/**
 * Error Display Component for Coqui TTS Frontend
 * 
 * Advanced error display component specifically designed for model loading failures
 * and operational errors. Provides categorized error messages, troubleshooting
 * suggestions, retry mechanisms, and fallback options based on error type.
 * 
 * Features:
 * - Comprehensive model loading error handling with specific failure categories
 * - Contextual troubleshooting suggestions based on error type and conditions
 * - Retry actions with exponential backoff and intelligent retry logic
 * - Fallback model options when primary model loading fails
 * - Network connectivity diagnostics and recovery suggestions
 * - Memory optimization suggestions for insufficient memory errors
 * - File corruption detection with automatic redownload options
 * - Model compatibility checking with automatic setting adjustments
 * - Error reporting and debugging information collection
 * - Theme-aware responsive design with accessibility features
 * - Progressive disclosure for technical details and advanced options
 * 
 * Requirements:
 * - 4.6: Model loading failure display with clear error messages and troubleshooting
 * - 7.1: Network issues handling with retry options and connectivity checks
 * - 7.2: Memory issues handling with optimization suggestions
 * - 7.3: Corruption handling with automatic redownload
 * - 7.4: Compatibility warnings with automatic setting adjustments
 * 
 * Leverages:
 * - Existing error handling patterns from ErrorMessage and ErrorBoundary
 * - ModelManagementService error types and recovery mechanisms
 * - Theme context for consistent styling
 * - Model service for fallback model suggestions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ModelManagementError, 
  ModelManagementErrorCode,
  ModelManagementService 
} from '../services/modelManagementService';
import { ApiError } from '../types/api';

// ===== Types and Interfaces =====

/**
 * Error display component props
 */
export interface ErrorDisplayProps {
  /** Error to display (API error or model management error) */
  error: ApiError | ModelManagementError | null;
  /** Context for the error (where it occurred) */
  context?: 'model_loading' | 'synthesis' | 'network' | 'general';
  /** Model name that failed to load (for model loading errors) */
  modelName?: string;
  /** Callback when user clicks retry */
  onRetry?: () => void | Promise<void>;
  /** Callback when user requests fallback model */
  onFallback?: (fallbackModelId: string) => void | Promise<void>;
  /** Callback when user dismisses the error */
  onDismiss?: () => void;
  /** Whether to show the error in compact mode */
  compact?: boolean;
  /** Whether retry action is disabled/in progress */
  retryDisabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Model management service for advanced operations */
  modelService?: ModelManagementService;
}

/**
 * Error category for UI display and actions
 */
enum ErrorCategory {
  MODEL_LOADING = 'model_loading',
  NETWORK = 'network',
  MEMORY = 'memory',
  CORRUPTION = 'corruption',
  COMPATIBILITY = 'compatibility',
  SERVER = 'server',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

/**
 * Error action interface for recovery options
 */
interface ErrorAction {
  /** Action identifier */
  id: string;
  /** Action label */
  label: string;
  /** Action description */
  description?: string;
  /** Action callback */
  handler: () => void | Promise<void>;
  /** Whether action is primary */
  primary?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Action icon (emoji) */
  icon?: string;
  /** Loading state for async actions */
  loading?: boolean;
}

/**
 * Troubleshooting suggestion interface
 */
interface TroubleshootingSuggestion {
  /** Suggestion title */
  title: string;
  /** Suggestion description */
  description: string;
  /** Optional action to perform */
  action?: () => void | Promise<void>;
  /** Action label if action is provided */
  actionLabel?: string;
  /** Priority level (higher = more important) */
  priority: number;
}

/**
 * Fallback model option
 */
interface FallbackModelOption {
  /** Model ID */
  model_id: string;
  /** Display name */
  name: string;
  /** Why this model is suggested */
  reason: string;
  /** Model size for user consideration */
  size_mb?: number;
  /** Whether model is cached locally */
  cached?: boolean;
}

// ===== Utility Functions =====

/**
 * Categorize error based on type and message
 */
function categorizeError(
  error: ApiError | ModelManagementError, 
  context?: string
): ErrorCategory {
  // Handle ModelManagementError with specific error codes
  if (error instanceof ModelManagementError) {
    switch (error.code) {
      case ModelManagementErrorCode.MODEL_NOT_FOUND:
      case ModelManagementErrorCode.MODEL_LOADING_FAILED:
        return ErrorCategory.MODEL_LOADING;
      case ModelManagementErrorCode.MODEL_DOWNLOAD_FAILED:
      case ModelManagementErrorCode.NETWORK_ERROR:
        return ErrorCategory.NETWORK;
      case ModelManagementErrorCode.INSUFFICIENT_MEMORY:
        return ErrorCategory.MEMORY;
      case ModelManagementErrorCode.CACHE_ERROR:
        return ErrorCategory.CORRUPTION;
      case ModelManagementErrorCode.GPU_NOT_AVAILABLE:
        return ErrorCategory.COMPATIBILITY;
      case ModelManagementErrorCode.SERVER_ERROR:
        return ErrorCategory.SERVER;
      default:
        return ErrorCategory.MODEL_LOADING;
    }
  }

  // Handle ApiError based on status and message
  const message = error.error?.toLowerCase() || '';
  const status = error.status;

  // Network errors
  if (message.includes('network') || message.includes('connection') || 
      message.includes('timeout') || message.includes('fetch') ||
      status === 0 || !status) {
    return ErrorCategory.NETWORK;
  }

  // Memory errors
  if (message.includes('memory') || message.includes('oom') || 
      message.includes('out of memory') || status === 507) {
    return ErrorCategory.MEMORY;
  }

  // Validation/compatibility errors
  if (message.includes('validation') || message.includes('invalid') || 
      message.includes('incompatible') || message.includes('unsupported') ||
      status === 422 || status === 400) {
    return ErrorCategory.VALIDATION;
  }

  // Server errors
  if (status && status >= 500) {
    return ErrorCategory.SERVER;
  }

  // Model loading context
  if (context === 'model_loading') {
    return ErrorCategory.MODEL_LOADING;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get error title based on category
 */
function getErrorTitle(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.MODEL_LOADING:
      return 'Model Loading Failed';
    case ErrorCategory.NETWORK:
      return 'Network Connection Error';
    case ErrorCategory.MEMORY:
      return 'Insufficient Memory';
    case ErrorCategory.CORRUPTION:
      return 'File Corruption Detected';
    case ErrorCategory.COMPATIBILITY:
      return 'Compatibility Issue';
    case ErrorCategory.SERVER:
      return 'Server Error';
    case ErrorCategory.VALIDATION:
      return 'Configuration Error';
    default:
      return 'Error Occurred';
  }
}

/**
 * Get error icon based on category
 */
function getErrorIcon(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.MODEL_LOADING:
      return '🔧';
    case ErrorCategory.NETWORK:
      return '📡';
    case ErrorCategory.MEMORY:
      return '💾';
    case ErrorCategory.CORRUPTION:
      return '🔄';
    case ErrorCategory.COMPATIBILITY:
      return '⚙️';
    case ErrorCategory.SERVER:
      return '🔧';
    case ErrorCategory.VALIDATION:
      return '⚠️';
    default:
      return '❌';
  }
}

/**
 * Generate troubleshooting suggestions based on error category
 */
function getTroubleshootingSuggestions(
  category: ErrorCategory,
  _error: ApiError | ModelManagementError,
  modelName?: string
): TroubleshootingSuggestion[] {
  const suggestions: TroubleshootingSuggestion[] = [];

  switch (category) {
    case ErrorCategory.MODEL_LOADING:
      suggestions.push(
        {
          title: 'Check Model Availability',
          description: 'Verify the model exists and is accessible',
          priority: 10,
        },
        {
          title: 'Clear Model Cache',
          description: 'Clear cached model files and retry loading',
          action: async () => {
            // Dispatch custom event for cache clearing
            window.dispatchEvent(new CustomEvent('coqui-tts-clear-cache'));
          },
          actionLabel: 'Clear Cache',
          priority: 8,
        }
      );
      break;

    case ErrorCategory.NETWORK:
      suggestions.push(
        {
          title: 'Check Internet Connection',
          description: 'Verify you have a stable internet connection',
          action: () => { window.open('https://www.google.com', '_blank'); },
          actionLabel: 'Test Connection',
          priority: 10,
        },
        {
          title: 'Try Again in a Moment',
          description: 'Network issues are often temporary. Wait 30 seconds and retry.',
          priority: 9,
        },
        {
          title: 'Check Firewall Settings',
          description: 'Ensure the TTS application is allowed through your firewall',
          priority: 7,
        }
      );
      break;

    case ErrorCategory.MEMORY:
      suggestions.push(
        {
          title: 'Close Other Applications',
          description: 'Free up memory by closing unnecessary applications',
          priority: 10,
        },
        {
          title: 'Try a Smaller Model',
          description: 'Consider using a model with lower memory requirements',
          priority: 9,
        },
        {
          title: 'Restart the Application',
          description: 'Restart to free up memory that may be in use',
          action: () => window.location.reload(),
          actionLabel: 'Restart App',
          priority: 8,
        }
      );
      break;

    case ErrorCategory.CORRUPTION:
      suggestions.push(
        {
          title: 'Redownload Model Files',
          description: 'Clear cache and redownload the model files',
          action: async () => {
            window.dispatchEvent(new CustomEvent('coqui-tts-redownload-model', {
              detail: { modelName }
            }));
          },
          actionLabel: 'Redownload',
          priority: 10,
        },
        {
          title: 'Check Available Storage',
          description: 'Ensure you have sufficient disk space for model files',
          priority: 8,
        }
      );
      break;

    case ErrorCategory.COMPATIBILITY:
      suggestions.push(
        {
          title: 'Check System Requirements',
          description: 'Verify your system meets the model requirements',
          priority: 10,
        },
        {
          title: 'Update Settings Automatically',
          description: 'Adjust settings to be compatible with the selected model',
          action: async () => {
            window.dispatchEvent(new CustomEvent('coqui-tts-auto-adjust-settings', {
              detail: { modelName }
            }));
          },
          actionLabel: 'Auto-Adjust',
          priority: 9,
        }
      );
      break;

    case ErrorCategory.SERVER:
      suggestions.push(
        {
          title: 'Wait and Retry',
          description: 'Server issues are usually temporary. Try again in a few minutes.',
          priority: 10,
        },
        {
          title: 'Check Service Status',
          description: 'Verify the TTS service is running properly',
          priority: 8,
        }
      );
      break;

    case ErrorCategory.VALIDATION:
      suggestions.push(
        {
          title: 'Check Input Settings',
          description: 'Review your synthesis settings for any invalid values',
          priority: 10,
        },
        {
          title: 'Reset to Defaults',
          description: 'Reset all settings to their default values',
          action: () => {
            window.dispatchEvent(new CustomEvent('coqui-tts-reset-form'));
          },
          actionLabel: 'Reset Settings',
          priority: 8,
        }
      );
      break;

    default:
      suggestions.push(
        {
          title: 'Try Again',
          description: 'The issue may be temporary. Try the operation again.',
          priority: 8,
        },
        {
          title: 'Refresh the Application',
          description: 'Reload the page to reset the application state',
          action: () => window.location.reload(),
          actionLabel: 'Refresh',
          priority: 6,
        }
      );
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate fallback model options based on the failed model
 */
function getFallbackModelOptions(
  failedModelName?: string
): Promise<FallbackModelOption[]> {
  return new Promise((resolve) => {
    // For now, provide static fallback options
    // In a real implementation, this would query the model service
    const fallbacks: FallbackModelOption[] = [
      {
        model_id: 'tts_models/en/ljspeech/tacotron2-DDC',
        name: 'Tacotron2 (English)',
        reason: 'Reliable, well-tested model with good performance',
        size_mb: 87,
        cached: true,
      },
      {
        model_id: 'tts_models/en/ljspeech/fast_pitch',
        name: 'FastPitch (English)',
        reason: 'Faster inference, lower memory usage',
        size_mb: 52,
        cached: false,
      },
      {
        model_id: 'tts_models/multilingual/multi-dataset/xtts_v2',
        name: 'XTTS v2 (Multilingual)',
        reason: 'Supports multiple languages and voice cloning',
        size_mb: 1800,
        cached: false,
      }
    ];

    // Filter out the failed model if it matches one of our fallbacks
    const filtered = fallbacks.filter(model => 
      !failedModelName || !failedModelName.includes(model.model_id)
    );

    resolve(filtered);
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ===== Main Component =====

/**
 * ErrorDisplay component for comprehensive error handling
 */
export function ErrorDisplay({
  error,
  context = 'general',
  modelName,
  onRetry,
  onFallback,
  onDismiss,
  compact = false,
  retryDisabled = false,
  className = '',
}: ErrorDisplayProps): JSX.Element | null {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [actionStates, setActionStates] = useState<Record<string, boolean>>({});
  const [fallbackModels, setFallbackModels] = useState<FallbackModelOption[]>([]);
  const [showFallbacks, setShowFallbacks] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);

  // Don't render if no error
  if (!error) {
    return null;
  }

  const category = categorizeError(error, context);
  const errorTitle = getErrorTitle(category);
  const errorIcon = getErrorIcon(category);
  const suggestions = getTroubleshootingSuggestions(category, error, modelName);

  /**
   * Load fallback models when needed
   */
  useEffect(() => {
    if (category === ErrorCategory.MODEL_LOADING && context === 'model_loading') {
      getFallbackModelOptions(modelName).then(setFallbackModels);
    }
  }, [category, context, modelName]);

  /**
   * Handle action execution with loading state
   */
  const handleAction = useCallback(async (actionId: string, handler: () => void | Promise<void>) => {
    setActionStates(prev => ({ ...prev, [actionId]: true }));
    
    try {
      await handler();
    } catch (actionError) {
      console.error(`[ErrorDisplay] Action ${actionId} failed:`, actionError);
    } finally {
      setActionStates(prev => ({ ...prev, [actionId]: false }));
    }
  }, []);

  /**
   * Handle retry with exponential backoff
   */
  const handleRetry = useCallback(async () => {
    if (!onRetry || retryDisabled) return;

    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
    setRetryCount(prev => prev + 1);

    if (delay > 1000) {
      // Show countdown for longer delays
      setActionStates(prev => ({ ...prev, retry: true }));
      retryTimeoutRef.current = window.setTimeout(async () => {
        try {
          await onRetry();
        } catch (retryError) {
          console.error('[ErrorDisplay] Retry failed:', retryError);
        } finally {
          setActionStates(prev => ({ ...prev, retry: false }));
        }
      }, delay);
    } else {
      // Immediate retry
      try {
        setActionStates(prev => ({ ...prev, retry: true }));
        await onRetry();
      } catch (retryError) {
        console.error('[ErrorDisplay] Retry failed:', retryError);
      } finally {
        setActionStates(prev => ({ ...prev, retry: false }));
      }
    }
  }, [onRetry, retryDisabled, retryCount]);

  /**
   * Handle fallback model selection
   */
  const handleFallback = useCallback(async (modelId: string) => {
    if (!onFallback) return;
    
    try {
      setActionStates(prev => ({ ...prev, [`fallback_${modelId}`]: true }));
      await onFallback(modelId);
    } catch (fallbackError) {
      console.error('[ErrorDisplay] Fallback failed:', fallbackError);
    } finally {
      setActionStates(prev => ({ ...prev, [`fallback_${modelId}`]: false }));
    }
  }, [onFallback]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onDismiss) {
      onDismiss();
    }
  }, [onDismiss]);

  /**
   * Clean up timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Generate primary actions
  const primaryActions: ErrorAction[] = [];
  
  if (onRetry) {
    primaryActions.push({
      id: 'retry',
      label: actionStates.retry ? 'Retrying...' : 'Try Again',
      description: 'Attempt the operation again',
      handler: handleRetry,
      primary: true,
      disabled: retryDisabled || actionStates.retry,
      icon: actionStates.retry ? '⏳' : '🔄',
      loading: actionStates.retry,
    });
  }

  const containerClasses = `error-display ${compact ? 'error-display--compact' : ''} ${className}`.trim();

  return (
    <div
      className={containerClasses}
      role="alert"
      aria-live="polite"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        backgroundColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(254, 226, 226, 1)',
        borderColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(252, 165, 165, 1)',
        color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
        border: '1px solid',
        borderRadius: '12px',
        padding: compact ? '1rem' : '1.5rem',
        margin: '1rem 0',
        fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        fontSize: compact ? '0.875rem' : '1rem',
        lineHeight: 1.6,
        boxShadow: theme.mode === 'dark' 
          ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: compact ? '0.75rem' : '1rem',
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            fontSize: compact ? '1.5rem' : '2rem',
            flexShrink: 0,
            marginTop: '0.125rem',
          }}
          aria-hidden="true"
        >
          {errorIcon}
        </div>

        {/* Error Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: compact ? '1rem' : '1.25rem',
              fontWeight: 600,
              color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
            }}
          >
            {errorTitle}
          </h3>

          <p
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: compact ? '0.8125rem' : '0.875rem',
              color: theme.mode === 'dark' ? '#fca5a5' : '#7f1d1d',
              wordBreak: 'break-word',
            }}
          >
            {error instanceof ModelManagementError ? error.message : error.error}
          </p>

          {modelName && context === 'model_loading' && (
            <div
              style={{
                fontSize: '0.75rem',
                color: theme.mode === 'dark' ? '#f87171' : '#991b1b',
                fontFamily: 'monospace',
                backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
                padding: '0.5rem',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            >
              Model: {modelName}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error"
            style={{
              background: 'none',
              border: 'none',
              color: theme.mode === 'dark' ? '#fca5a5' : '#991b1b',
              cursor: 'pointer',
              fontSize: '1.5rem',
              padding: '0.25rem',
              borderRadius: '4px',
              flexShrink: 0,
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 
                theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Primary Actions */}
      {primaryActions.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: compact ? '0.75rem' : '1rem',
          }}
        >
          {primaryActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id, action.handler)}
              disabled={action.disabled || action.loading}
              style={{
                backgroundColor: action.primary 
                  ? theme.mode === 'dark' ? '#dc2626' : '#dc2626'
                  : 'transparent',
                color: action.primary 
                  ? 'white' 
                  : theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                border: action.primary 
                  ? 'none' 
                  : `1px solid ${theme.mode === 'dark' ? '#fca5a5' : '#fca5a5'}`,
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                opacity: action.disabled ? 0.6 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (!action.disabled) {
                  if (action.primary) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 
                      theme.mode === 'dark' ? '#b91c1c' : '#b91c1c';
                  } else {
                    (e.target as HTMLButtonElement).style.backgroundColor = 
                      theme.mode === 'dark' ? 'rgba(252, 165, 165, 0.1)' : 'rgba(185, 28, 28, 0.1)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = action.primary 
                  ? theme.mode === 'dark' ? '#dc2626' : '#dc2626'
                  : 'transparent';
              }}
            >
              {action.icon && (
                <span style={{ fontSize: '1rem' }} aria-hidden="true">
                  {action.icon}
                </span>
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Expandable Content */}
      {!compact && (
        <div>
          {/* Troubleshooting Section */}
          {suggestions.length > 0 && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
                border: `1px solid ${theme.mode === 'dark' ? 'rgba(252, 165, 165, 0.2)' : 'rgba(252, 165, 165, 0.5)'}`,
              }}
            >
              <h4
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span aria-hidden="true">💡</span>
                Troubleshooting Suggestions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {suggestions.slice(0, isExpanded ? suggestions.length : 2).map((suggestion, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: '6px',
                      border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h5
                          style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                          }}
                        >
                          {suggestion.title}
                        </h5>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.8125rem',
                            color: theme.mode === 'dark' ? '#fca5a5' : '#7f1d1d',
                            lineHeight: 1.4,
                          }}
                        >
                          {suggestion.description}
                        </p>
                      </div>
                      
                      {suggestion.action && suggestion.actionLabel && (
                        <button
                          onClick={() => handleAction(`suggestion_${index}`, suggestion.action!)}
                          disabled={actionStates[`suggestion_${index}`]}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: `1px solid ${theme.mode === 'dark' ? '#fca5a5' : '#fca5a5'}`,
                            borderRadius: '6px',
                            color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                            cursor: actionStates[`suggestion_${index}`] ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            opacity: actionStates[`suggestion_${index}`] ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (!actionStates[`suggestion_${index}`]) {
                              (e.target as HTMLButtonElement).style.backgroundColor = 
                                theme.mode === 'dark' ? 'rgba(252, 165, 165, 0.1)' : 'rgba(185, 28, 28, 0.1)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                          }}
                        >
                          {actionStates[`suggestion_${index}`] ? '...' : suggestion.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {suggestions.length > 2 && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.mode === 'dark' ? '#fca5a5' : '#991b1b',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      padding: '0.25rem 0',
                    }}
                  >
                    {isExpanded ? 'Show Less' : `Show ${suggestions.length - 2} More Suggestions`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Fallback Models Section */}
          {category === ErrorCategory.MODEL_LOADING && fallbackModels.length > 0 && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
                border: `1px solid ${theme.mode === 'dark' ? 'rgba(252, 165, 165, 0.2)' : 'rgba(252, 165, 165, 0.5)'}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span aria-hidden="true">🔄</span>
                  Alternative Models
                </h4>
                <button
                  onClick={() => setShowFallbacks(!showFallbacks)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.mode === 'dark' ? '#fca5a5' : '#991b1b',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    padding: '0.25rem 0',
                  }}
                >
                  {showFallbacks ? 'Hide' : 'Show'} Options
                </button>
              </div>

              {showFallbacks && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fallbackModels.map((model) => (
                    <div
                      key={model.model_id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        borderRadius: '6px',
                        border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: theme.mode === 'dark' ? '#fecaca' : '#991b1b',
                            marginBottom: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {model.name}
                          {model.cached && (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                backgroundColor: theme.mode === 'dark' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                                color: theme.mode === 'dark' ? '#4ade80' : '#16a34a',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '4px',
                                fontWeight: 500,
                              }}
                            >
                              CACHED
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '0.75rem',
                            color: theme.mode === 'dark' ? '#fca5a5' : '#7f1d1d',
                            lineHeight: 1.3,
                          }}
                        >
                          {model.reason}
                        </p>
                        {model.size_mb && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.6875rem',
                              color: theme.mode === 'dark' ? '#f87171' : '#991b1b',
                              fontFamily: 'monospace',
                            }}
                          >
                            Size: {formatBytes(model.size_mb * 1024 * 1024)}
                          </p>
                        )}
                      </div>
                      
                      {onFallback && (
                        <button
                          onClick={() => handleFallback(model.model_id)}
                          disabled={actionStates[`fallback_${model.model_id}`]}
                          style={{
                            padding: '0.5rem 0.75rem',
                            backgroundColor: theme.mode === 'dark' ? '#dc2626' : '#dc2626',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'white',
                            cursor: actionStates[`fallback_${model.model_id}`] ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            opacity: actionStates[`fallback_${model.model_id}`] ? 0.6 : 1,
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (!actionStates[`fallback_${model.model_id}`]) {
                              (e.target as HTMLButtonElement).style.backgroundColor = 
                                theme.mode === 'dark' ? '#b91c1c' : '#b91c1c';
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.target as HTMLButtonElement).style.backgroundColor = 
                              theme.mode === 'dark' ? '#dc2626' : '#dc2626';
                          }}
                        >
                          {actionStates[`fallback_${model.model_id}`] ? 'Loading...' : 'Use This Model'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Technical Details */}
          {process.env.NODE_ENV === 'development' && (
            <details
              style={{
                padding: '1rem',
                backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
                border: `1px solid ${theme.mode === 'dark' ? 'rgba(252, 165, 165, 0.2)' : 'rgba(252, 165, 165, 0.5)'}`,
              }}
            >
              <summary
                style={{
                  color: theme.mode === 'dark' ? '#fca5a5' : '#7f1d1d',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                }}
              >
                Technical Details (Development Only)
              </summary>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: theme.mode === 'dark' ? '#f87171' : '#991b1b',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                  backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  lineHeight: 1.4,
                }}
              >
                {error instanceof ModelManagementError ? (
                  <>
                    <strong>Error Code:</strong> {error.code}<br/>
                    <strong>Message:</strong> {error.message}<br/>
                    <strong>Recoverable:</strong> {error.recoverable ? 'Yes' : 'No'}<br/>
                    {error.suggestions.length > 0 && (
                      <>
                        <strong>Built-in Suggestions:</strong><br/>
                        {error.suggestions.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}<br/>
                      </>
                    )}
                    {error.originalError && (
                      <>
                        <strong>Original Error:</strong><br/>
                        {error.originalError instanceof Error ? error.originalError.message : String(error.originalError)}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Error:</strong> {error.error}<br/>
                    {error.status && <><strong>Status Code:</strong> {error.status}<br/></>}
                    <strong>Category:</strong> {category}<br/>
                    <strong>Context:</strong> {context}
                  </>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Hook for Error Display Management =====

/**
 * Hook for managing error display state with automatic categorization
 */
export function useErrorDisplay() {
  const [error, setError] = useState<ApiError | ModelManagementError | null>(null);
  const [context, setContext] = useState<ErrorDisplayProps['context']>('general');
  const [modelName, setModelName] = useState<string>();

  const showError = useCallback((
    error: ApiError | ModelManagementError,
    context?: ErrorDisplayProps['context'],
    modelName?: string
  ) => {
    setError(error);
    setContext(context || 'general');
    setModelName(modelName);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setContext('general');
    setModelName(undefined);
  }, []);

  const showModelLoadingError = useCallback((
    error: ApiError | ModelManagementError,
    modelName: string
  ) => {
    showError(error, 'model_loading', modelName);
  }, [showError]);

  const showNetworkError = useCallback((error: ApiError | ModelManagementError) => {
    showError(error, 'network');
  }, [showError]);

  return {
    error,
    context,
    modelName,
    showError,
    clearError,
    showModelLoadingError,
    showNetworkError,
  };
}

export default ErrorDisplay;

