// Lisää oma API-avain tähän:
const API_KEY = "TÄHÄN_SE_AVAIN";

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

let data = {};
let socket;
let reconnectAttempts = 5;

function setGraphics(data) {
  home.name.innerText = data.team_A_name;
  away.name.innerText = data.team_B_name;
  home.score.innerText = data.live_A;
  away.score.innerText = data.live_B;

  if (!data.live_ps_A && !data.live_ps_B && !data.live_serve_team) {
    periodScore.classList.add("hide");
  } else if (!data.live_ps_A && !data.live_ps_B && data.live_serve_team) {
    home.periodScore.innerText = 0;
    away.periodScore.innerText = 0;
    periodScore.classList.remove("hide");
  } else {
    home.periodScore.innerText = data.live_ps_A;
    away.periodScore.innerText = data.live_ps_B;
    periodScore.classList.remove("hide");
  }

  if (data.live_serve_team.toUpperCase() === "A") {
    home.serving.classList.remove("hide");
    away.serving.classList.add("hide");
  } else if (data.live_serve_team.toUpperCase() === "B") {
    home.serving.classList.add("hide");
    away.serving.classList.remove("hide");
  } else {
    home.serving.classList.add("hide");
    away.serving.classList.add("hide");
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

addEventListener("load", init);
