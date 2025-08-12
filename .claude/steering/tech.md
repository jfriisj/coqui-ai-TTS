# Technology Stack - Coqui TTS

## Architecture Overview
Coqui TTS follows a modular architecture separating TTS models, vocoders, voice conversion, and serving infrastructure. The system supports both research experimentation and production deployment.

## Core Technologies

### Machine Learning Stack
- **PyTorch 2.1+**: Primary deep learning framework
- **TorchAudio**: Audio processing and feature extraction
- **NumPy 1.26+**: Numerical computations and array operations
- **SciPy**: Scientific computing and signal processing
- **Transformers 4.52.1+**: Pre-trained transformer models (Bark, XTTS)

### Audio Processing
- **LibROSA 0.11+**: Audio analysis and feature extraction
- **SoundFile**: Audio I/O operations
- **Cython 3.0+**: Performance-critical audio processing
- **Encodec**: Neural audio codec for compression

### Backend Services
- **FastAPI**: Modern async web framework for REST APIs
- **Uvicorn**: ASGI server with WebSocket support
- **Pydantic**: Data validation and API documentation
- **Python Multipart**: File upload handling

### Frontend Technologies
- **React 18**: UI framework with concurrent features
- **TypeScript 5.9+**: Type-safe JavaScript development
- **Vite 7.1+**: Build tool and development server
- **Jest 29**: Testing framework with JSDOM

### Development Tools
- **Ruff 0.9.1**: Fast Python linter and formatter
- **Pre-commit**: Git hooks for code quality
- **GitHub Actions**: CI/CD pipeline automation
- **Docker**: Containerization for development and deployment

## Model Architectures

### Text-to-Speech Models
- **XTTS v2**: GPT-based with streaming support, 17 languages
- **VITS**: Variational inference with normalizing flows
- **Bark**: Transformer-based generative model with non-speech sounds
- **Tortoise**: Autoregressive model for high-quality synthesis
- **Tacotron/Tacotron2**: Sequence-to-sequence with attention
- **GlowTTS**: Flow-based parallel synthesis
- **FastSpeech/FastSpeech2**: Non-autoregressive parallel synthesis

### Vocoders
- **HiFiGAN**: High-fidelity generative adversarial vocoder
- **WaveGrad**: Diffusion-based vocoder
- **MelGAN/MultibandMelGAN**: Lightweight GAN vocoders
- **WaveRNN**: Recurrent neural vocoder
- **UnivNet**: Universal vocoder

### Voice Conversion
- **FreeVC**: Any-to-any voice conversion
- **OpenVoice v1/v2**: Cross-lingual voice cloning
- **kNN-VC**: k-nearest neighbors voice conversion

## Technical Constraints

### Performance Requirements
- **Synthesis Speed**: Real-time factor < 1.0 for interactive use
- **Memory Usage**: Support systems with 4GB+ RAM
- **Latency**: <200ms for streaming synthesis (XTTS)
- **Quality**: MOS scores > 4.0 for natural speech

### Compatibility Requirements
- **Python**: 3.10, 3.11, 3.12 support
- **Platforms**: Linux (primary), macOS, Windows
- **Hardware**: CPU-only and GPU acceleration (CUDA, MPS)
- **Browsers**: Modern browsers for web interface

### Scalability Constraints
- **Model Size**: Balance quality vs. deployment size
- **Concurrent Users**: Support multiple simultaneous synthesis requests
- **Resource Management**: Efficient model loading and memory management

## Third-party Integrations

### Language Processing
- **Gruut**: Grapheme-to-phoneme conversion (German, Spanish, French)
- **espeak-ng**: Phonemization for multiple languages
- **Fairseq MMS**: 1100+ language models from Meta
- **Language-specific G2P**: Specialized processors for Bengali, Japanese, Korean, Chinese

### Model Distribution
- **Hugging Face Hub**: Model hosting and distribution
- **PyPI**: Package distribution
- **GitHub Releases**: Binary distributions and assets

### Audio Libraries
- **Monotonic Alignment Search**: Attention alignment optimization
- **Coqui TTS Trainer**: Training utilities and abstractions
- **Coqpit Config**: Configuration management

## Technical Decisions

### Framework Choices
- **PyTorch over TensorFlow**: Better research flexibility and dynamic graphs
- **FastAPI over Flask**: Modern async support and automatic documentation
- **React over Vue/Angular**: Large ecosystem and concurrent features
- **TypeScript over JavaScript**: Type safety for complex UI interactions

### Architecture Patterns
- **Modular Design**: Separate concerns for models, vocoders, and serving
- **Plugin Architecture**: Easy addition of new models and languages
- **Async Processing**: Non-blocking synthesis for web interface
- **Caching Strategy**: Intelligent model and result caching

### Quality Assurance
- **Type Checking**: MyPy for Python, TypeScript for frontend
- **Testing Strategy**: Unit, integration, and model validation tests
- **Code Quality**: Ruff linting with strict rules
- **Documentation**: Automated API docs with examples

## Performance Optimizations

### Model Optimization
- **ONNX Export**: Optimized inference for production
- **Quantization**: Reduced precision for faster inference
- **Model Pruning**: Remove unnecessary parameters
- **Batch Processing**: Efficient multi-request handling

### System Optimization
- **Memory Pooling**: Reuse audio buffers and tensors
- **Model Sharing**: Single model instance for multiple requests
- **Background Loading**: Preload commonly used models
- **Resource Monitoring**: Track GPU/CPU usage and memory

## Security Considerations

### Data Protection
- **No Persistent Storage**: Audio uploads not stored permanently
- **Input Validation**: Strict validation of audio and text inputs
- **Rate Limiting**: Prevent abuse of synthesis endpoints
- **CORS Configuration**: Secure cross-origin requests

### Deployment Security
- **Container Security**: Minimal base images and security scanning
- **Environment Isolation**: Separate development and production configs
- **Dependency Management**: Regular security updates
- **Access Control**: Authentication for administrative functions