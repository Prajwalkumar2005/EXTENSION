@echo off
setlocal
title YouTube Lyrics Overlay - System Diagnostics

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python overlay_app\diagnostics.py
    pause
    exit /b 0
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py overlay_app\diagnostics.py
    pause
    exit /b 0
)

echo [Error] Python is not installed or not found in system PATH.
echo Please install Python 3.8+ from https://www.python.org/
pause
exit /b 1
