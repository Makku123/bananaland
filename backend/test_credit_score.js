// Credit Score (liar's dice) mechanics test suite.
// Covers the hidden-cup roll → claim → walk → accuse pipeline, the credit
// tiers, the mode-derived pile collection, grows off the walked number, and
// the reworked Super Banana (rich-lander win, rich-cross credit, auto-win).
const { MonkeyBusinessGame } = require("./gameLogic");

let passed = 0;
let failed = 0;
const failures = [];

// Deterministic RNG so the board shuffle (which uses Math.random) is
// reproducible across runs (same seeding trick as test_game.js).
(function seedRandom() {
  let s = 0x12345678 >>> 0;
  Math.random = function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  FAIL: ${msg}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// Helper: create a game with N players and start it. Players are parked on
// tile 0 with start picks skipped so tests can roll immediately.
function createStartedGame(n = 2, opts = {}) {
  const game = new MonkeyBusinessGame(
    "TEST",
    opts.maxPlayers || n,
    opts.startingMoney || 5000,
    opts.gameMode || "classic",
    undefined,
    true,
  );
  if (opts.dodecahedron !== undefined) game.dodecahedron = opts.dodecahedron;
  if (opts.creditStart !== undefined) game.creditStart = opts.creditStart;
  // Timers off by default: tests drive the claim/accuse windows explicitly.
  game.noAuctionTimer = opts.noAuctionTimer !== undefined ? opts.noAuctionTimer : true;
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push(game.addPlayer(`p${i}`, `Player${i}`));
  }
  game.startGame("p0");
  game.completeReveal();
  if (!opts.skipStartPick) {
    for (const p of game.players) {
      p.startPickPending = false;
      p.position = 0;
    }
    game.diceRolled = false;
  }
  return { game, players: game.players };
}

// Roll for `id`, then FORCE the hidden dice to a known value (the tier /
// redaction logic ran with the real RNG; only the faces/total are pinned).
function forceRoll(game, id, d1, d2) {
  const r = game.rollDice(id);
  if (!r) return r;
  const pa = game.pendingAction;
  pa.rolledDice = d2 == null ? [d1] : [d1, d2];
  pa.rolledTotal = d2 == null ? d1 : d1 + d2;
  game.dice = pa.rolledDice.slice();
  return r;
}

// Resolve an open accuse window with every voter answering `accuseMap[id]`
// (missing ids vote "no"), then end the turn.
function finishTurn(game, id) {
  if (game.accuse) {
    for (const oid of Object.keys(game.accuse.votes)) {
      if (!game.accuse.votes[oid].answered) game.submitAccuse(oid, false);
    }
  }
  return game.endTurn(id);
}

function findSB(game) {
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") return pos;
  }
  return -1;
}

// A plain farm (group "farm") satisfying `pred(pos)` (defaults to any).
function findFarm(game, pred) {
  for (const [pos, prop] of game.properties) {
    if (prop.group === "farm" && (!pred || pred(pos))) return pos;
  }
  return -1;
}

// ────────────────────────────────────────────────────────────────────
section("1. creditStart seeding + public credit in getState");
{
  const { game, players } = createStartedGame(2, { creditStart: 5 });
  assert(players[0].credit === 5, "p0 credit seeded to creditStart (5)");
  assert(players[1].credit === 5, "p1 credit seeded to creditStart (5)");
  const st = game.getState("p0");
  assert(st.creditStart === 5, "creditStart ships in getState");
  const p1v = st.players.find((p) => p.id === "p1");
  assert(p1v && p1v.credit === 5, "OPPONENT credit is PUBLIC in getState");
  const stOther = game.getState("p1");
  const p0v = stOther.players.find((p) => p.id === "p0");
  assert(p0v && p0v.credit === 5, "credit public from the other viewer too");
  game.cleanup();

  // Default + clamp via updateSettings (lobby).
  const g2 = new MonkeyBusinessGame("T2", 2, 5000, "classic", undefined, true);
  assert(g2.creditStart === 7, "creditStart defaults to 7");
  g2.addPlayer("a", "A");
  g2.addPlayer("b", "B");
  g2.updateSettings("a", { creditStart: 999 });
  assert(g2.creditStart === 20, "updateSettings clamps creditStart to 20");
  assert(g2.players[0].credit === 20, "lobby players re-seeded on knob change");
  g2.updateSettings("a", { creditStart: 3 });
  assert(g2.creditStart === 3, "updateSettings accepts in-range creditStart");
}

// ────────────────────────────────────────────────────────────────────
section("2. Cup tier: dice hidden from opponents, visible to roller");
{
  const { game } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 3, 4);
  assert(game.turnPhase === "claiming", "turnPhase is 'claiming' after a roll");
  assert(game.pendingAction.cupPublic === false, "credit 7 >= 1 solvent opponent → cup kept");

  const stRoller = game.getState("p0");
  assert(
    Array.isArray(stRoller.dice) && stRoller.dice[0] === 3 && stRoller.dice[1] === 4,
    "roller sees their real dice",
  );
  assert(stRoller.diceHidden === false, "roller's view is not flagged hidden");
  assert(stRoller.pendingAction.rolledTotal === 7, "roller sees rolledTotal");

  const stOpp = game.getState("p1");
  assert(Array.isArray(stOpp.dice) && stOpp.dice.length === 0, "opponent gets dice: []");
  assert(stOpp.diceHidden === true, "opponent gets diceHidden: true");
  assert(stOpp.pendingAction.rolledTotal === undefined, "no rolledTotal leaked to opponent");
  assert(stOpp.pendingAction.rolledDice === undefined, "no rolledDice leaked to opponent");
  assert(stOpp.pendingAction.cupPublic === false, "cupPublic ships to opponents");
  assert(stOpp.pendingAction.playerId === "p0", "pendingAction owner ships to opponents");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("3. The claim walks the CLAIMED steps (not the roll)");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 3, 4); // real total 7
  assert(game.submitClaim("p0", 13) === false, "claim > 12 rejected");
  assert(game.submitClaim("p0", 0) === false, "claim < 1 rejected");
  assert(game.submitClaim("p0", 5), "claim 5 accepted (cup tier bluffs are free)");
  assert(players[0].position === 5, "token walked the CLAIMED 5, not the rolled 7");
  assert(players[0].credit === 7, "cup-tier bluff costs no credit");
  assert(game.diceRolled === true, "diceRolled true once the claim commits");
  assert(game.turnPhase === "accusing", "accuse window opens after the walk");
  assert(
    game.lastMove &&
      game.lastMove.playerId === "p0" &&
      game.lastMove.steps === 5 &&
      game.lastMove.mode === "turtle",
    "lastMove records {playerId, steps, mode} publicly",
  );
  assert(game.submitClaim("p0", 6) === false, "second claim rejected (already committed)");
  assert(finishTurn(game, "p0"), "turn ends after the accuse window resolves");

  // steps=null walks the TRUE roll.
  forceRoll(game, "p1", 4, 5); // 9
  assert(game.submitClaim("p1", null), "claim null (walk the true roll) accepted");
  assert(players[1].position === 9, "null claim walks the real total");
  assert(game.lastMove.mode === "rabbit", "9 steps is a rabbit move");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("4. Truthful + accused → each accuser -1, roller safe");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 3, 4); // 7
  game.submitClaim("p0", 7); // the truth
  assert(game.turnPhase === "accusing", "accusing phase open");
  assert(game.submitAccuse("p1", true), "p1 accuses");
  assert(players[1].credit === 6, "wrong accuser loses 1 credit");
  assert(players[0].credit === 7, "truthful roller unchanged");
  const r = game.lastAccuseResult;
  assert(r && r.truthful === true, "lastAccuseResult.truthful");
  assert(r.actualTotal === 7 && r.claim === 7, "accused → actualTotal revealed");
  assert(
    r.accusers.length === 1 && r.accusers[0].id === "p1" && r.accusers[0].delta === -1,
    "accusers[] carries the per-accuser delta",
  );
  assert(r.deltas && r.deltas.p1 === -1 && r.deltas.p0 === undefined, "deltas map correct");
  assert(game.turnPhase === "resolved", "turnPhase resolved after accusation");
  // The cup lifted: everyone can see the dice now.
  const stOpp = game.getState("p1");
  assert(stOpp.dice.length === 2 && stOpp.diceHidden === false, "accusation reveals the dice publicly");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("5. Claim 1 on a rolled 7 is TRUTHFUL (the free 7→1 right)");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 5, 2); // 7
  assert(game.submitClaim("p0", 1), "claim 1 accepted on a rolled 7");
  assert(players[0].position === 1, "walked 1 (turtle)");
  assert(players[0].credit === 7, "the 7→1 walk is free");
  game.submitAccuse("p1", true);
  assert(game.lastAccuseResult.truthful === true, "claim 1 on a real 7 counts as TRUTH");
  assert(players[1].credit === 6, "accuser of the 7→1 truth loses 1");
  assert(players[0].credit === 7, "roller unharmed");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("6. Lie + accused → each accuser +1, roller -1 FLAT (rule change 2026-07-03; floor 0)");
{
  const { game, players } = createStartedGame(3);
  game._processLanding = () => {};
  forceRoll(game, "p0", 2, 3); // real 5
  game.submitClaim("p0", 9); // a lie
  game.submitAccuse("p1", true);
  game.submitAccuse("p2", true);
  assert(players[1].credit === 8, "accuser #1 gains 1");
  assert(players[2].credit === 8, "accuser #2 gains 1");
  assert(players[0].credit === 6, "roller loses a FLAT 1 even with 2 accusers (7-1)");
  const r = game.lastAccuseResult;
  assert(r && r.truthful === false && r.actualTotal === 5 && r.claim === 9, "lie revealed");
  assert(r.deltas.p0 === -1 && r.deltas.p1 === 1 && r.deltas.p2 === 1, "deltas cover roller (flat -1) + accusers");

  // Credit floor 0 (the _adjustCredit clamp).
  players[0].credit = 2;
  const applied = game._adjustCredit(players[0], -5);
  assert(players[0].credit === 0, "credit floors at 0");
  assert(applied === -2, "_adjustCredit reports the APPLIED delta");
  assert(game._adjustCredit(players[0], -1) === 0 && players[0].credit === 0, "no negative credit ever");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("7. Unaccused lie: no deltas, actualTotal NEVER revealed");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 3, 4); // 7
  game.submitClaim("p0", 12); // a big lie
  game.submitAccuse("p1", false); // nobody accuses
  assert(players[0].credit === 7 && players[1].credit === 7, "no credit changes without accusation");
  assert(game.lastAccuseResult === null, "no lastAccuseResult without accusation");
  assert(game.turnPhase === "resolved", "resolved");
  const stOpp = game.getState("p1");
  assert(stOpp.dice.length === 0 && stOpp.diceHidden === true, "dice STAY hidden after an unaccused resolution");
  assert(JSON.stringify(stOpp).indexOf('"rolledTotal"') === -1, "no rolledTotal anywhere in the opponent state");
  const stRoller = game.getState("p0");
  assert(stRoller.dice.length === 2, "roller still sees their own dice");
  game.endTurn("p0");
  const stAfter = game.getState("p1");
  assert(stAfter.dice.length === 0 && stAfter.diceHidden === true, "still hidden after the turn ends");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("8. cup tier: hidden while credit >= 1; PUBLIC only at strictly 0 (rule change 2026-07-03)");
{
  const { game, players } = createStartedGame(3);
  game._processLanding = () => {};
  // Credit 1 KEEPS the cup now — even against 2 solvent opponents.
  players[0].credit = 1;
  forceRoll(game, "p0", 2, 3);
  assert(game.pendingAction.cupPublic === false, "credit 1 → cup KEPT (only 0 rolls in the open)");
  let stOpp = game.getState("p1");
  assert(stOpp.diceHidden === true && stOpp.dice.length === 0, "cup roll hidden from opponents at credit 1");
  game.submitClaim("p0", null); // walk the truth
  // Cupped roll → an accuse window opens (both opponents solvent).
  assert(game.turnPhase === "accusing" && game.accuse !== null, "accuse window opens on a cup roll");
  game.submitAccuse("p1", false);
  game.submitAccuse("p2", false);
  game.endTurn("p0");

  // Strictly 0 credit → public.
  players[1].credit = 0;
  forceRoll(game, "p1", 2, 2);
  assert(game.pendingAction.cupPublic === true, "credit 0 → PUBLIC roll");
  stOpp = game.getState("p2");
  assert(stOpp.dice.length === 2 && stOpp.diceHidden === false, "public-tier dice visible to opponents");
  assert(stOpp.pendingAction.rolledTotal === 4, "public-tier pendingAction ships the roll");
  game.submitClaim("p1", null);
  assert(game.turnPhase === "resolved" && game.accuse === null, "NO accuse window on a public roll");
  finishTurn(game, "p1");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("9. Claims are free while cupped; alternatives REJECTED at 0 credit");
{
  const { game, players } = createStartedGame(3);
  game._processLanding = () => {};
  // Credit 1 (cupped): an alternative claim is FREE — no paid-alternative tier
  // exists anymore (the pay-1 rule died with the solvent-opponent formula).
  players[0].credit = 1;
  forceRoll(game, "p0", 2, 3); // real 5
  assert(game.pendingAction.cupPublic === false, "credit 1 rolls under the cup");
  assert(game.submitClaim("p0", 8), "alternative claim accepted under the cup");
  assert(players[0].credit === 1, "cupped alternative claim costs NOTHING");
  assert(players[0].position === 8, "walked the claimed alternative");
  assert(game.turnPhase === "accusing", "cupped lie opens the accuse window");
  game.submitAccuse("p1", false);
  game.submitAccuse("p2", false);
  game.endTurn("p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  game.submitAccuse("p0", false);
  game.submitAccuse("p2", false);
  finishTurn(game, "p1");
  forceRoll(game, "p2", 3, 4);
  game.submitClaim("p2", null);
  game.submitAccuse("p0", false);
  game.submitAccuse("p1", false);
  finishTurn(game, "p2");

  // p0 drained to 0 credit: public + exact roll only.
  players[0].credit = 0;
  forceRoll(game, "p0", 2, 3); // real 5
  assert(game.pendingAction.cupPublic === true, "0 credit → public");
  assert(game.submitClaim("p0", 9) === false, "alternative REJECTED at 0 credit");
  assert(players[0].credit === 0, "no credit charged on a rejected claim");
  assert(game.submitClaim("p0", 5), "the exact roll is always allowed");
  assert(players[0].credit === 0, "walking the truth is free");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("10. The 7→1 option is FREE even at 0 credit");
{
  const { game, players } = createStartedGame(3);
  game._processLanding = () => {};
  players[0].credit = 0;
  forceRoll(game, "p0", 3, 4); // real 7
  assert(game.pendingAction.cupPublic === true, "0 credit → public tier");
  assert(game.submitClaim("p0", 1), "7→1 accepted at 0 credit");
  assert(players[0].credit === 0, "7→1 costs nothing");
  assert(players[0].position === 1 && game.lastMove.mode === "turtle", "walked 1 as a turtle");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("11. Turtle vs rabbit pile collection + BOTH modes land-steal");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  const F = findFarm(game);
  const prop = game.properties.get(F);

  // OWN farm, TURTLE cross: pile stays.
  prop.owner = "p0";
  players[0].properties.push(F);
  prop.bananaPile = 100;
  players[0].position = (F - 2 + game.boardSize) % game.boardSize;
  let money = players[0].money;
  forceRoll(game, "p0", 1, 1);
  game.submitClaim("p0", 4); // turtle, crosses F at step 2
  assert(prop.bananaPile === 100, "TURTLE does NOT collect own pile by crossing");
  assert(players[0].money === money, "no money from the turtle cross");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // OWN farm, RABBIT cross: pile collected.
  players[0].position = (F - 2 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 4, 4);
  game.submitClaim("p0", 8); // rabbit, crosses F
  assert(prop.bananaPile === 0, "RABBIT collects own pile on a cross");
  assert(players[0].money === money + 100, "rabbit cross banked the pile");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // OWN farm, TURTLE landing: collected (land-only rule).
  prop.bananaPile = 60;
  players[0].position = (F - 3 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 1, 1);
  game.submitClaim("p0", 3); // turtle, LANDS on F
  assert(prop.bananaPile === 0 && players[0].money === money + 60, "TURTLE collects own pile on LANDING");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // OPPONENT pile: TURTLE landing STEALS it (the old no-land-steal rule is gone).
  prop.owner = "p1";
  players[0].properties = players[0].properties.filter((x) => x !== F);
  players[1].properties.push(F);
  prop.bananaPile = 50;
  players[0].position = (F - 3 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 1, 1);
  game.submitClaim("p0", 3); // turtle LANDS on the opponent pile
  assert(prop.bananaPile === 0, "TURTLE land-steals an opponent pile");
  assert(players[0].money === money + 50, "stolen bananas banked");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // OPPONENT pile: crossing steals NOTHING (both modes are land-steal-only).
  prop.bananaPile = 40;
  players[0].position = (F - 2 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 4, 4);
  game.submitClaim("p0", 8); // rabbit CROSSES the opponent pile
  assert(prop.bananaPile === 40, "crossing an opponent pile steals nothing (rabbit too)");
  assert(players[0].money === money, "no money from the cross");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // UNCLAIMED pile: land-only for both modes.
  prop.owner = null;
  players[1].properties = players[1].properties.filter((x) => x !== F);
  prop.bananaPile = 70;
  players[0].position = (F - 2 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 4, 4);
  game.submitClaim("p0", 8); // crosses the unclaimed pile
  assert(prop.bananaPile === 70, "unclaimed pile not collected on a cross");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");
  players[0].position = (F - 2 + game.boardSize) % game.boardSize;
  money = players[0].money;
  forceRoll(game, "p0", 1, 1);
  game.submitClaim("p0", 2); // turtle LANDS on the unclaimed pile
  assert(prop.bananaPile === 0 && players[0].money === money + 70, "unclaimed pile collected on LANDING");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("12. GROW fires at the WALKED number (<=6, 1×); rabbit never fires");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  // Pick a grow tile, note its label, and reveal it.
  const growEntries = [...game.growTileLabels.entries()];
  const [growPos, label] = growEntries[0];
  players[1].revealedTiles.add(growPos); // any player's reveal is global
  // Give p0 a revealed farm far from the walking path (in range: with only one
  // grow revealed, the range spans the whole board minus the grow tile itself).
  const F = findFarm(game, (pos) => pos >= 20 && pos !== growPos);
  const prop = game.properties.get(F);
  prop.owner = "p0";
  players[0].properties.push(F);
  players[0].revealedTiles.add(F);
  players[0].position = 0;

  // RABBIT walk first: no grow can fire (grows are labelled 1..6).
  forceRoll(game, "p0", 4, 4);
  game.submitClaim("p0", 8);
  assert(prop.bananaPile === 0, "a rabbit walk (8) never fires a grow");
  finishTurn(game, "p0");
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // TURTLE walk of exactly the grow label: fires at 1×.
  players[0].position = (game.boardSize - 12) % game.boardSize; // path clear of F
  forceRoll(game, "p0", 2, 5); // real 7 → the claim is what matters
  game.submitClaim("p0", label); // walked number == grow label (turtle)
  assert(
    prop.bananaPile === prop.price,
    `walking ${label} fired GROW ${label} at exactly 1× (pile ${prop.bananaPile} == yield ${prop.price})`,
  );
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("13. Super Banana: rich lander must PROVE the roll (rule 2026-07-03)");
{
  // (a) LEGIT landing — claim == real roll → cup lifts, WIN.
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = game.superBananaPrice; // exactly rich
  players[0].position = (sbPos - 5 + game.boardSize) % game.boardSize;
  forceRoll(game, "p0", 2, 3); // real 5
  game.submitClaim("p0", 5); // lands EXACTLY on the SB, truthfully
  assert(players[0].position === sbPos, "landed on the Super Banana");
  assert(game.superBananaWin && game.superBananaWin.playerId === "p0", "LEGIT rich landing wins");
  assert(game.superBananaWinnerId === "p0", "superBananaWinnerId records the winner");
  assert(players[0].money === game.superBananaPrice + 200, "landing +200 still paid (win checked pre-bonus)");
  assert(game.accuse === null, "no accuse window on the SB landing (cup lifted itself)");
  assert(game.turnPhase === "resolved" && game.pendingAction === null, "turn resolved on the spot");
  const rec = game.lastAccuseResult;
  assert(rec && rec.sbLanding === true && rec.truthful === true && rec.actualTotal === 5,
    "SB reveal record shipped (sbLanding, truthful, real roll)");
  assert(game.diceHidden === false, "the winning cup is LIFTED for everyone");
  assert(game.d12OwnerId === "p0", "first SB lander still gets hexed (d12 originates)");
  game.cleanup();
}
{
  // (b) BLUFFED landing — claim != roll → cup STILL lifts, NO win, +1 credit,
  // accuse window skipped, play continues.
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = game.superBananaPrice + 5000; // rich
  players[0].position = (sbPos - 9 + game.boardSize) % game.boardSize;
  forceRoll(game, "p0", 2, 3); // real 5
  game.submitClaim("p0", 9); // a LIE that lands on the SB
  assert(players[0].position === sbPos, "bluffed walk landed on the Super Banana");
  assert(!game.superBananaWin && game.state === "playing", "bluffed landing does NOT win");
  assert(players[0].credit === 8, "+1 Credit consolation for the failed landing (7+1)");
  assert(game.diceHidden === false, "the cup lifts anyway — the real roll is public");
  const rec = game.lastAccuseResult;
  assert(rec && rec.sbLanding === true && rec.truthful === false &&
    rec.actualTotal === 5 && rec.claim === 9, "SB reveal record shows the bluff");
  assert(rec.deltas.p0 === 1, "record carries the +1 consolation delta");
  assert(game.accuse === null && game.turnPhase === "resolved", "accuse window SKIPPED (already revealed)");
  finishTurn(game, "p0");
  assert(game.getCurrentPlayer().id === "p1", "play continues to the next player");
  game.cleanup();
}
{
  // (c) 7→1 landing — rolled 7, walked the free 1 onto the SB → counts as LEGIT.
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = game.superBananaPrice;
  players[0].position = (sbPos - 1 + game.boardSize) % game.boardSize;
  forceRoll(game, "p0", 3, 4); // real 7
  game.submitClaim("p0", 1); // the standing free 7→1, landing on the SB
  assert(players[0].position === sbPos, "walked 1 onto the Super Banana");
  assert(game.superBananaWin && game.superBananaWin.playerId === "p0",
    "7→1 is an honest move — the landing WINS");
  assert(game.lastAccuseResult && game.lastAccuseResult.truthful === true, "reveal shows the honest 7");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("14. Super Banana: broke lander gets +200, NO win, play continues");
{
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = 500; // broke
  players[0].position = (sbPos - 4 + game.boardSize) % game.boardSize;
  forceRoll(game, "p0", 2, 2); // real 4
  game.submitClaim("p0", 4); // lands on the SB
  assert(players[0].money === 700, "broke lander pockets +200");
  assert(!game.superBananaWin && game.state === "playing", "no win for a broke lander");
  assert(players[0].credit === 7, "broke lander with credit >= 1 gets NO mercy credit");
  assert(game.diceHidden === true, "a BROKE lander's cup stays DOWN (nothing to prove)");
  assert(!game.lastAccuseResult, "no forced reveal for a broke lander");
  assert(game.turnPhase === "accusing", "a non-winning move still opens the accuse window");
  finishTurn(game, "p0");
  assert(game.getCurrentPlayer().id === "p1", "play continues to the next player");
  game.cleanup();
}
{
  // MERCY CREDIT (rule 2026-07-03): broke + STRICTLY 0 credit → +1 mercy
  // credit alongside the +200 (their next roll goes back under the cup).
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = 500; // broke
  players[0].credit = 0; // and drained → public tier
  players[0].position = (sbPos - 4 + game.boardSize) % game.boardSize;
  forceRoll(game, "p0", 2, 2); // real 4, rolled in the open
  assert(game.pendingAction.cupPublic === true, "0 credit rolls in the open");
  game.submitClaim("p0", 4); // exact roll lands on the SB
  assert(players[0].money === 700, "mercy lander still pockets the +200");
  assert(players[0].credit === 1, "broke + 0 credit → +1 MERCY credit");
  assert(!game.superBananaWin && game.state === "playing", "mercy landing never wins");
  game.endTurn("p0");
  // Follow-up turns don't need real landings (a farm auction would block endTurn).
  game._processLanding = () => {};
  // Next roll goes back under the cup (credit 1 >= 1).
  forceRoll(game, "p1", 3, 3);
  game.submitClaim("p1", null);
  game.submitAccuse("p0", false);
  finishTurn(game, "p1");
  forceRoll(game, "p0", 2, 3);
  assert(game.pendingAction.cupPublic === false, "the mercy credit restores the cup next roll");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("15. Rich SB cross: +1 credit, only when revealed, repeatable; broke-cross latch kept");
{
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  const from = (sbPos - 2 + game.boardSize) % game.boardSize;
  players[0].money = 20000; // rich

  // UNREVEALED cross: nothing fires off a fogged SB.
  players[0].position = (sbPos + 2) % game.boardSize; // as-if walked past it
  game._resolveSuperBananaCross(players[0], from);
  assert(players[0].credit === 7, "crossing a HIDDEN SB grants no credit");

  // Revealed cross: +1 credit, every lap.
  players[1].revealedTiles.add(sbPos); // global reveal state
  game._resolveSuperBananaCross(players[0], from);
  assert(players[0].credit === 8, "rich cross of the revealed SB grants +1 credit");
  game._resolveSuperBananaCross(players[0], from);
  assert(players[0].credit === 9, "repeatable — +1 on EVERY cross");

  // Broke cross keeps the existing one-time +200 consolation.
  players[1].money = 100;
  players[1].position = (sbPos + 2) % game.boardSize;
  game._resolveSuperBananaCross(players[1], from);
  assert(players[1].money === 300, "broke crosser gets the +200 consolation");
  game._resolveSuperBananaCross(players[1], from);
  assert(players[1].money === 300, "broke-cross consolation stays ONE-TIME (sbBonusTaken)");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("16. AUTO-WIN: rich + credit>=1 + revealed SB within 1..12 ahead");
{
  const { game, players } = createStartedGame(2);
  const sbPos = findSB(game);
  players[0].money = 15000;
  players[0].credit = 1;
  players[0].position = (sbPos - 5 + game.boardSize) % game.boardSize; // 5 ahead

  assert(game._checkSuperBananaAutoWin() === false, "no auto-win while the SB is fogged");
  players[1].revealedTiles.add(sbPos);
  players[0].credit = 0;
  assert(game._checkSuperBananaAutoWin() === false, "no auto-win at 0 credit");
  players[0].credit = 1;
  players[0].position = sbPos; // distance 0 (standing on it)
  assert(game._checkSuperBananaAutoWin() === false, "distance must be >= 1");
  players[0].position = (sbPos - 13 + game.boardSize) % game.boardSize;
  assert(game._checkSuperBananaAutoWin() === false, "distance 13 is out of reach");
  players[0].money = 9999;
  players[0].position = (sbPos - 5 + game.boardSize) % game.boardSize;
  assert(game._checkSuperBananaAutoWin() === false, "must be RICH (money >= SB price)");
  players[0].money = 15000;
  assert(game._checkSuperBananaAutoWin() === true, "rich + credit + revealed + within 12 → WIN");
  assert(game.superBananaWin && game.superBananaWin.playerId === "p0", "auto-win runs the celebration");
  assert(game.superBananaWinnerId === "p0", "winner recorded");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("17. AUTO-WIN fires from ANOTHER player's move + skips the accuse window");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  const sbPos = findSB(game);
  players[1].revealedTiles.add(sbPos);
  // p1 already qualifies — the sweep after p0's move must catch them.
  players[1].money = 15000;
  players[1].credit = 3;
  players[1].position = (sbPos - 8 + game.boardSize) % game.boardSize;
  players[0].position = (sbPos + 5) % game.boardSize; // p0 walks nowhere near
  forceRoll(game, "p0", 3, 4);
  game.submitClaim("p0", 7);
  assert(game.superBananaWin && game.superBananaWin.playerId === "p1", "auto-win sweep checks ALL players after a move");
  assert(game.accuse === null && game.turnPhase === "resolved", "the winning move skips the accuse window");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("18. Accuse eligibility: 0-credit / ghost opponents auto-no; window skipped");
{
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  players[1].credit = 0; // p1 can't accuse... but then p0's cup: 7 < 0? no → cup kept
  forceRoll(game, "p0", 3, 4);
  assert(game.pendingAction.cupPublic === false, "0 solvent opponents → cup kept");
  game.submitClaim("p0", 11); // an unpunishable lie
  assert(game.accuse === null && game.turnPhase === "resolved", "no eligible accusers → window skipped");
  assert(game.lastAccuseResult === null, "no result without a window");
  game.endTurn("p0");

  // A voter must hold >=1 credit to accuse "yes" (re-checked at answer time).
  players[1].credit = 5; // restore p1's cup so their roll stays hidden
  forceRoll(game, "p1", 3, 4);
  game.submitClaim("p1", null);
  assert(game.turnPhase === "accusing", "p0 (credit 7) can accuse p1");
  players[0].credit = 0; // credit vanished mid-window
  assert(game.submitAccuse("p0", true) === false, "accusing requires >=1 credit at answer time");
  assert(game.submitAccuse("p0", false), "voting no is always allowed");
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
section("19. Spec-fidelity audit: d12 truth, teammate accuse, mid-accuse auto-win, cross-turn secrecy");
{
  // 19.1 — HEXED d12: a natural 1 is the plain TRUTH (a d12 CAN roll a 1,
  // unlike 2d6), and the standing 7→1 right stays truthful on a d12 7.
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  assert(game.dodecahedron === true, "dodecahedron mode is ON by default");
  game.d12OwnerId = "p0"; // hex the roller: their 2d6 becomes a single d12
  forceRoll(game, "p0", 1); // natural d12 1
  assert(game.diceIsD12 === true, "hexed roller's roll is tagged d12");
  assert(
    game.pendingAction.rolledIsD12 === true && game.pendingAction.rolledDice.length === 1,
    "pendingAction carries a single d12 die",
  );
  assert(game.submitClaim("p0", 1), "claim 1 accepted on a d12 natural 1");
  assert(players[0].position === 1, "walked the claimed 1 (turtle)");
  assert(game.turnPhase === "accusing", "cup kept → accuse window opens on a d12 roll");
  game.submitAccuse("p1", true);
  const r1 = game.lastAccuseResult;
  assert(r1 && r1.truthful === true && r1.actualTotal === 1, "d12 natural 1 claimed as 1 is TRUTHFUL");
  assert(players[1].credit === 6, "wrong accuser of the d12 truth loses 1");
  assert(players[0].credit === 7, "truthful d12 roller unharmed");
  game.endTurn("p0");

  // The un-hexed opponent still rolls plain 2d6 in between.
  forceRoll(game, "p1", 3, 4);
  assert(game.diceIsD12 === false, "non-owner still rolls 2d6");
  game.submitClaim("p1", null);
  finishTurn(game, "p1");

  // d12 rolled 7, claim 1: the free 7→1 applies to the d12 exactly like 2d6.
  forceRoll(game, "p0", 7);
  assert(game.submitClaim("p0", 1), "7→1 accepted on a d12 7");
  game.submitAccuse("p1", true);
  const r2 = game.lastAccuseResult;
  assert(
    r2 && r2.truthful === true && r2.actualTotal === 7 && r2.claim === 1,
    "d12 7 claimed as 1 is TRUTHFUL (the 7→1 right)",
  );
  assert(players[1].credit === 5 && players[0].credit === 7, "wrong accuser pays again; roller safe");
  game.cleanup();
}

{
  // 19.2 — TEAMS (2v2): credit is individual and teammates get NO special
  // treatment — a teammate's accuse vote is eligible, accepted, and settles
  // at the normal ±1 stakes (no team blocking).
  const { game, players } = createStartedGame(4, { gameMode: "2v2" });
  game._processLanding = () => {};
  assert(game.teams && game.teams.A.length === 2 && game.teams.B.length === 2, "2v2 teams assigned");
  const roller = game.getCurrentPlayer();
  const team = game.getTeamOf(roller.id);
  const mate = players.find((p) => p.id !== roller.id && game.getTeamOf(p.id) === team);
  const opps = players.filter((p) => game.getTeamOf(p.id) !== team);
  assert(mate && opps.length === 2, "roller has 1 teammate and 2 opponents");
  forceRoll(game, roller.id, 3, 4); // real 7
  assert(game.pendingAction.cupPublic === false, "credit 7 vs 3 solvent opponents → cup kept");
  game.submitClaim(roller.id, 10); // a lie
  assert(game.turnPhase === "accusing", "accuse window opens for all 3 non-rollers");
  const mv = game.accuse.votes[mate.id];
  assert(mv && mv.eligible === true, "the TEAMMATE is an eligible accuser");
  assert(game.submitAccuse(mate.id, true) === true, "teammate's accuse vote is ACCEPTED");
  assert(game.submitAccuse(opps[0].id, false), "opponent 1 votes no");
  assert(game.submitAccuse(opps[1].id, false), "opponent 2 votes no");
  const r = game.lastAccuseResult;
  assert(r && r.truthful === false, "the teammate's accusation resolved the lie");
  assert(mate.credit === 8, "TEAMMATE accuser gains +1 (credit is individual)");
  assert(roller.credit === 6, "lying roller loses 1 to their own teammate");
  assert(opps[0].credit === 7 && opps[1].credit === 7, "non-accusers untouched");
  assert(r.deltas[mate.id] === 1 && r.deltas[roller.id] === -1, "deltas: teammate +1, roller -1");
  game.cleanup();
}

{
  // 19.3 — AUTO-WIN fires DURING the accuse resolution off _adjustCredit.
  // NOTE (spec fidelity): the audited scenario asked for accuser B at credit
  // 0, but the spec itself rules "accusers must hold >=1 credit" (§18 asserts
  // it), so a credit-0 B can never cast the accusation that would refill
  // them. The mid-accuse trigger is therefore staged the only spec-legal way:
  // B is eligible (credit 1) but NOT yet rich when the move's auto-win sweep
  // runs, and turns rich mid-window (the §18 mid-window-poke pattern). B's
  // correct accusation then runs _adjustCredit(+1), whose auto-win re-check
  // must end the game inside _resolveAccuse itself.
  const { game, players } = createStartedGame(2);
  game._processLanding = () => {};
  const sbPos = findSB(game);
  players[1].credit = 1; // eligible to accuse + satisfies the win's >=1 credit
  players[1].revealedTiles.add(sbPos); // the SB is genuinely revealed
  players[1].position = (sbPos - 6 + game.boardSize) % game.boardSize; // 6 ahead
  players[0].position = (sbPos + 5) % game.boardSize; // the roller walks nowhere near
  forceRoll(game, "p0", 3, 4); // real 7
  game.submitClaim("p0", 9); // a lie
  assert(
    !game.superBananaWin && game.turnPhase === "accusing",
    "no auto-win at move time (B not yet rich) → accuse window opens",
  );
  players[1].money = game.superBananaPrice + 5000; // B turns RICH mid-window
  assert(!game.superBananaWin, "a raw money poke alone runs no auto-win check");
  assert(game.submitAccuse("p1", true), "B's accusation accepted");
  // The +1 gain inside _resolveAccuse ran _adjustCredit → the auto-win check.
  assert(
    game.superBananaWin && game.superBananaWin.playerId === "p1",
    "auto-win fired DURING the accuse resolution (via _adjustCredit)",
  );
  assert(game.superBananaWin.how === "auto", 'superBananaWin.how === "auto"');
  assert(game.superBananaWinnerId === "p1", "B recorded as the winner");
  assert(players[1].credit === 2, "B's accuse gain (+1) applied before the win fired");
  const r = game.lastAccuseResult;
  assert(
    r && r.truthful === false && r.deltas.p1 === 1 && r.deltas.p0 === -1,
    "the accusation still settled fully (lie revealed, deltas paid)",
  );
  assert(game.accuse === null && game.turnPhase === "resolved", "accuse window closed by the resolution");
  game.cleanup();
}

{
  // 19.4 — UNACCUSED-roll secrecy ACROSS turns: once the NEXT player rolls,
  // the previous roller's real total must still be nowhere in anyone else's
  // state (the cup redaction survives the turn boundary — §7 only covered
  // the same turn).
  const { game } = createStartedGame(2);
  game._processLanding = () => {};
  forceRoll(game, "p0", 6, 5); // real 11 — a distinctive total
  game.submitClaim("p0", 4); // a lie nobody accuses
  // Positive control: the scan string DOES catch the roller's own view.
  assert(
    JSON.stringify(game.getState("p0")).indexOf("[6,5]") !== -1,
    "control: the roller's own state carries the real dice [6,5]",
  );
  finishTurn(game, "p0"); // p1 votes no → unaccused resolution → turn ends
  assert(game.lastAccuseResult === null, "unaccused resolution leaves lastAccuseResult null");

  // The NEXT player rolls: p0's 11 must not have survived anywhere.
  forceRoll(game, "p1", 1, 2); // p1's own cup roll (real 3)
  const stOpp = game.getState("p1");
  const jsonOpp = JSON.stringify(stOpp);
  assert(jsonOpp.indexOf('"rolledTotal":11') === -1, "no rolledTotal:11 in the next roller's state");
  assert(jsonOpp.indexOf('"actualTotal"') === -1, "no actualTotal field at all (never accused)");
  assert(jsonOpp.indexOf("[6,5]") === -1, "the old dice faces [6,5] appear nowhere");
  assert(jsonOpp.indexOf('"total":11') === -1, "no stray total:11 in any field");
  assert(jsonOpp.indexOf('"rolledTotal":3') !== -1, "control: p1 still sees their OWN live roll");
  assert(stOpp.lastAccuseResult === null, "lastAccuseResult still null on the next turn");
  const stP0 = game.getState("p0");
  const jsonP0 = JSON.stringify(stP0);
  assert(stP0.dice.length === 0 && stP0.diceHidden === true, "p1's live cup hidden from p0");
  assert(
    jsonP0.indexOf('"rolledTotal"') === -1 && jsonP0.indexOf("[6,5]") === -1,
    "p0's view: no rolledTotal key anywhere and the old faces gone",
  );
  game.cleanup();
}

// ────────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed ? 1 : 0);
