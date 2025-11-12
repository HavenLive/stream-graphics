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

if (!urlParams.get("id")) {
  window.location.replace(`/?id=${FALLBACK_MATCH_ID}`);
}

const socketUrl = debug ? DEBUG_WS_URL : TORNEO_WS_URL + matchId;

if (urlParams.has("bg")) {
  document.body.style.background = "slategrey";
}

// ====== HELPERS ======
function num(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

// ====== DOM: SCOREBUG ======
const periodScore = document.getElementById("period-score");
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
const lower3rdMessage = lower3rdEl ? lower3rdEl.querySelector(".message") : null;
const lower3rdHome = lower3rdEl ? lower3rdEl.querySelector(".home-team") : null;
const lower3rdAway = lower3rdEl ? lower3rdEl.querySelector(".away-team") : null;
const lower3rdScore = lower3rdEl ? lower3rdEl.querySelector(".score") : null;

// ====== STATE ======
let data = {};
let socket;
let reconnectAttempts = 5;

let lower3rdEnabled = !!lower3rdEl;

let prevTimeoutsA = 0;
let prevTimeoutsB = 0;
let timeoutBannerActive = false;
let timeoutBannerTeam = null;
let timeoutBannerExpiry = 0;
const TIMEOUT_BANNER_DURATION = 30000; // ms

let lastFinalSetsA = null;
let lastFinalSetsB = null;

// ====== TIMEOUT EXPIRY TICK ======
setInterval(() => {
  if (!timeoutBannerActive) return;

  if (Date.now() > timeoutBannerExpiry) {
    timeoutBannerActive = false;
    timeoutBannerTeam = null;
    if (data.match) setGraphics(data.match);
  }
}, 500);

// ====== MODE LOGIC ======
function determineLowerThirdMode(match) {
  // Scorebugin numerot = erävoitot
  const setsA = num(match.live_A);
  const setsB = num(match.live_B);

  // Erän sisäiset pisteet
  const periodA = num(match.live_ps_A);
  const periodB = num(match.live_ps_B);

  // Lisäturva aloitustilanteen erotteluun
  const periodsPlayed = num(match.periods_played);

  // FINAL: jommalla ≥3
  if (setsA >= 3 || setsB >= 3) return "FINAL";

  // TIMEOUT: banneri päällä
  if (timeoutBannerActive) return "TIMEOUT";

  // SET_BREAK: eräpisteet nollissa/tyhjät, mutta erävoittoja on
  const periodsAreZero =
    (!match.live_ps_A && !match.live_ps_B) || (periodA === 0 && periodB === 0);
  if (periodsAreZero && (setsA + setsB) >= 1) return "SET_BREAK";

  // GAME: aloitus, ei erävoittoja eikä eräpisteitä
  if (setsA === 0 && setsB === 0 && periodA === 0 && periodB === 0 && periodsPlayed === 0) {
    return "GAME";
  }

  // muut tilat: ei lower3rd
  return "NONE";
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
    timeoutBannerActive = true;
    timeoutBannerTeam = "B";
    timeoutBannerExpiry = Date.now() + TIMEOUT_BANNER_DURATION;
  }
  prevTimeoutsA = currentTimeoutsA;
  prevTimeoutsB = currentTimeoutsB;

  // --- pisteet ---
  const liveA = num(match.live_A);
  const liveB = num(match.live_B);

  // erävoitot = scorebugin numerot
  const setsA = liveA;
  const setsB = liveB;

  // erän sisäiset pisteet (näytetään vain jos numerot saatavilla)
  const hasPeriodA =
    match.live_ps_A !== undefined &&
    match.live_ps_A !== null &&
    match.live_ps_A !== "" &&
    !isNaN(Number(match.live_ps_A));

  const hasPeriodB =
    match.live_ps_B !== undefined &&
    match.live_ps_B !== null &&
    match.live_ps_B !== "" &&
    !isNaN(Number(match.live_ps_B));

  const periodA = hasPeriodA ? Number(match.live_ps_A) : 0;
  const periodB = hasPeriodB ? Number(match.live_ps_B) : 0;

  const mode = determineLowerThirdMode(match);

  // FINAL-lukitus
  if (mode === "FINAL") {
    if (lastFinalSetsA === null && lastFinalSetsB === null) {
      if (setsA !== 0 || setsB !== 0) {
        lastFinalSetsA = setsA;
        lastFinalSetsB = setsB;
      }
    }
  } else {
    lastFinalSetsA = null;
    lastFinalSetsB = null;
  }

  // --- SCOREBUG ---
  home.name.innerText = match.team_A_name || "";
  away.name.innerText = match.team_B_name || "";

  home.score.innerText = liveA;
  away.score.innerText = liveB;

  // Eräpiste-laatikko: näytetään vain jos erä käynnissä (oikeat numerot)
  if (!hasPeriodA && !hasPeriodB) {
    periodScore.classList.add("hide");
  } else {
    home.periodScore.innerText = periodA;
    away.periodScore.innerText = periodB;
    periodScore.classList.remove("hide");
  }

  // Syöttöindikaattori
  const serveTeam = (match.live_serve_team || "").toUpperCase();
  if (serveTeam === "A") {
    home.serving.classList.remove("hide");
    away.serving.classList.add("hide");
  } else if (serveTeam === "B") {
    home.serving.classList.add("hide");
    away.serving.classList.remove("hide");
  } else {
    home.serving.classList.add("hide");
    away.serving.classList.add("hide");
  }

  // --- LOWER THIRD ---
  if (!lower3rdEl || !lower3rdHome || !lower3rdAway || !lower3rdScore) return;

  if (!lower3rdEnabled) {
    lower3rdEl.classList.remove("in");
    return;
  }

  lower3rdHome.innerText = match.team_A_name || "";
  lower3rdAway.innerText = match.team_B_name || "";

  if (mode === "NONE") {
    lower3rdEl.classList.remove("in");
    return;
  }

  lower3rdEl.classList.add("in");
  if (lower3rdMessage) lower3rdMessage.classList.remove("hide");

  if (mode === "GAME") {
    if (lower3rdMessage) lower3rdMessage.classList.add("hide");
    lower3rdEl.classList.remove("timeout-mode");
    lower3rdScore.innerText = "";
  } else if (mode === "TIMEOUT") {
    lower3rdEl.classList.add("timeout-mode");
    if (lower3rdMessage) {
      const teamName =
        timeoutBannerTeam === "A"
          ? match.team_A_name || "Kotijoukkue"
          : timeoutBannerTeam === "B"
          ? match.team_B_name || "Vierasjoukkue"
          : "";
      lower3rdMessage.innerText = teamName ? `AIKALISÄ – ${teamName}` : "AIKALISÄ";
    }
    lower3rdScore.innerText = `${periodA} - ${periodB}`;
  } else if (mode === "SET_BREAK") {
    lower3rdEl.classList.remove("timeout-mode");
    if (lower3rdMessage) lower3rdMessage.innerText = "ERÄTAUKO";
    lower3rdScore.innerText = `${setsA} - ${setsB}`;
  } else if (mode === "FINAL") {
    lower3rdEl.classList.remove("timeout-mode");
    const showSetsA = lastFinalSetsA !== null ? lastFinalSetsA : setsA;
    const showSetsB = lastFinalSetsB !== null ? lastFinalSetsB : setsB;
    if (lower3rdMessage) lower3rdMessage.innerText = "LOPPUTULOS";
    lower3rdScore.innerText = `${showSetsA} - ${showSetsB}`;
  }
}

// ====== WS ======
function connectWebsocket() {
  if (socket) socket.close();
  socket = new WebSocket(socketUrl);

  socket.onopen = () => {
    if (debug) console.log("WS: Connected to", socketUrl);
    else console.log("WS: Connected");
    reconnectAttempts = 5;
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      data.match = msg.match ? msg.match : msg;
      setGraphics(data.match);
    } catch (err) {
      console.error("WS: invalid JSON", err);
    }
  };

  socket.onclose = () => {
    if (reconnectAttempts > 0) {
      console.warn(`WS: Connection lost. Reconnecting in 5s... (${reconnectAttempts} left)`);
      reconnectAttempts--;
      setTimeout(connectWebsocket, 5000);
    } else {
      console.error("Cannot reconnect. Maximum attempts reached.");
    }
  };

  socket.onerror = () => {
    console.error("WS: WebSocket error");
    socket.close();
  };
}

// ====== REST ======
async function fetchMatchData(id) {
  try {
    const response = await fetch(TORNEO_API_BASE + id);
    if (!response.ok) {
      const text = await response.text();
      console.log(">> REST error:", text);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(">> Fetch error:", error);
    return null;
  }
}

// ====== INIT ======
async function init() {
  // scorebug näkyviin pehmeästi alussa
  if (scorebugEl) scorebugEl.classList.add("show");

  data = await fetchMatchData(matchId);
  if (data) {
    const initialMatch = data.match ? data.match : data;
    data.match = initialMatch;
    setGraphics(initialMatch);
  }
  connectWebsocket();
}

// ====== BUTTONS ======
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

if (scorebugBtn) scorebugBtn.classList.add("on");
if (lower3rdBtn) lower3rdBtn.classList.add("on");

if (scorebugBtn && scorebugEl) {
  scorebugBtn.addEventListener("click", () => {
    const willShow = !scorebugEl.classList.contains("show");
    scorebugEl.classList.toggle("show", willShow);
    scorebugBtn.classList.toggle("on", willShow);
    scorebugBtn.classList.toggle("off", !willShow);
  });
}

if (lower3rdBtn && lower3rdEl) {
  lower3rdBtn.addEventListener("click", () => {
    lower3rdEnabled = !lower3rdEnabled;
    lower3rdBtn.classList.toggle("on", lower3rdEnabled);
    lower3rdBtn.classList.toggle("off", !lower3rdEnabled);

    if (!lower3rdEnabled) {
      lower3rdEl.classList.remove("in");
    } else if (data.match) {
      setGraphics(data.match);
    }
  });
}

// ====== BOOT ======
addEventListener("load", init);
