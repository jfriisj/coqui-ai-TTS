@echo off
setlocal enabledelayedexpansion

REM Integration test runner for TTS FastAPI server (Windows)
REM This script starts the server and runs comprehensive endpoint tests

echo TTS Server Integration Test Suite
echo =================================
echo.

REM Configuration
set PORT=5002
set HOST=127.0.0.1
set TIMEOUT=30
set DEVICE=cpu
set SERVER_PID=

REM Parse command line arguments
:parse_args
if "%1"=="--port" (
    set PORT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--host" (
    set HOST=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--device" (
    set DEVICE=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--timeout" (
    set TIMEOUT=%2
    shift
    shift
    goto parse_args
)
if "%1"=="--help" goto show_help
if "%1"=="-h" goto show_help
if not "%1"=="" (
    echo [ERROR] Unknown option: %1
    echo Use --help for usage information
    exit /b 1
)

REM Main execution
echo Starting integration test suite...
echo Server will run on: http://%HOST%:%PORT%
echo Device: %DEVICE%
echo Timeout: %TIMEOUT%s
echo.

REM Check if Python virtual environment exists
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else if exist "venv\Scripts\python.exe" (
    set PYTHON=venv\Scripts\python.exe
) else (
    set PYTHON=python
    echo [WARNING] No virtual environment found, using system Python
)

echo [INFO] Using Python: !PYTHON!

REM Check if server is already running
echo [INFO] Checking if server is already running...
curl -s -f "http://%HOST%:%PORT%/api/v1/health" >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Server is already running on port %PORT%
    echo [INFO] Using existing server for tests
    goto run_tests
)

REM Start the server
echo [INFO] Starting TTS server...
set NUMBA_CACHE_DIR=%TEMP%\numba_cache
start /b "TTS_SERVER" !PYTHON! TTS\server\server.py --port %PORT% --device %DEVICE% --debug

REM Wait for server to start
echo [INFO] Waiting for server to start on %HOST%:%PORT%...
set /a count=0
:wait_loop
if !count! geq %TIMEOUT% (
    echo [ERROR] Server failed to start within %TIMEOUT% seconds
    goto cleanup
)

timeout /t 1 /nobreak >nul
curl -s -f "http://%HOST%:%PORT%/api/v1/health" >nul 2>&1
if !errorlevel! equ 0 (
    echo [SUCCESS] Server is ready!
    goto run_tests
)

echo|set /p="."
set /a count+=1
goto wait_loop

:run_tests
echo [INFO] Server is ready, running tests...
timeout /t 2 /nobreak >nul

echo [INFO] Running integration tests...
!PYTHON! test_endpoints.py

if !errorlevel! equ 0 (
    echo.
    echo [SUCCESS] All integration tests completed successfully!
    goto cleanup
) else (
    echo.
    echo [ERROR] Some integration tests failed
    goto cleanup
)

:show_help
echo Usage: %0 [OPTIONS]
echo.
echo Options:
echo   --port PORT       Server port (default: 5002)
echo   --host HOST       Server host (default: 127.0.0.1)
echo   --device DEVICE   Device to use (default: cpu)
echo   --timeout TIMEOUT Startup timeout in seconds (default: 30)
echo   --help, -h        Show this help message
echo.
exit /b 0

:cleanup
REM Kill the server process if we started it
for /f "tokens=2" %%i in ('tasklist /fi "windowtitle eq TTS_SERVER" /fo csv ^| find "python"') do (
    echo [INFO] Stopping server...
    taskkill /f /pid %%i >nul 2>&1
)
exit /b %errorlevel%
