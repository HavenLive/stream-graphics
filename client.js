// ====== CONFIG ======
const API_KEY = "anzsj3jqsm";
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const DEBUG_WS_URL = "http://localhost:3000";
const FALLBACK_MATCH_ID = 685565;

// ====== URL PARAMS / ENV ======
const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug");
const matchId = urlParams.get("id") || FALLBACK_MATCH_ID;

// ====== DOM: SCOREBUG ======
const scorebugEl = document.getElementById("scorebug");

const home = {
  name: document.getElementById("home-team"),
  score: document.getElementById("home-score"),
  periodScore: document.getElementById("home-period-score"),
  serving: document.getElementById("home-serving"),
};

const away = {
  name: document.getElementById("away-team"),
  score: document.getElementById("away-score"),
  periodScore: document.getElementById("away-period-score"),
  serving: document.getElementById("away-serving"),
};

// ====== DOM: LOWER THIRD ======
const lower3rdEl = document.getElementById("lower3rd");
const lower3rdMessage = lower3rdEl
  ? lower3rdEl.querySelector(".message")
  : null;
const lower3rdHome = lower3rdEl
  ? lower3rdEl.querySelector(".home-team")
  : null;
const lower3rdAway = lower3rdEl
  ? lower3rdEl.querySelector(".away-team")
  : null;
const lower3rdScore = lower3rdEl ? lower3rdEl.querySelector(".score") : null;

let lower3rdEnabled = !!lower3rdEl;

let prevTimeoutsA = 0;
let prevTimeoutsB = 0;
let timeoutBannerActive = false;
let timeoutBannerTeam = null;
let timeoutBannerExpiry = 0;
const TIMEOUT_BANNER_DURATION = 30000; // 30 sek

// ====== HELPERS ======
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeUpper(str) {
  if (!str) return "";
  return String(str).toUpperCase();
}

function updateServeIndicator(teamAHasServe) {
  if (!home.serving || !away.serving) return;

  if (teamAHasServe === null || teamAHasServe === undefined) {
    home.serving.classList.add("hide");
    away.serving.classList.add("hide");
    return;
  }

  if (teamAHasServe) {
    home.serving.classList.remove("hide");
    away.serving.classList.add("hide");
  } else {
    home.serving.classList.add("hide");
    away.serving.classList.remove("hide");
  }
}

function getCurrentSet(match) {
  return num(match.set_index);
}

function getSetsWon(match) {
  return {
    A: num(match.sets_A),
    B: num(match.sets_B),
  };
}

function getSetScores(match) {
  return {
    A: num(match.score_A),
    B: num(match.score_B),
  };
}

function getServeSide(match) {
  const serve = match.serve; // "A", "B" tai null
  if (serve === "A") return "A";
  if (serve === "B") return "B";
  return null;
}

function isTimeoutOngoing(match) {
  // Torneopal: aikalisä käynnissä, jos jokin näistä flaggeista tms.
  // Tässä esimerkissä katsotaan vain live_timeouts_* countereita bannerin triggaamiseen,
  // ja käytetään erillistä timeoutBannerActive -flägiä näyttöön.
  return timeoutBannerActive && Date.now() < timeoutBannerExpiry;
}

function formatTimeoutMessage(match) {
  if (!timeoutBannerActive || !timeoutBannerTeam) return "ERÄTAUKO";

  const teamName =
    timeoutBannerTeam === "A" ? match.team_A_name : match.team_B_name;

  if (!teamName) return "AIKALISÄ";

  return `AIKALISÄ – ${safeUpper(teamName)}`;
}

function updateLowerThirdTimeout(match) {
  if (!lower3rdEl || !lower3rdMessage) return;

  if (!isTimeoutOngoing(match)) {
    timeoutBannerActive = false;
    timeoutBannerTeam = null;
    timeoutBannerExpiry = 0;
    return;
  }

  const message = formatTimeoutMessage(match);
  lower3rdMessage.textContent = message;

  // Aikalisätilassa käytetään tiiviimpää layoutia (CSS-luokka)
  lower3rdEl.classList.add("timeout-mode");
}

function clearLowerThirdTimeoutMode() {
  if (!lower3rdEl || !lower3rdMessage) return;
  lower3rdEl.classList.remove("timeout-mode");
  lower3rdMessage.textContent = "ERÄTAUKO";
}

// ====== FETCH & WS ======
async function fetchMatchData(id) {
  const url = TORNEO_API_BASE + encodeURIComponent(id);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("HTTP error", res.status);
      return null;
    }
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("fetchMatchData error", err);
    return null;
  }
}

let ws = null;
let reconnectTimeout = null;
let reconnectAttempts = 5;
let data = { match: null };

function connectWebsocket() {
  if (!matchId || debug) {
    return;
  }

  const wsUrl = `${TORNEO_WS_URL}${matchId}`;

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error("WebSocket init error", err);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("WS connected");
    reconnectAttempts = 5;
  });

  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.match) {
        data.match = msg.match;
        setGraphics(msg.match);
      }
    } catch (err) {
      console.error("WS message parse failed", err);
    }
  });

  ws.addEventListener("close", () => {
    console.warn("WS closed");
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("WS error", err);
    if (ws) {
      ws.close();
    }
  });
}

function scheduleReconnect() {
  if (reconnectAttempts <= 0) {
    console.warn("WS: no reconnect attempts left");
    return;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectTimeout = setTimeout(() => {
    console.warn(
      `WS: Connection lost. Reconnecting in 5s... (${reconnectAttempts} left)`
    );
    reconnectAttempts--;
    connectWebsocket();
  }, 5000);
}

// ====== RENDER ======
function setGraphics(match) {
  if (!match) return;

  // --- aikalisä tunnistus (counter kasvaa) ---
  const currentTimeoutsA = num(match.live_timeouts_A);
  const currentTimeoutsB = num(match.live_timeouts_B);

  if (currentTimeoutsA > prevTimeoutsA) {
    timeoutBannerActive = true;
    timeoutBannerTeam = "A";
    timeoutBannerExpiry = Date.now() + TIMEOUT_BANNER_DURATION;
  } else if (currentTimeoutsB > prevTimeoutsB) {
    time
