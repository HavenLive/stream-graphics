/* ============================================================
   Volleyball Graphics Controller
   - Upcoming: names only (no empty boxes)
   - Live: full graphics
   - Finished: final result on lower third
   - Hotkeys: A = scorebug, B = lower third
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

// Lower third internals
const l3Message = lower3rdEl.querySelector(".message");
const l3Home = lower3rdEl.querySelector(".home-team");
const l3Away = lower3rdEl.querySelector(".away-team");
const l3Score = lower3rdEl.querySelector(".score");
const l3TextBox = lower3rdEl.querySelector(".text-info"); // ylälaatikko
const l3ScoreBox = l3Score;                               // pistelaatikko

// Buttons
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

let lower3rdEnabled = true;
let latestMatch = null;

/* ============================
   HELPERS
   ============================ */
function safeUpper(str) {
  if (!str) return "";
  return String(str).toUpperCase();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* Small helpers for show/hide via inline styles */
function hideElement(el) {
  if (!el) return;
  el.style.display = "none";
}
function showElement(el, display = "") {
  if (!el) return;
  el.style.display = display; // "" = default (CSS määrää)
}

/* ============================
   RENDER: UPCOMING MATCH
   ============================ */
/*
  Ennen peliä:
  - Scorebug: vain joukkueiden nimet, EI pistebokseja, EI eräbokseja, EI syöttöä
  - Lower third: vain joukkueiden nimet, EI pistelaatikkoa, EI ylätekstilaatikkoa
*/
function renderUpcoming(match) {
  if (!match) return;

  // Scorebug näkyville
  scorebugEl.classList.add("show");

  // Joukkueiden nimet
  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // Piilota pisteboksi ja eräboksi kokonaan
  // .game-score (pisteboksi) on parent, johon home/away score kuuluvat
  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  hideElement(gameScoreBox);
  hideElement(periodBoxEl);

  // Tyhjennä piste- ja eräpiste arvot (varmuuden vuoksi)
  if (homeScoreEl) homeScoreEl.textContent = "";
  if (awayScoreEl) awayScoreEl.textContent = "";
  if (homePeriodEl) homePeriodEl.textContent = "";
  if (awayPeriodEl) awayPeriodEl.textContent = "";

  // Piilota syöttöikonit
  if (homeServeEl) homeServeEl.classList.add("hide");
  if (awayServeEl) awayServeEl.classList.add("hide");

  // LOWER THIRD: vain joukkueiden nimet, ei laatikoita turhaan
  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    // piilota tekstiboksi (ylälaatikko) ja pisteboksi
    hideElement(l3TextBox);
    hideElement(l3ScoreBox);

    if (l3Message) l3Message.textContent = "";
    if (l3Home) l3Home.textContent = match.team_A_name;
    if (l3Away) l3Away.textContent = match.team_B_name;
    if (l3Score) l3Score.textContent = "";
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   RENDER: LIVE MATCH
   ============================ */
/*
  Pelin aikana:
  - Scorebug: kaikki näkyvillä (pisteet, erät, syöttö)
  - Lower third: joukkueet + pistelaatikko, ei ylätekstiboksia ellei erikseen käytetä
*/
function renderLive(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  // Näytä piste- ja eräboksit
  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  showElement(gameScoreBox);
  showElement(periodBoxEl);

  // Joukkueiden nimet
  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // Pisteet
  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  // Erät
  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);

  // Syöttö
  const serve = match.serve;
  if (homeServeEl) homeServeEl.classList.toggle("hide", serve !== "A");
  if (awayServeEl) awayServeEl.classList.toggle("hide", serve !== "B");

  // LOWER THIRD: pisteboksi käytössä, ylätekstilaatikko piilotettu ellei tarvetta
  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    hideElement(l3TextBox);           // ei ERÄTAUKO-boksia automaattisesti
    showElement(l3ScoreBox);          // pisteboksi näkyviin

    if (l3Message) l3Message.textContent = "";
    if (l3Home) l3Home.textContent = match.team_A_name;
    if (l3Away) l3Away.textContent = match.team_B_name;
    if (l3Score) l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   RENDER: FINISHED MATCH
   ============================ */
/*
  Pelin jälkeen:
  - Scorebug: lopulliset pisteet ja erät näkyvät
  - Lower third: "LOPPUTULOS" ylälaatikossa + lopputulos pistelaatikossa
*/
function renderFinished(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  // Näytä piste- ja eräboksit
  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  showElement(gameScoreBox);
  showElement(periodBoxEl);

  // Joukkueiden nimet
  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // Pisteet
  homeScoreEl.textContent = num(match.score_A);
  awayScoreEl.textContent = num(match.score_B);

  // Erät
  homePeriodEl.textContent = num(match.sets_A);
  awayPeriodEl.textContent = num(match.sets_B);

  // Syöttö pois
  if (homeServeEl) homeServeEl.classList.add("hide");
  if (awayServeEl) awayServeEl.classList.add("hide");

  // LOWER THIRD: LOPPUTULOS
  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    showElement(l3TextBox);           // näytetään ylälaatikko
    showElement(l3ScoreBox);          // pisteboksi näkyviin

    if (l3Message) l3Message.textContent = "LOPPUTULOS";
    if (l3Home) l3Home.textContent = match.team_A_name;
    if (l3Away) l3Away.textContent = match.team_B_name;
    if (l3Score) l3Score.textContent = `${match.score_A} - ${match.score_B}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   MAIN LOGIC: choose view
   ============================ */

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

  if (isUpcoming) {
    renderUpcoming(match);
  } else if (isFinished) {
    renderFinished(match);
  } else {
    renderLive(match);
  }
}

/* ============================
   DATA: FETCH + WEBSOCKET
   ============================ */

async function fetchOnce() {
  try {
    const res = await fetch(TORNEO_API_BASE + matchId);
    const json = await res.json();
    return json.match || json;
  } catch (e) {
    console.error("fetchOnce error", e);
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
      console.error("WS message parse error", err);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWS, 2000);
  };
}

async function init() {
  const first = await fetchOnce();
  if (first) updateGraphics(first);

  connectWS();

  // backup-pollaus 10s välein
  setInterval(async () => {
    const m = await fetchOnce();
    if (m) updateGraphics(m);
  }, 10000);
}

/* ============================
   BUTTONS
   ============================ */

scorebugBtn.addEventListener("click", () => {
  const show = !scorebugEl.classList.contains("show");
  scorebugEl.classList.toggle("show", show);
  scorebugBtn.classList.toggle("on", show);
  scorebugBtn.classList.toggle("off", !show);
});

lower3rdBtn.addEventListener("click", () => {
  lower3rdEnabled = !lower3rdEnabled;
  lower3rdEl.classList.toggle("in", lower3rdEnabled);
  lower3rdBtn.classList.toggle("on", lower3rdEnabled);
  lower3rdBtn.classList.toggle("off", !lower3rdEnabled);
});

/* ============================
   HOTKEYS: A = scorebug, B = lower third
   ============================ */

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "a") {
    e.preventDefault();
    scorebugBtn.click();
  }

  if (key === "b") {
    e.preventDefault();
    lower3rdBtn.click();
  }
});

/* ============================
   BOOTSTRAP
   ============================ */
window.addEventListener("load", init);
