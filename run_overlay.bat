@echo off
echo Starting YouTube Lyrics Desktop Overlay...
cd overlay_app
pip install -r requirements.txt > nul 2>&1
python main_overlay.py
pause
