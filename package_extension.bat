@echo off
setlocal
title Package YouTube Lyrics Chrome Extension

cd /d "%~dp0"

echo Packaging Chrome Extension into ZIP archive...
if not exist "dist" mkdir "dist"

powershell -NoProfile -Command "if (Test-Path 'dist\yt-lyrics-overlay-extension.zip') { Remove-Item 'dist\yt-lyrics-overlay-extension.zip' -Force }; Compress-Archive -Path 'extension\*' -DestinationPath 'dist\yt-lyrics-overlay-extension.zip' -Force"

if exist "dist\yt-lyrics-overlay-extension.zip" (
    echo.
    echo =======================================================
    echo  SUCCESS: Extension packaged successfully!
    echo  Output: dist\yt-lyrics-overlay-extension.zip
    echo =======================================================
) else (
    echo [Error] Failed to package extension archive.
)
pause
