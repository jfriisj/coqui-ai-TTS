"""Comprehensive error handling for TTS server operations.

This module provides robust error handling with recovery strategies, user-friendly
error messages, and intelligent suggestions for common failure scenarios.
"""

import gc
import logging
import os
import psutil
import time
import traceback
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Tuple, Union
import requests
import torch

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Severity levels for different types of errors."""
    LOW = auto()      # Minor issues, system can continue normally
    MEDIUM = auto()   # Issues that affect functionality but are recoverable
    HIGH = auto()     # Major issues requiring user intervention
    CRITICAL = auto() # System-breaking issues requiring immediate attention


class ErrorCategory(Enum):
    """Categories of errors for better classification."""
    NETWORK = "network"
    MEMORY = "memory" 
    MODEL = "model"
    FILESYSTEM = "filesystem"
    HARDWARE = "hardware"
    CONFIGURATION = "configuration"
    USER_INPUT = "user_input"
    SYSTEM = "system"


class TTSError(Exception):
    """Base exception class for TTS server errors."""
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        suggestions: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
        recoverable: bool = True
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.severity = severity
        self.suggestions = suggestions or []
        self.context = context or {}
        self.recoverable = recoverable
        self.timestamp = time.time()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for API responses."""
        return {
            "error": self.message,
            "category": self.category.value,
            "severity": self.severity.name.lower(),
            "suggestions": self.suggestions,
            "context": self.context,
            "recoverable": self.recoverable,
            "timestamp": self.timestamp
        }


class ModelLoadingError(TTSError):
    """Exception raised when model loading fails."""
    
    def __init__(
        self,
        message: str,
        model_name: Optional[str] = None,
        cause: Optional[Exception] = None,
        retry_count: int = 0,
        **kwargs
    ):
        context = kwargs.get('context', {})
        context.update({
            'model_name': model_name,
            'retry_count': retry_count,
            'original_cause': str(cause) if cause else None
        })
        kwargs['context'] = context
        kwargs.setdefault('category', ErrorCategory.MODEL)
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        
        super().__init__(message, **kwargs)
        self.model_name = model_name
        self.cause = cause
        self.retry_count = retry_count


class NetworkError(TTSError):
    """Exception raised for network-related failures."""
    
    def __init__(
        self,
        message: str,
        url: Optional[str] = None,
        status_code: Optional[int] = None,
        timeout: bool = False,
        **kwargs
    ):
        context = kwargs.get('context', {})
        context.update({
            'url': url,
            'status_code': status_code,
            'timeout': timeout
        })
        kwargs['context'] = context
        kwargs.setdefault('category', ErrorCategory.NETWORK)
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        
        super().__init__(message, **kwargs)
        self.url = url
        self.status_code = status_code
        self.timeout = timeout


class InsufficientMemoryError(TTSError):
    """Exception raised when system runs out of memory."""
    
    def __init__(
        self,
        message: str,
        required_memory_mb: Optional[float] = None,
        available_memory_mb: Optional[float] = None,
        model_name: Optional[str] = None,
        **kwargs
    ):
        context = kwargs.get('context', {})
        context.update({
            'required_memory_mb': required_memory_mb,
            'available_memory_mb': available_memory_mb,
            'model_name': model_name
        })
        kwargs['context'] = context
        kwargs.setdefault('category', ErrorCategory.MEMORY)
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        
        super().__init__(message, **kwargs)
        self.required_memory_mb = required_memory_mb
        self.available_memory_mb = available_memory_mb
        self.model_name = model_name


class ModelCorruptionError(TTSError):
    """Exception raised when model files are corrupted."""
    
    def __init__(
        self,
        message: str,
        model_path: Optional[str] = None,
        file_size: Optional[int] = None,
        expected_size: Optional[int] = None,
        **kwargs
    ):
        context = kwargs.get('context', {})
        context.update({
            'model_path': model_path,
            'file_size': file_size,
            'expected_size': expected_size
        })
        kwargs['context'] = context
        kwargs.setdefault('category', ErrorCategory.MODEL)
        kwargs.setdefault('severity', ErrorSeverity.HIGH)
        
        super().__init__(message, **kwargs)
        self.model_path = model_path
        self.file_size = file_size
        self.expected_size = expected_size


class IncompatibilityError(TTSError):
    """Exception raised when model is incompatible with current settings."""
    
    def __init__(
        self,
        message: str,
        model_name: Optional[str] = None,
        required_features: Optional[List[str]] = None,
        missing_features: Optional[List[str]] = None,
        **kwargs
    ):
        context = kwargs.get('context', {})
        context.update({
            'model_name': model_name,
            'required_features': required_features,
            'missing_features': missing_features
        })
        kwargs['context'] = context
        kwargs.setdefault('category', ErrorCategory.CONFIGURATION)
        kwargs.setdefault('severity', ErrorSeverity.MEDIUM)
        
        super().__init__(message, **kwargs)
        self.model_name = model_name
        self.required_features = required_features or []
        self.missing_features = missing_features or []


class ErrorRecoveryManager:
    """Manages error recovery strategies with exponential backoff and intelligent suggestions."""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.retry_counts: Dict[str, int] = {}
        self.last_errors: Dict[str, TTSError] = {}
        
    def calculate_backoff_delay(self, retry_count: int) -> float:
        """Calculate exponential backoff delay."""
        return min(self.base_delay * (2 ** retry_count), 30.0)  # Max 30 seconds
    
    def should_retry(self, error: TTSError, operation_key: str) -> bool:
        """Determine if an operation should be retried."""
        current_retry_count = self.retry_counts.get(operation_key, 0)
        
        # Don't retry if max retries exceeded
        if current_retry_count >= self.max_retries:
            return False
        
        # Don't retry non-recoverable errors
        if not error.recoverable:
            return False
            
        # Don't retry user input errors
        if error.category == ErrorCategory.USER_INPUT:
            return False
            
        # Always retry network errors
        if error.category == ErrorCategory.NETWORK:
            return True
        
        # Retry memory errors after cleanup
        if error.category == ErrorCategory.MEMORY:
            return True
            
        # Retry model errors with corruption
        if isinstance(error, ModelCorruptionError):
            return True
            
        return error.severity in [ErrorSeverity.LOW, ErrorSeverity.MEDIUM]
    
    def get_retry_delay(self, operation_key: str) -> float:
        """Get the delay before next retry attempt."""
        retry_count = self.retry_counts.get(operation_key, 0)
        return self.calculate_backoff_delay(retry_count)
    
    def record_retry(self, operation_key: str):
        """Record a retry attempt."""
        self.retry_counts[operation_key] = self.retry_counts.get(operation_key, 0) + 1
    
    def reset_retries(self, operation_key: str):
        """Reset retry count for an operation."""
        self.retry_counts.pop(operation_key, None)
        self.last_errors.pop(operation_key, None)
    
    def record_error(self, operation_key: str, error: TTSError):
        """Record an error for an operation."""
        self.last_errors[operation_key] = error


class SystemResourceMonitor:
    """Monitors system resources and provides intelligent recommendations."""
    
    @staticmethod
    def get_memory_info() -> Dict[str, float]:
        """Get current memory usage information."""
        try:
            memory = psutil.virtual_memory()
            return {
                'total_gb': memory.total / (1024**3),
                'available_gb': memory.available / (1024**3),
                'used_gb': memory.used / (1024**3),
                'percent_used': memory.percent,
                'free_gb': (memory.total - memory.used) / (1024**3)
            }
        except Exception as e:
            logger.warning(f"Failed to get memory info: {e}")
            return {}
    
    @staticmethod
    def get_gpu_memory_info() -> Dict[str, Any]:
        """Get GPU memory information if available."""
        gpu_info = {}
        try:
            if torch.cuda.is_available():
                for device_id in range(torch.cuda.device_count()):
                    props = torch.cuda.get_device_properties(device_id)
                    memory_allocated = torch.cuda.memory_allocated(device_id) / (1024**3)
                    memory_cached = torch.cuda.memory_reserved(device_id) / (1024**3)
                    memory_total = props.total_memory / (1024**3)
                    
                    gpu_info[f'cuda:{device_id}'] = {
                        'name': props.name,
                        'total_memory_gb': memory_total,
                        'allocated_memory_gb': memory_allocated,
                        'cached_memory_gb': memory_cached,
                        'free_memory_gb': memory_total - memory_allocated,
                        'utilization_percent': (memory_allocated / memory_total) * 100
                    }
        except Exception as e:
            logger.warning(f"Failed to get GPU memory info: {e}")
        
        return gpu_info
    
    @staticmethod
    def estimate_model_memory_requirements(model_name: str) -> float:
        """Estimate memory requirements for a model in MB."""
        # Rough estimates based on model architecture
        memory_estimates = {
            'xtts': 6000,     # XTTS models are large
            'bark': 8000,     # Bark models are very large
            'vits': 2000,     # VITS models are moderate
            'tacotron2': 1500, # Tacotron2 models are smaller
            'tacotron': 1000,  # Original Tacotron is smaller
            'fastspeech': 1500,
            'glow': 2000,
            'yourtts': 4000
        }
        
        model_lower = model_name.lower()
        for arch, memory_mb in memory_estimates.items():
            if arch in model_lower:
                return memory_mb
        
        # Default estimate for unknown models
        return 2500
    
    @classmethod
    def check_memory_availability(cls, required_mb: float, model_name: str = "") -> Tuple[bool, Dict[str, Any]]:
        """Check if sufficient memory is available for model loading."""
        memory_info = cls.get_memory_info()
        gpu_info = cls.get_gpu_memory_info()
        
        if not memory_info:
            return True, {"warning": "Could not check memory availability"}
        
        available_mb = memory_info.get('available_gb', 0) * 1024
        result = {
            'sufficient_memory': available_mb >= required_mb,
            'required_mb': required_mb,
            'available_mb': available_mb,
            'system_memory_info': memory_info,
            'gpu_memory_info': gpu_info
        }
        
        return result['sufficient_memory'], result


class ErrorMessageFormatter:
    """Formats error messages with user-friendly suggestions."""
    
    @staticmethod
    def format_network_error(error: NetworkError) -> Dict[str, Any]:
        """Format network error with specific suggestions."""
        suggestions = []
        
        if error.timeout:
            suggestions.extend([
                "Check your internet connection stability",
                "Try loading the model again after a few minutes",
                "Consider using a different network if available"
            ])
        elif error.status_code:
            if error.status_code == 404:
                suggestions.extend([
                    "The model file may no longer be available",
                    "Check if the model name is spelled correctly",
                    "Try using a different model from the available list"
                ])
            elif error.status_code >= 500:
                suggestions.extend([
                    "The model server is experiencing issues",
                    "Wait a few minutes and try again",
                    "Check the Coqui TTS status page for known issues"
                ])
            else:
                suggestions.extend([
                    "Network connection issue occurred",
                    "Check your internet connection",
                    "Try again after a short wait"
                ])
        else:
            suggestions.extend([
                "Check your internet connection",
                "Ensure firewall allows TTS server connections",
                "Try loading a different model"
            ])
        
        return {
            "error": f"Network error: {error.message}",
            "category": "network",
            "suggestions": suggestions,
            "context": error.context,
            "recoverable": True
        }
    
    @staticmethod
    def format_memory_error(error: InsufficientMemoryError) -> Dict[str, Any]:
        """Format memory error with optimization suggestions."""
        suggestions = []
        memory_info = SystemResourceMonitor.get_memory_info()
        
        if error.required_memory_mb and error.available_memory_mb:
            deficit_gb = (error.required_memory_mb - error.available_memory_mb) / 1024
            suggestions.append(f"Free up at least {deficit_gb:.1f} GB of memory")
        
        suggestions.extend([
            "Close other applications to free memory",
            "Consider using a smaller model (e.g., Tacotron2 instead of XTTS)",
            "Switch to CPU processing if using GPU",
            "Restart the TTS server to clear memory leaks"
        ])
        
        # Add system-specific suggestions
        if memory_info.get('percent_used', 0) > 90:
            suggestions.insert(0, "System memory is critically low - close unnecessary applications")
        
        return {
            "error": f"Insufficient memory: {error.message}",
            "category": "memory", 
            "suggestions": suggestions,
            "context": {
                **error.context,
                "system_memory": memory_info
            },
            "recoverable": True
        }
    
    @staticmethod
    def format_model_corruption_error(error: ModelCorruptionError) -> Dict[str, Any]:
        """Format model corruption error with recovery suggestions."""
        suggestions = [
            "Clear the model cache and redownload",
            "Check available disk space for complete download",
            "Try using a different model temporarily",
            "Restart the TTS server to reset model cache"
        ]
        
        if error.file_size and error.expected_size:
            size_diff = abs(error.file_size - error.expected_size)
            suggestions.insert(0, f"Model file is {size_diff} bytes different than expected - will attempt redownload")
        
        return {
            "error": f"Model corruption detected: {error.message}",
            "category": "model",
            "suggestions": suggestions,
            "context": error.context,
            "recoverable": True,
            "automatic_recovery": "Will attempt to redownload the model"
        }
    
    @staticmethod
    def format_incompatibility_error(error: IncompatibilityError) -> Dict[str, Any]:
        """Format compatibility error with alternative suggestions."""
        suggestions = []
        
        if error.missing_features:
            suggestions.append(f"This operation requires: {', '.join(error.missing_features)}")
        
        suggestions.extend([
            "Try selecting a model that supports the required features",
            "Check model compatibility in the model information panel",
            "Consider adjusting your synthesis parameters"
        ])
        
        # Add specific model suggestions based on missing features
        if 'multi_speaker' in error.missing_features:
            suggestions.append("Try models like VITS or YourTTS for multi-speaker support")
        if 'voice_cloning' in error.missing_features:
            suggestions.append("Try XTTS or YourTTS models for voice cloning")
        
        return {
            "error": f"Model incompatibility: {error.message}",
            "category": "configuration",
            "suggestions": suggestions,
            "context": error.context,
            "recoverable": True
        }
    
    @staticmethod
    def format_generic_error(error: TTSError) -> Dict[str, Any]:
        """Format generic TTS error."""
        base_suggestions = [
            "Try reloading the current model",
            "Check the server logs for more details", 
            "Restart the TTS server if issues persist"
        ]
        
        suggestions = error.suggestions + base_suggestions
        
        return {
            "error": error.message,
            "category": error.category.value,
            "suggestions": list(dict.fromkeys(suggestions)),  # Remove duplicates
            "context": error.context,
            "recoverable": error.recoverable
        }


class TTSErrorHandler:
    """Main error handler with recovery strategies and intelligent error reporting."""
    
    def __init__(self):
        self.recovery_manager = ErrorRecoveryManager()
        self.formatter = ErrorMessageFormatter()
        self.resource_monitor = SystemResourceMonitor()
    
    def handle_error(
        self,
        exception: Exception,
        operation: str = "unknown",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main error handling method that processes exceptions and returns formatted responses.
        
        Args:
            exception: The exception that occurred
            operation: Description of the operation that failed
            context: Additional context about the error
            
        Returns:
            Formatted error response dictionary
        """
        # Convert to TTSError if not already
        if isinstance(exception, TTSError):
            tts_error = exception
        else:
            tts_error = self._convert_to_tts_error(exception, operation, context or {})
        
        # Record the error
        self.recovery_manager.record_error(operation, tts_error)
        
        # Log the error with appropriate level
        log_level = self._get_log_level(tts_error.severity)
        logger.log(log_level, f"Error in {operation}: {tts_error.message}")
        
        # Format the error response
        return self._format_error_response(tts_error)
    
    def _convert_to_tts_error(
        self,
        exception: Exception,
        operation: str,
        context: Dict[str, Any]
    ) -> TTSError:
        """Convert generic exceptions to TTSError instances."""
        error_msg = str(exception)
        exception_type = type(exception).__name__
        
        # Detect network errors
        if isinstance(exception, (requests.RequestException, ConnectionError)):
            return NetworkError(
                message=f"Network error during {operation}: {error_msg}",
                context=context
            )
        
        # Detect memory errors
        if isinstance(exception, (MemoryError, torch.cuda.OutOfMemoryError)) or \
           "memory" in error_msg.lower() or "out of memory" in error_msg.lower():
            memory_info = self.resource_monitor.get_memory_info()
            return InsufficientMemoryError(
                message=f"Out of memory during {operation}: {error_msg}",
                available_memory_mb=memory_info.get('available_gb', 0) * 1024,
                context=context
            )
        
        # Detect file/corruption errors
        if isinstance(exception, (IOError, FileNotFoundError)) or \
           any(word in error_msg.lower() for word in ['corrupt', 'invalid', 'malformed']):
            return ModelCorruptionError(
                message=f"File/model corruption in {operation}: {error_msg}",
                context=context
            )
        
        # Default to generic TTS error
        severity = ErrorSeverity.HIGH if "critical" in error_msg.lower() else ErrorSeverity.MEDIUM
        return TTSError(
            message=f"Error in {operation}: {error_msg}",
            severity=severity,
            context={**context, "exception_type": exception_type, "traceback": traceback.format_exc()}
        )
    
    def _get_log_level(self, severity: ErrorSeverity) -> int:
        """Get appropriate logging level for error severity."""
        return {
            ErrorSeverity.LOW: logging.DEBUG,
            ErrorSeverity.MEDIUM: logging.WARNING,  
            ErrorSeverity.HIGH: logging.ERROR,
            ErrorSeverity.CRITICAL: logging.CRITICAL
        }[severity]
    
    def _format_error_response(self, error: TTSError) -> Dict[str, Any]:
        """Format error response based on error type."""
        if isinstance(error, NetworkError):
            return self.formatter.format_network_error(error)
        elif isinstance(error, InsufficientMemoryError):
            return self.formatter.format_memory_error(error)
        elif isinstance(error, ModelCorruptionError):
            return self.formatter.format_model_corruption_error(error)
        elif isinstance(error, IncompatibilityError):
            return self.formatter.format_incompatibility_error(error)
        else:
            return self.formatter.format_generic_error(error)
    
    def should_retry_operation(self, operation: str) -> bool:
        """Check if an operation should be retried."""
        if operation not in self.recovery_manager.last_errors:
            return False
        
        last_error = self.recovery_manager.last_errors[operation]
        return self.recovery_manager.should_retry(last_error, operation)
    
    def get_retry_delay(self, operation: str) -> float:
        """Get delay before retrying operation."""
        return self.recovery_manager.get_retry_delay(operation)
    
    def record_retry_attempt(self, operation: str):
        """Record that a retry attempt is being made."""
        self.recovery_manager.record_retry(operation)
    
    def clear_error_history(self, operation: str):
        """Clear error history for an operation after success."""
        self.recovery_manager.reset_retries(operation)
    
    def cleanup_memory(self):
        """Perform memory cleanup to recover from memory errors."""
        try:
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if available
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            
            logger.info("Memory cleanup completed")
            return True
        except Exception as e:
            logger.error(f"Memory cleanup failed: {e}")
            return False
    
    def get_system_recommendations(self, model_name: str = "") -> List[str]:
        """Get system optimization recommendations."""
        recommendations = []
        memory_info = self.resource_monitor.get_memory_info()
        
        if memory_info.get('percent_used', 0) > 80:
            recommendations.append("System memory usage is high - consider closing other applications")
        
        if model_name:
            required_memory = self.resource_monitor.estimate_model_memory_requirements(model_name)
            sufficient, details = self.resource_monitor.check_memory_availability(required_memory, model_name)
            
            if not sufficient:
                deficit = required_memory - details.get('available_mb', 0)
                recommendations.append(f"Need {deficit:.0f} MB more memory for {model_name}")
                recommendations.append("Consider using a smaller model or freeing up memory")
        
        gpu_info = self.resource_monitor.get_gpu_memory_info()
        for device, info in gpu_info.items():
            if info.get('utilization_percent', 0) > 90:
                recommendations.append(f"GPU {device} memory is nearly full")
        
        return recommendations


# Global error handler instance
_error_handler: Optional[TTSErrorHandler] = None


def get_error_handler() -> TTSErrorHandler:
    """Get the global error handler instance."""
    global _error_handler
    if _error_handler is None:
        _error_handler = TTSErrorHandler()
    return _error_handler


def handle_tts_error(
    exception: Exception,
    operation: str = "unknown",
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convenience function for handling TTS errors.
    
    Args:
        exception: The exception that occurred
        operation: Description of the operation that failed
        context: Additional context about the error
        
    Returns:
        Formatted error response dictionary
    """
    return get_error_handler().handle_error(exception, operation, context)


def create_model_loading_error(
    message: str,
    model_name: str,
    cause: Optional[Exception] = None,
    retry_count: int = 0
) -> ModelLoadingError:
    """
    Create a model loading error with appropriate suggestions.
    
    Args:
        message: Error message
        model_name: Name of the model that failed to load
        cause: Original exception that caused the failure
        retry_count: Number of previous retry attempts
        
    Returns:
        ModelLoadingError instance with contextual suggestions
    """
    suggestions = []
    
    # Add retry-specific suggestions
    if retry_count == 0:
        suggestions.extend([
            "Checking network connection...",
            "This may be a temporary issue - retrying automatically"
        ])
    elif retry_count < 3:
        suggestions.extend([
            f"Retry attempt {retry_count + 1}/3",
            "Verifying model file integrity"
        ])
    else:
        suggestions.extend([
            "Maximum retry attempts reached",
            "Try selecting a different model",
            "Check server logs for detailed error information"
        ])
    
    # Add cause-specific suggestions
    if cause:
        if isinstance(cause, (requests.RequestException, ConnectionError)):
            suggestions.extend([
                "Network connectivity issue detected",
                "Check your internet connection",
                "Ensure firewall allows model downloads"
            ])
        elif "memory" in str(cause).lower():
            memory_info = SystemResourceMonitor.get_memory_info()
            if memory_info.get('available_gb', 0) < 2:
                suggestions.append("System is low on memory - close other applications")
            suggestions.append(f"Consider using a smaller model than {model_name}")
    
    return ModelLoadingError(
        message=message,
        model_name=model_name,
        cause=cause,
        retry_count=retry_count,
        suggestions=suggestions
    )


def create_memory_error(
    message: str,
    model_name: str,
    required_memory_mb: Optional[float] = None
) -> InsufficientMemoryError:
    """
    Create a memory error with system-specific suggestions.
    
    Args:
        message: Error message
        model_name: Name of the model requiring memory
        required_memory_mb: Amount of memory required
        
    Returns:
        InsufficientMemoryError with optimization suggestions
    """
    memory_info = SystemResourceMonitor.get_memory_info()
    available_memory_mb = memory_info.get('available_gb', 0) * 1024
    
    suggestions = [
        "Close unnecessary applications to free memory",
        "Consider restarting the TTS server to clear memory leaks"
    ]
    
    # Add model-specific suggestions
    if "xtts" in model_name.lower():
        suggestions.extend([
            "XTTS models require significant memory (~6GB)",
            "Try Tacotron2 or VITS models for lower memory usage"
        ])
    elif "bark" in model_name.lower():
        suggestions.extend([
            "Bark models are very large (~8GB+)",
            "Consider using XTTS or VITS for similar quality with less memory"
        ])
    
    # Add system recommendations
    if memory_info.get('percent_used', 0) > 90:
        suggestions.insert(0, "Critical: System memory is nearly exhausted")
    
    return InsufficientMemoryError(
        message=message,
        model_name=model_name,
        required_memory_mb=required_memory_mb,
        available_memory_mb=available_memory_mb,
        suggestions=suggestions
    )