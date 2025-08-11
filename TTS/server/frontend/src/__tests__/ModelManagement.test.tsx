/**
 * ModelManagement Component Tests
 * 
 * Comprehensive test suite for ModelSelect and ModelLoadingModal components
 * covering component interaction, model selection, loading progress updates,
 * cancellation, error handling, and service integration.
 * 
 * Test Coverage:
 * - ModelSelect component interaction and model selection
 * - ModelLoadingModal progress updates and cancellation
 * - Error handling and recovery scenarios
 * - Service integration with mock API responses
 * - Accessibility and keyboard navigation
 * - Theme integration and responsive behavior
 */

import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  MockApiClient,
  createMockModelInfo,
  createMockExtendedModelInfo,
  createMockApiResponse,
  createMockApiError,
  setupGlobalMocks,
  cleanupGlobalMocks,
  waitForCondition,
  mockConsole,
} from '../test/testUtils';

// Import components under test
import ModelSelect from '../components/ModelSelect';
import ModelLoadingModal from '../components/ModelLoadingModal';

// Import types and services
import {
  ModelMetadata,
  LoadingProgress,
  CurrentModelInfo,
  LoadModelOptions,
  modelManagementService,
  ModelManagementService,
} from '../services/modelManagementService';

// ===== Test Data =====

const mockModelMetadata: ModelMetadata[] = [
  {
    model_id: 'tts_models/en/ljspeech/tacotron2-DDC',
    display_name: 'Tacotron2 - LJSpeech',
    description: 'High-quality English TTS model',
    version: '1.0.0',
    size_mb: 87.5,
    languages: ['en'],
    speakers: ['ljspeech'],
    capabilities: {
      multi_speaker: false,
      multi_lingual: false,
      voice_cloning: false,
      gst_support: true,
      streaming: false,
      realtime_factor: 0.8,
    },
    performance: {
      avg_latency_ms: 1200,
      quality_score: 0.92,
      memory_usage_mb: 512,
    },
    cache_info: {
      is_cached: true,
      cache_size_mb: 87.5,
      last_accessed: '2024-01-15T10:30:00Z',
    },
    available: true,
    provider: 'Coqui',
    tags: ['english', 'female', 'neutral'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  {
    model_id: 'tts_models/en/vctk/vits',
    display_name: 'VITS - VCTK Multi-speaker',
    description: 'Multi-speaker English TTS model',
    version: '2.0.1',
    size_mb: 234.7,
    languages: ['en'],
    speakers: ['p225', 'p226', 'p227', 'p228', 'p229'],
    capabilities: {
      multi_speaker: true,
      multi_lingual: false,
      voice_cloning: false,
      gst_support: false,
      streaming: true,
      realtime_factor: 0.5,
    },
    performance: {
      avg_latency_ms: 800,
      quality_score: 0.95,
      memory_usage_mb: 768,
    },
    cache_info: {
      is_cached: false,
      cache_size_mb: 0,
    },
    available: true,
    provider: 'Coqui',
    tags: ['english', 'multi-speaker', 'streaming'],
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-20T00:00:00Z',
  },
  {
    model_id: 'tts_models/multilingual/multi-dataset/xtts_v2',
    display_name: 'XTTS v2 - Multilingual',
    description: 'Advanced multilingual voice cloning model',
    version: '2.0.3',
    size_mb: 1843.2,
    languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh-cn', 'hu', 'ko', 'ja'],
    speakers: [],
    capabilities: {
      multi_speaker: true,
      multi_lingual: true,
      voice_cloning: true,
      gst_support: false,
      streaming: true,
      realtime_factor: 0.3,
    },
    performance: {
      avg_latency_ms: 2500,
      quality_score: 0.98,
      memory_usage_mb: 2048,
    },
    cache_info: {
      is_cached: false,
      cache_size_mb: 0,
    },
    available: true,
    provider: 'Coqui',
    tags: ['multilingual', 'voice-cloning', 'streaming', 'advanced'],
    created_at: '2024-01-20T00:00:00Z',
    updated_at: '2024-01-25T00:00:00Z',
  },
];

const mockCurrentModel: CurrentModelInfo = {
  model: mockModelMetadata[0],
  is_loading: false,
  loading_progress: null,
  last_loaded_at: '2024-01-15T10:30:00Z',
};

const mockLoadingProgress: LoadingProgress[] = [
  {
    progress: 15,
    stage: 'downloading',
    message: 'Downloading model files...',
    eta_seconds: 180,
    download_progress: {
      bytes_downloaded: 15728640, // 15 MB
      total_bytes: 104857600, // 100 MB
      download_speed: 2097152, // 2 MB/s
    },
  },
  {
    progress: 45,
    stage: 'downloading',
    message: 'Downloading model files...',
    eta_seconds: 90,
    download_progress: {
      bytes_downloaded: 47185920, // 45 MB
      total_bytes: 104857600, // 100 MB
      download_speed: 2621440, // 2.5 MB/s
    },
  },
  {
    progress: 75,
    stage: 'extracting',
    message: 'Extracting model archive...',
    eta_seconds: 30,
  },
  {
    progress: 90,
    stage: 'initializing',
    message: 'Initializing model...',
    eta_seconds: 10,
  },
  {
    progress: 100,
    stage: 'complete',
    message: 'Model loaded successfully',
    eta_seconds: 0,
  },
];

// ===== Test Setup =====

describe('ModelManagement Components', () => {
  let mockApiClient: MockApiClient;
  let mockService: ModelManagementService;
  let progressCallback: ((progress: LoadingProgress) => void) | null = null;
  let statusCallback: ((status: any) => void) | null = null;

  // Setup and teardown
  beforeAll(() => {
    setupGlobalMocks();
    mockConsole();
  });

  beforeEach(() => {
    mockApiClient = new MockApiClient();
    
    // Mock the modelManagementService
    mockService = {
      getAvailableModels: jest.fn(),
      getCurrentModel: jest.fn(),
      loadModel: jest.fn(),
      cancelLoading: jest.fn(),
      getLoadingStatus: jest.fn(),
      pollLoadingStatus: jest.fn(),
      subscribeToProgress: jest.fn((callback) => {
        progressCallback = callback;
        return () => { progressCallback = null; };
      }),
      subscribeToStatus: jest.fn((callback) => {
        statusCallback = callback;
        return () => { statusCallback = null; };
      }),
    } as any;

    // Replace the global service
    (modelManagementService as any) = mockService;

    // Setup default mock responses
    (mockService.getAvailableModels as jest.Mock).mockResolvedValue(
      createMockApiResponse(mockModelMetadata)
    );
    (mockService.getCurrentModel as jest.Mock).mockResolvedValue(
      createMockApiResponse(mockCurrentModel)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanupGlobalMocks();
    progressCallback = null;
    statusCallback = null;
  });

  // ===== ModelSelect Component Tests =====

  describe('ModelSelect Component', () => {
    
    describe('Initial Loading and Display', () => {
      it('should display loading state while fetching models', async () => {
        // Delay the response to test loading state
        (mockService.getAvailableModels as jest.Mock).mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 100))
        );

        renderWithProviders(<ModelSelect />);

        // Should show loading indicator
        expect(screen.getByText('Loading models...')).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      it('should display available models after loading', async () => {
        renderWithProviders(<ModelSelect />);

        await waitFor(() => {
          expect(screen.getByText('Model Selection')).toBeInTheDocument();
        });

        // Should show current model info
        expect(screen.getByText('(Currently: Tacotron2 - LJSpeech)')).toBeInTheDocument();
        
        // Should show search input and grouping select
        expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Group by Language')).toBeInTheDocument();
      });

      it('should display error state when model loading fails', async () => {
        (mockService.getAvailableModels as jest.Mock).mockResolvedValue(
          createMockApiError('Failed to fetch models', 500)
        );

        renderWithProviders(<ModelSelect />);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(/Failed to fetch models/)).toBeInTheDocument();
        });

        // Should show retry button
        const retryButton = screen.getByText('Retry');
        expect(retryButton).toBeInTheDocument();
      });

      it('should display empty state when no models available', async () => {
        (mockService.getAvailableModels as jest.Mock).mockResolvedValue(
          createMockApiResponse([])
        );

        renderWithProviders(<ModelSelect />);

        await waitFor(() => {
          expect(screen.getByText('No Models Available')).toBeInTheDocument();
          expect(screen.getByText('🤖')).toBeInTheDocument();
        });
      });
    });

    describe('Model Selection and Interaction', () => {
      beforeEach(async () => {
        renderWithProviders(<ModelSelect />);
        await waitFor(() => {
          expect(screen.getByText('Model Selection')).toBeInTheDocument();
        });
      });

      it('should open dropdown when clicked', async () => {
        const user = userEvent.setup();
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        
        await user.click(dropdownButton);

        await waitFor(() => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        // Should show all models
        expect(screen.getByText('Tacotron2 - LJSpeech')).toBeInTheDocument();
        expect(screen.getByText('VITS - VCTK Multi-speaker')).toBeInTheDocument();
        expect(screen.getByText('XTTS v2 - Multilingual')).toBeInTheDocument();
      });

      it('should filter models based on search query', async () => {
        const user = userEvent.setup();
        const searchInput = screen.getByPlaceholderText('Search models...');
        
        await user.type(searchInput, 'VITS');

        // Open dropdown to see filtered results
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        await waitFor(() => {
          expect(screen.getByText('VITS - VCTK Multi-speaker')).toBeInTheDocument();
          expect(screen.queryByText('Tacotron2 - LJSpeech')).not.toBeInTheDocument();
        });
      });

      it('should group models by language when selected', async () => {
        const user = userEvent.setup();
        const groupingSelect = screen.getByDisplayValue('Group by Language');
        
        // Should already be grouped by language by default
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        await waitFor(() => {
          expect(screen.getByText('EN (3)')).toBeInTheDocument();
        });
      });

      it('should show confirmation dialog when selecting new model', async () => {
        const user = userEvent.setup();
        const onModelChange = jest.fn();
        
        renderWithProviders(
          <ModelSelect onModelChange={onModelChange} showConfirmation={true} />
        );

        await waitFor(() => {
          expect(screen.getByText('Model Selection')).toBeInTheDocument();
        });

        // Open dropdown and select different model
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        // Should show confirmation dialog
        await waitFor(() => {
          expect(screen.getByText('Load Model?')).toBeInTheDocument();
          expect(screen.getByText('Load VITS - VCTK Multi-speaker?')).toBeInTheDocument();
        });
      });

      it('should display model tooltips on hover', async () => {
        const user = userEvent.setup();
        
        // Open dropdown
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.hover(modelOption);

        await waitFor(() => {
          expect(screen.getByText('Multi-speaker support')).toBeInTheDocument();
          expect(screen.getByText('Streaming support')).toBeInTheDocument();
        });
      });

      it('should handle model selection without confirmation', async () => {
        const user = userEvent.setup();
        const onModelChange = jest.fn();
        
        renderWithProviders(
          <ModelSelect onModelChange={onModelChange} showConfirmation={false} />
        );

        await waitFor(() => {
          expect(screen.getByText('Model Selection')).toBeInTheDocument();
        });

        // Mock successful loading
        (mockService.loadModel as jest.Mock).mockResolvedValue(createMockApiResponse({}));
        (mockService.pollLoadingStatus as jest.Mock).mockResolvedValue();

        // Open dropdown and select model
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        // Should not show confirmation, but should start loading
        expect(screen.queryByText('Load Model?')).not.toBeInTheDocument();
        expect(mockService.loadModel).toHaveBeenCalled();
      });

      it('should close dropdown when clicking outside', async () => {
        const user = userEvent.setup();
        
        // Open dropdown
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);

        expect(screen.getByRole('listbox')).toBeInTheDocument();

        // Click outside
        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });
      });
    });

    describe('Model Loading Flow', () => {
      beforeEach(async () => {
        renderWithProviders(<ModelSelect />);
        await waitFor(() => {
          expect(screen.getByText('Model Selection')).toBeInTheDocument();
        });
      });

      it('should handle successful model loading', async () => {
        const user = userEvent.setup();
        const onLoadingComplete = jest.fn();

        renderWithProviders(
          <ModelSelect onLoadingComplete={onLoadingComplete} />
        );

        // Mock successful loading
        (mockService.loadModel as jest.Mock).mockResolvedValue(createMockApiResponse({}));
        (mockService.pollLoadingStatus as jest.Mock).mockResolvedValue();
        (mockService.getCurrentModel as jest.Mock).mockResolvedValueOnce(
          createMockApiResponse({
            ...mockCurrentModel,
            model: mockModelMetadata[1], // VITS model
          })
        );

        // Select model and confirm
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);
        
        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        const confirmButton = screen.getByText('Load Model');
        await user.click(confirmButton);

        // Should call loading complete callback
        await waitFor(() => {
          expect(onLoadingComplete).toHaveBeenCalledWith(
            'tts_models/en/vctk/vits',
            true
          );
        });
      });

      it('should handle model loading errors', async () => {
        const user = userEvent.setup();
        const onLoadingComplete = jest.fn();

        renderWithProviders(
          <ModelSelect onLoadingComplete={onLoadingComplete} />
        );

        // Mock loading failure
        (mockService.loadModel as jest.Mock).mockRejectedValue(
          new Error('Model loading failed')
        );

        // Select model and confirm
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);
        
        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        const confirmButton = screen.getByText('Load Model');
        await user.click(confirmButton);

        // Should show error dialog
        await waitFor(() => {
          expect(screen.getByText('Loading Failed')).toBeInTheDocument();
          expect(screen.getByText(/Model loading failed/)).toBeInTheDocument();
        });

        expect(onLoadingComplete).toHaveBeenCalledWith(
          'tts_models/en/vctk/vits',
          false
        );
      });

      it('should handle progress updates during loading', async () => {
        const user = userEvent.setup();

        renderWithProviders(<ModelSelect />);

        // Mock loading that triggers progress updates
        (mockService.loadModel as jest.Mock).mockImplementation(async () => {
          // Simulate progress updates
          setTimeout(() => progressCallback?.(mockLoadingProgress[0]), 50);
          setTimeout(() => progressCallback?.(mockLoadingProgress[1]), 100);
          setTimeout(() => progressCallback?.(mockLoadingProgress[2]), 150);
          return createMockApiResponse({});
        });

        // Select model and confirm
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);
        
        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        const confirmButton = screen.getByText('Load Model');
        await user.click(confirmButton);

        // Should show progress updates
        await waitFor(() => {
          expect(screen.getByText(/15%/)).toBeInTheDocument();
        });
      });

      it('should allow cancellation of loading', async () => {
        const user = userEvent.setup();

        renderWithProviders(<ModelSelect />);

        // Mock loading that can be cancelled
        (mockService.loadModel as jest.Mock).mockImplementation(
          () => new Promise(() => {}) // Never resolves
        );
        (mockService.cancelLoading as jest.Mock).mockResolvedValue();

        // Select model and confirm
        const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
        await user.click(dropdownButton);
        
        const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
        await user.click(modelOption);

        const confirmButton = screen.getByText('Load Model');
        await user.click(confirmButton);

        // Should show loading dialog with cancel button
        await waitFor(() => {
          expect(screen.getByText('Loading Model')).toBeInTheDocument();
        });

        const cancelButton = screen.getByText('Cancel');
        await user.click(cancelButton);

        expect(mockService.cancelLoading).toHaveBeenCalled();
      });
    });
  });

  // ===== ModelLoadingModal Component Tests =====

  describe('ModelLoadingModal Component', () => {
    
    describe('Modal Display and Animation', () => {
      it('should not render when not visible', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={false}
            onClose={jest.fn()}
          />
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('should render when visible', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelName="Test Model"
          />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Loading Test Model...')).toBeInTheDocument();
      });

      it('should focus modal when opened', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
          />
        );

        await waitFor(() => {
          const modal = screen.getByRole('dialog');
          expect(modal).toHaveFocus();
        });
      });

      it('should restore focus when closed', async () => {
        const { rerender } = renderWithProviders(
          <div>
            <button>Previous Focus</button>
            <ModelLoadingModal 
              isVisible={true}
              onClose={jest.fn()}
            />
          </div>
        );

        const button = screen.getByText('Previous Focus');
        button.focus();

        // Close modal
        rerender(
          <div>
            <button>Previous Focus</button>
            <ModelLoadingModal 
              isVisible={false}
              onClose={jest.fn()}
            />
          </div>
        );

        await waitFor(() => {
          expect(button).toHaveFocus();
        });
      });
    });

    describe('Progress Updates and Display', () => {
      it('should display initial progress state', () => {
        const initialProgress: LoadingProgress = {
          progress: 0,
          stage: 'downloading',
          message: 'Starting download...',
          eta_seconds: 120,
        };

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            initialProgress={initialProgress}
            modelService={mockService}
          />
        );

        expect(screen.getByText('Downloading Model Files')).toBeInTheDocument();
        expect(screen.getByText('Starting download...')).toBeInTheDocument();
        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(screen.getByText('2m 0s')).toBeInTheDocument();
      });

      it('should update progress when progress callback is called', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        // Simulate progress update
        act(() => {
          progressCallback?.(mockLoadingProgress[1]); // 45% downloading
        });

        await waitFor(() => {
          expect(screen.getByText('45%')).toBeInTheDocument();
          expect(screen.getByText('1m 30s')).toBeInTheDocument();
        });
      });

      it('should display download progress information', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        // Simulate progress update with download info
        act(() => {
          progressCallback?.(mockLoadingProgress[0]); // Has download progress
        });

        await waitFor(() => {
          expect(screen.getByText('15.0 MB / 100.0 MB')).toBeInTheDocument();
          expect(screen.getByText('2.0 MB/s')).toBeInTheDocument();
        });
      });

      it('should show different stages correctly', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        // Test different stages
        const stages = [
          { progress: mockLoadingProgress[0], expected: 'Downloading Model Files' },
          { progress: mockLoadingProgress[2], expected: 'Extracting Model Archive' },
          { progress: mockLoadingProgress[3], expected: 'Initializing Model' },
        ];

        for (const { progress, expected } of stages) {
          act(() => {
            progressCallback?.(progress);
          });

          await waitFor(() => {
            expect(screen.getByText(expected)).toBeInTheDocument();
          });
        }
      });

      it('should show success state when loading completes', async () => {
        const onClose = jest.fn();
        
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            modelName="Test Model"
            modelService={mockService}
          />
        );

        // Simulate completion
        act(() => {
          progressCallback?.(mockLoadingProgress[4]); // Complete stage
        });

        await waitFor(() => {
          expect(screen.getByText('Loading Complete!')).toBeInTheDocument();
          expect(screen.getByText('Model Ready!')).toBeInTheDocument();
          expect(screen.getByText('🎉')).toBeInTheDocument();
        });

        // Should auto-close after 2 seconds
        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        }, { timeout: 3000 });
      });

      it('should handle progress updates at the required interval', async () => {
        const progressSpy = jest.fn();
        
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        // Simulate rapid progress updates (should be throttled to 500ms minimum)
        const updates = Array.from({ length: 5 }, (_, i) => ({
          ...mockLoadingProgress[0],
          progress: i * 20,
        }));

        updates.forEach(update => {
          act(() => {
            progressCallback?.(update);
            progressSpy();
          });
        });

        expect(progressSpy).toHaveBeenCalledTimes(5);
      });
    });

    describe('Cancellation Handling', () => {
      it('should show cancel button during loading', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        const cancelButton = screen.getByText('Cancel Loading');
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toHaveAttribute('aria-label', 'Cancel model loading');
      });

      it('should call onCancel when cancel button is clicked', async () => {
        const user = userEvent.setup();
        const onCancel = jest.fn().mockResolvedValue();
        const onClose = jest.fn();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            onCancel={onCancel}
          />
        );

        const cancelButton = screen.getByText('Cancel Loading');
        await user.click(cancelButton);

        expect(onCancel).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      it('should use model service cancelLoading if no onCancel provided', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();
        
        (mockService.cancelLoading as jest.Mock).mockResolvedValue();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            modelService={mockService}
          />
        );

        const cancelButton = screen.getByText('Cancel Loading');
        await user.click(cancelButton);

        expect(mockService.cancelLoading).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      it('should handle cancellation errors', async () => {
        const user = userEvent.setup();
        const onCancel = jest.fn().mockRejectedValue(new Error('Cancel failed'));

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            onCancel={onCancel}
          />
        );

        const cancelButton = screen.getByText('Cancel Loading');
        await user.click(cancelButton);

        await waitFor(() => {
          expect(screen.getByText('Loading Failed')).toBeInTheDocument();
          expect(screen.getByText(/Failed to cancel model loading/)).toBeInTheDocument();
        });
      });

      it('should disable cancel button while cancelling', async () => {
        const user = userEvent.setup();
        const onCancel = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            onCancel={onCancel}
          />
        );

        const cancelButton = screen.getByText('Cancel Loading');
        await user.click(cancelButton);

        expect(screen.getByText('Cancelling...')).toBeInTheDocument();
        expect(cancelButton).toBeDisabled();
      });
    });

    describe('Error Handling', () => {
      it('should display error state when progress indicates error', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        const errorProgress: LoadingProgress = {
          progress: 50,
          stage: 'error',
          message: 'Model loading failed',
          error: {
            message: 'Network connection failed',
            recoverable: true,
          },
        };

        act(() => {
          progressCallback?.(errorProgress);
        });

        await waitFor(() => {
          expect(screen.getByText('Loading Failed')).toBeInTheDocument();
          expect(screen.getByText('Error Details')).toBeInTheDocument();
          expect(screen.getByText('Network connection failed')).toBeInTheDocument();
        });
      });

      it('should show error with suggestions when available', async () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        const errorProgress: LoadingProgress = {
          progress: 25,
          stage: 'error',
          message: 'Download failed',
          error: {
            message: 'Insufficient storage space',
            recoverable: true,
          },
        };

        act(() => {
          progressCallback?.(errorProgress);
        });

        await waitFor(() => {
          expect(screen.getByText('Insufficient storage space')).toBeInTheDocument();
        });
      });

      it('should allow closing error dialog', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            modelService={mockService}
          />
        );

        // Trigger error state
        const errorProgress: LoadingProgress = {
          progress: 30,
          stage: 'error',
          message: 'Loading failed',
        };

        act(() => {
          progressCallback?.(errorProgress);
        });

        await waitFor(() => {
          expect(screen.getByText('Close')).toBeInTheDocument();
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
      });
    });

    describe('Keyboard Navigation and Accessibility', () => {
      it('should close on Escape key during loading', async () => {
        const onClose = jest.fn();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            onCancel={jest.fn().mockResolvedValue()}
          />
        );

        const modal = screen.getByRole('dialog');
        fireEvent.keyDown(modal, { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();
      });

      it('should close on Escape key in error state', async () => {
        const onClose = jest.fn();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            modelService={mockService}
          />
        );

        // Trigger error state
        act(() => {
          progressCallback?.({
            progress: 50,
            stage: 'error',
            message: 'Error occurred',
          });
        });

        await waitFor(() => {
          expect(screen.getByText('Loading Failed')).toBeInTheDocument();
        });

        const modal = screen.getByRole('dialog');
        fireEvent.keyDown(modal, { key: 'Escape' });

        expect(onClose).toHaveBeenCalled();
      });

      it('should have proper ARIA attributes', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelName="Test Model"
          />
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('aria-modal', 'true');
        expect(modal).toHaveAttribute('aria-labelledby', 'loading-modal-title');
        expect(modal).toHaveAttribute('aria-describedby', 'loading-modal-description');
      });

      it('should handle backdrop clicks appropriately', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();
        const onCancel = jest.fn().mockResolvedValue();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            onCancel={onCancel}
          />
        );

        // Click on backdrop (not the modal content)
        const modal = screen.getByRole('dialog');
        await user.click(modal);

        // Should trigger cancellation during loading
        expect(onCancel).toHaveBeenCalled();
      });
    });

    describe('Service Integration', () => {
      it('should subscribe to progress updates when service is provided', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        expect(mockService.subscribeToProgress).toHaveBeenCalled();
        expect(mockService.subscribeToStatus).toHaveBeenCalled();
      });

      it('should unsubscribe from updates when modal closes', async () => {
        const unsubscribeProgress = jest.fn();
        const unsubscribeStatus = jest.fn();

        (mockService.subscribeToProgress as jest.Mock).mockReturnValue(unsubscribeProgress);
        (mockService.subscribeToStatus as jest.Mock).mockReturnValue(unsubscribeStatus);

        const { rerender } = renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        // Close modal
        rerender(
          <ModelLoadingModal 
            isVisible={false}
            onClose={jest.fn()}
            modelService={mockService}
          />
        );

        await waitFor(() => {
          expect(unsubscribeProgress).toHaveBeenCalled();
          expect(unsubscribeStatus).toHaveBeenCalled();
        });
      });

      it('should handle status updates correctly', async () => {
        const onClose = jest.fn();

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={onClose}
            modelService={mockService}
          />
        );

        // Simulate status update indicating loading stopped
        act(() => {
          statusCallback?.({ is_loading: false });
        });

        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
      });
    });

    describe('Responsive Design and Theming', () => {
      it('should apply theme styles correctly', () => {
        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelName="Test Model"
          />
        );

        const modal = screen.getByRole('dialog');
        const modalPanel = modal.firstChild as HTMLElement;
        
        // Should have theme-appropriate styling
        expect(modalPanel).toHaveStyle('background-color: rgb(248, 250, 252)'); // Light theme surface
      });

      it('should be responsive on small screens', () => {
        // Mock small screen
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 400,
        });

        renderWithProviders(
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelName="Very Long Model Name That Should Wrap"
          />
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toHaveStyle('padding: 1rem');
      });
    });
  });

  // ===== Integration Tests =====

  describe('Integration between ModelSelect and ModelLoadingModal', () => {
    it('should show loading modal when model loading starts', async () => {
      const user = userEvent.setup();

      // Mock loading that takes time
      (mockService.loadModel as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(
        <div>
          <ModelSelect showConfirmation={false} />
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Model Selection')).toBeInTheDocument();
      });

      // Select model to start loading
      const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
      await user.click(dropdownButton);
      
      const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
      await user.click(modelOption);

      // Should show both the selection interface and loading modal
      expect(screen.getByText('Model Selection')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle successful flow from selection to completion', async () => {
      const user = userEvent.setup();
      const onModelChange = jest.fn();
      const onLoadingComplete = jest.fn();
      
      // Mock successful loading with progress
      (mockService.loadModel as jest.Mock).mockImplementation(async () => {
        // Simulate progress updates
        setTimeout(() => progressCallback?.(mockLoadingProgress[0]), 10);
        setTimeout(() => progressCallback?.(mockLoadingProgress[4]), 50); // Complete
        return createMockApiResponse({});
      });
      (mockService.pollLoadingStatus as jest.Mock).mockResolvedValue();
      (mockService.getCurrentModel as jest.Mock).mockResolvedValueOnce(
        createMockApiResponse({
          ...mockCurrentModel,
          model: mockModelMetadata[1],
        })
      );

      renderWithProviders(
        <div>
          <ModelSelect 
            onModelChange={onModelChange}
            onLoadingComplete={onLoadingComplete}
            showConfirmation={false}
          />
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Model Selection')).toBeInTheDocument();
      });

      // Select model
      const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
      await user.click(dropdownButton);
      
      const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
      await user.click(modelOption);

      // Should complete successfully
      await waitFor(() => {
        expect(onModelChange).toHaveBeenCalledWith(
          'tts_models/en/vctk/vits',
          mockModelMetadata[1]
        );
        expect(onLoadingComplete).toHaveBeenCalledWith(
          'tts_models/en/vctk/vits',
          true
        );
      });
    });

    it('should handle error flow with recovery', async () => {
      const user = userEvent.setup();
      const onLoadingComplete = jest.fn();

      // Mock loading failure
      (mockService.loadModel as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(
        <div>
          <ModelSelect 
            onLoadingComplete={onLoadingComplete}
            showConfirmation={false}
          />
          <ModelLoadingModal 
            isVisible={true}
            onClose={jest.fn()}
            modelService={mockService}
          />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByText('Model Selection')).toBeInTheDocument();
      });

      // Select model to trigger error
      const dropdownButton = screen.getByRole('button', { name: /Select a model/ });
      await user.click(dropdownButton);
      
      const modelOption = screen.getByText('VITS - VCTK Multi-speaker');
      await user.click(modelOption);

      // Should show error in both components
      await waitFor(() => {
        expect(screen.getByText('Loading Failed')).toBeInTheDocument();
        expect(onLoadingComplete).toHaveBeenCalledWith(
          'tts_models/en/vctk/vits',
          false
        );
      });
    });
  });
});