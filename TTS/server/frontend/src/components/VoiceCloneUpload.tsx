/**
 * VoiceCloneUpload Component for Coqui TTS Frontend
 * 
 * A comprehensive file upload component for voice cloning with drag-and-drop
 * support, file validation, and processing feedback. Validates audio files
 * for format, size, and duration constraints with real-time feedback.
 * 
 * Features:
 * - Drag-and-drop file upload with visual feedback
 * - File format validation (WAV, MP3, FLAC, OGG)
 * - File size and duration validation with feedback
 * - Upload progress indicators and processing status
 * - Audio preview and file metadata display
 * - Theme-aware styling with light/dark mode support
 * - Accessibility features (ARIA labels, keyboard navigation)
 * 
 * Requirements:
 * - 2.3: Voice cloning audio upload with format validation
 * - 2.4: File validation with quality feedback and processing status
 * 
 * Leverages TTS service audio validation from task 7.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { validateCloningAudio, type AudioFileValidation } from '../services/ttsService';

// ===== Constants =====

/**
 * Supported file types for voice cloning upload
 */
const ACCEPTED_FILE_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/ogg',
  '.wav',
  '.mp3',
  '.flac',
  '.ogg',
];

/**
 * File size display thresholds
 */
const SIZE_THRESHOLDS = {
  KB: 1024,
  MB: 1024 * 1024,
} as const;

// ===== Types =====

/**
 * Upload state for tracking file processing
 */
type UploadState = 'idle' | 'dragover' | 'validating' | 'valid' | 'invalid' | 'processing';

/**
 * File metadata for display
 */
interface FileMetadata {
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** File type/format */
  type: string;
  /** Duration in seconds (if available) */
  duration?: number;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * VoiceCloneUpload component props
 */
export interface VoiceCloneUploadProps {
  /** Current uploaded file (if any) */
  file: File | null;
  /** Callback fired when file changes */
  onFileChange: (file: File | null) => void;
  /** Whether the upload is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Whether to show audio preview */
  showPreview?: boolean;
  /** Upload progress (0-100) for processing feedback */
  uploadProgress?: number;
  /** Processing status message */
  processingStatus?: string;
}

// ===== Helper Functions =====

/**
 * Format file size for human-readable display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  if (bytes < SIZE_THRESHOLDS.KB) {
    return `${bytes} B`;
  } else if (bytes < SIZE_THRESHOLDS.MB) {
    return `${(bytes / SIZE_THRESHOLDS.KB).toFixed(1)} KB`;
  } else {
    return `${(bytes / SIZE_THRESHOLDS.MB).toFixed(1)} MB`;
  }
}

/**
 * Format duration for human-readable display
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Extract file metadata for display
 */
function getFileMetadata(file: File): FileMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type || file.name.split('.').pop()?.toLowerCase() || 'unknown',
    lastModified: file.lastModified,
  };
}

/**
 * Get upload state styling
 */
function getStateStyles(state: UploadState, theme: any, disabled: boolean) {
  if (disabled) {
    return {
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.surface,
      opacity: 0.6,
      cursor: 'not-allowed',
    };
  }

  const baseStyles = {
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };

  switch (state) {
    case 'dragover':
      return {
        ...baseStyles,
        borderColor: theme.colors.primary,
        backgroundColor: `${theme.colors.primary}10`,
        transform: 'scale(1.02)',
      };
    case 'validating':
    case 'processing':
      return {
        ...baseStyles,
        borderColor: '#f59e0b',
        backgroundColor: theme.colors.surface,
      };
    case 'valid':
      return {
        ...baseStyles,
        borderColor: '#10b981',
        backgroundColor: `#10b98110`,
      };
    case 'invalid':
      return {
        ...baseStyles,
        borderColor: '#ef4444',
        backgroundColor: `#ef444410`,
      };
    default:
      return {
        ...baseStyles,
        borderColor: theme.colors.secondary,
        backgroundColor: theme.colors.surface,
      };
  }
}

// ===== VoiceCloneUpload Component =====

/**
 * VoiceCloneUpload component with drag-and-drop and validation
 * 
 * Provides a file upload interface for voice cloning with comprehensive
 * validation, progress tracking, and quality feedback.
 */
export function VoiceCloneUpload({
  file,
  onFileChange,
  disabled = false,
  className = "",
  showPreview = true,
  uploadProgress,
  processingStatus,
}: VoiceCloneUploadProps): JSX.Element {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [validation, setValidation] = useState<AudioFileValidation | null>(null);
  const [_dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    const styleId = 'voice-clone-upload-spin-animation';
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

  // Update upload state based on file and validation
  useEffect(() => {
    if (uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100) {
      setUploadState('processing');
    } else if (!file) {
      setUploadState('idle');
    } else if (validation) {
      setUploadState(validation.isValid ? 'valid' : 'invalid');
    }
  }, [file, validation, uploadProgress]);

  /**
   * Validate uploaded file
   */
  const validateFile = useCallback(async (uploadedFile: File) => {
    setUploadState('validating');
    
    try {
      const result = await validateCloningAudio(uploadedFile);
      setValidation(result);
    } catch (error) {
      setValidation({
        isValid: false,
        format: uploadedFile.name.split('.').pop()?.toLowerCase() || 'unknown',
        size: uploadedFile.size,
        errors: ['Failed to validate audio file'],
        feedback: [],
      });
    }
  }, []);

  /**
   * Handle file selection (from input or drop)
   */
  const handleFileSelection = useCallback(async (selectedFile: File) => {
    if (disabled) return;

    onFileChange(selectedFile);
    await validateFile(selectedFile);
  }, [disabled, onFileChange, validateFile]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  }, [handleFileSelection]);

  /**
   * Handle file removal
   */
  const handleRemoveFile = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onFileChange(null);
    setValidation(null);
    setUploadState('idle');
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileChange]);

  /**
   * Handle click to open file dialog
   */
  const handleClick = useCallback(() => {
    if (disabled || uploadState === 'processing') return;
    fileInputRef.current?.click();
  }, [disabled, uploadState]);

  /**
   * Drag and drop handlers
   */
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (disabled) return;
    
    setDragCounter(prev => prev + 1);
    if (uploadState !== 'processing') {
      setUploadState('dragover');
    }
  }, [disabled, uploadState]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0 && uploadState === 'dragover') {
        setUploadState(file ? (validation?.isValid ? 'valid' : 'invalid') : 'idle');
      }
      return newCount;
    });
  }, [file, validation, uploadState]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setDragCounter(0);
    
    if (disabled) return;

    const droppedFiles = Array.from(event.dataTransfer.files);
    const audioFile = droppedFiles.find(file => file.type.startsWith('audio/') || 
      ACCEPTED_FILE_TYPES.some(type => file.name.toLowerCase().endsWith(type.replace('.', ''))));
    
    if (audioFile) {
      handleFileSelection(audioFile);
    } else {
      setUploadState('invalid');
      setValidation({
        isValid: false,
        format: 'unknown',
        size: 0,
        errors: ['Please drop a valid audio file (WAV, MP3, FLAC, or OGG)'],
        feedback: [],
      });
    }
  }, [disabled, handleFileSelection]);

  // Get current file metadata
  const fileMetadata = file ? getFileMetadata(file) : null;
  const stateStyles = getStateStyles(uploadState, theme, disabled);

  return (
    <div 
      className={`voice-clone-upload ${className}`}
      style={{
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-label="Select audio file for voice cloning"
      />

      {/* Upload Area */}
      <div
        className="upload-area"
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={file ? `Selected: ${file.name}. Click to change file.` : "Click or drag to upload audio file for voice cloning"}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            handleClick();
          }
        }}
        style={{
          ...stateStyles,
          border: `2px dashed ${stateStyles.borderColor}`,
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center' as const,
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          position: 'relative',
        }}
      >
        {/* Upload Icon and Text */}
        {!file && (
          <>
            <div style={{ fontSize: '3rem', color: theme.colors.textSecondary }}>
              🎵
            </div>
            <div>
              <h3 style={{ 
                margin: 0, 
                marginBottom: '0.5rem',
                color: theme.colors.text,
                fontSize: '1.25rem',
                fontWeight: 600,
              }}>
                Upload Reference Audio
              </h3>
              <p style={{ 
                margin: 0,
                color: theme.colors.textSecondary,
                fontSize: '1rem',
                lineHeight: '1.5',
              }}>
                Drop your audio file here or click to browse
              </p>
              <p style={{ 
                margin: '0.5rem 0 0 0',
                color: theme.colors.textSecondary,
                fontSize: '0.875rem',
              }}>
                Supports WAV, MP3, FLAC, OGG (max 10MB)
              </p>
            </div>
          </>
        )}

        {/* File Information */}
        {file && fileMetadata && (
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {/* File Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}>
              <div style={{ fontSize: '2rem' }}>
                🎵
              </div>
              <button
                onClick={handleRemoveFile}
                disabled={disabled || uploadState === 'processing'}
                aria-label="Remove selected file"
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  padding: '0.25rem',
                  borderRadius: '4px',
                  fontSize: '1.5rem',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    (e.target as HTMLButtonElement).style.color = '#ef4444';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.color = theme.colors.textSecondary;
                }}
              >
                ✕
              </button>
            </div>

            {/* File Details */}
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ 
                margin: '0 0 0.5rem 0',
                color: theme.colors.text,
                fontSize: '1rem',
                fontWeight: 600,
                wordBreak: 'break-word' as const,
              }}>
                {fileMetadata.name}
              </h4>
              
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: theme.colors.textSecondary,
              }}>
                <div>
                  <strong>Size:</strong> {formatFileSize(fileMetadata.size)}
                </div>
                <div>
                  <strong>Format:</strong> {validation?.format || fileMetadata.type}
                </div>
                {validation?.duration && (
                  <>
                    <div>
                      <strong>Duration:</strong> {formatDuration(validation.duration)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing Progress */}
        {uploadState === 'processing' && uploadProgress !== undefined && (
          <div style={{ width: '100%', maxWidth: '400px', marginTop: '1rem' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: theme.colors.secondary + '40',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '0.5rem',
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: theme.colors.primary,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: theme.colors.text,
              textAlign: 'center' as const,
            }}>
              {processingStatus || `Processing... ${uploadProgress}%`}
            </div>
          </div>
        )}

        {/* Validation State Indicator */}
        {uploadState === 'validating' && (
          <div style={{
            fontSize: '0.875rem',
            color: theme.colors.text,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{ 
              display: 'inline-block',
              width: '16px',
              height: '16px',
              border: `2px solid ${theme.colors.primary}`,
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Validating audio file...
          </div>
        )}
      </div>

      {/* Validation Feedback */}
      {validation && (
        <div style={{ marginTop: '1rem' }}>
          {/* Errors */}
          {validation.errors.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              {validation.errors.map((error, index) => (
                <div
                  key={index}
                  style={{
                    color: '#ef4444',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  role="alert"
                  aria-live="polite"
                >
                  <span>⚠️</span>
                  {error}
                </div>
              ))}
            </div>
          )}

          {/* Quality Feedback */}
          {validation.feedback.length > 0 && (
            <div>
              {validation.feedback.map((feedback, index) => (
                <div
                  key={index}
                  style={{
                    color: validation.isValid ? '#10b981' : theme.colors.textSecondary,
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>{validation.isValid ? '✅' : 'ℹ️'}</span>
                  {feedback}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio Preview */}
      {showPreview && file && validation?.isValid && (
        <div style={{ marginTop: '1rem' }}>
          <audio
            controls
            style={{
              width: '100%',
              maxWidth: '400px',
            }}
            preload="metadata"
          >
            <source src={URL.createObjectURL(file)} type={file.type} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default VoiceCloneUpload;