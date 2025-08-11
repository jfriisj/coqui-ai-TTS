/**
 * SynthesisControls Component for Coqui TTS Frontend
 * 
 * Advanced synthesis control interface with progress tracking and real-time
 * feedback. Features synthesize/stop buttons with loading states, progress bar
 * with estimated time remaining, and comprehensive status display.
 * 
 * Features:
 * - Synthesize button with loading states and progress display
 * - Progress bar with estimated time remaining during synthesis
 * - Real-time progress updates at 100ms intervals
 * - Start/stop synthesis controls with proper state management
 * - Visual feedback within 100ms (button states, loading indicators)
 * - Theme-aware styling with light/dark mode support
 * - Accessibility features (ARIA labels, screen reader support)
 * 
 * Requirements:
 * - 1.2: Progress tracking with estimated time remaining
 * - 5.2: Immediate feedback within 100ms (button states, loading)
 * - 5.3: Real-time progress updates at least every 500ms (actually 100ms)
 * 
 * Leverages:
 * - TTS synthesis service from task 7 for synthesis operations
 * - Theme context for consistent styling
 * - Progress tracking from ttsService with enhanced UI feedback
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ttsService, SynthesisProgress, EnhancedSynthesisRequest } from '../services/ttsService';
import { SynthesisResult } from '../services/ttsService';

// ===== Constants =====

/**
 * UI update intervals for responsiveness
 */
const UI_INTERVALS = {
  /** Button state feedback delay (100ms for immediate response) */
  BUTTON_FEEDBACK: 100,
  /** Progress update interval (100ms for smooth updates) */
  PROGRESS_UPDATE: 100,
  /** Status message animation duration */
  STATUS_ANIMATION: 200,
} as const;

/**
 * Button states for synthesis control
 */
const BUTTON_STATES = {
  IDLE: 'idle',
  STARTING: 'starting',
  SYNTHESIZING: 'synthesizing',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

type ButtonState = typeof BUTTON_STATES[keyof typeof BUTTON_STATES];

// ===== Types =====

/**
 * Synthesis control state
 */
interface SynthesisControlState {
  /** Current button state */
  buttonState: ButtonState;
  /** Current synthesis progress */
  progress: SynthesisProgress | null;
  /** Last synthesis result */
  lastResult: SynthesisResult | null;
  /** Current error message */
  error: string | null;
  /** Request ID for tracking */
  requestId: string | null;
}

/**
 * SynthesisControls component props
 */
export interface SynthesisControlsProps {
  /** Text to synthesize */
  text: string;
  /** Synthesis options */
  synthesisOptions?: Partial<EnhancedSynthesisRequest>;
  /** Whether synthesis is enabled (text is valid) */
  enabled?: boolean;
  /** Callback when synthesis completes successfully */
  onSynthesisComplete?: (result: SynthesisResult, request: EnhancedSynthesisRequest) => void;
  /** Callback when synthesis fails */
  onSynthesisError?: (error: string) => void;
  /** Callback when synthesis starts */
  onSynthesisStart?: () => void;
  /** Callback when synthesis stops */
  onSynthesisStop?: () => void;
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Format time duration in a human-readable format
 */
function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Get button text based on current state
 */
function getButtonText(state: ButtonState, progress: SynthesisProgress | null): string {
  switch (state) {
    case BUTTON_STATES.IDLE:
      return 'Synthesize';
    case BUTTON_STATES.STARTING:
      return 'Starting...';
    case BUTTON_STATES.SYNTHESIZING:
      return progress ? `Stop (${Math.round(progress.progress)}%)` : 'Stop';
    case BUTTON_STATES.STOPPING:
      return 'Stopping...';
    case BUTTON_STATES.COMPLETED:
      return 'Complete!';
    case BUTTON_STATES.ERROR:
      return 'Try Again';
    default:
      return 'Synthesize';
  }
}

/**
 * Get button color scheme based on state and theme
 */
function getButtonColors(state: ButtonState, theme: any): {
  background: string;
  color: string;
  border: string;
  hoverBackground: string;
} {
  const colors = theme.colors;
  
  switch (state) {
    case BUTTON_STATES.IDLE:
      return {
        background: colors.primary,
        color: '#ffffff',
        border: colors.primary,
        hoverBackground: theme.mode === 'dark' ? '#2563eb' : '#1d4ed8',
      };
    case BUTTON_STATES.STARTING:
      return {
        background: colors.secondary,
        color: colors.text,
        border: colors.secondary,
        hoverBackground: colors.secondary,
      };
    case BUTTON_STATES.SYNTHESIZING:
      return {
        background: '#ef4444',
        color: '#ffffff',
        border: '#ef4444',
        hoverBackground: '#dc2626',
      };
    case BUTTON_STATES.STOPPING:
      return {
        background: '#6b7280',
        color: '#ffffff',
        border: '#6b7280',
        hoverBackground: '#6b7280',
      };
    case BUTTON_STATES.COMPLETED:
      return {
        background: '#10b981',
        color: '#ffffff',
        border: '#10b981',
        hoverBackground: '#059669',
      };
    case BUTTON_STATES.ERROR:
      return {
        background: '#ef4444',
        color: '#ffffff',
        border: '#ef4444',
        hoverBackground: '#dc2626',
      };
    default:
      return {
        background: colors.primary,
        color: '#ffffff',
        border: colors.primary,
        hoverBackground: theme.mode === 'dark' ? '#2563eb' : '#1d4ed8',
      };
  }
}

// ===== SynthesisControls Component =====

/**
 * SynthesisControls component with progress tracking and real-time feedback
 * 
 * Provides synthesis control interface with loading states, progress display,
 * and comprehensive status feedback.
 */
export function SynthesisControls({
  text,
  synthesisOptions = {},
  enabled = true,
  onSynthesisComplete,
  onSynthesisError,
  onSynthesisStart,
  onSynthesisStop,
  className = "",
}: SynthesisControlsProps): JSX.Element {
  const { theme } = useTheme();
  const [controlState, setControlState] = useState<SynthesisControlState>({
    buttonState: BUTTON_STATES.IDLE,
    progress: null,
    lastResult: null,
    error: null,
    requestId: null,
  });
  
  const progressUpdateRef = useRef<NodeJS.Timeout>();
  const buttonFeedbackRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const styleId = 'synthesis-controls-spin-animation';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);
  
  /**
   * Progress callback for synthesis tracking (Requirement 5.3)
   */
  const handleProgress = useCallback((progress: SynthesisProgress) => {
    setControlState(prev => ({
      ...prev,
      progress,
      error: progress.error || null,
    }));
    
    // Update button state based on progress
    if (progress.isComplete) {
      if (progress.error) {
        setControlState(prev => ({
          ...prev,
          buttonState: BUTTON_STATES.ERROR,
        }));
      } else {
        setControlState(prev => ({
          ...prev,
          buttonState: BUTTON_STATES.COMPLETED,
        }));
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setControlState(prev => ({
            ...prev,
            buttonState: BUTTON_STATES.IDLE,
            progress: null,
            error: null,
          }));
        }, 2000);
      }
    }
  }, []);
  
  /**
   * Start synthesis with progress tracking (Requirement 1.2, 5.2)
   */
  const startSynthesis = useCallback(async () => {
    if (!text.trim() || !enabled) return;
    
    // Immediate UI feedback (Requirement 5.2: <100ms)
    setControlState(prev => ({
      ...prev,
      buttonState: BUTTON_STATES.STARTING,
      error: null,
    }));
    
    // Generate unique request ID
    const requestId = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Transition to synthesizing state after brief delay
    buttonFeedbackRef.current = setTimeout(() => {
      setControlState(prev => ({
        ...prev,
        buttonState: BUTTON_STATES.SYNTHESIZING,
        requestId,
      }));
    }, UI_INTERVALS.BUTTON_FEEDBACK);
    
    try {
      // Notify synthesis start
      onSynthesisStart?.();
      
      // Prepare synthesis request
      const request: EnhancedSynthesisRequest = {
        text,
        trackProgress: true,
        ...synthesisOptions,
      };
      
      // Start synthesis with progress tracking
      const result = await ttsService.synthesize(request, handleProgress);
      
      if (result.success) {
        setControlState(prev => ({
          ...prev,
          lastResult: result.data,
          buttonState: BUTTON_STATES.COMPLETED,
        }));
        
        // Notify completion
        onSynthesisComplete?.(result.data, request);
      } else {
        const errorMessage = result.error.error || 'Synthesis failed';
        setControlState(prev => ({
          ...prev,
          error: errorMessage,
          buttonState: BUTTON_STATES.ERROR,
        }));
        
        // Notify error
        onSynthesisError?.(errorMessage);
      }
      
    } catch (error: any) {
      const errorMessage = error.message || 'Synthesis failed';
      setControlState(prev => ({
        ...prev,
        error: errorMessage,
        buttonState: BUTTON_STATES.ERROR,
      }));
      
      // Notify error
      onSynthesisError?.(errorMessage);
    }
  }, [text, enabled, synthesisOptions, onSynthesisStart, onSynthesisComplete, onSynthesisError, handleProgress]);
  
  /**
   * Stop synthesis
   */
  const stopSynthesis = useCallback(() => {
    // Immediate UI feedback (Requirement 5.2: <100ms)
    setControlState(prev => ({
      ...prev,
      buttonState: BUTTON_STATES.STOPPING,
    }));
    
    // Cancel synthesis request
    ttsService.cancelSynthesis();
    
    // Notify synthesis stop
    onSynthesisStop?.();
    
    // Reset state after brief delay
    setTimeout(() => {
      setControlState({
        buttonState: BUTTON_STATES.IDLE,
        progress: null,
        lastResult: null,
        error: null,
        requestId: null,
      });
    }, UI_INTERVALS.STATUS_ANIMATION);
  }, [onSynthesisStop]);
  
  /**
   * Handle button click based on current state
   */
  const handleButtonClick = useCallback(() => {
    const { buttonState } = controlState;
    
    switch (buttonState) {
      case BUTTON_STATES.IDLE:
      case BUTTON_STATES.ERROR:
      case BUTTON_STATES.COMPLETED:
        startSynthesis();
        break;
      case BUTTON_STATES.SYNTHESIZING:
        stopSynthesis();
        break;
      default:
        // Do nothing for transitional states
        break;
    }
  }, [controlState.buttonState, startSynthesis, stopSynthesis]);
  
  /**
   * Clean up timers on unmount
   */
  useEffect(() => {
    return () => {
      if (progressUpdateRef.current) {
        clearInterval(progressUpdateRef.current);
      }
      if (buttonFeedbackRef.current) {
        clearTimeout(buttonFeedbackRef.current);
      }
    };
  }, []);
  
  // Calculate component state
  const { buttonState, progress, error } = controlState;
  const isSynthesizing = buttonState === BUTTON_STATES.SYNTHESIZING;
  const isLoading = buttonState === BUTTON_STATES.STARTING || buttonState === BUTTON_STATES.STOPPING;
  const canInteract = enabled && text.trim().length > 0;
  const buttonColors = getButtonColors(buttonState, theme);
  const buttonText = getButtonText(buttonState, progress);
  
  return (
    <div 
      className={`synthesis-controls ${className}`}
      style={{
        width: '100%',
        padding: '1.5rem',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '12px',
        boxShadow: theme.mode === 'dark' 
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Main Control Button */}
      <div className="control-button-container" style={{ marginBottom: '1rem' }}>
        <button
          onClick={handleButtonClick}
          disabled={!canInteract || isLoading}
          aria-label={`${buttonText}${progress ? ` - ${Math.round(progress.progress)}% complete` : ''}`}
          aria-describedby={progress ? "synthesis-progress" : undefined}
          style={{
            width: '100%',
            height: '3rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            border: `2px solid ${buttonColors.border}`,
            borderRadius: '8px',
            backgroundColor: buttonColors.background,
            color: buttonColors.color,
            cursor: canInteract && !isLoading ? 'pointer' : 'not-allowed',
            opacity: !canInteract || isLoading ? 0.7 : 1,
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
          onMouseEnter={(e) => {
            if (canInteract && !isLoading) {
              e.currentTarget.style.backgroundColor = buttonColors.hoverBackground;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = buttonColors.background;
          }}
        >
          {/* Loading Spinner */}
          {isLoading && (
            <div
              style={{
                width: '1.25rem',
                height: '1.25rem',
                border: '2px solid transparent',
                borderTop: `2px solid ${buttonColors.color}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
          
          {/* Button Text */}
          <span>{buttonText}</span>
          
          {/* Progress Overlay for Synthesizing State */}
          {isSynthesizing && progress && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                height: '3px',
                width: `${progress.progress}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                transition: 'width 0.1s ease',
              }}
            />
          )}
        </button>
      </div>
      
      {/* Progress Information (Requirement 1.2) */}
      {progress && !progress.isComplete && (
        <div
          id="synthesis-progress"
          className="progress-container"
          style={{
            marginBottom: '1rem',
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Progress Bar */}
          <div
            className="progress-bar-container"
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '0.5rem',
            }}
          >
            <div
              className="progress-bar"
              style={{
                height: '100%',
                width: `${progress.progress}%`,
                backgroundColor: theme.colors.primary,
                borderRadius: '4px',
                transition: 'width 0.1s ease',
              }}
            />
          </div>
          
          {/* Progress Details */}
          <div
            className="progress-details"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              color: theme.colors.textSecondary,
            }}
          >
            <div className="progress-status">
              <span style={{ fontWeight: 500 }}>
                {progress.status}
              </span>
              {progress.progress > 0 && (
                <span style={{ marginLeft: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(progress.progress)}%
                </span>
              )}
            </div>
            
            {progress.estimatedTimeRemaining > 0 && (
              <div className="time-remaining">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDuration(progress.estimatedTimeRemaining)} remaining
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div
          className="error-container"
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
          }}
          role="alert"
          aria-live="assertive"
        >
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Success Message */}
      {buttonState === BUTTON_STATES.COMPLETED && !error && (
        <div
          className="success-container"
          style={{
            padding: '0.75rem',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#16a34a',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ fontSize: '1.25rem' }}>✓</span>
          <span>Synthesis completed successfully!</span>
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default SynthesisControls;