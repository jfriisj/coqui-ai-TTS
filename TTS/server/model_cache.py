"""Model cache manager for TTS server with SQLite persistence and LRU eviction.

This module provides intelligent caching of TTS model components to reduce loading
times by at least 50% on subsequent loads. It includes memory monitoring, LRU
eviction policies, and automatic cache corruption detection.
"""

import logging
import os
import pickle
import sqlite3
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import RLock
from typing import Optional, Dict, Any, List

import psutil
from trainer.io import get_user_data_dir

from TTS.api import TTS
from TTS.utils.manage import ModelManager

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Represents a cached model entry with metadata."""
    model_name: str
    file_path: str
    memory_size: int
    last_accessed: float
    created_at: float
    hit_count: int = 0
    is_corrupted: bool = False


@dataclass
class CacheStats:
    """Cache utilization statistics."""
    total_size: int = 0
    total_entries: int = 0
    hit_rate: float = 0.0
    eviction_count: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    available_memory: int = 0
    memory_usage_percent: float = 0.0
    last_cleanup: float = field(default_factory=time.time)


class ModelCacheManager:
    """
    Intelligent model cache manager with SQLite persistence and LRU eviction.
    
    Features:
    - SQLite-based persistence across server restarts
    - LRU eviction based on memory limits
    - Memory usage estimation and monitoring
    - Cache corruption detection and recovery
    - Thread-safe operations
    """

    def __init__(
        self,
        cache_dir: Optional[str] = None,
        max_memory_mb: int = 4096,
        max_entries: int = 10,
        cleanup_threshold: float = 0.8
    ):
        """
        Initialize the model cache manager.
        
        Args:
            cache_dir: Directory for cache storage. Defaults to ~/.local/share/tts/model_cache/
            max_memory_mb: Maximum memory usage in MB before eviction
            max_entries: Maximum number of cached models
            cleanup_threshold: Memory threshold (0.0-1.0) to trigger cleanup
        """
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.max_entries = max_entries
        self.cleanup_threshold = cleanup_threshold
        self._lock = RLock()
        
        # Initialize cache directory
        if cache_dir is None:
            self.cache_dir = Path(get_user_data_dir("tts")) / "model_cache"
        else:
            self.cache_dir = Path(cache_dir)
        
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.cache_dir / "model_cache.db"
        
        # Initialize model manager for metadata
        self.model_manager = ModelManager()
        
        # Initialize database and in-memory cache
        self._init_database()
        self._cache_entries: Dict[str, CacheEntry] = {}
        self._load_cache_from_db()
        
        logger.info(f"ModelCacheManager initialized with cache dir: {self.cache_dir}")
        logger.info(f"Max memory: {max_memory_mb}MB, Max entries: {max_entries}")

    def _init_database(self) -> None:
        """Initialize SQLite database with required tables."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_entries (
                    model_name TEXT PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    memory_size INTEGER NOT NULL,
                    last_accessed REAL NOT NULL,
                    created_at REAL NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    is_corrupted INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY,
                    total_size INTEGER DEFAULT 0,
                    hit_rate REAL DEFAULT 0.0,
                    eviction_count INTEGER DEFAULT 0,
                    cache_hits INTEGER DEFAULT 0,
                    cache_misses INTEGER DEFAULT 0,
                    last_updated REAL DEFAULT 0
                )
            """)
            
            # Initialize stats if not exists
            conn.execute("""
                INSERT OR IGNORE INTO cache_stats (id) VALUES (1)
            """)
            
            conn.commit()

    def _load_cache_from_db(self) -> None:
        """Load cache entries from database into memory."""
        with sqlite3.connect(str(self.db_path)) as conn:
            cursor = conn.execute("""
                SELECT model_name, file_path, memory_size, last_accessed, 
                       created_at, hit_count, is_corrupted
                FROM cache_entries
            """)
            
            for row in cursor:
                model_name, file_path, memory_size, last_accessed, created_at, hit_count, is_corrupted = row
                
                # Verify file still exists
                if not Path(file_path).exists():
                    logger.warning(f"Cache file missing for {model_name}: {file_path}")
                    self._remove_entry_from_db(model_name)
                    continue
                
                entry = CacheEntry(
                    model_name=model_name,
                    file_path=file_path,
                    memory_size=memory_size,
                    last_accessed=last_accessed,
                    created_at=created_at,
                    hit_count=hit_count,
                    is_corrupted=bool(is_corrupted)
                )
                self._cache_entries[model_name] = entry

    def cache_model(self, model_name: str, tts_instance: TTS, memory_size: Optional[int] = None) -> bool:
        """
        Cache a TTS model instance to disk.
        
        Args:
            model_name: Name of the model to cache
            tts_instance: TTS instance to cache
            memory_size: Estimated memory size in bytes (calculated if None)
            
        Returns:
            True if successfully cached, False otherwise
        """
        with self._lock:
            try:
                if memory_size is None:
                    memory_size = self.estimate_memory_usage(model_name)
                
                # Check if we need cleanup before caching
                self._cleanup_if_needed(memory_size)
                
                # Create cache file
                cache_file = self.cache_dir / f"{self._sanitize_filename(model_name)}.pkl"
                
                # Serialize the model
                with open(cache_file, 'wb') as f:
                    pickle.dump({
                        'model_name': model_name,
                        'tts_instance': tts_instance,
                        'cached_at': time.time(),
                        'version': '1.0'
                    }, f, protocol=pickle.HIGHEST_PROTOCOL)
                
                # Create cache entry
                current_time = time.time()
                entry = CacheEntry(
                    model_name=model_name,
                    file_path=str(cache_file),
                    memory_size=memory_size,
                    last_accessed=current_time,
                    created_at=current_time
                )
                
                # Update in-memory cache
                self._cache_entries[model_name] = entry
                
                # Persist to database
                self._save_entry_to_db(entry)
                
                logger.info(f"Successfully cached model {model_name} ({memory_size / (1024*1024):.1f}MB)")
                return True
                
            except Exception as e:
                logger.error(f"Failed to cache model {model_name}: {e}")
                return False

    def get_cached_model(self, model_name: str) -> Optional[TTS]:
        """
        Retrieve a cached TTS model.
        
        Args:
            model_name: Name of the model to retrieve
            
        Returns:
            Cached TTS instance or None if not found/corrupted
        """
        with self._lock:
            entry = self._cache_entries.get(model_name)
            if not entry:
                self._increment_cache_misses()
                return None
            
            try:
                # Check if file exists
                cache_file = Path(entry.file_path)
                if not cache_file.exists():
                    logger.warning(f"Cache file missing for {model_name}")
                    self._remove_cached_model(model_name)
                    self._increment_cache_misses()
                    return None
                
                # Check if corrupted
                if entry.is_corrupted:
                    logger.warning(f"Cache entry marked as corrupted for {model_name}")
                    self._remove_cached_model(model_name)
                    self._increment_cache_misses()
                    return None
                
                # Load the cached model
                with open(cache_file, 'rb') as f:
                    cached_data = pickle.load(f)
                
                # Verify cached data integrity
                if not self._verify_cached_data(cached_data, model_name):
                    logger.warning(f"Cache data verification failed for {model_name}")
                    self._mark_as_corrupted(model_name)
                    self._increment_cache_misses()
                    return None
                
                # Update access time and hit count
                current_time = time.time()
                entry.last_accessed = current_time
                entry.hit_count += 1
                
                self._update_entry_in_db(entry)
                self._increment_cache_hits()
                
                logger.info(f"Cache hit for model {model_name} (hits: {entry.hit_count})")
                return cached_data['tts_instance']
                
            except Exception as e:
                logger.error(f"Failed to load cached model {model_name}: {e}")
                self._mark_as_corrupted(model_name)
                self._increment_cache_misses()
                return None

    def cleanup_cache(self) -> int:
        """
        Perform LRU cache cleanup based on memory limits.
        
        Returns:
            Number of entries evicted
        """
        with self._lock:
            return self._cleanup_lru_cache()

    def get_cache_stats(self) -> CacheStats:
        """
        Get current cache statistics.
        
        Returns:
            CacheStats object with current metrics
        """
        with self._lock:
            # Get memory info
            memory = psutil.virtual_memory()
            
            # Calculate total cache size
            total_size = sum(entry.memory_size for entry in self._cache_entries.values())
            
            # Get stats from database
            with sqlite3.connect(str(self.db_path)) as conn:
                cursor = conn.execute("""
                    SELECT hit_rate, eviction_count, cache_hits, cache_misses 
                    FROM cache_stats WHERE id = 1
                """)
                row = cursor.fetchone()
                if row:
                    db_hit_rate, eviction_count, cache_hits, cache_misses = row
                else:
                    db_hit_rate = eviction_count = cache_hits = cache_misses = 0
            
            # Calculate current hit rate
            total_requests = cache_hits + cache_misses
            current_hit_rate = (cache_hits / total_requests) if total_requests > 0 else 0.0
            
            return CacheStats(
                total_size=total_size,
                total_entries=len(self._cache_entries),
                hit_rate=current_hit_rate,
                eviction_count=eviction_count,
                cache_hits=cache_hits,
                cache_misses=cache_misses,
                available_memory=memory.available,
                memory_usage_percent=memory.percent,
                last_cleanup=time.time()
            )

    def estimate_memory_usage(self, model_name: str) -> int:
        """
        Estimate memory usage for a model.
        
        Args:
            model_name: Name of the model
            
        Returns:
            Estimated memory usage in bytes
        """
        # Base memory estimates for different model types
        memory_estimates = {
            'xtts': 2048 * 1024 * 1024,  # 2GB for XTTS models
            'vits': 512 * 1024 * 1024,   # 512MB for VITS models
            'tacotron': 256 * 1024 * 1024,  # 256MB for Tacotron models
            'glow_tts': 384 * 1024 * 1024,  # 384MB for GlowTTS models
            'bark': 1024 * 1024 * 1024,  # 1GB for Bark models
            'tortoise': 1536 * 1024 * 1024,  # 1.5GB for Tortoise models
        }
        
        # Default estimate
        default_estimate = 512 * 1024 * 1024  # 512MB default
        
        model_lower = model_name.lower()
        for model_type, size in memory_estimates.items():
            if model_type in model_lower:
                return size
        
        logger.warning(f"Unknown model type for {model_name}, using default estimate")
        return default_estimate

    def persist_cache(self) -> None:
        """Persist current cache state to database."""
        with self._lock:
            try:
                with sqlite3.connect(str(self.db_path)) as conn:
                    # Update all entries
                    for entry in self._cache_entries.values():
                        conn.execute("""
                            INSERT OR REPLACE INTO cache_entries 
                            (model_name, file_path, memory_size, last_accessed, 
                             created_at, hit_count, is_corrupted)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (
                            entry.model_name,
                            entry.file_path,
                            entry.memory_size,
                            entry.last_accessed,
                            entry.created_at,
                            entry.hit_count,
                            int(entry.is_corrupted)
                        ))
                    
                    conn.commit()
                    
                logger.debug("Cache state persisted to database")
                
            except Exception as e:
                logger.error(f"Failed to persist cache: {e}")

    def clear_cache(self) -> int:
        """
        Clear all cached models.
        
        Returns:
            Number of entries cleared
        """
        with self._lock:
            count = len(self._cache_entries)
            
            # Remove all cache files
            for entry in self._cache_entries.values():
                cache_file = Path(entry.file_path)
                if cache_file.exists():
                    try:
                        cache_file.unlink()
                    except Exception as e:
                        logger.error(f"Failed to delete cache file {cache_file}: {e}")
            
            # Clear in-memory cache
            self._cache_entries.clear()
            
            # Clear database
            with sqlite3.connect(str(self.db_path)) as conn:
                conn.execute("DELETE FROM cache_entries")
                conn.execute("UPDATE cache_stats SET eviction_count = eviction_count + ? WHERE id = 1", (count,))
                conn.commit()
            
            logger.info(f"Cleared {count} cache entries")
            return count

    def remove_model(self, model_name: str) -> bool:
        """
        Remove a specific model from cache.
        
        Args:
            model_name: Name of the model to remove
            
        Returns:
            True if removed, False if not found
        """
        with self._lock:
            return self._remove_cached_model(model_name)

    def _cleanup_if_needed(self, additional_size: int = 0) -> None:
        """Check if cleanup is needed and perform it."""
        current_size = sum(entry.memory_size for entry in self._cache_entries.values())
        projected_size = current_size + additional_size
        
        # Check memory threshold
        memory = psutil.virtual_memory()
        if (memory.percent > self.cleanup_threshold * 100 or
            projected_size > self.max_memory_bytes or
            len(self._cache_entries) >= self.max_entries):
            
            logger.info("Cache cleanup triggered")
            self._cleanup_lru_cache()

    def _cleanup_lru_cache(self) -> int:
        """Perform LRU-based cache cleanup."""
        if not self._cache_entries:
            return 0
        
        # Sort by last accessed time (LRU first)
        sorted_entries = sorted(
            self._cache_entries.values(),
            key=lambda x: x.last_accessed
        )
        
        evicted_count = 0
        current_size = sum(entry.memory_size for entry in self._cache_entries.values())
        
        # Remove entries until within limits
        for entry in sorted_entries:
            if (current_size <= self.max_memory_bytes and 
                len(self._cache_entries) <= self.max_entries):
                break
            
            if self._remove_cached_model(entry.model_name):
                current_size -= entry.memory_size
                evicted_count += 1
        
        # Update eviction count in database
        if evicted_count > 0:
            with sqlite3.connect(str(self.db_path)) as conn:
                conn.execute("""
                    UPDATE cache_stats 
                    SET eviction_count = eviction_count + ? 
                    WHERE id = 1
                """, (evicted_count,))
                conn.commit()
        
        logger.info(f"Evicted {evicted_count} cache entries via LRU cleanup")
        return evicted_count

    def _remove_cached_model(self, model_name: str) -> bool:
        """Remove a cached model from memory and disk."""
        entry = self._cache_entries.get(model_name)
        if not entry:
            return False
        
        # Remove file
        cache_file = Path(entry.file_path)
        if cache_file.exists():
            try:
                cache_file.unlink()
            except Exception as e:
                logger.error(f"Failed to delete cache file {cache_file}: {e}")
        
        # Remove from in-memory cache
        del self._cache_entries[model_name]
        
        # Remove from database
        self._remove_entry_from_db(model_name)
        
        logger.debug(f"Removed cached model {model_name}")
        return True

    def _verify_cached_data(self, cached_data: Dict[str, Any], expected_model_name: str) -> bool:
        """Verify integrity of cached data."""
        try:
            return (
                isinstance(cached_data, dict) and
                'model_name' in cached_data and
                'tts_instance' in cached_data and
                'cached_at' in cached_data and
                cached_data['model_name'] == expected_model_name and
                hasattr(cached_data['tts_instance'], 'tts')
            )
        except Exception:
            return False

    def _mark_as_corrupted(self, model_name: str) -> None:
        """Mark a cache entry as corrupted."""
        if model_name in self._cache_entries:
            self._cache_entries[model_name].is_corrupted = True
            self._update_entry_in_db(self._cache_entries[model_name])

    def _sanitize_filename(self, model_name: str) -> str:
        """Convert model name to safe filename."""
        return model_name.replace('/', '_').replace('\\', '_').replace(':', '_')

    def _save_entry_to_db(self, entry: CacheEntry) -> None:
        """Save a cache entry to database."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO cache_entries 
                (model_name, file_path, memory_size, last_accessed, created_at, hit_count, is_corrupted)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                entry.model_name, entry.file_path, entry.memory_size,
                entry.last_accessed, entry.created_at, entry.hit_count, int(entry.is_corrupted)
            ))
            conn.commit()

    def _update_entry_in_db(self, entry: CacheEntry) -> None:
        """Update an existing cache entry in database."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                UPDATE cache_entries 
                SET last_accessed = ?, hit_count = ?, is_corrupted = ?
                WHERE model_name = ?
            """, (entry.last_accessed, entry.hit_count, int(entry.is_corrupted), entry.model_name))
            conn.commit()

    def _remove_entry_from_db(self, model_name: str) -> None:
        """Remove a cache entry from database."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("DELETE FROM cache_entries WHERE model_name = ?", (model_name,))
            conn.commit()

    def _increment_cache_hits(self) -> None:
        """Increment cache hit counter."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                UPDATE cache_stats 
                SET cache_hits = cache_hits + 1,
                    hit_rate = CAST(cache_hits + 1 AS REAL) / CAST(cache_hits + cache_misses + 1 AS REAL),
                    last_updated = ?
                WHERE id = 1
            """, (time.time(),))
            conn.commit()

    def _increment_cache_misses(self) -> None:
        """Increment cache miss counter."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute("""
                UPDATE cache_stats 
                SET cache_misses = cache_misses + 1,
                    hit_rate = CAST(cache_hits AS REAL) / CAST(cache_hits + cache_misses + 1 AS REAL),
                    last_updated = ?
                WHERE id = 1
            """, (time.time(),))
            conn.commit()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - persist cache state."""
        self.persist_cache()

    def __del__(self):
        """Destructor - ensure cache is persisted."""
        try:
            self.persist_cache()
        except Exception:
            pass  # Ignore errors during cleanup