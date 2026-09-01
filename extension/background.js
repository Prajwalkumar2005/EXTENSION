const PORTS = [48123, 48124, 48125, 48126, 48127, 48128];
let ws = null;
let currentPortIndex = 0;
let isConnected = false;
let authToken = "";

// Alarm setup for persistent reconnect check
chrome.alarms.create("ws_reconnect_check", { periodInMinutes: 0.25 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ws_reconnect_check") {
    if (!isConnected) {
      connectWebSocket();
    }
  }
});

let isConnecting = false;
let messageQueue = [];

async function getAuthToken() {
  const result = await chrome.storage.local.get(["auth_token"]);
  if (result.auth_token) {
    authToken = result.auth_token;
  }
  return authToken;
}

async function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }
  if (isConnecting) return;
  isConnecting = true;

  await getAuthToken();

  // If token is missing, do not attempt to connect (wait for user to save token)
  if (!authToken) {
    isConnecting = false;
    return;
  }

  // Always prefer the primary port unless we explicitly failed it in this rapid cycle
  const port = PORTS[currentPortIndex];
  const url = `ws://127.0.0.1:${port}/?token=${encodeURIComponent(authToken)}`;

  console.log(`[ServiceWorker] Connecting to ${url}...`);
  try {
    ws = new WebSocket(url);
  } catch (e) {
    isConnecting = false;
    return;
  }

  ws.onopen = () => {
    console.log(`[ServiceWorker] Connected to overlay on port ${port}`);
    isConnected = true;
    isConnecting = false;
    
    // Flush queue
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      ws.send(JSON.stringify(msg));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log("[ServiceWorker] Received:", msg);
    } catch (e) {}
  };

  ws.onerror = (err) => {
    console.log(`[ServiceWorker] WebSocket error on port ${port}`);
  };

  ws.onclose = () => {
    isConnected = false;
    isConnecting = false;
    ws = null;
    
    // Immediately try next port, but if we've cycled through all, wait a bit
    currentPortIndex = (currentPortIndex + 1) % PORTS.length;
    console.log(`[ServiceWorker] Disconnected. Will retry port ${PORTS[currentPortIndex]}`);
    
    // Auto-reconnect quickly on next port to find the active server
    if (messageQueue.length > 0) {
      setTimeout(connectWebSocket, 100);
    }
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "set_token") {
    authToken = message.token;
    chrome.storage.local.set({ auth_token: message.token });
    currentPortIndex = 0; // Reset to primary port
    if (ws) ws.close();
    connectWebSocket();
    sendResponse({ status: "ok" });
    return true;
  }

  // Forward all other messages (captions, play state)
  sendToOverlay(message);
});

function sendToOverlay(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    // Queue and connect
    if (messageQueue.length < 50) {
      messageQueue.push(payload);
    }
    connectWebSocket();
  }
}

connectWebSocket();
