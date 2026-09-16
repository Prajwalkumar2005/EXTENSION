@echo off
setlocal
title Setup Python Environment

cd /d "%~dp0"

echo Setting up Python environment for YouTube Lyrics Overlay...
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [Error] Python is not installed or not in system PATH.
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

python -m pip install --upgrade pip
python -m pip install -r "overlay_app\requirements.txt"

echo.
echo Environment setup complete! You can now launch using run_overlay.bat
pause
