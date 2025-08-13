#!/bin/bash

# TTS Server with OpenAPI Generation - Startup Script
# This script sets up and starts the TTS server with full TTS capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 TTS Server with OpenAPI Generation and Full TTS Support${NC}"
echo -e "${BLUE}==========================================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python
if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

# Check Node.js (optional)
if ! command_exists node; then
    echo -e "${YELLOW}⚠️ Node.js not found. Frontend generation will be limited.${NC}"
    echo -e "${YELLOW}   Install Node.js from https://nodejs.org/ for full functionality${NC}"
else
    echo -e "${GREEN}✅ Node.js found${NC}"
fi

# Check yarn (optional)
if command_exists node && ! command_exists yarn; then
    echo -e "${YELLOW}⚠️ Yarn not found, installing...${NC}"
    npm install -g yarn
fi

# Create virtual environment if it doesn't exist
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
echo -e "${YELLOW}🔧 Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate" || source "$VENV_DIR/Scripts/activate"

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
pip install -r "$SCRIPT_DIR/requirements.txt"

# Install OpenAPI Generator CLI globally if not present and Node.js is available
if command_exists node && ! command_exists openapi-generator-cli; then
    echo -e "${YELLOW}📦 Installing OpenAPI Generator CLI...${NC}"
    npm install -g @openapitools/openapi-generator-cli
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Parse command line arguments
GENERATE_ONLY=false
BUILD_FRONTEND=false
DISABLE_TTS=false
PORT=8000
HOST="0.0.0.0"
LOG_LEVEL="info"

while [[ $# -gt 0 ]]; do
    case $1 in
        --generate-only)
            GENERATE_ONLY=true
            shift
            ;;
        --build-frontend)
            BUILD_FRONTEND=true
            shift
            ;;
        --disable-tts)
            DISABLE_TTS=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --generate-only     Only generate API client and exit"
            echo "  --build-frontend    Build frontend after generation"
            echo "  --disable-tts       Disable TTS services (generator only mode)"
            echo "  --port PORT         Port to run server on (default: 8000)"
            echo "  --host HOST         Host to bind to (default: 0.0.0.0)"
            echo "  --log-level LEVEL   Log level: debug, info, warning, error (default: info)"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Start with all services"
            echo "  $0 --disable-tts             # Start without TTS services"
            echo "  $0 --generate-only           # Generate API client only"
            echo "  $0 --port 3000 --log-level debug  # Custom port with debug logging"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Set up TTS environment variables
echo -e "${YELLOW}🔧 Setting up TTS environment...${NC}"
export TTS_CACHE_MAX_MEMORY_MB=${TTS_CACHE_MAX_MEMORY_MB:-4096}
export TTS_CACHE_MAX_ENTRIES=${TTS_CACHE_MAX_ENTRIES:-10}
export TTS_CACHE_CLEANUP_THRESHOLD=${TTS_CACHE_CLEANUP_THRESHOLD:-0.8}

# Build command arguments
CMD_ARGS="--host $HOST --port $PORT --log-level $LOG_LEVEL"

if [ "$DISABLE_TTS" = true ]; then
    CMD_ARGS="$CMD_ARGS --disable-tts"
fi

if [ "$GENERATE_ONLY" = true ]; then
    CMD_ARGS="$CMD_ARGS --generate-only"
    if [ "$BUILD_FRONTEND" = true ]; then
        CMD_ARGS="$CMD_ARGS --build-frontend"
    fi
fi

# Run the server
if [ "$GENERATE_ONLY" = true ]; then
    echo -e "${BLUE}📝 Generating API client only...${NC}"
    python main.py $CMD_ARGS
else
    echo -e "${BLUE}🌐 Starting TTS server on ${HOST}:${PORT}...${NC}"
    echo -e "${BLUE}📖 API documentation: http://${HOST}:${PORT}/docs${NC}"
    echo -e "${BLUE}🌐 Frontend: http://${HOST}:${PORT}/frontend/${NC}"
    echo -e "${BLUE}⚡ OpenAPI spec: http://${HOST}:${PORT}/openapi${NC}"
    
    if [ "$DISABLE_TTS" = true ]; then
        echo -e "${YELLOW}🔇 TTS services: disabled${NC}"
    else
        echo -e "${GREEN}🎙️ TTS services: enabled${NC}"
        echo -e "${GREEN}🔧 TTS endpoints: http://${HOST}:${PORT}/tts/api/v2/*${NC}"
    fi
    
    echo -e "${BLUE}📊 Cache: ${TTS_CACHE_MAX_MEMORY_MB}MB, ${TTS_CACHE_MAX_ENTRIES} entries${NC}"
    echo ""
    echo -e "${GREEN}Press Ctrl+C to stop the server${NC}"
    echo ""
    
    # Add reload flag for development
    if [ "$LOG_LEVEL" = "debug" ]; then
        CMD_ARGS="$CMD_ARGS --reload"
    fi
    
    python main.py $CMD_ARGS
fi
