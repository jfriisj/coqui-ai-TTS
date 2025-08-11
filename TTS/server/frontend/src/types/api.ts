/**
 * TypeScript type definitions for Coqui TTS Flask API
 * These types match the existing Flask API response formats
 */

// ===== Request Types =====

/**
 * Request payload for TTS synthesis endpoints
 * Used by /api/tts, /api/v1/tts, and /v1/audio/speech
 */
export interface SynthesisRequest {
  /** Text to synthesize (required) */
  text: string;
  /** Speaker ID for multi-speaker models */
  speaker_id?: string;
  /** Language ID for multilingual models */
  language_id?: string;
  /** Style WAV file path or GST tokens for style transfer */
  style_wav?: string;
  /** Speaker WAV file for voice cloning */
  speaker_wav?: string;
  /** Audio output format */
  format?: 'wav' | 'mp3' | 'opus' | 'aac' | 'flac' | 'pcm';
  /** Synthesis speed multiplier */
  speed?: number;
}

/**
 * Request payload for OpenAI-compatible speech API
 * Used by /v1/audio/speech endpoint
 */
export interface OpenAISpeechRequest {
  /** Model name (ignored, uses server default) */
  model?: string;
  /** Voice/speaker identifier */
  voice: string;
  /** Text to synthesize */
  input: string;
  /** Audio response format */
  response_format?: 'wav' | 'mp3' | 'opus' | 'aac' | 'flac' | 'pcm';
  /** Synthesis speed */
  speed?: number;
}

/**
 * Request payload for voice conversion
 * Used by /api/v1/voice-convert endpoint
 */
export interface VoiceConvertRequest {
  /** Source audio file */
  source_wav: File;
  /** Target voice audio file */
  target_wav: File;
}

// ===== Response Types =====

/**
 * Model information from /api/v1/models endpoint
 */
export interface ModelInfo {
  /** List of available TTS models */
  models: string[];
}

/**
 * Health check response from /api/v1/health endpoint
 */
export interface HealthResponse {
  /** Service health status */
  status: 'healthy' | 'unhealthy';
  /** Whether a model is loaded and ready */
  model_loaded: boolean;
}

/**
 * Audio generation response wrapper
 * Used for successful synthesis requests
 */
export interface AudioGeneration {
  /** Audio data as Blob */
  audio: Blob;
  /** MIME type of the audio */
  mimeType: string;
}
/**
 * Full audio record with metadata for playback and comparison
 */

/**
 * Current model capabilities and configuration
 * Derived from TTS API properties
 */
export interface ModelCapabilities {
  /** Whether model supports multiple speakers */
  is_multi_speaker: boolean;
  /** Whether model supports multiple languages */
  is_multi_lingual: boolean;
  /** Whether model supports voice cloning */
  supports_cloning: boolean;
  /** Available speaker IDs */
  speakers?: string[];
  /** Available language codes */
  languages?: string[];
  /** Whether model uses GST (Global Style Tokens) */
  use_gst?: boolean;
}

/**
 * Complete model information including capabilities
 * Extended model info with current configuration
 */
export interface ExtendedModelInfo extends ModelCapabilities {
  /** Currently loaded model name */
  model_name: string;
  /** Available models list */
  available_models: string[];
}

// ===== Error Types =====

/**
 * Standard API error response format
 * Used by all Flask endpoints for error handling
 */
export interface ApiError {
  /** Error message */
  error: string;
  /** HTTP status code */
  status?: number;
}

/**
 * Validation error details
 * Used for form validation and input errors
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Validation error message */
  message: string;
}

/**
 * API response wrapper for error handling
 */
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
};

// ===== Theme Configuration =====

/**
 * Theme configuration for the frontend
 * Used for dark/light mode toggle
 */
export interface ThemeConfiguration {
  /** Current theme mode */
  mode: 'light' | 'dark';
  /** Theme colors */
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

// ===== Utility Types =====

/**
 * Available audio formats supported by the API
 */
export type AudioFormat = 'wav' | 'mp3' | 'opus' | 'aac' | 'flac' | 'pcm';

/**
 * HTTP methods used by the API
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // TTS endpoints
  TTS: '/api/tts',
  TTS_V1: '/api/v1/tts',
  OPENAI_SPEECH: '/v1/audio/speech',
  
  // Model management
  MODELS: '/api/v1/models',
  HEALTH: '/api/v1/health',
  
  // Voice conversion
  VOICE_CONVERT: '/api/v1/voice-convert',
  
  // MaryTTS compatibility
  LOCALES: '/locales',
  VOICES: '/voices',
  PROCESS: '/process',
} as const;

/**
 * Default values for synthesis requests
 */
export const DEFAULT_SYNTHESIS_OPTIONS: Partial<SynthesisRequest> = {
  format: 'wav',
  speed: 1.0,
};

/**
 * Audio MIME type mappings
 */
export const AUDIO_MIME_TYPES: Record<AudioFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pcm: 'audio/L16',
};
// Types for model UI components
export type { SpeakerInfo, LanguageInfo } from '../services/modelService';