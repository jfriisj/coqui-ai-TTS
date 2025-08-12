"""Enhanced TTS server using service architecture."""

import asyncio
import io
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from TTS.server.services.service_manager import get_service_manager
from TTS.server.services.synthesis_service import SynthesisRequest, SynthesisResponse
from TTS.server.services.model_management_service import ModelLoadRequest
from TTS.server.model_cache import ModelCacheManager


# Pydantic models for API
class TTSRequestAPI(BaseModel):
    """API request model for TTS synthesis."""
    text: str = Field(..., description="Text to synthesize", min_length=1, max_length=5000)
    speaker_name: Optional[str] = Field(None, description="Speaker name for multi-speaker models")
    language_name: Optional[str] = Field(None, description="Language name for multilingual models")
    speaker_wav: Optional[str] = Field(None, description="Path to speaker wav file for voice cloning")
    style_wav: Optional[str] = Field(None, description="Path to style wav file")
    output_format: str = Field("wav", description="Output audio format")
    split_sentences: bool = Field(True, description="Split text into sentences")


class BatchTTSRequestAPI(BaseModel):
    """API request model for batch TTS synthesis."""
    texts: List[str] = Field(..., description="List of texts to synthesize", min_items=1, max_items=10)
    speaker_name: Optional[str] = Field(None, description="Speaker name")
    language_name: Optional[str] = Field(None, description="Language name")
    output_format: str = Field("wav", description="Output audio format")


class ModelLoadRequestAPI(BaseModel):
    """API request model for model loading."""
    model_name: Optional[str] = Field(None, description="Name of model to load")
    model_path: Optional[str] = Field(None, description="Path to custom model")
    device: str = Field("cpu", description="Device to load model on")
    force_reload: bool = Field(False, description="Force reload if already loaded")


class ServiceBasedTTSServer:
    """TTS Server using service architecture."""
    
    def __init__(self, cache_manager: Optional[ModelCacheManager] = None):
        """Initialize the service-based TTS server.
        
        Args:
            cache_manager: Optional model cache manager
        """
        self.service_manager = get_service_manager(cache_manager)
        self.app = self._create_app()
    
    def _create_app(self) -> FastAPI:
        """Create and configure the FastAPI application."""
        app = FastAPI(
            title="Coqui TTS Server (Service Architecture)",
            description="Text-to-Speech server with service-based architecture",
            version="2.0.0",
            docs_url="/docs",
            redoc_url="/redoc"
        )
        
        # Add startup and shutdown event handlers
        app.add_event_handler("startup", self._startup_handler)
        app.add_event_handler("shutdown", self._shutdown_handler)
        
        # Add API routes
        self._add_routes(app)
        
        return app
    
    async def _startup_handler(self):
        """Handle server startup."""
        print("Initializing TTS server services...")
        result = await self.service_manager.initialize_all()
        if not result.success:
            print(f"Service initialization failed: {result.error_message}")
            raise RuntimeError("Failed to initialize services")
        print("TTS server services initialized successfully")
    
    async def _shutdown_handler(self):
        """Handle server shutdown."""
        print("Shutting down TTS server services...")
        await self.service_manager.cleanup_all()
        print("TTS server services shutdown complete")
    
    def _add_routes(self, app: FastAPI):
        """Add API routes to the FastAPI application."""
        
        @app.get("/api/v2/health")
        async def health_check():
            """Comprehensive health check using service architecture."""
            result = await self.service_manager.health_check_all()
            
            if result.success:
                return result.data
            else:
                raise HTTPException(status_code=503, detail=result.data)
        
        @app.post("/api/v2/tts")
        async def synthesize_speech(request_data: TTSRequestAPI):
            """Synthesize speech using the synthesis service."""
            synthesis_service = self.service_manager.get_synthesis_service()
            if not synthesis_service:
                raise HTTPException(status_code=503, detail="Synthesis service not available")
            
            # Convert API request to service request
            synthesis_request = SynthesisRequest(
                text=request_data.text,
                speaker_name=request_data.speaker_name,
                language_name=request_data.language_name,
                speaker_wav=request_data.speaker_wav,
                style_wav=request_data.style_wav,
                output_format=request_data.output_format,
                split_sentences=request_data.split_sentences
            )
            
            result = await synthesis_service.synthesize(synthesis_request)
            
            if result.success:
                response: SynthesisResponse = result.data
                
                # Return audio stream
                media_type_map = {
                    "wav": "audio/wav",
                    "mp3": "audio/mpeg",
                    "opus": "audio/opus",
                    "aac": "audio/aac",
                    "flac": "audio/flac",
                    "pcm": "audio/pcm"
                }
                
                media_type = media_type_map.get(response.format, "audio/wav")
                
                return StreamingResponse(
                    response.audio_data,
                    media_type=media_type,
                    headers={
                        "X-Synthesis-ID": response.synthesis_id,
                        "X-Duration": str(response.duration_seconds),
                        "X-Sample-Rate": str(response.sample_rate)
                    }
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": result.error_message,
                        "error_code": result.error_code,
                        "metadata": result.metadata
                    }
                )
        
        @app.post("/api/v2/tts/batch")
        async def batch_synthesize_speech(request_data: BatchTTSRequestAPI):
            """Batch synthesize speech using the synthesis service."""
            synthesis_service = self.service_manager.get_synthesis_service()
            if not synthesis_service:
                raise HTTPException(status_code=503, detail="Synthesis service not available")
            
            # Convert to individual synthesis requests
            synthesis_requests = [
                SynthesisRequest(
                    text=text,
                    speaker_name=request_data.speaker_name,
                    language_name=request_data.language_name,
                    output_format=request_data.output_format
                )
                for text in request_data.texts
            ]
            
            result = await synthesis_service.batch_synthesize(synthesis_requests)
            
            if result.success:
                # For now, return batch metadata
                # In a full implementation, you might return a zip file or individual responses
                return {
                    "batch_id": result.data["batch_id"],
                    "total_requests": result.data["total_requests"],
                    "successful_requests": result.data["successful_requests"],
                    "failed_requests": result.data["failed_requests"],
                    "success_rate": result.metadata["batch_statistics"]["success_rate"]
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": result.error_message,
                        "batch_results": result.data
                    }
                )
        
        @app.get("/api/v2/models/available")
        async def get_available_models():
            """Get available models using the model management service."""
            model_service = self.service_manager.get_model_management_service()
            if not model_service:
                raise HTTPException(status_code=503, detail="Model management service not available")
            
            result = await model_service.get_available_models()
            
            if result.success:
                return result.data
            else:
                raise HTTPException(status_code=500, detail=result.error_message)
        
        @app.get("/api/v2/models/current")
        async def get_current_model():
            """Get current model information using the model management service."""
            model_service = self.service_manager.get_model_management_service()
            if not model_service:
                raise HTTPException(status_code=503, detail="Model management service not available")
            
            result = await model_service.get_current_model()
            
            if result.success:
                return result.data
            else:
                if result.error_code == "NO_MODEL_LOADED":
                    raise HTTPException(status_code=404, detail=result.error_message)
                else:
                    raise HTTPException(status_code=500, detail=result.error_message)
        
        @app.post("/api/v2/models/load")
        async def load_model(request_data: ModelLoadRequestAPI):
            """Load a model using the model management service."""
            model_service = self.service_manager.get_model_management_service()
            if not model_service:
                raise HTTPException(status_code=503, detail="Model management service not available")
            
            # Convert API request to service request
            load_request = ModelLoadRequest(
                model_name=request_data.model_name,
                model_path=request_data.model_path,
                device=request_data.device,
                force_reload=request_data.force_reload
            )
            
            result = await model_service.load_model(load_request)
            
            if result.success:
                return result.data
            else:
                status_code = 400 if result.error_code in ["MODEL_NOT_FOUND", "INVALID_INPUT"] else 500
                raise HTTPException(status_code=status_code, detail=result.error_message)
        
        @app.get("/api/v2/models/status")
        async def get_model_loading_status():
            """Get model loading status using the model management service."""
            model_service = self.service_manager.get_model_management_service()
            if not model_service:
                raise HTTPException(status_code=503, detail="Model management service not available")
            
            result = await model_service.get_loading_status()
            
            if result.success:
                return result.data
            else:
                raise HTTPException(status_code=500, detail=result.error_message)
        
        @app.post("/api/v2/models/cancel")
        async def cancel_model_loading():
            """Cancel model loading using the model management service."""
            model_service = self.service_manager.get_model_management_service()
            if not model_service:
                raise HTTPException(status_code=503, detail="Model management service not available")
            
            result = await model_service.cancel_loading()
            
            if result.success:
                return result.data
            else:
                status_code = 400 if result.error_code == "NO_LOADING_OPERATION" else 500
                raise HTTPException(status_code=status_code, detail=result.error_message)
        
        @app.get("/api/v2/synthesis/active")
        async def get_active_syntheses():
            """Get active synthesis operations."""
            synthesis_service = self.service_manager.get_synthesis_service()
            if not synthesis_service:
                raise HTTPException(status_code=503, detail="Synthesis service not available")
            
            result = await synthesis_service.get_active_syntheses()
            
            if result.success:
                return result.data
            else:
                raise HTTPException(status_code=500, detail=result.error_message)
        
        @app.post("/api/v2/services/restart/{service_name}")
        async def restart_service(service_name: str):
            """Restart a specific service."""
            result = await self.service_manager.restart_service(service_name)
            
            if result.success:
                return result.data
            else:
                status_code = 404 if result.error_code == "SERVICE_NOT_FOUND" else 500
                raise HTTPException(status_code=status_code, detail=result.error_message)


# Example usage and integration
def create_service_based_app(cache_manager: Optional[ModelCacheManager] = None) -> FastAPI:
    """Create a service-based TTS server application.
    
    Args:
        cache_manager: Optional model cache manager
        
    Returns:
        Configured FastAPI application
    """
    server = ServiceBasedTTSServer(cache_manager)
    return server.app


# For backward compatibility and testing
if __name__ == "__main__":
    import uvicorn
    from TTS.server.model_cache import ModelCacheManager
    
    # Create cache manager
    cache_manager = ModelCacheManager(
        max_memory_mb=4096,
        max_entries=10
    )
    
    # Create app
    app = create_service_based_app(cache_manager)
    
    # Run server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5002,
        log_level="info"
    )
