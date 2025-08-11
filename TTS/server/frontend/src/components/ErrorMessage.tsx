/**
 * Error Message Component for Coqui TTS Frontend
 * 
 * Dedicated component for displaying API error messages with actionable recovery
 * suggestions and retry options. Provides consistent error display throughout
 * the application for various error types including network, validation, and 
 * synthesis errors.
 * 
 * Features:
 * - Consistent error display with suggested solutions
 * - Error categorization (network, validation, synthesis errors)
 * - Actionable error recovery suggestions and retry options
 * - Theme-aware error styling
 * - Keyboard accessible error interface
 * - Auto-dismissible errors with optional timeout
 * 
 * Requirements:
 * - 1.4: Clear error messages with suggested solutions when synthesis fails
 * - 5.4: Specific, actionable error messages with recovery suggestions
 * 
 * Usage:
 * ```tsx
 * <ErrorMessage 
 *   error={apiError}
 *   onRetry={handleRetry}
 *   onDismiss={handleDismiss}
 * />
 * ```
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../types/api';

// ===== Types =====

/**
 * Error message component props
 */
interface ErrorMessageProps {
  /** API error object to display */
  error: ApiError | null;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Callback when user dismisses the error */
  onDismiss?: () => void;
  /** Whether to show the error in compact mode */
  compact?: boolean;
  /** Auto-dismiss timeout in milliseconds (0 to disable) */
  autoTimeout?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether retry action is disabled */
  retryDisabled?: boolean;
  /** Custom title for the error */
  title?: string;
}

/**
 * Error category enumeration for user-friendly messaging
 */
enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation', 
  SYNTHESIS = 'synthesis',
  SERVER = 'server',
  AUTHENTICATION = 'authentication',
  UNKNOWN = 'unknown'
}

/**
 * Error recovery action interface
 */
interface ErrorAction {
  /** Action label */
  label: string;
  /** Action callback */
  handler: () => void;
  /** Whether action is primary */
  primary?: boolean;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Action icon (emoji) */
  icon?: string;
}

// ===== Utility Functions =====

/**
 * Categorize API error based on status code and message
 */
function categorizeApiError(error: ApiError): ErrorCategory {
  const { status, error: message } = error;
  const lowerMessage = message.toLowerCase();

  // Check status code first
  if (status) {
    if (status >= 400 && status < 500) {
      if (status === 401 || status === 403) {
        return ErrorCategory.AUTHENTICATION;
      }
      if (status === 422 || lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
        return ErrorCategory.VALIDATION;
      }
      return ErrorCategory.VALIDATION;
    }
    if (status >= 500) {
      return ErrorCategory.SERVER;
    }
  }

  // Check message content
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || 
      lowerMessage.includes('timeout') || lowerMessage.includes('fetch')) {
    return ErrorCategory.NETWORK;
  }

  if (lowerMessage.includes('synthesis') || lowerMessage.includes('tts') || 
      lowerMessage.includes('audio') || lowerMessage.includes('voice')) {
    return ErrorCategory.SYNTHESIS;
  }

  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
      lowerMessage.includes('required') || lowerMessage.includes('format')) {
    return ErrorCategory.VALIDATION;
  }

  if (lowerMessage.includes('server') || lowerMessage.includes('internal')) {
    return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly error title based on category
 */
function getErrorTitle(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Connection Error';
    case ErrorCategory.VALIDATION:
      return 'Input Validation Error';
    case ErrorCategory.SYNTHESIS:
      return 'Speech Synthesis Error';
    case ErrorCategory.SERVER:
      return 'Server Error';
    case ErrorCategory.AUTHENTICATION:
      return 'Authentication Error';
    default:
      return 'Error';
  }
}

/**
 * Get user-friendly error message with recovery suggestions
 */
function getUserFriendlyMessage(error: ApiError, category: ErrorCategory): string {
  const originalMessage = error.error;
  let suggestion = '';

  switch (category) {
    case ErrorCategory.NETWORK:
      suggestion = 'Check your internet connection and try again.';
      break;
    case ErrorCategory.VALIDATION:
      suggestion = 'Please review your input settings and ensure all required fields are filled correctly.';
      break;
    case ErrorCategory.SYNTHESIS:
      suggestion = 'Try using different text or voice settings. If the issue persists, the model may be unavailable.';
      break;
    case ErrorCategory.SERVER:
      suggestion = 'The server is experiencing issues. Please wait a moment and try again.';
      break;
    case ErrorCategory.AUTHENTICATION:
      suggestion = 'Authentication is required. Please check your credentials.';
      break;
    default:
      suggestion = 'Please try again. If the problem persists, contact support.';
  }

  return `${originalMessage}. ${suggestion}`;
}

/**
 * Get recovery actions based on error category
 */
function getRecoveryActions(
  category: ErrorCategory,
  onRetry?: () => void,
  retryDisabled: boolean = false
): ErrorAction[] {
  const actions: ErrorAction[] = [];

  // Always provide retry action if callback is provided
  if (onRetry) {
    actions.push({
      label: 'Try Again',
      handler: onRetry,
      primary: true,
      disabled: retryDisabled,
      icon: '🔄',
    });
  }

  // Category-specific actions
  switch (category) {
    case ErrorCategory.NETWORK:
      actions.push({
        label: 'Check Connection',
        handler: () => window.open('https://www.google.com', '_blank'),
        icon: '🌐',
      });
      break;
    
    case ErrorCategory.VALIDATION:
      actions.push({
        label: 'Reset Form',
        handler: () => {
          // Dispatch custom event that components can listen for
          window.dispatchEvent(new CustomEvent('coqui-tts-reset-form'));
        },
        icon: '🔄',
      });
      break;
    
    case ErrorCategory.SYNTHESIS:
      actions.push({
        label: 'Check Models',
        handler: () => {
          // Dispatch custom event to refresh model information
          window.dispatchEvent(new CustomEvent('coqui-tts-refresh-models'));
        },
        icon: '🔧',
      });
      break;
    
    case ErrorCategory.SERVER:
      actions.push({
        label: 'Reload Page',
        handler: () => window.location.reload(),
        icon: '🔄',
      });
      break;
  }

  return actions;
}

/**
 * Get error icon based on category
 */
function getErrorIcon(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return '📡';
    case ErrorCategory.VALIDATION:
      return '⚠️';
    case ErrorCategory.SYNTHESIS:
      return '🎤';
    case ErrorCategory.SERVER:
      return '🔧';
    case ErrorCategory.AUTHENTICATION:
      return '🔐';
    default:
      return '❌';
  }
}

// ===== Main Component =====

/**
 * ErrorMessage component for displaying API errors with recovery options
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  compact = false,
  autoTimeout = 0,
  className = '',
  retryDisabled = false,
  title,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(autoTimeout);

  // Auto-dismiss logic
  useEffect(() => {
    if (autoTimeout > 0 && error) {
      setTimeLeft(autoTimeout);
      setIsVisible(true);

      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1000) {
            clearInterval(interval);
            handleDismiss();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [error, autoTimeout]);

  // Handle dismiss action
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Don't render if no error or not visible
  if (!error || !isVisible) {
    return null;
  }

  const category = categorizeApiError(error);
  const errorTitle = title || getErrorTitle(category);
  const userMessage = getUserFriendlyMessage(error, category);
  const actions = getRecoveryActions(category, onRetry, retryDisabled);
  const errorIcon = getErrorIcon(category);

  const containerClasses = `error-message ${compact ? 'error-message--compact' : ''} ${className}`.trim();

  return (
    <div
      className={containerClasses}
      role="alert"
      aria-live="polite"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        backgroundColor: 'var(--color-error-bg, #fee2e2)',
        borderColor: 'var(--color-error-border, #fca5a5)',
        color: 'var(--color-error-text, #b91c1c)',
        border: '1px solid',
        borderRadius: '8px',
        padding: compact ? '0.75rem' : '1rem',
        margin: '0.5rem 0',
        position: 'relative',
        fontFamily: 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        fontSize: compact ? '0.875rem' : '1rem',
        lineHeight: 1.5,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Error Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: compact ? '0.5rem' : '0.75rem',
        }}
      >
        {/* Error Icon */}
        <span
          style={{
            fontSize: compact ? '1.25rem' : '1.5rem',
            flexShrink: 0,
            marginTop: '0.125rem',
          }}
          aria-hidden="true"
        >
          {errorIcon}
        </span>

        {/* Error Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Error Title */}
          <h4
            style={{
              margin: 0,
              marginBottom: '0.25rem',
              fontSize: compact ? '0.875rem' : '1rem',
              fontWeight: 600,
              color: 'var(--color-error-text, #b91c1c)',
            }}
          >
            {errorTitle}
          </h4>

          {/* Error Message */}
          <p
            style={{
              margin: 0,
              fontSize: compact ? '0.75rem' : '0.875rem',
              color: 'var(--color-error-text-secondary, #991b1b)',
              wordBreak: 'break-word',
            }}
          >
            {userMessage}
          </p>

          {/* Status Code (if available) */}
          {error.status && !compact && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: 'var(--color-error-text-muted, #7f1d1d)',
                fontFamily: 'monospace',
              }}
            >
              Status Code: {error.status}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss error"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-error-text-secondary, #991b1b)',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.25rem',
            borderRadius: '4px',
            flexShrink: 0,
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-error-hover, rgba(0, 0, 0, 0.1))';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>
      </div>

      {/* Recovery Actions */}
      {actions.length > 0 && !compact && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--color-error-border-light, #fca5a5)',
          }}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.handler}
              disabled={action.disabled}
              style={{
                backgroundColor: action.primary 
                  ? 'var(--color-error-action-primary, #dc2626)' 
                  : 'var(--color-error-action-secondary, transparent)',
                color: action.primary 
                  ? 'white' 
                  : 'var(--color-error-text, #b91c1c)',
                border: action.primary 
                  ? 'none' 
                  : '1px solid var(--color-error-border, #fca5a5)',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                opacity: action.disabled ? 0.6 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (!action.disabled) {
                  if (action.primary) {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-error-action-primary-hover, #b91c1c)';
                  } else {
                    (e.target as HTMLButtonElement).style.backgroundColor = 'var(--color-error-action-secondary-hover, rgba(185, 28, 28, 0.1))';
                  }
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = action.primary 
                  ? 'var(--color-error-action-primary, #dc2626)' 
                  : 'var(--color-error-action-secondary, transparent)';
              }}
            >
              {action.icon && (
                <span style={{ fontSize: '0.875rem' }} aria-hidden="true">
                  {action.icon}
                </span>
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Auto-dismiss timer */}
      {autoTimeout > 0 && timeLeft > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '3px',
            backgroundColor: 'var(--color-error-timer-bg, rgba(185, 28, 28, 0.2))',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--color-error-timer, #dc2626)',
              width: `${(timeLeft / autoTimeout) * 100}%`,
              transition: 'width 1s linear',
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Hook for managing error message state
 * Provides convenient methods for showing and dismissing errors
 */
export function useErrorMessage() {
  const [error, setError] = useState<ApiError | null>(null);

  const showError = useCallback((error: ApiError) => {
    setError(error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showErrorFromResponse = useCallback((response: { success: false; error: ApiError }) => {
    if (!response.success) {
      setError(response.error);
    }
  }, []);

  return {
    error,
    showError,
    clearError,
    showErrorFromResponse,
  };
}

export default ErrorMessage;