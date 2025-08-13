"""Background model loader for TTS server with queue management and caching.

This module provides asynchronous model loading capabilities with thread pool
management, queue-based operation sequencing, and intelligent caching integration.
It works seamlessly with GlobalModelState for progress tracking and ModelCacheManager
for intelligent caching.
"""

import asyncio
import logging
import queue
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, Optional, Set

from TTS.api import TTS
from TTS.server.services.model_cache import ModelCacheManager
from TTS.server.services.model_state import get_global_model_state

logger = logging.getLogger(__name__)


class LoadTaskType(Enum):
    """Types of loading tasks supported by the ModelLoader."""
    LOAD_MODEL = auto()
    PRELOAD_MODEL = auto()
    SWITCH_MODEL = auto()
    CLEANUP_MODEL = auto()


@dataclass
class LoadTask:
    """Represents a model loading task in the queue."""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    task_type: LoadTaskType = LoadTaskType.LOAD_MODEL
    model_name: Optional[str] = None
    model_path: Optional[str] = None
    config_path: Optional[str] = None
    vocoder_name: Optional[str] = None
    vocoder_path: Optional[str] = None
    vocoder_config_path: Optional[str] = None
    device: str = "cpu"
    priority: int = 0  # Higher values = higher priority
    created_at: float = field(default_factory=time.time)
    callback: Optional[Callable[[bool, Optional[str]], None]] = None
    future: Optional[Future] = None
    cancelled: bool = False
    kwargs: Dict[str, Any] = field(default_factory=dict)


class ModelLoader:
    """
    Background model loader with queue management and caching integration.
    
    Features:
    - Asynchronous model loading with ThreadPoolExecutor
    - Priority-based task queue for sequential operations
    - Integration with GlobalModelState for progress tracking
    - Intelligent caching via ModelCacheManager
    - Cancellation support for loading operations
    - Memory cleanup between model switches
    - Thread-safe operations with proper error handling
    """
    
    def __init__(
        self,
        max_workers: int = 2,
        cache_manager: Optional[ModelCacheManager] = None,
        enable_caching: bool = True,
        queue_timeout: float = 300.0  # 5 minutes
    ):
        """
        Initialize the ModelLoader.
        
        Args:
            max_workers: Maximum number of worker threads
            cache_manager: Optional ModelCacheManager instance
            enable_caching: Whether to use caching for loaded models
            queue_timeout: Timeout for queue operations in seconds
        """
        self.max_workers = max_workers
        self.enable_caching = enable_caching
        self.queue_timeout = queue_timeout
        
        # Initialize thread pool
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="ModelLoader"
        )
        
        # Initialize task queue (priority queue)
        self._task_queue: queue.PriorityQueue = queue.PriorityQueue()
        self._active_tasks: Dict[str, LoadTask] = {}
        self._task_lock = threading.RLock()
        
        # Initialize cache manager
        if cache_manager is None and enable_caching:
            try:
                self._cache_manager = ModelCacheManager()
                logger.info("Initialized ModelCacheManager for ModelLoader")
            except Exception as e:
                logger.warning(f"Failed to initialize cache manager: {e}")
                self._cache_manager = None
                self.enable_caching = False
        else:
            self._cache_manager = cache_manager
        
        # Get global model state
        self._global_state = get_global_model_state()
        
        # Worker thread for processing queue
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            name="ModelLoader-Worker",
            daemon=True
        )
        self._shutdown_event = threading.Event()
        self._worker_thread.start()
        
        # Task completion callbacks
        self._completion_callbacks: Set[Callable[[LoadTask, bool, Optional[str]], None]] = set()
        
        logger.info(f"ModelLoader initialized with {max_workers} workers, caching: {enable_caching}")
    
    def add_completion_callback(self, callback: Callable[[LoadTask, bool, Optional[str]], None]) -> None:
        """
        Add a callback to be called when tasks complete.
        
        Args:
            callback: Function called with (task, success, error_message)
        """
        self._completion_callbacks.add(callback)
    
    def remove_completion_callback(self, callback: Callable[[LoadTask, bool, Optional[str]], None]) -> None:
        """
        Remove a completion callback.
        
        Args:
            callback: Function to remove from callbacks
        """
        self._completion_callbacks.discard(callback)
    
    async def load_model_async(
        self,
        model_name: Optional[str] = None,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None,
        vocoder_name: Optional[str] = None,
        vocoder_path: Optional[str] = None,
        vocoder_config_path: Optional[str] = None,
        device: str = "cpu",
        priority: int = 10,
        **kwargs
    ) -> tuple[bool, Optional[str]]:
        """
        Asynchronously load a TTS model with background processing.
        
        Args:
            model_name: Name of pre-trained model to load
            model_path: Path to custom model checkpoint
            config_path: Path to model config file
            vocoder_name: Name of vocoder model
            vocoder_path: Path to vocoder checkpoint
            vocoder_config_path: Path to vocoder config
            device: Device to load model on ("cpu", "cuda", etc.)
            priority: Task priority (higher = more priority)
            **kwargs: Additional arguments for TTS initialization
        
        Returns:
            Tuple of (success, error_message)
        """
        # Check cache first if enabled
        target_model = model_name or model_path or "custom_model"
        
        if self.enable_caching and self._cache_manager and model_name:
            logger.info(f"Checking cache for model: {model_name}")
            try:
                cached_model = self._cache_manager.get_cached_model(model_name)
                if cached_model:
                    logger.info(f"Found cached model: {model_name}")
                    
                    # Update global state directly with cached model
                    success = await self._load_cached_model(cached_model, model_name, device)
                    if success:
                        return True, None
                    else:
                        logger.warning(f"Failed to load cached model: {model_name}")
            except Exception as e:
                logger.warning(f"Cache lookup failed for {model_name}: {e}")
        
        # Create load task
        task = LoadTask(
            task_type=LoadTaskType.LOAD_MODEL,
            model_name=model_name,
            model_path=model_path,
            config_path=config_path,
            vocoder_name=vocoder_name,
            vocoder_path=vocoder_path,
            vocoder_config_path=vocoder_config_path,
            device=device,
            priority=priority,
            kwargs=kwargs
        )
        
        return await self._submit_and_wait(task)
    
    def load_model_background(
        self,
        model_name: Optional[str] = None,
        model_path: Optional[str] = None,
        config_path: Optional[str] = None,
        vocoder_name: Optional[str] = None,
        vocoder_path: Optional[str] = None,
        vocoder_config_path: Optional[str] = None,
        device: str = "cpu",
        priority: int = 10,
        callback: Optional[Callable[[bool, Optional[str]], None]] = None,
        **kwargs
    ) -> str:
        """
        Submit a model loading task to run in the background.
        
        Args:
            Same as load_model_async, plus:
            callback: Optional callback for completion notification
        
        Returns:
            Task ID for tracking
        """
        task = LoadTask(
            task_type=LoadTaskType.LOAD_MODEL,
            model_name=model_name,
            model_path=model_path,
            config_path=config_path,
            vocoder_name=vocoder_name,
            vocoder_path=vocoder_path,
            vocoder_config_path=vocoder_config_path,
            device=device,
            priority=priority,
            callback=callback,
            kwargs=kwargs
        )
        
        return self._submit_task(task)
    
    def preload_model(
        self,
        model_name: str,
        device: str = "cpu",
        priority: int = 5,
        callback: Optional[Callable[[bool, Optional[str]], None]] = None
    ) -> str:
        """
        Preload a model for faster switching later.
        
        Args:
            model_name: Name of pre-trained model to preload
            device: Device to load model on
            priority: Task priority (lower than normal loads)
            callback: Optional callback for completion notification
            
        Returns:
            Task ID for tracking
        """
        task = LoadTask(
            task_type=LoadTaskType.PRELOAD_MODEL,
            model_name=model_name,
            device=device,
            priority=priority,
            callback=callback
        )
        
        return self._submit_task(task)
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending or active loading task.
        
        Args:
            task_id: ID of the task to cancel
            
        Returns:
            True if task was cancelled, False if not found or already completed
        """
        with self._task_lock:
            task = self._active_tasks.get(task_id)
            if task and not task.cancelled:
                task.cancelled = True
                
                # Cancel the future if it exists
                if task.future and not task.future.done():
                    task.future.cancel()
                
                # Cancel global state loading if this is the active task
                if (self._global_state.is_loading and 
                    self._global_state.loading_status.target_model == (task.model_name or task.model_path)):
                    self._global_state.cancel_loading()
                
                logger.info(f"Cancelled loading task: {task_id}")
                return True
            
            return False
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a loading task.
        
        Args:
            task_id: ID of the task to check
            
        Returns:
            Dictionary with task status or None if not found
        """
        with self._task_lock:
            task = self._active_tasks.get(task_id)
            if not task:
                return None
            
            status = {
                "task_id": task.task_id,
                "task_type": task.task_type.name,
                "model_name": task.model_name or task.model_path,
                "device": task.device,
                "priority": task.priority,
                "created_at": task.created_at,
                "cancelled": task.cancelled,
                "completed": task.future.done() if task.future else False
            }
            
            if task.future and task.future.done():
                try:
                    result = task.future.result()
                    status["success"] = result[0] if isinstance(result, tuple) else True
                    status["error"] = result[1] if isinstance(result, tuple) and len(result) > 1 else None
                except Exception as e:
                    status["success"] = False
                    status["error"] = str(e)
            
            return status
    
    def get_queue_info(self) -> Dict[str, Any]:
        """
        Get information about the current task queue.
        
        Returns:
            Dictionary with queue statistics
        """
        with self._task_lock:
            return {
                "queue_size": self._task_queue.qsize(),
                "active_tasks": len(self._active_tasks),
                "worker_threads": self.max_workers,
                "caching_enabled": self.enable_caching,
                "cache_stats": self._cache_manager.get_cache_stats().__dict__ if self._cache_manager else None
            }
    
    def shutdown(self, timeout: float = 30.0) -> None:
        """
        Shutdown the ModelLoader and clean up resources.
        
        Args:
            timeout: Maximum time to wait for shutdown
        """
        logger.info("Shutting down ModelLoader...")
        
        # Signal shutdown
        self._shutdown_event.set()
        
        # Cancel all active tasks
        with self._task_lock:
            for task in list(self._active_tasks.values()):
                self.cancel_task(task.task_id)
        
        # Wait for worker thread
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=timeout / 2)
        
        # Shutdown executor
        self._executor.shutdown(wait=True, timeout=timeout / 2)
        
        logger.info("ModelLoader shutdown complete")
    
    async def _load_cached_model(self, tts_instance: TTS, model_name: str, device: str) -> bool:
        """Load a cached model into the global state."""
        try:
            # Move to correct device if needed
            if hasattr(tts_instance, 'to'):
                tts_instance = tts_instance.to(device)
            
            # Use global state to set the cached model
            success = await self._global_state.load_model_async(
                model_name=model_name,
                device=device
            )
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to load cached model {model_name}: {e}")
            return False
    
    def _submit_task(self, task: LoadTask) -> str:
        """Submit a task to the queue."""
        with self._task_lock:
            self._active_tasks[task.task_id] = task
            
            # Add to priority queue (negative priority for max-heap behavior)
            self._task_queue.put((-task.priority, task.created_at, task))
            
            logger.info(f"Submitted task {task.task_id} ({task.task_type.name}) with priority {task.priority}")
            return task.task_id
    
    async def _submit_and_wait(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Submit a task and wait for its completion."""
        task_id = self._submit_task(task)
        
        # Wait for completion
        start_time = time.time()
        while not task.future or not task.future.done():
            await asyncio.sleep(0.1)
            
            # Check for timeout
            if time.time() - start_time > self.queue_timeout:
                self.cancel_task(task_id)
                return False, f"Task timeout after {self.queue_timeout}s"
            
            # Check if cancelled
            if task.cancelled:
                return False, "Task cancelled"
        
        try:
            return task.future.result()
        except Exception as e:
            return False, str(e)
    
    def _worker_loop(self) -> None:
        """Main worker loop for processing tasks."""
        logger.info("ModelLoader worker thread started")
        
        while not self._shutdown_event.is_set():
            try:
                # Get next task from queue with timeout
                try:
                    priority, created_at, task = self._task_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Check if task was cancelled
                if task.cancelled:
                    self._task_queue.task_done()
                    continue
                
                # Submit to thread pool
                future = self._executor.submit(self._execute_task, task)
                task.future = future
                
                # Wait for completion in a non-blocking way
                self._wait_for_task_completion(task)
                
                self._task_queue.task_done()
                
            except Exception as e:
                logger.error(f"Error in worker loop: {e}")
                continue
        
        logger.info("ModelLoader worker thread stopped")
    
    def _wait_for_task_completion(self, task: LoadTask) -> None:
        """Wait for task completion and handle callbacks."""
        def completion_handler(future: Future) -> None:
            try:
                success, error_msg = future.result()
                
                # Call task-specific callback
                if task.callback:
                    try:
                        task.callback(success, error_msg)
                    except Exception as e:
                        logger.warning(f"Task callback failed: {e}")
                
                # Call global completion callbacks
                for callback in self._completion_callbacks.copy():
                    try:
                        callback(task, success, error_msg)
                    except Exception as e:
                        logger.warning(f"Completion callback failed: {e}")
                
                # Clean up task
                with self._task_lock:
                    self._active_tasks.pop(task.task_id, None)
                
                logger.debug(f"Task {task.task_id} completed: success={success}")
                
            except Exception as e:
                logger.error(f"Error in task completion handler: {e}")
        
        if task.future:
            task.future.add_done_callback(completion_handler)
    
    def _execute_task(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Execute a loading task."""
        if task.cancelled:
            return False, "Task cancelled"
        
        try:
            target_model = task.model_name or task.model_path or "custom_model"
            logger.info(f"Executing task {task.task_id}: {task.task_type.name} for {target_model}")
            
            if task.task_type == LoadTaskType.LOAD_MODEL:
                return self._execute_load_model(task)
            elif task.task_type == LoadTaskType.PRELOAD_MODEL:
                return self._execute_preload_model(task)
            elif task.task_type == LoadTaskType.SWITCH_MODEL:
                return self._execute_switch_model(task)
            elif task.task_type == LoadTaskType.CLEANUP_MODEL:
                return self._execute_cleanup_model(task)
            else:
                return False, f"Unknown task type: {task.task_type}"
                
        except Exception as e:
            logger.error(f"Task execution failed {task.task_id}: {e}")
            return False, str(e)
    
    def _execute_load_model(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Execute model loading task."""
        try:
            # Use global state for actual loading
            success = self._global_state.load_model(
                model_name=task.model_name,
                model_path=task.model_path,
                config_path=task.config_path,
                vocoder_name=task.vocoder_name,
                vocoder_path=task.vocoder_path,
                vocoder_config_path=task.vocoder_config_path,
                device=task.device,
                **task.kwargs
            )
            
            if success and self.enable_caching and self._cache_manager and task.model_name:
                # Cache the loaded model
                current_model = self._global_state.current_model
                if current_model and current_model.tts_instance:
                    try:
                        self._cache_manager.cache_model(
                            task.model_name,
                            current_model.tts_instance
                        )
                        logger.info(f"Cached model: {task.model_name}")
                    except Exception as e:
                        logger.warning(f"Failed to cache model {task.model_name}: {e}")
            
            return success, None if success else "Model loading failed"
            
        except Exception as e:
            return False, str(e)
    
    def _execute_preload_model(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Execute model preloading task (cache only, don't switch)."""
        if not self.enable_caching or not self._cache_manager or not task.model_name:
            return False, "Caching not available for preloading"
        
        try:
            # Check if already cached
            cached_model = self._cache_manager.get_cached_model(task.model_name)
            if cached_model:
                logger.info(f"Model {task.model_name} already cached")
                return True, None
            
            # Load model temporarily for caching
            tts_instance = TTS(
                model_name=task.model_name,
                progress_bar=False
            ).to(task.device)
            
            # Cache the model
            success = self._cache_manager.cache_model(task.model_name, tts_instance)
            
            if success:
                logger.info(f"Successfully preloaded and cached model: {task.model_name}")
                return True, None
            else:
                return False, "Failed to cache preloaded model"
                
        except Exception as e:
            return False, str(e)
    
    def _execute_switch_model(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Execute model switching task."""
        # For now, this is the same as load_model
        return self._execute_load_model(task)
    
    def _execute_cleanup_model(self, task: LoadTask) -> tuple[bool, Optional[str]]:
        """Execute model cleanup task."""
        try:
            # Trigger cleanup in global state
            self._global_state._cleanup_current_model()
            
            # Optionally clean up cache
            if self.enable_caching and self._cache_manager and task.model_name:
                self._cache_manager.remove_model(task.model_name)
            
            return True, None
            
        except Exception as e:
            return False, str(e)
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.shutdown()
    
    def __del__(self):
        """Destructor."""
        try:
            self.shutdown(timeout=5.0)
        except Exception:
            pass  # Ignore errors during cleanup