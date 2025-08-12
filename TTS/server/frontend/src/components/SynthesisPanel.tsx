/**
 * SynthesisPanel Component for Coqui TTS Frontend
 * 
 * Comprehensive synthesis interface that integrates all input and control components
 * into a cohesive panel. Manages shared state and communication between TextInput,
 * SynthesisControls, SpeakerSelect, LanguageSelect, and VoiceCloneUpload components.
 * 
 * Features:
 * - Integrated text input with validation and character counting
 * - Advanced synthesis controls with progress tracking
 * - Dynamic model selection with confirmation dialogs and progress tracking
 * - Speaker selection with preview audio capabilities
 * - Language selection with text processing guidance
 * - Voice cloning upload with validation and quality feedback
 * - Responsive layout optimized for synthesis workflow
 * - Shared state management between all components
 * - Automatic capability refresh when model changes
 * - Theme-aware styling with accessibility support
 * 
 * Requirements:
 * - 1.1: Text input with character count and validation
 * - 1.2: Synthesis controls with progress tracking and estimated time
 * - 2.1: Speaker selection dropdown with preview audio
 * - 2.2: Language selection with appropriate text processing
 * - 2.3: Voice cloning audio upload with format validation and quality feedback
 * - 4.1: Dynamic model selection with searchable dropdown and confirmation dialogs
 * - 4.5: Automatic refresh of speakers/languages when model changes
 * 
 * Leverages:
 * - TextInput component from task 13
 * - SynthesisControls component from task 14
 * - SpeakerSelect component from task 17
 * - LanguageSelect component from task 18
 * - VoiceCloneUpload component from task 19
 * - ModelSelect component from task 12
 * - ModelLoadingModal component for progress tracking
 * - TTS service integration for synthesis operations
 * - Model service for speaker and language data
 * - ModelManagementService for dynamic model loading
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import TextInput from './TextInput';
import SynthesisControls from './SynthesisControls';
import SpeakerSelect from './SpeakerSelect';
import LanguageSelect from './LanguageSelect';
import VoiceCloneUpload from './VoiceCloneUpload';
import ModelSelect from './ModelSelect';
import ModelLoadingModal from './ModelLoadingModal';
import { SpeakerInfo, LanguageInfo, modelService } from '../services/modelService';
import { ModelMetadata, modelManagementService } from '../services/modelManagementService';
import { EnhancedSynthesisRequest, SynthesisResult } from '../services/ttsService';

// ===== Constants =====

/**
 * Default synthesis configuration
 */
const DEFAULT_SYNTHESIS_CONFIG = {
  /** Default synthesis format */
  format: 'wav' as const,
  /** Track progress for all synthesis requests */
  trackProgress: true,
  /** Default quality setting */
  quality: 'high' as const,
} as const;

/**
 * Panel layout breakpoints
 */
const LAYOUT_BREAKPOINTS = {
  /** Tablet breakpoint */
  TABLET: 768,
  /** Desktop breakpoint */
  DESKTOP: 1024,
} as const;

/**
 * Component spacing configuration
 */
const SPACING = {
  /** Standard component spacing */
  COMPONENT: '1.5rem',
  /** Section spacing */
  SECTION: '2rem',
  /** Panel padding */
  PANEL: '1.5rem',
} as const;

// ===== Types =====

/**
 * Synthesis panel state
 */
interface SynthesisPanelState {
  /** Current text input */
  text: string;
  /** Selected speaker information */
  selectedSpeaker: {
    id: string | null;
    info: SpeakerInfo | null;
  };
  /** Selected language information */
  selectedLanguage: {
    code: string | null;
    info: LanguageInfo | null;
  };
  /** Voice cloning file */
  voiceCloneFile: File | null;
  /** Whether synthesis is enabled based on text validation */
  synthesisEnabled: boolean;
  /** Last synthesis result */
  lastResult: SynthesisResult | null;
  /** Currently selected model */
  selectedModel: {
    id: string | null;
    info: ModelMetadata | null;
  };
  /** Model loading state */
  modelLoading: {
    isLoading: boolean;
    modelName?: string;
  };
  /** Available speakers and languages for current model */
  availableOptions: {
    speakers: SpeakerInfo[];
    languages: LanguageInfo[];
    isRefreshing: boolean;
  };
}

/**
 * SynthesisPanel component props
 */
export interface SynthesisPanelProps {
  /** Initial text value */
  initialText?: string;
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Callback when synthesis completes successfully */
  onSynthesisComplete?: (result: SynthesisResult, request: EnhancedSynthesisRequest) => void;
  /** Callback when synthesis fails */
  onSynthesisError?: (error: string) => void;
  /** Callback when synthesis starts */
  onSynthesisStart?: () => void;
  /** Callback when synthesis stops */
  onSynthesisStop?: () => void;
  /** Callback when model changes */
  onModelChange?: (modelId: string | null, modelInfo: ModelMetadata | null) => void;
  /** Additional CSS class name */
  className?: string;
  /** Whether to show advanced options (speaker, language, voice cloning) */
  showAdvancedOptions?: boolean;
  /** Whether to show model selection */
  showModelSelection?: boolean;
}

// ===== Helper Functions =====

/**
 * Validate text input for synthesis readiness
 */
function validateTextForSynthesis(text: string): boolean {
  const trimmedText = text.trim();
  return trimmedText.length > 0 && trimmedText.length <= 1000;
}

/**
 * Build synthesis request from current panel state
 */
function buildSynthesisRequest(panelState: SynthesisPanelState): EnhancedSynthesisRequest {
  const request: EnhancedSynthesisRequest = {
    text: panelState.text.trim(),
    ...DEFAULT_SYNTHESIS_CONFIG,
  };

  // Add speaker selection if available
  if (panelState.selectedSpeaker.id) {
    request.speakerId = panelState.selectedSpeaker.id;
  }

  // Add language selection if available
  if (panelState.selectedLanguage.code) {
    request.languageId = panelState.selectedLanguage.code;
  }

  // Add voice cloning file if available
  if (panelState.voiceCloneFile) {
    request.cloning_audio = panelState.voiceCloneFile;
  }

  return request;
}

/**
 * Get responsive panel layout based on screen size
 */
function getPanelLayout(): {
  columns: number;
  gridTemplate: string;
  gap: string;
} {
  const width = window.innerWidth;
  
  if (width >= LAYOUT_BREAKPOINTS.DESKTOP) {
    return {
      columns: 2,
      gridTemplate: '1fr 1fr',
      gap: SPACING.SECTION,
    };
  } else if (width >= LAYOUT_BREAKPOINTS.TABLET) {
    return {
      columns: 1,
      gridTemplate: '1fr',
      gap: SPACING.COMPONENT,
    };
  } else {
    return {
      columns: 1,
      gridTemplate: '1fr',
      gap: SPACING.COMPONENT,
    };
  }
}

// ===== SynthesisPanel Component =====

/**
 * SynthesisPanel component with integrated synthesis workflow
 * 
 * Provides a comprehensive interface for text-to-speech synthesis with
 * support for advanced options like speaker selection, language selection,
 * and voice cloning.
 */
export function SynthesisPanel({
  initialText = "",
  disabled = false,
  onSynthesisComplete,
  onSynthesisError,
  onSynthesisStart,
  onSynthesisStop,
  onModelChange,
  className = "",
  showAdvancedOptions = true,
  showModelSelection = true,
}: SynthesisPanelProps): JSX.Element {
  const { theme } = useTheme();
  
  const [panelState, setPanelState] = useState<SynthesisPanelState>({
    text: initialText,
    selectedSpeaker: { id: null, info: null },
    selectedLanguage: { code: null, info: null },
    voiceCloneFile: null,
    synthesisEnabled: validateTextForSynthesis(initialText),
    lastResult: null,
    selectedModel: { id: null, info: null },
    modelLoading: { isLoading: false },
    availableOptions: {
      speakers: [],
      languages: [],
      isRefreshing: false,
    },
  });

  // Refs for managing focus and scroll behavior
  const panelRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLDivElement>(null);
  
  // Track cache invalidation for automatic refresh (Requirement 4.5)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /**
   * Handle text input changes
   */
  const handleTextChange = useCallback((text: string) => {
    setPanelState(prev => ({
      ...prev,
      text,
      synthesisEnabled: validateTextForSynthesis(text),
    }));
  }, []);

  /**
   * Handle speaker selection changes
   */
  const handleSpeakerChange = useCallback((speakerId: string | null, speakerInfo: SpeakerInfo | null) => {
    setPanelState(prev => ({
      ...prev,
      selectedSpeaker: { id: speakerId, info: speakerInfo },
    }));
  }, []);

  /**
   * Handle language selection changes
   */
  const handleLanguageChange = useCallback((languageCode: string | null, languageInfo: LanguageInfo | null) => {
    setPanelState(prev => ({
      ...prev,
      selectedLanguage: { code: languageCode, info: languageInfo },
    }));
  }, []);

  /**
   * Handle voice clone file changes
   */
  const handleVoiceCloneFileChange = useCallback((file: File | null) => {
    setPanelState(prev => ({
      ...prev,
      voiceCloneFile: file,
    }));
  }, []);

  /**
   * Handle synthesis submission from text input (Ctrl+Enter)
   */
  const handleTextSubmit = useCallback(() => {
    if (panelState.synthesisEnabled && !disabled) {
      // Synthesis will be handled by SynthesisControls component
      // This callback provides keyboard shortcut support from TextInput
    }
  }, [panelState.synthesisEnabled, disabled]);

  /**
   * Handle successful synthesis completion
   */
  const handleSynthesisComplete = useCallback((result: SynthesisResult, request: EnhancedSynthesisRequest) => {
    setPanelState(prev => ({
      ...prev,
      lastResult: result,
    }));
    
    onSynthesisComplete?.(result, request);
  }, [onSynthesisComplete]);

  /**
   * Handle synthesis error
   */
  const handleSynthesisError = useCallback((error: string) => {
    onSynthesisError?.(error);
  }, [onSynthesisError]);

  /**
   * Handle synthesis start
   */
  const handleSynthesisStart = useCallback(() => {
    onSynthesisStart?.();
  }, [onSynthesisStart]);

  /**
   * Handle synthesis stop
   */
  const handleSynthesisStop = useCallback(() => {
    onSynthesisStop?.();
  }, [onSynthesisStop]);

  /**
   * Handle model selection changes (Requirement 4.1)
   */
  const handleModelChange = useCallback((modelId: string | null, modelInfo: ModelMetadata | null) => {
    setPanelState(prev => ({
      ...prev,
      selectedModel: { id: modelId, info: modelInfo },
      // Reset speaker and language selections when model changes
      selectedSpeaker: { id: null, info: null },
      selectedLanguage: { code: null, info: null },
    }));
    
    onModelChange?.(modelId, modelInfo);
    
    // Trigger refresh of available options (Requirement 4.5)
    if (modelId && modelInfo) {
      refreshAvailableOptions();
    }
  }, [onModelChange]);

  /**
   * Handle model loading start
   */
  const handleModelLoadingStart = useCallback((modelId: string) => {
    const modelInfo = panelState.selectedModel.info;
    setPanelState(prev => ({
      ...prev,
      modelLoading: {
        isLoading: true,
        modelName: modelInfo?.display_name || modelId,
      },
    }));
  }, [panelState.selectedModel.info]);

  /**
   * Handle model loading completion
   */
  const handleModelLoadingComplete = useCallback(async (_modelId: string, success: boolean) => {
    setPanelState(prev => ({
      ...prev,
      modelLoading: { isLoading: false },
    }));
    
    if (success) {
      // Refresh available options after successful model load (Requirement 4.5)
      await refreshAvailableOptions();
    }
  }, []);

  /**
   * Close model loading modal
   */
  const handleCloseModelLoading = useCallback(() => {
    setPanelState(prev => ({
      ...prev,
      modelLoading: { isLoading: false },
    }));
  }, []);

  /**
   * Refresh available speakers and languages for current model (Requirement 4.5)
   */
  const refreshAvailableOptions = useCallback(async () => {
    setPanelState(prev => ({
      ...prev,
      availableOptions: {
        ...prev.availableOptions,
        isRefreshing: true,
      },
    }));
    
    try {
      const [speakersResponse, languagesResponse] = await Promise.all([
        modelService.getSpeakers({ force: true }),
        modelService.getLanguages({ force: true }),
      ]);
      
      const speakers = speakersResponse.success ? speakersResponse.data : [];
      const languages = languagesResponse.success ? languagesResponse.data : [];
      
      setPanelState(prev => ({
        ...prev,
        availableOptions: {
          speakers,
          languages,
          isRefreshing: false,
        },
      }));
    } catch (error) {
      console.error('[SynthesisPanel] Error refreshing available options:', error);
      setPanelState(prev => ({
        ...prev,
        availableOptions: {
          ...prev.availableOptions,
          isRefreshing: false,
        },
      }));
    }
  }, []);

  /**
   * Load initial model information
   */
  const loadInitialModelInfo = useCallback(async () => {
    try {
      const currentModelResponse = await modelManagementService.getCurrentModel();
      if (currentModelResponse.success && currentModelResponse.data.model) {
        const modelInfo = currentModelResponse.data.model;
        setPanelState(prev => ({
          ...prev,
          selectedModel: {
            id: modelInfo.model_id,
            info: modelInfo,
          },
          // Set default language for multilingual models
          selectedLanguage: modelInfo.capabilities.multi_lingual 
            ? { 
                code: 'en', 
                info: { 
                  code: 'en', 
                  name: 'English', 
                  nativeName: 'English', 
                  available: true,
                  quality: 'excellent' as const
                } 
              }
            : { code: null, info: null },
        }));
        
        // Load available options for the current model
        await refreshAvailableOptions();
      }
    } catch (error) {
      console.error('[SynthesisPanel] Error loading initial model info:', error);
    }
  }, [refreshAvailableOptions]);

  /**
   * Subscribe to cache invalidation events for automatic refresh (Requirement 4.5)
   */
  useEffect(() => {
    const unsubscribe = modelService.onCacheInvalidation(() => {
      setRefreshTrigger(prev => prev + 1);
      refreshAvailableOptions();
    });
    
    return unsubscribe;
  }, [refreshAvailableOptions]);

  /**
   * Load initial model information on mount
   */
  useEffect(() => {
    loadInitialModelInfo();
  }, [loadInitialModelInfo]);

  /**
   * Refresh options when refresh trigger changes
   */
  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshAvailableOptions();
    }
  }, [refreshTrigger, refreshAvailableOptions]);

  // Calculate layout configuration
  const layout = getPanelLayout();
  const synthesisRequest = buildSynthesisRequest(panelState);
  
  // Check if advanced features are available based on model capabilities
  const modelCapabilities = panelState.selectedModel.info?.capabilities;
  const hasVoiceCloning = showAdvancedOptions && (modelCapabilities?.voice_cloning ?? true);
  const hasSpeakerSelection = showAdvancedOptions && (modelCapabilities?.multi_speaker ?? false) && 
    panelState.availableOptions.speakers.length > 1;
  const hasLanguageSelection = showAdvancedOptions && (modelCapabilities?.multi_lingual ?? false) && 
    panelState.availableOptions.languages.length > 1;
  const hasModelSelection = showModelSelection;

  return (
    <div 
      ref={panelRef}
      className={`synthesis-panel ${className}`}
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: SPACING.PANEL,
        backgroundColor: theme.colors.background,
        borderRadius: '16px',
        boxShadow: theme.mode === 'dark' 
          ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
          : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }}
      role="region"
      aria-label="Text-to-Speech Synthesis Panel"
    >
      {/* Panel Header */}
      <div 
        className="panel-header"
        style={{
          marginBottom: SPACING.SECTION,
          textAlign: 'center',
        }}
      >
        <h1 style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 700,
          color: theme.colors.text,
          marginBottom: '0.5rem',
        }}>
          Text-to-Speech Synthesis
        </h1>
        <p style={{
          margin: 0,
          fontSize: '1.125rem',
          color: theme.colors.textSecondary,
          lineHeight: '1.6',
        }}>
          Convert your text into natural-sounding speech with advanced voice options
        </p>
        {panelState.selectedModel.info && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(59, 130, 246, 0.1)' 
              : 'rgba(59, 130, 246, 0.05)',
            border: `1px solid ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`,
            borderRadius: '8px',
            display: 'inline-block',
          }}>
            <span style={{
              fontSize: '0.875rem',
              color: theme.colors.text,
              fontWeight: 500,
            }}>
              Current Model: {panelState.selectedModel.info.display_name}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div
        className="panel-content"
        style={{
          display: 'grid',
          gridTemplateColumns: layout.columns === 2 && showAdvancedOptions && (hasSpeakerSelection || hasLanguageSelection || hasVoiceCloning)
            ? 'minmax(0, 1fr) minmax(0, 400px)' 
            : '1fr',
          gap: layout.gap,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Text Input and Controls */}
        <div 
          className="input-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.COMPONENT,
          }}
        >
          {/* Model Selection */}
          {hasModelSelection && (
            <ModelSelect
              selectedModel={panelState.selectedModel.id}
              onModelChange={handleModelChange}
              onLoadingStart={handleModelLoadingStart}
              onLoadingComplete={handleModelLoadingComplete}
              enabled={!disabled && !panelState.modelLoading.isLoading}
              showTooltips={true}
              showConfirmation={true}
            />
          )}

          {/* Text Input */}
          <div ref={textInputRef}>
            <TextInput
              value={panelState.text}
              onChange={handleTextChange}
              onSubmit={handleTextSubmit}
              disabled={disabled || panelState.modelLoading.isLoading}
              placeholder="Enter the text you want to synthesize..."
              showCharacterCount={true}
              maxCharacters={1000}
            />
          </div>

          {/* Synthesis Controls */}
          <SynthesisControls
            text={panelState.text}
            synthesisOptions={synthesisRequest}
            enabled={panelState.synthesisEnabled && !disabled && !panelState.modelLoading.isLoading}
            onSynthesisComplete={handleSynthesisComplete}
            onSynthesisError={handleSynthesisError}
            onSynthesisStart={handleSynthesisStart}
            onSynthesisStop={handleSynthesisStop}
          />
        </div>

        {/* Right Column: Advanced Options */}
        {showAdvancedOptions && (hasSpeakerSelection || hasLanguageSelection || hasVoiceCloning) && (
          <div 
            className="options-column"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.COMPONENT,
            }}
          >
            {/* Advanced Options Header */}
            <div style={{ marginBottom: '0.5rem' }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '0.25rem',
              }}>
                Voice Options
              </h2>
              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: theme.colors.textSecondary,
                lineHeight: '1.4',
              }}>
                Customize the voice characteristics and language settings
              </p>
            </div>

            {/* Loading indicator for options refresh */}
            {panelState.availableOptions.isRefreshing && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: '6px',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}>
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
                <span>Updating voice options...</span>
              </div>
            )}

            {/* Language Selection */}
            {hasLanguageSelection && (
              <LanguageSelect
                selectedLanguage={panelState.selectedLanguage.code}
                onLanguageChange={handleLanguageChange}
                enabled={!disabled && !panelState.modelLoading.isLoading && !panelState.availableOptions.isRefreshing}
                showHints={true}
              />
            )}

            {/* Speaker Selection */}
            {hasSpeakerSelection && (
              <SpeakerSelect
                initialSelectedSpeaker={panelState.selectedSpeaker.id}
                onSpeakerChange={handleSpeakerChange}
                enabled={!disabled && !panelState.modelLoading.isLoading && !panelState.availableOptions.isRefreshing}
                showPreview={true}
                previewText={panelState.text.slice(0, 100) || "Hello, this is a preview of my voice."}
              />
            )}

            {/* Voice Cloning Upload */}
            {hasVoiceCloning && (
              <div>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: theme.colors.text,
                }}>
                  Voice Cloning
                </h3>
                <VoiceCloneUpload
                  file={panelState.voiceCloneFile}
                  onFileChange={handleVoiceCloneFileChange}
                  disabled={disabled || panelState.modelLoading.isLoading}
                  showPreview={true}
                />
                <p style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                }}>
                  Upload a reference audio to clone the voice characteristics. 
                  High-quality, clear speech samples work best.
                </p>
              </div>
            )}

            {/* No Options Available Message */}
            {!hasSpeakerSelection && !hasLanguageSelection && !hasVoiceCloning && (
              <div style={{
                padding: '1rem',
                backgroundColor: theme.mode === 'dark' 
                  ? 'rgba(75, 85, 99, 0.1)' 
                  : 'rgba(107, 114, 128, 0.05)',
                border: `1px solid ${theme.mode === 'dark' ? 'rgba(75, 85, 99, 0.2)' : 'rgba(107, 114, 128, 0.1)'}`,
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem',
                }}>
                  🎤
                </div>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}>
                  Single Voice Model
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                }}>
                  This model uses a single voice and language.
                  {hasModelSelection && ' Try selecting a different model for more voice options.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Loading Modal */}
      <ModelLoadingModal
        isVisible={panelState.modelLoading.isLoading}
        onClose={handleCloseModelLoading}
        modelName={panelState.modelLoading.modelName}
        modelService={modelManagementService}
      />

      {/* Panel Footer - Usage Tips */}
      <div 
        className="panel-footer"
        style={{
          marginTop: SPACING.SECTION,
          padding: SPACING.COMPONENT,
          backgroundColor: theme.mode === 'dark' 
            ? 'rgba(59, 130, 246, 0.1)' 
            : 'rgba(59, 130, 246, 0.05)',
          border: `1px solid ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`,
          borderRadius: '8px',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <div style={{
            fontSize: '1.25rem',
            marginTop: '0.125rem',
            flexShrink: 0,
          }}>
            💡
          </div>
          <div>
            <h4 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: theme.colors.text,
            }}>
              Pro Tips
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '1.25rem',
              fontSize: '0.75rem',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <li>Use proper punctuation for natural-sounding pauses and intonation</li>
              <li>Press Ctrl+Enter from the text area to quickly start synthesis</li>
              {hasModelSelection && <li>Change models to explore different voice characteristics and capabilities</li>}
              {hasSpeakerSelection && <li>Preview different speakers to find the perfect voice for your content</li>}
              {hasLanguageSelection && <li>Select the appropriate language for optimal text processing</li>}
              {hasVoiceCloning && <li>For voice cloning, use clear, high-quality audio samples (5-30 seconds)</li>}
              {!hasSpeakerSelection && !hasLanguageSelection && !hasVoiceCloning && (
                <li>This model provides consistent, high-quality speech synthesis with a single voice</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      
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

export default SynthesisPanel;

