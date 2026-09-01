import sys
import os
import ctypes
import json
import asyncio
import threading
import collections
import time
import tkinter as tk
from tkinter import ttk
from bridge_server import BridgeServer, load_or_create_config, save_config

# Set DPI awareness on Windows safely before creating GUI
try:
    if sys.platform == "win32":
        try:
            ctypes.windll.shcore.SetProcessDpiAwarenessContext(-4)
        except AttributeError:
            try:
                ctypes.windll.shcore.SetProcessDpiAwareness(2)
            except AttributeError:
                ctypes.windll.user32.SetProcessDPIAware()
except Exception as e:
    print(f"[DPI Info]: {e}")

# Win32 Constants
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_NOACTIVATE = 0x08000000
WS_EX_TOOLWINDOW = 0x00000080
LWA_ALPHA = 0x00000002

class TransparentOverlayApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.config = load_or_create_config()
        self.server = None
        self.loop = None

        self.root.title("YouTube Lyrics Desktop Overlay")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", self.config.get("bg_opacity", 0.85))

        # Position window
        x = self.config.get("window_x", 300)
        y = self.config.get("window_y", 100)
        w = self.config.get("window_w", 800)
        h = self.config.get("window_h", 140)
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        
        # Transparent background color keying for Windows desktop transparency
        self.bg_color = "#000001"
        self.root.configure(bg=self.bg_color)
        if sys.platform == "win32":
            self.root.wm_attributes("-transparentcolor", self.bg_color)

        self.setup_ui()
        self.apply_win32_styles()
        self.setup_drag()

        # Queue for incoming captions (Queue-and-Drop for fast lyrics)
        self.caption_queue = collections.deque(maxlen=5)
        self.is_animating = False
        self.status_state = "searching" # searching, connected, disconnected, no_captions

        # Start async bridge server in daemon thread
        self.start_server_thread()

    def setup_ui(self):
        # Outer Frame
        self.main_frame = tk.Frame(self.root, bg=self.bg_color)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Header Bar for Draggable Handle & Control Buttons
        self.header_frame = tk.Frame(self.main_frame, bg="#181824", height=24)
        self.header_frame.pack(fill=tk.X, side=tk.TOP)

        # Status dot indicator
        self.status_canvas = tk.Canvas(self.header_frame, width=12, height=12, bg="#181824", highlightthickness=0)
        self.status_canvas.pack(side=tk.LEFT, padx=6, pady=4)
        self.status_dot = self.status_canvas.create_oval(2, 2, 10, 10, fill="#fcc419") # Yellow searching

        self.status_label = tk.Label(self.header_frame, text="Searching Bridge...", font=("Segoe UI", 8), fg="#8888aa", bg="#181824")
        self.status_label.pack(side=tk.LEFT, padx=2)

        # Non-Lyric / ASR tag badge
        self.badge_label = tk.Label(self.header_frame, text="", font=("Segoe UI", 7, "bold"), fg="#4dabf7", bg="#181824")
        self.badge_label.pack(side=tk.LEFT, padx=6)

        # Action Buttons
        self.close_btn = tk.Button(self.header_frame, text="✕", font=("Segoe UI", 9), fg="#aaa", bg="#181824", bd=0, command=self.close_app)
        self.close_btn.pack(side=tk.RIGHT, padx=4)

        self.settings_btn = tk.Button(self.header_frame, text="⚙", font=("Segoe UI", 10), fg="#aaa", bg="#181824", bd=0, command=self.open_settings)
        self.settings_btn.pack(side=tk.RIGHT, padx=4)

        # Lyrics Display Canvas (for shadow & multi-color typography)
        self.lyrics_canvas = tk.Canvas(
            self.main_frame,
            bg=self.bg_color,
            highlightthickness=0
        )
        self.lyrics_canvas.pack(fill=tk.BOTH, expand=True, padx=12, pady=10)
        
        # Initial text
        self.draw_poster_text("[ Waiting for Captions ]")

    def apply_win32_styles(self):
        if sys.platform != "win32":
            return
        try:
            hwnd = ctypes.windll.user32.GetParent(self.root.winfo_id())
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            style |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE

            if self.config.get("click_through", False):
                style |= WS_EX_TRANSPARENT
            else:
                style &= ~WS_EX_TRANSPARENT

            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)
        except Exception as e:
            print(f"[Win32] Failed to set style: {e}")

    def setup_drag(self):
        def start_drag(event):
            if not self.config.get("lock_position", False):
                self.x = event.x
                self.y = event.y

        def do_drag(event):
            if not self.config.get("lock_position", False):
                deltax = event.x - self.x
                deltay = event.y - self.y
                x = self.root.winfo_x() + deltax
                y = self.root.winfo_y() + deltay
                self.root.geometry(f"+{x}+{y}")
                self.config["window_x"] = x
                self.config["window_y"] = y

        def stop_drag(event):
            save_config(self.config)

        self.header_frame.bind("<Button-1>", start_drag)
        self.header_frame.bind("<B1-Motion>", do_drag)
        self.header_frame.bind("<ButtonRelease-1>", stop_drag)

    def start_server_thread(self):
        def run_loop():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            self.server = BridgeServer(self.config, message_callback=self.on_bridge_message)
            self.loop.run_until_complete(self.server.start())
            self.root.after(0, self.update_status, "connected", f"Listening on port {self.server.bound_port}")
            self.loop.run_forever()

        t = threading.Thread(target=run_loop, daemon=True)
        t.start()

    def on_bridge_message(self, msg: dict):
        msg_type = msg.get("type")
        if msg_type == "caption_update":
            text = msg.get("text", "")
            is_asr = msg.get("is_asr", False)
            is_tag = msg.get("is_tag", False)
            self.root.after(0, self.queue_caption, text, is_asr, is_tag)
        elif msg_type == "play_state":
            is_playing = msg.get("is_playing", True)
            self.root.after(0, self.update_play_state, is_playing)
        elif msg_type == "no_captions":
            self.root.after(0, self.update_status, "no_captions", "No captions on this video")
        elif msg_type == "config_update":
            self.root.after(0, self.apply_config_update, msg)

    def apply_config_update(self, msg: dict):
        # Update config dictionary
        if "text_style" in msg:
            self.config["text_style"] = msg["text_style"]
        if "font_size" in msg:
            self.config["font_size"] = msg["font_size"]
        save_config(self.config)
        
        # Redraw the current text
        if self.caption_queue:
            # We don't want to disrupt animation, but if it's paused on the last caption we redraw it
            pass
        # Let's just redraw whatever was last shown by storing it or retrieving it
        # The easiest way is to just let the next caption render it, but we want live feedback
        self.draw_poster_text("[ Configuration Updated ]")

    def update_play_state(self, is_playing: bool):
        if not is_playing:
            self.root.attributes("-alpha", 0.3)
        else:
            self.root.attributes("-alpha", self.config.get("bg_opacity", 0.85))

    def update_status(self, state: str, text: str):
        self.status_state = state
        self.status_label.config(text=text)
        if state == "connected":
            self.status_canvas.itemconfig(self.status_dot, fill="#40c057") # Green
        elif state == "no_captions":
            self.status_canvas.itemconfig(self.status_dot, fill="#ff922b") # Orange
            self.draw_poster_text("[ No Captions Available ]")
        elif state == "searching":
            self.status_canvas.itemconfig(self.status_dot, fill="#fcc419") # Yellow

    def draw_poster_text(self, text: str, is_tag: bool = False):
        self.lyrics_canvas.delete("all")
        if not text: return
        
        # Determine center
        w = self.lyrics_canvas.winfo_width() or self.config.get("window_w", 800)
        h = self.lyrics_canvas.winfo_height() or 100
        cx = w / 2
        
        style = self.config.get("text_style", "poster")
        base_size = self.config.get("font_size", 38)
        
        # Split text into two halves
        words = text.split()
        if len(words) <= 2:
            line1, line2 = " ".join(words), ""
        else:
            mid = len(words) // 2
            line1, line2 = " ".join(words[:mid]), " ".join(words[mid:])

        if style == "poster":
            font_name = "Impact"
            f_size1 = base_size
            f_size2 = max(16, base_size - 6)
            
            def draw_glow(txt, y, fsize):
                offsets = [(-2,-2), (2,-2), (-2,2), (2,2), (0,3), (3,0), (-3,0), (0,-3)]
                for dx, dy in offsets:
                    self.lyrics_canvas.create_text(cx + dx, y + dy, text=txt, font=(font_name, fsize), fill="#8b0000", justify="center")
                self.lyrics_canvas.create_text(cx + 1, y + 1, text=txt, font=(font_name, fsize), fill="#ff0000", justify="center")

            y_base = h / 2
            if line2:
                draw_glow(line1, y_base - (base_size//2), f_size1)
                draw_glow(line2, y_base + (base_size//2) + 4, f_size2)
                self.lyrics_canvas.create_text(cx, y_base - (base_size//2), text=line1, font=(font_name, f_size1), fill="#FBC02D", justify="center")
                self.lyrics_canvas.create_text(cx, y_base + (base_size//2) + 4, text=line2, font=(font_name, f_size2), fill="#FFFFFF", justify="center")
            else:
                draw_glow(line1, y_base, f_size1)
                self.lyrics_canvas.create_text(cx, y_base, text=line1, font=(font_name, f_size1), fill="#FBC02D", justify="center")

        elif style == "neon":
            font_name = "Comic Sans MS" if sys.platform == "win32" else "Arial" # Fallback neon-ish
            f_size = base_size
            y_base = h / 2
            full_text = f"{line1}\n{line2}" if line2 else line1
            
            # Neon blur effect
            for offset in [4, 2]:
                self.lyrics_canvas.create_text(cx, y_base, text=full_text, font=(font_name, f_size, "bold"), fill="#ff00ff", justify="center")
            self.lyrics_canvas.create_text(cx, y_base, text=full_text, font=(font_name, f_size, "bold"), fill="#ffffff", justify="center")

        else: # minimal
            font_name = self.config.get("font_family", "Segoe UI")
            f_size = base_size
            y_base = h / 2
            full_text = f"{line1}\n{line2}" if line2 else line1
            color = self.config.get("highlight_color", "#FFD700") if is_tag else self.config.get("font_color", "#FFFFFF")
            self.lyrics_canvas.create_text(cx, y_base, text=full_text, font=(font_name, f_size, "bold"), fill=color, justify="center")

    def queue_caption(self, text: str, is_asr: bool, is_tag: bool):
        self.update_status("connected", "Streaming Captions")
        # Update badge
        if is_tag:
            self.badge_label.config(text="[SOUND TAG]")
        elif is_asr:
            self.badge_label.config(text="[AUTO ASR]")
        else:
            self.badge_label.config(text="[MANUAL CC]")

        self.caption_queue.append((text, is_tag))
        if not self.is_animating:
            self.process_next_caption()

    def process_next_caption(self):
        if not self.caption_queue:
            self.is_animating = False
            return

        self.is_animating = True
        text, is_tag = self.caption_queue.popleft()
        
        self.draw_poster_text(text, is_tag)
        
        # Queue-and-drop timer (~250ms crossfade step)
        self.root.after(250, self.process_next_caption)

    def open_settings(self):
        win = tk.Toplevel(self.root)
        win.title("Overlay Settings")
        win.geometry("360x320")
        win.configure(bg="#181824")
        win.attributes("-topmost", True)

        tk.Label(win, text="YouTube Overlay Settings", font=("Segoe UI", 12, "bold"), fg="#fff", bg="#181824").pack(pady=8)

        # Token display
        tk.Label(win, text="Auth Token (Paste in Chrome Extension):", font=("Segoe UI", 8), fg="#aaa", bg="#181824").pack()
        token_entry = tk.Entry(win, width=38, font=("Consolas", 9))
        token_entry.insert(0, self.config.get("auth_token", ""))
        token_entry.pack(pady=4)

        # Click-through toggle
        ct_var = tk.BooleanVar(value=self.config.get("click_through", False))
        def toggle_ct():
            self.config["click_through"] = ct_var.get()
            save_config(self.config)
            self.apply_win32_styles()
        tk.Checkbutton(win, text="Enable Click-Through Mode", variable=ct_var, command=toggle_ct, fg="#fff", bg="#181824", selectcolor="#2a2a38").pack(anchor="w", padx=20, pady=4)

        # Lock position toggle
        lp_var = tk.BooleanVar(value=self.config.get("lock_position", False))
        def toggle_lp():
            self.config["lock_position"] = lp_var.get()
            save_config(self.config)
        tk.Checkbutton(win, text="Lock Overlay Position", variable=lp_var, command=toggle_lp, fg="#fff", bg="#181824", selectcolor="#2a2a38").pack(anchor="w", padx=20, pady=4)

        # Opacity slider
        tk.Label(win, text="Background Opacity:", font=("Segoe UI", 9), fg="#aaa", bg="#181824").pack(anchor="w", padx=20)
        op_scale = tk.Scale(win, from_=0.2, to=1.0, resolution=0.05, orient=tk.HORIZONTAL, bg="#181824", fg="#fff", highlightthickness=0)
        op_scale.set(self.config.get("bg_opacity", 0.85))
        def update_op(val):
            self.config["bg_opacity"] = float(val)
            self.root.attributes("-alpha", float(val))
            save_config(self.config)
        op_scale.config(command=update_op)
        op_scale.pack(fill=tk.X, padx=20, pady=4)

        # OS Notice
        tk.Label(win, text="⚠️ OS Note: Exclusive Fullscreen games hide overlays.\nUse Borderless Windowed mode in games.", font=("Segoe UI", 8, "italic"), fg="#fcc419", bg="#181824", justify="left").pack(pady=12)

    def close_app(self):
        save_config(self.config)
        if self.loop and self.server:
            asyncio.run_coroutine_threadsafe(self.server.stop(), self.loop)
        self.root.destroy()
        sys.exit(0)

if __name__ == "__main__":
    root = tk.Tk()
    app = TransparentOverlayApp(root)
    root.mainloop()
