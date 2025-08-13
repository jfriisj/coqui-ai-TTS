"""Model management service for TTS operations."""

import asyncio
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass

from TTS.server.services.base_service import BaseService, ServiceResult
from TTS.server.services.model_state import get_global_model_state, GlobalModelState
from TTS.server.services.model_cache import ModelCacheManager
from TTS.server.services.model_registry import ModelRegistry, get_model_registry
from TTS.utils.manage import ModelManager
from TTS.api import TTS


@dataclass
class ModelInfo:
    """Information about a TTS model."""
    name: str
    display_name: str
    model_type: str
    language: str
    dataset: str
    architecture: str
    capabilities: Dict[str, Any]
    performance: Dict[str, Any]
    cached: bool = False
    available: bool = True
    estimated_load_time: int = 30


@dataclass
class ModelLoadRequest:
    """Request to load a model."""
    model_name: Optional[str] = None
    model_path: Optional[str] = None
    config_path: Optional[str] = None
    vocoder_name: Optional[str] = None
    vocoder_path: Optional[str] = None
    vocoder_config_path: Optional[str] = None
    device: str = "cpu"
    force_reload: bool = False
    use_cache: bool = True


class ModelManagementService(BaseService):
    """Service for managing TTS models."""
    
    def __init__(self, cache_manager: Optional[ModelCacheManager] = None):
        """Initialize the model management service.
        
        Args:
            cache_manager: Optional model cache manager instance
        """
        super().__init__("model_management")
        self.global_model_state: Optional[GlobalModelState] = None
        self.cache_manager = cache_manager
        self.model_registry: Optional[ModelRegistry] = None
        self.model_manager: Optional[ModelManager] = None
        self._loading_lock = asyncio.Lock()
    
    async def initialize(self) -> ServiceResult:
        """Initialize the model management service."""
        try:
            # Initialize global model state
            self.global_model_state = get_global_model_state()
            
            # Initialize model manager
            self.model_manager = ModelManager(models_file=TTS.get_models_file_path())
            
            # Initialize model registry
            self.model_registry = get_model_registry()
            if not self.model_registry.start_monitoring():
                self.logger.warning("Failed to start model registry monitoring, continuing without it")
            
            self._mark_initialized()
            return ServiceResult(
                success=True,
                data={
                    "message": "Model management service initialized",
                    "cache_enabled": self.cache_manager is not None,
                    "registry_monitoring": self.model_registry is not None
                }
            )
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def cleanup(self) -> ServiceResult:
        """Cleanup model management service resources."""
        try:
            # Stop model registry monitoring
            if self.model_registry:
                self.model_registry.stop_monitoring()
            
            # Cleanup cache if present
            if self.cache_manager:
                self.cache_manager.persist_cache()
            
            self._mark_uninitialized()
            return ServiceResult(success=True, data={"message": "Model management service cleanup completed"})
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def health_check(self) -> ServiceResult:
        """Check model management service health."""
        try:
            health_data = {
                "service_name": self.name,
                "initialized": self.is_initialized(),
                "global_model_state": self.global_model_state is not None,
                "model_manager": self.model_manager is not None,
                "cache_manager": self.cache_manager is not None,
                "registry_monitoring": False
            }
            
            # Check current model status
            if self.global_model_state:
                current_model = self.global_model_state.current_model
                health_data.update({
                    "current_model_loaded": current_model is not None,
                    "is_loading": self.global_model_state.is_loading,
                    "has_active_synthesis": self.global_model_state.has_active_synthesis
                })
                
                if current_model:
                    health_data["current_model_info"] = {
                        "name": current_model.model_name,
                        "device": current_model.device,
                        "load_time": current_model.load_time,
                        "memory_usage": current_model.memory_usage
                    }
            
            # Check cache status
            if self.cache_manager:
                cache_stats = self.cache_manager.get_cache_stats()
                health_data["cache_info"] = {
                    "total_entries": cache_stats.total_entries,
                    "total_size_mb": round(cache_stats.total_size / (1024 * 1024), 1),
                    "hit_rate": round(cache_stats.hit_rate * 100, 1),
                    "memory_usage_percent": round(cache_stats.memory_usage_percent, 1)
                }
            
            # Check registry status
            if self.model_registry:
                registry_stats = self.model_registry.get_registry_stats()
                health_data.update({
                    "registry_monitoring": registry_stats.state.name == "MONITORING",
                    "registry_models_count": registry_stats.models_count,
                    "registry_last_refresh": registry_stats.last_refresh
                })
            
            return ServiceResult(success=True, data=health_data)
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def load_model(self, request: ModelLoadRequest) -> ServiceResult:
        """Load a TTS model.
        
        Args:
            request: Model loading request
            
        Returns:
            ServiceResult with loading status
        """
        if not self.global_model_state:
            return ServiceResult(
                success=False,
                error_message="Model management service not initialized",
                error_code="SERVICE_NOT_INITIALIZED"
            )
        
        model_identifier = request.model_name or request.model_path or "custom_model"
        
        async with self._loading_lock:
            # Check if already loading
            if self.global_model_state.is_loading:
                loading_status = self.global_model_state.loading_status
                if loading_status.target_model == model_identifier:
                    return ServiceResult(
                        success=True,
                        data={
                            "message": "Model loading already in progress",
                            "model_name": model_identifier,
                            "status": "loading"
                        }
                    )
                else:
                    return ServiceResult(
                        success=False,
                        error_message="Another model is currently loading",
                        error_code="LOADING_IN_PROGRESS"
                    )
            
            # Check if model is already loaded and not forcing reload
            current_model = self.global_model_state.current_model
            if (not request.force_reload and current_model and 
                current_model.model_name == model_identifier):
                return ServiceResult(
                    success=True,
                    data={
                        "message": "Model is already loaded",
                        "model_name": model_identifier,
                        "status": "loaded",
                        "load_time": current_model.load_time
                    }
                )
            
            try:
                # Validate model exists if using model name
                if request.model_name and self.model_manager:
                    available_models = self.model_manager.list_models()
                    if request.model_name not in available_models:
                        # Try to suggest alternatives
                        suggestions = [m for m in available_models 
                                     if any(part in m for part in request.model_name.split('/'))]
                        suggestion_text = f" Suggestions: {', '.join(suggestions[:3])}" if suggestions else ""
                        return ServiceResult(
                            success=False,
                            error_message=f"Model '{request.model_name}' not found.{suggestion_text}",
                            error_code="MODEL_NOT_FOUND"
                        )
                
                # Check cache first if enabled
                if request.use_cache and self.cache_manager and request.model_name:
                    cached_model = self.cache_manager.get_cached_model(request.model_name)
                    if cached_model:
                        self.logger.info(f"Loading model {request.model_name} from cache")
                        # Note: We'd need to integrate cached model loading with GlobalModelState
                        # For now, proceed with normal loading
                
                # Start loading
                start_time = time.time()
                success = await self.global_model_state.load_model_async(
                    model_name=request.model_name,
                    model_path=request.model_path,
                    config_path=request.config_path,
                    vocoder_name=request.vocoder_name,
                    vocoder_path=request.vocoder_path,
                    vocoder_config_path=request.vocoder_config_path,
                    device=request.device,
                    progress_bar=False
                )
                
                load_time = time.time() - start_time
                
                if success:
                    # Cache the loaded model if caching is enabled
                    if (request.use_cache and self.cache_manager and 
                        self.global_model_state.current_model):
                        try:
                            current_model = self.global_model_state.current_model
                            estimated_memory = self.cache_manager.estimate_memory_usage(
                                current_model.model_name
                            )
                            self.cache_manager.cache_model(
                                current_model.model_name,
                                current_model.tts_instance,
                                estimated_memory
                            )
                            self.logger.info(f"Model {current_model.model_name} cached successfully")
                        except Exception as e:
                            self.logger.warning(f"Failed to cache model: {str(e)}")
                    
                    loaded_model = self.global_model_state.current_model
                    return ServiceResult(
                        success=True,
                        data={
                            "message": "Model loaded successfully",
                            "model_name": loaded_model.model_name,
                            "status": "loaded",
                            "load_time": round(load_time, 2),
                            "capabilities": {
                                "multi_speaker": loaded_model.is_multi_speaker,
                                "multi_lingual": loaded_model.is_multi_lingual,
                                "speakers_count": len(loaded_model.speakers) if loaded_model.speakers else 0,
                                "languages_count": len(loaded_model.languages) if loaded_model.languages else 0
                            }
                        }
                    )
                else:
                    return ServiceResult(
                        success=False,
                        error_message="Model loading failed",
                        error_code="LOADING_FAILED"
                    )
                
            except Exception as e:
                self.logger.error(f"Model loading error: {str(e)}", exc_info=True)
                return ServiceResult(
                    success=False,
                    error_message=f"Model loading error: {str(e)}",
                    error_code="LOADING_ERROR"
                )
    
    async def get_available_models(self) -> ServiceResult:
        """Get list of available models.
        
        Returns:
            ServiceResult with list of available models
        """
        try:
            if not self.model_manager:
                return ServiceResult(
                    success=False,
                    error_message="Model manager not initialized",
                    error_code="SERVICE_NOT_INITIALIZED"
                )
            
            models_list = self.model_manager.list_models()
            models_data = []
            
            for model_name in models_list:
                model_info = await self._get_model_info(model_name)
                models_data.append(model_info)
            
            return ServiceResult(
                success=True,
                data={
                    "models": models_data,
                    "total_count": len(models_data)
                }
            )
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def get_current_model(self) -> ServiceResult:
        """Get information about the currently loaded model.
        
        Returns:
            ServiceResult with current model information
        """
        try:
            if not self.global_model_state:
                return ServiceResult(
                    success=False,
                    error_message="Model management service not initialized",
                    error_code="SERVICE_NOT_INITIALIZED"
                )
            
            current_model = self.global_model_state.current_model
            if not current_model:
                return ServiceResult(
                    success=False,
                    error_message="No model currently loaded",
                    error_code="NO_MODEL_LOADED"
                )
            
            # Create display name from model name
            name_parts = current_model.model_name.split('/')
            display_name = f"{name_parts[3].title() if len(name_parts) > 3 else 'Unknown'} - {name_parts[2].upper() if len(name_parts) > 2 else 'Unknown'} ({name_parts[1].upper() if len(name_parts) > 1 else 'Unknown'})"
            
            model_data = {
                "model_name": current_model.model_name,
                "display_name": display_name,
                "device": current_model.device,
                "capabilities": {
                    "multi_speaker": current_model.is_multi_speaker,
                    "multi_lingual": current_model.is_multi_lingual,
                    "speakers": current_model.speakers or [],
                    "languages": current_model.languages or [],
                    "voice_cloning": self._check_voice_cloning_support(current_model)
                },
                "performance": {
                    "load_time": round(current_model.load_time, 2),
                    "memory_usage": int(current_model.memory_usage)
                },
                "loaded_at": time.time()  # Approximate
            }
            
            return ServiceResult(success=True, data=model_data)
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def get_loading_status(self) -> ServiceResult:
        """Get current model loading status.
        
        Returns:
            ServiceResult with loading status information
        """
        try:
            if not self.global_model_state:
                return ServiceResult(
                    success=False,
                    error_message="Model management service not initialized",
                    error_code="SERVICE_NOT_INITIALIZED"
                )
            
            loading_progress = self.global_model_state.get_loading_progress()
            
            # Calculate time remaining
            time_remaining = 0
            if loading_progress["is_loading"] and loading_progress["progress"] > 0:
                elapsed_time = time.time() - loading_progress.get("start_time", time.time())
                if loading_progress["progress"] > 0:
                    total_estimated = elapsed_time / (loading_progress["progress"] / 100)
                    time_remaining = max(0, int(total_estimated - elapsed_time))
            
            status_data = {
                "is_loading": loading_progress["is_loading"],
                "progress": round(loading_progress["progress"], 1),
                "stage": loading_progress["message"],
                "time_remaining": time_remaining,
                "can_cancel": loading_progress["is_loading"],
                "target_model": self.global_model_state.loading_status.target_model
            }
            
            return ServiceResult(success=True, data=status_data)
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def cancel_loading(self) -> ServiceResult:
        """Cancel current model loading operation.
        
        Returns:
            ServiceResult indicating success or failure
        """
        try:
            if not self.global_model_state:
                return ServiceResult(
                    success=False,
                    error_message="Model management service not initialized",
                    error_code="SERVICE_NOT_INITIALIZED"
                )
            
            if not self.global_model_state.is_loading:
                return ServiceResult(
                    success=False,
                    error_message="No model loading operation in progress",
                    error_code="NO_LOADING_OPERATION"
                )
            
            success = self.global_model_state.cancel_loading()
            
            if success:
                return ServiceResult(
                    success=True,
                    data={"message": "Model loading cancelled successfully"}
                )
            else:
                return ServiceResult(
                    success=False,
                    error_message="Failed to cancel model loading",
                    error_code="CANCELLATION_FAILED"
                )
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def _get_model_info(self, model_name: str) -> ModelInfo:
        """Get detailed information about a model.
        
        Args:
            model_name: Name of the model
            
        Returns:
            ModelInfo object with model details
        """
        # Extract model components from name
        name_parts = model_name.split('/')
        model_type = name_parts[0] if len(name_parts) > 0 else "unknown"
        language = name_parts[1] if len(name_parts) > 1 else "unknown"
        dataset = name_parts[2] if len(name_parts) > 2 else "unknown"
        architecture = name_parts[3] if len(name_parts) > 3 else "unknown"
        
        # Determine capabilities based on model type and name
        capabilities = {
            "multi_speaker": "multi" in model_name.lower() or "vctk" in model_name.lower() or "yourtts" in model_name.lower(),
            "multi_lingual": "multi" in model_name.lower() or "yourtts" in model_name.lower() or "bark" in model_name.lower(),
            "voice_cloning": "xtts" in model_name.lower() or "yourtts" in model_name.lower(),
            "style_transfer": "gst" in model_name.lower() or "capacitron" in model_name.lower()
        }
        
        # Estimate performance characteristics
        performance = {
            "quality": "high" if any(x in model_name.lower() for x in ["xtts", "vits", "yourtts"]) else "medium",
            "speed": "fast" if "fast" in model_name.lower() else "medium",
            "memory_usage_mb": (self.cache_manager.estimate_memory_usage(model_name) // (1024 * 1024)) if self.cache_manager else 512
        }
        
        # Check if model is cached
        cached = False
        if self.cache_manager:
            cached = model_name in self.cache_manager._cache_entries
        
        # Create display name
        display_name = f"{architecture.title()} - {dataset.upper()} ({language.upper()})"
        
        return ModelInfo(
            name=model_name,
            display_name=display_name,
            model_type=architecture,
            language=language,
            dataset=dataset,
            architecture=architecture,
            capabilities=capabilities,
            performance=performance,
            cached=cached,
            estimated_load_time=15 if cached else 30
        )
    
    def _check_voice_cloning_support(self, model_state) -> bool:
        """Check if the model supports voice cloning.
        
        Args:
            model_state: Current model state
            
        Returns:
            True if voice cloning is supported
        """
        if not model_state.tts_instance:
            return False
        
        tts_instance = model_state.tts_instance
        
        # Check if voice cloning is supported
        if (hasattr(tts_instance, 'synthesizer') and
            hasattr(tts_instance.synthesizer, 'tts_config') and
            hasattr(tts_instance.synthesizer.tts_config, 'supports_cloning')):
            return tts_instance.synthesizer.tts_config.supports_cloning
        
        # Fallback: check model name
        return "xtts" in model_state.model_name.lower() or "yourtts" in model_state.model_name.lower()
