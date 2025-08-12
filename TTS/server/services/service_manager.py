"""Service manager for orchestrating TTS server services."""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from TTS.server.services.base_service import BaseService, ServiceResult
from TTS.server.services.synthesis_service import SynthesisService
from TTS.server.services.model_management_service import ModelManagementService
from TTS.server.model_cache import ModelCacheManager

logger = logging.getLogger(__name__)


@dataclass
class ServiceHealth:
    """Health status of a service."""
    name: str
    status: str
    initialized: bool
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ServiceManager:
    """Manager for orchestrating all TTS server services."""
    
    def __init__(self, cache_manager: Optional[ModelCacheManager] = None):
        """Initialize the service manager.
        
        Args:
            cache_manager: Optional model cache manager
        """
        self.logger = logging.getLogger("TTS.services.manager")
        self._services: Dict[str, BaseService] = {}
        self._initialization_order: List[str] = []
        self._initialized = False
        
        # Initialize services
        self._setup_services(cache_manager)
    
    def _setup_services(self, cache_manager: Optional[ModelCacheManager]):
        """Setup all services in the correct order.
        
        Args:
            cache_manager: Model cache manager instance
        """
        # Order matters - dependencies should be initialized first
        
        # Model management service (depends on cache manager)
        self._services["model_management"] = ModelManagementService(cache_manager)
        self._initialization_order.append("model_management")
        
        # Synthesis service (depends on model management)
        self._services["synthesis"] = SynthesisService()
        self._initialization_order.append("synthesis")
        
        self.logger.info(f"Service manager configured with {len(self._services)} services")
    
    async def initialize_all(self) -> ServiceResult:
        """Initialize all services in the correct order.
        
        Returns:
            ServiceResult indicating overall success
        """
        self.logger.info("Initializing all services...")
        
        failed_services = []
        initialized_services = []
        
        for service_name in self._initialization_order:
            service = self._services[service_name]
            self.logger.debug(f"Initializing service: {service_name}")
            
            try:
                result = await service.initialize()
                if result.success:
                    initialized_services.append(service_name)
                    self.logger.info(f"Service {service_name} initialized successfully")
                else:
                    failed_services.append({
                        "name": service_name,
                        "error": result.error_message
                    })
                    self.logger.error(f"Service {service_name} initialization failed: {result.error_message}")
            except Exception as e:
                failed_services.append({
                    "name": service_name,
                    "error": str(e)
                })
                self.logger.error(f"Service {service_name} initialization error: {str(e)}", exc_info=True)
        
        if not failed_services:
            self._initialized = True
            self.logger.info("All services initialized successfully")
            return ServiceResult(
                success=True,
                data={
                    "message": "All services initialized successfully",
                    "initialized_services": initialized_services,
                    "total_services": len(self._services)
                }
            )
        else:
            # Partial initialization
            self.logger.warning(f"Service initialization completed with {len(failed_services)} failures")
            return ServiceResult(
                success=len(failed_services) < len(self._services),  # Success if at least some services started
                data={
                    "message": f"Service initialization completed with {len(failed_services)} failures",
                    "initialized_services": initialized_services,
                    "failed_services": failed_services,
                    "total_services": len(self._services)
                },
                error_message=f"Failed to initialize {len(failed_services)} services" if failed_services else None
            )
    
    async def cleanup_all(self) -> ServiceResult:
        """Cleanup all services in reverse order.
        
        Returns:
            ServiceResult indicating overall success
        """
        self.logger.info("Cleaning up all services...")
        
        failed_cleanups = []
        cleaned_services = []
        
        # Cleanup in reverse order
        for service_name in reversed(self._initialization_order):
            service = self._services[service_name]
            
            if not service.is_initialized():
                continue
            
            self.logger.debug(f"Cleaning up service: {service_name}")
            
            try:
                result = await service.cleanup()
                if result.success:
                    cleaned_services.append(service_name)
                    self.logger.info(f"Service {service_name} cleanup completed")
                else:
                    failed_cleanups.append({
                        "name": service_name,
                        "error": result.error_message
                    })
                    self.logger.error(f"Service {service_name} cleanup failed: {result.error_message}")
            except Exception as e:
                failed_cleanups.append({
                    "name": service_name,
                    "error": str(e)
                })
                self.logger.error(f"Service {service_name} cleanup error: {str(e)}", exc_info=True)
        
        self._initialized = False
        
        if not failed_cleanups:
            self.logger.info("All services cleaned up successfully")
            return ServiceResult(
                success=True,
                data={
                    "message": "All services cleaned up successfully",
                    "cleaned_services": cleaned_services
                }
            )
        else:
            self.logger.warning(f"Service cleanup completed with {len(failed_cleanups)} failures")
            return ServiceResult(
                success=False,
                data={
                    "message": f"Service cleanup completed with {len(failed_cleanups)} failures",
                    "cleaned_services": cleaned_services,
                    "failed_cleanups": failed_cleanups
                },
                error_message=f"Failed to cleanup {len(failed_cleanups)} services"
            )
    
    async def health_check_all(self) -> ServiceResult:
        """Perform health check on all services.
        
        Returns:
            ServiceResult with health status of all services
        """
        service_health: List[ServiceHealth] = []
        healthy_count = 0
        
        for service_name, service in self._services.items():
            try:
                result = await service.health_check()
                
                if result.success:
                    health_status = ServiceHealth(
                        name=service_name,
                        status="healthy",
                        initialized=service.is_initialized(),
                        metadata=result.data
                    )
                    healthy_count += 1
                else:
                    health_status = ServiceHealth(
                        name=service_name,
                        status="unhealthy",
                        initialized=service.is_initialized(),
                        error_message=result.error_message,
                        metadata=result.data
                    )
                
                service_health.append(health_status)
                
            except Exception as e:
                self.logger.error(f"Health check error for service {service_name}: {str(e)}")
                service_health.append(ServiceHealth(
                    name=service_name,
                    status="error",
                    initialized=service.is_initialized(),
                    error_message=str(e)
                ))
        
        overall_healthy = healthy_count == len(self._services)
        
        return ServiceResult(
            success=overall_healthy,
            data={
                "overall_status": "healthy" if overall_healthy else "degraded",
                "healthy_services": healthy_count,
                "total_services": len(self._services),
                "services": [
                    {
                        "name": health.name,
                        "status": health.status,
                        "initialized": health.initialized,
                        "error_message": health.error_message,
                        "details": health.metadata
                    } for health in service_health
                ]
            }
        )
    
    def get_service(self, service_name: str) -> Optional[BaseService]:
        """Get a service by name.
        
        Args:
            service_name: Name of the service to retrieve
            
        Returns:
            Service instance or None if not found
        """
        return self._services.get(service_name)
    
    def get_synthesis_service(self) -> Optional[SynthesisService]:
        """Get the synthesis service.
        
        Returns:
            SynthesisService instance or None
        """
        service = self.get_service("synthesis")
        return service if isinstance(service, SynthesisService) else None
    
    def get_model_management_service(self) -> Optional[ModelManagementService]:
        """Get the model management service.
        
        Returns:
            ModelManagementService instance or None
        """
        service = self.get_service("model_management")
        return service if isinstance(service, ModelManagementService) else None
    
    def is_initialized(self) -> bool:
        """Check if the service manager is initialized.
        
        Returns:
            True if all services are initialized
        """
        return self._initialized
    
    def get_service_status(self) -> Dict[str, bool]:
        """Get the initialization status of all services.
        
        Returns:
            Dictionary mapping service names to initialization status
        """
        return {
            name: service.is_initialized()
            for name, service in self._services.items()
        }
    
    async def restart_service(self, service_name: str) -> ServiceResult:
        """Restart a specific service.
        
        Args:
            service_name: Name of the service to restart
            
        Returns:
            ServiceResult indicating success or failure
        """
        if service_name not in self._services:
            return ServiceResult(
                success=False,
                error_message=f"Service '{service_name}' not found",
                error_code="SERVICE_NOT_FOUND"
            )
        
        service = self._services[service_name]
        
        try:
            # Cleanup first
            if service.is_initialized():
                cleanup_result = await service.cleanup()
                if not cleanup_result.success:
                    self.logger.warning(f"Service {service_name} cleanup failed during restart: {cleanup_result.error_message}")
            
            # Re-initialize
            init_result = await service.initialize()
            
            if init_result.success:
                self.logger.info(f"Service {service_name} restarted successfully")
                return ServiceResult(
                    success=True,
                    data={
                        "message": f"Service {service_name} restarted successfully",
                        "service_name": service_name
                    }
                )
            else:
                self.logger.error(f"Service {service_name} restart failed during initialization: {init_result.error_message}")
                return ServiceResult(
                    success=False,
                    error_message=f"Service restart failed: {init_result.error_message}",
                    error_code="RESTART_FAILED"
                )
        
        except Exception as e:
            self.logger.error(f"Service {service_name} restart error: {str(e)}", exc_info=True)
            return ServiceResult(
                success=False,
                error_message=f"Service restart error: {str(e)}",
                error_code="RESTART_ERROR"
            )
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with cleanup."""
        try:
            # Use asyncio.run to handle cleanup if we're not in an async context
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context, create a task
                asyncio.create_task(self.cleanup_all())
            else:
                # If not in async context, run cleanup synchronously
                asyncio.run(self.cleanup_all())
        except Exception as e:
            self.logger.error(f"Error during service manager cleanup: {str(e)}")


# Global service manager instance
_global_service_manager: Optional[ServiceManager] = None


def get_service_manager(cache_manager: Optional[ModelCacheManager] = None) -> ServiceManager:
    """Get or create the global service manager instance.
    
    Args:
        cache_manager: Optional model cache manager
        
    Returns:
        ServiceManager instance
    """
    global _global_service_manager
    
    if _global_service_manager is None:
        _global_service_manager = ServiceManager(cache_manager)
    
    return _global_service_manager


def cleanup_service_manager() -> None:
    """Clean up the global service manager instance."""
    global _global_service_manager
    
    if _global_service_manager is not None:
        try:
            # Try to cleanup asynchronously if possible
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_global_service_manager.cleanup_all())
            else:
                asyncio.run(_global_service_manager.cleanup_all())
        except Exception as e:
            logger.error(f"Error cleaning up service manager: {str(e)}")
        finally:
            _global_service_manager = None
    
    logger.info("Service manager cleaned up")
