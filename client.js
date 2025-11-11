// Lisää oma API-avain tähän:
const API_KEY = "anzsj3jqsm";

const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?api_key=" +
  API_KEY +
  "&match_id=";

const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";

const FALLBACK_MATCH_ID = 685565;
const DEBUG_WS_URL = "http://localhost:3000";

const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug") ?? false;
const matchId = urlParams.get("id") ?? false;
if (!matchId) window.location.replace(`/?id=${FALLBACK_MATCH_ID}`);
const socketUrl = debug ? DEBUG_WS_URL : TORNEO_WS_URL + matchId;
if (urlParams.has("bg")) document.body.style.background = "slategrey";

const periodScore = document.getElementById("period-score");
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

// Lower third -elementit
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
const lower3rdScore = lower3rdEl
  ? lower3rdEl.querySelector(".score")
  : null;


let data = {};
let socket;
let reconnectAttempts = 5;

function setGraphics(match) {
  // Scorebug – joukkueiden nimet ja live-pisteet
  home.name.innerText = match.team_A_name;
  away.name.innerText = match.team_B_name;
  home.score.innerText = match.live_A;
  away.score.innerText = match.live_B;

  // Eräpisteet / period score
  if (!match.live_ps_A && !match.live_ps_B && !match.live_serve_team) {
    periodScore.classList.add("hide");
  } else if (!match.live_ps_A && !match.live_ps_B && match.live_serve_team) {
    home.periodScore.innerText = 0;
    away.periodScore.innerText = 0;
    periodScore.classList.remove("hide");
  } else {
    home.periodScore.innerText = match.live_ps_A;
    away.periodScore.innerText = match.live_ps_B;
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

  // LOWER THIRD – sama data käyttöön
  if (lower3rdHome && lower3rdAway && lower3rdScore) {
    lower3rdHome.innerText = match.team_A_name;
    lower3rdAway.innerText = match.team_B_name;

    // Yritetään käyttää erävoittoja jos kentät löytyy, muuten live-pisteet
    const setsA =
      match.sets_A ??
      match.set_A ??
      match.sets_home ??
      null;
    const setsB =
      match.sets_B ??
      match.set_B ??
      match.sets_away ??
      null;

    if (setsA != null && setsB != null) {
      lower3rdScore.innerText = `${setsA} - ${setsB}`;
    } else {
      lower3rdScore.innerText = `${match.live_A} - ${match.live_B}`;
    }

    // Halutessasi voit muuttaa myös messagen dynaamiseksi, esim:
    // if (lower3rdMessage) lower3rdMessage.innerText = "LIVE";
  }
}


function connectWebsocket() {
  if (socket) socket.close();
  socket = new WebSocket(socketUrl);

  socket.onopen = () => {
    if (debug) console.log("WS: Connected to", socketUrl);
    else console.log("WS: Connected");
    reconnectAttempts = 5;
  };

  socket.onmessage = (e) => {
    data.match = JSON.parse(e.data);
    setGraphics(data.match);
  };

  socket.onclose = () => {
    if (reconnectAttempts > 0) {
      console.warn(
        `WS: Connection lost. Attempting to reconnect in 5 seconds... (${reconnectAttempts} attempts left)`
      );
      reconnectAttempts--;
      setTimeout(connectWebsocket, 5000);
    } else {
      console.error("Cannot reconnect. Maximum attempts reached.");
    }
  };

  socket.onerror = (e) => {
    console.error("WS: WebSocket error");
    socket.close();
  };
}

async function fetchMatchData(id) {
  const response = await fetch(TORNEO_API_BASE + id);

  if (!response.ok) {
    console.log(">> Something went wrong with fetch");
    return;
  }

  return await response.json();
}

async function init() {
  data = await fetchMatchData(matchId);
  setGraphics(data.match);
  connectWebsocket();
}

// UI-kontrollit: scorebug ja lower third
const scorebugEl = document.getElementById("scorebug");
const lower3rdEl = document.getElementById("lower3rd");
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

if (scorebugBtn && scorebugEl) {
  scorebugBtn.addEventListener("click", () => {
    scorebugEl.classList.toggle("hidden");
  });
}

if (lower3rdBtn && lower3rdEl) {
  // Näytä/piilota lower third animaation kanssa
  lower3rdBtn.addEventListener("click", () => {
    lower3rdEl.classList.toggle("in");
  });
}


addEventListener("load", init);
