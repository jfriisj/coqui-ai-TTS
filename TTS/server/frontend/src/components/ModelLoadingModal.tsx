/**
 * ModelLoadingModal Component for Coqui TTS Frontend
 * 
 * Displays a comprehensive progress modal for model loading operations with
 * real-time progress updates via Server-Sent Events. Provides detailed progress
 * information including current stage, percentage completion, estimated time
 * remaining, and download metrics.
 * 
 * Features:
 * - Real-time progress updates using Server-Sent Events (SSE)
 * - Visual progress bar with percentage display
 * - Current stage description and context messages
 * - Estimated time remaining with dynamic updates
 * - Download progress for model files (bytes/speed)
 * - Cancel button with safe operation abortion
 * - Error state display with recovery suggestions
 * - Success confirmation with auto-dismiss (2 seconds)
 * - Accessibility features with proper ARIA labels
 * - Theme-aware styling with responsive design
 * - Keyboard navigation support (Escape to cancel)
 * 
 * Requirements:
 * - 4.4: Progress modal with real-time progress, stage description, ETA, and cancel option
 * - 6.1: Immediate progress indicator with initial stage information
 * - 6.2: Update progress information at least every 500ms with percentage/stage/time
 * - 6.4: Cancel button that safely aborts operation and retains current model
 * - 6.6: Success confirmation with new model info and auto-dismiss after 2 seconds
 * 
 * Leverages:
 * - ModelManagementService for progress tracking and cancellation
 * - Theme context for consistent styling
 * - Existing modal patterns for accessibility and keyboard handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  LoadingProgress, 
  LoadingStatus, 
  ModelManagementService,
  ModelManagementError,
  ProgressCallback,
  StatusChangeCallback,
} from '../services/modelManagementService';

// ===== Constants =====

/**
 * Modal display states
 */
const MODAL_STATES = {
  HIDDEN: 'hidden',
  LOADING: 'loading', 
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

type ModalState = typeof MODAL_STATES[keyof typeof MODAL_STATES];

/**
 * Animation configuration
 */
const ANIMATION_CONFIG = {
  /** Modal fade in/out duration */
  MODAL_DURATION: 250,
  /** Success auto-dismiss timeout (requirement 6.6) */
  SUCCESS_TIMEOUT: 2000,
  /** Progress update minimum interval (requirement 6.2) */
  PROGRESS_UPDATE_INTERVAL: 500,
} as const;

/**
 * Z-index for modal positioning
 */
const MODAL_Z_INDEX = 10000;

/**
 * Default progress values for initialization
 */
const DEFAULT_PROGRESS: LoadingProgress = {
  progress: 0,
  stage: 'downloading',
  message: 'Initializing model loading...',
  eta_seconds: undefined,
};

// ===== Helper Functions =====

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

/**
 * Format seconds to human readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Format download speed to human readable string
 */
function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Get stage icon emoji
 */
function getStageIcon(stage: LoadingProgress['stage']): string {
  switch (stage) {
    case 'downloading':
      return '📥';
    case 'extracting':
      return '📦';
    case 'initializing':
      return '🔧';
    case 'warming_up':
      return '🔥';
    case 'complete':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '⏳';
  }
}

/**
 * Get user-friendly stage description
 */
function getStageDescription(stage: LoadingProgress['stage']): string {
  switch (stage) {
    case 'downloading':
      return 'Downloading Model Files';
    case 'extracting':
      return 'Extracting Model Archive';
    case 'initializing':
      return 'Initializing Model';
    case 'warming_up':
      return 'Warming Up Model';
    case 'complete':
      return 'Model Loading Complete';
    case 'error':
      return 'Loading Failed';
    default:
      return 'Processing...';
  }
}

// ===== Component Types =====

/**
 * ModelLoadingModal component props
 */
export interface ModelLoadingModalProps {
  /** Whether the modal is visible */
  isVisible: boolean;
  /** Handler for modal close */
  onClose: () => void;
  /** Handler for loading cancellation */
  onCancel?: () => Promise<void>;
  /** Model being loaded (for display) */
  modelName?: string;
  /** Model management service instance */
  modelService?: ModelManagementService;
  /** Custom CSS class name */
  className?: string;
  /** Initial loading state */
  initialProgress?: LoadingProgress;
}

// ===== ModelLoadingModal Component =====

/**
 * ModelLoadingModal component with real-time progress tracking
 * 
 * Provides comprehensive progress feedback for model loading operations
 * with Server-Sent Events integration, cancellation support, and error handling.
 */
export function ModelLoadingModal({
  isVisible,
  onClose,
  onCancel,
  modelName = 'Selected Model',
  modelService,
  className = '',
  initialProgress = DEFAULT_PROGRESS,
}: ModelLoadingModalProps): JSX.Element {
  const { theme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  const progressUnsubscribeRef = useRef<(() => void) | null>(null);
  const statusUnsubscribeRef = useRef<(() => void) | null>(null);
  
  const [currentState, setCurrentState] = useState<ModalState>(MODAL_STATES.HIDDEN);
  const [progress, setProgress] = useState<LoadingProgress>(initialProgress);
  const [error, setError] = useState<ModelManagementError | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  /**
   * Progress callback for Server-Sent Events
   */
  const handleProgressUpdate: ProgressCallback = useCallback((newProgress: LoadingProgress) => {
    setProgress(newProgress);
    
    // Handle completion
    if (newProgress.stage === 'complete') {
      setCurrentState(MODAL_STATES.SUCCESS);
      
      // Auto-dismiss after 2 seconds (requirement 6.6)
      successTimeoutRef.current = window.setTimeout(() => {
        onClose();
      }, ANIMATION_CONFIG.SUCCESS_TIMEOUT);
    }
    
    // Handle error state
    if (newProgress.stage === 'error') {
      setCurrentState(MODAL_STATES.ERROR);
      if (newProgress.error) {
        setError(new ModelManagementError(
          'MODEL_LOADING_FAILED' as any,
          newProgress.error.message,
          newProgress.error.recoverable,
          []
        ));
      }
    }
  }, [onClose]);

  /**
   * Status callback for Server-Sent Events
   */
  const handleStatusUpdate: StatusChangeCallback = useCallback((status: LoadingStatus) => {
    // If loading stopped but no completion/error, it was likely cancelled
    if (!status.is_loading && progress.stage !== 'complete' && progress.stage !== 'error') {
      setCurrentState(MODAL_STATES.HIDDEN);
    }
  }, [progress.stage]);

  /**
   * Handle modal visibility changes
   */
  useEffect(() => {
    if (isVisible && currentState === MODAL_STATES.HIDDEN) {
      // Store current focus (requirement for accessibility)
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      setIsAnimating(true);
      setCurrentState(MODAL_STATES.LOADING);
      setProgress(initialProgress);
      setError(null);
      setIsCancelling(false);
      
      // Set up progress monitoring if service is available
      if (modelService) {
        // Subscribe to progress updates (requirement 6.2)
        progressUnsubscribeRef.current = modelService.subscribeToProgress(handleProgressUpdate);
        statusUnsubscribeRef.current = modelService.subscribeToStatus(handleStatusUpdate);
      }
      
      // Focus modal after animation
      setTimeout(() => {
        modalRef.current?.focus();
        setIsAnimating(false);
      }, ANIMATION_CONFIG.MODAL_DURATION);
      
    } else if (!isVisible && currentState !== MODAL_STATES.HIDDEN) {
      setIsAnimating(true);
      
      // Clear timeouts
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      
      // Unsubscribe from progress updates
      if (progressUnsubscribeRef.current) {
        progressUnsubscribeRef.current();
        progressUnsubscribeRef.current = null;
      }
      
      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current();
        statusUnsubscribeRef.current = null;
      }
      
      setCurrentState(MODAL_STATES.HIDDEN);
      
      // Restore previous focus after animation
      setTimeout(() => {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
        setIsAnimating(false);
      }, ANIMATION_CONFIG.MODAL_DURATION);
    }
  }, [isVisible, currentState, initialProgress, modelService, handleProgressUpdate, handleStatusUpdate]);

  /**
   * Handle cancellation
   */
  const handleCancel = useCallback(async () => {
    if (isCancelling) return;
    
    setIsCancelling(true);
    
    try {
      if (onCancel) {
        await onCancel();
      } else if (modelService) {
        await modelService.cancelLoading();
      }
      
      // Close modal after successful cancellation
      onClose();
    } catch (error) {
      console.error('[ModelLoadingModal] Failed to cancel loading:', error);
      setError(new ModelManagementError(
        'LOADING_CANCELLED' as any,
        'Failed to cancel model loading',
        true,
        ['Try closing the modal and retrying the operation']
      ));
      setCurrentState(MODAL_STATES.ERROR);
    } finally {
      setIsCancelling(false);
    }
  }, [isCancelling, onCancel, modelService, onClose]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        if (currentState === MODAL_STATES.LOADING && !isCancelling) {
          handleCancel();
        } else if (currentState === MODAL_STATES.ERROR || currentState === MODAL_STATES.SUCCESS) {
          onClose();
        }
        break;
        
      case 'Tab':
        // Allow normal tab navigation within modal
        break;
        
      default:
        // Prevent other keyboard shortcuts while modal is open
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
        }
        break;
    }
  }, [currentState, isCancelling, handleCancel, onClose]);

  /**
   * Handle backdrop click (close modal)
   */
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      if (currentState === MODAL_STATES.LOADING && !isCancelling) {
        handleCancel();
      } else if (currentState === MODAL_STATES.ERROR || currentState === MODAL_STATES.SUCCESS) {
        onClose();
      }
    }
  }, [currentState, isCancelling, handleCancel, onClose]);

  // Don't render if hidden
  if (currentState === MODAL_STATES.HIDDEN && !isAnimating) {
    return <></>;
  }

  return (
    <div
      ref={modalRef}
      className={`model-loading-modal ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: MODAL_Z_INDEX,
        opacity: currentState === MODAL_STATES.HIDDEN ? 0 : 1,
        transition: `opacity ${ANIMATION_CONFIG.MODAL_DURATION}ms ease-in-out`,
        padding: '1rem',
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
      aria-describedby="loading-modal-description"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      {/* Main Modal Panel */}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          border: `2px solid ${currentState === MODAL_STATES.ERROR ? '#ef4444' : theme.colors.primary}`,
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: theme.mode === 'dark' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.6)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          transform: currentState === MODAL_STATES.HIDDEN ? 'scale(0.95)' : 'scale(1)',
          transition: `transform ${ANIMATION_CONFIG.MODAL_DURATION}ms ease-in-out`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '2rem 2rem 1rem 2rem',
            borderBottom: `1px solid ${theme.colors.secondary}`,
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.02)' 
              : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            {/* Stage Icon */}
            <div
              style={{
                fontSize: '2.5rem',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '4rem',
                height: '4rem',
                backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: '12px',
              }}
            >
              {getStageIcon(progress.stage)}
            </div>
            
            {/* Title and Description */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="loading-modal-title"
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: theme.colors.text,
                  lineHeight: 1.2,
                }}
              >
                {currentState === MODAL_STATES.SUCCESS ? 'Loading Complete!' :
                 currentState === MODAL_STATES.ERROR ? 'Loading Failed' :
                 getStageDescription(progress.stage)}
              </h2>
              
              <p
                id="loading-modal-description"
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.875rem',
                  color: theme.colors.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                {currentState === MODAL_STATES.SUCCESS ? 
                  `Successfully loaded ${modelName}` :
                  currentState === MODAL_STATES.ERROR ?
                  'Model loading encountered an error' :
                  `Loading ${modelName}...`}
              </p>
              
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: theme.colors.textSecondary,
                  opacity: 0.8,
                }}
              >
                {progress.message}
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div style={{ padding: '2rem' }}>
          {/* Loading State */}
          {currentState === MODAL_STATES.LOADING && (
            <div>
              {/* Progress Bar */}
              <div
                style={{
                  marginBottom: '1.5rem',
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
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Progress
                  </span>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: theme.colors.primary,
                    }}
                  >
                    {Math.round(progress.progress)}%
                  </span>
                </div>
                
                {/* Progress Bar Track */}
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Progress Bar Fill */}
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: theme.colors.primary,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease-out',
                      width: `${Math.max(0, Math.min(100, progress.progress))}%`,
                    }}
                  />
                </div>
              </div>
              
              {/* Progress Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {/* Time Remaining */}
                {progress.eta_seconds !== undefined && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: theme.colors.textSecondary,
                        marginBottom: '0.25rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Time Remaining
                    </div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: theme.colors.text,
                      }}
                    >
                      {formatTime(progress.eta_seconds)}
                    </div>
                  </div>
                )}
                
                {/* Download Progress */}
                {progress.download_progress && (
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: theme.colors.textSecondary,
                        marginBottom: '0.25rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Download
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: theme.colors.text,
                        marginBottom: '0.25rem',
                      }}
                    >
                      {formatBytes(progress.download_progress.bytes_downloaded)} / {formatBytes(progress.download_progress.total_bytes)}
                    </div>
                    {progress.download_progress.download_speed && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {formatSpeed(progress.download_progress.download_speed)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Cancel Button (requirement 6.4) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: `2px solid ${theme.colors.secondary}`,
                    borderRadius: '8px',
                    color: theme.colors.text,
                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    opacity: isCancelling ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.backgroundColor = theme.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCancelling) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = theme.colors.secondary;
                    }
                  }}
                  aria-label="Cancel model loading"
                >
                  {isCancelling ? (
                    <>
                      <span style={{ fontSize: '1rem' }}>⏳</span>
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '1rem' }}>✕</span>
                      Cancel Loading
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Success State (requirement 6.6) */}
          {currentState === MODAL_STATES.SUCCESS && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '4rem',
                  marginBottom: '1rem',
                }}
              >
                🎉
              </div>
              <h3
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Model Ready!
              </h3>
              <p
                style={{
                  margin: '0 0 1.5rem 0',
                  fontSize: '0.875rem',
                  color: theme.colors.textSecondary,
                }}
              >
                {modelName} has been successfully loaded and is ready for synthesis.
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary,
                  opacity: 0.7,
                }}
              >
                This dialog will close automatically in 2 seconds...
              </p>
            </div>
          )}
          
          {/* Error State */}
          {currentState === MODAL_STATES.ERROR && error && (
            <div>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#ef4444',
                  }}
                >
                  Error Details
                </h4>
                <p
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '0.875rem',
                    color: theme.colors.text,
                    lineHeight: 1.5,
                  }}
                >
                  {error.message}
                </p>
                
                {error.suggestions && error.suggestions.length > 0 && (
                  <div>
                    <h5
                      style={{
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: theme.colors.text,
                      }}
                    >
                      Suggested Solutions:
                    </h5>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.25rem',
                        fontSize: '0.8125rem',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {error.suggestions.map((suggestion, index) => (
                        <li key={index} style={{ marginBottom: '0.25rem' }}>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Error Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: theme.colors.primary,
                    border: `2px solid ${theme.colors.primary}`,
                    borderRadius: '8px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Export =====

export default ModelLoadingModal;

