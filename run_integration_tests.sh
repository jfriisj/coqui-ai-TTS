#!/bin/bash

# Integration test runner script for TTS FastAPI server
# This script starts the server and runs comprehensive endpoint tests

set -e

echo "TTS Server Integration Test Suite"
echo "================================="
echo

# Configuration
PORT=5002
HOST="127.0.0.1"
TIMEOUT=30
DEVICE="cpu"  # Use CPU for consistent testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Function to check if server is running
check_server() {
    local url="http://${HOST}:${PORT}/api/v1/health"
    if curl -s -f "$url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for server to be ready
wait_for_server() {
    log_info "Waiting for server to start on ${HOST}:${PORT}..."
    
    local count=0
    while [ $count -lt $TIMEOUT ]; do
        if check_server; then
            log_success "Server is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        count=$((count + 1))
    done
    
    log_error "Server failed to start within ${TIMEOUT} seconds"
    return 1
}

# Function to start the TTS server
start_server() {
    log_info "Starting TTS server..."
    
    # Check if Python virtual environment exists
    if [ -f ".venv/Scripts/python.exe" ]; then
        PYTHON=".venv/Scripts/python.exe"
    elif [ -f "venv/bin/python" ]; then
        PYTHON="venv/bin/python"
    elif [ -f ".venv/bin/python" ]; then
        PYTHON=".venv/bin/python"
    else
        PYTHON="python"
        log_warning "No virtual environment found, using system Python"
    fi
    
    # Start the server in background
    log_info "Using Python: $PYTHON"
    log_info "Starting server with: $PYTHON TTS/server/server.py --port $PORT --device $DEVICE"
    
    NUMBA_CACHE_DIR=/tmp/numba_cache $PYTHON TTS/server/server.py \
        --port $PORT \
        --device $DEVICE \
        --debug &
    
    SERVER_PID=$!
    log_info "Server started with PID: $SERVER_PID"
    
    # Wait for server to be ready
    if wait_for_server; then
        return 0
    else
        log_error "Failed to start server"
        kill $SERVER_PID 2>/dev/null || true
        return 1
    fi
}

# Function to run integration tests
run_tests() {
    log_info "Running integration tests..."
    
    # Check if Python virtual environment exists for tests
    if [ -f ".venv/Scripts/python.exe" ]; then
        PYTHON=".venv/Scripts/python.exe"
    elif [ -f "venv/bin/python" ]; then
        PYTHON="venv/bin/python"
    elif [ -f ".venv/bin/python" ]; then
        PYTHON=".venv/bin/python"
    else
        PYTHON="python"
    fi
    
    # Run the test script
    $PYTHON test_endpoints.py
    return $?
}

# Function to run tests with pytest (if available)
run_pytest() {
    log_info "Running pytest integration tests..."
    
    # Check if pytest is available
    if ! command -v pytest &> /dev/null; then
        log_warning "pytest not found, installing test dependencies..."
        pip install -r tests/integration/requirements-test.txt
    fi
    
    # Run pytest
    pytest tests/integration/test_fastapi_server.py -v --tb=short
    return $?
}

# Function to cleanup
cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        log_info "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        log_success "Server stopped"
    fi
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    echo "Starting integration test suite..."
    echo "Server will run on: http://${HOST}:${PORT}"
    echo "Device: ${DEVICE}"
    echo "Timeout: ${TIMEOUT}s"
    echo
    
    # Check if server is already running
    if check_server; then
        log_warning "Server is already running on port $PORT"
        log_info "Using existing server for tests"
        SERVER_PID=""  # Don't kill existing server
    else
        # Start new server
        if ! start_server; then
            log_error "Failed to start server"
            exit 1
        fi
    fi
    
    # Run tests
    log_info "Server is ready, running tests..."
    sleep 2  # Give server extra time to fully initialize
    
    if run_tests; then
        log_success "All integration tests completed successfully!"
        exit 0
    else
        log_error "Some integration tests failed"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --device)
            DEVICE="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --pytest)
            USE_PYTEST=1
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --port PORT       Server port (default: 5002)"
            echo "  --host HOST       Server host (default: 127.0.0.1)"
            echo "  --device DEVICE   Device to use (default: cpu)"
            echo "  --timeout TIMEOUT Startup timeout in seconds (default: 30)"
            echo "  --pytest          Use pytest instead of simple test runner"
            echo "  --help, -h        Show this help message"
            echo
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main
