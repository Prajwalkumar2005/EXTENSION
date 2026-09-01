document.addEventListener("DOMContentLoaded", async () => {
  const tokenInput = document.getElementById("token");
  const saveBtn = document.getElementById("save-token");
  const statusDiv = document.getElementById("status");

  const styleSelect = document.getElementById("style-select");
  const sizeSlider = document.getElementById("size-slider");
  const sizeVal = document.getElementById("size-val");

  const DEFAULT_TOKEN = "6b525ec81e87c7c627f54b564b5b925e";

  // Load saved config
  const stored = await chrome.storage.local.get(["auth_token", "text_style", "font_size"]);
  
  if (stored.auth_token) {
    tokenInput.value = stored.auth_token;
  } else {
    // Automatically set default token for non-technical users
    tokenInput.value = DEFAULT_TOKEN;
    chrome.storage.local.set({ auth_token: DEFAULT_TOKEN });
    chrome.runtime.sendMessage({ type: "set_token", token: DEFAULT_TOKEN }, () => {});
  }
  
  if (stored.text_style) {
    styleSelect.value = stored.text_style;
  }
  if (stored.font_size) {
    sizeSlider.value = stored.font_size;
    sizeVal.textContent = stored.font_size + "px";
  }

  function showStatus(text) {
    statusDiv.textContent = text;
    statusDiv.classList.add("visible");
    setTimeout(() => {
      statusDiv.classList.remove("visible");
    }, 2000);
  }

  // Token Save
  saveBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    if (token) {
      chrome.runtime.sendMessage({ type: "set_token", token: token }, (response) => {
        showStatus("Bridge connected!");
      });
    }
  });

  // Config Update
  function updateConfig() {
    const newStyle = styleSelect.value;
    const newSize = parseInt(sizeSlider.value, 10);
    
    // Save locally
    chrome.storage.local.set({ text_style: newStyle, font_size: newSize });

    // Send to bridge
    chrome.runtime.sendMessage({
      type: "config_update",
      text_style: newStyle,
      font_size: newSize
    });
  }

  styleSelect.addEventListener("change", updateConfig);
  
  sizeSlider.addEventListener("input", (e) => {
    sizeVal.textContent = e.target.value + "px";
  });
  
  sizeSlider.addEventListener("change", updateConfig);
});
