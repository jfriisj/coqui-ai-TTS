@echo off
REM TTS Server Startup Script for Windows
REM This script sets up and starts the TTS server with OpenAPI generation

setlocal EnableDelayedExpansion

echo.
echo ^🚀 TTS Server with OpenAPI Generation
echo =====================================

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required but not installed
    exit /b 1
)

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required but not installed
    exit /b 1
)

REM Check yarn
yarn --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Yarn not found, installing...
    npm install -g yarn
)

REM Create virtual environment if it doesn't exist
set "VENV_DIR=%SCRIPT_DIR%venv"
if not exist "%VENV_DIR%" (
    echo 📦 Creating Python virtual environment...
    python -m venv "%VENV_DIR%"
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r "%SCRIPT_DIR%requirements.txt"

REM Install OpenAPI Generator CLI globally if not present
openapi-generator-cli version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing OpenAPI Generator CLI...
    npm install -g @openapitools/openapi-generator-cli
)

REM Change to script directory
cd /d "%SCRIPT_DIR%"

REM Parse command line arguments
set "GENERATE_ONLY=false"
set "BUILD_FRONTEND=false"
set "PORT=8000"
set "HOST=0.0.0.0"

:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--generate-only" (
    set "GENERATE_ONLY=true"
    shift
    goto parse_args
)
if "%~1"=="--build-frontend" (
    set "BUILD_FRONTEND=true"
    shift
    goto parse_args
)
if "%~1"=="--port" (
    set "PORT=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--host" (
    set "HOST=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help

echo ❌ Unknown option: %~1
exit /b 1

:show_help
echo Usage: %~nx0 [options]
echo Options:
echo   --generate-only     Only generate API client and exit
echo   --build-frontend    Build frontend after generation
echo   --port PORT         Port to run server on (default: 8000)
echo   --host HOST         Host to bind to (default: 0.0.0.0)
echo   --help, -h          Show this help message
exit /b 0

:end_parse

REM Run the server
if "%GENERATE_ONLY%"=="true" (
    echo 📝 Generating API client only...
    if "%BUILD_FRONTEND%"=="true" (
        python main.py --generate-only --build-frontend
    ) else (
        python main.py --generate-only
    )
) else (
    echo 🌐 Starting TTS server on %HOST%:%PORT%...
    echo 📖 API documentation will be available at http://%HOST%:%PORT%/docs
    echo 🌐 Frontend will be available at http://%HOST%:%PORT%/frontend/
    echo ⚡ OpenAPI spec at http://%HOST%:%PORT%/openapi
    echo.
    python main.py --host %HOST% --port %PORT% --reload
)
