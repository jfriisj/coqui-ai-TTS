# Project Structure - Coqui TTS

## Directory Organization

### Root Level Structure
```
coqui-ai-TTS/
├── TTS/                    # Main package directory
├── docs/                   # Sphinx documentation
├── tests/                  # Test suites
├── recipes/                # Training recipes for different datasets
├── notebooks/              # Jupyter notebooks for tutorials
├── dockerfiles/            # Docker configurations
├── scripts/                # Utility scripts
├── pyproject.toml          # Python package configuration
├── README.md               # Project documentation
└── .claude/steering/       # Claude Code steering documents
```

### Core Package Structure (TTS/)
```
TTS/
├── api.py                  # Main API interface
├── tts/                    # Text-to-speech models
├── vocoder/                # Vocoder models
├── vc/                     # Voice conversion models
├── encoder/                # Speaker encoder models
├── server/                 # Web server and frontend
├── utils/                  # Shared utilities
├── config/                 # Configuration classes
└── bin/                    # Command-line tools
```

### Frontend Structure (TTS/server/frontend/)
```
frontend/
├── src/
│   ├── components/         # React components
│   ├── contexts/           # React contexts (Theme, Model, Audio)
│   ├── services/           # API clients and business logic
│   ├── types/              # TypeScript type definitions
│   ├── hooks/              # Custom React hooks
│   ├── test/               # Test utilities and setup
│   └── __tests__/          # Component tests
├── public/                 # Static assets
├── package.json            # Node.js dependencies
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── jest.config.js          # Jest test configuration
```

## Naming Conventions

### Python Files and Modules
- **Snake case**: `model_manager.py`, `audio_processor.py`
- **Classes**: PascalCase (`AudioProcessor`, `ModelManager`)
- **Functions/Variables**: snake_case (`load_model`, `sample_rate`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_SAMPLE_RATE`, `MODEL_CACHE_SIZE`)

### Frontend Files
- **Components**: PascalCase (`ModelBrowser.tsx`, `AudioPlayer.tsx`)
- **Services**: camelCase (`apiClient.ts`, `modelService.ts`)
- **Types**: PascalCase (`TTSResponse`, `ModelInfo`)
- **Hooks**: camelCase with `use` prefix (`useModelState`, `useAudioPlayer`)

### Model and Configuration Names
- **Model names**: lowercase with hyphens (`xtts-v2`, `glow-tts`)
- **Config files**: snake_case (`xtts_config.py`, `hifigan_config.py`)
- **Dataset references**: lowercase (`ljspeech`, `vctk`, `common-voice`)

## File Organization Patterns

### Model Implementation Pattern
```
models/
├── base_tts.py             # Abstract base class
├── specific_model.py       # Model implementation
└── __init__.py             # Public API exports
```

### Configuration Pattern
```
configs/
├── shared_configs.py       # Common configuration base classes
├── model_config.py         # Model-specific configurations
└── __init__.py             # Configuration registry
```

### Layer Organization
```
layers/
├── model_name/             # Model-specific layers
│   ├── __init__.py
│   ├── encoder.py
│   ├── decoder.py
│   └── attention.py
└── generic/                # Shared layer implementations
    ├── transformer.py
    ├── convolution.py
    └── normalization.py
```

## Coding Standards

### Python Code Style
- **Line length**: 120 characters maximum
- **Imports**: Organized by standard, third-party, local
- **Docstrings**: Google style with type hints
- **Type hints**: Required for all public functions
- **Error handling**: Specific exception types, not bare except

### TypeScript/React Standards
- **Component structure**: Functional components with hooks
- **Props typing**: Explicit interfaces for all component props
- **Export pattern**: Named exports preferred over default
- **File organization**: One main component per file
- **Styling**: CSS modules or styled-components

### Documentation Standards
- **API documentation**: Automatically generated from docstrings
- **Code comments**: Explain why, not what
- **README files**: Present in each major directory
- **Type documentation**: Comprehensive interface definitions

## Testing Organization

### Test Directory Structure
```
tests/
├── aux_tests/              # Utility and helper tests
├── data_tests/             # Dataset and data loading tests
├── tts_tests/              # TTS model tests
├── vocoder_tests/          # Vocoder model tests
├── vc_tests/               # Voice conversion tests
├── text_tests/             # Text processing tests
├── inference_tests/        # End-to-end inference tests
├── integration/            # Integration tests
└── zoo_tests/              # Model zoo validation tests
```

### Frontend Test Structure
```
src/
├── __tests__/              # Component tests
│   └── ComponentName.test.tsx
├── test/                   # Test utilities
│   ├── setupTests.ts       # Jest configuration
│   └── testUtils.ts        # Testing helpers
└── components/
    └── ComponentName.tsx   # Component with co-located tests
```

### Test File Naming
- **Python**: `test_feature_name.py`
- **TypeScript**: `FeatureName.test.tsx` or `featureName.test.ts`
- **Integration**: `test_integration_scenario.py`

## Configuration Management

### Environment-specific Configs
- **Development**: Verbose logging, debug features enabled
- **Testing**: Minimal models, fast execution
- **Production**: Optimized models, performance monitoring

### Configuration File Hierarchy
1. **Default configs**: Built-in reasonable defaults
2. **Model configs**: Model-specific parameters
3. **User configs**: Local overrides and customizations
4. **Environment configs**: Deployment-specific settings

## Build and Deployment Patterns

### Python Package Structure
- **pyproject.toml**: Modern Python packaging with hatchling
- **Optional dependencies**: Grouped by functionality (server, languages)
- **Entry points**: CLI commands and module access
- **Include/exclude**: Careful package content management

### Frontend Build Process
- **Development**: Vite dev server with HMR
- **Testing**: Jest with jsdom environment
- **Production**: Optimized bundle with tree shaking
- **Static generation**: Pre-built assets for server integration

### Docker Organization
- **Multi-stage builds**: Separate build and runtime stages
- **Base images**: Minimal, security-focused base images
- **Layer optimization**: Careful layer ordering for caching
- **Environment handling**: Configurable via environment variables

## Version Control Patterns

### Branch Strategy
- **main**: Stable, production-ready code
- **dev**: Development integration branch
- **feature/***: Feature development branches
- **hotfix/***: Critical bug fixes

### Commit Message Format
- **Conventional commits**: `type(scope): description`
- **Types**: feat, fix, docs, style, refactor, test, chore
- **Scope**: Component or area affected
- **Breaking changes**: Clearly marked in commit body

### File Ignore Patterns
- **Build artifacts**: `__pycache__`, `dist/`, `build/`
- **Environment files**: `.env`, `*.local`
- **IDE files**: `.vscode/`, `.idea/`
- **Model files**: Large model weights and checkpoints
- **Generated content**: Auto-generated documentation