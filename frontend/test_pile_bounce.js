// Headless regression harness for the pile-box bounce/blink bug.
//
// Loads the REAL frontend/board.js into a jsdom window and drives renderBoard
// / walkStepUpdate through the render sequences that fire around turn-end.
// A CSS animation restarts iff (a) its element is re-inserted into the DOM, or
// (b) an animation-bearing class is removed and re-added. Both are observable
// without a real renderer, so the harness instruments exactly those two:
//
//   * any detach (remove/removeChild/replaceChild) of a live .banana-pile chip
//   * any classList.add of pile-grew / dice-match-grow / pile-bounce
//
// and asserts the invariant Mark asked for: a chip bounces ONCE, and ONLY when
// its on-screen banana count increases.

// Run from this directory: npm i --no-save jsdom && node test_pile_bounce.js
const fs = require("fs");
const path = require("path");
let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  console.error("jsdom not found - run: npm i --no-save jsdom (in frontend/)");
  process.exit(2);
}

const boardSrc = fs.readFileSync(path.join(__dirname, "board.js"), "utf8");

let passed = 0, failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); console.log("  FAIL: " + msg); }
}

// ---------------------------------------------------------------- DOM setup
function makeWorld() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="board"></div></body></html>`,
    { runScripts: "outside-only", pretendToBeVisual: true },
  );
  const w = dom.window;

  // ---- instrumentation -----------------------------------------------
  const events = []; // { type: 'detach'|'class-add', tile, token }
  w.__events = events;

  const isChip = (n) =>
    n && n.nodeType === 1 && n.classList && n.classList.contains("banana-pile");
  const tileOf = (n) => (n.getAttribute && n.getAttribute("data-tile")) || "?";

  const origRemove = w.Element.prototype.remove;
  w.Element.prototype.remove = function () {
    if (isChip(this) && this.isConnected)
      events.push({ type: "detach", tile: tileOf(this) });
    return origRemove.call(this);
  };
  const origRemoveChild = w.Node.prototype.removeChild;
  w.Node.prototype.removeChild = function (child) {
    if (isChip(child) && child.isConnected)
      events.push({ type: "detach", tile: tileOf(child) });
    return origRemoveChild.call(this, child);
  };

  const BOUNCE_RE = /^(pile-grew|dice-match-grow|pile-bounce)$/;
  const origAdd = w.DOMTokenList.prototype.add;
  w.DOMTokenList.prototype.add = function (...tokens) {
    for (const t of tokens) {
      if (BOUNCE_RE.test(t)) {
        // find owner element: jsdom token lists don't expose it, so chips tag
        // themselves (see below) — fall back to '?' for non-chip lists.
        const owner = this.__ownerTile != null ? this.__ownerTile : "?";
        const had = this.contains(t);
        if (!had) events.push({ type: "class-add", token: t, tile: owner });
      }
    }
    return origAdd.apply(this, tokens);
  };
  // Tag every chip's token list with its tile for the interceptor above.
  const origSetAttr = w.Element.prototype.setAttribute;
  w.Element.prototype.setAttribute = function (name, value) {
    const r = origSetAttr.call(this, name, value);
    if (name === "data-tile" && this.classList.contains("banana-pile")) {
      this.classList.__ownerTile = String(value);
    }
    return r;
  };

  // ---- globals board.js expects from the other modules ------------------
  const stub = () => {};
  w.eval(`
    var gs = null;
    var myId = "p1";
    var socket = { emit: function(){} };
    var gameId = "TEST";
    var bananaBurst = function(){};
    var _touchLandingFx = function(){};
    var SIMPLE_PLAYER_COLOR_HEX = { red: "#f00", blue: "#00f", green: "#0f0", yellow: "#ff0" };
    var route = function(){};
    var showScreen = function(){};
    var playSound = function(){};
    var _runGrowPulse = function(){};
    var _bounceFarmPile = function(){};
    var twemoji = undefined;
  `);

  // Load the real board.js, auto-stubbing any global the slice of code we
  // exercise still references (logged so unexpected names are visible).
  const stubbed = [];
  for (let i = 0; i < 60; i++) {
    try {
      w.eval(boardSrc);
      break;
    } catch (e) {
      const m = /^(?:ReferenceError:\s*)?(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      stubbed.push(m[1]);
      w.eval(`var ${m[1]} = function(){};`);
    }
  }
  w.__stubbedAtLoad = stubbed;

  return { dom, w, events };
}

// Drive a render, auto-stubbing late ReferenceErrors the same way.
function drive(w, fnName, gs) {
  w.eval("gs = window.__nextGs;");
  w.__nextGs = gs;
  w.eval("gs = window.__nextGs;");
  for (let i = 0; i < 60; i++) {
    try {
      w.__fnName = fnName;
      w.eval(`window["${fnName}"] ? window["${fnName}"](window.__nextGs) : ${fnName}(window.__nextGs);`);
      return;
    } catch (e) {
      const m = /^(?:ReferenceError:\s*)?(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      w.eval(`var ${m[1]} = function(){};`);
      (w.__stubbedLate = w.__stubbedLate || []).push(m[1]);
    }
  }
  throw new Error("drive(): too many stub iterations");
}

// ---------------------------------------------------------------- fixtures
function makeGs(piles, extra) {
  // piles: { tileIndex: { amount, owner } }
  const boardLayout = [];
  const properties = [];
  for (let i = 0; i < 48; i++) {
    boardLayout.push({ type: "property", name: "F" + (i + 1), group: "farm" });
    const p = piles[i] || {};
    properties.push({
      id: i,
      name: "F" + (i + 1),
      group: "farm",
      price: i + 1,
      owner: p.owner || null,
      bananaPile: p.amount || 0,
    });
  }
  const revealed = Array.from({ length: 48 }, (_, i) => i);
  return Object.assign(
    {
      state: "playing",
      turn: 3,
      boardLayout,
      properties,
      players: [
        mkPlayer("p1", "Alice", "red", 10),
        mkPlayer("p2", "Bob", "blue", 30),
      ],
      currentPlayer: null,
      gameMode: "classic",
      dice: [2, 3],
      diceRolled: false,
      log: [],
      diceMatchTiles: null,
      diceMatchGrownAmounts: null,
      diceMatchEarlyPickup: null,
      lastGrowFired: null,
      lastGrowActivated: null,
      revealAccepted: [],
      teams: null,
    },
    extra || {},
  );
  function mkPlayer(id, name, color, position) {
    return {
      id, name, color, position,
      money: 1000, bankrupt: false, ghost: false, startPickPending: false,
      properties: [], revealedTiles: revealed,
    };
  }
}

const chipsOnBoard = (w) =>
  Array.from(w.document.querySelectorAll("#board .banana-pile"));
const chipFor = (w, tile) =>
  w.document.querySelector(`#board .banana-pile[data-tile="${tile}"]`);
const drain = (events) => events.splice(0, events.length);
const countType = (evs, type, token) =>
  evs.filter((e) => e.type === type && (!token || e.token === token)).length;

// ================================================================ scenarios
console.log("\n=== H1. First render: chips appear, at most one bounce each ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } }));
  const chips = chipsOnBoard(w);
  assert(chips.length === 2, "H1: two pile chips rendered (got " + chips.length + ")");
  const adds = countType(events, "class-add");
  assert(adds <= 2, "H1: at most one bounce per new chip (got " + adds + " adds)");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("12"), "H1: chip shows its amount");
  if (w.__stubbedAtLoad.length || (w.__stubbedLate || []).length)
    console.log("  (auto-stubbed: " + w.__stubbedAtLoad.concat(w.__stubbedLate || []).join(", ") + ")");
}

console.log("\n=== H2. Turn-end barrage: 6 identical re-renders — zero restarts ===");
{
  const { w, events } = makeWorld();
  const gs = makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } });
  drive(w, "renderBoard", gs);
  const before = chipsOnBoard(w);
  drain(events);
  for (let i = 0; i < 6; i++) drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } }, { turn: 4 }));
  assert(countType(events, "detach") === 0,
    "H2: chips never detached across 6 turn-end re-renders (got " + countType(events, "detach") + ")");
  assert(countType(events, "class-add") === 0,
    "H2: no bounce class re-added when amounts unchanged (got " + countType(events, "class-add") + ")");
  const after = chipsOnBoard(w);
  assert(before.length === 2 && after.length === 2 && before[0] === after[0] && before[1] === after[1],
    "H2: the SAME chip nodes survive every re-render (identity preserved)");
}

console.log("\n=== H3. A pile actually grows: exactly one bounce, then silence ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" } }));
  drain(events);
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } })); // grew 12 -> 20
  assert(countType(events, "class-add", "pile-grew") === 1,
    "H3: pile-grew added exactly once on a real increase (got " + countType(events, "class-add", "pile-grew") + ")");
  assert(countType(events, "detach") === 0, "H3: growth never detaches the chip");
  drain(events);
  for (let i = 0; i < 4; i++) drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, { turn: 5 }));
  assert(countType(events, "class-add") === 0,
    "H3: follow-up renders at the same amount never re-bounce (got " + countType(events, "class-add") + ")");
  assert(chipFor(w, 5).textContent.includes("20"), "H3: chip shows the new amount");
}

console.log("\n=== H4. Regression: grow-unfreeze re-render with STALE diceMatchGrownAmounts ===");
{
  // This was cause #2: diceMatchGrownAmounts is only cleared on the NEXT roll,
  // so a grow-unfreeze render after the bounce already played used to re-flag
  // the tile (prev = amount - grown) and force-restart the animation.
  const { w, events } = makeWorld();
  const grown = makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5],
    diceMatchGrownAmounts: { 5: 8 },
  });
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" } })); // pre-grow
  drive(w, "renderBoard", grown); // the legit grow render (bounces once)
  drain(events);
  // turn-end: grow-unfreeze render fires with the SAME amounts + stale fields
  w.eval("window._growUnfreezeRender = true;");
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5],
    diceMatchGrownAmounts: { 5: 8 },
    turn: 4,
  }));
  assert(countType(events, "class-add") === 0,
    "H4: stale grow-unfreeze render does NOT re-bounce (got " + countType(events, "class-add") + ")");
  // and a second stale pass (route refresh) is quiet too
  w.eval("window._growUnfreezeRender = true;");
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5],
    diceMatchGrownAmounts: { 5: 8 },
    turn: 4,
  }));
  assert(countType(events, "class-add") === 0,
    "H4: repeated stale unfreeze renders stay quiet");
}

console.log("\n=== H5. Genuine unfreeze growth still bounces (fix didn't over-suppress) ===");
{
  // Land-on-grow with no pulse: piles stay frozen at the old value during the
  // walk, the unfreeze render is where the increase first shows -> must bounce.
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" } })); // pre-roll
  drain(events);
  // walk renders: piles frozen at pre-roll value
  w.eval("window._frozenBananaPiles = {5: 12}; window._tokenWalking = true;");
  drive(w, "walkStepUpdate", makeGs({ 5: { amount: 20, owner: "p2" } }));
  assert(countType(events, "class-add") === 0, "H5: frozen walk render doesn't bounce");
  assert(chipFor(w, 5).textContent.includes("12"), "H5: chip stays at frozen value mid-walk");
  drain(events);
  // unfreeze: authoritative amount appears for the first time
  w.eval("window._frozenBananaPiles = null; window._tokenWalking = false; window._growUnfreezeRender = true;");
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5],
    diceMatchGrownAmounts: { 5: 8 },
  }));
  assert(countType(events, "class-add", "pile-grew") + countType(events, "class-add", "dice-match-grow") === 1,
    "H5: the unfreeze render that first SHOWS the growth bounces exactly once");
  assert(chipFor(w, 5).textContent.includes("20"), "H5: chip shows the grown amount");
}

console.log("\n=== H6. walkStepUpdate barrage never restarts chips ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } }));
  const before = chipsOnBoard(w);
  drain(events);
  for (let i = 0; i < 8; i++)
    drive(w, "walkStepUpdate", makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } }));
  assert(countType(events, "detach") === 0, "H6: no chip detach across 8 walk steps");
  assert(countType(events, "class-add") === 0, "H6: no bounce class across 8 walk steps");
  const after = chipsOnBoard(w);
  assert(before[0] === after[0] && before[1] === after[1], "H6: same nodes after the walk");
}

console.log("\n=== H7. Collected pile: chip is removed (the one legal detach) ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" }, 9: { amount: 7, owner: "p1" } }));
  drain(events);
  drive(w, "renderBoard", makeGs({ 9: { amount: 7, owner: "p1" } })); // tile 5 collected
  assert(chipsOnBoard(w).length === 1, "H7: collected pile's chip is gone");
  assert(chipFor(w, 5) === null, "H7: tile 5 chip removed");
  assert(chipFor(w, 9) !== null, "H7: tile 9 chip survives untouched");
  assert(countType(events, "class-add") === 0, "H7: no bounce on a decrease");
}

console.log("\n=== H8. Shrink then regrow bounces again (prevShown follows decreases) ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }));
  drive(w, "renderBoard", makeGs({ 5: { amount: 3, owner: "p2" } })); // partial... (e.g. new small pile after collect)
  drain(events);
  drive(w, "renderBoard", makeGs({ 5: { amount: 9, owner: "p2" } })); // grows again
  assert(countType(events, "class-add", "pile-grew") === 1,
    "H8: regrowth after shrinking bounces exactly once (got " + countType(events, "class-add", "pile-grew") + ")");
}

console.log("\n=== H9. Full dice-match turn: bounce once at reveal, quiet through walk + turn-end ===");
{
  const { w, events } = makeWorld();
  const grownGs = () => makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5],
    diceMatchGrownAmounts: { 5: 8 },
  });
  drive(w, "renderBoard", makeGs({ 5: { amount: 12, owner: "p2" } })); // pre-roll
  drain(events);
  // dice settle: frozen piles + dice-match reveal render (game-screen.js:276-280)
  w.eval("window._frozenBananaPiles = {5: 12}; window._tokenWalking = true; window._diceMatchUnfrozen = true; window._diceMatchStealRender = true;");
  drive(w, "renderBoard", grownGs());
  assert(countType(events, "class-add", "dice-match-grow") === 1,
    "H9: dice-match reveal bounces exactly once (got " + countType(events, "class-add", "dice-match-grow") + ")");
  assert(chipFor(w, 5).textContent.includes("20"), "H9: chip shows frozen+grown immediately");
  drain(events);
  // token walks: several walkStepUpdates
  for (let i = 0; i < 5; i++) drive(w, "walkStepUpdate", grownGs());
  assert(countType(events, "class-add") === 0, "H9: walk renders stay quiet");
  assert(countType(events, "detach") === 0, "H9: walk renders never detach the chip");
  drain(events);
  // walk end: unfreeze + route refresh + next-turn update (all full renders)
  w.eval("window._frozenBananaPiles = null; window._tokenWalking = false; window._diceMatchUnfrozen = false;");
  drive(w, "renderBoard", grownGs());
  drive(w, "renderBoard", grownGs());
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5], diceMatchGrownAmounts: { 5: 8 }, turn: 4,
  }));
  assert(countType(events, "class-add") === 0,
    "H9: unfreeze + route + next-turn renders never re-bounce (got " + countType(events, "class-add") + ")");
  assert(countType(events, "detach") === 0, "H9: turn-end renders never detach the chip");
}

console.log("\n=== H10. Multi-pile independence: only the grown piles bounce ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({
    5: { amount: 12, owner: "p2" },
    9: { amount: 7, owner: "p1" },
    20: { amount: 33, owner: "p2" },
  }));
  drain(events);
  drive(w, "renderBoard", makeGs({
    5: { amount: 17, owner: "p2" },   // grew
    9: { amount: 7, owner: "p1" },    // unchanged
    20: { amount: 40, owner: "p2" },  // grew
  }));
  const adds = events.filter((e) => e.type === "class-add");
  assert(adds.length === 2, "H10: exactly the two grown piles bounce (got " + adds.length + ")");
  const tiles = new Set(adds.map((e) => e.tile));
  assert(tiles.has("5") && tiles.has("20") && !tiles.has("9"),
    "H10: bounces land on tiles 5 and 20, never the unchanged 9");
}

console.log("\n=== H11. Blink recreation: removed + re-added at same amount never re-bounces ===");
{
  // A transient render that drops a pile (stale freeze snapshot, overlapped
  // walk timers) removes its chip; the next render brings it back. The
  // recreated chip must inherit its "already bounced at this amount" memory —
  // before the fix it reset prevShown to 0 and replayed the grow bounce.
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } })); // grown earlier
  drive(w, "renderBoard", makeGs({})); // blink: pile momentarily absent
  assert(chipFor(w, 5) === null, "H11: blink render removes the chip");
  drain(events);
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } })); // it comes back
  assert(chipFor(w, 5) !== null && chipFor(w, 5).textContent.includes("20"),
    "H11: chip reappears at its amount");
  assert(countType(events, "class-add") === 0,
    "H11: a same-amount blink reappearance never re-bounces (got " + countType(events, "class-add") + ")");
}

console.log("\n=== H12. Blink + real growth: recreated chip still bounces for the increase ===");
{
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }));
  drive(w, "renderBoard", makeGs({})); // blink
  drain(events);
  drive(w, "renderBoard", makeGs({ 5: { amount: 30, owner: "p2" } })); // back AND grown
  assert(countType(events, "class-add", "pile-grew") === 1,
    "H12: reappearing at a HIGHER amount bounces exactly once (got " + countType(events, "class-add", "pile-grew") + ")");
  assert(chipFor(w, 5).textContent.includes("30"), "H12: chip shows the grown amount");
}

console.log("\n=== H13. Next-roll gap: gate fields nulled + stale freeze never drops revealed piles ===");
{
  // Live-game forensics: a grow revealed piles during turn A's freeze
  // (frozenVal 0 + grownAmount, gated by gs.diceMatchTiles). Turn B's roll
  // NULLS diceMatchTiles/diceMatchGrownAmounts server-side, and its update can
  // render BEFORE the dice handler installs the fresh freeze — the gate fails,
  // frozenVal is 0, and every revealed pile vanished for one frame.
  // _pulseRevealedAmounts must hold them on screen through that gap.
  const { w, events } = makeWorld();
  drive(w, "renderBoard", makeGs({})); // pre-turn: no piles anywhere
  // Turn A: roll freezes (empty pre-roll snapshot), dice-match grows tile 5
  w.eval("window._frozenBananaPiles = {}; window._tokenWalking = true; window._diceMatchUnfrozen = true; window._diceMatchStealRender = true;");
  const grownGs = makeGs({ 5: { amount: 20, owner: "p2" } }, {
    diceMatchTiles: [5], diceMatchGrownAmounts: { 5: 20 },
  });
  drive(w, "renderBoard", grownGs); // reveal render: chip appears at 20
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"), "H13: pile revealed at 20");
  drain(events);
  // Turn A walk ends, _tokenWalking false but unfreeze timer hasn't fired yet;
  // turn B's ROLL update arrives: diceMatchTiles nulled, freeze still stale.
  w.eval("window._tokenWalking = false;");
  drive(w, "renderBoard", makeGs({ 5: { amount: 20, owner: "p2" } }, {
    turn: 4, diceRolled: true, diceMatchTiles: null, diceMatchGrownAmounts: null,
  }));
  assert(countType(events, "detach") === 0,
    "H13: revealed pile survives the gap render (got " + countType(events, "detach") + " detaches)");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"), "H13: chip still shows 20");
  assert(countType(events, "class-add") === 0, "H13: and it does not re-bounce");
  // Dice handler then installs the fresh freeze + clears the memory: still stable.
  w.eval("window._frozenBananaPiles = {5: 20}; window._tokenWalking = true; window._pulseRevealedAmounts = null;");
  drive(w, "walkStepUpdate", makeGs({ 5: { amount: 20, owner: "p2" } }, { turn: 4 }));
  assert(countType(events, "detach") === 0, "H13: stable through turn B's re-freeze");
  assert(chipFor(w, 5) && chipFor(w, 5).textContent.includes("20"), "H13: chip at 20 after re-freeze");
}

console.log("\n" + "=".repeat(50));
console.log(`HARNESS RESULTS: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));
if (failures.length) {
  console.log("\nFailed:");
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
