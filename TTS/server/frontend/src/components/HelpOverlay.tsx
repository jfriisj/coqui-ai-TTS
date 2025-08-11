/**
 * HelpOverlay Component for Coqui TTS Frontend
 * 
 * Comprehensive help overlay providing contextual tooltips and keyboard shortcut
 * information. Displays help content triggered by the ? key press, with progressive
 * help disclosure based on current model capabilities and interface context.
 * 
 * Features:
 * - Keyboard shortcut display triggered by ? key
 * - Contextual tooltips based on current model capabilities  
 * - Progressive help disclosure for different user expertise levels
 * - Accessibility features with proper ARIA labels and keyboard navigation
 * - Theme-aware styling with responsive design
 * - Model-specific help content based on capabilities
 * - Focus management and escape key handling
 * - Categorized help sections for better organization
 * 
 * Requirements:
 * - 5.5: Contextual tooltips and keyboard shortcut hints with single key press
 * 
 * Leverages:
 * - Keyboard shortcut hook from task 6 (keyboard shortcuts management)
 * - Model capabilities from ModelService (contextual help content)
 * - Theme context for consistent styling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useShortcutHelp } from '../hooks/useKeyboardShortcuts';
import { ModelCapabilities } from '../types/api';

// ===== Constants =====

/**
 * Help overlay display modes
 */
const OVERLAY_MODES = {
  HIDDEN: 'hidden',
  SHORTCUTS: 'shortcuts',
  CONTEXTUAL: 'contextual',
  DETAILED: 'detailed',
} as const;

type OverlayMode = typeof OVERLAY_MODES[keyof typeof OVERLAY_MODES];

/**
 * Help categories for organization
 */
const HELP_CATEGORIES = {
  SYNTHESIS: 'Synthesis',
  AUDIO: 'Audio Control',
  INTERFACE: 'Interface',
  MODEL: 'Model Features',
  ACCESSIBILITY: 'Accessibility',
} as const;

/**
 * Animation durations and transitions
 */
const ANIMATION_CONFIG = {
  /** Overlay fade in/out duration */
  OVERLAY_DURATION: 200,
  /** Content transition duration */
  CONTENT_DURATION: 150,
  /** Auto-hide timeout for tooltips */
  TOOLTIP_TIMEOUT: 5000,
} as const;

/**
 * Z-index for overlay positioning
 */
const OVERLAY_Z_INDEX = 9999;

// ===== Types =====

/**
 * Help item structure
 */
interface HelpItem {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Detailed description */
  description: string;
  /** Help category */
  category: string;
  /** Keyboard shortcut if applicable */
  shortcut?: string;
  /** Whether item requires specific model capabilities */
  requiresCapabilities?: Array<keyof ModelCapabilities>;
  /** Icon emoji for visual identification */
  icon?: string;
  /** Additional context or examples */
  examples?: string[];
}



/**
 * HelpOverlay component props
 */
export interface HelpOverlayProps {
  /** Current model capabilities for contextual help */
  modelCapabilities?: ModelCapabilities;
  /** Whether overlay is visible */
  isVisible: boolean;
  /** Handler for overlay close */
  onClose: () => void;
  /** Initial display mode */
  initialMode?: OverlayMode;
  /** Custom CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Generate help items based on model capabilities
 */
function generateHelpItems(modelCapabilities?: ModelCapabilities): HelpItem[] {
  const baseItems: HelpItem[] = [
    // Synthesis help
    {
      id: 'synthesis-basic',
      title: 'Text Synthesis',
      description: 'Enter text in the input field and click "Synthesize" or press Ctrl+Enter to generate speech.',
      category: HELP_CATEGORIES.SYNTHESIS,
      shortcut: 'Ctrl+Enter',
      icon: '🎙️',
      examples: ['Type any text and press Ctrl+Enter', 'Use punctuation for natural pauses'],
    },
    
    // Audio control help
    {
      id: 'audio-playback',
      title: 'Audio Playback',
      description: 'Control audio playback with the Space key or using the audio player controls.',
      category: HELP_CATEGORIES.AUDIO,
      shortcut: 'Space',
      icon: '🔊',
      examples: ['Press Space to play/pause audio', 'Use player controls for fine control'],
    },
    
    // Interface help
    {
      id: 'help-shortcut',
      title: 'Keyboard Shortcuts',
      description: 'Press the ? key to show or hide this help overlay and view all available shortcuts.',
      category: HELP_CATEGORIES.INTERFACE,
      shortcut: '?',
      icon: '❓',
    },
    
    // Accessibility help
    {
      id: 'accessibility-navigation',
      title: 'Keyboard Navigation',
      description: 'Navigate the interface using Tab and arrow keys. All functionality is accessible via keyboard.',
      category: HELP_CATEGORIES.ACCESSIBILITY,
      icon: '⌨️',
      examples: ['Use Tab to navigate between elements', 'Press Enter to activate buttons'],
    },
  ];

  // Add model-specific help items based on capabilities
  const modelSpecificItems: HelpItem[] = [];

  if (modelCapabilities?.is_multi_speaker) {
    modelSpecificItems.push({
      id: 'model-speakers',
      title: 'Speaker Selection',
      description: 'This model supports multiple speakers. Select different voices from the speaker dropdown.',
      category: HELP_CATEGORIES.MODEL,
      requiresCapabilities: ['is_multi_speaker'],
      icon: '👥',
      examples: ['Choose speaker from dropdown', 'Different speakers have unique characteristics'],
    });
  }

  if (modelCapabilities?.is_multi_lingual) {
    modelSpecificItems.push({
      id: 'model-languages',
      title: 'Language Support',
      description: 'This model supports multiple languages. Select your target language from the language dropdown.',
      category: HELP_CATEGORIES.MODEL,
      requiresCapabilities: ['is_multi_lingual'],
      icon: '🌐',
      examples: ['Select target language before synthesis', 'Some models auto-detect language'],
    });
  }

  if (modelCapabilities?.supports_cloning) {
    modelSpecificItems.push({
      id: 'model-cloning',
      title: 'Voice Cloning',
      description: 'This model supports voice cloning. Upload a reference audio file to clone the voice characteristics.',
      category: HELP_CATEGORIES.MODEL,
      requiresCapabilities: ['supports_cloning'],
      icon: '🎭',
      examples: ['Upload 5-30 second audio sample', 'Clear audio works best for cloning'],
    });
  }

  if (modelCapabilities?.use_gst) {
    modelSpecificItems.push({
      id: 'model-style',
      title: 'Style Transfer',
      description: 'This model supports style transfer using GST (Global Style Tokens). Upload style audio to control speaking style.',
      category: HELP_CATEGORIES.MODEL,
      requiresCapabilities: ['use_gst'],
      icon: '🎨',
      examples: ['Upload style reference audio', 'Emotion and speaking style transfer'],
    });
  }

  return [...baseItems, ...modelSpecificItems];
}

/**
 * Group help items by category
 */
function groupHelpItemsByCategory(items: HelpItem[]): Record<string, HelpItem[]> {
  return items.reduce((groups, item) => {
    const category = item.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, HelpItem[]>);
}

/**
 * Filter help items based on model capabilities
 */
function filterHelpItemsByCapabilities(
  items: HelpItem[],
  capabilities?: ModelCapabilities
): HelpItem[] {
  return items.filter(item => {
    if (!item.requiresCapabilities || !capabilities) {
      return true;
    }
    
    return item.requiresCapabilities.every(capability => 
      capabilities[capability] === true
    );
  });
}

// ===== HelpOverlay Component =====

/**
 * HelpOverlay component with contextual help and keyboard shortcuts
 * 
 * Provides comprehensive help information with model-specific content,
 * keyboard shortcuts, and accessibility features.
 */
export function HelpOverlay({
  modelCapabilities,
  isVisible,
  onClose,
  initialMode = OVERLAY_MODES.SHORTCUTS,
  className = "",
}: HelpOverlayProps): JSX.Element {
  const { theme } = useTheme();
  const { shortcuts } = useShortcutHelp();
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  const [currentMode, setCurrentMode] = useState<OverlayMode>(
    isVisible ? initialMode : OVERLAY_MODES.HIDDEN
  );
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Generate contextual help items
  const helpItems = React.useMemo(() => {
    const allItems = generateHelpItems(modelCapabilities);
    return filterHelpItemsByCapabilities(allItems, modelCapabilities);
  }, [modelCapabilities]);
  
  const groupedHelpItems = React.useMemo(() => {
    return groupHelpItemsByCategory(helpItems);
  }, [helpItems]);

  /**
   * Handle overlay visibility changes
   */
  useEffect(() => {
    if (isVisible && currentMode === OVERLAY_MODES.HIDDEN) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      setIsAnimating(true);
      setCurrentMode(initialMode);
      
      // Focus overlay after animation
      setTimeout(() => {
        overlayRef.current?.focus();
        setIsAnimating(false);
      }, ANIMATION_CONFIG.OVERLAY_DURATION);
      
    } else if (!isVisible && currentMode !== OVERLAY_MODES.HIDDEN) {
      setIsAnimating(true);
      setCurrentMode(OVERLAY_MODES.HIDDEN);
      
      // Restore previous focus after animation
      setTimeout(() => {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
        setIsAnimating(false);
      }, ANIMATION_CONFIG.OVERLAY_DURATION);
    }
  }, [isVisible, currentMode, initialMode]);

  /**
   * Handle keyboard navigation within overlay
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
        
      case 'Tab':
        // Allow normal tab navigation within overlay
        break;
        
      case '1':
      case '2':
      case '3':
        if (event.altKey) {
          event.preventDefault();
          const modes = [OVERLAY_MODES.SHORTCUTS, OVERLAY_MODES.CONTEXTUAL, OVERLAY_MODES.DETAILED];
          const modeIndex = parseInt(event.key, 10) - 1;
          if (modes[modeIndex]) {
            setCurrentMode(modes[modeIndex]);
          }
        }
        break;
        
      default:
        // Prevent other keyboard shortcuts while overlay is open
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
        }
        break;
    }
  }, [onClose]);

  /**
   * Handle mode switching
   */
  const switchMode = useCallback((mode: OverlayMode) => {
    if (mode !== currentMode && !isAnimating) {
      setIsAnimating(true);
      setCurrentMode(mode);
      setTimeout(() => setIsAnimating(false), ANIMATION_CONFIG.CONTENT_DURATION);
    }
  }, [currentMode, isAnimating]);

  /**
   * Handle overlay click (close on backdrop click)
   */
  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Don't render if hidden
  if (currentMode === OVERLAY_MODES.HIDDEN && !isAnimating) {
    return <></>;
  }

  return (
    <div
      ref={overlayRef}
      className={`help-overlay ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: OVERLAY_Z_INDEX,
        opacity: currentMode === OVERLAY_MODES.HIDDEN ? 0 : 1,
        transition: `opacity ${ANIMATION_CONFIG.OVERLAY_DURATION}ms ease-in-out`,
        padding: '1rem',
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-overlay-title"
      aria-describedby="help-overlay-description"
      onKeyDown={handleKeyDown}
      onClick={handleOverlayClick}
    >
      {/* Main Help Panel */}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          border: `2px solid ${theme.colors.primary}`,
          borderRadius: '12px',
          maxWidth: '800px',
          maxHeight: '90vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: theme.mode === 'dark' 
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          transform: currentMode === OVERLAY_MODES.HIDDEN ? 'scale(0.95)' : 'scale(1)',
          transition: `transform ${ANIMATION_CONFIG.OVERLAY_DURATION}ms ease-in-out`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: `1px solid ${theme.colors.secondary}`,
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.02)' 
              : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2
                id="help-overlay-title"
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '2rem' }}>💡</span>
                Coqui TTS Help
              </h2>
              
              <p
                id="help-overlay-description"
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: theme.colors.textSecondary,
                }}
              >
                Keyboard shortcuts, features, and contextual help for the TTS interface
              </p>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close help (Escape)"
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '6px',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              aria-label="Close help overlay"
            >
              ✕
            </button>
          </div>
          
          {/* Mode Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '1rem',
            }}
          >
            {[
              { mode: OVERLAY_MODES.SHORTCUTS, label: 'Shortcuts', key: '1' },
              { mode: OVERLAY_MODES.CONTEXTUAL, label: 'Features', key: '2' },
              { mode: OVERLAY_MODES.DETAILED, label: 'Detailed', key: '3' },
            ].map(({ mode, label, key }) => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                disabled={isAnimating}
                title={`Switch to ${label} (Alt+${key})`}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: currentMode === mode ? theme.colors.primary : 'transparent',
                  border: `1px solid ${currentMode === mode ? theme.colors.primary : theme.colors.secondary}`,
                  borderRadius: '6px',
                  color: currentMode === mode ? '#ffffff' : theme.colors.text,
                  cursor: isAnimating ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: isAnimating ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {label}
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Alt+{key}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.5rem',
            opacity: isAnimating ? 0.7 : 1,
            transition: `opacity ${ANIMATION_CONFIG.CONTENT_DURATION}ms ease-in-out`,
          }}
        >
          {/* Shortcuts Mode */}
          {currentMode === OVERLAY_MODES.SHORTCUTS && (
            <div>
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Keyboard Shortcuts
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '1rem',
                          fontWeight: 500,
                          color: theme.colors.text,
                          marginBottom: '0.25rem',
                        }}
                      >
                        {shortcut.description}
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Category: {shortcut.category}
                      </div>
                    </div>
                    
                    <kbd
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: theme.mode === 'dark' ? '#374151' : '#f3f4f6',
                        border: `1px solid ${theme.mode === 'dark' ? '#4b5563' : '#d1d5db'}`,
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: theme.colors.text,
                        fontFamily: 'monospace',
                      }}
                    >
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Contextual/Features Mode */}
          {currentMode === OVERLAY_MODES.CONTEXTUAL && (
            <div>
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Available Features
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {Object.entries(groupedHelpItems).map(([category, items]) => (
                  <div key={category}>
                    <h4
                      style={{
                        margin: '0 0 0.75rem 0',
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: theme.colors.primary,
                      }}
                    >
                      {category}
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '1rem',
                            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                            border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            {item.icon && (
                              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                                {item.icon}
                              </span>
                            )}
                            
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <h5
                                  style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                  }}
                                >
                                  {item.title}
                                </h5>
                                
                                {item.shortcut && (
                                  <kbd
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      backgroundColor: theme.mode === 'dark' ? '#374151' : '#f3f4f6',
                                      border: `1px solid ${theme.mode === 'dark' ? '#4b5563' : '#d1d5db'}`,
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      color: theme.colors.textSecondary,
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </div>
                              
                              <p
                                style={{
                                  margin: '0 0 0.5rem 0',
                                  fontSize: '0.875rem',
                                  color: theme.colors.textSecondary,
                                  lineHeight: 1.5,
                                }}
                              >
                                {item.description}
                              </p>
                              
                              {item.examples && item.examples.length > 0 && (
                                <ul
                                  style={{
                                    margin: 0,
                                    paddingLeft: '1.25rem',
                                    fontSize: '0.8125rem',
                                    color: theme.colors.textSecondary,
                                    opacity: 0.8,
                                  }}
                                >
                                  {item.examples.map((example, idx) => (
                                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                      {example}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Detailed Mode */}
          {currentMode === OVERLAY_MODES.DETAILED && (
            <div>
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Detailed Information
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Model-specific information */}
                {modelCapabilities && (
                  <div>
                    <h4
                      style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: theme.colors.primary,
                      }}
                    >
                      Current Model Capabilities
                    </h4>
                    
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                        border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Multi-Speaker:</span>
                        <span style={{ 
                          fontSize: '0.875rem', 
                          color: modelCapabilities.is_multi_speaker ? '#10b981' : theme.colors.textSecondary,
                          fontWeight: 500,
                        }}>
                          {modelCapabilities.is_multi_speaker ? 'Yes' : 'No'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Multi-Lingual:</span>
                        <span style={{ 
                          fontSize: '0.875rem', 
                          color: modelCapabilities.is_multi_lingual ? '#10b981' : theme.colors.textSecondary,
                          fontWeight: 500,
                        }}>
                          {modelCapabilities.is_multi_lingual ? 'Yes' : 'No'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Voice Cloning:</span>
                        <span style={{ 
                          fontSize: '0.875rem', 
                          color: modelCapabilities.supports_cloning ? '#10b981' : theme.colors.textSecondary,
                          fontWeight: 500,
                        }}>
                          {modelCapabilities.supports_cloning ? 'Supported' : 'Not supported'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Style Transfer:</span>
                        <span style={{ 
                          fontSize: '0.875rem', 
                          color: modelCapabilities.use_gst ? '#10b981' : theme.colors.textSecondary,
                          fontWeight: 500,
                        }}>
                          {modelCapabilities.use_gst ? 'Available (GST)' : 'Not available'}
                        </span>
                      </div>
                      
                      {modelCapabilities.speakers && modelCapabilities.speakers.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Available Speakers:</span>
                          <span style={{ fontSize: '0.875rem', color: theme.colors.text, fontWeight: 500 }}>
                            {modelCapabilities.speakers.length} voices
                          </span>
                        </div>
                      )}
                      
                      {modelCapabilities.languages && modelCapabilities.languages.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>Supported Languages:</span>
                          <span style={{ fontSize: '0.875rem', color: theme.colors.text, fontWeight: 500 }}>
                            {modelCapabilities.languages.length} languages
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Accessibility information */}
                <div>
                  <h4
                    style={{
                      margin: '0 0 1rem 0',
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: theme.colors.primary,
                    }}
                  >
                    Accessibility Features
                  </h4>
                  
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                      border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      borderRadius: '8px',
                    }}
                  >
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.25rem',
                        fontSize: '0.875rem',
                        color: theme.colors.textSecondary,
                        lineHeight: 1.6,
                      }}
                    >
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: theme.colors.text }}>Keyboard Navigation:</strong> Full interface accessibility via keyboard
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: theme.colors.text }}>Screen Reader:</strong> ARIA labels and descriptions throughout
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: theme.colors.text }}>Focus Management:</strong> Proper focus handling and visual indicators
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: theme.colors.text }}>Color Contrast:</strong> Theme-aware colors for optimal readability
                      </li>
                      <li>
                        <strong style={{ color: theme.colors.text }}>Help Access:</strong> Context-sensitive help via ? key from any location
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${theme.colors.secondary}`,
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.02)' 
              : 'rgba(0, 0, 0, 0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8125rem',
            color: theme.colors.textSecondary,
          }}
        >
          <div>
            Press <kbd style={{ 
              padding: '0.125rem 0.25rem', 
              backgroundColor: theme.mode === 'dark' ? '#374151' : '#f3f4f6',
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}>Escape</kbd> to close
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>🐸 Coqui TTS Frontend</span>
            <span>Press <kbd style={{ 
              padding: '0.125rem 0.25rem', 
              backgroundColor: theme.mode === 'dark' ? '#374151' : '#f3f4f6',
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}>?</kbd> anytime for help</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Export =====

export default HelpOverlay;