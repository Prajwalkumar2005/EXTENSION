#!/usr/bin/env python3
"""
YouTube Desktop Lyrics Overlay - System Health & Diagnostic Tool
Validates Python runtime, dependencies, network ports, and Chrome extension assets.
"""
import sys
import os
import socket
import json

DEFAULT_PORTS = [48123, 48124, 48125, 48126, 48127, 48128]

def print_result(name: str, passed: bool, detail: str = ""):
    status = "[ PASS ]" if passed else "[ FAIL ]"
    color = "\033[92m" if passed else "\033[91m"
    reset = "\033[0m"
    print(f"{color}{status}{reset} {name:<35} {detail}")

def check_python_version():
    ver = sys.version_info
    passed = ver.major == 3 and ver.minor >= 8
    detail = f"Python {ver.major}.{ver.minor}.{ver.micro}"
    print_result("Python Runtime Version (>= 3.8)", passed, detail)
    return passed

def check_dependencies():
    all_ok = True
    deps = [
        ("tkinter", "Desktop GUI Framework"),
        ("websockets", "WebSocket Server Engine"),
        ("asyncio", "Asynchronous Event Loop"),
        ("json", "JSON Serialization")
    ]
    for mod, desc in deps:
        try:
            __import__(mod)
            print_result(f"Module: {mod}", True, desc)
        except ImportError as e:
            print_result(f"Module: {mod}", False, f"Missing! Run: pip install {mod}")
            all_ok = False
    return all_ok

def check_port_availability():
    free_ports = []
    for port in DEFAULT_PORTS:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                free_ports.append(port)
            except OSError:
                pass
    passed = len(free_ports) > 0
    detail = f"{len(free_ports)}/{len(DEFAULT_PORTS)} ports free ({', '.join(map(str, free_ports[:3]))}...)" if passed else "All ports occupied!"
    print_result("Bridge Ports (48123-48128)", passed, detail)
    return passed

def check_extension_assets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ext_dir = os.path.join(base_dir, "extension")
    manifest_path = os.path.join(ext_dir, "manifest.json")

    if not os.path.exists(manifest_path):
        print_result("Extension Manifest Check", False, "manifest.json not found")
        return False

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        mv = data.get("manifest_version")
        passed = (mv == 3)
        print_result("Extension Manifest V3", passed, f"Version: {data.get('version', '1.0.0')}")
    except Exception as e:
        print_result("Extension Manifest V3", False, str(e))
        return False

    # Check icons
    icon_sizes = [16, 32, 48, 128]
    icons_ok = all(os.path.exists(os.path.join(ext_dir, "icons", f"icon{s}.png")) for s in icon_sizes)
    print_result("Extension Icon Assets", icons_ok, "16, 32, 48, 128px PNGs verified")
    return passed and icons_ok

def check_os_features():
    is_win = sys.platform == "win32"
    if not is_win:
        print_result("OS Platform Compatibility", True, f"Running on {sys.platform}")
        return True
    try:
        import ctypes
        has_user32 = hasattr(ctypes.windll, "user32")
        print_result("Windows Transparent Compositor", has_user32, "Direct Win32 Window Keying Supported")
        return has_user32
    except Exception as e:
        print_result("Windows Transparent Compositor", False, str(e))
        return False

def main():
    print("=" * 65)
    print("      YouTube Desktop Lyrics Overlay - System Diagnostics")
    print("=" * 65)
    print()

    results = [
        check_python_version(),
        check_dependencies(),
        check_port_availability(),
        check_extension_assets(),
        check_os_features()
    ]

    print()
    print("=" * 65)
    if all(results):
        print(" [SUCCESS] All system health checks passed! Ready to run.")
        print("=" * 65)
        sys.exit(0)
    else:
        print(" [WARNING] Some diagnostics failed. Please review items marked [ FAIL ].")
        print("=" * 65)
        sys.exit(1)

if __name__ == "__main__":
    main()
