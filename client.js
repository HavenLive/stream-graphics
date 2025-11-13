// Volleyball graphics controller with keyboard shortcuts
// Scorebug toggle: CTRL + SHIFT + ALT + A
// Lower 3rd toggle: CTRL + SHIFT + ALT + B

// ====== CONFIG ======
const API_KEY = "anzsj3jqsm";
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const DEBUG_WS_URL = "ws://localhost:3000";
const FALLBACK_MATCH_ID = 685565;

// ====== URL PARAMS / ENV ======
const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug");
const matchId = urlParams.get("id") || FALLBACK_MATCH_ID;

// ====== DOM ELEMENTS ======
const scorebugEl = document.getElementById("scorebug");

const home = {
  name: document.getElementById("home-team"),
  score: document.getElementById("home-score"),
  sets: document.getElementById("home-period-score"),
  serve: document.getElementById("home-serving"),
};

const away = {
  name: document.getElementById("away-team"),
  score: document.getElementById("away-score"),
  sets: document.getElementById("away-period-score"),
  serve: document.getElementById("away-serving"),
};

const lower3rdEl = document.getElementById("lower3rd");
const lower3rdMessageEl = lower3rdEl
  ? lower3rdEl.querySelector(".message")
  : null;
const lower3rdHomeEl = lower3rdEl
  ? lower3rdEl.querySelector(".home-team")
  : null;
const lower3rdAwayEl = lower3rdEl
  ? lower3rdEl.querySelector(".away-team")
  : null;
const lower3rdScoreEl = lower3rdEl
  ? lower3rdEl.querySelector(".score")
  : null;

const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

// ====== STATE ======
let latestMatch = null;
let scorebugVisible = true;
let lower3rdVisible = true;
let ws = null;
let reconnectTimeout = null;

// ====== HELPERS ======
function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function upper(str) {
  if (!str) return "";
  return String(str).toUpperCase();
}

function setServeIndicator(serveSide) {
  if (!home.serve || !away.serve) return;

  // piilota molemmat oletuksena
  home.serve.classList.add("hide");
  away.serve.classList.add("hide");

  if (serveSide === "A") {
    home.serve.classList.remove("hide");
  } else if (serveSide === "B") {
    away.serve.classList.remove("hide");
  }
}

// ====== RENDERING ======
function renderMatch(match) {
  if (!match) return;

  latestMatch = match;

  // Joukkueiden nimet
  if (home.name) home.name.textContent = upper(match.team_A_name);
  if (away.name) away.name.textContent = upper(match.team_B_name);

  // Erän pisteet
  if (home.score) home.score.textContent = toNumber(match.score_A);
  if (away.score) away.score.textContent = toNumber(match.score_B);

  // Voitetut erät
  if (home.sets) home.sets.textContent = toNumber(match.sets_A);
  if (away.sets) away.sets.textContent = toNumber(match.sets_B);

  // Syöttäjä ("A" / "B" / null)
  setServeIndicator(match.serve);

  // Lower 3rd
  if (lower3rdEl) {
    if (lower3rdHomeEl) lower3rdHomeEl.textContent = match.team_A_name || "";
    if (lower3rdAwayEl) lower3rdAwayEl.textContent = match.team_B_name || "";

    if (lower3rdScoreEl) {
      const scoreText = `${toNumber(match.score_A)} - ${toNumber(
        match.score_B
      )}`;
      lower3rdScoreEl.textContent = scoreText;
    }

    if (lower3rdMessageEl && !lower3rdMessageEl.textContent.trim()) {
      // oletusviesti jos tyhjä
      lower3rdMessageEl.textContent = "ERÄTAUKO";
    }

    if (lower3rdVisible) {
      lower3rdEl.classList.add("in");
    } else {
      lower3rdEl.classList.remove("in");
    }
  }
}

// ====== DATA FETCHING ======
async function fetchMatchOnce(id) {
  const url = TORNEO_API_BASE + encodeURIComponent(id);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("HTTP error", res.status);
      return null;
    }
    const json = await res.json();
    // API voi palauttaa joko pelkän matsin tai { match: {...} }
    return json.match || json;
  } catch (err) {
    console.error("fetchMatchOnce failed", err);
    return null;
  }
}

// ====== WEBSOCKET ======
function connectWebSocket() {
  if (!("WebSocket" in window)) {
    console.warn("WebSocket ei tuettu – käytetään vain pollingia");
    return;
  }

  const url = debug ? DEBUG_WS_URL : `${TORNEO_WS_URL}${matchId}`;

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.error("WebSocket init error", err);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("WebSocket connected");
  });

  ws.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      const match = payload.match || payload;
      renderMatch(match);
    } catch (err) {
      console.error("WebSocket message parse failed", err);
    }
  });

  ws.addEventListener("close", () => {
    console.warn("WebSocket closed");
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("WebSocket error", err);
    try {
      ws.close();
    } catch (_) {}
  });
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  reconnectTimeout = setTimeout(() => {
    connectWebSocket();
  }, 5000);
}

// ====== BUTTON LOGIC ======
function setupButtons() {
  if (scorebugBtn && scorebugEl) {
    scorebugBtn.classList.add("on");
    scorebugEl.classList.add("show"); // näkyviin alussa

    scorebugBtn.addEventListener("click", () => {
      scorebugVisible = !scorebugVisible;
      scorebugEl.classList.toggle("show", scorebugVisible);
      scorebugBtn.classList.toggle("on", scorebugVisible);
      scorebugBtn.classList.toggle("off", !scorebugVisible);
    });
  }

  if (lower3rdBtn && lower3rdEl) {
    lower3rdBtn.classList.add("on");

    lower3rdBtn.addEventListener("click", () => {
      lower3rdVisible = !lower3rdVisible;
      lower3rdBtn.classList.toggle("on", lower3rdVisible);
      lower3rdBtn.classList.toggle("off", !lower3rdVisible);

      if (lower3rdVisible) {
        lower3rdEl.classList.add("in");
      } else {
        lower3rdEl.classList.remove("in");
      }
    });
  }
}

// ====== KEYBOARD SHORTCUTS ======
// CTRL + SHIFT + ALT + A => toggle scorebug
// CTRL + SHIFT + ALT + B => toggle lower 3rd
function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || !event.shiftKey || !event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "a" && scorebugBtn) {
      event.preventDefault();
      scorebugBtn.click();
    } else if (key === "b" && lower3rdBtn) {
      event.preventDefault();
      lower3rdBtn.click();
    }
  });
}

// ====== INIT ======
async function init() {
  setupButtons();
  setupKeyboardShortcuts();

  // Ensimmäinen haku
  const firstMatch = await fetchMatchOnce(matchId);
  if (firstMatch) {
    renderMatch(firstMatch);
  }

  // WebSocket livepäivityksille
  connectWebSocket();

  // Varmuuden vuoksi pollaus 10s välein
  setInterval(async () => {
    const match = await fetchMatchOnce(matchId);
    if (match) {
      renderMatch(match);
    }
  }, 10000);
}

window.addEventListener("load", init);
