// Armed-rune PATH PREVIEW gate — regression test for "the cyan dashed armed-path
// perforations show even though the rune is not (effectively) armed".
//
// Drives the REAL board.js renderBoard() in jsdom and asserts the .armed-path /
// .armed-path-dest outline is painted ONLY when it should be:
//   - the viewer's OWN turn (gs.currentPlayer.id === myId),
//   - NOT during a token walk (window._tokenWalking),
//   - and only for a rune VALUE the viewer still holds (hold-check).
//
// Run from frontend/: npm i --no-save jsdom && node test_armed_path.js

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
  w.eval(`
    var gs = null; var myId = "p1"; var socket = { emit: function(){} };
    var gameId = "TEST";
    var bananaBurst = function(){}; var _touchLandingFx = function(){};
    var SIMPLE_PLAYER_COLOR_HEX = { red:"#f00", blue:"#00f" };
    var handleAbilityTileClick = function(){};
    // The REAL _growRangePath (normally in game-lobby.js) so the grow-range
    // preview computes against true range logic, not a stub.
    function _growRangePath(gs, growPos) {
      const boardSize = (gs.boardLayout || []).length || 48;
      const revealedGrows = new Set((gs.genuineRevealedGrows || []).filter((p) => p !== growPos));
      const path = [];
      for (let off = 1; off < boardSize; off++) {
        const p = (growPos + off) % boardSize;
        if (revealedGrows.has(p)) break;
        path.push(p);
      }
      return path;
    }
  `);
  for (let i = 0; i < 80; i++) {
    try { w.eval(boardSrc); break; }
    catch (e) {
      const m = /(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      w.eval(`var ${m[1]} = function(){};`);
    }
  }
  return w;
}

function drive(w, gs) {
  w.__g = gs;
  for (let i = 0; i < 80; i++) {
    try { w.eval(`gs = window.__g; renderBoard(window.__g);`); return; }
    catch (e) {
      const m = /(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      w.eval(`var ${m[1]} = function(){};`);
    }
  }
  throw new Error("drive: too many stubs");
}

// p1 (Alice) sits at tile 10 with an armed rune of value 3 -> walks 7-3 = 4 ->
// path tiles 11,12,13 (.armed-path) and 14 (.armed-path-dest).
function makeGs(extra) {
  const boardLayout = [], properties = [];
  for (let i = 0; i < 48; i++) {
    boardLayout.push({ type: "property", name: "F" + (i + 1), group: "farm" });
    properties.push({ id: i, name: "F" + (i + 1), group: "farm", price: i + 1,
      owner: null, bananaPile: 0 });
  }
  const revealed = Array.from({ length: 48 }, (_, i) => i);
  const mk = (id, name, color, pos, arm, cards) => ({ id, name, color, position: pos,
    money: 1000, bankrupt: false, ghost: false, startPickPending: false, properties: [],
    revealedTiles: revealed, cards: {}, bomb: 0, rollCards: cards || [], armedRoll: arm || null });
  const players = [
    mk("p1", "Alice", "red", 10, { value: 3 }, [3]),
    mk("p2", "Bob", "blue", 30, null, []),
  ];
  return Object.assign({
    state: "playing", turn: 3, boardLayout, properties, players,
    currentPlayer: players[0], gameMode: "classic", dice: [2, 3], diceRolled: false,
    bombs: [], log: [], diceMatchTiles: null, diceMatchGrownAmounts: null,
    diceMatchEarlyPickup: null, lastGrowFired: null, lastGrowActivated: null,
    revealAccepted: [], teams: null,
  }, extra || {});
}

const armedCount = (w) =>
  w.document.querySelectorAll("#board .armed-path, #board .armed-path-dest").length;
const destTile = (w) => {
  const el = w.document.querySelector("#board .armed-path-dest");
  return el ? el.getAttribute("data-tile") : null;
};
const growTile = (w) => {
  const el = w.document.querySelector("#board .armed-grow-tile");
  return el ? el.getAttribute("data-tile") : null;
};
const growTileCount = (w) => w.document.querySelectorAll("#board .armed-grow-tile").length;
const growPathTiles = (w) =>
  Array.from(w.document.querySelectorAll("#board .armed-grow-path"))
    .map((e) => Number(e.getAttribute("data-tile")))
    .sort((a, b) => a - b);

// Patch a gs to carry REVEALED grow tiles: GROW labeled 3 at tile 20, GROW
// labeled 5 at tile 30 (both revealed). Rune value 3 -> fires grow @20, whose
// clockwise range runs 21..29 (stops at the next revealed grow, tile 30).
function withGrows(gs) {
  gs.boardLayout[20] = { id: 20, type: "grow", growLabel: 3 };
  gs.boardLayout[30] = { id: 30, type: "grow", growLabel: 5 };
  gs.genuineRevealedGrows = [20, 30];
  return gs;
}
const range21to29 = Array.from({ length: 9 }, (_, i) => 21 + i);
const eqArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const w = makeWorld();

// 1. OWN turn, not walking, value held -> path painted (3 step + 1 dest = 4).
w.eval("window._tokenWalking = false;");
drive(w, makeGs());
assert(armedCount(w) === 4, `own turn: expected 4 armed tiles, got ${armedCount(w)}`);
assert(destTile(w) === "14", `own turn: dest should be tile 14, got ${destTile(w)}`);

// 2. OPPONENT's turn (currentPlayer = p2) -> NO path (phantom-on-opponents'-turns).
const g2 = makeGs();
g2.currentPlayer = g2.players[1];
drive(w, g2);
assert(armedCount(w) === 0, `opponent turn: expected 0 armed tiles, got ${armedCount(w)}`);

// 3. During a token WALK -> NO path (frozen board / unfrozen position mismatch).
w.eval("window._tokenWalking = true;");
drive(w, makeGs());
assert(armedCount(w) === 0, `walking: expected 0 armed tiles, got ${armedCount(w)}`);
w.eval("window._tokenWalking = false;");

// 4. Armed VALUE no longer held (rollCards lacks it) -> NO path (hold-check).
const g4 = makeGs();
g4.players[0].rollCards = [5]; // armedRoll.value 3 not present
drive(w, g4);
assert(armedCount(w) === 0, `stale value: expected 0 armed tiles, got ${armedCount(w)}`);

// 5. No arm at all -> NO path (baseline).
const g5 = makeGs();
g5.players[0].armedRoll = null;
drive(w, g5);
assert(armedCount(w) === 0, `no arm: expected 0 armed tiles, got ${armedCount(w)}`);

// 6. walkStepUpdate strips a previously-painted path (mid-walk clear).
//    Paint it on the armer's turn, then run a walk step and confirm it's gone.
drive(w, makeGs());
assert(armedCount(w) === 4, `pre-walk: expected 4 armed tiles, got ${armedCount(w)}`);
w.eval("window._tokenWalking = true;");
w.__g = makeGs();
w.eval(`gs = window.__g; walkStepUpdate(window.__g);`);
assert(armedCount(w) === 0, `walkStepUpdate should strip stale path, got ${armedCount(w)}`);
w.eval("window._tokenWalking = false;");

// ── GROW PREVIEW (the armed rune's grow tile + yellow range) ──────────────

// 7. OWN turn, value 3, grow @20 revealed -> grow tile 20 + range 21..29 painted.
drive(w, withGrows(makeGs()));
assert(growTileCount(w) === 1 && growTile(w) === "20",
  `grow tile: expected just tile 20, got count=${growTileCount(w)} tile=${growTile(w)}`);
assert(eqArr(growPathTiles(w), range21to29),
  `grow range: expected 21..29, got ${growPathTiles(w).join(",")}`);
assert(!growPathTiles(w).includes(20) && !growPathTiles(w).includes(30),
  "grow range must exclude the grow tile (20) and the next grow (30)");

// 8. OPPONENT's turn -> NO grow preview (same gate as the walk path).
const g8 = withGrows(makeGs());
g8.currentPlayer = g8.players[1];
drive(w, g8);
assert(growTileCount(w) === 0 && growPathTiles(w).length === 0,
  `opponent turn: expected no grow preview, got tile=${growTileCount(w)} path=${growPathTiles(w).length}`);

// 9. During a WALK -> NO grow preview.
w.eval("window._tokenWalking = true;");
drive(w, withGrows(makeGs()));
assert(growTileCount(w) === 0 && growPathTiles(w).length === 0,
  `walking: expected no grow preview, got tile=${growTileCount(w)} path=${growPathTiles(w).length}`);
w.eval("window._tokenWalking = false;");

// 10. The grow for the armed value is HIDDEN (fog) -> NO grow preview, but the
//     cyan WALK path still shows (the rune still moves).
const g10 = makeGs();
g10.boardLayout[20] = { id: 20, type: "hidden" }; // grow 3 not revealed to viewer
g10.boardLayout[30] = { id: 30, type: "grow", growLabel: 5 };
g10.genuineRevealedGrows = [30];
drive(w, g10);
assert(growTileCount(w) === 0 && growPathTiles(w).length === 0,
  `hidden grow: expected no grow preview, got tile=${growTileCount(w)} path=${growPathTiles(w).length}`);
assert(armedCount(w) === 4, `hidden grow: walk path should still show 4, got ${armedCount(w)}`);

// 11. walkStepUpdate strips the grow preview too (mid-walk phantom guard).
drive(w, withGrows(makeGs()));
assert(growTileCount(w) === 1 && growPathTiles(w).length === 9, "pre-walk grow preview present");
w.eval("window._tokenWalking = true;");
w.__g = withGrows(makeGs());
w.eval(`gs = window.__g; walkStepUpdate(window.__g);`);
assert(growTileCount(w) === 0 && growPathTiles(w).length === 0,
  `walkStepUpdate should strip grow preview, got tile=${growTileCount(w)} path=${growPathTiles(w).length}`);
w.eval("window._tokenWalking = false;");

// 12. Defensive gate: a grow present in boardLayout (type grow + growLabel) but
//     NOT in genuineRevealedGrows must NOT preview — the preview keys on the same
//     field the backend fires on (would never happen with correct redaction, but
//     guards against drift). The walk path still shows.
const g12 = withGrows(makeGs());
g12.genuineRevealedGrows = []; // grow @20 visible in layout but "not genuinely revealed"
drive(w, g12);
assert(growTileCount(w) === 0 && growPathTiles(w).length === 0,
  `gate: grow not in genuineRevealedGrows must not preview, got tile=${growTileCount(w)} path=${growPathTiles(w).length}`);
assert(armedCount(w) === 4, `gate: walk path still shows, got ${armedCount(w)}`);

console.log("==================================================");
console.log(`ARMED-PATH RESULTS: ${passed} passed, ${failed} failed`);
console.log("==================================================");
if (failed) process.exit(1);
