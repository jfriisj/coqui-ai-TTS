#!/bin/bash

# TTS Frontend Development Script
# Coordinates Vite dev server and Flask backend for development workflow

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR"
SERVER_DIR="$SCRIPT_DIR/.."
PROJECT_ROOT="$SCRIPT_DIR/../../.."

# Default configuration
DEFAULT_FRONTEND_PORT=3000
DEFAULT_BACKEND_PORT=5002
DEFAULT_MODEL="tts_models/en/ljspeech/tacotron2-DDC"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Process tracking
FRONTEND_PID=""
BACKEND_PID=""
CLEANUP_DONE=false

# Logging functions
log_info() {
    echo -e "${BLUE}[DEV]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handler
error_exit() {
    log_error "$1"
    cleanup
    exit 1
}

# Show usage
show_usage() {
    cat << EOF
TTS Frontend Development Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --frontend-port PORT    Frontend dev server port (default: $DEFAULT_FRONTEND_PORT)
    --backend-port PORT     Flask backend server port (default: $DEFAULT_BACKEND_PORT)
    --model MODEL          TTS model to use (default: $DEFAULT_MODEL)
    --backend-only         Run only Flask backend server
    --frontend-only        Run only Vite frontend server
    --install-deps         Install/update dependencies before starting
    --help                 Show this help message

EXAMPLES:
    $0                                    # Start both servers with defaults
    $0 --frontend-port 3001               # Use custom frontend port
    $0 --backend-port 5003                # Use custom backend port
    $0 --model "tts_models/en/vctk/vits"  # Use different TTS model
    $0 --frontend-only                    # Only start Vite dev server
    $0 --backend-only                     # Only start Flask server
    $0 --install-deps                     # Install deps and start servers

DEVELOPMENT WORKFLOW:
    1. The script starts both Vite dev server and Flask backend
    2. Vite proxies API calls to Flask server automatically
    3. Frontend accessible at http://localhost:$DEFAULT_FRONTEND_PORT
    4. Backend API accessible at http://localhost:$DEFAULT_BACKEND_PORT
    5. Hot reload works for frontend changes
    6. Press Ctrl+C to stop both servers

API ENDPOINTS:
    /api/tts              - Main TTS synthesis endpoint
    /api/v1/tts          - V1 TTS synthesis endpoint  
    /v1/audio/speech     - Speech synthesis endpoint
    /api/v1/models       - Available models endpoint

EOF
}

# Parse command line arguments
parse_args() {
    FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
    BACKEND_PORT=$DEFAULT_BACKEND_PORT
    MODEL=$DEFAULT_MODEL
    BACKEND_ONLY=false
    FRONTEND_ONLY=false
    INSTALL_DEPS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --frontend-port)
                FRONTEND_PORT="$2"
                shift 2
                ;;
            --backend-port)
                BACKEND_PORT="$2"
                shift 2
                ;;
            --model)
                MODEL="$2"
                shift 2
                ;;
            --backend-only)
                BACKEND_ONLY=true
                shift
                ;;
            --frontend-only)
                FRONTEND_ONLY=true
                shift
                ;;
            --install-deps)
                INSTALL_DEPS=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Validate port numbers
    if ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || [ "$FRONTEND_PORT" -lt 1024 ] || [ "$FRONTEND_PORT" -gt 65535 ]; then
        error_exit "Invalid frontend port: $FRONTEND_PORT (must be 1024-65535)"
    fi

    if ! [[ "$BACKEND_PORT" =~ ^[0-9]+$ ]] || [ "$BACKEND_PORT" -lt 1024 ] || [ "$BACKEND_PORT" -gt 65535 ]; then
        error_exit "Invalid backend port: $BACKEND_PORT (must be 1024-65535)"
    fi

    # Check for port conflicts
    if [ "$FRONTEND_PORT" -eq "$BACKEND_PORT" ]; then
        error_exit "Frontend and backend ports cannot be the same"
    fi
}

# Check if port is available
check_port_available() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        error_exit "$service port $port is already in use. Please use a different port or stop the conflicting service."
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed or not in PATH. Please install Node.js 18+ and try again."
    fi

    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"

    # Check npm
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed or not in PATH. Please install npm and try again."
    fi

    # Check Python
    if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
        error_exit "Python is not installed or not in PATH. Please install Python 3.8+ and try again."
    fi

    # Determine python command
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    else
        PYTHON_CMD="python"
    fi

    PYTHON_VERSION=$($PYTHON_CMD --version)
    log_info "Python version: $PYTHON_VERSION"

    # Check if we're in the TTS project
    if [ ! -f "$PROJECT_ROOT/pyproject.toml" ] || ! grep -q "coqui-tts" "$PROJECT_ROOT/pyproject.toml" 2>/dev/null; then
        log_warning "Not in TTS project root. Flask server may not work correctly."
    fi

    # Check port availability
    if [ "$BACKEND_ONLY" = false ]; then
        check_port_available $FRONTEND_PORT "Frontend"
    fi
    
    if [ "$FRONTEND_ONLY" = false ]; then
        check_port_available $BACKEND_PORT "Backend"
    fi
}

# Install dependencies
install_dependencies() {
    if [ "$INSTALL_DEPS" = true ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log_info "Installing frontend dependencies..."
        cd "$FRONTEND_DIR" || error_exit "Failed to change to frontend directory"
        
        if [ "$INSTALL_DEPS" = true ]; then
            npm install || error_exit "Failed to install frontend dependencies"
        else
            npm ci --silent || error_exit "Failed to install frontend dependencies"
        fi
        
        log_success "Frontend dependencies installed"
    else
        log_info "Frontend dependencies already installed"
    fi
}

# Update Vite config with correct backend port
update_vite_config() {
    local config_file="$FRONTEND_DIR/vite.config.ts"
    local temp_file="$config_file.tmp"
    
    log_info "Updating Vite config for backend port $BACKEND_PORT..."
    
    # Create updated config
    cat > "$temp_file" << EOF
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static/frontend',
    emptyOutDir: true,
    assetsDir: 'assets'
  },
  server: {
    port: $FRONTEND_PORT,
    proxy: {
      '/api': {
        target: 'http://localhost:$BACKEND_PORT',
        changeOrigin: true,
        secure: false
      },
      '/v1': {
        target: 'http://localhost:$BACKEND_PORT',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
EOF

    mv "$temp_file" "$config_file" || error_exit "Failed to update Vite config"
    log_success "Vite config updated"
}

# Start Flask backend server
start_backend() {
    log_info "Starting Flask backend server on port $BACKEND_PORT..."
    log_info "Using model: $MODEL"
    
    cd "$PROJECT_ROOT" || error_exit "Failed to change to project root"
    
    # Set environment variables
    export FLASK_ENV=development
    export FLASK_DEBUG=1
    
    # Start Flask server in background
    $PYTHON_CMD -m TTS.server.server \
        --port $BACKEND_PORT \
        --model_name "$MODEL" \
        > /tmp/tts-backend.log 2>&1 &
    
    BACKEND_PID=$!
    
    # Wait for backend to start
    log_info "Waiting for backend server to start..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:$BACKEND_PORT/api/v1/models" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
        
        # Check if process is still running
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            log_error "Backend server failed to start. Check logs:"
            tail -n 20 /tmp/tts-backend.log
            error_exit "Backend server startup failed"
        fi
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_error "Backend server did not respond within 30 seconds. Check logs:"
        tail -n 20 /tmp/tts-backend.log
        error_exit "Backend server startup timeout"
    fi
    
    log_success "Backend server started (PID: $BACKEND_PID)"
    log_info "Backend API: http://localhost:$BACKEND_PORT"
}

# Start Vite frontend server
start_frontend() {
    log_info "Starting Vite frontend server on port $FRONTEND_PORT..."
    
    cd "$FRONTEND_DIR" || error_exit "Failed to change to frontend directory"
    
    # Start Vite dev server in background
    npm run dev > /tmp/tts-frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    log_info "Waiting for frontend server to start..."
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
        
        # Check if process is still running
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            log_error "Frontend server failed to start. Check logs:"
            tail -n 20 /tmp/tts-frontend.log
            error_exit "Frontend server startup failed"
        fi
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_error "Frontend server did not respond within 30 seconds. Check logs:"
        tail -n 20 /tmp/tts-frontend.log
        error_exit "Frontend server startup timeout"
    fi
    
    log_success "Frontend server started (PID: $FRONTEND_PID)"
    log_info "Frontend URL: http://localhost:$FRONTEND_PORT"
}

# Cleanup function
cleanup() {
    if [ "$CLEANUP_DONE" = true ]; then
        return
    fi
    
    log_info "Shutting down servers..."
    
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        log_info "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
        log_success "Frontend server stopped"
    fi
    
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        log_info "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        log_success "Backend server stopped"
    fi
    
    # Restore original Vite config if it was modified
    if [ -f "$FRONTEND_DIR/vite.config.ts.backup" ]; then
        mv "$FRONTEND_DIR/vite.config.ts.backup" "$FRONTEND_DIR/vite.config.ts"
        log_info "Vite config restored"
    fi
    
    # Cleanup log files
    rm -f /tmp/tts-backend.log /tmp/tts-frontend.log 2>/dev/null || true
    
    CLEANUP_DONE=true
    log_success "Cleanup completed"
}

# Show development info
show_development_info() {
    echo
    log_success "🐸 Coqui TTS Development Environment Ready!"
    echo
    log_info "DEVELOPMENT SERVERS:"
    
    if [ "$BACKEND_ONLY" = false ]; then
        log_info "  Frontend:  http://localhost:$FRONTEND_PORT"
    fi
    
    if [ "$FRONTEND_ONLY" = false ]; then
        log_info "  Backend:   http://localhost:$BACKEND_PORT"
    fi
    
    echo
    log_info "DEVELOPMENT FEATURES:"
    log_info "  ✓ Hot reload for frontend changes"
    log_info "  ✓ API proxy from frontend to backend"
    log_info "  ✓ Development logging enabled"
    log_info "  ✓ CORS configured for local development"
    echo
    
    if [ "$BACKEND_ONLY" = false ] && [ "$FRONTEND_ONLY" = false ]; then
        log_info "WORKFLOW:"
        log_info "  1. Access the TTS interface at http://localhost:$FRONTEND_PORT"
        log_info "  2. Make changes to React components in src/"
        log_info "  3. Frontend updates automatically with hot reload"
        log_info "  4. API calls are proxied to Flask backend"
        echo
    fi
    
    log_info "LOGS:"
    log_info "  Frontend: tail -f /tmp/tts-frontend.log"
    log_info "  Backend:  tail -f /tmp/tts-backend.log"
    echo
    
    log_info "Press Ctrl+C to stop all servers"
    echo
}

# Wait for user interrupt
wait_for_interrupt() {
    # Set up signal handlers
    trap cleanup EXIT
    trap cleanup INT
    trap cleanup TERM
    
    # Show info
    show_development_info
    
    # Wait for interrupt
    while true; do
        sleep 1
        
        # Check if processes are still running
        if [ ! -z "$FRONTEND_PID" ] && [ "$BACKEND_ONLY" = false ]; then
            if ! kill -0 $FRONTEND_PID 2>/dev/null; then
                log_error "Frontend server stopped unexpectedly"
                error_exit "Frontend server died"
            fi
        fi
        
        if [ ! -z "$BACKEND_PID" ] && [ "$FRONTEND_ONLY" = false ]; then
            if ! kill -0 $BACKEND_PID 2>/dev/null; then
                log_error "Backend server stopped unexpectedly"
                error_exit "Backend server died"
            fi
        fi
    done
}

# Main function
main() {
    log_info "Starting TTS Frontend Development Environment"
    
    # Parse arguments
    parse_args "$@"
    
    # Validate conflicting options
    if [ "$BACKEND_ONLY" = true ] && [ "$FRONTEND_ONLY" = true ]; then
        error_exit "Cannot specify both --backend-only and --frontend-only"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Install dependencies if needed
    if [ "$BACKEND_ONLY" = false ]; then
        install_dependencies
        
        # Update Vite config
        update_vite_config
    fi
    
    # Start servers
    if [ "$FRONTEND_ONLY" = false ]; then
        start_backend
    fi
    
    if [ "$BACKEND_ONLY" = false ]; then
        start_frontend
    fi
    
    # Wait for interrupt
    wait_for_interrupt
}

# Run main function
main "$@"