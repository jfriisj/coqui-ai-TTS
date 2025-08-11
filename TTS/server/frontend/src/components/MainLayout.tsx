/**
 * MainLayout Component for Coqui TTS Frontend
 * 
 * Main application layout that integrates all major interface panels into a cohesive
 * desktop-focused interface. Handles responsive layout, component positioning, loading
 * states, and error boundaries for the primary TTS synthesis workflow.
 * 
 * Features:
 * - Responsive grid layout with desktop and mobile breakpoints
 * - Integration of SynthesisPanel, AudioPlayer, and ModelInfoPanel
 * - Error boundary for graceful error handling and recovery
 * - Loading states with skeleton placeholders for better UX
 * - Theme-aware styling with consistent visual hierarchy
 * - Real-time synthesis progress indication and feedback
 * - Audio generation history management and display
 * - Keyboard navigation support and accessibility features
 * 
 * Requirements:
 * - 5.1: Interface comprehension within 30 seconds (clear layout and guidance)
 * - 5.2: Immediate feedback within 100ms (loading states and button responses)
 * 
 * Leverages:
 * - SynthesisPanel component from task 22 (complete synthesis interface)
 * - AudioPlayer component from task 20 (waveform playback)
 * - ModelInfoPanel component from task 21 (model capabilities display)
 * - Audio context for generation history and playback management
 * - Theme context for consistent styling and user preferences
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio, AudioGenerationRecord, SynthesisProgress } from '../contexts/AudioContext';
import SynthesisPanel from './SynthesisPanel';
import AudioPlayer from './AudioPlayer';
import ModelInfoPanel from './ModelInfoPanel';
import { EnhancedSynthesisRequest, SynthesisResult } from '../services/ttsService';
import { CompleteModelInfo } from '../services/modelService';

// ===== Constants =====

/**
 * Layout breakpoints for responsive design
 */
const LAYOUT_BREAKPOINTS = {
  /** Mobile breakpoint */
  MOBILE: 640,
  /** Tablet breakpoint */
  TABLET: 768,
  /** Desktop breakpoint */
  DESKTOP: 1024,
  /** Large desktop breakpoint */
  DESKTOP_LG: 1280,
} as const;

/**
 * Layout configuration
 */
const LAYOUT_CONFIG = {
  /** Header height */
  HEADER_HEIGHT: '80px',
  /** Sidebar width on desktop */
  SIDEBAR_WIDTH: '350px',
  /** Minimum content width */
  MIN_CONTENT_WIDTH: '400px',
  /** Maximum content width */
  MAX_CONTENT_WIDTH: '1200px',
  /** Standard spacing unit */
  SPACING_UNIT: '1rem',
  /** Large spacing for sections */
  SPACING_LARGE: '2rem',
} as const;

/**
 * Loading state duration for smooth transitions
 */
const LOADING_CONFIG = {
  /** Minimum loading duration to prevent flashing */
  MIN_LOADING_DURATION: 500,
  /** Skeleton animation duration */
  SKELETON_ANIMATION_DURATION: 1500,
} as const;

// ===== Types =====

/**
 * Layout state interface
 */
interface LayoutState {
  /** Currently active audio record for playback */
  activeAudioRecord: AudioGenerationRecord | null;
  /** Current synthesis progress */
  synthesisProgress: SynthesisProgress;
  /** Whether the layout is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether sidebar is collapsed on mobile */
  isSidebarCollapsed: boolean;
  /** Current window width for responsive behavior */
  windowWidth: number;
  /** Whether synthesis is currently active */
  isSynthesizing: boolean;
}

/**
 * MainLayout component props
 */
export interface MainLayoutProps {
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Get responsive layout configuration based on screen width
 */
function getResponsiveLayout(windowWidth: number): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  gridTemplate: string;
  sidebarPosition: 'overlay' | 'inline';
  contentPadding: string;
} {
  const isMobile = windowWidth < LAYOUT_BREAKPOINTS.TABLET;
  const isTablet = windowWidth >= LAYOUT_BREAKPOINTS.TABLET && windowWidth < LAYOUT_BREAKPOINTS.DESKTOP;
  // @ts-ignore
  const _isDesktop = windowWidth >= LAYOUT_BREAKPOINTS.DESKTOP;

  if (isMobile) {
    return {
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      gridTemplate: '1fr',
      sidebarPosition: 'overlay',
      contentPadding: LAYOUT_CONFIG.SPACING_UNIT,
    };
  } else if (isTablet) {
    return {
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      gridTemplate: '1fr',
      sidebarPosition: 'inline',
      contentPadding: LAYOUT_CONFIG.SPACING_LARGE,
    };
  } else {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      gridTemplate: windowWidth >= LAYOUT_BREAKPOINTS.DESKTOP_LG 
        ? `minmax(${LAYOUT_CONFIG.MIN_CONTENT_WIDTH}, ${LAYOUT_CONFIG.MAX_CONTENT_WIDTH}) ${LAYOUT_CONFIG.SIDEBAR_WIDTH}`
        : `1fr ${LAYOUT_CONFIG.SIDEBAR_WIDTH}`,
      sidebarPosition: 'inline',
      contentPadding: LAYOUT_CONFIG.SPACING_LARGE,
    };
  }
}

/**
 * Error Boundary Component for graceful error handling
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MainLayout Error Boundary caught error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '2rem',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '1.5rem', maxWidth: '500px', lineHeight: 1.6 }}>
            The application encountered an unexpected error. Please refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details style={{ marginTop: '1.5rem', textAlign: 'left', fontSize: '0.875rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Error Details</summary>
              <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', color: '#991b1b' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading Skeleton Component for smooth loading states
 */
function LoadingSkeleton(): JSX.Element {
  const { theme } = useTheme();

  useEffect(() => {
    const styleId = 'pulse-animation';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `;
    document.head.appendChild(style);
  }, []);
  
  return (
    <div
      style={{
        animation: `pulse ${LOADING_CONFIG.SKELETON_ANIMATION_DURATION}ms infinite`,
        display: 'flex',
        flexDirection: 'column',
        gap: LAYOUT_CONFIG.SPACING_LARGE,
        padding: LAYOUT_CONFIG.SPACING_LARGE,
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          height: '120px',
          backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
        }}
      />
      
      {/* Content skeleton */}
      <div style={{ display: 'flex', gap: LAYOUT_CONFIG.SPACING_LARGE }}>
        <div
          style={{
            flex: 1,
            height: '400px',
            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
          }}
        />
        <div
          style={{
            width: '300px',
            height: '400px',
            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
          }}
        />
      </div>
    </div>
  );
}

// ===== MainLayout Component =====

/**
 * MainLayout component providing the primary application interface
 * 
 * Integrates synthesis panel, audio player, and model information into
 * a cohesive, responsive desktop-focused layout with comprehensive
 * error handling and loading states.
 */
export function MainLayout({ className = "" }: MainLayoutProps): JSX.Element {
  const { theme } = useTheme();
  const { 
    audioHistory, 
    synthesisProgress,
    addAudioGeneration,
  } = useAudio();

  // Component state
  const [layoutState, setLayoutState] = useState<LayoutState>({
    activeAudioRecord: null,
    synthesisProgress: synthesisProgress,
    isLoading: true,
    error: null,
    isSidebarCollapsed: false,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : LAYOUT_BREAKPOINTS.DESKTOP,
    isSynthesizing: false,
  });

  // Refs for managing focus and interactions
  const mainContentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const styleId = 'main-layout-animations';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .main-layout {
          transition: all 0.2s ease;
        }
        
        .main-layout button:hover {
          opacity: 0.8;
        }
        
        .main-layout button:active {
          transform: translateY(1px);
        }
      `;
    document.head.appendChild(style);
  }, []);

  /**
   * Handle window resize for responsive layout
   */
  useEffect(() => {
    const handleResize = () => {
      setLayoutState(prev => ({
        ...prev,
        windowWidth: window.innerWidth,
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Initialize layout after mount
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setLayoutState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }, LOADING_CONFIG.MIN_LOADING_DURATION);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Update synthesis progress from audio context
   */
  useEffect(() => {
    setLayoutState(prev => ({
      ...prev,
      synthesisProgress: synthesisProgress,
      isSynthesizing: synthesisProgress.isActive,
    }));
  }, [synthesisProgress]);

  /**
   * Handle synthesis completion (Requirement 5.2: immediate feedback)
   */
  const handleSynthesisComplete = useCallback(async (result: SynthesisResult, request: EnhancedSynthesisRequest) => {
    const newRecord = await addAudioGeneration(result.audio, result.metadata.text, request);
    setLayoutState(prev => ({
      ...prev,
      activeAudioRecord: newRecord,
      isSynthesizing: false,
    }));
  }, [addAudioGeneration]);

  /**
   * Handle synthesis error
   */
  const handleSynthesisError = useCallback((error: string) => {
    setLayoutState(prev => ({
      ...prev,
      error,
      isSynthesizing: false,
    }));
  }, []);

  /**
   * Handle synthesis start (Requirement 5.2: immediate feedback)
   */
  const handleSynthesisStart = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      isSynthesizing: true,
      error: null,
    }));
  }, []);

  /**
   * Handle synthesis stop
   */
  const handleSynthesisStop = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      isSynthesizing: false,
    }));
  }, []);

  /**
   * Handle model info refresh
   */
  const handleModelInfoRefresh = useCallback((modelInfo?: CompleteModelInfo) => {
    // Handle model info refresh - modelInfo parameter is optional
    if (modelInfo) {
      console.log('[MainLayout] Model info refreshed:', modelInfo);
    }
  }, []);

  /**
   * Handle audio record selection from history
   */
  const handleAudioRecordSelect = useCallback((record: AudioGenerationRecord) => {
    setLayoutState(prev => ({
      ...prev,
      activeAudioRecord: record,
    }));
  }, []);

  /**
   * Toggle sidebar on mobile
   */
  const toggleSidebar = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      isSidebarCollapsed: !prev.isSidebarCollapsed,
    }));
  }, []);

  /**
   * Handle error boundary error
   */
  const handleErrorBoundaryError = useCallback((error: Error) => {
    setLayoutState(prev => ({
      ...prev,
      error: error.message,
    }));
  }, []);

  // Calculate responsive layout
  const layout = getResponsiveLayout(layoutState.windowWidth);
  const { activeAudioRecord, isLoading, error, isSidebarCollapsed } = layoutState;

  // Show loading skeleton while initializing
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <ErrorBoundary onError={handleErrorBoundaryError}>
      <div
        className={`main-layout ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Application Header */}
        <header
          style={{
            height: LAYOUT_CONFIG.HEADER_HEIGHT,
            backgroundColor: theme.colors.surface,
            borderBottom: `1px solid ${theme.colors.secondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${layout.contentPadding}`,
            position: 'relative',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.75rem' }}>🐸</span>
              Coqui TTS
            </h1>
            
            {/* Synthesis Progress Indicator (Requirement 5.2: immediate feedback) */}
            {layoutState.isSynthesizing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: theme.colors.primary + '20',
                  border: `1px solid ${theme.colors.primary}`,
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  color: theme.colors.primary,
                }}
              >
                <div
                  style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid transparent',
                    borderTop: `2px solid ${theme.colors.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>
                  {synthesisProgress.stage} 
                  {synthesisProgress.progress > 0 && ` (${Math.round(synthesisProgress.progress)}%)`}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Mobile sidebar toggle */}
            {layout.isMobile && (
              <button
                onClick={toggleSidebar}
                aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                style={{
                  padding: '0.5rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.secondary}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Theme toggle */}
            <button
              onClick={() => useTheme().toggleTheme()}
              aria-label="Toggle theme"
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '4px',
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: '1.25rem',
              }}
            >
              {theme.mode === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          ref={mainContentRef}
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: layout.gridTemplate,
            gap: layout.isDesktop ? LAYOUT_CONFIG.SPACING_LARGE : LAYOUT_CONFIG.SPACING_UNIT,
            padding: layout.contentPadding,
            overflow: 'hidden',
          }}
        >
          {/* Primary Content Column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: LAYOUT_CONFIG.SPACING_LARGE,
              minWidth: 0, // Prevent grid overflow
              overflow: 'auto',
            }}
          >
            {/* Synthesis Panel (Requirement 5.1: clear interface) */}
            <SynthesisPanel
              onSynthesisComplete={handleSynthesisComplete}
              onSynthesisError={handleSynthesisError}
              onSynthesisStart={handleSynthesisStart}
              onSynthesisStop={handleSynthesisStop}
              showAdvancedOptions={true}
            />

            {/* Audio Player Section */}
            {activeAudioRecord && (
              <div>
                <h2
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>🎵</span>
                  Generated Audio
                </h2>
                
                <AudioPlayer
                  audioRecord={activeAudioRecord}
                  isActive={true}
                  showWaveform={true}
                  showControls={true}
                  enableKeyboardShortcuts={true}
                />
              </div>
            )}

            {/* Audio History Preview */}
            {audioHistory.length > 1 && (
              <div>
                <h2
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: theme.colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>📂</span>
                  Recent Generations ({audioHistory.length})
                </h2>
                
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: layout.isDesktop 
                      ? 'repeat(auto-fit, minmax(300px, 1fr))' 
                      : '1fr',
                    gap: '1rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {audioHistory.slice(0, 4).map((record) => (
                    <div
                      key={record.id}
                      onClick={() => handleAudioRecordSelect(record)}
                      style={{
                        padding: '1rem',
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${record === activeAudioRecord ? theme.colors.primary : theme.colors.secondary}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: theme.colors.text,
                          marginBottom: '0.5rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        "{record.text.substring(0, 50)}{record.text.length > 50 ? '...' : ''}"
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{record.timestamp.toLocaleTimeString()}</span>
                        <span>{record.duration ? `${record.duration.toFixed(1)}s` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          {(layout.sidebarPosition === 'inline' || !isSidebarCollapsed) && (
            <aside
              ref={sidebarRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: LAYOUT_CONFIG.SPACING_UNIT,
                ...(layout.sidebarPosition === 'overlay' && layout.isMobile ? {
                  position: 'fixed',
                  top: LAYOUT_CONFIG.HEADER_HEIGHT,
                  right: 0,
                  bottom: 0,
                  width: '80%',
                  maxWidth: '300px',
                  backgroundColor: theme.colors.background,
                  borderLeft: `1px solid ${theme.colors.secondary}`,
                  zIndex: 999,
                  overflowY: 'auto',
                  padding: LAYOUT_CONFIG.SPACING_UNIT,
                } : {
                  minWidth: 0, // Prevent overflow
                }),
              }}
            >
              {/* Model Information Panel */}
              <ModelInfoPanel
                defaultExpanded={false}
                enableAutoRefresh={true}
                onRefresh={handleModelInfoRefresh}
              />
            </aside>
          )}
        </main>

        {/* Mobile sidebar backdrop */}
        {layout.isMobile && !isSidebarCollapsed && (
          <div
            onClick={toggleSidebar}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 998,
            }}
          />
        )}

        {/* Error Toast */}
        {error && (
          <div
            style={{
              position: 'fixed',
              bottom: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: theme.mode === 'dark' ? '#dc2626' : '#fef2f2',
              color: theme.mode === 'dark' ? '#ffffff' : '#dc2626',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              border: `1px solid ${theme.mode === 'dark' ? '#dc2626' : '#fecaca'}`,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              zIndex: 1001,
              maxWidth: '90%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
            role="alert"
            aria-live="assertive"
          >
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => setLayoutState(prev => ({ ...prev, error: null }))}
              style={{
                marginLeft: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1.25rem',
                padding: '0.25rem',
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// ===== Export =====

export default MainLayout;

