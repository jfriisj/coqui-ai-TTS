/**
 * Main App Component for Coqui TTS Frontend
 * 
 * The root component that sets up context providers, global keyboard shortcuts,
 * and the main application layout. Provides theme management, audio functionality,
 * and help overlay functionality for the desktop-focused TTS interface.
 * 
 * Features:
 * - Theme context provider with light/dark theme switching
 * - Audio context provider for TTS audio management
 * - Global keyboard shortcut handling (Ctrl+Enter, Space, ?)
 * - Help overlay with keyboard shortcuts display
 * - Main application layout structure with all advanced components
 * - Error boundary for graceful error handling
 * 
 * Requirements:
 * - 3.1: Desktop keyboard shortcuts (Ctrl+Enter for synthesis, Space for play/pause)
 * - 3.2: Theme switching with consistent updates and preference memory
 * - 5.5: Contextual help with single key press (? key)
 */

import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AudioProvider } from './contexts/AudioContext';
import MainLayout from './components/MainLayout';
import HelpOverlay from './components/HelpOverlay';
import ErrorBoundary from './components/ErrorBoundary';

// ===== App Inner Component =====

/**
 * Inner app component that uses the theme and audio contexts
 * Separated from the main App component to ensure contexts are available
 */
function AppInner(): JSX.Element {
  // Help overlay state
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  /**
   * Handle keyboard shortcuts for help overlay
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show help on ? key (shift + slash on most keyboards)
      if (event.key === '?' && !event.ctrlKey && !event.altKey) {
        // Don't trigger if user is typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }
        
        event.preventDefault();
        setIsHelpVisible(prev => !prev);
      }
      
      // Hide help on Escape key
      if (event.key === 'Escape' && isHelpVisible) {
        event.preventDefault();
        setIsHelpVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpVisible]);

  /**
   * Handle help overlay close
   */
  const handleHelpClose = useCallback(() => {
    setIsHelpVisible(false);
  }, []);

  return (
    <div className="app">
      {/* Main Application Layout */}
      <MainLayout />
      
      {/* Help Overlay */}
      <HelpOverlay
        isVisible={isHelpVisible}
        onClose={handleHelpClose}
      />
    </div>
  );
}

// ===== Main App Component =====

/**
 * Main App component with context providers and error boundary
 */
export function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AudioProvider>
          <AppInner />
        </AudioProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// ===== Export =====

export default App;