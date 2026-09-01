(function () {
  console.log("[YT Caption Bridge] Content script initialized");

  let currentVideoId = "";
  let captionTracks = [];
  let fetchedCaptions = []; // [{ startMs, endMs, text }]
  let isASR = false;
  let captionObserver = null;
  let videoElement = null;
  let lastHref = location.href;
  let pollInterval = null;

  // INJECT SCRIPT TO SPOOF VISIBILITY (Forces YouTube to render DOM captions in background tabs)
  const spoofScript = document.createElement('script');
  spoofScript.textContent = `
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  `;
  (document.head || document.documentElement).appendChild(spoofScript);
  spoofScript.remove();

  // SPA Navigation Detection
  window.addEventListener("yt-navigate-finish", () => {
    console.log("[YT Caption Bridge] yt-navigate-finish event detected");
    onVideoChange();
  });

  pollInterval = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      console.log("[YT Caption Bridge] URL change detected via polling");
      onVideoChange();
    }
    checkPlayStateAndAds();
  }, 1000);

  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  async function onVideoChange() {
    const videoId = getVideoId();
    if (!videoId) return;

    if (videoId === currentVideoId) return;
    currentVideoId = videoId;
    console.log(`[YT Caption Bridge] Video changed to ${currentVideoId}`);

    // Reset state
    captionTracks = [];
    fetchedCaptions = [];
    isASR = false;
    if (captionObserver) {
      captionObserver.disconnect();
      captionObserver = null;
    }

    // Strategy 1: TimedText primary
    const success = await tryFetchPlayerCaptions();
    if (!success) {
      console.log("[YT Caption Bridge] Primary TimedText fetch failed. Enabling DOM fallback Strategy 2");
      setupDOMObserver();
    }
  }

  async function tryFetchPlayerCaptions() {
    try {
      let playerResponse = null;

      // Try reading page context / movie_player API
      const moviePlayer = document.getElementById("movie_player");
      if (moviePlayer && typeof moviePlayer.getPlayerResponse === "function") {
        try {
          playerResponse = moviePlayer.getPlayerResponse();
        } catch (e) {}
      }

      if (!playerResponse || playerResponse?.videoDetails?.videoId !== currentVideoId) {
        // Fallback to fetch HTML and extract ytInitialPlayerResponse
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
        console.log("[YT Caption Bridge] No caption tracks in player response");
        return false;
      }

      captionTracks = tracks;
      // Prefer tracks matching page language or English or first non-auto track
      let selectedTrack = tracks.find(t => t.languageCode === "hi" || t.languageCode === "en") || tracks[0];
      isASR = selectedTrack.kind === "asr" || (selectedTrack.vssId && selectedTrack.vssId.startsWith("a."));

      const timedTextUrl = `${selectedTrack.baseUrl}&fmt=json3`;
      console.log(`[YT Caption Bridge] Fetching timedtext JSON3 from ${timedTextUrl}`);
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

        console.log(`[YT Caption Bridge] Strategy 1 success: Loaded ${fetchedCaptions.length} caption events`);
        startTimestampSyncLoop();
        return true;
      }
    } catch (e) {
      console.error("[YT Caption Bridge] TimedText fetch error:", e);
    }
    return false;
  }

  function startTimestampSyncLoop() {
    if (window._captionSyncTimer) {
      clearInterval(window._captionSyncTimer);
    }
    
    // Also use a video 'timeupdate' listener to bypass background tab throttling
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

    // Attach native media event (not throttled in background tabs)
    if (window._captionSyncHandler) {
      video.removeEventListener("timeupdate", window._captionSyncHandler);
    }
    window._captionSyncHandler = syncLogic;
    video.addEventListener("timeupdate", syncLogic);
    
    // Keep a slow interval just as a fallback in case timeupdate stalls
    window._captionSyncTimer = setInterval(syncLogic, 500);
  }

  // Strategy 2 Fallback: MutationObserver on .ytp-caption-segment + active polling
  function setupDOMObserver() {
    console.log("[YT Caption Bridge] Setting up Strategy 2 (DOM Observer & Poller)");

    let lastText = "";
    const checkCaptions = () => {
      const segments = document.querySelectorAll(".ytp-caption-segment");
      if (segments && segments.length > 0) {
        const fullText = Array.from(segments).map(s => s.textContent).join(" ").replace(/\s+/g, " ").trim();
        if (fullText && fullText !== lastText) {
          lastText = fullText;
          console.log("[YT Caption Bridge DOM]:", fullText);
          sendCaptionUpdate(fullText, null, null);
        }
      }
    };

    if (window._domCapTimer) clearInterval(window._domCapTimer);
    window._domCapTimer = setInterval(checkCaptions, 200);

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

    chrome.runtime.sendMessage({
      type: "play_state",
      is_playing: !isPaused && !isAd,
      is_ad: !!isAd,
      sent_at: Date.now()
    });
  }

  function sendNoCaptionsState() {
    chrome.runtime.sendMessage({
      type: "no_captions",
      video_id: currentVideoId,
      sent_at: Date.now()
    });
  }

  function sendCaptionUpdate(rawText, startMs, endMs) {
    // Edge case: Filter bracketed non-lyric tags [Music], [Applause] or flag them
    const isBracketTag = /^\[.+\]$/.test(rawText.trim());

    chrome.runtime.sendMessage({
      type: "caption_update",
      text: rawText,
      start_ms: startMs,
      end_ms: endMs,
      is_asr: isASR,
      is_tag: isBracketTag,
      sent_at: Date.now()
    });
  }

  // Initial trigger
  onVideoChange();
})();
