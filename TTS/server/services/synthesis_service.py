"""Synthesis service for TTS operations."""

import asyncio
import io
import uuid
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, field
from pathlib import Path
import torch
import torchaudio

from TTS.server.services.base_service import BaseService, ServiceResult
from TTS.server.model_state import get_global_model_state, GlobalModelState
from TTS.server.error_handlers import handle_tts_error, create_model_loading_error


@dataclass
class SynthesisRequest:
    """Request structure for TTS synthesis."""
    text: str
    speaker_name: Optional[str] = None
    language_name: Optional[str] = None
    speaker_wav: Optional[str] = None
    style_wav: Optional[str] = None
    style_text: Optional[str] = None
    split_sentences: bool = True
    output_format: str = "wav"
    voice_dir: Optional[str] = None


@dataclass
class SynthesisResponse:
    """Response structure for TTS synthesis."""
    audio_data: io.BytesIO
    format: str
    sample_rate: int
    duration_seconds: float
    synthesis_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)


class SynthesisService(BaseService):
    """Service for handling TTS synthesis operations."""
    
    def __init__(self):
        """Initialize the synthesis service."""
        super().__init__("synthesis")
        self.global_model_state: Optional[GlobalModelState] = None
        self._active_syntheses: Dict[str, Dict[str, Any]] = {}
        self._synthesis_lock = asyncio.Lock()
    
    async def initialize(self) -> ServiceResult:
        """Initialize the synthesis service."""
        try:
            self.global_model_state = get_global_model_state()
            self._mark_initialized()
            return ServiceResult(success=True, data={"message": "Synthesis service initialized"})
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def cleanup(self) -> ServiceResult:
        """Cleanup synthesis service resources."""
        try:
            # Cancel any active syntheses
            for synthesis_id in list(self._active_syntheses.keys()):
                await self.cancel_synthesis(synthesis_id)
            
            self._mark_uninitialized()
            return ServiceResult(success=True, data={"message": "Synthesis service cleanup completed"})
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def health_check(self) -> ServiceResult:
        """Check synthesis service health."""
        try:
            health_data = {
                "service_name": self.name,
                "initialized": self.is_initialized(),
                "model_loaded": (
                    self.global_model_state is not None and 
                    self.global_model_state.current_model is not None
                ),
                "active_syntheses": len(self._active_syntheses),
                "is_loading": (
                    self.global_model_state.is_loading if self.global_model_state else False
                )
            }
            
            if self.global_model_state and self.global_model_state.current_model:
                current_model = self.global_model_state.current_model
                health_data.update({
                    "current_model": {
                        "name": current_model.model_name,
                        "multi_speaker": current_model.is_multi_speaker,
                        "multi_lingual": current_model.is_multi_lingual,
                        "speakers_count": len(current_model.speakers) if current_model.speakers else 0,
                        "languages_count": len(current_model.languages) if current_model.languages else 0
                    }
                })
            
            return ServiceResult(success=True, data=health_data)
        except Exception as e:
            return ServiceResult(success=False, error_message=str(e))
    
    async def synthesize(self, request: SynthesisRequest) -> ServiceResult:
        """Perform TTS synthesis.
        
        Args:
            request: Synthesis request parameters
            
        Returns:
            ServiceResult with SynthesisResponse or error
        """
        # Input validation
        if not request.text.strip():
            return ServiceResult(
                success=False,
                error_message="Text parameter is required and cannot be empty",
                error_code="INVALID_INPUT"
            )
        
        if len(request.text) > 5000:
            return ServiceResult(
                success=False,
                error_message="Text parameter exceeds maximum length (5000 characters)",
                error_code="TEXT_TOO_LONG"
            )
        
        # Check if model is loaded
        if not self.global_model_state or not self.global_model_state.current_model:
            return ServiceResult(
                success=False,
                error_message="No TTS model is currently loaded",
                error_code="NO_MODEL_LOADED"
            )
        
        synthesis_id = str(uuid.uuid4())[:8]
        
        async with self._synthesis_lock:
            try:
                # Register synthesis operation
                self._active_syntheses[synthesis_id] = {
                    "text": request.text[:100] + "..." if len(request.text) > 100 else request.text,
                    "started_at": asyncio.get_event_loop().time(),
                    "status": "in_progress"
                }
                
                self.global_model_state.register_synthesis(synthesis_id)
                
                current_model = self.global_model_state.current_model
                
                self.logger.info(f"Starting synthesis {synthesis_id} with model {current_model.model_name}")
                
                # Prepare synthesis parameters
                tts_kwargs = {
                    "text": request.text,
                    "speaker_name": request.speaker_name or "",
                    "language_name": request.language_name or "",
                    "split_sentences": request.split_sentences
                }
                
                # Add optional parameters if provided
                if request.speaker_wav:
                    tts_kwargs["speaker_wav"] = request.speaker_wav
                if request.style_wav:
                    tts_kwargs["style_wav"] = request.style_wav
                if request.style_text:
                    tts_kwargs["style_text"] = request.style_text
                if request.voice_dir:
                    tts_kwargs["voice_dir"] = request.voice_dir
                
                # Remove None values
                tts_kwargs = {k: v for k, v in tts_kwargs.items() if v is not None}
                
                # Perform synthesis
                start_time = asyncio.get_event_loop().time()
                
                try:
                    wavs = current_model.tts_instance.synthesizer.tts(**tts_kwargs)
                except Exception as e:
                    self.logger.error(f"TTS synthesis failed for {synthesis_id}: {str(e)}")
                    error_response = handle_tts_error(e, "synthesis", {"synthesis_id": synthesis_id})
                    return ServiceResult(
                        success=False,
                        error_message=error_response.get("error", str(e)),
                        error_code="SYNTHESIS_FAILED",
                        metadata=error_response
                    )
                
                synthesis_time = asyncio.get_event_loop().time() - start_time
                
                # Convert to audio buffer
                audio_buffer = io.BytesIO()
                current_model.tts_instance.synthesizer.save_wav(wavs, audio_buffer)
                audio_buffer.seek(0)
                
                # Get audio metadata
                try:
                    waveform, sample_rate = torchaudio.load(audio_buffer)
                    duration_seconds = waveform.shape[1] / sample_rate
                    audio_buffer.seek(0)  # Reset buffer position
                except Exception:
                    # Fallback values if metadata extraction fails
                    sample_rate = 22050
                    duration_seconds = len(wavs) / sample_rate if isinstance(wavs, list) else 0.0
                
                # Handle format conversion if needed
                final_buffer = await self._convert_audio_format(
                    audio_buffer, request.output_format, sample_rate
                )
                
                # Create response
                response = SynthesisResponse(
                    audio_data=final_buffer,
                    format=request.output_format,
                    sample_rate=sample_rate,
                    duration_seconds=duration_seconds,
                    synthesis_id=synthesis_id,
                    metadata={
                        "model_name": current_model.model_name,
                        "synthesis_time_seconds": round(synthesis_time, 3),
                        "text_length": len(request.text),
                        "parameters_used": {k: v for k, v in tts_kwargs.items() if k != "text"}
                    }
                )
                
                self.logger.info(f"Synthesis {synthesis_id} completed in {synthesis_time:.3f}s")
                
                # Update synthesis tracking
                self._active_syntheses[synthesis_id]["status"] = "completed"
                self._active_syntheses[synthesis_id]["duration"] = synthesis_time
                
                return ServiceResult(success=True, data=response)
                
            except Exception as e:
                self.logger.error(f"Synthesis error for {synthesis_id}: {str(e)}", exc_info=True)
                self._active_syntheses[synthesis_id]["status"] = "failed"
                self._active_syntheses[synthesis_id]["error"] = str(e)
                
                error_response = handle_tts_error(e, "synthesis", {"synthesis_id": synthesis_id})
                return ServiceResult(
                    success=False,
                    error_message=str(e),
                    error_code="SYNTHESIS_ERROR",
                    metadata=error_response
                )
            finally:
                # Always unregister synthesis
                if self.global_model_state:
                    self.global_model_state.unregister_synthesis(synthesis_id)
                
                # Cleanup old synthesis records (keep last 10)
                if len(self._active_syntheses) > 10:
                    oldest_keys = list(self._active_syntheses.keys())[:-10]
                    for key in oldest_keys:
                        self._active_syntheses.pop(key, None)
    
    async def batch_synthesize(self, requests: List[SynthesisRequest]) -> ServiceResult:
        """Perform batch TTS synthesis.
        
        Args:
            requests: List of synthesis requests
            
        Returns:
            ServiceResult with list of SynthesisResponse or error
        """
        if not requests:
            return ServiceResult(
                success=False,
                error_message="No synthesis requests provided",
                error_code="EMPTY_BATCH"
            )
        
        if len(requests) > 10:
            return ServiceResult(
                success=False,
                error_message="Batch size exceeds maximum limit (10)",
                error_code="BATCH_TOO_LARGE"
            )
        
        batch_id = str(uuid.uuid4())[:8]
        self.logger.info(f"Starting batch synthesis {batch_id} with {len(requests)} requests")
        
        results = []
        failed_count = 0
        
        for i, request in enumerate(requests):
            self.logger.debug(f"Processing batch item {i+1}/{len(requests)} in batch {batch_id}")
            
            result = await self.synthesize(request)
            results.append(result)
            
            if not result.success:
                failed_count += 1
                self.logger.warning(f"Batch item {i+1} failed: {result.error_message}")
        
        batch_success = failed_count == 0
        
        return ServiceResult(
            success=batch_success,
            data={
                "batch_id": batch_id,
                "results": results,
                "total_requests": len(requests),
                "successful_requests": len(requests) - failed_count,
                "failed_requests": failed_count
            },
            metadata={
                "batch_statistics": {
                    "success_rate": round((len(requests) - failed_count) / len(requests) * 100, 1),
                    "partial_success": failed_count > 0 and failed_count < len(requests)
                }
            }
        )
    
    async def cancel_synthesis(self, synthesis_id: str) -> ServiceResult:
        """Cancel an active synthesis operation.
        
        Args:
            synthesis_id: ID of synthesis to cancel
            
        Returns:
            ServiceResult indicating success or failure
        """
        if synthesis_id not in self._active_syntheses:
            return ServiceResult(
                success=False,
                error_message=f"Synthesis {synthesis_id} not found or already completed",
                error_code="SYNTHESIS_NOT_FOUND"
            )
        
        try:
            # Mark as cancelled
            self._active_syntheses[synthesis_id]["status"] = "cancelled"
            
            # Unregister from global state
            if self.global_model_state:
                self.global_model_state.unregister_synthesis(synthesis_id)
            
            self.logger.info(f"Synthesis {synthesis_id} cancelled")
            
            return ServiceResult(
                success=True,
                data={"synthesis_id": synthesis_id, "status": "cancelled"}
            )
        except Exception as e:
            return ServiceResult(
                success=False,
                error_message=f"Failed to cancel synthesis: {str(e)}",
                error_code="CANCELLATION_FAILED"
            )
    
    async def get_synthesis_status(self, synthesis_id: str) -> ServiceResult:
        """Get status of a synthesis operation.
        
        Args:
            synthesis_id: ID of synthesis to check
            
        Returns:
            ServiceResult with synthesis status
        """
        if synthesis_id not in self._active_syntheses:
            return ServiceResult(
                success=False,
                error_message=f"Synthesis {synthesis_id} not found",
                error_code="SYNTHESIS_NOT_FOUND"
            )
        
        status_info = self._active_syntheses[synthesis_id].copy()
        status_info["synthesis_id"] = synthesis_id
        
        return ServiceResult(success=True, data=status_info)
    
    async def get_active_syntheses(self) -> ServiceResult:
        """Get list of all active syntheses.
        
        Returns:
            ServiceResult with active syntheses information
        """
        active_list = []
        for synthesis_id, info in self._active_syntheses.items():
            if info["status"] == "in_progress":
                active_list.append({
                    "synthesis_id": synthesis_id,
                    "text_preview": info["text"],
                    "started_at": info["started_at"]
                })
        
        return ServiceResult(
            success=True,
            data={
                "active_syntheses": active_list,
                "total_active": len(active_list),
                "total_tracked": len(self._active_syntheses)
            }
        )
    
    async def _convert_audio_format(self, audio_buffer: io.BytesIO, target_format: str, sample_rate: int) -> io.BytesIO:
        """Convert audio to target format.
        
        Args:
            audio_buffer: Input audio buffer
            target_format: Target format (wav, mp3, etc.)
            sample_rate: Audio sample rate
            
        Returns:
            Converted audio buffer
        """
        if target_format.lower() == "wav":
            return audio_buffer
        
        try:
            # Load audio
            audio_buffer.seek(0)
            waveform, original_sample_rate = torchaudio.load(audio_buffer)
            
            # Convert format
            output_buffer = io.BytesIO()
            
            format_configs = {
                "mp3": {"format": "mp3"},
                "opus": {"format": "ogg", "encoding": "opus"},
                "aac": {"format": "mp4", "encoding": "aac"},
                "flac": {"format": "flac"},
                "pcm": None  # Special handling for PCM
            }
            
            if target_format.lower() == "pcm":
                # Raw PCM (16-bit little-endian)
                waveform_int16 = (waveform * 32767).to(torch.int16)
                output_buffer.write(waveform_int16.numpy().tobytes())
            else:
                config = format_configs.get(target_format.lower())
                if config:
                    torchaudio.save(output_buffer, waveform, sample_rate, **config)
                else:
                    # Fallback to WAV
                    torchaudio.save(output_buffer, waveform, sample_rate, format="wav")
            
            output_buffer.seek(0)
            return output_buffer
            
        except Exception as e:
            self.logger.warning(f"Audio format conversion failed, returning original: {str(e)}")
            audio_buffer.seek(0)
            return audio_buffer
