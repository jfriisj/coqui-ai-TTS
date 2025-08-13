"""Model registry refresh functionality for TTS server.

This module provides automatic monitoring and refresh capabilities for the TTS model registry
(.models.json) with intelligent caching, fallback handling, and cache invalidation.
Implements requirements 8.2, 8.4, and 8.5 for dynamic model selection.
"""

import asyncio
import json
import logging
import os
import threading
import time
import weakref
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from threading import RLock
from typing import Any, Callable, Dict, List, Optional, Set

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    Observer = None
    FileSystemEventHandler = None
    HAS_WATCHDOG = False

from TTS.utils.manage import ModelManager, ModelItem
from TTS.config import read_json_with_comments

logger = logging.getLogger(__name__)


class RegistryState(Enum):
    """Registry monitoring states."""
    IDLE = auto()
    MONITORING = auto()
    REFRESHING = auto()
    UNAVAILABLE = auto()
    ERROR = auto()


@dataclass
class RegistryStats:
    """Statistics for registry operations."""
    last_refresh: float = 0.0
    refresh_count: int = 0
    cache_invalidation_count: int = 0
    failure_count: int = 0
    models_count: int = 0
    state: RegistryState = RegistryState.IDLE


@dataclass
class CachedModelRegistry:
    """Cached model registry data with metadata."""
    models_data: Dict[str, Any] = field(default_factory=dict)
    cached_at: float = field(default_factory=time.time)
    file_modified_time: float = 0.0
    is_stale: bool = False


class ModelRegistryHandler:
    """File system event handler for .models.json changes."""
    
    def __init__(self, registry: 'ModelRegistry'):
        if HAS_WATCHDOG:
            super().__init__()
        self._registry_ref = weakref.ref(registry)
    
    def on_modified(self, event):
        """Handle file modification events."""
        if event.is_directory:
            return
        
        registry = self._registry_ref()
        if registry is None:
            return
            
        # Check if the modified file is the models.json file
        if Path(event.src_path).name == '.models.json':
            logger.info("Detected .models.json file change: %s", event.src_path)
            registry._schedule_refresh()


# Create handler class dynamically based on watchdog availability
if HAS_WATCHDOG:
    class ModelRegistryHandler(ModelRegistryHandler, FileSystemEventHandler):
        pass


class ModelRegistry:
    """
    Model registry refresh functionality with automatic monitoring and caching.
    
    Features:
    - Automatic .models.json file monitoring with watchdog
    - Refresh within 60 seconds of registry updates (requirement 8.2)
    - Cache invalidation and model list updates (requirement 8.4)
    - Fallback to cached data when registry unavailable (requirement 8.5)
    - Thread-safe operations with progress callbacks
    - Background refresh scheduling and rate limiting
    """
    
    def __init__(
        self,
        models_file: Optional[Path] = None,
        refresh_interval: float = 60.0,
        max_refresh_attempts: int = 3,
        cache_ttl: float = 3600.0  # 1 hour
    ):
        """
        Initialize the model registry.
        
        Args:
            models_file: Path to .models.json file (defaults to TTS default)
            refresh_interval: Maximum time between refresh checks in seconds
            max_refresh_attempts: Maximum retry attempts for failed refreshes
            cache_ttl: Cache time-to-live in seconds
        """
        self.refresh_interval = refresh_interval
        self.max_refresh_attempts = max_refresh_attempts
        self.cache_ttl = cache_ttl
        
        # Initialize models file path
        if models_file is None:
            self.models_file = Path(__file__).parent.parent / ".models.json"
        else:
            self.models_file = Path(models_file)
        
        # Thread safety
        self._lock = RLock()
        
        # Registry state
        self._state = RegistryState.IDLE
        self._stats = RegistryStats()
        self._cached_registry = CachedModelRegistry()
        
        # ModelManager instance for registry operations
        self._model_manager: Optional[ModelManager] = None
        
        # File monitoring
        self._observer: Optional[Observer] = None
        self._event_handler: Optional[ModelRegistryHandler] = None
        
        # Polling mode (fallback when watchdog is not available)
        self._polling_thread: Optional[threading.Thread] = None
        self._polling_stop_event = threading.Event()
        self._last_poll_mtime: float = 0.0
        
        # Background refresh scheduling
        self._refresh_scheduled = False
        self._refresh_timer: Optional[threading.Timer] = None
        
        # Callbacks for cache invalidation and updates
        self._invalidation_callbacks: Set[Callable[[], None]] = set()
        self._update_callbacks: Set[Callable[[Dict[str, Any]], None]] = set()
        
        # Initialize the registry
        self._initialize_registry()
        
        logger.info("ModelRegistry initialized for file: %s", self.models_file)
    
    def start_monitoring(self) -> bool:
        """
        Start monitoring the .models.json file for changes.
        Uses watchdog if available, otherwise falls back to polling.
        
        Returns:
            True if monitoring started successfully, False otherwise
        """
        with self._lock:
            if self._state == RegistryState.MONITORING:
                logger.warning("Registry monitoring already active")
                return True
            
            # Check if registry file exists
            if not self.models_file.exists():
                logger.error("Registry file does not exist: %s", self.models_file)
                return False
            
            try:
                if HAS_WATCHDOG:
                    # Use watchdog for efficient file monitoring
                    success = self._start_watchdog_monitoring()
                else:
                    # Fall back to polling
                    success = self._start_polling_monitoring()
                
                if success:
                    self._state = RegistryState.MONITORING
                    logger.info("Started monitoring registry file: %s (mode: %s)", 
                               self.models_file, "watchdog" if HAS_WATCHDOG else "polling")
                
                return success
                
            except Exception as e:
                logger.error("Failed to start registry monitoring: %s", e)
                self._state = RegistryState.ERROR
                return False
    
    def _start_watchdog_monitoring(self) -> bool:
        """Start monitoring using watchdog library."""
        try:
            self._event_handler = ModelRegistryHandler(self)
            self._observer = Observer()
            
            # Watch the directory containing the models file
            watch_dir = self.models_file.parent
            if not watch_dir.exists():
                logger.error("Registry directory does not exist: %s", watch_dir)
                return False
            
            self._observer.schedule(
                self._event_handler,
                str(watch_dir),
                recursive=False
            )
            
            self._observer.start()
            return True
            
        except Exception as e:
            logger.error("Failed to start watchdog monitoring: %s", e)
            return False
    
    def _start_polling_monitoring(self) -> bool:
        """Start monitoring using polling (fallback method)."""
        try:
            # Initialize polling state
            if self.models_file.exists():
                self._last_poll_mtime = self.models_file.stat().st_mtime
            
            # Start polling thread
            self._polling_stop_event.clear()
            self._polling_thread = threading.Thread(
                target=self._polling_worker,
                name="ModelRegistry-PollingWorker",
                daemon=True
            )
            self._polling_thread.start()
            
            return True
            
        except Exception as e:
            logger.error("Failed to start polling monitoring: %s", e)
            return False
    
    def _polling_worker(self) -> None:
        """Worker thread for polling-based file monitoring."""
        logger.debug("Starting registry polling worker")
        
        while not self._polling_stop_event.is_set():
            try:
                # Check if file has been modified
                if self.models_file.exists():
                    current_mtime = self.models_file.stat().st_mtime
                    if current_mtime > self._last_poll_mtime:
                        logger.info("Detected .models.json file change via polling: %s", self.models_file)
                        self._last_poll_mtime = current_mtime
                        self._schedule_refresh()
                
                # Sleep for a portion of the refresh interval
                poll_interval = min(self.refresh_interval / 4, 15.0)  # Poll more frequently than refresh
                self._polling_stop_event.wait(poll_interval)
                
            except Exception as e:
                logger.error("Error in polling worker: %s", e)
                self._polling_stop_event.wait(5.0)  # Wait before retrying
        
        logger.debug("Registry polling worker stopped")
    
    def stop_monitoring(self) -> None:
        """Stop monitoring the .models.json file."""
        with self._lock:
            # Stop watchdog observer if running
            if self._observer:
                try:
                    self._observer.stop()
                    self._observer.join(timeout=5.0)
                    logger.debug("Stopped watchdog monitoring")
                except Exception as e:
                    logger.error("Error stopping watchdog monitoring: %s", e)
                finally:
                    self._observer = None
                    self._event_handler = None
            
            # Stop polling thread if running
            if self._polling_thread:
                try:
                    self._polling_stop_event.set()
                    self._polling_thread.join(timeout=5.0)
                    logger.debug("Stopped polling monitoring")
                except Exception as e:
                    logger.error("Error stopping polling monitoring: %s", e)
                finally:
                    self._polling_thread = None
                    self._polling_stop_event.clear()
            
            # Cancel any pending refresh
            if self._refresh_timer:
                self._refresh_timer.cancel()
                self._refresh_timer = None
                self._refresh_scheduled = False
            
            if self._state == RegistryState.MONITORING:
                self._state = RegistryState.IDLE
            
            logger.info("Stopped registry monitoring")
    
    def refresh_registry(self, force: bool = False) -> bool:
        """
        Manually refresh the model registry.
        
        Args:
            force: Force refresh even if cache is fresh
            
        Returns:
            True if refresh succeeded, False otherwise
        """
        with self._lock:
            return self._perform_refresh(force=force)
    
    def get_models_data(self, allow_stale: bool = True) -> Dict[str, Any]:
        """
        Get the current models data.
        
        Args:
            allow_stale: Whether to return stale cached data if registry unavailable
            
        Returns:
            Dictionary containing models data from registry
        """
        with self._lock:
            # Check if we need to refresh
            if self._should_refresh():
                self._perform_refresh()
            
            # Return cached data if available
            if self._cached_registry.models_data:
                if self._cached_registry.is_stale and not allow_stale:
                    logger.warning("Registry data is stale and fresh data not allowed")
                    return {}
                return self._cached_registry.models_data.copy()
            
            # Try to load from file as fallback
            try:
                if self.models_file.exists():
                    models_data = read_json_with_comments(self.models_file)
                    # Update cache with fresh data
                    self._update_cached_registry(models_data, self.models_file.stat().st_mtime)
                    return models_data
            except Exception as e:
                logger.error("Failed to load models data from file: %s", e)
            
            logger.warning("No models data available")
            return {}
    
    def get_available_models(self) -> List[str]:
        """
        Get list of available model names.
        
        Returns:
            List of model names in format 'type/language/dataset/model'
        """
        models_data = self.get_models_data()
        model_names = []
        
        try:
            for model_type in models_data:
                if not isinstance(models_data[model_type], dict):
                    continue
                for lang in models_data[model_type]:
                    if not isinstance(models_data[model_type][lang], dict):
                        continue
                    for dataset in models_data[model_type][lang]:
                        if not isinstance(models_data[model_type][lang][dataset], dict):
                            continue
                        for model in models_data[model_type][lang][dataset]:
                            model_names.append(f"{model_type}/{lang}/{dataset}/{model}")
        except Exception as e:
            logger.error("Error parsing models data: %s", e)
        
        return sorted(model_names)
    
    def is_registry_available(self) -> bool:
        """
        Check if the registry is currently available.
        
        Returns:
            True if registry file exists and is readable
        """
        try:
            return (
                self.models_file.exists() and 
                os.access(self.models_file, os.R_OK) and
                self._state != RegistryState.UNAVAILABLE
            )
        except Exception:
            return False
    
    def is_data_stale(self) -> bool:
        """
        Check if cached registry data is stale.
        
        Returns:
            True if data is stale or unavailable
        """
        with self._lock:
            return (
                self._cached_registry.is_stale or
                time.time() - self._cached_registry.cached_at > self.cache_ttl or
                not self._cached_registry.models_data
            )
    
    def add_invalidation_callback(self, callback: Callable[[], None]) -> None:
        """
        Add a callback to be called when cache should be invalidated.
        
        Args:
            callback: Function to call for cache invalidation
        """
        self._invalidation_callbacks.add(callback)
    
    def remove_invalidation_callback(self, callback: Callable[[], None]) -> None:
        """
        Remove an invalidation callback.
        
        Args:
            callback: Function to remove from callbacks
        """
        self._invalidation_callbacks.discard(callback)
    
    def add_update_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Add a callback to be called when registry is updated.
        
        Args:
            callback: Function to call with updated models data
        """
        self._update_callbacks.add(callback)
    
    def remove_update_callback(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Remove an update callback.
        
        Args:
            callback: Function to remove from callbacks
        """
        self._update_callbacks.discard(callback)
    
    def get_registry_stats(self) -> RegistryStats:
        """
        Get registry statistics.
        
        Returns:
            RegistryStats object with current metrics
        """
        with self._lock:
            return RegistryStats(
                last_refresh=self._stats.last_refresh,
                refresh_count=self._stats.refresh_count,
                cache_invalidation_count=self._stats.cache_invalidation_count,
                failure_count=self._stats.failure_count,
                models_count=self._stats.models_count,
                state=self._state
            )
    
    def _initialize_registry(self) -> None:
        """Initialize the registry by loading initial data."""
        try:
            # Initialize ModelManager for registry operations
            self._model_manager = ModelManager(models_file=self.models_file)
            
            # Load initial registry data
            if self.models_file.exists():
                self._perform_refresh(force=True)
            else:
                logger.warning("Registry file does not exist: %s", self.models_file)
                self._state = RegistryState.UNAVAILABLE
                
        except Exception as e:
            logger.error("Failed to initialize registry: %s", e)
            self._state = RegistryState.ERROR
    
    def _should_refresh(self) -> bool:
        """Check if registry should be refreshed."""
        if not self.models_file.exists():
            return False
        
        try:
            file_mtime = self.models_file.stat().st_mtime
            return file_mtime > self._cached_registry.file_modified_time
        except Exception as e:
            logger.error("Error checking file modification time: %s", e)
            return False
    
    def _schedule_refresh(self) -> None:
        """Schedule a registry refresh with rate limiting."""
        with self._lock:
            if self._refresh_scheduled:
                logger.debug("Registry refresh already scheduled")
                return
            
            # Schedule refresh within the configured interval
            self._refresh_scheduled = True
            self._refresh_timer = threading.Timer(
                min(self.refresh_interval, 60.0),  # Cap at 60 seconds per requirement 8.2
                self._execute_scheduled_refresh
            )
            self._refresh_timer.start()
            
            logger.debug("Scheduled registry refresh in %.1f seconds", self.refresh_interval)
    
    def _execute_scheduled_refresh(self) -> None:
        """Execute a scheduled registry refresh."""
        with self._lock:
            self._refresh_scheduled = False
            self._refresh_timer = None
            
            logger.info("Executing scheduled registry refresh")
            self._perform_refresh()
    
    def _perform_refresh(self, force: bool = False) -> bool:
        """
        Perform the actual registry refresh operation.
        
        Args:
            force: Force refresh even if not needed
            
        Returns:
            True if refresh succeeded, False otherwise
        """
        if self._state == RegistryState.REFRESHING:
            logger.debug("Registry refresh already in progress")
            return True
        
        if not force and not self._should_refresh():
            logger.debug("Registry refresh not needed")
            return True
        
        previous_state = self._state
        self._state = RegistryState.REFRESHING
        
        try:
            logger.info("Refreshing model registry from: %s", self.models_file)
            
            # Attempt to read the registry file
            if not self.models_file.exists():
                logger.error("Registry file not found: %s", self.models_file)
                self._state = RegistryState.UNAVAILABLE
                return False
            
            # Load models data
            models_data = read_json_with_comments(self.models_file)
            if not isinstance(models_data, dict):
                raise ValueError("Registry file does not contain valid JSON object")
            
            # Get file modification time
            file_mtime = self.models_file.stat().st_mtime
            
            # Check if data actually changed
            data_changed = (
                force or 
                models_data != self._cached_registry.models_data or
                file_mtime > self._cached_registry.file_modified_time
            )
            
            if data_changed:
                # Update cached registry
                self._update_cached_registry(models_data, file_mtime)
                
                # Trigger cache invalidation callbacks (requirement 8.4)
                self._trigger_invalidation_callbacks()
                
                # Trigger update callbacks with new data
                self._trigger_update_callbacks(models_data)
                
                logger.info("Registry refresh completed - %d models loaded", self._stats.models_count)
            else:
                logger.debug("Registry data unchanged, skipping callbacks")
            
            # Update stats
            self._stats.last_refresh = time.time()
            self._stats.refresh_count += 1
            
            # Return to monitoring or idle state
            self._state = RegistryState.MONITORING if previous_state == RegistryState.MONITORING else RegistryState.IDLE
            return True
            
        except Exception as e:
            logger.error("Registry refresh failed: %s", e)
            self._stats.failure_count += 1
            
            # Mark cached data as stale but keep it available (requirement 8.5)
            if self._cached_registry.models_data:
                self._cached_registry.is_stale = True
                logger.info("Registry refresh failed, using stale cached data")
                self._state = RegistryState.UNAVAILABLE
            else:
                self._state = RegistryState.ERROR
            
            return False
    
    def _update_cached_registry(self, models_data: Dict[str, Any], file_mtime: float) -> None:
        """Update the cached registry data."""
        self._cached_registry.models_data = models_data
        self._cached_registry.cached_at = time.time()
        self._cached_registry.file_modified_time = file_mtime
        self._cached_registry.is_stale = False
        
        # Count total models
        self._stats.models_count = self._count_models(models_data)
    
    def _count_models(self, models_data: Dict[str, Any]) -> int:
        """Count total number of models in the registry."""
        count = 0
        try:
            for model_type in models_data:
                if not isinstance(models_data[model_type], dict):
                    continue
                for lang in models_data[model_type]:
                    if not isinstance(models_data[model_type][lang], dict):
                        continue
                    for dataset in models_data[model_type][lang]:
                        if not isinstance(models_data[model_type][lang][dataset], dict):
                            continue
                        count += len(models_data[model_type][lang][dataset])
        except Exception as e:
            logger.error("Error counting models: %s", e)
        return count
    
    def _trigger_invalidation_callbacks(self) -> None:
        """Trigger all registered invalidation callbacks."""
        self._stats.cache_invalidation_count += 1
        
        for callback in self._invalidation_callbacks.copy():
            try:
                callback()
                logger.debug("Triggered cache invalidation callback")
            except Exception as e:
                logger.warning("Invalidation callback failed: %s", e)
    
    def _trigger_update_callbacks(self, models_data: Dict[str, Any]) -> None:
        """Trigger all registered update callbacks."""
        for callback in self._update_callbacks.copy():
            try:
                callback(models_data)
                logger.debug("Triggered registry update callback")
            except Exception as e:
                logger.warning("Update callback failed: %s", e)
    
    def __enter__(self):
        """Context manager entry."""
        self.start_monitoring()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop_monitoring()
    
    def __del__(self):
        """Destructor - ensure monitoring is stopped."""
        try:
            self.stop_monitoring()
        except Exception:
            pass  # Ignore errors during cleanup


# Global registry instance management
_global_model_registry: Optional[ModelRegistry] = None


def get_model_registry(
    models_file: Optional[Path] = None,
    refresh_interval: float = 60.0
) -> ModelRegistry:
    """
    Get or create the global model registry instance.
    
    Args:
        models_file: Path to .models.json file (defaults to TTS default)
        refresh_interval: Maximum time between refresh checks in seconds
        
    Returns:
        ModelRegistry instance
    """
    global _global_model_registry
    
    if _global_model_registry is None:
        _global_model_registry = ModelRegistry(
            models_file=models_file,
            refresh_interval=refresh_interval
        )
    
    return _global_model_registry


def cleanup_model_registry() -> None:
    """Clean up the global model registry instance."""
    global _global_model_registry
    
    if _global_model_registry is not None:
        _global_model_registry.stop_monitoring()
        _global_model_registry = None
    
    logger.info("Model registry cleaned up")