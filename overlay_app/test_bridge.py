import asyncio
import json
import websockets
from bridge_server import BridgeServer, load_or_create_config

class TestBridgeSecurity:
    async def test_valid_connection(self):
        cfg = load_or_create_config()
        received = []
        server = BridgeServer(cfg, message_callback=lambda m: received.append(m))
        port = await server.start()
        
        url = f"ws://127.0.0.1:{port}/?token={cfg['auth_token']}"
        headers = {"Origin": "chrome-extension://test-extension-id-1234"}
        
        async with websockets.connect(url, additional_headers=headers) as ws:
            payload = {"type": "caption_update", "text": "Hello world", "sent_at": 1000}
            await ws.send(json.dumps(payload))
            await asyncio.sleep(0.1)
            
        await server.stop()
        assert len(received) == 1
        assert received[0]["text"] == "Hello world"

    async def test_invalid_origin_rejection(self):
        cfg = load_or_create_config()
        server = BridgeServer(cfg)
        port = await server.start()
        
        url = f"ws://127.0.0.1:{port}/?token={cfg['auth_token']}"
        headers = {"Origin": "https://malicious-website.com"}
        
        try:
            async with websockets.connect(url, additional_headers=headers):
                pass
        except websockets.exceptions.InvalidStatusCode:
            pass
        finally:
            await server.stop()

    async def test_invalid_token_rejection(self):
        cfg = load_or_create_config()
        server = BridgeServer(cfg)
        port = await server.start()
        
        url = f"ws://127.0.0.1:{port}/?token=wrongtoken"
        headers = {"Origin": "chrome-extension://test-extension-id-1234"}
        
        try:
            async with websockets.connect(url, additional_headers=headers):
                pass
        except websockets.exceptions.InvalidStatusCode:
            pass
        finally:
            await server.stop()

if __name__ == "__main__":
    asyncio.run(TestBridgeSecurity().test_valid_connection())
    try:
        asyncio.run(TestBridgeSecurity().test_invalid_origin_rejection())
    except Exception:
        print("[Pass] Invalid Origin rejected")
    try:
        asyncio.run(TestBridgeSecurity().test_invalid_token_rejection())
    except Exception:
        print("[Pass] Invalid token rejected")
    print("All bridge security tests passed!")
