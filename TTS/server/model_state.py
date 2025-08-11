"""Global model state manager for TTS server.

This module provides thread-safe model loading, switching, and state management
for the TTS server. It includes progress tracking, cancellation capability,
and proper memory cleanup.
"""

import asyncio
import logging
import threading
import weakref
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, Optional, Set
import gc
import torch

from TTS.api import TTS
from TTS.utils.manage import ModelManager

logger = logging.getLogger(__name__)


class LoadingState(Enum):
    """Enumeration of model loading states."""
    IDLE = auto()
    LOADING = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()


@dataclass
class ModelState:
    """Represents the state of a loaded TTS model."""
    model_name: str
    tts_instance: Optional[TTS] = None
    config_path: Optional[str] = None
    model_path: Optional[str] = None
    vocoder_name: Optional[str] = None
    device: str = "cpu"
    is_multi_speaker: bool = False
    is_multi_lingual: bool = False
    speakers: Optional[list[str]] = None
    languages: Optional[list[str]] = None
    load_time: float = 0.0
    memory_usage: float = 0.0


@dataclass
class LoadingStatus:
    """Tracks the status and progress of model loading operations."""
    state: LoadingState = LoadingState.IDLE
    current_model: Optional[str] = None
    target_model: Optional[str] = None
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None
    start_time: float = 0.0
    cancellation_token: Optional[asyncio.Event] = field(default_factory=asyncio.Event)


class GlobalModelState:
    """Thread-safe global model state manager for TTS server.
    
    This singleton class manages model loading, switching, and cleanup operations
    with support for progress tracking, cancellation, and memory management.
    """
    
    _instance: Optional['GlobalModelState'] = None
    _lock = threading.RLock()
    
    def __new__(cls) -> 'GlobalModelState':
        """Ensure singleton pattern."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self) -> None:
        """Initialize the global model state manager."""
        if self._initialized:
            return
        
        self._initialized = True
        self._model_state: Optional[ModelState] = None
        self._loading_status = LoadingStatus()
        self._model_manager: Optional[ModelManager] = None
        self._active_synthesis_count = 0
        self._synthesis_lock = threading.RLock()
        self._loading_lock = threading.RLock()
        self._progress_callbacks: Set[Callable[[LoadingStatus], None]] = set()
        
        # Track active synthesis operations (using regular set for string IDs)
        self._active_syntheses: Set[Any] = set()
        
        logger.info("GlobalModelState initialized")
    
    @property
    def current_model(self) -> Optional[ModelState]:
        """Get the currently loaded model state."""
        with self._lock:
            return self._model_state
    
    @property
    def loading_status(self) -> LoadingStatus:
        """Get the current loading status."""
        with self._lock:
            return self._loading_status
    
    @property
    def is_loading(self) -> bool:
        """Check if a model is currently being loaded."""
        with self._lock:
            return self._loading_status.state == LoadingState.LOADING
    
    @property
    def has_active_synthesis(self) -> bool:
        """Check if there are active synthesis operations."""
        with self._synthesis_lock:
            return self._active_synthesis_count > 0
    
    def register_progress_callback(self, callback: Callable[[LoadingStatus], None]) -> None:
        """Register a callback to receive loading progress updates.
        
        Args:
            callback: Function to call with LoadingStatus updates
        """
        self._progress_callbacks.add(callback)
    
    def unregister_progress_callback(self, callback: Callable[[LoadingStatus], None]) -> None:
        """Unregister a progress callback.
        
        Args:
            callback: Function to remove from callbacks
        """
        self._progress_callbacks.discard(callback)
    
    def _notify_progress(self) -> None:
        """Notify all registered callbacks about progress updates."""
        status_copy = LoadingStatus(
            state=self._loading_status.state,
            current_model=self._loading_status.current_model,
            target_model=self._loading_status.target_model,
            progress=self._loading_status.progress,
            message=self._loading_status.message,
            error=self._loading_status.error,
            start_time=self._loading_status.start_time
        )
        
        for callback in self._progress_callbacks.copy():
            try:
                callback(status_copy)
            except Exception as e:
                logger.warning("Progress callback failed: %s", e)
    
    def _cleanup_current_model(self) -> None:
        """Clean up the currently loaded model to free memory."""
        if self._model_state and self._model_state.tts_instance:
            try:
                logger.info("Cleaning up model: %s", self._model_state.model_name)
                
                # Move model to CPU and clear CUDA cache if needed
                if hasattr(self._model_state.tts_instance, 'synthesizer') and \
                   self._model_state.tts_instance.synthesizer:
                    try:
                        if hasattr(self._model_state.tts_instance.synthesizer, 'tts_model'):
                            self._model_state.tts_instance.synthesizer.tts_model.cpu()
                        if hasattr(self._model_state.tts_instance.synthesizer, 'vocoder_model') and \
                           self._model_state.tts_instance.synthesizer.vocoder_model:
                            self._model_state.tts_instance.synthesizer.vocoder_model.cpu()
                    except Exception as e:
                        logger.warning("Error moving models to CPU: %s", e)
                
                # Clear references
                self._model_state.tts_instance = None
                
                # Force garbage collection
                gc.collect()
                
                # Clear CUDA cache if available
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                logger.info("Model cleanup completed")
                
            except Exception as e:
                logger.error("Error during model cleanup: %s", e)
    
    def _update_loading_progress(self, progress: float, message: str) -> None:
        """Update loading progress and notify callbacks."""
        with self._lock:
            self._loading_status.progress = min(100.0, max(0.0, progress))
            self._loading_status.message = message
            self._notify_progress()
    
    async def load_model_async(
        self,
        model_name: Optional[str] = None,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None,
        vocoder_name: Optional[str] = None,
        vocoder_path: Optional[str] = None,
        vocoder_config_path: Optional[str] = None,
        device: str = "cpu",
        progress_bar: bool = True,
        **kwargs
    ) -> bool:
        """Asynchronously load a TTS model with progress tracking.
        
        Args:
            model_name: Name of pre-trained model to load
            model_path: Path to custom model checkpoint
            config_path: Path to model config file
            vocoder_name: Name of vocoder model
            vocoder_path: Path to vocoder checkpoint
            vocoder_config_path: Path to vocoder config
            device: Device to load model on ("cpu", "cuda", etc.)
            progress_bar: Whether to show progress during download
            **kwargs: Additional arguments for TTS initialization
        
        Returns:
            True if loading succeeded, False otherwise
        """
        target_model = model_name or model_path or "custom_model"
        
        with self._loading_lock:
            # Check if already loading the same model
            if self.is_loading and self._loading_status.target_model == target_model:
                logger.info("Model %s is already being loaded, waiting...", target_model)
                while self.is_loading:
                    await asyncio.sleep(0.1)
                    if self._loading_status.cancellation_token.is_set():
                        return False
                return self._loading_status.state == LoadingState.COMPLETED
            
            # Check if model is already loaded
            if (self._model_state and 
                ((model_name and self._model_state.model_name == model_name) or
                 (model_path and self._model_state.model_path == model_path))):
                logger.info("Model %s is already loaded", target_model)
                return True
            
            # Wait for active synthesis to complete
            if self.has_active_synthesis:
                logger.info("Waiting for active synthesis to complete before switching models...")
                self._update_loading_progress(5.0, "Waiting for active synthesis to complete")
                while self.has_active_synthesis:
                    await asyncio.sleep(0.1)
                    if self._loading_status.cancellation_token.is_set():
                        return False
            
            # Set loading state
            with self._lock:
                self._loading_status = LoadingStatus(
                    state=LoadingState.LOADING,
                    current_model=self._model_state.model_name if self._model_state else None,
                    target_model=target_model,
                    start_time=asyncio.get_event_loop().time()
                )
                self._notify_progress()
        
        try:
            # Clean up previous model
            self._update_loading_progress(10.0, "Cleaning up previous model")
            self._cleanup_current_model()
            
            if self._loading_status.cancellation_token.is_set():
                raise asyncio.CancelledError("Loading cancelled")
            
            # Initialize model manager if needed
            if not self._model_manager:
                self._update_loading_progress(15.0, "Initializing model manager")
                self._model_manager = ModelManager(
                    models_file=TTS.get_models_file_path(),
                    progress_bar=progress_bar
                )
            
            if self._loading_status.cancellation_token.is_set():
                raise asyncio.CancelledError("Loading cancelled")
            
            # Load the TTS model
            self._update_loading_progress(25.0, f"Loading TTS model: {target_model}")
            
            # Run model loading in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            tts_instance = await loop.run_in_executor(
                None,
                self._load_tts_instance,
                model_name,
                model_path,
                config_path,
                vocoder_name,
                vocoder_path,
                vocoder_config_path,
                device,
                progress_bar,
                kwargs
            )
            
            if self._loading_status.cancellation_token.is_set():
                raise asyncio.CancelledError("Loading cancelled")
            
            self._update_loading_progress(85.0, "Extracting model information")
            
            # Create new model state
            new_state = ModelState(
                model_name=model_name or "custom_model",
                tts_instance=tts_instance,
                config_path=config_path,
                model_path=model_path,
                vocoder_name=vocoder_name,
                device=device,
                is_multi_speaker=tts_instance.is_multi_speaker,
                is_multi_lingual=tts_instance.is_multi_lingual,
                speakers=tts_instance.speakers,
                languages=tts_instance.languages,
                load_time=asyncio.get_event_loop().time() - self._loading_status.start_time
            )
            
            # Estimate memory usage
            if torch.cuda.is_available() and device.startswith('cuda'):
                try:
                    new_state.memory_usage = torch.cuda.memory_allocated() / 1024 / 1024  # MB
                except Exception:
                    new_state.memory_usage = 0.0
            
            if self._loading_status.cancellation_token.is_set():
                raise asyncio.CancelledError("Loading cancelled")
            
            self._update_loading_progress(95.0, "Finalizing model setup")
            
            # Update state atomically
            with self._lock:
                self._model_state = new_state
                self._loading_status.state = LoadingState.COMPLETED
                self._loading_status.progress = 100.0
                self._loading_status.message = f"Model {target_model} loaded successfully"
                self._notify_progress()
            
            logger.info(
                "Successfully loaded model %s (speakers: %d, languages: %d, load_time: %.2fs)",
                target_model,
                len(new_state.speakers) if new_state.speakers else 0,
                len(new_state.languages) if new_state.languages else 0,
                new_state.load_time
            )
            
            return True
            
        except asyncio.CancelledError:
            logger.info("Model loading cancelled: %s", target_model)
            with self._lock:
                self._loading_status.state = LoadingState.CANCELLED
                self._loading_status.message = "Loading cancelled"
                self._notify_progress()
            return False
            
        except Exception as e:
            logger.error("Failed to load model %s: %s", target_model, str(e))
            with self._lock:
                self._loading_status.state = LoadingState.FAILED
                self._loading_status.error = str(e)
                self._loading_status.message = f"Failed to load model: {str(e)}"
                self._notify_progress()
            return False
    
    def _load_tts_instance(
        self,
        model_name: Optional[str],
        model_path: Optional[str],
        config_path: Optional[str],
        vocoder_name: Optional[str],
        vocoder_path: Optional[str],
        vocoder_config_path: Optional[str],
        device: str,
        progress_bar: bool,
        kwargs: Dict[str, Any]
    ) -> TTS:
        """Load TTS instance in a separate thread."""
        return TTS(
            model_name=model_name,
            model_path=model_path,
            config_path=config_path,
            vocoder_name=vocoder_name,
            vocoder_path=vocoder_path,
            vocoder_config_path=vocoder_config_path,
            progress_bar=progress_bar,
            **kwargs
        ).to(device)
    
    def load_model(
        self,
        model_name: Optional[str] = None,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None,
        vocoder_name: Optional[str] = None,
        vocoder_path: Optional[str] = None,
        vocoder_config_path: Optional[str] = None,
        device: str = "cpu",
        progress_bar: bool = True,
        **kwargs
    ) -> bool:
        """Synchronously load a TTS model.
        
        This is a blocking wrapper around the async load_model_async method.
        
        Args:
            Same as load_model_async
        
        Returns:
            True if loading succeeded, False otherwise
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.load_model_async(
                model_name=model_name,
                model_path=model_path,
                config_path=config_path,
                vocoder_name=vocoder_name,
                vocoder_path=vocoder_path,
                vocoder_config_path=vocoder_config_path,
                device=device,
                progress_bar=progress_bar,
                **kwargs
            )
        )
    
    def cancel_loading(self) -> bool:
        """Cancel the current model loading operation.
        
        Returns:
            True if cancellation was requested, False if not loading
        """
        with self._lock:
            if self._loading_status.state == LoadingState.LOADING:
                logger.info("Cancelling model loading: %s", self._loading_status.target_model)
                self._loading_status.cancellation_token.set()
                return True
            return False
    
    def register_synthesis(self, synthesis_id: Any) -> None:
        """Register an active synthesis operation.
        
        Args:
            synthesis_id: Identifier for the synthesis operation
        """
        with self._synthesis_lock:
            self._active_synthesis_count += 1
            self._active_syntheses.add(synthesis_id)
            logger.debug("Registered synthesis %s (active: %d)", synthesis_id, self._active_synthesis_count)
    
    def unregister_synthesis(self, synthesis_id: Any) -> None:
        """Unregister a completed synthesis operation.
        
        Args:
            synthesis_id: Identifier for the synthesis operation
        """
        with self._synthesis_lock:
            if self._active_synthesis_count > 0:
                self._active_synthesis_count -= 1
            self._active_syntheses.discard(synthesis_id)
            logger.debug("Unregistered synthesis %s (active: %d)", synthesis_id, self._active_synthesis_count)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the currently loaded model.
        
        Returns:
            Dictionary containing model information
        """
        with self._lock:
            if not self._model_state:
                return {"error": "No model loaded"}
            
            return {
                "model_name": self._model_state.model_name,
                "device": self._model_state.device,
                "is_multi_speaker": self._model_state.is_multi_speaker,
                "is_multi_lingual": self._model_state.is_multi_lingual,
                "speakers": self._model_state.speakers,
                "languages": self._model_state.languages,
                "speaker_count": len(self._model_state.speakers) if self._model_state.speakers else 0,
                "language_count": len(self._model_state.languages) if self._model_state.languages else 0,
                "load_time": self._model_state.load_time,
                "memory_usage_mb": self._model_state.memory_usage,
                "supports_cloning": (
                    self._model_state.tts_instance.synthesizer.tts_config.supports_cloning
                    if self._model_state.tts_instance and 
                       hasattr(self._model_state.tts_instance, 'synthesizer') and
                       hasattr(self._model_state.tts_instance.synthesizer, 'tts_config')
                    else False
                )
            }
    
    def get_loading_progress(self) -> Dict[str, Any]:
        """Get current loading progress information.
        
        Returns:
            Dictionary containing loading progress
        """
        with self._lock:
            return {
                "state": self._loading_status.state.name,
                "current_model": self._loading_status.current_model,
                "target_model": self._loading_status.target_model,
                "progress": self._loading_status.progress,
                "message": self._loading_status.message,
                "error": self._loading_status.error,
                "start_time": self._loading_status.start_time,
                "is_loading": self._loading_status.state == LoadingState.LOADING,
                "active_synthesis_count": self._active_synthesis_count
            }


# Global instance
_global_model_state: Optional[GlobalModelState] = None


def get_global_model_state() -> GlobalModelState:
    """Get the global model state singleton instance.
    
    Returns:
        The global model state manager instance
    """
    global _global_model_state
    if _global_model_state is None:
        _global_model_state = GlobalModelState()
    return _global_model_state


def cleanup_global_state() -> None:
    """Clean up the global model state.
    
    This should be called when shutting down the server to ensure
    proper cleanup of resources.
    """
    global _global_model_state
    if _global_model_state is not None:
        _global_model_state._cleanup_current_model()
        _global_model_state = None
    logger.info("Global model state cleaned up")