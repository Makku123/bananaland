// Pile-chip persistence across TURNS — regression test for "boxes disappear
// then reappear on turn change". Emulates the cross-module choreography
// (game-socket.js pile snapshot + game-screen.js freeze/walk/unfreeze flags)
// while driving the REAL board.js renderers in jsdom.
//
// The bug: game-socket.js rebuilt _prevBananaPileState only when
// !window._tokenWalking. With overlapping walks (throttled background tab,
// fast consecutive turns) the next roll froze the board to a snapshot from
// BEFORE the previous turn — piles grown since then vanished until unfreeze.
// Fixed by snapshotting piles unconditionally on every update.
//
// Run from frontend/: npm i --no-save jsdom && node test_pile_persist.js

const fs = require("fs");
const path = require("path");
let JSDOM, root;
if (process.argv[2]) {
  root = process.argv[2];
  ({ JSDOM } = require(path.join(root, "harness", "node_modules", "jsdom")));
} else {
  root = null;
  ({ JSDOM } = require("jsdom"));
}
const feDir = root ? path.join(root, "fe") : __dirname;
const boardSrc = fs.readFileSync(path.join(feDir, "board.js"), "utf8");
const socketSrc = fs.readFileSync(path.join(feDir, "game-socket.js"), "utf8");

let passed = 0, failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log("  FAIL: " + msg); }
}

function makeWorld() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="board"></div></body></html>`,
    { runScripts: "outside-only", pretendToBeVisual: true },
  );
  const w = dom.window;
  const events = [];
  const isChip = (n) => n && n.nodeType === 1 && n.classList && n.classList.contains("banana-pile");
  const tileOf = (n) => (n.getAttribute && n.getAttribute("data-tile")) || "?";
  const origRemove = w.Element.prototype.remove;
  w.Element.prototype.remove = function () {
    if (isChip(this) && this.isConnected)
      events.push({ type: "detach", tile: tileOf(this), text: this.textContent });
    return origRemove.call(this);
  };
  w.eval(`
    var gs = null; var myId = "p1"; var socket = { emit: function(){} };
    var gameId = "TEST";
    var bananaBurst = function(){}; var _touchLandingFx = function(){};
    var SIMPLE_PLAYER_COLOR_HEX = { red:"#f00", blue:"#00f" };
    var handleAbilityTileClick = function(){};
  `);
  for (let i = 0; i < 60; i++) {
    try { w.eval(boardSrc); break; }
    catch (e) {
      const m = /(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      w.eval(`var ${m[1]} = function(){};`);
    }
  }
  return { w, events };
}

function drive(w, fn, gs) {
  w.__g = gs;
  for (let i = 0; i < 60; i++) {
    try { w.eval(`gs = window.__g; ${fn}(window.__g);`); return; }
    catch (e) {
      const m = /(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      w.eval(`var ${m[1]} = function(){};`);
    }
  }
  throw new Error("drive: too many stubs");
}

// The game-socket.js pile-snapshot semantics. legacyGuard=true reproduces the
// old behavior (skip while _tokenWalking) for the negative check below;
// production behavior is unconditional (see sync-check at the bottom).
function socketSnapshot(w, prevGs, legacyGuard) {
  if (!prevGs) return;
  if (legacyGuard && w.eval("!!window._tokenWalking")) return;
  if (prevGs.properties) {
    const snap = {};
    prevGs.properties.forEach((p) => { if (p.bananaPile > 0) snap[p.id] = p.bananaPile; });
    w.__snap = snap;
    w.eval("window._prevBananaPileState = window.__snap;");
  }
}

function makeGs(piles, extra) {
  const boardLayout = [], properties = [];
  for (let i = 0; i < 48; i++) {
    boardLayout.push({ type: "property", name: "F" + (i + 1), group: "farm" });
    const p = piles[i] || {};
    properties.push({ id: i, name: "F" + (i + 1), group: "farm", price: i + 1,
      owner: p.owner || null, bananaPile: p.amount || 0 });
  }
  const revealed = Array.from({ length: 48 }, (_, i) => i);
  const mk = (id, name, color, pos) => ({ id, name, color, position: pos, money: 1000,
    bankrupt: false, ghost: false, startPickPending: false, properties: [],
    revealedTiles: revealed, cards: {}, bomb: 0 });
  return Object.assign({
    state: "playing", turn: 3, boardLayout, properties,
    players: [mk("p1", "Alice", "red", 10), mk("p2", "Bob", "blue", 30)],
    currentPlayer: null, gameMode: "classic", dice: [2, 3], diceRolled: false,
    bombs: [], log: [], diceMatchTiles: null, diceMatchGrownAmounts: null,
    diceMatchEarlyPickup: null, lastGrowFired: null, lastGrowActivated: null,
    revealAccepted: [], teams: null,
  }, extra || {});
}

const chipFor = (w, t) => w.document.querySelector(`#board .banana-pile[data-tile="${t}"]`);
const drain = (e) => e.splice(0, e.length);
const detaches = (e, t) => e.filter(x => x.type === "detach" && (!t || x.tile === String(t))).length;

function rollFreeze(w) {
  // Mirrors the game-screen.js dice handler: installing a freeze also clears
  // the revealed-amounts memory (the fresh snapshot carries last turn's piles).
  w.eval(`
    window._tokenWalking = true;
    window._frozenBananaPiles = window._prevBananaPileState || null;
    window._tokenVisitedTiles = new Set();
    window._pulseRevealedTiles = null;
    window._pulseRevealedAmounts = null;
    window._walkingPlayerId = gs && gs.currentPlayer ? gs.currentPlayer.id : null;
  `);
}
function unfreeze(w) {
  w.eval(`
    window._tokenWalking = false;
    window._frozenBananaPiles = null;
    window._diceMatchUnfrozen = false;
    window._tokenVisitedTiles = null;
    window._walkingPlayerId = null;
    window._walkingLandingPos = null;
    window._frozenPileTotals = null;
    window._pulseRevealedTiles = null;
    window._pulseRevealedAmounts = null;
  `);
}

// Two consecutive turns. Turn A's rolled grow CREATES a 20-pile on the
// previously-empty tile 5. overlapped=true delivers the turn-end update and
// turn B's roll while the previous walk is still animating.
function runTwoTurns(legacyGuard, overlapped) {
  const { w, events } = makeWorld();
  const gs0 = makeGs({ 9: { amount: 7, owner: "p1" } });
  drive(w, "renderBoard", gs0);

  const gs1 = makeGs({ 5: { amount: 20, owner: "p2" }, 9: { amount: 7, owner: "p1" } }, {
    diceRolled: true, diceMatchTiles: [5], diceMatchGrownAmounts: { 5: 20 },
    currentPlayer: { id: "p2" },
  });
  socketSnapshot(w, gs0, legacyGuard);
  rollFreeze(w);
  w.eval("window._diceMatchUnfrozen = true; window._diceMatchStealRender = true;");
  drive(w, "renderBoard", gs1);
  for (let i = 0; i < 3; i++) drive(w, "walkStepUpdate", gs1);

  const gs2 = makeGs({ 5: { amount: 20, owner: "p2" }, 9: { amount: 7, owner: "p1" } }, { turn: 4 });
  if (overlapped) {
    socketSnapshot(w, gs1, legacyGuard); // arrives while walk still animating
    drive(w, "walkStepUpdate", gs1);
    unfreeze(w); // A's cleanup finally fires
    drive(w, "renderBoard", gs2);
  } else {
    unfreeze(w);
    drive(w, "renderBoard", gs1);
    socketSnapshot(w, gs1, legacyGuard);
    drive(w, "renderBoard", gs2);
  }
  drain(events);

  const gs3 = makeGs({ 5: { amount: 20, owner: "p2" }, 9: { amount: 7, owner: "p1" } }, {
    turn: 4, diceRolled: true, currentPlayer: { id: "p1" }, dice: [1, 2],
  });
  if (overlapped) w.eval("window._tokenWalking = true;"); // B rolls before cleanup
  socketSnapshot(w, gs2, legacyGuard);
  rollFreeze(w);
  for (let i = 0; i < 3; i++) drive(w, "walkStepUpdate", gs3);
  unfreeze(w);
  drive(w, "renderBoard", gs3);
  return { w, events };
}

console.log("\n=== P1. Happy two-turn flow: untouched piles never vanish ===");
{
  const { w, events } = runTwoTurns(true, false);
  assert(detaches(events, 5) === 0, "P1: tile-5 chip survives turn B");
  assert(detaches(events, 9) === 0, "P1: tile-9 chip survives turn B");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"), "P1: tile-5 chip ends at 20");
}

console.log("\n=== P2. NEGATIVE: the old walking-guard reproduces the vanish ===");
{
  const { w, events } = runTwoTurns(true, true);
  assert(detaches(events, 5) > 0,
    "P2: legacy guard makes the tile-5 chip vanish mid-turn-B (harness detects the bug)");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"),
    "P2: ...and it reappears at unfreeze (the reported disappear/reappear)");
}

console.log("\n=== P3. PRODUCTION: unconditional snapshot — no vanish, ever ===");
{
  const { w, events } = runTwoTurns(false, true);
  assert(detaches(events, 5) === 0,
    "P3: tile-5 chip never vanishes across overlapped turns (got " + detaches(events, 5) + ")");
  assert(detaches(events, 9) === 0, "P3: tile-9 chip survives everything");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"), "P3: tile-5 chip ends at 20");
}

console.log("\n=== P4. Sync-check: game-socket.js snapshots piles unconditionally ===");
{
  assert(socketSrc.includes("Pile snapshot: ALWAYS"),
    "P4: the unconditional-snapshot block exists in game-socket.js");
  const guardIdx = socketSrc.indexOf("!window._tokenWalking)");
  const snapIdx = socketSrc.indexOf("_prevBananaPileState = {}");
  assert(guardIdx > 0 && snapIdx > guardIdx,
    "P4: the pile snapshot sits AFTER (outside) the walking-guarded block");
  const guardBlockEnd = socketSrc.indexOf("\n    }", guardIdx);
  assert(snapIdx > guardBlockEnd,
    "P4: the pile snapshot is not inside the guarded block");
}

console.log("\n=== P5. Sync-check: stale walk timers are generation-guarded ===");
{
  // game-screen.js stamps each walk with _walkGen; every deferred callback
  // (walk interval, landing cleanup, _growUnfreeze, finishLanding, pulse
  // timers) checks _walkAlive() before touching the shared freeze globals.
  // Without these guards, a previous turn's 600ms grow-unfreeze timer nulls
  // the NEW walk's _frozenBananaPiles mid-walk — the blink/re-bounce bug.
  const screenSrc = fs.readFileSync(path.join(feDir, "game-screen.js"), "utf8");
  const lobbySrc = fs.readFileSync(path.join(feDir, "game-lobby.js"), "utf8");
  assert(/window\._walkGen = \(window\._walkGen \|\| 0\) \+ 1/.test(screenSrc),
    "P5: dice handler stamps a new walk generation");
  assert(/const _growUnfreeze = \(isGrow\) => \{\s*\n\s*if \(!_walkAlive\(\)\) return;/.test(screenSrc),
    "P5: _growUnfreeze refuses to run for a superseded walk");
  assert(/const walkInterval = setInterval\(\(\) => \{\s*\n\s*if \(!_walkAlive\(\)\)/.test(screenSrc),
    "P5: the walk interval self-terminates when superseded");
  assert(/const _pulseGen = window\._walkGen;/.test(lobbySrc),
    "P5: _runGrowPulse stamps its walk generation");
  assert(/window\._growPulseActive = Math\.max\(0, \(window\._growPulseActive \|\| 1\) - 1\);\s*\n\s*if \(typeof onAllDone === "function" && _pulseAlive\(\)\) onAllDone\(\);/.test(lobbySrc),
    "P5: a stale pulse still releases _growPulseActive but skips onAllDone");
}

console.log("\n=== P6. Sync-check: game-socket.js snapshots REVEALED tiles unconditionally ===");
{
  // The fog freeze (game-screen.js _diceRollingRevealed) only keeps the
  // destination hidden during the walk if game-socket.js captured the PRE-move
  // revealed set. Exactly like the pile snapshot, that capture must sit OUTSIDE
  // the !window._tokenWalking guard — otherwise an overlapping / auto-roll
  // leaves _prevRevealedTiles stale and the destination tile un-fogs BEFORE the
  // token lands (the reported "tile reveals before it's landed on" bug).
  assert(socketSrc.includes("Revealed-tiles snapshot: ALWAYS"),
    "P6: the unconditional revealed-snapshot block exists in game-socket.js");
  const guardIdx = socketSrc.indexOf("!window._tokenWalking)");
  const revIdx = socketSrc.indexOf("_prevRevealedTiles = new Set");
  assert(guardIdx > 0 && revIdx > guardIdx,
    "P6: the revealed snapshot sits AFTER (outside) the walking-guarded block");
  const guardBlockEnd = socketSrc.indexOf("\n    }", guardIdx);
  assert(revIdx > guardBlockEnd,
    "P6: the revealed snapshot is not inside the guarded block");
  const count = (socketSrc.match(/_prevRevealedTiles = new Set/g) || []).length;
  assert(count === 1,
    "P6: exactly one _prevRevealedTiles snapshot (the old guarded copy was removed)");
}

console.log("\n=== P7. Sync-check: game-socket.js snapshots PLAYER POSITIONS unconditionally ===");
{
  // The frozen walk reads _prevPlayerPositions[cur.id] to find each player's
  // pre-move tile. Like the pile/revealed snapshots, this capture must sit OUTSIDE
  // the !window._tokenWalking guard — otherwise an overlapping / auto-roll /
  // backgrounded-tab update leaves _prevPlayerPositions stale and the frozen walk
  // renders the token from the wrong position.
  assert(socketSrc.includes("Player-position snapshot: ALWAYS"),
    "P7: the unconditional position-snapshot block exists in game-socket.js");
  const posIdx = socketSrc.indexOf("_prevPlayerPositions = {}");
  const guardIdx = socketSrc.indexOf("!window._tokenWalking)");
  // The position snapshot is its OWN unguarded `if (gs && gs.players)` block, so it
  // must appear BEFORE the first walk-guarded block (now the money snapshot).
  assert(posIdx > 0 && guardIdx > 0 && posIdx < guardIdx,
    "P7: the position snapshot sits OUTSIDE (before) the walking-guarded block");
  const blockOpen = socketSrc.lastIndexOf("if (gs && gs.players", posIdx);
  const opener = socketSrc.slice(blockOpen, posIdx);
  assert(blockOpen > 0 && !opener.includes("!window._tokenWalking"),
    "P7: the position snapshot's enclosing `if` does NOT include the walk guard");
  const count = (socketSrc.match(/_prevPlayerPositions = \{\}/g) || []).length;
  assert(count === 1,
    "P7: exactly one _prevPlayerPositions snapshot (the old guarded copy was removed)");
}

console.log("\n" + "=".repeat(50));
console.log(`PERSIST RESULTS: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));
if (failures.length) failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
process.exit(failed > 0 ? 1 : 0);
