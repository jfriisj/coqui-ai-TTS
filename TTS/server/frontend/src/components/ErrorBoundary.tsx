/**
 * Error Boundary Component for Coqui TTS Frontend
 * 
 * React Error Boundary implementation that provides user-friendly error display
 * with recovery options and error reporting capabilities. Handles component 
 * error states with fallback UI that matches the application theme.
 * 
 * Features:
 * - Catches JavaScript errors in component tree
 * - User-friendly error messages with recovery suggestions
 * - Error recovery options (retry, refresh, report)
 * - Theme-aware fallback UI
 * - Error logging and reporting capabilities
 * - Keyboard accessible error interface
 * 
 * Requirements:
 * - 5.4: Specific, actionable error messages with recovery suggestions
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={CustomFallback}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ThemeConfiguration } from '../types/api';

// ===== Types =====

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The caught error object */
  error: Error | null;
  /** Error boundary information */
  errorInfo: ErrorInfo | null;
  /** Unique error ID for reporting */
  errorId: string;
}

/**
 * Error boundary props interface
 */
interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional custom fallback component */
  fallback?: React.ComponentType<ErrorFallbackProps>;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  /** Whether to show detailed error information in development */
  showDetails?: boolean;
}

/**
 * Error fallback component props
 */
interface ErrorFallbackProps {
  /** The caught error */
  error: Error;
  /** Error boundary information */
  errorInfo: ErrorInfo;
  /** Unique error ID */
  errorId: string;
  /** Retry function */
  onRetry: () => void;
  /** Current theme configuration */
  theme: ThemeConfiguration;
}

/**
 * Error category enumeration for user-friendly messaging
 */
enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  COMPONENT = 'component',
  UNKNOWN = 'unknown'
}

/**
 * Error recovery suggestion interface
 */
interface RecoverySuggestion {
  /** Action description */
  action: string;
  /** Action callback */
  handler: () => void;
  /** Whether action is primary */
  primary?: boolean;
}

// ===== Utility Functions =====

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Categorize error based on error message and stack
 */
function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';

  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return ErrorCategory.NETWORK;
  }
  
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return ErrorCategory.VALIDATION;
  }
  
  if (stack.includes('react') || message.includes('component')) {
    return ErrorCategory.COMPONENT;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly error message based on category
 */
function getUserFriendlyMessage(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Unable to connect to the TTS service. Please check your connection and try again.';
    case ErrorCategory.VALIDATION:
      return 'There was an issue with the provided input. Please check your settings and try again.';
    case ErrorCategory.COMPONENT:
      return 'A display error occurred. Refreshing the page should resolve this issue.';
    default:
      return 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.';
  }
}

/**
 * Get recovery suggestions based on error category
 */
function getRecoverySuggestions(
  category: ErrorCategory,
  onRetry: () => void
): RecoverySuggestion[] {
  const suggestions: RecoverySuggestion[] = [];

  // Always provide retry option
  suggestions.push({
    action: 'Try Again',
    handler: onRetry,
    primary: true,
  });

  // Category-specific suggestions
  switch (category) {
    case ErrorCategory.NETWORK:
      suggestions.push(
        {
          action: 'Check Connection',
          handler: () => window.open('https://www.google.com', '_blank'),
        },
        {
          action: 'Refresh Page',
          handler: () => window.location.reload(),
        }
      );
      break;
    
    case ErrorCategory.VALIDATION:
      suggestions.push({
        action: 'Reset Form',
        handler: () => {
          // Clear localStorage form data if any
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('coqui-tts-')) {
              localStorage.removeItem(key);
            }
          });
          onRetry();
        },
      });
      break;
    
    case ErrorCategory.COMPONENT:
    case ErrorCategory.UNKNOWN:
      suggestions.push({
        action: 'Refresh Page',
        handler: () => window.location.reload(),
      });
      break;
  }

  return suggestions;
}

/**
 * Report error to logging service or console
 */
function reportError(error: Error, errorInfo: ErrorInfo, errorId: string): void {
  // In production, this could send to an error reporting service
  console.group(`🚨 Error Boundary [${errorId}]`);
  console.error('Error:', error);
  console.error('Error Info:', errorInfo);
  console.error('Stack Trace:', error.stack);
  console.groupEnd();

  // TODO: In production, integrate with error reporting service like Sentry
  // Sentry.captureException(error, { extra: { errorInfo, errorId } });
}

// ===== Default Fallback Component =====

/**
 * Default error fallback component
 * Provides user-friendly error display with recovery options
 */
function DefaultErrorFallback({
  error,
  errorInfo,
  errorId,
  onRetry,
  theme,
}: ErrorFallbackProps): JSX.Element {
  const category = categorizeError(error);
  const userMessage = getUserFriendlyMessage(category);
  const suggestions = getRecoverySuggestions(category, onRetry);

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div
      className="error-boundary-container"
      style={{
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        className="error-content"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Error Icon */}
        <div
          style={{
            fontSize: '4rem',
            marginBottom: '1rem',
          }}
        >
          ⚠️
        </div>

        {/* Error Title */}
        <h1
          style={{
            color: theme.colors.text,
            fontSize: '1.5rem',
            fontWeight: 600,
            margin: 0,
            marginBottom: '1rem',
          }}
        >
          Oops! Something went wrong
        </h1>

        {/* User-friendly Error Message */}
        <p
          style={{
            color: theme.colors.textSecondary,
            fontSize: '1rem',
            lineHeight: 1.5,
            margin: 0,
            marginBottom: '2rem',
          }}
        >
          {userMessage}
        </p>

        {/* Error ID for Support */}
        <div
          style={{
            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            marginBottom: '2rem',
            fontSize: '0.875rem',
            color: theme.colors.textSecondary,
          }}
        >
          Error ID: <code style={{ fontFamily: 'monospace' }}>{errorId}</code>
        </div>

        {/* Recovery Actions */}
        <div
          className="recovery-actions"
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '2rem',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={suggestion.handler}
              style={{
                backgroundColor: suggestion.primary ? theme.colors.primary : 'transparent',
                color: suggestion.primary ? 'white' : theme.colors.primary,
                border: `2px solid ${theme.colors.primary}`,
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px',
              }}
              onMouseEnter={(e) => {
                if (suggestion.primary) {
                  (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.secondary;
                } else {
                  (e.target as HTMLButtonElement).style.backgroundColor = theme.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'rgba(0, 0, 0, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = suggestion.primary 
                  ? theme.colors.primary 
                  : 'transparent';
              }}
            >
              {suggestion.action}
            </button>
          ))}
        </div>

        {/* Development Error Details */}
        {isDevelopment && (
          <details
            style={{
              textAlign: 'left',
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
              padding: '1rem',
              marginTop: '1rem',
            }}
          >
            <summary
              style={{
                color: theme.colors.textSecondary,
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
                color: theme.colors.textSecondary,
                whiteSpace: 'pre-wrap',
                overflowX: 'auto',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <strong>Error:</strong> {error.message}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Component Stack:</strong>
                {errorInfo.componentStack}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack Trace:</strong>
                  {error.stack}
                </div>
              )}
            </div>
          </details>
        )}

        {/* Support Information */}
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: theme.colors.textSecondary,
          }}
        >
          <p style={{ margin: 0, marginBottom: '0.5rem' }}>
            If this problem persists, please report it with the Error ID above.
          </p>
          <p style={{ margin: 0 }}>
            Visit{' '}
            <a
              href="https://github.com/coqui-ai/TTS/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: theme.colors.primary,
                textDecoration: 'none',
              }}
            >
              GitHub Issues
            </a>{' '}
            for support and bug reports.
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Main Error Boundary Component =====

/**
 * Get current theme from document styles or use default light theme
 */
function getCurrentTheme(): ThemeConfiguration {
  const isDark = document.body.className.includes('theme-dark');
  
  return {
    mode: isDark ? 'dark' : 'light',
    colors: {
      primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#2563eb',
      secondary: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary') || '#64748b',
      background: getComputedStyle(document.documentElement).getPropertyValue('--color-background') || '#ffffff',
      surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface') || '#f8fafc',
      text: getComputedStyle(document.documentElement).getPropertyValue('--color-text') || '#0f172a',
      textSecondary: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary') || '#475569',
    },
  };
}

/**
 * Error Boundary Class Component
 * Implements React Error Boundary lifecycle methods
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };

    this.handleRetry = this.handleRetry.bind(this);
  }

  /**
   * Static method called when an error occurs
   * Updates component state to trigger error UI
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  /**
   * Lifecycle method called after an error is caught
   * Handles error reporting and logging
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report error
    reportError(error, errorInfo, this.state.errorId);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.state.errorId);
    }
  }

  /**
   * Retry handler to reset error boundary state
   */
  handleRetry(): void {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  }

  /**
   * Render method - shows error UI or normal children
   */
  render(): ReactNode {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      const theme = getCurrentTheme();

      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          theme={theme}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for error boundary functionality in functional components
 * Provides error state management and recovery options
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  // Reset error state
  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  // Trigger error manually
  const throwError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  // Throw error on next render if set
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return {
    throwError,
    resetError,
  };
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WrappedWithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;