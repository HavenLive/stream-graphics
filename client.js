const API_KEY = "anzsj3jqsm"; 
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

function num(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
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
let lower3rdEnabled = true; // ← TÄMÄ KUULUU TÄNNE (globaaliksi)
let prevTimeoutsA = 0;
let prevTimeoutsB = 0;
let timeoutBannerActive = false;
let timeoutBannerTeam = null;
let timeoutBannerExpiry = 0;
const TIMEOUT_BANNER_DURATION = 30000; // ms, esim. 30 sekuntia


// --- LOWER THIRD -TILAN MÄÄRITYS ---

function determineLowerThirdMode(match) {
  const liveA = num(match.live_A);
  const liveB = num(match.live_B);

  const setsA = num(
    match.sets_A ??
      match.set_A ??
      match.sets_home
  );

  const setsB = num(
    match.sets_B ??
      match.set_B ??
      match.sets_away
  );

  const periodA = num(match.live_ps_A);
  const periodB = num(match.live_ps_B);

  // 1) LOPPUTULOS – peli ohi kun jollain 3 erää
  if (setsA >= 3 || setsB >= 3) return "FINAL";

  // 2) AIKALISÄ – aikalisä käynnissä (banneri aktiivinen)
  if (timeoutBannerActive) return "TIMEOUT";

  // 3) ERÄTAUKO – eräpisteet 0–0, mutta erävoittoja vähintään 1
  if (periodA === 0 && periodB === 0 && (setsA + setsB) >= 1) {
    return "SET_BREAK";
  }

  // 4) GAME – ei pisteitä eikä erävoittoja
  if (liveA === 0 && liveB === 0 && setsA === 0 && setsB === 0) {
    return "GAME";
  }

  // Muulloin ei lower3rd-grafiikkaa automaattisesti
  return "NONE";
}







// --- GRAFIIKAN PÄIVITYS ---

function setGraphics(match) {
  if (!match) return;

  // --- AIKALISÄN TUNNISTUS live_timeouts_A/B-perusteella ---
  const currentTimeoutsA = num(match.live_timeouts_A);
  const currentTimeoutsB = num(match.live_timeouts_B);

  // Jos aikalisien määrä kasvaa, käynnistetään timeout-banneri
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

  // Jos timeoutin aika on ummessa, lopetetaan banneri
  if (timeoutBannerActive && Date.now() > timeoutBannerExpiry) {
    timeoutBannerActive = false;
    timeoutBannerTeam = null;
  }

  // --- PISTEMUUTTUJAT YHTENÄISESTI NUMEROINA ---
  const liveA = num(match.live_A);
  const liveB = num(match.live_B);

  const setsA =
    num(
      match.sets_A ??
        match.set_A ??
        match.sets_home
    );

  const setsB =
    num(
      match.sets_B ??
        match.set_B ??
        match.sets_away
    );

  const periodA = num(match.live_ps_A);
  const periodB = num(match.live_ps_B);

  const mode = determineLowerThirdMode(match);

  // --- SCOREBUG – joukkueet ja live-pisteet ---

  home.name.innerText = match.team_A_name || "";
  away.name.innerText = match.team_B_name || "";

  home.score.innerText = liveA;
  away.score.innerText = liveB;

  // Eräpisteet / period score
  if (!match.live_ps_A && !match.live_ps_B && !match.live_serve_team) {
    periodScore.classList.add("hide");
  } else if (!match.live_ps_A && !match.live_ps_B && match.live_serve_team) {
    home.periodScore.innerText = 0;
    away.periodScore.innerText = 0;
    periodScore.classList.remove("hide");
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

  // --- LOWER THIRD – automaattinen moodi ---

  if (!lower3rdEl || !lower3rdHome || !lower3rdAway || !lower3rdScore) return;

  // Jos kytkin pois päältä → piilotetaan aina
  if (!lower3rdEnabled) {
    lower3rdEl.classList.remove("in");
    return;
  }

  // Päivitetään aina joukkueiden nimet lower3rdille
  lower3rdHome.innerText = match.team_A_name || "";
  lower3rdAway.innerText = match.team_B_name || "";

  // Jos ei mitään moodia → piilotetaan lower3rd kokonaan
  if (mode === "NONE") {
    lower3rdEl.classList.remove("in");
    return;
  }

  // Muuten varmistetaan että lower3rd on näkyvissä
  lower3rdEl.classList.add("in");

  // Default: näytetään message, ellei GAME-tilaa
  if (lower3rdMessage) {
    lower3rdMessage.classList.remove("hide");
  }

  if (mode === "GAME") {
    // GAME – ei pisteitä eikä otsikkaa
    if (lower3rdMessage) {
      lower3rdMessage.classList.add("hide");
    }
    lower3rdScore.innerText = "";
  } else if (mode === "TIMEOUT") {
    // AIKALISÄ – erän sisäiset pisteet + aikalisän ottanut joukkue
    if (lower3rdMessage) {
      const teamName =
        timeoutBannerTeam === "A"
          ? match.team_A_name || "Kotijoukkue"
          : timeoutBannerTeam === "B"
          ? match.team_B_name || "Vierasjoukkue"
          : "";

      lower3rdMessage.innerText = teamName
        ? `AIKALISÄ – ${teamName}`
        : "AIKALISÄ";
    }

    // Näytetään erän sisäiset pisteet, ei koko pelin erätilannetta
    lower3rdScore.innerText = `${periodA} - ${periodB}`;
  } else if (mode === "SET_BREAK") {
    // ERÄTAUKO – pelin erätilanne
    if (lower3rdMessage) lower3rdMessage.innerText = "ERÄTAUKO";
    lower3rdScore.innerText = `${setsA} - ${setsB}`;
  } else if (mode === "FINAL") {
    // LOPPUTULOS – lopullinen erätilanne
    if (lower3rdMessage) lower3rdMessage.innerText = "LOPPUTULOS";
    lower3rdScore.innerText = `${setsA} - ${setsB}`;
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

// Oletus: molemmat päällä alussa
if (scorebugBtn) scorebugBtn.classList.add("on");
if (lower3rdBtn) lower3rdBtn.classList.add("on");

if (scorebugBtn && scorebugEl) {
  scorebugBtn.addEventListener("click", () => {
    scorebugEl.classList.toggle("hidden");
    const active = !scorebugEl.classList.contains("hidden");
    scorebugBtn.classList.toggle("on", active);
    scorebugBtn.classList.toggle("off", !active);
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



// --- KÄYNNISTYS ---

addEventListener("load", init);
