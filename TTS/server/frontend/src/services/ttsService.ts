/**
 * TTS Synthesis Service
 * 
 * Dedicated service for TTS synthesis operations with progress tracking,
 * multipart form data support for voice cloning, and endpoint handling.
 * Implements requirements 1.1, 1.2, and 2.3 from the specification.
 * 
 * Features:
 * - Text validation with character count and limits
 * - Progress tracking with estimated time remaining
 * - Voice cloning audio upload with format validation
 * - Support for multiple synthesis endpoints
 * - Real-time synthesis progress updates
 */

import {
  ApiResponse,
  AudioGeneration,
  API_ENDPOINTS,
  SynthesisRequest,
  type AudioFormat,
} from '../types/api';
import { apiClient } from './apiClient';

// Import generated OpenAPI classes for type safety
import {
  TTSRequest,
  OpenAITTSRequest,
} from '../gen/src';

// ===== Constants =====

/**
 * Text validation limits
 */
export const TEXT_LIMITS = {
  /** Maximum text length for synthesis */
  MAX_LENGTH: 1000,
  /** Recommended text length for optimal quality */
  RECOMMENDED_MAX: 500,
  /** Warning threshold for long text */
  WARNING_THRESHOLD: 300,
} as const;

/**
 * Audio file validation for voice cloning
 */
export const AUDIO_VALIDATION = {
  /** Supported audio formats for voice cloning */
  SUPPORTED_FORMATS: ['wav', 'mp3', 'flac', 'ogg'] as string[],
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Minimum file size in bytes (1KB) */
  MIN_FILE_SIZE: 1024,
  /** Recommended duration limits in seconds */
  DURATION_LIMITS: {
    min: 3,
    max: 30,
    recommended: 10,
  },
} as const;

/**
 * Progress tracking configuration
 */
export const PROGRESS_CONFIG = {
  /** Default synthesis time estimate per character (ms) */
  TIME_PER_CHAR: 50,
  /** Progress update interval during synthesis (ms) */
  UPDATE_INTERVAL: 100,
  /** Minimum estimated time for progress tracking (ms) */
  MIN_ESTIMATED_TIME: 1000,
} as const;

// ===== Types =====

/**
 * Text validation result
 */
export interface TextValidation {
  /** Whether text is valid */
  isValid: boolean;
  /** Character count */
  characterCount: number;
  /** Validation errors if any */
  errors: string[];
  /** Validation warnings if any */
  warnings: string[];
  /** Estimated synthesis time in milliseconds */
  estimatedTime: number;
}

/**
 * Audio file validation result for voice cloning
 */
export interface AudioFileValidation {
  /** Whether file is valid */
  isValid: boolean;
  /** File format */
  format: string;
  /** File size in bytes */
  size: number;
  /** Duration in seconds (if detectable) */
  duration?: number;
  /** Validation errors if any */
  errors: string[];
  /** Quality feedback messages */
  feedback: string[];
}

/**
 * Synthesis progress information
 */
export interface SynthesisProgress {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current status message */
  status: string;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining: number;
  /** Total estimated time in milliseconds */
  totalEstimatedTime: number;
  /** Whether synthesis is complete */
  isComplete: boolean;
  /** Any error that occurred */
  error?: string;
}

/**
 * Enhanced synthesis request with voice cloning support
 */
export interface EnhancedSynthesisRequest extends TTSRequest {
  /** Audio file for voice cloning */
  cloning_audio?: File;
  /** Endpoint preference for synthesis */
  endpoint?: 'legacy' | 'v1' | 'openai';
  /** Enable progress tracking */
  trackProgress?: boolean;
}

/**
 * Synthesis result with metadata
 */
export interface SynthesisResult {
  /** Generated audio */
  audio: AudioGeneration;
  /** Synthesis metadata */
  metadata: {
    /** Text that was synthesized */
    text: string;
    /** Character count */
    characterCount: number;
    /** Actual synthesis time in milliseconds */
    synthesisTime: number;
    /** Endpoint used */
    endpoint: string;
    /** Audio format */
    format: AudioFormat;
  };
}

/**
 * Progress tracking callback function
 */
export type ProgressCallback = (progress: SynthesisProgress) => void;

// ===== TTS Service Class =====

/**
 * TTS Synthesis Service
 * 
 * Handles all TTS synthesis operations with progress tracking,
 * text validation, and voice cloning support.
 */
export class TTSService {
  private progressCallbacks = new Map<string, ProgressCallback>();
  private activeRequests = new Map<string, AbortController>();

  // ===== Text Validation (Requirement 1.1) =====

  /**
   * Validate input text for synthesis
   * 
   * @param text - Text to validate
   * @returns Validation result with character count and feedback
   */
  validateText(text: string): TextValidation {
    const characterCount = text.length;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!text.trim()) {
      errors.push('Text cannot be empty');
    }

    if (characterCount > TEXT_LIMITS.MAX_LENGTH) {
      errors.push(`Text exceeds maximum length of ${TEXT_LIMITS.MAX_LENGTH} characters`);
    }

    // Warning checks
    if (characterCount > TEXT_LIMITS.WARNING_THRESHOLD) {
      warnings.push(`Text is quite long (${characterCount} chars). Consider shorter text for better quality.`);
    }

    if (characterCount > TEXT_LIMITS.RECOMMENDED_MAX) {
      warnings.push(`Text exceeds recommended length of ${TEXT_LIMITS.RECOMMENDED_MAX} characters.`);
    }

    // Check for problematic characters or patterns
    if (text.includes('\n\n\n')) {
      warnings.push('Multiple consecutive line breaks may affect speech quality.');
    }

    const specialCharCount = (text.match(/[^\w\s.,!?;:'"()-]/g) || []).length;
    if (specialCharCount > characterCount * 0.1) {
      warnings.push('High number of special characters may affect pronunciation.');
    }

    // Estimate synthesis time
    const estimatedTime = Math.max(
      characterCount * PROGRESS_CONFIG.TIME_PER_CHAR,
      PROGRESS_CONFIG.MIN_ESTIMATED_TIME
    );

    return {
      isValid: errors.length === 0,
      characterCount,
      errors,
      warnings,
      estimatedTime,
    };
  }

  // ===== Audio File Validation (Requirement 2.3) =====

  /**
   * Validate audio file for voice cloning
   * 
   * @param file - Audio file to validate
   * @returns Promise resolving to validation result
   */
  async validateAudioFile(file: File): Promise<AudioFileValidation> {
    const errors: string[] = [];
    const feedback: string[] = [];

    // Extract file extension and format
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const format = extension;

    // File format validation
    if (!AUDIO_VALIDATION.SUPPORTED_FORMATS.includes(format)) {
      errors.push(`Unsupported format: ${format}. Supported formats: ${AUDIO_VALIDATION.SUPPORTED_FORMATS.join(', ')}`);
    }

    // File size validation
    if (file.size > AUDIO_VALIDATION.MAX_FILE_SIZE) {
      errors.push(`File too large: ${Math.round(file.size / (1024 * 1024))}MB. Maximum size: ${AUDIO_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (file.size < AUDIO_VALIDATION.MIN_FILE_SIZE) {
      errors.push(`File too small: ${file.size} bytes. Minimum size: ${AUDIO_VALIDATION.MIN_FILE_SIZE} bytes`);
    }

    // Try to get audio duration using Web Audio API
    let duration: number | undefined;
    try {
      duration = await this.getAudioDuration(file);
      
      if (duration) {
        if (duration < AUDIO_VALIDATION.DURATION_LIMITS.min) {
          errors.push(`Audio too short: ${duration.toFixed(1)}s. Minimum: ${AUDIO_VALIDATION.DURATION_LIMITS.min}s`);
        }
        
        if (duration > AUDIO_VALIDATION.DURATION_LIMITS.max) {
          feedback.push(`Audio quite long: ${duration.toFixed(1)}s. Consider trimming to under ${AUDIO_VALIDATION.DURATION_LIMITS.max}s for best results.`);
        }
        
        if (duration > AUDIO_VALIDATION.DURATION_LIMITS.recommended) {
          feedback.push(`For optimal voice cloning, consider using audio around ${AUDIO_VALIDATION.DURATION_LIMITS.recommended} seconds.`);
        }
      }
    } catch (error) {
      feedback.push('Could not analyze audio duration. Ensure file is a valid audio file.');
    }

    // Quality feedback
    if (format === 'wav') {
      feedback.push('WAV format is optimal for voice cloning quality.');
    } else if (format === 'flac') {
      feedback.push('FLAC format provides good quality for voice cloning.');
    } else {
      feedback.push('For best results, consider using WAV or FLAC format.');
    }

    if (file.size < 100 * 1024) { // Less than 100KB
      feedback.push('Small file size may indicate low quality. Higher quality audio produces better voice cloning.');
    }

    return {
      isValid: errors.length === 0,
      format,
      size: file.size,
      duration,
      errors,
      feedback,
    };
  }

  /**
   * Get audio duration from file using Web Audio API
   */
  private async getAudioDuration(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      const audio = new Audio();
      
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      
      audio.onerror = () => {
        resolve(undefined);
      };
      
      // Set timeout to avoid hanging
      setTimeout(() => resolve(undefined), 3000);
      
      audio.src = URL.createObjectURL(file);
    });
  }

  // ===== Progress Tracking (Requirement 1.2) =====

  /**
   * Start progress tracking for a synthesis request
   */
  private startProgressTracking(requestId: string, estimatedTime: number, callback: ProgressCallback): void {
    let startTime = Date.now();
    let progress = 0;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min((elapsed / estimatedTime) * 90, 90); // Cap at 90% until completion
      
      const remainingTime = Math.max(estimatedTime - elapsed, 0);
      
      callback({
        progress,
        status: progress < 30 ? 'Initializing synthesis...' :
                progress < 60 ? 'Generating speech...' :
                'Finalizing audio...',
        estimatedTimeRemaining: remainingTime,
        totalEstimatedTime: estimatedTime,
        isComplete: false,
      });
      
      // Continue updating until request completes
      if (this.progressCallbacks.has(requestId) && progress < 90) {
        setTimeout(updateProgress, PROGRESS_CONFIG.UPDATE_INTERVAL);
      }
    };
    
    this.progressCallbacks.set(requestId, callback);
    updateProgress();
  }

  /**
   * Complete progress tracking
   */
  private completeProgress(requestId: string, success: boolean, error?: string): void {
    const callback = this.progressCallbacks.get(requestId);
    if (callback) {
      callback({
        progress: 100,
        status: success ? 'Synthesis complete!' : 'Synthesis failed',
        estimatedTimeRemaining: 0,
        totalEstimatedTime: 0,
        isComplete: true,
        error,
      });
      
      this.progressCallbacks.delete(requestId);
    }
  }

  // ===== Synthesis Methods =====

  /**
   * Synthesize text to speech with progress tracking and validation
   * 
   * @param request - Enhanced synthesis request
   * @param progressCallback - Optional progress callback
   * @returns Promise resolving to synthesis result
   */
  async synthesize(
    request: EnhancedSynthesisRequest,
    progressCallback?: ProgressCallback
  ): Promise<ApiResponse<SynthesisResult>> {
    const startTime = Date.now();
    const requestId = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate text (Requirement 1.1)
      const textValidation = this.validateText(request.text);
      if (!textValidation.isValid) {
        return {
          success: false,
          error: {
            error: `Text validation failed: ${textValidation.errors.join(', ')}`,
            status: 400,
          },
        };
      }

      // Validate audio file if provided (Requirement 2.3)
      if (request.cloning_audio) {
        const audioValidation = await this.validateAudioFile(request.cloning_audio);
        if (!audioValidation.isValid) {
          return {
            success: false,
            error: {
              error: `Audio validation failed: ${audioValidation.errors.join(', ')}`,
              status: 400,
            },
          };
        }
      }

      // Start progress tracking (Requirement 1.2)
      if (progressCallback && request.trackProgress !== false) {
        this.startProgressTracking(requestId, textValidation.estimatedTime, progressCallback);
      }

      // Create abort controller for request cancellation
      const abortController = new AbortController();
      this.activeRequests.set(requestId, abortController);

      // Prepare synthesis request
      const synthesisData: TTSRequest = {
        text: request.text,
        speaker: request.speaker,
        language: request.language,
        format: request.format || 'wav'
      };

      // Handle voice cloning audio upload
      let response: ApiResponse<AudioGeneration>;
      
      if (request.cloning_audio) {
        // Use multipart form data for voice cloning
        response = await this.synthesizeWithVoiceCloning(
          synthesisData,
          request.cloning_audio,
          abortController.signal
        );
      } else {
        // Use appropriate endpoint based on preference
        response = await this.synthesizeWithEndpoint(
          synthesisData,
          request.endpoint,
          abortController.signal
        );
      }

      // Clean up
      this.activeRequests.delete(requestId);
      
      if (response.success) {
        // Complete progress tracking
        if (progressCallback && request.trackProgress !== false) {
          this.completeProgress(requestId, true);
        }
        
        const synthesisTime = Date.now() - startTime;
        
        return {
          success: true,
          data: {
            audio: response.data,
            metadata: {
              text: request.text,
              characterCount: textValidation.characterCount,
              synthesisTime,
              endpoint: request.endpoint || 'v1',
              format: (request.format || 'wav') as AudioFormat,
            },
          },
        };
      } else {
        // Complete progress tracking with error
        if (progressCallback && request.trackProgress !== false) {
          this.completeProgress(requestId, false, response.error.error);
        }
        
        return response as ApiResponse<SynthesisResult>;
      }
      
    } catch (error) {
      // Clean up on error
      this.activeRequests.delete(requestId);
      if (progressCallback && request.trackProgress !== false) {
        this.completeProgress(requestId, false, error instanceof Error ? error.message : 'Unknown error');
      }
      
      return {
        success: false,
        error: {
          error: `Synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        },
      };
    }
  }

  /**
   * Synthesize with voice cloning using multipart form data
   */
  private async synthesizeWithVoiceCloning(
    request: TTSRequest,
    audioFile: File,
    signal?: AbortSignal
  ): Promise<ApiResponse<AudioGeneration>> {
    // For voice cloning, we need to handle the speaker_wav parameter differently
    // The original Flask API expects speaker_wav as a file path or file data
    
    // Use the legacy endpoint which supports speaker_wav
    const formData = new FormData();
    formData.append('text', request.text);
    
    if (request.speaker) formData.append('speaker', request.speaker);
    if (request.language) formData.append('language', request.language);
    if (request.format) formData.append('format', request.format);

    // Add the audio file for voice cloning
    formData.append('speaker_wav', audioFile);

    // Make request with FormData
    return await apiClient.makeRequest<AudioGeneration>(
      API_ENDPOINTS.TTS,
      'POST',
      formData,
      { signal }
    );
  }

  /**
   * Convert generated TTSRequest to the legacy SynthesisRequest format
   */
  private convertTTSRequestToSynthesisRequest(request: TTSRequest): SynthesisRequest {
    return {
      text: request.text,
      speaker_id: request.speakerId || request.speaker,
      language_id: request.languageId || request.language,
      format: request.format as 'wav' | 'mp3' | 'opus' | 'aac' | 'flac' | 'pcm' | undefined,
    };
  }

  /**
   * Synthesize using specified endpoint
   */
  private async synthesizeWithEndpoint(
    request: TTSRequest,
    endpoint: string = 'legacy',
    signal?: AbortSignal
  ): Promise<ApiResponse<AudioGeneration>> {
    const config = { signal };
    
    switch (endpoint) {
      case 'v1':
      case 'legacy':
      default:
        // Convert to legacy format for existing API client
        const synthesisRequest = this.convertTTSRequestToSynthesisRequest(request);
        return await apiClient.synthesizeTextV1(synthesisRequest, config);
      case 'openai':
        // Convert to OpenAI format
        const openAIRequest: OpenAITTSRequest = {
          model: 'tts-1',
          voice: request.speaker || 'default',
          input: request.text,
          responseFormat: request.format,
          speed: 1.0, // Default speed since TTSRequest doesn't have speed
        };
        return await apiClient.synthesizeOpenAI(openAIRequest, config);
    }
  }

  /**
   * Cancel an active synthesis request
   */
  cancelSynthesis(requestId?: string): void {
    if (requestId) {
      const controller = this.activeRequests.get(requestId);
      if (controller) {
        controller.abort();
        this.activeRequests.delete(requestId);
        this.completeProgress(requestId, false, 'Request cancelled by user');
      }
    } else {
      // Cancel all active requests
      for (const [id, controller] of this.activeRequests.entries()) {
        controller.abort();
        this.completeProgress(id, false, 'Request cancelled by user');
      }
      this.activeRequests.clear();
    }
  }

  /**
   * Get current synthesis statistics
   */
  getStatistics(): {
    activeRequests: number;
    totalRequests: number;
  } {
    return {
      activeRequests: this.activeRequests.size,
      totalRequests: this.progressCallbacks.size + this.activeRequests.size,
    };
  }
}

// ===== Default Instance =====

/**
 * Default TTS service instance
 */
export const ttsService = new TTSService();

// ===== Convenience Functions =====

/**
 * Quick text synthesis with validation
 */
export const synthesizeText = async (
  text: string,
  options: Partial<EnhancedSynthesisRequest> = {},
  progressCallback?: ProgressCallback
): Promise<ApiResponse<SynthesisResult>> => {
  return ttsService.synthesize({ text, ...options }, progressCallback);
};

/**
 * Synthesize with voice cloning
 */
export const synthesizeWithVoiceCloning = async (
  text: string,
  audioFile: File,
  options: Partial<EnhancedSynthesisRequest> = {},
  progressCallback?: ProgressCallback
): Promise<ApiResponse<SynthesisResult>> => {
  return ttsService.synthesize(
    { text, cloning_audio: audioFile, ...options },
    progressCallback
  );
};

/**
 * Validate text for synthesis
 */
export const validateSynthesisText = (text: string): TextValidation => {
  return ttsService.validateText(text);
};

/**
 * Validate audio file for voice cloning
 */
export const validateCloningAudio = async (file: File): Promise<AudioFileValidation> => {
  return ttsService.validateAudioFile(file);
};
