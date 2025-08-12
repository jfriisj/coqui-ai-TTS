# TTS Server with OpenAPI Generation and Full TTS Support

A comprehensive TTS (Text-to-Speech) server that automatically generates TypeScript API clients from OpenAPI specifications and provides full TTS capabilities with modern service architecture.

## Features

- 🎙️ **Full TTS Capabilities**: Complete integration with Coqui TTS models and services
- 🔄 **Automatic Code Generation**: Generates TypeScript API clients from OpenAPI specs
- 🌐 **Frontend Serving**: Serves the built frontend application with auto-generated API clients
- 📖 **API Documentation**: Interactive API documentation via FastAPI
- 🔧 **Development Mode**: Auto-reload, file watching, and hot-reloading
- 🚀 **Service Architecture**: Modern service-based TTS backend with caching and model management
- 🎯 **Single Source of Truth**: OpenAPI spec drives both backend and frontend types
- 📊 **Performance Monitoring**: Built-in health checks and performance metrics

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- Coqui TTS installed (`pip install TTS`)

### Windows

```bash
# Clone and navigate to the project
cd coqui-ai-TTS/tts-server

# Run the startup script
start.bat
```

### Linux/macOS

```bash
# Make the script executable
chmod +x start.sh

# Run the startup script
./start.sh
```

### Manual Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install OpenAPI Generator CLI
npm install -g @openapitools/openapi-generator-cli

# Start the server with TTS services
python main.py

# Or start without TTS (generator only)
python main.py --disable-tts
```

## Usage

### Start the Server

```bash
# Default with TTS services: http://localhost:8000
python main.py

# Custom host and port
python main.py --host 0.0.0.0 --port 3000

# Development mode with auto-reload
python main.py --reload --log-level debug

# Generator only (no TTS services)
python main.py --disable-tts

# Production mode
python main.py --host 0.0.0.0 --port 8000 --log-level info
```

### Generate API Client Only

```bash
# Generate TypeScript client only
python main.py --generate-only

# Generate and build frontend
python main.py --generate-only --build-frontend
```

## Available Endpoints

When the server is running:

### Core Services
- **API Documentation**: `http://localhost:8000/docs`
- **Frontend Application**: `http://localhost:8000/frontend/`
- **OpenAPI Specification**: `http://localhost:8000/openapi`
- **Server Health**: `http://localhost:8000/api/v1/health`

### TTS Services (when enabled)
- **TTS Synthesis (Modern)**: `POST /tts/api/v2/tts`
- **Batch TTS**: `POST /tts/api/v2/tts/batch`
- **Model Management**: `GET/POST /tts/api/v2/models/*`
- **TTS Health Check**: `GET /tts/api/v2/health`

### Legacy TTS Endpoints (compatibility)
- **Simple TTS**: `GET/POST /api/tts`
- **MaryTTS Process**: `GET/POST /process`
- **OpenAI Compatible**: `POST /v1/audio/speech`
- **Available Voices**: `GET /voices`
- **Available Locales**: `GET /locales`

### Management
- **Manual Regeneration**: `POST /generate`
- **Generation Status**: `GET /generate/status`

## Configuration

Edit `config.json` to customize:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8000,
    "reload": true
  },
  "generation": {
    "auto_generate_on_startup": true,
    "auto_build_frontend": false,
    "watch_for_changes": true
  }
}
```

## Development Workflow

1. **Start the server**: `./start.sh` or `start.bat`
2. **Edit OpenAPI spec**: Modify `../TTS/server/openapi.yaml`
3. **Auto-regeneration**: The server detects changes and regenerates the client
4. **Frontend development**: Use the generated types in your frontend code
5. **Build frontend**: Changes are automatically served

## File Structure

```
tts-server/
├── main.py                 # Main server application
├── config.json            # Configuration file
├── requirements.txt       # Python dependencies
├── start.sh               # Linux/macOS startup script
├── start.bat              # Windows startup script
└── README.md              # This file

../TTS/server/
├── openapi.yaml           # OpenAPI specification
├── frontend/              # Frontend application
│   ├── src/gen/          # Generated TypeScript client (auto-generated)
│   ├── openapi-generator-config.json
│   └── ...
└── static/               # Built frontend files
```

## How It Works

1. **OpenAPI Specification**: The server reads the OpenAPI spec from `../TTS/server/openapi.yaml`
2. **Code Generation**: Uses OpenAPI Generator CLI to create TypeScript client code
3. **File Watching**: Monitors the OpenAPI spec for changes
4. **Auto-regeneration**: Regenerates client code when the spec changes
5. **Frontend Building**: Optionally builds the frontend after generation
6. **Static Serving**: Serves the built frontend application

## API Client Generation

The generated TypeScript client includes:

- **Type-safe interfaces** for all API models
- **Fetch-based API client** with proper error handling
- **Request/response types** matching the OpenAPI spec
- **Automatic serialization/deserialization**

Example usage in frontend:

```typescript
import { DefaultApi, TTSRequest } from '../gen/src';

const api = new DefaultApi();

const request: TTSRequest = {
  text: "Hello, world!",
  speaker: "default",
  format: "wav"
};

const response = await api.ttsSynthesisPost({ tTSRequest: request });
```

## Benefits

- **Type Safety**: Frontend and backend types are always in sync
- **Single Source of Truth**: OpenAPI spec defines the contract
- **Rapid Development**: Automatic code generation saves time
- **Error Prevention**: TypeScript catches API mismatches at compile time
- **Documentation**: Interactive API docs are always up-to-date

## Troubleshooting

### Common Issues

1. **"openapi-generator-cli not found"**
   ```bash
   npm install -g @openapitools/openapi-generator-cli
   ```

2. **"Permission denied" on Linux/macOS**
   ```bash
   chmod +x start.sh
   ```

3. **Port already in use**
   ```bash
   python main.py --port 3000
   ```

4. **Generated files not found**
   ```bash
   python main.py --generate-only
   ```

### Debug Mode

Run with debug logging:

```bash
python main.py --reload
```

Check the logs for detailed generation information.

## License

This project follows the same license as the main Coqui TTS project.
