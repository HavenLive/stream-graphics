
const API_KEY = "anzsj3jqsm"; 

// REST-rajapinnan perus-URL
// Jos avain ei mene URL:iin, muuta tätä riviä omaan muotoosi:
const TORNEO_API_BASE =
  "https://lentopallo.api.torneopal.com/taso/rest/getMatch?" +
  (API_KEY ? "api_key=" + API_KEY + "&" : "") +
  "match_id=";

// WebSocket-osoitteet
const TORNEO_WS_URL = "wss://nchan.torneopal.com/lentopallo/";
const DEBUG_WS_URL = "http://localhost:3000";

// Oletusottelu
const FALLBACK_MATCH_ID = 685565;

// URL-parametrit: ?id=xxxx&debug&bg
const urlParams = new URLSearchParams(window.location.search);
const debug = urlParams.has("debug");
const matchId = urlParams.get("id") || FALLBACK_MATCH_ID;

// Jos id puuttuu, ohjataan samaan osoitteeseen fallback-id:llä
if (!urlParams.get("id")) {
  window.location.replace(`/?id=${FALLBACK_MATCH_ID}`);
}

// WebSocketin osoite
const socketUrl = debug ? DEBUG_WS_URL : TORNEO_WS_URL + matchId;

// Taustan värinvaihto (esim. OBS:ssa bg-parametrilla)
if (urlParams.has("bg")) {
  document.body.style.background = "slategrey";
}

// --- DOM-ELEMENTIT SCOREBUGIA VARTEN ---

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

// --- LOWER THIRD -ELEMENTIT ---

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

// --- MUUT MUUTTUJAT ---

let data = {};
let socket;
let reconnectAttempts = 5;

// --- GRAFIIKAN PÄIVITYS ---

function setGraphics(match) {
  if (!match) return;

  // Scorebug – joukkueiden nimet ja live-pisteet
  home.name.innerText = match.team_A_name || "";
  away.name.innerText = match.team_B_name || "";

  home.score.innerText =
    match.live_A !== undefined && match.live_A !== null ? match.live_A : "";
  away.score.innerText =
    match.live_B !== undefined && match.live_B !== null ? match.live_B : "";

  // Eräpisteet / period score
  if (!match.live_ps_A && !match.live_ps_B && !match.live_serve_team) {
    periodScore.classList.add("hide");
  } else if (!match.live_ps_A && !match.live_ps_B && match.live_serve_team) {
    home.periodScore.innerText = 0;
    away.periodScore.innerText = 0;
    periodScore.classList.remove("hide");
  } else {
    home.periodScore.innerText =
      match.live_ps_A !== undefined && match.live_ps_A !== null
        ? match.live_ps_A
        : 0;
    away.periodScore.innerText =
      match.live_ps_B !== undefined && match.live_ps_B !== null
        ? match.live_ps_B
        : 0;
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
    lower3rdHome.innerText = match.team_A_name || "";
    lower3rdAway.innerText = match.team_B_name || "";

    // Yritetään käyttää erävoittoja jos kentät löytyy, muuten live-pisteet
    let setsA =
      match.sets_A !== undefined && match.sets_A !== null
        ? match.sets_A
        : match.set_A !== undefined && match.set_A !== null
        ? match.set_A
        : match.sets_home !== undefined && match.sets_home !== null
        ? match.sets_home
        : null;

    let setsB =
      match.sets_B !== undefined && match.sets_B !== null
        ? match.sets_B
        : match.set_B !== undefined && match.set_B !== null
        ? match.set_B
        : match.sets_away !== undefined && match.sets_away !== null
        ? match.sets_away
        : null;

    if (setsA !== null && setsB !== null) {
      lower3rdScore.innerText = setsA + " - " + setsB;
    } else {
      const la =
        match.live_A !== undefined && match.live_A !== null ? match.live_A : 0;
      const lb =
        match.live_B !== undefined && match.live_B !== null ? match.live_B : 0;
      lower3rdScore.innerText = la + " - " + lb;
    }

    // Jos haluat joskus vaihtaa viestin dynaamisesti:
    // if (lower3rdMessage) lower3rdMessage.innerText = "LIVE";
  }
}

// --- WEBSOCKET ---

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
      // Oletus: websocket palauttaa suoraan match-olion
      const msg = JSON.parse(e.data);
      data.match = msg.match ? msg.match : msg;
      setGraphics(data.match);
    } catch (err) {
      console.error("WS: invalid JSON", err);
    }
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

  socket.onerror = () => {
    console.error("WS: WebSocket error");
    socket.close();
  };
}

// --- REST-HAKU ---

async function fetchMatchData(id) {
  try {
    const response = await fetch(TORNEO_API_BASE + id);

    if (!response.ok) {
      const text = await response.text();
      console.log(">> Something went wrong with fetch:", text);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(">> Fetch error:", error);
    return null;
  }
}

// --- INIT ---

async function init() {
  data = await fetchMatchData(matchId);

  if (data) {
    // REST: oletus että data.match sisältää ottelun
    const initialMatch = data.match ? data.match : data;
    data.match = initialMatch;
    setGraphics(initialMatch);
  }

  connectWebsocket();
}

// --- NAPIT: SCOREBUG JA LOWER THIRD ---

const scorebugEl = document.getElementById("scorebug");
const scorebugBtn = document.getElementById("scorebug-btn");
const lower3rdBtn = document.getElementById("lower3rd-btn");

if (scorebugBtn && scorebugEl) {
  scorebugBtn.addEventListener("click", () => {
    scorebugEl.classList.toggle("hidden");
  });
}

if (lower3rdBtn && lower3rdEl) {
  lower3rdBtn.addEventListener("click", () => {
    lower3rdEl.classList.toggle("in");
  });
}

// --- KÄYNNISTYS ---

addEventListener("load", init);
