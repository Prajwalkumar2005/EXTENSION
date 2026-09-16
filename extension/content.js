// YouTube Desktop Lyrics Overlay - Live Caption Bridge
(function () {
  console.log("[YT Lyrics Bridge] Content script initialized");

  let currentVideoId = "";
  let captionTracks = [];
  let fetchedCaptions = [];
  let isASR = false;
  let captionObserver = null;
  let videoElement = null;
  let lastHref = location.href;
  let pollInterval = null;

  // Spoof visibility to keep YouTube caption render active even when tab is backgrounded
  try {
    const spoofScript = document.createElement("script");
    spoofScript.textContent = `
      try {
        Object.defineProperty(document, 'hidden', { get: () => false });
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      } catch (e) {}
    `;
    (document.head || document.documentElement).appendChild(spoofScript);
    spoofScript.remove();
  } catch (e) {}

  // Detect YouTube SPA navigation events
  window.addEventListener("yt-navigate-finish", () => {
    onVideoChange();
  });

  // Watch URL changes & monitor playback state
  pollInterval = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      onVideoChange();
    }
    checkPlayStateAndAds();
  }, 1000);

  function getVideoId() {
    const pathname = window.location.pathname;
    if (pathname.startsWith("/shorts/")) {
      return pathname.split("/shorts/")[1].split("/")[0].split("?")[0];
    }
    if (pathname.startsWith("/live/")) {
      return pathname.split("/live/")[1].split("/")[0].split("?")[0];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  async function onVideoChange() {
    const videoId = getVideoId();
    if (!videoId) return;

    if (videoId === currentVideoId) return;
    currentVideoId = videoId;
    console.log(`[YT Lyrics Bridge] Video loaded: ${currentVideoId}`);

    // Reset state
    captionTracks = [];
    fetchedCaptions = [];
    isASR = false;
    if (captionObserver) {
      captionObserver.disconnect();
      captionObserver = null;
    }

    // Always enable live DOM observer so on-screen CC is immediately mirrored
    setupDOMObserver();

    // Also fetch TimedText JSON for sub-second precision whenever available
    tryFetchPlayerCaptions();
  }

  async function tryFetchPlayerCaptions() {
    try {
      let playerResponse = null;

      const moviePlayer = document.getElementById("movie_player");
      if (moviePlayer && typeof moviePlayer.getPlayerResponse === "function") {
        try {
          playerResponse = moviePlayer.getPlayerResponse();
        } catch (e) {}
      }

      if (!playerResponse || playerResponse?.videoDetails?.videoId !== currentVideoId) {
        const res = await fetch(window.location.href);
        const html = await res.text();
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var\s|script)/s);
        if (match) {
          try {
            playerResponse = JSON.parse(match[1]);
          } catch (e) {}
        }
      }

      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks || tracks.length === 0) {
        return false;
      }

      captionTracks = tracks;
      let selectedTrack = tracks.find(t => t.languageCode === "en" || t.languageCode === "hi") || tracks[0];
      isASR = selectedTrack.kind === "asr" || (selectedTrack.vssId && selectedTrack.vssId.startsWith("a."));

      const timedTextUrl = `${selectedTrack.baseUrl}&fmt=json3`;
      const captionRes = await fetch(timedTextUrl);
      const data = await captionRes.json();

      if (data.events) {
        fetchedCaptions = [];
        data.events.forEach(evt => {
          if (!evt.segs) return;
          const text = evt.segs.map(s => s.utf8).join("").replace(/\n/g, " ").trim();
          if (!text) return;

          const startMs = evt.tStartMs;
          const durationMs = evt.dDurationMs || 3000;
          const endMs = startMs + durationMs;

          fetchedCaptions.push({ startMs, endMs, text });
        });

        startTimestampSyncLoop();
        return true;
      }
    } catch (e) {
      console.warn("[YT Lyrics Bridge] TimedText fetch note:", e.message);
    }
    return false;
  }

  function startTimestampSyncLoop() {
    if (window._captionSyncTimer) {
      clearInterval(window._captionSyncTimer);
    }

    const video = document.querySelector("video");
    if (!video) return;

    let lastSentText = "";

    const syncLogic = () => {
      if (video.paused) return;
      const currentTimeMs = video.currentTime * 1000;
      const currentCap = fetchedCaptions.find(c => currentTimeMs >= c.startMs && currentTimeMs <= c.endMs);

      if (currentCap && currentCap.text !== lastSentText) {
        lastSentText = currentCap.text;
        sendCaptionUpdate(currentCap.text, currentCap.startMs, currentCap.endMs);
      }
    };

    if (window._captionSyncHandler) {
      video.removeEventListener("timeupdate", window._captionSyncHandler);
    }
    window._captionSyncHandler = syncLogic;
    video.addEventListener("timeupdate", syncLogic);
    window._captionSyncTimer = setInterval(syncLogic, 400);
  }

  // Live DOM observer on YouTube CC elements (.ytp-caption-segment)
  function setupDOMObserver() {
    let lastText = "";
    const checkCaptions = () => {
      const segments = document.querySelectorAll(".ytp-caption-segment");
      if (segments && segments.length > 0) {
        const fullText = Array.from(segments).map(s => s.textContent).join(" ").replace(/\s+/g, " ").trim();
        if (fullText && fullText !== lastText) {
          lastText = fullText;
          sendCaptionUpdate(fullText, null, null);
        }
      }
    };

    if (window._domCapTimer) clearInterval(window._domCapTimer);
    window._domCapTimer = setInterval(checkCaptions, 180);

    const targetNode = document.querySelector(".html5-video-player") || document.body;
    if (captionObserver) captionObserver.disconnect();
    captionObserver = new MutationObserver(checkCaptions);
    captionObserver.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function checkPlayStateAndAds() {
    const player = document.querySelector(".html5-video-player");
    const isAd = player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting");
    videoElement = document.querySelector("video");
    const isPaused = videoElement ? videoElement.paused : true;

    safeSendMessage({
      type: "play_state",
      is_playing: !isPaused && !isAd,
      is_ad: !!isAd,
      sent_at: Date.now()
    });
  }

  function sendCaptionUpdate(rawText, startMs, endMs) {
    const isBracketTag = /^\[.+\]$/.test(rawText.trim());

    safeSendMessage({
      type: "caption_update",
      text: rawText,
      start_ms: startMs,
      end_ms: endMs,
      is_asr: isASR,
      is_tag: isBracketTag,
      sent_at: Date.now()
    });
  }

  function safeSendMessage(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        if (chrome.runtime.lastError) {
          // Extension reloaded or idle
        }
      });
    } catch (e) {}
  }

  // Initial trigger
  onVideoChange();
})();
