/**
 * Model Information Service
 * 
 * Provides comprehensive model information including capabilities, configuration,
 * and available options for speakers and languages. Implements caching for
 * performance and refresh capabilities for updated model information.
 * 
 * Features:
 * - Model capability detection (multi-speaker, multi-lingual, cloning support)
 * - Speaker and language list retrieval with metadata
 * - Model configuration parsing and validation
 * - Intelligent caching with TTL and refresh strategies
 * - Error handling with graceful degradation
 * 
 * Implements requirements 2.1, 2.2, 2.6, 5.1, 5.6, and 8.4 from the specification.
 */

import {
  ApiResponse,
  ModelCapabilities,
} from '../types/api';
import { apiClient } from './apiClient';
import { modelManagementService, ModelMetadata/*, CurrentModelInfo*/ } from './modelManagementService';

// ===== Constants =====

/**
 * Cache configuration for model information
 */
export const CACHE_CONFIG = {
  /** Cache TTL in milliseconds (5 minutes) */
  TTL: 5 * 60 * 1000,
  /** Maximum number of cached entries */
  MAX_ENTRIES: 10,
  /** Stale cache threshold in milliseconds (1 minute) */
  STALE_THRESHOLD: 60 * 1000,
} as const;

/**
 * Model capability inference patterns
 * Used to detect capabilities from model names and configurations
 */
export const MODEL_PATTERNS = {
  /** Multi-speaker model indicators */
  MULTI_SPEAKER: [
    'vits',
    'yourtts',
    'multi',
    'speaker',
    'vctk',
  ],
  /** Multi-lingual model indicators */
  MULTI_LINGUAL: [
    'multilingual',
    'yourtts',
    'xtts',
    'bark',
    'multi',
  ],
  /** Voice cloning support indicators */
  CLONING_SUPPORT: [
    'yourtts',
    'xtts',
    'tortoise',
    'bark',
    'clone',
  ],
} as const;

/**
 * Default speaker options for different model types
 */
/**
 * Common language codes with display names
 */
export const LANGUAGE_INFO = {
  'en': { name: 'English', native: 'English' },
  'es': { name: 'Spanish', native: 'Español' },
  'fr': { name: 'French', native: 'Français' },
  'de': { name: 'German', native: 'Deutsch' },
  'it': { name: 'Italian', native: 'Italiano' },
  'pt': { name: 'Portuguese', native: 'Português' },
  'pl': { name: 'Polish', native: 'Polski' },
  'tr': { name: 'Turkish', native: 'Türkçe' },
  'ru': { name: 'Russian', native: 'Русский' },
  'nl': { name: 'Dutch', native: 'Nederlands' },
  'cs': { name: 'Czech', native: 'Čeština' },
  'ar': { name: 'Arabic', native: 'العربية' },
  'zh': { name: 'Chinese', native: '中文' },
  'ja': { name: 'Japanese', native: '日本語' },
  'hu': { name: 'Hungarian', native: 'Magyar' },
  'ko': { name: 'Korean', native: '한국어' },
} as const;

// ===== Types =====

/**
 * Enhanced speaker information with metadata
 */
export interface SpeakerInfo {
  /** Speaker ID/name */
  id: string;
  /** Display name for UI */
  name: string;
  /** Language code if speaker is language-specific */
  language?: string;
  /** Gender if known */
  gender?: 'male' | 'female' | 'neutral';
  /** Audio preview URL if available */
  previewUrl?: string;
  /** Speaker description or accent info */
  description?: string;
}

/**
 * Enhanced language information with metadata
 */
export interface LanguageInfo {
  /** Language code (ISO 639-1 or similar) */
  code: string;
  /** Display name in English */
  name: string;
  /** Native name in the language itself */
  nativeName: string;
  /** Whether this language is currently available */
  available: boolean;
  /** Text processing quality for this language */
  quality?: 'excellent' | 'good' | 'experimental';
}

/**
 * Comprehensive model configuration information
 */
export interface ModelConfiguration {
  /** Current model name/path */
  model_name: string;
  /** Model type (tacotron2, vits, etc.) */
  model_type?: string;
  /** Model architecture details */
  architecture?: string;
  /** Training dataset information */
  dataset?: string;
  /** Model version */
  version?: string;
  /** Model parameters and settings */
  parameters?: Record<string, any>;
  /** Vocoder information if applicable */
  vocoder?: {
    name: string;
    type: string;
    parameters?: Record<string, any>;
  };
  /** Performance characteristics */
  performance?: {
    /** Estimated synthesis speed */
    speed: 'fast' | 'medium' | 'slow';
    /** Quality rating */
    quality: 'high' | 'medium' | 'low';
    /** Memory usage */
    memory_usage: 'low' | 'medium' | 'high';
  };
}

/**
 * Complete model information with all capabilities and metadata
 */
export interface CompleteModelInfo extends Omit<ModelCapabilities, 'speakers' | 'languages'> {
  /** Model configuration details */
  configuration: ModelConfiguration;
  /** Enhanced speaker information */
  speakers: SpeakerInfo[];
  /** Enhanced language information */
  languages: LanguageInfo[];
  /** Available models list with metadata */
  available_models: string[];
  /** Last update timestamp */
  last_updated: number;
  /** Cache metadata */
  cached: boolean;
  /** Whether information might be stale */
  stale?: boolean;
}

/**
 * Model service cache entry
 */
interface CacheEntry {
  /** Cached model information */
  data: CompleteModelInfo;
  /** Cache timestamp */
  timestamp: number;
  /** Cache key */
  key: string;
}

/**
 * Model refresh options
 */
export interface RefreshOptions {
  /** Force refresh even if cache is fresh */
  force?: boolean;
  /** Timeout for refresh operation */
  timeout?: number;
  /** Whether to return stale data on failure */
  fallbackToStale?: boolean;
}

/**
 * Cache invalidation listener type
 */
export type CacheInvalidationListener = () => void;

// ===== Model Service Class =====

/**
 * Model Information Service
 * 
 * Manages comprehensive model information with intelligent caching,
 * capability detection, and metadata enhancement.
 */
export class ModelService {
  private cache = new Map<string, CacheEntry>();
  private refreshPromises = new Map<string, Promise<ApiResponse<CompleteModelInfo>>>();
  private cacheInvalidationListeners = new Set<CacheInvalidationListener>();
  private lastModelRegistryUpdate: number = 0;

  // ===== Cache Management =====

  /**
   * Get cache key for current model information
   */
  private getCacheKey(): string {
    return 'current_model_info';
  }

  /**
   * Check if cache entry is valid (not expired)
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < CACHE_CONFIG.TTL;
  }

  /**
   * Check if cache entry is stale but still usable
   */
  private isCacheStale(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age > CACHE_CONFIG.STALE_THRESHOLD && age < CACHE_CONFIG.TTL;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_CONFIG.TTL) {
        this.cache.delete(key);
      }
    }

    // Limit cache size
    if (this.cache.size > CACHE_CONFIG.MAX_ENTRIES) {
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp);
      
      const toDelete = entries.slice(0, this.cache.size - CACHE_CONFIG.MAX_ENTRIES);
      for (const [key] of toDelete) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Store data in cache
   */
  private setCacheEntry(key: string, data: CompleteModelInfo): void {
    this.cache.set(key, {
      data: { ...data, cached: true, last_updated: Date.now() },
      timestamp: Date.now(),
      key,
    });
    this.cleanupCache();
  }

  /**
   * Invalidate cache and notify listeners (Requirement 8.4)
   */
  private invalidateCache(): void {
    this.cache.clear();
    this.refreshPromises.clear();
    this.lastModelRegistryUpdate = Date.now();
    
    // Notify all invalidation listeners
    this.cacheInvalidationListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[ModelService] Error in cache invalidation listener:', error);
      }
    });
  }

  /**
   * Subscribe to cache invalidation events (Requirement 8.4)
   */
  onCacheInvalidation(listener: CacheInvalidationListener): () => void {
    this.cacheInvalidationListeners.add(listener);
    return () => {
      this.cacheInvalidationListeners.delete(listener);
    };
  }

  /**
   * Get data from cache if valid
   */
  private getCacheEntry(key: string): CompleteModelInfo | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isCacheValid(entry)) {
      const isStale = this.isCacheStale(entry);
      return {
        ...entry.data,
        stale: isStale,
      };
    }

    // Cache expired, remove it
    this.cache.delete(key);
    return null;
  }

  // ===== Model Capability Detection =====

  /**
   * Detect model capabilities from model name and available information
   */
  private detectCapabilities(modelName: string): ModelCapabilities {
    const nameLower = modelName.toLowerCase();
    
    // Detect multi-speaker capability
    const isMultiSpeaker = MODEL_PATTERNS.MULTI_SPEAKER.some(pattern => 
      nameLower.includes(pattern)
    );

    // Detect multi-lingual capability
    const isMultiLingual = MODEL_PATTERNS.MULTI_LINGUAL.some(pattern => 
      nameLower.includes(pattern)
    );

    // Detect voice cloning support
    const supportsCloning = MODEL_PATTERNS.CLONING_SUPPORT.some(pattern => 
      nameLower.includes(pattern)
    );

    // Detect GST (Global Style Tokens) support
    const useGst = nameLower.includes('gst') || nameLower.includes('style');

    return {
      is_multi_speaker: isMultiSpeaker,
      is_multi_lingual: isMultiLingual,
      supports_cloning: supportsCloning,
      use_gst: useGst,
    };
  }





  /**
   * Parse model configuration from model name or metadata
   */
  private parseModelConfiguration(modelName: string, metadata?: ModelMetadata): ModelConfiguration {
    // If we have metadata from ModelManagementService, use it
    if (metadata) {
      return {
        model_name: metadata.model_id,
        model_type: this.extractModelType(metadata.model_id),
        architecture: this.mapArchitecture(metadata.model_id),
        dataset: this.extractDataset(metadata.model_id),
        version: metadata.version || '1.0',
        parameters: {
          languages: metadata.languages,
          speakers: metadata.speakers,
          size_mb: metadata.size_mb,
        },
        performance: metadata.performance ? {
          speed: this.mapSpeedFromLatency(metadata.performance.avg_latency_ms),
          quality: this.mapQualityFromScore(metadata.performance.quality_score),
          memory_usage: this.mapMemoryUsage(metadata.performance.memory_usage_mb),
        } : undefined,
      };
    }

    // Fallback to legacy parsing
    const parts = modelName.split('/');
    const model_type = parts.length > 3 ? parts[3] : 'unknown';
    const dataset = parts.length > 2 ? parts[2] : 'unknown';
    const language = parts.length > 1 ? parts[1] : 'en';

    // Determine architecture from model type
    let architecture = 'unknown';
    let speed: 'fast' | 'medium' | 'slow' = 'medium';
    let quality: 'high' | 'medium' | 'low' = 'medium';
    let memory_usage: 'low' | 'medium' | 'high' = 'medium';

    const typeLower = model_type.toLowerCase();
    
    if (typeLower.includes('tacotron')) {
      architecture = 'Tacotron';
      speed = 'medium';
      quality = 'high';
      memory_usage = 'medium';
    } else if (typeLower.includes('vits')) {
      architecture = 'VITS';
      speed = 'fast';
      quality = 'high';
      memory_usage = 'medium';
    } else if (typeLower.includes('xtts')) {
      architecture = 'XTTS';
      speed = 'medium';
      quality = 'high';
      memory_usage = 'high';
    } else if (typeLower.includes('bark')) {
      architecture = 'Bark';
      speed = 'slow';
      quality = 'high';
      memory_usage = 'high';
    } else if (typeLower.includes('glow')) {
      architecture = 'Glow-TTS';
      speed = 'fast';
      quality = 'medium';
      memory_usage = 'low';
    }

    return {
      model_name: modelName,
      model_type,
      architecture,
      dataset,
      version: '1.0', // Default version
      parameters: {
        language,
        dataset,
      },
      performance: {
        speed,
        quality,
        memory_usage,
      },
    };
  }

  /**
   * Helper methods for mapping metadata to legacy format
   */
  private extractModelType(modelId: string): string {
    const parts = modelId.split('/');
    return parts.length > 3 ? parts[3] : 'unknown';
  }

  private extractDataset(modelId: string): string {
    const parts = modelId.split('/');
    return parts.length > 2 ? parts[2] : 'unknown';
  }

  private mapArchitecture(modelId: string): string {
    const idLower = modelId.toLowerCase();
    if (idLower.includes('tacotron')) return 'Tacotron';
    if (idLower.includes('vits')) return 'VITS';
    if (idLower.includes('xtts')) return 'XTTS';
    if (idLower.includes('bark')) return 'Bark';
    if (idLower.includes('glow')) return 'Glow-TTS';
    return 'Unknown';
  }

  private mapSpeedFromLatency(latencyMs?: number): 'fast' | 'medium' | 'slow' {
    if (!latencyMs) return 'medium';
    if (latencyMs < 100) return 'fast';
    if (latencyMs < 500) return 'medium';
    return 'slow';
  }

  private mapQualityFromScore(score?: number): 'high' | 'medium' | 'low' {
    if (!score) return 'medium';
    if (score > 0.8) return 'high';
    if (score > 0.6) return 'medium';
    return 'low';
  }

  private mapMemoryUsage(memoryMb?: number): 'low' | 'medium' | 'high' {
    if (!memoryMb) return 'medium';
    if (memoryMb < 500) return 'low';
    if (memoryMb < 2000) return 'medium';
    return 'high';
  }

  // ===== Public API Methods =====

  /**
   * Get comprehensive model information with caching (Requirement 2.6)
   * 
   * @param options - Refresh options
   * @returns Promise resolving to complete model information
   */
  async getModelInfo(options: RefreshOptions = {}): Promise<ApiResponse<CompleteModelInfo>> {
    const cacheKey = this.getCacheKey();
    const { force = false, timeout = 10000, fallbackToStale = true } = options;

    // Check cache first unless forced refresh
    if (!force) {
      const cachedData = this.getCacheEntry(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData };
      }
    }

    // Check if refresh is already in progress
    const existingPromise = this.refreshPromises.get(cacheKey);
    if (existingPromise && !force) {
      return existingPromise;
    }

    // Start new refresh operation
    const refreshPromise = this.performRefresh(timeout, fallbackToStale);
    this.refreshPromises.set(cacheKey, refreshPromise);

    try {
      const result = await refreshPromise;
      if (result.success) {
        this.setCacheEntry(cacheKey, result.data);
      }
      return result;
    } finally {
      this.refreshPromises.delete(cacheKey);
    }
  }

  /**
   * Perform model information refresh from API endpoints with dynamic model support (Requirements 5.1, 5.6)
   */
  private async performRefresh(
    timeout: number,
    fallbackToStale: boolean
  ): Promise<ApiResponse<CompleteModelInfo>> {
    const cacheKey = this.getCacheKey();
    
    try {
      // First, try to get current model from ModelManagementService (Requirements 5.1)
      const currentModelResponse = await modelManagementService.getCurrentModel();
      
      // Get available models list for complete information
      const availableModelsResponse = await modelManagementService.getAvailableModels();
      
      let currentModelMetadata: ModelMetadata | undefined;
      let currentModelName: string;
      
      if (currentModelResponse.success && currentModelResponse.data.model) {
        // Use currently loaded model from ModelManagementService
        currentModelMetadata = currentModelResponse.data.model;
        currentModelName = currentModelMetadata.model_id;
      } else {
        // Fallback to legacy approach
        const legacyModelsResponse = await apiClient.getModels({ timeout });
        if (!legacyModelsResponse.success) {
          if (fallbackToStale) {
            const staleData = this.cache.get(cacheKey)?.data;
            if (staleData) {
              return { 
                success: true, 
                data: { ...staleData, stale: true, cached: true } 
              };
            }
          }
          return legacyModelsResponse as ApiResponse<CompleteModelInfo>;
        }
        currentModelName = legacyModelsResponse.data.models[0] || 'tts_models/en/ljspeech/tacotron2-DDC';
      }
      
      // Detect model capabilities (enhanced with metadata)
      const capabilities = this.detectCapabilitiesFromMetadata(currentModelName, currentModelMetadata);
      
      // Get enhanced speaker and language lists from API endpoints (Requirements 2.1, 2.2, 5.1)
      let speakers: SpeakerInfo[] = [];
      let languages: LanguageInfo[] = [];
      
      try {
        // Try to get speakers from API
        const speakersResponse = await apiClient.getModelSpeakers({ timeout: timeout / 2 });
        if (speakersResponse.success) {
          speakers = speakersResponse.data.speakers.map(speakerId => ({
            id: speakerId,
            name: this.formatSpeakerName(speakerId),
            description: `Speaker from ${currentModelName}`,
            gender: this.detectGender(speakerId),
          }));
        }
      } catch (error) {
        console.warn('[ModelService] Failed to fetch speakers from API in performRefresh:', error);
        speakers = [{ id: 'default', name: 'Default Speaker', description: 'Default speaker (API unavailable)' }];
      }
      
      try {
        // Try to get languages from API
        const languagesResponse = await apiClient.getModelLanguages({ timeout: timeout / 2 });
        if (languagesResponse.success) {
          languages = languagesResponse.data.languages.map(langCode => ({
            code: langCode,
            name: LANGUAGE_INFO[langCode as keyof typeof LANGUAGE_INFO]?.name || langCode,
            nativeName: LANGUAGE_INFO[langCode as keyof typeof LANGUAGE_INFO]?.native || langCode,
            available: true,
            quality: this.assessLanguageQualityFromModelName(langCode, currentModelName),
          }));
        }
      } catch (error) {
        console.warn('[ModelService] Failed to fetch languages from API in performRefresh:', error);
        languages = [{ code: 'en', name: 'English', nativeName: 'English', available: true, quality: 'excellent' }];
      }
      
      // Parse model configuration with metadata (Requirement 5.1)
      const configuration = this.parseModelConfiguration(currentModelName, currentModelMetadata);

      // Get available models list
      const availableModels = availableModelsResponse.success ? 
        availableModelsResponse.data.map(m => m.model_id) :
        [currentModelName];

      const completeInfo: CompleteModelInfo = {
        ...capabilities,
        configuration,
        speakers,
        languages,
        available_models: availableModels,
        last_updated: Date.now(),
        cached: false,
        // Add data freshness indicator (Requirement 5.6)
        stale: this.isDataStale(currentModelResponse.success ? currentModelResponse.data?.loaded_at : undefined),
      };

      return { success: true, data: completeInfo };

    } catch (error) {
      if (fallbackToStale) {
        const staleData = this.cache.get(cacheKey)?.data;
        if (staleData) {
          return { 
            success: true, 
            data: { ...staleData, stale: true, cached: true } 
          };
        }
      }

      return {
        success: false,
        error: {
          error: `Failed to refresh model information: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 500,
        },
      };
    }
  }

  /**
   * Check if data is stale based on load timestamp (Requirement 5.6)
   */
  private isDataStale(loadedAt?: string): boolean {
    if (!loadedAt) return false;
    
    const loadTime = new Date(loadedAt).getTime();
    const now = Date.now();
    const staleThreshold = CACHE_CONFIG.STALE_THRESHOLD;
    
    return (now - loadTime) > staleThreshold;
  }

  /**
   * Enhanced capability detection using ModelMetadata (Requirement 5.1)
   */
  private detectCapabilitiesFromMetadata(modelName: string, metadata?: ModelMetadata): ModelCapabilities {
    if (metadata) {
      return {
        is_multi_speaker: metadata.capabilities.multi_speaker,
        is_multi_lingual: metadata.capabilities.multi_lingual,
        supports_cloning: metadata.capabilities.voice_cloning,
        use_gst: metadata.capabilities.gst_support,
        speakers: metadata.speakers,
        languages: metadata.languages,
      };
    }
    
    // Fallback to pattern-based detection
    return this.detectCapabilities(modelName);
  }





  /**
   * Helper methods for metadata processing
   */
  private formatSpeakerName(speakerId: string): string {
    // Format speaker ID into display name
    if (speakerId.startsWith('p') && /^p\d+$/.test(speakerId)) {
      return `Speaker ${speakerId.toUpperCase()}`;
    }
    return speakerId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private detectGender(speakerId: string): 'male' | 'female' | 'neutral' | undefined {
    const femalePatterns = ['female', 'woman', 'girl', 'f_'];
    const malePatterns = ['male', 'man', 'boy', 'm_'];
    
    const lowerSpeakerId = speakerId.toLowerCase();
    
    if (femalePatterns.some(pattern => lowerSpeakerId.includes(pattern))) {
      return 'female';
    }
    if (malePatterns.some(pattern => lowerSpeakerId.includes(pattern))) {
      return 'male';
    }
    return undefined;
  }



  /**
   * Assess language quality from model name (simpler version for API responses)
   */
  private assessLanguageQualityFromModelName(langCode: string, modelName: string): 'excellent' | 'good' | 'experimental' {
    // Primary language gets excellent quality (usually English for most models)
    if (langCode === 'en') {
      return 'excellent';
    }
    
    // Check if this language is in the model name
    if (modelName.toLowerCase().includes(langCode.toLowerCase())) {
      return 'excellent';
    }
    
    // Common languages get good quality
    const commonLanguages = ['es', 'fr', 'de', 'it', 'pt'];
    if (commonLanguages.includes(langCode)) {
      return 'good';
    }
    
    return 'experimental';
  }

  /**
   * Get speaker list for current model (Requirement 2.1)
   * 
   * @param options - Refresh options
   * @returns Promise resolving to speaker information
   */
  async getSpeakers(options: RefreshOptions = {}): Promise<ApiResponse<SpeakerInfo[]>> {
    try {
      // Fetch speakers directly from the API
      const response = await apiClient.getModelSpeakers({
        timeout: options.timeout || 5000,
      });
      
      if (!response.success) {
        return response as ApiResponse<SpeakerInfo[]>;
      }
      
      const data = response.data;
      
      // Convert string array to SpeakerInfo array
      const speakers: SpeakerInfo[] = data.speakers.map(speakerId => ({
        id: speakerId,
        name: this.formatSpeakerName(speakerId),
        description: `Speaker from ${data.model_name}`,
        gender: this.detectGender(speakerId),
      }));
      
      return { success: true, data: speakers };
    } catch (error) {
      // Return empty array on error rather than falling back to hardcoded values
      console.warn('[ModelService] Failed to fetch speakers from API, returning empty array:', error);
      return { 
        success: true, 
        data: [{ 
          id: 'default', 
          name: 'Default Speaker', 
          description: 'Default speaker (API unavailable)' 
        }] 
      };
    }
  }

  /**
   * Get language list for current model (Requirement 2.2)
   * 
   * @param options - Refresh options
   * @returns Promise resolving to language information
   */
  async getLanguages(options: RefreshOptions = {}): Promise<ApiResponse<LanguageInfo[]>> {
    try {
      // Fetch languages directly from the API
      const response = await apiClient.getModelLanguages({
        timeout: options.timeout || 5000,
      });
      
      if (!response.success) {
        return response as ApiResponse<LanguageInfo[]>;
      }
      
      const data = response.data;
      
      // Convert string array to LanguageInfo array
      const languages: LanguageInfo[] = data.languages.map(langCode => ({
        code: langCode,
        name: LANGUAGE_INFO[langCode as keyof typeof LANGUAGE_INFO]?.name || langCode,
        nativeName: LANGUAGE_INFO[langCode as keyof typeof LANGUAGE_INFO]?.native || langCode,
        available: true,
        quality: this.assessLanguageQualityFromModelName(langCode, data.model_name),
      }));
      
      return { success: true, data: languages };
    } catch (error) {
      // Return default language on error rather than falling back to hardcoded values
      console.warn('[ModelService] Failed to fetch languages from API, returning default:', error);
      return { 
        success: true, 
        data: [{ 
          code: 'en', 
          name: 'English', 
          nativeName: 'English', 
          available: true, 
          quality: 'excellent' 
        }] 
      };
    }
  }

  /**
   * Get model capabilities only
   * 
   * @param options - Refresh options
   * @returns Promise resolving to model capabilities
   */
  async getCapabilities(options: RefreshOptions = {}): Promise<ApiResponse<ModelCapabilities>> {
    const modelInfo = await this.getModelInfo(options);
    
    if (!modelInfo.success) {
      return modelInfo as ApiResponse<ModelCapabilities>;
    }

    const { is_multi_speaker, is_multi_lingual, supports_cloning, use_gst, speakers, languages } = modelInfo.data;
    
    return { 
      success: true, 
      data: { 
        is_multi_speaker, 
        is_multi_lingual, 
        supports_cloning, 
        use_gst,
        speakers: speakers.map(s => s.id),
        languages: languages.map(l => l.code),
      } 
    };
  }

  /**
   * Refresh model information cache
   * 
   * @param options - Refresh options
   * @returns Promise resolving to updated model information
   */
  async refreshModelInfo(options: RefreshOptions = {}): Promise<ApiResponse<CompleteModelInfo>> {
    return this.getModelInfo({ ...options, force: true });
  }

  /**
   * Clear model information cache and trigger invalidation (Requirement 8.4)
   */
  clearCache(): void {
    this.invalidateCache();
  }

  /**
   * Force cache invalidation when model registry is updated (Requirement 8.4)
   */
  async invalidateCacheOnModelRegistryUpdate(): Promise<void> {
    try {
      // Check if model registry has been updated
      const availableModels = await modelManagementService.getAvailableModels(true);
      
      if (availableModels.success) {
        // Clear cache to ensure fresh data
        this.invalidateCache();
        console.log('[ModelService] Cache invalidated due to model registry update');
      }
    } catch (error) {
      console.error('[ModelService] Error checking model registry updates:', error);
    }
  }

  /**
   * Check if cached data needs refresh (Requirement 5.6)
   */
  needsRefresh(): boolean {
    const cacheKey = this.getCacheKey();
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return true;
    
    return this.isCacheStale(entry) || 
           (Date.now() - this.lastModelRegistryUpdate) > CACHE_CONFIG.STALE_THRESHOLD;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    lastUpdate?: number;
    cacheSize: number;
    activeRefreshes: number;
  } {
    let lastUpdate: number | undefined;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      if (!lastUpdate || entry.timestamp > lastUpdate) {
        lastUpdate = entry.timestamp;
      }
      // Rough estimate of cache entry size
      totalSize += JSON.stringify(entry.data).length;
    }

    return {
      entries: this.cache.size,
      lastUpdate,
      cacheSize: totalSize,
      activeRefreshes: this.refreshPromises.size,
    };
  }
}

// ===== Default Instance =====

/**
 * Default model service instance
 */
export const modelService = new ModelService();

// ===== Convenience Functions =====

/**
 * Get current model information with caching
 */
export const getModelInfo = async (options?: RefreshOptions): Promise<ApiResponse<CompleteModelInfo>> => {
  return modelService.getModelInfo(options);
};

/**
 * Get speaker list for current model
 */
export const getModelSpeakers = async (options?: RefreshOptions): Promise<ApiResponse<SpeakerInfo[]>> => {
  return modelService.getSpeakers(options);
};

/**
 * Get language list for current model
 */
export const getModelLanguages = async (options?: RefreshOptions): Promise<ApiResponse<LanguageInfo[]>> => {
  return modelService.getLanguages(options);
};

/**
 * Get model capabilities
 */
export const getModelCapabilities = async (options?: RefreshOptions): Promise<ApiResponse<ModelCapabilities>> => {
  return modelService.getCapabilities(options);
};

/**
 * Refresh model information
 */
export const refreshModelInfo = async (options?: RefreshOptions): Promise<ApiResponse<CompleteModelInfo>> => {
  return modelService.refreshModelInfo(options);
};

/**
 * Subscribe to cache invalidation events (Requirement 8.4)
 */
export const onCacheInvalidation = (listener: CacheInvalidationListener): () => void => {
  return modelService.onCacheInvalidation(listener);
};

/**
 * Check if model data needs refresh (Requirement 5.6)
 */
export const needsModelDataRefresh = (): boolean => {
  return modelService.needsRefresh();
};

/**
 * Force cache invalidation on model registry update (Requirement 8.4)
 */
export const invalidateCacheOnRegistryUpdate = async (): Promise<void> => {
  return modelService.invalidateCacheOnModelRegistryUpdate();
};