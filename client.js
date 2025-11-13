/* ============================================================
   CLEAN AND STABLE client.js
   - No logos
   - Upcoming match view (names only)
   - Live view (normal)
   - Finished match view (final result)
   ============================================================ */

const API_KEY = "anzsj3jqsm";
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const FALLBACK_MATCH_ID = 685565;

const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug");
const matchId = urlParams.get("id") || FALLBACK_MATCH_ID;

/* DOM ELEMENTS */
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

const l3Message = lower3rdEl.querySelector(".message");
const l3Home = lower3rdEl.querySelector(".home-team");
const l3Away = lower3rdEl.querySelector(".away-team");
const l3Score = lower3rdEl.querySelector(".score");

/* BUTTONS */
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

let lower3rdEnabled = true;
let latestMatch = null;

/* HELPERS */
function safeUpper(str) {
  if (!str) return "";
  return String(str).toUpperCase();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ============================================================
   RENDER UPCOMING MATCH (before match starts)
   ============================================================ */

function renderUpcoming(match) {
  scorebugEl.classList.add("show");

  // Team names only
  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // NO scores
  homeScoreEl.textContent = "";
  awayScoreEl.textContent = "";

  // NO sets
  homePeriodEl.textContent = "";
  awayPeriodEl.textContent = "";
  periodBoxEl.classList.add("hide");

  // NO serve
  homeServeEl.classList.add("hide");
  awayServeEl.classList.add("hide");

  // LOWER THIRD:
  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");
    l3Message.textContent = "";       // no "ERÄTAUKO"
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = "";         // no score
  }
}

/* ============================================================
   RENDER LIVE MATCH
   ============================================================ */

function renderLive(match) {
  scorebugEl.classList.add("show");

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);
  periodBoxEl.classList.remove("hide");

  const serve = match.serve;
  homeServeEl.classList.toggle("hide", serve !== "A");
  awayServeEl.classList.toggle("hide", serve !== "B");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");
    l3Message.textContent = ""; // keep clean unless timeout logic added later
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  }
}

/* ============================================================
   RENDER FINISHED MATCH
   ============================================================ */

function renderFinished(match) {
  scorebugEl.classList.add("show");

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);
  periodBoxEl.classList.remove("hide");

  homeServeEl.classList.add("hide");
  awayServeEl.classList.add("hide");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");
    l3Message.textContent = "LOPPUTULOS";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  }
}

/* ============================================================
   MAIN LOGIC
   ============================================================ */

function updateGraphics(match) {
  latestMatch = match;

  const isUpcoming =
    match.status === "upcoming" ||
    (num(match.score_A) === 0 &&
      num(match.score_B) === 0 &&
      num(match.set_index) === 0);

  const isFinished =
    match.status === "finished" ||
    num(match.sets_A) === 3 ||
    num(match.sets_B) === 3;

  if (isUpcoming) return renderUpcoming(match);
  if (isFinished) return renderFinished(match);
  return renderLive(match);
}

/* ============================================================
   FETCH + WEBSOCKET
   ============================================================ */

async function fetchOnce() {
  try {
    const res = await fetch(TORNEO_API_BASE + matchId);
    const json = await res.json();
    return json.match || json;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function connectWS() {
  const ws = new WebSocket(`${TORNEO_WS_URL}${matchId}`);

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.match) updateGraphics(data.match);
    } catch {}
  };

  ws.onclose = () => setTimeout(connectWS, 2000);
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

/* ============================================================
   BUTTONS
   ============================================================ */

scorebugBtn.addEventListener("click", () => {
  const show = !scorebugEl.classList.contains("show");
  scorebugEl.classList.toggle("show", show);
});

lower3rdBtn.addEventListener("click", () => {
  lower3rdEnabled = !lower3rdEnabled;
  lower3rdEl.classList.toggle("in", lower3rdEnabled);
});

/* Hotkeys */
window.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || !e.shiftKey || !e.altKey) return;
  if (e.key.toLowerCase() === "a") scorebugBtn.click();
  if (e.key.toLowerCase() === "b") lower3rdBtn.click();
});

window.addEventListener("load", init);
