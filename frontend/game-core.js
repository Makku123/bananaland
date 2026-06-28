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
  purple: "\uD83D\uDFE3",
  pink: "\uD83C\uDF38",
};

// Emoji shown for a "ghost" player (someone who left/disconnected mid-game; the
// server auto-plays their monkey until they reconnect).
const GHOST_EMOJI = "\uD83D\uDC7B"; // \uD83D\uDC7B

// Persistent per-device id, used to reclaim your GHOST after a disconnect. Kept
// in localStorage so it survives reloads; falls back to an in-memory id.
let _clientIdCache = null;
function getClientId() {
  if (_clientIdCache) return _clientIdCache;
  try {
    let id = localStorage.getItem("banana_client_id");
    if (!id) {
      id = "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("banana_client_id", id);
    }
    _clientIdCache = id;
  } catch {
    _clientIdCache = "c-" + Math.random().toString(36).slice(2);
  }
  return _clientIdCache;
}
// Last name we joined/created with \u2014 re-sent on a reconnect rejoin.
let _joinedName = null;

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

// Soft "thunk" played when a grow chain hits its stop (next revealed grow, or
// loops back to itself). Low-pitched triangle with a quick downward sweep —
// short enough to read as a "landed" beat without stepping on the chain music.
function playGrowChainStop() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.11);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.14);
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

