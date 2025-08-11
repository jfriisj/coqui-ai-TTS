/**
 * Main Application Entry Point for Coqui TTS Frontend
 * 
 * Sets up React application mounting, initialization, and error handling.
 * Configures development mode features and initializes theme and audio contexts
 * with proper error boundaries for robust application startup.
 * 
 * Features:
 * - React 18 concurrent mode with createRoot
 * - Error boundary wrapping for application resilience
 * - Development mode React.StrictMode for debugging
 * - Proper TypeScript integration
 * - Performance monitoring hooks
 * - Accessibility focus management
 * 
 * Requirements:
 * - 5.1: WHEN I first visit the interface THEN I can understand how to perform basic synthesis within 30 seconds
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// ===== Constants =====

/**
 * Application mount point element ID
 */
const MOUNT_ELEMENT_ID = 'root';

/**
 * Application startup timeout in milliseconds
 */
const STARTUP_TIMEOUT = 5000;

// ===== Error Handlers =====

/**
 * Global error handler for unhandled errors
 */
function handleGlobalError(event: ErrorEvent): void {
  console.error('[Global Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
}

/**
 * Global handler for unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  console.error('[Unhandled Promise Rejection]', event.reason);
}

/**
 * Error boundary error handler
 */
function handleErrorBoundaryError(error: Error, errorInfo: React.ErrorInfo, errorId: string): void {
  console.error('[Error Boundary]', {
    errorId,
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });

  // In production, this could send error reports to a service
  // For development, we log to console with structured data
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with error reporting service
    // Example: Sentry.captureException(error, { extra: { errorInfo, errorId } });
  }
}

// ===== Application Setup =====

/**
 * Initialize application mount point
 * Creates root element if it doesn't exist and configures accessibility
 */
function initializeMountPoint(): HTMLElement {
  let rootElement = document.getElementById(MOUNT_ELEMENT_ID);
  
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = MOUNT_ELEMENT_ID;
    document.body.appendChild(rootElement);
  }

  // Configure accessibility attributes
  rootElement.setAttribute('role', 'main');
  rootElement.setAttribute('aria-label', 'Coqui TTS Application');

  return rootElement;
}

/**
 * Configure document metadata and viewport
 */
function configureDocument(): void {
  // Set document title
  document.title = 'Coqui TTS - Advanced Text-to-Speech Synthesis';

  // Add viewport meta tag if missing
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewportMeta);
  }

  // Add description meta tag
  if (!document.querySelector('meta[name="description"]')) {
    const descriptionMeta = document.createElement('meta');
    descriptionMeta.name = 'description';
    descriptionMeta.content = 'Advanced Text-to-Speech synthesis with voice cloning and multi-language support powered by Coqui TTS';
    document.head.appendChild(descriptionMeta);
  }

  // Set document language
  if (!document.documentElement.lang) {
    document.documentElement.lang = 'en';
  }
}

/**
 * Setup global event listeners for error handling
 */
function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', handleGlobalError);
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
}

/**
 * Setup development mode features
 */
function setupDevelopmentFeatures(): void {
  if (process.env.NODE_ENV === 'development') {
    // Enable React DevTools performance profiling
    if (typeof window !== 'undefined') {
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.onCommitFiberRoot?.enableProfiling?.();
    }

    // Log application startup
    console.log('[Coqui TTS Frontend] Starting in development mode');
    console.log('[Environment]', {
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }
}

/**
 * Performance monitoring setup
 */
function setupPerformanceMonitoring(): void {
  // Mark application start
  performance.mark('app-start');

  // Log performance metrics after load
  window.addEventListener('load', () => {
    performance.mark('app-loaded');
    performance.measure('app-load-time', 'app-start', 'app-loaded');
    
    if (process.env.NODE_ENV === 'development') {
      const loadMeasure = performance.getEntriesByName('app-load-time')[0];
      console.log('[Performance] App load time:', `${loadMeasure.duration.toFixed(2)}ms`);
    }
  });
}

// ===== Main Application Bootstrap =====

/**
 * Application wrapper with error boundary and development features
 */
function AppWrapper(): JSX.Element {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <ErrorBoundary
      onError={handleErrorBoundaryError}
      showDetails={isDevelopment}
    >
      {isDevelopment ? (
        <React.StrictMode>
          <App />
        </React.StrictMode>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  );
}

/**
 * Main application initialization function
 * Handles setup, mounting, and error recovery
 */
async function initializeApplication(): Promise<void> {
  try {
    // Setup global configurations
    setupGlobalErrorHandlers();
    setupDevelopmentFeatures();
    setupPerformanceMonitoring();
    configureDocument();

    // Initialize mount point
    const rootElement = initializeMountPoint();

    // Create React root with concurrent features
    const root = createRoot(rootElement, {
      // Enable concurrent features in React 18
      identifierPrefix: 'coqui-tts',
    });

    // Render application with timeout protection
    const renderPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Application render timeout'));
      }, STARTUP_TIMEOUT);

      try {
        root.render(<AppWrapper />);
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    await renderPromise;

    // Hide loading screen
    if (typeof (window as any).hideLoadingScreen === 'function') {
      (window as any).hideLoadingScreen();
    }

    // Mark successful startup
    performance.mark('app-ready');
    performance.measure('app-startup-time', 'app-start', 'app-ready');

    if (process.env.NODE_ENV === 'development') {
      const startupMeasure = performance.getEntriesByName('app-startup-time')[0];
      console.log('[Startup] Application ready in:', `${startupMeasure.duration.toFixed(2)}ms`);
    }

    // Focus management for accessibility
    const focusTarget = document.querySelector<HTMLElement>('[data-autofocus]') || 
                       document.querySelector<HTMLElement>('input[type="text"]') ||
                       document.querySelector<HTMLElement>('textarea') ||
                       rootElement;
    
    if (focusTarget && focusTarget.focus) {
      // Delay focus to allow for component mounting
      setTimeout(() => {
        focusTarget.focus();
      }, 100);
    }

  } catch (error) {
    console.error('[Startup Error]', error);
    
    // Display fallback error message
    const rootElement = initializeMountPoint();
    rootElement.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: #f8fafc;
        color: #0f172a;
      ">
        <div style="
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 500px;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h1 style="color: #dc2626; margin-bottom: 1rem;">Application Failed to Start</h1>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">
            The Coqui TTS frontend encountered an error during startup.
          </p>
          <button onclick="window.location.reload()" style="
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          ">
            Retry
          </button>
          ${process.env.NODE_ENV === 'development' ? `
            <details style="margin-top: 1.5rem; text-align: left;">
              <summary style="cursor: pointer; color: #6b7280;">Error Details</summary>
              <pre style="
                background: #f3f4f6;
                padding: 1rem;
                border-radius: 4px;
                font-size: 0.875rem;
                overflow-x: auto;
                margin-top: 0.5rem;
              ">${error instanceof Error ? error.stack : String(error)}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  }
}

// ===== Application Entry Point =====

/**
 * Initialize the application when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
  initializeApplication();
}

// Hot module replacement support for development
if (process.env.NODE_ENV === 'development' && import.meta.hot) {
  import.meta.hot.accept('./App', () => {
    console.log('[HMR] App component updated');
  });
}

// Export for testing purposes
export { initializeApplication };