# Changelog

All notable changes to this project will be documented in this file.

## [v1.1.0] - Interactive Controls & Diagnostics

### Added
- **Global Keyboard Shortcuts:** Support for `Ctrl + / -` (font sizing), `Ctrl + S` (cycle styles), `Ctrl + L` (lock position), `Ctrl + T` (click-through toggle), and `Ctrl + H` (hide/unhide).
- **Audio-Reactive Equalizer:** Dynamic 5-bar animated visualizer in the overlay header that dances during playback.
- **Custom Color Picker & Live Preview:** Extension popup now features a color wheel/hex picker and an interactive typography preview card.
- **Smooth Micro-Glide Transitions:** Lyrics glide into position smoothly with balanced line breaking to eliminate jarring visual cuts.
- **System Health Diagnostics:** Built-in `diagnostics.py` and `diagnose_setup.bat` verifying Python environment, port bindings, extension manifest, and transparency compositing.

## [v1.0.0] - Production Release

### Added
- **Multi-Resolution Extension Branding:** Designed and generated high-resolution icons (16x16, 32x32, 48x48, 128x128) for Chrome toolbar, context menus, and extensions management.
- **Manifest V3 Modernization:** Complete declarative manifest with YouTube Shorts (`/shorts/*`) and Live stream support.
- **Zero-Config Auto-Connect:** Extension and Desktop overlay now connect instantly out-of-the-box without requiring manual token entry.
- **Sleek Popup UI:** Modern glassmorphic popup with live connection status pill, real-time font size slider, and "Send Test Caption" emitter.
- **13 Cinematic Visual Styles:** Integrated Cinematic Poster, Neon Glow, Minimalist, Classic Subtitle (Yellow & White), Cyberpunk, Luxury Gold, Hacker Green, Blood Red, Ocean Blue, Sunset Orange, Ghost White, and Vaporwave.
- **Dual-Engine Caption Capture:** Fast TimedText API JSON fetch coupled with low-latency DOM MutationObserver mirroring.
- **Screen Boundary Clamping:** Desktop overlay automatically guards against off-screen coordinates on single or multi-monitor setups.
- **1-Click Token Copy:** Quick-copy button in the overlay header and settings window.
- **Automated Distribution Scripts:** `run_overlay.bat` for one-click launch, `package_extension.bat` for building distribution ZIP packages, and `setup_windows.bat` for dependency installation.
- **Automated Test Suite:** Security tests for origin verification and token validation in `test_bridge.py`.
