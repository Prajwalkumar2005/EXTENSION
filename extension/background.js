// YouTube Desktop Lyrics Overlay - Background Service Worker
const PORTS = [48123, 48124, 48125, 48126, 48127, 48128];
const DEFAULT_AUTH_TOKEN = "6b525ec81e87c7c627f54b564b5b925e";

let ws = null;
let currentPortIndex = 0;
let isConnected = false;
let isConnecting = false;
let authToken = "";
let messageQueue = [];
let retryTimer = null;
let consecutiveFailuresOnPort = 0;

// Setup persistent reconnect alarm every 15 seconds
chrome.alarms.create("ws_reconnect_check", { periodInMinutes: 0.25 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ws_reconnect_check") {
    if (!isConnected && !isConnecting) {
      connectWebSocket();
    }
  }
});

async function getAuthToken() {
  const result = await chrome.storage.local.get(["auth_token"]);
  if (result.auth_token) {
    authToken = result.auth_token;
  } else {
    // Provide zero-config default pairing token for instant plug-and-play
    authToken = DEFAULT_AUTH_TOKEN;
    await chrome.storage.local.set({ auth_token: DEFAULT_AUTH_TOKEN });
  }
  return authToken;
}

async function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }
  if (isConnecting) return;
  isConnecting = true;

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  await getAuthToken();

  if (!authToken) {
    isConnecting = false;
    return;
  }

  const port = PORTS[currentPortIndex];
  const url = `ws://127.0.0.1:${port}/?token=${encodeURIComponent(authToken)}`;

  console.log(`[Lyrics Bridge] Connecting to ${url}...`);
  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.warn(`[Lyrics Bridge] WebSocket constructor error:`, e);
    isConnecting = false;
    scheduleReconnect(true);
    return;
  }

  ws.onopen = () => {
    console.log(`[Lyrics Bridge] Connected to overlay on port ${port}`);
    isConnected = true;
    isConnecting = false;
    consecutiveFailuresOnPort = 0;

    // Send initial handshake ping
    try {
      ws.send(JSON.stringify({ type: "ping", sent_at: Date.now() }));
    } catch (e) {}

    // Flush any queued caption/state messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      try {
        ws.send(JSON.stringify(msg));
      } catch (e) {}
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log("[Lyrics Bridge] Received:", msg);
    } catch (e) {}
  };

  ws.onerror = () => {
    // Expected when scanning ports while overlay is starting
  };

  ws.onclose = () => {
    isConnected = false;
    isConnecting = false;
    ws = null;

    consecutiveFailuresOnPort++;
    // If current port fails multiple times, cycle to the next candidate port
    const shouldRotate = consecutiveFailuresOnPort >= 2;
    if (shouldRotate) {
      currentPortIndex = (currentPortIndex + 1) % PORTS.length;
      consecutiveFailuresOnPort = 0;
      console.log(`[Lyrics Bridge] Trying fallback port ${PORTS[currentPortIndex]}...`);
    }

    scheduleReconnect(false);
  };
}

function scheduleReconnect(immediate = false) {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = immediate ? 150 : 1200;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectWebSocket();
  }, delay);
}

// Runtime message dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "set_token") {
    authToken = message.token || DEFAULT_AUTH_TOKEN;
    chrome.storage.local.set({ auth_token: authToken });
    currentPortIndex = 0; // Reset to primary port
    consecutiveFailuresOnPort = 0;

    // Cleanly close existing connection without port rotation
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      ws = null;
    }
    isConnected = false;
    isConnecting = false;

    connectWebSocket();
    sendResponse({ status: "ok" });
    return true;
  }

  if (message.type === "get_status") {
    sendResponse({
      isConnected: ws !== null && ws.readyState === WebSocket.OPEN,
      isConnecting: isConnecting || (ws !== null && ws.readyState === WebSocket.CONNECTING),
      port: PORTS[currentPortIndex],
      hasToken: Boolean(authToken)
    });
    return true;
  }

  // Forward captions, playback state, and config changes to desktop overlay
  sendToOverlay(message);
  sendResponse({ status: "forwarded" });
  return true;
});

function sendToOverlay(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch (e) {
      console.error("[Lyrics Bridge] Failed to send payload:", e);
    }
  } else {
    // Buffer last 50 messages during connection gaps
    if (messageQueue.length < 50) {
      messageQueue.push(payload);
    }
    if (!isConnecting && !isConnected) {
      connectWebSocket();
    }
  }
}

// Immediate initial connection on worker start
connectWebSocket();
