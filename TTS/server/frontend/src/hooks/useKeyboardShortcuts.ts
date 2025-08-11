/**
 * Keyboard Shortcuts Hook for Coqui TTS Frontend
 * 
 * Provides comprehensive keyboard shortcut functionality for desktop users
 * with proper accessibility support and focus management. Implements shortcuts
 * for synthesis (Ctrl+Enter), audio playback (Space), and contextual help (?).
 * 
 * Features:
 * - Desktop-focused keyboard shortcuts with browser compatibility
 * - Focus management to prevent conflicts with form inputs
 * - Accessibility considerations for screen readers
 * - Proper event cleanup and memory management
 * - Configurable shortcut handlers for different contexts
 * 
 * Requirements:
 * - 3.1: Desktop keyboard shortcuts (Ctrl+Enter for synthesis, Space for play/pause)
 * - 5.5: Contextual help with single key press (? key)
 */

import { useEffect, useCallback, useRef } from 'react';

// ===== Types and Interfaces =====

/**
 * Keyboard shortcut configuration interface
 */
export interface KeyboardShortcut {
  /** Keys combination (e.g., 'ctrl+enter', 'space', '?') */
  keys: string;
  /** Description for accessibility and help system */
  description: string;
  /** Handler function to execute */
  handler: (event: KeyboardEvent) => void;
  /** Whether shortcut is enabled */
  enabled?: boolean;
  /** Prevent shortcut when focus is on these elements */
  preventOnElements?: string[];
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Stop event propagation */
  stopPropagation?: boolean;
}

/**
 * Keyboard shortcut handlers interface
 */
export interface KeyboardShortcutHandlers {
  /** Trigger TTS synthesis (Ctrl+Enter) */
  onSynthesize?: () => void;
  /** Toggle audio playback (Space) */
  onTogglePlayback?: () => void;
  /** Show help overlay (? key) */
  onShowHelp?: () => void;
  /** Custom shortcut handlers */
  customShortcuts?: KeyboardShortcut[];
}

/**
 * Hook options for customizing behavior
 */
export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled globally */
  enabled?: boolean;
  /** Elements to exclude from shortcut handling */
  excludeElements?: string[];
  /** Whether to show console debug information */
  debug?: boolean;
}

/**
 * Hook return value with shortcut information
 */
export interface KeyboardShortcutsState {
  /** Currently registered shortcuts */
  shortcuts: KeyboardShortcut[];
  /** Whether shortcuts are currently active */
  isEnabled: boolean;
  /** Get shortcut description by key combination */
  getShortcutDescription: (keys: string) => string | undefined;
}

// ===== Constants =====

/**
 * Default elements where shortcuts should be disabled
 * Prevents conflicts with form inputs and editable content
 */
const DEFAULT_EXCLUDE_ELEMENTS = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[contenteditable=""]',
];

/**
 * Key mapping for cross-browser compatibility
 */
const KEY_MAPPINGS: Record<string, string> = {
  ' ': 'space',
  'Enter': 'enter',
  'Escape': 'escape',
  'ArrowUp': 'arrowup',
  'ArrowDown': 'arrowdown',
  'ArrowLeft': 'arrowleft',
  'ArrowRight': 'arrowright',
  'Tab': 'tab',
  'Backspace': 'backspace',
  'Delete': 'delete',
};

// ===== Utility Functions =====

/**
 * Normalize key combination for consistent matching
 */
function normalizeKeys(keys: string): string {
  return keys
    .toLowerCase()
    .split('+')
    .map(key => key.trim())
    .sort()
    .join('+');
}

/**
 * Extract key combination from keyboard event
 */
function getKeysFromEvent(event: KeyboardEvent): string {
  const keys: string[] = [];
  
  // Add modifier keys
  if (event.ctrlKey) keys.push('ctrl');
  if (event.altKey) keys.push('alt');
  if (event.shiftKey) keys.push('shift');
  if (event.metaKey) keys.push('meta');
  
  // Add main key
  let key = event.key;
  
  // Normalize key using mapping
  if (KEY_MAPPINGS[key]) {
    key = KEY_MAPPINGS[key];
  } else {
    key = key.toLowerCase();
  }
  
  keys.push(key);
  
  return normalizeKeys(keys.join('+'));
}

/**
 * Check if current focus is on an excluded element
 */
function isElementExcluded(excludeElements: string[]): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  return excludeElements.some(selector => {
    try {
      return activeElement.matches(selector);
    } catch (error) {
      // Invalid selector
      return false;
    }
  });
}

// ===== Main Hook =====

/**
 * Custom hook for managing keyboard shortcuts in the TTS frontend
 * 
 * @param handlers - Shortcut handler functions
 * @param options - Hook configuration options
 * @returns Keyboard shortcuts state and utilities
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers = {},
  options: UseKeyboardShortcutsOptions = {}
): KeyboardShortcutsState {
  const {
    enabled = true,
    excludeElements = DEFAULT_EXCLUDE_ELEMENTS,
    debug = false,
  } = options;
  
  // Refs for stable handler references
  const handlersRef = useRef<KeyboardShortcutHandlers>(handlers);
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  // Update handlers ref when handlers change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);
  
  // Build shortcuts configuration
  const buildShortcuts = useCallback((): KeyboardShortcut[] => {
    const shortcuts: KeyboardShortcut[] = [];
    
    // Synthesis shortcut (Ctrl+Enter)
    if (handlersRef.current.onSynthesize) {
      shortcuts.push({
        keys: 'ctrl+enter',
        description: 'Synthesize text to speech (Ctrl+Enter)',
        handler: (_event) => {
          handlersRef.current.onSynthesize?.();
          if (debug) {
            console.log('[KeyboardShortcuts] Synthesis triggered via Ctrl+Enter');
          }
        },
        enabled: true,
        preventDefault: true,
        stopPropagation: true,
        preventOnElements: excludeElements,
      });
    }
    
    // Playback toggle shortcut (Space)
    if (handlersRef.current.onTogglePlayback) {
      shortcuts.push({
        keys: 'space',
        description: 'Toggle audio playback (Space)',
        handler: (_event) => {
          handlersRef.current.onTogglePlayback?.();
          if (debug) {
            console.log('[KeyboardShortcuts] Playback toggled via Space');
          }
        },
        enabled: true,
        preventDefault: true,
        stopPropagation: true,
        preventOnElements: excludeElements,
      });
    }
    
    // Help shortcut (? key)
    if (handlersRef.current.onShowHelp) {
      shortcuts.push({
        keys: '?',
        description: 'Show keyboard shortcuts help (?)',
        handler: (_event) => {
          handlersRef.current.onShowHelp?.();
          if (debug) {
            console.log('[KeyboardShortcuts] Help triggered via ?');
          }
        },
        enabled: true,
        preventDefault: true,
        stopPropagation: true,
        preventOnElements: [], // Allow help from any context
      });
    }
    
    // Custom shortcuts
    if (handlersRef.current.customShortcuts) {
      shortcuts.push(...handlersRef.current.customShortcuts);
    }
    
    return shortcuts;
  }, [excludeElements, debug]);
  
  // Update shortcuts when configuration changes
  useEffect(() => {
    shortcutsRef.current = buildShortcuts();
  }, [buildShortcuts]);
  
  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    const keys = getKeysFromEvent(event);
    const shortcuts = shortcutsRef.current;
    
    if (debug) {
      console.log('[KeyboardShortcuts] Key pressed:', keys);
    }
    
    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      const normalizedShortcutKeys = normalizeKeys(shortcut.keys);
      return normalizedShortcutKeys === keys && (shortcut.enabled !== false);
    });
    
    if (!matchingShortcut) return;
    
    // Check if current focus should prevent this shortcut
    const preventOnElements = matchingShortcut.preventOnElements || [];
    if (preventOnElements.length > 0 && isElementExcluded(preventOnElements)) {
      if (debug) {
        console.log('[KeyboardShortcuts] Shortcut prevented due to focus on excluded element');
      }
      return;
    }
    
    // Execute shortcut handler
    try {
      if (matchingShortcut.preventDefault) {
        event.preventDefault();
      }
      
      if (matchingShortcut.stopPropagation) {
        event.stopPropagation();
      }
      
      matchingShortcut.handler(event);
      
      if (debug) {
        console.log('[KeyboardShortcuts] Executed shortcut:', matchingShortcut.keys);
      }
    } catch (error) {
      console.error('[KeyboardShortcuts] Error executing shortcut handler:', error);
    }
  }, [enabled, debug]);
  
  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;
    
    // Use capture phase to handle shortcuts before other event listeners
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    if (debug) {
      console.log('[KeyboardShortcuts] Event listeners attached');
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      
      if (debug) {
        console.log('[KeyboardShortcuts] Event listeners removed');
      }
    };
  }, [enabled, handleKeyDown, debug]);
  
  // Get shortcut description by key combination
  const getShortcutDescription = useCallback((keys: string): string | undefined => {
    const normalizedKeys = normalizeKeys(keys);
    const shortcut = shortcutsRef.current.find(s => 
      normalizeKeys(s.keys) === normalizedKeys
    );
    return shortcut?.description;
  }, []);
  
  // Return hook state
  return {
    shortcuts: shortcutsRef.current,
    isEnabled: enabled,
    getShortcutDescription,
  };
}

// ===== Helper Hooks =====

/**
 * Pre-configured hook for common TTS shortcuts
 * Provides the standard shortcuts expected in the TTS interface
 */
export function useTTSKeyboardShortcuts(
  onSynthesize?: () => void,
  onTogglePlayback?: () => void,
  onShowHelp?: () => void,
  options: UseKeyboardShortcutsOptions = {}
) {
  return useKeyboardShortcuts({
    onSynthesize,
    onTogglePlayback,
    onShowHelp,
  }, options);
}

/**
 * Hook for getting all available shortcuts for help display
 * Returns formatted shortcut information for UI display
 */
export function useShortcutHelp() {
  const shortcuts: Array<{ keys: string; description: string; category: string }> = [
    {
      keys: 'Ctrl+Enter',
      description: 'Synthesize text to speech',
      category: 'Synthesis',
    },
    {
      keys: 'Space',
      description: 'Toggle audio playback (play/pause)',
      category: 'Audio',
    },
    {
      keys: '?',
      description: 'Show keyboard shortcuts help',
      category: 'Help',
    },
  ];
  
  return { shortcuts };
}

// ===== Accessibility Helpers =====

/**
 * Add ARIA labels and descriptions for keyboard shortcuts
 * Should be used on interactive elements that have shortcuts
 */
export function getShortcutAriaProps(
  keys: string,
  description?: string
): { 'aria-keyshortcuts': string; 'aria-describedby'?: string } {
  const ariaProps: { 'aria-keyshortcuts': string; 'aria-describedby'?: string } = {
    'aria-keyshortcuts': keys,
  };
  
  if (description) {
    // In a real implementation, you'd generate a unique ID and create
    // a hidden description element. For now, we'll just include the key.
    ariaProps['aria-describedby'] = `shortcut-${keys.replace(/[^a-zA-Z0-9]/g, '')}`;
  }
  
  return ariaProps;
}