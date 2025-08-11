/**
 * Model Management Service
 * 
 * Comprehensive TypeScript service for dynamic model management operations
 * including loading, status tracking, progress monitoring, and caching.
 * 
 * Features:
 * - Dynamic model loading with progress tracking
 * - Server-Sent Events (SSE) for real-time progress updates
 * - Model metadata caching for performance optimization
 * - Loading cancellation and timeout handling
 * - Comprehensive error handling with recovery suggestions
 * - Offline mode support with cached data
 * - Retry logic with exponential backoff
 */

import { ApiClient, ApiClientError, NetworkError, TimeoutError } from './apiClient';
import { ApiResponse, /*ApiError,*/ /*ModelInfo,*/ HealthResponse } from '../types/api';

// ===== Configuration Constants =====

/**
 * Configuration values for model management operations
 */
const MODEL_MANAGEMENT_CONFIG = {
  /** Default timeout for model loading operations (5 minutes) */
  MODEL_LOADING_TIMEOUT: 5 * 60 * 1000,
  
  /** Polling interval for status updates (5 seconds - reduced from 2 to avoid connection issues) */
  STATUS_POLLING_INTERVAL: 5000,
  
  /** Model metadata cache duration (30 minutes) */
  CACHE_DURATION: 30 * 60 * 1000,
  
  /** Maximum retry attempts for failed operations */
  MAX_RETRIES: 3,
  
  /** Initial retry delay in milliseconds */
  RETRY_DELAY: 1000,
  
  /** Server-Sent Events connection timeout (10 seconds) */
  SSE_TIMEOUT: 10 * 1000,
  
  /** SSE reconnection interval (5 seconds) */
  SSE_RECONNECT_INTERVAL: 5000,
} as const;

/**
 * Model management API endpoints
 */
const MODEL_ENDPOINTS = {
  /** Get list of available models */
  AVAILABLE_MODELS: '/api/v1/models/available',
  
  /** Get current loaded model */
  CURRENT_MODEL: '/api/v1/models/current',
  
  /** Load a specific model */
  LOAD_MODEL: '/api/v1/models/load',
  
  /** Get model loading status */
  LOADING_STATUS: '/api/v1/models/status',
  
  /** Cancel active model loading */
  CANCEL_LOADING: '/api/v1/models/cancel',
  
  /** Clear model cache */
  CLEAR_CACHE: '/api/v1/models/cache/clear',
  
  /** Server-Sent Events stream for progress */
  PROGRESS_STREAM: '/api/v1/models/progress-stream',
} as const;

// ===== Data Model Interfaces =====

/**
 * Performance metrics for a model
 */
export interface ModelPerformance {
  /** Average synthesis latency in milliseconds */
  avg_latency_ms: number;
  /** Memory usage in MB */
  memory_usage_mb: number;
  /** GPU utilization percentage (0-100) */
  gpu_utilization?: number;
  /** Quality score (0-1) */
  quality_score?: number;
}

/**
 * Model caching information
 */
export interface ModelCacheInfo {
  /** Whether model files are cached locally */
  is_cached: boolean;
  /** Cache size in MB */
  cache_size_mb?: number;
  /** Cache creation timestamp */
  cached_at?: string;
  /** Cache expiration timestamp */
  expires_at?: string;
}

/**
 * Comprehensive model metadata with capabilities and performance information
 */
export interface ModelMetadata {
  /** Unique model identifier */
  model_id: string;
  
  /** Human-readable model name */
  display_name: string;
  
  /** Model description */
  description?: string;
  
  /** Model version */
  version?: string;
  
  /** Model size in MB */
  size_mb: number;
  
  /** Supported languages */
  languages: string[];
  
  /** Available speakers for multi-speaker models */
  speakers: string[];
  
  /** Model capabilities */
  capabilities: {
    /** Whether model supports multiple speakers */
    multi_speaker: boolean;
    /** Whether model supports multiple languages */
    multi_lingual: boolean;
    /** Whether model supports voice cloning */
    voice_cloning: boolean;
    /** Whether model uses Global Style Tokens */
    gst_support: boolean;
    /** Whether model supports streaming synthesis */
    streaming: boolean;
    /** Real-time factor (lower is faster) */
    realtime_factor?: number;
  };
  
  /** Performance metrics */
  performance?: ModelPerformance;
  
  /** Caching information */
  cache_info?: ModelCacheInfo;
  
  /** Model tags for categorization */
  tags?: string[];
  
  /** Whether model is available for loading */
  available: boolean;
  
  /** Model provider/source */
  provider?: string;
}

/**
 * Current loaded model information
 */
export interface CurrentModelInfo {
  /** Currently loaded model metadata */
  model?: ModelMetadata;
  
  /** Whether a model is currently loaded */
  is_loaded: boolean;
  
  /** Model load timestamp */
  loaded_at?: string;
  
  /** Model warm-up status */
  is_ready: boolean;
  
  /** Current memory usage */
  memory_usage_mb?: number;
}

/**
 * Model loading progress information
 */
export interface LoadingProgress {
  /** Loading progress percentage (0-100) */
  progress: number;
  
  /** Current loading stage */
  stage: 'downloading' | 'extracting' | 'initializing' | 'warming_up' | 'complete' | 'error';
  
  /** Stage-specific message */
  message: string;
  
  /** Estimated time remaining in seconds */
  eta_seconds?: number;
  
  /** Download progress for model files */
  download_progress?: {
    /** Bytes downloaded */
    bytes_downloaded: number;
    /** Total bytes to download */
    total_bytes: number;
    /** Download speed in bytes/second */
    download_speed?: number;
  };
  
  /** Error information if loading failed */
  error?: {
    /** Error message */
    message: string;
    /** Error code */
    code: string;
    /** Whether error is recoverable */
    recoverable: boolean;
  };
}

/**
 * Model loading status response
 */
export interface LoadingStatus {
  /** Whether a loading operation is active */
  is_loading: boolean;
  
  /** Model being loaded */
  target_model?: string;
  
  /** Loading progress information */
  progress?: LoadingProgress;
  
  /** Loading start timestamp */
  started_at?: string;
  
  /** Loading operation ID for cancellation */
  operation_id?: string;
}

/**
 * Model loading request options
 */
export interface LoadModelOptions {
  /** Model to load */
  model_id: string;
  
  /** Whether to force reload if already loaded */
  force_reload?: boolean;
  
  /** Loading timeout in milliseconds */
  timeout?: number;
  
  /** Whether to enable GPU acceleration */
  use_gpu?: boolean;
  
  /** Additional model configuration */
  config?: Record<string, unknown>;
}

/**
 * Model management error categories
 */
export enum ModelManagementErrorCode {
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_LOADING_FAILED = 'MODEL_LOADING_FAILED',
  MODEL_DOWNLOAD_FAILED = 'MODEL_DOWNLOAD_FAILED',
  INSUFFICIENT_MEMORY = 'INSUFFICIENT_MEMORY',
  GPU_NOT_AVAILABLE = 'GPU_NOT_AVAILABLE',
  LOADING_TIMEOUT = 'LOADING_TIMEOUT',
  LOADING_CANCELLED = 'LOADING_CANCELLED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
}

/**
 * Specialized error class for model management operations
 */
export class ModelManagementError extends Error {
  public readonly code: ModelManagementErrorCode;
  public readonly recoverable: boolean;
  public readonly suggestions: string[];
  public readonly originalError?: unknown;

  constructor(
    code: ModelManagementErrorCode,
    message: string,
    recoverable: boolean = true,
    suggestions: string[] = [],
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ModelManagementError';
    this.code = code;
    this.recoverable = recoverable;
    this.suggestions = suggestions;
    this.originalError = originalError;
  }
}

// ===== Progress Callback Types =====

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: LoadingProgress) => void;

/**
 * Status change callback function type
 */
export type StatusChangeCallback = (status: LoadingStatus) => void;

// ===== Cache Management =====

/**
 * Model metadata cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires_at: number;
}

/**
 * Simple in-memory cache for model metadata
 */
class ModelCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, ttl: number = MODEL_MANAGEMENT_CONFIG.CACHE_DURATION): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expires_at: now + ttl,
    });
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expires_at < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Check if cache contains valid entry
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires_at < now) {
        this.cache.delete(key);
      }
    }
  }
}

// ===== Main Service Class =====

/**
 * Model Management Service
 * 
 * Comprehensive service for managing TTS model operations including:
 * - Dynamic model loading with progress tracking
 * - Server-Sent Events for real-time updates
 * - Model metadata caching
 * - Loading cancellation and timeout handling
 * - Error handling with recovery suggestions
 */
export class ModelManagementService {
  private readonly apiClient: ApiClient;
  private readonly cache = new ModelCache();
  
  /** Active Server-Sent Events connection */
  private eventSource?: EventSource;
  
  /** Active progress callbacks */
  private progressCallbacks = new Set<ProgressCallback>();
  
  /** Active status callbacks */
  private statusCallbacks = new Set<StatusChangeCallback>();
  
  /** Current loading operation controller */
  private loadingController?: AbortController;
  
  /** Periodic cleanup interval */
  private cleanupInterval?: number;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient || new ApiClient();
    
    // Set up periodic cache cleanup
    this.cleanupInterval = window.setInterval(
      () => this.cache.cleanup(),
      MODEL_MANAGEMENT_CONFIG.CACHE_DURATION
    );
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disconnectSSE();
    this.cancelLoading();
    this.progressCallbacks.clear();
    this.statusCallbacks.clear();
    this.cache.clear();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // ===== Model Information Methods =====

  /**
   * Transform backend API model data to frontend ModelMetadata format
   */
  private transformBackendModelToMetadata(backendModel: any): ModelMetadata {
    return {
      model_id: backendModel.name || backendModel.model_id || 'unknown',
      display_name: backendModel.displayName || backendModel.display_name || backendModel.name || 'Unknown Model',
      description: backendModel.description || '',
      version: backendModel.version || '1.0.0',
      size_mb: backendModel.size_mb || 0,
      languages: backendModel.languages || [],
      speakers: backendModel.speakers || [],
      capabilities: {
        multi_speaker: backendModel.capabilities?.multiSpeaker || backendModel.multiSpeaker || false,
        multi_lingual: backendModel.capabilities?.multiLingual || backendModel.multiLingual || false,
        voice_cloning: backendModel.capabilities?.voiceCloning || backendModel.voiceCloning || false,
        gst_support: backendModel.capabilities?.gst_support || backendModel.gst_support || false,
        streaming: backendModel.capabilities?.streaming || backendModel.streaming || false,
        realtime_factor: backendModel.capabilities?.realtime_factor || backendModel.realtime_factor
      },
      performance: backendModel.performance,
      cache_info: backendModel.cache_info,
      tags: backendModel.tags || [],
      available: backendModel.available !== false, // Default to true unless explicitly false
      provider: backendModel.provider || 'Coqui'
    };
  }

  /**
   * Get list of all available models with metadata
   * 
   * @param forceRefresh - Whether to bypass cache and fetch fresh data
   * @returns Promise resolving to available models or error
   */
  async getAvailableModels(forceRefresh: boolean = false): Promise<ApiResponse<ModelMetadata[]>> {
    const cacheKey = 'available_models';
    
    // Try to get from cache first
    if (!forceRefresh) {
      const cachedModels = this.cache.get<ModelMetadata[]>(cacheKey);
      if (cachedModels) {
        return { success: true, data: cachedModels };
      }
    }

    try {
      // Make request to backend API
      const response = await this.apiClient.makeRequest<any>(
        MODEL_ENDPOINTS.AVAILABLE_MODELS,
        'GET',
        undefined,
        { timeout: 30000 }
      );

      if (response.success) {
        // Transform backend response to frontend format
        let transformedModels: ModelMetadata[] = [];
        
        if (response.data && Array.isArray(response.data.models)) {
          // Backend returns {models: [...]} format
          transformedModels = response.data.models.map((model: any) => 
            this.transformBackendModelToMetadata(model)
          );
        } else if (response.data && Array.isArray(response.data)) {
          // Backend returns [...] format directly
          transformedModels = response.data.map((model: any) => 
            this.transformBackendModelToMetadata(model)
          );
        }

        // Cache the transformed response
        this.cache.set(cacheKey, transformedModels);
        
        return { success: true, data: transformedModels };
      }

      return response;
    } catch (error) {
      return this.handleError(error, 'Failed to fetch available models');
    }
  }

  /**
   * Get currently loaded model information
   * 
   * @returns Promise resolving to current model info or error
   */
  async getCurrentModel(): Promise<ApiResponse<CurrentModelInfo>> {
    try {
      const response = await this.apiClient.makeRequest<any>(
        MODEL_ENDPOINTS.CURRENT_MODEL,
        'GET',
        undefined,
        { timeout: 10000 }
      );

      if (response.success) {
        // Transform backend response to frontend format
        const backendData = response.data;
        const transformedResponse: CurrentModelInfo = {
          model: backendData.modelName ? this.transformBackendCurrentModelToMetadata(backendData) : undefined,
          is_loaded: !!backendData.modelName,
          loaded_at: backendData.loadedAt,
          is_ready: true,
          memory_usage_mb: backendData.performance?.memoryUsage || 0
        };

        return { success: true, data: transformedResponse };
      }

      return response;
    } catch (error) {
      return this.handleError(error, 'Failed to get current model information');
    }
  }

  /**
   * Transform backend current model data to frontend ModelMetadata format
   */
  private transformBackendCurrentModelToMetadata(backendData: any): ModelMetadata {
    return {
      model_id: backendData.modelName || 'unknown',
      display_name: backendData.displayName || backendData.modelName || 'Unknown Model',
      description: '',
      version: '1.0.0',
      size_mb: 0,
      languages: backendData.capabilities?.languages || [],
      speakers: backendData.capabilities?.speakers || [],
      capabilities: {
        multi_speaker: backendData.capabilities?.multiSpeaker || false,
        multi_lingual: backendData.capabilities?.multiLingual || false,
        voice_cloning: backendData.capabilities?.voiceCloning || false,
        gst_support: false,
        streaming: false
      },
      available: true,
      provider: 'Coqui'
    };
  }

  // ===== Model Loading Methods =====

  /**
   * Load a specific model with progress tracking
   * 
   * @param options - Model loading options
   * @returns Promise resolving to loading operation result
   */
  async loadModel(options: LoadModelOptions): Promise<ApiResponse<{ operation_id: string }>> {
    try {
      // Cancel any existing loading operation
      this.cancelLoading();

      // Create new abort controller
      this.loadingController = new AbortController();

      const requestConfig = {
        timeout: options.timeout || MODEL_MANAGEMENT_CONFIG.MODEL_LOADING_TIMEOUT,
        signal: this.loadingController.signal,
      };

      const response = await this.apiClient.makeRequest<{ operation_id: string }>(
        MODEL_ENDPOINTS.LOAD_MODEL,
        'POST',
        options,
        requestConfig
      );

      if (response.success) {
        // Start SSE progress monitoring
        this.connectSSE();
        
        // Clear current model from cache
        this.cache.set('current_model', null);
      }

      return response;
    } catch (error) {
      return this.handleError(error, `Failed to load model: ${options.model_id}`);
    }
  }

  /**
   * Get current model loading status
   * 
   * @returns Promise resolving to loading status or error
   */
  async getLoadingStatus(): Promise<ApiResponse<LoadingStatus>> {
    try {
      return await this.apiClient.makeRequest<LoadingStatus>(
        MODEL_ENDPOINTS.LOADING_STATUS,
        'GET',
        undefined,
        { timeout: 5000 }
      );
    } catch (error) {
      return this.handleError(error, 'Failed to get loading status');
    }
  }

  /**
   * Cancel active model loading operation
   * 
   * @returns Promise resolving to cancellation result
   */
  async cancelLoading(): Promise<ApiResponse<{ cancelled: boolean }>> {
    // Cancel local abort controller
    if (this.loadingController) {
      this.loadingController.abort();
      this.loadingController = undefined;
    }

    // Disconnect SSE
    this.disconnectSSE();

    try {
      return await this.apiClient.makeRequest<{ cancelled: boolean }>(
        MODEL_ENDPOINTS.CANCEL_LOADING,
        'POST',
        undefined,
        { timeout: 5000 }
      );
    } catch (error) {
      return this.handleError(error, 'Failed to cancel model loading');
    }
  }

  // ===== Progress Monitoring Methods =====

  /**
   * Subscribe to loading progress updates via callback
   * 
   * @param callback - Function to call with progress updates
   * @returns Unsubscribe function
   */
  subscribeToProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to loading status changes via callback
   * 
   * @param callback - Function to call with status updates
   * @returns Unsubscribe function
   */
  subscribeToStatus(callback: StatusChangeCallback): () => void {
    this.statusCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Start Server-Sent Events connection for real-time progress
   */
  private connectSSE(): void {
    // Disconnect existing connection
    this.disconnectSSE();

    try {
      this.eventSource = new EventSource(MODEL_ENDPOINTS.PROGRESS_STREAM);

      this.eventSource.onopen = () => {
        console.log('[ModelManagementService] SSE connection established');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress' && data.progress) {
            // Notify progress callbacks
            this.progressCallbacks.forEach(callback => {
              try {
                callback(data.progress);
              } catch (error) {
                console.error('[ModelManagementService] Error in progress callback:', error);
              }
            });
          }
          
          if (data.type === 'status' && data.status) {
            // Notify status callbacks
            this.statusCallbacks.forEach(callback => {
              try {
                callback(data.status);
              } catch (error) {
                console.error('[ModelManagementService] Error in status callback:', error);
              }
            });
          }
        } catch (error) {
          console.error('[ModelManagementService] Error parsing SSE data:', error);
        }
      };

      this.eventSource.onerror = (event) => {
        console.error('[ModelManagementService] SSE error:', event);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
            this.connectSSE();
          }
        }, MODEL_MANAGEMENT_CONFIG.SSE_RECONNECT_INTERVAL);
      };

    } catch (error) {
      console.error('[ModelManagementService] Failed to establish SSE connection:', error);
    }
  }

  /**
   * Disconnect Server-Sent Events connection
   */
  private disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
      console.log('[ModelManagementService] SSE connection closed');
    }
  }

  // ===== Cache Management Methods =====

  /**
   * Clear model metadata cache
   * 
   * @returns Promise resolving to cache clear result
   */
  async clearModelCache(): Promise<ApiResponse<{ cleared: boolean }>> {
    try {
      // Clear local cache
      this.cache.clear();

      // Clear server-side cache
      return await this.apiClient.makeRequest<{ cleared: boolean }>(
        MODEL_ENDPOINTS.CLEAR_CACHE,
        'POST',
        undefined,
        { timeout: 10000 }
      );
    } catch (error) {
      return this.handleError(error, 'Failed to clear model cache');
    }
  }

  /**
   * Get cached model metadata without making API request
   * 
   * @param modelId - Model identifier
   * @returns Cached model metadata or null
   */
  getCachedModel(modelId: string): ModelMetadata | null {
    return this.cache.get<ModelMetadata>(`model_${modelId}`);
  }

  /**
   * Check if model metadata is cached
   * 
   * @param modelId - Model identifier
   * @returns Whether model is cached
   */
  isModelCached(modelId: string): boolean {
    return this.cache.has(`model_${modelId}`);
  }

  // ===== Utility Methods =====

  /**
   * Poll loading status until completion or failure
   * 
   * @param onProgress - Optional progress callback
   * @param onStatus - Optional status callback
   * @returns Promise resolving when loading completes
   */
  async pollLoadingStatus(
    onProgress?: ProgressCallback,
    onStatus?: StatusChangeCallback
  ): Promise<ApiResponse<LoadingStatus>> {
    const poll = async (): Promise<LoadingStatus> => {
      const response = await this.getLoadingStatus();
      
      if (!response.success) {
        throw new ModelManagementError(
          ModelManagementErrorCode.SERVER_ERROR,
          response.error.error,
          true,
          ['Check server connectivity', 'Try refreshing the page']
        );
      }

      const status = response.data;
      
      // Call status callback if provided
      if (onStatus) {
        onStatus(status);
      }

      // Call progress callback if progress is available
      if (onProgress && status.progress) {
        onProgress(status.progress);
      }

      // Check if loading is complete
      if (!status.is_loading) {
        return status;
      }

      // Check for errors
      if (status.progress?.stage === 'error') {
        throw new ModelManagementError(
          ModelManagementErrorCode.MODEL_LOADING_FAILED,
          status.progress.error?.message || 'Model loading failed',
          status.progress.error?.recoverable ?? true,
          ['Try loading the model again', 'Check available disk space', 'Verify internet connection']
        );
      }

      // Continue polling
      await new Promise(resolve => 
        setTimeout(resolve, MODEL_MANAGEMENT_CONFIG.STATUS_POLLING_INTERVAL)
      );
      
      return poll();
    };

    try {
      const finalStatus = await poll();
      return { success: true, data: finalStatus };
    } catch (error) {
      return this.handleError(error, 'Loading status polling failed');
    }
  }

  /**
   * Check if the service is connected and ready
   * 
   * @returns Promise resolving to service health status
   */
  async checkServiceHealth(): Promise<ApiResponse<HealthResponse>> {
    try {
      return await this.apiClient.checkHealth();
    } catch (error) {
      return this.handleError(error, 'Failed to check service health');
    }
  }

  /**
   * Get service connection status
   * 
   * @returns Connection status information
   */
  getConnectionStatus(): {
    sseConnected: boolean;
    loadingActive: boolean;
    cacheSize: number;
  } {
    return {
      sseConnected: this.eventSource?.readyState === EventSource.OPEN,
      loadingActive: !!this.loadingController && !this.loadingController.signal.aborted,
      cacheSize: this.cache['cache'].size, // Access private property for debugging
    };
  }

  // ===== Error Handling =====

  /**
   * Handle and categorize errors from API operations
   */
  private handleError(error: unknown, context: string): ApiResponse<never> {
    let managementError: ModelManagementError;

    if (error instanceof ModelManagementError) {
      managementError = error;
    } else if (error instanceof NetworkError) {
      managementError = new ModelManagementError(
        ModelManagementErrorCode.NETWORK_ERROR,
        `Network error: ${error.message}`,
        true,
        ['Check your internet connection', 'Try again in a few moments'],
        error
      );
    } else if (error instanceof TimeoutError) {
      managementError = new ModelManagementError(
        ModelManagementErrorCode.LOADING_TIMEOUT,
        `Operation timed out: ${error.message}`,
        true,
        ['Try again with a longer timeout', 'Check your connection speed'],
        error
      );
    } else if (error instanceof ApiClientError) {
      const code = this.mapHttpStatusToErrorCode(error.status);
      managementError = new ModelManagementError(
        code,
        `${context}: ${error.message}`,
        error.status !== 404, // 404 errors are generally not recoverable
        this.getSuggestionsForErrorCode(code),
        error
      );
    } else {
      managementError = new ModelManagementError(
        ModelManagementErrorCode.SERVER_ERROR,
        `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true,
        ['Try refreshing the page', 'Contact support if the problem persists'],
        error
      );
    }

    console.error(`[ModelManagementService] ${context}:`, managementError);

    return {
      success: false,
      error: {
        error: managementError.message,
        status: managementError.code as unknown as number,
      },
    };
  }

  /**
   * Map HTTP status codes to model management error codes
   */
  private mapHttpStatusToErrorCode(status?: number): ModelManagementErrorCode {
    switch (status) {
      case 404:
        return ModelManagementErrorCode.MODEL_NOT_FOUND;
      case 413:
        return ModelManagementErrorCode.INSUFFICIENT_MEMORY;
      case 503:
        return ModelManagementErrorCode.GPU_NOT_AVAILABLE;
      case 408:
      case 504:
        return ModelManagementErrorCode.LOADING_TIMEOUT;
      default:
        return ModelManagementErrorCode.SERVER_ERROR;
    }
  }

  /**
   * Get recovery suggestions for specific error codes
   */
  private getSuggestionsForErrorCode(code: ModelManagementErrorCode): string[] {
    switch (code) {
      case ModelManagementErrorCode.MODEL_NOT_FOUND:
        return [
          'Verify the model name is correct',
          'Check if the model is available in the model list',
          'Try refreshing the available models'
        ];
      case ModelManagementErrorCode.INSUFFICIENT_MEMORY:
        return [
          'Close other applications to free memory',
          'Try a smaller model',
          'Restart the TTS service'
        ];
      case ModelManagementErrorCode.GPU_NOT_AVAILABLE:
        return [
          'Check if GPU drivers are installed',
          'Try loading without GPU acceleration',
          'Verify CUDA availability'
        ];
      case ModelManagementErrorCode.NETWORK_ERROR:
        return [
          'Check your internet connection',
          'Verify firewall settings',
          'Try again in a few moments'
        ];
      case ModelManagementErrorCode.LOADING_TIMEOUT:
        return [
          'Try again with a longer timeout',
          'Check your connection speed',
          'Verify sufficient disk space'
        ];
      default:
        return [
          'Try the operation again',
          'Check server logs for details',
          'Contact support if the problem persists'
        ];
    }
  }
}

// ===== Default Service Instance =====

/**
 * Default model management service instance
 * Pre-configured for typical usage patterns
 */
export const modelManagementService = new ModelManagementService();

// ===== Convenience Functions =====

/**
 * Quick function to get available models
 * 
 * @param forceRefresh - Whether to bypass cache
 * @returns Promise resolving to available models
 */
export const getAvailableModels = async (
  forceRefresh: boolean = false
): Promise<ApiResponse<ModelMetadata[]>> => {
  return modelManagementService.getAvailableModels(forceRefresh);
};

/**
 * Quick function to get current model
 * 
 * @returns Promise resolving to current model info
 */
export const getCurrentModel = async (): Promise<ApiResponse<CurrentModelInfo>> => {
  return modelManagementService.getCurrentModel();
};

/**
 * Quick function to load a model
 * 
 * @param modelId - Model to load
 * @param options - Additional loading options
 * @returns Promise resolving to loading operation
 */
export const loadModel = async (
  modelId: string,
  options: Partial<LoadModelOptions> = {}
): Promise<ApiResponse<{ operation_id: string }>> => {
  return modelManagementService.loadModel({ model_id: modelId, ...options });
};

/**
 * Quick function to cancel loading
 * 
 * @returns Promise resolving to cancellation result
 */
export const cancelLoading = async (): Promise<ApiResponse<{ cancelled: boolean }>> => {
  return modelManagementService.cancelLoading();
};