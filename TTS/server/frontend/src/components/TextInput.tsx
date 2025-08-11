/**
 * TextInput Component for Coqui TTS Frontend
 * 
 * A comprehensive text input component with character counting, validation,
 * and visual feedback. Provides real-time character limit checking with
 * a 1000 character maximum to match Flask API constraints.
 * 
 * Features:
 * - Text area with auto-resize functionality
 * - Real-time character count display with visual feedback
 * - Character limit validation (1000 char max)
 * - Input state management with validation feedback
 * - Theme-aware styling with light/dark mode support
 * - Accessibility features (ARIA labels, screen reader support)
 * 
 * Requirements:
 * - 1.1: Text input with character count and validation
 * 
 * API Constraints:
 * - 1000 character maximum text length (Flask API limit)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// ===== Constants =====

/**
 * Maximum allowed character count for text input
 * Matches the Flask API constraint for text synthesis
 */
const MAX_CHARACTER_COUNT = 1000;

/**
 * Warning threshold for character count (90% of max)
 * Shows warning styling when approaching limit
 */
const WARNING_THRESHOLD = Math.floor(MAX_CHARACTER_COUNT * 0.9); // 900 characters

/**
 * Minimum height for the text area in pixels
 */
const MIN_TEXTAREA_HEIGHT = 120;

// ===== Types =====

/**
 * Text input validation state
 */
interface ValidationState {
  /** Whether the current input is valid */
  isValid: boolean;
  /** Validation error message (if any) */
  errorMessage?: string;
  /** Whether input is at warning threshold */
  isWarning: boolean;
}

/**
 * TextInput component props
 */
export interface TextInputProps {
  /** Current text value */
  value: string;
  /** Callback fired when text changes */
  onChange: (text: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Callback fired when Enter key is pressed (with Ctrl/Cmd) */
  onSubmit?: () => void;
  /** Whether to show character count */
  showCharacterCount?: boolean;
  /** Custom maximum character count (defaults to 1000) */
  maxCharacters?: number;
}

// ===== Helper Functions =====

/**
 * Validate text input and return validation state
 */
function validateText(text: string, maxChars: number = MAX_CHARACTER_COUNT): ValidationState {
  const length = text.length;
  
  if (length > maxChars) {
    return {
      isValid: false,
      errorMessage: `Text exceeds maximum length of ${maxChars} characters`,
      isWarning: false,
    };
  }
  
  if (length > WARNING_THRESHOLD) {
    return {
      isValid: true,
      errorMessage: undefined,
      isWarning: true,
    };
  }
  
  return {
    isValid: true,
    errorMessage: undefined,
    isWarning: false,
  };
}

/**
 * Get character count display color based on validation state
 */
function getCharCountColor(validation: ValidationState, theme: any): string {
  if (!validation.isValid) {
    return '#ef4444'; // Red for errors
  }
  if (validation.isWarning) {
    return '#f59e0b'; // Orange for warnings
  }
  return theme.colors.textSecondary;
}

// ===== TextInput Component =====

/**
 * TextInput component with character counting and validation
 * 
 * Provides a text area input with real-time character validation,
 * visual feedback, and accessibility features.
 */
export function TextInput({
  value,
  onChange,
  placeholder = "Enter text to synthesize...",
  disabled = false,
  className = "",
  onSubmit,
  showCharacterCount = true,
  maxCharacters = MAX_CHARACTER_COUNT,
}: TextInputProps): JSX.Element {
  const { theme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Calculate validation state
  const validation = validateText(value, maxCharacters);
  const characterCount = value.length;
  
  /**
   * Handle text change with validation
   */
  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    onChange(newText);
  }, [onChange]);
  
  /**
   * Handle keyboard shortcuts (Ctrl+Enter for submit)
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && onSubmit) {
      event.preventDefault();
      if (validation.isValid) {
        onSubmit();
      }
    }
  }, [onSubmit, validation.isValid]);
  
  /**
   * Auto-resize textarea based on content
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to calculate new height
    textarea.style.height = 'auto';
    
    // Calculate new height based on scroll height
    const newHeight = Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value]);
  
  /**
   * Focus handlers
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);
  
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);
  
  // Character count color
  const charCountColor = getCharCountColor(validation, theme);
  
  // Border color based on validation and focus state
  const borderColor = !validation.isValid 
    ? '#ef4444' 
    : isFocused 
      ? theme.colors.primary 
      : theme.colors.secondary;
  
  return (
    <div 
      className={`text-input-container ${className}`}
      style={{
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Text input for TTS synthesis"
        aria-describedby={showCharacterCount ? "char-count" : undefined}
        aria-invalid={!validation.isValid}
        style={{
          width: '100%',
          minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
          padding: '1rem',
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          fontSize: '1rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: '1.5',
          resize: 'none',
          outline: 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: isFocused ? `0 0 0 3px ${theme.colors.primary}20` : 'none',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
        // Prevent spell-check and autocorrect for cleaner text input
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      
      {/* Character Count and Validation */}
      <div
        className="text-input-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        {/* Validation Error Message */}
        <div 
          className="validation-message"
          style={{
            color: !validation.isValid ? '#ef4444' : 'transparent',
            fontWeight: 500,
            minHeight: '1.25rem',
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {validation.errorMessage || ''}
        </div>
        
        {/* Character Count */}
        {showCharacterCount && (
          <div
            id="char-count"
            className="character-count"
            style={{
              color: charCountColor,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-label={`${characterCount} of ${maxCharacters} characters used`}
          >
            {characterCount.toLocaleString()} / {maxCharacters.toLocaleString()}
          </div>
        )}
      </div>
      
      {/* Keyboard Shortcut Hint */}
      {onSubmit && (
        <div
          className="shortcut-hint"
          style={{
            fontSize: '0.75rem',
            color: theme.colors.textSecondary,
            marginTop: '0.25rem',
            textAlign: 'right',
            fontStyle: 'italic',
          }}
        >
          Press <kbd 
            style={{ 
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', 
              padding: '0.1rem 0.3rem', 
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
            }}
          >
            Ctrl+Enter
          </kbd> to synthesize
        </div>
      )}
    </div>
  );
}

// ===== Export =====

export default TextInput;