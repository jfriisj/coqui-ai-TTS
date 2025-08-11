/**
 * AudioComparison Component for Coqui TTS Frontend
 * 
 * Advanced audio comparison interface for side-by-side analysis of multiple
 * generated audio files. Provides individual and synchronized playback controls,
 * parameter comparison, and comprehensive history management.
 * 
 * Features:
 * - Side-by-side audio player layout for comparison
 * - Individual audio controls with waveform visualization
 * - Synchronized playback for simultaneous comparison
 * - Text and parameter display for each generation
 * - Audio history management with selection capabilities
 * - Comparison controls (play both, individual controls)
 * - Theme-aware responsive design with accessibility support
 * 
 * Requirements:
 * - 1.6: Side-by-side audio comparison with play controls
 * 
 * Leverages:
 * - Audio context history from task 5 for state management
 * - AudioPlayer component for individual playback
 * - Comparison state management from audio context
 * - Theme context for consistent styling
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio, useAudioComparison } from '../contexts/AudioContext';
import AudioPlayer from './AudioPlayer';

// ===== Constants =====

/**
 * Comparison view configuration
 */
const COMPARISON_CONFIG = {
  /** Maximum number of audio files to compare simultaneously */
  MAX_COMPARISONS: 4,
  /** Minimum history items to show comparison option */
  MIN_HISTORY_FOR_COMPARISON: 2,
  /** History item preview text length */
  PREVIEW_TEXT_LENGTH: 60,
  /** Parameter display limit */
  MAX_DISPLAYED_PARAMS: 5,
} as const;

/**
 * Comparison view modes
 */
const COMPARISON_MODES = {
  SELECT: 'select',
  COMPARE: 'compare',
} as const;

type ComparisonMode = typeof COMPARISON_MODES[keyof typeof COMPARISON_MODES];

// ===== Types =====

/**
 * AudioComparison component props
 */
export interface AudioComparisonProps {
  /** Additional CSS class name */
  className?: string;
  /** Callback when comparison mode changes */
  onModeChange?: (mode: ComparisonMode) => void;
  /** Callback when audio selections change */
  onSelectionChange?: (selectedIds: string[]) => void;
}

/**
 * Audio parameter display item
 */
interface ParameterDisplayItem {
  key: string;
  value: string | number | boolean;
  label: string;
}

// ===== Helper Functions =====

/**
 * Format parameter value for display
 */
function formatParameterValue(key: string, value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return key.includes('rate') || key.includes('speed') 
      ? `${value}x` 
      : key.includes('temperature') || key.includes('length')
      ? value.toFixed(2)
      : value.toString();
  }
  if (typeof value === 'string' && value.length > 20) {
    return `${value.substring(0, 20)}...`;
  }
  return String(value || 'N/A');
}

/**
 * Get parameter label from key
 */
function getParameterLabel(key: string): string {
  const labelMap: Record<string, string> = {
    'model_name': 'Model',
    'speaker_id': 'Speaker',
    'language': 'Language',
    'speed': 'Speed',
    'temperature': 'Temperature',
    'length_penalty': 'Length Penalty',
    'repetition_penalty': 'Repetition Penalty',
    'top_k': 'Top K',
    'top_p': 'Top P',
    'voice_dir': 'Voice Directory',
    'file_path': 'Reference File',
  };
  
  return labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Extract displayable parameters from synthesis request
 */
function extractDisplayParameters(parameters: any): ParameterDisplayItem[] {
  const items: ParameterDisplayItem[] = [];
  
  // Define parameter priority order
  const priorityKeys = ['model_name', 'speaker_id', 'language', 'speed', 'temperature'];
  const excludeKeys = ['text', 'file_format', 'sample_rate']; // Already shown elsewhere
  
  // Add priority parameters first
  priorityKeys.forEach(key => {
    if (parameters[key] !== undefined && parameters[key] !== null) {
      items.push({
        key,
        value: parameters[key],
        label: getParameterLabel(key),
      });
    }
  });
  
  // Add remaining parameters
  Object.entries(parameters).forEach(([key, value]) => {
    if (!priorityKeys.includes(key) && !excludeKeys.includes(key) && 
        value !== undefined && value !== null && value !== '' &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      items.push({
        key,
        value,
        label: getParameterLabel(key),
      });
    }
  });
  
  return items.slice(0, COMPARISON_CONFIG.MAX_DISPLAYED_PARAMS);
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return timestamp.toLocaleDateString();
}

// ===== AudioComparison Component =====

/**
 * AudioComparison component for side-by-side audio analysis
 * 
 * Provides comprehensive comparison interface with history selection,
 * synchronized playback, and parameter analysis capabilities.
 */
export function AudioComparison({
  className = "",
  onModeChange,
  onSelectionChange,
}: AudioComparisonProps): JSX.Element {
  const { theme } = useTheme();
  const { audioHistory, clearAudioHistory } = useAudio();
  const {
    compareRecords,
    isComparing,
    startComparison,
    stopComparison,
    playComparisonSync,
    pauseComparisonSync,
  } = useAudioComparison();

  // Component state
  const [mode, setMode] = useState<ComparisonMode>(COMPARISON_MODES.SELECT);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  // Memoized values
  const canStartComparison = useMemo(() => {
    return audioHistory.length >= COMPARISON_CONFIG.MIN_HISTORY_FOR_COMPARISON &&
           selectedIds.length >= 2 &&
           selectedIds.length <= COMPARISON_CONFIG.MAX_COMPARISONS;
  }, [audioHistory.length, selectedIds.length]);

  /**
   * Toggle audio selection for comparison
   */
  const toggleAudioSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : prev.length < COMPARISON_CONFIG.MAX_COMPARISONS
        ? [...prev, id]
        : prev;
      
      onSelectionChange?.(newSelection);
      return newSelection;
    });
  }, [onSelectionChange]);

  /**
   * Start comparison mode with selected audio files
   */
  const handleStartComparison = useCallback(() => {
    if (canStartComparison) {
      startComparison(selectedIds);
      setMode(COMPARISON_MODES.COMPARE);
      onModeChange?.(COMPARISON_MODES.COMPARE);
    }
  }, [canStartComparison, selectedIds, startComparison, onModeChange]);

  /**
   * Exit comparison mode
   */
  const handleExitComparison = useCallback(() => {
    stopComparison();
    setMode(COMPARISON_MODES.SELECT);
    setSelectedIds([]);
    setActiveAudioId(null);
    onModeChange?.(COMPARISON_MODES.SELECT);
    onSelectionChange?.([]);
  }, [stopComparison, onModeChange, onSelectionChange]);

  /**
   * Handle synchronized playback
   */
  const handleSyncedPlayback = useCallback(async () => {
    if (isComparing) {
      await playComparisonSync();
    }
  }, [isComparing, playComparisonSync]);

  /**
   * Handle synchronized pause
   */
  const handleSyncedPause = useCallback(() => {
    if (isComparing) {
      pauseComparisonSync();
    }
  }, [isComparing, pauseComparisonSync]);

  /**
   * Clear all selected items
   */
  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  /**
   * Update mode when comparison state changes
   */
  useEffect(() => {
    if (isComparing && mode !== COMPARISON_MODES.COMPARE) {
      setMode(COMPARISON_MODES.COMPARE);
      onModeChange?.(COMPARISON_MODES.COMPARE);
    } else if (!isComparing && mode !== COMPARISON_MODES.SELECT) {
      setMode(COMPARISON_MODES.SELECT);
      onModeChange?.(COMPARISON_MODES.SELECT);
    }
  }, [isComparing, mode, onModeChange]);

  return (
    <div
      className={`audio-comparison ${className}`}
      style={{
        width: '100%',
        padding: '1.5rem',
        backgroundColor: theme.colors.background,
        borderRadius: '12px',
        border: `1px solid ${theme.colors.secondary}`,
        boxShadow: theme.mode === 'dark'
          ? '0 4px 12px rgba(0, 0, 0, 0.3)'
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div
        className="comparison-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: `1px solid ${theme.colors.secondary}`,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '0.25rem',
            }}
          >
            Audio Comparison
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: theme.colors.textSecondary,
            }}
          >
            {mode === COMPARISON_MODES.SELECT
              ? 'Select 2-4 audio files to compare side by side'
              : `Comparing ${compareRecords.length} audio files`}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {mode === COMPARISON_MODES.SELECT ? (
            <>
              {selectedIds.length > 0 && (
                <button
                  onClick={handleClearSelection}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.secondary}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Clear ({selectedIds.length})
                </button>
              )}
              <button
                onClick={handleStartComparison}
                disabled={!canStartComparison}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: canStartComparison ? theme.colors.primary : theme.colors.secondary,
                  color: canStartComparison ? '#ffffff' : theme.colors.textSecondary,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: canStartComparison ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                }}
              >
                Compare Selected
              </button>
            </>
          ) : (
            <button
              onClick={handleExitComparison}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.secondary}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ← Back to Selection
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === COMPARISON_MODES.SELECT ? (
        /* Selection Mode */
        <div className="selection-mode">
          {audioHistory.length === 0 ? (
            <div
              className="empty-state"
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: theme.colors.textSecondary,
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text }}>
                No Audio History
              </h3>
              <p style={{ margin: 0 }}>
                Generate some audio files first to use the comparison feature.
              </p>
            </div>
          ) : audioHistory.length < COMPARISON_CONFIG.MIN_HISTORY_FOR_COMPARISON ? (
            <div
              className="insufficient-history"
              style={{
                textAlign: 'center',
                padding: '3rem',
                color: theme.colors.textSecondary,
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text }}>
                Need More Audio Files
              </h3>
              <p style={{ margin: 0 }}>
                Generate at least {COMPARISON_CONFIG.MIN_HISTORY_FOR_COMPARISON} audio files to enable comparison.
                Currently: {audioHistory.length} file{audioHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          ) : (
            /* History Selection Grid */
            <div
              className="history-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1rem',
              }}
            >
              {audioHistory.map((record) => {
                const isSelected = selectedIds.includes(record.id);
                const parameters = extractDisplayParameters(record.parameters);
                
                return (
                  <div
                    key={record.id}
                    className="history-item"
                    onClick={() => toggleAudioSelection(record.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.secondary}`,
                      backgroundColor: isSelected 
                        ? `${theme.colors.primary}15` 
                        : theme.colors.surface,
                      cursor: selectedIds.length < COMPARISON_CONFIG.MAX_COMPARISONS || isSelected 
                        ? 'pointer' 
                        : 'not-allowed',
                      opacity: selectedIds.length >= COMPARISON_CONFIG.MAX_COMPARISONS && !isSelected 
                        ? 0.5 
                        : 1,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.primary,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        ✓
                      </div>
                    )}
                    
                    {/* Text Preview */}
                    <div
                      style={{
                        fontWeight: 500,
                        color: theme.colors.text,
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.4',
                        paddingRight: isSelected ? '2rem' : 0,
                      }}
                    >
                      "{record.text.substring(0, COMPARISON_CONFIG.PREVIEW_TEXT_LENGTH)}{record.text.length > COMPARISON_CONFIG.PREVIEW_TEXT_LENGTH ? '...' : ''}"
                    </div>
                    
                    {/* Timestamp */}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: theme.colors.textSecondary,
                        marginBottom: '0.75rem',
                      }}
                    >
                      {formatTimestamp(record.timestamp)}
                    </div>
                    
                    {/* Parameters */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.25rem',
                      }}
                    >
                      {parameters.map((param) => (
                        <span
                          key={param.key}
                          style={{
                            padding: '0.125rem 0.5rem',
                            fontSize: '0.75rem',
                            backgroundColor: theme.mode === 'dark' 
                              ? 'rgba(255, 255, 255, 0.1)' 
                              : 'rgba(0, 0, 0, 0.05)',
                            borderRadius: '12px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {param.label}: {formatParameterValue(param.key, param.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Comparison Mode */
        <div className="comparison-mode">
          {/* Synchronized Controls */}
          <div
            className="sync-controls"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: theme.colors.surface,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.secondary}`,
            }}
          >
            <button
              onClick={handleSyncedPlayback}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              ▶️ Play All Synchronized
            </button>
            <button
              onClick={handleSyncedPause}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.secondary}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
            >
              ⏸️ Pause All
            </button>
          </div>
          
          {/* Audio Players Grid */}
          <div
            className="comparison-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: compareRecords.length === 2 
                ? '1fr 1fr' 
                : compareRecords.length === 3
                ? '1fr 1fr 1fr'
                : '1fr 1fr 1fr 1fr',
              gap: '1rem',
            }}
          >
            {compareRecords.map((record, index) => (
              <div
                key={record.id}
                className="comparison-item"
                style={{
                  position: 'relative',
                }}
              >
                {/* Comparison Index */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-0.5rem',
                    left: '1rem',
                    backgroundColor: theme.colors.primary,
                    color: '#ffffff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    zIndex: 10,
                  }}
                >
                  Audio {String.fromCharCode(65 + index)}
                </div>
                
                {/* Audio Player */}
                <AudioPlayer
                  audioRecord={record}
                  isActive={activeAudioId === record.id}
                  showWaveform={true}
                  showControls={true}
                  enableKeyboardShortcuts={activeAudioId === record.id}
                  onPlaybackStateChange={() => {}}
                  onSeek={() => {}}
                  className="comparison-player"
                />
                
                {/* Parameter Comparison */}
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: theme.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '0.5rem',
                    }}
                  >
                    Parameters
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {extractDisplayParameters(record.parameters).map((param) => (
                      <div
                        key={param.key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        <span>{param.label}:</span>
                        <span style={{ fontWeight: 500, color: theme.colors.text }}>
                          {formatParameterValue(param.key, param.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* History Management */}
      {audioHistory.length > 0 && (
        <div
          className="history-actions"
          style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: `1px solid ${theme.colors.secondary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              color: theme.colors.textSecondary,
            }}
          >
            {audioHistory.length} audio file{audioHistory.length !== 1 ? 's' : ''} in history
          </div>
          <button
            onClick={clearAudioHistory}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid #ef4444`,
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default AudioComparison;