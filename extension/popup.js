// YouTube Desktop Lyrics Overlay - Popup Controller
document.addEventListener("DOMContentLoaded", async () => {
  const tokenInput = document.getElementById("token");
  const saveBtn = document.getElementById("save-token");
  const testBtn = document.getElementById("test-btn");
  const statusMsg = document.getElementById("status");
  const statusBadge = document.getElementById("status-badge");
  const badgeText = document.getElementById("badge-text");
  const styleSelect = document.getElementById("style-select");
  const sizeSlider = document.getElementById("size-slider");
  const sizeVal = document.getElementById("size-val");

  const DEFAULT_TOKEN = "6b525ec81e87c7c627f54b564b5b925e";

  // Load stored preferences
  const stored = await chrome.storage.local.get(["auth_token", "text_style", "font_size"]);
  tokenInput.value = stored.auth_token || DEFAULT_TOKEN;

  if (stored.text_style) {
    styleSelect.value = stored.text_style;
  }
  if (stored.font_size) {
    sizeSlider.value = stored.font_size;
    sizeVal.textContent = stored.font_size + "px";
  }

  function showMessage(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.style.color = isError ? "#ff6b6b" : "#40c057";
    statusMsg.classList.add("visible");
    setTimeout(() => {
      statusMsg.classList.remove("visible");
    }, 3000);
  }

  function updateStatusIndicator() {
    chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        statusBadge.className = "status-badge offline";
        badgeText.textContent = "Offline";
        return;
      }

      if (res.isConnected) {
        statusBadge.className = "status-badge connected";
        badgeText.textContent = `Online (Port ${res.port})`;
      } else if (res.isConnecting) {
        statusBadge.className = "status-badge";
        badgeText.textContent = "Connecting...";
      } else {
        statusBadge.className = "status-badge offline";
        badgeText.textContent = "Disconnected";
      }
    });
  }

  // Initial check and periodic polling while popup remains open
  updateStatusIndicator();
  const statusInterval = setInterval(updateStatusIndicator, 1500);
  window.addEventListener("unload", () => clearInterval(statusInterval));

  // Connect / Save Token
  saveBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    if (!token) {
      showMessage("Please enter a pairing token!", true);
      return;
    }

    statusBadge.className = "status-badge";
    badgeText.textContent = "Connecting...";
    showMessage("Pairing with desktop overlay...");

    chrome.runtime.sendMessage({ type: "set_token", token: token }, () => {
      setTimeout(() => {
        updateStatusIndicator();
        chrome.runtime.sendMessage({ type: "get_status" }, (res) => {
          if (res && res.isConnected) {
            showMessage(`🟢 Connected to Port ${res.port}!`);
          } else {
            showMessage("Reconnecting to overlay...");
          }
        });
      }, 600);
    });
  });

  // Send Test Caption
  testBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "caption_update",
      text: "🎵 Bridge Connected! Live Lyrics Ready.",
      is_asr: false,
      is_tag: false,
      sent_at: Date.now()
    });
    showMessage("Test caption sent to desktop!");
  });

  // Synchronize visual styles and font size
  function dispatchConfigUpdate() {
    const newStyle = styleSelect.value;
    const newSize = parseInt(sizeSlider.value, 10);
    sizeVal.textContent = newSize + "px";

    chrome.storage.local.set({
      text_style: newStyle,
      font_size: newSize
    });

    chrome.runtime.sendMessage({
      type: "config_update",
      text_style: newStyle,
      font_size: newSize,
      sent_at: Date.now()
    });
  }

  styleSelect.addEventListener("change", dispatchConfigUpdate);
  sizeSlider.addEventListener("input", dispatchConfigUpdate);
});
