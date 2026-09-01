import asyncio
import websockets
import json

async def test():
    uri = "ws://127.0.0.1:48123/?token=6b525ec81e87c7c627f54b564b5b925e"
    async with websockets.connect(uri, additional_headers={"Origin": "chrome-extension://dummy"}) as ws:
        await ws.send(json.dumps({
            "type": "caption_update",
            "text": "Hello! The bridge is working perfectly!",
            "is_asr": False,
            "is_tag": False,
            "sent_at": 1000
        }))
        print("Test payload sent successfully.")

if __name__ == "__main__":
    asyncio.run(test())
