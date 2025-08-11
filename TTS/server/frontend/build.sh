#!/bin/bash

# TTS Frontend Production Build Script
# Builds optimized frontend assets for Flask server integration

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR"
OUTPUT_DIR="$SCRIPT_DIR/../static/frontend"
NODE_MODULES_DIR="$FRONTEND_DIR/node_modules"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Error handler
error_exit() {
    log_error "$1"
    exit 1
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "Build failed. Cleaning up..."
        # Remove partial build artifacts if they exist
        if [ -d "$OUTPUT_DIR" ]; then
            rm -rf "$OUTPUT_DIR"
            log_info "Removed partial build artifacts"
        fi
    fi
}

trap cleanup EXIT

main() {
    log_info "Starting TTS Frontend production build"
    log_info "Frontend directory: $FRONTEND_DIR"
    log_info "Output directory: $OUTPUT_DIR"
    
    # Change to frontend directory
    cd "$FRONTEND_DIR" || error_exit "Failed to change to frontend directory: $FRONTEND_DIR"
    
    # Verify package.json exists
    if [ ! -f "package.json" ]; then
        error_exit "package.json not found in $FRONTEND_DIR"
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed or not in PATH"
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
    
    # Check npm version
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed or not in PATH"
    fi
    
    NPM_VERSION=$(npm --version)
    log_info "npm version: $NPM_VERSION"
    
    # Install dependencies if node_modules doesn't exist or is outdated
    if [ ! -d "$NODE_MODULES_DIR" ] || [ "package.json" -nt "$NODE_MODULES_DIR" ]; then
        log_info "Installing dependencies..."
        npm ci --silent || error_exit "Failed to install dependencies"
        log_success "Dependencies installed"
    else
        log_info "Dependencies already up to date"
    fi
    
    # Clean previous build
    if [ -d "$OUTPUT_DIR" ]; then
        log_info "Cleaning previous build..."
        rm -rf "$OUTPUT_DIR"
        log_success "Previous build cleaned"
    fi
    
    # Run TypeScript compilation and build
    log_info "Running production build..."
    
    # Set NODE_ENV for optimized build
    export NODE_ENV=production
    
    # Build with error handling
    if ! npm run build; then
        error_exit "Build command failed"
    fi
    
    # Verify build output
    if [ ! -d "$OUTPUT_DIR" ]; then
        error_exit "Build output directory not created: $OUTPUT_DIR"
    fi
    
    if [ ! -f "$OUTPUT_DIR/index.html" ]; then
        error_exit "index.html not found in build output"
    fi
    
    # Verify assets directory
    if [ ! -d "$OUTPUT_DIR/assets" ]; then
        log_warning "Assets directory not found in build output"
    else
        ASSET_COUNT=$(find "$OUTPUT_DIR/assets" -type f | wc -l)
        log_info "Found $ASSET_COUNT asset files"
    fi
    
    # Calculate build size
    BUILD_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    log_info "Build size: $BUILD_SIZE"
    
    # Verify critical files exist
    log_info "Verifying build integrity..."
    
    CRITICAL_FILES=("index.html")
    for file in "${CRITICAL_FILES[@]}"; do
        if [ ! -f "$OUTPUT_DIR/$file" ]; then
            error_exit "Critical file missing: $file"
        fi
    done
    
    # Check for JavaScript bundles
    JS_FILES=$(find "$OUTPUT_DIR" -name "*.js" | wc -l)
    if [ "$JS_FILES" -eq 0 ]; then
        log_warning "No JavaScript files found in build output"
    else
        log_info "Found $JS_FILES JavaScript files"
    fi
    
    # Check for CSS files
    CSS_FILES=$(find "$OUTPUT_DIR" -name "*.css" | wc -l)
    if [ "$CSS_FILES" -eq 0 ]; then
        log_info "No CSS files found (may be inlined)"
    else
        log_info "Found $CSS_FILES CSS files"
    fi
    
    # Set appropriate permissions for Flask server
    log_info "Setting file permissions..."
    find "$OUTPUT_DIR" -type f -exec chmod 644 {} \;
    find "$OUTPUT_DIR" -type d -exec chmod 755 {} \;
    
    # Generate build manifest
    MANIFEST_FILE="$OUTPUT_DIR/build-manifest.json"
    cat > "$MANIFEST_FILE" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "buildSize": "$BUILD_SIZE",
  "nodeVersion": "$NODE_VERSION",
  "npmVersion": "$NPM_VERSION",
  "files": {
    "total": $(find "$OUTPUT_DIR" -type f | wc -l),
    "js": $JS_FILES,
    "css": $CSS_FILES
  }
}
EOF
    
    log_success "Build manifest created: $MANIFEST_FILE"
    
    # Final verification
    log_info "Running final verification..."
    
    # Verify index.html can be read
    if [ ! -r "$OUTPUT_DIR/index.html" ]; then
        error_exit "index.html is not readable"
    fi
    
    # Check if index.html has minimum expected content
    if ! grep -q "<div id=\"root\">" "$OUTPUT_DIR/index.html"; then
        log_warning "index.html may not contain expected React root element"
    fi
    
    log_success "Frontend build completed successfully!"
    log_info "Build output: $OUTPUT_DIR"
    log_info "Build size: $BUILD_SIZE"
    log_info "Ready for Flask server integration"
    
    # Provide usage instructions
    echo
    log_info "To serve the built frontend:"
    log_info "1. Start the TTS server: python -m TTS.server.server"
    log_info "2. The frontend will be available at the server's root URL"
    log_info "3. Static assets are served from /static/frontend/"
    
    return 0
}

# Run main function with all arguments
main "$@"