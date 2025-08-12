"""Base service interface for TTS server services."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ServiceResult:
    """Standard result structure for service operations."""
    success: bool
    data: Optional[Any] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BaseService(ABC):
    """Base service class that all TTS services should inherit from."""
    
    def __init__(self, name: str):
        """Initialize the base service.
        
        Args:
            name: Service name for logging and identification
        """
        self.name = name
        self.logger = logging.getLogger(f"TTS.services.{name}")
        self._initialized = False
    
    @abstractmethod
    async def initialize(self) -> ServiceResult:
        """Initialize the service. Must be implemented by subclasses.
        
        Returns:
            ServiceResult indicating success or failure
        """
        pass
    
    @abstractmethod
    async def cleanup(self) -> ServiceResult:
        """Cleanup service resources. Must be implemented by subclasses.
        
        Returns:
            ServiceResult indicating success or failure
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> ServiceResult:
        """Check service health. Must be implemented by subclasses.
        
        Returns:
            ServiceResult with health status information
        """
        pass
    
    def is_initialized(self) -> bool:
        """Check if service is initialized.
        
        Returns:
            True if service is initialized
        """
        return self._initialized
    
    def _mark_initialized(self) -> None:
        """Mark service as initialized."""
        self._initialized = True
        self.logger.info(f"Service {self.name} initialized successfully")
    
    def _mark_uninitialized(self) -> None:
        """Mark service as uninitialized."""
        self._initialized = False
        self.logger.info(f"Service {self.name} cleanup completed")
    
    async def safe_execute(self, operation_name: str, operation_func, *args, **kwargs) -> ServiceResult:
        """Safely execute an operation with error handling.
        
        Args:
            operation_name: Name of the operation for logging
            operation_func: Function to execute
            *args, **kwargs: Arguments to pass to the function
            
        Returns:
            ServiceResult with operation result
        """
        try:
            self.logger.debug(f"Executing {operation_name}")
            result = await operation_func(*args, **kwargs) if asyncio.iscoroutinefunction(operation_func) else operation_func(*args, **kwargs)
            self.logger.debug(f"{operation_name} completed successfully")
            return ServiceResult(success=True, data=result)
        except Exception as e:
            self.logger.error(f"{operation_name} failed: {str(e)}", exc_info=True)
            return ServiceResult(
                success=False,
                error_message=str(e),
                error_code=type(e).__name__
            )
