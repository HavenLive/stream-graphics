/* ============================================================
   Volleyball Graphics Controller
   - Upcoming: names only (no empty boxes)
   - Live: full graphics
   - Finished: final result on lower third & scorebug
   - Hotkeys: A = scorebug, B = lower third
   ============================================================ */

const API_KEY = "anzsj3jqsm";
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const FALLBACK_MATCH_ID = 748838;

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

  scorebugEl.classList.add("show");

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  hideElement(gameScoreBox);

  if (periodBoxEl) {
    periodBoxEl.classList.add("hide");
    periodBoxEl.style.display = "";
  }

  homeScoreEl.textContent = "";
  awayScoreEl.textContent = "";
  homePeriodEl.textContent = "";
  awayPeriodEl.textContent = "";

  if (homeServeEl) homeServeEl.classList.add("hide");
  if (awayServeEl) awayServeEl.classList.add("hide");

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
   RENDER: LIVE MATCH
   ============================ */
/*
  Pelin aikana:
  - Scorebug: kaikki näkyvillä (pisteet, erät, syöttö)
  - Lower third: joukkueet + pistelaatikko (pisteet), ei ylätekstiboksia
*/
function renderLive(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  showElement(gameScoreBox);

  if (periodBoxEl) {
    periodBoxEl.classList.remove("hide");
    periodBoxEl.style.display = "";
  }

  const scoreA = num(match.score_A);
  const scoreB = num(match.score_B);
  const setsA  = num(match.sets_A);
  const setsB  = num(match.sets_B);

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // Pelin aikana isossa boksissa nykyiset eräpisteet
  homeScoreEl.textContent = scoreA;
  awayScoreEl.textContent = scoreB;

  // Pieni eräboksi: voitetut erät
  homePeriodEl.textContent = setsA;
  awayPeriodEl.textContent = setsB;

  const serve = match.serve;
  if (homeServeEl) homeServeEl.classList.toggle("hide", serve !== "A");
  if (awayServeEl) awayServeEl.classList.toggle("hide", serve !== "B");

  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    hideElement(l3TextBox);
    showElement(l3ScoreBox);

    l3Message.textContent = "";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    // Pelin aikana alarivillä myös eräpisteet (voit halutessa vaihtaa)
    l3Score.textContent = `${scoreA} - ${scoreB}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   RENDER: FINISHED MATCH
   ============================ */
/*
  Pelin jälkeen:
  - Scorebug: kaikki laatikot näkyvissä, isossa boksissa LOPULLISET ERÄT
  - Lower third: "LOPPUTULOS" + lopputuloksen erät
*/
function renderFinished(match) {
  if (!match) return;

  scorebugEl.classList.add("show");

  const gameScoreBox = homeScoreEl ? homeScoreEl.parentElement : null;
  showElement(gameScoreBox);

  if (periodBoxEl) {
    periodBoxEl.classList.remove("hide");
    periodBoxEl.style.display = "";
  }

  const scoreA = num(match.score_A);
  const scoreB = num(match.score_B);
  const setsA  = num(match.sets_A);
  const setsB  = num(match.sets_B);

  homeNameEl.textContent = safeUpper(match.team_A_name);
  awayNameEl.textContent = safeUpper(match.team_B_name);

  // Jos Torneo on nollannut pisteet (0–0) pelin jälkeen, näytetään erät pääboksissa
  const useSetsAsMainScore =
    (scoreA === 0 && scoreB === 0 && (setsA > 0 || setsB > 0));

  const mainHome = useSetsAsMainScore ? setsA : scoreA;
  const mainAway = useSetsAsMainScore ? setsB : scoreB;

  // ISON BOKSIN LOPPUTULOS
  homeScoreEl.textContent = mainHome;
  awayScoreEl.textContent = mainAway;

  // ERÄBOKSISSA AINA VOITETUT ERÄT (LOPPUTULOS DATA)
  homePeriodEl.textContent = setsA;
  awayPeriodEl.textContent = setsB;

  // Syöttö pois lopussa
  if (homeServeEl) homeServeEl.classList.add("hide");
  if (awayServeEl) awayServeEl.classList.add("hide");

  // LOWER THIRD: LOPPUTULOS + lopulliset erät
  if (lower3rdEnabled) {
    lower3rdEl.classList.add("in");

    showElement(l3TextBox);
    showElement(l3ScoreBox);

    l3Message.textContent = "LOPPUTULOS";
    l3Home.textContent = match.team_A_name;
    l3Away.textContent = match.team_B_name;
    // TÄSSÄ ON LOPPUTULOKSEN PISTEET = ERÄT
    l3Score.textContent = `${setsA} - ${setsB}`;
  } else {
    lower3rdEl.classList.remove("in");
  }
}

/* ============================
   MAIN LOGIC: choose view
   ============================ */

function updateGraphics(match) {
  latestMatch = match;

  const scoreA   = num(match.score_A);
  const scoreB   = num(match.score_B);
  const setsA    = num(match.sets_A);
  const setsB    = num(match.sets_B);
  const setIndex = num(match.set_index);

  const isFinished =
    match.status === "finished" ||
    setsA === 3 ||
    setsB === 3;

  // Upcoming vain jos KAIKKI nollilla (myös erät)
  const isUpcoming =
    !isFinished &&
    (match.status === "upcoming" ||
      (scoreA === 0 && scoreB === 0 && setsA === 0 && setsB === 0 && setIndex === 0));

  if (debug) {
    console.log("updateGraphics", {
      status: match.status,
      scoreA,
      scoreB,
      setsA,
      setsB,
      setIndex,
      isUpcoming,
      isFinished,
    });
  }

  if (isFinished) {
    renderFinished(match);
  } else if (isUpcoming) {
    renderUpcoming(match);
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

  if (latestMatch) updateGraphics(latestMatch);
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
