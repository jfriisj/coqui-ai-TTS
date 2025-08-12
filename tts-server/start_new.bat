@echo off
REM TTS Server with OpenAPI Generation - Windows Startup Script
REM This script sets up and starts the TTS server with full TTS capabilities

setlocal enabledelayedexpansion

echo 🚀 TTS Server with OpenAPI Generation and Full TTS Support
echo ==========================================================

REM Script directory
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..

REM Default values
set GENERATE_ONLY=false
set BUILD_FRONTEND=false
set DISABLE_TTS=false
set PORT=8000
set HOST=0.0.0.0
set LOG_LEVEL=info

REM Parse command line arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--generate-only" (
    set GENERATE_ONLY=true
    shift
    goto parse_args
)
if "%~1"=="--build-frontend" (
    set BUILD_FRONTEND=true
    shift
    goto parse_args
)
if "%~1"=="--disable-tts" (
    set DISABLE_TTS=true
    shift
    goto parse_args
)
if "%~1"=="--port" (
    set PORT=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--host" (
    set HOST=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--log-level" (
    set LOG_LEVEL=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
echo ❌ Unknown option: %~1
goto show_help

:show_help
echo Usage: %0 [options]
echo Options:
echo   --generate-only     Only generate API client and exit
echo   --build-frontend    Build frontend after generation
echo   --disable-tts       Disable TTS services (generator only mode)
echo   --port PORT         Port to run server on (default: 8000)
echo   --host HOST         Host to bind to (default: 0.0.0.0)
echo   --log-level LEVEL   Log level: debug, info, warning, error (default: info)
echo   --help, -h          Show this help message
echo.
echo Examples:
echo   %0                           # Start with all services
echo   %0 --disable-tts             # Start without TTS services
echo   %0 --generate-only           # Generate API client only
echo   %0 --port 3000 --log-level debug  # Custom port with debug logging
exit /b 0

:end_parse

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required but not installed
    exit /b 1
)
echo ✅ Python found

REM Check Node.js (optional)
where node >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Node.js not found. Frontend generation will be limited.
    echo    Install Node.js from https://nodejs.org/ for full functionality
) else (
    echo ✅ Node.js found
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo 📦 Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt --quiet

REM Install OpenAPI Generator CLI if Node.js is available
where node >nul 2>&1
if not errorlevel 1 (
    where openapi-generator-cli >nul 2>&1
    if errorlevel 1 (
        echo 📦 Installing OpenAPI Generator CLI...
        npm install -g @openapitools/openapi-generator-cli
    ) else (
        echo ✅ OpenAPI Generator CLI found
    )
)

REM Set up TTS environment variables
echo 🔧 Setting up TTS environment...
if not defined TTS_CACHE_MAX_MEMORY_MB set TTS_CACHE_MAX_MEMORY_MB=4096
if not defined TTS_CACHE_MAX_ENTRIES set TTS_CACHE_MAX_ENTRIES=10
if not defined TTS_CACHE_CLEANUP_THRESHOLD set TTS_CACHE_CLEANUP_THRESHOLD=0.8

REM Build command arguments
set CMD_ARGS=--host %HOST% --port %PORT% --log-level %LOG_LEVEL%

if "%DISABLE_TTS%"=="true" (
    set CMD_ARGS=%CMD_ARGS% --disable-tts
)

if "%GENERATE_ONLY%"=="true" (
    set CMD_ARGS=%CMD_ARGS% --generate-only
    if "%BUILD_FRONTEND%"=="true" (
        set CMD_ARGS=%CMD_ARGS% --build-frontend
    )
)

REM Run the server
if "%GENERATE_ONLY%"=="true" (
    echo 📝 Generating API client only...
    python main.py %CMD_ARGS%
) else (
    echo 🌐 Starting TTS server on %HOST%:%PORT%...
    echo 📖 API documentation: http://%HOST%:%PORT%/docs
    echo 🌐 Frontend: http://%HOST%:%PORT%/frontend/
    echo ⚡ OpenAPI spec: http://%HOST%:%PORT%/openapi
    
    if "%DISABLE_TTS%"=="true" (
        echo 🔇 TTS services: disabled
    ) else (
        echo 🎙️ TTS services: enabled
        echo 🔧 TTS endpoints: http://%HOST%:%PORT%/tts/api/v2/*
    )
    
    echo 📊 Cache: %TTS_CACHE_MAX_MEMORY_MB%MB, %TTS_CACHE_MAX_ENTRIES% entries
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    
    REM Add reload flag for development
    if "%LOG_LEVEL%"=="debug" (
        set CMD_ARGS=%CMD_ARGS% --reload
    )
    
    python main.py %CMD_ARGS%
)

pause
