/**
 * AudioPlayer Component for Coqui TTS Frontend
 * 
 * Advanced audio playback component with waveform visualization, keyboard controls,
 * and comprehensive playback state management. Features play/pause/seek controls
 * with visual waveform display and keyboard shortcut support.
 * 
 * Features:
 * - Audio playback controls (play, pause, seek) with keyboard support
 * - Waveform visualization with click-to-seek functionality
 * - Audio loading from Flask-generated WAV file URLs
 * - Playback state management with real-time progress updates
 * - Error recovery and loading state handling
 * - Theme-aware styling with light/dark mode support
 * - Accessibility features (ARIA labels, keyboard navigation)
 * 
 * Requirements:
 * - 1.3: Visual waveform display with audio playback controls
 * - 3.1: Keyboard shortcuts (Space for play/pause)
 * 
 * Leverages:
 * - Audio context from task 5 for state management and waveform data
 * - Flask audio file serving for WAV file URLs
 * - Keyboard shortcuts hook for Space key handling
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio, AudioGenerationRecord, AudioPlaybackState } from '../contexts/AudioContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// ===== Constants =====

/**
 * Audio player configuration
 */
const PLAYER_CONFIG = {
  /** Waveform canvas height in pixels */
  WAVEFORM_HEIGHT: 80,
  /** Waveform samples for visualization */
  WAVEFORM_SAMPLES: 1000,
  /** Progress update interval in milliseconds */
  PROGRESS_UPDATE_INTERVAL: 100,
  /** Seek sensitivity for keyboard controls */
  SEEK_STEP: 5, // seconds
  /** Volume adjustment step */
  VOLUME_STEP: 0.1,
} as const;

/**
 * Player states for UI feedback
 */
const PLAYER_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error',
} as const;

type PlayerState = typeof PLAYER_STATES[keyof typeof PLAYER_STATES];

// ===== Types =====

/**
 * AudioPlayer component props
 */
export interface AudioPlayerProps {
  /** Audio record to play */
  audioRecord: AudioGenerationRecord;
  /** Whether player is currently active/selected */
  isActive?: boolean;
  /** Show waveform visualization */
  showWaveform?: boolean;
  /** Show playback controls */
  showControls?: boolean;
  /** Enable keyboard shortcuts when active */
  enableKeyboardShortcuts?: boolean;
  /** Callback when playback state changes */
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  /** Callback when seeking occurs */
  onSeek?: (currentTime: number) => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Waveform point for visualization
 */
interface WaveformPoint {
  x: number;
  y: number;
  amplitude: number;
}

// ===== Helper Functions =====

/**
 * Format time duration for display
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate waveform points from amplitude data
 */
function generateWaveformPoints(
  waveformData: Float32Array | undefined,
  width: number,
  height: number
): WaveformPoint[] {
  if (!waveformData || waveformData.length === 0) {
    // Return flat line for no data
    return [
      { x: 0, y: height / 2, amplitude: 0 },
      { x: width, y: height / 2, amplitude: 0 },
    ];
  }

  const points: WaveformPoint[] = [];
  const samples = Math.min(waveformData.length, PLAYER_CONFIG.WAVEFORM_SAMPLES);
  const step = waveformData.length / samples;
  
  for (let i = 0; i < samples; i++) {
    const dataIndex = Math.floor(i * step);
    const amplitude = waveformData[dataIndex] || 0;
    const x = (i / (samples - 1)) * width;
    const y = height / 2 - (amplitude * height * 0.4); // Scale to 40% of height
    
    points.push({ x, y, amplitude });
  }
  
  return points;
}

/**
 * Draw waveform on canvas
 */
function drawWaveform(
  canvas: HTMLCanvasElement,
  points: WaveformPoint[],
  currentTime: number,
  duration: number,
  theme: any
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const progressX = progressRatio * width;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Set line styles
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw waveform
  if (points.length > 1) {
    // Draw played portion
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.primary;
    
    for (let i = 0; i < points.length && points[i].x <= progressX; i++) {
      const point = points[i];
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
      // Draw mirrored waveform below centerline
      ctx.lineTo(point.x, height - point.y);
    }
    ctx.stroke();

    // Draw unplayed portion
    ctx.beginPath();
    ctx.strokeStyle = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    
    let startIndex = points.findIndex(p => p.x > progressX);
    if (startIndex === -1) startIndex = points.length - 1;
    
    for (let i = startIndex; i < points.length; i++) {
      const point = points[i];
      if (i === startIndex) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
      // Draw mirrored waveform below centerline
      ctx.lineTo(point.x, height - point.y);
    }
    ctx.stroke();
  }

  // Draw center line
  ctx.beginPath();
  ctx.strokeStyle = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Draw progress indicator
  if (progressRatio > 0) {
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.primary;
    ctx.lineWidth = 2;
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();
  }
}

// ===== AudioPlayer Component =====

/**
 * AudioPlayer component with waveform visualization and playback controls
 * 
 * Provides audio playback interface with visual waveform display, keyboard shortcuts,
 * and comprehensive state management.
 */
export function AudioPlayer({
  audioRecord,
  isActive = false,
  showWaveform = true,
  showControls = true,
  enableKeyboardShortcuts = true,
  onPlaybackStateChange,
  onSeek,
  className = "",
}: AudioPlayerProps): JSX.Element {
  const { theme } = useTheme();
  const {
    playbackStates,
    playAudio,
    pauseAudio,
    stopAudio,
    seekAudio,
    setVolume,
  } = useAudio();

  // Component state
  const [playerState, setPlayerState] = useState<PlayerState>(PLAYER_STATES.READY);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current playback state
  const playbackState: AudioPlaybackState = playbackStates[audioRecord.id] || {
    isPlaying: false,
    currentTime: 0,
    duration: audioRecord.duration || 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
  };

  // Generate waveform points
  const waveformPoints = useMemo(() => {
    if (!showWaveform || !canvasRef.current) return [];
    
    const canvas = canvasRef.current;
    return generateWaveformPoints(
      audioRecord.waveformData,
      canvas.width,
      canvas.height
    );
  }, [audioRecord.waveformData, showWaveform, canvasRef.current?.width, canvasRef.current?.height]);

  /**
   * Toggle play/pause (Requirement 3.1: Space key support)
   */
  const togglePlayback = useCallback(async () => {
    try {
      if (playbackState.isPlaying) {
        pauseAudio(audioRecord.id);
        setPlayerState(PLAYER_STATES.PAUSED);
      } else {
        await playAudio(audioRecord.id);
        setPlayerState(PLAYER_STATES.PLAYING);
      }
      
      onPlaybackStateChange?.(playbackState.isPlaying);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Playback failed');
      setPlayerState(PLAYER_STATES.ERROR);
    }
  }, [audioRecord.id, playbackState.isPlaying, playAudio, pauseAudio, onPlaybackStateChange]);

  /**
   * Stop playback
   */
  const stopPlayback = useCallback(() => {
    stopAudio(audioRecord.id);
    setPlayerState(PLAYER_STATES.READY);
    onPlaybackStateChange?.(false);
  }, [audioRecord.id, stopAudio, onPlaybackStateChange]);

  /**
   * Seek to specific time position
   */
  const seekToTime = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, playbackState.duration));
    seekAudio(audioRecord.id, clampedTime);
    onSeek?.(clampedTime);
  }, [audioRecord.id, playbackState.duration, seekAudio, onSeek]);

  /**
   * Handle waveform click for seeking
   */
  const handleWaveformClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickRatio = x / canvas.width;
    const seekTime = clickRatio * playbackState.duration;
    
    seekToTime(seekTime);
  }, [playbackState.duration, seekToTime]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(audioRecord.id, clampedVolume);
  }, [audioRecord.id, setVolume]);

  /**
   * Keyboard shortcuts (Requirement 3.1)
   */
  useKeyboardShortcuts({
    onTogglePlayback: enableKeyboardShortcuts && isActive ? togglePlayback : undefined,
    customShortcuts: enableKeyboardShortcuts && isActive ? [
      {
        keys: 'arrowleft',
        description: 'Seek backward 5 seconds',
        handler: () => seekToTime(playbackState.currentTime - PLAYER_CONFIG.SEEK_STEP),
        preventDefault: true,
      },
      {
        keys: 'arrowright',
        description: 'Seek forward 5 seconds',
        handler: () => seekToTime(playbackState.currentTime + PLAYER_CONFIG.SEEK_STEP),
        preventDefault: true,
      },
      {
        keys: 'arrowup',
        description: 'Increase volume',
        handler: () => handleVolumeChange(playbackState.volume + PLAYER_CONFIG.VOLUME_STEP),
        preventDefault: true,
      },
      {
        keys: 'arrowdown',
        description: 'Decrease volume',
        handler: () => handleVolumeChange(playbackState.volume - PLAYER_CONFIG.VOLUME_STEP),
        preventDefault: true,
      },
    ] : undefined,
  });

  /**
   * Update player state based on playback state
   */
  useEffect(() => {
    if (playbackState.isPlaying) {
      setPlayerState(PLAYER_STATES.PLAYING);
    } else if (playbackState.currentTime >= playbackState.duration && playbackState.duration > 0) {
      setPlayerState(PLAYER_STATES.ENDED);
    } else if (playbackState.currentTime > 0) {
      setPlayerState(PLAYER_STATES.PAUSED);
    } else {
      setPlayerState(PLAYER_STATES.READY);
    }
  }, [playbackState.isPlaying, playbackState.currentTime, playbackState.duration]);

  /**
   * Draw waveform when it updates
   */
  useEffect(() => {
    if (!showWaveform || !canvasRef.current || waveformPoints.length === 0) return;

    drawWaveform(
      canvasRef.current,
      waveformPoints,
      playbackState.currentTime,
      playbackState.duration,
      theme
    );
  }, [waveformPoints, playbackState.currentTime, playbackState.duration, theme, showWaveform]);

  /**
   * Set up canvas dimensions
   */
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = PLAYER_CONFIG.WAVEFORM_HEIGHT;
      
      // Redraw waveform after resize
      if (waveformPoints.length > 0) {
        const newPoints = generateWaveformPoints(
          audioRecord.waveformData,
          canvas.width,
          canvas.height
        );
        drawWaveform(canvas, newPoints, playbackState.currentTime, playbackState.duration, theme);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [audioRecord.waveformData, playbackState.currentTime, playbackState.duration, theme, waveformPoints.length]);

  return (
    <div
      ref={containerRef}
      className={`audio-player ${className}`}
      style={{
        width: '100%',
        padding: '1rem',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${isActive ? theme.colors.primary : theme.colors.secondary}`,
        borderRadius: '8px',
        boxShadow: isActive
          ? `0 0 0 2px ${theme.colors.primary}33`
          : theme.mode === 'dark'
          ? '0 2px 4px rgba(0, 0, 0, 0.3)'
          : '0 2px 4px rgba(0, 0, 0, 0.1)',
        outline: 'none',
        transition: 'all 0.2s ease',
      }}
      tabIndex={isActive ? 0 : -1}
      role="region"
      aria-label={`Audio player for: ${audioRecord.text.substring(0, 50)}${audioRecord.text.length > 50 ? '...' : ''}`}
    >
      {/* Audio Info */}
      <div
        className="audio-info"
        style={{
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ fontWeight: 500, color: theme.colors.text, marginBottom: '0.25rem' }}>
          "{audioRecord.text.substring(0, 100)}{audioRecord.text.length > 100 ? '...' : ''}"
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>Duration: {formatTime(playbackState.duration)}</span>
          <span>Format: {audioRecord.mimeType}</span>
          {audioRecord.parameters.speaker_id && (
            <span>Speaker: {audioRecord.parameters.speaker_id}</span>
          )}
        </div>
      </div>

      {/* Waveform Display (Requirement 1.3) */}
      {showWaveform && (
        <div
          className="waveform-container"
          style={{
            marginBottom: '1rem',
            position: 'relative',
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleWaveformClick}
            style={{
              display: 'block',
              width: '100%',
              height: `${PLAYER_CONFIG.WAVEFORM_HEIGHT}px`,
              backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
            }}
            aria-label="Audio waveform - click to seek"
            role="img"
          />
        </div>
      )}

      {/* Playback Controls */}
      {showControls && (
        <div
          className="playback-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayback}
            disabled={playerState === PLAYER_STATES.LOADING || playerState === PLAYER_STATES.ERROR}
            aria-label={playbackState.isPlaying ? 'Pause audio' : 'Play audio'}
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '50%',
              border: `2px solid ${theme.colors.primary}`,
              backgroundColor: playbackState.isPlaying ? theme.colors.primary : 'transparent',
              color: playbackState.isPlaying ? '#ffffff' : theme.colors.primary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
          >
            {playerState === PLAYER_STATES.LOADING ? '...' : playbackState.isPlaying ? '⏸️' : '▶️'}
          </button>

          {/* Stop Button */}
          <button
            onClick={stopPlayback}
            disabled={playerState === PLAYER_STATES.LOADING || playerState === PLAYER_STATES.READY}
            aria-label="Stop audio"
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.secondary}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
          >
            ⏹️
          </button>

          {/* Time Display */}
          <div
            className="time-display"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontVariantNumeric: 'tabular-nums',
              fontSize: '0.875rem',
              color: theme.colors.text,
              minWidth: '80px',
            }}
          >
            <span>{formatTime(playbackState.currentTime)}</span>
            <span style={{ color: theme.colors.textSecondary }}>|</span>
            <span>{formatTime(playbackState.duration)}</span>
          </div>

          {/* Volume Control */}
          <div
            className="volume-control"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flex: 1,
            }}
          >
            <span style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={playbackState.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume"
              style={{
                flex: 1,
                maxWidth: '100px',
              }}
            />
            <span
              style={{
                fontSize: '0.75rem',
                color: theme.colors.textSecondary,
                minWidth: '30px',
                textAlign: 'right',
              }}
            >
              {Math.round(playbackState.volume * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && playerState === PLAYER_STATES.ERROR && (
        <div
          className="error-message"
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
          role="alert"
          aria-live="assertive"
        >
          <strong>Playback Error:</strong> {error}
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {enableKeyboardShortcuts && isActive && (
        <div
          className="keyboard-hints"
          style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span>Space: Play/Pause</span>
          <span>←/→: Seek</span>
          <span>↑/↓: Volume</span>
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default AudioPlayer;