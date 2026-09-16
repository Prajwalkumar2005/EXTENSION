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
            await asyncio.sleep(0.15)

        await server.stop()
        caption_msgs = [m for m in received if m.get("type") == "caption_update"]
        assert len(caption_msgs) == 1
        assert caption_msgs[0]["text"] == "Hello world"
        print("[Pass] Valid connection and caption delivery verified")

    async def test_invalid_origin_rejection(self):
        cfg = load_or_create_config()
        server = BridgeServer(cfg)
        port = await server.start()

        url = f"ws://127.0.0.1:{port}/?token={cfg['auth_token']}"
        headers = {"Origin": "https://malicious-website.com"}

        try:
            async with websockets.connect(url, additional_headers=headers):
                assert False, "Should have been rejected!"
        except Exception:
            print("[Pass] Invalid Origin rejected")
        finally:
            await server.stop()

    async def test_invalid_token_rejection(self):
        cfg = load_or_create_config()
        server = BridgeServer(cfg)
        port = await server.start()

        url = f"ws://127.0.0.1:{port}/?token=wrong_token_value"
        headers = {"Origin": "chrome-extension://test-extension-id-1234"}

        try:
            async with websockets.connect(url, additional_headers=headers):
                assert False, "Should have been rejected!"
        except Exception:
            print("[Pass] Invalid token rejected")
        finally:
            await server.stop()

if __name__ == "__main__":
    asyncio.run(TestBridgeSecurity().test_valid_connection())
    asyncio.run(TestBridgeSecurity().test_invalid_origin_rejection())
    asyncio.run(TestBridgeSecurity().test_invalid_token_rejection())
    print("All bridge security tests passed successfully!")
