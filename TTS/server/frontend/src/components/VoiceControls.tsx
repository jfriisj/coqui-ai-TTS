/**
 * VoiceControls Container Component for Coqui TTS Frontend
 * 
 * A comprehensive voice controls container that integrates speaker selection,
 * language selection, and voice cloning upload based on model capabilities.
 * Provides voice parameter coordination, validation, and seamless integration
 * with the TTS synthesis system.
 * 
 * Features:
 * - Conditional rendering based on model capabilities
 * - Integrated speaker selection with preview audio
 * - Multi-lingual language selection with text processing hints
 * - Voice cloning file upload with validation and quality feedback
 * - Voice parameter coordination and state management
 * - Theme-aware styling with accessibility support
 * - Error handling and loading states
 * - Real-time capability detection and updates
 * 
 * Requirements:
 * - 2.1: Speaker selection dropdown with preview audio
 * - 2.2: Language selection with appropriate text processing
 * - 2.3: Voice cloning audio upload with format validation
 * 
 * Leverages:
 * - SpeakerSelect component from task 12
 * - LanguageSelect component from task 13  
 * - VoiceCloneUpload component from task 14
 * - Model service capabilities from task 8
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getModelCapabilities, type SpeakerInfo, type LanguageInfo } from '../services/modelService';
import { SpeakerSelect } from './SpeakerSelect';
import { LanguageSelect } from './LanguageSelect';
import { VoiceCloneUpload } from './VoiceCloneUpload';
import type { ModelCapabilities } from '../types/api';

// ===== Constants =====

/**
 * Voice control states for tracking component status
 */
const CONTROL_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  DISABLED: 'disabled',
} as const;

type ControlState = typeof CONTROL_STATES[keyof typeof CONTROL_STATES];

/**
 * Voice parameter validation states
 */
const VALIDATION_STATES = {
  VALID: 'valid',
  INVALID: 'invalid',
  PENDING: 'pending',
} as const;

type ValidationState = typeof VALIDATION_STATES[keyof typeof VALIDATION_STATES];

// ===== Types =====

/**
 * Voice control parameters for synthesis
 */
export interface VoiceControlParams {
  /** Selected speaker ID */
  speakerId?: string | null;
  /** Selected speaker information */
  speakerInfo?: SpeakerInfo | null;
  /** Selected language code */
  languageCode?: string | null;
  /** Selected language information */
  languageInfo?: LanguageInfo | null;
  /** Voice cloning reference file */
  referenceAudio?: File | null;
  /** Whether voice cloning is being used */
  useCloning?: boolean;
}

/**
 * Voice controls validation result
 */
export interface VoiceControlValidation {
  /** Overall validation state */
  isValid: boolean;
  /** Validation state per control */
  states: {
    speaker: ValidationState;
    language: ValidationState;
    cloning: ValidationState;
  };
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * VoiceControls component state
 */
interface VoiceControlsState {
  /** Model capabilities */
  capabilities: ModelCapabilities | null;
  /** Current voice parameters */
  params: VoiceControlParams;
  /** Control state */
  controlState: ControlState;
  /** Validation result */
  validation: VoiceControlValidation;
  /** Loading error message */
  error: string | null;
  /** Whether capabilities are being refreshed */
  refreshing: boolean;
}

/**
 * VoiceControls component props
 */
export interface VoiceControlsProps {
  /** Current voice control parameters */
  value?: VoiceControlParams;
  /** Callback when voice parameters change */
  onChange?: (params: VoiceControlParams) => void;
  /** Whether controls are enabled */
  enabled?: boolean;
  /** Whether to show preview features */
  showPreview?: boolean;
  /** Whether to show text processing hints */
  showHints?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Whether to auto-refresh capabilities */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
}

// ===== Helper Functions =====

/**
 * Create initial validation state
 */
function createInitialValidation(): VoiceControlValidation {
  return {
    isValid: true,
    states: {
      speaker: VALIDATION_STATES.VALID,
      language: VALIDATION_STATES.VALID,
      cloning: VALIDATION_STATES.VALID,
    },
    errors: [],
    warnings: [],
  };
}

/**
 * Validate voice control parameters
 */
function validateVoiceParams(
  params: VoiceControlParams,
  capabilities: ModelCapabilities | null
): VoiceControlValidation {
  const validation = createInitialValidation();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!capabilities) {
    validation.isValid = false;
    errors.push('Model capabilities not loaded');
    return { ...validation, errors };
  }

  // Validate speaker selection
  if (capabilities.is_multi_speaker) {
    if (!params.speakerId && !params.useCloning) {
      validation.states.speaker = VALIDATION_STATES.INVALID;
      errors.push('Speaker selection required for multi-speaker model');
    } else if (params.speakerId && params.useCloning) {
      validation.states.speaker = VALIDATION_STATES.VALID;
      warnings.push('Speaker selection ignored when using voice cloning');
    }
  }

  // Validate language selection
  if (capabilities.is_multi_lingual) {
    if (!params.languageCode) {
      validation.states.language = VALIDATION_STATES.INVALID;
      errors.push('Language selection required for multilingual model');
    }
  }

  // Validate voice cloning
  if (capabilities.supports_cloning && params.useCloning) {
    if (!params.referenceAudio) {
      validation.states.cloning = VALIDATION_STATES.INVALID;
      errors.push('Reference audio required for voice cloning');
    }
  }

  validation.isValid = errors.length === 0;
  validation.errors = errors;
  validation.warnings = warnings;

  return validation;
}

/**
 * Get section styling based on state and capabilities
 */
function getSectionStyle(
  hasCapability: boolean,
  controlState: ControlState,
  _theme: any
): React.CSSProperties {
  if (!hasCapability) {
    return { display: 'none' };
  }

  const baseStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
    transition: 'opacity 0.2s ease',
  };

  switch (controlState) {
    case CONTROL_STATES.LOADING:
      return {
        ...baseStyle,
        opacity: 0.6,
      };
    case CONTROL_STATES.ERROR:
      return {
        ...baseStyle,
        opacity: 0.8,
        borderLeft: `3px solid #ef4444`,
        paddingLeft: '0.75rem',
      };
    case CONTROL_STATES.DISABLED:
      return {
        ...baseStyle,
        opacity: 0.5,
        pointerEvents: 'none' as const,
      };
    default:
      return baseStyle;
  }
}

// ===== VoiceControls Component =====

/**
 * VoiceControls container component with integrated voice parameter management
 * 
 * Provides a comprehensive interface for voice control parameters including
 * speaker selection, language selection, and voice cloning upload with
 * intelligent conditional rendering based on model capabilities.
 */
export function VoiceControls({
  value = {},
  onChange,
  enabled = true,
  showPreview = true,
  showHints = true,
  className = "",
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: VoiceControlsProps): JSX.Element {
  const { theme } = useTheme();
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  const [state, setState] = useState<VoiceControlsState>({
    capabilities: null,
    params: value,
    controlState: CONTROL_STATES.LOADING,
    validation: createInitialValidation(),
    error: null,
    refreshing: false,
  });

  useEffect(() => {
    const styleId = 'voice-controls-spin-animation';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  /**
   * Load model capabilities
   */
  const loadCapabilities = useCallback(async (forceRefresh = false) => {
    setState(prev => ({
      ...prev,
      controlState: forceRefresh ? CONTROL_STATES.READY : CONTROL_STATES.LOADING,
      refreshing: forceRefresh,
      error: null,
    }));

    try {
      const response = await getModelCapabilities({ force: forceRefresh });
      
      if (response.success) {
        const capabilities = response.data;
        const validation = validateVoiceParams(state.params, capabilities);
        
        setState(prev => ({
          ...prev,
          capabilities,
          controlState: CONTROL_STATES.READY,
          validation,
          refreshing: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          controlState: CONTROL_STATES.ERROR,
          error: response.error.error || 'Failed to load model capabilities',
          refreshing: false,
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        controlState: CONTROL_STATES.ERROR,
        error: error.message || 'Failed to load capabilities',
        refreshing: false,
      }));
    }
  }, [state.params]);

  /**
   * Update voice parameters and notify parent
   */
  const updateParams = useCallback((updates: Partial<VoiceControlParams>) => {
    const newParams = { ...state.params, ...updates };
    const validation = validateVoiceParams(newParams, state.capabilities);
    
    setState(prev => ({
      ...prev,
      params: newParams,
      validation,
    }));

    onChange?.(newParams);
  }, [state.params, state.capabilities, onChange]);

  /**
   * Handle speaker selection change
   */
  const handleSpeakerChange = useCallback((speakerId: string | null, speakerInfo: SpeakerInfo | null) => {
    updateParams({
      speakerId,
      speakerInfo,
      // Disable cloning when speaker is selected
      useCloning: speakerId ? false : state.params.useCloning,
    });
  }, [updateParams, state.params.useCloning]);

  /**
   * Handle language selection change
   */
  const handleLanguageChange = useCallback((languageCode: string | null, languageInfo: LanguageInfo | null) => {
    updateParams({
      languageCode,
      languageInfo,
    });
  }, [updateParams]);

  /**
   * Handle voice cloning file change
   */
  const handleCloningFileChange = useCallback((file: File | null) => {
    updateParams({
      referenceAudio: file,
      useCloning: file !== null,
      // Clear speaker selection when using cloning
      speakerId: file !== null ? null : state.params.speakerId,
      speakerInfo: file !== null ? null : state.params.speakerInfo,
    });
  }, [updateParams, state.params.speakerId, state.params.speakerInfo]);

  /**
   * Setup auto-refresh for capabilities
   */
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && state.controlState === CONTROL_STATES.READY) {
      refreshTimeoutRef.current = setTimeout(() => {
        loadCapabilities(true);
      }, refreshInterval);

      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, state.controlState, loadCapabilities]);

  /**
   * Load capabilities on component mount
   */
  useEffect(() => {
    loadCapabilities();
  }, [loadCapabilities]);

  /**
   * Update internal state when value prop changes
   */
  useEffect(() => {
    if (value !== state.params) {
      const validation = validateVoiceParams(value, state.capabilities);
      setState(prev => ({
        ...prev,
        params: value,
        validation,
      }));
    }
  }, [value, state.params, state.capabilities]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Calculate component state
  const { capabilities, params, controlState, validation, error, refreshing } = state;
  const isLoading = controlState === CONTROL_STATES.LOADING;
  const hasError = controlState === CONTROL_STATES.ERROR;
  const isDisabled = !enabled || controlState === CONTROL_STATES.DISABLED;

  // Determine which controls to show based on capabilities
  const showSpeakerSelect = capabilities?.is_multi_speaker || false;
  const showLanguageSelect = capabilities?.is_multi_lingual || false;
  const showVoiceCloning = capabilities?.supports_cloning || false;
  const hasAnyControls = showSpeakerSelect || showLanguageSelect || showVoiceCloning;

  return (
    <div 
      className={`voice-controls ${className}`}
      style={{
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: theme.colors.text,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>Voice Settings</span>
          {refreshing && (
            <span
              style={{
                width: '1rem',
                height: '1rem',
                border: `2px solid ${theme.colors.primary}`,
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </h3>
        
        {/* Status and validation indicators */}
        <div style={{
          fontSize: '0.875rem',
          color: theme.colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <span>
            {isLoading ? 'Loading model capabilities...' :
             hasError ? `Error: ${error}` :
             hasAnyControls ? `${Object.values(validation.states).filter(s => s === 'valid').length}/${Object.keys(validation.states).length} controls ready` :
             'No voice controls available for this model'
            }
          </span>
          
          {validation.errors.length > 0 && (
            <span style={{ color: '#ef4444', fontWeight: 500 }}>
              {validation.errors.length} error{validation.errors.length > 1 ? 's' : ''}
            </span>
          )}
          
          {validation.warnings.length > 0 && (
            <span style={{ color: '#f59e0b', fontWeight: 500 }}>
              {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{
          padding: '2rem',
          textAlign: 'center' as const,
          color: theme.colors.textSecondary,
        }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: `3px solid ${theme.colors.secondary}`,
            borderTop: `3px solid ${theme.colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto',
          }} />
          <p>Loading voice control capabilities...</p>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            color: '#dc2626',
            fontSize: '0.875rem',
            marginBottom: '0.5rem',
            fontWeight: 500,
          }}>
            <strong>Error loading voice controls:</strong> {error}
          </div>
          <button
            onClick={() => loadCapabilities(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid #dc2626',
              borderRadius: '6px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Voice Controls */}
      {!isLoading && !hasError && hasAnyControls && (
        <div className="voice-controls-content">
          {/* Speaker Selection */}
          <div style={getSectionStyle(showSpeakerSelect, controlState, theme)}>
            <SpeakerSelect
              initialSelectedSpeaker={params.speakerId}
              onSpeakerChange={handleSpeakerChange}
              enabled={!isDisabled && !params.useCloning}
              showPreview={showPreview}
            />
          </div>

          {/* Language Selection */}
          <div style={getSectionStyle(showLanguageSelect, controlState, theme)}>
            <LanguageSelect
              selectedLanguage={params.languageCode}
              onLanguageChange={handleLanguageChange}
              enabled={!isDisabled}
              showHints={showHints}
            />
          </div>

          {/* Voice Cloning Upload */}
          <div style={getSectionStyle(showVoiceCloning, controlState, theme)}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: '0.5rem',
              }}>
                Voice Cloning
              </label>
              <p style={{
                margin: 0,
                fontSize: '0.75rem',
                color: theme.colors.textSecondary,
                lineHeight: '1.4',
              }}>
                Upload reference audio to clone a specific voice. This will override speaker selection.
              </p>
            </div>
            
            <VoiceCloneUpload
              file={params.referenceAudio || null}
              onFileChange={handleCloningFileChange}
              disabled={isDisabled}
              showPreview={showPreview}
            />
          </div>
        </div>
      )}

      {/* No Controls Message */}
      {!isLoading && !hasError && !hasAnyControls && (
        <div style={{
          padding: '2rem',
          textAlign: 'center' as const,
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.secondary}`,
          borderRadius: '8px',
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
            No voice controls needed
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            This model uses a single voice and language setting.
          </p>
        </div>
      )}

      {/* Validation Feedback */}
      {!isLoading && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#dc2626',
              }}>
                Please fix the following issues:
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                fontSize: '0.875rem',
                color: '#dc2626',
              }}>
                {validation.errors.map((error, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <div>
              <h4 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#f59e0b',
              }}>
                Note:
              </h4>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                fontSize: '0.875rem',
                color: '#f59e0b',
              }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default VoiceControls;