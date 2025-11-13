/* ============================================================
   Volleyball Graphics Controller — FIXED FULL VERSION
   ============================================================ */

const API_KEY = "anzsj3jqsm";
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const FALLBACK_MATCH_ID = 685565;

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get("id") || FALLBACK_MATCH_ID;

/* ============================
   DOM ELEMENTS
   ============================ */
const scorebugEl = document.getElementById("scorebug");
const lower3rdEl = document.getElementById("lower3rd");

const homeNameEl = document.getElementById("home-team");
const awayNameEl = document.getElementById("away-team");

const homeScoreEl = document.getElementById("home-score");
const awayScoreEl = document.getElementById("away-score");

const homePeriodEl = document.getElementById("home-period-score");
const awayPeriodEl = document.getElementById("away-period-score");

const periodBoxEl = document.getElementById("period-score");

const homeServeEl = document.getElementById("home-serving");
const awayServeEl = document.getElementById("away-serving");

// Lower third
const l3Message = lower3rdEl.querySelector(".message");
const l3Home = lower3rdEl.querySelector(".home-team");
const l3Away = lower3rdEl.querySelector(".away-team");
const l3Score = lower3rdEl.querySelector(".score");
const l3TextBox = lower3rdEl.querySelector(".text-info");
const l3ScoreBox = l3Score;

// Buttons
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

let lower3rdEnabled = true;
let latestMatch = null;

/* ============================
   HELPERS
   ============================ */
function safeUpper(s) {
  return s ? String(s).toUpperCase() : "";
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function hideElement(el) {
  if (el) el.style.display = "none";
}
function showElement(el, display = "") {
  if (el) el.style.display = display;
}

/* ============================
   RENDER UPCOMING
   ============================ */
function renderUpcoming(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  const gameScoreBox = homeScoreEl.parentElement;
  hideElement(gameScoreBox);
  hideElement(periodBoxEl);

  homeScoreEl.textContent = "";
  awayScoreEl.textContent = "";
  homePeriodEl.textContent = "";
  awayPeriodEl.textContent = "";

  homeServeEl.classList.add("hide");
  awayServeEl.classList.add("hide");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    hideElement(l3TextBox);
    hideElement(l3ScoreBox);

    l3Message.textContent = "";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = "";
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   RENDER LIVE
   ============================ */
function renderLive(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  const gameScoreBox = homeScoreEl.parentElement;
  showElement(gameScoreBox);
  showElement(periodBoxEl);

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);

  const serve = match.serve;
  homeServeEl.classList.toggle("hide", serve !== "A");
  awayServeEl.classList.toggle("hide", serve !== "B");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    hideElement(l3TextBox);
    showElement(l3ScoreBox);

    l3Message.textContent = "";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   RENDER FINISHED
   ============================ */
function renderFinished(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  const gameScoreBox = homeScoreEl.parentElement;
  showElement(gameScoreBox);
  showElement(periodBoxEl);

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);

  homeServeEl.classList.add("hide");
  awayServeEl.classList.add("hide");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    showElement(l3TextBox);
    showElement(l3ScoreBox);

    l3Message.textContent = "LOPPUTULOS";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   MAIN UPDATE SELECTOR
   ============================ */
function updateGraphics(match) {
  latestMatch = match;

  const upcoming =
    match.status === "upcoming" ||
    (num(match.score_A) === 0 &&
      num(match.score_B) === 0 &&
      num(match.set_index) === 0);

  const finished =
    match.status === "finished" ||
    num(match.sets_A) === 3 ||
    num(match.sets_B) === 3;

  if (upcoming) return renderUpcoming(match);
  if (finished) return renderFinished(match);
  return renderLive(match);
}

/* ============================
   FETCH + WS
   ============================ */
async function fetchOnce() {
  try {
    const res = await fetch(TORNEO_API_BASE + matchId);
    const json = await res.json();
    return json.match || json;
  } catch (e) {
    console.error("fetch error", e);
    return null;
  }
}

function connectWS() {
  const ws = new WebSocket(`${TORNEO_WS_URL}${matchId}`);

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.match) updateGraphics(data.match);
    } catch (err) {
      console.error("WS parse error", err);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWS, 1500);
  };
}

async function init() {
  const first = await fetchOnce();
  if (first) updateGraphics(first);

  connectWS();

  setInterval(async () => {
    const m = await fetchOnce();
    if (m) updateGraphics(m);
  }, 10000);
}

/* ============================
   BUTTONS
   ============================ */
scorebugBtn.addEventListener("click", () => {
  const visible = !scorebugEl.classList.contains("show");
  scorebugEl.classList.toggle("show", visible);
  scorebugBtn.classList.toggle("on", visible);
  scorebugBtn.classList.toggle("off", !visible);
});

lower3rdBtn.addEventListener("click", () => {
  lower3rdEnabled = !lower3rdEnabled;
  lower3rdEl.classList.toggle("in", lower3rdEnabled);
  lower3rdBtn.classList.toggle("on", lower3rdEnabled);
  lower3rdBtn.classList.toggle("off", !lower3rdEnabled);

  if (latestMatch) updateGraphics(latestMatch);
});

/* ============================
   HOTKEYS (A = scorebug, B = lower third)
   ============================ */
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a") scorebugBtn.click();
  if (k === "b") lower3rdBtn.click();
});

/* ============================
   INIT
   ============================ */
window.addEventListener("load", init);
