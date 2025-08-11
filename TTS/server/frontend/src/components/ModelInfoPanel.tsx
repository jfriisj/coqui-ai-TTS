/**
 * ModelInfoPanel Component for Coqui TTS Frontend
 *
 * Enhanced component that displays comprehensive information about the currently loaded TTS model,
 * with dynamic model management integration and real-time updates. Features advanced model information
 * display, performance monitoring, and interactive capabilities management.
 *
 * Key Features:
 * - Dynamic model information with real-time updates via ModelManagementService
 * - Performance characteristics display (latency, memory, GPU usage, quality)
 * - Visual capability indicators with contextual information
 * - Speaker and language information with expandable details
 * - Manual and automatic refresh with data freshness indicators
 * - Loading states and error handling with retry mechanisms
 * - Theme-aware styling and accessibility features
 * - Integration with dynamic model selection system
 *
 * Requirements:
 * - 5.1: Current model name and basic info with default collapsed state
 * - 5.2: Performance characteristics display (latency, memory, GPU usage, quality)
 * - 5.3: Model capabilities as visual indicators/badges
 * - 5.4: Speaker/language information with expandable details
 * - 5.5: Manual refresh functionality with data freshness indicators
 * - 5.6: Auto-refresh with configurable intervals and loading states
 *
 * Integrates with:
 * - ModelManagementService for enhanced model information
 * - Dynamic model selection system for seamless model switching
 * - Theme context for consistent styling
 * - Accessibility features for screen readers and keyboard navigation
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '../contexts/ThemeContext';
import { CompleteModelInfo, modelService } from '../services/modelService';
import {
    CurrentModelInfo,
    ModelManagementService,
    modelManagementService,
    ModelMetadata
} from '../services/modelManagementService';

// ===== Constants =====

/**
 * Refresh configuration for auto-refresh and data freshness
 */
const REFRESH_CONFIG = {
    /** Auto-refresh interval in milliseconds (5 minutes) */
    AUTO_REFRESH_INTERVAL: 5 * 60 * 1000,
    /** Manual refresh timeout */
    REFRESH_TIMEOUT: 10000,
    /** Data freshness threshold for warning display (2 minutes) */
    DATA_FRESHNESS_THRESHOLD: 2 * 60 * 1000,
    /** Live time display update interval (10 seconds) */
    TIME_UPDATE_INTERVAL: 10 * 1000,
} as const;

/**
 * Performance metrics display thresholds
 */
const PERFORMANCE_THRESHOLDS = {
    LATENCY: {
        EXCELLENT: 100, // ms
        GOOD: 300,
        POOR: 1000,
    },
    MEMORY: {
        LOW: 1024, // MB
        MEDIUM: 2048,
        HIGH: 4096,
    },
    GPU: {
        LOW: 30, // %
        MEDIUM: 70,
        HIGH: 90,
    },
    QUALITY: {
        EXCELLENT: 0.9,
        GOOD: 0.7,
        POOR: 0.5,
    },
} as const;

// ===== Types =====

/**
 * ModelInfoPanel component props
 */
export interface ModelInfoPanelProps {
    /** Whether to show detailed configuration by default */
    defaultExpanded?: boolean;
    /** Whether to enable auto-refresh */
    enableAutoRefresh?: boolean;
    /** Custom refresh interval in milliseconds */
    refreshInterval?: number;
    /** Additional CSS class name */
    className?: string;
    /** Callback when refresh is triggered */
    onRefresh?: (modelInfo?: CompleteModelInfo) => void;
    /** Optional model management service instance */
    modelManagementService?: ModelManagementService;
    /** Whether to show advanced performance metrics */
    showAdvancedMetrics?: boolean;
    /** Whether to enable real-time updates */
    enableRealTimeUpdates?: boolean;
}

// ===== ModelInfoPanel Component =====

/**
 * ModelInfoPanel component with comprehensive model information display
 */
export function ModelInfoPanel({
                                   defaultExpanded = false,
                                   enableAutoRefresh = true,
                                   refreshInterval = REFRESH_CONFIG.AUTO_REFRESH_INTERVAL,
                                   className = "",
                                   onRefresh,
                                   modelManagementService: customModelService,
                                   showAdvancedMetrics = true,
                                                                        // enableRealTimeUpdates = true,
                               }: ModelInfoPanelProps): JSX.Element {
    const {theme} = useTheme();
    const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
    const managementService = customModelService || modelManagementService;
    const refreshTimeoutRef = useRef<number | null>(null);
    const freshnessTimeoutRef = useRef<number | null>(null);
    const refreshIntervalRef = useRef<number | null>(null);
    const timeUpdateIntervalRef = useRef<number | null>(null);

    // State management
    const [modelInfo, setModelInfo] = useState<CompleteModelInfo | null>(null);
    const [currentModelInfo, setCurrentModelInfo] = useState<CurrentModelInfo | null>(null);
    const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [refreshCount, setRefreshCount] = useState<number>(0);
    const [dataFreshness, setDataFreshness] = useState<'fresh' | 'stale' | 'error'>('fresh');
    const [timeDisplayTrigger, setTimeDisplayTrigger] = useState<number>(0);

    /**
     * Fetch model information from both services (legacy and new)
     */
    const fetchModelInfo = useCallback(async (showRefreshingState: boolean = false) => {
        if (showRefreshingState) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            // Fetch from both legacy service and new management service
            const [legacyResult, currentModelResult] = await Promise.allSettled([
                modelService.getModelInfo(),
                managementService.getCurrentModel()
            ]);

            // Process legacy service result
            if (legacyResult.status === 'fulfilled' && legacyResult.value.success) {
                setModelInfo(legacyResult.value.data);
            } else {
                console.warn('Legacy model service failed:', 
                    legacyResult.status === 'rejected' ? legacyResult.reason : 
                        legacyResult.value.success ? 'Unknown error' : legacyResult.value.error.error);
            }

            // Process new management service result
            if (currentModelResult.status === 'fulfilled' && currentModelResult.value.success) {
                const currentModel = currentModelResult.value.data;
                setCurrentModelInfo(currentModel);
                setModelMetadata(currentModel.model || null);
            } else {
                console.warn('Model management service failed:',
                    currentModelResult.status === 'rejected' ? currentModelResult.reason :
                        currentModelResult.value.success ? 'Unknown error (success but no model)' : currentModelResult.value.error.error);
            }

            setLastRefreshTime(new Date());
            setRefreshCount(prev => prev + 1);
            setDataFreshness('fresh');

            // Set up freshness tracking
            if (freshnessTimeoutRef.current) {
                clearTimeout(freshnessTimeoutRef.current);
            }
            freshnessTimeoutRef.current = window.setTimeout(() => {
                setDataFreshness('stale');
            }, REFRESH_CONFIG.DATA_FRESHNESS_THRESHOLD);

            // Trigger onRefresh callback if provided
            if (onRefresh) {
                onRefresh();
            }

        } catch (err) {
            console.error('Failed to fetch model information:', err);
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            setDataFreshness('error');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [onRefresh, managementService]);

    /**
     * Manual refresh handler
     */
    const handleManualRefresh = useCallback(async () => {
        await fetchModelInfo(true);
    }, [fetchModelInfo]);

    /**
     * Toggle expanded view
     */
    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    /**
     * Initial load effect
     */
    useEffect(() => {
        fetchModelInfo();
    }, [fetchModelInfo]);

    /**
     * Auto-refresh effect
     */
    useEffect(() => {
        if (enableAutoRefresh && refreshInterval > 0) {
            refreshIntervalRef.current = window.setInterval(() => {
                fetchModelInfo(false);
            }, refreshInterval);

            return () => {
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                }
            };
        }
    }, [enableAutoRefresh, refreshInterval, fetchModelInfo]);

    /**
     * Time display update effect for live relative time
     */
    useEffect(() => {
        if (lastRefreshTime) {
            timeUpdateIntervalRef.current = window.setInterval(() => {
                setTimeDisplayTrigger(prev => prev + 1);
            }, REFRESH_CONFIG.TIME_UPDATE_INTERVAL);

            return () => {
                if (timeUpdateIntervalRef.current) {
                    clearInterval(timeUpdateIntervalRef.current);
                }
            };
        }
    }, [lastRefreshTime]);

    /**
     * Clean up intervals and timeouts on unmount
     */
    useEffect(() => {
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            if (freshnessTimeoutRef.current) {
                clearTimeout(freshnessTimeoutRef.current);
            }
            if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
            }
        };
    }, []);

    /**
     * Calculate time since last refresh for display with live updates
     */
    const timeSinceRefresh = useMemo(() => {
        if (!lastRefreshTime) return null;

        const now = new Date();
        const diffMs = now.getTime() - lastRefreshTime.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);

        if (diffSeconds < 60) {
            return `${diffSeconds}s ago`;
        } else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            return `${minutes}m ago`;
        } else {
            const hours = Math.floor(diffSeconds / 3600);
            return `${hours}h ago`;
        }
    }, [lastRefreshTime, timeDisplayTrigger]);

    /**
     * Get freshness status with visual indicator
     */
    const freshnessStatus = useMemo(() => {
        switch (dataFreshness) {
            case 'fresh':
                return {color: '#10b981', icon: '🟢', label: 'Up to date'};
            case 'stale':
                return {color: '#f59e0b', icon: '🟡', label: 'Data may be outdated'};
            case 'error':
                return {color: '#ef4444', icon: '🔴', label: 'Error loading data'};
            default:
                return {color: theme.colors.textSecondary, icon: '⚪', label: 'Unknown'};
        }
    }, [dataFreshness, theme.colors.textSecondary]);

    /**
     * Enhanced model display name with version and provider
     */
    const displayModelName = useMemo(() => {
        if (modelMetadata) {
            let name = modelMetadata.display_name || modelMetadata.model_id;
            if (modelMetadata.version) {
                name += ` v${modelMetadata.version}`;
            }
            if (modelMetadata.provider) {
                name += ` (${modelMetadata.provider})`;
            }
            return name;
        }
        return (modelInfo as any)?.model_name || 'No model loaded';
    }, [modelMetadata, modelInfo]);

    /**
     * Performance metrics display data with advanced calculations
     */
    const performanceMetrics = useMemo(() => {
        const metadata = modelMetadata?.performance || {};
        const memoryUsage = currentModelInfo?.memory_usage_mb || (metadata as any)?.memory_usage_mb;

        const getLatencyLevel = (latency?: number) => {
            if (!latency) return 'unknown';
            if (latency < PERFORMANCE_THRESHOLDS.LATENCY.EXCELLENT) return 'excellent';
            if (latency < PERFORMANCE_THRESHOLDS.LATENCY.GOOD) return 'good';
            return 'poor';
        };

        const getMemoryLevel = (memory?: number) => {
            if (!memory) return 'unknown';
            if (memory < PERFORMANCE_THRESHOLDS.MEMORY.LOW) return 'low';
            if (memory < PERFORMANCE_THRESHOLDS.MEMORY.MEDIUM) return 'medium';
            return 'high';
        };

        const getGpuLevel = (gpu?: number) => {
            if (!gpu) return 'unknown';
            if (gpu < PERFORMANCE_THRESHOLDS.GPU.LOW) return 'low';
            if (gpu < PERFORMANCE_THRESHOLDS.GPU.MEDIUM) return 'medium';
            return 'high';
        };

        const getQualityLevel = (quality?: number) => {
            if (!quality) return 'unknown';
            if (quality >= PERFORMANCE_THRESHOLDS.QUALITY.EXCELLENT) return 'excellent';
            if (quality >= PERFORMANCE_THRESHOLDS.QUALITY.GOOD) return 'good';
            return 'poor';
        };

        return {
            latency: {
                value: (metadata as any)?.avg_latency_ms,
                level: getLatencyLevel((metadata as any)?.avg_latency_ms),
                unit: 'ms'
            },
            memory: {
                value: memoryUsage,
                level: getMemoryLevel(memoryUsage),
                unit: 'MB'
            },
            gpu: {
                value: (metadata as any)?.gpu_utilization,
                level: getGpuLevel((metadata as any)?.gpu_utilization),
                unit: '%'
            },
            quality: {
                value: (metadata as any)?.quality_score,
                level: getQualityLevel((metadata as any)?.quality_score),
                unit: ''
            },
            realtime: {
                value: modelMetadata?.capabilities?.realtime_factor,
                level: 'neutral',
                unit: 'x'
            }
        };
    }, [modelMetadata, currentModelInfo]);

    /**
     * Enhanced capability indicators with contextual information
     */
    const capabilityInfo = useMemo(() => {
        const legacyCaps = modelInfo;
        const newCaps = modelMetadata?.capabilities;

        return {
            multiSpeaker: {
                enabled: newCaps?.multi_speaker ?? legacyCaps?.is_multi_speaker ?? false,
                count: modelMetadata?.speakers?.length ?? legacyCaps?.speakers?.length ?? 0,
                icon: '👥',
                label: 'Multi-Speaker'
            },
            multiLingual: {
                enabled: newCaps?.multi_lingual ?? legacyCaps?.is_multi_lingual ?? false,
                count: modelMetadata?.languages?.length ?? legacyCaps?.languages?.length ?? 0,
                icon: '🌐',
                label: 'Multi-Lingual'
            },
            voiceCloning: {
                enabled: newCaps?.voice_cloning ?? legacyCaps?.supports_cloning ?? false,
                icon: '🎭',
                label: 'Voice Cloning'
            },
            styleTransfer: {
                enabled: newCaps?.gst_support ?? legacyCaps?.use_gst ?? false,
                icon: '🎨',
                label: 'Style Transfer'
            },
            streaming: {
                enabled: newCaps?.streaming ?? false,
                icon: '⚡',
                label: 'Streaming'
            }
        };
    }, [modelInfo, modelMetadata]);

    /**
     * Performance metric color helper
     */
    const getPerformanceColor = useCallback((level: string) => {
        switch (level) {
            case 'excellent':
                return '#10b981';
            case 'good':
                return '#3b82f6';
            case 'medium':
                return '#f59e0b';
            case 'poor':
            case 'high':
                return '#ef4444';
            case 'low':
                return '#10b981';
            case 'unknown':
                return theme.colors.textSecondary;
            default:
                return theme.colors.textSecondary;
        }
    }, [theme.colors.textSecondary]);

    return (
        <div
            className={`model-info-panel ${className}`}
            style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            {/* Panel Header */}
            <div
                style={{
                    padding: '1rem',
                    borderBottom: `1px solid ${theme.colors.secondary}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                }}
            >
                <h3
                    style={{
                        margin: 0,
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: theme.colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <span style={{fontSize: '1.25rem'}}>🤖</span>
                    Model Information
                </h3>

                <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    {/* Data Freshness Indicator */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            color: freshnessStatus.color,
                        }}
                        title={freshnessStatus.label}
                    >
                        <span>{freshnessStatus.icon}</span>
                        {timeSinceRefresh && <span>{timeSinceRefresh}</span>}
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={isLoading || isRefreshing}
                        title={`Refresh model information${enableAutoRefresh ? ' (auto-refresh enabled)' : ''}`}
                        style={{
                            padding: '0.5rem',
                            backgroundColor: theme.colors.primary,
                            border: 'none',
                            borderRadius: '4px',
                            color: '#ffffff',
                            cursor: isLoading || isRefreshing ? 'not-allowed' : 'pointer',
                            opacity: isLoading || isRefreshing ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.875rem',
                            transition: 'all 0.15s ease',
                        }}
                    >
            <span style={{
                animation: isLoading || isRefreshing ? 'spin 1s linear infinite' : 'none',
                display: 'inline-block'
            }}>
              🔄
            </span>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Panel Content */}
            <div style={{padding: '1rem'}}>
                {/* Loading State */}
                {isLoading && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem',
                            color: theme.colors.textSecondary,
                            gap: '0.75rem',
                        }}
                    >
                        <div
                            style={{
                                width: '1.5rem',
                                height: '1.5rem',
                                border: '2px solid transparent',
                                borderTop: `2px solid ${theme.colors.primary}`,
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }}
                        />
                        <span>Loading model information...</span>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div
                        style={{
                            padding: '1rem',
                            backgroundColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                            border: `1px solid ${theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'}`,
                            borderRadius: '6px',
                            color: theme.mode === 'dark' ? '#fca5a5' : '#dc2626',
                            marginBottom: '1rem',
                        }}
                        role="alert"
                    >
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                            <span style={{fontSize: '1.25rem'}}>⚠️</span>
                            <strong>Error Loading Model Information</strong>
                        </div>
                        <p style={{margin: '0 0 0.75rem 0', opacity: 0.9}}>
                            {error}
                        </p>
                        <button
                            onClick={handleManualRefresh}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.5)' : '#dc2626'}`,
                                borderRadius: '4px',
                                color: theme.mode === 'dark' ? '#fca5a5' : '#dc2626',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Model Information Display */}
                {(modelInfo || modelMetadata) && !error && (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        {/* Basic Model Information */}
                        <div>
                            <div
                                style={{
                                    padding: '1rem',
                                    backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                    borderRadius: '6px',
                                    border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '1.125rem',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        marginBottom: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <span>{currentModelInfo?.is_ready ? '✅' : '⏳'}</span>
                                    {displayModelName}
                                </div>

                                {modelMetadata?.description && (
                                    <div
                                        style={{
                                            fontSize: '0.875rem',
                                            color: theme.colors.textSecondary,
                                            marginBottom: '0.75rem',
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {modelMetadata.description}
                                    </div>
                                )}

                                {/* Model Architecture and Dataset Information */}
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '0.5rem',
                                        fontSize: '0.8125rem'
                                    }}>
                                        {modelMetadata?.model_id && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <span style={{ color: theme.colors.textSecondary, fontWeight: 500 }}>Architecture:</span>
                                                <span style={{ color: theme.colors.text, fontFamily: 'monospace' }}>
                                                    {modelMetadata.model_id.includes('xtts') ? 'XTTS' :
                                                     modelMetadata.model_id.includes('vits') ? 'VITS' :
                                                     modelMetadata.model_id.includes('tacotron') ? 'Tacotron2' :
                                                     modelMetadata.model_id.includes('bark') ? 'Bark' :
                                                     modelMetadata.model_id.includes('tortoise') ? 'Tortoise' :
                                                     modelMetadata.model_id.split('_')[0]?.toUpperCase() || 'Unknown'}
                                                </span>
                                            </div>
                                        )}
                                        {modelMetadata?.model_id && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <span style={{ color: theme.colors.textSecondary, fontWeight: 500 }}>Training Dataset:</span>
                                                <span style={{ color: theme.colors.text }}>
                                                    {modelMetadata.model_id.includes('ljspeech') ? 'LJSpeech' :
                                                     modelMetadata.model_id.includes('vctk') ? 'VCTK' :
                                                     modelMetadata.model_id.includes('multilingual') ? 'Multilingual' :
                                                     modelMetadata.model_id.includes('fairseq') ? 'Fairseq MMS' :
                                                     'Various'}
                                                </span>
                                            </div>
                                        )}
                                        {modelMetadata?.size_mb && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <span style={{ color: theme.colors.textSecondary, fontWeight: 500 }}>Model Size:</span>
                                                <span style={{ color: theme.colors.text }}>
                                                    {modelMetadata.size_mb > 1024 ? 
                                                        `${(modelMetadata.size_mb / 1024).toFixed(1)} GB` : 
                                                        `${modelMetadata.size_mb} MB`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Status indicators */}
                                <div
                                    style={{display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                    <span style={{color: currentModelInfo?.is_loaded ? '#10b981' : '#6b7280'}}>
                      {currentModelInfo?.is_loaded ? '●' : '○'}
                    </span>
                                        <span style={{color: theme.colors.textSecondary}}>
                      {currentModelInfo?.is_loaded ? 'Loaded' : 'Not loaded'}
                    </span>
                                    </div>

                                    {currentModelInfo?.loaded_at && (
                                        <div style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                                            <span>📅</span>
                                            <span style={{color: theme.colors.textSecondary}}>
                        Loaded {new Date(currentModelInfo.loaded_at).toLocaleTimeString()}
                      </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Performance Metrics */}
                        {showAdvancedMetrics && (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 0.75rem 0',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <span>📊</span>
                                    Performance Metrics
                                </h4>

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                        gap: '0.75rem',
                                    }}
                                >
                                    {Object.entries(performanceMetrics).map(([key, metric]) => {
                                        if (metric.value === undefined && metric.value !== 0) return null;

                                        return (
                                            <div
                                                key={key}
                                                style={{
                                                    padding: '0.75rem',
                                                    backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                                    border: `1px solid ${getPerformanceColor(metric.level)}`,
                                                    borderRadius: '6px',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: theme.colors.textSecondary,
                                                        marginBottom: '0.25rem',
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {key}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: '1.125rem',
                                                        fontWeight: 600,
                                                        color: getPerformanceColor(metric.level),
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.25rem',
                                                    }}
                                                >
                          <span>
                            {typeof metric.value === 'number'
                                ? metric.value.toLocaleString(undefined, {maximumFractionDigits: 1})
                                : '—'
                            }
                          </span>
                                                    {metric.unit &&
                                                        <span style={{fontSize: '0.75rem'}}>{metric.unit}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Model Capabilities */}
                        <div>
                            <h4
                                style={{
                                    margin: '0 0 0.75rem 0',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: theme.colors.text,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                }}
                            >
                                <span>🎯</span>
                                Capabilities
                            </h4>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '0.75rem',
                                }}
                            >
                                {Object.entries(capabilityInfo).map(([key, capability]) => (
                                    <div
                                        key={key}
                                        style={{
                                            padding: '0.75rem',
                                            backgroundColor: capability.enabled
                                                ? theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)'
                                                : theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.05)',
                                            border: `1px solid ${capability.enabled
                                                ? theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'
                                                : theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)'
                                            }`,
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                        }}
                                    >
                                        <span style={{fontSize: '1.25rem'}}>{capability.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontWeight: 500,
                                                    color: theme.colors.text,
                                                    fontSize: '0.875rem',
                                                }}
                                            >
                                                {capability.label}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: theme.colors.textSecondary,
                                                }}
                                            >
                                                {capability.enabled
                                                    ? ('count' in capability && capability.count !== undefined
                                                            ? `${capability.count} ${capability.count === 1 ? 'option' : 'options'}`
                                                            : 'Available'
                                                    )
                                                    : 'Not available'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Voice Cloning Capabilities and Guidance */}
                        {capabilityInfo.voiceCloning.enabled && (
                            <div>
                                <h4
                                    style={{
                                        margin: '0 0 0.75rem 0',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: theme.colors.text,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                    }}
                                >
                                    <span>🎭</span>
                                    Voice Cloning Guidance
                                </h4>

                                <div
                                    style={{
                                        padding: '1rem',
                                        backgroundColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                        border: `1px solid ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                                        borderRadius: '6px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🎤</span>
                                        <div>
                                            <div style={{
                                                fontWeight: 500,
                                                color: theme.colors.text,
                                                fontSize: '0.875rem',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Reference Audio Requirements
                                            </div>
                                            <ul style={{
                                                margin: 0,
                                                paddingLeft: '1.25rem',
                                                fontSize: '0.8125rem',
                                                color: theme.colors.textSecondary,
                                                lineHeight: 1.4
                                            }}>
                                                {modelMetadata?.model_id?.includes('xtts') ? (
                                                    <>
                                                        <li>6-22 seconds of clean speech</li>
                                                        <li>WAV format, 22kHz sample rate preferred</li>
                                                        <li>Single speaker, minimal background noise</li>
                                                        <li>Clear pronunciation and natural intonation</li>
                                                    </>
                                                ) : (
                                                    <>
                                                        <li>5-30 seconds of clean speech</li>
                                                        <li>High quality audio (16-48kHz)</li>
                                                        <li>Single speaker with consistent tone</li>
                                                        <li>Minimal background noise and echoes</li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>💡</span>
                                        <div>
                                            <div style={{
                                                fontWeight: 500,
                                                color: theme.colors.text,
                                                fontSize: '0.875rem',
                                                marginBottom: '0.25rem'
                                            }}>
                                                Best Practices
                                            </div>
                                            <ul style={{
                                                margin: 0,
                                                paddingLeft: '1.25rem',
                                                fontSize: '0.8125rem',
                                                color: theme.colors.textSecondary,
                                                lineHeight: 1.4
                                            }}>
                                                <li>Record in a quiet environment</li>
                                                <li>Use varied sentence structures</li>
                                                <li>Maintain consistent speaking pace</li>
                                                <li>Avoid excessive emotional variation</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Expandable Details Section */}
                        <div>
                            <button
                                onClick={toggleExpanded}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${theme.colors.secondary}`,
                                    borderRadius: '6px',
                                    color: theme.colors.text,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = theme.mode === 'dark'
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(0, 0, 0, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                    <span>🔍</span>
                                    <span>Detailed Information</span>
                                </div>
                                <span
                                    style={{
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.15s ease',
                                    }}
                                >
                  ↓
                </span>
                            </button>

                            {/* Expanded Details Content */}
                            {isExpanded && (
                                <div
                                    style={
                                        {
                                            marginTop: '1rem',
                                            padding: '1rem',
                                            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                            border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                            borderRadius: '6px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1rem',
                                        }
                                    }
                                >
                                    {/* Speaker Information with Metadata */}
                                    {capabilityInfo.multiSpeaker.enabled && capabilityInfo.multiSpeaker.count > 0 && (
                                        <div>
                                            <h5
                                                style={{
                                                    margin: '0 0 0.5rem 0',
                                                    fontSize: '0.9375rem',
                                                    fontWeight: 600,
                                                    color: theme.colors.text,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                }}
                                            >
                                                <span>👥</span>
                                                Available Speakers ({capabilityInfo.multiSpeaker.count})
                                            </h5>
                                            
                                            {/* Enhanced Speaker Display */}
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                                    gap: '0.5rem',
                                                    maxHeight: '160px',
                                                    overflowY: 'auto',
                                                    padding: '0.5rem',
                                                    backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                                }}
                                            >
                                                {(modelMetadata?.speakers || (modelInfo as any)?.speakers || []).slice(0, 24).map((speaker: any, index: number) => {
                                                    // Extract gender/metadata from speaker name if available
                                                    const speakerName = typeof speaker === 'string' ? speaker : speaker.name || speaker.id || 'Unknown';
                                                    const speakerParts = speakerName.split('_');
                                                    const genderIcon = speakerParts.some((part: string) => part.toLowerCase().includes('female') || part.toLowerCase().includes('f')) ? '♀️' :
                                                                      speakerParts.some((part: string) => part.toLowerCase().includes('male') || part.toLowerCase().includes('m')) ? '♂️' : '🗣️';
                                                    
                                                    return (
                                                        <div
                                                            key={typeof speaker === 'string' ? speaker : speaker.name || speaker.id || Math.random()}
                                                            style={{
                                                                padding: '0.375rem 0.5rem',
                                                                backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                color: theme.colors.text,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                                            }}
                                                            title={`Speaker: ${speakerName} (Index: ${index})`}
                                                        >
                                                            <span style={{ fontSize: '1rem' }}>{genderIcon}</span>
                                                            <span style={{ fontWeight: 500, flex: 1, textAlign: 'center' }}>
                                                                {speakerName.length > 12 ? speakerName.substring(0, 12) + '...' : speakerName}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {(modelMetadata?.speakers?.length || modelInfo?.speakers?.length || 0) > 24 && (
                                                    <div
                                                        style={{
                                                            padding: '0.375rem 0.5rem',
                                                            backgroundColor: theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            color: theme.colors.textSecondary,
                                                            textAlign: 'center',
                                                            fontStyle: 'italic',
                                                            border: `1px dashed ${theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        +{((modelMetadata?.speakers?.length || modelInfo?.speakers?.length || 0) - 24)} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Enhanced Language Information with Quality Indicators */}
                                    {capabilityInfo.multiLingual.enabled && capabilityInfo.multiLingual.count > 0 && (
                                        <div>
                                            <h5
                                                style={{
                                                    margin: '0 0 0.5rem 0',
                                                    fontSize: '0.9375rem',
                                                    fontWeight: 600,
                                                    color: theme.colors.text,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                }}
                                            >
                                                <span>🌐</span>
                                                Supported Languages ({capabilityInfo.multiLingual.count})
                                            </h5>
                                            
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                                    gap: '0.5rem',
                                                    maxHeight: '160px',
                                                    overflowY: 'auto',
                                                    padding: '0.5rem',
                                                    backgroundColor: theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                                                    borderRadius: '4px',
                                                    border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                                                }}
                                            >
                                                {(modelMetadata?.languages || (modelInfo as any)?.languages || []).slice(0, 30).map((lang: any) => {
                                                    // Language metadata with quality indicators
                                                    const langCode = typeof lang === 'string' ? lang : lang.code || lang.name || 'unknown';
                                                    const getLanguageInfo = (code: string) => {
                                                        const langCode = code.toLowerCase();
                                                        const highQualityLangs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hi', 'ko'];
                                                        const isHighQuality = highQualityLangs.includes(langCode);
                                                        
                                                        const nativeNames: { [key: string]: string } = {
                                                            'en': 'English',
                                                            'es': 'Español',
                                                            'fr': 'Français',
                                                            'de': 'Deutsch',
                                                            'it': 'Italiano',
                                                            'pt': 'Português',
                                                            'ru': 'Русский',
                                                            'ja': '日本語',
                                                            'ko': '한국어',
                                                            'zh': '中文',
                                                            'ar': 'العربية',
                                                            'hi': 'हिन्दी',
                                                            'tr': 'Türkçe',
                                                            'pl': 'Polski',
                                                            'nl': 'Nederlands',
                                                            'cs': 'Čeština',
                                                        };
                                                        
                                                        return {
                                                            quality: isHighQuality ? 'high' : 'medium',
                                                            nativeName: nativeNames[langCode] || code.toUpperCase(),
                                                            qualityIcon: isHighQuality ? '🟢' : '🟡'
                                                        };
                                                    };
                                                    
                                                    const langInfo = getLanguageInfo(langCode);
                                                    
                                                    return (
                                                        <div
                                                            key={typeof lang === 'string' ? lang : lang.code || lang.name || Math.random()}
                                                            style={{
                                                                padding: '0.375rem 0.5rem',
                                                                backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                color: theme.colors.text,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                border: `1px solid ${langInfo.quality === 'high' ? 
                                                                    (theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)') :
                                                                    (theme.mode === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)')}`,
                                                            }}
                                                            title={`${langInfo.nativeName} (${langCode.toUpperCase()}) - ${langInfo.quality === 'high' ? 'High' : 'Medium'} Quality`}
                                                        >
                                                            <span style={{ fontSize: '0.875rem' }}>{langInfo.qualityIcon}</span>
                                                            <span style={{ fontWeight: 500, flex: 1, textAlign: 'center' }}>
                                                                {langCode.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {(modelMetadata?.languages?.length || modelInfo?.languages?.length || 0) > 30 && (
                                                    <div
                                                        style={{
                                                            padding: '0.375rem 0.5rem',
                                                            backgroundColor: theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.75rem',
                                                            color: theme.colors.textSecondary,
                                                            textAlign: 'center',
                                                            fontStyle: 'italic',
                                                            border: `1px dashed ${theme.mode === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)'}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        +{((modelMetadata?.languages?.length || modelInfo?.languages?.length || 0) - 30)} more
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Quality Legend */}
                                            <div style={{
                                                marginTop: '0.5rem',
                                                fontSize: '0.6875rem',
                                                color: theme.colors.textSecondary,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                paddingTop: '0.5rem',
                                                borderTop: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span>🟢</span>
                                                    <span>High Quality</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span>🟡</span>
                                                    <span>Medium Quality</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Technical Details */}
                                    <div>
                                        <h5
                                            style={{
                                                margin: '0 0 0.5rem 0',
                                                fontSize: '0.9375rem',
                                                fontWeight: 600,
                                                color: theme.colors.text,
                                            }}
                                        >
                                            Technical Details
                                        </h5>

                                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                                            {[
                                                {
                                                    label: 'Architecture Type',
                                                    value: modelMetadata?.model_id?.includes('xtts') ? 'XTTS (GPT-based)' :
                                                           modelMetadata?.model_id?.includes('vits') ? 'VITS (End-to-end)' :
                                                           modelMetadata?.model_id?.includes('tacotron') ? 'Tacotron2 (Two-stage)' :
                                                           modelMetadata?.model_id?.includes('bark') ? 'Bark (Transformer)' :
                                                           modelMetadata?.model_id?.includes('tortoise') ? 'Tortoise (Autoregressive)' :
                                                           'Neural TTS'
                                                },
                                                {
                                                    label: 'Model ID',
                                                    value: modelMetadata?.model_id || (modelInfo as any)?.model_name
                                                },
                                                {label: 'Version', value: modelMetadata?.version},
                                                {label: 'Provider', value: modelMetadata?.provider},
                                                {
                                                    label: 'Size',
                                                    value: modelMetadata?.size_mb !== undefined ? modelMetadata.size_mb + ' MB' : undefined
                                                },
                                                {
                                                    label: 'Cache Status',
                                                    value: modelMetadata?.cache_info?.is_cached ? 
                                                            `Cached (${modelMetadata.cache_info.cache_size_mb ? Math.round(modelMetadata.cache_info.cache_size_mb) + ' MB' : 'size unknown'})` : 
                                                            'Not cached'
                                                },
                                                {
                                                    label: 'Memory Usage',
                                                    value: currentModelInfo?.memory_usage_mb ? `${Math.round(currentModelInfo.memory_usage_mb)} MB` : 'Unknown'
                                                },
                                                {
                                                    label: 'Tags',
                                                    value: modelMetadata?.tags?.join(', ') || 'None'
                                                },
                                            ].filter(item => item.value && item.value !== 'Unknown' && item.value !== 'None').map((item) => (
                                                <div key={item.label} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{
                                                        fontSize: '0.875rem',
                                                        color: theme.colors.textSecondary
                                                    }}>{item.label}:</span>
                                                    <span style={{
                                                        fontSize: '0.875rem',
                                                        color: theme.colors.text,
                                                        fontFamily: 'monospace'
                                                    }}>
                            {item.value}
                          </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Enhanced Status Footer with Data Freshness */}
                        <div
                            style={{
                                fontSize: '0.75rem',
                                color: theme.colors.textSecondary,
                                paddingTop: '0.75rem',
                                borderTop: '1px solid ' + (theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                            }}
                        >
                            {/* Top Row - Refresh Info */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {enableAutoRefresh && (
                                        <span>🔄 Auto-refresh: {Math.floor(refreshInterval / 1000 / 60)}min</span>
                                    )}
                                    {refreshCount > 0 && (
                                        <span style={{ opacity: 0.7 }}>({refreshCount} updates)</span>
                                    )}
                                </div>
                                <div>
                                    {lastRefreshTime && (
                                        <span>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Bottom Row - Data Status */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem',
                                backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                                borderRadius: '4px',
                                border: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: freshnessStatus.color }}>{freshnessStatus.icon}</span>
                                    <span style={{ color: freshnessStatus.color }}>{freshnessStatus.label}</span>
                                </div>
                                
                                {dataFreshness === 'stale' && (
                                    <button
                                        onClick={handleManualRefresh}
                                        disabled={isLoading || isRefreshing}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.6875rem',
                                            backgroundColor: theme.colors.primary,
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: isLoading || isRefreshing ? 'not-allowed' : 'pointer',
                                            opacity: isLoading || isRefreshing ? 0.6 : 1,
                                        }}
                                    >
                                        Refresh Now
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add CSS animations */}
            <style
                dangerouslySetInnerHTML={{__html: "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }"}}/>
        </div>
    );
}

// ===== Export =====

export default ModelInfoPanel;
