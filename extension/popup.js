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
  const colorPicker = document.getElementById("color-picker");
  const colorVal = document.getElementById("color-val");
  const prevLine1 = document.getElementById("prev-line1");
  const prevLine2 = document.getElementById("prev-line2");

  const DEFAULT_TOKEN = "6b525ec81e87c7c627f54b564b5b925e";

  // Load stored preferences
  const stored = await chrome.storage.local.get(["auth_token", "text_style", "font_size", "highlight_color"]);
  tokenInput.value = stored.auth_token || DEFAULT_TOKEN;

  if (stored.text_style) {
    styleSelect.value = stored.text_style;
  }
  if (stored.font_size) {
    sizeSlider.value = stored.font_size;
    sizeVal.textContent = stored.font_size + "px";
  }
  if (stored.highlight_color) {
    colorPicker.value = stored.highlight_color;
    colorVal.textContent = stored.highlight_color;
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

  function updatePreviewBox() {
    const style = styleSelect.value;
    const color = colorPicker.value;
    colorVal.textContent = color.toUpperCase();

    prevLine1.style.fontFamily = "inherit";
    prevLine1.style.textShadow = "none";
    prevLine1.style.color = "#FFFFFF";
    prevLine2.style.fontFamily = "inherit";
    prevLine2.style.textShadow = "none";
    prevLine2.style.color = "#CCCCCC";

    if (style === "poster") {
      prevLine1.style.fontFamily = "Impact, sans-serif";
      prevLine1.style.color = color || "#FBC02D";
      prevLine1.style.textShadow = "0 0 6px rgba(255, 0, 0, 0.6)";
      prevLine2.style.fontFamily = "Impact, sans-serif";
      prevLine2.style.color = "#FFFFFF";
      prevLine2.style.textShadow = "0 0 4px rgba(255, 0, 0, 0.4)";
    } else if (style === "neon") {
      prevLine1.style.color = "#00FFFF";
      prevLine1.style.textShadow = "0 0 8px #FF00FF, 0 0 14px #FF00FF";
      prevLine2.style.color = "#FFFFFF";
      prevLine2.style.textShadow = "0 0 6px #FF00FF";
    } else if (style === "cyberpunk") {
      prevLine1.style.fontFamily = "Courier New, monospace";
      prevLine1.style.color = "#00FFFF";
      prevLine1.style.textShadow = "1px 1px 0 #FF00FF";
      prevLine2.style.fontFamily = "Courier New, monospace";
      prevLine2.style.color = "#FF00FF";
    } else if (style === "gold") {
      prevLine1.style.fontFamily = "Georgia, serif";
      prevLine1.style.color = "#FFDF00";
      prevLine1.style.textShadow = "0 0 4px #B8860B";
      prevLine2.style.fontFamily = "Georgia, serif";
      prevLine2.style.color = "#FFF8DC";
    } else if (style === "hacker") {
      prevLine1.style.fontFamily = "Consolas, monospace";
      prevLine1.style.color = "#00FF00";
      prevLine1.style.textShadow = "0 0 6px #00FF00";
      prevLine2.style.fontFamily = "Consolas, monospace";
      prevLine2.style.color = "#76FF03";
    } else if (style === "blood") {
      prevLine1.style.fontFamily = "Impact, sans-serif";
      prevLine1.style.color = "#FF0000";
      prevLine1.style.textShadow = "0 0 6px #8B0000";
      prevLine2.style.fontFamily = "Impact, sans-serif";
      prevLine2.style.color = "#FF8080";
    } else if (style === "ocean") {
      prevLine1.style.color = "#00BFFF";
      prevLine1.style.textShadow = "0 0 4px #00008B";
      prevLine2.style.color = "#E0F7FA";
    } else if (style === "sunset") {
      prevLine1.style.color = "#FF4500";
      prevLine1.style.textShadow = "0 0 6px #800080";
      prevLine2.style.color = "#FFD180";
    } else if (style === "vaporwave") {
      prevLine1.style.color = "#FF66FF";
      prevLine1.style.textShadow = "1px 1px 0 #00FFFF";
      prevLine2.style.color = "#E1BEE7";
    } else if (style === "classic") {
      prevLine1.style.color = color || "#FFD700";
      prevLine1.style.textShadow = "1px 1px 2px #000";
      prevLine2.style.color = color || "#FFD700";
    }
  }

  // Initial preview render
  updatePreviewBox();

  // Synchronize visual styles and font size
  function dispatchConfigUpdate() {
    const newStyle = styleSelect.value;
    const newSize = parseInt(sizeSlider.value, 10);
    const newColor = colorPicker.value;
    sizeVal.textContent = newSize + "px";

    updatePreviewBox();

    chrome.storage.local.set({
      text_style: newStyle,
      font_size: newSize,
      highlight_color: newColor
    });

    chrome.runtime.sendMessage({
      type: "config_update",
      text_style: newStyle,
      font_size: newSize,
      highlight_color: newColor,
      sent_at: Date.now()
    });
  }

  styleSelect.addEventListener("change", dispatchConfigUpdate);
  sizeSlider.addEventListener("input", dispatchConfigUpdate);
  colorPicker.addEventListener("input", dispatchConfigUpdate);
});
