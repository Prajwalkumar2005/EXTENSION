@echo off
setlocal enabledelayedexpansion
title YouTube Desktop Lyrics Overlay

cd /d "%~dp0"

echo =======================================================
echo     YouTube Desktop Lyrics Overlay - Startup Loader
echo =======================================================
echo.

REM 1. Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=python"
    goto :PYTHON_FOUND
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=py"
    goto :PYTHON_FOUND
)

REM 2. If Python is not installed, check for standalone executable
if exist "overlay_app\dist\YT_Lyrics_Overlay.exe" (
    echo [Info] Python not detected in PATH.
    echo [Info] Launching standalone executable: overlay_app\dist\YT_Lyrics_Overlay.exe...
    start "" "overlay_app\dist\YT_Lyrics_Overlay.exe"
    exit /b 0
)

echo [Error] Python 3 was not found in your system PATH!
echo.
echo Please either:
echo   1. Install Python 3.8+ from https://www.python.org/downloads/
echo      (Make sure to check "Add Python to PATH" during installation)
echo   OR
echo   2. Run overlay_app\dist\YT_Lyrics_Overlay.exe
echo.
pause
exit /b 1

:PYTHON_FOUND
echo [1/2] Checking Python environment...
%PY_CMD% -c "import websockets, tkinter" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [Notice] Installing required Python dependencies...
    %PY_CMD% -m pip install -r "overlay_app\requirements.txt"
    if %ERRORLEVEL% neq 0 (
        echo [Error] Failed to install dependencies. Check your internet connection.
        pause
        exit /b 1
    )
)

echo [2/2] Launching YouTube Lyrics Overlay...
echo.
echo =======================================================
echo  Overlay is running!
echo  Pairing Token: 6b525ec81e87c7c627f54b564b5b925e
echo  Click 'Token' in header to copy token to clipboard.
echo =======================================================
echo.

cd overlay_app
start "" %PY_CMD% main_overlay.py
exit /b 0
