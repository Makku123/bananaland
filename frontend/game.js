// ─── Monopoly Client ───────────────────────────────────────────────

let socket = null;
let gameId = null;
let myId = null;
let revealAll = false;
let gs = null; // current game state
let _gsPlayerMap = {}; // { playerId: player } — rebuilt on each game_update for O(1) lookups
let _gsPropMap = {}; // { propertyId: property } — rebuilt on each game_update for O(1) lookups
let _syncingLobby = false; // guard: prevent updateLobbySettings during showLobby sync

const MONKEY_EMOJI = {
  brown: "\uD83D\uDC35",
  golden: "\uD83D\uDC12",
  silver: "\uD83E\uDDA7",
  red: "\uD83E\uDDE8",
};

// ── Sound Volume Control ───────────────────────────────────────────
let _sfxVolume = (() => {
  try { const v = parseFloat(localStorage.getItem("sfx-volume")); return isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); }
  catch { return 1; }
})();

// Shared AudioContext — creating a new one per sound causes variable startup
// latency (tens of ms) which desyncs short repeated sounds like the walk tick.
let _sharedAudioCtx = null;
function _getAudioCtx() {
  if (!_sharedAudioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    _sharedAudioCtx = new Ctor();
  }
  if (_sharedAudioCtx.state === "suspended") {
    try { _sharedAudioCtx.resume(); } catch {}
  }
  return _sharedAudioCtx;
}

function _sfxDest(ctx) {
  const g = ctx.createGain();
  g.gain.value = _sfxVolume;
  g.connect(ctx.destination);
  return g;
}

function setSfxVolume(v) {
  _sfxVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("sfx-volume", _sfxVolume); } catch {}
  const icon = document.getElementById("sfx-toggle-icon");
  if (icon) icon.textContent = _sfxVolume === 0 ? "\uD83D\uDD07" : _sfxVolume < 0.5 ? "\uD83D\uDD09" : "\uD83D\uDD0A";
}

function playTickSound() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, t);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.04);
  } catch (e) {}
}

function playMoveTickSound() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {}
}

function playChatNotif() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1046.5, t + 0.08);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.25);
  } catch (e) {}
}

function playTurnChime() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
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
      osc.connect(gain).connect(_sfxDest(ctx));
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch (e) {}
}

function playDiceRoll() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
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
      src.connect(bp).connect(gain).connect(_sfxDest(ctx));
      src.start(start);
      src.stop(start + 0.04);
    }
  } catch (e) {}
}

function playAuctionLoss() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
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
      osc.connect(gain).connect(_sfxDest(ctx));
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (e) {}
}

function playTaxSound() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Cash register "ka-ching" — bright metallic hit then bell ring
    const hit = ctx.createOscillator();
    const hitGain = ctx.createGain();
    hit.type = "square";
    hit.frequency.setValueAtTime(1200, t);
    hit.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    hitGain.gain.setValueAtTime(0.04, t);
    hitGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    hit.connect(hitGain).connect(_sfxDest(ctx));
    hit.start(t);
    hit.stop(t + 0.08);
    // Bell ding
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = "sine";
    bell.frequency.setValueAtTime(2200, t + 0.06);
    bellGain.gain.setValueAtTime(0.05, t + 0.06);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    bell.connect(bellGain).connect(_sfxDest(ctx));
    bell.start(t + 0.06);
    bell.stop(t + 0.5);
    // Second higher ding
    const bell2 = ctx.createOscillator();
    const bell2Gain = ctx.createGain();
    bell2.type = "sine";
    bell2.frequency.setValueAtTime(3300, t + 0.12);
    bell2Gain.gain.setValueAtTime(0.035, t + 0.12);
    bell2Gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    bell2.connect(bell2Gain).connect(_sfxDest(ctx));
    bell2.start(t + 0.12);
    bell2.stop(t + 0.55);
  } catch (e) {}
}

function playBananaWhoosh() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Whoosh — filtered noise sweep
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2000, t + 0.15);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    bp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(bp).connect(gain).connect(_sfxDest(ctx));
    src.start(t);
    src.stop(t + 0.35);
  } catch (e) {}
}

function playVineSwing() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Swooping tone (high to low) — like swinging on a vine
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.3);
    // Whoosh noise layer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * 0.4 * Math.exp(-i / (ctx.sampleRate * 0.08));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2000, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    bp.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(bp).connect(ng).connect(_sfxDest(ctx));
    src.start(t);
    src.stop(t + 0.2);
  } catch (e) {}
}

function playExplosionSound() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Low boom — short sub-bass thump
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(140, t);
    boom.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    boomGain.gain.setValueAtTime(0.0001, t);
    boomGain.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    boom.connect(boomGain).connect(_sfxDest(ctx));
    boom.start(t);
    boom.stop(t + 0.55);
    // Noise crackle layer (debris/fire)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.8);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    src.connect(lp).connect(noiseGain).connect(_sfxDest(ctx));
    src.start(t);
    src.stop(t + 0.9);
    // High-frequency snap at the front
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = "square";
    snap.frequency.setValueAtTime(900, t);
    snap.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    snapGain.gain.setValueAtTime(0.25, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    snap.connect(snapGain).connect(_sfxDest(ctx));
    snap.start(t);
    snap.stop(t + 0.1);
  } catch (e) {}
}

function playShuffleSound() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Quick sweep tone
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(_sfxDest(ctx));
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
    src.connect(ng).connect(_sfxDest(ctx));
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
  // Auto-refresh public lobbies when entering join screen
  if (id === "screen-join") refreshPublicLobbies();
}

function dismissLoadingOverlay() {
  var overlay = document.getElementById("loading-overlay");
  if (!overlay || overlay.classList.contains("fade-out")) return;
  overlay.classList.add("fade-out");
  setTimeout(function () { overlay.remove(); }, 500);
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
    // Dismiss loading overlay once connected
    dismissLoadingOverlay();
  });

  socket.on("public_lobbies", _handlePublicLobbies);

  socket.on("game_update", (state) => {
    // Save player positions and revealed tiles before overwriting gs so we can freeze during dice roll
    // Don't overwrite if we're mid-walk animation (positions are synthetic)
    if (gs && gs.players && !window._tokenWalking) {
      window._prevPlayerPositions = {};
      gs.players.forEach((p) => {
        window._prevPlayerPositions[p.id] = p.position;
      });
      const me = _gsPlayerMap[socket.id];
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
      const meSnap = _gsPlayerMap[socket.id];
      if (meSnap) window._prevMoney = meSnap.money;
      // Snapshot all players' money for deduction popups
      window._prevPlayerMoney = {};
      for (const p of gs.players) {
        window._prevPlayerMoney[p.id] = p.money;
      }
    }
    // Detect vine swing completion: previous state had vineSwing, new one doesn't
    if (gs && gs.vineSwing && !state.vineSwing) {
      playVineSwing();
      window._vineSwingJustLanded = true;
    }

    // Leaver-shuffle notification: a new pending shuffle entry means a player
    // just left and their tiles are about to be reshuffled. Show a toast so
    // the leave is unmistakable (the chat log alone is easy to miss).
    if (Array.isArray(state.pendingTileShuffles)) {
      const _prevShuffleKeys = new Set(
        ((gs && gs.pendingTileShuffles) || []).map(
          (p) => p.leavingName + ":" + p.endsAt,
        ),
      );
      for (const pending of state.pendingTileShuffles) {
        const key = pending.leavingName + ":" + pending.endsAt;
        if (_prevShuffleKeys.has(key)) continue;
        const tileWord = pending.positions.length === 1 ? "farm" : "farms";
        showToast(
          `${pending.leavingName} left the game — their ${pending.positions.length} ${tileWord} will be covered and reshuffled.`,
          "info",
          3000,
        );
      }
    }

    // Shuffle sound: fires once when a new lastTileShuffle stamp arrives
    // (the deferred shuffle finished). Dedup by timestamp so repeated state
    // updates with the same stamp don't re-trigger the sound.
    if (state.lastTileShuffle && state.lastTileShuffle.ts) {
      if (window._lastTileShuffleTs !== state.lastTileShuffle.ts) {
        window._lastTileShuffleTs = state.lastTileShuffle.ts;
        if (typeof playShuffleSound === "function") playShuffleSound();
      }
    }
    // Detect vine swing activation: animate the vine tile
    if (state.vineSwing && (!gs || !gs.vineSwing)) {
      const vinePlayer = state.players && state.players.find(p => p.id === state.vineSwing);
      if (vinePlayer) {
        const vineEl = document.getElementById("space-" + vinePlayer.position);
        if (vineEl) {
          vineEl.classList.remove("vine-activate");
          void vineEl.offsetWidth;
          vineEl.classList.add("vine-activate");
          vineEl.addEventListener("animationend", () => vineEl.classList.remove("vine-activate"), { once: true });
        }
      }
    }

    gs = state;
    gameId = state.gameId;
    myId = socket.id;
    // Simple mode re-skins the four player colours to Red/Green/Blue/Black
    // (scoped CSS overrides hang off this body class).
    document.body.classList.toggle(
      "mode-simple",
      state.gameMode === "simple" || state.gameMode === "simple_teams",
    );
    // Sync no-timer toggle with server state
    const noTimerChk = document.getElementById("chk-no-timer");
    if (noTimerChk) noTimerChk.checked = !!gs.noAuctionTimer;
    // Rebuild lookup maps for O(1) access
    _gsPlayerMap = {};
    if (gs.players) for (const p of gs.players) _gsPlayerMap[p.id] = p;
    _gsPropMap = {};
    if (gs.properties) for (const p of gs.properties) _gsPropMap[p.id] = p;

    // Auto-cancel bomb placement overlay only when it's genuinely no longer
    // actionable — game ended, player gone, or no bombs left to place.
    // Intentionally keep the overlay open across turn changes so a player
    // can "arm" placement mode on their turn and keep it open through the
    // round until they choose a tile (bombs no longer expire, so this is
    // safe and matches player expectations).
    if (window._bombPlacementMode) {
      const meNow = _gsPlayerMap[myId];
      if (
        gs.state !== "playing" ||
        !meNow ||
        meNow.bankrupt ||
        !meNow.bomb
      ) {
        closeBombPlacement();
      }
    }

    route();

    // General money-loss detection: show red deduction popup for ANY player
    // whose money decreased (tax, farm purchase, bombs, poker, etc.)
    // If a walk animation is in progress, defer the walking player's deduction
    // until they visually land on the tile.
    // If poker just started, defer BOTH poker players' deductions until the
    // poker table visually appears.
    if (window._prevPlayerMoney) {
      // Detect if a brand-new dice roll just arrived (walk animation hasn't started yet)
      const isNewDiceRoll = gs.diceRolled && gs.dice && !gs.petUsedThisTurn &&
        gs.currentPlayer && (gs.dice.join("-") + "-" + gs.turn) !== window._lastDiceKey;
      const walkInProgress = window._tokenWalking || isNewDiceRoll;
      const pokerJustStarted = gs.poker && !gs.poker.resolved && walkInProgress;
      const walkingId = window._walkingPlayerId || (isNewDiceRoll && gs.currentPlayer ? gs.currentPlayer.id : null);

      for (const p of gs.players) {
        const prev = window._prevPlayerMoney[p.id];

        // ── Money LOSS detection ──
        if (prev != null && p.money < prev) {
          const diff = prev - p.money;
          if (pokerJustStarted && gs.poker.players[p.id]) {
            // Defer poker deductions until poker table appears
            if (!window._pendingPokerDeductions) window._pendingPokerDeductions = [];
            window._pendingPokerDeductions.push({ playerId: p.id, amount: diff });
          } else if (walkInProgress && p.id === walkingId) {
            // Defer walking player's deduction until visual landing
            window._pendingLandingDeduction = { playerId: p.id, amount: diff };
          } else if (isNewDiceRoll && p.id !== walkingId) {
            // Defer other players' deductions (e.g. rent loss) until visual landing
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "loss", playerId: p.id, amount: diff });
          } else {
            _showMoneyDeduction(p.id, diff);
          }
        }

        // ── Money GAIN detection ──
        // Skip the walking player — pile collections are handled in board.js,
        // and non-pile gains fire from the post-walk handler.
        if (prev != null && p.money > prev) {
          const gain = p.money - prev;
          if (walkInProgress && p.id === walkingId) {
            // Walking player gains handled by post-walk handler
          } else if (isNewDiceRoll) {
            // Defer other players' gains (e.g. rent income) until visual landing
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "gain", playerId: p.id, amount: gain });
          } else if (window._tokenWalking) {
            // Walk mid-progress updates — defer
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "gain", playerId: p.id, amount: gain });
          } else {
            bananaBurst(gain, p.id);
          }
        }
      }
    }

  });

  socket.on("game_error", (data) => {
    showToast(data.message, "error");
  });

  socket.on("kicked", (data) => {
    showToast(data.message || "You were kicked from the lobby.", "error");
    gameId = null;
    gs = null;
    showScreen("screen-menu");
  });

  socket.on("player_reaction", (data) => {
    showEmojiReaction(data.playerId, data.emoji);
  });

  socket.on("chat_message", (data) => {
    const container = document.getElementById("board-chat-messages");
    if (!container) return;
    const msg = document.createElement("div");
    msg.className = "board-chat-msg";

    // Colored dot + player name
    const nameWrap = document.createElement("span");
    nameWrap.className = "board-chat-name-wrap";
    const dot = document.createElement("span");
    dot.className = "board-chat-dot c-" + (data.color || "brown");
    const nameSpan = document.createElement("span");
    nameSpan.className = "board-chat-name c-" + (data.color || "brown");
    nameSpan.textContent = data.name;
    nameWrap.appendChild(dot);
    nameWrap.appendChild(nameSpan);

    // Timestamp
    const timeSpan = document.createElement("span");
    timeSpan.className = "board-chat-time";
    const now = new Date();
    timeSpan.textContent = now.getHours().toString().padStart(2, "0") + ":" +
      now.getMinutes().toString().padStart(2, "0");

    // Message text — parse @mentions
    const textSpan = document.createElement("span");
    textSpan.className = "board-chat-text";
    const mentionRegex = /@(\S+)/g;
    let lastIdx = 0;
    let match;
    const messageText = data.message;
    let hasMention = false;
    while ((match = mentionRegex.exec(messageText)) !== null) {
      // Add text before the mention
      if (match.index > lastIdx) {
        textSpan.appendChild(document.createTextNode(messageText.slice(lastIdx, match.index)));
      }
      const mentionName = match[1];
      const mentionSpan = document.createElement("span");
      // Find matching player for color
      const matchedPlayer = gs && gs.players
        ? gs.players.find((p) => p.name.toLowerCase() === mentionName.toLowerCase())
        : null;
      if (matchedPlayer) {
        mentionSpan.className = "board-chat-mention c-" + matchedPlayer.color;
        if (matchedPlayer.id === myId) {
          mentionSpan.classList.add("board-chat-mention-me");
          hasMention = true;
        }
      } else {
        mentionSpan.className = "board-chat-mention";
      }
      mentionSpan.textContent = "@" + mentionName;
      textSpan.appendChild(mentionSpan);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < messageText.length) {
      textSpan.appendChild(document.createTextNode(messageText.slice(lastIdx)));
    }
    if (hasMention) {
      msg.classList.add("board-chat-msg-mentioned");
    }

    msg.appendChild(nameWrap);
    msg.appendChild(timeSpan);
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

  socket.on("sale_completed", (data) => {
    // Store pending flash — renderBoard (triggered by the game_update that
    // follows immediately) will destroy the current DOM element, so we apply
    // the flash AFTER the board is re-rendered.
    window._pendingSaleFlash = {
      propPos: data.propPos,
      buyerColor: data.buyerColor,
    };
  });
}

// ── Routing: pick correct screen based on state ────────────────────

function route() {
  if (!gs) return;
  if (gs.state === "waiting") {
    window._returnedToLobby = false;
    showLobby();
  } else if (gs.state === "finished" && window._returnedToLobby) {
    // Player clicked "Back to Lobby" but game hasn't fully reset yet
    // Show lobby screen while waiting for other players
    showLobby();
  } else if (gs.state === "revealing") {
    showReveal();
    updateRevealAcceptStatus();
  } else {
    hideReveal();
    if (!_shufflePlayed) {
      _shufflePlayed = true;
      playShuffleSound();
    }
    showGame();
    if (gs.state === "finished") {
      // If a bomb just exploded and the winner is via bomb, defer the
      // game-over screen until after the walk + explosion animation has
      // played. The explosion animation block in board.js triggers
      // _runDeferredBombGameOver() once the explosion fires.
      const bombFinishPending =
        gs.bombWinner && gs.lastExplosion && !window._explosionShown;
      if (bombFinishPending) {
        window._pendingBombGameOver = true;
      } else if (!window._pendingBombGameOver && !window._bombWinAnnouncing) {
        showGameOver();
      }
    }
  }
}

// Called by board.js after the bomb explosion animation fires.
// Plays the win announcement for the winning player, then shows game over.
function _runDeferredBombGameOver() {
  if (!window._pendingBombGameOver) return;
  window._pendingBombGameOver = false;
  window._bombWinAnnouncing = true;
  const explosionAnimMs = 1500;
  setTimeout(() => {
    if (!gs || gs.state !== "finished") {
      window._bombWinAnnouncing = false;
      return;
    }
    const isMyWin = gs.bombWinner && gs.bombWinner === myId;
    if (isMyWin) {
      const notif = document.getElementById("bomb-win-notification");
      if (notif) {
        notif.classList.remove("show");
        void notif.offsetWidth;
        notif.classList.add("show");
        setTimeout(() => notif.classList.remove("show"), 3000);
      }
      setTimeout(() => {
        window._bombWinAnnouncing = false;
        showGameOver();
      }, 3000);
    } else {
      window._bombWinAnnouncing = false;
      showGameOver();
    }
  }, explosionAnimMs);
}

function showGameOver() {
  const overlay = document.getElementById("game-over-overlay");
  if (!overlay || overlay.style.display === "flex") return;
  overlay.style.display = "flex";

  // Spawn confetti particles
  const confettiEmojis = ["\uD83C\uDF4C", "\uD83C\uDF1F", "\u2728", "\uD83C\uDF89", "\uD83C\uDF8A", "\uD83D\uDC51", "\uD83C\uDF4C", "\u2B50"];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement("span");
    el.className = "game-over-confetti";
    el.textContent = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
    el.style.left = Math.random() * 100 + "vw";
    el.style.top = -(Math.random() * 10) + "%";
    el.style.animationDuration = 2.5 + Math.random() * 3 + "s";
    el.style.animationDelay = Math.random() * 2 + "s";
    el.style.fontSize = 1 + Math.random() * 1.2 + "em";
    overlay.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // Find the winner (player who owns the mushroom property, bomb winner, or banana loser)
  let winnerPlayer;
  if (gs.bombWinner) {
    winnerPlayer = _gsPlayerMap[gs.bombWinner];
  } else if (gs.bananaLoser) {
    // Winner is the opponent with the most money
    winnerPlayer = [...gs.players]
      .filter((p) => p.id !== gs.bananaLoser && !p.bankrupt)
      .sort((a, b) => b.money - a.money)[0];
  } else {
    winnerPlayer = gs.players.find((p) =>
      p.properties.some((pos) => {
        const prop = _gsPropMap[pos];
        return prop && prop.group === "mushroom";
      }),
    );
  }

  const winnerEl = document.getElementById("game-over-winner");
  if (winnerPlayer && gs.bombWinner) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Monkey King! \uD83D\uDC51\uD83D\uDCA5`;
  } else if (winnerPlayer && gs.bananaLoser) {
    const loser = _gsPlayerMap[gs.bananaLoser];
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the richest monkey and wins! \u2b50\uD83D\uDC51`;
  } else if (winnerPlayer) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Monkey God! \uD83D\uDC51\u2b50`;
  }

  // Standings sorted by money (winner always first, bankrupt players last)
  const standingsEl = document.getElementById("game-over-standings");
  const winnerId = winnerPlayer ? winnerPlayer.id : null;
  const sorted = [...gs.players].sort((a, b) => {
    if (winnerId) {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
    }
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return b.money - a.money;
  });
  const superBananaSvg = `<svg class="super-banana-icon" viewBox="0 0 64 64" width="28" height="28"><defs><linearGradient id="sbrb" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="#ff3333"/><stop offset="20%" stop-color="#ff9933"/><stop offset="40%" stop-color="#ffee33"/><stop offset="60%" stop-color="#33dd55"/><stop offset="80%" stop-color="#3399ff"/><stop offset="100%" stop-color="#cc44ff"/></linearGradient></defs><g transform="rotate(45,32,32) translate(64,0) scale(-1,1)"><path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#sbrb)" stroke="#fff" stroke-width="1.5"/><path d="M36 10 C38 6 41 3 44 2 C46 1 47 3 46 5 C45 7 42 9 39 10Z" fill="#5a3a1a" stroke="#3d2510" stroke-width="0.8" stroke-linejoin="round"/><path d="M24 38 C22 42 21 46 22 50" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round"/></g></svg>`;

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
      const isWinner = winnerId && p.id === winnerId;
      const bananaIcon = isWinner ? superBananaSvg : "";
      return `<div class="standing-row">${medal} ${emoji} <span style="flex:1;margin-left:6px">${p.name}${status}</span>${bananaIcon}<span>${p.money}\uD83C\uDF4C</span></div>`;
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
  const _isSimpleAny =
    gs.gameMode === "simple" || gs.gameMode === "simple_teams";
  if (_isSimpleAny) content.classList.add("reveal-content--simple");

  // Title
  const title = document.createElement("div");
  title.className = "reveal-title";
  title.innerHTML = "\ud83c\udf4c THE BOARD \ud83c\udf4c";
  content.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.className = "reveal-subtitle";
  subtitle.textContent = _isSimpleAny
    ? "Here's every tile in this run \u2014 shuffled fresh."
    : "Here are all the tiles this game...";
  content.appendChild(subtitle);

  // Simple mode uses a dedicated grouping (Farms / Grow Tiles / Special Tiles)
  // because its tiles all share `group: "simple"` and would otherwise be
  // dropped by the classic colour-keyed renderer below.
  if (_isSimpleAny) {
    _renderSimpleReveal(content);
    _attachRevealCountdown(content, overlay);
    return;
  }

  // Group tiles from boardLayout
  const colorOrder = [
    "yellow",
    "lightblue",
    "red",
    "pink",
    "darkblue",
    "orange",
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
  const grows = [];
  let mushroom = null;

  for (const tile of gs.boardLayout) {
    if (tile.type === "grow") {
      grows.push(tile);
      continue;
    }
    if (tile.type === "desert") {
      cacti.push(tile);
    } else if (tile.group && tile.group !== "desert" && tile.group !== "mushroom") {
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
      " tiles</span>";
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
      '<span class="reveal-group-dot" style="background:#000"></span> Other Tiles';
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

  // Grow tiles (now shuffled into the board like any other tile)
  if (grows.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";

    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#2e7d32"></span> Grow Tiles 🌴 ' +
      '<span class="reveal-group-meta">' +
      grows.length +
      " tiles (hidden & shuffled)</span>";
    section.appendChild(header);

    const row = document.createElement("div");
    row.className = "reveal-group-tiles";

    grows.sort((a, b) => (a.growPct || 0) - (b.growPct || 0));
    for (const t of grows) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile-other";
      const pct = Math.round((t.growPct || 0) * 100);
      el.innerHTML =
        '<span class="reveal-tile-emoji">🌴</span>' +
        '<span class="reveal-tile-label">' + pct + '%</span>';
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
      '<span class="reveal-group-dot" style="background:#fff"></span> Super Banana \u2b50';
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
  _attachRevealCountdown(content, overlay);
}

// Build and attach the shared countdown footer + start the 5-second timer.
// Called by both the classic and simple-mode reveal paths so the timing/
// presentation of the countdown stays identical between modes.
function _attachRevealCountdown(content, overlay) {
  const acceptBar = document.createElement("div");
  acceptBar.className = "reveal-accept-bar";
  acceptBar.id = "reveal-accept-bar";

  const countdownEl = document.createElement("div");
  countdownEl.className = "reveal-countdown";
  countdownEl.id = "reveal-countdown";
  countdownEl.textContent = "Shuffling\u2026 Starting in 5";
  acceptBar.appendChild(countdownEl);

  const progressBar = document.createElement("div");
  progressBar.className = "reveal-progress-bar";
  const progressFill = document.createElement("div");
  progressFill.className = "reveal-progress-fill";
  progressBar.appendChild(progressFill);
  acceptBar.appendChild(progressBar);

  content.appendChild(acceptBar);
  overlay.appendChild(content);

  let remaining = 5;
  clearInterval(window._revealCountdownTimer);
  window._revealCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(window._revealCountdownTimer);
      countdownEl.textContent = "\uD83C\uDF4C Shuffling\u2026";
    } else {
      countdownEl.textContent = `Shuffling\u2026 Starting in ${remaining}`;
    }
    progressFill.style.width = `${((5 - remaining) / 5) * 100}%`;
  }, 1000);
}

// Simple-mode reveal: 40 farms (F1\u2013F40), 6 grow tiles (G1\u2013G6), and 2 special
// tiles (+25 Free Bananas, Super Banana). The colour-keyed classic renderer
// would silently drop these \u2014 every simple-mode tile shares `group: "simple"`,
// which isn't in colorOrder.
function _renderSimpleReveal(content) {
  const tilesGrid = document.createElement("div");
  tilesGrid.className = "reveal-grid reveal-grid--simple";

  const farms = [];
  const grows = [];
  const specials = [];
  for (const tile of gs.boardLayout || []) {
    if (tile.type === "grow") {
      grows.push(tile);
    } else if (tile.group === "simple") {
      farms.push(tile);
    } else if (tile.type === "special" || tile.type === "freebananas") {
      specials.push(tile);
    }
  }
  farms.sort((a, b) => (a.price || 0) - (b.price || 0));
  grows.sort((a, b) => (a.growLabel || 0) - (b.growLabel || 0));

  // Farms \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (farms.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const lo = farms[0].price;
    const hi = farms[farms.length - 1].price;
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#ffd633"></span>' +
      ' Farms \uD83C\uDF3E <span class="reveal-group-meta">' +
      farms.length + ' farms \u00B7 yields ' + lo + '\u2013' + hi + '\uD83C\uDF4C</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles";
    for (const t of farms) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile--farm";
      el.innerHTML = '<span class="reveal-tile-yield">F' + t.price + '</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Grow tiles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (grows.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#2e7d32"></span>' +
      ' Grow Tiles \uD83C\uDF34 <span class="reveal-group-meta">' +
      grows.length + ' tiles \u00B7 roll the number to fire</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles";
    for (const t of grows) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile--grow";
      const label = t.growLabel != null ? "G" + t.growLabel : "\uD83C\uDF34";
      el.innerHTML = '<span class="reveal-tile-yield">' + label + '</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Special tiles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (specials.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:linear-gradient(135deg,#ffd633,#d24cff)"></span>' +
      ' Special Tiles \u2728 <span class="reveal-group-meta">' +
      specials.length + ' tiles</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles reveal-group-tiles--specials";
    for (const t of specials) {
      const el = document.createElement("div");
      let icon, name, mod;
      if (t.type === "freebananas") {
        icon = "\uD83C\uDF4C"; name = "+25 Free Bananas"; mod = "reveal-tile--freebananas";
      } else {
        // Super Banana / mushroom-style special.
        icon = "\u2B50"; name = "Super Banana"; mod = "reveal-tile--super";
      }
      el.className = "reveal-tile reveal-tile--special " + mod;
      el.innerHTML =
        '<span class="reveal-tile-icon">' + icon + '</span>' +
        '<span class="reveal-tile-name">' + name + '</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  content.appendChild(tilesGrid);
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
  _revealShown = false;
  _shufflePlayed = false;
  resetBoardAnimationState();

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
  const modeLabel =
    gs.gameMode === "teams"
      ? "2v2 Teams"
      : gs.gameMode === "simple_teams"
        ? "2v2 Simple Teams"
        : gs.gameMode === "simple"
          ? "Simple Mode"
          : "Free for All";
  const _superBananaWinModes =
    gs.gameMode === "teams" || gs.gameMode === "simple_teams";
  settingsEl.innerHTML = `
    <div class="lobby-setting">\ud83c\udf4c <span class="lobby-setting-val">${gs.startingMoney || 500}</span></div>
    <div class="lobby-setting">\ud83d\udc65 <span class="lobby-setting-val">${gs.maxPlayers || 4} max</span></div>
    <div class="lobby-setting">\ud83c\udfae <span class="lobby-setting-val">${modeLabel}</span></div>
    ${_superBananaWinModes ? `<div class="lobby-setting">\u2b50 <span class="lobby-setting-val">Win: Buy the Super Banana (7777\ud83c\udf4c)</span></div>` : ""}
    ${gs.bombMode ? '<div class="lobby-setting">\ud83c\udf4d <span class="lobby-setting-val">Pineapple Bomb Mode</span></div>' : ""}
    ${gs.monkeyPoker ? '<div class="lobby-setting">\ud83d\udc35 <span class="lobby-setting-val">Monkey Poker</span></div>' : ""}
    ${!gs.monkeyPoker ? '<div class="lobby-setting">\ud83c\udccf <span class="lobby-setting-val">Real Poker</span></div>' : ""}
    ${gs.isPublic ? '<div class="lobby-setting">\ud83c\udf10 <span class="lobby-setting-val">Public</span></div>' : '<div class="lobby-setting">\ud83d\udd12 <span class="lobby-setting-val">Private</span></div>'}
  `;

  // Host settings controls (hide while waiting for players to return from finished game)
  const controlsEl = document.getElementById("lobby-settings-controls");
  const isHost = myId === gs.admin;
  if (isHost && gs.state === "waiting") {
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
      if (gs.gameMode === "teams" || gs.gameMode === "simple_teams") {
        lobbyMax.value = "4";
        lobbyMax.disabled = true;
      } else {
        lobbyMax.value = String(gs.maxPlayers || 4);
        lobbyMax.disabled = false;
      }
      document.getElementById("lobby-public").checked = !!gs.isPublic;
      document.getElementById("lobby-bomb-mode").checked = !!gs.bombMode;
      const lobbyBombCost = document.getElementById("lobby-bomb-cost");
      if (lobbyBombCost && gs.bombCost != null) lobbyBombCost.value = gs.bombCost;
      document.getElementById("lobby-monkey-poker").checked = !!gs.monkeyPoker;
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
  const waitingForLobby = gs.state === "finished" && gs.lobbyReady;
  const list = document.getElementById("lobby-players");
  list.innerHTML = "";
  gs.players.forEach((p, idx) => {
    const div = document.createElement("div");
    const isMe = p.id === myId;
    const notReturned = waitingForLobby && !gs.lobbyReady.includes(p.id);
    div.className = "lobby-player" + (isMe ? " lobby-player-me" : "") + (notReturned ? " lobby-player-away" : "");
    const emoji = monkeyEmoji[p.color] || "\ud83d\udc35";
    const role =
      p.id === gs.admin
        ? '<span class="lobby-player-role">\ud83d\udc51 Host</span>'
        : "";
    const editHint = "";
    const isTeamMode =
      gs.gameMode === "teams" || gs.gameMode === "simple_teams";
    const isSimpleAny =
      gs.gameMode === "simple" || gs.gameMode === "simple_teams";
    const teamTag = isTeamMode
      ? `<span class="lobby-team-tag">${idx < 2 ? "Team A" : "Team B"}</span>`
      : "";
    const petBadge = isSimpleAny
      ? ""
      : p.pet
        ? p.pet === "hidden"
          ? `<span class="lobby-pet-badge">\u2713 Pet chosen</span>`
          : `<span class="lobby-pet-badge">${PET_EMOJIS[p.pet] || "\ud83d\udc3e"} ${petDisplayName(p.pet)}</span>`
        : "";
    const hostActions = (isHost && !isMe && gs.state === "waiting")
      ? `<div class="lobby-host-actions">
           <button class="lobby-btn-transfer" data-id="${p.id}" title="Transfer host">👑</button>
           <button class="lobby-btn-kick" data-id="${p.id}" title="Kick player">✕</button>
         </div>`
      : "";
    div.innerHTML = `
      <div class="lobby-player-avatar c-${p.color}">${emoji}</div>
      <div class="lobby-player-info">
        <div class="lobby-player-name">${p.name}${editHint}</div>
        ${role}${teamTag}${petBadge}
      </div>
      ${hostActions}
    `;

    list.appendChild(div);
  });

  // Empty slots
  const maxP = gs.maxPlayers || 4;
  for (let i = gs.players.length; i < maxP; i++) {
    const slot = document.createElement("div");
    slot.className = "lobby-slot-empty";
    const teamTag =
      gs.gameMode === "teams" || gs.gameMode === "simple_teams"
        ? `<span class="lobby-team-tag">${i < 2 ? "Team A" : "Team B"}</span>`
        : "";
    slot.innerHTML =
      '<div class="lobby-slot-empty-dot">?</div><span>Waiting\u2026</span>' +
      teamTag;
    list.appendChild(slot);
  }

  // Host action buttons
  list.querySelectorAll(".lobby-btn-transfer").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.id;
      const target = gs.players.find((p) => p.id === targetId);
      if (target && confirm(`Transfer host to ${target.name}?`)) {
        socket.emit("transfer_host", { gameId, targetId });
      }
    };
  });
  list.querySelectorAll(".lobby-btn-kick").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.id;
      const target = gs.players.find((p) => p.id === targetId);
      if (target && confirm(`Remove ${target.name} from the lobby?`)) {
        socket.emit("kick_player", { gameId, targetId });
      }
    };
  });

  // Waiting indicator
  const waitingEl = document.getElementById("lobby-waiting");
  const waitingTextEl = document.getElementById("lobby-waiting-text");
  if (waitingForLobby) {
    const readyCount = gs.lobbyReady.length;
    const totalCount = gs.players.length;
    waitingEl.style.display = "flex";
    waitingTextEl.textContent =
      `Waiting for players to return (${readyCount}/${totalCount})`;
  } else if (gs.gameMode === "teams" || gs.gameMode === "simple_teams") {
    waitingEl.style.display = gs.players.length < 4 ? "flex" : "none";
    waitingTextEl.textContent = "Waiting for players";
  } else {
    waitingEl.style.display = gs.players.length < 2 ? "flex" : "none";
    waitingTextEl.textContent = "Waiting for players";
  }

  const btn = document.getElementById("btn-start");
  const allHavePets = gs.players.every((p) => p.pet);
  if (waitingForLobby) {
    btn.disabled = true;
  } else if (gs.gameMode === "teams" || gs.gameMode === "simple_teams") {
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
  magic: "\ud83e\udd84",
};
const PET_NAMES = {
  strong: "Strong Pet",
  energy: "Energy Pet",
  magic: "Magic Pet",
};

// Simple mode renames the strong pet to "Magic Dice" everywhere it shows up.
function petDisplayName(petType) {
  if (
    gs &&
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
    petType === "strong"
  ) {
    return "Magic Dice";
  }
  return PET_NAMES[petType] || "Pet";
}

function selectPet(petType) {
  if (!socket || !gameId) return;
  socket.emit("select_pet", { gameId, petType });
}

function usePet() {
  if (!socket || !gameId || !gs) return;
  const me = _gsPlayerMap[myId];
  if (!me || !me.pet) return;
  if (me.petCooldown > 0) return;
  socket.emit("use_pet", { gameId });
}

function cancelPet() {
  if (!socket || !gameId) return;
  socket.emit("cancel_pet", { gameId });
}

// ── Simple-mode Magic Dice ────────────────────────────────────────
function useMagicDice(steps) {
  if (!socket || !gameId) return;
  socket.emit("use_magic_dice", { gameId, steps });
}

function upgradeMagicDice() {
  if (!socket || !gameId) return;
  socket.emit("upgrade_magic_dice", { gameId });
}

// Magic Dice cooldown length (mirrors useMagicDice: cur.petCooldown = 10).
const MAGIC_DICE_COOLDOWN = 10;

// Build a die-shaped step button. 1–6 render real pip patterns; 7+ render a
// centered number (no real die face above 6).
function _makeMagicDieButton(n) {
  const die = document.createElement("button");
  die.className = "magic-dice-step";
  die.dataset.value = String(n);
  if (n >= 1 && n <= 6) {
    die.classList.add("die-pips", "pips-" + n);
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      die.appendChild(pip);
    }
  } else {
    die.classList.add("die-num");
    const label = document.createElement("span");
    label.className = "die-num-label";
    label.textContent = String(n);
    die.appendChild(label);
  }
  return die;
}

// ── Simple-mode GROW pulse animation ──────────────────────────────
// When a grow tile fires on a rolled number (pre-move), a glow of the roller's
// colour starts on that grow tile and chains clockwise, one tile at a time, to
// the next genuinely-revealed grow (its range). Each of the roller's farms the
// pulse crosses pops its banana pile in at that moment. All grows fired this
// roll pulse simultaneously; longer ranges step a bit faster; a grow that grew
// nothing still pulses, just quickly. This plays BEFORE the token walks.
const SIMPLE_PLAYER_COLOR_HEX = {
  brown: "#e23b3b", // red slot
  golden: "#2e7fe0", // blue slot
  silver: "#ff8c00", // orange slot (was green)
  red: "#8e44ad", // purple slot (was black)
};

// Grow positions fired this turn for a given source ("roll" = rolled-number
// match, fires pre-walk; "land" = a grow you landed on, fires after arrival),
// de-duplicated.
function _computeGrowPulseBySource(gs, source) {
  if (
    !gs ||
    (gs.gameMode !== "simple" && gs.gameMode !== "simple_teams")
  ) {
    return [];
  }
  const act = gs.lastGrowActivated;
  if (!Array.isArray(act) || act.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const a of act) {
    if (!a || a.source !== source || a.pos == null) continue;
    if (seen.has(a.pos)) continue;
    seen.add(a.pos);
    out.push(a.pos);
  }
  return out;
}
function _computePreWalkGrowPulse(gs) {
  return _computeGrowPulseBySource(gs, "roll");
}
function _computeLandGrowPulse(gs) {
  return _computeGrowPulseBySource(gs, "land");
}

// Tiles strictly clockwise after growPos up to (excluding) the next genuinely
// revealed grow. Wraps almost the whole board if no other grow is known yet.
// Mirrors the backend _simpleGrowRange.
function _simpleGrowRangePath(gs, growPos) {
  const boardSize = (gs.boardLayout || []).length || 48;
  const revealedGrows = new Set(
    (gs.genuineRevealedGrows || []).filter((p) => p !== growPos),
  );
  const path = [];
  for (let off = 1; off < boardSize; off++) {
    const p = (growPos + off) % boardSize;
    if (revealedGrows.has(p)) break;
    path.push(p);
  }
  return path;
}

function _lightPulseTile(pos, hex, ttlMs) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.style.setProperty("--pulse-color", hex);
  el.classList.add("grow-pulse-on");
  if (el._growPulseTimer) clearTimeout(el._growPulseTimer);
  el._growPulseTimer = setTimeout(() => {
    el.classList.remove("grow-pulse-on");
    el._growPulseTimer = null;
  }, ttlMs);
}

function _growPopTile(pos) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.classList.remove("grow-pop");
  void el.offsetWidth; // restart the animation
  el.classList.add("grow-pop");
  el.addEventListener("animationend", () => el.classList.remove("grow-pop"), {
    once: true,
  });
}

// Fire the "Early Pickup!" floater + burst for a farm the roller stood on when
// it grew (synced to the pulse crossing it). Marks the tile visited so its pile
// renders as collected.
function _firePulseEarlyPickup(gs, cur, pos) {
  const el = document.getElementById("space-" + pos);
  if (el) {
    const r = el.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "early-pickup-floater";
    f.textContent = "Early Pickup!";
    f.style.position = "fixed";
    f.style.left = r.left + r.width / 2 + "px";
    f.style.top = r.top + r.height / 2 + "px";
    f.style.pointerEvents = "none";
    f.style.zIndex = "9999";
    document.body.appendChild(f);
    f.addEventListener("animationend", () => f.remove());
  }
  if (typeof bananaBurst === "function") {
    bananaBurst((gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[pos]) || 1, cur.id);
  }
  if (window._tokenVisitedTiles) window._tokenVisitedTiles.add(pos);
}

// Light a grow TILE's "fired" pop (bouncy scale + yellow G-number) — applied by
// the pulse when its chain fires, so a grow you're about to land on no longer
// glows during the approach walk.
function _fireGrowTileGlow(pos) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.classList.remove("grow-fired");
  void el.offsetWidth;
  el.classList.add("grow-fired");
  el.addEventListener("animationend", () => el.classList.remove("grow-fired"), {
    once: true,
  });
}

// Bounce a farm's banana count box (even if it already had bananas). The tile
// sits in _pileBounceTiles for one bounce; board.js adds the .pile-bounce class
// while it's there (surviving the chip recreation walkStepUpdate does).
const PILE_BOUNCE_MS = 1000; // pronounced grow bounce duration (see .pile-bounce)
function _bounceFarmPile(pos) {
  if (!window._pileBounceTiles) window._pileBounceTiles = new Set();
  if (!window._pileBounceStart) window._pileBounceStart = {};
  window._pileBounceTiles.add(pos);
  // Record when the bounce began so board.js can resume it (negative
  // animation-delay) after each chip rebuild rather than restarting it.
  window._pileBounceStart[pos] = performance.now();
  setTimeout(() => {
    if (window._pileBounceTiles) window._pileBounceTiles.delete(pos);
    if (window._pileBounceStart) delete window._pileBounceStart[pos];
  }, PILE_BOUNCE_MS + 80);
}

// Animate the pulse(s) for `growPositions` (simultaneous), then call onAllDone.
// The chain sweep advances at 7 steps/second (≈143ms per tile) by default and
// stays linear. If a chain is long enough that 7/sec would run past 2s, the per-
// tile time shrinks just enough to fit the whole sweep into 2s (still linear) —
// so the sweep never takes longer than 2 seconds. opts.earlyPickup (default
// true) controls the "Early Pickup!" floater — only the pre-walk pulse handles
// it; the landing pulse must not re-fire it.
const GROW_PULSE_RATE = 7; // default steps per second
// Empty fires (no farms in range to grow) zip past at 20 tiles/sec — no piles
// pop in along the chain, so there's nothing for the player to watch and the
// pulse just becomes wasted time.
const GROW_PULSE_RATE_EMPTY = 20;
const GROW_PULSE_MAX_MS = 2000; // hard cap on the whole sweep (then compress, linear)
const GROW_PULSE_BOUNCE_TAIL = 480; // let the last count-box bounce finish
function _runGrowPulse(gs, growPositions, cur, onAllDone, opts) {
  const hex = (cur && SIMPLE_PLAYER_COLOR_HEX[cur.color]) || "#ffe135";
  const grownSet = new Set(gs.diceMatchTiles || []);
  const firedSet = new Set(gs.lastGrowFired || []); // grows that actually grew
  const handleEP = !opts || opts.earlyPickup !== false;
  const epTile = handleEP ? gs.diceMatchEarlyPickup : null;
  let epFired = false;
  if (!window._pulseRevealedTiles) window._pulseRevealedTiles = new Set();

  let maxTotal = 0;
  for (const growPos of growPositions) {
    const fullPath = [growPos, ..._simpleGrowRangePath(gs, growPos)];
    const len = fullPath.length || 1;
    const grew = firedSet.has(growPos); // this grow produced bananas
    // 7 tiles/sec normally, but shrink the step so a long chain still fits
    // within 2s. Empty fires (no farms in range) sweep at 20 tiles/sec so the
    // animation doesn't slow the game down when there's nothing to watch.
    const rate = grew ? GROW_PULSE_RATE : GROW_PULSE_RATE_EMPTY;
    const stepMs = Math.min(1000 / rate, GROW_PULSE_MAX_MS / len);
    const totalMs = len * stepMs; // ≤ GROW_PULSE_MAX_MS, linear
    maxTotal = Math.max(maxTotal, totalMs);
    const trailMs = Math.round(stepMs + 350); // glow lingers → comet tail
    for (let k = 0; k < fullPath.length; k++) {
      const pos = fullPath[k];
      const t = Math.round(k * stepMs);
      setTimeout(() => {
        _lightPulseTile(pos, hex, trailMs);
        // The grow tile itself lights (bouncy pop + text glow) the moment its
        // chain fires — but only when it actually grew something.
        if (k === 0 && grew) _fireGrowTileGlow(pos);
        if (grownSet.has(pos) && !window._pulseRevealedTiles.has(pos)) {
          window._pulseRevealedTiles.add(pos);
          _growPopTile(pos); // per-tile flash (kept alongside the box bounce)
          _bounceFarmPile(pos); // bounce the count box as the chain reaches it
          if (pos === epTile && !epFired) {
            epFired = true;
            _firePulseEarlyPickup(gs, cur, pos);
          }
          if (typeof walkStepUpdate === "function") walkStepUpdate(gs);
        }
      }, t);
    }
  }

  setTimeout(() => {
    // Safety net: if the early-pickup tile somehow wasn't on a pulse path, still
    // fire it so the pickup reads before the walk.
    if (epTile != null && !epFired) _firePulseEarlyPickup(gs, cur, epTile);
    if (typeof onAllDone === "function") onAllDone();
  }, maxTotal + GROW_PULSE_BOUNCE_TAIL);
}

function updateMagicDiceBox(me, isMyTurn) {
  const box = document.getElementById("magic-dice-box");
  if (!box) return;
  if (!me || gs.state === "finished" || me.startPickPending) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";

  const max = Math.max(0, Number(me.magicDiceMaxSteps) || 0);
  const cd = Math.max(0, Number(me.petCooldown) || 0);
  const ready = cd === 0;
  const canUse = isMyTurn && !gs.diceRolled && ready;

  // Cooldown gauge ring.
  const gauge = document.getElementById("magic-dice-gauge");
  const ringFill = document.getElementById("magic-dice-ring-fill");
  const center = document.getElementById("magic-dice-gauge-center");
  const status = document.getElementById("magic-dice-status");
  const R = 27;
  const CIRC = 2 * Math.PI * R;
  if (ringFill) {
    ringFill.style.strokeDasharray = String(CIRC);
    // Ring depletes as cooldown ticks down; full when ready.
    const frac = ready ? 1 : Math.max(0, Math.min(1, cd / MAGIC_DICE_COOLDOWN));
    ringFill.style.strokeDashoffset = String(CIRC * (1 - frac));
  }
  if (gauge) {
    gauge.classList.toggle("ready", ready);
    gauge.classList.toggle("cooling", !ready);
    gauge.classList.toggle("usable", canUse);
  }
  if (center) {
    center.textContent = ready ? "🎲" : String(cd);
  }
  if (status) {
    if (!ready) status.textContent = `Charging · ${cd} ${cd === 1 ? "roll" : "rolls"}`;
    else if (canUse) status.textContent = "Ready — pick your roll!";
    else status.textContent = "Ready";
  }

  // Step picker (pip dice): fixed at six options, 1..6 — no upgrades. There is
  // no "stay put" / 0-step option.
  const pickerLabel = document.getElementById("magic-dice-picker-label");
  const picker = document.getElementById("magic-dice-picker");
  if (picker) {
    picker.innerHTML = "";
    if (pickerLabel) pickerLabel.style.display = "";
    for (let n = 1; n <= max; n++) {
      const die = _makeMagicDieButton(n);
      die.disabled = !canUse;
      die.title = `Move ${n}`;
      die.onclick = () => useMagicDice(n);
      picker.appendChild(die);
    }
  }

  // No upgrade button anymore — Magic Dice is permanently level 6.
  const upBtn = document.getElementById("btn-upgrade-magic-dice");
  if (upBtn) upBtn.style.display = "none";
}

function updateLobbyPets() {
  const petSection = document.getElementById("lobby-pet-section");
  if (!petSection || !gs) return;
  // Simple modes auto-assign Magic Dice — hide the picker entirely.
  if (gs.gameMode === "simple" || gs.gameMode === "simple_teams") {
    petSection.style.display = "none";
    return;
  }
  petSection.style.display = "";
  const me = _gsPlayerMap[myId];
  if (!me) return;

  // Highlight selected pet card
  const cards = document.querySelectorAll(".lobby-pet-card");
  cards.forEach((card) => {
    const pet = card.getAttribute("data-pet");
    card.classList.toggle("lobby-pet-selected", me.pet === pet);
  });
}

function updatePetAbilityBox(me, isMyTurn) {
  const box = document.getElementById("pet-ability-box");
  // Simple mode has no pet/cooldown UI here — Magic Dice is a won item shown in
  // the "Your Special Items" box (see updateSpecialItems). Hide both panels.
  if (gs && (gs.gameMode === "simple" || gs.gameMode === "simple_teams")) {
    if (box) box.style.display = "none";
    const magicBox = document.getElementById("magic-dice-box");
    if (magicBox) magicBox.style.display = "none";
    return;
  }
  const magicBox = document.getElementById("magic-dice-box");
  if (magicBox) magicBox.style.display = "none";
  if (!box || !me) {
    if (box) box.style.display = "none";
    return;
  }

  if (!me.pet || gs.state === "finished") {
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
  const petName = petDisplayName(me.pet);

  const petUsable = me.petCooldown <= 0;
  const canAffordPet = true;

  // Show last coin flip result near toggle (delayed until coin animation finishes)
  const flipResultEl = document.getElementById("pet-flip-result");
  if (flipResultEl) {
    if (gs.petCoinFlip) {
      const flipSideKey = `${gs.turn}-${gs.petCoinFlip.playerName}-${gs.petCoinFlip.result}`;
      if (flipSideKey !== window._lastPetFlipSideKey) {
        window._lastPetFlipSideKey = flipSideKey;
        flipResultEl.style.display = "none";
        clearTimeout(window._petFlipSideTimer);
        // 400ms show delay + 150ms pause + 1200ms animation + 0ms buffer
        window._petFlipSideTimer = setTimeout(() => {
          const isHeads = gs.petCoinFlip && gs.petCoinFlip.result === "heads";
          flipResultEl.textContent = isHeads ? "✅ HEADS" : "❌ TAILS";
          flipResultEl.style.color = isHeads ? "#4caf50" : "#ff5555";
          flipResultEl.style.display = "";
        }, 1750);
      }
    } else {
      window._lastPetFlipSideKey = null;
      clearTimeout(window._petFlipSideTimer);
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
    info.textContent = `${petEmoji} ${petName} — Cooldown: ${me.petCooldown} turn${me.petCooldown !== 1 ? "s" : ""}`;
    if (toggleText)
      toggleText.textContent = `⏳ ${me.petCooldown} turn${me.petCooldown !== 1 ? "s" : ""}`;
  } else {
    // Ready
    if (toggleLabel) {
      toggleLabel.classList.remove("pet-toggle-disabled");
      toggleLabel.classList.remove("pet-toggle-cooldown");
    }
    if (petBtn) {
      // Energy/Strong/Magic pet: disable on your turn or if already pending
      const diceArmed = !!window._armedDiceOverride;
      // Only magic pet requires having rolled at least once first
      const notYetRolled = me.pet === "magic" && !me.hasRolled;
      if (me.pet === "energy" || me.pet === "strong" || me.pet === "magic") {
        petBtn.disabled =
          isMyTurn ||
          !!me.pendingPet ||
          !canAffordPet ||
          diceArmed ||
          notYetRolled;
      } else {
        petBtn.disabled =
          isMyTurn || !canAffordPet || diceArmed || notYetRolled;
      }
    }
    info.textContent = `${petEmoji} ${petName} — Ready!`;
    if (toggleText) {
      if (
        (me.pet === "energy" || me.pet === "strong" || me.pet === "magic") &&
        me.pendingPet
      ) {
        toggleText.textContent = "\ud83d\udc3e Pet acting next turn!";
      } else if (petBtn && petBtn.dataset.armed === "true") {
        toggleText.textContent = "\ud83d\udc3e Pet acting next turn!";
      } else if (me.pet === "magic" && !me.hasRolled) {
        toggleText.textContent = "\u26D4 Roll dice first";
      } else {
        toggleText.innerHTML =
          me.pet === "energy" || me.pet === "strong" || me.pet === "magic"
              ? "Use Pet"
              : "Use Pet Next Turn";
      }
    }

    // Magic pet needs a target selector when toggle is on
    const autoPetChecked = petBtn && petBtn.dataset.armed === "true";
    if (false) {
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

// ── Money Deduction Popup ──────────────────────────────────────────
// CONTRACT: call ONLY when the player's banana score has just decreased.
// The general money-delta detector in the game_update handler is the
// authoritative caller; other call sites must already know money went down
// (e.g. deferred deductions from that same detector). The amount guard below
// silently no-ops on 0/negative amounts so a stray call can't draw stray
// flying bananas. Pair with bananaBurst() for the inverse (score went up).
function _showMoneyDeduction(playerId, amount) {
  if (!amount || amount <= 0) return;
  // Show flying bananas from the player's token (up to 5, no text)
  const player = gs && gs.players && gs.players.find((p) => p.id === playerId);
  if (player != null) {
    let anchor = document.querySelector(`.token[data-player-id="${playerId}"]`);
    if (!anchor) anchor = document.querySelector(".token-me");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const count = 3;
      for (let i = 0; i < count; i++) {
        const el = document.createElement("span");
        el.className = "banana-burst-icon";
        el.textContent = "\ud83c\udf4c";
        el.style.left = originX + "px";
        el.style.top = originY + "px";
        const dx = (Math.random() - 0.5) * 160;
        const dy = -(60 + Math.random() * 140);
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--dy", dy + "px");
        el.style.fontSize = 0.9 + Math.random() * 0.9 + "em";
        el.style.animationDelay = Math.random() * 0.2 + "s";
        document.body.appendChild(el);
        el.addEventListener("animationend", () => el.remove());
      }
    }
    // Red negative text near the player's banana total
    const isMe = playerId === myId;
    const moneyAnchor = isMe
      ? document.getElementById("info-money")
      : document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-money`);
    if (moneyAnchor) {
      const mRect = moneyAnchor.getBoundingClientRect();
      const popup = document.createElement("div");
      popup.className = "money-deduction-float";
      popup.textContent = `-${amount}\ud83c\udf4c`;
      popup.style.position = "fixed";
      popup.style.left = mRect.left + mRect.width / 2 + "px";
      popup.style.top = mRect.top + "px";
      popup.style.pointerEvents = "none";
      popup.style.zIndex = "1000";
      document.body.appendChild(popup);
      popup.addEventListener("animationend", () => popup.remove());
    }
  }
}

// ── Animated Money Counter ─────────────────────────────────────────

function _animateMoneyEl(el, targetVal, suffix) {
  if (!el) return;
  suffix = suffix || "\ud83c\udf4c";
  // Simple modes get a per-digit slot-machine wheel (each reel spins upward
  // on a gain, downward on a loss). Classic / ffa keep the existing smooth
  // counter so they look unchanged for players used to that mode.
  if (
    typeof gs !== "undefined" &&
    gs &&
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams")
  ) {
    _animateMoneyWheel(el, targetVal, suffix);
    return;
  }
  // Skip if already displaying or animating toward this target
  if (el._moneyAnimTarget === targetVal) return;
  el._moneyAnimTarget = targetVal;
  // Parse current displayed number
  const currentText = el.textContent || "";
  const currentVal = parseInt(currentText.replace(/[^\d-]/g, ""), 10);
  if (isNaN(currentVal) || currentVal === targetVal) {
    el.textContent = `${targetVal}${suffix}`;
    return;
  }
  // Cancel any in-progress animation on this element
  if (el._moneyAnimFrame) cancelAnimationFrame(el._moneyAnimFrame);
  if (el._moneyFlashTimer) clearTimeout(el._moneyFlashTimer);

  const diff = targetVal - currentVal;
  const absDiff = Math.abs(diff);
  // Scale duration with the change amount: small changes ~400ms, large changes up to 1200ms
  const duration = Math.min(1200, Math.max(400, absDiff * 2));
  const startTime = performance.now();
  const startVal = currentVal;

  // Add color flash class
  if (diff > 0) {
    el.classList.add("money-anim-up");
    el.classList.remove("money-anim-down");
  } else {
    el.classList.add("money-anim-down");
    el.classList.remove("money-anim-up");
  }

  let prevDisplayVal = startVal;
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    // Ease-in-out: fast in the middle, slows at both ends for a realistic counter feel
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const val = Math.round(startVal + diff * eased);
    if (val !== prevDisplayVal) {
      el.textContent = `${val}${suffix}`;
      prevDisplayVal = val;
    }
    if (t < 1) {
      el._moneyAnimFrame = requestAnimationFrame(tick);
    } else {
      el.textContent = `${targetVal}${suffix}`;
      el._moneyAnimFrame = null;
      // Remove color flash after a brief hold
      el._moneyFlashTimer = setTimeout(() => {
        el._moneyFlashTimer = null;
        el.classList.remove("money-anim-up", "money-anim-down");
      }, 400);
    }
  }
  el._moneyAnimFrame = requestAnimationFrame(tick);
}

// ── Slot-machine money wheel (simple modes) ───────────────────────
//
// Each digit position is its own reel: a vertical strip of digits that
// slides through the visible 1-em-tall window. Gains spin the reels
// UPWARD (digits scroll up out of view, new digits rise in from below);
// losses spin DOWNWARD. After the animation settles the element's text
// content is reset to the plain `${target}${suffix}` string so anything
// that reads textContent (the parser at the top of _animateMoneyEl, for
// example) sees a normal number again.
function _animateMoneyWheel(el, targetVal, suffix) {
  if (!el) return;
  suffix = suffix || "🍌";
  if (typeof targetVal !== "number" || !Number.isFinite(targetVal)) return;
  targetVal = Math.round(targetVal);

  // Treat a re-call with the same target as a no-op so frequent renders
  // don't restart the spin from scratch.
  if (el._wheelTarget === targetVal) return;

  // Resolve current value: prefer the cached "last target" (accurate even
  // mid-spin) over parsing textContent (which during a spin contains every
  // digit on every reel concatenated).
  let currentVal = el._wheelTarget;
  if (currentVal == null) {
    const raw = (el.textContent || "").replace(/[^\d-]/g, "");
    currentVal = parseInt(raw, 10);
  }
  if (!Number.isFinite(currentVal)) currentVal = targetVal;

  el._wheelTarget = targetVal;

  if (currentVal === targetVal) {
    if (el._wheelTimer) {
      clearTimeout(el._wheelTimer);
      el._wheelTimer = null;
    }
    el.textContent = `${targetVal}${suffix}`;
    return;
  }

  // Cancel any settle timer from a prior spin so we don't snap text away
  // while the new spin is running.
  if (el._wheelTimer) {
    clearTimeout(el._wheelTimer);
    el._wheelTimer = null;
  }

  const direction = targetVal > currentVal ? "up" : "down";
  const currentAbs = Math.abs(currentVal);
  const targetAbs = Math.abs(targetVal);
  const currentStr = String(currentAbs);
  const targetStr = String(targetAbs);
  const maxLen = Math.max(currentStr.length, targetStr.length);
  const padCurrent = currentStr.padStart(maxLen, "0");
  const padTarget = targetStr.padStart(maxLen, "0");

  // Per-step duration (~70 ms feels like a real slot reel), with a min and
  // max so tiny changes don't feel instant and huge ones don't drag.
  const absDiff = Math.abs(targetVal - currentVal);
  const baseMs = Math.min(950, Math.max(450, 350 + Math.log10(absDiff + 1) * 220));

  // Rebuild the element: optional sign, N reels, suffix.
  el.innerHTML = "";
  if (targetVal < 0) {
    const sign = document.createElement("span");
    sign.className = "money-sign";
    sign.textContent = "-";
    el.appendChild(sign);
  }

  const reelAnimators = [];
  for (let i = 0; i < maxLen; i++) {
    const fromDigit = parseInt(padCurrent[i], 10);
    const toDigit = parseInt(padTarget[i], 10);
    const built = _buildMoneyReel(fromDigit, toDigit, direction);
    el.appendChild(built.reel);
    reelAnimators.push(built.animate);
  }

  const sfx = document.createElement("span");
  sfx.className = "money-suffix";
  sfx.textContent = suffix;
  el.appendChild(sfx);

  if (direction === "up") {
    el.classList.add("money-anim-up");
    el.classList.remove("money-anim-down");
  } else {
    el.classList.add("money-anim-down");
    el.classList.remove("money-anim-up");
  }

  // Kick off the CSS transitions on the next frame so the initial transform
  // is committed first (otherwise the browser would collapse start+end into
  // a single repaint and skip the animation).
  requestAnimationFrame(() => {
    for (const fn of reelAnimators) fn(baseMs);
  });

  // After the spin settles, flatten back to plain text so future reads
  // (or callers that snapshot textContent) see a clean number.
  el._wheelTimer = setTimeout(() => {
    el._wheelTimer = null;
    // Guard against a newer spin having claimed the element already.
    if (el._wheelTarget !== targetVal) return;
    el.textContent = `${targetVal}${suffix}`;
    setTimeout(() => {
      if (el._wheelTarget !== targetVal) return;
      el.classList.remove("money-anim-up", "money-anim-down");
    }, 380);
  }, baseMs + 120);
}

function _buildMoneyReel(fromDigit, toDigit, direction) {
  const reel = document.createElement("span");
  reel.className = "money-digit-reel";

  if (fromDigit === toDigit) {
    const digit = document.createElement("span");
    digit.className = "money-digit";
    digit.textContent = String(toDigit);
    reel.appendChild(digit);
    return { reel, animate: () => {} };
  }

  // Walk the digits from `fromDigit` toward `toDigit` in the chosen
  // direction (wrapping 0..9). Sequence always starts with fromDigit and
  // ends with toDigit; for a 1-step change that's two entries.
  const sequence = [fromDigit];
  let cur = fromDigit;
  const advance =
    direction === "up"
      ? (d) => (d + 1) % 10
      : (d) => (d - 1 + 10) % 10;
  while (cur !== toDigit) {
    cur = advance(cur);
    sequence.push(cur);
  }

  // UP: strip in natural order, scroll up (translateY 0 → -(N-1)em) so the
  //     visible digit climbs through higher values.
  // DOWN: strip reversed, scroll down (translateY -(N-1)em → 0) so visible
  //       digits appear to fall toward smaller values.
  const stripItems = direction === "up" ? sequence : [...sequence].reverse();
  const totalSteps = sequence.length - 1;

  const strip = document.createElement("span");
  strip.className = "money-digit-strip";
  for (const d of stripItems) {
    const digit = document.createElement("span");
    digit.className = "money-digit";
    digit.textContent = String(d);
    strip.appendChild(digit);
  }
  reel.appendChild(strip);

  // Set the initial transform so the strip starts with fromDigit in view.
  const startTransform =
    direction === "up" ? "translateY(0)" : `translateY(-${totalSteps}em)`;
  const endTransform =
    direction === "up" ? `translateY(-${totalSteps}em)` : "translateY(0)";
  strip.style.transform = startTransform;

  return {
    reel,
    animate: (durationMs) => {
      // Force layout so the start transform is committed before we set the
      // end transform — otherwise the browser short-circuits the transition.
      void strip.offsetHeight;
      strip.style.transition = `transform ${durationMs}ms cubic-bezier(0.34, 0.04, 0.18, 1)`;
      strip.style.transform = endTransform;
    },
  };
}

// ── Property Card Flip Animation ───────────────────────────────────

function _showPropertyCardFlip(propName, propGroup, propPrice, timeStr, isWin) {
  // Remove any existing card flip overlay
  const existing = document.getElementById("prop-card-flip-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "prop-card-flip-overlay";
  overlay.className = "prop-card-flip-overlay";

  const card = document.createElement("div");
  card.className = "prop-card-flip";

  // Front face (question mark)
  const front = document.createElement("div");
  front.className = "prop-card-face prop-card-front";
  front.innerHTML = `<span class="prop-card-q">?</span>`;

  // Back face (property details)
  const back = document.createElement("div");
  back.className = "prop-card-face prop-card-back" + (propGroup ? " g-" + propGroup : "");
  if (isWin) {
    back.innerHTML =
      `<div class="prop-card-stamp">BOUGHT</div>` +
      `<div class="prop-card-name">${propName}</div>` +
      (propPrice ? `<div class="prop-card-price">${propPrice}\ud83c\udf4c yield</div>` : "") +
      (timeStr ? `<div class="prop-card-time">${timeStr}</div>` : "");
  } else {
    back.innerHTML =
      `<div class="prop-card-stamp prop-card-stamp-miss">MISSED</div>` +
      `<div class="prop-card-name">${propName}</div>` +
      (propPrice ? `<div class="prop-card-price">${propPrice}\ud83c\udf4c yield</div>` : "");
  }

  card.appendChild(front);
  card.appendChild(back);
  overlay.appendChild(card);

  const boardWrap = document.querySelector(".board-wrap");
  (boardWrap || document.body).appendChild(overlay);

  // Trigger flip after brief delay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add("flipped");
    });
  });

  // Auto-remove after animation
  setTimeout(() => {
    overlay.classList.add("prop-card-flip-out");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 600);
  }, isWin ? 3200 : 2800);
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
      textSpan.textContent = "Welcome To Monkey Bidniz!";
      msg.appendChild(nameSpan);
      msg.appendChild(textSpan);
      container.appendChild(msg);
    }
  }

  const cur = gs.currentPlayer;
  const me = _gsPlayerMap[myId];
  const isMyTurn = cur && cur.id === myId;

  // Turn info
  {
    const isMyTurnLabel = cur && cur.id === myId;
    const startPickLabel =
      cur &&
      cur.startPickPending &&
      (gs.gameMode === "simple" || gs.gameMode === "simple_teams");
    document.getElementById("turn-name").textContent = cur
      ? isMyTurnLabel
        ? startPickLabel
          ? "Pick your start tile!"
          : gs.petUsedThisTurn
            ? "\ud83d\udc3e Pet used!"
            : "Your turn!"
        : startPickLabel
          ? `${cur.name} is picking a tile\u2026`
          : cur.name
      : "—";
    document.getElementById("turn-name").style.color = isMyTurnLabel
      ? "#ffe135"
      : cur
        ? ""
        : "#888";
    const turnInfoEl = document.querySelector(".turn-info");
    if (turnInfoEl) turnInfoEl.classList.toggle("my-turn", !!isMyTurnLabel);
  }

  // Dice
  const die1El = document.getElementById("die1");
  const die2El = document.getElementById("die2");
  const die3El = document.getElementById("die3");
  const dieScene2 = document.getElementById("die-scene2");
  const dieScene3 = document.getElementById("die-scene3");
  // Show/hide die scenes based on dice count
  const numDice = gs.dice ? gs.dice.length : 2;
  if (dieScene2) dieScene2.style.display = numDice >= 2 ? "" : "none";
  if (dieScene3) dieScene3.style.display = numDice >= 3 ? "" : "none";
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
  const needsStartPick =
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
    gs.currentPlayer &&
    !!gs.currentPlayer.startPickPending;
  const canRoll =
    isMyTurn &&
    !gs.diceRolled &&
    !gs.mushroomPending &&
    !gs.petResolving &&
    !needsStartPick &&
    !window._abilityTargetMode &&
    rollDelayDone;
  document.getElementById("btn-roll").disabled = !canRoll;
  document.getElementById("btn-debug-move").disabled = !canRoll;

  // Dice override buttons: arm a paid dice count for your NEXT roll (armed on
  // other players' turns). Classic only: Turtle x1 + x3, both 300. In simple
  // mode the Rabbit/Cheetah dice are won items, armed from the "Your Special
  // Items" box (updateSpecialItems), so these two buttons are hidden.
  const myMoney = me ? me.money : 0;
  const simpleMode =
    gs.gameMode === "simple" || gs.gameMode === "simple_teams";
  const roll1Btn = document.getElementById("btn-roll-1");
  const roll3Btn = document.getElementById("btn-roll-3");
  const armedDice = window._armedDiceOverride || null;
  const petIsArmedForDice =
    (document.getElementById("btn-auto-pet") &&
      document.getElementById("btn-auto-pet").dataset.armed === "true") ||
    (me && me.pendingPet);
  const isFirstRound = gs.turn < gs.players.length;
  // Per-button config: icon, the dice count it arms, and its cost.
  const cfgA = { icon: "\uD83D\uDC22", count: 1, cost: 300 }; // Turtle x1
  const cfgB = { icon: "\uD83D\uDC07", count: 3, cost: 300 }; // x3
  const configDiceBtn = (btn, cfg, otherCount) => {
    if (!btn) return;
    // Hidden entirely in simple mode (won dice items replace these).
    if (simpleMode) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = me ? "" : "none";
    btn.disabled =
      isMyTurn ||
      myMoney < cfg.cost ||
      !!petIsArmedForDice ||
      isFirstRound ||
      armedDice === otherCount;
    const armed = armedDice === cfg.count;
    const tail = armed ? "Armed \u2713" : `${cfg.cost}\uD83C\uDF4C`;
    btn.innerHTML =
      `<span style="font-size:1.2em;line-height:1">${cfg.icon}</span>` +
      `<span>\uD83C\uDFB2\u00d7${cfg.count} ${tail}</span>`;
    btn.classList.toggle("btn-armed", armed);
    btn.onclick = () => armDiceOverride(cfg.count);
  };
  configDiceBtn(roll1Btn, cfgA, cfgB.count);
  configDiceBtn(roll3Btn, cfgB, cfgA.count);
  // When it's our turn and dice override is armed, show indicator on roll button
  const _ARMED_ROLL_LABEL = {
    rabbitDice: "\uD83D\uDC22 Turtle Dice",
    cheetahDice: "\uD83D\uDC07 Rabbit Dice",
    magicDice: "1\uFE0F\u20E3 Roll One",
    teleport: "\uD83C\uDF3F Vine Swing",
  };
  const rollBtn = document.getElementById("btn-roll");
  const myArmed = me && me.armedAbility;
  if (rollBtn) {
    if (canRoll && (gs.gameMode === "simple" || gs.gameMode === "simple_teams") && myArmed) {
      rollBtn.textContent = _ARMED_ROLL_LABEL[myArmed] || "Roll Dice";
    } else if (canRoll && armedDice) {
      rollBtn.textContent = `\uD83C\uDFB2 Roll (${armedDice} ${armedDice === 1 ? "die" : "dice"})`;
    } else {
      rollBtn.textContent = "Roll Dice";
    }
  }

  // Armed special ability (simple mode) fires the moment your turn is ready —
  // takes precedence over a plain auto-roll.
  if (canRoll) _maybeFireArmedAbility();

  // Auto-roll: trigger dice roll when it's our turn and we haven't rolled yet
  // (skip if an ability is armed/being fired — that drives the turn instead).
  if (
    canRoll &&
    !myArmed &&
    document.getElementById("chk-auto-roll").checked
  ) {
    if (!window._autoRollQueued) {
      window._autoRollQueued = true;
      setTimeout(() => {
        window._autoRollQueued = false;
        const meNow = _gsPlayerMap[myId];
        if (document.getElementById("chk-auto-roll").checked && !(meNow && meNow.armedAbility)) rollDice();
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

  // Universal dice roll notification — show for all players when dice are rolled.
  // Simple-mode start picks teleport instantly, so skip the walk animation path.
  const diceNotif = document.getElementById("dice-roll-notification");
  const isStartPickTeleport =
    !!(gs.lastStartPick && gs.lastStartPick.turn === gs.turn) ||
    !!(gs.lastTeleport && gs.lastTeleport.turn === gs.turn);
  // Simple-mode Magic Dice (the "strong" pet) should walk step-by-step like a
  // normal roll. It sets petUsedThisTurn, so the regular gate would skip it —
  // detect it explicitly: a single chosen value > 0 that actually moves.
  const isMagicDiceWalk =
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
    gs.petUsedThisTurn &&
    gs.lastPetUsed &&
    gs.lastPetUsed.petType === "strong" &&
    Array.isArray(gs.dice) &&
    gs.dice.length === 1 &&
    gs.dice[0] > 0;
  if (
    diceNotif &&
    gs.diceRolled &&
    (!gs.petUsedThisTurn || isMagicDiceWalk) &&
    !isStartPickTeleport &&
    cur
  ) {
    const diceKey = gs.dice.join("-") + "-" + gs.turn;
    if (diceKey !== window._lastDiceKey) {
      window._lastDiceKey = diceKey;
      // Mark walk in progress immediately so subsequent game_updates
      // defer money effects (closes the gap between _lastDiceKey set and walk start)
      window._tokenWalking = true;
      window._walkPileCollected = 0;
      // Freeze token positions and tile reveals at pre-roll state during animation
      window._diceRollingPositions = window._prevPlayerPositions || null;
      window._walkStartPositions = window._prevPlayerPositions ? Object.assign({}, window._prevPlayerPositions) : null;
      window._diceRollingRevealed = window._prevRevealedTiles || null;
      // Freeze banana piles and track which tiles the token has visited
      window._frozenBananaPiles = window._prevBananaPileState || null;
      window._tokenVisitedTiles = new Set();
      // Clear any stale grow-pulse gating from a prior turn (set fresh below if
      // a simple-mode rolled grow fires this turn).
      window._pulseRevealedTiles = null;
      // Freeze per-player pile totals so pstat-pile decreases in sync with board collection
      if (gs.properties) {
        window._frozenPileTotals = {};
        for (const prop of gs.properties) {
          if (prop.owner && window._prevBananaPileState && window._prevBananaPileState[prop.id] > 0) {
            window._frozenPileTotals[prop.owner] =
              (window._frozenPileTotals[prop.owner] || 0) + window._prevBananaPileState[prop.id];
          }
        }
      }
      window._walkingPlayerId = cur.id;
      window._walkingLandingPos = cur.position;
      // Reset the per-walk dedup sets here, BEFORE _showStealFloaterAt marks
      // the from-tile. Otherwise renderBoard's own reset block would fire on
      // the first frame of this walk and clobber that mark, causing the walk-
      // end pile-decrement detector to fire a second "Steal!" floater.
      if (typeof resetWalkDedup === "function") resetWalkDedup();
      // Leave-steal "Steal!" floater fires immediately at walk start (not at
      // walk end) — so the steal text reads the moment the player departs the
      // squatted tile. Triggered when the pre-move tile had a pile that the
      // backend just stole on their behalf (cur doesn't own it; pile now 0).
      // The banana burst + money update still fire at walk-end via path #2.
      if (
        gs &&
        (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
        window._prevPlayerPositions &&
        window._prevBananaPileState
      ) {
        const _fromPos = window._prevPlayerPositions[cur.id];
        if (_fromPos != null && _fromPos !== cur.position) {
          const _prevPile = window._prevBananaPileState[_fromPos] || 0;
          const _propNow =
            gs.properties && gs.properties.find((p) => p && p.id === _fromPos);
          const _nowPile = _propNow ? (_propNow.bananaPile || 0) : 0;
          // Leave-steal fires when departing an OPPONENT's farm whose pile
          // the backend just stole on the walker's behalf.
          if (
            _prevPile > 0 && _nowPile === 0 &&
            _propNow && _propNow.owner && _propNow.owner !== cur.id &&
            typeof _showStealFloaterAt === "function"
          ) {
            _showStealFloaterAt(_fromPos);
          }
        }
      }
      window._walkPreMoney = window._prevPlayerMoney && window._prevPlayerMoney[cur.id] != null
        ? window._prevPlayerMoney[cur.id] : (cur.money || 0);
      // Freeze money display at pre-roll value
      window._frozenMoney =
        window._prevMoney != null ? window._prevMoney : null;
      // Start the physical dice roll. Magic Dice rolls EXACTLY like a normal
      // roll (same spin, sound, and notification) so opponents can't tell it was
      // used — its only tell, the cooldown, is shown to its own user alone.
      die1El.classList.add("rolling");
      if (numDice >= 2) die2El.classList.add("rolling");
      if (numDice >= 3) die3El.classList.add("rolling");
      const rollDuration = 550;
      const rollInterval = 70;
      let elapsed = 0;
      const ticker = setInterval(() => {
        elapsed += rollInterval;
        if (elapsed >= rollDuration) {
          clearInterval(ticker);
          setDieFace(die1El, gs.dice[0]);
          if (numDice >= 2) setDieFace(die2El, gs.dice[1]);
          if (numDice >= 3) setDieFace(die3El, gs.dice[2]);
          die1El.classList.remove("rolling");
          if (numDice >= 2) die2El.classList.remove("rolling");
          if (numDice >= 3) die3El.classList.remove("rolling");
          // Store final transform for bounce animation
          die1El.style.setProperty("--die-final", DIE_TRANSFORMS[gs.dice[0]]);
          if (numDice >= 2)
            die2El.style.setProperty("--die-final", DIE_TRANSFORMS[gs.dice[1]]);
          if (numDice >= 3)
            die3El.style.setProperty("--die-final", DIE_TRANSFORMS[gs.dice[2]]);
          // Simple-mode GROW pulse: a coloured glow chains from each fired grow
          // along its range, popping in grown piles as it crosses. Rolled-number
          // grows pulse BEFORE the walk; a grow you LAND on pulses after you
          // arrive (see the walk-end grow branch). While any pulse is in play
          // the grown piles stay hidden until the pulse sweeps over them (gated
          // by _pulseRevealedTiles).
          const pulseGrows = _computePreWalkGrowPulse(gs);
          const landGrows = _computeLandGrowPulse(gs);
          const usePulse = pulseGrows.length > 0;
          const anyGrowPulse =
            (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
            (pulseGrows.length > 0 || landGrows.length > 0);
          // Show dice-match pile grows immediately when dice settle
          const hasDiceMatch = gs.diceMatchTiles && gs.diceMatchTiles.length > 0;
          if (anyGrowPulse) window._pulseRevealedTiles = new Set();
          if (hasDiceMatch) {
            window._diceMatchUnfrozen = true;
            window._diceMatchStealRender = true;
            renderBoard(gs); // pulse case: grown piles stay hidden (gated)
          }
          // Early Pickup: the player was standing on a farm of theirs that grew
          // (classic dice-match, or simple-mode rolled grow — both set
          // diceMatchEarlyPickup). Show a floater on that tile, burst the fresh
          // growth, mark it visited so its pile clears, and add a short delay
          // before the walk so the pickup reads clearly. In the pulse case this
          // is fired by the pulse when it crosses the tile (see _runGrowPulse).
          const hasEarlyPickup = gs.diceMatchEarlyPickup != null;
          if (hasEarlyPickup && !usePulse) {
            const epTile = document.getElementById("space-" + gs.diceMatchEarlyPickup);
            if (epTile) {
              const epRect = epTile.getBoundingClientRect();
              const epFloater = document.createElement("div");
              epFloater.className = "early-pickup-floater";
              epFloater.textContent = "Early Pickup!";
              epFloater.style.position = "fixed";
              epFloater.style.left = epRect.left + epRect.width / 2 + "px";
              epFloater.style.top = epRect.top + epRect.height / 2 + "px";
              epFloater.style.pointerEvents = "none";
              epFloater.style.zIndex = "9999";
              document.body.appendChild(epFloater);
              epFloater.addEventListener("animationend", () => epFloater.remove());
            }
            // Trigger pile collection burst at the starting tile
            bananaBurst(gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[gs.diceMatchEarlyPickup] || 1, cur.id);
            // Mark the early-pickup tile as visited so the pile disappears immediately
            if (window._tokenVisitedTiles) {
              window._tokenVisitedTiles.add(gs.diceMatchEarlyPickup);
            }
            walkStepUpdate(gs);
          }
          // Step-by-step token walk to final position
          const total = gs.dice.reduce((a, b) => a + b, 0);
          const rollText = isMagicDiceWalk
            ? `1️⃣ ${cur.name} used Roll One`
            : `🎲 ${cur.name} rolled ${gs.dice.join("+")} = ${total}`;
          const startPos =
            window._diceRollingPositions &&
            window._diceRollingPositions[cur.id] != null
              ? window._diceRollingPositions[cur.id]
              : cur.position;
          // Board loop length: 52 (classic) or 48 (simple, cornerless).
          const BSZ = (gs.boardLayout && gs.boardLayout.length) || 52;
          // Detect backward movement (e.g. magic pet tails): if forward distance > half the board, walk backward instead
          const forwardDist = (cur.position - startPos + BSZ) % BSZ;
          const backwardDist = (startPos - cur.position + BSZ) % BSZ;
          const walkBackward = forwardDist > BSZ / 2 && backwardDist <= 3;
          const steps = walkBackward ? backwardDist : forwardDist || total;
          // Delay walk start when dice-match animation needs to play, and when
          // an early-pickup floater is shown (including simple mode, which has
          // no dice-match animation) so the pickup is visible before the walk.
          // With a grow pulse in play the pulse drives the timing (grown piles
          // are gated until it sweeps; landing-grow piles reveal after arrival),
          // so skip the dice-match pre-walk pause.
          const walkDelay = anyGrowPulse
            ? 0
            : hasDiceMatch
              ? (1200 + (hasEarlyPickup ? 1000 : 0))
              : (hasEarlyPickup ? 1000 : 0);
          const startWalk = () => {
          let step = 0;
          // Keep reveals frozen during walk, but let token move
          window._diceRollingRevealed = window._diceRollingRevealed || null;
          const walkInterval = setInterval(() => {
            step++;
            if (step >= steps) {
              clearInterval(walkInterval);

              // ── Smooth landing: move token to final position via the
              // lightweight walk-step path first, then defer the heavy
              // full-board rebuild so the CSS transition finishes cleanly.
              const finalPos = walkBackward
                ? (startPos - step + BSZ) % BSZ
                : (startPos + step) % BSZ;
              window._diceRollingPositions = window._diceRollingPositions || {};
              window._diceRollingPositions[cur.id] = finalPos;
              if (window._tokenVisitedTiles) {
                window._tokenVisitedTiles.add(finalPos);
              }
              walkStepUpdate(gs);
              playMoveTickSound();
              // Landing pulse on the final tile
              const landedEl = document.getElementById("space-" + finalPos);
              if (landedEl) {
                landedEl.classList.remove("space-stepped", "space-landed");
                void landedEl.offsetWidth;
                landedEl.classList.add("space-landed");
                landedEl.addEventListener("animationend", () => landedEl.classList.remove("space-landed"), { once: true });
              }

              // After the token transition completes, do the heavy cleanup
              setTimeout(() => {
              // Fire freebananas popup if landing directly on the tile (it is never
              // an intermediate step so the board.js walk-through check can't catch it)
              const _landingSpace = gs.boardLayout && gs.boardLayout[cur.position];
              if (_landingSpace && _landingSpace.type === "freebananas" && !(window._freeBananasShown && window._freeBananasShown.has(cur.position))) {
                const _wasHidden = window._diceRollingRevealed && !window._diceRollingRevealed.has(cur.position);
                const _isMe = cur.id === myId;
                if (_isMe) {
                  setTimeout(() => showPopupAtBananaBox((gs && (gs.gameMode === "simple" || gs.gameMode === "simple_teams") ? "+25" : "+500") + "\uD83C\uDF4C", "free-bananas-popup-player"), _wasHidden ? 1100 : 100);
                } else {
                  setTimeout(() => {
                    const pstat = document.querySelector(`.pstat[data-player-id="${cur.id}"]`);
                    const anchor = pstat && pstat.querySelector(".pstat-money");
                    if (anchor) {
                      const rect = anchor.getBoundingClientRect();
                      const floater = document.createElement("div");
                      floater.className = "free-bananas-popup-player";
                      floater.textContent = (gs && (gs.gameMode === "simple" || gs.gameMode === "simple_teams") ? "+25" : "+500") + "\uD83C\uDF4C";
                      floater.style.position = "fixed";
                      floater.style.left = rect.left + rect.width / 2 + "px";
                      floater.style.top = rect.top + "px";
                      floater.style.pointerEvents = "none";
                      floater.style.zIndex = "1000";
                      document.body.appendChild(floater);
                      floater.addEventListener("animationend", () => floater.remove());
                    }
                  }, _wasHidden ? 1100 : 100);
                }
              }
              // Fully unfreeze positions and reveals
              window._diceRollingPositions = null;
              window._diceRollingRevealed = null;
              window._tokenWalking = false;
              // Fire banana burst for non-pile money gains during walk so the
              // player gets visual feedback on EVERY gain. Pile collections
              // are already burst per-tile by the pile-decrement detector in
              // board.js, so subtract their total here and only burst what's
              // left (Free Bananas crossings/landings, landed-grow path-on
              // contributions, bomb loot, rent income, etc.). The burst is
              // anchored to the player's token so it appears above their
              // piece in sync with the walk landing.
              const _walkPlayer = gs.players && gs.players.find(p => p.id === window._walkingPlayerId);
              if (_walkPlayer && window._walkPreMoney != null) {
                const totalGain = _walkPlayer.money - window._walkPreMoney;
                const pileGain = window._walkPileCollected || 0;
                // Early pickup (rolled grow that fired while the player was
                // standing on their own farm) already fires its own burst via
                // the pulse — or via the pre-walk floater in non-pulse mode.
                // The fresh-growth portion was credited straight to money
                // without flowing through a pile-decrement, so we must subtract
                // it here or the post-walk reconciliation rains a second time.
                let earlyPickupGain = 0;
                if (gs.diceMatchEarlyPickup != null) {
                  earlyPickupGain =
                    (gs.diceMatchGrownAmounts &&
                      gs.diceMatchGrownAmounts[gs.diceMatchEarlyPickup]) ||
                    0;
                }
                const nonPileGain = totalGain - pileGain - earlyPickupGain;
                if (nonPileGain > 0) {
                  bananaBurst(nonPileGain, _walkPlayer.id);
                }
              }
              window._walkPreMoney = null;
              window._walkPileCollected = 0;
              // NOTE: _walkingPlayerId, _walkingLandingPos, and _frozenPileTotals
              // are intentionally NOT cleared here — the frozen renderBoard below
              // (for GROW landings) needs them so picked-up piles render as 0
              // instead of resurrecting to their pre-pickup frozen value. They are
              // cleared after that render fires (see grow/non-grow branches).
              // Fire deferred effects for other players (rent, etc.)
              // Skip squatter steal gains — those are handled by the grow animation in board.js
              const _squatterStealIds = new Set();
              if (gs && gs.growSquatterSteals) {
                for (const s of gs.growSquatterSteals) _squatterStealIds.add(s.squatterId);
              }
              if (window._pendingLandingOtherEffects) {
                for (const fx of window._pendingLandingOtherEffects) {
                  if (fx.type === "gain" && _squatterStealIds.has(fx.playerId)) {
                    // Skip — board.js grow animation fires the burst for squatter steals
                    continue;
                  }
                  if (fx.type === "gain") {
                    bananaBurst(fx.amount, fx.playerId);
                  } else {
                    _showMoneyDeduction(fx.playerId, fx.amount);
                  }
                }
                window._pendingLandingOtherEffects = null;
              }
              // If poker is about to start, keep money frozen for poker players
              // until the poker table visually appears
              const _pokerPending = gs && gs.poker && !gs.poker.resolved;
              if (_pokerPending) {
                window._pokerMoneyFrozen = {};
                if (window._prevPlayerMoney) {
                  for (const pid of Object.keys(gs.poker.players)) {
                    if (window._prevPlayerMoney[pid] != null) {
                      window._pokerMoneyFrozen[pid] = window._prevPlayerMoney[pid];
                    }
                  }
                }
                // Keep own money frozen if we're in the poker
                if (window._frozenMoney != null && gs.poker.players[myId]) {
                  window._pokerMoneyFrozen._myFrozen = window._frozenMoney;
                }
              }
              window._frozenMoney = null;
              // Fire deferred deduction popup (e.g. tax) now that the token has landed
              // But skip poker deductions — those fire when the poker table appears
              if (window._pendingLandingDeduction) {
                const _ded = window._pendingLandingDeduction;
                window._pendingLandingDeduction = null;
                if (!(_pokerPending && gs.poker.players[_ded.playerId])) {
                  _showMoneyDeduction(_ded.playerId, _ded.amount);
                }
              }
              // Update all players' banana scores immediately on landing
              // (but keep poker players' money frozen)
              if (gs && gs.players) {
                const _landingMe = _gsPlayerMap[myId];
                if (_landingMe) {
                  const _moneyEl = document.getElementById("info-money");
                  if (_moneyEl) {
                    const _displayMoney = (window._pokerMoneyFrozen && window._pokerMoneyFrozen._myFrozen != null)
                      ? window._pokerMoneyFrozen._myFrozen : _landingMe.money;
                    _animateMoneyEl(_moneyEl, _displayMoney);
                  }
                }
                for (const _p of gs.players) {
                  const _pstat = document.querySelector(`.pstat[data-player-id="${_p.id}"]`);
                  if (_pstat) {
                    const _pm = _pstat.querySelector(".pstat-money");
                    if (_pm) {
                      const _dispMoney = (window._pokerMoneyFrozen && window._pokerMoneyFrozen[_p.id] != null)
                        ? window._pokerMoneyFrozen[_p.id] : _p.money;
                      _animateMoneyEl(_pm, _dispMoney);
                    }
                  }
                }
              }
              // Check if landing on a GROW tile — keep piles frozen briefly
              const landTile = gs.boardLayout && gs.boardLayout[cur.position];
              // The grow(s) you LAND on this turn (chain their pulse now that
              // you've arrived). Their grown piles were gated during the walk.
              const _landGrowsNow = _computeLandGrowPulse(gs);
              const finishLanding = () => {
                updateAuctionPanel();
                updatePokerTable();
                // Re-run showGame to update money display + pending notifications
                route();
              };
              const _growUnfreeze = (isGrow) => {
                window._frozenBananaPiles = null;
                window._diceMatchUnfrozen = false;
                window._tokenVisitedTiles = null;
                window._walkingPlayerId = null;
                window._walkingLandingPos = null;
                window._frozenPileTotals = null;
                window._pulseRevealedTiles = null; // ungate everything for the final render
                if (isGrow) window._growUnfreezeRender = true;
                renderBoard(gs);
              };
              let _landingPulseRan = false;
              if (
                landTile &&
                landTile.type === "grow" &&
                window._frozenBananaPiles
              ) {
                // Show token on GROW first (piles still gated), then chain the
                // landing pulse from the grow tile, popping grown piles in as it
                // sweeps. Keep _tokenVisitedTiles / _walkingPlayerId / etc. alive
                // so collected piles stay rendered as 0 during the pulse.
                renderBoard(gs);
                if (_landGrowsNow.length > 0) {
                  // Defer the landing's auction/poker/route refresh until the
                  // pulse finishes so it doesn't re-render and cut the glow.
                  _landingPulseRan = true;
                  if (!window._pulseRevealedTiles) window._pulseRevealedTiles = new Set();
                  setTimeout(() => {
                    _runGrowPulse(
                      gs,
                      _landGrowsNow,
                      cur,
                      () => {
                        // false: the pulse already bounced each box, so skip the
                        // all-at-once grow-unfreeze bounce (avoids double-bounce).
                        setTimeout(() => {
                          _growUnfreeze(false);
                          finishLanding();
                        }, 200);
                      },
                      { earlyPickup: false }, // EP belongs to the pre-walk pulse
                    );
                  }, 250);
                } else {
                  setTimeout(() => _growUnfreeze(true), 600);
                }
              } else {
                // Not landing on a grow — ungate immediately (any pre-walk grow
                // piles are already revealed) and do the authoritative render.
                _growUnfreeze(false);
              }
              // Brief pause so the player sees the landing before auction/poker/
              // notifications — unless a landing pulse is running (it finishes
              // the landing itself via finishLanding above).
              if (!_landingPulseRan) {
                setTimeout(finishLanding, 500);
              }
              }, 160); // wait for token CSS transition (140ms) to finish
            } else {
              // Move token one tile forward (or backward)
              const intermediatePos = walkBackward
                ? (startPos - step + BSZ) % BSZ
                : (startPos + step) % BSZ;
              window._diceRollingPositions = window._diceRollingPositions || {};
              window._diceRollingPositions[cur.id] = intermediatePos;
              // Mark this tile as visited so its banana pile disappears
              if (window._tokenVisitedTiles) {
                window._tokenVisitedTiles.add(intermediatePos);
              }
              walkStepUpdate(gs);
              playMoveTickSound();
              // Brief glow on the tile being stepped on
              const steppedEl = document.getElementById("space-" + intermediatePos);
              if (steppedEl) {
                steppedEl.classList.remove("space-stepped");
                void steppedEl.offsetWidth;
                steppedEl.classList.add("space-stepped");
                steppedEl.addEventListener("animationend", () => steppedEl.classList.remove("space-stepped"), { once: true });
              }
            }
          }, 150);
          }; // end startWalk
          // _tokenWalking and _walkPileCollected already set at dice roll detection time
          if (usePulse) {
            // Pre-walk pulse first, then walk. Keep the gate so a grow you LAND
            // on stays hidden until its post-arrival pulse (see walk-end). The
            // gate is cleared at walk-end.
            _runGrowPulse(gs, pulseGrows, cur, () => {
              if (typeof walkStepUpdate === "function") walkStepUpdate(gs);
              startWalk();
            });
          } else if (walkDelay > 0) {
            setTimeout(startWalk, walkDelay);
          } else {
            startWalk();
          }
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
      // Show rolling text immediately (identical to a normal roll).
      diceNotif.textContent = `🎲 ${cur.name} is rolling...`;
      diceNotif.classList.remove("show");
      void diceNotif.offsetWidth;
      diceNotif.classList.add("show");
    } else {
      if (gs.dice[0]) setDieFace(die1El, gs.dice[0]);
      if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
      if (gs.dice[2]) setDieFace(die3El, gs.dice[2]);
    }
  } else {
    if (gs.dice[0]) setDieFace(die1El, gs.dice[0]);
    if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
    if (gs.dice[2]) setDieFace(die3El, gs.dice[2]);
  }

  // Turn notification — show once per turn, keep visible for 1.5s (suppress during pet resolving)
  const notif = document.getElementById("turn-notification");

  // Pet used notification — only show to the player who activated the pet
  const petNotifEl = document.getElementById("pet-used-notification");
  if (petNotifEl && gs.lastPetUsed && gs.lastPetUsed.playerId === myId) {
    const petKey = `${gs.turn}-${gs.lastPetUsed.playerName}-${gs.lastPetUsed.petType}`;
    if (petKey !== window._lastPetNotifKey) {
      window._lastPetNotifKey = petKey;
      const emoji = PET_EMOJIS[gs.lastPetUsed.petType] || "\ud83d\udc3e";
      const name = petDisplayName(gs.lastPetUsed.petType);
      petNotifEl.textContent = `${emoji} You used ${name}!`;
      petNotifEl.classList.remove("show");
      void petNotifEl.offsetWidth;
      petNotifEl.classList.add("show");
      clearTimeout(window._petNotifTimer);
      window._petNotifTimer = setTimeout(
        () => petNotifEl.classList.remove("show"),
        2500,
      );
    }
  }

  if (notif) {
    const turnKey = isMyTurn ? gs.turn : null;
    if (
      isMyTurn &&
      (gs.petTurnDelay || !gs.petResolving) &&
      turnKey !== window._lastNotifTurn
    ) {
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
      gs.superBananaWin &&
      !window._diceRollingPositions &&
      !window._tokenWalking
    ) {
      // Super banana win phased notifications
      const textEl = document.getElementById("mushroom-notif-text");
      if (
        gs.superBananaWin.phase === "found" &&
        !window._superBananaFoundShown
      ) {
        window._superBananaFoundShown = true;
        window._mushNotifShown = true;
        if (textEl) textEl.textContent = "\u2b50 Super Banana Found! \u2b50";
        mushNotif.classList.remove("show");
        void mushNotif.offsetWidth;
        mushNotif.classList.add("show");
      } else if (
        gs.superBananaWin.phase === "bought" &&
        !window._superBananaBoughtShown
      ) {
        window._superBananaBoughtShown = true;
        const buyer = _gsPlayerMap[gs.superBananaWin.playerId];
        const name = buyer ? buyer.name : "Someone";
        if (textEl)
          textEl.textContent = `\u2b50 ${name} can afford it! ${name} bought the Super Banana and became Monkey God! \ud83d\udc51`;
      } else if (
        gs.superBananaWin.phase === "cantafford" &&
        !window._superBananaCantAffordShown
      ) {
        window._superBananaCantAffordShown = true;
        const loser = _gsPlayerMap[gs.superBananaWin.playerId];
        const winner = gs.superBananaWin.winnerId
          ? _gsPlayerMap[gs.superBananaWin.winnerId]
          : null;
        const loserName = loser ? loser.name : "Someone";
        const winnerName = winner ? winner.name : "the richest monkey";
        if (textEl)
          textEl.textContent = `\u2b50 ${loserName} can't afford it! Nowhere to hide it! ${winnerName} is the richest monkey and wins! \ud83d\udc51`;
      }
    } else if (
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
    } else if (!gs.mushroomPending && !gs.superBananaWin) {
      window._mushNotifShown = false;
      window._superBananaFoundShown = false;
      window._superBananaBoughtShown = false;
      window._superBananaCantAffordShown = false;
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
        bombSelfNotif.textContent = `🍍 Caught in your own pineapple bomb! Lost ${gs.bombSelfDamage.lost}🍌! 💥`;
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
          coinFlipEl.style.animation = `${animName} 1.2s cubic-bezier(0.12, 0.75, 0.2, 1) forwards`;

          // Show result after spin settles
          setTimeout(() => {
            coinFlipEl.style.animation = "none";
            coinFlipEl.style.transform = isHeads
              ? "rotateY(0deg)"
              : "rotateY(180deg)";
            if (isHeads) {
              resultEl.classList.add("heads");
              if (flipData.petType === "magic") {
                resultEl.textContent = "\u2705 HEADS \u2014 Moved forward!";
              } else {
                resultEl.textContent = "\u2705 HEADS \u2014 Moved forward!";
              }
            } else {
              resultEl.classList.add("tails");
              if (flipData.petType === "magic") {
                resultEl.textContent = "\u274c TAILS \u2014 Moved backward!";
              } else {
                resultEl.textContent = "\u274c TAILS \u2014 No effect!";
              }
            }
            resultEl.classList.add("visible");
          }, 1300);
        }, 150);

        // Auto-hide after spin + result display
        clearTimeout(window._petCoinTimer);
        window._petCoinTimer = setTimeout(() => {
          petCoinNotif.classList.remove("show");
        }, 3800);
      }, 400);
    }
  }

  // Auction win notification
  const auctionNotif = document.getElementById("auction-won-notification");
  if (auctionNotif) {
    if (gs.auction) {
      window._lastAuctionPos = gs.auction.position;
      window._lastAuctionAcceptTime = gs.auction.acceptTime || null;
      window._lastAuctionWasParticipant = !!(gs.auction.bids && gs.auction.bids[myId]);
      window._lastAuctionPropName = gs.auction.propName || null;
      window._lastAuctionPropGroup = gs.auction.propGroup || null;
      window._lastAuctionPropPrice = gs.auction.propPrice || null;
    } else if (window._lastAuctionPos != null) {
      const wonProp = _gsPlayerMap[myId];
      if (wonProp && wonProp.properties.includes(window._lastAuctionPos)) {
        const timeStr = window._lastAuctionAcceptTime
          ? ` (${window._lastAuctionAcceptTime}s)`
          : "";
        // Card flip animation
        _showPropertyCardFlip(
          window._lastAuctionPropName || `Farm #${window._lastAuctionPos}`,
          window._lastAuctionPropGroup,
          window._lastAuctionPropPrice,
          timeStr,
          true
        );
      } else if (window._lastAuctionWasParticipant) {
        // Lost the auction — show notification and play loss sound
        playAuctionLoss();
        _showPropertyCardFlip(
          window._lastAuctionPropName || `Farm #${window._lastAuctionPos}`,
          window._lastAuctionPropGroup,
          window._lastAuctionPropPrice,
          "",
          false
        );
      } else {
        playAuctionLoss();
      }
      window._lastAuctionPos = null;
      window._lastAuctionWasParticipant = false;
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
        : (window._pokerMoneyFrozen && window._pokerMoneyFrozen._myFrozen != null)
          ? window._pokerMoneyFrozen._myFrozen
          : me.money;
    _animateMoneyEl(document.getElementById("info-money"), displayMoney);
    document.getElementById("info-position").textContent =
      `Position: ${me.position}`;
  }

  // End turn (disabled during auction, vine swing, poker, mushroom pending, or auction end delay)
  const canEnd =
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
    !gs.auction &&
    !gs.vineSwing &&
    !gs.poker &&
    !gs.mushroomPending &&
    isMyTurn &&
    gs.diceRolled;
  document.getElementById("btn-end").disabled = !canEnd;

  // Show countdown timer on End Turn button when auto-end delay is active
  // Don't show it while the token is still walking — wait until it lands
  const btnEnd = document.getElementById("btn-end");
  if (
    gs.autoEndDelay &&
    gs.autoEndDelayMs > 0 &&
    !window._tokenWalking &&
    !window._diceRollingPositions
  ) {
    if (!window._autoEndCountdown) {
      window._autoEndCountdownStart = Date.now();
      window._autoEndCountdownMs = gs.autoEndDelayMs;
      window._autoEndCountdown = setInterval(() => {
        const elapsed = Date.now() - window._autoEndCountdownStart;
        const remaining = Math.max(0, window._autoEndCountdownMs - elapsed);
        const secs = Math.ceil(remaining / 1000);
        const btn = document.getElementById("btn-end");
        if (btn) btn.textContent = `Ending turn in ${secs}`;
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
  // Skip if bomb placement overlay is open — the player deliberately chose to
  // place a bomb, so don't yank the turn away before they pick a tile.
  if (
    canEnd &&
    !window._bombPlacementMode &&
    document.getElementById("chk-auto-end").checked
  ) {
    const mePetReady = me && me.pet && me.petCooldown <= 0;
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
        const meNow = gs && _gsPlayerMap[myId];
        const petReady = meNow && meNow.pet && meNow.petCooldown <= 0;
        if (!petReady && document.getElementById("chk-auto-end").checked)
          endTurn();
      }, 0);
    }
  }

  // Auto vine swing: pick a random owned farm when vine swing is active
  // Gate on !_tokenWalking so the emit waits until the walk animation finishes
  // (matches the manual vine-click guard in board.js)
  if (
    gs.vineSwing &&
    gs.vineSwing === myId &&
    !window._tokenWalking &&
    document.getElementById("chk-auto-vine").checked &&
    !window._autoVineQueued
  ) {
    const ownedProps = (gs.properties || []).filter((p) => p.owner === myId);
    if (ownedProps.length > 0) {
      window._autoVineQueued = true;
      const pick = ownedProps[Math.floor(Math.random() * ownedProps.length)];
      setTimeout(() => {
        window._autoVineQueued = false;
        if (socket && gameId)
          socket.emit("vine_swing_move", { gameId, position: pick.id });
      }, 300);
    }
  }
  if (!gs.vineSwing || gs.vineSwing !== myId) {
    window._autoVineQueued = false;
  }

  // Auto fold poker: fold when it's our turn
  if (
    gs.poker &&
    !gs.poker.resolved &&
    gs.poker.currentTurn === myId &&
    document.getElementById("chk-auto-fold").checked &&
    !window._autoFoldQueued
  ) {
    const myPk = gs.poker.players && gs.poker.players[myId];
    if (myPk && !myPk.folded) {
      window._autoFoldQueued = true;
      setTimeout(() => {
        window._autoFoldQueued = false;
        if (socket && gameId)
          socket.emit("poker_action", { gameId, action: "fold" });
      }, 300);
    }
  }
  if (!gs.poker || gs.poker.resolved || gs.poker.currentTurn !== myId) {
    window._autoFoldQueued = false;
  }

  // Auto-pet: when toggle is on, arm for next turn. Fire after roll resolves (and after auction if applicable).
  const petBtn = document.getElementById("btn-auto-pet");
  if (petBtn) {
    // Energy/Strong pet: fire immediately when toggled off-turn (server handles off-turn activation)
    const petArmedNow = petBtn.dataset.armed === "true";
    if (
      me &&
      (me.pet === "energy" || me.pet === "strong" || me.pet === "magic") &&
      petArmedNow &&
      !isMyTurn &&
      !me.pendingPet &&
      !window._autoPetQueued
    ) {
      const mePetReady = me.petCooldown <= 0;
      if (mePetReady) {
        window._autoPetQueued = true;
        setTimeout(() => {
          window._autoPetQueued = false;
          const meNow = gs && _gsPlayerMap[myId];
          const petStillReady =
            meNow &&
            (meNow.pet === "energy" ||
              meNow.pet === "strong" ||
              meNow.pet === "magic") &&
            !meNow.pendingPet &&
            meNow.petCooldown <= 0;
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
      (me.pet === "energy" || me.pet === "strong" || me.pet === "magic") &&
      me.pendingPet &&
      petBtn.dataset.armed === "true"
    ) {
      petBtn.dataset.armed = "false";
      window._petArmedForTurn = null;
    }

    // Devil: arm for next turn, fire after roll resolves
    if (
      me &&
      me.pet !== "energy" &&
      me.pet !== "strong" &&
      me.pet !== "magic"
    ) {
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
        const mePetReady = me && me.pet && me.petCooldown <= 0;
        if (mePetReady && !window._autoPetQueued) {
          window._autoPetQueued = true;
          setTimeout(() => {
            window._autoPetQueued = false;
            const meNow = gs && _gsPlayerMap[myId];
            const petStillReady =
              meNow && meNow.pet && meNow.petCooldown <= 0;
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
  updatePetAbilityBox(me, isMyTurn);

  // Trade button: visible but disabled when it's your turn
  const sellBtn = document.getElementById("btn-sell");
  if (sellBtn) {
    sellBtn.style.display = "";
    sellBtn.disabled = false;
    const isTeams = gs.gameMode === "teams";
    if (!isSellMode()) {
      sellBtn.innerHTML = isTeams ? "🎁 Give" : "🏷️ Sell";
    }
  }

  // Send Bananas button (any team mode)
  const sendBananasBtn = document.getElementById("btn-send-bananas");
  if (sendBananasBtn) {
    const isTeamsMode =
      gs.gameMode === "teams" || gs.gameMode === "simple_teams";
    sendBananasBtn.style.display = isTeamsMode ? "" : "none";
  }

  // Bomb buttons
  const buyBombBtn = document.getElementById("btn-buy-bomb");
  const placeBombBtn = document.getElementById("btn-place-bomb");
  const bombCount = Number(me.bomb) || 0;
  const bombPrice = gs && gs.bombCost != null ? gs.bombCost : 666;
  if (buyBombBtn) {
    if (gs.bombMode) {
      buyBombBtn.style.display = "";
      buyBombBtn.disabled = me.money < bombPrice;
      buyBombBtn.textContent =
        bombCount > 0
          ? `🍍 Buy Pineapple Bomb ${bombPrice}🍌 (own ${bombCount})`
          : `🍍 Buy Pineapple Bomb ${bombPrice}🍌`;
    } else {
      buyBombBtn.style.display = "none";
    }
  }
  if (placeBombBtn) {
    if (gs.bombMode && bombCount > 0) {
      placeBombBtn.style.display = "";
      placeBombBtn.disabled = false;
      placeBombBtn.textContent =
        bombCount > 1
          ? `🍍 Place Pineapple Bomb (${bombCount} held)`
          : "🍍 Place Pineapple Bomb";
    } else {
      placeBombBtn.style.display = "none";
    }
  }

  // Cancel ability targeting if it's no longer valid (turn ended, rolled,
  // an interactive element took over, etc.).
  if (window._abilityTargetMode) {
    const stillValid =
      isMyTurn &&
      !gs.diceRolled &&
      me &&
      !me.startPickPending &&
      !gs.auction &&
      !gs.poker &&
      !gs.vineSwing &&
      !gs.mushroomPending &&
      !gs.petResolving &&
      !gs.itemAuction;
    if (!stillValid) cancelAbilityTargeting();
  }

  // Simple Mode "Your Special Items" box
  updateSpecialItems(me, isMyTurn);

  // Simple Mode Item Auction (wheel + silent bid overlay)
  updateItemAuctionUI(me);

  // In team mode: hide jungle log (trade panel replaces it)
  const logBox = document.querySelector(".log-box");
  if (gs.gameMode === "teams") {
    if (logBox) logBox.style.display = "none";
  } else {
    if (logBox) logBox.style.display = "";
  }

  // Auction panel
  updateAuctionPanel();

  // Trade deals panel / notification badge
  updateSellListingsNotification();
  const tradeDealsPanel = document.getElementById("board-trade-deals");
  if (
    tradeDealsPanel &&
    !tradeDealsPanel.classList.contains("board-trade-deals-hidden")
  ) {
    renderSellListings();
  }

  // Players list
  // Compute per-player uncollected banana piles
  // During walk animation, use frozen totals so the counter decreases in sync with board collection
  const playerPiles = {};
  if (window._frozenPileTotals && window._tokenWalking) {
    for (const [pid, total] of Object.entries(window._frozenPileTotals)) {
      if (total > 0) playerPiles[pid] = total;
    }
  } else if (gs.properties) {
    for (const prop of gs.properties) {
      if (prop.owner && prop.bananaPile > 0) {
        playerPiles[prop.owner] =
          (playerPiles[prop.owner] || 0) + prop.bananaPile;
      }
    }
  }

  const plist = document.getElementById("players-list");
  plist.innerHTML = "";
  const isAnimating = !!(window._diceRollingPositions || window._tokenWalking);
  const frozenPlayerMoney = isAnimating ? window._prevPlayerMoney : window._pokerMoneyFrozen || null;
  if ((gs.gameMode === "teams" || gs.gameMode === "simple_teams") && gs.teams) {
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
        const p = _gsPlayerMap[id];
        if (!p) return;
        const div = document.createElement("div");
        const isMe = p.id === myId;
        div.className = "pstat" + (isMe ? " pstat-me" : "");
        div.setAttribute("data-player-id", p.id);
        // Simple modes don't surface the pet badge (Magic Dice is a consumable,
        // shown separately under Special Items).
        const isSimpleAny =
          gs.gameMode === "simple" || gs.gameMode === "simple_teams";
        const petTag = p.pet && !isSimpleAny
          ? `<span class="pstat-pet">${PET_EMOJIS[p.pet] || ""}${p.petCooldown > 0 ? p.petCooldown : "✓"}</span>`
          : "";
        const pileTag = playerPiles[p.id]
          ? `<span class="pstat-pile">${playerPiles[p.id]}🍌</span>`
          : "";
        div.innerHTML =
          `<div class="pstat-monkey c-${p.color}">${MONKEY_EMOJI[p.color] || "\uD83D\uDC35"}</div>` +
          `<span>${p.name}<span class="team-badge team-${teamKey}">T${teamKey}</span>${petTag}</span>` +
          pileTag +
          `<span class="pstat-money">${frozenPlayerMoney && frozenPlayerMoney[p.id] != null ? frozenPlayerMoney[p.id] : p.money}🍌</span>`;
        teamDiv.appendChild(div);
      });
      plist.appendChild(teamDiv);
    }
  } else {
    gs.players.forEach((p) => {
      const div = document.createElement("div");
      const isMe = p.id === myId;
      div.className = "pstat" + (isMe ? " pstat-me" : "");
      div.setAttribute("data-player-id", p.id);
      // Simple mode has no cooldown pet (Magic Dice is a won consumable shown in
      // the Your Special Items box), so no pet badge is rendered there.
      const petCd = p.petCooldown > 0 ? p.petCooldown : "✓";
      const petTag =
        p.pet && gs.gameMode !== "simple"
          ? `<span class="pstat-pet">${PET_EMOJIS[p.pet] || ""}${petCd}</span>`
          : "";
      const pileTag = playerPiles[p.id]
        ? `<span class="pstat-pile">${playerPiles[p.id]}🍌</span>`
        : "";
      div.innerHTML =
        `<div class="pstat-monkey c-${p.color}">${MONKEY_EMOJI[p.color] || "\uD83D\uDC35"}</div>` +
        `<span>${p.name}${petTag}</span>` +
        pileTag +
        `<span class="pstat-money">${frozenPlayerMoney && frozenPlayerMoney[p.id] != null ? frozenPlayerMoney[p.id] : p.money}🍌</span>`;
      plist.appendChild(div);
    });
  }

  // Snapshot target values BEFORE animation modifies textContent, then animate
  const oldPstatMoney = window._prevPstatMoney;
  window._prevPstatMoney = {};
  document.querySelectorAll(".pstat").forEach((div) => {
    const pid = div.getAttribute("data-player-id");
    const moneyEl = div.querySelector(".pstat-money");
    if (moneyEl && pid) {
      const val = parseInt(moneyEl.textContent.replace(/[^\d-]/g, ""), 10);
      if (!isNaN(val)) window._prevPstatMoney[pid] = val;
    }
  });
  // Animate only players whose money actually changed
  if (oldPstatMoney) {
    document.querySelectorAll(".pstat").forEach((div) => {
      const pid = div.getAttribute("data-player-id");
      const moneyEl = div.querySelector(".pstat-money");
      if (moneyEl && pid && oldPstatMoney[pid] != null) {
        const target = window._prevPstatMoney[pid];
        if (target != null && oldPstatMoney[pid] !== target) {
          moneyEl.textContent = `${oldPstatMoney[pid]}\ud83c\udf4c`;
          _animateMoneyEl(moneyEl, target);
        }
      }
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

  // Log (floating panel). Entries are strings, or { text, color } when the
  // backend wants to theme a line (e.g. friendly steals render green).
  const logEl = document.getElementById("board-log-messages");
  if (logEl) {
    logEl.innerHTML = "";
    (gs.log || [])
      .slice()
      .reverse()
      .forEach((msg) => {
        const d = document.createElement("div");
        if (msg && typeof msg === "object") {
          d.textContent = msg.text || "";
          if (msg.color) d.classList.add("log-color-" + msg.color);
        } else {
          d.textContent = msg;
        }
        logEl.appendChild(d);
      });
    logEl.scrollTop = 0;
  }


  // Board
  renderBoard(gs);

  // Apply pending sale flash (stored before renderBoard rebuilds DOM)
  if (window._pendingSaleFlash) {
    const flash = window._pendingSaleFlash;
    window._pendingSaleFlash = null;
    const el = document.getElementById("space-" + flash.propPos);
    if (el) {
      el.classList.add("sale-flash-" + flash.buyerColor);
      el.addEventListener(
        "animationend",
        () => el.classList.remove("sale-flash-" + flash.buyerColor),
        { once: true },
      );
    }
  }

  // Poker table
  updatePokerTable();
}

// ── Owner Panel ────────────────────────────────────────────────────

function updateOwnerPanel() {
  const el = document.getElementById("owner-list");
  if (!el) return;
  el.innerHTML = "";
  const isSimpleMode =
    gs && (gs.gameMode === "simple" || gs.gameMode === "simple_teams");
  const GROUP_NAMES = isSimpleMode
    ? { simple: "Farms" }
    : {
        yellow: "Cavendish",
        lightblue: "Blue Java",
        red: "Red Dacca",
        pink: "Lady Finger",
        darkblue: "Gros Michel",
        orange: "Goldfinger",
      };
  const GROUP_ACRONYMS = isSimpleMode
    ? { simple: "F" }
    : {
        yellow: "CV",
        lightblue: "BJ",
        red: "RD",
        pink: "LF",
        darkblue: "GM",
        orange: "GF",
      };
  gs.players.forEach((player) => {
    const section = document.createElement("div");
    section.className = "owner-section";

    const ownedIds = player.properties || [];
    let propsHTML;
    if (ownedIds.length === 0) {
      propsHTML = '<div class="owner-empty">No farms yet</div>';
    } else if (isSimpleMode) {
      propsHTML = buildSimpleGrowGroupedProps(player);
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
      // Count total tiles per group from board layout
      const groupTotals = {};
      if (gs.boardLayout) {
        for (const key of Object.keys(gs.boardLayout)) {
          const t = gs.boardLayout[key];
          if (t && t.group && GROUP_NAMES[t.group]) {
            groupTotals[t.group] = (groupTotals[t.group] || 0) + 1;
          }
        }
      }
      // Compute chain multipliers for this player's farms
      // (simple mode has no chain bonuses — leave map empty so every farm shows 1x)
      const _playerChainMults = {};
      if (!isSimpleMode) {
        const ownedProps = ownedIds
          .map((id) => {
            const tile = gs.boardLayout && gs.boardLayout[id];
            return tile && tile.group ? { id, group: tile.group } : null;
          })
          .filter(Boolean);
        const posSet = new Set(ownedProps.map((p) => p.id));
        const visited = new Set();
        for (const prop of ownedProps) {
          if (visited.has(prop.id)) continue;
          const chain = [];
          const queue = [prop.id];
          visited.add(prop.id);
          while (queue.length > 0) {
            const cur = queue.shift();
            chain.push(cur);
            const neighbors = [(cur - 1 + 52) % 52, (cur + 1) % 52];
            for (const n of neighbors) {
              if (visited.has(n) || !posSet.has(n)) continue;
              const nProp = ownedProps.find((p) => p.id === n);
              if (!nProp || nProp.group !== prop.group) continue;
              visited.add(n);
              queue.push(n);
            }
          }
          for (const c of chain) {
            _playerChainMults[c] = chain.length;
          }
        }
      }
      propsHTML = '<div class="owner-props">';
      Object.keys(GROUP_NAMES).forEach((g) => {
        if (!counts[g]) return;
        const countLabel = `${counts[g]}/${groupTotals[g] || "?"}`;
        propsHTML += `<div class="owner-set-group">`;
        propsHTML += `<div class="owner-set-header"><span class="owner-prop-dot g-${g}"></span><span class="owner-set-name">${GROUP_ACRONYMS[g]} — ${GROUP_NAMES[g]}</span> <span class="owner-set-count">${countLabel}</span></div>`;
        const farms = farmsByGroup[g] || [];
        farms.forEach((f) => {
          const chainMult = _playerChainMults[f.id] || 1;
          const effectivePrice = Math.round(f.price * chainMult);
          const chainLabel =
            chainMult > 1
              ? ` <span class="owner-prop-bonus">${chainMult}x</span>`
              : "";
          propsHTML += `<div class="owner-set-farm"><span class="owner-farm-name">${f.tileLabel || f.tileName || f.name}</span><span class="owner-prop-price">${effectivePrice}🍌${chainLabel}</span></div>`;
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

// Simple mode: group a player's owned farms by the grow tile whose range they
// fall in \u2014 the nearest grow tile counterclockwise (the one whose number, when
// rolled, grows them). Only GENUINELY revealed grow tiles count: a grow that's
// merely been scouted does NOT anchor farms, matching how grows actually fire.
// "Revealed by anyone" is global (genuine reveals broadcast to all players).
//   - If >=1 grow tile is genuinely revealed, every farm anchors to one (the
//     nearest revealed grow counterclockwise, wrapping the board), so a farm is
//     NEVER shown as "undiscovered".
//   - If no grow tile is revealed yet, all farms list under a single
//     "No grow tiles revealed yet" header.
// Groups sort by grow label (1-6); farms within a group sort by yield desc.
function buildSimpleGrowGroupedProps(player) {
  const ownedIds = player.properties || [];
  const N = (gs.boardLayout && gs.boardLayout.length) || 52;

  // Current banana pile sitting on each tile (by board position), so each farm
  // row can show its to-be-collected bananas — like the monkeys-section pile.
  const pileById = {};
  if (gs.properties) {
    for (const p of gs.properties) pileById[p.id] = p.bananaPile || 0;
  }

  // Grow tile labels (all grows). Anchoring uses only the grows GENUINELY
  // revealed by anyone (scouted-only grows are pre-filtered out of
  // genuineRevealedGrows server-side, matching how grows actually fire). A
  // genuine grow reveal broadcasts to every player, so it's already on the
  // viewer's board — using the global set leaks no fog-of-war info.
  const growLabelByPos = {};
  if (gs.boardLayout) {
    gs.boardLayout.forEach((t, pos) => {
      if (t && t.type === "grow") growLabelByPos[pos] = t.growLabel;
    });
  }
  const revealedGrows = new Set(gs.genuineRevealedGrows || []);

  // Nearest genuinely-revealed grow tile counterclockwise from a board position.
  // When >=1 grow is revealed this always finds one (it wraps the whole board),
  // so no farm is "undiscovered"; when none are revealed it returns null.
  const anchorGrowOf = (p) => {
    for (let off = 1; off <= N; off++) {
      const pos = (p - off + N) % N;
      if (revealedGrows.has(pos)) return pos;
    }
    return null;
  };

  const byLabel = new Map(); // growLabel -> farms[]
  const undiscovered = []; // only populated when NO grow is revealed yet
  for (const id of ownedIds) {
    const tile = gs.boardLayout && gs.boardLayout[id];
    if (!tile || tile.group !== "simple") continue;
    const anchor = anchorGrowOf(id);
    if (anchor != null && growLabelByPos[anchor] != null) {
      const label = growLabelByPos[anchor];
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(tile);
    } else {
      undiscovered.push(tile);
    }
  }

  if (byLabel.size === 0 && undiscovered.length === 0) {
    return '<div class="owner-empty">No farms yet</div>';
  }

  const byYield = (a, b) => (b.price || 0) - (a.price || 0);
  const farmRow = (f) => {
    const pile = pileById[f.id] || 0;
    // Always show the pile chip (even 0\uD83C\uDF4C) so the column is constant and easy to
    // scan. data-tile lets the walk animation count it down in sync (board.js).
    const pileTag = `<span class="owner-farm-pile${pile > 0 ? " has-pile" : ""}" data-tile="${f.id}" title="Bananas waiting on this farm">${pile}\uD83C\uDF4C</span>`;
    return `<div class="owner-set-farm"><span class="owner-farm-name">${f.tileLabel || f.tileName || f.name}</span>${pileTag}<span class="owner-prop-price">${f.price}\uD83C\uDF4C</span></div>`;
  };

  let html = '<div class="owner-props">';
  for (const label of [...byLabel.keys()].sort((a, b) => a - b)) {
    const farms = byLabel.get(label).slice().sort(byYield);
    html +=
      `<div class="owner-set-group">` +
      `<div class="owner-set-header"><span class="owner-prop-dot" style="background:#2e7d32"></span><span class="owner-set-name">\uD83C\uDF34 GROW ${label}</span> <span class="owner-set-count">${farms.length}</span></div>` +
      farms.map(farmRow).join("") +
      `</div>`;
  }
  if (undiscovered.length > 0) {
    // Reached only when no grow tile is genuinely revealed yet \u2014 relabel the
    // bucket instead of calling these farms "Undiscovered".
    const farms = undiscovered.slice().sort(byYield);
    html +=
      `<div class="owner-set-group">` +
      `<div class="owner-set-header"><span class="owner-prop-dot" style="background:#555"></span><span class="owner-set-name">\ud83c\udf31 No grow tiles revealed yet</span> <span class="owner-set-count">${farms.length}</span></div>` +
      farms.map(farmRow).join("") +
      `</div>`;
  }
  html += "</div>";
  return html;
}

// ── Actions ────────────────────────────────────────────────────────

const CHART_GROUPS = [
  { key: "yellow", label: "CV — Cavendish" },
  { key: "lightblue", label: "BJ — Blue Java" },
  { key: "red", label: "RD — Red Dacca" },
  { key: "pink", label: "LF — Lady Finger" },
  { key: "darkblue", label: "GM — Gros Michel" },
  { key: "orange", label: "GF — Goldfinger" },
];
const CHART_GROUPS_SIMPLE = [{ key: "simple", label: "F — Farms" }];

function updatePropertyChart() {
  const el = document.getElementById("property-chart");
  if (!el) return;
  el.innerHTML = "";
  if (!gs || !gs.boardLayout) return;

  const chartGroups =
    gs.gameMode === "simple" || gs.gameMode === "simple_teams"
      ? CHART_GROUPS_SIMPLE
      : CHART_GROUPS;

  // Build map: group -> [{name, price, owner, ownerColor}]
  const grouped = {};
  chartGroups.forEach((g) => (grouped[g.key] = []));

  // Build set of tiles revealed to current player
  const me = _gsPlayerMap[socket.id];
  const myRevealed = me && me.revealedTiles ? new Set(me.revealedTiles) : null;

  gs.boardLayout.forEach((tile, pos) => {
    if (!tile.tileName || !tile.group) return;
    const prop = _gsPropMap[pos];
    const ownerPlayer =
      prop && prop.owner ? _gsPlayerMap[prop.owner] : null;
    if (!grouped[tile.group]) grouped[tile.group] = [];
    const revealed = !myRevealed || myRevealed.has(pos);
    grouped[tile.group].push({
      pos,
      name: tile.tileName,
      label: tile.tileLabel || null,
      price: tile.price,
      owner: ownerPlayer,
      revealed,
    });
  });

  chartGroups.forEach(({ key, label }) => {
    const items = grouped[key];
    if (!items || items.length === 0) return;

    // Sort by label number so LF1, LF2, LF3 appear in order
    // (simple mode uses tile.price for ordering since there are no labels)
    items.sort((a, b) => {
      if (key === "simple") return (a.price || 0) - (b.price || 0);
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
      const diceGlow =
        gs.diceMatchTiles && gs.diceMatchTiles.includes(item.pos)
          ? " dice-match-glow"
          : "";
      const priceText = `${item.price}🍌 yield`;
      html += `<div class="chart-item${owned}${diceGlow}"><span class="chart-item-name">${displayName}</span><span class="chart-item-price">${priceText}</span>${ownerDot}</div>`;
    });
    div.innerHTML = html;
    el.appendChild(div);
  });

  updateTileLegend();
  updateGrowChart();
}

// Simple-mode only: a discovery tracker for the 8 GROW tiles (labeled 0-7).
// Lists every grow label; ones you've revealed show their board tile, the rest
// stay "?" so the fog of war is preserved.
function updateGrowChart() {
  const section = document.getElementById("grow-chart-section");
  const el = document.getElementById("grow-chart");
  if (!section || !el) return;
  // Only meaningful once play has started — grow labels (0-7) are assigned at
  // that point; before then tiles still read "GROW 100%".
  if (
    !gs ||
    (gs.gameMode !== "simple" && gs.gameMode !== "simple_teams") ||
    gs.state !== "playing" ||
    !gs.boardLayout
  ) {
    section.style.display = "none";
    el.innerHTML = "";
    return;
  }

  // Match the Farm Chart: reveal status is the viewer's own fog of war.
  const me = _gsPlayerMap[socket.id];
  const myRevealed = me && me.revealedTiles ? new Set(me.revealedTiles) : null;

  const tiles = [];
  gs.boardLayout.forEach((tile, pos) => {
    if (tile.type !== "grow") return;
    let label = tile.growLabel;
    if (label == null && typeof tile.name === "string") {
      const m = tile.name.match(/GROW\s+(\d+)/);
      if (m) label = parseInt(m[1], 10);
    }
    tiles.push({
      pos,
      label: label == null ? "?" : label,
      revealed: !myRevealed || myRevealed.has(pos),
    });
  });

  if (tiles.length === 0) {
    section.style.display = "none";
    el.innerHTML = "";
    return;
  }
  section.style.display = "";

  tiles.sort((a, b) => (Number(a.label) || 0) - (Number(b.label) || 0));
  const foundCount = tiles.filter((t) => t.revealed).length;

  let html = `<div class="grow-chart-count">${foundCount}/${tiles.length} found</div>`;
  html += '<div class="grow-chart-grid">';
  tiles.forEach((t) => {
    const cls = t.revealed ? "grow-cell found" : "grow-cell hidden";
    const posText = t.revealed ? `tile ${t.pos}` : "?";
    html += `<div class="${cls}"><span class="grow-cell-label">🌴 ${t.label}</span><span class="grow-cell-pos">${posText}</span></div>`;
  });
  html += "</div>";
  el.innerHTML = html;
}

// Collapse/expand a left-panel chart by clicking its header. The content div is
// the header's next sibling; toggling its inline display survives chart
// re-renders (those only rewrite innerHTML, not the display style).
function toggleChartCollapse(headerEl) {
  const content = headerEl.nextElementSibling;
  if (!content) return;
  const collapsed = headerEl.classList.toggle("collapsed");
  content.style.display = collapsed ? "none" : "";
  headerEl.setAttribute("aria-expanded", String(!collapsed));
}

function updateTileLegend() {
  const el = document.getElementById("tile-legend");
  if (!el || !gs || !gs.boardLayout) return;
  el.innerHTML = "";

  // Special tiles only (vine swing, +500, -10% tax, super banana). GROW tiles
  // have their own Grow Chart and desert tiles aren't "special".
  const counts = {
    bus: 0,
    tax10: 0,
    freebananas: 0,
    special: 0,
  };
  for (const tile of gs.boardLayout) {
    if (counts[tile.type] !== undefined) counts[tile.type]++;
  }

  const isSimple =
    gs && (gs.gameMode === "simple" || gs.gameMode === "simple_teams");
  const entries = [
    { icon: "🌿", name: "Vine Swing", count: counts.bus },
    {
      icon: "🍌",
      name: isSimple ? "+25" : "+500",
      count: counts.freebananas,
    },
    { icon: "🍌", name: "-10% Peel", count: counts.tax10 },
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
  const gameMode = document.getElementById("create-mode").value;
  const bombMode = document.getElementById("create-bomb-mode").checked;
  const bombCostEl = document.getElementById("create-bomb-cost");
  const bombCost = bombCostEl ? (parseInt(bombCostEl.value) || 666) : 666;
  const monkeyPoker = document.getElementById("create-monkey-poker").checked;
  const isPublic = document.getElementById("create-public").checked;
  const itemAuctionEnabled = document.getElementById(
    "create-item-auction-enabled",
  ).checked;
  const itemAuctionStart =
    parseInt(document.getElementById("create-item-auction-start").value) || 50;
  const itemAuctionTimer =
    parseInt(document.getElementById("create-item-auction-timer").value) || 15;
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  socket.emit("create_game", {
    playerName: name,
    maxPlayers: max,
    startingMoney: bananas,
    gameMode,
    bombMode,
    monkeyPoker,
    isPublic,
    bombCost,
    itemAuctionEnabled,
    itemAuctionStartValue: itemAuctionStart,
    itemAuctionTimer,
  });
}

function toggleItemAuctionFields() {
  const enabled = document.getElementById(
    "create-item-auction-enabled",
  ).checked;
  document.querySelectorAll("#simple-settings .item-auction-sub").forEach(
    (el) => {
      el.style.opacity = enabled ? "1" : "0.4";
      el.style.pointerEvents = enabled ? "" : "none";
    },
  );
}

function pasteCode() {
  const input = document.getElementById("join-code");
  function apply(raw) {
    if (!raw) return false;
    const code = raw.trim().replace(/\D/g, "").substring(0, 6);
    if (code) { input.value = code; return true; }
    return false;
  }
  function askUser() {
    const text = prompt("Paste your game code:");
    apply(text);
  }
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then((text) => {
      if (!apply(text)) askUser();
    }).catch(() => askUser());
  } else {
    askUser();
  }
}

function joinGame() {
  const code = document.getElementById("join-code").value.trim();
  const name = document.getElementById("join-name").value.trim() || "Player";
  if (!code) return showToast("Enter a game code.", "warning");
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  gameId = code;
  socket.emit("join_game", {
    gameId: code,
    playerName: name,
  });
}

function switchJoinTab(tab) {
  document.querySelectorAll(".join-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("join-tab-browse").classList.toggle("active", tab === "browse");
  document.getElementById("join-tab-code").classList.toggle("active", tab === "code");
  if (tab === "browse") refreshPublicLobbies();
}

function refreshPublicLobbies() {
  if (!socket) return;
  socket.emit("get_public_lobbies");
}

function _handlePublicLobbies(lobbies) {
  const container = document.getElementById("public-lobbies");
  if (!container) return;
  if (!lobbies || lobbies.length === 0) {
    container.innerHTML = '<div class="public-lobbies-empty">No public lobbies available right now.<br>Create one or join with a code!</div>';
    return;
  }
  container.innerHTML = lobbies.map(l => {
    const modeLabel =
      l.gameMode === "teams"
        ? "Teams"
        : l.gameMode === "simple_teams"
          ? "2v2 Simple"
          : l.gameMode === "simple"
            ? "Simple"
            : "FFA";
    return `<button class="public-lobby-item" onclick="joinPublicLobby('${l.gameId}')">
      <div class="public-lobby-host">${l.hostName}'s game</div>
      <div class="public-lobby-details">
        <span>👥 ${l.playerCount}/${l.maxPlayers}</span>
        <span>🎮 ${modeLabel}</span>
        <span>🍌 ${l.startingMoney}</span>
      </div>
    </button>`;
  }).join("");
}

function joinPublicLobby(code) {
  const name = document.getElementById("join-name").value.trim() || "Player";
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  gameId = code;
  socket.emit("join_game", { gameId: code, playerName: name });
}

function startGame() {
  socket.emit("start_game", { gameId });
}

function rollDice(diceCount) {
  const meNow = _gsPlayerMap[myId];
  const armed = (meNow && meNow.armedAbility) || null;
  // Simple mode: a manual Roll with Roll One / Vine Swing armed triggers that
  // item instead of a normal roll. (Legacy key magicDice = Roll One.)
  if (
    diceCount === undefined &&
    gs &&
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams")
  ) {
    if (armed === "magicDice") {
      useMagicDice(1); // Roll One — guaranteed move of 1
      return;
    }
    if (armed === "teleport") {
      useCard("teleport");
      return;
    }
  }
  let override = diceCount || window._armedDiceOverride || undefined;
  // Simple mode: an armed Turtle Dice rolls 1 die, an armed Rabbit Dice rolls 3
  // (server consumes the item + clears armedAbility on the roll); default 2d6.
  // (Legacy keys: rabbitDice = Turtle / 1 die, cheetahDice = Rabbit / 3 dice.)
  if (
    override === undefined &&
    gs &&
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
    (armed === "rabbitDice" || armed === "cheetahDice")
  ) {
    override = armed === "rabbitDice" ? 1 : 3;
  }
  window._armedDiceOverride = null;
  const opts = { gameId };
  // Simple mode arms 1 (Turtle) or 3 (Rabbit); classic arms 1 or 3. The server
  // ignores a value that doesn't apply to the current mode.
  if (override === 1 || override === 2 || override === 3) opts.diceCount = override;
  socket.emit("roll_dice", opts);
}

function armDiceOverride(count) {
  if (window._armedDiceOverride === count) {
    window._armedDiceOverride = null;
  } else {
    window._armedDiceOverride = count;
    // Disarm pet if armed
    const petBtn = document.getElementById("btn-auto-pet");
    if (petBtn && petBtn.dataset.armed === "true") {
      petBtn.dataset.armed = "false";
      const txt = document.getElementById("pet-toggle-text");
      if (txt) txt.innerHTML = "Use Pet Next Turn";
    }
  }
  route();
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

function _getMyTeamKey() {
  if (!gs || !gs.teams) return null;
  if (gs.teams.A && gs.teams.A.includes(myId)) return "A";
  if (gs.teams.B && gs.teams.B.includes(myId)) return "B";
  return null;
}

function _getLanderTeamKey(a) {
  if (!gs || !gs.teams || !a) return null;
  if (gs.teams.A && gs.teams.A.includes(a.landingPlayer)) return "A";
  if (gs.teams.B && gs.teams.B.includes(a.landingPlayer)) return "B";
  return null;
}

function _getBidMax() {
  const me = gs ? _gsPlayerMap[myId] : null;
  if (!me) return 500;
  let max = me.money;
  // Silent tie-breaker: the top-up is capped at what's left after the list price.
  if (gs.auction && gs.auction.phase === "silentbid") {
    return Math.max(0, me.money - (gs.auction.landerOpenBid || 0));
  }
  // When lander is pitching a price, cap at richest opponent's money
  if (
    gs.auction &&
    gs.auction.phase === "pitch" &&
    myId === gs.auction.landingPlayer
  ) {
    const others = gs.players.filter((p) => p.id !== myId && !p.bankrupt);
    if (others.length > 0) {
      const maxOtherMoney = Math.max(...others.map((p) => p.money));
      if (me.money >= maxOtherMoney) {
        max = maxOtherMoney;
      }
    }
  }
  return max;
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
  const me = _gsPlayerMap[myId];
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

  // The silent tie-breaker reuses this keypad; a 0 top-up is valid there.
  if (gs && gs.auction && gs.auction.phase === "silentbid") {
    window._myLastBid = amount;
    socket.emit("submit_silent_bid", { gameId, amount });
    input.value = "0";
    return;
  }

  // Minimum 1 banana (unless player is broke)
  const me = gs && _gsPlayerMap[myId];
  if (amount < 1 && me && me.money > 0) {
    showBidToast("1🍌 minimum!");
    return;
  }

  // Client-side check: pitch price capped at richest opponent's money
  if (
    gs &&
    gs.auction &&
    gs.auction.phase === "pitch" &&
    myId === gs.auction.landingPlayer
  ) {
    const maxAllowed = _getBidMax();
    if (amount > maxAllowed) {
      showBidToast(
        `Max price is ${maxAllowed}🍌 (richest opponent's bank)`,
      );
      input.value = String(maxAllowed);
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

function playAuctionTimerStart() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Quick rising sweep to signal timer start
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.25);
  } catch (e) {}
}

function playAuctionTimerTick() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.03);
  } catch (e) {}
}

function playAuctionTimerEnd() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Descending buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.35);
  } catch (e) {}
}

function _startAuctionTimer() {
  if (window._auctionTimerRAF) cancelAnimationFrame(window._auctionTimerRAF);
  window._auctionTimerStarted = true;
  window._lastTimerTick = -1;
  playAuctionTimerStart();

  function tick() {
    const _aa = gs && gs.auction;
    const _deadline = _aa
      ? _aa.phase === "respond"
        ? _aa.respondDeadline
        : _aa.phase === "silentbid"
          ? _aa.silentDeadline
          : null
      : null;
    if (!_aa || !_deadline) {
      // Timer done
      const timerWrap = document.getElementById("auction-timer-wrap");
      if (timerWrap) timerWrap.style.display = "none";
      window._auctionTimerStarted = false;
      return;
    }
    const now = Date.now();
    const deadline = _deadline;
    const remaining = Math.max(0, deadline - now);
    const pct = Math.max(0, Math.min(100, (remaining / 15000) * 100));
    const secs = (remaining / 1000).toFixed(1);

    const bar = document.getElementById("auction-timer-bar");
    const text = document.getElementById("auction-timer-text");
    const ring = document.getElementById("auction-timer-ring");
    const timerWrap = document.getElementById("auction-timer-wrap");
    if (timerWrap) timerWrap.style.display = "";

    const urgencyClass = pct <= 20 ? " timer-urgent" : pct <= 40 ? " timer-low" : "";

    if (bar) {
      bar.style.width = pct + "%";
      bar.className = "auction-timer-bar" + urgencyClass;
    }
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      const offset = circumference * (1 - pct / 100);
      ring.style.strokeDashoffset = offset;
      ring.className.baseVal = "auction-timer-ring-progress" + urgencyClass;
    }
    if (text) {
      text.textContent = Math.ceil(remaining / 1000);
      text.className = "auction-timer-text" + urgencyClass;
    }
    if (timerWrap) {
      timerWrap.className = "auction-timer-wrap" + urgencyClass;
    }

    // Tick sound each second
    const secFloor = Math.floor(remaining / 1000);
    if (secFloor !== window._lastTimerTick && secFloor >= 0 && remaining > 0) {
      window._lastTimerTick = secFloor;
      if (secFloor <= 2) playAuctionTimerTick();
    }

    if (remaining <= 0) {
      playAuctionTimerEnd();
      window._auctionTimerStarted = false;
      return;
    }

    window._auctionTimerRAF = requestAnimationFrame(tick);
  }
  tick();
}

function updateAuctionPanel() {
  const box = document.getElementById("auction-box");
  if (!gs || !gs.auction) {
    box.style.display = "none";
    window._auctionBidPhase = null;
    window._myLastBid = null;
    window._auctionDelayShown = false;
    window._auctionTimerStarted = false;
    if (window._auctionTimerRAF) cancelAnimationFrame(window._auctionTimerRAF);
    if (window._teammateDelayTimer) {
      clearTimeout(window._teammateDelayTimer);
      window._teammateDelayTimer = null;
    }
    const timerWrap = document.getElementById("auction-timer-wrap");
    if (timerWrap) timerWrap.style.display = "none";
    return;
  }
  // Delay showing the auction until the dice animation finishes.
  if (
    (window._diceRollingPositions || window._tokenWalking) &&
    !window._auctionDelayShown
  ) {
    box.style.display = "none";
    return;
  }
  window._auctionDelayShown = true;

  const a = gs.auction;
  const myBid = a.bids[myId];
  const iAmLander = myId === a.landingPlayer;
  const iAmAcceptor = !!a.iAmAcceptor;

  const titleEl = document.getElementById("auction-title");
  if (titleEl) titleEl.textContent = "🏷️ PRICE IT 🏷️";
  box.style.display = "block";

  // In classic mode only the lander sees the farm; in 2v2 simple the
  // teammate also sees it (the backend sets propName=null for opponents).
  // Anyone who can see propName here is allowed to — the backend already
  // gated visibility per viewer.
  const propEl = document.getElementById("auction-prop");
  if (a.propName) {
    propEl.textContent = `${a.propName} — ${a.propPrice}🍌 yield`;
    propEl.className = a.propGroup
      ? "auction-prop g-" + a.propGroup
      : "auction-prop";
  } else if (a.position != null) {
    propEl.textContent = `Farm #${a.position} (hidden)`;
    propEl.className = "auction-prop";
  } else {
    propEl.textContent = "Mystery farm (hidden)";
    propEl.className = "auction-prop";
  }

  const highEl = document.getElementById("auction-high");
  const simpleControls = document.getElementById("simple-auction-controls");
  if (simpleControls) simpleControls.style.display = "none";
  const controls = document.getElementById("auction-controls");
  const timerWrap = document.getElementById("auction-timer-wrap");
  if (timerWrap) timerWrap.style.display = "none";

  let showKeypad = false;
  let keypadLabel = "Bid";

  if (a.phase === "pitch") {
    if (iAmLander) {
      highEl.textContent = "You landed here — name your price! 🍌";
      showKeypad = true;
      keypadLabel = "Set Price";
    } else {
      highEl.textContent = "Waiting for the lander to name a price...";
    }
  } else if (a.phase === "respond") {
    if (!window._auctionTimerStarted && !gs.noAuctionTimer && a.respondDeadline) {
      _startAuctionTimer();
    }
    if (!gs.noAuctionTimer && a.respondDeadline && timerWrap) {
      timerWrap.style.display = "";
    }
    if (iAmLander) {
      highEl.textContent = `You priced it at ${a.landerOpenBid}🍌 — waiting for responses...`;
    } else if (!myBid) {
      highEl.textContent = `You can't afford ${a.landerOpenBid}🍌 — excluded from this auction.`;
    } else if (myBid.responded) {
      highEl.textContent = "Choice locked in — waiting for the others (nobody can see it).";
    } else {
      const isTeammate =
        (gs.gameMode === "teams" || gs.gameMode === "simple_teams") &&
        gs.teams &&
        a.respondStartTime &&
        _getMyTeamKey() === _getLanderTeamKey(a);
      const teammateDelay = isTeammate
        ? Math.max(0, a.respondStartTime + 5000 - Date.now())
        : 0;
      highEl.textContent = `Priced at ${a.landerOpenBid}🍌 — accept or reject. Your choice stays hidden.`;
      if (simpleControls) {
        simpleControls.style.display = "flex";
        const acceptBtn = simpleControls.querySelector(".btn-accept");
        if (acceptBtn) {
          if (teammateDelay > 0) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = `⏳ Wait ${Math.ceil(teammateDelay / 1000)}s...`;
            if (!window._teammateDelayTimer) {
              window._teammateDelayTimer = setTimeout(() => {
                window._teammateDelayTimer = null;
                if (gs && gs.auction) updateAuctionPanel();
              }, teammateDelay);
            }
          } else {
            acceptBtn.disabled = false;
            acceptBtn.textContent = "✅ Accept";
          }
        }
      }
    }
  } else if (a.phase === "silentbid") {
    if (!window._auctionTimerStarted && !gs.noAuctionTimer && a.silentDeadline) {
      _startAuctionTimer();
    }
    if (!gs.noAuctionTimer && a.silentDeadline && timerWrap) {
      timerWrap.style.display = "";
    }
    if (iAmAcceptor && myBid && !myBid.submittedTopup) {
      highEl.textContent = `Tie-breaker! Secretly bid extra on top of ${a.landerOpenBid}🍌 — you'd pay ${a.landerOpenBid}+your bid.`;
      showKeypad = true;
      keypadLabel = "Submit Bid";
    } else if (iAmAcceptor && myBid && myBid.submittedTopup) {
      highEl.textContent = "🔒 Tie-breaker bid locked in — waiting for the others...";
    } else {
      highEl.textContent =
        "Multiple players accepted — a silent tie-breaker is underway...";
    }
  }

  document.getElementById("auction-turn").textContent = "";

  // Keypad: used by the lander while pitching, and by acceptors in the
  // tie-breaker. placeBid() routes to the right socket event by phase.
  controls.style.display = showKeypad ? "flex" : "none";
  const bidBtn = document.getElementById("btn-bid");
  if (bidBtn) bidBtn.textContent = keypadLabel;
  const passBtn = document.getElementById("btn-pass");
  if (passBtn) passBtn.style.display = "none";

  const bidInput = document.getElementById("bid-amount");
  const maxBid = _getBidMax();
  if (parseInt(bidInput.value) > maxBid) bidInput.value = String(maxBid);
  const phaseKey = a.phase + (showKeypad ? ":kp" : "");
  if (showKeypad && window._auctionBidPhase !== phaseKey) {
    const defaultBid = a.phase === "pitch" ? Math.min(1, maxBid) : 0;
    bidInput.value = String(defaultBid);
    window._bidAutoFilled = defaultBid > 0;
    window._auctionBidPhase = phaseKey;
  }
  if (!showKeypad) window._auctionBidPhase = null;

  // Debug auto-toggles.
  const autoBid = document.getElementById("chk-auto-bid");
  const autoAccept = document.getElementById("chk-auto-accept");
  if (showKeypad && autoBid && autoBid.checked) {
    if (!window._autoBidQueued) {
      window._autoBidQueued = true;
      const dv = a.phase === "pitch" ? "1" : "0";
      setTimeout(() => {
        window._autoBidQueued = false;
        if (autoBid.checked) {
          document.getElementById("bid-amount").value = dv;
          placeBid();
        }
      }, 600);
    }
  }
  if (
    a.phase === "respond" &&
    !iAmLander &&
    myBid &&
    !myBid.responded &&
    autoAccept &&
    autoAccept.checked
  ) {
    if (!window._autoAcceptQueued) {
      window._autoAcceptQueued = true;
      setTimeout(() => {
        window._autoAcceptQueued = false;
        if (autoAccept.checked) respondAuction(true);
      }, 600);
    }
  }

  // Privacy: never render per-opponent accept/reject status. Show only a
  // neutral note.
  const bidsEl = document.getElementById("auction-bids");
  if (bidsEl) {
    bidsEl.innerHTML = "";
    const note = document.createElement("div");
    note.className = "auction-participant-note";
    if (a.phase === "pitch") {
      note.textContent = "Players will accept or reject privately.";
    } else if (a.phase === "respond") {
      note.textContent =
        "Each player decides in secret — revealed only at the end.";
    } else if (a.phase === "silentbid") {
      note.textContent = "Sealed bids — amounts stay hidden until it resolves.";
    }
    bidsEl.appendChild(note);
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
let _prevPokerResolved = false;
let _pokerDealQueue = []; // scheduled timeouts for dealing animation

function playPokerAnnounce() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Dramatic rising chord: D4 → F#4 → A4 → D5 with a punchy attack
    const notes = [293.66, 369.99, 440, 587.33];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.07);
      g.gain.setValueAtTime(0.12, t + i * 0.07 + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.6);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2000;
      osc.connect(lp).connect(g).connect(_sfxDest(ctx));
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.6);
    });
    // Impact hit
    const nBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let j = 0; j < nData.length; j++) {
      nData[j] = (Math.random() * 2 - 1) * 0.5 * Math.exp(-j / (ctx.sampleRate * 0.015));
    }
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.25, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    nSrc.connect(nGain).connect(_sfxDest(ctx));
    nSrc.start(t);
  } catch (e) {}
}

function playPokerWin() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Victory fanfare: ascending notes with shimmer
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
      osc.connect(gain).connect(_sfxDest(ctx));
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.4);
    });
  } catch (e) {}
}

function playCardDraw() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
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
    src.connect(hp).connect(gain).connect(_sfxDest(ctx));
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
    osc.connect(oGain).connect(_sfxDest(ctx));
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
      _prevPokerResolved = false;
      window._pokerAnnouncing = false;
      _pokerDealQueue.forEach((t) => clearTimeout(t));
      _pokerDealQueue = [];
      document.getElementById("poker-guide").style.display = "none";
      document.getElementById("poker-announce-notification").classList.remove("show");
    }
    return;
  }

  const pk = gs.poker;
  const isMk = pk.monkeyPoker;
  const renderCard = isMk ? monkeyCardHTML : cardHTML;
  const me = _gsPlayerMap[myId];
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
  const opPlayer = _gsPlayerMap[opId];
  const myPlayer = _gsPlayerMap[myPkId];

  // Detect if this is a brand-new poker game
  const justStarted = !_prevPokerActive;
  // Detect if new community cards appeared
  const newCommunity = pk.communityCards.length - _prevPokerCommunityCount;
  const roundChanged = pk.round !== _prevPokerRound;

  // Update tracking state
  _prevPokerActive = true;
  _prevPokerRound = pk.round;
  _prevPokerCommunityCount = pk.communityCards.length;

  // ── Poker Announcement Sequence ──────────────────────────────
  if (justStarted) {
    // Keep table hidden during announcement
    table.style.display = "none";
    window._pokerAnnouncing = true;

    const bbPlayer = _gsPlayerMap[pk.bbPlayer];
    const sbPlayer = _gsPlayerMap[pk.sbPlayer];

    // 1) Sound effect
    playPokerAnnounce();

    // 2) Notification banner
    const notif = document.getElementById("poker-announce-notification");
    const announceText = notif.querySelector(".poker-announce-text");
    announceText.textContent = isMk ? "MONKEY POKER!" : "POKER MATCH!";
    document.getElementById("poker-announce-p1").textContent = bbPlayer ? bbPlayer.name : "?";
    document.getElementById("poker-announce-p2").textContent = sbPlayer ? sbPlayer.name : "?";
    const ep1 = document.getElementById("poker-announce-emoji-p1");
    const ep2 = document.getElementById("poker-announce-emoji-p2");
    if (ep1) ep1.textContent = isMk ? "🐵" : "🃏";
    if (ep2) ep2.textContent = isMk ? "🐵" : "🃏";
    notif.classList.add("show");

    // 2b) Screen shake for dramatic effect
    const board = document.getElementById("board");
    if (board) {
      board.classList.remove("board-poker-shake");
      void board.offsetWidth;
      board.classList.add("board-poker-shake");
      setTimeout(() => board.classList.remove("board-poker-shake"), 900);
    }

    // 3) Flashy tile glow where the clash happens
    const clashPos = bbPlayer ? bbPlayer.position : null;
    const clashTile = clashPos != null ? document.getElementById("space-" + clashPos) : null;
    if (clashTile) {
      clashTile.classList.remove("space-poker-clash");
      void clashTile.offsetWidth;
      clashTile.classList.add("space-poker-clash");
      clashTile.addEventListener("animationend", () => clashTile.classList.remove("space-poker-clash"), { once: true });
    }

    // 4) Spark particles around the tile
    if (clashTile) {
      const tRect = clashTile.getBoundingClientRect();
      const cx = tRect.left + tRect.width / 2;
      const cy = tRect.top + tRect.height / 2;
      const sparkColors = ["#ffaa32", "#ff6b4a", "#cc44ff", "#ffe135", "#ff3366"];
      for (let i = 0; i < 12; i++) {
        const spark = document.createElement("div");
        spark.className = "poker-spark";
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 40;
        spark.style.setProperty("--sx", Math.cos(angle) * dist + "px");
        spark.style.setProperty("--sy", Math.sin(angle) * dist + "px");
        spark.style.left = cx + "px";
        spark.style.top = cy + "px";
        spark.style.background = sparkColors[i % sparkColors.length];
        spark.style.boxShadow = `0 0 4px ${sparkColors[i % sparkColors.length]}`;
        document.body.appendChild(spark);
        spark.addEventListener("animationend", () => spark.remove());
      }
    }

    // 5) "Monkey Poker!" text bubbles above both tokens
    [pk.bbPlayer, pk.sbPlayer].forEach((pid) => {
      const tok = document.querySelector(`.token[data-player-id="${pid}"]`);
      if (!tok) return;
      const tRect = tok.getBoundingClientRect();
      const bubble = document.createElement("div");
      bubble.className = "poker-token-bubble";
      bubble.textContent = isMk ? "Monkey Poker!" : "Poker!";
      bubble.style.left = tRect.left + tRect.width / 2 + "px";
      bubble.style.top = tRect.top - 8 + "px";
      document.body.appendChild(bubble);
      bubble.addEventListener("animationend", () => bubble.remove());
    });

    // (Decorative banana burst removed: both poker players' money just went
    // DOWN paying the blinds, so a rain animation here would point the wrong
    // way. The deferred _showMoneyDeduction calls below — fired when the
    // announcement settles — are the correct visual for the blind payment.)

    // 7) Dismiss announcement and open poker table
    setTimeout(() => {
      notif.classList.remove("show");
      window._pokerAnnouncing = false;

      // Now fire the deferred deductions and unfreeze money
      if (window._pendingPokerDeductions) {
        const deds = window._pendingPokerDeductions;
        window._pendingPokerDeductions = null;
        for (const d of deds) _showMoneyDeduction(d.playerId, d.amount);
      }
      if (window._pokerMoneyFrozen) {
        window._pokerMoneyFrozen = null;
        if (gs && gs.players) {
          const _me = _gsPlayerMap[myId];
          if (_me) {
            const _moneyEl = document.getElementById("info-money");
            if (_moneyEl) _animateMoneyEl(_moneyEl, _me.money);
          }
          for (const _p of gs.players) {
            const _pstat = document.querySelector(`.pstat[data-player-id="${_p.id}"]`);
            if (_pstat) {
              const _pm = _pstat.querySelector(".pstat-money");
              if (_pm) _animateMoneyEl(_pm, _p.money);
            }
          }
        }
      }

      // Show the table now
      table.style.display = "flex";
      updatePokerTable();
    }, 2000);

    return; // Don't render the table yet
  }

  // If announcement is still playing, keep table hidden
  if (window._pokerAnnouncing) {
    table.style.display = "none";
    return;
  }

  table.style.display = "flex";

  // Fire deferred poker deductions (fallback for non-announcement path)
  // (These are already handled in the announcement timeout above for justStarted);

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
              oppCardsEl.insertAdjacentHTML('beforeend', renderCard(null, "poker-card-dealing"));
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

  // Opponent hand name / card total
  const oppHandEl = document.getElementById("poker-opp-hand");
  if (pk.round === "showdown") {
    oppHandEl.textContent =
      opId === pk.bbPlayer ? pk.bbHandName || "" : pk.sbHandName || "";
  } else if (isMk && opPoker.cards && opPoker.cards.length > 0) {
    const opTotal = opPoker.cards.reduce((s, c) => s + c.value, 0);
    oppHandEl.textContent = `Total: ${opTotal}`;
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
              myCardsEl.insertAdjacentHTML('beforeend', renderCard(
                myPk.cards[i],
                "poker-card-dealing",
              ));
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
              myCardsEl.insertAdjacentHTML('beforeend', renderCard(null, "poker-card-dealing"));
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

  // My hand name / card total
  const myHandEl = document.getElementById("poker-my-hand");
  if (pk.round === "showdown") {
    myHandEl.textContent =
      myPkId === pk.bbPlayer ? pk.bbHandName || "" : pk.sbHandName || "";
  } else if (isMk && myPk.cards && myPk.cards.length > 0) {
    const myTotal = myPk.cards.reduce((s, c) => s + c.value, 0);
    myHandEl.textContent = `Total: ${myTotal}`;
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
      const winnerP = _gsPlayerMap[pk.winner];
      resultText.textContent = `🏆 ${winnerP?.name || "?"} wins ${pk.pot}🍌!`;
    }
    // Play win sound on resolution
    if (!_prevPokerResolved) {
      playPokerWin();
      if (pk.winner && pk.winner !== "tie") bananaBurst(pk.pot, pk.winner);
    }
    _prevPokerResolved = true;
  } else if (amInPoker && pk.currentTurn === myId && !myPk.folded) {
    actionsEl.style.display = "flex";
    resultEl.style.display = "none";
    const toCall = pk.currentBet - myPoker.bet;
    const checkBtn = document.getElementById("poker-btn-check");
    const callBtn = document.getElementById("poker-btn-call");
    checkBtn.style.display = toCall <= 0 ? "" : "none";
    callBtn.style.display = toCall > 0 ? "" : "none";
    callBtn.textContent = `Call ${toCall}🍌`;

    // Raise controls
    const raiseRow = document.querySelector(".poker-raise-row");
    if (isMk) {
      // Monkey poker: fixed 100🍌 raise only
      const raiseNeeded = pk.currentBet + 100 - myPoker.bet;
      const canRaise = me && me.money >= raiseNeeded;
      const slider = document.getElementById("poker-raise-slider");
      slider.style.display = "none";
      const raiseWrap = document.getElementById("poker-raise-wrap");
      raiseWrap.style.display = "none";
      const allInBtn = raiseRow.querySelector(".btn-preset");
      if (allInBtn) allInBtn.style.display = "none";
      const raiseBtn = raiseRow.querySelector(".poker-btn-raise");
      raiseBtn.textContent = "Raise 100🍌";
      raiseBtn.disabled = !canRaise;
      raiseBtn.onclick = function () {
        pokerRaise();
      };
    } else {
      const slider = document.getElementById("poker-raise-slider");
      slider.style.display = "";
      const raiseWrap = document.getElementById("poker-raise-wrap");
      raiseWrap.style.display = "";
      const allInBtn = raiseRow.querySelector(".btn-preset");
      if (allInBtn) allInBtn.style.display = "";
      const raiseBtn = raiseRow.querySelector(".poker-btn-raise");
      raiseBtn.textContent = "Raise";
      raiseBtn.disabled = false;
      raiseBtn.onclick = function () {
        pokerRaise();
      };
      const minRaise = pk.currentBet + 1;
      const maxRaise = me ? me.money + myPoker.bet : pk.currentBet + 1;
      slider.min = minRaise;
      slider.max = Math.max(minRaise, maxRaise);
      if (parseInt(slider.value) < minRaise) {
        slider.value = minRaise;
        document.getElementById("poker-raise-display").textContent = minRaise;
      }
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
  const pk = gs?.poker;
  let amount;
  if (pk && pk.monkeyPoker) {
    amount = pk.currentBet + 100;
  } else {
    amount = parseInt(document.getElementById("poker-raise-slider").value);
  }
  if (socket && gameId && !isNaN(amount))
    socket.emit("poker_action", { gameId, action: "raise", amount });
}

function pokerAllIn() {
  const me = _gsPlayerMap[myId];
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

function toggleAutoAll(on) {
  // Only affect checkboxes inside the toggles panel, and skip Auto All itself.
  const panel = document.getElementById("toggles-panel");
  if (!panel) return;
  const boxes = panel.querySelectorAll('input[type="checkbox"]');
  for (const box of boxes) {
    if (box.id === "chk-auto-all") continue;
    if (box.checked === on) continue;
    box.checked = on;
    // Fire change events so onchange handlers (Reveal All, No Timer) run.
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function toggleNoTimer() {
  const checked = document.getElementById("chk-no-timer").checked;
  if (socket && gameId) {
    socket.emit("toggle_no_timer", { gameId, noTimer: checked });
  }
}

function toggleRevealAll() {
  revealAll = document.getElementById("chk-reveal").checked;
  if (gs) renderBoard(gs);
}

function toggleTogglesPanel(force) {
  const panel = document.getElementById("toggles-panel");
  const btn = document.getElementById("btn-toggles");
  if (!panel || !btn) return;
  const shouldShow = typeof force === "boolean" ? force : panel.hasAttribute("hidden");
  if (shouldShow) {
    panel.removeAttribute("hidden");
    btn.setAttribute("aria-expanded", "true");
  } else {
    panel.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", "false");
  }
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
  const isPublic = document.getElementById("lobby-public").checked;
  const bombMode = document.getElementById("lobby-bomb-mode").checked;
  const bombCostEl = document.getElementById("lobby-bomb-cost");
  const bombCost = bombCostEl ? (parseInt(bombCostEl.value) || 666) : 666;
  const monkeyPoker = document.getElementById("lobby-monkey-poker").checked;
  socket.emit("update_settings", {
    gameId,
    startingMoney: money,
    gameMode: mode,
    maxPlayers: max,
    isPublic,
    bombMode,
    bombCost,
    monkeyPoker,
  });
}

function toggleModeSettings() {
  const mode = document.getElementById("create-mode").value;
  const teamSettings = document.getElementById("team-settings");
  const maxSelect = document.getElementById("create-max");
  const simpleSettings = document.getElementById("simple-settings");
  const isTeams = mode === "teams" || mode === "simple_teams";
  const isSimple = mode === "simple" || mode === "simple_teams";
  if (isTeams) {
    teamSettings.style.display = "";
    maxSelect.value = "4";
    maxSelect.disabled = true;
  } else {
    teamSettings.style.display = "none";
    maxSelect.disabled = false;
  }
  if (simpleSettings) {
    simpleSettings.style.display = isSimple ? "" : "none";
  }
  // Default starting bananas per mode: 333 in simple modes, 2222 elsewhere.
  const bananasEl = document.getElementById("create-bananas");
  const bananasDisp = document.getElementById("bananas-display");
  if (bananasEl) {
    bananasEl.value = isSimple ? 333 : 2222;
    if (bananasDisp) bananasDisp.textContent = bananasEl.value;
  }
  // 2v2 simple bumps bomb cost to 1000 by default (classic/ffa/simple stay 666).
  const bombCostEl = document.getElementById("create-bomb-cost");
  if (bombCostEl) {
    bombCostEl.value = mode === "simple_teams" ? 1000 : 666;
  }
  if (isSimple) toggleItemAuctionFields();
}

function endTurn() {
  socket.emit("end_turn", { gameId });
}

// ── Simple Mode Special Items ────────────────────────────────────
// Items: Turtle Dice (1 die) / Rabbit Dice (3 dice) arm the roll; Roll One
// auto-moves 1; Vine Swing picks one of YOUR farms (board-targeting). Only Vine
// Swing flows through useCard.
function useCard(cardType) {
  if (!socket || !gameId) return;
  if (cardType === "teleport") {
    startAbilityTargeting(cardType);
    return;
  }
}

function _canUseSimpleCard(me, cardType) {
  if (!me || !gs) return false;
  const owned = (me.cards && me.cards[cardType]) || 0;
  if (owned <= 0) return false;
  if (cardType === "teleport") {
    // Vine Swing needs at least one farm YOU own to swing to.
    return (gs.properties || []).some(
      (p) => p && p.owner === myId && p.group === "simple",
    );
  }
  return false;
}

// ── Ability target selection (Vine Swing) ─────────────────────────
// window._abilityTargetMode = { card, picks: number[], needed }
function _abilityNeeds(/* cardType */) {
  return 1;
}

function _isAbilityTileSelectable(mode, pos, state) {
  state = state || gs;
  if (!mode || !state) return false;
  if (mode.card === "teleport") {
    // Vine Swing: only a farm YOU own (occupied is fine — triggers poker
    // server-side). Mirrors the backend _validateTeleportTarget rule.
    const prop = (state.properties || []).find((p) => p.id === pos);
    return !!(prop && prop.owner === myId && prop.group === "simple");
  }
  return false;
}

function startAbilityTargeting(cardType) {
  window._abilityTargetMode = {
    card: cardType,
    picks: [],
    needed: _abilityNeeds(cardType),
  };
  const board = document.getElementById("board");
  if (board) board.classList.add("ability-targeting");
  showAbilityTargetBanner();
  window._abilityTargetKeyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelAbilityTargeting();
    }
  };
  document.addEventListener("keydown", window._abilityTargetKeyHandler);
  if (typeof renderBoard === "function" && gs) renderBoard(gs);
}

function cancelAbilityTargeting() {
  const wasCard = window._abilityTargetMode && window._abilityTargetMode.card;
  window._abilityTargetMode = null;
  const board = document.getElementById("board");
  if (board) board.classList.remove("ability-targeting");
  hideAbilityTargetBanner();
  if (window._abilityTargetKeyHandler) {
    document.removeEventListener("keydown", window._abilityTargetKeyHandler);
    window._abilityTargetKeyHandler = null;
  }
  // Cancelling an auto-opened Vine Swing pick releases the armed item (kept,
  // not consumed) so you can take a normal turn instead.
  const me = _gsPlayerMap[myId];
  if (
    socket &&
    gameId &&
    gs &&
    (gs.gameMode === "simple" || gs.gameMode === "simple_teams") &&
    me &&
    me.armedAbility &&
    wasCard === "teleport"
  ) {
    socket.emit("arm_ability", { gameId, ability: null });
  }
  if (typeof renderBoard === "function" && gs) renderBoard(gs);
}

function handleAbilityTileClick(pos) {
  const mode = window._abilityTargetMode;
  if (!mode) return;
  if (!_isAbilityTileSelectable(mode, pos, gs)) {
    showToast("You can't pick that tile.", "warning");
    return;
  }
  mode.picks.push(pos);
  if (mode.picks.length >= mode.needed) {
    if (mode.card === "teleport") {
      socket.emit("use_card", { gameId, cardType: "teleport", pos: mode.picks[0] });
    }
    cancelAbilityTargeting();
  } else {
    showAbilityTargetBanner();
    if (typeof renderBoard === "function" && gs) renderBoard(gs);
  }
}

const ABILITY_TARGET_PROMPTS = {
  teleport: ["🌿 Pick one of your farms to swing to"],
};

function showAbilityTargetBanner() {
  const mode = window._abilityTargetMode;
  if (!mode) return;
  let banner = document.getElementById("ability-target-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "ability-target-banner";
    banner.className = "ability-target-banner";
    document.body.appendChild(banner);
  }
  const prompts = ABILITY_TARGET_PROMPTS[mode.card] || ["Pick a tile"];
  const promptText = prompts[Math.min(mode.picks.length, prompts.length - 1)];
  banner.innerHTML =
    `<span class="ability-target-text">${promptText}</span>` +
    `<button class="ability-target-cancel" onclick="cancelAbilityTargeting()">✕ Cancel</button>`;
  banner.style.display = "flex";
}

function hideAbilityTargetBanner() {
  const banner = document.getElementById("ability-target-banner");
  if (banner) banner.style.display = "none";
}

// Item-ability reference popover (simple mode), opened by clicking the
// board-center auction counter. Pass `false` to force-close, or the click
// event to toggle. Closes on outside click or Escape.
function toggleAbilitiesPopover(arg) {
  const pop = document.getElementById("abilities-popover");
  if (!pop) return;
  if (arg && typeof arg === "object" && arg.stopPropagation) arg.stopPropagation();
  const willOpen = arg === false ? false : !pop.classList.contains("open");
  pop.classList.toggle("open", willOpen);
  if (willOpen) {
    // Defer wiring the dismiss listeners so the opening click doesn't close it.
    setTimeout(() => {
      document.addEventListener("click", _dismissAbilitiesPopover);
      document.addEventListener("keydown", _dismissAbilitiesPopoverKey);
    }, 0);
  } else {
    document.removeEventListener("click", _dismissAbilitiesPopover);
    document.removeEventListener("keydown", _dismissAbilitiesPopoverKey);
  }
}
function _dismissAbilitiesPopover(e) {
  const pop = document.getElementById("abilities-popover");
  if (!pop || pop.contains(e.target)) return; // clicks inside keep it open
  toggleAbilitiesPopover(false);
}
function _dismissAbilitiesPopoverKey(e) {
  if (e.key === "Escape") toggleAbilitiesPopover(false);
}

// Arm/disarm one special ability for your NEXT turn (server-authoritative, so
// it survives refresh/reconnect and stays private to you). Only allowed while
// it is NOT your turn; it fires when your turn starts. One armed at a time —
// arming another swaps it; clicking the armed one disarms.
function armSpecialAbility(type) {
  if (
    !socket ||
    !gameId ||
    !gs ||
    (gs.gameMode !== "simple" && gs.gameMode !== "simple_teams")
  ) {
    return;
  }
  const me = _gsPlayerMap[myId];
  if (!me) return;
  const isMyTurn = !!(gs.currentPlayer && gs.currentPlayer.id === myId);
  if (isMyTurn) return; // can't arm on your own turn
  if (((me.cards && me.cards[type]) | 0) <= 0) return; // must own it
  // Toggle off if it's already the armed one; null disarms.
  const next = me.armedAbility === type ? null : type;
  socket.emit("arm_ability", { gameId, ability: next });
}

// "Your Special Items" box (simple mode). You ARM one ability during other
// players' turns; it fires when your turn starts (Double/Triple auto-roll;
// Magic Dice / Vine Swing open tile-targeting). Everyone starts with one of
// each, so the box shows even with item auctions off (unless you hold nothing).
function updateSpecialItems(me, isMyTurn) {
  const box = document.getElementById("special-items");
  if (!box) return;
  const hasAnyItem =
    me && me.cards && Object.keys(me.cards).some((k) => (me.cards[k] || 0) > 0);
  if (
    !gs ||
    (gs.gameMode !== "simple" && gs.gameMode !== "simple_teams") ||
    gs.state !== "playing" ||
    !me ||
    me.startPickPending ||
    (!gs.itemAuctionEnabled && !hasAnyItem)
  ) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";

  const cards = me.cards || {};
  const noBlockingState =
    !gs.auction &&
    !gs.poker &&
    !gs.vineSwing &&
    !gs.mushroomPending &&
    !gs.petResolving &&
    !gs.itemAuction &&
    !window._abilityTargetMode;
  // You arm DURING other players' turns (commit ahead). On your own turn the
  // armed ability fires; you can't change it then.
  const canArm = !isMyTurn && noBlockingState && !me.startPickPending;
  const armed = me.armedAbility || null;

  const sub = document.getElementById("special-items-sub");
  if (sub) {
    sub.textContent = isMyTurn
      ? armed
        ? "Your armed item fires now!"
        : "Arm an item on others' turns for next time"
      : armed
        ? "Armed — fires when your turn starts"
        : "Arm one for your next turn";
  }

  const setItem = (key) => {
    const owned = cards[key] || 0;
    const countEl = document.getElementById(`special-count-${key}`);
    const btn = document.getElementById(`special-btn-${key}`);
    if (countEl) countEl.textContent = `×${owned}`;
    if (!btn) return;
    const isArmed = armed === key;
    btn.classList.toggle("special-item-armed", isArmed);
    btn.textContent = isArmed ? "Armed ✓" : "Arm";
    // Enabled to arm (own it + off-turn, no blocking) or to disarm (if armed).
    btn.disabled = !((owned > 0 && canArm) || isArmed);
  };
  setItem("rabbitDice");
  setItem("cheetahDice");
  setItem("magicDice");
  setItem("teleport");
}

// Fire the armed special ability at the start of your ready turn. Double/Triple
// auto-roll; Magic Dice / Vine Swing open tile targeting (you pick on your
// turn). Fires once per turn; clears the armed choice.
function _maybeFireArmedAbility() {
  if (
    !gs ||
    (gs.gameMode !== "simple" && gs.gameMode !== "simple_teams")
  ) {
    return;
  }
  const me = _gsPlayerMap[myId];
  const armed = me && me.armedAbility;
  if (!armed) return;
  if (window._abilityTargetMode) return; // already targeting
  const fireKey = "armed:" + gs.turn;
  if (window._armedAbilityFiredKey === fireKey) return;
  window._armedAbilityFiredKey = fireKey;
  setTimeout(() => {
    // Re-check it's still our ready, unrolled turn (server is authoritative;
    // consuming the item / clearing armedAbility happens server-side).
    if (!gs || !gs.currentPlayer || gs.currentPlayer.id !== myId) return;
    if (gs.diceRolled || window._abilityTargetMode) return;
    if (armed === "rabbitDice" || armed === "cheetahDice") {
      rollDice(armed === "rabbitDice" ? 1 : 3); // Turtle = 1 die, Rabbit = 3 dice
    } else if (armed === "magicDice") {
      useMagicDice(1); // Roll One — guaranteed move of 1 (no picker)
    } else if (armed === "teleport") {
      useCard("teleport");
    }
  }, 250);
}

// ── Simple Mode Item Auction (wheel + silent bid) ─────────────────
const ITEM_AUCTION_META = {
  // Legacy keys → current items.
  rabbitDice: { emoji: "🐢", name: "Turtle Dice" }, // roll 1 die
  cheetahDice: { emoji: "🐇", name: "Rabbit Dice" }, // roll 3 dice
  magicDice: { emoji: "1️⃣", name: "Roll One" }, // guaranteed move of 1
  teleport: { emoji: "🌿", name: "Vine Swing" },
};
// Angular position on the wheel for each item (degrees, clockwise from 12 o'clock)
const ITEM_AUCTION_ANGLE = {
  rabbitDice: 0,
  cheetahDice: 90,
  magicDice: 180,
  teleport: 270,
};
window._itemAuctionState = window._itemAuctionState || {
  spinAppliedFor: null, // item key the spin animation was applied for
  lastPhase: null,
  lastItem: null,
  bidLockedAt: null,
};

// The item keypad serves two phases: the starter naming a price (pitch) and an
// acceptor's silent top-up (silentbid). Route to the matching socket event.
function submitItemBid() {
  const a = gs && gs.itemAuction;
  if (!a) return;
  const input = document.getElementById("item-auction-bid-input");
  if (!input) return;
  let n = Math.floor(Number(input.value));
  if (!Number.isFinite(n) || n < 0) n = 0;
  const cap = _itemBidMax();
  if (n > cap) n = cap;
  if (!socket || !gameId) return;
  if (a.phase === "pitch") {
    socket.emit("pitch_item_price", { gameId, amount: n });
  } else if (a.phase === "silentbid") {
    socket.emit("submit_item_bid", { gameId, amount: n });
  }
}

// Accept or reject the priced (hidden) item during the item respond phase.
function respondItemAuction(accept) {
  if (!socket || !gameId) return;
  if (!gs || !gs.itemAuction || gs.itemAuction.phase !== "respond") return;
  socket.emit("respond_item_auction", { gameId, accept });
}

// RAF-driven wheel spin: fast start → smooth decel (cubic ease-out) → small
// overshoot bounce-back. Plays a tick sound + wiggles the pointer each time
// a 90° boundary passes the pointer. On completion, marks the winning slot.
function _spinItemAuctionWheel(wheel, targetAngle, itemKey) {
  if (window._itemAuctionSpinRAF) {
    cancelAnimationFrame(window._itemAuctionSpinRAF);
    window._itemAuctionSpinRAF = null;
  }
  // Clear any previous winner highlight before this new spin.
  document
    .querySelectorAll(".item-auction-wheel-slot.is-winner")
    .forEach((el) => el.classList.remove("is-winner"));

  const spins = 5; // number of full rotations before settling
  const overshoot = 10; // degrees past the target before bounce-back
  const decelMs = 2800; // long smooth deceleration
  const bounceMs = 450; // bounce back from overshoot to target
  const totalMs = decelMs + bounceMs;
  const finalRotation = spins * 360 - targetAngle;
  const peakRotation = finalRotation + overshoot;

  const pointer = document.getElementById("item-auction-pointer");
  let lastTickBoundary = 0;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeOutQuad(t) {
    return 1 - Math.pow(1 - t, 2);
  }

  function tick(now) {
    const elapsed = now - startTime;
    let rotation;
    let done = false;
    if (elapsed < decelMs) {
      const t = elapsed / decelMs;
      rotation = peakRotation * easeOutCubic(t);
    } else if (elapsed < totalMs) {
      const t = (elapsed - decelMs) / bounceMs;
      rotation = peakRotation - overshoot * easeOutQuad(t);
    } else {
      rotation = finalRotation;
      done = true;
    }
    wheel.style.transform = `rotate(${rotation}deg)`;

    // Tick: every time the rotation crosses a multiple of 90° (a slot
    // boundary passes the pointer), play a short click + wiggle the pointer.
    const crossings = Math.floor(rotation / 90);
    if (crossings !== lastTickBoundary) {
      // Account for multiple crossings in a single frame (early spin is fast).
      const delta = crossings - lastTickBoundary;
      lastTickBoundary = crossings;
      // Only play one sound per frame to avoid overlap; wiggle once.
      playWheelTick();
      if (pointer) {
        pointer.classList.remove("pointer-tick");
        // Force reflow so the class re-apply triggers a fresh transition.
        void pointer.offsetWidth;
        pointer.classList.add("pointer-tick");
        setTimeout(() => pointer.classList.remove("pointer-tick"), 60);
      }
    }

    if (!done) {
      window._itemAuctionSpinRAF = requestAnimationFrame(tick);
    } else {
      window._itemAuctionSpinRAF = null;
      // Snap to exact final rotation and mark winner.
      wheel.style.transform = `rotate(${finalRotation}deg)`;
      const winnerSlot = document.querySelector(
        `.item-auction-wheel-slot[data-item="${itemKey}"]`,
      );
      if (winnerSlot) winnerSlot.classList.add("is-winner");
      // Final solid "lock" tick.
      playWheelTick(1.4);
    }
  }
  window._itemAuctionSpinRAF = requestAnimationFrame(tick);
}

// Short metallic click — like a wheel ratchet pawl hitting a peg.
function playWheelTick(volumeMult = 1) {
  try {
    if (!_sfxVolume || _sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Short high-pitched tone burst (the "tick")
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08 * volumeMult, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.06);
    // Tiny noise burst layered on top for click texture
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.02), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.value = 0.06 * volumeMult;
    src.connect(hp).connect(ng).connect(_sfxDest(ctx));
    src.start(t);
    src.stop(t + 0.025);
  } catch (e) {}
}

function setItemBidPreset(kind) {
  const input = document.getElementById("item-auction-bid-input");
  if (!input || input.disabled) return;
  const money = _itemBidMax();
  let val;
  if (kind === "max") val = money;
  else if (kind === "half") val = Math.floor(money / 2);
  else val = 0;
  input.value = String(val);
}

// ── Item-auction keypad (mirrors the farm-auction keypad) ──────────
// Highest silent bid is capped at the player's bananas. The input is
// readonly and driven entirely by these keys; they no-op once the bid
// is locked in (input gets disabled in updateItemAuctionUI).
function _itemBidMax() {
  const me = _gsPlayerMap[myId];
  const money = me ? Math.max(0, me.money || 0) : 0;
  const a = gs && gs.itemAuction;
  if (a && a.phase === "silentbid") {
    // Top-up is capped at what's left after the list price.
    return Math.max(0, money - (a.listPrice || 0));
  }
  if (a && a.phase === "pitch" && a.iAmStarter && gs.players) {
    // Starter can't price above the richest opponent's bank.
    const others = gs.players.filter((p) => p.id !== myId && !p.bankrupt);
    if (others.length) {
      const mx = Math.max(...others.map((p) => p.money));
      if (money >= mx) return mx;
    }
  }
  return money;
}
function itemBidKey(digit) {
  const input = document.getElementById("item-auction-bid-input");
  if (!input || input.disabled) return;
  playTickSound();
  const cur = input.value === "0" ? "" : input.value;
  const num = parseInt(cur + digit, 10) || 0;
  input.value = String(Math.min(num, _itemBidMax()));
}
function itemBidClear() {
  const input = document.getElementById("item-auction-bid-input");
  if (!input || input.disabled) return;
  playTickSound();
  input.value = "0";
}
function itemBidBackspace() {
  const input = document.getElementById("item-auction-bid-input");
  if (!input || input.disabled) return;
  playTickSound();
  const cur = input.value;
  input.value = cur.length <= 1 ? "0" : cur.slice(0, -1);
}

function updateItemAuctionUI(me) {
  const box = document.getElementById("item-auction-box");
  if (!box) return;
  const a = gs && gs.itemAuction;
  if (!gs || !a) {
    box.style.display = "none";
    window._itemAuctionState.spinAppliedFor = null;
    window._itemAuctionState.lastPhase = null;
    window._itemAuctionState.lastItem = null;
    window._itemAuctionState.kpResetKey = null;
    window._itemAuctionState.bidLockedAt = null;
    document
      .querySelectorAll(".item-auction-wheel-slot.is-winner")
      .forEach((el) => el.classList.remove("is-winner"));
    if (window._itemAuctionSpinRAF) {
      cancelAnimationFrame(window._itemAuctionSpinRAF);
      window._itemAuctionSpinRAF = null;
    }
    if (window._itemAuctionTimerRAF) {
      cancelAnimationFrame(window._itemAuctionTimerRAF);
      window._itemAuctionTimerRAF = null;
    }
    return;
  }
  box.style.display = "";
  const wheelPhase = document.getElementById("item-auction-wheel-phase");
  const bidPhase = document.getElementById("item-auction-bid-phase");
  const resultPhase = document.getElementById("item-auction-result-phase");

  // Blind viewer = everyone but the starter, before the result. They never see
  // the item or the wheel.
  const hidden = !a.item;
  const iAmStarter = !!a.iAmStarter;

  const wheel = document.getElementById("item-auction-wheel");
  // Only spin (and play the wheel-tick sound) during the actual wheel phase.
  // Non-starters keep the item hidden until the result phase, at which point
  // !hidden first becomes true — without this phase guard the wheel would
  // "spin" silently off-screen and play its tick sound when the winner is
  // revealed, which makes no sense to the listener.
  if (wheel && !hidden && a.phase === "wheel") {
    const targetAngle = ITEM_AUCTION_ANGLE[a.item] ?? 0;
    const auctionKey = a.wheelStartedAt || a.item;
    if (window._itemAuctionState.spinAppliedFor !== auctionKey) {
      window._itemAuctionState.spinAppliedFor = auctionKey;
      _spinItemAuctionWheel(wheel, targetAngle, a.item);
    }
  }

  const showWheel = a.phase === "wheel" && !hidden;
  // Blind players (and everyone during pitch/respond/silentbid) use the panel.
  const showPanel =
    a.phase === "pitch" ||
    a.phase === "respond" ||
    a.phase === "silentbid" ||
    (a.phase === "wheel" && hidden);
  const showResult = a.phase === "result";
  if (wheelPhase) wheelPhase.style.display = showWheel ? "" : "none";
  if (bidPhase) bidPhase.style.display = showPanel ? "" : "none";
  if (resultPhase) resultPhase.style.display = showResult ? "" : "none";

  const meta = ITEM_AUCTION_META[a.item] || { emoji: "🎁", name: "Item" };
  const price = a.listPrice || 0;

  if (showPanel) {
    // Item shown only to the starter; blind players see the pool of items.
    const itemEl = document.getElementById("item-auction-item");
    const possibleEl = document.getElementById("item-auction-possible");
    if (hidden) {
      if (itemEl) itemEl.style.display = "none";
      if (possibleEl) {
        possibleEl.style.display = "";
        const grid = document.getElementById("item-auction-possible-grid");
        if (grid && !grid.childElementCount) {
          grid.innerHTML = Object.values(ITEM_AUCTION_META)
            .map(
              (m) =>
                `<div class="item-auction-possible-chip"><span class="chip-emoji">${m.emoji}</span><span class="chip-name">${escapeHtml(m.name)}</span></div>`,
            )
            .join("");
        }
      }
    } else {
      if (possibleEl) possibleEl.style.display = "none";
      if (itemEl) itemEl.style.display = "";
      const emojiEl = document.getElementById("item-auction-item-emoji");
      const nameEl = document.getElementById("item-auction-item-name");
      if (emojiEl) emojiEl.textContent = meta.emoji;
      if (nameEl) nameEl.textContent = meta.name;
    }

    const ctxEl = document.getElementById("item-auction-context");
    const respondControls = document.getElementById(
      "item-auction-respond-controls",
    );
    const bidControls = document.getElementById("item-auction-bid-controls");
    const lockedEl = document.getElementById("item-auction-bid-locked");
    const labelEl = document.querySelector(
      "#item-auction-bid-phase .item-auction-bid-label",
    );
    const timerWrap = document.querySelector(
      "#item-auction-bid-phase .item-auction-timer",
    );
    const maxEl = document.getElementById("item-auction-bid-max");
    const input = document.getElementById("item-auction-bid-input");
    const submitBtn = document.getElementById("item-auction-bid-submit");

    if (respondControls) respondControls.style.display = "none";
    let showKeypad = false;
    let submitLabel = "Submit";
    let labelText = "";
    let showLocked = false;
    let ctx = "";

    if (a.phase === "wheel") {
      ctx = "🎡 Spinning the wheel for a mystery item...";
      if (timerWrap) timerWrap.style.display = "none";
    } else if (a.phase === "pitch") {
      if (timerWrap) timerWrap.style.display = "none";
      if (iAmStarter) {
        ctx = "You spun this item — name your price! 🍌";
        showKeypad = true;
        submitLabel = "Set Price";
        labelText = `Your price (max ${_itemBidMax()}🍌)`;
      } else {
        ctx = "🙈 The starter is naming a price for the hidden item...";
      }
    } else if (a.phase === "respond") {
      startItemTimer(a);
      if (iAmStarter) {
        ctx = `You priced it at ${price}🍌 — waiting for responses...`;
      } else if (a.iAmExcluded) {
        ctx = `You can't afford ${price}🍌 — excluded from this auction.`;
      } else if (a.myResponded) {
        ctx = "Choice locked in — waiting for the others (nobody can see it).";
      } else if (a.iAmParticipant) {
        ctx = `Priced at ${price}🍌 — accept or reject the hidden item. Your choice stays secret.`;
        if (respondControls) respondControls.style.display = "flex";
      } else {
        ctx = "An item auction is underway...";
      }
    } else if (a.phase === "silentbid") {
      startItemTimer(a);
      if (a.iAmAcceptor && !a.mySubmittedTopup) {
        ctx = `Tie-breaker! Secretly bid extra on top of ${price}🍌 — you'd pay ${price}+your bid.`;
        showKeypad = true;
        submitLabel = "Submit Bid";
        labelText = `Your top-up (max ${_itemBidMax()}🍌)`;
      } else if (a.iAmAcceptor && a.mySubmittedTopup) {
        ctx = "🔒 Tie-breaker bid locked in — waiting for the others...";
        showLocked = true;
      } else {
        ctx = "Multiple takers — a silent tie-breaker is underway...";
      }
    }

    if (ctxEl) ctxEl.textContent = ctx;
    if (labelEl && labelText) labelEl.textContent = labelText;
    if (lockedEl) lockedEl.style.display = showLocked ? "" : "none";
    if (bidControls) bidControls.style.display = showKeypad ? "" : "none";

    if (showKeypad) {
      const cap = _itemBidMax();
      if (maxEl) maxEl.textContent = String(cap);
      if (input) {
        input.max = String(cap);
        const resetKey = (a.wheelStartedAt || a.item || "blind") + ":" + a.phase;
        if (window._itemAuctionState.kpResetKey !== resetKey) {
          input.value = "0";
          window._itemAuctionState.kpResetKey = resetKey;
        }
        input.disabled = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      }
      const kp = document.querySelector("#item-auction-bid-phase .bid-keypad");
      if (kp) kp.classList.remove("keypad-locked");
      document
        .querySelectorAll("#item-auction-bid-phase .bid-btn-row .btn-preset")
        .forEach((b) => (b.disabled = false));
    } else {
      window._itemAuctionState.kpResetKey = null;
      const kp = document.querySelector("#item-auction-bid-phase .bid-keypad");
      if (kp) kp.classList.add("keypad-locked");
      if (input) input.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      document
        .querySelectorAll("#item-auction-bid-phase .bid-btn-row .btn-preset")
        .forEach((b) => (b.disabled = true));
    }

    // Debug auto-toggles — the same ones the Price It auction uses. Auto Bid 1
    // submits the pitch price (1) / silent top-up (0); Auto Accept takes the deal.
    const _autoBid = document.getElementById("chk-auto-bid");
    const _autoAccept = document.getElementById("chk-auto-accept");
    if (showKeypad && _autoBid && _autoBid.checked) {
      if (!window._autoBidQueued) {
        window._autoBidQueued = true;
        const dv = a.phase === "pitch" ? "1" : "0";
        setTimeout(() => {
          window._autoBidQueued = false;
          if (_autoBid.checked) {
            const inp = document.getElementById("item-auction-bid-input");
            if (inp) inp.value = dv;
            submitItemBid();
          }
        }, 600);
      }
    }
    if (
      a.phase === "respond" &&
      a.iAmParticipant &&
      !a.myResponded &&
      _autoAccept &&
      _autoAccept.checked
    ) {
      if (!window._autoAcceptQueued) {
        window._autoAcceptQueued = true;
        setTimeout(() => {
          window._autoAcceptQueued = false;
          if (_autoAccept.checked) respondItemAuction(true);
        }, 600);
      }
    }
  } else if (showResult) {
    const emojiEl = document.getElementById("item-auction-result-emoji");
    const nameEl = document.getElementById("item-auction-result-name");
    if (emojiEl) emojiEl.textContent = meta.emoji;
    if (nameEl) nameEl.textContent = meta.name;
    const headline = document.getElementById("item-auction-result-headline");
    const bidsEl = document.getElementById("item-auction-result-bids");
    // Winner + price only — never reveal individual bids.
    if (bidsEl) bidsEl.innerHTML = "";
    const r = a.result || {};
    if (headline) {
      if (r.winnerId) {
        const won = r.winnerId === myId;
        headline.className =
          "item-auction-result-headline " + (won ? "won-mine" : "won-other");
        const verb = r.viaStarter ? "kept" : "won";
        headline.textContent = won
          ? `🏆 You ${verb} ${meta.name} for ${r.pricePaid}🍌!`
          : `🏆 ${r.winnerName} ${verb} ${meta.name} for ${r.pricePaid}🍌!`;
      } else {
        headline.className = "item-auction-result-headline";
        headline.textContent = "💨 No winner.";
      }
    }
  }

  window._itemAuctionState.lastPhase = a.phase;
  window._itemAuctionState.lastItem = a.wheelStartedAt || a.item;

  function startItemTimer(au) {
    const bar = document.getElementById("item-auction-timer-bar");
    const txt = document.getElementById("item-auction-timer-text");
    const wrap = document.querySelector(
      "#item-auction-bid-phase .item-auction-timer",
    );
    const deadline =
      au.phase === "respond"
        ? au.respondDeadline
        : au.phase === "silentbid"
          ? au.silentDeadline
          : null;
    if (!deadline) {
      if (wrap) wrap.style.display = "none";
      return;
    }
    if (wrap) wrap.style.display = "";
    const total = (gs.itemAuctionTimer || 15) * 1000;
    const step = () => {
      const left = Math.max(0, deadline - Date.now());
      const pct = Math.max(0, Math.min(100, (left / total) * 100));
      if (bar) bar.style.width = pct + "%";
      if (txt) txt.textContent = Math.ceil(left / 1000) + "s";
      const cur = gs && gs.itemAuction;
      if (
        left > 0 &&
        cur &&
        (cur.phase === "respond" || cur.phase === "silentbid")
      ) {
        window._itemAuctionTimerRAF = requestAnimationFrame(step);
      }
    };
    if (window._itemAuctionTimerRAF) cancelAnimationFrame(window._itemAuctionTimerRAF);
    step();
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buyBomb() {
  const overlay = document.getElementById("buy-bomb-confirm");
  if (!overlay) {
    // Fallback if the modal markup is missing for any reason
    socket.emit("buy_bomb", { gameId });
    return;
  }
  const bombPrice = gs && gs.bombCost != null ? gs.bombCost : 666;
  const priceEl = overlay.querySelector(".bomb-confirm-price");
  if (priceEl) priceEl.textContent = `${bombPrice}🍌`;
  const confirmBtn = overlay.querySelector(".btn-bomb");
  if (confirmBtn) confirmBtn.textContent = `🍍 Buy for ${bombPrice}🍌`;
  overlay.style.display = "flex";
  // Escape cancels, Enter confirms — wired once per open
  window._buyBombKeyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeBuyBombConfirm();
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirmBuyBomb();
    }
  };
  document.addEventListener("keydown", window._buyBombKeyHandler);
}

function closeBuyBombConfirm() {
  const overlay = document.getElementById("buy-bomb-confirm");
  if (overlay) overlay.style.display = "none";
  if (window._buyBombKeyHandler) {
    document.removeEventListener("keydown", window._buyBombKeyHandler);
    window._buyBombKeyHandler = null;
  }
}

function confirmBuyBomb() {
  closeBuyBombConfirm();
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

// ── Sell ───────────────────────────────────────────────────────────

// Sell state: { selectedTile: number | null }
window._sellState = null;

function isSellMode() {
  return window._sellState !== null;
}

function openSellPanel() {
  if (!gs || gs.state !== "playing") return;
  const panel = document.getElementById("trade-panel");
  if (panel.style.display !== "none" && panel.style.display !== "") {
    closeSellPanel();
    return;
  }

  const isTeams = gs.gameMode === "teams";

  const bananasSection = document.getElementById("trade-bananas-section");
  const swapSection = document.getElementById("trade-swap-section");
  if (bananasSection) bananasSection.style.display = "none";
  if (swapSection) swapSection.style.display = "none";

  // In teams mode: hide price section, change header/button labels
  const panelHeader = panel.querySelector(".trade-panel-header");
  const priceSection = document.getElementById("sell-price-label");
  const confirmBtn = document.getElementById("btn-sell-confirm");
  if (isTeams) {
    if (panelHeader) panelHeader.firstChild.textContent = "🎁 Give Farm ";
    if (priceSection) priceSection.style.display = "none";
    if (confirmBtn) confirmBtn.textContent = "Give to Teammate (300🍌)";
  } else {
    if (panelHeader) panelHeader.firstChild.textContent = "🏷️ Sell Farm ";
    if (confirmBtn) confirmBtn.textContent = "Confirm Listing";
  }

  resetSellSelection();

  panel.style.display = "flex";
  const sellBtn = document.getElementById("btn-sell");
  if (sellBtn) sellBtn.innerHTML = "✕ Close";
  const closeX = document.querySelector(".trade-panel-close");
  if (closeX) closeX.style.display = "none";
}

function closeSellPanel() {
  window._sellState = null;
  document.getElementById("trade-panel").style.display = "none";
  const sellBtn = document.getElementById("btn-sell");
  if (sellBtn) {
    const isTeams = gs && gs.gameMode === "teams";
    sellBtn.innerHTML = isTeams ? "🎁 Give" : "🏷️ Sell";
  }
  const closeX = document.querySelector(".trade-panel-close");
  if (closeX) closeX.style.display = "";
  updateSellHighlights();
}

function resetSellSelection() {
  window._sellState = { selectedTile: null };
  const sellNumpad = document.getElementById("sell-price-numpad");
  if (sellNumpad) sellNumpad.value = "";
  updateSellPrice(0);
  updateSellUI();
  updateSellHighlights();
}

function getTileName(pos) {
  if (!gs || !gs.boardLayout) return "Tile #" + pos;
  const tile = gs.boardLayout[pos];
  return tile && tile.tileLabel ? tile.tileLabel : "Tile #" + pos;
}

function updateSellUI() {
  const state = window._sellState;
  if (!state) return;

  const isTeams = gs && gs.gameMode === "teams";
  const hint = document.getElementById("sell-phase-hint");
  const selectedItem = document.getElementById("sell-selected-item");
  const confirmBtn = document.getElementById("btn-sell-confirm");
  const priceLabel = document.getElementById("sell-price-label");
  const selectedLabel = document.querySelector(
    "#sell-selected-display .trade-selected-label",
  );
  if (selectedLabel)
    selectedLabel.textContent = isTeams ? "Farm to give:" : "Farm to sell:";

  if (state.selectedTile === null) {
    hint.textContent = "Click one of your farms on the board to select it";
    hint.className = "trade-phase-hint phase-mine";
    selectedItem.textContent = "None selected";
    confirmBtn.disabled = true;
    if (priceLabel && !isTeams) priceLabel.style.display = "none";
  } else {
    hint.textContent = isTeams
      ? "Confirm to give this farm to your teammate"
      : "Set your asking price and confirm the listing";
    hint.className = "trade-phase-hint phase-mine";
    selectedItem.innerHTML = `<span class="trade-chip trade-chip-mine">${getTileName(state.selectedTile)} ✕</span>`;
    selectedItem.querySelector(".trade-chip-mine").onclick = () => {
      state.selectedTile = null;
      updateSellUI();
      updateSellHighlights();
    };
    confirmBtn.disabled = false;
    if (priceLabel && !isTeams) priceLabel.style.display = "";
  }
}

function handleSellTileClick(tilePos) {
  const state = window._sellState;
  if (!state || !gs) return;

  const prop = _gsPropMap[tilePos];
  if (!prop || prop.owner !== myId) return;

  if (state.selectedTile === tilePos) {
    state.selectedTile = null;
  } else {
    state.selectedTile = tilePos;
  }

  updateSellUI();
  updateSellHighlights();
}

function updateSellPrice(val) {
  val = Math.max(0, Math.min(100000, Math.round(Number(val) || 0)));
  const display = document.getElementById("sell-price-display");
  const hidden = document.getElementById("sell-price-input");
  const numpad = document.getElementById("sell-price-numpad");
  if (display) display.textContent = val.toLocaleString() + "\uD83C\uDF4C";
  if (hidden) hidden.value = val;
  if (numpad && numpad !== document.activeElement) numpad.value = val > 0 ? val : "";
}

function onSellCalcInput(rawVal) {
  const digits = rawVal.replace(/\D/g, "");
  const val = parseInt(digits) || 0;
  updateSellPrice(val);
}

function sellCalcPress(digit) {
  const numpad = document.getElementById("sell-price-numpad");
  if (!numpad) return;
  const cur = numpad.value.replace(/\D/g, "");
  if (cur.length >= 6) return;
  const next = cur + digit;
  numpad.value = next;
  updateSellPrice(parseInt(next) || 0);
}

function sellCalcClear() {
  const numpad = document.getElementById("sell-price-numpad");
  if (numpad) numpad.value = "";
  updateSellPrice(0);
}

function sellCalcBackspace() {
  const numpad = document.getElementById("sell-price-numpad");
  if (!numpad) return;
  const cur = numpad.value.replace(/\D/g, "");
  const next = cur.slice(0, -1);
  numpad.value = next;
  updateSellPrice(parseInt(next) || 0);
}

function confirmSell() {
  const state = window._sellState;
  if (!state || state.selectedTile === null) return;

  if (gs && gs.gameMode === "teams") {
    // Teams mode: give farm directly to teammate
    socket.emit("give_farm", {
      gameId,
      propPos: state.selectedTile,
    });
    closeSellPanel();
    return;
  }

  const priceInput = document.getElementById("sell-price-input");
  const price = parseInt(priceInput.value) || 0;
  if (price <= 0) return;

  socket.emit("sell_property", {
    gameId,
    propPos: state.selectedTile,
    price,
  });
  closeSellPanel();
}

function buySaleListing(saleId) {
  if (!socket || !gameId) return;
  socket.emit("buy_sale", { gameId, saleId });
}

function cancelSaleListing(saleId) {
  if (!socket || !gameId) return;
  socket.emit("cancel_sale", { gameId, saleId });
}

// ── Sell Listings Panel ────────────────────────────────────────────

function toggleSellListingsPanel() {
  const panel = document.getElementById("board-trade-deals");
  if (!panel) return;
  panel.classList.toggle("board-trade-deals-hidden");
  if (!panel.classList.contains("board-trade-deals-hidden")) {
    renderSellListings();
  }
}

function renderSellListings() {
  const container = document.getElementById("trade-deals-messages");
  if (!container || !gs) return;
  const listings = gs.sellListings || [];

  if (listings.length === 0) {
    container.innerHTML =
      '<div class="trade-deals-empty">No farms for sale</div>';
    return;
  }

  container.innerHTML = listings
    .map((listing) => {
      const isMine = listing.sellerId === myId;
      const me = _gsPlayerMap[myId];
      const canAfford = me && me.money >= listing.price;
      const dirClass = isMine ? "deal-sent" : "deal-received";

      let actions;
      if (isMine) {
        actions = `<button class="btn-deal btn-deal-cancel" onclick="cancelSaleListing(${listing.id})">Cancel</button>`;
      } else {
        actions = `<button class="btn-deal btn-deal-accept" onclick="buySaleListing(${listing.id})" ${canAfford ? "" : "disabled"}>Buy${canAfford ? "" : " (can't afford)"}</button>`;
      }

      return (
        `<div class="trade-deal-card ${dirClass}">` +
        `<div class="trade-deal-header">${isMine ? "Your listing" : `<strong>${listing.sellerName}</strong> is selling`}</div>` +
        `<div class="trade-deal-body">` +
        `<div class="trade-deal-side"><span class="trade-deal-label">Farm:</span> ${listing.propName}</div>` +
        `<div class="trade-deal-arrow">💰</div>` +
        `<div class="trade-deal-side"><span class="trade-deal-label">Price:</span> ${listing.price}🍌</div>` +
        `</div>` +
        `<div class="trade-deal-actions">${actions}</div>` +
        `</div>`
      );
    })
    .join("");
}

function updateSellListingsNotification() {
  const badge = document.getElementById("trade-deals-badge");
  if (!badge || !gs) return;
  const listings = gs.sellListings || [];
  const available = listings.filter((l) => l.sellerId !== myId).length;
  if (available > 0) {
    badge.textContent = available;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function updateSendBananaAmount(val) {
  val = Math.max(0, Math.round(Number(val) || 0));
  const me = gs && _gsPlayerMap[myId];
  // 2v2 simple uses a 50-banana fee and caps the amount sent at half the
  // sender's bananas. Classic teams uses a 150-banana fee, no cap.
  const isSimpleTeams = gs && gs.gameMode === "simple_teams";
  const fee = isSimpleTeams ? 50 : 150;
  const myMoney = me ? me.money : 0;
  let maxSend = Math.max(1, myMoney - fee);
  if (isSimpleTeams) {
    maxSend = Math.min(maxSend, Math.floor(myMoney / 2));
  }
  val = Math.min(val, maxSend);
  const display = document.getElementById("send-banana-display");
  const hidden = document.getElementById("send-banana-input");
  const numpad = document.getElementById("send-banana-numpad");
  if (display) display.textContent = val.toLocaleString() + "🍌";
  if (numpad && numpad !== document.activeElement) numpad.value = val > 0 ? val : "";
  if (hidden) hidden.value = val;
  const total = document.getElementById("send-banana-total");
  if (total)
    total.textContent = `Total cost: ${(val + fee).toLocaleString()}🍌 (fee ${fee})`;
}

function onSendCalcInput(rawVal) {
  const digits = rawVal.replace(/\D/g, "");
  const val = parseInt(digits) || 0;
  updateSendBananaAmount(val);
}

function sendCalcPress(digit) {
  const numpad = document.getElementById("send-banana-numpad");
  if (!numpad) return;
  const cur = numpad.value.replace(/\D/g, "");
  if (cur.length >= 6) return;
  const next = cur + digit;
  numpad.value = next;
  updateSendBananaAmount(parseInt(next) || 0);
}

function sendCalcClear() {
  const numpad = document.getElementById("send-banana-numpad");
  if (numpad) numpad.value = "";
  updateSendBananaAmount(0);
}

function sendCalcBackspace() {
  const numpad = document.getElementById("send-banana-numpad");
  if (!numpad) return;
  const cur = numpad.value.replace(/\D/g, "");
  const next = cur.slice(0, -1);
  numpad.value = next;
  updateSendBananaAmount(parseInt(next) || 0);
}

function sendTrade() {
  if (!gs || !gs.teams) return;
  const myTeam = gs.teams.A.includes(myId) ? "A" : "B";
  const mateId = gs.teams[myTeam].find((id) => id !== myId);
  if (!mateId) return;
  const amount =
    parseInt(document.getElementById("send-banana-input").value) || 0;
  if (amount <= 0) return;
  socket.emit("trade_bananas", { gameId, recipientId: mateId, amount });
  // Don't fire bananaBurst here — the sender LOSES bananas (amount + fee),
  // so the rain animation would lie. The post-trade game_update will fire
  // _showMoneyDeduction on the sender and bananaBurst on the recipient via
  // the general money-delta detector.
  closeSendBananas();
}

function toggleSendBananas() {
  const panel = document.getElementById("send-bananas-panel");
  if (!panel || !gs) return;
  if (panel.style.display !== "none" && panel.style.display !== "") {
    closeSendBananas();
    return;
  }
  // Close sell panel if open
  if (isSellMode()) closeSellPanel();
  // Tune fee/cap copy for the active mode.
  const isSimpleTeams = gs.gameMode === "simple_teams";
  const feeNotice = document.getElementById("send-banana-fee-notice");
  if (feeNotice) {
    feeNotice.textContent = isSimpleTeams
      ? "Transfer fee: 50🍌 · Max send: half your bananas"
      : "Transfer fee: 150🍌";
  }
  // Reset calculator
  updateSendBananaAmount(0);
  const sendNumpad = document.getElementById("send-banana-numpad");
  if (sendNumpad) sendNumpad.value = "";
  panel.style.display = "flex";
  const btn = document.getElementById("btn-send-bananas");
  if (btn) btn.innerHTML = "✕ Close";
}

function closeSendBananas() {
  const panel = document.getElementById("send-bananas-panel");
  if (panel) panel.style.display = "none";
  const btn = document.getElementById("btn-send-bananas");
  if (btn) btn.innerHTML = "🍌 Send Bananas";
}

// ── Farm Swap ──────────────────────────────────────────────────────

function populateFarmSwap() {
  const myFarmSel = document.getElementById("swap-my-farm");
  const mateFarmSel = document.getElementById("swap-mate-farm");
  if (!myFarmSel || !mateFarmSel) return;
  myFarmSel.innerHTML = "";
  mateFarmSel.innerHTML = "";

  const me = _gsPlayerMap[myId];
  if (!me || !gs.teams) return;

  const myTeam = gs.teams.A.includes(myId) ? "A" : "B";
  const mateId = gs.teams[myTeam].find((id) => id !== myId);
  const mate = _gsPlayerMap[mateId];
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
  const goOverlay = document.getElementById("game-over-overlay");
  if (goOverlay) goOverlay.style.display = "none";
  if (gameId && gs && gs.state === "finished") {
    // Signal this player is ready to return to lobby
    window._returnedToLobby = true;
    socket.emit("return_to_lobby", { gameId });
    route();
  } else {
    if (gameId) socket.emit("leave_game", { gameId });
    gameId = null;
    gs = null;
    showScreen("screen-menu");
  }
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
    "\ud83c\udf4d",
    "\ud83c\udf4d",
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

// CONTRACT: call ONLY when the player's banana score has just increased.
// The general money-delta detector in the game_update handler is the
// authoritative caller; explicit callers during walk animations (pile
// collection, early pickup, post-walk reconciliation) are intentional and
// each already correspond to a real gain. The amount guard below silently
// no-ops on 0/negative amounts so a stray call can't draw stray banana rain.
// Pair with _showMoneyDeduction() for the inverse (score went down).
function bananaBurst(amount, playerId, anchorEl) {
  if (!amount || amount <= 0) return;
  playBananaWhoosh();
  // Caller-supplied anchor takes priority — used for leave-steal so the
  // banana rain falls on the SQUATTED TILE the player is departing, not on
  // their moving token. Falls back to the player's token / "me" token / pstat
  // monkey icon otherwise so existing callers behave the same.
  let anchor = anchorEl || null;
  if (!anchor && playerId) {
    anchor = document.querySelector(`.token[data-player-id="${playerId}"]`);
  }
  if (!anchor) {
    anchor = document.querySelector(".token-me");
  }
  if (!anchor) {
    const mePstat = document.querySelector(".pstat-me .pstat-monkey");
    if (mePstat) anchor = mePstat;
  }
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const count = 3;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "banana-burst-icon banana-burst-down";
    el.textContent = "\ud83c\udf4c";
    // Start above the token so bananas rain down onto it
    const dx = (Math.random() - 0.5) * 120;
    const dy = -(80 + Math.random() * 60);
    el.style.left = (originX + dx) + "px";
    el.style.top = (originY + dy) + "px";
    el.style.setProperty("--fall-dx", (Math.random() - 0.5) * 40 + "px");
    el.style.setProperty("--fall-dy", (-dy) + "px");
    el.style.fontSize = 0.9 + Math.random() * 0.9 + "em";
    el.style.animationDelay = Math.random() * 0.25 + "s";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
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

  // Fallback: dismiss loading overlay after 5s even if socket is slow
  setTimeout(dismissLoadingOverlay, 5000);

  // Sync twemoji toggle checkbox with saved preference
  var twToggle = document.getElementById("twemoji-toggle");
  if (twToggle && typeof twemojiIsEnabled === "function") {
    twToggle.checked = twemojiIsEnabled();
  }

  // Close auction tooltip when clicking outside
  document.addEventListener("click", (e) => {
    const icon = document.querySelector(".auction-info-icon.open");
    if (icon && !icon.contains(e.target)) icon.classList.remove("open");
  });

  // Pet toggle button handler
  const petToggleBtn = document.getElementById("btn-auto-pet");
  if (petToggleBtn) {
    petToggleBtn.addEventListener("click", () => {
      const txt = document.getElementById("pet-toggle-text");
      const armed = petToggleBtn.dataset.armed === "true";
      const now = !armed;
      petToggleBtn.dataset.armed = now ? "true" : "false";
      if (txt) {
        if (now) {
          txt.textContent = "\ud83d\udc3e Pet acting next turn!";
        } else {
          txt.innerHTML = "Use Pet Next Turn";
        }
      }
      // Disarm dice override when pet is armed
      if (now) {
        window._armedDiceOverride = null;
      }
      // Energy/Strong/Magic pets activate off-turn — fire usePet immediately when toggled on
      if (now && gs) {
        const me = _gsPlayerMap[myId];
        if (
          me &&
          (me.pet === "energy" || me.pet === "strong" || me.pet === "magic") &&
          !me.pendingPet
        ) {
          usePet();
        }
      }
      // Cancel pending pet when toggled off
      if (!now) {
        cancelPet();
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
      if (chatEl.classList.contains("board-chat-hidden")) {
        chatEl.classList.remove("board-chat-hidden");
        chatToggle.classList.remove("has-unread");
        // Open near the toggle button (bottom-right of board)
        chatEl.style.left = "auto";
        chatEl.style.right = "2%";
        chatEl.style.top = "auto";
        chatEl.style.bottom = "12%";
        chatEl.style.transform = "none";
      } else {
        chatEl.classList.add("board-chat-hidden");
      }
    });
  }

  // Sound volume toggle + slider
  const sfxToggle = document.getElementById("sfx-toggle");
  const sfxPopup = document.getElementById("sfx-slider-popup");
  const sfxSlider = document.getElementById("sfx-slider");
  const sfxLabel = document.getElementById("sfx-slider-label");
  const sfxIcon = document.getElementById("sfx-toggle-icon");
  if (sfxToggle && sfxPopup && sfxSlider) {
    // Init slider to current volume
    sfxSlider.value = Math.round(_sfxVolume * 100);
    if (sfxLabel) sfxLabel.textContent = Math.round(_sfxVolume * 100) + "%";
    if (sfxIcon) sfxIcon.textContent = _sfxVolume === 0 ? "\uD83D\uDD07" : _sfxVolume < 0.5 ? "\uD83D\uDD09" : "\uD83D\uDD0A";
    sfxToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = sfxPopup.style.display !== "none";
      sfxPopup.style.display = visible ? "none" : "flex";
    });
    sfxSlider.addEventListener("input", () => {
      const v = parseInt(sfxSlider.value, 10) / 100;
      setSfxVolume(v);
      if (sfxLabel) sfxLabel.textContent = Math.round(v * 100) + "%";
    });
    // Close popup when clicking elsewhere
    document.addEventListener("click", (e) => {
      if (!sfxToggle.contains(e.target) && !sfxPopup.contains(e.target)) {
        sfxPopup.style.display = "none";
      }
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

  // ── Debug Tools window toggle / close / drag ──────────────────
  const debugWin = document.getElementById("debug-window");
  const debugToggleBtn = document.getElementById("debug-toggle");
  const debugWinClose = document.getElementById("debug-window-close");
  const debugWinHeader = document.getElementById("debug-window-header");
  function setDebugWindowOpen(open) {
    if (!debugWin) return;
    debugWin.classList.toggle("debug-window-hidden", !open);
    if (debugToggleBtn) debugToggleBtn.classList.toggle("is-open", open);
  }
  if (debugToggleBtn && debugWin) {
    debugToggleBtn.addEventListener("click", () => {
      setDebugWindowOpen(debugWin.classList.contains("debug-window-hidden"));
    });
  }
  if (debugWinClose && debugWin) {
    debugWinClose.addEventListener("click", () => setDebugWindowOpen(false));
  }
  if (debugWinHeader && debugWin) {
    let draggingDebug = false,
      dbgStartX,
      dbgStartY,
      dbgOrigX,
      dbgOrigY;
    debugWinHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".debug-window-close")) return;
      draggingDebug = true;
      const rect = debugWin.getBoundingClientRect();
      dbgOrigX = rect.left;
      dbgOrigY = rect.top;
      dbgStartX = e.clientX;
      dbgStartY = e.clientY;
      debugWin.style.left = dbgOrigX + "px";
      debugWin.style.top = dbgOrigY + "px";
      debugWin.style.right = "auto";
      debugWin.style.bottom = "auto";
      debugWinHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingDebug) return;
      const nextLeft = dbgOrigX + e.clientX - dbgStartX;
      const nextTop = dbgOrigY + e.clientY - dbgStartY;
      const maxLeft = window.innerWidth - debugWin.offsetWidth - 4;
      const maxTop = window.innerHeight - debugWin.offsetHeight - 4;
      debugWin.style.left = Math.max(4, Math.min(nextLeft, maxLeft)) + "px";
      debugWin.style.top = Math.max(4, Math.min(nextTop, maxTop)) + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingDebug) return;
      draggingDebug = false;
      debugWinHeader.style.cursor = "";
    });
  }

  // How to Play toggle
  const helpToggle = document.getElementById("board-help-toggle");
  const helpEl = document.getElementById("board-help");
  const helpClose = document.getElementById("board-help-close");
  if (helpClose && helpEl) {
    helpClose.addEventListener("click", () => {
      helpEl.classList.add("board-help-hidden");
    });
  }
  if (helpToggle && helpEl) {
    helpToggle.addEventListener("click", () => {
      if (helpEl.classList.contains("board-help-hidden")) {
        helpEl.classList.remove("board-help-hidden");
        helpEl.style.left = "auto";
        helpEl.style.right = "2%";
        helpEl.style.top = "auto";
        helpEl.style.bottom = "12%";
        helpEl.style.transform = "none";
      } else {
        helpEl.classList.add("board-help-hidden");
      }
    });
  }
  // Make help panel draggable
  const helpHeader = document.getElementById("board-help-header");
  if (helpHeader && helpEl) {
    let draggingHelp = false, helpStartX, helpStartY, helpOrigX, helpOrigY;
    helpHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-help-close")) return;
      draggingHelp = true;
      const rect = helpEl.getBoundingClientRect();
      const parentRect = helpEl.parentElement.getBoundingClientRect();
      helpOrigX = rect.left - parentRect.left;
      helpOrigY = rect.top - parentRect.top;
      helpStartX = e.clientX;
      helpStartY = e.clientY;
      helpEl.style.left = helpOrigX + "px";
      helpEl.style.top = helpOrigY + "px";
      helpEl.style.right = "auto";
      helpEl.style.bottom = "auto";
      helpHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingHelp) return;
      helpEl.style.left = helpOrigX + e.clientX - helpStartX + "px";
      helpEl.style.top = helpOrigY + e.clientY - helpStartY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingHelp) return;
      draggingHelp = false;
      helpHeader.style.cursor = "";
    });
  }

  // Emoji reactions toggle
  const emojiToggle = document.getElementById("board-emoji-toggle");
  const emojiPicker = document.getElementById("emoji-picker");
  if (emojiToggle && emojiPicker) {
    // Restore saved position
    try {
      const saved = localStorage.getItem("emoji-picker-pos");
      if (saved) {
        const { left, top } = JSON.parse(saved);
        if (typeof left === "number" && typeof top === "number") {
          emojiPicker.style.left = left + "px";
          emojiPicker.style.top = top + "px";
          emojiPicker.style.right = "auto";
          emojiPicker.style.bottom = "auto";
        }
      }
    } catch (_) {}

    emojiToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = emojiPicker.style.display !== "none";
      emojiPicker.style.display = visible ? "none" : "flex";
    });

    // Track drag state so click-outside doesn't close the picker mid-drag,
    // and so a drag release that lands on an emoji doesn't fire sendReaction.
    let emojiDragging = false;
    let emojiDragMoved = false;
    let emojiStartX, emojiStartY, emojiOrigX, emojiOrigY;
    const EMOJI_DRAG_THRESHOLD = 3;
    const emojiHandle = document.getElementById("emoji-picker-handle");
    if (emojiHandle) {
      emojiHandle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        emojiDragging = true;
        emojiDragMoved = false;
        const rect = emojiPicker.getBoundingClientRect();
        const parentRect = emojiPicker.parentElement.getBoundingClientRect();
        emojiOrigX = rect.left - parentRect.left;
        emojiOrigY = rect.top - parentRect.top;
        emojiStartX = e.clientX;
        emojiStartY = e.clientY;
        emojiPicker.style.left = emojiOrigX + "px";
        emojiPicker.style.top = emojiOrigY + "px";
        emojiPicker.style.right = "auto";
        emojiPicker.style.bottom = "auto";
        emojiHandle.style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
      });
    }
    window.addEventListener("mousemove", (e) => {
      if (!emojiDragging) return;
      const dx = e.clientX - emojiStartX;
      const dy = e.clientY - emojiStartY;
      if (!emojiDragMoved && Math.hypot(dx, dy) > EMOJI_DRAG_THRESHOLD) {
        emojiDragMoved = true;
      }
      emojiPicker.style.left = emojiOrigX + dx + "px";
      emojiPicker.style.top = emojiOrigY + dy + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!emojiDragging) return;
      emojiDragging = false;
      if (emojiHandle) emojiHandle.style.cursor = "";
      if (emojiDragMoved) {
        // Save new position
        const parentRect = emojiPicker.parentElement.getBoundingClientRect();
        const rect = emojiPicker.getBoundingClientRect();
        const left = rect.left - parentRect.left;
        const top = rect.top - parentRect.top;
        try {
          localStorage.setItem(
            "emoji-picker-pos",
            JSON.stringify({ left, top })
          );
        } catch (_) {}
      }
      // Suppress the click event that follows mouseup after a real drag
      if (emojiDragMoved) {
        const suppress = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", suppress, true);
        };
        window.addEventListener("click", suppress, true);
      }
    });

    document.addEventListener("click", (e) => {
      if (emojiDragging || emojiDragMoved) return;
      if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
        emojiPicker.style.display = "none";
      }
    });
  }

  // Phone toggle — show/hide app buttons
  const phoneToggle = document.getElementById("phone-toggle");
  if (phoneToggle) {
    // ── Draggable phone button ───────────────────────────────────
    // The phone always starts at the CSS default position (bottom middle of
    // the board). It can be dragged around within a session, but the
    // position is intentionally NOT persisted — restarting the game resets
    // it to bottom middle. Clear any stale saved position from older builds.
    try { localStorage.removeItem("phone-toggle-pos"); } catch {}

    let phoneDragging = false;
    let phoneMoved = false;
    let phoneStartX, phoneStartY, phoneOrigX, phoneOrigY;
    const PHONE_DRAG_THRESHOLD = 4;

    phoneToggle.addEventListener("mousedown", (e) => {
      phoneDragging = true;
      phoneMoved = false;
      const rect = phoneToggle.getBoundingClientRect();
      const parentEl = phoneToggle.parentElement;
      if (!parentEl) return;
      const parentRect = parentEl.getBoundingClientRect();
      phoneOrigX = rect.left - parentRect.left;
      phoneOrigY = rect.top - parentRect.top;
      phoneStartX = e.clientX;
      phoneStartY = e.clientY;
      phoneToggle.style.left = phoneOrigX + "px";
      phoneToggle.style.top = phoneOrigY + "px";
      phoneToggle.style.bottom = "auto";
      phoneToggle.classList.add("phone-toggle-dragged");
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!phoneDragging) return;
      const dx = e.clientX - phoneStartX;
      const dy = e.clientY - phoneStartY;
      if (!phoneMoved && Math.hypot(dx, dy) > PHONE_DRAG_THRESHOLD) {
        phoneMoved = true;
        phoneToggle.style.cursor = "grabbing";
      }
      if (phoneMoved) {
        phoneToggle.style.left = phoneOrigX + dx + "px";
        phoneToggle.style.top = phoneOrigY + dy + "px";
        updatePhoneAppPositions();
      }
    });
    window.addEventListener("mouseup", () => {
      if (!phoneDragging) return;
      phoneDragging = false;
      phoneToggle.style.cursor = "";
    });
    // Suppress click if a drag just happened so the toggle doesn't fire
    phoneToggle.addEventListener("click", (e) => {
      if (phoneMoved) {
        phoneMoved = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);

    phoneToggle.addEventListener("click", () => {
      const board = document.getElementById("board");
      if (!board) return;
      const collapsed = board.classList.toggle("apps-collapsed");
      phoneToggle.classList.toggle("apps-hidden", collapsed);
      // Also close any open panels when hiding
      if (collapsed) {
        emojiPicker && (emojiPicker.style.display = "none");
      }
    });

    // Initial positioning of app buttons above the phone, plus resize tracking
    requestAnimationFrame(updatePhoneAppPositions);
    window.addEventListener("resize", updatePhoneAppPositions);
  }
});

// Position the 6 app buttons (chat, log, trade, help, emoji, sfx) in a
// vertical column directly above the phone-toggle so they follow it when
// dragged. Called on init, on phone drag, and on window resize.
const PHONE_APP_BUTTON_IDS = [
  "board-chat-toggle",
  "board-log-toggle",
  "board-trade-deals-toggle",
  "board-help-toggle",
  "board-emoji-toggle",
  "sfx-toggle",
];
function updatePhoneAppPositions() {
  const phoneToggle = document.getElementById("phone-toggle");
  if (!phoneToggle) return;
  const parentEl = phoneToggle.parentElement;
  if (!parentEl) return;
  const phoneRect = phoneToggle.getBoundingClientRect();
  if (phoneRect.width === 0 || phoneRect.height === 0) return;
  const parentRect = parentEl.getBoundingClientRect();
  const phoneLeft = phoneRect.left - parentRect.left;
  const phoneTop = phoneRect.top - parentRect.top;
  const phoneCenterX = phoneLeft + phoneRect.width / 2;
  const APP_SIZE = 40;
  const GAP = 8;
  PHONE_APP_BUTTON_IDS.forEach((id, i) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const btnLeft = phoneCenterX - APP_SIZE / 2;
    const btnTop = phoneTop - (i + 1) * (APP_SIZE + GAP);
    btn.style.left = btnLeft + "px";
    btn.style.top = btnTop + "px";
    btn.style.bottom = "auto";
    btn.style.right = "auto";
  });
}

// ── Emoji Reactions ────────────────────────────────────────────────

let _reactionCooldown = false;

function sendReaction(emoji) {
  if (!socket || !gameId) return;
  if (_reactionCooldown) return;
  _reactionCooldown = true;
  setTimeout(() => { _reactionCooldown = false; }, 2000);
  socket.emit("player_reaction", { gameId, emoji });
}

function showEmojiReaction(playerId, emoji) {
  const tok = _tokenElements && _tokenElements[playerId];
  if (!tok || !tok.parentNode) return;
  const rect = tok.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "emoji-reaction-bubble";
  bubble.textContent = emoji;
  bubble.style.position = "fixed";
  bubble.style.left = (rect.left + rect.width / 2) + "px";
  bubble.style.top = rect.top + "px";
  bubble.style.zIndex = "9999";
  document.body.appendChild(bubble);
  bubble.addEventListener("animationend", () => bubble.remove());
}

// ── Board Preview ──────────────────────────────────────────────────

let _previewLayout = null;
let _previewMode = "classic"; // "classic" | "simple"

function openBoardPreview() {
  const overlay = document.getElementById("board-preview-overlay");
  overlay.style.display = "flex";
  setPreviewMode(_previewMode);
}

function closeBoardPreview() {
  document.getElementById("board-preview-overlay").style.display = "none";
}

// Switch the preview between the classic and simple-mode boards, then re-shuffle.
function setPreviewMode(mode) {
  _previewMode = mode === "simple" ? "simple" : "classic";
  const classicBtn = document.getElementById("bp-mode-classic");
  const simpleBtn = document.getElementById("bp-mode-simple");
  if (classicBtn) classicBtn.classList.toggle("active", _previewMode === "classic");
  if (simpleBtn) simpleBtn.classList.toggle("active", _previewMode === "simple");
  shuffleBoardPreview();
}

function shuffleBoardPreview() {
  playShuffleSound();
  _previewLayout =
    _previewMode === "simple" ? buildSimplePreviewLayout() : buildPreviewLayout();
  renderPreviewBoard(_previewLayout);
}

function scrollHelpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const body = document.querySelector(".board-help-body");
  if (body) {
    const offset = el.offsetTop - body.offsetTop - 8;
    body.scrollTo({ top: offset, behavior: "smooth" });
  }
}

/* ── Tutorial Mode ─────────────────────────────────────────────── */

let _tutStep = 0;
let _tutVisited = new Set();

const TUTORIAL_STEPS = [
  // 0: Welcome
  {
    title: "Welcome to Monkey Business!",
    icon: "🐒",
    render() {
      return `
        <div class="tut-icon">🐒🍌💰</div>
        <h2>Welcome to Monkey Business!</h2>
        <p>Ready to become the <span class="tut-highlight">top banana tycoon</span>? This tutorial will teach you everything you need to dominate the board.</p>
        <p>You'll learn how to buy farms, grow bananas, outsmart opponents, and maybe throw a pineapple bomb or two.</p>
        <div class="tut-tip"><strong>Tip:</strong> You can click the dots below to jump to any section, or use the arrow buttons to go step by step.</div>
        <p style="text-align:center;margin-top:12px;font-size:0.85em;color:#aaa;">Click <span class="tut-highlight">Next →</span> to begin!</p>`;
    },
  },
  // 1: The Board
  {
    title: "The Board",
    icon: "🗺️",
    render() {
      const tiles = [];
      // Row 1 (top)
      const labels = ["🌴GO", "🟡", "🔵", "🌵", "🔴", "🍄", "🌴25%"];
      const classes = ["corner", "prop", "prop", "special", "prop", "special", "corner"];
      for (let i = 0; i < 7; i++) {
        tiles.push(`<div class="tut-tile tut-tile-${classes[i]}">${labels[i]}</div>`);
      }
      // Middle rows (sides only)
      const leftTiles = ["🟠", "💰", "🎰", "🟡", "🌿"];
      const rightTiles = ["🔵", "💀", "🟠", "🟡", "🌿"];
      for (let r = 0; r < 5; r++) {
        tiles.push(`<div class="tut-tile tut-tile-prop">${leftTiles[r]}</div>`);
        for (let c = 0; c < 5; c++) {
          tiles.push(`<div class="tut-tile" style="background:transparent;"></div>`);
        }
        tiles.push(`<div class="tut-tile tut-tile-prop">${rightTiles[r]}</div>`);
      }
      // Bottom row
      const botLabels = ["🌴75%", "🟡", "🔴", "🌿", "💗", "🔵", "🌴50%"];
      const botClasses = ["corner", "prop", "prop", "special", "prop", "prop", "corner"];
      for (let i = 0; i < 7; i++) {
        tiles.push(`<div class="tut-tile tut-tile-${botClasses[i]}">${botLabels[i]}</div>`);
      }
      return `
        <div class="tut-icon">🗺️</div>
        <h2>The Board</h2>
        <p>The board has <span class="tut-highlight">52 spaces</span> arranged in a square loop. Each game shuffles the tiles, so no two games are the same!</p>
        <div class="tut-board-mini">${tiles.join("")}</div>
        <p><span class="tut-highlight">Corners</span> (🌴) give you banana growth bonuses when you pass them: 100%, 25%, 50%, and 75%.</p>
        <p>Colored tiles are <span class="tut-highlight">buyable farms</span>. Special tiles include deserts 🌵, vine swings 🌿, mushrooms 🍄, and more.</p>`;
    },
  },
  // 2: Dice & Movement
  {
    title: "Dice & Movement",
    icon: "🎲",
    render() {
      return `
        <div class="tut-icon">🎲</div>
        <h2>Rolling the Dice</h2>
        <p>On your turn, roll <span class="tut-highlight">1 to 3 dice</span>. More dice means you move farther, but you might overshoot a tile you wanted!</p>
        <div class="tut-dice-demo">
          <div class="tut-die" onclick="tutRollDie(this)">3</div>
          <div class="tut-die" onclick="tutRollDie(this)">5</div>
          <div class="tut-die" onclick="tutRollDie(this)">2</div>
        </div>
        <p style="text-align:center;font-size:0.8em;color:#aaa;">Click the dice to roll them!</p>
        <p>As you move, you <span class="tut-highlight">collect bananas</span> from piles on each tile you pass through. Bigger piles mean more bananas!</p>
        <div class="tut-tip"><strong>Tip:</strong> If your dice total matches the number on the tile you land on, you get a <span class="tut-highlight">500 banana bonus</span>!</div>`;
    },
  },
  // 3: Buying Farms
  {
    title: "Buying Farms",
    icon: "🌴",
    render() {
      return `
        <div class="tut-icon">🌴</div>
        <h2>Buying Farms</h2>
        <p>When you land on an unowned farm, you can <span class="tut-highlight">buy it</span>! Farms come in 6 color groups:</p>
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0;">
          <span style="color:#ffe135;">● Yellow (12)</span>
          <span style="color:#87ceeb;">● Blue (7)</span>
          <span style="color:#e74c3c;">● Red (5)</span>
          <span style="color:#ff69b4;">● Pink (5)</span>
          <span style="color:#4169e1;">● DarkBlue (4)</span>
          <span style="color:#ff8c00;">● Orange (3)</span>
        </div>
        <div class="tut-property-card" style="border-color:#87ceeb;">
          <div class="tut-prop-name" style="color:#87ceeb;">Coconut Cove</div>
          <div class="tut-prop-price">🍌 200</div>
          <div class="tut-prop-rent">Rent: 20 → 40 → 80 → 160</div>
        </div>
        <p>When opponents land on your farm, they <span class="tut-highlight">pay you rent</span>. Own more farms in the same color group to increase rent!</p>
        <div class="tut-tip"><strong>Tip:</strong> Orange farms are rare (only 3!) but have high rent. They're great investments.</div>`;
    },
  },
  // 4: Banana Economy
  {
    title: "Banana Economy",
    icon: "🍌",
    render() {
      return `
        <div class="tut-icon">🍌</div>
        <h2>The Banana Economy</h2>
        <p>Bananas are your currency. You start with <span class="tut-highlight">2,222 bananas</span> (customizable). Here's how to earn more:</p>
        <p>🌴 <strong>Passing corners</strong> — grow your bananas by 25-100%</p>
        <p>🚶 <strong>Walking over tiles</strong> — collect banana piles along the way</p>
        <p>🏠 <strong>Rent from farms</strong> — opponents pay you when they land on your farms</p>
        <p>🎰 <strong>Poker wins</strong> — defeat opponents in card showdowns</p>
        <p>🎲 <strong>Dice match bonus</strong> — land on a tile matching your dice total</p>
        <h2 style="font-size:1em;margin-top:12px;">Chain Multipliers</h2>
        <div class="tut-chain-demo">
          <div class="tut-chain-tile owned" style="background:rgba(255,225,53,0.2);color:#ffe135;">🌴</div>
          <span class="tut-chain-arrow">→</span>
          <div class="tut-chain-tile owned" style="background:rgba(255,225,53,0.2);color:#ffe135;">🌴</div>
          <span class="tut-chain-arrow">→</span>
          <div class="tut-chain-tile owned" style="background:rgba(255,225,53,0.2);color:#ffe135;">🌴</div>
          <div class="tut-chain-mult">×3 bonus!</div>
        </div>
        <p>Own <span class="tut-highlight">adjacent farms</span> to earn chain multipliers on banana collection — the longer the chain, the bigger the bonus!</p>`;
    },
  },
  // 5: Auctions
  {
    title: "Auctions",
    icon: "🔨",
    render() {
      return `
        <div class="tut-icon">🔨</div>
        <h2>Auctions</h2>
        <p>When you land on a farm owned by someone else, instead of just paying rent, you can <span class="tut-highlight">start an auction</span> to try to buy it!</p>
        <p>Here's how it works:</p>
        <p>1️⃣ <strong>You bid</strong> — enter the amount you're willing to pay</p>
        <p>2️⃣ <strong>Owner decides</strong> — they can <span style="color:#4caf50;">accept</span> your bid (sell the farm) or <span style="color:#e74c3c;">reject</span> it</p>
        <p>3️⃣ <strong>15-second timer</strong> — decisions must be fast!</p>
        <div class="tut-tip"><strong>Strategy:</strong> Bid high enough to tempt the owner, but not so high that you overpay. Watch your opponents' banana counts to know what they can afford to reject!</div>
        <p>If the owner doesn't respond in time, the auction <span class="tut-highlight">automatically resolves</span> based on the bid amount.</p>`;
    },
  },
  // 6: Monkey Poker
  {
    title: "Monkey Poker",
    icon: "🃏",
    render() {
      return `
        <div class="tut-icon">🃏</div>
        <h2>Monkey Poker</h2>
        <p>Land on a <span class="tut-highlight">poker challenge tile</span> and you'll face off against an opponent in a simplified poker game!</p>
        <p>Each player gets cards numbered <strong>1-10</strong>. The player with the <span class="tut-highlight">highest sum</span> wins the pot.</p>
        <div style="display:flex;gap:8px;justify-content:center;margin:12px 0;">
          <div style="background:rgba(255,225,53,0.15);border:2px solid rgba(255,225,53,0.4);border-radius:8px;padding:8px 14px;font-size:1.3em;font-weight:700;color:#ffe135;">7</div>
          <div style="background:rgba(255,225,53,0.15);border:2px solid rgba(255,225,53,0.4);border-radius:8px;padding:8px 14px;font-size:1.3em;font-weight:700;color:#ffe135;">9</div>
          <div style="background:rgba(135,206,235,0.15);border:2px solid rgba(135,206,235,0.4);border-radius:8px;padding:8px 14px;font-size:1.3em;color:#87ceeb;">?</div>
          <div style="background:rgba(135,206,235,0.15);border:2px solid rgba(135,206,235,0.4);border-radius:8px;padding:8px 14px;font-size:1.3em;color:#87ceeb;">?</div>
        </div>
        <p style="text-align:center;font-size:0.8em;color:#aaa;">Your cards (yellow) vs. opponent's hidden cards (blue)</p>
        <p>You can <strong>bet</strong>, <strong>raise</strong>, <strong>call</strong>, <strong>fold</strong>, or go <strong>all-in</strong> — just like real poker!</p>
        <div class="tut-tip"><strong>Tip:</strong> If you have a strong hand (high cards), raise aggressively. If your hand is weak, consider folding early to minimize losses.</div>`;
    },
  },
  // 7: Pets
  {
    title: "Pet Abilities",
    icon: "🐾",
    render() {
      return `
        <div class="tut-icon">🐾</div>
        <h2>Pet Abilities</h2>
        <p>Choose a pet companion before the game starts. Each pet has a <span class="tut-highlight">unique special ability</span> you can activate during gameplay!</p>
        <div class="tut-pets-grid">
          <div class="tut-pet-item">
            <span class="tut-pet-icon">💪</span>
            <div class="tut-pet-name">Strong</div>
            <div class="tut-pet-desc">Move forward 1 space</div>
          </div>
          <div class="tut-pet-item">
            <span class="tut-pet-icon">🔮</span>
            <div class="tut-pet-name">Magic</div>
            <div class="tut-pet-desc">Teleport an opponent randomly</div>
          </div>
          <div class="tut-pet-item">
            <span class="tut-pet-icon">⚡</span>
            <div class="tut-pet-name">Energy</div>
            <div class="tut-pet-desc">Coin flip: +2 or -1 spaces</div>
          </div>
          <div class="tut-pet-item">
            <span class="tut-pet-icon">😈</span>
            <div class="tut-pet-name">Devil</div>
            <div class="tut-pet-desc">Push back opponent, steal 200🍌</div>
          </div>
          <div class="tut-pet-item">
            <span class="tut-pet-icon">🌿</span>
            <div class="tut-pet-name">Vine Swing</div>
            <div class="tut-pet-desc">Choose your landing tile</div>
          </div>
        </div>
        <div class="tut-tip"><strong>Strategy:</strong> Devil is risky (10-roll cooldown) but devastating. Vine Swing gives the most control. Strong is reliable and charges fast (6 rolls).</div>`;
    },
  },
  // 8: Pineapple Bombs
  {
    title: "Pineapple Bombs",
    icon: "🍍💣",
    render() {
      return `
        <div class="tut-icon">🍍💣</div>
        <h2>Pineapple Bombs</h2>
        <p>The most dangerous weapon in Monkey Business! Buy a bomb for <span class="tut-highlight">500 bananas</span> and plant it on any tile.</p>
        <p>If an opponent lands on your bomb... <strong>BOOM!</strong> They're <span style="color:#e74c3c;font-weight:700;">eliminated</span> from the game!</p>
        <div style="text-align:center;font-size:2em;margin:10px 0;animation:pulse 1.5s infinite;">🍍💥🐒</div>
        <p>Key bomb rules:</p>
        <p>💣 Bombs <span class="tut-highlight">expire after 8 turns</span> if nobody triggers them</p>
        <p>💣 You can't bomb your own teammates (in 2v2 mode)</p>
        <p>💣 The bomber gets a <span class="tut-highlight">bounty reward</span> for each elimination</p>
        <div class="tut-tip"><strong>Strategy:</strong> Place bombs on high-traffic tiles near corners, or on properties your opponent needs to complete a color group. Mind games are half the fun!</div>`;
    },
  },
  // 9: Game Modes & Tips
  {
    title: "Game Modes & Tips",
    icon: "🏆",
    render() {
      return `
        <div class="tut-icon">🏆</div>
        <h2>Game Modes</h2>
        <p><strong>🐒 Free-for-All (2-4 players)</strong> — Last monkey standing wins! Bankrupt or bomb everyone else.</p>
        <p><strong>🤝 2v2 Teams (4 players)</strong> — Work with your partner to reach the team banana target first. You can swap farms and trade bananas freely with your teammate.</p>
        <h2 style="font-size:1em;margin-top:14px;">Top Tips for Success</h2>
        <p>🧠 <strong>Buy strategically</strong> — Focus on completing color groups for maximum rent</p>
        <p>🎯 <strong>Choose dice count wisely</strong> — Fewer dice for precision, more dice for speed</p>
        <p>💰 <strong>Keep a reserve</strong> — Don't spend all your bananas on farms. You need money for auctions, bombs, and rent!</p>
        <p>🐾 <strong>Time your pet ability</strong> — Don't waste it early. Save it for a critical moment</p>
        <p>👀 <strong>Watch opponents</strong> — Track their banana count and farm positions to predict their moves</p>
        <div class="tut-tip"><strong>Ready?</strong> Click <span class="tut-highlight">Start Playing!</span> to head back to the menu and create or join a game!</div>`;
    },
  },
];

function startTutorial() {
  _tutStep = 0;
  _tutVisited = new Set([0]);
  showScreen("screen-tutorial");
  renderTutorialStep();
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[_tutStep];
  const content = document.getElementById("tutorial-content");
  content.innerHTML = `<div class="tutorial-step">${step.render()}</div>`;

  // Progress bar
  const pct = ((_tutStep + 1) / TUTORIAL_STEPS.length) * 100;
  document.getElementById("tutorial-progress-bar").style.width = pct + "%";

  // Step counter
  document.getElementById("tutorial-step-counter").textContent =
    `Step ${_tutStep + 1} / ${TUTORIAL_STEPS.length}`;

  // Dots
  const dotsEl = document.getElementById("tutorial-dots");
  dotsEl.innerHTML = TUTORIAL_STEPS.map(
    (_, i) =>
      `<div class="tutorial-dot${i === _tutStep ? " active" : ""}${_tutVisited.has(i) ? " visited" : ""}" onclick="tutorialGoTo(${i})"></div>`
  ).join("");

  // Nav buttons
  const prevBtn = document.getElementById("tutorial-prev");
  const nextBtn = document.getElementById("tutorial-next");

  if (_tutStep === 0) {
    prevBtn.textContent = "← Menu";
    prevBtn.onclick = () => showScreen("screen-menu");
  } else {
    prevBtn.textContent = "← Back";
    prevBtn.onclick = tutorialPrev;
  }

  if (_tutStep === TUTORIAL_STEPS.length - 1) {
    nextBtn.textContent = "Start Playing! 🎮";
    nextBtn.onclick = () => showScreen("screen-menu");
  } else {
    nextBtn.textContent = "Next →";
    nextBtn.onclick = tutorialNext;
  }
}

function tutorialNext() {
  if (_tutStep < TUTORIAL_STEPS.length - 1) {
    _tutStep++;
    _tutVisited.add(_tutStep);
    renderTutorialStep();
  }
}

function tutorialPrev() {
  if (_tutStep > 0) {
    _tutStep--;
    renderTutorialStep();
  }
}

function tutorialGoTo(i) {
  _tutStep = i;
  _tutVisited.add(i);
  renderTutorialStep();
}

function tutRollDie(el) {
  const val = Math.floor(Math.random() * 6) + 1;
  el.textContent = val;
  el.classList.remove("tut-die-roll");
  void el.offsetWidth; // force reflow
  el.classList.add("tut-die-roll");
  try { playDiceRoll(); } catch (e) {}
}
