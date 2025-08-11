/**
 * DownloadControls Component for Coqui TTS Frontend
 * 
 * Single-click download controls for generated audio files with automatic
 * filename generation and browser compatibility handling. Provides download
 * functionality for WAV files with informative naming and proper error handling.
 * 
 * Features:
 * - Single-click WAV file download from generated audio URLs
 * - Automatic filename generation with text snippet and timestamp
 * - Browser download compatibility handling (anchor element method)
 * - Visual download button with theme-aware styling
 * - Error handling for download failures
 * - Accessibility features (ARIA labels, keyboard support)
 * 
 * Requirements:
 * - 1.5: Single-click WAV file download functionality
 * 
 * Leverages:
 * - Generated audio URLs from Flask server
 * - Browser download APIs via anchor element
 * - Theme context for consistent styling
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { AudioGenerationRecord } from '../contexts/AudioContext';

// ===== Constants =====

/**
 * Download configuration settings
 */
const DOWNLOAD_CONFIG = {
  /** Maximum text length to include in filename */
  MAX_FILENAME_TEXT_LENGTH: 30,
  /** File extension for downloaded files */
  FILE_EXTENSION: 'wav',
  /** Prefix for download filenames */
  FILENAME_PREFIX: 'coqui-tts',
  /** Characters to remove/replace in filenames */
  INVALID_FILENAME_CHARS: /[<>:"/\\|?*\x00-\x1f]/g,
} as const;

/**
 * Download states for UI feedback
 */
const DOWNLOAD_STATES = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

type DownloadState = typeof DOWNLOAD_STATES[keyof typeof DOWNLOAD_STATES];

// ===== Types =====

/**
 * DownloadControls component props
 */
export interface DownloadControlsProps {
  /** Audio record to download */
  audioRecord: AudioGenerationRecord;
  /** Show download button */
  showButton?: boolean;
  /** Button size variant */
  size?: 'small' | 'medium' | 'large';
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Callback when download starts */
  onDownloadStart?: (audioRecord: AudioGenerationRecord) => void;
  /** Callback when download completes successfully */
  onDownloadSuccess?: (audioRecord: AudioGenerationRecord, filename: string) => void;
  /** Callback when download fails */
  onDownloadError?: (audioRecord: AudioGenerationRecord, error: string) => void;
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Generate a safe filename for the downloaded audio file
 */
function generateDownloadFilename(audioRecord: AudioGenerationRecord): string {
  // Extract a clean text snippet
  const cleanText = audioRecord.text
    .substring(0, DOWNLOAD_CONFIG.MAX_FILENAME_TEXT_LENGTH)
    .replace(DOWNLOAD_CONFIG.INVALID_FILENAME_CHARS, '_')
    .trim()
    .replace(/\s+/g, '_');

  // Generate timestamp
  const timestamp = audioRecord.timestamp.toISOString()
    .replace(/[:.]/g, '-')
    .substring(0, 19); // Remove milliseconds and 'Z'

  // Combine parts
  const baseFilename = `${DOWNLOAD_CONFIG.FILENAME_PREFIX}_${cleanText}_${timestamp}`;
  return `${baseFilename}.${DOWNLOAD_CONFIG.FILE_EXTENSION}`;
}

/**
 * Download file using browser anchor element method
 */
async function downloadFile(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create temporary anchor element
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';

      // Add to DOM, click, and remove
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Resolve immediately as we can't detect completion with this method
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Download failed'));
    }
  });
}

// ===== DownloadControls Component =====

/**
 * DownloadControls component for single-click WAV file download
 * 
 * Provides download functionality for generated audio files with automatic
 * filename generation and proper error handling.
 */
export function DownloadControls({
  audioRecord,
  showButton = true,
  size = 'medium',
  variant = 'secondary',
  onDownloadStart,
  onDownloadSuccess,
  onDownloadError,
  className = "",
}: DownloadControlsProps): JSX.Element {
  const { theme } = useTheme();
  const [downloadState, setDownloadState] = useState<DownloadState>(DOWNLOAD_STATES.IDLE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const styleId = 'spin-animation';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.innerHTML = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  /**
   * Handle download initiation
   */
  const handleDownload = useCallback(async () => {
    try {
      setDownloadState(DOWNLOAD_STATES.DOWNLOADING);
      setError(null);

      // Generate filename
      const filename = generateDownloadFilename(audioRecord);

      // Notify start callback
      onDownloadStart?.(audioRecord);

      // Initiate download
      await downloadFile(audioRecord.audioUrl, filename);

      // Update state and notify success
      setDownloadState(DOWNLOAD_STATES.SUCCESS);
      onDownloadSuccess?.(audioRecord, filename);

      // Reset state after brief success indicator
      setTimeout(() => {
        setDownloadState(DOWNLOAD_STATES.IDLE);
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      setError(errorMessage);
      setDownloadState(DOWNLOAD_STATES.ERROR);
      onDownloadError?.(audioRecord, errorMessage);

      // Reset error state after delay
      setTimeout(() => {
        setDownloadState(DOWNLOAD_STATES.IDLE);
        setError(null);
      }, 3000);
    }
  }, [audioRecord, onDownloadStart, onDownloadSuccess, onDownloadError]);

  /**
   * Get button styles based on variant and size
   */
  const getButtonStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      borderRadius: '6px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      cursor: downloadState === DOWNLOAD_STATES.DOWNLOADING ? 'wait' : 'pointer',
      textDecoration: 'none',
      border: 'none',
    };

    // Size variants
    const sizeStyles = {
      small: {
        padding: '0.375rem 0.75rem',
        fontSize: '0.875rem',
        minHeight: '32px',
      },
      medium: {
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        minHeight: '36px',
      },
      large: {
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
        minHeight: '44px',
      },
    };

    // Variant styles
    let variantStyles: React.CSSProperties = {};
    
    switch (variant) {
      case 'primary':
        variantStyles = {
          backgroundColor: theme.colors.primary,
          color: '#ffffff',
          border: `1px solid ${theme.colors.primary}`,
        };
        break;
      case 'secondary':
        variantStyles = {
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.secondary}`,
        };
        break;
      case 'outline':
        variantStyles = {
          backgroundColor: 'transparent',
          color: theme.colors.primary,
          border: `1px solid ${theme.colors.primary}`,
        };
        break;
    }

    // State-based modifications
    if (downloadState === DOWNLOAD_STATES.DOWNLOADING) {
      variantStyles.opacity = 0.7;
    } else if (downloadState === DOWNLOAD_STATES.SUCCESS) {
      variantStyles.backgroundColor = '#10b981'; // Success green
      variantStyles.color = '#ffffff';
      variantStyles.border = '1px solid #10b981';
    } else if (downloadState === DOWNLOAD_STATES.ERROR) {
      variantStyles.backgroundColor = '#ef4444'; // Error red
      variantStyles.color = '#ffffff';
      variantStyles.border = '1px solid #ef4444';
    }

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles,
    };
  };

  /**
   * Get button content based on current state
   */
  const getButtonContent = (): React.ReactNode => {
    switch (downloadState) {
      case DOWNLOAD_STATES.DOWNLOADING:
        return (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            Downloading...
          </>
        );
      case DOWNLOAD_STATES.SUCCESS:
        return (
          <>
            ✅ Downloaded
          </>
        );
      case DOWNLOAD_STATES.ERROR:
        return (
          <>
            ❌ Failed
          </>
        );
      default:
        return (
          <>
            📥 Download WAV
          </>
        );
    }
  };

  /**
   * Get ARIA label for accessibility
   */
  const getAriaLabel = (): string => {
    const baseText = audioRecord.text.substring(0, 50);
    const textSuffix = audioRecord.text.length > 50 ? '...' : '';
    
    switch (downloadState) {
      case DOWNLOAD_STATES.DOWNLOADING:
        return `Downloading audio for: ${baseText}${textSuffix}`;
      case DOWNLOAD_STATES.SUCCESS:
        return `Successfully downloaded audio for: ${baseText}${textSuffix}`;
      case DOWNLOAD_STATES.ERROR:
        return `Failed to download audio for: ${baseText}${textSuffix}. Click to retry.`;
      default:
        return `Download WAV audio file for: ${baseText}${textSuffix}`;
    }
  };

  if (!showButton) {
    return <></>;
  }

  return (
    <div
      className={`download-controls ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={downloadState === DOWNLOAD_STATES.DOWNLOADING}
        style={getButtonStyles()}
        aria-label={getAriaLabel()}
        title={getAriaLabel()}
      >
        {getButtonContent()}
      </button>

      {/* Error Message */}
      {error && downloadState === DOWNLOAD_STATES.ERROR && (
        <div
          className="error-message"
          style={{
            padding: '0.5rem',
            backgroundColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
            border: `1px solid ${theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'}`,
            borderRadius: '4px',
            color: theme.mode === 'dark' ? '#fca5a5' : '#dc2626',
            fontSize: '0.75rem',
            lineHeight: '1.25',
          }}
          role="alert"
          aria-live="assertive"
        >
          <strong>Download Error:</strong> {error}
        </div>
      )}

      {/* Download Info */}
      <div
        className="download-info"
        style={{
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span>Format: WAV</span>
        {audioRecord.duration && (
          <span>Duration: {Math.round(audioRecord.duration)}s</span>
        )}
        <span>Generated: {audioRecord.timestamp.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ===== Export =====

export default DownloadControls;
