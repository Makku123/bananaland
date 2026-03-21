// ─── Monopoly Client ───────────────────────────────────────────────

let socket = null;
let gameId = null;
let myId = null;
let revealAll = false;
let gs = null; // current game state
let _prevLogLen = 0; // track log length for banana burst detection
let _syncingLobby = false; // guard: prevent updateLobbySettings during showLobby sync

const MONKEY_EMOJI = {
  brown: "\uD83D\uDC35",
  golden: "\uD83D\uDC12",
  silver: "\uD83E\uDDA7",
  red: "\uD83E\uDDE8",
};

function playTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  } catch (e) {}
}

function playMoveTickSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {}
}

function playChatNotif() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1046.5, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch (e) {}
}

function playTurnChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.12 + 0.3,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch (e) {}
}

function playDiceRoll() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Rapid short noise bursts to mimic dice clatter
    for (let i = 0; i < 8; i++) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++)
        data[j] = (Math.random() * 2 - 1) * 0.6;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 800 + Math.random() * 2000;
      bp.Q.value = 1.5;
      const gain = ctx.createGain();
      const start = t + i * 0.05;
      gain.gain.setValueAtTime(0.15 + Math.random() * 0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
      src.connect(bp).connect(gain).connect(ctx.destination);
      src.start(start);
      src.stop(start + 0.04);
    }
  } catch (e) {}
}

function playAuctionLoss() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Descending sad tones
    const notes = [493.88, 440, 349.23]; // B4, A4, F4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = t + i * 0.18;
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (e) {}
}

let _shuffleAudioCtx = null;
function playShuffleSound() {
  try {
    if (!_shuffleAudioCtx)
      _shuffleAudioCtx = new (
        window.AudioContext || window.webkitAudioContext
      )();
    const ctx = _shuffleAudioCtx;
    const t = ctx.currentTime;
    // Quick sweep tone
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
    // Tiny noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(ng).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.08);
  } catch (e) {}
}

// ── Screens ────────────────────────────────────────────────────────

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  // Hide floaters during game
  const floaters = document.getElementById("bg-floaters");
  if (floaters) floaters.style.display = id === "screen-game" ? "none" : "";
}

// ── Socket setup ───────────────────────────────────────────────────

function initSocket() {
  if (socket) return;
  socket = io();
  myId = socket.id; // will be set after connect

  socket.on("connect", () => {
    myId = socket.id;
    // Authenticate socket if user is logged in
    const token = localStorage.getItem("banana_auth_token");
    if (token) socket.emit("auth_socket", { token });
  });

  socket.on("game_update", (state) => {
    // Save player positions and revealed tiles before overwriting gs so we can freeze during dice roll
    // Don't overwrite if we're mid-walk animation (positions are synthetic)
    if (gs && gs.players && !window._tokenWalking) {
      window._prevPlayerPositions = {};
      gs.players.forEach((p) => {
        window._prevPlayerPositions[p.id] = p.position;
      });
      const me = gs.players.find((p) => p.id === socket.id);
      if (me && me.revealedTiles) {
        window._prevRevealedTiles = new Set(me.revealedTiles);
      }
      // Snapshot banana piles before state update
      if (gs.properties) {
        window._prevBananaPileState = {};
        gs.properties.forEach((p) => {
          if (p.bananaPile > 0)
            window._prevBananaPileState[p.id] = p.bananaPile;
        });
      }
      // Snapshot money before state update
      const meSnap = gs.players.find((p) => p.id === socket.id);
      if (meSnap) window._prevMoney = meSnap.money;
    }
    gs = state;
    gameId = state.gameId;
    myId = socket.id;
    route();
  });

  socket.on("game_error", (data) => {
    alert(data.message);
  });

  socket.on("chat_message", (data) => {
    const container = document.getElementById("board-chat-messages");
    if (!container) return;
    const msg = document.createElement("div");
    msg.className = "board-chat-msg";
    const nameSpan = document.createElement("span");
    nameSpan.className = "board-chat-name c-" + (data.color || "brown");
    nameSpan.textContent = data.name;
    const textSpan = document.createElement("span");
    textSpan.className = "board-chat-text";
    textSpan.textContent = data.message;
    msg.appendChild(nameSpan);
    msg.appendChild(textSpan);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    playChatNotif();
    // Show unread badge if chat is hidden
    const chatEl = document.getElementById("board-chat");
    const toggle = document.getElementById("board-chat-toggle");
    if (chatEl && chatEl.classList.contains("board-chat-hidden") && toggle) {
      toggle.classList.add("has-unread");
    }
  });

  socket.on("dev:reload", () => location.reload());
}

// ── Routing: pick correct screen based on state ────────────────────

function route() {
  if (!gs) return;
  if (gs.state === "waiting") {
    showLobby();
  } else if (gs.state === "revealing") {
    showReveal();
    updateRevealAcceptStatus();
  } else if (gs.state === "picking") {
    hideReveal();
    if (!_shufflePlayed) {
      _shufflePlayed = true;
      playShuffleSound();
    }
    showGame();
  } else {
    hideReveal();
    if (!_shufflePlayed) {
      _shufflePlayed = true;
      playShuffleSound();
    }
    showGame();
    if (gs.state === "finished") {
      showGameOver();
    }
  }
}

function showGameOver() {
  const overlay = document.getElementById("game-over-overlay");
  if (!overlay || overlay.style.display === "flex") return;
  overlay.style.display = "flex";

  // Find the winner (player who owns the mushroom property, bomb winner, or banana loser)
  let winnerPlayer;
  if (gs.bombWinner) {
    winnerPlayer = gs.players.find((p) => p.id === gs.bombWinner);
  } else if (gs.bananaLoser) {
    // Winner is the opponent with the most money
    winnerPlayer = [...gs.players]
      .filter((p) => p.id !== gs.bananaLoser && !p.bankrupt)
      .sort((a, b) => b.money - a.money)[0];
  } else {
    winnerPlayer = gs.players.find((p) =>
      p.properties.some((pos) => {
        const prop = gs.properties && gs.properties.find((pr) => pr.id === pos);
        return prop && prop.group === "mushroom";
      }),
    );
  }

  const winnerEl = document.getElementById("game-over-winner");
  if (winnerPlayer && gs.bombWinner) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Monkey King! \uD83D\uDC51\uD83D\uDCA5`;
  } else if (winnerPlayer && gs.bananaLoser) {
    const loser = gs.players.find((p) => p.id === gs.bananaLoser);
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the richest monkey and wins! \u2b50\uD83D\uDC51`;
  } else if (winnerPlayer) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Banana King! \uD83D\uDC51`;
  }

  // Standings sorted by money (bankrupt players last)
  const standingsEl = document.getElementById("game-over-standings");
  const sorted = [...gs.players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return b.money - a.money;
  });
  standingsEl.innerHTML = sorted
    .map((p, i) => {
      const emoji = MONKEY_EMOJI[p.color] || "\uD83D\uDC35";
      const medal =
        i === 0
          ? "\uD83E\uDD47"
          : i === 1
            ? "\uD83E\uDD48"
            : i === 2
              ? "\uD83E\uDD49"
              : "";
      const status = p.bankrupt ? " \uD83D\uDCA5" : "";
      return `<div class="standing-row">${medal} ${emoji} <span style="flex:1;margin-left:6px">${p.name}${status}</span><span>${p.money}\uD83C\uDF4C</span></div>`;
    })
    .join("");
}

// ── Reveal Phase ───────────────────────────────────────────────────

let _revealShown = false;
let _shufflePlayed = false;

function showReveal() {
  showScreen("screen-game");
  const overlay = document.getElementById("reveal-overlay");
  if (_revealShown) return; // already rendered
  _revealShown = true;
  _shufflePlayed = false;
  overlay.style.display = "flex";
  overlay.innerHTML = "";

  const content = document.createElement("div");
  content.className = "reveal-content";

  // Title
  const title = document.createElement("div");
  title.className = "reveal-title";
  title.innerHTML = "\ud83c\udf4c THE BOARD \ud83c\udf4c";
  content.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.className = "reveal-subtitle";
  subtitle.textContent = "Here are all the tiles this game...";
  content.appendChild(subtitle);

  // Group tiles from boardLayout
  const colorOrder = [
    "yellow",
    "lightblue",
    "red",
    "pink",
    "orange",
    "darkblue",
  ];
  const groupNames = {
    yellow: "Cavendish",
    lightblue: "Blue Java",
    red: "Red Dacca",
    pink: "Lady Finger",
    orange: "Goldfinger",
    darkblue: "Gros Michel",
  };
  const tileEmojis = {
    yellow: "\ud83c\udf34",
    lightblue: "\ud83c\udf34",
    red: "\ud83c\udf34",
    pink: "\ud83c\udf34",
    orange: "\ud83c\udf34",
    darkblue: "\ud83c\udf34",
  };

  const farmGroups = {};
  const nonFarms = [];
  const cacti = [];
  let mushroom = null;

  for (const tile of gs.boardLayout) {
    if (tile.type === "grow") continue;
    if (tile.type === "desert") {
      cacti.push(tile);
    } else if (tile.group && tile.group !== "desert") {
      if (!farmGroups[tile.group]) farmGroups[tile.group] = [];
      farmGroups[tile.group].push(tile);
    } else if (tile.type === "special") {
      mushroom = tile;
    } else {
      nonFarms.push(tile);
    }
  }

  let delay = 0;
  const tilesGrid = document.createElement("div");
  tilesGrid.className = "reveal-grid";

  // Farm groups
  for (const colorKey of colorOrder) {
    const tiles = farmGroups[colorKey];
    if (!tiles || tiles.length === 0) continue;

    const section = document.createElement("div");
    section.className = "reveal-group";

    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:var(--gc-' +
      colorKey +
      ')"></span> ' +
      groupNames[colorKey] +
      ' <span class="reveal-group-meta">' +
      tiles.length +
      " farms \u00b7 " +
      tiles[0].price +
      "\ud83c\udf4c yield</span>";
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "reveal-group-tiles";

    for (const t of tiles) {
      const el = document.createElement("div");
      el.className = "reveal-tile";
      el.style.background = "var(--gc-" + colorKey + ")";
      el.innerHTML =
        '<span class="reveal-tile-emoji">' +
        (tileEmojis[colorKey] || "\ud83c\udf34") +
        "</span>" +
        '<span class="reveal-tile-label">' +
        (t.tileLabel || "") +
        "</span>";
      row.appendChild(el);
      delay++;
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Cacti section
  if (cacti.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";

    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#5a8a3c"></span> Desert \ud83c\udf35 ' +
      '<span class="reveal-group-meta">' +
      cacti.length +
      " tiles \u00b7 values: 0, 15, 20, 25, 30, 35, 40, 45\ud83c\udf4c</span>";
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "reveal-group-tiles";

    for (const t of cacti) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile-cacti";
      el.innerHTML = '<span class="reveal-tile-emoji">\ud83c\udf35</span>';
      row.appendChild(el);
      delay++;
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Non-farms (non-cacti)
  if (nonFarms.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";

    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#666"></span> Other Tiles';
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "reveal-group-tiles";

    for (const t of nonFarms) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile-other";
      const icon = t.tileName || t.name || "?";
      el.innerHTML = '<span class="reveal-tile-emoji">' + icon + "</span>";
      row.appendChild(el);
      delay++;
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Mushroom — last tile (#52 feeling)
  if (mushroom) {
    const section = document.createElement("div");
    section.className = "reveal-group";

    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#8B4513"></span> Super Banana \u2b50';
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "reveal-group-tiles";

    const el = document.createElement("div");
    el.className = "reveal-tile reveal-tile-mushroom";
    el.innerHTML =
      '<span class="reveal-tile-emoji">' +
      (mushroom.name || "\u2b50") +
      "</span>";
    row.appendChild(el);
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  content.appendChild(tilesGrid);

  // Countdown bar at bottom
  const acceptBar = document.createElement("div");
  acceptBar.className = "reveal-accept-bar";
  acceptBar.id = "reveal-accept-bar";

  const countdownEl = document.createElement("div");
  countdownEl.className = "reveal-countdown";
  countdownEl.id = "reveal-countdown";
  countdownEl.textContent = "Shuffling... Starting in 5";
  acceptBar.appendChild(countdownEl);

  // Progress bar
  const progressBar = document.createElement("div");
  progressBar.className = "reveal-progress-bar";
  const progressFill = document.createElement("div");
  progressFill.className = "reveal-progress-fill";
  progressBar.appendChild(progressFill);
  acceptBar.appendChild(progressBar);

  content.appendChild(acceptBar);
  overlay.appendChild(content);

  // Client-side countdown display
  let remaining = 5;
  clearInterval(window._revealCountdownTimer);
  window._revealCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(window._revealCountdownTimer);
      countdownEl.textContent = "\uD83C\uDF4C Shuffling...";
    } else {
      countdownEl.textContent = `Shuffling... Starting in ${remaining}`;
    }
    progressFill.style.width = `${((5 - remaining) / 5) * 100}%`;
  }, 1000);
}

function updateRevealAcceptStatus() {
  // No-op: reveal now uses a timed countdown
}

function hideReveal() {
  const overlay = document.getElementById("reveal-overlay");
  if (overlay.style.display !== "flex") return;
  if (window._revealCountdownTimer) {
    clearInterval(window._revealCountdownTimer);
    window._revealCountdownTimer = null;
  }
  overlay.style.display = "none";
  overlay.innerHTML = "";
  _revealShown = false;
}

// ── Lobby ──────────────────────────────────────────────────────────

function showLobby() {
  showScreen("screen-lobby");
  _prevLogLen = 0;

  // Game code (click to copy)
  const codeEl = document.getElementById("lobby-code");
  codeEl.textContent = gs.gameId;
  codeEl.parentElement.onclick = () => {
    navigator.clipboard.writeText(gs.gameId).then(() => {
      codeEl.classList.add("copied");
      setTimeout(() => codeEl.classList.remove("copied"), 1200);
    });
  };

  // Settings summary (non-host read-only view)
  const settingsEl = document.getElementById("lobby-settings");
  const modeLabel = gs.gameMode === "teams" ? "2v2 Teams" : "Free for All";
  const petModeLabel = gs.petMode === "limited" ? "Limited Uses" : "Cooldown";
  settingsEl.innerHTML = `
    <div class="lobby-setting">\ud83c\udf4c <span class="lobby-setting-val">${gs.startingMoney || 500}</span></div>
    <div class="lobby-setting">\ud83d\udc65 <span class="lobby-setting-val">${gs.maxPlayers || 4} max</span></div>
    <div class="lobby-setting">\ud83c\udfae <span class="lobby-setting-val">${modeLabel}</span></div>
    <div class="lobby-setting">\ud83d\udc3e <span class="lobby-setting-val">${petModeLabel}</span></div>
    ${gs.gameMode === "teams" ? `<div class="lobby-setting">\u2b50 <span class="lobby-setting-val">Win: Buy the Super Banana (7777\ud83c\udf4c)</span></div>` : ""}
    ${gs.scouting ? '<div class="lobby-setting">\ud83d\udd0d <span class="lobby-setting-val">Scouting</span></div>' : ""}
    ${gs.simpleAuction ? '<div class="lobby-setting">\ud83c\udff7\ufe0f <span class="lobby-setting-val">Simple Auction</span></div>' : ""}
    ${gs.bombMode ? '<div class="lobby-setting">\ud83d\udca3 <span class="lobby-setting-val">Bomb Mode</span></div>' : ""}
    ${gs.monkeyPoker ? '<div class="lobby-setting">\ud83d\udc35 <span class="lobby-setting-val">Monkey Poker</span></div>' : ""}
    ${!gs.monkeyPoker ? '<div class="lobby-setting">\ud83c\udccf <span class="lobby-setting-val">Real Poker</span></div>' : ""}
  `;

  // Host settings controls
  const controlsEl = document.getElementById("lobby-settings-controls");
  const isHost = myId === gs.admin;
  if (isHost) {
    controlsEl.style.display = "";
    settingsEl.style.display = "none";
    const lobbyBananas = document.getElementById("lobby-bananas");
    const lobbyMode = document.getElementById("lobby-mode");
    const lobbyMax = document.getElementById("lobby-max");
    // Sync controls to current game state without triggering events
    _syncingLobby = true;
    try {
      lobbyBananas.value = String(gs.startingMoney || 3333);
      document.getElementById("lobby-bananas-display").textContent =
        gs.startingMoney || 3333;
      lobbyMode.value = gs.gameMode || "ffa";
      if (gs.gameMode === "teams") {
        lobbyMax.value = "4";
        lobbyMax.disabled = true;
      } else {
        lobbyMax.value = String(gs.maxPlayers || 4);
        lobbyMax.disabled = false;
      }
      document.getElementById("lobby-petmode").value = gs.petMode || "cooldown";
    } finally {
      _syncingLobby = false;
    }
  } else {
    controlsEl.style.display = "none";
    settingsEl.style.display = "";
  }

  // Player count
  const countEl = document.getElementById("lobby-count");
  countEl.textContent = `(${gs.players.length}/${gs.maxPlayers || 4})`;

  // Monkey emoji map
  const monkeyEmoji = {
    brown: "\ud83d\udc35",
    golden: "\ud83d\udc12",
    silver: "\ud83e\udda7",
    red: "\ud83e\udde8",
  };
  const colorNames = {
    brown: "Brown",
    golden: "Golden",
    silver: "Silver",
    red: "Red",
  };

  // Player list
  const list = document.getElementById("lobby-players");
  list.innerHTML = "";
  gs.players.forEach((p, idx) => {
    const div = document.createElement("div");
    const isMe = p.id === myId;
    div.className = "lobby-player" + (isMe ? " lobby-player-me" : "");
    const emoji = monkeyEmoji[p.color] || "\ud83d\udc35";
    const role =
      p.id === gs.admin
        ? '<span class="lobby-player-role">\ud83d\udc51 Host</span>'
        : "";
    const editHint = "";
    const teamTag =
      gs.gameMode === "teams"
        ? `<span class="lobby-team-tag">${idx < 2 ? "Team A" : "Team B"}</span>`
        : "";
    const petBadge = p.pet
      ? p.pet === "hidden"
        ? `<span class="lobby-pet-badge">\u2713 Pet chosen</span>`
        : `<span class="lobby-pet-badge">${PET_EMOJIS[p.pet] || "\ud83d\udc3e"} ${PET_NAMES[p.pet] || ""}</span>`
      : "";
    div.innerHTML = `
      <div class="lobby-player-avatar c-${p.color}">${emoji}</div>
      <div class="lobby-player-info">
        <div class="lobby-player-name">${p.name}${editHint}</div>
        ${role}${teamTag}${petBadge}
      </div>
    `;

    list.appendChild(div);
  });

  // Empty slots
  const maxP = gs.maxPlayers || 4;
  for (let i = gs.players.length; i < maxP; i++) {
    const slot = document.createElement("div");
    slot.className = "lobby-slot-empty";
    const teamTag =
      gs.gameMode === "teams"
        ? `<span class="lobby-team-tag">${i < 2 ? "Team A" : "Team B"}</span>`
        : "";
    slot.innerHTML =
      '<div class="lobby-slot-empty-dot">?</div><span>Waiting\u2026</span>' +
      teamTag;
    list.appendChild(slot);
  }

  // Waiting indicator
  const waitingEl = document.getElementById("lobby-waiting");
  if (gs.gameMode === "teams") {
    waitingEl.style.display = gs.players.length < 4 ? "flex" : "none";
  } else {
    waitingEl.style.display = gs.players.length < 2 ? "flex" : "none";
  }

  const btn = document.getElementById("btn-start");
  const allHavePets = gs.players.every((p) => p.pet);
  if (gs.gameMode === "teams") {
    btn.disabled = !(
      myId === gs.admin &&
      gs.players.length === 4 &&
      allHavePets
    );
  } else {
    btn.disabled = !(
      myId === gs.admin &&
      gs.players.length >= 2 &&
      allHavePets
    );
  }
  if (myId === gs.admin && !allHavePets && gs.players.length >= 2) {
    btn.title = "All players must pick a pet first";
  } else {
    btn.title = "";
  }

  // Update pet selection highlight
  updateLobbyPets();
}

function toggleColorPicker(playerEl, currentColor) {
  // If picker already open, close it
  const existing = playerEl.querySelector(".lobby-color-picker");
  if (existing) {
    existing.remove();
    return;
  }
  // Close any other open picker
  document.querySelectorAll(".lobby-color-picker").forEach((el) => el.remove());

  const monkeyEmoji = {
    brown: "\ud83d\udc35",
    golden: "\ud83d\udc12",
    silver: "\ud83e\udda7",
    red: "\ud83e\udde8",
  };
  const colors = ["brown", "golden", "silver", "red"];

  const picker = document.createElement("div");
  picker.className = "lobby-color-picker";
  colors.forEach((c) => {
    const opt = document.createElement("button");
    opt.className =
      "lobby-color-option" + (c === currentColor ? " active" : "");
    opt.innerHTML = `<span class="lobby-color-dot c-${c}">${monkeyEmoji[c]}</span>`;
    opt.onclick = (e) => {
      e.stopPropagation();
      if (c !== currentColor) {
        socket.emit("change_color", { gameId, color: c });
      }
      picker.remove();
    };
    picker.appendChild(opt);
  });
  playerEl.appendChild(picker);
}

// ── Pet Selection ──────────────────────────────────────────────────

const PET_EMOJIS = {
  strong: "\ud83e\udd81",
  energy: "\ud83d\udc06",
  devil: "\ud83e\udd84",
};
const PET_NAMES = {
  strong: "Strong Pet",
  energy: "Energy Pet",
  devil: "Magic Pet",
};

function selectPet(petType) {
  if (!socket || !gameId) return;
  socket.emit("select_pet", { gameId, petType });
}

function usePet() {
  if (!socket || !gameId || !gs) return;
  const me = gs.players.find((p) => p.id === myId);
  if (!me || !me.pet) return;
  if (gs.petMode === "limited") {
    if ((me.petUses || 0) <= 0) return;
  } else {
    if (me.petCooldown > 0) return;
  }
  if (me.pet === "devil") {
    const sel = document.getElementById("pet-target");
    const targetId = sel.value;
    if (!targetId) return;
    socket.emit("use_pet", { gameId, targetId });
  } else {
    socket.emit("use_pet", { gameId });
  }
}

function updateLobbyPets() {
  const petSection = document.getElementById("lobby-pet-section");
  if (!petSection || !gs) return;
  const me = gs.players.find((p) => p.id === myId);
  if (!me) return;

  // Highlight selected pet card
  const cards = document.querySelectorAll(".lobby-pet-card");
  cards.forEach((card) => {
    const pet = card.getAttribute("data-pet");
    card.classList.toggle("lobby-pet-selected", me.pet === pet);
  });

  // Update descriptions based on pet mode
  const isLimited = gs.petMode === "limited";
  const descs = document.querySelectorAll(".lobby-pet-desc");
  descs.forEach((desc) => {
    const cd = desc.getAttribute("data-cd-desc");
    const lim = desc.getAttribute("data-lim-desc");
    if (cd && lim) desc.textContent = isLimited ? lim : cd;
  });
}

function updatePetAbilityBox(me, isMyTurn, isPicking) {
  const box = document.getElementById("pet-ability-box");
  if (!box || !me) {
    if (box) box.style.display = "none";
    return;
  }

  if (!me.pet || isPicking || gs.state === "finished") {
    box.style.display = "none";
    return;
  }

  box.style.display = "";
  const info = document.getElementById("pet-ability-info");
  const targetSel = document.getElementById("pet-target");
  const toggleLabel = document.getElementById("pet-toggle-label");
  const toggleText = document.getElementById("pet-toggle-text");
  const petBtn = document.getElementById("btn-auto-pet");

  const petEmoji = PET_EMOJIS[me.pet] || "\ud83d\udc3e";
  const petName = PET_NAMES[me.pet] || "Pet";

  const isLimited = gs.petMode === "limited";
  const petUsable = isLimited ? (me.petUses || 0) > 0 : me.petCooldown <= 0;

  // Show last coin flip result near toggle
  const flipResultEl = document.getElementById("pet-flip-result");
  if (flipResultEl) {
    if (gs.petCoinFlip) {
      const isHeads = gs.petCoinFlip.result === "heads";
      flipResultEl.textContent = isHeads ? "✅ HEADS" : "❌ TAILS";
      flipResultEl.style.color = isHeads ? "#4caf50" : "#ff5555";
      flipResultEl.style.display = "";
    } else {
      flipResultEl.style.display = "none";
    }
  }

  if (!petUsable) {
    // On cooldown or out of uses — show dimmed toggle with cooldown info
    if (toggleLabel) {
      toggleLabel.classList.remove("pet-toggle-disabled");
      toggleLabel.classList.add("pet-toggle-cooldown");
    }
    if (petBtn) {
      petBtn.disabled = true;
      petBtn.dataset.armed = "false";
    }
    targetSel.style.display = "none";
    if (isLimited) {
      info.textContent = `${petEmoji} ${petName} — No uses left`;
      if (toggleText) toggleText.textContent = "No uses left";
    } else {
      info.textContent = `${petEmoji} ${petName} — Cooldown: ${me.petCooldown} turn${me.petCooldown !== 1 ? "s" : ""}`;
      if (toggleText)
        toggleText.textContent = `⏳ ${me.petCooldown} turn${me.petCooldown !== 1 ? "s" : ""}`;
    }
  } else {
    // Ready
    if (toggleLabel) {
      toggleLabel.classList.remove("pet-toggle-disabled");
      toggleLabel.classList.remove("pet-toggle-cooldown");
    }
    if (petBtn) {
      // Energy/Strong pet: disable on your turn or if already pending
      if (me.pet === "energy" || me.pet === "strong") {
        petBtn.disabled = isMyTurn || !!me.pendingPet;
      } else {
        petBtn.disabled = isMyTurn;
      }
    }
    if (isLimited) {
      info.textContent = `${petEmoji} ${petName} — ${me.petUses} use${me.petUses !== 1 ? "s" : ""} left`;
    } else {
      info.textContent = `${petEmoji} ${petName} — Ready!`;
    }
    if (toggleText) {
      if ((me.pet === "energy" || me.pet === "strong") && me.pendingPet) {
        toggleText.textContent = "\ud83d\udc3e Pet acting next turn!";
      } else if (petBtn && petBtn.dataset.armed === "true") {
        toggleText.textContent = "\ud83d\udc3e Pet acting next turn!";
      } else {
        toggleText.textContent =
          me.pet === "energy" || me.pet === "strong"
            ? "Use Pet"
            : "Use Pet Next Turn";
      }
    }

    // Magic pet needs a target selector when toggle is on
    const autoPetChecked = petBtn && petBtn.dataset.armed === "true";
    if (me.pet === "devil") {
      targetSel.style.display = autoPetChecked ? "" : "none";
      if (autoPetChecked && targetSel.options.length === 0) {
        targetSel.innerHTML = "";
        const opponents = gs.players.filter((p) => {
          if (p.id === myId || p.bankrupt) return false;
          if (gs.gameMode === "teams" && gs.teams) {
            const myTeam = gs.teams.A.includes(myId) ? "A" : "B";
            return !gs.teams[myTeam].includes(p.id);
          }
          return true;
        });
        opponents.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${MONKEY_EMOJI[p.color] || "\ud83d\udc35"} ${p.name}`;
          targetSel.appendChild(opt);
        });
      }
    } else {
      targetSel.style.display = "none";
    }
  }
}

// ── Game Screen ────────────────────────────────────────────────────

function showGame() {
  showScreen("screen-game");

  // Welcome message on first render
  if (!window._chatWelcomeSent) {
    window._chatWelcomeSent = true;
    const container = document.getElementById("board-chat-messages");
    if (container) {
      const msg = document.createElement("div");
      msg.className = "board-chat-msg";
      const nameSpan = document.createElement("span");
      nameSpan.className = "board-chat-name";
      nameSpan.style.color = "#ffe135";
      nameSpan.textContent = "🍌";
      const textSpan = document.createElement("span");
      textSpan.className = "board-chat-text";
      textSpan.textContent = "Welcome To Monkey Business!";
      msg.appendChild(nameSpan);
      msg.appendChild(textSpan);
      container.appendChild(msg);
    }
  }

  const isPicking = gs.state === "picking";
  const cur = gs.currentPlayer;
  const me = gs.players.find((p) => p.id === myId);
  const isMyTurn = !isPicking && cur && cur.id === myId;

  // Turn info
  if (isPicking) {
    const picker = gs.currentPicker;
    const isMyPick = picker && picker.id === myId;
    document.getElementById("turn-name").textContent = isMyPick
      ? "Your turn to scout!"
      : `${picker?.name || "..."} is scouting`;
    document.getElementById("turn-name").style.color = isMyPick
      ? "#ffe135"
      : "#aaa";
  } else {
    const isMyTurnLabel = cur && cur.id === myId;
    document.getElementById("turn-name").textContent = cur
      ? isMyTurnLabel
        ? "Your turn!"
        : cur.name
      : "—";
    document.getElementById("turn-name").style.color = isMyTurnLabel
      ? "#ffe135"
      : cur
        ? ""
        : "#888";
  }

  // Dice
  const die1El = document.getElementById("die1");
  const die2El = document.getElementById("die2");
  const coinEl = document.getElementById("coin");
  // Brief delay before allowing dice roll at the start of each turn
  const ROLL_DELAY = 2000;
  const turnKey2 = `${gs.turn}-${isMyTurn}`;
  if (isMyTurn && !gs.diceRolled && turnKey2 !== window._lastRollDelayKey) {
    window._lastRollDelayKey = turnKey2;
    window._rollReady = false;
    clearTimeout(window._rollDelayTimer);
    window._rollDelayTimer = setTimeout(() => {
      window._rollReady = true;
      // Re-render to enable roll button
      route();
    }, ROLL_DELAY);
  }
  const rollDelayDone = window._rollReady || gs.diceRolled;
  const canRoll =
    !isPicking &&
    isMyTurn &&
    !gs.diceRolled &&
    !gs.mushroomPending &&
    !gs.petResolving &&
    rollDelayDone;
  document.getElementById("btn-roll").disabled = !canRoll;
  document.getElementById("btn-debug-move").disabled = !canRoll;

  // Auto-roll: trigger dice roll when it's our turn and we haven't rolled yet
  if (canRoll && document.getElementById("chk-auto-roll").checked) {
    if (!window._autoRollQueued) {
      window._autoRollQueued = true;
      setTimeout(() => {
        window._autoRollQueued = false;
        if (document.getElementById("chk-auto-roll").checked) rollDice();
      }, 100);
    }
  }

  // 3D die transform map: rotate cube so the correct face points toward viewer
  const DIE_TRANSFORMS = {
    1: "rotateX(0deg) rotateY(0deg)",
    2: "rotateX(0deg) rotateY(-90deg)",
    3: "rotateX(-90deg) rotateY(0deg)",
    4: "rotateX(90deg) rotateY(0deg)",
    5: "rotateX(0deg) rotateY(90deg)",
    6: "rotateX(0deg) rotateY(180deg)",
  };
  function setDieFace(dieEl, value) {
    const v = parseInt(value, 10);
    if (v >= 1 && v <= 6) {
      dieEl.style.transform = DIE_TRANSFORMS[v];
    }
  }

  // Universal dice roll notification — show for all players when dice are rolled
  const diceNotif = document.getElementById("dice-roll-notification");
  if (diceNotif && gs.diceRolled && cur) {
    const diceKey = `${gs.turn}-${gs.dice[0]}-${gs.dice[1]}-${gs.dice[2]}`;
    if (diceKey !== window._lastDiceKey) {
      window._lastDiceKey = diceKey;
      // Freeze token positions and tile reveals at pre-roll state during animation
      window._diceRollingPositions = window._prevPlayerPositions || null;
      window._diceRollingRevealed = window._prevRevealedTiles || null;
      // Freeze banana piles and track which tiles the token has visited
      window._frozenBananaPiles = window._prevBananaPileState || null;
      window._tokenVisitedTiles = new Set();
      window._walkingPlayerId = cur.id;
      window._walkingLandingPos = cur.position;
      // Freeze money display at pre-roll value
      window._frozenMoney =
        window._prevMoney != null ? window._prevMoney : null;
      // Start rolling animation
      die1El.classList.add("rolling");
      die2El.classList.add("rolling");
      const rollDuration = 550;
      const rollInterval = 70;
      let elapsed = 0;
      const ticker = setInterval(() => {
        // Only randomize the coin during animation; dice faces handled by CSS 3D spin
        const fakeCoin = Math.random() < 0.5;
        coinEl.classList.toggle("coin-minus", !fakeCoin);
        elapsed += rollInterval;
        if (elapsed >= rollDuration) {
          clearInterval(ticker);
          setDieFace(die1El, gs.dice[0]);
          setDieFace(die2El, gs.dice[1]);
          coinEl.classList.toggle("coin-minus", gs.dice[2] === -1);
          die1El.classList.remove("rolling");
          die2El.classList.remove("rolling");
          // Store final transform for bounce animation
          die1El.style.setProperty("--die-final", DIE_TRANSFORMS[gs.dice[0]]);
          die2El.style.setProperty("--die-final", DIE_TRANSFORMS[gs.dice[1]]);
          // Step-by-step token walk to final position
          const total = gs.dice[0] + gs.dice[1] + gs.dice[2];
          const coinColor = gs.dice[2] === 0 ? "#ffe135" : "#ff4444";
          const coinLabel = gs.dice[2] === 0 ? "+0" : "-1";
          const rollText = `🎲 ${cur.name} rolled ${gs.dice[0]}+${gs.dice[1]}<span style="color:${coinColor}">${coinLabel}</span> = ${total}`;
          const startPos =
            window._diceRollingPositions &&
            window._diceRollingPositions[cur.id] != null
              ? window._diceRollingPositions[cur.id]
              : cur.position;
          const steps = (cur.position - startPos + 52 + 52) % 52 || total;
          let step = 0;
          // Keep reveals frozen during walk, but let token move
          window._diceRollingRevealed = window._diceRollingRevealed || null;
          const walkInterval = setInterval(() => {
            step++;
            playMoveTickSound();
            if (step >= steps) {
              clearInterval(walkInterval);
              // Fully unfreeze positions and reveals
              window._diceRollingPositions = null;
              window._diceRollingRevealed = null;
              window._tokenWalking = false;
              window._frozenMoney = null;
              window._walkingPlayerId = null;
              window._walkingLandingPos = null;
              // Check if landing on a GROW tile — keep piles frozen briefly
              const landTile = gs.boardLayout && gs.boardLayout[cur.position];
              if (
                landTile &&
                landTile.type === "grow" &&
                window._frozenBananaPiles
              ) {
                // Show token on GROW first, then reveal updated piles
                window._tokenVisitedTiles = null;
                renderBoard(gs);
                setTimeout(() => {
                  window._frozenBananaPiles = null;
                  renderBoard(gs);
                }, 600);
              } else {
                window._frozenBananaPiles = null;
                window._tokenVisitedTiles = null;
                renderBoard(gs);
              }
              // Brief pause so the player sees the landing before auction/poker/notifications
              setTimeout(() => {
                updateAuctionPanel();
                updatePokerTable();
                // Re-run showGame to update money display and trigger pending notifications
                route();
              }, 500);
            } else {
              // Move token one tile forward
              const intermediatePos = (startPos + step) % 52;
              window._diceRollingPositions = window._diceRollingPositions || {};
              window._diceRollingPositions[cur.id] = intermediatePos;
              // Mark this tile as visited so its banana pile disappears
              if (window._tokenVisitedTiles) {
                window._tokenVisitedTiles.add(intermediatePos);
              }
              renderBoard(gs);
            }
          }, 150);
          window._tokenWalking = true;
          // Show result notification after dice settle
          diceNotif.innerHTML = rollText;
          diceNotif.classList.remove("show");
          void diceNotif.offsetWidth;
          diceNotif.classList.add("show");
          clearTimeout(window._diceNotifTimer);
          window._diceNotifTimer = setTimeout(
            () => diceNotif.classList.remove("show"),
            2000,
          );
        }
      }, rollInterval);
      playDiceRoll();
      // Show rolling text immediately
      diceNotif.textContent = `🎲 ${cur.name} is rolling...`;
      diceNotif.classList.remove("show");
      void diceNotif.offsetWidth;
      diceNotif.classList.add("show");
    } else {
      if (gs.dice[0]) setDieFace(die1El, gs.dice[0]);
      if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
      coinEl.classList.toggle("coin-minus", gs.diceRolled && gs.dice[2] === -1);
    }
  } else {
    if (gs.dice[0]) setDieFace(die1El, gs.dice[0]);
    if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
    coinEl.classList.toggle("coin-minus", gs.diceRolled && gs.dice[2] === -1);
  }

  // Turn notification — show once per turn, keep visible for 1.5s (suppress during pet resolving)
  const notif = document.getElementById("turn-notification");
  if (notif) {
    const turnKey = isMyTurn ? gs.turn : null;
    if (isMyTurn && !gs.petResolving && turnKey !== window._lastNotifTurn) {
      window._lastNotifTurn = turnKey;
      notif.classList.remove("show");
      void notif.offsetWidth; // reset animation
      notif.classList.add("show");
      playTurnChime();
      clearTimeout(window._turnNotifTimer);
      window._turnNotifTimer = setTimeout(
        () => notif.classList.remove("show"),
        1500,
      );
    }
  }

  // Mushroom pending notification (delay until token walk finishes)
  const mushNotif = document.getElementById("mushroom-notification");
  if (mushNotif) {
    if (
      gs.mushroomPending &&
      !window._mushNotifShown &&
      !window._diceRollingPositions &&
      !window._tokenWalking
    ) {
      window._mushNotifShown = true;
      const textEl = document.getElementById("mushroom-notif-text");
      if (textEl) textEl.textContent = "\u2b50 Super Banana Found! \u2b50";
      mushNotif.classList.remove("show");
      void mushNotif.offsetWidth;
      mushNotif.classList.add("show");
      clearTimeout(window._mushPhase2Timer);
      window._mushPhase2Timer = setTimeout(() => {
        if (textEl)
          textEl.textContent =
            "\u2b50 Can't afford it! The Super Banana will swap with another tile and hide...";
      }, 3000);
    } else if (!gs.mushroomPending) {
      window._mushNotifShown = false;
      mushNotif.classList.remove("show");
      clearTimeout(window._mushPhase2Timer);
    }
  }

  // Bomb self-damage notification
  const bombSelfNotif = document.getElementById("bomb-self-notification");
  if (bombSelfNotif) {
    if (gs.bombSelfDamage && gs.bombSelfDamage.playerId === myId) {
      const selfKey = `${gs.turn}-${gs.bombSelfDamage.lost}`;
      if (selfKey !== window._lastBombSelfKey) {
        window._lastBombSelfKey = selfKey;
        bombSelfNotif.textContent = `💣 Caught in your own bomb! Lost ${gs.bombSelfDamage.lost}🍌! 💥`;
        bombSelfNotif.classList.remove("show");
        void bombSelfNotif.offsetWidth;
        bombSelfNotif.classList.add("show");
        clearTimeout(window._bombSelfTimer);
        window._bombSelfTimer = setTimeout(
          () => bombSelfNotif.classList.remove("show"),
          3000,
        );
      }
    } else if (!gs.bombSelfDamage) {
      window._lastBombSelfKey = null;
    }
  }

  // Pet coin flip notification
  const petCoinNotif = document.getElementById("pet-coin-notification");
  if (petCoinNotif && gs.petCoinFlip) {
    const flipKey = `${gs.turn}-${gs.petCoinFlip.playerName}-${gs.petCoinFlip.result}`;
    if (flipKey !== window._lastPetFlipKey) {
      window._lastPetFlipKey = flipKey;
      // Capture flip data locally so setTimeout callbacks don't depend on gs
      const flipData = { ...gs.petCoinFlip };
      const textEl = document.getElementById("pet-coin-text");
      const coinFlipEl = document.getElementById("pet-coin-flip");
      const resultEl = document.getElementById("pet-coin-result");
      const petEmoji =
        flipData.petType === "energy" ? "\ud83d\udc06" : "\ud83e\udd84";
      textEl.textContent = `${petEmoji} ${flipData.playerName}'s ${flipData.petType === "energy" ? "Energy" : "Magic"} Pet`;

      // Reset coin
      coinFlipEl.className = "pet-coin-flipper";
      coinFlipEl.style.animation = "none";
      coinFlipEl.style.transform = "";
      resultEl.className = "pet-coin-result";
      resultEl.textContent = "";

      // Show notification after a short delay so there's a beat before the flip
      petCoinNotif.classList.remove("show");
      clearTimeout(window._petCoinShowTimer);
      window._petCoinShowTimer = setTimeout(() => {
        petCoinNotif.classList.add("show");

        // Start spin after a brief pause
        setTimeout(() => {
          const isHeads = flipData.result === "heads";
          const animName = isHeads ? "petCoinSpin" : "petCoinSpinTails";
          void coinFlipEl.offsetWidth;
          coinFlipEl.style.animation = `${animName} 2.5s cubic-bezier(0.15, 0.8, 0.25, 1) forwards`;

          // Show result after spin settles
          setTimeout(() => {
            coinFlipEl.style.animation = "none";
            coinFlipEl.style.transform = isHeads
              ? "rotateY(0deg)"
              : "rotateY(180deg)";
            if (isHeads) {
              resultEl.classList.add("heads");
              if (flipData.petType === "devil") {
                resultEl.textContent = `\u2705 HEADS \u2014 ${flipData.targetName} pushed!`;
              } else {
                resultEl.textContent = "\u2705 HEADS \u2014 Moved forward!";
              }
            } else {
              resultEl.classList.add("tails");
              resultEl.textContent = "\u274c TAILS \u2014 No effect!";
            }
            resultEl.classList.add("visible");
          }, 2600);
        }, 250);

        // Auto-hide after spin + result display (7200ms from when notification appears)
        clearTimeout(window._petCoinTimer);
        window._petCoinTimer = setTimeout(() => {
          petCoinNotif.classList.remove("show");
        }, 7200);
      }, 1000);
    }
  }

  // Auction win notification
  const auctionNotif = document.getElementById("auction-won-notification");
  if (auctionNotif) {
    if (gs.auction) {
      window._lastAuctionPos = gs.auction.position;
      window._lastAuctionSimple = gs.auction.simple;
    } else if (window._lastAuctionPos != null) {
      const wonProp = gs.players.find((p) => p.id === myId);
      if (wonProp && wonProp.properties.includes(window._lastAuctionPos)) {
        if (window._lastAuctionSimple) {
          auctionNotif.textContent =
            "\ud83c\udf34 You Bought the Farm! \ud83c\udf4c";
        } else {
          auctionNotif.textContent =
            "\ud83c\udf89 You Won the Auction! \ud83c\udf4c";
        }
        auctionNotif.classList.remove("show");
        void auctionNotif.offsetWidth;
        auctionNotif.classList.add("show");
        clearTimeout(window._auctionNotifTimer);
        window._auctionNotifTimer = setTimeout(
          () => auctionNotif.classList.remove("show"),
          2000,
        );
      } else {
        // Lost the auction — play loss sound
        playAuctionLoss();
      }
      window._lastAuctionPos = null;
    }
  }

  // Auto-roll disabled for debugging
  if (window._autoRollQueued && !canRoll) {
    window._autoRollQueued = false;
  }

  // My info
  if (me) {
    const displayMoney =
      (window._diceRollingPositions || window._tokenWalking) &&
      window._frozenMoney != null
        ? window._frozenMoney
        : me.money;
    document.getElementById("info-money").textContent = `${displayMoney}🍌`;
    document.getElementById("info-position").textContent =
      `Position: ${me.position}`;
  }

  // End turn (disabled during auction, vine swing, poker, mushroom pending, or auction end delay)
  const canEnd =
    !isPicking &&
    !gs.auction &&
    !gs.vineSwing &&
    !gs.poker &&
    !gs.mushroomPending &&
    !gs.autoEndDelay &&
    isMyTurn &&
    gs.diceRolled;
  // Like canEnd but ignores autoEndDelay — pet can fire during the delay
  // (server's usePetAbility cancels the auto-end timer)
  const canPetFire =
    !isPicking &&
    !gs.auction &&
    !gs.vineSwing &&
    !gs.poker &&
    !gs.mushroomPending &&
    isMyTurn &&
    gs.diceRolled;
  document.getElementById("btn-end").disabled = !canEnd;

  // Show countdown timer on End Turn button when auto-end delay is active
  const btnEnd = document.getElementById("btn-end");
  if (gs.autoEndDelay && gs.autoEndDelayMs > 0) {
    if (!window._autoEndCountdown) {
      window._autoEndCountdownStart = Date.now();
      window._autoEndCountdownMs = gs.autoEndDelayMs;
      window._autoEndCountdown = setInterval(() => {
        const elapsed = Date.now() - window._autoEndCountdownStart;
        const remaining = Math.max(0, window._autoEndCountdownMs - elapsed);
        const secs = Math.ceil(remaining / 1000);
        const btn = document.getElementById("btn-end");
        if (btn) btn.textContent = `End Turn (${secs}s)`;
        if (remaining <= 0) {
          clearInterval(window._autoEndCountdown);
          window._autoEndCountdown = null;
          if (btn) btn.textContent = "End Turn";
        }
      }, 100);
    }
  } else {
    if (window._autoEndCountdown) {
      clearInterval(window._autoEndCountdown);
      window._autoEndCountdown = null;
    }
    btnEnd.textContent = "End Turn";
  }

  // Auto-end: end turn automatically when possible (skip if pet is usable or auto-pet is armed)
  // Respect autoEndDelay so we don't skip the server's 2s pause after auction/pitch
  if (canEnd && document.getElementById("chk-auto-end").checked) {
    const mePetReady =
      me &&
      me.pet &&
      (gs.petMode === "limited" ? (me.petUses || 0) > 0 : me.petCooldown <= 0);
    const petBtn = document.getElementById("btn-auto-pet");
    const petArmed =
      mePetReady &&
      petBtn &&
      petBtn.dataset.armed === "true" &&
      window._petArmedForTurn != null &&
      (gs.turn || 0) >= window._petArmedForTurn;
    if (!mePetReady && !petArmed && !window._autoEndQueued) {
      window._autoEndQueued = true;
      setTimeout(() => {
        window._autoEndQueued = false;
        // Re-check pet usability at execution time to avoid stale timer ending turn
        const meNow = gs && gs.players && gs.players.find((p) => p.id === myId);
        const petReady =
          meNow &&
          meNow.pet &&
          (gs.petMode === "limited"
            ? (meNow.petUses || 0) > 0
            : meNow.petCooldown <= 0);
        if (!petReady && document.getElementById("chk-auto-end").checked)
          endTurn();
      }, 0);
    }
  }

  // Auto-pet: when toggle is on, arm for next turn. Fire after roll resolves (and after auction if applicable).
  const petBtn = document.getElementById("btn-auto-pet");
  if (petBtn) {
    // Energy/Strong pet: fire immediately when toggled off-turn (server handles off-turn activation)
    const petArmedNow = petBtn.dataset.armed === "true";
    if (
      me &&
      (me.pet === "energy" || me.pet === "strong") &&
      petArmedNow &&
      !isMyTurn &&
      !me.pendingPet &&
      !window._autoPetQueued
    ) {
      const mePetReady =
        gs.petMode === "limited" ? (me.petUses || 0) > 0 : me.petCooldown <= 0;
      if (mePetReady) {
        window._autoPetQueued = true;
        setTimeout(() => {
          window._autoPetQueued = false;
          const meNow =
            gs && gs.players && gs.players.find((p) => p.id === myId);
          const petStillReady =
            meNow &&
            (meNow.pet === "energy" || meNow.pet === "strong") &&
            !meNow.pendingPet &&
            (gs.petMode === "limited"
              ? (meNow.petUses || 0) > 0
              : meNow.petCooldown <= 0);
          if (petStillReady && petBtn.dataset.armed === "true") {
            usePet();
            // Toggle stays on until effect resolves at start of next turn
          }
        }, 200);
      }
    }

    // Energy/Strong pet: auto-uncheck toggle once pendingPet resolves on their turn
    if (
      me &&
      (me.pet === "energy" || me.pet === "strong") &&
      me.pendingPet &&
      petBtn.dataset.armed === "true"
    ) {
      petBtn.dataset.armed = "false";
      window._petArmedForTurn = null;
    }

    // Devil: arm for next turn, fire after roll resolves
    if (me && me.pet !== "energy" && me.pet !== "strong") {
      // Detect toggle being turned on: arm for the current turn (effect is deferred to next turn)
      if (petBtn.dataset.armed === "true" && window._petArmedForTurn == null) {
        // Arm: pet will fire this turn after rolling (effect queued for next turn)
        window._petArmedForTurn = gs.turn || 0;
      } else if (petBtn.dataset.armed !== "true") {
        // Toggle turned off — disarm
        window._petArmedForTurn = null;
      }

      // Fire auto-pet when armed turn has arrived, pet is ready
      if (
        canPetFire &&
        petBtn.dataset.armed === "true" &&
        window._petArmedForTurn != null &&
        (gs.turn || 0) >= window._petArmedForTurn
      ) {
        const mePetReady =
          me &&
          me.pet &&
          (gs.petMode === "limited"
            ? (me.petUses || 0) > 0
            : me.petCooldown <= 0);
        if (mePetReady && !window._autoPetQueued) {
          window._autoPetQueued = true;
          setTimeout(() => {
            window._autoPetQueued = false;
            const meNow =
              gs && gs.players && gs.players.find((p) => p.id === myId);
            const petStillReady =
              meNow &&
              meNow.pet &&
              (gs.petMode === "limited"
                ? (meNow.petUses || 0) > 0
                : meNow.petCooldown <= 0);
            if (petStillReady && petBtn.dataset.armed === "true") {
              usePet();
              petBtn.dataset.armed = "false";
              window._petArmedForTurn = null;
            }
          }, 400);
        }
      }
    }
  }

  // Pet ability panel
  updatePetAbilityBox(me, isMyTurn, isPicking);

  // Trade button: visible but disabled when it's your turn
  const tradeBtn = document.getElementById("btn-trade");
  if (tradeBtn) {
    tradeBtn.style.display = "";
    if (isMyTurn) {
      tradeBtn.disabled = true;
      closeTradePanel();
    } else {
      tradeBtn.disabled = false;
    }
  }

  // Bomb buttons
  const buyBombBtn = document.getElementById("btn-buy-bomb");
  const placeBombBtn = document.getElementById("btn-place-bomb");
  if (buyBombBtn) {
    if (gs.bombMode && !me.bomb) {
      buyBombBtn.style.display = "";
      buyBombBtn.disabled = me.money < 5000;
    } else {
      buyBombBtn.style.display = "none";
    }
  }
  if (placeBombBtn) {
    if (gs.bombMode && me.bomb) {
      placeBombBtn.style.display = "";
      placeBombBtn.disabled = isMyTurn;
    } else {
      placeBombBtn.style.display = "none";
    }
  }

  // In team mode: hide jungle log (trade panel replaces it)
  const logBox = document.querySelector(".log-box");
  if (gs.gameMode === "teams") {
    if (logBox) logBox.style.display = "none";
  } else {
    if (logBox) logBox.style.display = "";
  }

  // Auction panel
  updateAuctionPanel();

  // Players list
  const plist = document.getElementById("players-list");
  plist.innerHTML = "";
  if (gs.gameMode === "teams" && gs.teams) {
    // Section off by team
    for (const teamKey of ["A", "B"]) {
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-section team-section-" + teamKey;
      const teamHeader = document.createElement("div");
      teamHeader.className = "team-section-header";
      teamHeader.innerHTML = `<span class="team-section-dot team-${teamKey}"></span> Team ${teamKey}`;
      teamDiv.appendChild(teamHeader);
      const members = gs.teams[teamKey];
      members.forEach((id) => {
        const p = gs.players.find((pl) => pl.id === id);
        if (!p) return;
        const div = document.createElement("div");
        const isMe = p.id === myId;
        div.className = "pstat" + (isMe ? " pstat-me" : "");
        const petTag = p.pet
          ? `<span class="pstat-pet">${PET_EMOJIS[p.pet] || ""}${p.petCooldown > 0 ? p.petCooldown : "✓"}</span>`
          : "";
        div.innerHTML =
          `<div class="pstat-monkey c-${p.color}">${MONKEY_EMOJI[p.color] || "\uD83D\uDC35"}</div>` +
          `<span>${p.name}<span class="team-badge team-${teamKey}">T${teamKey}</span>${petTag}</span>` +
          `<span class="pstat-money">${p.money}🍌</span>`;
        teamDiv.appendChild(div);
      });
      plist.appendChild(teamDiv);
    }
  } else {
    gs.players.forEach((p) => {
      const div = document.createElement("div");
      const isMe = p.id === myId;
      div.className = "pstat" + (isMe ? " pstat-me" : "");
      const petTag = p.pet
        ? `<span class="pstat-pet">${PET_EMOJIS[p.pet] || ""}${p.petCooldown > 0 ? p.petCooldown : "✓"}</span>`
        : "";
      div.innerHTML =
        `<div class="pstat-monkey c-${p.color}">${MONKEY_EMOJI[p.color] || "\uD83D\uDC35"}</div>` +
        `<span>${p.name}${petTag}</span>` +
        `<span class="pstat-money">${p.money}🍌</span>`;
      plist.appendChild(div);
    });
  }

  // Team info: hide (mushroom win replaces team target)
  const teamInfoEl = document.getElementById("team-info");
  if (teamInfoEl) {
    teamInfoEl.style.display = "none";
  }

  // Ownership panel
  updateOwnerPanel();

  // Property chart
  updatePropertyChart();

  // Log (floating panel)
  const logEl = document.getElementById("board-log-messages");
  if (logEl) {
    logEl.innerHTML = "";
    (gs.log || [])
      .slice()
      .reverse()
      .forEach((msg) => {
        const d = document.createElement("div");
        d.textContent = msg;
        logEl.appendChild(d);
      });
    logEl.scrollTop = 0;
  }

  // Banana burst check
  checkBananaBurstTrigger();

  // Board
  renderBoard(gs);

  // Poker table
  updatePokerTable();
}

// ── Owner Panel ────────────────────────────────────────────────────

function updateOwnerPanel() {
  const el = document.getElementById("owner-list");
  if (!el) return;
  el.innerHTML = "";
  const GROUP_NAMES = {
    yellow: "Cavendish",
    lightblue: "Blue Java",
    red: "Red Dacca",
    pink: "Lady Finger",
    orange: "Goldfinger",
    darkblue: "Gros Michel",
  };
  gs.players.forEach((player) => {
    const section = document.createElement("div");
    section.className = "owner-section";

    const ownedIds = player.properties || [];
    let propsHTML;
    if (ownedIds.length === 0) {
      propsHTML = '<div class="owner-empty">No farms yet</div>';
    } else {
      const counts = {};
      const prices = {};
      ownedIds.forEach((id) => {
        const tile = gs.boardLayout && gs.boardLayout[id];
        if (!tile || !tile.group) return;
        counts[tile.group] = (counts[tile.group] || 0) + 1;
        if (!prices[tile.group]) prices[tile.group] = tile.price;
      });
      // Build list of farms per group
      const farmsByGroup = {};
      ownedIds.forEach((id) => {
        const tile = gs.boardLayout && gs.boardLayout[id];
        if (!tile || !tile.group) return;
        if (!farmsByGroup[tile.group]) farmsByGroup[tile.group] = [];
        farmsByGroup[tile.group].push(tile);
      });
      propsHTML = '<div class="owner-props">';
      Object.keys(GROUP_NAMES).forEach((g) => {
        if (!counts[g]) return;
        const bonusPct = (counts[g] - 1) * 10;
        const bonusLabel = bonusPct > 0 ? `+${bonusPct}%` : "";
        propsHTML += `<div class="owner-set-group">`;
        propsHTML += `<div class="owner-set-header"><span class="owner-prop-dot g-${g}"></span><span class="owner-set-name">${GROUP_NAMES[g]}</span>${bonusLabel ? ` <span class="owner-prop-bonus">${bonusLabel}</span>` : ""}</div>`;
        const farms = farmsByGroup[g] || [];
        farms.forEach((f) => {
          const mult = 1 + (counts[g] - 1) * 0.1;
          const effectivePrice = Math.round(f.price * mult);
          propsHTML += `<div class="owner-set-farm"><span class="owner-farm-name">${f.tileName || f.name}</span><span class="owner-prop-price">${effectivePrice}🍌</span></div>`;
        });
        propsHTML += `</div>`;
      });
      propsHTML += "</div>";
    }

    section.innerHTML =
      `<div class="owner-header"><div class="owner-monkey c-${player.color}">${MONKEY_EMOJI[player.color] || "\uD83D\uDC35"}</div>${player.name}</div>` +
      propsHTML;
    el.appendChild(section);
  });
}

// ── Actions ────────────────────────────────────────────────────────

const CHART_GROUPS = [
  { key: "yellow", label: "CV — Cavendish" },
  { key: "lightblue", label: "BJ — Blue Java" },
  { key: "red", label: "RD — Red Dacca" },
  { key: "pink", label: "LF — Lady Finger" },
  { key: "orange", label: "GF — Goldfinger" },
  { key: "darkblue", label: "GM — Gros Michel" },
];

function updatePropertyChart() {
  const el = document.getElementById("property-chart");
  if (!el) return;
  el.innerHTML = "";
  if (!gs || !gs.boardLayout) return;

  // Build map: group -> [{name, price, owner, ownerColor}]
  const grouped = {};
  CHART_GROUPS.forEach((g) => (grouped[g.key] = []));

  gs.boardLayout.forEach((tile, pos) => {
    if (!tile.tileName || !tile.group) return;
    const prop = gs.properties.find((p) => p.id === pos);
    const ownerPlayer =
      prop && prop.owner ? gs.players.find((pl) => pl.id === prop.owner) : null;
    if (!grouped[tile.group]) grouped[tile.group] = [];
    grouped[tile.group].push({
      name: tile.tileName,
      label: tile.tileLabel || null,
      price: tile.price,
      owner: ownerPlayer,
    });
  });

  CHART_GROUPS.forEach(({ key, label }) => {
    const items = grouped[key];
    if (!items || items.length === 0) return;

    // Sort by label number so LF1, LF2, LF3 appear in order
    items.sort((a, b) => {
      const numA = parseInt((a.label || "").replace(/\D/g, "")) || 0;
      const numB = parseInt((b.label || "").replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    const div = document.createElement("div");
    div.className = "chart-group";
    let html = `<div class="chart-group-label"><span class="chart-group-dot g-${key}"></span>${label}</div>`;
    items.forEach((item) => {
      const displayName = item.label || item.name;
      const owned = item.owner ? " chart-owned" : "";
      const ownerDot = item.owner
        ? `<span class="chart-item-owner c-${item.owner.color}">${MONKEY_EMOJI[item.owner.color] || "\uD83D\uDC35"}</span>`
        : "";
      html += `<div class="chart-item${owned}"><span class="chart-item-name">${displayName}</span><span class="chart-item-price">${item.price}🍌 yield</span>${ownerDot}</div>`;
    });
    div.innerHTML = html;
    el.appendChild(div);
  });

  updateTileLegend();
}

function updateTileLegend() {
  const el = document.getElementById("tile-legend");
  if (!el || !gs || !gs.boardLayout) return;
  el.innerHTML = "";

  const counts = { grow: 0, bus: 0, tax: 0, tax10: 0, desert: 0, special: 0 };
  for (const tile of gs.boardLayout) {
    if (counts[tile.type] !== undefined) counts[tile.type]++;
  }

  const entries = [
    { icon: "🌴", name: "GROW", count: counts.grow },
    { icon: "🌿", name: "Vine Swing", count: counts.bus },
    { icon: "🍌", name: "-10% Peel", count: counts.tax10 },
    { icon: "🍌", name: "-15% Peel", count: counts.tax },
    { icon: "🌵", name: "Desert", count: counts.desert },
    { icon: "\u2b50", name: "Super Banana", count: counts.special },
  ];

  for (const e of entries) {
    if (e.count === 0) continue;
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<span class="legend-icon">${e.icon}</span><span class="legend-name">${e.name}</span><span class="legend-count">×${e.count}</span>`;
    el.appendChild(row);
  }
}

// ── Actions (cont.) ────────────────────────────────────────────────

function createGame() {
  const name = document.getElementById("create-name").value.trim() || "Player";
  const max = parseInt(document.getElementById("create-max").value);
  const bananas =
    parseInt(document.getElementById("create-bananas").value) || 2222;
  const scouting = document.getElementById("create-scouting").checked;
  const gameMode = document.getElementById("create-mode").value;
  const petMode = document.getElementById("create-petmode").value;
  const simpleAuction = document.getElementById(
    "create-simple-auction",
  ).checked;
  const bombMode = document.getElementById("create-bomb-mode").checked;
  const monkeyPoker = document.getElementById("create-monkey-poker").checked;
  if (!socket.connected)
    return alert("Connecting to server, please try again.");
  socket.emit("create_game", {
    playerName: name,
    maxPlayers: max,
    startingMoney: bananas,
    scouting,
    gameMode,
    petMode,
    simpleAuction,
    bombMode,
    monkeyPoker,
  });
}

function pasteCode() {
  navigator.clipboard
    .readText()
    .then((text) => {
      const code = text.trim().replace(/\D/g, "").substring(0, 6);
      if (code) document.getElementById("join-code").value = code;
    })
    .catch(() => alert("Could not read clipboard. Paste manually."));
}

function joinGame() {
  const code = document.getElementById("join-code").value.trim();
  const name = document.getElementById("join-name").value.trim() || "Player";
  if (!code) return alert("Enter a game code.");
  if (!socket.connected)
    return alert("Connecting to server, please try again.");
  gameId = code;
  socket.emit("join_game", {
    gameId: code,
    playerName: name,
  });
}

function startGame() {
  socket.emit("start_game", { gameId });
}

function rollDice() {
  socket.emit("roll_dice", { gameId });
}

function debugMove() {
  const pos = parseInt(document.getElementById("debug-tile").value);
  if (isNaN(pos) || pos < 0 || pos > 51) return;
  socket.emit("debug_move", { gameId, position: pos });
}

function debugShuffle() {
  socket.emit("debug_shuffle", { gameId });
}

function debugResetPet() {
  socket.emit("debug_reset_pet", { gameId });
}

function debugAddBananas() {
  socket.emit("debug_add_bananas", { gameId });
}

function _getBidMax() {
  const me = gs && gs.players ? gs.players.find((p) => p.id === myId) : null;
  return me ? me.money : 500;
}

function bidKeyPress(digit) {
  playTickSound();
  const input = document.getElementById("bid-amount");
  // If the value was auto-filled, clear it so the user starts fresh
  let cur;
  if (window._bidAutoFilled) {
    cur = "";
    window._bidAutoFilled = false;
  } else {
    cur = input.value === "0" ? "" : input.value;
  }
  const next = cur + digit;
  const num = parseInt(next) || 0;
  const max = _getBidMax();
  input.value = String(Math.min(num, max));
}

function bidKeyClear() {
  playTickSound();
  window._bidAutoFilled = false;
  document.getElementById("bid-amount").value = "0";
}

function bidKeyBackspace() {
  playTickSound();
  window._bidAutoFilled = false;
  const input = document.getElementById("bid-amount");
  const cur = input.value;
  input.value = cur.length <= 1 ? "0" : cur.slice(0, -1);
}

function setBidHalf() {
  playTickSound();
  window._bidAutoFilled = false;
  const input = document.getElementById("bid-amount");
  const half = Math.max(0, Math.floor(_getBidMax() / 2));
  input.value = String(half);
}

function setBidMax() {
  playTickSound();
  window._bidAutoFilled = false;
  document.getElementById("bid-amount").value = String(_getBidMax());
}

function setBidOpponentBankPlus1() {
  playTickSound();
  if (!gs || !gs.auction) return;
  const me = gs.players.find((p) => p.id === myId);
  if (!me) return;
  const opponents = gs.players.filter((p) => p.id !== myId && !p.bankrupt);
  if (!opponents.length) return;
  const maxOppBank = Math.max(...opponents.map((p) => p.money));
  const bid = Math.min(maxOppBank + 1, me.money);
  document.getElementById("bid-amount").value = String(bid);
}

function showBidToast(msg) {
  const toast = document.getElementById("bid-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(window._bidToastTimer);
  window._bidToastTimer = setTimeout(
    () => toast.classList.remove("show"),
    2000,
  );
}

function placeBid() {
  const input = document.getElementById("bid-amount");
  const amount = parseInt(input.value) || 0;
  if (amount < 0) return;

  // Minimum 1 banana (unless player is broke)
  const me = gs && gs.players && gs.players.find((p) => p.id === myId);
  if (amount < 1 && me && me.money > 0) {
    showBidToast("1🍌 minimum!");
    return;
  }

  // Client-side check: challengers must bid more than lander's opening bid
  if (
    gs &&
    gs.auction &&
    gs.auction.phase === "challenger-bid" &&
    myId !== gs.auction.landingPlayer
  ) {
    if (
      gs.auction.landerOpenBid != null &&
      amount <= gs.auction.landerOpenBid
    ) {
      showBidToast(
        `Bid too low! Must be more than ${gs.auction.landerOpenBid}🍌`,
      );
      return;
    }
  }
  // Client-side check: lander second bid must exceed their opening bid
  if (
    gs &&
    gs.auction &&
    gs.auction.phase === "lander-second" &&
    myId === gs.auction.landingPlayer
  ) {
    if (
      gs.auction.landerOpenBid != null &&
      amount <= gs.auction.landerOpenBid
    ) {
      showBidToast(
        `Bid too low! Must be more than ${gs.auction.landerOpenBid}🍌`,
      );
      return;
    }
  }
  window._myLastBid = amount;
  socket.emit("place_bid", { gameId, amount });
  input.value = "0";
}

function passBid() {
  socket.emit("pass_bid", { gameId });
}

function respondAuction(accept) {
  socket.emit("respond_auction", { gameId, accept });
}

function updateAuctionPanel() {
  const box = document.getElementById("auction-box");
  if (!gs || !gs.auction) {
    box.style.display = "none";
    window._auctionBidPhase = null;
    window._myLastBid = null;
    window._auctionDelayShown = false;
    window._challengerRevealDone = false;
    window._challengerRevealTimer = null;
    return;
  }
  // Delay showing auction until dice animation finishes (tokens reach destination)
  if (window._diceRollingPositions && !window._auctionDelayShown) {
    box.style.display = "none";
    return;
  }
  window._auctionDelayShown = true;

  const a = gs.auction;
  const myBid = a.bids[myId];
  const isChallenger = a.phase === "challenger-bid" && myId !== a.landingPlayer;

  // Update auction title
  const titleEl = document.getElementById("auction-title");
  if (titleEl)
    titleEl.textContent = a.simple
      ? "\uD83C\uDFF7\uFE0F PRICE IT \uD83C\uDFF7\uFE0F"
      : "\uD83C\uDF4C BANANA BID \uD83C\uDF4C";

  // Challenger reveal delay: show lander's bid for 2s before showing controls
  if (isChallenger && !window._challengerRevealDone) {
    box.style.display = "block";
    // Show the lander bid reveal splash
    const propEl = document.getElementById("auction-prop");
    propEl.textContent = `Farm #${a.position} (hidden)`;
    propEl.className = "auction-prop";
    const highEl = document.getElementById("auction-high");
    const landerName =
      gs.players.find((p) => p.id === a.landingPlayer)?.name || "Lander";
    highEl.textContent = `${landerName} bid ${a.landerOpenBid}\uD83C\uDF4C`;
    document.getElementById("auction-turn").textContent = "";
    document.getElementById("auction-controls").style.display = "none";
    const passBtn = document.getElementById("btn-pass");
    if (passBtn) passBtn.style.display = "none";
    document.getElementById("auction-bids").innerHTML = "";
    if (!window._challengerRevealTimer) {
      window._challengerRevealTimer = setTimeout(() => {
        window._challengerRevealDone = true;
        window._challengerRevealTimer = null;
        updateAuctionPanel();
      }, 2000);
    }
    return;
  }

  box.style.display = "block";

  const propEl = document.getElementById("auction-prop");
  if (myId === a.landingPlayer && a.propName) {
    propEl.textContent = `${a.propName} \u2014 ${a.propPrice}\uD83C\uDF4C yield`;
    propEl.className = a.propGroup
      ? "auction-prop g-" + a.propGroup
      : "auction-prop";
  } else {
    propEl.textContent = `Farm #${a.position} (hidden)`;
    propEl.className = "auction-prop";
  }

  // Phase-dependent header text
  const highEl = document.getElementById("auction-high");
  // Simple auction response controls
  const simpleControls = document.getElementById("simple-auction-controls");
  if (simpleControls) simpleControls.style.display = "none";

  if (a.phase === "simple-bid") {
    highEl.textContent =
      myId === a.landingPlayer
        ? "You landed here \u2014 name your price! \uD83C\uDF4C"
        : "Waiting for lander to name a price...";
  } else if (a.phase === "simple-respond") {
    if (myId === a.landingPlayer) {
      highEl.textContent = `You priced it at ${a.landerOpenBid}\uD83C\uDF4C \u2014 waiting for response...`;
    } else {
      highEl.textContent = `Lander priced it at ${a.landerOpenBid}\uD83C\uDF4C \u2014 accept or decline?`;
      const ob = a.bids[myId];
      if (simpleControls && ob && !ob.placed && !ob.passed) {
        simpleControls.style.display = "flex";
      }
    }
  } else if (a.phase === "simple-tiebreak") {
    const isTiebreaker = (a.tiebreakBidders || []).includes(myId);
    if (isTiebreaker) {
      highEl.textContent = `Tie! Silent bid tiebreaker \u2014 highest bid wins the right to buy at ${a.landerOpenBid}\uD83C\uDF4C`;
    } else {
      highEl.textContent =
        "Tiebreaker in progress \u2014 waiting for silent bids...";
    }
  } else if (a.phase === "lander-bid") {
    highEl.textContent =
      myId === a.landingPlayer
        ? "You landed here \u2014 place your opening bid! \uD83C\uDF4C"
        : "Waiting for lander to place their opening bid...";
  } else if (a.phase === "challenger-bid") {
    if (myId === a.landingPlayer) {
      highEl.textContent = `You bid ${a.landerOpenBid}\uD83C\uDF4C \u2014 waiting for challengers...`;
    } else {
      highEl.textContent = `Lander bid ${a.landerOpenBid}\uD83C\uDF4C \u2014 outbid or pass! \uD83D\uDC12`;
    }
  } else if (a.phase === "lander-second") {
    highEl.textContent =
      myId === a.landingPlayer
        ? "Challenger(s) outbid you! Pass or place your second bid. \uD83C\uDF4C"
        : "Lander is placing a second bid...";
  }

  document.getElementById("auction-turn").textContent = "";

  // Update bid button text for simple auction
  const bidBtn = document.getElementById("btn-bid");
  if (bidBtn)
    bidBtn.textContent =
      a.simple && a.phase === "simple-bid" ? "Set Price" : "Bid";

  // Show bid controls if I haven't bid/passed yet (and I'm allowed to in this phase)
  const controls = document.getElementById("auction-controls");
  let canBid = myBid && !myBid.placed && !myBid.passed;
  if (a.phase === "simple-bid" && myId !== a.landingPlayer) canBid = false;
  if (a.phase === "simple-respond") canBid = false; // uses accept/decline buttons
  if (
    a.phase === "simple-tiebreak" &&
    !(a.tiebreakBidders || []).includes(myId)
  )
    canBid = false;
  if (a.phase === "lander-bid" && myId !== a.landingPlayer) canBid = false;
  if (a.phase === "challenger-bid" && myId === a.landingPlayer) canBid = false;
  if (a.phase === "lander-second" && myId !== a.landingPlayer) canBid = false;
  controls.style.display = canBid ? "flex" : "none";

  // Auto-bid debug toggle: automatically bid 1 when it's our turn to bid
  if (canBid && document.getElementById("chk-auto-bid").checked) {
    if (!window._autoBidQueued) {
      window._autoBidQueued = true;
      setTimeout(() => {
        window._autoBidQueued = false;
        if (document.getElementById("chk-auto-bid").checked) {
          document.getElementById("bid-amount").value = "1";
          placeBid();
        }
      }, 600);
    }
  }

  // Auto-accept debug toggle: automatically accept in simple-respond phase
  if (
    a.phase === "simple-respond" &&
    myId !== a.landingPlayer &&
    document.getElementById("chk-auto-accept").checked
  ) {
    const ob = a.bids[myId];
    if (ob && !ob.placed && !ob.passed) {
      if (!window._autoAcceptQueued) {
        window._autoAcceptQueued = true;
        setTimeout(() => {
          window._autoAcceptQueued = false;
          if (document.getElementById("chk-auto-accept").checked)
            respondAuction(true);
        }, 600);
      }
    }
  }

  // Show/hide pass button (challengers can pass, lander on second bid can pass)
  const passBtn = document.getElementById("btn-pass");
  if (passBtn) {
    const showPass =
      canBid &&
      (a.phase === "challenger-bid" ||
        a.phase === "lander-second" ||
        a.phase === "simple-tiebreak");
    passBtn.style.display = showPass ? "inline-block" : "none";
  }

  // Bid input hint
  const bidInput = document.getElementById("bid-amount");
  const me = gs.players.find((p) => p.id === myId);
  const maxBid = me ? me.money : 500;
  if (parseInt(bidInput.value) > maxBid) bidInput.value = String(maxBid);
  // Reset input when auction first appears or phase changes
  const phaseKey = a.phase;
  if (canBid && window._auctionBidPhase !== phaseKey) {
    // Pre-fill challenger bid with lander's bid + 1
    if (
      a.phase === "challenger-bid" &&
      myId !== a.landingPlayer &&
      a.landerOpenBid != null
    ) {
      const prefill = Math.min(a.landerOpenBid + 1, maxBid);
      bidInput.value = String(prefill);
      window._bidAutoFilled = true;
    } else if (
      a.phase === "lander-second" &&
      myId === a.landingPlayer &&
      a.landerOpenBid != null
    ) {
      const prefill = Math.min(a.landerOpenBid + 1, maxBid);
      bidInput.value = String(prefill);
      window._bidAutoFilled = true;
    } else {
      // Default to 1 for opening bids (or 0 if player is broke)
      const defaultBid =
        a.phase === "simple-bid" || a.phase === "lander-bid"
          ? Math.min(1, maxBid)
          : 0;
      bidInput.value = String(defaultBid);
      window._bidAutoFilled = defaultBid > 0;
    }
    window._auctionBidPhase = phaseKey;
  }
  if (!canBid) window._auctionBidPhase = null;

  // Show "You bid X" after placing a bid (persists across phases)
  const myBidDisplay = document.getElementById("auction-turn");
  if (myBid && myBid.passed) {
    myBidDisplay.textContent = "You passed";
  } else if (window._myLastBid != null) {
    myBidDisplay.textContent = `You bid ${window._myLastBid}\uD83C\uDF4C`;
  } else {
    myBidDisplay.textContent = "";
  }
  const bidsEl = document.getElementById("auction-bids");
  bidsEl.innerHTML = "";
  for (const pid of Object.keys(a.bids)) {
    const player = gs.players.find((p) => p.id === pid);
    const b = a.bids[pid];
    const d = document.createElement("div");
    const isLanding = pid === a.landingPlayer;
    const label = isLanding ? " (landed)" : "";
    if (b.passed) {
      d.className = "bid-passed";
      d.textContent = `${player?.name || "?"}${label}: ${a.phase === "simple-respond" || a.simple ? "Declined" : "Passed"}`;
    } else if (b.placed) {
      // Show the lander's bid amount to everyone (visible in all phases)
      if (isLanding && a.landerOpenBid != null) {
        d.textContent = `${player?.name || "?"}${label}: ${a.simple ? "Priced" : "Bid"} ${a.landerOpenBid}\uD83C\uDF4C`;
      } else if (a.simple && !isLanding) {
        d.textContent = `${player?.name || "?"}${label}: Accepted`;
      } else {
        d.textContent = `${player?.name || "?"}${label}: Bid placed \u2713`;
      }
    } else if (a.phase === "simple-bid" && !isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Waiting...`;
    } else if (a.phase === "simple-respond" && isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Priced ${a.landerOpenBid}\uD83C\uDF4C`;
    } else if (a.phase === "simple-respond" && !isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Deciding...`;
    } else if (a.phase === "lander-bid" && !isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Waiting...`;
    } else if (a.phase === "challenger-bid" && isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Bid ${a.landerOpenBid}\uD83C\uDF4C`;
    } else if (a.phase === "lander-second" && !isLanding) {
      d.textContent = `${player?.name || "?"}${label}: Waiting for result...`;
    } else {
      d.textContent = `${player?.name || "?"}${label}: Bidding...`;
    }
    bidsEl.appendChild(d);
  }
}

// ── Poker UI ───────────────────────────────────────────────────────

const SUIT_SYMBOLS = { h: "♥", d: "♦", c: "♣", s: "♠" };
const SUIT_COLORS = { h: "red", d: "red", c: "black", s: "black" };
const RANK_NAMES = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "10",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

// Track previous poker state for dealing animation
let _prevPokerRound = null;
let _prevPokerCommunityCount = 0;
let _prevPokerActive = false;
let _pokerDealQueue = []; // scheduled timeouts for dealing animation

function playCardDraw() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    // Short snap/swish sound
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) {
      data[j] =
        (Math.random() * 2 - 1) * 0.5 * Math.exp(-j / (ctx.sampleRate * 0.02));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.08);
    // Tonal tap
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.12, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(oGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {}
}

function cardHTML(card, extraClass) {
  const cls = extraClass ? " " + extraClass : "";
  if (!card)
    return (
      '<div class="poker-card poker-card-back' + cls + '"><span>🂠</span></div>'
    );
  const color = SUIT_COLORS[card.suit];
  return `<div class="poker-card poker-card-${color}${cls}"><span class="poker-card-rank">${RANK_NAMES[card.rank]}</span><span class="poker-card-suit">${SUIT_SYMBOLS[card.suit]}</span></div>`;
}

function monkeyCardHTML(card, extraClass) {
  const cls = extraClass ? " " + extraClass : "";
  if (!card)
    return (
      '<div class="poker-card poker-card-back poker-card-mk-size' +
      cls +
      '"><span>🂠</span></div>'
    );
  return `<div class="poker-card poker-card-monkey${cls}"><span class="poker-card-rank">${card.value}</span><span class="poker-card-suit">🐵</span></div>`;
}

function updatePokerTable() {
  const table = document.getElementById("poker-table");
  // Delay poker visuals until the token walk animation finishes
  if (window._diceRollingPositions || window._tokenWalking) {
    table.style.display = "none";
    return;
  }
  if (!gs || !gs.poker) {
    table.style.display = "none";
    // Clear deal tracking when poker ends
    if (_prevPokerActive) {
      _prevPokerActive = false;
      _prevPokerRound = null;
      _prevPokerCommunityCount = 0;
      _pokerDealQueue.forEach((t) => clearTimeout(t));
      _pokerDealQueue = [];
      document.getElementById("poker-guide").style.display = "none";
    }
    return;
  }
  table.style.display = "flex";
  const pk = gs.poker;
  const isMk = pk.monkeyPoker;
  const renderCard = isMk ? monkeyCardHTML : cardHTML;
  const me = gs.players.find((p) => p.id === myId);
  const amInPoker = pk.players[myId] != null;
  const myPoker = pk.players[myId];
  const opId = amInPoker
    ? myId === pk.bbPlayer
      ? pk.sbPlayer
      : pk.bbPlayer
    : pk.bbPlayer;
  const myPkId = amInPoker ? myId : pk.sbPlayer;
  const opPoker = pk.players[opId];
  const myPk = pk.players[myPkId];
  const opPlayer = gs.players.find((p) => p.id === opId);
  const myPlayer = gs.players.find((p) => p.id === myPkId);

  // Detect if this is a brand-new poker game
  const justStarted = !_prevPokerActive;
  // Detect if new community cards appeared
  const newCommunity = pk.communityCards.length - _prevPokerCommunityCount;
  const roundChanged = pk.round !== _prevPokerRound;

  // Update tracking state
  _prevPokerActive = true;
  _prevPokerRound = pk.round;
  _prevPokerCommunityCount = pk.communityCards.length;

  // Header and guide
  document.getElementById("poker-header-text").textContent = isMk
    ? "🐵 MONKEY POKER 🐵"
    : "🃏 POKER MATCH 🃏";
  document.getElementById("poker-guide-btn").style.display = isMk ? "none" : "";

  // Pot
  document.getElementById("poker-pot-amount").textContent = pk.pot;

  // Round label
  const roundLabels = isMk
    ? {
        preflop: "Round 1",
        flop: "Round 2",
        river: "Round 3",
        showdown: "Showdown",
      }
    : {
        preflop: "Pre-Flop",
        flop: "Flop",
        turn: "Turn",
        river: "River",
        showdown: "Showdown",
      };
  document.getElementById("poker-round-label").textContent =
    roundLabels[pk.round] || pk.round;

  // Opponent info
  document.getElementById("poker-opp-name").textContent = opPlayer?.name || "?";
  document.getElementById("poker-opp-role").textContent =
    opId === pk.bbPlayer ? "BB" : "SB";
  document.getElementById("poker-opp-bet").textContent = opPoker.allIn
    ? "ALL IN"
    : opPoker.bet > 0
      ? `Bet: ${opPoker.bet}🍌`
      : "";

  // Opponent cards — deal animation on first appearance
  const oppCardsEl = document.getElementById("poker-opp-cards");
  const mkRoundCards = { preflop: 1, flop: 2, river: 3, showdown: 3 };
  const oppCardCount = isMk ? mkRoundCards[pk.round] || 1 : 2;
  if (isMk) {
    // Monkey poker: render cards directly (no delayed animation)
    if (opPoker.cards) {
      oppCardsEl.innerHTML = opPoker.cards.map((c) => renderCard(c)).join("");
    } else {
      oppCardsEl.innerHTML = Array(oppCardCount)
        .fill(renderCard(null))
        .join("");
    }
    if ((justStarted || roundChanged) && oppCardsEl.lastElementChild) {
      oppCardsEl.lastElementChild.classList.add("poker-card-dealing");
      playCardDraw();
    }
  } else if (opPoker.cards) {
    if (justStarted) {
      oppCardsEl.innerHTML = Array(oppCardCount)
        .fill(renderCard(null, "poker-card-dealing"))
        .join("");
      for (let i = 0; i < oppCardCount; i++) {
        _pokerDealQueue.push(
          setTimeout(
            () => {
              const cards = oppCardsEl.querySelectorAll(".poker-card");
              if (cards[i]) {
                cards[i].outerHTML = renderCard(
                  opPoker.cards[i],
                  "poker-card-dealing",
                );
                playCardDraw();
              }
            },
            200 + i * 300,
          ),
        );
      }
    } else {
      oppCardsEl.innerHTML = opPoker.cards.map((c) => renderCard(c)).join("");
    }
  } else {
    if (justStarted) {
      oppCardsEl.innerHTML = "";
      for (let i = 0; i < oppCardCount; i++) {
        _pokerDealQueue.push(
          setTimeout(
            () => {
              oppCardsEl.innerHTML += renderCard(null, "poker-card-dealing");
              playCardDraw();
            },
            200 + i * 300,
          ),
        );
      }
    } else {
      oppCardsEl.innerHTML = Array(oppCardCount)
        .fill(renderCard(null))
        .join("");
    }
  }

  // Opponent hand name at showdown
  const oppHandEl = document.getElementById("poker-opp-hand");
  if (pk.round === "showdown") {
    oppHandEl.textContent =
      opId === pk.bbPlayer ? pk.bbHandName || "" : pk.sbHandName || "";
  } else {
    oppHandEl.textContent = "";
  }

  // My info
  document.getElementById("poker-my-name").textContent = myPlayer?.name || "?";
  document.getElementById("poker-my-role").textContent =
    myPkId === pk.bbPlayer ? "BB" : "SB";
  document.getElementById("poker-my-bet").textContent = myPk.allIn
    ? "ALL IN"
    : myPk.bet > 0
      ? `Bet: ${myPk.bet}🍌`
      : "";

  // My cards — deal animation on first appearance
  const myCardsEl = document.getElementById("poker-my-cards");
  const myCardCount = isMk ? mkRoundCards[pk.round] || 1 : 2;
  if (isMk) {
    // Monkey poker: render cards directly (no delayed animation)
    if (myPk.cards) {
      myCardsEl.innerHTML = myPk.cards.map((c) => renderCard(c)).join("");
    } else {
      myCardsEl.innerHTML = Array(myCardCount).fill(renderCard(null)).join("");
    }
    if ((justStarted || roundChanged) && myCardsEl.lastElementChild) {
      myCardsEl.lastElementChild.classList.add("poker-card-dealing");
      playCardDraw();
    }
  } else if (myPk.cards) {
    if (justStarted) {
      myCardsEl.innerHTML = "";
      for (let i = 0; i < myCardCount; i++) {
        _pokerDealQueue.push(
          setTimeout(
            () => {
              myCardsEl.innerHTML += renderCard(
                myPk.cards[i],
                "poker-card-dealing",
              );
              playCardDraw();
            },
            800 + i * 300,
          ),
        );
      }
    } else {
      myCardsEl.innerHTML = myPk.cards.map((c) => renderCard(c)).join("");
    }
  } else {
    if (justStarted) {
      myCardsEl.innerHTML = "";
      for (let i = 0; i < myCardCount; i++) {
        _pokerDealQueue.push(
          setTimeout(
            () => {
              myCardsEl.innerHTML += renderCard(null, "poker-card-dealing");
              playCardDraw();
            },
            800 + i * 300,
          ),
        );
      }
    } else {
      myCardsEl.innerHTML = Array(myCardCount).fill(renderCard(null)).join("");
    }
  }

  // My hand name at showdown
  const myHandEl = document.getElementById("poker-my-hand");
  if (pk.round === "showdown") {
    myHandEl.textContent =
      myPkId === pk.bbPlayer ? pk.bbHandName || "" : pk.sbHandName || "";
  } else {
    myHandEl.textContent = "";
  }

  // Community cards — only for real poker
  const commEl = document.getElementById("poker-community");
  if (isMk) {
    commEl.style.display = "none";
  } else {
    commEl.style.display = "";
    if (roundChanged && newCommunity > 0 && !justStarted) {
      // New community cards to deal
      let commHTML = "";
      const alreadyShown = pk.communityCards.length - newCommunity;
      for (let i = 0; i < 5; i++) {
        if (i < alreadyShown) {
          commHTML += cardHTML(pk.communityCards[i]);
        } else {
          commHTML += '<div class="poker-card poker-card-empty"></div>';
        }
      }
      commEl.innerHTML = commHTML;
      // Stagger the new cards
      for (let n = 0; n < newCommunity; n++) {
        const idx = alreadyShown + n;
        _pokerDealQueue.push(
          setTimeout(
            () => {
              const slots = commEl.querySelectorAll(".poker-card");
              if (slots[idx]) {
                slots[idx].outerHTML = cardHTML(
                  pk.communityCards[idx],
                  "poker-card-dealing",
                );
                playCardDraw();
              }
            },
            300 * (n + 1),
          ),
        );
      }
    } else {
      let commHTML = "";
      for (let i = 0; i < 5; i++) {
        if (i < pk.communityCards.length) {
          commHTML += cardHTML(pk.communityCards[i]);
        } else {
          commHTML += '<div class="poker-card poker-card-empty"></div>';
        }
      }
      commEl.innerHTML = commHTML;
    }
  }

  // Actions
  const actionsEl = document.getElementById("poker-actions");
  const resultEl = document.getElementById("poker-result");

  if (pk.resolved) {
    actionsEl.style.display = "none";
    resultEl.style.display = "flex";
    const resultText = document.getElementById("poker-result-text");
    if (pk.winner === "tie") {
      resultText.textContent = `🤝 It's a tie! Pot split!`;
    } else {
      const winnerP = gs.players.find((p) => p.id === pk.winner);
      resultText.textContent = `🏆 ${winnerP?.name || "?"} wins ${pk.pot}🍌!`;
    }
  } else if (amInPoker && pk.currentTurn === myId && !myPk.folded) {
    actionsEl.style.display = "flex";
    resultEl.style.display = "none";
    const toCall = pk.currentBet - myPoker.bet;
    const checkBtn = document.getElementById("poker-btn-check");
    const callBtn = document.getElementById("poker-btn-call");
    checkBtn.style.display = toCall <= 0 ? "" : "none";
    callBtn.style.display = toCall > 0 ? "" : "none";
    callBtn.textContent = `Call ${toCall}🍌`;

    // Raise slider
    const slider = document.getElementById("poker-raise-slider");
    const minRaise = pk.currentBet + 1;
    const maxRaise = me ? me.money + myPoker.bet : pk.currentBet + 1;
    slider.min = minRaise;
    slider.max = Math.max(minRaise, maxRaise);
    if (parseInt(slider.value) < minRaise) {
      slider.value = minRaise;
      document.getElementById("poker-raise-display").textContent = minRaise;
    }
  } else {
    actionsEl.style.display = "none";
    resultEl.style.display = "none";
  }
}

function pokerFold() {
  if (socket && gameId) socket.emit("poker_action", { gameId, action: "fold" });
}

function pokerCheck() {
  if (socket && gameId)
    socket.emit("poker_action", { gameId, action: "check" });
}

function pokerCall() {
  if (socket && gameId) socket.emit("poker_action", { gameId, action: "call" });
}

function pokerRaise() {
  const amount = parseInt(document.getElementById("poker-raise-slider").value);
  if (socket && gameId && !isNaN(amount))
    socket.emit("poker_action", { gameId, action: "raise", amount });
}

function pokerAllIn() {
  const me = gs.players.find((p) => p.id === myId);
  const pk = gs.poker;
  if (!me || !pk || !pk.players[myId]) return;
  const total = me.money + pk.players[myId].bet;
  if (socket && gameId)
    socket.emit("poker_action", { gameId, action: "raise", amount: total });
}

function pokerDismiss() {
  if (socket && gameId) socket.emit("poker_dismiss", { gameId });
}

function togglePokerGuide() {
  const guide = document.getElementById("poker-guide");
  guide.style.display = guide.style.display === "none" ? "" : "none";
}

function toggleRevealAll() {
  revealAll = document.getElementById("chk-reveal").checked;
  if (gs) renderBoard(gs);
}

function updateLobbySettings() {
  if (_syncingLobby) return;
  if (!gameId || !gs || myId !== gs.admin) return;
  const money =
    parseInt(document.getElementById("lobby-bananas").value) || 3333;
  const mode = document.getElementById("lobby-mode").value;
  const lobbyMax = document.getElementById("lobby-max");
  if (mode === "teams") {
    lobbyMax.value = "4";
    lobbyMax.disabled = true;
  } else {
    lobbyMax.disabled = false;
  }
  const max = parseInt(lobbyMax.value) || 4;
  const petMode = document.getElementById("lobby-petmode").value;
  socket.emit("update_settings", {
    gameId,
    startingMoney: money,
    gameMode: mode,
    maxPlayers: max,
    petMode,
  });
}

function toggleModeSettings() {
  const mode = document.getElementById("create-mode").value;
  const teamSettings = document.getElementById("team-settings");
  const maxSelect = document.getElementById("create-max");
  const simpleLabel = document.getElementById("simple-auction-label");
  if (mode === "teams") {
    teamSettings.style.display = "";
    maxSelect.value = "4";
    maxSelect.disabled = true;
  } else {
    teamSettings.style.display = "none";
    maxSelect.disabled = false;
  }
  updateSimpleAuctionVisibility();
}

function updateSimpleAuctionVisibility() {
  const mode = document.getElementById("create-mode").value;
  const max = parseInt(document.getElementById("create-max").value);
  const simpleLabel = document.getElementById("simple-auction-label");
  const simpleCheckbox = document.getElementById("create-simple-auction");
  if (mode === "ffa") {
    simpleLabel.style.display = "";
  } else {
    simpleLabel.style.display = "none";
    simpleCheckbox.checked = false;
  }
}

function endTurn() {
  socket.emit("end_turn", { gameId });
}

function buyBomb() {
  socket.emit("buy_bomb", { gameId });
}

function openBombPlacement() {
  window._bombPlacementMode = true;
  document.getElementById("bomb-placement-overlay").style.display = "flex";
  document.getElementById("board").classList.add("bomb-placing");
  renderBoard(gs);
}

function confirmBombPlacement() {
  // placement now happens via tile click in board.js
}

function closeBombPlacement() {
  window._bombPlacementMode = false;
  document.getElementById("bomb-placement-overlay").style.display = "none";
  document.getElementById("board").classList.remove("bomb-placing");
  renderBoard(gs);
}

// ── Trade ──────────────────────────────────────────────────────────

function openTradePanel() {
  if (!gs || gs.state !== "playing") return;
  // Can't trade on your own turn
  const cur = gs.currentPlayer;
  if (cur && cur.id === myId) return;
  const panel = document.getElementById("trade-panel");
  // If already open, close it
  if (panel.style.display !== "none" && panel.style.display !== "") {
    closeTradePanel();
    return;
  }

  const isTeams = gs.gameMode === "teams";

  // Show/hide sections based on game mode
  const bananasSection = document.getElementById("trade-bananas-section");
  const swapSection = document.getElementById("trade-swap-section");
  if (bananasSection) bananasSection.style.display = isTeams ? "" : "none";
  if (swapSection) swapSection.style.display = isTeams ? "" : "none";

  // Property trade section — available in all modes
  populatePropertyTrade();

  if (isTeams) {
    // Populate banana send recipients (teammates only)
    const sel = document.getElementById("trade-recipient");
    sel.innerHTML = "";
    let teammates = [];
    if (gs.teams) {
      const myTeam = gs.teams.A.includes(myId) ? "A" : "B";
      teammates = gs.teams[myTeam].filter((id) => id !== myId);
    }
    const others = gs.players.filter(
      (p) => teammates.includes(p.id) && !p.bankrupt,
    );
    others.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${MONKEY_EMOJI[p.color] || "🐵"} ${p.name}`;
      sel.appendChild(opt);
    });
    const me = gs.players.find((p) => p.id === myId);
    const maxSend = Math.max(0, (me ? me.money : 0) - 50);
    const slider = document.getElementById("trade-amount");
    slider.max = maxSend;
    slider.value = Math.min(50, maxSend);
    document.getElementById("trade-amount-display").textContent = slider.value;
    updateTradeTotal();
    slider.oninput = function () {
      document.getElementById("trade-amount-display").textContent = this.value;
      updateTradeTotal();
    };
    // Populate farm swap dropdowns
    populateFarmSwap();
  }

  panel.style.display = "flex";
  // Change button text to Close and hide X
  const tradeBtn = document.getElementById("btn-trade");
  if (tradeBtn) tradeBtn.innerHTML = "✕ Close";
  const closeX = document.querySelector(".trade-panel-close");
  if (closeX) closeX.style.display = "none";
}

function closeTradePanel() {
  document.getElementById("trade-panel").style.display = "none";
  // Restore button text
  const tradeBtn = document.getElementById("btn-trade");
  if (tradeBtn) tradeBtn.innerHTML = "🔄 Trade";
  const closeX = document.querySelector(".trade-panel-close");
  if (closeX) closeX.style.display = "";
}

function populatePropertyTrade() {
  const myPropSel = document.getElementById("trade-prop-mine");
  const recipientSel = document.getElementById("trade-prop-recipient");
  if (!myPropSel || !recipientSel) return;
  myPropSel.innerHTML = "";
  recipientSel.innerHTML = "";

  const me = gs.players.find((p) => p.id === myId);
  if (!me) return;

  // My farms
  me.properties.forEach((pos) => {
    const tile = gs.boardLayout && gs.boardLayout[pos];
    if (!tile || !tile.tileLabel) return;
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = `${tile.tileLabel} (${tile.price}🍌 yield)`;
    myPropSel.appendChild(opt);
  });

  // All other non-bankrupt players who own properties
  const others = gs.players.filter(
    (p) => p.id !== myId && !p.bankrupt && p.properties.length > 0,
  );
  others.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${MONKEY_EMOJI[p.color] || "🐵"} ${p.name}`;
    recipientSel.appendChild(opt);
  });

  // Populate their farms for the first selected player
  populateTheirFarms();

  // Update button state
  updateTradePropertyBtn();
}

function populateTheirFarms() {
  const recipientSel = document.getElementById("trade-prop-recipient");
  const theirPropSel = document.getElementById("trade-prop-theirs");
  if (!recipientSel || !theirPropSel) return;
  theirPropSel.innerHTML = "";

  const recipientId = recipientSel.value;
  if (!recipientId) {
    updateTradePropertyBtn();
    return;
  }

  const recipient = gs.players.find((p) => p.id === recipientId);
  if (!recipient) {
    updateTradePropertyBtn();
    return;
  }

  recipient.properties.forEach((pos) => {
    const tile = gs.boardLayout && gs.boardLayout[pos];
    if (!tile || !tile.tileLabel) return;
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = `${tile.tileLabel} (${tile.price}🍌 yield)`;
    theirPropSel.appendChild(opt);
  });

  updateTradePropertyBtn();
}

function updateTradePropertyBtn() {
  const btn = document.getElementById("btn-trade-prop");
  if (!btn) return;
  const myPropSel = document.getElementById("trade-prop-mine");
  const theirPropSel = document.getElementById("trade-prop-theirs");
  const recipientSel = document.getElementById("trade-prop-recipient");
  btn.disabled =
    !myPropSel ||
    myPropSel.options.length === 0 ||
    !recipientSel ||
    recipientSel.options.length === 0 ||
    !theirPropSel ||
    theirPropSel.options.length === 0;
}

function sendPropertyTrade() {
  const propertyPos = parseInt(
    document.getElementById("trade-prop-mine").value,
  );
  const theirPropertyPos = parseInt(
    document.getElementById("trade-prop-theirs").value,
  );
  const recipientId = document.getElementById("trade-prop-recipient").value;
  if (isNaN(propertyPos) || isNaN(theirPropertyPos) || !recipientId) return;
  socket.emit("trade_property", {
    gameId,
    recipientId,
    propertyPos,
    theirPropertyPos,
  });
  closeTradePanel();
}

function updateTradeTotal() {
  const amount = parseInt(document.getElementById("trade-amount").value) || 0;
  document.getElementById("trade-total").textContent =
    `Total cost: ${amount + 50}🍌`;
}

function sendTrade() {
  const recipientId = document.getElementById("trade-recipient").value;
  const amount = parseInt(document.getElementById("trade-amount").value) || 0;
  if (!recipientId || amount <= 0) return;
  socket.emit("trade_bananas", { gameId, recipientId, amount });
  closeTradePanel();
}

// ── Farm Swap ──────────────────────────────────────────────────────

function populateFarmSwap() {
  const myFarmSel = document.getElementById("swap-my-farm");
  const mateFarmSel = document.getElementById("swap-mate-farm");
  if (!myFarmSel || !mateFarmSel) return;
  myFarmSel.innerHTML = "";
  mateFarmSel.innerHTML = "";

  const me = gs.players.find((p) => p.id === myId);
  if (!me || !gs.teams) return;

  const myTeam = gs.teams.A.includes(myId) ? "A" : "B";
  const mateId = gs.teams[myTeam].find((id) => id !== myId);
  const mate = gs.players.find((p) => p.id === mateId);
  if (!mate) return;

  // My farms
  me.properties.forEach((pos) => {
    const tile = gs.boardLayout && gs.boardLayout[pos];
    if (!tile || !tile.tileLabel) return;
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = `${tile.tileLabel} (${tile.price}🍌 yield)`;
    myFarmSel.appendChild(opt);
  });

  // Teammate farms
  mate.properties.forEach((pos) => {
    const tile = gs.boardLayout && gs.boardLayout[pos];
    if (!tile || !tile.tileLabel) return;
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = `${tile.tileLabel} (${tile.price}🍌 yield)`;
    mateFarmSel.appendChild(opt);
  });

  // Update swap button state
  const swapBtn = document.getElementById("btn-swap-farm");
  if (swapBtn) {
    swapBtn.disabled =
      myFarmSel.options.length === 0 || mateFarmSel.options.length === 0;
  }
}

function swapFarm() {
  const myFarmPos = parseInt(document.getElementById("swap-my-farm").value);
  const mateFarmPos = parseInt(document.getElementById("swap-mate-farm").value);
  if (isNaN(myFarmPos) || isNaN(mateFarmPos)) return;
  socket.emit("swap_farm", { gameId, myFarmPos, mateFarmPos });
}

function leaveGame() {
  if (gameId) socket.emit("leave_game", { gameId });
  gameId = null;
  gs = null;
  showScreen("screen-menu");
}

// ── Init ───────────────────────────────────────────────────────────

function initFloaters() {
  const container = document.getElementById("bg-floaters");
  if (!container) return;
  const emojis = [
    "\ud83c\udf4c",
    "\ud83c\udf4c",
    "\ud83c\udf34",
    "\ud83d\udc12",
    "\ud83d\udc12",
    "\ud83d\udc35",
    "\ud83d\udc35",
    "\ud83d\ude48",
    "\ud83d\ude49",
    "\ud83d\ude4a",
    "\ud83e\udda7",
    "\ud83d\udcb0",
    "\ud83d\udcb5",
    "\ud83d\udcb8",
    "\ud83c\udf43",
    "\ud83c\udf3e",
    "\ud83d\udca3",
    "\ud83d\udca3",
  ];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement("span");
    el.className = "bg-floater";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.animationDuration = 12 + Math.random() * 20 + "s";
    el.style.animationDelay = -(Math.random() * 30) + "s";
    el.style.fontSize = 1.2 + Math.random() * 1.5 + "em";
    container.appendChild(el);
  }
}

function bananaBurst(amount) {
  const container = document.getElementById("board-floaters");
  if (!container) return;
  const count = Math.max(5, Math.min(60, Math.round(amount / 10)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "banana-burst";
    el.textContent = "\ud83c\udf4c";
    el.style.left = 30 + Math.random() * 40 + "%";
    el.style.top = 30 + Math.random() * 40 + "%";
    const angle = Math.random() * 360;
    const dist = 80 + Math.random() * 220;
    const dx = Math.cos((angle * Math.PI) / 180) * dist;
    const dy = Math.sin((angle * Math.PI) / 180) * dist;
    el.style.setProperty("--dx", dx + "px");
    el.style.setProperty("--dy", dy + "px");
    el.style.fontSize = 1.2 + Math.random() * 1.4 + "em";
    el.style.animationDelay = Math.random() * 0.15 + "s";
    container.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

function checkBananaBurstTrigger() {
  const log = gs.log || [];
  if (log.length > _prevLogLen) {
    const newEntries = log.slice(_prevLogLen);
    for (const msg of newEntries) {
      const m = msg.match(/(\d+)\ud83c\udf4c/);
      if (!m) continue;
      const amount = parseInt(m[1], 10);
      if (
        /won the banana bid|bought the (?:farm|desert)|claimed .* for free|paid .* yield|landed on GROW|slipped on|Chain bonus/i.test(
          msg,
        )
      ) {
        bananaBurst(amount);
      }
    }
  }
  _prevLogLen = log.length;
}

function initBoardFloaters() {
  const container = document.getElementById("board-floaters");
  if (!container || container.children.length > 0) return;
  const emojis = [
    "\ud83c\udf4c",
    "\ud83c\udf4c",
    "\ud83d\udc12",
    "\ud83d\udc35",
    "\ud83c\udf4c",
  ];
  for (let i = 0; i < 15; i++) {
    const el = document.createElement("span");
    el.className = "board-floater";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.animationDuration = 14 + Math.random() * 18 + "s";
    el.style.animationDelay = -(Math.random() * 30) + "s";
    el.style.fontSize = 1 + Math.random() * 1.2 + "em";
    container.appendChild(el);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initSocket();
  initFloaters();
  initBoardFloaters();
  showScreen("screen-menu");

  // Pet toggle button handler
  const petToggleBtn = document.getElementById("btn-auto-pet");
  if (petToggleBtn) {
    petToggleBtn.addEventListener("click", () => {
      const txt = document.getElementById("pet-toggle-text");
      const armed = petToggleBtn.dataset.armed === "true";
      const now = !armed;
      petToggleBtn.dataset.armed = now ? "true" : "false";
      if (txt)
        txt.textContent = now
          ? "\ud83d\udc3e Pet acting next turn!"
          : "Use Pet Next Turn";
      // Energy/Strong pets activate off-turn — fire usePet immediately when toggled on
      if (now && gs) {
        const me = gs.players && gs.players.find((p) => p.id === myId);
        if (
          me &&
          (me.pet === "energy" || me.pet === "strong") &&
          !me.pendingPet
        ) {
          usePet();
        }
      }
    });
  }

  // Clear auto-filled bid value on first keystroke so typing replaces it
  const bidAmountInput = document.getElementById("bid-amount");
  if (bidAmountInput) {
    bidAmountInput.addEventListener("keydown", (e) => {
      if (window._bidAutoFilled !== false && e.key >= "0" && e.key <= "9") {
        bidAmountInput.value = "";
        window._bidAutoFilled = false;
      }
    });
  }

  const chatForm = document.getElementById("board-chat-form");
  const chatInput = document.getElementById("board-chat-input");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || !socket || !gameId) return;
      socket.emit("chat_message", { gameId, message: text });
      chatInput.value = "";
    });
  }

  // Chat close / open
  const chatEl = document.getElementById("board-chat");
  const chatClose = document.getElementById("board-chat-close");
  const chatToggle = document.getElementById("board-chat-toggle");
  if (chatClose && chatEl) {
    chatClose.addEventListener("click", () => {
      chatEl.classList.add("board-chat-hidden");
    });
  }
  if (chatToggle && chatEl) {
    chatToggle.addEventListener("click", () => {
      chatEl.classList.remove("board-chat-hidden");
      chatToggle.classList.remove("has-unread");
      // Open near the toggle button (bottom-right of board)
      chatEl.style.left = "auto";
      chatEl.style.right = "2%";
      chatEl.style.top = "auto";
      chatEl.style.bottom = "12%";
      chatEl.style.transform = "none";
    });
  }

  // Drag chat by header
  const chatHeader = document.getElementById("board-chat-header");
  if (chatHeader && chatEl) {
    let dragging = false,
      startX,
      startY,
      origX,
      origY;
    chatHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-chat-close")) return;
      dragging = true;
      const rect = chatEl.getBoundingClientRect();
      const parentRect = chatEl.parentElement.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      startX = e.clientX;
      startY = e.clientY;
      chatEl.style.transform = "none";
      chatEl.style.left = origX + "px";
      chatEl.style.top = origY + "px";
      chatHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      chatEl.style.left = origX + e.clientX - startX + "px";
      chatEl.style.top = origY + e.clientY - startY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      chatHeader.style.cursor = "";
    });
  }

  // ── Jungle Log toggle / close / drag ──────────────────────────
  const logEl = document.getElementById("board-log");
  const logClose = document.getElementById("board-log-close");
  const logToggle = document.getElementById("board-log-toggle");
  if (logClose && logEl) {
    logClose.addEventListener("click", () => {
      logEl.classList.add("board-log-hidden");
    });
  }
  if (logToggle && logEl) {
    logToggle.addEventListener("click", () => {
      logEl.classList.toggle("board-log-hidden");
    });
  }
  const logHeader = document.getElementById("board-log-header");
  if (logHeader && logEl) {
    let draggingLog = false,
      logStartX,
      logStartY,
      logOrigX,
      logOrigY;
    logHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-log-close")) return;
      draggingLog = true;
      const rect = logEl.getBoundingClientRect();
      const parentRect = logEl.parentElement.getBoundingClientRect();
      logOrigX = rect.left - parentRect.left;
      logOrigY = rect.top - parentRect.top;
      logStartX = e.clientX;
      logStartY = e.clientY;
      logEl.style.left = logOrigX + "px";
      logEl.style.top = logOrigY + "px";
      logEl.style.right = "auto";
      logEl.style.bottom = "auto";
      logHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingLog) return;
      logEl.style.left = logOrigX + e.clientX - logStartX + "px";
      logEl.style.top = logOrigY + e.clientY - logStartY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingLog) return;
      draggingLog = false;
      logHeader.style.cursor = "";
    });
  }
});

// ── Board Preview ──────────────────────────────────────────────────

let _previewLayout = null;

function openBoardPreview() {
  const overlay = document.getElementById("board-preview-overlay");
  overlay.style.display = "flex";
  switchPreviewTab("variations");
  shuffleBoardPreview();
}

function closeBoardPreview() {
  document.getElementById("board-preview-overlay").style.display = "none";
}

function shuffleBoardPreview() {
  playShuffleSound();
  _previewLayout = buildPreviewLayout();
  renderPreviewBoard(_previewLayout);
}

function switchPreviewTab(tab) {
  const varView = document.getElementById("bp-view-variations");
  const rulesView = document.getElementById("bp-view-rules");
  const tabVar = document.getElementById("bp-tab-variations");
  const tabRules = document.getElementById("bp-tab-rules");
  if (tab === "rules") {
    varView.style.display = "none";
    rulesView.style.display = "block";
    tabVar.classList.remove("bp-tab-active");
    tabRules.classList.add("bp-tab-active");
  } else {
    varView.style.display = "";
    rulesView.style.display = "none";
    tabVar.classList.add("bp-tab-active");
    tabRules.classList.remove("bp-tab-active");
  }
}
