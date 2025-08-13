"""Server configuration classes for Coqui TTS."""

from dataclasses import asdict, dataclass, field
from typing import Dict, Any, List

from coqpit import Coqpit, check_argument


@dataclass
class ModelCacheConfig(Coqpit):
    """Configuration for model caching and memory management.

    Args:
        cache_size_limit_gb (float):
            Maximum memory size limit for the model cache in GB. When exceeded, 
            least recently used models will be unloaded. Defaults to 2.0.

        cache_size_limit_models (int):
            Maximum number of models to keep in cache simultaneously. 
            When exceeded, least recently used models will be unloaded. 
            Defaults to 3.

        model_ttl_seconds (int):
            Time-to-live for cached models in seconds. Models not accessed 
            within this time will be considered for cleanup. Set to 0 to disable 
            TTL-based cleanup. Defaults to 3600 (1 hour).

        cleanup_interval_seconds (int):
            Interval in seconds between cache cleanup operations. The cleanup 
            process removes expired and least recently used models. Defaults to 300 (5 minutes).

        enable_aggressive_cleanup (bool):
            Enable aggressive cleanup mode that more actively removes models 
            when memory pressure is detected. Defaults to False.

        memory_threshold_percent (float):
            System memory usage percentage threshold above which aggressive 
            model unloading is triggered. Defaults to 85.0.

        preload_default_models (bool):
            Whether to preload default/frequently used models at server startup 
            to improve initial response times. Defaults to True.

        enable_model_warmup (bool):
            Enable model warmup during loading to improve first inference 
            performance. May increase initial loading time. Defaults to False.
    """

    cache_size_limit_gb: float = 2.0
    cache_size_limit_models: int = 3
    model_ttl_seconds: int = 3600
    cleanup_interval_seconds: int = 300
    enable_aggressive_cleanup: bool = False
    memory_threshold_percent: float = 85.0
    preload_default_models: bool = True
    enable_model_warmup: bool = False

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        check_argument("cache_size_limit_gb", c, restricted=True, min_val=0.1, max_val=100.0)
        check_argument("cache_size_limit_models", c, restricted=True, min_val=1, max_val=50)
        check_argument("model_ttl_seconds", c, restricted=True, min_val=0, max_val=86400)
        check_argument("cleanup_interval_seconds", c, restricted=True, min_val=60, max_val=3600)
        check_argument("memory_threshold_percent", c, restricted=True, min_val=50.0, max_val=95.0)


@dataclass
class ProgressConfig(Coqpit):
    """Configuration for progress reporting and updates.

    Args:
        update_interval_ms (int):
            Minimum interval in milliseconds between progress updates. 
            System will update progress information at least this frequently 
            during model loading operations. Defaults to 500.

        include_time_estimates (bool):
            Whether to include estimated time remaining in progress updates. 
            Defaults to True.

        include_stage_details (bool):
            Whether to include detailed stage information (e.g., "Loading weights", 
            "Initializing model") in progress updates. Defaults to True.

        enable_percentage_progress (bool):
            Whether to include percentage complete in progress updates. 
            Defaults to True.

        detailed_logging (bool):
            Enable detailed logging of progress stages for debugging purposes. 
            Defaults to False.

        loading_timeout_seconds (int):
            Maximum time in seconds to wait for model loading before timing out. 
            Set to 0 to disable timeout. Defaults to 300 (5 minutes).

        stage_timeout_seconds (int):
            Maximum time in seconds to wait for individual loading stages 
            before timing out. Defaults to 120 (2 minutes).
    """

    update_interval_ms: int = 500
    include_time_estimates: bool = True
    include_stage_details: bool = True
    enable_percentage_progress: bool = True
    detailed_logging: bool = False
    loading_timeout_seconds: int = 300
    stage_timeout_seconds: int = 120

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        check_argument("update_interval_ms", c, restricted=True, min_val=100, max_val=5000)
        check_argument("loading_timeout_seconds", c, restricted=True, min_val=0, max_val=1800)
        check_argument("stage_timeout_seconds", c, restricted=True, min_val=10, max_val=600)


@dataclass
class MemoryManagementConfig(Coqpit):
    """Configuration for system memory management.

    Args:
        enable_memory_monitoring (bool):
            Enable continuous monitoring of system memory usage. 
            Defaults to True.

        memory_check_interval_seconds (int):
            Interval in seconds between memory usage checks. 
            Defaults to 30.

        low_memory_threshold_percent (float):
            System memory usage percentage above which low memory 
            warnings are triggered. Defaults to 80.0.

        critical_memory_threshold_percent (float):
            System memory usage percentage above which critical memory 
            actions are triggered (aggressive model unloading). 
            Defaults to 90.0.

        enable_garbage_collection (bool):
            Enable automatic garbage collection when memory thresholds 
            are exceeded. Defaults to True.

        gc_collection_interval_seconds (int):
            Interval in seconds between forced garbage collection cycles 
            when memory usage is high. Defaults to 60.

        enable_memory_pressure_response (bool):
            Enable automatic response to memory pressure by unloading 
            least recently used models. Defaults to True.

        unload_policy (str):
            Policy for determining which models to unload under memory pressure.
            Options: "lru" (least recently used), "size" (largest first), 
            "age" (oldest first). Defaults to "lru".

        min_free_memory_gb (float):
            Minimum amount of free memory to maintain in GB. When free memory 
            falls below this threshold, models will be unloaded. Defaults to 0.5.
    """

    enable_memory_monitoring: bool = True
    memory_check_interval_seconds: int = 30
    low_memory_threshold_percent: float = 80.0
    critical_memory_threshold_percent: float = 90.0
    enable_garbage_collection: bool = True
    gc_collection_interval_seconds: int = 60
    enable_memory_pressure_response: bool = True
    unload_policy: str = "lru"
    min_free_memory_gb: float = 0.5

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        check_argument("memory_check_interval_seconds", c, restricted=True, min_val=10, max_val=300)
        check_argument("low_memory_threshold_percent", c, restricted=True, min_val=50.0, max_val=95.0)
        check_argument("critical_memory_threshold_percent", c, restricted=True, min_val=60.0, max_val=98.0)
        check_argument("gc_collection_interval_seconds", c, restricted=True, min_val=30, max_val=600)
        check_argument("min_free_memory_gb", c, restricted=True, min_val=0.1, max_val=10.0)
        
        # Validate unload policy
        valid_policies = ["lru", "size", "age"]
        if c["unload_policy"] not in valid_policies:
            raise ValueError(f"unload_policy must be one of {valid_policies}, got {c['unload_policy']}")
        
        # Ensure critical threshold is higher than low threshold
        if c["critical_memory_threshold_percent"] <= c["low_memory_threshold_percent"]:
            raise ValueError("critical_memory_threshold_percent must be higher than low_memory_threshold_percent")


@dataclass
class SSEConnectionConfig(Coqpit):
    """Configuration for Server-Sent Events (SSE) connections.

    Args:
        connection_timeout_seconds (int):
            Maximum time in seconds to wait for SSE connection establishment 
            before timing out. Defaults to 30.

        keepalive_interval_seconds (int):
            Interval in seconds between keepalive messages sent to maintain 
            SSE connections. Defaults to 25.

        max_retry_attempts (int):
            Maximum number of retry attempts for failed SSE connections. 
            Defaults to 3.

        retry_delay_seconds (int):
            Base delay in seconds between retry attempts. Actual delay 
            may include exponential backoff. Defaults to 5.

        enable_exponential_backoff (bool):
            Enable exponential backoff for retry attempts, increasing 
            delay with each failed attempt. Defaults to True.

        max_backoff_seconds (int):
            Maximum backoff delay in seconds when using exponential backoff. 
            Defaults to 60.

        buffer_size (int):
            Size of the message buffer for SSE connections. Larger buffers 
            can handle more concurrent updates but use more memory. 
            Defaults to 1000.

        enable_compression (bool):
            Enable compression of SSE messages to reduce bandwidth usage. 
            Defaults to True.

        heartbeat_message (str):
            Message content for SSE heartbeat/keepalive messages. 
            Defaults to "heartbeat".
    """

    connection_timeout_seconds: int = 30
    keepalive_interval_seconds: int = 25
    max_retry_attempts: int = 3
    retry_delay_seconds: int = 5
    enable_exponential_backoff: bool = True
    max_backoff_seconds: int = 60
    buffer_size: int = 1000
    enable_compression: bool = True
    heartbeat_message: str = "heartbeat"

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        check_argument("connection_timeout_seconds", c, restricted=True, min_val=5, max_val=300)
        check_argument("keepalive_interval_seconds", c, restricted=True, min_val=5, max_val=120)
        check_argument("max_retry_attempts", c, restricted=True, min_val=0, max_val=10)
        check_argument("retry_delay_seconds", c, restricted=True, min_val=1, max_val=60)
        check_argument("max_backoff_seconds", c, restricted=True, min_val=1, max_val=300)
        check_argument("buffer_size", c, restricted=True, min_val=100, max_val=10000)


@dataclass
class OpenAPIServerConfig(Coqpit):
    """Configuration for OpenAPI-first TTS server implementation.

    Args:
        openapi_spec_path (str):
            Path to the OpenAPI specification file. Defaults to "openapi.yaml".

        strict_validation (bool):
            Enable strict validation of OpenAPI specification during startup.
            When True, any validation errors will prevent server startup.
            Defaults to True.

        require_all_endpoints (bool):
            Require all endpoints defined in OpenAPI spec to be successfully
            registered. When True, missing endpoints will prevent startup.
            Defaults to True.

        auto_generate_missing (bool):
            Automatically generate missing API components (models, endpoints)
            from OpenAPI specification when they are not found. Defaults to True.

        generation_timeout_seconds (int):
            Maximum time in seconds to wait for OpenAPI component generation
            before timing out. Defaults to 60.

        force_regeneration (bool):
            Force regeneration of API components even if they already exist.
            Useful for ensuring components are up-to-date with spec changes.
            Defaults to False.

        api_only_mode (bool):
            Enable API-only mode, disabling frontend asset serving and 
            focusing purely on REST API endpoints. Defaults to True.

        enable_openapi_docs (bool):
            Enable OpenAPI documentation serving at /docs endpoint.
            Provides Swagger UI interface for API exploration. Defaults to True.

        enable_redoc_docs (bool):
            Enable ReDoc documentation serving at /redoc endpoint.
            Provides alternative documentation interface. Defaults to True.

        cors_origins (List[str]):
            List of allowed CORS origins for cross-origin API requests.
            Empty list allows no cross-origin requests. Defaults to empty list.

        model_service_required (bool):
            Whether ModelManagementService is required for server operation.
            When True, server won't start without healthy model service.
            Defaults to True.

        health_check_interval_seconds (int):
            Interval in seconds between health checks of integrated services.
            Used for monitoring service status and availability. Defaults to 30.

        graceful_shutdown_timeout_seconds (int):
            Maximum time in seconds to wait for graceful shutdown of services
            before forcing termination. Defaults to 30.
    """

    openapi_spec_path: str = "openapi.yaml"
    strict_validation: bool = True
    require_all_endpoints: bool = True
    auto_generate_missing: bool = True
    generation_timeout_seconds: int = 60
    force_regeneration: bool = False
    api_only_mode: bool = True
    enable_openapi_docs: bool = True
    enable_redoc_docs: bool = True
    cors_origins: list = field(default_factory=list)
    model_service_required: bool = True
    health_check_interval_seconds: int = 30
    graceful_shutdown_timeout_seconds: int = 30

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        check_argument("generation_timeout_seconds", c, restricted=True, min_val=10, max_val=600)
        check_argument("health_check_interval_seconds", c, restricted=True, min_val=5, max_val=300)
        check_argument("graceful_shutdown_timeout_seconds", c, restricted=True, min_val=5, max_val=300)
        
        # Validate openapi_spec_path is not empty
        if not c["openapi_spec_path"] or not c["openapi_spec_path"].strip():
            raise ValueError("openapi_spec_path cannot be empty")
            
        # Validate cors_origins is a list
        if not isinstance(c["cors_origins"], list):
            raise ValueError("cors_origins must be a list of strings")


@dataclass
class ServerConfig(Coqpit):
    """Main server configuration containing all subsystem configurations.

    Args:
        model_cache (ModelCacheConfig):
            Configuration for model caching and memory management.

        progress (ProgressConfig):
            Configuration for progress reporting and updates.

        memory_management (MemoryManagementConfig):
            Configuration for system memory management.

        sse_connection (SSEConnectionConfig):
            Configuration for Server-Sent Events connections.

        openapi_server (OpenAPIServerConfig):
            Configuration for OpenAPI-first server implementation.

        debug_mode (bool):
            Enable debug mode with additional logging and validation. 
            Defaults to False.

        enable_metrics (bool):
            Enable collection and reporting of server metrics (memory usage, 
            response times, etc.). Defaults to True.

        metrics_collection_interval_seconds (int):
            Interval in seconds between metrics collection cycles. 
            Defaults to 60.

        log_level (str):
            Logging level for server operations. Options: "DEBUG", "INFO", 
            "WARNING", "ERROR", "CRITICAL". Defaults to "INFO".
    """

    model_cache: ModelCacheConfig = field(default_factory=ModelCacheConfig)
    progress: ProgressConfig = field(default_factory=ProgressConfig)
    memory_management: MemoryManagementConfig = field(default_factory=MemoryManagementConfig)
    sse_connection: SSEConnectionConfig = field(default_factory=SSEConnectionConfig)
    openapi_server: OpenAPIServerConfig = field(default_factory=OpenAPIServerConfig)
    
    debug_mode: bool = False
    enable_metrics: bool = True
    metrics_collection_interval_seconds: int = 60
    log_level: str = "INFO"

    def check_values(self) -> None:
        """Check config fields."""
        c = asdict(self)
        super().check_values()
        
        # Validate log level
        valid_log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if c["log_level"] not in valid_log_levels:
            raise ValueError(f"log_level must be one of {valid_log_levels}, got {c['log_level']}")
            
        check_argument("metrics_collection_interval_seconds", c, restricted=True, min_val=10, max_val=3600)
        
        # Check nested configurations
        if self.model_cache:
            self.model_cache.check_values()
        if self.progress:
            self.progress.check_values()
        if self.memory_management:
            self.memory_management.check_values()
        if self.sse_connection:
            self.sse_connection.check_values()
        if self.openapi_server:
            self.openapi_server.check_values()


def create_default_server_config() -> ServerConfig:
    """Create a default server configuration with sensible defaults.
    
    Returns:
        ServerConfig: Default configuration instance.
    """
    return ServerConfig()


def load_server_config_from_dict(config_dict: Dict[str, Any]) -> ServerConfig:
    """Load server configuration from a dictionary.
    
    Args:
        config_dict: Dictionary containing configuration values.
        
    Returns:
        ServerConfig: Loaded configuration instance.
    """
    config = ServerConfig()
    config.from_dict(config_dict)
    return config