# YouTube Desktop Lyrics Overlay 🎵

[![Chrome Extension MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?logo=googlechrome&logoColor=white)](extension/manifest.json)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)](overlay_app/requirements.txt)
[![Platform Windows 10/11](https://img.shields.io/badge/Platform-Windows_10%20%7C%2011-0078D6?logo=windows&logoColor=white)](run_overlay.bat)
[![License MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Privacy 100% Local](https://img.shields.io/badge/Privacy-100%25_Local_%26_Private-success)](overlay_app/bridge_server.py)

A sleek, lightweight, and completely private tool to stream **YouTube Closed-Captions & lyrics** directly to a beautiful, transparent, always-on-top desktop overlay in real time. Perfect for karaoke, singing along, language learning, or watching tutorials while working in other windows or playing games.

---

## 📸 Live Preview

![Demo Screenshot](demo_screenshot.png)

---

## ⚡ Quick Start Guide (Zero-Config Plug & Play)

Getting started takes less than 60 seconds. Anyone can download and launch it directly:

### 1. Install Chrome Extension (30 Seconds)
1. **Download** or clone this repository to your computer.
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the `extension` folder inside this project.
6. Click the puzzle icon 🧩 in Chrome's top toolbar and pin **YouTube Desktop Lyrics Overlay** for quick access.

### 2. Launch Desktop Overlay
1. Double-click **`run_overlay.bat`** in the main folder.
   - *Automatic setup:* The script checks your environment, installs necessary dependencies (`websockets`), and launches the overlay.
   - *No Python?* You can also run the standalone pre-compiled executable directly at `overlay_app\dist\YT_Lyrics_Overlay.exe`.
2. A sleek transparent overlay will appear on your desktop with a green status indicator: `Connected to Chrome`.
   - *Zero-Config:* The extension and desktop overlay are pre-configured with an out-of-the-box pairing key—no manual token setup required!

### 3. Play Any YouTube Video!
1. Open [YouTube](https://www.youtube.com) and play any video, music track, or YouTube Short with Closed Captions (**CC**) enabled.
2. Watch the lyrics float seamlessly over your screen!

---

## ✨ Features

- **🎨 13 Cinematic Visual Styles:** Switch styles on the fly from the Chrome popup—from Hollywood cinematic dual-line poster text to Cyberpunk neon glow.
- **🪟 True Desktop Transparency:** Text renders directly over your desktop wallpaper, browser, IDE, or games with zero window borders.
- **🖱️ Click-Through Mode:** Enable click-through so your mouse clicks pass completely through the lyrics to windows beneath.
- **⚡ Dual-Engine Caption Sync:** Combines YouTube's TimedText sub-second API with real-time DOM mutation fallback for sub-frame accuracy.
- **📱 Shorts & Live Support:** Works seamlessly across standard YouTube videos, YouTube Shorts, and live streams.
- **🔒 100% Local & Private:** No cloud servers, no account required, no telemetry. Communication runs entirely through a local loopback WebSocket (`127.0.0.1`).
- **🎛️ Live Customization:** Adjust font sizes, switch styles, and test caption emission directly from the Chrome extension popup.

---

## 🎭 Visual Typography Styles

| Style Name | Description | Color Palette |
| :--- | :--- | :--- |
| **Cinematic Poster** *(Default)* | Dual-line movie title typography with bold drop-glow | Gold `#FBC02D` & Crisp White `#FFF` |
| **Neon Glow** | Vibrant synthwave glow with multi-pass blur | Neon Pink `#FF00FF` & Cyan `#00FFFF` |
| **Minimalist** | Clean modern aesthetic for focus and productivity | Crisp Studio White `#FFFFFF` |
| **Classic Subtitle (Yellow)** | Traditional broadcast yellow subtitles | High-contrast Yellow `#FFD700` |
| **Classic Subtitle (White)** | Classic cinema white subtitles with dark border | Clean White `#FFFFFF` |
| **Cyberpunk** | Monospace terminal aesthetic | Electric Cyan `#00FFFF` & Magenta `#FF00FF` |
| **Luxury Gold** | Elegant serif typeface with warm gold tones | Regal Gold `#FFDF00` |
| **Hacker Green** | Retro matrix phosphor glow | Terminal Green `#00FF00` |
| **Blood Red** | Aggressive bold high-impact red | Crimson Red `#FF0000` |
| **Ocean Blue** | Cool aquatic tones with navy outline | Azure Cyan `#00BFFF` |
| **Sunset Orange** | Warm dusk gradient styling | Deep Orange `#FF4500` & Violet `#800080` |
| **Ghost White** | Ethereal soft-shadow subtitle | Off-white `#F8F8FF` |
| **Vaporwave** | 80s retro aesthetic | Pastel Lavender `#FF66FF` & Cyan |

---

---

## ⚡ Keyboard Shortcuts (Global Desktop Hotkeys)

| Shortcut | Action |
| :--- | :--- |
| **`Ctrl` + `+`** or **`Ctrl` + `=`** | Increase Font Size (+2px) |
| **`Ctrl` + `-`** | Decrease Font Size (-2px) |
| **`Ctrl` + `S`** | Cycle to Next Visual Typography Style |
| **`Ctrl` + `L`** | Toggle Overlay Position Lock |
| **`Ctrl` + `T`** | Toggle Click-Through Mode (pass mouse clicks through) |
| **`Ctrl` + `H`** | Hide / Unhide Overlay Window |

---

## 🕹️ Desktop Overlay Controls

- **Move Overlay:** Click and drag anywhere along the top dark header bar.
- **Resize Overlay:** Click and drag the bottom-right resize grip (**◢**).
- **Audio Visualizer:** Animated reactive equalizer bars in the header pulse during playback.
- **Copy Pairing Token:** Click the **📋 Token** button in the header to copy your pairing key with 1 click.
- **Settings Panel:** Click the **⚙** gear icon in the header to:
  - Toggle **Click-Through Mode** (clicks pass through overlay).
  - Toggle **Lock Position** (prevents accidental movement).
  - Adjust **Background Opacity** slider.
  - View full list of hotkeys.
- **Close Overlay:** Click the **✕** button on the right side of the header.

---

## 🛠️ Developer & Distribution Scripts

| Script | Purpose |
| :--- | :--- |
| **`run_overlay.bat`** | One-click launcher for Windows; auto-detects Python or standalone EXE. |
| **`diagnose_setup.bat`** | Runs full system health check (Python, ports, dependencies, manifest). |
| **`package_extension.bat`** | Bundles the `extension/` folder into `dist/yt-lyrics-overlay-extension.zip`. |
| **`setup_windows.bat`** | Automatically installs and upgrades Python dependencies from `requirements.txt`. |
| **`overlay_app/test_bridge.py`** | Automated security and communication test suite for WebSocket bridge. |

---

## ❓ Troubleshooting FAQ

### Lyrics aren't appearing on desktop?
1. Check that Closed Captions (**CC**) are turned on in the YouTube player (press `C` on your keyboard).
2. Look at the status dot in the overlay header:
   - 🟢 **Green:** Connected to Chrome.
   - 🟡 **Yellow:** Waiting for connection. Click **Connect Bridge** in the Chrome extension popup.
   - 🟠 **Orange:** No captions track found for current video.

### Running games in fullscreen?
Windows exclusive fullscreen games take exclusive control of the display hardware and hide desktop overlays. **Switch your game display mode to "Borderless Windowed"** or "Windowed Fullscreen" to keep lyrics floating over gameplay.

### Port conflict?
The overlay automatically scans fallback ports `48123` through `48128`. If port 48123 is busy, it automatically binds to the next available port and informs the Chrome extension.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
