/**
 * LanguageSelect Component for Coqui TTS Frontend
 * 
 * Language selection interface for multilingual TTS models with text processing
 * guidance. Provides dropdown selection with language information, quality indicators,
 * and seamless integration with the TTS synthesis system.
 * 
 * Features:
 * - Language dropdown with native names and quality indicators
 * - Text processing hints for selected languages
 * - Loading states during language list updates
 * - Error handling for language loading failures
 * - Theme-aware styling with accessibility support
 * - Real-time language information updates
 * - Quality indicators for different languages
 * 
 * Requirements:
 * - 2.2: Language selection with appropriate text processing
 * 
 * Leverages:
 * - Model service language data from task 8
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getModelLanguages, LanguageInfo } from '../services/modelService';

// ===== Constants =====

/**
 * Language selection states
 */
const SELECTION_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  EMPTY: 'empty',
} as const;

type SelectionState = typeof SELECTION_STATES[keyof typeof SELECTION_STATES];

/**
 * Text processing hints for different languages
 */
const TEXT_PROCESSING_HINTS: Record<string, string> = {
  'en': 'Use standard English punctuation. Numbers are automatically converted to words.',
  'es': 'Use Spanish accents (á, é, í, ó, ú, ñ). Numbers are converted to Spanish words.',
  'fr': 'Use French accents (à, é, è, ê, ë, ç). Numbers are converted to French words.',
  'de': 'Use German umlauts (ä, ö, ü, ß). Numbers are converted to German words.',
  'it': 'Use Italian accents (à, è, é, ì, í, ò, ó, ù, ú). Numbers are converted to Italian words.',
  'pt': 'Use Portuguese accents (ã, á, à, â, é, ê, í, ó, ô, õ, ú, ç). Numbers are converted to Portuguese words.',
  'pl': 'Use Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż). Numbers are converted to Polish words.',
  'tr': 'Use Turkish characters (ç, ğ, ı, ö, ş, ü). Numbers are converted to Turkish words.',
  'ru': 'Use Cyrillic script. Numbers are converted to Russian words. Stress marks optional.',
  'nl': 'Use Dutch punctuation. Numbers are converted to Dutch words.',
  'cs': 'Use Czech diacritics (á, č, ď, é, ě, í, ň, ó, ř, š, t, ú, ů, ý, ž). Numbers are converted to Czech words.',
  'ar': 'Use Arabic script (right-to-left). Numbers are converted to Arabic words.',
  'zh': 'Use simplified or traditional Chinese characters. Numbers are converted to Chinese words.',
  'ja': 'Use Hiragana, Katakana, or Kanji. Numbers are converted to Japanese words.',
  'hu': 'Use Hungarian accents (á, é, í, ó, ö, ő, ú, ü, ű). Numbers are converted to Hungarian words.',
  'ko': 'Use Korean Hangul script. Numbers are converted to Korean words.',
} as const;

/**
 * Quality indicator colors and descriptions
 */
const QUALITY_INDICATORS = {
  excellent: { 
    color: '#22c55e', 
    description: 'Excellent text processing and synthesis quality' 
  },
  good: { 
    color: '#f59e0b', 
    description: 'Good quality with minor limitations' 
  },
  experimental: { 
    color: '#ef4444', 
    description: 'Experimental support - may have limitations' 
  },
} as const;

// ===== Types =====

/**
 * Language selection component state
 */
interface LanguageSelectState {
  /** Available languages */
  languages: LanguageInfo[];
  /** Currently selected language code */
  selectedLanguageCode: string | null;
  /** Language selection state */
  selectionState: SelectionState;
  /** Loading error message */
  error: string | null;
}

/**
 * LanguageSelect component props
 */
export interface LanguageSelectProps {
  /** Currently selected language code */
  selectedLanguage?: string | null;
  /** Callback when language selection changes */
  onLanguageChange?: (languageCode: string | null, languageInfo: LanguageInfo | null) => void;
  /** Whether language selection is enabled */
  enabled?: boolean;
  /** Whether to show text processing hints */
  showHints?: boolean;
  /** Additional CSS class name */
  className?: string;
}

// ===== Helper Functions =====

/**
 * Generate language display name with native name
 */
function getLanguageDisplayName(language: LanguageInfo): string {
  if (language.name === language.nativeName) {
    return language.name;
  }
  return `${language.name} (${language.nativeName})`;
}

/**
 * Get quality indicator for a language
 */
function getQualityIndicator(quality?: LanguageInfo['quality']): {
  color: string;
  description: string;
} {
  if (!quality) {
    return QUALITY_INDICATORS.good;
  }
  return QUALITY_INDICATORS[quality];
}

/**
 * Get language option styling based on selection state
 */
function getLanguageOptionStyle(isSelected: boolean, theme: any): React.CSSProperties {
  return {
    padding: '0.75rem 1rem',
    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
    color: isSelected ? '#ffffff' : theme.colors.text,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    borderBottom: `1px solid ${theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
  };
}

/**
 * Get text processing hint for a language
 */
function getTextProcessingHint(languageCode: string): string {
  return TEXT_PROCESSING_HINTS[languageCode] || 
    'Follow standard text formatting for this language. Numbers are automatically processed.';
}

// ===== LanguageSelect Component =====

/**
 * LanguageSelect component with text processing guidance
 * 
 * Provides language selection dropdown with integrated text processing
 * hints for multilingual TTS models.
 */
export function LanguageSelect({
  selectedLanguage: selectedLanguageCode = null,
  onLanguageChange,
  enabled = true,
  showHints = true,
  className = "",
}: LanguageSelectProps): JSX.Element {
  const { theme } = useTheme();
  
  const [selectState, setSelectState] = useState<LanguageSelectState>({
    languages: [],
    selectedLanguageCode: selectedLanguageCode,
    selectionState: SELECTION_STATES.LOADING,
    error: null,
  });
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  /**
   * Load available languages from model service
   */
  const loadLanguages = useCallback(async () => {
    setSelectState(prev => ({
      ...prev,
      selectionState: SELECTION_STATES.LOADING,
      error: null,
    }));
    
    try {
      const languagesResponse = await getModelLanguages();
      
      if (languagesResponse.success) {
        const languages = languagesResponse.data;
        
        setSelectState(prev => ({
          ...prev,
          languages,
          selectionState: languages.length > 0 ? SELECTION_STATES.READY : SELECTION_STATES.EMPTY,
          selectedLanguageCode: selectedLanguageCode || (languages.length > 0 ? languages[0].code : null),
        }));
        
        // Notify parent of initial selection if no language was pre-selected
        if (!selectedLanguageCode && languages.length > 0) {
          onLanguageChange?.(languages[0].code, languages[0]);
        }
      } else {
        setSelectState(prev => ({
          ...prev,
          selectionState: SELECTION_STATES.ERROR,
          error: languagesResponse.error.error || 'Failed to load languages',
        }));
      }
    } catch (error) {
      setSelectState(prev => ({
        ...prev,
        selectionState: SELECTION_STATES.ERROR,
        error: error instanceof Error ? error.message : 'Failed to load languages',
      }));
    }
  }, [selectedLanguageCode, onLanguageChange]);

  /**
   * Handle language selection change
   */
  const handleLanguageChange = useCallback((languageCode: string) => {
    const language = selectState.languages.find(l => l.code === languageCode) || null;
    
    setSelectState(prev => ({
      ...prev,
      selectedLanguageCode: languageCode,
    }));
    
    setIsDropdownOpen(false);
    onLanguageChange?.(languageCode, language);
  }, [selectState.languages, onLanguageChange]);
  
  /**
   * Handle clicks outside dropdown to close it
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  }, []);
  
  /**
   * Load languages on component mount
   */
  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);
  
  /**
   * Setup click outside handler
   */
  useEffect(() => {
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen, handleClickOutside]);
  
  // Calculate component state
  const { languages, selectedLanguageCode: currentSelectedCode, selectionState, error } = selectState;
  const selectedLanguage = languages.find(l => l.code === currentSelectedCode);
  const hasMultipleLanguages = languages.length > 1;
  const isLoading = selectionState === SELECTION_STATES.LOADING;
  const hasError = selectionState === SELECTION_STATES.ERROR;
  const isEmpty = selectionState === SELECTION_STATES.EMPTY;
  
  // Don't render if model doesn't support multiple languages and only has single language
  if (isEmpty || (!hasMultipleLanguages && languages.length === 1 && languages[0].code === 'en')) {
    return <div style={{ display: 'none' }} />; // Hidden component
  }
  
  return (
    <div 
      className={`language-select ${className}`}
      style={{
        width: '100%',
        marginBottom: '1rem',
      }}
    >
      {/* Label */}
      <label 
        htmlFor="language-select-dropdown"
        style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: theme.colors.text,
          marginBottom: '0.5rem',
        }}
      >
        Language Selection
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
          <span>Loading languages...</span>
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
            onClick={loadLanguages}
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
      
      {/* Language Selection Dropdown */}
      {selectionState === SELECTION_STATES.READY && (
        <div
          ref={dropdownRef}
          className="language-dropdown"
          style={{
            position: 'relative',
            width: '100%',
          }}
        >
          {/* Dropdown Button */}
          <button
            id="language-select-dropdown"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={!enabled}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-describedby="language-select-description"
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
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.secondary;
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
              {selectedLanguage && (
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getQualityIndicator(selectedLanguage.quality).color,
                    flexShrink: 0,
                  }}
                />
              )}
              <span>
                {selectedLanguage 
                  ? getLanguageDisplayName(selectedLanguage)
                  : 'Select a language...'
                }
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
              aria-label="Available languages"
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
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: theme.mode === 'dark' 
                  ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
                  : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              }}
            >
              {languages.map((language) => {
                const isSelected = language.code === selectedLanguageCode;
                const qualityIndicator = getQualityIndicator(language.quality);
                
                return (
                  <div
                    key={language.code}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleLanguageChange(language.code)}
                    style={{
                      ...getLanguageOptionStyle(isSelected, theme),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = theme.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.05)' 
                          : 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Quality Indicator */}
                    <div
                      title={qualityIndicator.description}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: qualityIndicator.color,
                        flexShrink: 0,
                      }}
                    />
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: isSelected ? 600 : 400 }}>
                        {getLanguageDisplayName(language)}
                      </div>
                      {language.quality && (
                        <div style={{
                          fontSize: '0.75rem',
                          opacity: 0.8,
                          marginTop: '0.25rem',
                          textTransform: 'capitalize',
                        }}>
                          {language.quality} quality
                        </div>
                      )}
                    </div>
                    
                    {/* Available Badge */}
                    {language.available && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          opacity: 0.7,
                        }}
                      >
                        Available
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Text Processing Hint */}
      {showHints && selectedLanguage && selectionState === SELECTION_STATES.READY && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            backgroundColor: theme.mode === 'dark' 
              ? 'rgba(59, 130, 246, 0.1)' 
              : 'rgba(59, 130, 246, 0.05)',
            border: `1px solid ${theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`,
            borderRadius: '6px',
          }}
        >
          <div 
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: theme.colors.text,
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Text Processing Hint
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            lineHeight: '1.4',
          }}>
            {getTextProcessingHint(selectedLanguage.code)}
          </div>
        </div>
      )}
      
      {/* Description */}
      <div
        id="language-select-description"
        style={{
          fontSize: '0.75rem',
          color: theme.colors.textSecondary,
          marginTop: '0.5rem',
        }}
      >
        {hasMultipleLanguages 
          ? `Choose from ${languages.length} supported languages. Quality indicators show text processing reliability.`
          : 'Single language model - no selection needed.'
        }
      </div>
      
      {/* CSS Animation for Spinners */}
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

export default LanguageSelect;

