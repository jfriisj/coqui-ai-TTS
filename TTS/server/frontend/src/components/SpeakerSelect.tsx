/**
 * SpeakerSelect Component for Coqui TTS Frontend
 * 
 * Speaker selection interface with preview audio generation for multi-speaker
 * TTS models. Provides dropdown selection with audio preview capabilities
 * and seamless integration with the TTS synthesis system.
 * 
 * Features:
 * - Speaker dropdown with enhanced speaker information
 * - Preview audio generation for selected speakers
 * - Loading states during preview generation
 * - Error handling for preview failures
 * - Theme-aware styling with accessibility support
 * - Real-time speaker information updates
 * - Audio playback controls with volume and replay
 * 
 * Requirements:
 * - 2.1: Speaker selection dropdown with preview audio
 * 
 * Leverages:
 * - Model service speaker data from task 8
 * - TTS service for preview audio generation from task 7
 * - Audio context for playback management
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getModelSpeakers, SpeakerInfo } from '../services/modelService';
import { ttsService, EnhancedSynthesisRequest } from '../services/ttsService';

// ===== Constants =====

/**
 * Preview audio configuration
 */
const PREVIEW_CONFIG = {
  /** Default preview text for speaker demonstration */
  DEFAULT_TEXT: "Hello, this is a preview of my voice. I hope you like what you hear!",
  /** Preview audio format */
  FORMAT: 'wav' as const,
  /** Preview generation timeout in milliseconds */
  TIMEOUT: 10000,
  /** Maximum concurrent preview generations */
  MAX_CONCURRENT: 1,
} as const;

/**
 * UI interaction states
 */
const PREVIEW_STATES = {
  IDLE: 'idle',
  GENERATING: 'generating',
  READY: 'ready',
  PLAYING: 'playing',
  ERROR: 'error',
} as const;

type PreviewState = typeof PREVIEW_STATES[keyof typeof PREVIEW_STATES];

/**
 * Speaker selection states
 */
const SELECTION_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  EMPTY: 'empty',
} as const;

type SelectionState = typeof SELECTION_STATES[keyof typeof SELECTION_STATES];

// ===== Types =====

/**
 * Speaker preview information
 */
interface SpeakerPreview {
  /** Speaker ID */
  speakerId: string;
  /** Preview audio blob */
  audioBlob: Blob | null;
  /** Preview state */
  state: PreviewState;
  /** Error message if preview failed */
  error: string | null;
  /** Preview generation timestamp */
  timestamp: number;
}

/**
 * Speaker selection component state
 */
interface SpeakerSelectState {
  /** Available speakers */
  speakers: SpeakerInfo[];
  /** Currently selected speaker ID */
  selectedSpeakerId: string | null;
  /** Speaker selection state */
  selectionState: SelectionState;
  /** Speaker previews cache */
  previews: Map<string, SpeakerPreview>;
  /** Currently playing preview */
  playingPreview: string | null;
  /** Loading error message */
  error: string | null;
}

/**
 * SpeakerSelect component props
 */
export interface SpeakerSelectProps {
  /** Currently selected speaker ID */
  initialSelectedSpeaker?: string | null;
  /** Callback when speaker selection changes */
  onSpeakerChange?: (speakerId: string | null, speakerInfo: SpeakerInfo | null) => void;
  /** Whether speaker selection is enabled */
  enabled?: boolean;
  /** Whether to show preview audio controls */
  showPreview?: boolean;
  /** Custom preview text for audio generation */
  previewText?: string;
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Generate speaker display name with metadata
 */
function getSpeakerDisplayName(speaker: SpeakerInfo): string {
  let displayName = speaker.name;
  
  if (speaker.description) {
    displayName += ` (${speaker.description})`;
  } else if (speaker.language) {
    displayName += ` (${speaker.language})`;
  }
  
  if (speaker.gender) {
    const genderIcon = speaker.gender === 'male' ? '♂' : speaker.gender === 'female' ? '♀' : '⚲';
    displayName = `${genderIcon} ${displayName}`;
  }
  
  return displayName;
}

/**
 * Get preview button text based on state
 */
function getPreviewButtonText(state: PreviewState): string {
  switch (state) {
    case PREVIEW_STATES.IDLE:
      return 'Preview';
    case PREVIEW_STATES.GENERATING:
      return 'Generating...';
    case PREVIEW_STATES.READY:
      return 'Play Preview';
    case PREVIEW_STATES.PLAYING:
      return 'Playing...';
    case PREVIEW_STATES.ERROR:
      return 'Retry Preview';
    default:
      return 'Preview';
  }
}

/**
 * Get speaker option styling based on selection state
 */
function getSpeakerOptionStyle(isSelected: boolean, theme: any): React.CSSProperties {
  return {
    padding: '0.75rem 1rem',
    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
    color: isSelected ? '#ffffff' : theme.colors.text,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    borderBottom: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
  };
}

// ===== SpeakerSelect Component =====

/**
 * SpeakerSelect component with preview audio capabilities
 * 
 * Provides speaker selection dropdown with integrated preview audio
 * generation for multi-speaker TTS models.
 */
export function SpeakerSelect({
  initialSelectedSpeaker = null,
  onSpeakerChange,
  enabled = true,
  showPreview = true,
  previewText = PREVIEW_CONFIG.DEFAULT_TEXT,
  className = "",
}: SpeakerSelectProps): JSX.Element | null {
  const { theme } = useTheme();
  
  const [selectState, setSelectState] = useState<SpeakerSelectState>({
    speakers: [],
    selectedSpeakerId: initialSelectedSpeaker,
    selectionState: SELECTION_STATES.LOADING,
    previews: new Map(),
    playingPreview: null,
    error: null,
  });
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const styleId = 'speaker-select-spin-animation';
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
   * Load available speakers from model service
   */
  const loadSpeakers = useCallback(async () => {
    setSelectState(prev => ({
      ...prev,
      selectionState: SELECTION_STATES.LOADING,
      error: null,
    }));
    
    try {
      const speakersResponse = await getModelSpeakers({ force: true });
      
      if (speakersResponse.success) {
        const speakers = speakersResponse.data;
        
        setSelectState(prev => ({
          ...prev,
          speakers,
          selectionState: speakers.length > 0 ? SELECTION_STATES.READY : SELECTION_STATES.EMPTY,
          selectedSpeakerId: initialSelectedSpeaker || (speakers.length > 0 ? speakers[0].id : null),
        }));
        
        // Notify parent of initial selection if no speaker was pre-selected
        if (!initialSelectedSpeaker && speakers.length > 0) {
          onSpeakerChange?.(speakers[0].id, speakers[0]);
        }
      } else {
        setSelectState(prev => ({
          ...prev,
          selectionState: SELECTION_STATES.ERROR,
          error: speakersResponse.error.error || 'Failed to load speakers',
        }));
      }
    } catch (error: any) {
      setSelectState(prev => ({
        ...prev,
        selectionState: SELECTION_STATES.ERROR,
        error: error.message || 'Failed to load speakers',
      }));
    }
  }, [initialSelectedSpeaker, onSpeakerChange]);
  
  /**
   * Handle speaker selection change
   */
  const handleSpeakerChange = useCallback((speakerId: string) => {
    const speaker = selectState.speakers.find(s => s.id === speakerId) || null;
    
    setSelectState(prev => ({
      ...prev,
      selectedSpeakerId: speakerId,
    }));
    
    setIsDropdownOpen(false);
    onSpeakerChange?.(speakerId, speaker);
  }, [selectState.speakers, onSpeakerChange]);
  
  /**
   * Generate preview audio for a speaker
   */
  const generatePreview = useCallback(async (speakerId: string) => {
    // Update preview state to generating
    setSelectState(prev => ({
      ...prev,
      previews: new Map(prev.previews).set(speakerId, {
        speakerId,
        audioBlob: null,
        state: PREVIEW_STATES.GENERATING,
        error: null,
        timestamp: Date.now(),
      }),
    }));
    
    try {
      // Prepare synthesis request for preview
      const request: EnhancedSynthesisRequest = {
        text: previewText,
        speakerId: speakerId,
        format: PREVIEW_CONFIG.FORMAT,
        trackProgress: false, // No progress tracking for previews
      };
      
      // Generate preview audio
      const result = await ttsService.synthesize(request);
      
      if (result.success) {
        // Update preview with generated audio
        setSelectState(prev => ({
          ...prev,
          previews: new Map(prev.previews).set(speakerId, {
            speakerId,
            audioBlob: result.data.audio.audio,
            state: PREVIEW_STATES.READY,
            error: null,
            timestamp: Date.now(),
          }),
        }));
      } else {
        // Update preview with error
        setSelectState(prev => ({
          ...prev,
          previews: new Map(prev.previews).set(speakerId, {
            speakerId,
            audioBlob: null,
            state: PREVIEW_STATES.ERROR,
            error: result.error.error || 'Preview generation failed',
            timestamp: Date.now(),
          }),
        }));
      }
    } catch (error: any) {
      // Update preview with error
      setSelectState(prev => ({
        ...prev,
        previews: new Map(prev.previews).set(speakerId, {
          speakerId,
          audioBlob: null,
          state: PREVIEW_STATES.ERROR,
          error: error.message || 'Preview generation failed',
          timestamp: Date.now(),
        }),
      }));
    }
  }, [previewText]);

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (selectState.playingPreview) {
        const preview = selectState.previews.get(selectState.playingPreview);
        if (preview) {
            setSelectState(prev => ({
                ...prev,
                previews: new Map(prev.previews).set(selectState.playingPreview!, {
                    ...preview,
                    state: PREVIEW_STATES.READY,
                }),
                playingPreview: null,
            }));
        }
    }
  }, [selectState.playingPreview, selectState.previews]);
  
  /**
   * Play preview audio for a speaker
   */
  const playPreview = useCallback(async (speakerId: string) => {
    const preview = selectState.previews.get(speakerId);
    
    if (!preview || !preview.audioBlob) {
      // Generate preview if not available
      await generatePreview(speakerId);
      return;
    }
    
    stopPreview();
    
    // Update preview state to playing
    setSelectState(prev => ({
      ...prev,
      previews: new Map(prev.previews).set(speakerId, {
        ...preview,
        state: PREVIEW_STATES.PLAYING,
      }),
      playingPreview: speakerId,
    }));
    
    const audio = new Audio(URL.createObjectURL(preview.audioBlob));
    previewAudioRef.current = audio;
    audio.play();

    audio.onended = () => {
        stopPreview();
    };
    audio.onerror = () => {
        setSelectState(prev => ({
            ...prev,
            previews: new Map(prev.previews).set(speakerId, {
                ...preview,
                state: PREVIEW_STATES.ERROR,
                error: 'Playback failed',
            }),
            playingPreview: null,
        }));
    }
  }, [selectState.previews, generatePreview, stopPreview]);
  
  /**
   * Handle preview button click
   */
  const handlePreviewClick = useCallback(async (speakerId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent dropdown from closing
    
    const preview = selectState.previews.get(speakerId);
    
    if (!preview || preview.state === PREVIEW_STATES.IDLE || preview.state === PREVIEW_STATES.ERROR) {
      await generatePreview(speakerId);
    } else if (preview.state === PREVIEW_STATES.READY) {
      await playPreview(speakerId);
    } else if (preview.state === PREVIEW_STATES.PLAYING) {
      stopPreview();
    }
  }, [selectState.previews, generatePreview, playPreview, stopPreview]);
  
  /**
   * Handle clicks outside dropdown to close it
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  }, []);
  
  /**
   * Load speakers on component mount
   */
  useEffect(() => {
    loadSpeakers();
  }, [loadSpeakers]);
  
  /**
   * Setup click outside handler
   */
  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, handleClickOutside]);
  
  // Calculate component state
  const { speakers, selectedSpeakerId, selectionState, error } = selectState;
  const selectedSpeakerInfo = speakers.find(s => s.id === selectedSpeakerId);
  const hasMultipleSpeakers = speakers.length > 1;
  const isLoading = selectionState === SELECTION_STATES.LOADING;
  const hasError = selectionState === SELECTION_STATES.ERROR;
  const isEmpty = selectionState === SELECTION_STATES.EMPTY;
  
  // Don't render if model doesn't support multiple speakers or only has default speaker
  if (isEmpty || !hasMultipleSpeakers || (speakers.length === 1 && speakers[0].id === 'default')) {
    return null; // Return null instead of hidden div for better React rendering
  }
  
  return (
    <div 
      className={`speaker-select ${className}`}
      style={{
        width: '100%',
        marginBottom: '1rem',
      }}
    >
      {/* Label */}
      <label 
        htmlFor="speaker-select-dropdown"
        style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: theme.colors.text,
          marginBottom: '0.5rem',
        }}
      >
        Speaker Selection
      </label>
      
      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '6px',
            color: theme.colors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
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
          <span>Loading speakers...</span>
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
          role="alert"
        >
          <strong>Error:</strong> {error}
          <button
            onClick={loadSpeakers}
            style={{
              marginLeft: '0.5rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Speaker Selection Dropdown */}
      {selectionState === SELECTION_STATES.READY && (
        <div
          ref={dropdownRef}
          className="speaker-dropdown"
          style={{
            position: 'relative',
            width: '100%',
          }}
        >
          {/* Dropdown Button */}
          <button
            id="speaker-select-dropdown"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={!enabled}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-describedby="speaker-select-description"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.secondary}`,
              borderRadius: '6px',
              color: theme.colors.text,
              cursor: enabled ? 'pointer' : 'not-allowed',
              opacity: enabled ? 1 : 0.6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.secondary;
            }}
          >
            <span style={{ textAlign: 'left' }}>
              {selectedSpeakerInfo 
                ? getSpeakerDisplayName(selectedSpeakerInfo)
                : 'Select a speaker...'
              }
            </span>
            
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          
          {/* Dropdown Options */}
          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Available speakers"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                marginTop: '4px',
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '6px',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: theme.mode === 'dark' 
                  ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
                  : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              }}
            >
              {speakers.map((speaker) => {
                const isSelected = speaker.id === selectedSpeakerId;
                const preview = selectState.previews.get(speaker.id);
                
                return (
                  <div
                    key={speaker.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSpeakerChange(speaker.id)}
                    style={{
                      ...getSpeakerOptionStyle(isSelected, theme),
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = theme.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.05)' 
                          : 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: isSelected ? 600 : 400 }}>
                        {getSpeakerDisplayName(speaker)}
                      </div>
                      {speaker.description && (
                        <div style={{
                          fontSize: '0.75rem',
                          opacity: 0.8,
                          marginTop: '0.25rem',
                        }}>
                          {speaker.description}
                        </div>
                      )}
                    </div>
                    
                    {/* Preview Button */}
                    {showPreview && (
                      <button
                        onClick={(e) => handlePreviewClick(speaker.id, e)}
                        disabled={!enabled || (preview?.state === PREVIEW_STATES.GENERATING)}
                        aria-label={`Preview ${speaker.name} voice`}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: preview?.state === PREVIEW_STATES.PLAYING 
                            ? '#ef4444' : theme.colors.primary,
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ffffff',
                          cursor: enabled ? 'pointer' : 'not-allowed',
                          fontSize: '0.75rem',
                          opacity: enabled && preview?.state !== PREVIEW_STATES.GENERATING ? 1 : 0.6,
                          minWidth: '80px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {preview?.state === PREVIEW_STATES.GENERATING && (
                          <div
                            style={{
                              width: '0.75rem',
                              height: '0.75rem',
                              border: '1px solid transparent',
                              borderTop: '1px solid #ffffff',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        )}
                        <span>{getPreviewButtonText(preview?.state || PREVIEW_STATES.IDLE)}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Description */}
      <div
        id="speaker-select-description"
        style={{
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
          marginTop: '0.5rem',
        }}
      >
        {hasMultipleSpeakers 
          ? `Choose from ${speakers.length} available speakers. ${showPreview ? 'Click Preview to hear each voice.' : ''}`
          : 'Single speaker model - no selection needed.'
        }
      </div>
    </div>
  );
}

// ===== Export =====

export default SpeakerSelect;

