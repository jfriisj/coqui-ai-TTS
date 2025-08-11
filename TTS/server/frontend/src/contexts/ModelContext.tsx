/**
 * Model Context Provider for Coqui TTS Frontend
 * 
 * Dedicated context for comprehensive model state management with real-time progress tracking,
 * Server-Sent Events (SSE) integration, and automatic capability refresh functionality.
 * 
 * Features:
 * - Model loading state management with progress tracking
 * - Real-time progress updates via SSE (Requirements 6.1, 6.2)
 * - Automatic capability refresh on model changes (Requirement 4.5)
 * - Model information display with comprehensive metadata (Requirement 5.1)
 * - Error handling and recovery mechanisms
 * - Performance optimized with proper state updates and re-render prevention
 * 
 * Requirements implemented:
 * - 4.5: Model State Management - Auto refresh speakers/languages on model change
 * - 5.1: Model Information Display - Show comprehensive model information
 * - 6.1: Progress Tracking Initialization - Immediate progress indicator
 * - 6.2: Real-time Progress Updates - Updates every 500ms with SSE
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { 
  modelManagementService,
  ModelMetadata,
  // CurrentModelInfo,
  LoadingProgress,
  LoadingStatus,
  LoadModelOptions,
  ProgressCallback,
  StatusChangeCallback,
  ModelManagementErrorCode,
  ModelManagementError
} from '../services/modelManagementService';
import {
  modelService,
  CompleteModelInfo,
  SpeakerInfo,
  LanguageInfo,
  RefreshOptions,
  onCacheInvalidation
} from '../services/modelService';

// ===== Types and Interfaces =====

/**
 * Model loading operation information
 */
export interface ModelLoadingOperation {
  /** Unique operation ID */
  id: string;
  /** Model being loaded */
  modelId: string;
  /** Operation start timestamp */
  startedAt: string;
  /** Loading options used */
  options: LoadModelOptions;
  /** Whether operation can be cancelled */
  cancellable: boolean;
}

/**
 * Progress tracking state with real-time updates (Requirements 6.1, 6.2)
 */
export interface ModelProgressState {
  /** Whether progress tracking is active */
  isActive: boolean;
  /** Current progress information */
  progress?: LoadingProgress;
  /** Real-time update interval in ms (500ms per requirement) */
  updateInterval: number;
  /** Last update timestamp */
  lastUpdate?: number;
  /** Progress history for detailed tracking */
  progressHistory: LoadingProgress[];
  /** Estimated completion time */
  estimatedCompletion?: number;
}

/**
 * Model error information with recovery suggestions
 */
export interface ModelErrorInfo {
  /** Error message */
  message: string;
  /** Error code for categorization */
  code: ModelManagementErrorCode;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Recovery suggestions for user */
  suggestions: string[];
  /** Error timestamp */
  timestamp: number;
  /** Associated operation ID if applicable */
  operationId?: string;
}

/**
 * Model information display state (Requirement 5.1)
 */
export interface ModelInfoDisplayState {
  /** Whether model information panel is shown */
  showInfoPanel: boolean;
  /** Current model information */
  modelInfo?: CompleteModelInfo;
  /** Model metadata from management service */
  modelMetadata?: ModelMetadata;
  /** Whether model information is stale */
  isStale: boolean;
  /** Last refresh timestamp */
  lastRefresh?: number;
}

/**
 * Model capabilities state (Requirement 4.5)
 */
export interface ModelCapabilitiesState {
  /** Available speakers for current model */
  speakers: SpeakerInfo[];
  /** Available languages for current model */
  languages: LanguageInfo[];
  /** Model capabilities flags */
  capabilities: {
    multiSpeaker: boolean;
    multiLingual: boolean;
    voiceCloning: boolean;
    gstSupport: boolean;
    streaming: boolean;
  };
  /** Whether capabilities are being refreshed */
  isRefreshing: boolean;
  /** Last capabilities refresh timestamp */
  lastRefresh: number;
}

/**
 * Complete model context state
 */
export interface ModelState {
  // Current Model Information (Requirement 5.1)
  /** Currently loaded model metadata */
  currentModel?: ModelMetadata;
  /** Complete model information with capabilities */
  modelInfo?: CompleteModelInfo;
  /** Whether a model is loaded and ready */
  isModelReady: boolean;
  /** Model load timestamp */
  loadedAt?: string;

  // Available Models
  /** List of all available models */
  availableModels: ModelMetadata[];
  /** Whether models list is being loaded */
  isLoadingModels: boolean;

  // Loading State Management
  /** Current loading operation if active */
  currentOperation?: ModelLoadingOperation;
  /** Loading status information */
  loadingStatus?: LoadingStatus;
  /** Whether any loading operation is active */
  isLoading: boolean;

  // Progress Tracking (Requirements 6.1, 6.2)
  /** Real-time progress tracking state */
  progressState: ModelProgressState;

  // Model Capabilities (Requirement 4.5)
  /** Model capabilities and options */
  capabilities: ModelCapabilitiesState;

  // Information Display (Requirement 5.1)
  /** Model information display state */
  infoDisplay: ModelInfoDisplayState;

  // Error Handling
  /** Current error information */
  error?: ModelErrorInfo;
  /** Error history for debugging */
  errorHistory: ModelErrorInfo[];

  // Connection Status
  /** SSE connection status */
  sseConnected: boolean;
  /** Service health status */
  serviceHealthy: boolean;
  /** Last health check timestamp */
  lastHealthCheck?: number;
}

/**
 * Model context actions and methods
 */
export interface ModelContextActions {
  // Model Loading Operations
  /** Load a specific model with progress tracking */
  loadModel: (modelId: string, options?: Partial<LoadModelOptions>) => Promise<void>;
  /** Cancel current loading operation */
  cancelLoading: () => Promise<void>;
  /** Retry failed loading operation */
  retryLoading: () => Promise<void>;

  // Model Information Management (Requirement 5.1)
  /** Refresh model information and capabilities */
  refreshModelInfo: (options?: RefreshOptions) => Promise<void>;
  /** Get available models list */
  refreshAvailableModels: (force?: boolean) => Promise<void>;
  /** Show/hide model information panel */
  toggleInfoPanel: (show?: boolean) => void;

  // Capabilities Management (Requirement 4.5)
  /** Refresh speakers list for current model */
  refreshSpeakers: () => Promise<void>;
  /** Refresh languages list for current model */
  refreshLanguages: () => Promise<void>;
  /** Refresh all capabilities */
  refreshCapabilities: () => Promise<void>;

  // Progress Monitoring (Requirements 6.1, 6.2)
  /** Subscribe to progress updates */
  subscribeToProgress: (callback: ProgressCallback) => () => void;
  /** Subscribe to status changes */
  subscribeToStatus: (callback: StatusChangeCallback) => () => void;
  /** Clear progress history */
  clearProgressHistory: () => void;

  // Error Management
  /** Clear current error */
  clearError: () => void;
  /** Clear error history */
  clearErrorHistory: () => void;
  /** Get error recovery suggestions */
  getRecoverySuggestions: () => string[];

  // Service Health
  /** Check service health status */
  checkServiceHealth: () => Promise<void>;
  /** Get connection status information */
  getConnectionStatus: () => {
    sseConnected: boolean;
    loadingActive: boolean;
    serviceHealthy: boolean;
  };
}

/**
 * Complete model context value
 */
interface ModelContextValue extends ModelState, ModelContextActions {}

// ===== Constants =====

/**
 * Default progress state
 */
const DEFAULT_PROGRESS_STATE: ModelProgressState = {
  isActive: false,
  updateInterval: 500, // 500ms per requirement 6.2
  progressHistory: [],
};

/**
 * Default capabilities state
 */
const DEFAULT_CAPABILITIES_STATE: ModelCapabilitiesState = {
  speakers: [],
  languages: [],
  capabilities: {
    multiSpeaker: false,
    multiLingual: false,
    voiceCloning: false,
    gstSupport: false,
    streaming: false,
  },
  isRefreshing: false,
  lastRefresh: 0,
};

/**
 * Default info display state
 */
const DEFAULT_INFO_DISPLAY_STATE: ModelInfoDisplayState = {
  showInfoPanel: false,
  isStale: false,
};

/**
 * Default model state
 */
const DEFAULT_MODEL_STATE: ModelState = {
  isModelReady: false,
  availableModels: [],
  isLoadingModels: false,
  isLoading: false,
  progressState: DEFAULT_PROGRESS_STATE,
  capabilities: DEFAULT_CAPABILITIES_STATE,
  infoDisplay: DEFAULT_INFO_DISPLAY_STATE,
  errorHistory: [],
  sseConnected: false,
  serviceHealthy: false,
};

/**
 * Progress update interval (500ms per requirement 6.2) - Currently unused
 */
// const PROGRESS_UPDATE_INTERVAL = 500;

/**
 * Health check interval (30 seconds)
 */
const HEALTH_CHECK_INTERVAL = 30 * 1000;

/**
 * Maximum progress history entries
 */
const MAX_PROGRESS_HISTORY = 50;

/**
 * Maximum error history entries
 */
const MAX_ERROR_HISTORY = 10;

// ===== Context Creation =====

/**
 * Model context for managing TTS model state throughout the application
 */
const ModelContext = createContext<ModelContextValue | undefined>(undefined);

// ===== Context Provider =====

/**
 * Model provider props
 */
interface ModelProviderProps {
  children: ReactNode;
}

/**
 * Model context provider component
 * Manages all model-related state and provides functionality to child components
 */
export function ModelProvider({ children }: ModelProviderProps): JSX.Element {
  // ===== State Management =====
  
  const [modelState, setModelState] = useState<ModelState>(DEFAULT_MODEL_STATE);
  
  // Refs for managing callbacks and intervals
  const progressCallbacksRef = useRef<Set<ProgressCallback>>(new Set());
  const statusCallbacksRef = useRef<Set<StatusChangeCallback>>(new Set());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheInvalidationUnsubscribeRef = useRef<(() => void) | null>(null);

  // ===== Utility Functions =====

  /**
   * Create error info from various error types
   */
  const createErrorInfo = useCallback((
    error: unknown,
    operationId?: string
  ): ModelErrorInfo => {
    if (error instanceof ModelManagementError) {
      return {
        message: error.message,
        code: error.code,
        recoverable: error.recoverable,
        suggestions: error.suggestions,
        timestamp: Date.now(),
        operationId,
      };
    }

    return {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: ModelManagementErrorCode.SERVER_ERROR,
      recoverable: true,
      suggestions: ['Try the operation again', 'Check your connection', 'Contact support if the problem persists'],
      timestamp: Date.now(),
      operationId,
    };
  }, []);

  /**
   * Add error to history with size limit
   */
  const addErrorToHistory = useCallback((error: ModelErrorInfo) => {
    setModelState(prev => ({
      ...prev,
      error,
      errorHistory: [error, ...prev.errorHistory.slice(0, MAX_ERROR_HISTORY - 1)],
    }));
  }, []);

  /**
   * Update progress state with history tracking
   */
  const updateProgressState = useCallback((progress: LoadingProgress) => {
    const now = Date.now();
    
    setModelState(prev => {
      const newHistory = [progress, ...prev.progressState.progressHistory.slice(0, MAX_PROGRESS_HISTORY - 1)];
      
      // Calculate estimated completion based on progress history
      let estimatedCompletion: number | undefined;
      if (progress.eta_seconds) {
        estimatedCompletion = now + (progress.eta_seconds * 1000);
      } else if (newHistory.length >= 2 && progress.progress > 0) {
        // Estimate based on progress rate
        const oldProgress = newHistory[1];
        const timeDiff = now - (prev.progressState.lastUpdate || now);
        const progressDiff = progress.progress - oldProgress.progress;
        
        if (progressDiff > 0 && timeDiff > 0) {
          const progressRate = progressDiff / timeDiff; // progress per ms
          const remainingProgress = 100 - progress.progress;
          const estimatedTimeMs = remainingProgress / progressRate;
          estimatedCompletion = now + estimatedTimeMs;
        }
      }

      return {
        ...prev,
        progressState: {
          ...prev.progressState,
          isActive: progress.stage !== 'complete' && progress.stage !== 'error',
          progress,
          lastUpdate: now,
          progressHistory: newHistory,
          estimatedCompletion,
        },
      };
    });
  }, []);

  // ===== Model Loading Operations =====

  /**
   * Load a specific model with comprehensive progress tracking (Requirements 6.1, 6.2)
   */
  const loadModel = useCallback(async (
    modelId: string,
    options: Partial<LoadModelOptions> = {}
  ): Promise<void> => {
    try {
      // Clear previous errors
      setModelState(prev => ({ ...prev, error: undefined }));

      // Start progress tracking (Requirement 6.1)
      setModelState(prev => ({
        ...prev,
        isLoading: true,
        progressState: {
          ...prev.progressState,
          isActive: true,
          progress: {
            progress: 0,
            stage: 'downloading' as const,
            message: `Starting to load model: ${modelId}`,
          },
          lastUpdate: Date.now(),
          progressHistory: [],
        },
      }));

      const loadOptions: LoadModelOptions = {
        model_id: modelId,
        force_reload: options.force_reload ?? false,
        use_gpu: options.use_gpu ?? true,
        timeout: options.timeout,
        config: options.config,
      };

      const response = await modelManagementService.loadModel(loadOptions);

      if (!response.success) {
        throw new ModelManagementError(
          ModelManagementErrorCode.MODEL_LOADING_FAILED,
          response.error.error,
          true,
          ['Try loading the model again', 'Check if the model exists', 'Verify your connection']
        );
      }

      // Set up current operation tracking
      const operation: ModelLoadingOperation = {
        id: response.data.operation_id,
        modelId,
        startedAt: new Date().toISOString(),
        options: loadOptions,
        cancellable: true,
      };

      setModelState(prev => ({
        ...prev,
        currentOperation: operation,
      }));

    } catch (error) {
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      
      setModelState(prev => ({
        ...prev,
        isLoading: false,
        progressState: {
          ...prev.progressState,
          isActive: false,
        },
      }));
      
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Cancel current loading operation
   */
  const cancelLoading = useCallback(async (): Promise<void> => {
    try {
      await modelManagementService.cancelLoading();
      
      setModelState(prev => ({
        ...prev,
        isLoading: false,
        currentOperation: undefined,
        progressState: {
          ...prev.progressState,
          isActive: false,
        },
      }));
    } catch (error) {
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Retry the last failed loading operation
   */
  const retryLoading = useCallback(async (): Promise<void> => {
    const { currentOperation } = modelState;
    if (!currentOperation) {
      throw new Error('No operation to retry');
    }

    await loadModel(currentOperation.modelId, currentOperation.options);
  }, [modelState, loadModel]);

  // ===== Model Information Management (Requirement 5.1) =====

  /**
   * Refresh comprehensive model information
   */
  const refreshModelInfo = useCallback(async (options: RefreshOptions = {}): Promise<void> => {
    try {
      setModelState(prev => ({
        ...prev,
        capabilities: {
          ...prev.capabilities,
          isRefreshing: true,
        },
      }));

      // Get current model from management service
      const currentModelResponse = await modelManagementService.getCurrentModel();
      
      // Get detailed model information from model service
      const modelInfoResponse = await modelService.getModelInfo(options);

      if (currentModelResponse.success) {
        const currentModelData = currentModelResponse.data;
        
        setModelState(prev => ({
          ...prev,
          currentModel: currentModelData.model,
          isModelReady: currentModelData.is_ready,
          loadedAt: currentModelData.loaded_at,
          infoDisplay: {
            ...prev.infoDisplay,
            modelMetadata: currentModelData.model,
            lastRefresh: Date.now(),
            isStale: false,
          },
        }));
      }

      if (modelInfoResponse.success) {
        const modelInfo = modelInfoResponse.data;
        
        setModelState(prev => ({
          ...prev,
          modelInfo,
          capabilities: {
            ...prev.capabilities,
            speakers: modelInfo.speakers,
            languages: modelInfo.languages,
            capabilities: {
              multiSpeaker: modelInfo.is_multi_speaker,
              multiLingual: modelInfo.is_multi_lingual,
              voiceCloning: modelInfo.supports_cloning,
              gstSupport: modelInfo.use_gst || false,
              streaming: modelInfo.configuration.parameters?.streaming || false,
            },
            lastRefresh: Date.now(),
            isRefreshing: false,
          },
          infoDisplay: {
            ...prev.infoDisplay,
            modelInfo,
            isStale: modelInfo.stale || false,
          },
        }));
      } else {
        setModelState(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            isRefreshing: false,
          },
        }));
        
        const errorInfo = createErrorInfo(new Error(modelInfoResponse.error.error));
        addErrorToHistory(errorInfo);
      }
    } catch (error) {
      setModelState(prev => ({
        ...prev,
        capabilities: {
          ...prev.capabilities,
          isRefreshing: false,
        },
      }));
      
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Refresh available models list
   */
  const refreshAvailableModels = useCallback(async (force: boolean = false): Promise<void> => {
    try {
      setModelState(prev => ({ ...prev, isLoadingModels: true }));

      const response = await modelManagementService.getAvailableModels(force);

      if (response.success) {
        setModelState(prev => ({
          ...prev,
          availableModels: response.data,
          isLoadingModels: false,
        }));
      } else {
        setModelState(prev => ({ ...prev, isLoadingModels: false }));
        
        const errorInfo = createErrorInfo(new Error(response.error.error));
        addErrorToHistory(errorInfo);
      }
    } catch (error) {
      setModelState(prev => ({ ...prev, isLoadingModels: false }));
      
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Toggle model information panel visibility
   */
  const toggleInfoPanel = useCallback((show?: boolean): void => {
    setModelState(prev => ({
      ...prev,
      infoDisplay: {
        ...prev.infoDisplay,
        showInfoPanel: show !== undefined ? show : !prev.infoDisplay.showInfoPanel,
      },
    }));
  }, []);

  // ===== Capabilities Management (Requirement 4.5) =====

  /**
   * Refresh speakers list for current model
   */
  const refreshSpeakers = useCallback(async (): Promise<void> => {
    try {
      const response = await modelService.getSpeakers({ force: true });
      
      if (response.success) {
        setModelState(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            speakers: response.data,
            lastRefresh: Date.now(),
          },
        }));
      } else {
        const errorInfo = createErrorInfo(new Error(response.error.error));
        addErrorToHistory(errorInfo);
      }
    } catch (error) {
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Refresh languages list for current model
   */
  const refreshLanguages = useCallback(async (): Promise<void> => {
    try {
      const response = await modelService.getLanguages({ force: true });
      
      if (response.success) {
        setModelState(prev => ({
          ...prev,
          capabilities: {
            ...prev.capabilities,
            languages: response.data,
            lastRefresh: Date.now(),
          },
        }));
      } else {
        const errorInfo = createErrorInfo(new Error(response.error.error));
        addErrorToHistory(errorInfo);
      }
    } catch (error) {
      const errorInfo = createErrorInfo(error);
      addErrorToHistory(errorInfo);
      throw error;
    }
  }, [createErrorInfo, addErrorToHistory]);

  /**
   * Refresh all model capabilities (Requirement 4.5)
   */
  const refreshCapabilities = useCallback(async (): Promise<void> => {
    await Promise.all([
      refreshSpeakers(),
      refreshLanguages(),
    ]);
  }, [refreshSpeakers, refreshLanguages]);

  // ===== Progress Monitoring (Requirements 6.1, 6.2) =====

  /**
   * Subscribe to progress updates with callback
   */
  const subscribeToProgress = useCallback((callback: ProgressCallback): () => void => {
    progressCallbacksRef.current.add(callback);
    
    // Subscribe to underlying service
    const unsubscribeService = modelManagementService.subscribeToProgress((progress) => {
      updateProgressState(progress);
      callback(progress);
    });

    return () => {
      progressCallbacksRef.current.delete(callback);
      unsubscribeService();
    };
  }, [updateProgressState]);

  /**
   * Subscribe to status changes with callback
   */
  const subscribeToStatus = useCallback((callback: StatusChangeCallback): () => void => {
    statusCallbacksRef.current.add(callback);
    
    // Subscribe to underlying service
    const unsubscribeService = modelManagementService.subscribeToStatus((status) => {
      setModelState(prev => ({
        ...prev,
        loadingStatus: status,
        isLoading: status.is_loading,
        currentOperation: status.is_loading && status.target_model ? {
          id: status.operation_id || 'unknown',
          modelId: status.target_model,
          startedAt: status.started_at || new Date().toISOString(),
          options: { model_id: status.target_model },
          cancellable: true,
        } : undefined,
      }));

      // Auto-refresh capabilities when loading completes successfully (Requirement 4.5)
      if (!status.is_loading && status.progress?.stage === 'complete') {
        console.log('[ModelContext] Model loading completed, refreshing capabilities');
        refreshModelInfo();
      }

      callback(status);
    });

    return () => {
      statusCallbacksRef.current.delete(callback);
      unsubscribeService();
    };
  }, [refreshModelInfo]);

  /**
   * Clear progress history
   */
  const clearProgressHistory = useCallback((): void => {
    setModelState(prev => ({
      ...prev,
      progressState: {
        ...prev.progressState,
        progressHistory: [],
      },
    }));
  }, []);

  // ===== Error Management =====

  /**
   * Clear current error
   */
  const clearError = useCallback((): void => {
    setModelState(prev => ({ ...prev, error: undefined }));
  }, []);

  /**
   * Clear error history
   */
  const clearErrorHistory = useCallback((): void => {
    setModelState(prev => ({ ...prev, errorHistory: [] }));
  }, []);

  /**
   * Get recovery suggestions for current error
   */
  const getRecoverySuggestions = useCallback((): string[] => {
    return modelState.error?.suggestions || [];
  }, [modelState.error]);

  // ===== Service Health =====

  /**
   * Check service health status
   */
  const checkServiceHealth = useCallback(async (): Promise<void> => {
    try {
      const response = await modelManagementService.checkServiceHealth();
      
      setModelState(prev => ({
        ...prev,
        serviceHealthy: response.success && response.data.status === 'healthy',
        lastHealthCheck: Date.now(),
      }));
    } catch (error) {
      setModelState(prev => ({
        ...prev,
        serviceHealthy: false,
        lastHealthCheck: Date.now(),
      }));
    }
  }, []);

  /**
   * Get connection status information
   */
  const getConnectionStatus = useCallback(() => {
    const connectionStatus = modelManagementService.getConnectionStatus();
    return {
      sseConnected: connectionStatus.sseConnected,
      loadingActive: connectionStatus.loadingActive,
      serviceHealthy: modelState.serviceHealthy,
    };
  }, [modelState.serviceHealthy]);

  // ===== Effects =====

  /**
   * Initialize model context and set up subscriptions
   */
  useEffect(() => {
    const initializeModelContext = async () => {
      try {
        // Initialize model information
        await refreshModelInfo();
        await refreshAvailableModels();
        
        // Check service health
        await checkServiceHealth();

        // Subscribe to cache invalidation events (Requirement 4.5)
        cacheInvalidationUnsubscribeRef.current = onCacheInvalidation(() => {
          console.log('[ModelContext] Cache invalidated, refreshing model information');
          refreshModelInfo();
        });

        // Set up progress and status subscriptions
        const progressUnsubscribe = subscribeToProgress(() => {
          // Progress updates are handled in the subscription
        });

        const statusUnsubscribe = subscribeToStatus(() => {
          // Status updates are handled in the subscription
        });

        return () => {
          progressUnsubscribe();
          statusUnsubscribe();
        };
        
      } catch (error) {
        console.error('[ModelContext] Failed to initialize model context:', error);
        const errorInfo = createErrorInfo(error);
        addErrorToHistory(errorInfo);
      }
    };

    initializeModelContext();

    return () => {
      if (cacheInvalidationUnsubscribeRef.current) {
        cacheInvalidationUnsubscribeRef.current();
        cacheInvalidationUnsubscribeRef.current = null;
      }
    };
  }, [refreshModelInfo, refreshAvailableModels, checkServiceHealth, subscribeToProgress, subscribeToStatus, createErrorInfo, addErrorToHistory]);

  /**
   * Set up periodic health checks
   */
  useEffect(() => {
    const startHealthChecks = () => {
      checkServiceHealth();
      
      healthCheckIntervalRef.current = setInterval(
        checkServiceHealth,
        HEALTH_CHECK_INTERVAL
      );
    };

    startHealthChecks();

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [checkServiceHealth]);

  /**
   * Update SSE connection status
   */
  useEffect(() => {
    const updateConnectionStatus = () => {
      const connectionStatus = modelManagementService.getConnectionStatus();
      setModelState(prev => ({
        ...prev,
        sseConnected: connectionStatus.sseConnected,
      }));
    };

    // Check connection status periodically
    const connectionInterval = setInterval(updateConnectionStatus, 1000);

    return () => {
      clearInterval(connectionInterval);
    };
  }, []);

  // ===== Memoized Context Value =====

  const contextValue: ModelContextValue = useMemo(() => ({
    // State
    ...modelState,

    // Actions
    loadModel,
    cancelLoading,
    retryLoading,
    refreshModelInfo,
    refreshAvailableModels,
    toggleInfoPanel,
    refreshSpeakers,
    refreshLanguages,
    refreshCapabilities,
    subscribeToProgress,
    subscribeToStatus,
    clearProgressHistory,
    clearError,
    clearErrorHistory,
    getRecoverySuggestions,
    checkServiceHealth,
    getConnectionStatus,
  }), [
    modelState,
    loadModel,
    cancelLoading,
    retryLoading,
    refreshModelInfo,
    refreshAvailableModels,
    toggleInfoPanel,
    refreshSpeakers,
    refreshLanguages,
    refreshCapabilities,
    subscribeToProgress,
    subscribeToStatus,
    clearProgressHistory,
    clearError,
    clearErrorHistory,
    getRecoverySuggestions,
    checkServiceHealth,
    getConnectionStatus,
  ]);

  return (
    <ModelContext.Provider value={contextValue}>
      {children}
    </ModelContext.Provider>
  );
}

// ===== Hook Exports =====

/**
 * Main hook to use model context
 * Must be used within a ModelProvider
 */
export function useModel(): ModelContextValue {
  const context = useContext(ModelContext);
  
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  
  return context;
}

/**
 * Hook to get current model information (Requirement 5.1)
 */
export function useCurrentModel(): {
  currentModel?: ModelMetadata;
  modelInfo?: CompleteModelInfo;
  isReady: boolean;
  isLoading: boolean;
} {
  const { currentModel, modelInfo, isModelReady, isLoading } = useModel();
  
  return {
    currentModel,
    modelInfo,
    isReady: isModelReady,
    isLoading,
  };
}

/**
 * Hook for model capabilities (Requirement 4.5)
 */
export function useModelCapabilities(): ModelCapabilitiesState & {
  refreshCapabilities: () => Promise<void>;
  refreshSpeakers: () => Promise<void>;
  refreshLanguages: () => Promise<void>;
} {
  const { capabilities, refreshCapabilities, refreshSpeakers, refreshLanguages } = useModel();
  
  return {
    ...capabilities,
    refreshCapabilities,
    refreshSpeakers,
    refreshLanguages,
  };
}

/**
 * Hook for model loading operations
 */
export function useModelLoading(): {
  isLoading: boolean;
  currentOperation?: ModelLoadingOperation;
  loadModel: (modelId: string, options?: Partial<LoadModelOptions>) => Promise<void>;
  cancelLoading: () => Promise<void>;
  retryLoading: () => Promise<void>;
} {
  const { isLoading, currentOperation, loadModel, cancelLoading, retryLoading } = useModel();
  
  return {
    isLoading,
    currentOperation,
    loadModel,
    cancelLoading,
    retryLoading,
  };
}

/**
 * Hook for progress tracking (Requirements 6.1, 6.2)
 */
export function useModelProgress(): ModelProgressState & {
  subscribeToProgress: (callback: ProgressCallback) => () => void;
  clearProgressHistory: () => void;
} {
  const { progressState, subscribeToProgress, clearProgressHistory } = useModel();
  
  return {
    ...progressState,
    subscribeToProgress,
    clearProgressHistory,
  };
}

/**
 * Hook for model information display (Requirement 5.1)
 */
export function useModelInfoDisplay(): ModelInfoDisplayState & {
  toggleInfoPanel: (show?: boolean) => void;
  refreshModelInfo: (options?: RefreshOptions) => Promise<void>;
} {
  const { infoDisplay, toggleInfoPanel, refreshModelInfo } = useModel();
  
  return {
    ...infoDisplay,
    toggleInfoPanel,
    refreshModelInfo,
  };
}

/**
 * Hook for error handling
 */
export function useModelErrors(): {
  error?: ModelErrorInfo;
  errorHistory: ModelErrorInfo[];
  clearError: () => void;
  clearErrorHistory: () => void;
  getRecoverySuggestions: () => string[];
} {
  const { error, errorHistory, clearError, clearErrorHistory, getRecoverySuggestions } = useModel();
  
  return {
    error,
    errorHistory,
    clearError,
    clearErrorHistory,
    getRecoverySuggestions,
  };
}

/**
 * Hook for service connection status
 */
export function useModelConnection(): {
  sseConnected: boolean;
  serviceHealthy: boolean;
  lastHealthCheck?: number;
  checkServiceHealth: () => Promise<void>;
  getConnectionStatus: () => {
    sseConnected: boolean;
    loadingActive: boolean;
    serviceHealthy: boolean;
  };
} {
  const { sseConnected, serviceHealthy, lastHealthCheck, checkServiceHealth, getConnectionStatus } = useModel();
  
  return {
    sseConnected,
    serviceHealthy,
    lastHealthCheck,
    checkServiceHealth,
    getConnectionStatus,
  };
}

/**
 * Hook for available models
 */
export function useAvailableModels(): {
  availableModels: ModelMetadata[];
  isLoadingModels: boolean;
  refreshAvailableModels: (force?: boolean) => Promise<void>;
} {
  const { availableModels, isLoadingModels, refreshAvailableModels } = useModel();
  
  return {
    availableModels,
    isLoadingModels,
    refreshAvailableModels,
  };
}