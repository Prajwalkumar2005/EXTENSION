import asyncio
import json
import secrets
import os
import sys
import re
from typing import Dict, Any, Callable, Optional, Set
import websockets
try:
    from websockets.asyncio.server import ServerConnection
except ImportError:
    ServerConnection = Any

DEFAULT_PORTS = [48123, 48124, 48125, 48126, 48127, 48128]
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

def load_or_create_config() -> Dict[str, Any]:
    default_config = {
        "auth_token": secrets.token_hex(16),
        "active_port": DEFAULT_PORTS[0],
        "always_on_top": True,
        "click_through": False,
        "lock_position": False,
        "bg_opacity": 0.82,
        "font_family": "Segoe UI",
        "font_size": 22,
        "font_color": "#FFFFFF",
        "highlight_color": "#FFD700",
        "window_x": 300,
        "window_y": 100,
        "window_w": 800,
        "window_h": 140
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                default_config.update(data)
        except Exception as e:
            print(f"[Config] Failed to load config, re-creating: {e}")
    
    # Save config
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
        self.auth_token = config.get("auth_token", "")
        self.message_callback = message_callback
        self.active_clients: Set[WebSocketServerProtocol] = set()
        self.server = None
        self.bound_port = None

    async def validate_connection(self, websocket: ServerConnection) -> Optional[bool]:
        headers = getattr(websocket, "request", getattr(websocket, "headers", None))
        origin = ""
        path = ""
        if hasattr(websocket, "request") and websocket.request:
            origin = websocket.request.headers.get("Origin", "")
            path = websocket.request.path
        elif hasattr(websocket, "request_headers"):
            origin = websocket.request_headers.get("Origin", "")
            path = getattr(websocket, "path", "")

        if not origin.startswith("chrome-extension://"):
            print(f"[Security Rejected] Invalid Origin: '{origin}'")
            return False

        # Validate query parameter token: ws://127.0.0.1:port/?token=xyz
        token = None
        if "?token=" in path:
            token = path.split("?token=")[-1].split("&")[0]

        if not token or token != self.auth_token:
            print(f"[Security Rejected] Token mismatch. Received: '{token}'")
            return False

        print(f"[Bridge] Connection accepted from Origin: {origin}")
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
        print(f"[Bridge] Client connected. Total: {len(self.active_clients)}")
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
                        print(f"[Bridge] Malformed payload rejected: {message[:100]}")
                except json.JSONDecodeError:
                    print("[Bridge] Non-JSON message rejected")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.active_clients.remove(websocket)
            print(f"[Bridge] Client disconnected. Total: {len(self.active_clients)}")

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
                print(f"[Bridge Server] Successfully bound to 127.0.0.1:{port}")
                return port
            except OSError as e:
                print(f"[Bridge Server] Port {port} in use, trying next...")
        
        raise RuntimeError("Failed to bind WebSocket server to any port in list!")

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            print("[Bridge Server] Server stopped.")

if __name__ == "__main__":
    cfg = load_or_create_config()
    def print_msg(msg):
        print("[Received Msg]:", msg)

    async def main():
        server = BridgeServer(cfg, message_callback=print_msg)
        port = await server.start()
        print(f"Server active on port {port}. Auth Token: {cfg['auth_token']}")
        await asyncio.Event().wait()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Exiting...")
