/**
 * Test setup configuration for Jest and React Testing Library
 */

import '@testing-library/jest-dom';
import { setupGlobalMocks } from './testUtils';

// Setup global mocks
setupGlobalMocks();

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};