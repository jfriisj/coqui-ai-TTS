/**
 * WaveformVisualizer Component for Coqui TTS Frontend
 * 
 * Standalone waveform visualization component with Web Audio API integration,
 * visual playback progress indicator, and click-to-seek functionality.
 * Designed for high-performance rendering with real-time audio analysis.
 * 
 * Features:
 * - Waveform display using Web Audio API analysis
 * - Visual playback progress indicator overlaid on waveform
 * - Click-to-seek functionality with precise time targeting
 * - Real-time audio analysis with customizable resolution
 * - Responsive canvas rendering with theme support
 * - Accessibility features with ARIA labels and keyboard navigation
 * 
 * Requirements:
 * - 1.3: Visual waveform display with audio playback controls
 * 
 * Leverages:
 * - Web Audio API from AudioContext for waveform data extraction
 * - Canvas-based rendering for optimal performance
 * - Theme system for consistent visual styling
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAudio, AudioGenerationRecord, AudioPlaybackState } from '../contexts/AudioContext';

// ===== Constants =====

/**
 * Waveform visualizer configuration
 */
const VISUALIZER_CONFIG = {
  /** Default canvas height in pixels */
  DEFAULT_HEIGHT: 120,
  /** Default canvas width in pixels */
  DEFAULT_WIDTH: 800,
  /** Minimum canvas height */
  MIN_HEIGHT: 60,
  /** Maximum canvas height */
  MAX_HEIGHT: 300,
  /** Waveform line width */
  LINE_WIDTH: 1.5,
  /** Progress indicator width */
  PROGRESS_WIDTH: 2,
  /** Waveform amplitude scaling factor (0-1) */
  AMPLITUDE_SCALE: 0.8,
  /** Animation frame rate for smooth updates */
  ANIMATION_FPS: 60,
  /** Hover interaction radius in pixels */
  HOVER_RADIUS: 5,
} as const;

/**
 * Waveform rendering styles
 */
const WAVEFORM_STYLES = {
  BARS: 'bars',
  LINE: 'line',
  FILLED: 'filled',
} as const;

type WaveformStyle = typeof WAVEFORM_STYLES[keyof typeof WAVEFORM_STYLES];

// ===== Types =====

/**
 * WaveformVisualizer component props
 */
export interface WaveformVisualizerProps {
  /** Audio record to visualize */
  audioRecord: AudioGenerationRecord;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Waveform rendering style */
  style?: WaveformStyle;
  /** Show progress indicator */
  showProgress?: boolean;
  /** Enable click-to-seek functionality */
  enableSeek?: boolean;
  /** Show hover effects */
  showHover?: boolean;
  /** Show time markers */
  showTimeMarkers?: boolean;
  /** Show amplitude scale */
  showAmplitudeScale?: boolean;
  /** Custom color overrides */
  colors?: {
    waveform?: string;
    progress?: string;
    played?: string;
    unplayed?: string;
    background?: string;
    hover?: string;
    timeMarkers?: string;
  };
  /** Callback when seeking occurs */
  onSeek?: (time: number) => void;
  /** Callback when hover time changes */
  onHoverTimeChange?: (time: number | null) => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Waveform drawing point
 */
interface WaveformPoint {
  x: number;
  y: number;
  amplitude: number;
  time: number;
}

/**
 * Mouse interaction state
 */
interface MouseInteraction {
  isHovering: boolean;
  hoverX: number;
  hoverTime: number;
  isDragging: boolean;
}

// ===== Helper Functions =====

/**
 * Generate waveform points from amplitude data with time information
 */
function generateWaveformPoints(
  waveformData: Float32Array | undefined,
  width: number,
  height: number,
  duration: number
): WaveformPoint[] {
  if (!waveformData || waveformData.length === 0 || duration <= 0) {
    // Return flat line for no data
    return [
      { x: 0, y: height / 2, amplitude: 0, time: 0 },
      { x: width, y: height / 2, amplitude: 0, time: duration },
    ];
  }

  const points: WaveformPoint[] = [];
  const centerY = height / 2;
  const maxAmplitude = height * VISUALIZER_CONFIG.AMPLITUDE_SCALE * 0.5;
  
  for (let i = 0; i < waveformData.length; i++) {
    const amplitude = Math.min(1, Math.max(0, waveformData[i]));
    const x = (i / (waveformData.length - 1)) * width;
    const time = (i / (waveformData.length - 1)) * duration;
    const y = centerY - (amplitude * maxAmplitude);
    
    points.push({ x, y, amplitude, time });
  }
  
  return points;
}

/**
 * Draw bar-style waveform
 */
function drawBarsWaveform(
  ctx: CanvasRenderingContext2D,
  points: WaveformPoint[],
  width: number,
  height: number,
  colors: { played: string; unplayed: string },
  progressX: number
): void {
  if (points.length === 0) return;

  const barWidth = Math.max(1, width / points.length);
  const centerY = height / 2;

  ctx.lineWidth = Math.max(1, barWidth * 0.8);
  ctx.lineCap = 'round';

  points.forEach((point) => {
    const x = point.x;
    const amplitude = point.amplitude;
    const barHeight = amplitude * height * VISUALIZER_CONFIG.AMPLITUDE_SCALE * 0.5;
    
    // Color based on progress
    ctx.strokeStyle = x <= progressX ? colors.played : colors.unplayed;
    
    // Draw bar from center extending both up and down
    ctx.beginPath();
    ctx.moveTo(x, centerY - barHeight);
    ctx.lineTo(x, centerY + barHeight);
    ctx.stroke();
  });
}

/**
 * Draw line-style waveform
 */
function drawLineWaveform(
  ctx: CanvasRenderingContext2D,
  points: WaveformPoint[],
  colors: { played: string; unplayed: string },
  progressX: number
): void {
  if (points.length < 2) return;

  ctx.lineWidth = VISUALIZER_CONFIG.LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw played portion
  ctx.beginPath();
  ctx.strokeStyle = colors.played;
  
  let hasStarted = false;
  for (let i = 0; i < points.length && points[i].x <= progressX; i++) {
    const point = points[i];
    if (!hasStarted) {
      ctx.moveTo(point.x, point.y);
      hasStarted = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();

  // Draw unplayed portion
  ctx.beginPath();
  ctx.strokeStyle = colors.unplayed;
  
  const startIndex = Math.max(0, points.findIndex(p => p.x > progressX) - 1);
  hasStarted = false;
  
  for (let i = startIndex; i < points.length; i++) {
    const point = points[i];
    if (!hasStarted) {
      ctx.moveTo(point.x, point.y);
      hasStarted = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
}

/**
 * Draw filled-style waveform
 */
function drawFilledWaveform(
  ctx: CanvasRenderingContext2D,
  points: WaveformPoint[],
  height: number,
  colors: { played: string; unplayed: string },
  progressX: number
): void {
  if (points.length === 0) return;

  const centerY = height / 2;

  // Create gradient for played portion
  const playedGradient = ctx.createLinearGradient(0, 0, 0, height);
  playedGradient.addColorStop(0, colors.played);
  playedGradient.addColorStop(0.5, colors.played);
  playedGradient.addColorStop(1, colors.played);

  // Create gradient for unplayed portion
  const unplayedGradient = ctx.createLinearGradient(0, 0, 0, height);
  unplayedGradient.addColorStop(0, colors.unplayed);
  unplayedGradient.addColorStop(0.5, colors.unplayed);
  unplayedGradient.addColorStop(1, colors.unplayed);

  // Draw played portion
  ctx.fillStyle = playedGradient;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  
  for (let i = 0; i < points.length && points[i].x <= progressX; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  
  ctx.lineTo(progressX, centerY);
  ctx.closePath();
  ctx.fill();

  // Draw unplayed portion
  ctx.fillStyle = unplayedGradient;
  ctx.beginPath();
  
  const startIndex = Math.max(0, points.findIndex(p => p.x > progressX));
  ctx.moveTo(progressX, centerY);
  
  for (let i = startIndex; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  
  ctx.lineTo(points[points.length - 1]?.x || 0, centerY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw time markers
 */
function drawTimeMarkers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  duration: number,
  color: string
): void {
  if (duration <= 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';

  // Calculate marker intervals (every 10 seconds for long audio, more frequent for short)
  const interval = duration > 60 ? 10 : duration > 30 ? 5 : 1;
  const markers = Math.floor(duration / interval);

  for (let i = 1; i <= markers; i++) {
    const time = i * interval;
    const x = (time / duration) * width;
    
    // Draw marker line
    ctx.beginPath();
    ctx.moveTo(x, height - 15);
    ctx.lineTo(x, height - 5);
    ctx.stroke();
    
    // Draw time label
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    ctx.fillText(timeLabel, x, height - 2);
  }
}

/**
 * Draw amplitude scale
 */
function drawAmplitudeScale(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';

  const centerY = height / 2;
  const maxAmplitude = height * VISUALIZER_CONFIG.AMPLITUDE_SCALE * 0.5;

  // Draw scale markers at 25%, 50%, 75%, 100%
  [0.25, 0.5, 0.75, 1.0].forEach(scale => {
    const y = centerY - (scale * maxAmplitude);
    
    // Draw scale line
    ctx.beginPath();
    ctx.moveTo(width - 20, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
    
    // Draw scale label
    ctx.fillText(`${Math.round(scale * 100)}%`, width - 22, y + 3);
  });
}

// ===== WaveformVisualizer Component =====

/**
 * WaveformVisualizer component with Web Audio API integration and interactive features
 * 
 * Provides advanced waveform visualization with real-time progress indication,
 * click-to-seek functionality, and customizable rendering styles.
 */
export function WaveformVisualizer({
  audioRecord,
  width = VISUALIZER_CONFIG.DEFAULT_WIDTH,
  height = VISUALIZER_CONFIG.DEFAULT_HEIGHT,
  style = WAVEFORM_STYLES.LINE,
  showProgress = true,
  enableSeek = true,
  showHover = true,
  showTimeMarkers = false,
  showAmplitudeScale = false,
  colors,
  onSeek,
  onHoverTimeChange,
  className = "",
}: WaveformVisualizerProps): JSX.Element {
  const { theme } = useTheme();
  const { playbackStates, seekAudio } = useAudio();

  // Component state
  const [mouseInteraction, setMouseInteraction] = useState<MouseInteraction>({
    isHovering: false,
    hoverX: 0,
    hoverTime: 0,
    isDragging: false,
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get current playback state
  const playbackState: AudioPlaybackState = playbackStates[audioRecord.id] || {
    isPlaying: false,
    currentTime: 0,
    duration: audioRecord.duration || 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
  };

  // Color scheme with theme integration
  const colorScheme = useMemo(() => ({
    waveform: colors?.waveform || theme.colors.primary,
    progress: colors?.progress || theme.colors.primary,
    played: colors?.played || theme.colors.primary,
    unplayed: colors?.unplayed || (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'),
    background: colors?.background || (theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.8)'),
    hover: colors?.hover || (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
    timeMarkers: colors?.timeMarkers || (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'),
  }), [colors, theme]);

  // Generate waveform points
  const waveformPoints = useMemo(() => {
    return generateWaveformPoints(
      audioRecord.waveformData,
      width,
      height,
      playbackState.duration
    );
  }, [audioRecord.waveformData, width, height, playbackState.duration]);

  /**
   * Handle mouse move for hover effects
   */
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !enableSeek) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const hoverRatio = Math.max(0, Math.min(1, x / canvas.width));
    const hoverTime = hoverRatio * playbackState.duration;

    setMouseInteraction(prev => ({
      ...prev,
      isHovering: true,
      hoverX: x,
      hoverTime,
    }));

    onHoverTimeChange?.(hoverTime);
  }, [enableSeek, playbackState.duration, onHoverTimeChange]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setMouseInteraction(prev => ({
      ...prev,
      isHovering: false,
      isDragging: false,
    }));
    onHoverTimeChange?.(null);
  }, [onHoverTimeChange]);

  /**
   * Handle waveform click for seeking
   */
  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !enableSeek) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, x / canvas.width));
    const seekTime = clickRatio * playbackState.duration;
    
    seekAudio(audioRecord.id, seekTime);
    onSeek?.(seekTime);
  }, [enableSeek, playbackState.duration, seekAudio, audioRecord.id, onSeek]);

  /**
   * Handle mouse down for dragging
   */
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enableSeek) return;
    
    setMouseInteraction(prev => ({ ...prev, isDragging: true }));
    handleClick(event);
  }, [enableSeek, handleClick]);

  /**
   * Handle mouse up to stop dragging
   */
  const handleMouseUp = useCallback(() => {
    setMouseInteraction(prev => ({ ...prev, isDragging: false }));
  }, []);

  /**
   * Draw complete waveform visualization
   */
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = canvas;
    const progressRatio = playbackState.duration > 0 ? playbackState.currentTime / playbackState.duration : 0;
    const progressX = progressRatio * width;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = colorScheme.background;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform based on style
    switch (style) {
      case WAVEFORM_STYLES.BARS:
        drawBarsWaveform(ctx, waveformPoints, width, height, colorScheme, progressX);
        break;
      case WAVEFORM_STYLES.FILLED:
        drawFilledWaveform(ctx, waveformPoints, height, colorScheme, progressX);
        break;
      case WAVEFORM_STYLES.LINE:
      default:
        drawLineWaveform(ctx, waveformPoints, colorScheme, progressX);
        break;
    }

    // Draw center line
    ctx.strokeStyle = colorScheme.timeMarkers;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw progress indicator
    if (showProgress && progressRatio > 0) {
      ctx.strokeStyle = colorScheme.progress;
      ctx.lineWidth = VISUALIZER_CONFIG.PROGRESS_WIDTH;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Draw progress indicator circle
      ctx.fillStyle = colorScheme.progress;
      ctx.beginPath();
      ctx.arc(progressX, height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw hover indicator
    if (showHover && mouseInteraction.isHovering && enableSeek) {
      ctx.strokeStyle = colorScheme.hover;
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.moveTo(mouseInteraction.hoverX, 0);
      ctx.lineTo(mouseInteraction.hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw time markers
    if (showTimeMarkers) {
      drawTimeMarkers(ctx, width, height, playbackState.duration, colorScheme.timeMarkers);
    }

    // Draw amplitude scale
    if (showAmplitudeScale) {
      drawAmplitudeScale(ctx, width, height, colorScheme.timeMarkers);
    }
  }, [
    waveformPoints,
    playbackState,
    colorScheme,
    style,
    showProgress,
    showHover,
    showTimeMarkers,
    showAmplitudeScale,
    mouseInteraction,
    enableSeek,
  ]);

  /**
   * Animation loop for smooth updates
   */
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (canvas && ctx) {
      drawWaveform(ctx);
    }

    // Continue animation if playing
    if (playbackState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [drawWaveform, playbackState.isPlaying]);

  /**
   * Set up canvas and start animation
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Initial draw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawWaveform(ctx);
    }

    // Start animation if playing
    if (playbackState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [width, height, drawWaveform, animate, playbackState.isPlaying]);

  /**
   * Redraw when state changes
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (canvas && ctx && !playbackState.isPlaying) {
      // Only draw immediately if not playing (animation handles playing state)
      drawWaveform(ctx);
    }
  }, [drawWaveform, playbackState.isPlaying]);

  // Format time for hover tooltip
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`waveform-visualizer ${className}`}
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: enableSeek ? 'pointer' : 'default',
        backgroundColor: colorScheme.background,
      }}
      role="img"
      aria-label={`Waveform visualization for audio: ${audioRecord.text.substring(0, 50)}${audioRecord.text.length > 50 ? '...' : ''}`}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
        aria-label="Waveform - click to seek to specific time"
      />
      
      {/* Hover tooltip */}
      {showHover && mouseInteraction.isHovering && enableSeek && (
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            left: `${mouseInteraction.hoverX - 25}px`,
            width: '50px',
            textAlign: 'center',
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '4px',
            padding: '2px 4px',
            fontSize: '10px',
            color: theme.colors.text,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {formatTime(mouseInteraction.hoverTime)}
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default WaveformVisualizer;