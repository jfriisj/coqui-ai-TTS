/**
 * ModelSelect Component for Coqui TTS Frontend
 * 
 * Dynamic model selection dropdown with rich metadata display, model grouping,
 * and confirmation dialogs for model switching. Provides comprehensive model
 * management interface with search capabilities and performance indicators.
 * 
 * Features:
 * - Searchable dropdown with model filtering and grouping
 * - Rich metadata display with capability indicators
 * - Performance metrics and quality ratings
 * - Loading time estimates and confirmation dialogs
 * - Model availability status and caching information
 * - Theme-aware styling with accessibility support
 * - Error handling with recovery suggestions
 * - Loading progress tracking and cancellation
 * 
 * Requirements:
 * - 4.1: Searchable dropdown with model organization by language/type
 * - 4.2: Model tooltips with capabilities and performance indicators
 * - 4.3: Confirmation dialog with loading time estimate
 * 
 * Leverages:
 * - ModelManagementService from task 8
 * - Existing dropdown patterns from LanguageSelect and SpeakerSelect
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  // ModelManagementService,
  ModelMetadata,
  // LoadingStatus,
  modelManagementService,
  CurrentModelInfo,
  LoadingProgress,
  LoadModelOptions,
} from '../services/modelManagementService';

// ===== Constants =====

/**
 * Model selection states
 */
const SELECTION_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  EMPTY: 'empty',
} as const;

type SelectionState = typeof SELECTION_STATES[keyof typeof SELECTION_STATES];

/**
 * Model loading states for confirmation dialog
 */
const LOADING_STATES = {
  IDLE: 'idle',
  CONFIRMING: 'confirming',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  CANCELLED: 'cancelled',
} as const;

type LoadingState = typeof LOADING_STATES[keyof typeof LOADING_STATES];

/**
 * Model grouping options
 */
const GROUPING_OPTIONS = {
  LANGUAGE: 'language',
  TYPE: 'type',
  PROVIDER: 'provider',
  NONE: 'none',
} as const;

type GroupingOption = typeof GROUPING_OPTIONS[keyof typeof GROUPING_OPTIONS];

/**
 * Performance indicator colors
 */
const PERFORMANCE_INDICATORS = {
  excellent: { color: '#22c55e', label: 'Excellent' },
  good: { color: '#f59e0b', label: 'Good' },
  fair: { color: '#f97316', label: 'Fair' },
  poor: { color: '#ef4444', label: 'Limited' },
  unknown: { color: '#9ca3af', label: 'Unknown' },
} as const;

/**
 * Model capability icons (unused but keeping for future use)
 */
// const CAPABILITY_ICONS = {
//   multi_speaker: '👥',
//   multi_lingual: '🌍',
//   voice_cloning: '🎭',
//   streaming: '⚡',
//   gst_support: '🎨',
// } as const;

// ===== Types =====

/**
 * Model group with metadata
 */
interface ModelGroup {
  /** Group identifier */
  id: string;
  /** Group display name */
  name: string;
  /** Models in this group */
  models: ModelMetadata[];
  /** Group description */
  description?: string;
}

/**
 * Model selection component state
 */
interface ModelSelectState {
  /** Available models */
  availableModels: ModelMetadata[];
  /** Currently loaded model */
  currentModel: CurrentModelInfo | null;
  /** Model selection state */
  selectionState: SelectionState;
  /** Search query for filtering */
  searchQuery: string;
  /** Selected grouping option */
  groupBy: GroupingOption;
  /** Loading error message */
  error: string | null;
  /** Loading state for model switching */
  loadingState: LoadingState;
  /** Model being loaded */
  targetModel: string | null;
  /** Loading progress information */
  loadingProgress: LoadingProgress | null;
  /** Loading error details */
  loadingError: string | null;
}

/**
 * ModelSelect component props
 */
export interface ModelSelectProps {
  /** Currently selected model ID */
  selectedModel?: string | null;
  /** Callback when model selection changes */
  onModelChange?: (modelId: string | null, modelInfo: ModelMetadata | null) => void;
  /** Callback when model loading starts */
  onLoadingStart?: (modelId: string) => void;
  /** Callback when model loading completes */
  onLoadingComplete?: (modelId: string, success: boolean) => void;
  /** Whether model selection is enabled */
  enabled?: boolean;
  /** Whether to show model tooltips */
  showTooltips?: boolean;
  /** Whether to show confirmation dialogs */
  showConfirmation?: boolean;
  /** Default grouping option */
  defaultGroupBy?: GroupingOption;
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Extract model type from model ID
 */
function extractModelType(model: ModelMetadata): string {
  const modelId = model.model_id;
  const parts = modelId.split('/');
  if (parts.length >= 3) {
    return parts[2]; // e.g., 'tacotron2' from 'tts_models/en/ljspeech/tacotron2-DDC'
  }
  return 'unknown';
}

/**
 * Extract primary language from model
 */
function extractPrimaryLanguage(model: ModelMetadata): string {
  if (model.languages.length > 0) {
    return model.languages[0];
  }
  
  // Fallback: extract from model ID
  const parts = model.model_id.split('/');
  if (parts.length >= 2 && parts[0] === 'tts_models') {
    return parts[1]; // e.g., 'en' from 'tts_models/en/ljspeech/tacotron2-DDC'
  }
  
  return 'unknown';
}

/**
 * Get performance indicator based on metrics
 */
function getPerformanceIndicator(model: ModelMetadata): {
  color: string;
  label: string;
} {
  if (!model.performance) {
    return PERFORMANCE_INDICATORS.unknown;
  }
  
  const { avg_latency_ms, quality_score } = model.performance;
  
  // Consider both latency and quality
  if (quality_score && quality_score >= 0.9 && avg_latency_ms < 1000) {
    return PERFORMANCE_INDICATORS.excellent;
  } else if (quality_score && quality_score >= 0.7 && avg_latency_ms < 2000) {
    return PERFORMANCE_INDICATORS.good;
  } else if (quality_score && quality_score >= 0.5 && avg_latency_ms < 5000) {
    return PERFORMANCE_INDICATORS.fair;
  } else if (avg_latency_ms > 5000 || (quality_score && quality_score < 0.5)) {
    return PERFORMANCE_INDICATORS.poor;
  }
  
  return PERFORMANCE_INDICATORS.unknown;
}

/**
 * Estimate loading time based on model size and caching
 */
function estimateLoadingTime(model: ModelMetadata): string {
  const sizeMB = model.size_mb;
  const isCached = model.cache_info?.is_cached || false;
  
  if (isCached) {
    return '< 30 seconds';
  }
  
  if (sizeMB < 100) {
    return '1-2 minutes';
  } else if (sizeMB < 500) {
    return '2-5 minutes';
  } else if (sizeMB < 1000) {
    return '5-10 minutes';
  } else {
    return '10+ minutes';
  }
}

/**
 * Group models by specified criteria
 */
function groupModels(models: ModelMetadata[], groupBy: GroupingOption): ModelGroup[] {
  // Handle undefined or null models array
  if (!models || !Array.isArray(models)) {
    return [{
      id: 'all',
      name: 'All Models',
      models: [],
      description: 'No models available',
    }];
  }

  if (groupBy === GROUPING_OPTIONS.NONE) {
    return [{
      id: 'all',
      name: 'All Models',
      models,
      description: 'All available models',
    }];
  }
  
  const groups = new Map<string, ModelMetadata[]>();
  
  models.forEach(model => {
    let groupKey: string;
    
    switch (groupBy) {
      case GROUPING_OPTIONS.LANGUAGE:
        groupKey = extractPrimaryLanguage(model);
        break;
      case GROUPING_OPTIONS.TYPE:
        groupKey = extractModelType(model);
        break;
      case GROUPING_OPTIONS.PROVIDER:
        groupKey = model.provider || 'Coqui';
        break;
      default:
        groupKey = 'unknown';
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(model);
  });
  
  return Array.from(groups.entries()).map(([key, groupModels]) => ({
    id: key,
    name: formatGroupName(key, groupBy),
    models: groupModels.sort((a, b) => a.display_name.localeCompare(b.display_name)),
    description: getGroupDescription(key, groupBy),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Format group name for display
 */
function formatGroupName(key: string, groupBy: GroupingOption): string {
  switch (groupBy) {
    case GROUPING_OPTIONS.LANGUAGE:
      return key.toUpperCase(); // e.g., 'EN', 'ES'
    case GROUPING_OPTIONS.TYPE:
      return key.charAt(0).toUpperCase() + key.slice(1); // e.g., 'Tacotron2'
    case GROUPING_OPTIONS.PROVIDER:
      return key;
    default:
      return key;
  }
}

/**
 * Get group description
 */
function getGroupDescription(key: string, groupBy: GroupingOption): string {
  switch (groupBy) {
    case GROUPING_OPTIONS.LANGUAGE:
      return `Models for ${key.toUpperCase()} language`;
    case GROUPING_OPTIONS.TYPE:
      return `${key.charAt(0).toUpperCase() + key.slice(1)} architecture models`;
    case GROUPING_OPTIONS.PROVIDER:
      return `Models from ${key}`;
    default:
      return '';
  }
}

/**
 * Filter models based on search query
 */
function filterModels(models: ModelMetadata[], query: string): ModelMetadata[] {
  // Handle undefined or null models array
  if (!models || !Array.isArray(models)) {
    return [];
  }
  
  if (!query.trim()) {
    return models;
  }
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  
  return models.filter(model => {
    const searchableText = [
      model.display_name,
      model.description || '',
      model.model_id,
      ...model.languages,
      ...model.speakers,
      ...(model.tags || []),
    ].join(' ').toLowerCase();
    
    return searchTerms.every(term => searchableText.includes(term));
  });
}

// ===== ModelSelect Component =====

/**
 * ModelSelect component with dynamic model management
 * 
 * Provides comprehensive model selection interface with rich metadata,
 * grouping capabilities, and confirmation dialogs.
 */
export function ModelSelect({
  // selectedModel = null, // Commented out as it's never used
  onModelChange,
  onLoadingStart,
  onLoadingComplete,
  enabled = true,
  showTooltips = true,
  showConfirmation = true,
  defaultGroupBy = GROUPING_OPTIONS.LANGUAGE,
  className = "",
}: ModelSelectProps): JSX.Element {
  const { theme } = useTheme();
  
  const [selectState, setSelectState] = useState<ModelSelectState>({
    availableModels: [],
    currentModel: null,
    selectionState: SELECTION_STATES.LOADING,
    searchQuery: '',
    groupBy: defaultGroupBy,
    error: null,
    loadingState: LOADING_STATES.IDLE,
    targetModel: null,
    loadingProgress: null,
    loadingError: null,
  });
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTooltip, setSelectedTooltip] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const unsubscribeProgressRef = useRef<(() => void) | null>(null);
  
  /**
   * Load available models and current model
   */
  const loadModels = useCallback(async () => {
    setSelectState(prev => ({
      ...prev,
      selectionState: SELECTION_STATES.LOADING,
      error: null,
    }));
    
    try {
      const [availableResponse, currentResponse] = await Promise.all([
        modelManagementService.getAvailableModels(),
        modelManagementService.getCurrentModel(),
      ]);
      
      if (availableResponse.success && currentResponse.success) {
        const availableModels = availableResponse.data;
        const currentModel = currentResponse.data;
        
        setSelectState(prev => ({
          ...prev,
          availableModels,
          currentModel,
          selectionState: availableModels.length > 0 ? SELECTION_STATES.READY : SELECTION_STATES.EMPTY,
        }));
      } else {
        const error = !availableResponse.success 
          ? availableResponse.error.error 
          : !currentResponse.success ? currentResponse.error.error : 'Unknown error';
        
        setSelectState(prev => ({
          ...prev,
          selectionState: SELECTION_STATES.ERROR,
          error: error || 'Failed to load models',
        }));
      }
    } catch (error) {
      setSelectState(prev => ({
        ...prev,
        selectionState: SELECTION_STATES.ERROR,
        error: error instanceof Error ? error.message : 'Failed to load models',
      }));
    }
  }, []);
  
  /**
   * Handle model selection with confirmation
   */
  const handleModelSelection = useCallback(async (modelId: string) => {
    const model = selectState.availableModels.find(m => m.model_id === modelId);
    if (!model) return;
    
    // Close dropdown
    setIsDropdownOpen(false);
    
    // Check if model is already loaded
    if (selectState.currentModel?.model?.model_id === modelId) {
      onModelChange?.(modelId, model);
      return;
    }
    
    // Show confirmation dialog if enabled
    if (showConfirmation) {
      setSelectState(prev => ({
        ...prev,
        loadingState: LOADING_STATES.CONFIRMING,
        targetModel: modelId,
        loadingProgress: null,
        loadingError: null,
      }));
    } else {
      // Load model immediately
      await loadModel(modelId, model);
    }
  }, [selectState.availableModels, selectState.currentModel, onModelChange, showConfirmation]);
  
  /**
   * Load a specific model
   */
  const loadModel = useCallback(async (modelId: string, model: ModelMetadata) => {
    setSelectState(prev => ({
      ...prev,
      loadingState: LOADING_STATES.LOADING,
      targetModel: modelId,
      loadingProgress: null,
      loadingError: null,
    }));
    
    onLoadingStart?.(modelId);
    
    try {
      // Subscribe to progress updates
      unsubscribeProgressRef.current = modelManagementService.subscribeToProgress(
        (progress: LoadingProgress) => {
          setSelectState(prev => ({
            ...prev,
            loadingProgress: progress,
          }));
        }
      );
      
      const options: LoadModelOptions = {
        model_id: modelId,
        force_reload: false,
        timeout: 10 * 60 * 1000, // 10 minutes
      };
      
      const response = await modelManagementService.loadModel(options);
      
      if (response.success) {
        // Poll for completion
        await modelManagementService.pollLoadingStatus();
        
        // Update current model
        const currentResponse = await modelManagementService.getCurrentModel();
        if (currentResponse.success) {
          setSelectState(prev => ({
            ...prev,
            currentModel: currentResponse.data,
            loadingState: LOADING_STATES.SUCCESS,
            loadingProgress: null,
          }));
          
          onModelChange?.(modelId, model);
          onLoadingComplete?.(modelId, true);
          
          // Hide success state after delay
          setTimeout(() => {
            setSelectState(prev => ({
              ...prev,
              loadingState: LOADING_STATES.IDLE,
              targetModel: null,
            }));
          }, 2000);
        }
      } else {
        throw new Error(response.error.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Model loading failed';
      
      setSelectState(prev => ({
        ...prev,
        loadingState: LOADING_STATES.ERROR,
        loadingError: errorMessage,
        loadingProgress: null,
      }));
      
      onLoadingComplete?.(modelId, false);
    } finally {
      // Clean up progress subscription
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current();
        unsubscribeProgressRef.current = null;
      }
    }
  }, [onLoadingStart, onLoadingComplete, onModelChange]);
  
  /**
   * Cancel model loading
   */
  const cancelLoading = useCallback(async () => {
    try {
      await modelManagementService.cancelLoading();
      
      setSelectState(prev => ({
        ...prev,
        loadingState: LOADING_STATES.CANCELLED,
        loadingProgress: null,
      }));
      
      // Clean up progress subscription
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current();
        unsubscribeProgressRef.current = null;
      }
      
      // Reset state after delay
      setTimeout(() => {
        setSelectState(prev => ({
          ...prev,
          loadingState: LOADING_STATES.IDLE,
          targetModel: null,
        }));
      }, 1000);
    } catch (error) {
      console.error('Failed to cancel loading:', error);
    }
  }, []);
  
  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((query: string) => {
    setSelectState(prev => ({
      ...prev,
      searchQuery: query,
    }));
  }, []);
  
  /**
   * Handle grouping change
   */
  const handleGroupingChange = useCallback((groupBy: GroupingOption) => {
    setSelectState(prev => ({
      ...prev,
      groupBy,
    }));
  }, []);
  
  /**
   * Handle clicks outside dropdown to close it
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
      setSelectedTooltip(null);
    }
  }, []);
  
  /**
   * Load models on component mount
   */
  useEffect(() => {
    loadModels();
  }, [loadModels]);
  
  /**
   * Setup click outside handler
   */
  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, handleClickOutside]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current();
      }
    };
  }, []);
  
  // Calculate filtered and grouped models
  const filteredModels = useMemo(() => 
    filterModels(selectState.availableModels, selectState.searchQuery),
    [selectState.availableModels, selectState.searchQuery]
  );
  
  const modelGroups = useMemo(() => 
    groupModels(filteredModels, selectState.groupBy),
    [filteredModels, selectState.groupBy]
  );
  
  // Component state calculations
  const { 
    selectionState, 
    currentModel, 
    error, 
    loadingState, 
    targetModel, 
    loadingProgress, 
    loadingError 
  } = selectState;
  const isLoading = selectionState === SELECTION_STATES.LOADING;
  const hasError = selectionState === SELECTION_STATES.ERROR;
  const isEmpty = selectionState === SELECTION_STATES.EMPTY;
  const isModelLoading = loadingState === LOADING_STATES.LOADING;
  const isConfirming = loadingState === LOADING_STATES.CONFIRMING;
  const hasLoadingError = loadingState === LOADING_STATES.ERROR;
  
  return (
    <div 
      className={`model-select ${className}`}
      style={{
        width: '100%',
        marginBottom: '1rem',
        position: 'relative',
      }}
    >
      {/* Label */}
      <label 
        htmlFor="model-select-dropdown"
        style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: theme.colors.text,
          marginBottom: '0.5rem',
        }}
      >
        Model Selection
        {currentModel?.model && (
          <span style={{
            marginLeft: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 400,
            color: theme.colors.textSecondary,
          }}>
            (Currently: {currentModel.model.display_name})
          </span>
        )}
      </label>
      
      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '6px',
            color: theme.colors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid transparent',
              borderTop: `2px solid ${theme.colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span>Loading models...</span>
        </div>
      )}
      
      {/* Error State */}
      {hasError && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}
          role="alert"
        >
          <strong>Error:</strong> {error}
          <button
            onClick={loadModels}
            style={{
              marginLeft: '0.5rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Empty State */}
      {isEmpty && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '6px',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>No Models Available</div>
          <div style={{ fontSize: '0.875rem' }}>Check your TTS server configuration</div>
        </div>
      )}
      
      {/* Model Selection Interface */}
      {selectionState === SELECTION_STATES.READY && (
        <div>
          {/* Search and Grouping Controls */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}>
            {/* Search Input */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search models..."
                value={selectState.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.secondary}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                }}
              />
            </div>
            
            {/* Grouping Select */}
            <select
              value={selectState.groupBy}
              onChange={(e) => handleGroupingChange(e.target.value as GroupingOption)}
              style={{
                padding: '0.5rem',
                fontSize: '0.875rem',
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '4px',
                color: theme.colors.text,
                cursor: 'pointer',
              }}
            >
              <option value={GROUPING_OPTIONS.LANGUAGE}>Group by Language</option>
              <option value={GROUPING_OPTIONS.TYPE}>Group by Type</option>
              <option value={GROUPING_OPTIONS.PROVIDER}>Group by Provider</option>
              <option value={GROUPING_OPTIONS.NONE}>No Grouping</option>
            </select>
          </div>
          
          {/* Model Dropdown */}
          <div
            ref={dropdownRef}
            style={{
              position: 'relative',
              width: '100%',
            }}
          >
            {/* Dropdown Button */}
            <button
              id="model-select-dropdown"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={!enabled}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '6px',
                color: theme.colors.text,
                cursor: enabled ? 'pointer' : 'not-allowed',
                opacity: enabled ? 1 : 0.6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.875rem',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {currentModel?.model && (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: getPerformanceIndicator(currentModel.model).color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span>
                  {currentModel?.model?.display_name || 'Select a model...'}
                </span>
              </div>
              
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            {/* Dropdown Options */}
            {isDropdownOpen && (
              <div
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  marginTop: '4px',
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.secondary}`,
                  borderRadius: '6px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  boxShadow: theme.mode === 'dark' 
                    ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
                    : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                }}
              >
                {modelGroups.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: theme.colors.textSecondary,
                  }}>
                    No models match your search
                  </div>
                ) : (
                  modelGroups.map(group => (
                    <div key={group.id}>
                      {/* Group Header */}
                      {selectState.groupBy !== GROUPING_OPTIONS.NONE && (
                        <div
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: theme.mode === 'dark' 
                              ? 'rgba(255, 255, 255, 0.05)' 
                              : 'rgba(0, 0, 0, 0.05)',
                            borderBottom: `1px solid ${theme.colors.secondary}`,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: theme.colors.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {group.name} ({group.models.length})
                        </div>
                      )}
                      
                      {/* Group Models */}
                      {group.models.map(model => {
                        const isSelected = currentModel?.model?.model_id === model.model_id;
                        const isAvailable = model.available;
                        const performanceIndicator = getPerformanceIndicator(model);
                        
                        return (
                          <div
                            key={model.model_id}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => isAvailable && handleModelSelection(model.model_id)}
                            onMouseEnter={() => showTooltips && setSelectedTooltip(model.model_id)}
                            onMouseLeave={() => setSelectedTooltip(null)}
                            style={{
                              padding: '0.75rem 1rem',
                              backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                              color: isSelected ? '#ffffff' : theme.colors.text,
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              opacity: isAvailable ? 1 : 0.5,
                              borderBottom: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              transition: 'background-color 0.15s ease',
                              position: 'relative',
                            }}
                          >
                            {/* Performance Indicator */}
                            <div
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: performanceIndicator.color,
                                flexShrink: 0,
                              }}
                            />
                            
                            {/* Model Info */}
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: isSelected ? 600 : 500,
                                marginBottom: '0.25rem',
                              }}>
                                {model.display_name}
                              </div>
                              
                              <div style={{
                                fontSize: '0.75rem',
                                opacity: 0.8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexWrap: 'wrap',
                              }}>
                                {/* Model Size */}
                                <span>{model.size_mb.toFixed(0)} MB</span>
                                
                                {/* Languages */}
                                {model.languages.length > 0 && (
                                  <span>
                                    {model.languages.slice(0, 3).join(', ')}
                                    {model.languages.length > 3 && ` +${model.languages.length - 3}`}
                                  </span>
                                )}
                                
                                {/* Capabilities */}
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  {model.capabilities.multi_speaker && (
                                    <span title="Multi-speaker support">👥</span>
                                  )}
                                  {model.capabilities.multi_lingual && (
                                    <span title="Multi-lingual support">🌍</span>
                                  )}
                                  {model.capabilities.voice_cloning && (
                                    <span title="Voice cloning support">🎭</span>
                                  )}
                                  {model.capabilities.streaming && (
                                    <span title="Streaming support">⚡</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Cached Indicator */}
                            {model.cache_info?.is_cached && (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#22c55e',
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(34, 197, 94, 0.2)',
                                }}
                              >
                                Cached
                              </div>
                            )}
                            
                            {/* Tooltip */}
                            {showTooltips && selectedTooltip === model.model_id && (
                              <div
                                ref={tooltipRef}
                                style={{
                                  position: 'absolute',
                                  left: '100%',
                                  top: 0,
                                  marginLeft: '0.5rem',
                                  width: '300px',
                                  padding: '0.75rem',
                                  backgroundColor: theme.colors.surface,
                                  border: `1px solid ${theme.colors.secondary}`,
                                  borderRadius: '6px',
                                  boxShadow: theme.mode === 'dark' 
                                    ? '0 10px 15px -5px rgba(0, 0, 0, 0.3)'
                                    : '0 10px 15px -5px rgba(0, 0, 0, 0.1)',
                                  fontSize: '0.75rem',
                                  color: theme.colors.text,
                                  zIndex: 60,
                                }}
                              >
                                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                  {model.display_name}
                                </div>
                                
                                {model.description && (
                                  <div style={{ marginBottom: '0.5rem', opacity: 0.8 }}>
                                    {model.description}
                                  </div>
                                )}
                                
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div><strong>Size:</strong> {model.size_mb.toFixed(0)} MB</div>
                                  <div><strong>Languages:</strong> {model.languages.join(', ') || 'N/A'}</div>
                                  <div><strong>Speakers:</strong> {model.speakers.length || 'Single'}</div>
                                  {model.performance && (
                                    <>
                                      <div><strong>Avg Latency:</strong> {model.performance.avg_latency_ms}ms</div>
                                      {model.performance.quality_score && (
                                        <div><strong>Quality:</strong> {(model.performance.quality_score * 100).toFixed(0)}%</div>
                                      )}
                                    </>
                                  )}
                                  <div><strong>Est. Load Time:</strong> {estimateLoadingTime(model)}</div>
                                </div>
                                
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem',
                                }}>
                                  <div
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      backgroundColor: performanceIndicator.color,
                                    }}
                                  />
                                  <span><strong>Performance:</strong> {performanceIndicator.label}</span>
                                </div>
                                
                                <div style={{ 
                                  fontSize: '0.6875rem',
                                  opacity: 0.7,
                                  borderTop: `1px solid ${theme.colors.secondary}`,
                                  paddingTop: '0.5rem',
                                }}>
                                  <strong>Capabilities:</strong>
                                  <div style={{ marginTop: '0.25rem' }}>
                                    {model.capabilities.multi_speaker && '• Multi-speaker\n'}
                                    {model.capabilities.multi_lingual && '• Multi-lingual\n'}
                                    {model.capabilities.voice_cloning && '• Voice cloning\n'}
                                    {model.capabilities.streaming && '• Streaming synthesis\n'}
                                    {model.capabilities.gst_support && '• Global Style Tokens\n'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      {isConfirming && targetModel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.surface,
              padding: '1.5rem',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.secondary}`,
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            {(() => {
              const model = selectState.availableModels.find(m => m.model_id === targetModel);
              const estimatedTime = model ? estimateLoadingTime(model) : 'Unknown';
              
              return (
                <>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}>
                    Load Model?
                  </h3>
                  
                  <div style={{
                    marginBottom: '1rem',
                    color: theme.colors.textSecondary,
                    lineHeight: '1.5',
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      Load <strong>{model?.display_name || targetModel}</strong>?
                    </p>
                    
                    {model && (
                      <div style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
                        <div><strong>Size:</strong> {model.size_mb.toFixed(0)} MB</div>
                        <div><strong>Estimated loading time:</strong> {estimatedTime}</div>
                        {model.cache_info?.is_cached && (
                          <div style={{ color: '#22c55e' }}>
                            <strong>✓ Model is cached</strong> - will load faster
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={() => setSelectState(prev => ({ ...prev, loadingState: LOADING_STATES.IDLE }))}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.secondary}`,
                        borderRadius: '4px',
                        color: theme.colors.text,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={() => model && loadModel(targetModel, model)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: theme.colors.primary,
                        border: 'none',
                        borderRadius: '4px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                      }}
                    >
                      Load Model
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* Loading Progress Dialog */}
      {isModelLoading && targetModel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.surface,
              padding: '1.5rem',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.secondary}`,
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            {(() => {
              const model = selectState.availableModels.find(m => m.model_id === targetModel);
              
              return (
                <>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}>
                    Loading Model
                  </h3>
                  
                  <div style={{
                    marginBottom: '1rem',
                    color: theme.colors.textSecondary,
                  }}>
                    <p style={{ margin: '0 0 0.75rem 0' }}>
                      Loading <strong>{model?.display_name || targetModel}</strong>...
                    </p>
                    
                    {loadingProgress && (
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          marginBottom: '0.5rem',
                          color: theme.colors.text,
                        }}>
                          {loadingProgress.message}
                        </div>
                        
                        {/* Progress Bar */}
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <div
                            style={{
                              width: `${loadingProgress.progress}%`,
                              height: '100%',
                              backgroundColor: theme.colors.primary,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.75rem',
                          opacity: 0.8,
                        }}>
                          <span>{loadingProgress.progress.toFixed(0)}%</span>
                          {loadingProgress.eta_seconds && (
                            <span>ETA: {Math.ceil(loadingProgress.eta_seconds)}s</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={cancelLoading}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#ef4444',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* Loading Error Dialog */}
      {hasLoadingError && targetModel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.surface,
              padding: '1.5rem',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.secondary}`,
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#ef4444',
            }}>
              Loading Failed
            </h3>
            
            <div style={{
              marginBottom: '1rem',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                Failed to load model. Please try again.
              </p>
              
              {loadingError && (
                <div style={{
                  fontSize: '0.875rem',
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                }}>
                  {loadingError}
                </div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setSelectState(prev => ({ ...prev, loadingState: LOADING_STATES.IDLE }))}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.secondary}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  const model = selectState.availableModels.find(m => m.model_id === targetModel);
                  if (model) loadModel(targetModel, model);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: theme.colors.primary,
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Results Summary */}
      {selectionState === SELECTION_STATES.READY && (
        <div style={{
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
          marginTop: '0.5rem',
        }}>
          {filteredModels.length === selectState.availableModels.length ? (
            `${selectState.availableModels.length} models available`
          ) : (
            `${filteredModels.length} of ${selectState.availableModels.length} models shown`
          )}
          {selectState.searchQuery && (
            <span> • Filtered by "{selectState.searchQuery}"</span>
          )}
        </div>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ===== Export =====

export default ModelSelect;
