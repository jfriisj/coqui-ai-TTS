/**
 * Coqui TTS API Client
 * 
 * HTTP client with fetch API for Flask endpoints including error handling,
 * request timeouts, retry logic, and base URL handling for development/production.
 * 
 * Features:
 * - Configurable base URL for dev (Vite proxy) and production (Flask static)
 * - Request/response interceptors with comprehensive error handling
 * - Exponential backoff retry logic for transient failures
 * - Type-safe API methods for all Flask endpoints
 * - Request timeouts and abort signal support
 * - Detailed error messages with recovery suggestions
 */

import {
  ApiResponse,
  ApiError,
  SynthesisRequest,
  OpenAISpeechRequest,
  VoiceConvertRequest,
  ModelInfo,
  HealthResponse,
  AudioGeneration,
  ExtendedModelInfo,
  API_ENDPOINTS,
  DEFAULT_SYNTHESIS_OPTIONS,
  type HttpMethod,
} from '../types/api';

// Import generated OpenAPI classes
import {
  TTSRequest,
  ModelLoadRequest,
  EnhancedTTSRequest,
  BatchTTSRequest,
  VoiceConversionRequest,
  AvailableModelsGet200Response,
  AvailableSpeakersGet200Response,
  AvailableLanguagesGet200Response,
  CurrentModelGet200Response,
} from '../gen/src';

// ===== Configuration =====

/**
 * API Client configuration options
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseUrl?: string;
  /** Default request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Request configuration options
 */
export interface RequestConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** AbortController signal for request cancellation */
  signal?: AbortSignal;
  /** Whether to retry on failure */
  retry?: boolean;
  /** Number of retry attempts for this request */
  maxRetries?: number;
  /** Custom headers for this request */
  headers?: Record<string, string>;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseUrl: '',  // Empty for relative URLs (handled by Vite proxy in dev, Flask routing in prod)
  timeout: 30000,  // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,  // 1 second
  debug: false,
};

// ===== Error Classes =====

/**
 * Custom error class for API client errors
 */
export class ApiClientError extends Error {
  public readonly status?: number;
  public readonly endpoint?: string;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    status?: number,
    endpoint?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.endpoint = endpoint;
    this.originalError = originalError;
  }
}

/**
 * Error class for network-related failures
 */
export class NetworkError extends ApiClientError {
  constructor(message: string, endpoint?: string, originalError?: unknown) {
    super(message, undefined, endpoint, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Error class for timeout-related failures
 */
export class TimeoutError extends ApiClientError {
  constructor(timeout: number, endpoint?: string) {
    super(`Request timeout after ${timeout}ms`, 408, endpoint);
    this.name = 'TimeoutError';
  }
}

// ===== Utility Functions =====

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if an error is retryable
 */
const isRetryableError = (error: unknown, status?: number): boolean => {
  // Retry on network errors, timeouts, and certain HTTP status codes
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }
  
  if (status) {
    // Retry on 5xx server errors and 429 rate limiting
    return status >= 500 || status === 429;
  }
  
  return false;
};

/**
 * Parse error response from Flask API
 */
const parseErrorResponse = async (response: Response): Promise<ApiError> => {
  try {
    const errorData = await response.json();
    return {
      error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
    };
  } catch {
    // Fallback if response is not JSON
    return {
      error: `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
    };
  }
};

/**
 * Generate user-friendly error message with recovery suggestions
 */
const generateErrorMessage = (error: ApiClientError): string => {
  const baseMessage = error.message;
  let suggestion = '';

  switch (error.status) {
    case 400:
      suggestion = 'Please check your input parameters and try again.';
      break;
    case 404:
      suggestion = 'The requested resource was not found. Verify the API endpoint.';
      break;
    case 429:
      suggestion = 'Too many requests. Please wait a moment and try again.';
      break;
    case 500:
      suggestion = 'Server error occurred. Please try again or contact support.';
      break;
    case 503:
      suggestion = 'Service temporarily unavailable. Please try again later.';
      break;
    default:
      if (error instanceof NetworkError) {
        suggestion = 'Check your internet connection and try again.';
      } else if (error instanceof TimeoutError) {
        suggestion = 'The request took too long. Try again or check your connection.';
      } else {
        suggestion = 'An unexpected error occurred. Please try again.';
      }
  }

  return suggestion ? `${baseMessage} ${suggestion}` : baseMessage;
};

// ===== Main API Client Class =====

/**
 * Coqui TTS API Client
 * 
 * Provides type-safe methods for interacting with all Flask API endpoints
 * with built-in error handling, retries, and timeout management.
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.debug) {
      console.log('[ApiClient] Initialized with config:', this.config);
    }
  }

  /**
   * Make a raw HTTP request with retry logic and error handling
   */
  public async makeRequest<T>(
    endpoint: string,
    method: HttpMethod = 'GET',
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.config.timeout,
      signal,
      retry = true,
      maxRetries = this.config.maxRetries,
      headers = {},
    } = config;

    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: ApiClientError = new ApiClientError('Unknown error');

    // Attempt request with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.config.debug) {
        console.log(`[ApiClient] ${method} ${url} (attempt ${attempt + 1}/${maxRetries + 1})`);
      }

      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

      // Combine timeout and user-provided abort signals
      const combinedSignal = signal 
        ? this.combineAbortSignals([signal, timeoutController.signal])
        : timeoutController.signal;

      try {
        // Prepare request options
        const requestInit: RequestInit = {
          method,
          signal: combinedSignal,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        };

        // Add request body for POST/PUT requests
        if (data && method !== 'GET') {
          if (data instanceof FormData) {
            // Don't set Content-Type for FormData (browser will set it with boundary)
            if (requestInit.headers) {
                delete (requestInit.headers as any)['Content-Type'];
            }
            requestInit.body = data;
          } else {
            requestInit.body = JSON.stringify(data);
          }
        }

        // Make the request
        const response = await fetch(url, requestInit);
        clearTimeout(timeoutId);

        // Handle successful response
        if (response.ok) {
          // Check if response is audio data
          const contentType = response.headers.get('content-type') || '';
          if (contentType.startsWith('audio/')) {
            const audioBlob = await response.blob();
            return {
              success: true,
              data: { audio: audioBlob, mimeType: contentType } as T,
            };
          }

          // Handle JSON response
          try {
            const jsonData = await response.json();
            return { success: true, data: jsonData as T };
          } catch {
            // Response is not JSON, return empty object
            return { success: true, data: {} as T };
          }
        }

        // Handle error response
        const errorData = await parseErrorResponse(response);
        lastError = new ApiClientError(
          errorData.error,
          response.status,
          endpoint
        );

        // Check if error is retryable
        if (!retry || !isRetryableError(lastError, response.status) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await sleep(delay);

      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = signal?.aborted
            ? new ApiClientError('Request was cancelled', undefined, endpoint, error)
            : new TimeoutError(timeout, endpoint);
        } else {
          lastError = new NetworkError(
            `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            endpoint,
            error
          );
        }

        // Check if error is retryable
        if (!retry || !isRetryableError(lastError) || attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    // Return error response with user-friendly message
    return {
      success: false,
      error: {
        error: generateErrorMessage(lastError),
        status: lastError.status,
      },
    };
  }

  /**
   * Combine multiple AbortSignals into one
   */
  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    signals.forEach(signal => {
      if (signal.aborted) {
        controller.abort();
        return;
      }
      
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    });
    
    return controller.signal;
  }

  // ===== Public API Methods =====

  /**
   * Synthesize speech using the main TTS endpoint
   * 
   * @param request - Synthesis parameters
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeText(
    request: SynthesisRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const synthesisData = { ...DEFAULT_SYNTHESIS_OPTIONS, ...request };
    // Use longer timeout for TTS synthesis (Bark can take 2-3 minutes)
    const ttsConfig = { timeout: 300000, ...config }; // 5 minutes
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.TTS,
      'POST',
      synthesisData,
      ttsConfig
    );
  }

  /**
   * Synthesize speech using the v1 TTS endpoint
   * 
   * @param request - Synthesis parameters
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeTextV1(
    request: SynthesisRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const synthesisData = { ...DEFAULT_SYNTHESIS_OPTIONS, ...request };
    // Use longer timeout for TTS synthesis (Bark can take 2-3 minutes)
    const ttsConfig = { timeout: 300000, ...config }; // 5 minutes
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.TTS_V1,
      'POST',
      synthesisData,
      ttsConfig
    );
  }

  /**
   * Synthesize speech using OpenAI-compatible endpoint
   * 
   * @param request - OpenAI speech parameters
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeOpenAI(
    request: OpenAISpeechRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.OPENAI_SPEECH,
      'POST',
      request,
      config
    );
  }

  /**
   * Get list of available models
   * 
   * @param config - Request configuration options
   * @returns Model information or error
   */
  async getModels(config?: RequestConfig): Promise<ApiResponse<ModelInfo>> {
    return this.makeRequest<ModelInfo>(API_ENDPOINTS.MODELS, 'GET', undefined, config);
  }

  /**
   * Get speakers for the current model
   * 
   * @param config - Request configuration options
   * @returns Model speakers response or error
   */
  async getModelSpeakers(config?: RequestConfig): Promise<ApiResponse<{ model_name: string; speakers: string[] }>> {
    return this.makeRequest<{ model_name: string; speakers: string[] }>(API_ENDPOINTS.MODEL_SPEAKERS, 'GET', undefined, config);
  }

  /**
   * Get languages for the current model
   * 
   * @param config - Request configuration options
   * @returns Model languages response or error
   */
  async getModelLanguages(config?: RequestConfig): Promise<ApiResponse<{ model_name: string; languages: string[] }>> {
    return this.makeRequest<{ model_name: string; languages: string[] }>(API_ENDPOINTS.MODEL_LANGUAGES, 'GET', undefined, config);
  }

  /**
   * Check API health status
   * 
   * @param config - Request configuration options
   * @returns Health status response or error
   */
  async checkHealth(config?: RequestConfig): Promise<ApiResponse<HealthResponse>> {
    return this.makeRequest<HealthResponse>(API_ENDPOINTS.HEALTH, 'GET', undefined, config);
  }

  /**
   * Perform voice conversion
   * 
   * @param request - Voice conversion files
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async convertVoice(
    request: VoiceConvertRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const formData = new FormData();
    formData.append('source_wav', request.source_wav);
    formData.append('target_wav', request.target_wav);

    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.VOICE_CONVERT,
      'POST',
      formData,
      config
    );
  }

  /**
   * Get current model capabilities and configuration
   * Note: This combines information from multiple endpoints to provide complete model info
   * 
   * @param config - Request configuration options
   * @returns Extended model information or error
   */
  async getModelInfo(config?: RequestConfig): Promise<ApiResponse<ExtendedModelInfo>> {
    // This would typically require additional endpoints to get current model capabilities
    // For now, we return basic model information
    const modelsResponse = await this.getModels(config);
    
    if (!modelsResponse.success) {
      return modelsResponse as ApiResponse<ExtendedModelInfo>;
    }

    // TODO: Implement full model capabilities detection
    // This would require additional Flask endpoints to expose current model configuration
    const extendedInfo: ExtendedModelInfo = {
      model_name: 'current_model', // Would need to be provided by Flask
      available_models: modelsResponse.data.models,
      is_multi_speaker: false,
      is_multi_lingual: false,
      supports_cloning: false,
      speakers: [],
      languages: [],
      use_gst: false,
    };

    return { success: true, data: extendedInfo };
  }

  /**
   * Get available locales (MaryTTS compatibility)
   * 
   * @param config - Request configuration options
   * @returns Text response with locales or error
   */
  async getLocales(config?: RequestConfig): Promise<ApiResponse<string>> {
    const response = await this.makeRequest<string>(
      API_ENDPOINTS.LOCALES,
      'GET',
      undefined,
      config
    );
    
    return response;
  }

  /**
   * Get available voices (MaryTTS compatibility)
   * 
   * @param config - Request configuration options
   * @returns Text response with voices or error
   */
  async getVoices(config?: RequestConfig): Promise<ApiResponse<string>> {
    return this.makeRequest<string>(API_ENDPOINTS.VOICES, 'GET', undefined, config);
  }

  /**
   * Process text using MaryTTS-compatible endpoint
   * 
   * @param text - Text to process
   * @param voice - Voice ID
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async processMaryTTS(
    text: string,
    voice?: string,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const formData = new FormData();
    formData.append('INPUT_TEXT', text);
    if (voice) {
      formData.append('VOICE', voice);
    }

    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.PROCESS,
      'POST',
      formData,
      config
    );
  }

  /**
   * Update client configuration
   * 
   * @param newConfig - Configuration updates
   */
  updateConfig(newConfig: Partial<ApiClientConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.debug) {
      console.log('[ApiClient] Config updated:', this.config);
    }
  }

  /**
   * Get current client configuration
   * 
   * @returns Current configuration
   */
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  // ===== Enhanced Methods Using Generated Classes =====

  /**
   * Synthesize speech using generated TTSRequest class for better type safety
   *
   * @param request - Generated TTSRequest object
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeWithTTSRequest(
    request: TTSRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const ttsConfig = { timeout: 300000, ...config }; // 5 minutes
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.TTS_V1,
      'POST',
      request,
      ttsConfig
    );
  }

  /**
   * Enhanced synthesis using the generated EnhancedTTSRequest class
   *
   * @param request - Generated EnhancedTTSRequest object
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeEnhanced(
    request: EnhancedTTSRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    const ttsConfig = { timeout: 300000, ...config }; // 5 minutes
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.TTS_V1,
      'POST',
      request,
      ttsConfig
    );
  }

  /**
   * Batch synthesis using generated BatchTTSRequest class
   *
   * @param request - Generated BatchTTSRequest object
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async synthesizeBatch(
    request: BatchTTSRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration[]>> {
    const ttsConfig = { timeout: 600000, ...config }; // 10 minutes for batch
    return this.makeRequest<AudioGeneration[]>(
      '/api/v1/tts/batch', // Assuming batch endpoint
      'POST',
      request,
      ttsConfig
    );
  }

  /**
   * Load model using generated ModelLoadRequest class
   *
   * @param request - Generated ModelLoadRequest object
   * @param config - Request configuration options
   * @returns Model load response or error
   */
  async loadModel(
    request: ModelLoadRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(
      '/api/v1/models/load',
      'POST',
      request,
      config
    );
  }

  /**
   * Get available models with proper typing using generated response class
   *
   * @param config - Request configuration options
   * @returns Available models response with proper typing
   */
  async getAvailableModelsTyped(config?: RequestConfig): Promise<ApiResponse<AvailableModelsGet200Response>> {
    return this.makeRequest<AvailableModelsGet200Response>(
      '/api/v1/models/available',
      'GET',
      undefined,
      config
    );
  }

  /**
   * Get current model with proper typing using generated response class
   *
   * @param config - Request configuration options
   * @returns Current model response with proper typing
   */
  async getCurrentModelTyped(config?: RequestConfig): Promise<ApiResponse<CurrentModelGet200Response>> {
    return this.makeRequest<CurrentModelGet200Response>(
      '/api/v1/models/current',
      'GET',
      undefined,
      config
    );
  }

  /**
   * Get model speakers with proper typing using generated response class
   *
   * @param config - Request configuration options
   * @returns Speakers response with proper typing
   */
  async getModelSpeakersTyped(config?: RequestConfig): Promise<ApiResponse<AvailableSpeakersGet200Response>> {
    return this.makeRequest<AvailableSpeakersGet200Response>(
      '/api/v1/models/speakers',
      'GET',
      undefined,
      config
    );
  }

  /**
   * Get model languages with proper typing using generated response class
   *
   * @param config - Request configuration options
   * @returns Languages response with proper typing
   */
  async getModelLanguagesTyped(config?: RequestConfig): Promise<ApiResponse<AvailableLanguagesGet200Response>> {
    return this.makeRequest<AvailableLanguagesGet200Response>(
      '/api/v1/models/languages',
      'GET',
      undefined,
      config
    );
  }

  /**
   * Voice conversion using generated VoiceConversionRequest class
   *
   * @param request - Generated VoiceConversionRequest object
   * @param config - Request configuration options
   * @returns Audio generation response or error
   */
  async convertVoiceTyped(
    request: VoiceConversionRequest,
    config?: RequestConfig
  ): Promise<ApiResponse<AudioGeneration>> {
    return this.makeRequest<AudioGeneration>(
      API_ENDPOINTS.VOICE_CONVERT,
      'POST',
      request,
      config
    );
  }
}

// ===== Default Instance =====

/**
 * Default API client instance
 * Pre-configured for typical usage patterns
 */
export const apiClient = new ApiClient({
  debug: process.env.NODE_ENV === 'development',
});

// ===== Convenience Functions =====

/**
 * Quick synthesis function using default client
 * 
 * @param text - Text to synthesize
 * @param options - Optional synthesis parameters
 * @returns Audio generation response
 */
export const synthesize = async (
  text: string,
  options: Partial<SynthesisRequest> = {}
): Promise<ApiResponse<AudioGeneration>> => {
  return apiClient.synthesizeText({ text, ...options });
};

/**
 * Quick health check using default client
 * 
 * @returns Health status response
 */
export const checkHealth = async (): Promise<ApiResponse<HealthResponse>> => {
  return apiClient.checkHealth();
};

/**
 * Quick model list using default client
 * 
 * @returns Available models response
 */
export const getModels = async (): Promise<ApiResponse<ModelInfo>> => {
  return apiClient.getModels();
};

