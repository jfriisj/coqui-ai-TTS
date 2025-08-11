import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeConfiguration } from '../types/api';

/**
 * Theme context value interface
 * Provides theme state and toggle functionality
 */
interface ThemeContextValue {
  /** Current theme configuration */
  theme: ThemeConfiguration;
  /** Toggle between light and dark themes */
  toggleTheme: () => void;
  /** Set specific theme mode */
  setThemeMode: (mode: 'light' | 'dark') => void;
}

/**
 * Light theme configuration
 */
const LIGHT_THEME: ThemeConfiguration = {
  mode: 'light',
  colors: {
    primary: '#2563eb',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#475569',
  },
};

/**
 * Dark theme configuration
 */
const DARK_THEME: ThemeConfiguration = {
  mode: 'dark',
  colors: {
    primary: '#3b82f6',
    secondary: '#94a3b8',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
  },
};

/**
 * Local storage key for theme persistence
 */
const THEME_STORAGE_KEY = 'coqui-tts-theme';

/**
 * Theme context for providing theme state throughout the application
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Get initial theme from localStorage or system preference
 */
function getInitialTheme(): ThemeConfiguration {
  // Check localStorage first
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme) {
    try {
      const parsed = JSON.parse(storedTheme) as { mode: 'light' | 'dark' };
      return parsed.mode === 'dark' ? DARK_THEME : LIGHT_THEME;
    } catch {
      // Fall back to system preference if stored theme is invalid
    }
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return DARK_THEME;
  }

  return LIGHT_THEME;
}

/**
 * Theme provider props
 */
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Theme context provider component
 * Manages theme state and provides theme configuration to child components
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [theme, setTheme] = useState<ThemeConfiguration>(getInitialTheme);

  /**
   * Persist theme to localStorage
   */
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: theme.mode }));
  }, [theme.mode]);

  /**
   * Listen for system theme preference changes
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    function handleSystemThemeChange(event: MediaQueryListEvent) {
      // Only update if no user preference is stored
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (!storedTheme) {
        setTheme(event.matches ? DARK_THEME : LIGHT_THEME);
      }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  /**
   * Apply theme CSS custom properties to document root
   */
  useEffect(() => {
    const root = document.documentElement;
    const colors = theme.colors;

    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-secondary', colors.textSecondary);
    
    // Add theme class to body for component-specific styling
    document.body.className = `theme-${theme.mode}`;
  }, [theme]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setTheme(current => current.mode === 'light' ? DARK_THEME : LIGHT_THEME);
  };

  /**
   * Set specific theme mode
   */
  const setThemeMode = (mode: 'light' | 'dark') => {
    setTheme(mode === 'dark' ? DARK_THEME : LIGHT_THEME);
  };

  const contextValue: ThemeContextValue = {
    theme,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context
 * Must be used within a ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

/**
 * Hook to get theme-aware CSS variables
 * Returns an object with CSS custom properties for easy inline styling
 */
export function useThemeStyles() {
  const { theme } = useTheme();
  
  return {
    '--color-primary': theme.colors.primary,
    '--color-secondary': theme.colors.secondary,
    '--color-background': theme.colors.background,
    '--color-surface': theme.colors.surface,
    '--color-text': theme.colors.text,
    '--color-text-secondary': theme.colors.textSecondary,
  } as React.CSSProperties;
}