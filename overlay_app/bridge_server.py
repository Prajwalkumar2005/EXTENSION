import asyncio
import json
import secrets
import os
import sys
from typing import Dict, Any, Callable, Optional, Set
import websockets
try:
    from websockets.asyncio.server import ServerConnection
except ImportError:
    ServerConnection = Any

DEFAULT_PORTS = [48123, 48124, 48125, 48126, 48127, 48128]
DEFAULT_AUTH_TOKEN = "6b525ec81e87c7c627f54b564b5b925e"
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

def load_or_create_config() -> Dict[str, Any]:
    default_config = {
        "auth_token": DEFAULT_AUTH_TOKEN,
        "active_port": DEFAULT_PORTS[0],
        "always_on_top": True,
        "click_through": False,
        "lock_position": False,
        "bg_opacity": 0.85,
        "font_family": "Segoe UI",
        "font_size": 34,
        "font_color": "#FFFFFF",
        "highlight_color": "#FFD700",
        "window_x": 300,
        "window_y": 80,
        "window_w": 960,
        "window_h": 160,
        "text_style": "poster"
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                default_config.update(data)
        except Exception as e:
            print(f"[Config] Note: Loaded defaults due to: {e}")

    save_config(default_config)
    return default_config

def save_config(config: Dict[str, Any]):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[Config] Error saving config: {e}")

class BridgeServer:
    def __init__(self, config: Dict[str, Any], message_callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.config = config
        self.auth_token = config.get("auth_token", DEFAULT_AUTH_TOKEN)
        self.message_callback = message_callback
        self.active_clients: Set[Any] = set()
        self.server = None
        self.bound_port = None

    async def validate_connection(self, websocket: ServerConnection) -> bool:
        origin = ""
        path = ""
        if hasattr(websocket, "request") and websocket.request:
            origin = websocket.request.headers.get("Origin", "")
            path = websocket.request.path
        elif hasattr(websocket, "request_headers"):
            origin = websocket.request_headers.get("Origin", "")
            path = getattr(websocket, "path", "")

        # Origin verification: must originate from a browser extension
        if not origin.startswith("chrome-extension://"):
            print(f"[Security Rejected] Invalid Origin: '{origin}'")
            return False

        # Query token verification
        token = None
        if "?token=" in path:
            token = path.split("?token=")[-1].split("&")[0]

        if not token or token != self.auth_token:
            print(f"[Security Rejected] Token mismatch. Received: '{token}'")
            return False

        print(f"[Bridge] Verified connection from {origin}")
        return True

    def validate_payload(self, data: Dict[str, Any]) -> bool:
        if not isinstance(data, dict):
            return False
        msg_type = data.get("type")
        if not msg_type or not isinstance(msg_type, str):
            return False

        valid_types = {"caption_update", "play_state", "no_captions", "ping", "config_update"}
        if msg_type not in valid_types:
            return False

        if msg_type == "caption_update":
            if "text" not in data or not isinstance(data["text"], str):
                return False
        return True

    async def handler(self, websocket: ServerConnection, path: str = ""):
        if not await self.validate_connection(websocket):
            await websocket.close(code=4001, reason="Unauthorized connection")
            return

        self.active_clients.add(websocket)
        print(f"[Bridge] Extension client connected (Total: {len(self.active_clients)})")
        if self.message_callback:
            self.message_callback({"type": "client_connected"})

        try:
            async for message in websocket:
                try:
                    payload = json.loads(message)
                    if self.validate_payload(payload):
                        if payload.get("type") == "ping":
                            await websocket.send(json.dumps({"type": "pong"}))
                        elif self.message_callback:
                            self.message_callback(payload)
                    else:
                        print(f"[Bridge] Invalid payload discarded")
                except json.JSONDecodeError:
                    print("[Bridge] Malformed non-JSON data discarded")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.active_clients:
                self.active_clients.remove(websocket)
            print(f"[Bridge] Client disconnected (Remaining: {len(self.active_clients)})")
            if self.message_callback:
                self.message_callback({"type": "client_disconnected", "count": len(self.active_clients)})

    async def start(self):
        for port in DEFAULT_PORTS:
            try:
                self.server = await websockets.serve(
                    self.handler,
                    "127.0.0.1",
                    port
                )
                self.bound_port = port
                self.config["active_port"] = port
                save_config(self.config)
                print(f"[Bridge Server] Active and listening on 127.0.0.1:{port}")
                return port
            except OSError:
                print(f"[Bridge Server] Port {port} busy, testing next port...")

        raise RuntimeError("Failed to bind WebSocket server to any available port.")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            print("[Bridge Server] Stopped cleanly.")

if __name__ == "__main__":
    cfg = load_or_create_config()
    def print_msg(msg):
        print("[Received]:", msg)

    async def main():
        server = BridgeServer(cfg, message_callback=print_msg)
        port = await server.start()
        print(f"Server online on port {port}. Token: {cfg['auth_token']}")
        await asyncio.Event().wait()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server shutdown requested.")
