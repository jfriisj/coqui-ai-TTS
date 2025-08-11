/**
 * Audio Context Provider for Coqui TTS Frontend
 * 
 * Manages audio playback state, waveform data storage, and audio generation history
 * with side-by-side comparison functionality. Provides Web Audio API integration
 * with browser compatibility handling and real-time progress updates.
 * 
 * Features:
 * - Audio generation history with persistent storage
 * - Waveform data extraction and storage using Web Audio API
 * - Multiple audio file comparison with synchronized playback
 * - Real-time progress updates during synthesis (500ms intervals)
 * - Browser compatibility detection and fallbacks
 * - Audio file management with Flask URL integration
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { SynthesisRequest, AudioGeneration } from '../types/api';
import { 
  modelManagementService, 
  ModelMetadata, 
  // CurrentModelInfo, 
  LoadingProgress,
  LoadingStatus,
  ProgressCallback,
  StatusChangeCallback
} from '../services/modelManagementService';
import {
  modelService,
  CompleteModelInfo,
  SpeakerInfo,
  LanguageInfo,
  onCacheInvalidation,
  RefreshOptions
} from '../services/modelService';

// ===== Types and Interfaces =====

/**
 * Audio generation record with metadata and waveform data
 * Represents a single generated audio file with all associated data
 */
export interface AudioGenerationRecord {
  /** Unique identifier for the generation */
  id: string;
  /** Original text that was synthesized */
  text: string;
  /** URL to the generated audio file (Flask static serving) */
  audioUrl: string;
  /** Timestamp when the audio was generated */
  timestamp: Date;
  /** Synthesis parameters used for generation */
  parameters: SynthesisRequest;
  /** Waveform data for visualization (amplitude values 0-1) */
  waveformData?: Float32Array;
  /** Audio duration in seconds */
  duration?: number;
  /** Audio MIME type */
  mimeType: string;
}

/**
 * Audio playback state for a single audio file
 */
export interface AudioPlaybackState {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Playback volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Playback rate/speed multiplier */
  playbackRate: number;
}

/**
 * Audio comparison state for side-by-side analysis
 */
export interface AudioComparisonState {
  /** Audio records being compared */
  compareRecords: AudioGenerationRecord[];
  /** Whether comparison mode is active */
  isComparing: boolean;
  /** Synchronized playback position for comparison */
  syncedCurrentTime: number;
  /** Whether playback is synchronized across compared audio */
  isSynchronized: boolean;
}

/**
 * Synthesis progress state for real-time updates
 */
export interface SynthesisProgress {
  /** Whether synthesis is currently active */
  isActive: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current synthesis stage description */
  stage: string;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Web Audio API context state
 */
export interface WebAudioState {
  /** Whether Web Audio API is available */
  isSupported: boolean;
  /** AudioContext instance */
  audioContext?: AudioContext;
  /** Whether audio context is initialized */
  isInitialized: boolean;
}

/**
 * Model management state for current loaded model
 */
export interface ModelState {
  /** Currently loaded model metadata */
  currentModel?: ModelMetadata;
  /** Model information with capabilities and config */
  modelInfo?: CompleteModelInfo;
  /** Whether model is loaded and ready */
  isModelReady: boolean;
  /** Loading progress information */
  loadingProgress?: LoadingProgress;
  /** Loading status */
  loadingStatus?: LoadingStatus;
  /** Available speakers for current model */
  speakers: SpeakerInfo[];
  /** Available languages for current model */
  languages: LanguageInfo[];
  /** When model was last loaded */
  loadedAt?: string;
  /** Model loading error */
  error?: string;
}

/**
 * Complete audio context value interface
 */
interface AudioContextValue {
  // Audio History Management
  /** List of all generated audio records */
  audioHistory: AudioGenerationRecord[];
  /** Add new audio generation to history */
  addAudioGeneration: (generation: AudioGeneration, text: string, parameters: SynthesisRequest) => Promise<AudioGenerationRecord>;
  /** Remove audio generation from history */
  removeAudioGeneration: (id: string) => void;
  /** Clear all audio history */
  clearAudioHistory: () => void;
  /** Get audio generation by ID */
  getAudioById: (id: string) => AudioGenerationRecord | undefined;

  // Audio Playback State
  /** Current playback states for each audio ID */
  playbackStates: Record<string, AudioPlaybackState>;
  /** Play audio by ID */
  playAudio: (id: string) => Promise<void>;
  /** Pause audio by ID */
  pauseAudio: (id: string) => void;
  /** Stop audio by ID */
  stopAudio: (id: string) => void;
  /** Seek to specific time position */
  seekAudio: (id: string, time: number) => void;
  /** Set volume for specific audio */
  setVolume: (id: string, volume: number) => void;
  /** Set playback rate for specific audio */
  setPlaybackRate: (id: string, rate: number) => void;

  // Audio Comparison
  /** Audio comparison state */
  comparisonState: AudioComparisonState;
  /** Start comparing multiple audio files */
  startComparison: (recordIds: string[]) => void;
  /** Stop comparison mode */
  stopComparison: () => void;
  /** Play all compared audio files synchronously */
  playComparisonSync: () => Promise<void>;
  /** Pause all compared audio files */
  pauseComparisonSync: () => void;

  // Synthesis Progress
  /** Current synthesis progress state */
  synthesisProgress: SynthesisProgress;
  /** Start synthesis progress tracking */
  startSynthesisProgress: (text: string) => void;
  /** Update synthesis progress */
  updateSynthesisProgress: (progress: number, stage: string, estimatedTime?: number) => void;
  /** Complete synthesis progress */
  completeSynthesisProgress: () => void;

  // Web Audio API
  /** Web Audio API state */
  webAudioState: WebAudioState;
  /** Initialize Web Audio API context */
  initializeAudioContext: () => Promise<boolean>;
  /** Extract waveform data from audio blob */
  extractWaveformData: (audioBlob: Blob) => Promise<Float32Array>;

  // Model Management Integration
  /** Current model state with capabilities */
  modelState: ModelState;
  /** Load a specific model */
  loadModel: (modelId: string, options?: { force_reload?: boolean; use_gpu?: boolean }) => Promise<void>;
  /** Cancel active model loading */
  cancelModelLoading: () => Promise<void>;
  /** Refresh model information and capabilities */
  refreshModelInfo: (options?: RefreshOptions) => Promise<void>;
  /** Get available models list */
  getAvailableModels: () => Promise<ModelMetadata[]>;
  /** Subscribe to model loading progress */
  subscribeToModelProgress: (callback: ProgressCallback) => () => void;
  /** Subscribe to model loading status */
  subscribeToModelStatus: (callback: StatusChangeCallback) => () => void;
}

// ===== Constants =====

/**
 * Default playback state for new audio files
 */
const DEFAULT_PLAYBACK_STATE: AudioPlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
};

/**
 * Default comparison state
 */
const DEFAULT_COMPARISON_STATE: AudioComparisonState = {
  compareRecords: [],
  isComparing: false,
  syncedCurrentTime: 0,
  isSynchronized: true,
};

/**
 * Default synthesis progress state
 */
const DEFAULT_SYNTHESIS_PROGRESS: SynthesisProgress = {
  isActive: false,
  progress: 0,
  stage: 'idle',
};

/**
 * Default model state
 */
const DEFAULT_MODEL_STATE: ModelState = {
  isModelReady: false,
  speakers: [],
  languages: [],
};

/**
 * Local storage key for audio history persistence
 */
const AUDIO_HISTORY_STORAGE_KEY = 'coqui-tts-audio-history';

/**
 * Progress update interval in milliseconds (500ms as per requirement 5.3)
 */
const PROGRESS_UPDATE_INTERVAL = 500;

// ===== Context Creation =====

/**
 * Audio context for managing TTS audio state throughout the application
 */
const AudioContext = createContext<AudioContextValue | undefined>(undefined);

// ===== Context Provider =====

/**
 * Audio provider props
 */
interface AudioProviderProps {
  children: ReactNode;
}

/**
 * Audio context provider component
 * Manages all audio-related state and provides functionality to child components
 */
export function AudioProvider({ children }: AudioProviderProps): JSX.Element {
  // State management
  const [audioHistory, setAudioHistory] = useState<AudioGenerationRecord[]>([]);
  const [playbackStates, setPlaybackStates] = useState<Record<string, AudioPlaybackState>>({});
  const [comparisonState, setComparisonState] = useState<AudioComparisonState>(DEFAULT_COMPARISON_STATE);
  const [synthesisProgress, setSynthesisProgress] = useState<SynthesisProgress>(DEFAULT_SYNTHESIS_PROGRESS);
  const [webAudioState, setWebAudioState] = useState<WebAudioState>({
    isSupported: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
    isInitialized: false,
  });
  const [modelState, setModelState] = useState<ModelState>(DEFAULT_MODEL_STATE);

  // Refs for managing audio elements and intervals
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Model management refs
  const modelProgressCallbacksRef = useRef<Set<ProgressCallback>>(new Set());
  const modelStatusCallbacksRef = useRef<Set<StatusChangeCallback>>(new Set());
  const cacheInvalidationUnsubscribeRef = useRef<(() => void) | null>(null);

  // ===== Local Storage Management =====

  /**
   * Load audio history from localStorage on component mount
   */
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(AUDIO_HISTORY_STORAGE_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory) as AudioGenerationRecord[];
        // Convert timestamp strings back to Date objects
        const withDates = parsed.map(record => ({
          ...record,
          timestamp: new Date(record.timestamp),
        }));
        setAudioHistory(withDates);
      }
    } catch (error) {
      console.warn('[AudioContext] Failed to load audio history from localStorage:', error);
    }
  }, []);

  /**
   * Save audio history to localStorage whenever it changes
   */
  useEffect(() => {
    try {
      localStorage.setItem(AUDIO_HISTORY_STORAGE_KEY, JSON.stringify(audioHistory));
    } catch (error) {
      console.warn('[AudioContext] Failed to save audio history to localStorage:', error);
    }
  }, [audioHistory]);

  // ===== Web Audio API Management =====

  /**
   * Initialize Web Audio API context
   */
  const initializeAudioContext = useCallback(async (): Promise<boolean> => {
    if (!webAudioState.isSupported) {
      console.warn('[AudioContext] Web Audio API not supported in this browser');
      return false;
    }

    if (webAudioState.audioContext && webAudioState.isInitialized) {
      return true;
    }

    try {
      // Try to create AudioContext with fallback to webkit version
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      // Resume context if it starts suspended (Chrome autoplay policy)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      setWebAudioState(prev => ({
        ...prev,
        audioContext,
        isInitialized: true,
      }));

      return true;
    } catch (error) {
      console.error('[AudioContext] Failed to initialize Web Audio API:', error);
      setWebAudioState(prev => ({
        ...prev,
        isSupported: false,
        isInitialized: false,
      }));
      return false;
    }
  }, [webAudioState.audioContext, webAudioState.isInitialized, webAudioState.isSupported]);

  /**
   * Extract waveform data from audio blob using Web Audio API
   */
  const extractWaveformData = useCallback(async (audioBlob: Blob): Promise<Float32Array> => {
    const initialized = await initializeAudioContext();
    if (!initialized || !webAudioState.audioContext) {
      console.warn('[AudioContext] Web Audio API not available, returning empty waveform data');
      // Return a simple flat waveform when Web Audio API is not available
      return new Float32Array(100).fill(0.5);
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await webAudioState.audioContext.decodeAudioData(arrayBuffer);
      
      // Get channel data (use first channel for mono or mix down for stereo)
      const channelData = audioBuffer.getChannelData(0);

      // Downsample for visualization (target ~1000 samples for performance)
      const targetSamples = 1000;
      const samplesPerPixel = Math.max(1, Math.floor(channelData.length / targetSamples));
      const waveformData = new Float32Array(Math.ceil(channelData.length / samplesPerPixel));

      // Create waveform by taking RMS of sample groups
      for (let i = 0; i < waveformData.length; i++) {
        const start = i * samplesPerPixel;
        const end = Math.min(start + samplesPerPixel, channelData.length);
        
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += channelData[j] * channelData[j];
        }
        
        // RMS and normalize to 0-1
        waveformData[i] = Math.sqrt(sum / (end - start));
      }

      return waveformData;
    } catch (error) {
      console.error('[AudioContext] Failed to extract waveform data:', error);
      throw error;
    }
  }, [webAudioState.audioContext, initializeAudioContext]);

  // ===== Audio History Management =====

  /**
   * Add new audio generation to history with waveform extraction
   */
  const addAudioGeneration = useCallback(async (
    generation: AudioGeneration,
    text: string,
    parameters: SynthesisRequest
  ): Promise<AudioGenerationRecord> => {
    const id = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const audioUrl = URL.createObjectURL(generation.audio);

    // Create audio element to get duration
    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';

    const record: AudioGenerationRecord = {
      id,
      text,
      audioUrl,
      timestamp: new Date(),
      parameters,
      mimeType: generation.mimeType,
    };

    // Wait for audio metadata to load
    await new Promise<void>((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        record.duration = audio.duration;
        resolve();
      });
      audio.addEventListener('error', () => {
        console.warn('[AudioContext] Failed to load audio metadata');
        resolve();
      });
    });

    // Extract waveform data in the background
    try {
      record.waveformData = await extractWaveformData(generation.audio);
    } catch (error) {
      console.warn('[AudioContext] Failed to extract waveform data:', error);
      // Continue without waveform data
    }

    // Add to history (newest first)
    setAudioHistory(prev => [record, ...prev]);

    // Initialize playback state
    setPlaybackStates(prev => ({
      ...prev,
      [id]: { ...DEFAULT_PLAYBACK_STATE, duration: record.duration || 0 },
    }));

    // Return the created record
    return record;
  }, [extractWaveformData]);

  /**
   * Remove audio generation from history
   */
  const removeAudioGeneration = useCallback((id: string): void => {
    // Clean up audio element
    const audioElement = audioElementsRef.current[id];
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      delete audioElementsRef.current[id];
    }

    // Clean up playback state
    setPlaybackStates(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });

    // Remove from history
    setAudioHistory(prev => {
      const record = prev.find(r => r.id === id);
      if (record) {
        // Revoke object URL to free memory
        URL.revokeObjectURL(record.audioUrl);
      }
      return prev.filter(r => r.id !== id);
    });

    // Remove from comparison if present
    setComparisonState(prev => ({
      ...prev,
      compareRecords: prev.compareRecords.filter(r => r.id !== id),
    }));
  }, []);

  /**
   * Clear all audio history
   */
  const clearAudioHistory = useCallback((): void => {
    // Clean up all audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    audioElementsRef.current = {};

    // Clean up object URLs
    audioHistory.forEach(record => {
      URL.revokeObjectURL(record.audioUrl);
    });

    // Clear state
    setAudioHistory([]);
    setPlaybackStates({});
    setComparisonState(DEFAULT_COMPARISON_STATE);
  }, [audioHistory]);

  /**
   * Get audio generation by ID
   */
  const getAudioById = useCallback((id: string): AudioGenerationRecord | undefined => {
    return audioHistory.find(record => record.id === id);
  }, [audioHistory]);

  // ===== Audio Playback Management =====

  /**
   * Get or create audio element for a record
   */
  const getAudioElement = useCallback((id: string): HTMLAudioElement | null => {
    const record = getAudioById(id);
    if (!record) return null;

    if (!audioElementsRef.current[id]) {
      const audio = new Audio(record.audioUrl);
      audio.preload = 'metadata';
      
      // Set up event listeners for playback state updates
      audio.addEventListener('timeupdate', () => {
        setPlaybackStates(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            currentTime: audio.currentTime,
          },
        }));
      });

      audio.addEventListener('ended', () => {
        setPlaybackStates(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            isPlaying: false,
            currentTime: 0,
          },
        }));
      });

      audio.addEventListener('loadedmetadata', () => {
        setPlaybackStates(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            duration: audio.duration,
          },
        }));
      });

      audioElementsRef.current[id] = audio;
    }

    return audioElementsRef.current[id];
  }, [getAudioById]);

  /**
   * Play audio by ID
   */
  const playAudio = useCallback(async (id: string): Promise<void> => {
    const audio = getAudioElement(id);
    if (!audio) return;

    try {
      await audio.play();
      setPlaybackStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          isPlaying: true,
        },
      }));
    } catch (error) {
      console.error('[AudioContext] Failed to play audio:', error);
    }
  }, [getAudioElement]);

  /**
   * Pause audio by ID
   */
  const pauseAudio = useCallback((id: string): void => {
    const audio = getAudioElement(id);
    if (!audio) return;

    audio.pause();
    setPlaybackStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isPlaying: false,
      },
    }));
  }, [getAudioElement]);

  /**
   * Stop audio by ID
   */
  const stopAudio = useCallback((id: string): void => {
    const audio = getAudioElement(id);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setPlaybackStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isPlaying: false,
        currentTime: 0,
      },
    }));
  }, [getAudioElement]);

  /**
   * Seek to specific time position
   */
  const seekAudio = useCallback((id: string, time: number): void => {
    const audio = getAudioElement(id);
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
  }, [getAudioElement]);

  /**
   * Set volume for specific audio
   */
  const setVolume = useCallback((id: string, volume: number): void => {
    const audio = getAudioElement(id);
    if (!audio) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    audio.volume = clampedVolume;
    setPlaybackStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        volume: clampedVolume,
      },
    }));
  }, [getAudioElement]);

  /**
   * Set playback rate for specific audio
   */
  const setPlaybackRate = useCallback((id: string, rate: number): void => {
    const audio = getAudioElement(id);
    if (!audio) return;

    const clampedRate = Math.max(0.25, Math.min(4, rate));
    audio.playbackRate = clampedRate;
    setPlaybackStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        playbackRate: clampedRate,
      },
    }));
  }, [getAudioElement]);

  // ===== Audio Comparison Management =====

  /**
   * Start comparing multiple audio files
   */
  const startComparison = useCallback((recordIds: string[]): void => {
    const records = recordIds.map(id => getAudioById(id)).filter(Boolean) as AudioGenerationRecord[];
    
    setComparisonState({
      compareRecords: records,
      isComparing: records.length > 1,
      syncedCurrentTime: 0,
      isSynchronized: true,
    });
  }, [getAudioById]);

  /**
   * Stop comparison mode
   */
  const stopComparison = useCallback((): void => {
    // Pause all comparison audio
    comparisonState.compareRecords.forEach(record => {
      pauseAudio(record.id);
    });

    setComparisonState(DEFAULT_COMPARISON_STATE);
  }, [comparisonState.compareRecords, pauseAudio]);

  /**
   * Play all compared audio files synchronously
   */
  const playComparisonSync = useCallback(async (): Promise<void> => {
    if (!comparisonState.isComparing) return;

    // Synchronize all audio elements to the same time position
    const syncTime = comparisonState.syncedCurrentTime;
    
    for (const record of comparisonState.compareRecords) {
      const audio = getAudioElement(record.id);
      if (audio) {
        audio.currentTime = syncTime;
      }
    }

    // Play all audio elements
    const playPromises = comparisonState.compareRecords.map(record => playAudio(record.id));
    await Promise.all(playPromises);
  }, [comparisonState, getAudioElement, playAudio]);

  /**
   * Pause all compared audio files
   */
  const pauseComparisonSync = useCallback((): void => {
    if (!comparisonState.isComparing) return;

    comparisonState.compareRecords.forEach(record => {
      pauseAudio(record.id);
    });
  }, [comparisonState, pauseAudio]);

  // ===== Synthesis Progress Management =====

  /**
   * Start synthesis progress tracking
   */
  const startSynthesisProgress = useCallback((text: string): void => {
    setSynthesisProgress({
      isActive: true,
      progress: 0,
      stage: `Starting synthesis for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      estimatedTimeRemaining: undefined,
    });

    // Set up progress update interval
    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress = Math.min(progress + Math.random() * 15, 90); // Simulate progress
      
      setSynthesisProgress(prev => ({
        ...prev,
        progress,
        stage: progress < 30 ? 'Preprocessing text...' 
             : progress < 60 ? 'Generating audio...' 
             : 'Finalizing synthesis...',
        estimatedTimeRemaining: Math.max(1, Math.floor((100 - progress) / 10)),
      }));
    }, PROGRESS_UPDATE_INTERVAL);
  }, []);

  /**
   * Update synthesis progress
   */
  const updateSynthesisProgress = useCallback((
    progress: number,
    stage: string,
    estimatedTime?: number
  ): void => {
    setSynthesisProgress(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
      stage,
      estimatedTimeRemaining: estimatedTime,
    }));
  }, []);

  /**
   * Complete synthesis progress
   */
  const completeSynthesisProgress = useCallback((): void => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setSynthesisProgress({
      isActive: false,
      progress: 100,
      stage: 'Synthesis completed',
      estimatedTimeRemaining: 0,
    });

    // Reset progress after a short delay
    setTimeout(() => {
      setSynthesisProgress(DEFAULT_SYNTHESIS_PROGRESS);
    }, 2000);
  }, []);

  // ===== Model Management Effects =====

  /**
   * Initialize model management integration on component mount
   */
  useEffect(() => {
    const initializeModelIntegration = async () => {
      try {
        // Load initial model state
        await refreshModelInformation();
        
        // Subscribe to cache invalidation events for automatic refresh (Requirement 4.5)
        cacheInvalidationUnsubscribeRef.current = onCacheInvalidation(() => {
          console.log('[AudioContext] Cache invalidated, refreshing model information');
          refreshModelInformation();
        });
      } catch (error) {
        console.error('[AudioContext] Failed to initialize model integration:', error);
        setModelState(prev => ({
          ...prev,
          error: `Failed to initialize model integration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }));
      }
    };

    initializeModelIntegration();

    return () => {
      // Clean up cache invalidation subscription
      if (cacheInvalidationUnsubscribeRef.current) {
        cacheInvalidationUnsubscribeRef.current();
        cacheInvalidationUnsubscribeRef.current = null;
      }
    };
  }, []);

  /**
   * Refresh model information and update state (Requirements 4.5, 5.1)
   */
  const refreshModelInformation = useCallback(async () => {
    try {
      // Get current model from ModelManagementService
      const currentModelResponse = await modelManagementService.getCurrentModel();
      
      // Get enhanced model information from ModelService
      const modelInfoResponse = await modelService.getModelInfo({ force: false, fallbackToStale: true });
      
      if (currentModelResponse.success) {
        const currentModelData = currentModelResponse.data;
        
        setModelState(prev => ({
          ...prev,
          currentModel: currentModelData.model,
          isModelReady: currentModelData.is_ready,
          loadedAt: currentModelData.loaded_at,
          error: undefined,
        }));
      }
      
      if (modelInfoResponse.success) {
        const modelInfo = modelInfoResponse.data;
        
        setModelState(prev => ({
          ...prev,
          modelInfo,
          speakers: modelInfo.speakers,
          languages: modelInfo.languages,
        }));
      } else {
        console.warn('[AudioContext] Failed to get model info:', modelInfoResponse.error.error);
      }
    } catch (error) {
      console.error('[AudioContext] Failed to refresh model information:', error);
      setModelState(prev => ({
        ...prev,
        error: `Failed to refresh model information: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }, []);

  // ===== Model Management Methods =====

  /**
   * Load a specific model and refresh capabilities (Requirements 4.5, 5.1)
   */
  const loadModel = useCallback(async (
    modelId: string, 
    options?: { force_reload?: boolean; use_gpu?: boolean }
  ): Promise<void> => {
    try {
      setModelState(prev => ({ ...prev, error: undefined }));
      
      const response = await modelManagementService.loadModel({
        model_id: modelId,
        force_reload: options?.force_reload,
        use_gpu: options?.use_gpu,
      });
      
      if (!response.success) {
        throw new Error(response.error.error);
      }
      
      // The automatic refresh will be triggered by SSE events and cache invalidation
      console.log('[AudioContext] Model loading initiated:', modelId);
    } catch (error) {
      console.error('[AudioContext] Failed to load model:', error);
      setModelState(prev => ({
        ...prev,
        error: `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      throw error;
    }
  }, []);

  /**
   * Cancel active model loading
   */
  const cancelModelLoading = useCallback(async (): Promise<void> => {
    try {
      await modelManagementService.cancelLoading();
      setModelState(prev => ({ ...prev, loadingProgress: undefined, loadingStatus: undefined }));
    } catch (error) {
      console.error('[AudioContext] Failed to cancel model loading:', error);
    }
  }, []);

  /**
   * Refresh model information (Requirement 4.5)
   */
  const refreshModelInfo = useCallback(async (_options?: RefreshOptions): Promise<void> => {
    await refreshModelInformation();
  }, [refreshModelInformation]);

  /**
   * Get available models list
   */
  const getAvailableModels = useCallback(async (): Promise<ModelMetadata[]> => {
    try {
      const response = await modelManagementService.getAvailableModels();
      if (response.success) {
        return response.data;
      } else {
        console.error('[AudioContext] Failed to get available models:', response.error.error);
        return [];
      }
    } catch (error) {
      console.error('[AudioContext] Error getting available models:', error);
      return [];
    }
  }, []);

  /**
   * Subscribe to model loading progress updates
   */
  const subscribeToModelProgress = useCallback((callback: ProgressCallback): () => void => {
    modelProgressCallbacksRef.current.add(callback);
    
    // Subscribe to ModelManagementService progress
    const unsubscribeService = modelManagementService.subscribeToProgress((progress) => {
      setModelState(prev => ({ ...prev, loadingProgress: progress }));
      callback(progress);
    });
    
    // Return combined unsubscribe function
    return () => {
      modelProgressCallbacksRef.current.delete(callback);
      unsubscribeService();
    };
  }, []);

  /**
   * Subscribe to model loading status updates
   */
  const subscribeToModelStatus = useCallback((callback: StatusChangeCallback): () => void => {
    modelStatusCallbacksRef.current.add(callback);
    
    // Subscribe to ModelManagementService status
    const unsubscribeService = modelManagementService.subscribeToStatus((status) => {
      setModelState(prev => ({ ...prev, loadingStatus: status }));
      
      // If loading is complete and successful, refresh model information (Requirement 4.5)
      if (!status.is_loading && status.progress?.stage === 'complete') {
        console.log('[AudioContext] Model loading completed, refreshing capabilities');
        refreshModelInformation();
      }
      
      callback(status);
    });
    
    // Return combined unsubscribe function
    return () => {
      modelStatusCallbacksRef.current.delete(callback);
      unsubscribeService();
    };
  }, [refreshModelInformation]);

  // ===== Cleanup Effect =====

  /**
   * Clean up resources on unmount
   */
  useEffect(() => {
    return () => {
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Clean up all audio elements
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });

      // Clean up Web Audio context
      if (webAudioState.audioContext && webAudioState.audioContext.state !== 'closed') {
        webAudioState.audioContext.close();
      }

      // Clean up object URLs
      audioHistory.forEach(record => {
        URL.revokeObjectURL(record.audioUrl);
      });

      // Clean up model management subscriptions
      if (cacheInvalidationUnsubscribeRef.current) {
        cacheInvalidationUnsubscribeRef.current();
      }
      modelProgressCallbacksRef.current.clear();
      modelStatusCallbacksRef.current.clear();
    };
  }, [webAudioState.audioContext, audioHistory]);

  // ===== Context Value =====

  const contextValue: AudioContextValue = {
    // Audio History Management
    audioHistory,
    addAudioGeneration,
    removeAudioGeneration,
    clearAudioHistory,
    getAudioById,

    // Audio Playback State
    playbackStates,
    playAudio,
    pauseAudio,
    stopAudio,
    seekAudio,
    setVolume,
    setPlaybackRate,

    // Audio Comparison
    comparisonState,
    startComparison,
    stopComparison,
    playComparisonSync,
    pauseComparisonSync,

    // Synthesis Progress
    synthesisProgress,
    startSynthesisProgress,
    updateSynthesisProgress,
    completeSynthesisProgress,

    // Web Audio API
    webAudioState,
    initializeAudioContext,
    extractWaveformData,

    // Model Management Integration
    modelState,
    loadModel,
    cancelModelLoading,
    refreshModelInfo,
    getAvailableModels,
    subscribeToModelProgress,
    subscribeToModelStatus,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

// ===== Hook Export =====

/**
 * Hook to use audio context
 * Must be used within an AudioProvider
 */
export function useAudio(): AudioContextValue {
  const context = useContext(AudioContext);
  
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  
  return context;
}

/**
 * Hook to get audio generation by ID with automatic updates
 */
export function useAudioGeneration(id: string): AudioGenerationRecord | undefined {
  const { getAudioById } = useAudio();
  return getAudioById(id);
}

/**
 * Hook to get playback state for a specific audio ID
 */
export function useAudioPlayback(id: string): AudioPlaybackState {
  const { playbackStates } = useAudio();
  return playbackStates[id] || DEFAULT_PLAYBACK_STATE;
}

/**
 * Hook for audio comparison functionality
 */
export function useAudioComparison() {
  const { comparisonState, startComparison, stopComparison, playComparisonSync, pauseComparisonSync } = useAudio();
  
  return {
    ...comparisonState,
    startComparison,
    stopComparison,
    playComparisonSync,
    pauseComparisonSync,
  };
}

/**
 * Hook for synthesis progress tracking
 */
export function useSynthesisProgress() {
  const { synthesisProgress, startSynthesisProgress, updateSynthesisProgress, completeSynthesisProgress } = useAudio();
  
  return {
    ...synthesisProgress,
    startSynthesisProgress,
    updateSynthesisProgress,
    completeSynthesisProgress,
  };
}

/**
 * Hook for model management functionality
 */
export function useModelManagement() {
  const { 
    modelState,
    loadModel,
    cancelModelLoading,
    refreshModelInfo,
    getAvailableModels,
    subscribeToModelProgress,
    subscribeToModelStatus
  } = useAudio();
  
  return {
    modelState,
    loadModel,
    cancelModelLoading,
    refreshModelInfo,
    getAvailableModels,
    subscribeToModelProgress,
    subscribeToModelStatus,
  };
}

/**
 * Hook to get current model information (Requirement 5.1)
 */
export function useModelInfo(): ModelState {
  const { modelState } = useAudio();
  return modelState;
}

/**
 * Hook to get speakers for current model (Requirement 4.5)
 */
export function useModelSpeakers(): SpeakerInfo[] {
  const { modelState } = useAudio();
  return modelState.speakers;
}

/**
 * Hook to get languages for current model (Requirement 4.5)
 */
export function useModelLanguages(): LanguageInfo[] {
  const { modelState } = useAudio();
  return modelState.languages;
}