// Comprehensive game mechanics test suite
const { MonkeyBusinessGame } = require("./gameLogic");

let passed = 0;
let failed = 0;
const failures = [];

// Deterministic RNG so the board shuffle (which uses Math.random) is reproducible
// across runs. Without this, board-layout-sensitive checks (e.g. the landing-grow
// chain tests) are flaky from one run to the next. Sections that need a specific
// Math.random still override + restore it locally; they restore to this seeded fn.
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

// Helper: create a game with N players and start it
function createStartedGame(n = 2, opts = {}) {
  const game = new MonkeyBusinessGame(
    "TEST",
    opts.maxPlayers || n,
    opts.startingMoney || 5000,
    opts.gameMode || "classic",
    undefined,
    opts.monkeyPoker !== undefined ? opts.monkeyPoker : true,
  );
  if (opts.dodecahedron !== undefined) game.dodecahedron = opts.dodecahedron;
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push(game.addPlayer(`p${i}`, `Player${i}`));
  }
  // Start game
  game.startGame("p0");
  game.completeReveal();
  // Skip start picks: drop players onto tile 0 so tests can roll
  // immediately, matching the pre-start-pick legacy assumptions.
  if (!opts.skipStartPick) {
    for (const p of game.players) {
      p.startPickPending = false;
      p.position = 0;
    }
    game.diceRolled = false;
  }
  // A turn is now multi-phase (roll → optional ability → opponents predict →
  // commit), normally driven by the frontend. Tests that don't exercise the
  // predict bluff want the OLD atomic behavior, so by default wrap the turn
  // entry points to auto-pass the ability window and resolve the prediction with
  // every opponent answering "no" (no ability caught → no reward/penalty, full
  // refund of any stake except teleport's built-in 1-card nerf). Opt out with
  // {manualTurns:true} to drive the window by hand (the prediction tests do).
  if (!opts.manualTurns) installAutoCommit(game);
  return { game, players };
}

// Resolve an OPEN pending turn with NO ability caught and NO prediction (every
// eligible opponent answers "no"), committing the move synchronously.
function forceResolveNoPredict(game) {
  if (game.turnPhase === "ability" && game.pendingAction) {
    game.passPostRoll(game.pendingAction.playerId);
  }
  if (game.prediction) {
    for (const id of Object.keys(game.prediction.votes)) {
      game.prediction.votes[id].answered = true;
      game.prediction.votes[id].guess = false;
    }
    game._resolvePredictionAndCommit();
  }
}

// Wrap rollDice / useRollCard / usePostRollAbility so each auto-commits the turn
// (teleportToFarm delegates to usePostRollAbility, so it's covered too).
function installAutoCommit(game) {
  for (const name of ["rollDice", "useRollCard", "usePostRollAbility"]) {
    const orig = game[name].bind(game);
    game[name] = (...args) => {
      const r = orig(...args);
      if (r) forceResolveNoPredict(game);
      return r;
    };
  }
}

// Drive a PREDICTION by hand (manualTurns mode): each opponent in `guesses`
// (id -> bool) submits that guess; everyone else left as-is. Then, if the
// window is fully answered, it resolves automatically (submitPrediction calls
// _checkPredictionComplete). Returns nothing.
function predictAll(game, guesses) {
  for (const [id, g] of Object.entries(guesses || {})) {
    game.submitPrediction(id, g);
  }
}

// Post-roll TELEPORT for tests: teleport is now an ability you pick AFTER rolling.
// Open a held plain pending action (a roll that hasn't committed) when it's this
// player's turn, then stake the teleport. With the auto-commit wrapper installed
// (createStartedGame/_quickStarted), usePostRollAbility resolves the (no-)predict
// and commits. Returns the teleportToFarm result (false if rejected — the plain
// pending is left open, exactly as a real rejected ability would be).
function tpFarm(game, id, pos, discardIndices) {
  const cur = game.getCurrentPlayer();
  if (cur && cur.id === id && !game.pendingAction && !game.diceRolled) {
    game.pendingAction = {
      playerId: id, turn: game.turn, rolledDice: [1, 1], rolledIsD12: false,
      kind: "plain", finalValue: 2, stakeValues: [],
      teleportPosition: null, cardValue: null, plusSix: false,
    };
    game.turnPhase = "ability";
  }
  return game.teleportToFarm(id, pos, discardIndices);
}

// Post-roll SPELL CARD play for tests: spell cards are now played AFTER rolling.
// Open a held plain pending action with a NON-matching rolled value (12, which a
// 1-6 card can never equal → no redraw, so the seeded board RNG isn't shifted),
// then play the card. The wrapped useRollCard auto-resolves the (no-)prediction.
// (Uses bracket notation so the global `playCard(game, ` -> playCard rewrite
// skips this real call.) Returns the useRollCard result.
function playCard(game, id, idx) {
  const cur = game.getCurrentPlayer();
  if (cur && cur.id === id && !game.pendingAction && !game.diceRolled) {
    game.pendingAction = {
      playerId: id, turn: game.turn, rolledDice: [6, 6], rolledIsD12: false,
      kind: "plain", finalValue: 12, stakeValues: [],
      teleportPosition: null, cardValue: null, plusSix: false,
    };
    game.turnPhase = "ability";
  }
  return game["useRollCard"](id, idx);
}

// Park the roller one tile past the Super Banana — no roll sum (max 18 with
// 3 dice) wraps the board back to it — and move everyone else out of landing
// reach. Landing on the Super Banana wins the game (rich) or demands a
// hideout pick (broke), blocking endTurn and changing money. Tests doing REAL
// rolls call this first so the landing stays effect-neutral on a shuffled board.
function parkForNeutralRoll(game, roller) {
  let sbPos = 0;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbPos = pos; break; }
  }
  roller.position = (sbPos + 1) % game.boardSize;
  for (const p of game.players) {
    if (p.id !== roller.id) p.position = (sbPos + 25) % game.boardSize;
  }
}

// ============================================================
section("1. Game Creation & Player Management");
// ============================================================

{
  const game = new MonkeyBusinessGame("G1", 4, 2222, "classic", true, true, true);
  assert(game.state === "waiting", "Game starts in waiting state");
  assert(game.maxPlayers === 4, "Max players set correctly");
  assert(game.startingMoney === 2222, "Starting money set correctly");
  assert(game.gameMode === "classic", "Game mode set correctly");

  const p1 = game.addPlayer("s1", "Alice");
  assert(p1 && !p1.error, "First player added successfully");
  assert(p1.money === 2222, "Player gets starting money");
  assert(game.admin === "s1", "First player is admin");

  const p2 = game.addPlayer("s2", "Bob");
  assert(p2 && !p2.error, "Second player added");

  const p3 = game.addPlayer("s3", "Charlie");
  const p4 = game.addPlayer("s4", "Diana");
  assert(p3 && !p3.error, "Third player added");
  assert(p4 && !p4.error, "Fourth player added");

  const p5 = game.addPlayer("s5", "Eve");
  assert(p5 && p5.error === "full", "Fifth player rejected (full)");

  // Colors should be unique
  const colors = new Set(game.players.map(p => p.color));
  assert(colors.size === 4, "All players have unique colors");
}

// ============================================================
section("2. Settings Update");
// ============================================================

{
  const game = new MonkeyBusinessGame("G2", 4, 2222, "classic", false, true, true);
  game.addPlayer("s1", "Alice");
  game.addPlayer("s2", "Bob");

  assert(game.updateSettings("s1", { startingMoney: 5000 }), "Admin can update settings");
  assert(game.startingMoney === 5000, "Starting money updated");
  assert(game.players[0].money === 5000, "Player money updated with setting");

  assert(!game.updateSettings("s2", { startingMoney: 9999 }), "Non-admin cannot update settings");

  assert(game.updateSettings("s1", { gameMode: "2v2" }), "Can switch to 2v2 mode");
  assert(game.maxPlayers === 4, "Teams mode forces 4 players");
}

// ============================================================
section("3. Game Start");
// ============================================================

{
  const game = new MonkeyBusinessGame("G3", 2, 2222, "classic", true, true, true);
  game.addPlayer("s1", "Alice");
  game.addPlayer("s2", "Bob");

  assert(game.startGame("s1"), "Can start once 2+ players have joined");
  assert(game.state === "revealing", "State changes to revealing");

  game.completeReveal();
  assert(game.state === "playing", "State changes to playing after reveal");
}

// ============================================================
section("4. Dice Rolling & Movement");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const curId = cur.id;

  // Non-current player can't roll
  const otherId = curId === "p0" ? "p1" : "p0";
  assert(!game.rollDice(otherId), "Non-current player can't roll");

  // Roll dice
  const result = game.rollDice(curId);
  assert(result !== null, "Current player can roll");
  assert(result.dice.length === 2, "Default 2 dice");
  assert(game.diceRolled === true, "Dice marked as rolled");

  // Can't roll again
  assert(!game.rollDice(curId), "Can't roll twice");
}

// ============================================================
section("5. rollDice always rolls exactly 2 dice (no dice tiers)");
// ============================================================

{
  // The old Turtle/Rabbit dice tiers are gone: rollDice ALWAYS rolls 2 dice and
  // ignores any extra argument passed by legacy call sites.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  parkForNeutralRoll(game, cur);

  const moneyBefore = cur.money;
  const result = game.rollDice(cur.id, 1); // extra arg ignored
  assert(result !== null, "Current player can roll");
  assert(result.dice.length === 2, "Always 2 dice, even when a count is passed");
  assert(cur.money === moneyBefore, "Rolling never costs money");
}

// ============================================================
section("6. End Turn");
// ============================================================

{
  const { game } = createStartedGame(2);
  const firstPlayer = game.getCurrentPlayer().id;

  // Can't end turn before rolling
  assert(!game.endTurn(firstPlayer), "Can't end turn before rolling");

  // Own every farm to the roller so the neutral roll lands on an owned tile and
  // no auction opens — endTurn now refuses while an auction is live (same
  // as notifyAnimsComplete), so we isolate the turn-advance mechanics here.
  for (const [pos, prop] of game.properties) {
    if (prop.group !== "superBanana") {
      prop.owner = firstPlayer;
      const rp = game.players.find((p) => p.id === firstPlayer);
      if (rp && !rp.properties.includes(pos)) rp.properties.push(pos);
    }
  }

  parkForNeutralRoll(game, game.getCurrentPlayer());
  game.rollDice(firstPlayer);

  // Cancel auto-end timer for testing
  game._cancelAutoEnd();

  assert(!game.auction, "Neutral roll opened no blocking interaction");
  assert(game.endTurn(firstPlayer), "Can end turn after rolling");
  assert(game.getCurrentPlayer().id !== firstPlayer, "Turn advanced to next player");
  assert(game.diceRolled === false, "Dice reset for next player");
}

// ============================================================
section("7. Debug Move");
// ============================================================

{
  const { game } = createStartedGame(2);
  const cur = game.getCurrentPlayer();

  const result = game.debugMove(cur.id, 10);
  assert(result !== null, "Debug move works");
  assert(cur.position === 10, "Player teleported to tile 10");
  assert(game.diceRolled === true, "Debug move marks dice as rolled");
}

// ============================================================
section("8. Auction System - Standard (Lander-Challenger)");
// ============================================================

{
  const { game } = createStartedGame(2);

  // Find an unowned property position
  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const cur = game.getCurrentPlayer();
    game.debugMove(cur.id, propPos);
    game._cancelAutoEnd();

    if (game.auction) {
      game.noAuctionTimer = true;
      assert(game.auction.phase === "pitch", "Auction starts in pitch phase");
      assert(game.auction.landingPlayer === cur.id, "Landing player is lander");

      // Lander names a price
      assert(game.placeBid(cur.id, 100), "Lander can name a price");
      assert(game.auction && game.auction.phase === "respond", "Moves to respond phase");

      // Sole acceptor buys at the lander's price (no silent bid needed)
      const other = game.players.find(p => p.id !== cur.id);
      assert(game.respondAuction(other.id, true), "Opponent can accept the price");

      const prop = game.properties.get(propPos);
      assert(prop && prop.owner === other.id, "Sole acceptor buys at lander's price");

      // Spend tracking: the buyer's totalSpent reflects the price paid; the
      // lander who only pitched (and didn't win) spent nothing; and getState
      // ships the figure to clients (PUBLIC, like totalYield).
      assert(other.totalSpent === 100, "Auction winner's totalSpent = price paid (100)");
      assert((cur.totalSpent || 0) === 0, "Lander who didn't win spent nothing");
      const _spentState = game.getState(other.id).players.find((pp) => pp.id === other.id);
      assert(_spentState && _spentState.totalSpent === 100, "getState ships totalSpent to clients");
    } else {
      // Property might have been auto-assigned (everyone broke, etc.)
      console.log("  (Auction skipped - auto-assigned)");
    }
  } else {
    console.log("  (No available property found to test)");
  }
}

// ============================================================
section("9. Auction - Pass Mechanics");
// ============================================================

{
  const { game } = createStartedGame(2);

  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const cur = game.getCurrentPlayer();
    game.debugMove(cur.id, propPos);
    game._cancelAutoEnd();

    if (game.auction) {
      game.noAuctionTimer = true;

      // Lander names a price
      game.placeBid(cur.id, 50);

      // Sole opponent declines -> lander keeps the farm at their price
      const other = game.players.find(p => p.id !== cur.id);
      if (game.auction && game.auction.phase === "respond") {
        assert(game.respondAuction(other.id, false), "Opponent can decline");
        const prop = game.properties.get(propPos);
        assert(prop && prop.owner === cur.id, "Lander keeps farm when sole opponent declines");
      }
    }
  }
}

// ============================================================
section("10. Auction - Accept with multiple players");
// ============================================================

{
  const { game } = createStartedGame(3);

  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const cur = game.getCurrentPlayer();
    game.debugMove(cur.id, propPos);
    game._cancelAutoEnd();

    if (game.auction) {
      game.noAuctionTimer = true;
      assert(game.auction.phase === "pitch", "3-player auction starts in pitch phase");

      // Lander names a price
      game.placeBid(cur.id, 100);
      const others = game.players.filter(p => p.id !== cur.id && !p.bankrupt);
      assert(game.auction && game.auction.phase === "respond", "Moves to respond phase");

      // Both opponents accept -> silent tie-breaker
      assert(game.respondAuction(others[0].id, true), "First opponent accepts");
      assert(game.respondAuction(others[1].id, true), "Second opponent accepts");
      assert(
        game.auction && game.auction.phase === "silentbid",
        "2+ acceptors trigger the silent tie-breaker"
      );

      // Higher top-up wins, paying list price + top-up
      const moneyBefore = others[0].money;
      game.submitSilentBid(others[0].id, 50);
      game.submitSilentBid(others[1].id, 20);
      const prop = game.properties.get(propPos);
      assert(prop && prop.owner === others[0].id, "Highest silent top-up wins");
      assert(others[0].money === moneyBefore - 150, "Winner pays list + top-up (100+50)");
    }
  }
}

// ============================================================
section("10b. Auction - 0-banana players are excluded");
// ============================================================

function _findUnownedFarm(game) {
  for (let i = 0; i < game.boardSize; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group === "farm") return i;
  }
  return -1;
}

// 2 players, broke lander, moneyed opponent → opponent gets the farm immediately.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 0; p1.money = 5000;
  p0.position = farm;
  const created = game._createAuctionForLander(p0.id);
  const prop = game.properties.get(farm);
  assert(created === false, "2p broke lander: no auction opened");
  assert(!game.auction, "2p broke lander: no auction object");
  assert(prop && prop.owner === p1.id, "2p broke lander: moneyed opponent gets the farm free");
}

// 2 players, moneyed lander, broke opponent → lander gets it immediately.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 5000; p1.money = 0;
  p0.position = farm;
  const created = game._createAuctionForLander(p0.id);
  const prop = game.properties.get(farm);
  assert(created === false, "2p broke opponent: no auction opened");
  assert(prop && prop.owner === p0.id, "2p broke opponent: lander gets the farm free");
}

// 3 players, moneyed lander + 1 moneyed opp + 1 broke opp → pitch, broke excluded.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 5000; p1.money = 5000; p2.money = 0;
  p0.position = farm;
  const created = game._createAuctionForLander(p0.id);
  const a = game.auction;
  assert(created === true, "3p one broke: auction opened");
  assert(a && a.phase === "pitch", "3p one broke: normal pitch auction");
  assert(a.landingPlayer === p0.id, "3p one broke: moneyed lander pitches");
  assert(a.bidders.includes(p0.id) && a.bidders.includes(p1.id), "moneyed players are bidders");
  assert(!a.bidders.includes(p2.id), "broke player excluded from bidders");
}

// 3 players, broke lander + 2 moneyed opps → sealed bid; highest wins.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 0; p1.money = 5000; p2.money = 3000;
  p0.position = farm;
  game.noAuctionTimer = true;
  const created = game._createAuctionForLander(p0.id);
  const a = game.auction;
  assert(created === true, "3p broke lander: auction opened");
  assert(a && a.phase === "silentbid" && a.sealedBid === true, "3p broke lander: sealed bid");
  assert(a.landingPlayer === null, "sealed bid has no leader");
  assert(
    a.acceptorIds.includes(p1.id) && a.acceptorIds.includes(p2.id) && !a.acceptorIds.includes(p0.id),
    "only the moneyed players bid in a sealed bid",
  );
  assert(game.submitSilentBid(p1.id, 100), "p1 submits a sealed bid");
  assert(game.submitSilentBid(p2.id, 250), "p2 submits a sealed bid");
  const prop = game.properties.get(farm);
  assert(prop && prop.owner === p2.id, "highest sealed bid wins the farm");
  assert(p2.money === 3000 - 250, "sealed-bid winner pays their bid");
}

// Sealed-bid tie → the lander gets the property (rules.md), free.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 0; p1.money = 5000; p2.money = 3000;
  p0.position = farm;
  game.noAuctionTimer = true;
  assert(game._createAuctionForLander(p0.id) === true, "sealed tie: auction opened");
  assert(game.auction.sealedLanderId === p0.id, "sealed bid records the lander");
  assert(game.submitSilentBid(p1.id, 250), "p1 bids 250");
  assert(game.submitSilentBid(p2.id, 250), "p2 ties at 250");
  const prop = game.properties.get(farm);
  assert(prop && prop.owner === p0.id, "sealed-bid tie: the lander gets the farm");
  assert(p0.money === 0, "broke lander pays nothing on the tie");
  assert(p1.money === 5000 && p2.money === 3000, "tied bidders pay nothing");
}

// Ghost-found sealed bid tie → the ghost lander takes the tile.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  const farm = _findUnownedFarm(game);
  game.noAuctionTimer = true;
  assert(game.makeGhost(p0.id) === true, "leaver becomes a ghost");
  p0.position = farm;
  p1.money = 500; p2.money = 500;
  assert(game._createAuctionForLander(p0.id) === true, "ghost sealed tie: auction opened");
  assert(game.submitSilentBid(p1.id, 100), "p1 bids 100");
  assert(game.submitSilentBid(p2.id, 100), "p2 ties at 100");
  const prop = game.properties.get(farm);
  assert(prop && prop.owner === p0.id, "ghost sealed tie: ghost lander takes the farm");
}

// Everyone broke → lander gets it for free.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 0; p1.money = 0;
  p0.position = farm;
  const created = game._createAuctionForLander(p0.id);
  const prop = game.properties.get(farm);
  assert(created === false, "everyone broke: no auction opened");
  assert(prop && prop.owner === p0.id, "everyone broke: lander gets the farm free");
}

// ============================================================
section("10c. Auction - Buy Now (richest lander)");
// ============================================================

// Richest lander can instantly buy for second-highest + 1, skipping the auction.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 5000; p1.money = 3000; p2.money = 2000;
  p0.position = farm;
  game.noAuctionTimer = true;
  game._createAuctionForLander(p0.id);
  assert(game.auction && game.auction.phase === "pitch", "Buy Now: a pitch auction started");
  assert(game._buyNowPrice(p0.id) === 3001, "Buy Now price = second-highest banana score + 1");
  assert(game._buyNowPrice(p1.id) === null, "Buy Now is only offered to the lander");
  const ok = game.auctionBuyNow(p0.id);
  assert(ok === true, "Richest lander can Buy Now");
  const prop = game.properties.get(farm);
  assert(prop && prop.owner === p0.id, "Buy Now: lander owns the farm");
  assert(p0.money === 5000 - 3001, "Buy Now: lander pays second-highest + 1");
  assert(!game.auction, "Buy Now: the auction resolved immediately");
  game._cancelAutoEnd();
}

// Lander tied for richest -> no Buy Now (can't afford second-highest + 1).
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 3000; p1.money = 3000;
  p0.position = farm;
  game.noAuctionTimer = true;
  game._createAuctionForLander(p0.id);
  assert(game._buyNowPrice(p0.id) === null, "Tied-for-richest lander: no Buy Now");
  assert(game.auctionBuyNow(p0.id) === false, "Tied-for-richest lander: Buy Now rejected");
  assert(game.auction && game.auction.phase === "pitch", "Tied lander: auction continues normally");
}

// Non-lander can't Buy Now; it's unavailable outside the pitch phase.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _findUnownedFarm(game);
  p0.money = 5000; p1.money = 1000;
  p0.position = farm;
  game.noAuctionTimer = true;
  game._createAuctionForLander(p0.id);
  assert(game.auctionBuyNow(p1.id) === false, "Non-lander can't Buy Now");
  game.placeBid(p0.id, 1); // normal pitch advances to the respond phase
  assert(game.auction.phase === "respond", "advanced to respond phase");
  assert(game._buyNowPrice(p0.id) === null, "Buy Now unavailable outside the pitch phase");
  assert(game.auctionBuyNow(p0.id) === false, "Buy Now rejected outside the pitch phase");
  game._cancelAutoEnd();
}

// ============================================================
section("18. Super Banana — land-to-buy (both modes), no cross, no +20 bonus");
// ============================================================

function _sbPos(game) {
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "superBanana" && !pr.owner) return i;
  }
  return -1;
}
function _quickStarted(n, opts) {
  const r = createStartedGame(n, opts || {});
  for (const p of r.game.players) p.startPickPending = false;
  return r;
}
const _wrap = (game, i) => ((i % game.boardSize) + game.boardSize) % game.boardSize;

// 18a: FFA LAND on the SB you can afford -> buy + win.
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const a = game.getCurrentPlayer();
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  a.position = _wrap(game, sb - 1);
  const before = a.money;
  game.debugMove(a.id, sb);
  assert(prop.owner === a.id, "18a: FFA afford+land buys the Super Banana");
  assert(a.money === before - prop.price, "18a: the win price is paid");
  assert(!!game.superBananaWin && game.superBananaWin.playerId === a.id, "18a: win sequence started");
  game.cleanup();
}

// 18b: FFA LAND on a can't-afford SB -> the lander grabs a ONE-TIME consolation
// +200 bananas (minted) AND a MYSTERY rune auction opens. The SB is revealed,
// stays put (no relocate), and there is no win.
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const a = game.getCurrentPlayer();
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  for (const p of game.players) p.revealedTiles.delete(sb); // ensure hidden pre-land
  a.money = prop.price - 1; // can't afford
  a.position = _wrap(game, sb - 1);
  a.rollCards = []; // start from a known card count
  // Keep the opponent OFF the landing tile so no poker fires.
  const opp = game.players.find((p) => p.id !== a.id);
  opp.money = 5000;
  opp.position = _wrap(game, sb + 20);
  game.noAuctionTimer = true;
  const mintBefore = game.bananaLedger.minted;
  const moneyBefore = a.money;
  game.debugMove(a.id, sb); // LAND on the SB
  game._cancelAutoEnd && game._cancelAutoEnd();
  assert(a.money === moneyBefore + 200, "18b: the can't-afford lander grabs the one-time +200 landing consolation");
  assert(game.bananaLedger.minted === mintBefore + 200, "18b: the +200 landing consolation is minted (conservation)");
  assert(a.sbBonusTaken === true, "18b: the one-time SB consolation latch is set so a later cross won't re-pay");
  assert(game.auction && game.auction.sbRune, "18b: a MYSTERY rune auction opens (lander names a price)");
  assert(game.auction.runeCount >= 0 && game.auction.runeCount <= 2, "18b: the hidden draw count is 0..2");
  assert((a.pendingPick || 0) === 0 && (a.pendingDraws || 0) === 0, "18b: the lander earns no pick/draw — only the auction winner does");
  assert(a.rollCards.length === 0, "18b: the lander gets no rune");
  assert(prop.owner == null, "18b: the SB is not bought/owned");
  assert(_sbPos(game) === sb, "18b: the SB stays put (no relocate)");
  assert(a.revealedTiles.has(sb), "18b: landing still reveals the SB");
  assert(!game.superBananaWin, "18b: no win");
  game.cleanup();
}

// 18c: TEAMS (2v2) LAND on the SB you can afford -> buy + win (must land to buy).
{
  const { game } = _quickStarted(4, { gameMode: "2v2", startingMoney: 20000 });
  const a = game.getCurrentPlayer();
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  a.position = _wrap(game, sb - 1);
  const before = a.money;
  game.debugMove(a.id, sb);
  assert(prop.owner === a.id && a.money === before - prop.price, "18c: teams BUY by landing");
  assert(!!game.superBananaWin, "18c: win sequence started");
  game.cleanup();
}

// 18d: crossing the affordable SB no longer does nothing — it OPENS the
// guaranteed-roll card auction (crosser = lander) but does NOT buy/win it and,
// crucially, does NOT reveal the SB tile (only LANDING exposes it; fog is
// preserved on a cross). Walk PAST the SB WITHOUT pre-revealing it, then assert
// the tile stayed hidden for both the opponent and the crosser. (A robust
// direct-call lock for the card auction itself lives at the end of this file: 18z.)
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const a = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== a.id);
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  // Keep the opponent off the landing tile so nothing else fires. Do NOT
  // pre-reveal the SB — that no-reveal-on-cross invariant is exactly what we test.
  opp.position = _wrap(game, sb + 20);
  a.position = _wrap(game, sb - 2);
  const before = a.money;
  game.debugMove(a.id, _wrap(game, sb + 2)); // walk across the SB, land 2 past it
  assert(prop.owner == null, "18d: crossing the SB does not buy the tile");
  assert(a.money === before, "18d: crossing itself costs nothing (any auction is pending)");
  assert(!game.superBananaWin, "18d: crossing the SB never wins");
  assert(!opp.revealedTiles.has(sb), "18d: crossing does NOT reveal the SB to opponents");
  assert(!a.revealedTiles.has(sb), "18d: crossing does NOT reveal the SB even to the crosser");
  game.cleanup();
}

// 18e: a GHOST never wins the SB and triggers NO card auction — even an
// affordable can't-be-bought-by-a-ghost land just reveals the tile and leaves it
// unowned. A ghost lander gets nothing (no auction, no card).
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const a = game.getCurrentPlayer();
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  a.ghost = true; // could afford, but a ghost
  a.money = prop.price - 1; // also force the can't-afford branch — still no auction
  a.rollCards = [];
  a.position = _wrap(game, sb - 1);
  // Eligible opponent parked clear so we can prove the GHOST (not affordability)
  // is why no auction opens.
  const opp = game.players.find((p) => p.id !== a.id);
  opp.money = 5000;
  opp.position = _wrap(game, sb + 20);
  const oppCardsBefore = opp.rollCards.length;
  game.noAuctionTimer = true;
  game.debugMove(a.id, sb); // ghost LANDS on the SB
  assert(prop.owner == null && !game.superBananaWin, "18e: a ghost doesn't buy/win the SB on landing");
  assert(!game.auction, "18e: a ghost lander triggers no auction");
  assert(a.rollCards.length === 0, "18e: a ghost gets no consolation roll card");
  assert(opp.rollCards.length === oppCardsBefore, "18e: no other player is granted a card from a ghost land");
  assert(_sbPos(game) === sb, "18e: the SB stays put under a ghost");
  game.cleanup();
}

// 18f: the superBananaBonus field/setting is gone (no minting on the SB anymore).
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 100 });
  assert(game.superBananaBonus === undefined, "18f: superBananaBonus field removed");
  const st = game.getState(game.players[0].id);
  assert(st.superBananaBonus === undefined, "18f: superBananaBonus not in getState");
  game.cleanup();
}

// ============================================================
section("19. Guaranteed Rolls (rollCards + useRollCard)");
// ============================================================
// Every player starts each game with 6 guaranteed-roll cards, each an
// independent uniform int 1..6 (duplicates allowed). Playing card `index` moves
// the player EXACTLY that many tiles (like a single die of that value): it sets
// dice=[N], fires the GROW labelled N before the move, walks N tiles, collects
// piles on the path, resolves the landing, and consumes the one card. One card
// per turn (the diceRolled gate). getState ships your OWN rollCards array; other
// players see only rollCardCount.

// 19a: start with 7 cards, each an int 1..6.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) {
    assert(Array.isArray(p.rollCards) && p.rollCards.length === 7, "19a: each player starts with 7 spell cards");
    assert(
      p.rollCards.every((c) => Number.isInteger(c) && c >= 1 && c <= 6),
      "19a: every card is an int 1..6",
    );
  }
}

// 19a2: a fresh game (reset to lobby + restart) reseeds 7 cards.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  game.state = "finished";
  for (const p of game.players) game.playerReadyForLobby(p.id);
  assert(game.state === "waiting", "19a2: back in the lobby");
  for (const p of game.players) assert(p.rollCards.length === 0, "19a2: roll cards empty in the lobby");
  game.startGame(game.admin);
  game.completeReveal();
  for (const p of game.players) {
    assert(p.rollCards.length === 7, "19a2: a new game reseeds 7 dice");
    assert(p.rollCards.every((c) => c >= 1 && c <= 6), "19a2: reseeded cards are 1..6");
  }
}

// 19b: useRollCard walks 7-N (low-roll inversion; runes are always 1..6),
// consumes one card, marks diceRolled, sets dice=[N] (dice shows the face).
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.startPickPending = false;
  // Park everyone clear and neutralize the landing so the move is isolated.
  game._processLanding = () => {};
  cur.position = 0;
  cur.rollCards = [2, 5, 1]; // play the '5' at index 1
  game.diceRolled = false;
  const ok = playCard(game, cur.id, 1);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true, "19b: useRollCard succeeds on your own turn");
  assert(game.diceRolled === true, "19b: diceRolled set after a card play");
  assert(game.dice.length === 1 && game.dice[0] === 5, "19b: dice = [N] (the card value)");
  assert(cur.position === 2, "19b: rune 5 walks 7-5=2 (low-roll inversion, no grow needed)");
  assert(JSON.stringify(cur.rollCards) === "[2,1]", "19b: the played card (index 1) is removed, others kept in order");
}

// 19b2: the move wraps the board.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.startPickPending = false;
  game._processLanding = () => {};
  cur.position = game.boardSize - 2;
  cur.rollCards = [4];
  game.diceRolled = false;
  playCard(game, cur.id, 0);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.position === 1, "19b2: rune 4 walks 7-4=3 from boardSize-2, wraps to tile 1");
}

// 19c: a Spell Card whose value matches a REVEALED grow fires that grow at 5×
// each owned farm's yield (spell-card grows hit harder than a dice 1× match).
// The player walks 7-N.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) { p.startPickPending = false; p.revealedTiles = new Set(); }
  const N = 3;
  const growPos = game._findGrowByLabel(N);
  // Own a farm in range so the grow has something to grow; reveal grow + farm.
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && i !== growPos) { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos);
  fp.owner = cur.id; fp.bananaPile = 0;
  cur.properties = [farmPos];
  for (const p of game.players) p.revealedTiles.add(growPos).add(farmPos);
  // Stand the player off their own farm so the growth piles up (no early-pickup),
  // and keep the move landing on a clean own tile so nothing else fires.
  cur.position = (farmPos + 1) % game.boardSize; // not on the farm
  // Make the landing a no-op so an auction/poker doesn't interfere.
  game._processLanding = () => {};
  if (other) other.position = (cur.position + 24) % game.boardSize;
  game.diceRolled = false;
  cur.rollCards = [N];
  game.lastGrowFired = null;
  playCard(game, cur.id, 0);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(game.lastGrowFired && game.lastGrowFired.includes(growPos), "19c: a matching spell card fires the GROW labelled N");
  assert(fp.bananaPile === fp.price * 5, "19c: the in-range owned farm grew at 5× yield on the card play");
  assert(cur.position === ((farmPos + 1 + 4) % game.boardSize), "19c: a card matching a REVEALED grow moves 7-3=4 (base 7)");
}

// 19d: one card per turn — once diceRolled is set, a second card play is gated.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.startPickPending = false;
  game._processLanding = () => {};
  cur.position = 0;
  cur.rollCards = [2, 3];
  game.diceRolled = false;
  assert(playCard(game, cur.id, 0) === true, "19d: first card play succeeds");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(playCard(game, cur.id, 0) === false, "19d: a second card play is gated by diceRolled");
  assert(cur.rollCards.length === 1, "19d: only one card consumed this turn");
}

// 19e: gating — not your turn / bad index / bankrupt / ghost / start-pick / a
// live auction all reject the play.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;
  game._processLanding = () => {};
  cur.position = 0;
  cur.rollCards = [2, 3];
  other.rollCards = [4];
  game.diceRolled = false;

  assert(playCard(game, other.id, 0) === false, "19e: a non-current player can't play a card");
  assert(playCard(game, cur.id, -1) === false, "19e: negative index rejected");
  assert(playCard(game, cur.id, 2) === false, "19e: out-of-range index rejected");
  assert(playCard(game, cur.id, 1.5) === false, "19e: non-integer index rejected");

  cur.startPickPending = true;
  assert(playCard(game, cur.id, 0) === false, "19e: blocked while a start pick is pending");
  cur.startPickPending = false;

  game.auction = { phase: "pitch" };
  assert(playCard(game, cur.id, 0) === false, "19e: a live auction blocks the play");
  game.auction = { phase: "respond" };
  assert(playCard(game, cur.id, 0) === false, "19e: a live auction (respond phase) blocks the play");
  game.auction = null;

  cur.ghost = true;
  assert(playCard(game, cur.id, 0) === false, "19e: a ghost can't play a card");
  cur.ghost = false;
  cur.bankrupt = true;
  assert(playCard(game, cur.id, 0) === false, "19e: a bankrupt player can't play a card");
  cur.bankrupt = false;

  // None of the rejected attempts consumed a card or set diceRolled.
  assert(cur.rollCards.length === 2 && game.diceRolled === false, "19e: rejected plays consume nothing");
}

// 19f: getState ships the viewer's OWN rollCards array, but redacts other
// players' rollCards to [] while still exposing everyone's rollCardCount.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b] = game.players;
  a.rollCards = [1, 2, 3, 4];
  b.rollCards = [6, 6];

  const sA = game.getState(a.id);
  const aSelf = sA.players.find((p) => p.id === a.id);
  const bSeenByA = sA.players.find((p) => p.id === b.id);
  assert(JSON.stringify(aSelf.rollCards) === "[1,2,3,4]", "19f: a sees their own rollCards array");
  assert(aSelf.rollCardCount === 4, "19f: a's own rollCardCount matches");
  assert(Array.isArray(bSeenByA.rollCards) && bSeenByA.rollCards.length === 0, "19f: b's rollCards redacted to [] for a");
  assert(bSeenByA.rollCardCount === 2, "19f: but b's rollCardCount is visible to a");

  const sB = game.getState(b.id);
  const bSelf = sB.players.find((p) => p.id === b.id);
  const aSeenByB = sB.players.find((p) => p.id === a.id);
  assert(JSON.stringify(bSelf.rollCards) === "[6,6]", "19f: b sees their own rollCards array");
  assert(aSeenByB.rollCards.length === 0 && aSeenByB.rollCardCount === 4, "19f: a's rollCards redacted for b, count still shown");
}

// ============================================================
section("19g. No revealed cards — players hold only concealed guaranteed rolls");
// ============================================================
// The revealed-cards mechanic was removed: every guaranteed roll is CONCEALED.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) {
    assert(Array.isArray(p.rollCards) && p.rollCards.length === 7, "19g: every player starts with 7 concealed dice");
    assert(!p.revealedRollCards || p.revealedRollCards.length === 0, "19g: no player has any revealed cards");
  }
  // useRollCard plays from the concealed hand (no revealed collection / param).
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.startPickPending = false;
  game._processLanding = () => {};
  cur.position = 0; cur.rollCards = [5, 1]; game.diceRolled = false;
  assert(playCard(game, cur.id, 0) === true, "19g: useRollCard plays a concealed card");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.position === 2 && JSON.stringify(cur.rollCards) === "[1]", "19g: rune 5 walks 7-5=2; the concealed card is consumed");
  game.cleanup();
}

// ============================================================
section("21. GROW Mechanics");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Give player a farm with a known price.
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "farm") {
      farmPos = i;
      break;
    }
  }
  if (farmPos < 0) {
    console.log("  (No farm found)");
  } else {
    const prop = game.properties.get(farmPos);
    prop.owner = cur.id;
    cur.properties.push(farmPos);
    for (const p of game.players) p.revealedTiles.add(farmPos);

    // Find a grow tile and stand on it; fire it directly.
    let growPos = -1;
    for (let i = 0; i < game.board.length; i++) {
      if (game.board[i].type === "grow" && i !== farmPos) {
        growPos = i;
        break;
      }
    }
    if (growPos >= 0) {
      // Reveal the grow so it can fire, then trigger.
      for (const p of game.players) p.revealedTiles.add(growPos);
      game._fireGrowAt(cur, growPos, "land");
      // Either the pile grew or the owner picked it up while standing on it.
      const grew = prop.bananaPile > 0 || cur.money > game.startingMoney;
      assert(grew, "Farm grew bananas when a GROW fires");
    }
  }
}

// ============================================================
section("21b. Grow grows ONLY the firing player's revealed farms (rules.md)");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);

  let growPos = -1;
  for (let i = 0; i < game.board.length; i++) {
    if (game.board[i].type === "grow") {
      growPos = i;
      break;
    }
  }
  const farms = [];
  for (let i = 0; i < game.boardSize && farms.length < 4; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "farm") farms.push(i);
  }
  const [minePos, theirsPos, nobodysPos, hiddenPos] = farms;
  const mine = game.properties.get(minePos);
  const theirs = game.properties.get(theirsPos);
  const nobodys = game.properties.get(nobodysPos);
  const hidden = game.properties.get(hiddenPos);
  // Only the grow + the two "bought" farms are revealed; hiddenPos is owned
  // but stays unrevealed.
  for (const p of game.players)
    p.revealedTiles = new Set([growPos, minePos, theirsPos]);
  mine.owner = cur.id;
  cur.properties.push(minePos);
  theirs.owner = other.id;
  other.properties.push(theirsPos);
  nobodys.owner = null;
  hidden.owner = cur.id;
  cur.properties.push(hiddenPos);
  mine.bananaPile = 0;
  theirs.bananaPile = 0;
  nobodys.bananaPile = 0;
  hidden.bananaPile = 0;
  cur.position = growPos;
  other.position = growPos;
  cur.startPickPending = false;
  other.startPickPending = false;

  game._fireGrowAt(cur, growPos, "land");
  assert(mine.bananaPile === mine.price, "Firing player's revealed farm grew by its full yield");
  assert(theirs.bananaPile === 0, "Opponent's farm in range did NOT grow");
  assert(nobodys.bananaPile === 0, "Unowned farm did not grow");
  assert(hidden.bananaPile === 0, "Firing player's UNREVEALED farm did not grow");

  // An opponent standing on their own farm pockets nothing — their farm
  // never grows off someone else's fire.
  theirs.bananaPile = 10;
  const otherMoney = other.money;
  other.position = theirsPos;
  game._fireGrowAt(cur, growPos, "land");
  assert(other.money === otherMoney, "Opponent on their own farm pockets nothing from your grow");
  assert(theirs.bananaPile === 10, "Opponent's existing pile is untouched by your grow");
}

// ============================================================
section("23. Banana Pile Collection");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Set up a banana pile on owned property
  let farmPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "superBanana") {
      farmPos = i;
      break;
    }
  }

  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = cur.id;
    cur.properties.push(farmPos);
    prop.bananaPile = 500;

    const moneyBefore = cur.money;
    // Landing on your OWN farm collects its pile (collection happens by
    // crossing/landing DURING a move — _collectBananasOnPath).
    const from = (farmPos - 2 + game.boardSize) % game.boardSize;
    cur.position = from;
    game._collectBananasOnPath(cur, from, farmPos);
    assert(cur.money === moneyBefore + 500, "Collected own banana pile on landing");
    assert(prop.bananaPile === 0, "Banana pile cleared after collection");
  }
}

// ============================================================
section("24. Stealing Banana Piles");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  let farmPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "farm") {
      farmPos = i;
      break;
    }
  }

  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = other.id;
    other.properties.push(farmPos);
    prop.bananaPile = 300;

    const moneyBefore = cur.money;
    // Landing ON an opponent's farm STEALS its WHOLE pile right away.
    const from = (farmPos - 2 + game.boardSize) % game.boardSize;
    cur.position = from;
    game._collectBananasOnPath(cur, from, farmPos);
    assert(cur.money === moneyBefore + 300, "24: landing on an opponent's farm STEALS the whole pile");
    assert(prop.bananaPile === 0, "24: the pile is taken on land");
  }
}

// ============================================================
section("30. Team Mode - Game Setup");
// ============================================================

{
  const game = new MonkeyBusinessGame("T1", 4, 5000, "2v2", "cooldown", false, true, true);

  for (let i = 0; i < 4; i++) {
    game.addPlayer(`t${i}`, `Team${i}`);
  }

  // Teams requires exactly 4 players
  assert(game.maxPlayers === 4, "Teams mode forces 4 max players");

  game.startGame("t0");
  assert(game.teams !== null, "Teams assigned on start");
  assert(game.teams.A.length === 2, "Team A has 2 players");
  assert(game.teams.B.length === 2, "Team B has 2 players");
  assert(game.teamCoinFlip !== null, "Team coin flip happened");
}

// ============================================================
section("31. Player Removal & Admin Transfer");
// ============================================================

{
  const { game } = createStartedGame(3);

  assert(game.admin === "p0", "First player is admin");

  game.removePlayer("p0");
  assert(game.players.length === 2, "Player removed");
  assert(game.admin === game.players[0].id, "Admin transferred to next player");
}

// ============================================================
section("32. Game State Serialization");
// ============================================================

{
  const { game } = createStartedGame(2);
  const state = game.getState("p0");

  assert(state.gameId === "TEST", "State has game ID");
  assert(state.state === "playing", "State has game state");
  assert(Array.isArray(state.players), "State has players array");
  assert(Array.isArray(state.properties), "State has properties array");
  assert(Array.isArray(state.boardLayout), "State has board layout");
  assert(state.boardLayout.length === 48, "Board has 52 tiles");
  assert(Array.isArray(state.log), "State has log array");
  assert(state.dice !== undefined, "State has dice");
}

// ============================================================
section("34. Reveal Phase");
// ============================================================

{
  const game = new MonkeyBusinessGame("R1", 2, 2222, "classic", "cooldown", false, true, true);
  game.addPlayer("r0", "R0");
  game.addPlayer("r1", "R1");

  game.startGame("r0");
  assert(game.state === "revealing", "Game enters reveal phase");

  game.acceptReveal("r0");
  assert(game.state === "revealing", "Still revealing until all accept");

  game.acceptReveal("r1");
  assert(game.state === "playing", "Game starts when all accept");
}

// ============================================================
section("35. Board has six GROW tiles after shuffle");
// ============================================================

{
  const { game } = createStartedGame(2);

  const growCount = game.board.filter((t) => t.type === "grow").length;
  assert(growCount === 6, "Board has 6 GROW tiles after shuffle");
}

// ============================================================
section("36. Debug Shuffle");
// ============================================================

{
  const { game } = createStartedGame(2);

  // Give a player a property
  const cur = game.getCurrentPlayer();
  const prop = game.properties.get(5);
  if (prop) {
    prop.owner = cur.id;
    cur.properties.push(5);
  }

  assert(game.debugShuffle(), "Debug shuffle works");
  // Properties should be cleared
  assert(cur.properties.length === 0, "Player properties cleared after reshuffle");
}

// ============================================================
section("38. Debug Add Bananas");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 1000 });
  const cur = game.getCurrentPlayer();
  const before = cur.money;

  assert(game.debugAddBananas(cur.id), "Debug add bananas works");
  assert(cur.money === before + 10000, "10000 bananas added");
}

// ============================================================
section("40. Desert Tile");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Find the desert tile
  let desertPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "desert") {
      desertPos = i;
      break;
    }
  }

  if (desertPos >= 0) {
    const prop = game.properties.get(desertPos);
    assert(
      prop && prop.group === "desert",
      "Desert is a buyable property (group desert)",
    );
    assert(prop && prop.price === 0, "Desert has yield/price 0");
    assert(prop && !prop.owner, "Desert starts unowned");

    // Keep opponents off the desert so landing auctions it (not poker).
    for (const p of game.players) {
      if (p.id !== cur.id) p.position = (desertPos + 1) % game.boardSize;
    }
    cur.position = desertPos;
    const before = cur.money;
    game._processLanding(cur);
    assert(
      cur.money === before,
      "Landing on the desert costs nothing immediately (it grows nothing)",
    );
    assert(
      game.auction && game.auction.position === desertPos,
      "Landing on an unowned desert starts a banana-bid auction",
    );
  } else {
    console.log("  (No desert tile found)");
  }
}

// ============================================================
section("41. Return to Lobby");
// ============================================================

{
  const { game } = createStartedGame(2);
  game.state = "finished";

  assert(game.playerReadyForLobby("p0"), "Player can signal ready for lobby");
  assert(game.state === "finished", "Game not reset until all ready");

  assert(game.playerReadyForLobby("p1"), "Second player signals ready");
  assert(game.state === "waiting", "Game resets to lobby when all ready");
  assert(game.players[0].money === game.startingMoney, "Money reset");
  assert(game.players[0].properties.length === 0, "Properties cleared");
}

// ============================================================
section("42. Broke Player - Property Goes to Opponent");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  // Make current player broke
  cur.money = 0;

  // Find unowned property
  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana" && prop.group !== "desert") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    cur.position = propPos;
    game._processLanding(cur);

    const prop = game.properties.get(propPos);
    if (prop && prop.owner) {
      // Since cur is broke and other has money, other should get the property
      assert(prop.owner === other.id, "Broke player's property goes to rich opponent");
    }
  }
}

// ============================================================
section("46. Auction - Minimum Bid Validation");
// ============================================================

{
  const { game } = createStartedGame(2);

  // Set up auction manually
  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const cur = game.getCurrentPlayer();
    game.debugMove(cur.id, propPos);
    game._cancelAutoEnd();

    if (game.auction) {
      // Lander can't bid 0 (unless broke)
      assert(!game.placeBid(cur.id, 0), "Can't bid 0 bananas (not broke)");

      // Negative bid rejected
      assert(!game.placeBid(cur.id, -100), "Can't bid negative amount");
    }
  }
}

// ============================================================
section("49. Last Player Standing Wins");
// ============================================================

{
  const { game } = createStartedGame(3);

  // Remove players until one remains
  game.removePlayer("p1");
  assert(game.state === "playing", "Game continues with 2 players");

  game.removePlayer("p2");
  assert(game.state === "finished", "Game ends with 1 player");
  assert(game.lastStandingWinner === "p0", "Last player is winner");
}

// ============================================================
section("50. Super Banana - Can Afford");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000 });
  const cur = game.getCurrentPlayer();

  // Find super banana position
  let superBananaPos = -1;
  for (let i = 0; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "superBanana") {
      superBananaPos = i;
      break;
    }
  }

  if (superBananaPos >= 0) {
    cur.position = superBananaPos;
    const prop = game.properties.get(superBananaPos);

    // Ensure player can afford it
    cur.money = prop.price + 1000;

    game._processLanding(cur);

    // Super banana triggers a delayed win - check superBananaWin
    assert(game.superBananaWin !== null || game.state === "finished",
      "Super Banana triggers win sequence");
  } else {
    console.log("  (No super banana property found)");
  }
}

// ============================================================
section("51d. Random start-pick (sequential picks never collide)");
// ============================================================

  // Helper: reset transient landing side effects so the next start pick isn't
  // blocked by an auction / super-banana the previous landing opened.
  const clearLandingFx = (game) => {
    if (game._cancelAutoEnd) game._cancelAutoEnd();
    game.state = "playing";
    game.auction = null;
    game.superBananaWin = null;
    game.diceRolled = false;
  };

{
  // Random start pick: only the current player; sequential picks across all four
  // players never collide (the core "2nd/3rd/4th don't land on anyone" rule).
  const { game } = createStartedGame(4, { startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = true; p.position = 0; p.properties = []; }

  // A non-current player can't random-pick.
  game.currentPlayerIndex = 0;
  clearLandingFx(game);
  assert(game.pickStartTileRandom(game.players[1].id) === false,
    "Only the current player can random-pick");

  const picked = [];
  for (let n = 0; n < 4; n++) {
    game.currentPlayerIndex = n; // isolate: player n is current
    clearLandingFx(game);
    const cur = game.players[n];
    assert(cur.startPickPending, "Player " + n + " owes a start pick");
    const ok = game.pickStartTileRandom(cur.id);
    if (game._cancelAutoEnd) game._cancelAutoEnd();
    assert(ok === true, "Random start pick succeeds for player " + n);
    assert(cur.startPickPending === false, "Picker " + n + " is now on the board");
    assert(cur.position >= 0 && cur.position < game.boardSize, "Picked a valid tile");
    assert(!picked.includes(cur.position),
      "Random pick never lands on another player (got " + cur.position + ")");
    picked.push(cur.position);
  }
  assert(new Set(picked).size === 4, "All four start tiles are distinct");
}

{
  // The core guarantee, stressed: with one opponent parked on a fixed tile, 200
  // random picks must NEVER choose that occupied tile.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = true; p.position = 0; p.properties = []; }
  const p1 = game.players[0];
  const p2 = game.players[1];
  game.currentPlayerIndex = 0;
  clearLandingFx(game);
  assert(game.pickStartTile(p1.id, 7) === true, "Player 1 takes tile 7");
  let everHit7 = false;
  for (let trial = 0; trial < 200; trial++) {
    p1.position = 7; p1.startPickPending = false; // p1 stays on tile 7
    p2.startPickPending = true; p2.position = 0;
    game.currentPlayerIndex = 1;
    clearLandingFx(game);
    const ok = game.pickStartTileRandom(p2.id);
    if (game._cancelAutoEnd) game._cancelAutoEnd();
    assert(ok === true, "p2 random pick succeeds");
    if (p2.position === 7) everHit7 = true;
  }
  assert(everHit7 === false, "200 random picks for p2 never landed on p1's tile (7)");
}

// ============================================================
section("54. Auction - Price Cap");
// ============================================================

{
  // The lander can't name a price above the richest opponent's bank.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const p0 = game.players[0];
  const p1 = game.players[1];
  p1.money = 100; // Opponent only has 100

  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "superBanana" && prop.price > 0) {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const prop = game.properties.get(propPos);
    game.auction = {
      position: propPos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: p0.id,
      bidders: [p0.id, p1.id],
      bids: {
        [p0.id]: { amount: 0, placed: false, passed: false },
        [p1.id]: { amount: 0, placed: false, passed: false },
      },
      phase: "pitch",
      highBid: 0,
      highBidder: null,
    };
    // p0 (5000) can't price above the opponent's 100 bank, but can price at it.
    assert(!game.placeBid(p0.id, 3000), "Lander can't price above richest opponent's bank");
    assert(game.placeBid(p0.id, 100), "Lander can price at the opponent's bank");
    if (game._cancelAutoEnd) game._cancelAutoEnd();
  }
}

// ============================================================
section("61. Classic - Early Pickup on own farm");
// ============================================================

// Helper: set up a game with the current player owning a farm,
// a known grow tile, and the whole board in grow-range. Returns the pieces.
function setupGrow(opts = {}) {
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  // Clear reveals so the grow range spans the whole board (only the fired
  // grow tile gets revealed inside _fireGrowAt).
  for (const p of game.players) {
    p.revealedTiles = new Set();
    p.startPickPending = false; // simulate a mid-game grow, not the first pick
  }
  let growPos = -1;
  for (let i = 0; i < 48; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  let farmPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group && prop.group !== "desert" && prop.group !== "superBanana" && i !== growPos) {
      farmPos = i; break;
    }
  }
  // Owned farms are revealed in real play (bought at auction) — mirror that.
  if (farmPos >= 0) for (const p of game.players) p.revealedTiles.add(farmPos);
  return { game, p0: game.players[0], p1: game.players[1], growPos, farmPos };
}

{
  const { game, p0, growPos, farmPos } = setupGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 250; // a pre-existing pile already sitting on the tile
    p0.properties.push(farmPos);

    // Player is standing ON their own farm when the grow fires.
    p0.position = farmPos;
    const before = p0.money;

    game._fireGrowAt(p0, growPos, "roll");

    // Sweep the whole tile: fresh growth (prop.price) + the pre-existing pile.
    assert(p0.money === before + prop.price + 250, "Early pickup sweeps fresh growth + pre-existing pile");
    assert(prop.bananaPile === 0, "No pile left on the farm under the player");
    assert(game.diceMatchEarlyPickup === farmPos, "diceMatchEarlyPickup records the picked tile");
    assert(game.diceMatchGrownAmounts && game.diceMatchGrownAmounts[farmPos] === prop.price, "Grown amount (fresh growth) recorded for the picked tile");
  } else {
    console.log("  (No grow/farm tile found)");
  }
}

// ============================================================
section("62. Classic - No early pickup when standing elsewhere");
// ============================================================

{
  const { game, p0, growPos, farmPos } = setupGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 0;
    p0.properties.push(farmPos);

    // Player stands somewhere that is neither the farm nor the grow tile.
    let elsewhere = 1;
    while (elsewhere === farmPos || elsewhere === growPos) elsewhere++;
    p0.position = elsewhere;
    const before = p0.money;

    game._fireGrowAt(p0, growPos, "roll");

    assert(prop.bananaPile === prop.price, "Pile grows normally when owner is not on the farm");
    assert(p0.money === before, "No money credited when owner is not standing on the farm");
    assert(game.diceMatchEarlyPickup == null, "No early pickup recorded");
    assert(game.diceMatchTiles && game.diceMatchTiles.includes(farmPos), "Grown farm recorded in diceMatchTiles for the walk animation");
  }
}

// ============================================================
section("63. Classic - Early pickup beats a squatting opponent");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 0;
    p0.properties.push(farmPos);

    // Both the owner AND an opponent are on the farm when it grows.
    p0.position = farmPos;
    p1.position = farmPos;
    const before0 = p0.money;
    const before1 = p1.money;

    game._fireGrowAt(p0, growPos, "roll");

    assert(p0.money === before0 + prop.price, "Owner early-picks even with an opponent present");
    assert(p1.money === before1, "Squatter gets nothing when owner is on their own tile");
    assert(prop.bananaPile === 0, "No pile left after owner-priority early pickup");
  }
}

// ============================================================
section("64. Classic - Rolled grow fires BEFORE move (path collection)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) {
    p.revealedTiles = new Set();
    p.startPickPending = false;
  }
  game.auction = null;
  game.superBananaPending = null;
  game.diceRolled = false;
  const BSZ = game.boardSize;

  // Force a default 2d6 roll summing to 4 (two 2s). face = floor(r*6)+1; for
  // r=0.25 that's floor(1.5)+1 = 2, so both dice show 2 → sum 4 → fires G4.
  const realRandom = Math.random;
  Math.random = () => 0.25;
  try {
    const sum = 4;
    // Grow-match rule: a sum (<=6) that fires a revealed grow hops 7 - sum.
    const hop = 7 - sum; // sum 4 fires GROW 4 → hops 3
    // A start farm (player stands on it) and a path farm exactly `hop` ahead,
    // both owned by cur.
    let start = -1, pathPos = -1;
    for (let s = 0; s < BSZ; s++) {
      const sp = game.properties.get(s);
      if (!sp || sp.group !== "farm") continue;
      const pp = (s + hop) % BSZ;
      const pprop = game.properties.get(pp);
      if (pp !== s && pprop && pprop.group === "farm") { start = s; pathPos = pp; break; }
    }
    // A grow tile distinct from start/path; label it `sum` so the SUM fires it.
    let growPos = -1;
    for (let i = 0; i < BSZ; i++) {
      if (game.board[i].type === "grow" && i !== start && i !== pathPos) { growPos = i; break; }
    }

    if (start >= 0 && pathPos >= 0 && growPos >= 0) {
      game.growTileLabels = game.growTileLabels || new Map();
      for (const [pos, lbl] of [...game.growTileLabels]) {
        if (lbl === sum) game.growTileLabels.delete(pos);
      }
      game.growTileLabels.set(growPos, sum);

      const startProp = game.properties.get(start);
      const pathProp = game.properties.get(pathPos);
      startProp.owner = cur.id; startProp.bananaPile = 0;
      pathProp.owner = cur.id; pathProp.bananaPile = 0;
      cur.properties = [start, pathPos];

      // Park the opponent clear so they can't trigger poker on landing.
      if (other) other.position = (start + 24) % BSZ;

      cur.position = start;
      // Only this grow revealed → its range wraps the board (covers both farms).
      for (const p of game.players) {
        p.revealedTiles.add(growPos);
        p.revealedTiles.add(start);
        p.revealedTiles.add(pathPos);
      }
      const before = cur.money;

      game.rollDice(cur.id); // default 2d6 → sum 4 (mocked)
      game._cancelAutoEnd();

      // The GROW matching the SUM fires BEFORE the move, then the player hops
      // 7 - sum. Start farm (under the player) is early-picked; the path farm at
      // the hop landing is collected as the token walks onto it.
      assert(cur.position === pathPos, "Rolled sum 4 fired GROW 4 → hopped 7-4=3 onto the path farm");
      assert(game.lastGrowMatchHop && game.lastGrowMatchHop.rolled === 4 && game.lastGrowMatchHop.hop === 3,
        "Grow-match sets lastGrowMatchHop {rolled:4,hop:3} for the frontend 7-N=M animation");
      assert(game.getState(cur.id).lastGrowMatchHop && game.getState(cur.id).lastGrowMatchHop.hop === 3,
        "getState ships lastGrowMatchHop");
      assert(cur.money === before + startProp.price + pathProp.price,
        "Pre-move grow: start farm early-picked AND hop-landing farm collected");
      assert(startProp.bananaPile === 0, "Start farm left no pile (early-picked)");
      assert(pathProp.bananaPile === 0, "Path farm left no pile (collected during walk)");
      assert(game.diceMatchEarlyPickup === start, "Early pickup recorded on the start tile");
    } else {
      console.log("  (Couldn't find suitable start/path/grow tiles)");
    }
  } finally {
    Math.random = realRandom;
  }
}

// ============================================================
section("65. Classic - A squatter who only SAT (never landed) steals nothing on leaving — growth stays with owner");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 0;
    p0.properties.push(farmPos);

    // Owner p0 stands elsewhere; opponent p1 squats on the farm when it grows.
    let elsewhere = 1;
    while (elsewhere === farmPos || elsewhere === growPos) elsewhere++;
    p0.position = elsewhere;
    p1.position = farmPos;
    const b0 = p0.money, b1 = p1.money;

    game._fireGrowAt(p0, growPos, "roll");

    // The growth piles up on the farm — the squatter does NOT grab it on the spot.
    assert(p1.money === b1, "Squatter does NOT steal the growth the instant it grows");
    assert(p0.money === b0, "Owner (off the tile) gets nothing yet");
    assert(prop.bananaPile === prop.price, "Fresh growth lands in the farm pile");

    // p1 only SAT here (it never LANDED on the farm), so leaving steals NOTHING —
    // the grown pile stays with the owner.
    const pile = prop.bananaPile;
    const dest = (farmPos + 3) % game.boardSize;
    game._collectBananasOnPath(p1, farmPos, dest);
    assert(prop.bananaPile === pile, "Leaving steals nothing — growth stays with the owner");
    assert(p1.money === b1, "Squatter gains nothing on departure");
  }
}

// ============================================================
section("65b. Classic - Owner reclaims a grown pile by crossing before the squatter leaves");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 0;
    p0.properties.push(farmPos);

    // Squatter sits on the farm when it grows; owner is off the tile.
    let elsewhere = 1;
    while (elsewhere === farmPos || elsewhere === growPos) elsewhere++;
    p0.position = elsewhere;
    p1.position = farmPos;
    game._fireGrowAt(p0, growPos, "roll");
    const pile = prop.bananaPile;
    const b0 = p0.money, b1 = p1.money;

    // Owner walks THROUGH their own farm before the squatter moves off.
    const start = (farmPos - 2 + game.boardSize) % game.boardSize;
    p0.position = start;
    game._collectBananasOnPath(p0, start, (farmPos + 1) % game.boardSize);
    assert(prop.bananaPile === 0, "Owner reclaims their own grown pile by crossing");
    assert(p0.money === b0 + pile, "Owner collects the grown pile they crossed");

    // Now the squatter leaves — leaving never steals (and the owner already
    // reclaimed the pile anyway), so they get nothing.
    game._collectBananasOnPath(p1, farmPos, (farmPos + 3) % game.boardSize);
    assert(p1.money === b1, "Squatter gets nothing — leaving never steals");
  }
}

// ============================================================
section("65c. Classic - Landing STEALS the whole pile immediately; later growth stays with owner");
// ============================================================

{
  const { game, p0, p1, farmPos } = setupGrow();
  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;     // p0 owns the farm
    prop.bananaPile = 250;  // a pile already sitting on it (grown earlier)
    p0.properties.push(farmPos);

    // p1 (opponent) LANDS on p0's farm (newPos === farmPos) → STEALS the pile now.
    const b1 = p1.money;
    const landFrom = (farmPos - 2 + game.boardSize) % game.boardSize;
    p1.position = landFrom;
    game._collectBananasOnPath(p1, landFrom, farmPos);
    assert(p1.money === b1 + 250, "65c: landing on an opponent's farm STEALS the whole pile");
    assert(prop.bananaPile === 0, "65c: the pile is taken on land");

    // While p1 squats, the farm GROWS again — that growth stays with the OWNER.
    // p1 leaving collects NOTHING more.
    prop.bananaPile = 200; // growth accrued after the land-steal
    p1.position = farmPos;
    game._collectBananasOnPath(p1, farmPos, (farmPos + 3) % game.boardSize);
    assert(p1.money === b1 + 250, "65c: leaving after a land-steal collects nothing more");
    assert(prop.bananaPile === 200, "65c: growth after landing stays with the owner");
  }
}

// ============================================================
section("65d. Classic - Crossing an opponent's farm collects nothing");
// ============================================================

{
  const { game, p0, p1, farmPos } = setupGrow();
  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 180;
    p0.properties.push(farmPos);

    // p1 walks THROUGH p0's farm (farmPos is mid-path, not the landing tile).
    const b1 = p1.money;
    const start = (farmPos - 1 + game.boardSize) % game.boardSize;
    p1.position = start;
    game._collectBananasOnPath(p1, start, (farmPos + 2) % game.boardSize);
    assert(prop.bananaPile === 180, "65d: crossing an opponent's farm leaves the pile untouched");
    assert(p1.money === b1, "65d: the crosser gains nothing from merely crossing");
  }
}

section("65g. 2v2 - LANDING on a TEAMMATE's farm steals the pile (silently; teammates aren't spared)");
// ============================================================
{
  const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const teamA = game.teams.A;
  const mate = game.players.find((p) => p.id === teamA[0]);
  const walker = game.players.find((p) => p.id === teamA[1]);
  const farms = [];
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") farms.push(i);
  }
  if (mate && walker && farms.length >= 1) {
    const squatPos = farms.find((x) => x > 2 && x < game.boardSize - 3) || farms[0];
    const squatted = game.properties.get(squatPos);
    squatted.owner = mate.id;
    squatted.bananaPile = 150;
    mate.properties.push(squatPos);
    const landFrom = (squatPos - 2 + game.boardSize) % game.boardSize;
    walker.position = landFrom;
    const before = walker.money;
    const logBefore = game.log.length;
    game._collectBananasOnPath(walker, landFrom, squatPos); // LAND on the teammate's farm
    assert(squatted.bananaPile === 0, "65g: landing on a teammate's farm clears the pile");
    assert(walker.money === before + 150, "65g: teammate's pile is stolen on landing");
    const stealLog = game.log.slice(logBefore).find(
      (l) => String(typeof l === "object" ? l.text : l).toLowerCase().includes("stole"),
    );
    assert(!stealLog, "65g: the steal is SILENT — no steal notification is logged");
  }
}

// ============================================================
section("65i. Classic - Owner crossing AND landing sweep the whole pile; opponent crossing collects nothing");
// ============================================================
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [p0, p1] = game.players;
  // Two adjacent farms to walk across in one move.
  let f1 = -1, f2 = -1;
  for (let i = 1; i < game.boardSize - 2; i++) {
    const a = game.properties.get(i), b = game.properties.get(i + 1);
    if (a && a.group === "farm" && b && b.group === "farm") { f1 = i; f2 = i + 1; break; }
  }
  const pa = game.properties.get(f1), pb = game.properties.get(f2);
  pa.owner = p0.id; pa.bananaPile = pa.price * 3; // three stacks
  pb.owner = p0.id; pb.bananaPile = pb.price * 3;
  p0.properties.push(f1, f2);
  const econ = (g) => g.players.reduce((s, p) => s + p.money, 0) +
    [...g.properties.values()].reduce((s, pr) => s + (pr.bananaPile || 0), 0);
  const totalBefore = econ(game);
  const start = (f1 - 1 + game.boardSize) % game.boardSize;

  // Opponent p1 crosses BOTH farms — collects NOTHING (no skim; you must squat).
  const oppBefore = p1.money;
  p1.position = start;
  game._collectBananasOnPath(p1, start, (f2 + 1) % game.boardSize);
  assert(pa.bananaPile === pa.price * 3 && pb.bananaPile === pb.price * 3,
    "65i: an opponent crossing leaves both piles untouched");
  assert(p1.money === oppBefore, "65i: the opponent gains nothing from crossing");

  // Owner p0 CROSSES their OWN farms — sweeps the WHOLE pile (every stack) off
  // EACH crossed farm; nothing is left behind on a fly-over.
  const ownBefore = p0.money;
  const sweptOnCross = pa.bananaPile + pb.bananaPile; // price*3 + price*3
  p0.position = start;
  game._collectBananasOnPath(p0, start, (f2 + 1) % game.boardSize);
  assert(pa.bananaPile === 0 && pb.bananaPile === 0,
    "65i: the OWNER crossing sweeps every stack off each farm (piles -> 0)");
  assert(p0.money === ownBefore + sweptOnCross,
    "65i: the owner collects ALL stacks from each crossed farm");

  // Conservation: collection is a pure pile->money transfer.
  assert(econ(game) === totalBefore, "65i: collection conserves total bananas");

  // LANDING on your own farm ALSO sweeps the whole pile (identical to crossing
  // now). Restock f2 and use a fresh conservation baseline.
  pb.bananaPile = pb.price * 4;
  const baseLand = econ(game);
  const landBefore = p0.money;
  const pbBeforeLand = pb.bananaPile;
  p0.position = (f2 - 1 + game.boardSize) % game.boardSize;
  game._collectBananasOnPath(p0, p0.position, f2);
  assert(pb.bananaPile === 0, "65i: LANDING on your own farm sweeps the whole pile");
  assert(p0.money === landBefore + pbBeforeLand, "65i: landing collects all remaining stacks");
  assert(econ(game) === baseLand, "65i: landing collection conserves total bananas");
}

// ============================================================
section("65h. Classic - Land-steal fires through the real rollDice flow");
// ============================================================
// Every other steal test pokes _collectBananasOnPath / _stealPileOnLand directly.
// This one drives a genuine public roll: the player rolls 2d6 (mocked to sum 8, a
// RABBIT roll >=7 that walks its full 8) and LANDS on an opponent's piled farm,
// stealing it on arrival — locking the rollDice -> _collectBananasOnPath ->
// _stealPileOnLand wiring. (A turtle roll <7 would NOT steal — see 65j.)
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const squatter = game.getCurrentPlayer();
  const owner = game.players.find((p) => p.id !== squatter.id);
  for (const p of game.players) {
    p.revealedTiles = new Set();
    p.startPickPending = false;
  }
  game.auction = null;
  game.superBananaPending = null;
  game.diceRolled = false;
  const BSZ = game.boardSize;

  // A farm the squatter is parked on (their own) such that the tile exactly 8
  // ahead is ALSO a farm (a 2d6 sum of 8 is a RABBIT roll that walks its full 8).
  let squatPos = -1, landPos = -1;
  for (let s = 0; s < BSZ; s++) {
    const sp = game.properties.get(s);
    if (!sp || sp.group !== "farm") continue;
    const lp = (s + 8) % BSZ;
    const lprop = game.properties.get(lp);
    if (lp !== s && lprop && lprop.group === "farm") { squatPos = s; landPos = lp; break; }
  }

  if (squatPos >= 0 && landPos >= 0) {
    const startProp = game.properties.get(squatPos);
    const landProp = game.properties.get(landPos);
    // The player starts on their OWN (empty) farm and rolls 8 ONTO the opponent's
    // piled farm, stealing it the instant they LAND (rabbit roll, so steal applies).
    startProp.owner = squatter.id;
    startProp.bananaPile = 0;
    squatter.properties = [squatPos];
    landProp.owner = owner.id;
    landProp.bananaPile = 250;
    owner.properties = [landPos];

    // Keep the owner clear of the path/landing so nothing else fires.
    owner.position = (landPos + 24) % BSZ;
    squatter.position = squatPos;
    // No grow tiles revealed; the sum (8) is a rabbit roll (>=7) that walks 8.

    const before = squatter.money;
    const totalBefore = (() => {
      let t = 0;
      for (const [, pr] of game.properties) t += pr.bananaPile || 0;
      for (const p of game.players) t += p.money || 0;
      return t;
    })();

    const realRandom = Math.random;
    Math.random = () => 0.5; // each die -> 4, 2d6 -> sum 8 (rabbit, >=7)
    try {
      game.rollDice(squatter.id);
    } finally {
      Math.random = realRandom;
    }
    game._cancelAutoEnd();

    assert(squatter.position === landPos, "65h: rolled sum 8 (rabbit) → walks 8 onto the opponent's farm");
    assert(landProp.bananaPile === 0, "65h: the opponent's pile is cleared on LANDING");
    assert(squatter.money === before + 250, "65h: rollDice flow stole the pile on land (+250)");
    let totalAfter = 0;
    for (const [, pr] of game.properties) totalAfter += pr.bananaPile || 0;
    for (const p of game.players) totalAfter += p.money || 0;
    assert(totalAfter === totalBefore, "65h: land-steal is a pure transfer (money+piles conserved)");
  } else {
    console.log("  (65h: couldn't find adjacent farm tiles 3 apart — skipped)");
  }
  game.cleanup();
}

// ============================================================
section("65j. Classic - a TURTLE roll (value < 7) does NOT steal on landing");
// ============================================================
// New rule: landing on an opponent's farm via a TURTLE move (value < 7, walked
// 7-value) leaves their pile untouched; only a RABBIT move (>=7) steals.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const mover = game.getCurrentPlayer();
  const owner = game.players.find((p) => p.id !== mover.id);
  for (const p of game.players) { p.revealedTiles = new Set(); p.startPickPending = false; }
  game.auction = null; game.superBananaPending = null; game.diceRolled = false;
  const BSZ = game.boardSize;
  // An opponent farm exactly 3 ahead (a sum-4 turtle roll walks 7-4=3 onto it).
  let startPos = -1, landPos = -1;
  for (let s = 0; s < BSZ; s++) {
    const sp = game.properties.get(s);
    const lp = (s + 3) % BSZ;
    const lprop = game.properties.get(lp);
    if (lp !== s && lprop && lprop.group === "farm" && (!sp || sp.group !== "superBanana")) { startPos = s; landPos = lp; break; }
  }
  if (startPos >= 0) {
    const landProp = game.properties.get(landPos);
    landProp.owner = owner.id; landProp.bananaPile = 250; owner.properties = [landPos];
    owner.position = (landPos + 24) % BSZ;
    mover.position = startPos; mover.properties = [];
    game._processLanding = () => {}; // isolate landing side-effects
    const moneyBefore = mover.money;
    const realRandom = Math.random;
    Math.random = () => 0.25; // each die -> 2, 2d6 -> sum 4 (turtle, walks 7-4=3)
    try { game.rollDice(mover.id); } finally { Math.random = realRandom; }
    if (game._cancelAutoEnd) game._cancelAutoEnd();
    assert(mover.position === landPos, "65j: sum 4 → walks 7-4=3 onto the opponent's farm");
    assert(landProp.bananaPile === 250, "65j: a TURTLE landing does NOT steal — the pile stays with its owner");
    assert(mover.money === moneyBefore, "65j: the mover gains nothing from a turtle landing");
  } else {
    console.log("  (65j: couldn't find adjacent farm tiles 3 apart — skipped)");
  }
  game.cleanup();
}

// ============================================================
section("65k. Classic - a TURTLE move doesn't collect OWN piles by crossing");
// ============================================================
// New rule: in turtle mode you collect your own pile only by LANDING on it —
// walking PAST your own pile collects nothing. A RABBIT move collects on cross too.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const p = game.getCurrentPlayer();
  for (const pl of game.players) pl.startPickPending = false;
  const A = 1, B = 3; // own farms: A is CROSSED (pos 1), B is LANDED (pos 3) from oldPos 0
  const pa = game.properties.get(A), pb = game.properties.get(B);
  pa.owner = p.id; pb.owner = p.id; p.properties = [A, B];
  // TURTLE move (isTurtle=true): cross A, land B.
  pa.bananaPile = 100; pb.bananaPile = 200; p.position = 0;
  const moneyBefore = p.money;
  game._collectBananasOnPath(p, 0, 3, false, true);
  assert(pa.bananaPile === 100, "65k: a TURTLE cross of your own farm collects nothing — the pile stays");
  assert(pb.bananaPile === 0, "65k: a TURTLE landing on your own farm still collects");
  assert(p.money === moneyBefore + 200, "65k: only the landed pile (200) is collected on a turtle move");
  // RABBIT control (isTurtle=false): a cross collects too.
  pa.bananaPile = 100; pb.bananaPile = 200; p.position = 0; p.money = moneyBefore;
  game._collectBananasOnPath(p, 0, 3, false, false);
  assert(pa.bananaPile === 0 && pb.bananaPile === 0, "65k: a RABBIT move collects own piles on cross AND land");
  assert(p.money === moneyBefore + 300, "65k: a rabbit collects both piles (100 crossed + 200 landed)");
  game.cleanup();
}

// ============================================================
section("66. Classic - Cornerless 48-tile board");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });

  assert(game.board.length === 48, "Board has 48 tiles");
  assert(game.boardSize === 48, "boardSize is 48");

  const counts = { grow: 0, special: 0, desert: 0, farm: 0, other: 0 };
  for (let i = 0; i < game.board.length; i++) {
    const t = game.board[i];
    if (t.type === "grow") counts.grow++;
    else if (t.type === "special") counts.special++;
    else if (t.type === "desert") counts.desert++;
    else if (t.buyable && t.buyable.group === "farm") counts.farm++;
    else counts.other++;
  }
  assert(counts.grow === 6, "Board has 6 GROW tiles");
  assert(counts.farm === 40, "Board has 40 farm tiles");
  assert(counts.special === 1, "Board has 1 Super Banana tile");
  assert(counts.desert === 1, "Board has 1 Desert tile");
  assert(counts.other === 0, "Board has no legacy tile types");

  // Grow tiles are labelled 1..6 (no 0, no 7).
  const labels = [...game.growTileLabels.values()].sort((a, b) => a - b);
  assert(labels.length === 6, "Six grow labels assigned");
  assert(labels[0] === 1 && labels[5] === 6, "Grow labels span 1..6");
  assert(!labels.includes(0) && !labels.includes(7), "No grow label 0 or 7");

  // Movement wraps around the 48-tile loop.
  const cur = game.getCurrentPlayer();
  cur.startPickPending = false;
  cur.position = 47;
  const wrapped = (cur.position + 3) % game.boardSize;
  assert(wrapped === 2, "Position wraps mod 48 (47 + 3 -> 2)");
}

// ============================================================
section("68c. Post-roll abilities + Predict bluff (replaces the old Cancel)");
// ============================================================
// A turn is now roll → (optional ability) → opponents predict → commit. These
// tests drive the window by hand ({manualTurns:true}); the auto-commit harness
// covers the plain-roll path everywhere else.
//
// Helper: neutralize landing / SB-cross so a committed move only changes position.
function _neutralizeMove(game) {
  game._processLanding = () => {};
  game._resolveSuperBananaCross = () => {};
}
{
  // Roll DEFERS: it holds a pending plain action and does NOT move or set diceRolled.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  const cur = game.getCurrentPlayer();
  game.rollDice(cur.id);
  assert(game.turnPhase === "ability", "68c: rollDice opens the ABILITY phase");
  assert(game.diceRolled === false, "68c: the move is NOT committed at roll (diceRolled false)");
  assert(cur.position === 0, "68c: the token has not moved yet");
  assert(game.pendingAction && game.pendingAction.kind === "plain", "68c: a plain pending action is held");
  game.cleanup();
}
{
  // PASS → the plain rolled move commits (ineligible opponent auto-answers "no").
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // <2 cards → ineligible predictor → auto-no
  game.rollDice(cur.id);
  const sum = game.pendingAction.finalValue;
  game.passPostRoll(cur.id);
  assert(game.diceRolled === true && game.turnPhase === "resolved", "68c: a passed plain roll commits");
  const expected = (sum < 7 ? 7 - sum : sum) % game.boardSize;
  assert(cur.position === expected, "68c: the plain walk uses the below-7 movement");
  game.cleanup();
}
{
  // SWITCH PETS math (uncaught → full refund of the 1-card stake).
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // auto-no
  cur.rollCards = [1, 2, 3]; cur.position = 0;
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 8; game.pendingAction.rolledDice = [5, 3]; // rabbit 8
  assert(game.usePostRollAbility(cur.id, "switch") === true, "68c: switch pets accepted");
  assert(cur.position === 5, "68c: switch 8→2 (turtle) walks 7-2=5");
  assert(cur.rollCards.length === 3, "68c: an uncaught switch fully refunds its 1-card stake");
  // turtle → rabbit
  cur.position = 0; game.diceRolled = false; game.turnPhase = null; game.pendingAction = null; game.prediction = null;
  game.currentPlayerIndex = game.players.indexOf(cur);
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 5; game.pendingAction.rolledDice = [3, 2]; // turtle 5
  game.usePostRollAbility(cur.id, "switch");
  assert(cur.position === 11, "68c: switch 5→11 (rabbit) walks the full 11");
  game.cleanup();
}
{
  // STEADY WALK: validates 1..12 BEFORE escrow; runs the below-7 mechanism and
  // fires a matched revealed grow on the CHOSEN value.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.revealedTiles = new Set(); }
  game._processLanding = () => {}; game._resolveSuperBananaCross = () => {};
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // auto-no
  const growPos = game._findGrowByLabel(3);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && i !== growPos) { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos);
  fp.owner = cur.id; fp.bananaPile = 0; cur.properties = [farmPos];
  for (const p of game.players) p.revealedTiles.add(growPos).add(farmPos);
  cur.position = (farmPos + 1) % game.boardSize; // off the farm so growth piles up
  cur.rollCards = [1, 2, 3];
  game.rollDice(cur.id);
  assert(game.usePostRollAbility(cur.id, "steady", { value: 0 }) === false, "68c: steady rejects 0");
  assert(game.usePostRollAbility(cur.id, "steady", { value: 13 }) === false, "68c: steady rejects 13");
  assert(cur.rollCards.length === 3, "68c: a rejected steady escrows nothing");
  assert(game.usePostRollAbility(cur.id, "steady", { value: 3 }) === true, "68c: steady 3 accepted");
  assert(cur.position === ((farmPos + 1 + 4) % game.boardSize), "68c: steady 3 walks 7-3=4");
  assert(fp.bananaPile === fp.price, "68c: steady fires the matched grow on the chosen value (3)");
  assert(cur.rollCards.length === 3, "68c: an uncaught steady fully refunds its 1-card stake");
  game.cleanup();
}
{
  // TELEPORT nerf: uncaught → refund 1 of 2 (net −1 card); jumps + harvests.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // auto-no
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos); fp.owner = cur.id; fp.bananaPile = 0; cur.properties = [farmPos];
  cur.rollCards = [1, 2, 3];
  game.rollDice(cur.id);
  assert(game.usePostRollAbility(cur.id, "teleport", { position: farmPos }) === true, "68c: teleport accepted");
  assert(cur.position === farmPos, "68c: teleport jumps to the owned farm");
  assert(cur.rollCards.length === 2, "68c: an uncaught teleport forfeits its 1-card stake (nerf, 3→2)");
  game.cleanup();
}
{
  // CAUGHT teleport: a correct "yes" → DENIED. The player walks their ORIGINAL
  // rolled number (no jump) and forfeits the 1-card stake; predictor draws.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = [4, 5]; // eligible predictor
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos); fp.owner = cur.id; fp.bananaPile = 0; cur.properties = [farmPos];
  cur.rollCards = [1, 2, 3]; cur.position = 0;
  game.rollDice(cur.id);
  const sum = game.pendingAction.finalValue;
  const expectedPos = (sum < 7 ? 7 - sum : sum) % game.boardSize;
  game.usePostRollAbility(cur.id, "teleport", { position: farmPos });
  const oppBefore = opp.rollCards.length;
  game.submitPrediction(opp.id, true); // correct → resolves
  assert(cur.position === expectedPos, "68c: a caught teleport is DENIED — walks the original rolled number");
  assert(cur.rollCards.length === 2, "68c: a caught teleport forfeits its 1-card stake (3→2)");
  assert(opp.rollCards.length === oppBefore + 1, "68c: the correct predictor still draws a card");
  game.cleanup();
}
{
  // CAUGHT switch: switch STILL executes; the player owes a 1-card CHOSEN discard
  // ("lose one card of your choice"); the predictor draws.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = [4, 5];
  cur.rollCards = [1, 2, 3]; cur.position = 0;
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 8; game.pendingAction.rolledDice = [5, 3]; // rabbit 8
  game.usePostRollAbility(cur.id, "switch");
  const oppBefore = opp.rollCards.length;
  game.submitPrediction(opp.id, true); // correct → resolves
  assert(cur.position === 5, "68c: a caught switch STILL executes (8→2, walks 5)");
  assert(cur.pendingCancelDiscard === 1, "68c: a caught switch owes a 1-card chosen discard");
  assert(opp.rollCards.length === oppBefore + 1, "68c: the predictor draws a card");
  assert(game.resolveCancelMissDiscard(cur.id, [0]) === true, "68c: the switch player resolves the 1-card discard");
  assert(cur.rollCards.length === 2 && cur.pendingCancelDiscard === 0, "68c: net −1 card after the chosen discard");
  game.cleanup();
}
{
  // WRONG "yes": predicting an ability on a PLAIN roll owes a 2-card chosen discard.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = [1, 2, 3]; // >2 so the penalty defers to a chosen pick
  game.rollDice(cur.id);
  game.passPostRoll(cur.id); // plain
  game.submitPrediction(opp.id, true); // wrong (no ability) → resolves
  assert(game.diceRolled === true, "68c: the plain move still commits");
  assert(opp.pendingCancelDiscard === 2, "68c: a wrong 'yes' owes a 2-card chosen discard");
  assert(game.resolveCancelMissDiscard(opp.id, [0, 1]) === true, "68c: the wrong predictor resolves the discard");
  assert(opp.rollCards.length === 1 && opp.pendingCancelDiscard === 0, "68c: the discard is paid");
  game.cleanup();
}
{
  // CARD play under prediction: uncaught → consumed + moves; caught → consumed +
  // BLOCKED (falls back to a plain 2d6).
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // auto-no
  cur.rollCards = [3, 4, 5]; cur.position = 0;
  playCard(game, cur.id, 0); // play the 3 (turtle)
  assert(cur.rollCards.length === 2, "68c: an unpredicted card is consumed");
  assert(cur.position === 4, "68c: card 3 (turtle) walks 7-3=4");
  // caught card → blocked → 2d6
  cur.position = 0; cur.rollCards = [3, 4, 5];
  game.diceRolled = false; game.turnPhase = null; game.pendingAction = null; game.prediction = null;
  game.currentPlayerIndex = game.players.indexOf(cur);
  opp.rollCards = [5, 6];
  playCard(game, cur.id, 0); // play the 3
  const oppB = opp.rollCards.length;
  game.submitPrediction(opp.id, true); // correct (card is special)
  assert(cur.rollCards.length === 2, "68c: a caught card is still consumed");
  assert(game.dice.length === 2, "68c: a caught card play falls back to a plain 2d6 roll");
  assert(opp.rollCards.length === oppB + 1, "68c: the correct predictor draws a card");
  game.cleanup();
}
{
  // REDRAW REWARD: a card whose value MATCHES the roll, played uncaught, draws a
  // fresh card (net-neutral: discard the used card, draw a new one). A card whose
  // value differs from the roll earns NO redraw (net −1).
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = []; // ineligible predictor → auto-no → the play is uncaught
  // MATCHING: rolled a 4, play the 4-card.
  cur.rollCards = [4, 5]; cur.position = 0;
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 4; game.pendingAction.rolledDice = [2, 2]; // rolled 4
  game.useRollCard(cur.id, cur.rollCards.indexOf(4)); // matches → resolves uncaught → redraw
  assert(cur.rollCards.length === 2, "68c: a matching card played uncaught is net-neutral (−1 used, +1 redraw)");
  // NON-MATCHING: rolled a 5, play the 3-card.
  cur.rollCards = [3, 6]; cur.position = 0;
  game.diceRolled = false; game.turnPhase = null; game.pendingAction = null; game.prediction = null;
  game.currentPlayerIndex = game.players.indexOf(cur);
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 5; game.pendingAction.rolledDice = [3, 2]; // rolled 5
  game.useRollCard(cur.id, cur.rollCards.indexOf(3)); // 3 != 5 → no redraw
  assert(cur.rollCards.length === 1, "68c: a NON-matching card earns no redraw (net −1)");
  // CAUGHT matching card → blocked, no redraw (predictor draws instead).
  cur.rollCards = [4, 5]; cur.position = 0;
  game.diceRolled = false; game.turnPhase = null; game.pendingAction = null; game.prediction = null;
  game.currentPlayerIndex = game.players.indexOf(cur);
  opp.rollCards = [1, 2]; // eligible predictor
  game.rollDice(cur.id);
  game.pendingAction.finalValue = 4; game.pendingAction.rolledDice = [2, 2];
  game.useRollCard(cur.id, cur.rollCards.indexOf(4));
  const oppBefore = opp.rollCards.length;
  game.submitPrediction(opp.id, true); // correct → blocked, no redraw
  assert(cur.rollCards.length === 1, "68c: a CAUGHT matching card is consumed with NO redraw (net −1)");
  assert(game.dice.length === 2, "68c: a caught matching card still fizzles to a 2d6");
  assert(opp.rollCards.length === oppBefore + 1, "68c: the predictor (not the actor) draws on a caught card");
  game.cleanup();
}
{
  // ELIGIBILITY: a <2-card opponent auto-answers "no"; an eligible one must answer;
  // a "yes" from an ineligible opponent is rejected. The bluff secret is redacted.
  const { game } = createStartedGame(3, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const others = game.players.filter((p) => p.id !== cur.id);
  const oppA = others[0], oppB = others[1];
  oppA.rollCards = [1, 2]; // eligible
  oppB.rollCards = [6];     // ineligible (<2)
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) { const pr = game.properties.get(i); if (pr && pr.group === "farm") { farmPos = i; break; } }
  const fp = game.properties.get(farmPos); fp.owner = cur.id; fp.bananaPile = 0; cur.properties = [farmPos];
  cur.rollCards = [1, 2, 3];
  game.rollDice(cur.id);
  game.usePostRollAbility(cur.id, "teleport", { position: farmPos });
  assert(game.prediction, "68c: prediction is open with an eligible opponent pending");
  assert(game.prediction.votes[oppB.id].answered === true && game.prediction.votes[oppB.id].eligible === false,
    "68c: the <2-card opponent is auto-no / ineligible");
  assert(game.prediction.votes[oppA.id].answered === false, "68c: the eligible opponent must still answer");
  assert(game.submitPrediction(oppB.id, true) === false, "68c: an ineligible opponent can't predict 'yes'");
  // Secrecy: the active player sees their choice; opponents see only the public roll.
  const curView = game.getState(cur.id);
  const oppView = game.getState(oppA.id);
  assert(curView.pendingAction.kind === "teleport", "68c: the active player sees their own choice");
  assert(oppView.pendingAction && oppView.pendingAction.kind === undefined && oppView.pendingAction.rolledDice,
    "68c: an opponent sees only the public rolled dice, never the chosen ability");
  assert(oppView.prediction && oppView.prediction.myVote, "68c: an opponent sees their own vote slot");
  game.submitPrediction(oppA.id, false); // resolves (uncaught)
  assert(game.turnPhase === "resolved", "68c: resolves once the eligible opponent answers");
  game.cleanup();
}

// ============================================================
section("68f. Predict runs CONCURRENTLY with the roller's choice (opened at roll time)");
// ============================================================
// The predict window now opens at ROLL time, so opponents vote at the SAME time the
// roller picks an ability — not after. The turn resolves once BOTH are in (either order).
{
  // Opponent votes BEFORE the roller commits → must wait for the roller; then commit resolves.
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = [4, 5]; // eligible predictor
  cur.rollCards = [1, 2, 3];
  game.rollDice(cur.id);
  assert(game.prediction && game.prediction.votes[opp.id] && game.prediction.votes[opp.id].answered === false,
    "68f: rollDice opens the predict window immediately (opponent may vote now)");
  assert(game.turnPhase === "ability", "68f: turnPhase stays 'ability' while the roller is still choosing");
  game.submitPrediction(opp.id, false); // votes FIRST, before the roller commits
  assert(game.turnPhase === "ability" && !game.diceRolled && game.pendingAction,
    "68f: an early opponent vote does NOT resolve — it waits for the roller to commit");
  assert(game.prediction, "68f: the prediction stays open until the roller commits");
  game.passPostRoll(cur.id); // roller commits (plain) → both sides in → resolves
  assert(game.turnPhase === "resolved" && game.diceRolled === true,
    "68f: once the roller commits with all votes already in, the turn resolves");
  game.cleanup();
}
{
  // CAUGHT via the concurrent order: opponent predicts YES first, then the roller's
  // ability commits and is caught (same outcome as the commit-then-predict order).
  const { game } = createStartedGame(2, { manualTurns: true, gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  _neutralizeMove(game);
  const cur = game.getCurrentPlayer();
  const opp = game.players.find((p) => p.id !== cur.id);
  opp.rollCards = [4, 5];
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) { const pr = game.properties.get(i); if (pr && pr.group === "farm") { farmPos = i; break; } }
  const fp = game.properties.get(farmPos); fp.owner = cur.id; fp.bananaPile = 0; cur.properties = [farmPos];
  cur.rollCards = [1, 2, 3]; cur.position = 0;
  game.rollDice(cur.id);
  const sum = game.pendingAction.finalValue;
  const expectedPos = (sum < 7 ? 7 - sum : sum) % game.boardSize;
  const oppBefore = opp.rollCards.length;
  game.submitPrediction(opp.id, true); // predicts YES first
  assert(game.turnPhase === "ability", "68f: roller is still choosing after the early YES");
  game.usePostRollAbility(cur.id, "teleport", { position: farmPos }); // commits → caught
  assert(game.turnPhase === "resolved", "68f: resolves the moment the roller commits (votes already in)");
  assert(cur.position === expectedPos, "68f: a teleport caught via an early prediction is DENIED (walks the roll)");
  assert(opp.rollCards.length === oppBefore + 1, "68f: the early correct predictor still draws a card");
  game.cleanup();
}

// ============================================================
section("68e. Armed guaranteed rolls — persist across turns (auto-activation queue)");
// ============================================================
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  game._processLanding = () => {};
  game._resolveSuperBananaCross = () => false; // keep the roll focused on arming
  const p0 = game.players[0];
  const p1 = game.players[1];
  game.currentPlayerIndex = 0;

  // Arming validates you actually hold the card; disarm clears it.
  const heldVal = p0.rollCards[0];
  assert(game.armRollCard(p0.id, heldVal) === true, "68e: can arm a concealed value you hold");
  assert(p0.armedRoll && p0.armedRoll.value === heldVal, "68e: armedRoll is set");
  const notHeld = [1, 2, 3, 4, 5, 6].find((v) => !p0.rollCards.includes(v));
  if (notHeld != null) assert(game.armRollCard(p0.id, notHeld) === false, "68e: can't arm a concealed value you don't hold");
  assert(game.disarmRollCard(p0.id) === true, "68e: disarm clears the arm");
  assert(p0.armedRoll == null, "68e: armedRoll null after disarm");

  // Arm AFTER rolling -> the arm PERSISTS across the owner's turn end.
  game.diceRolled = false; game.auction = null; game.superBananaWin = null;
  game.rollDice(p0.id); // p0 takes a normal roll (no arm to clear yet)
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  game.auction = null; game.superBananaWin = null;
  const armVal = p0.rollCards[0];
  assert(game.armRollCard(p0.id, armVal) === true, "68e: can arm AFTER rolling (any time)");
  game.diceRolled = true; game.endTurn(p0.id);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(p0.armedRoll && p0.armedRoll.value === armVal, "68e: the arm PERSISTS across the owner's turn end");
  game.diceRolled = true; game.endTurn(p1.id); // full round back to p0
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(p0.armedRoll && p0.armedRoll.value === armVal, "68e: the arm survives a full round back to the owner");
  assert(game.getCurrentPlayer().id === p0.id, "68e: it's p0's turn again");

  // Playing the armed card (what the auto-activation does) consumes + clears it.
  game.diceRolled = false; game.auction = null; game.superBananaWin = null;
  const idx = p0.rollCards.indexOf(armVal);
  assert(playCard(game, p0.id, idx) === true, "68e: playing the armed card works");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(p0.armedRoll == null, "68e: the arm is cleared once played (consumed)");
}
{
  // Arm before rolling, then take a NORMAL roll instead -> the arm is cleared.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  game._processLanding = () => {};
  game._resolveSuperBananaCross = () => false;
  const p0 = game.getCurrentPlayer();
  game.currentPlayerIndex = game.players.indexOf(p0);
  game.diceRolled = false; game.auction = null; game.superBananaWin = null;
  assert(game.armRollCard(p0.id, p0.rollCards[0]) === true, "68e: arm before rolling");
  game.rollDice(p0.id);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(p0.armedRoll == null, "68e: a normal roll clears the arm");
}
{
  // getState serves armedRoll OWNER-ONLY.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const p0 = game.players[0], p1 = game.players[1];
  game.armRollCard(p0.id, p0.rollCards[0]);
  const asP0 = JSON.parse(JSON.stringify(game.getState(p0.id)));
  const asP1 = JSON.parse(JSON.stringify(game.getState(p1.id)));
  const p0SeenByP0 = asP0.players.find((p) => p.id === p0.id);
  const p0SeenByP1 = asP1.players.find((p) => p.id === p0.id);
  assert(p0SeenByP0.armedRoll && p0SeenByP0.armedRoll.value === p0.rollCards[0], "68e: owner sees their own armedRoll");
  assert(!("armedRoll" in p0SeenByP1) || p0SeenByP1.armedRoll == null, "68e: opponents never see your armedRoll");
}

// ============================================================
section("72. Property auction - silent-bid edge cases");
// ============================================================

{
  const { game } = createStartedGame(3, { startingMoney: 1000 });
  game.noAuctionTimer = true;
  const [a, b, c] = game.players;

  let pos = -1;
  for (let i = 1; i < 48; i++) {
    const p = game.properties.get(i);
    if (p && !p.owner && p.group !== "superBanana" && p.price > 0) { pos = i; break; }
  }

  function reset() {
    a.money = b.money = c.money = 1000;
    for (const pp of game.properties.values()) pp.owner = null;
    a.properties = []; b.properties = []; c.properties = [];
  }
  function freshAuction() {
    const bidders = [a.id, b.id, c.id];
    const bids = {};
    for (const id of bidders) bids[id] = { amount: 0, placed: false, passed: false };
    const prop = game.properties.get(pos);
    game.auction = {
      position: pos, propName: prop.name, propPrice: prop.price,
      propGroup: prop.group || null, landingPlayer: a.id, bidders, bids,
      phase: "pitch", highBid: 0, highBidder: null,
    };
  }

  if (pos >= 0) {
    // Tie at the top -> lander gets it at the list price.
    reset(); freshAuction();
    game.placeBid(a.id, 100);
    game.respondAuction(b.id, true);
    game.respondAuction(c.id, true);
    game.submitSilentBid(b.id, 40);
    game.submitSilentBid(c.id, 40);
    assert(game.properties.get(pos).owner === a.id, "Silent-bid tie -> lander gets the property");
    assert(a.money === 900, "Lander pays only the list price on a tie");

    // Nobody accepts -> lander keeps it at the list price.
    reset(); freshAuction();
    game.placeBid(a.id, 100);
    game.respondAuction(b.id, false);
    game.respondAuction(c.id, false);
    assert(game.properties.get(pos).owner === a.id, "No acceptors -> lander keeps the property");
    assert(a.money === 900, "Lander pays the list price when nobody accepts");

    if (game._cancelAutoEnd) game._cancelAutoEnd();
  }
}

// ============================================================
section("73d. Classic - notifyAnimsComplete ends the turn immediately");
// ============================================================
// With the End Turn button + auto-end countdown removed, the lander's client
// emits turn_anims_complete the instant every animation settles and the
// server advances to the next player synchronously — no 2 s timer, no manual
// click required.

{
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a] = game.players;
  for (const p of game.players) p.startPickPending = false;

  // Initial state from _scheduleAutoEnd: flag set, long safety net armed.
  game.diceRolled = true;
  game._scheduleAutoEnd(a, 99999, 2000);
  assert(game.autoEndDelay === true, "autoEndDelay flag set after _scheduleAutoEnd");
  assert(game._autoEndFireTimer != null, "Long safety fire timer armed");
  const aIndex = game.currentPlayerIndex;
  const turnBefore = game.turn;

  // Signal arrives → turn advances immediately, all timers cleared.
  const ok = game.notifyAnimsComplete(a.id, turnBefore);
  assert(ok === true, "notifyAnimsComplete accepts the signal");
  assert(game.currentPlayerIndex !== aIndex, "Turn advanced immediately");
  assert(game.turn === turnBefore + 1, "gs.turn incremented exactly once");
  assert(game._autoEndFireTimer == null, "Safety fire timer cancelled");
  assert(game._autoEndTimer == null, "No display timer left behind");
  assert(game.autoEndDelay === false, "autoEndDelay cleared by endTurn");
  assert(game.diceRolled === false, "diceRolled reset for the next player");
}

{
  // Stale signals (wrong turn, wrong player, blocking overlays) are rejected
  // so a delayed packet can't accidentally skip someone's turn.
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a, b] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.diceRolled = true;
  const aIndex = game.currentPlayerIndex;
  const turnBefore = game.turn;
  assert(game.notifyAnimsComplete("nobody", turnBefore) === false, "Unknown socket rejected");
  assert(game.notifyAnimsComplete(b.id, turnBefore) === false, "Non-current player rejected");
  assert(game.notifyAnimsComplete(a.id, turnBefore + 5) === false, "Stale turn rejected");
  game.diceRolled = false;
  assert(game.notifyAnimsComplete(a.id, turnBefore) === false, "Pre-roll signal rejected");
  game.diceRolled = true;
  game.auction = { phase: "pitch" };
  assert(game.notifyAnimsComplete(a.id, turnBefore) === false, "A live auction blocks the signal");
  game.auction = null;
  game.superBananaWin = { phase: "found", playerId: a.id };
  assert(game.notifyAnimsComplete(a.id, turnBefore) === false, "An in-progress Super Banana win blocks the signal");
  game.superBananaWin = null;
  assert(game.currentPlayerIndex === aIndex, "Turn did NOT advance from any rejected signal");
  assert(game.turn === turnBefore, "gs.turn unchanged after rejected signals");
  game._cancelAutoEnd();
}

// ============================================================
section("74. Classic - Hidden grow is dormant on a roll");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.revealedTiles = new Set();
  game.lastGrowFired = null;

  let growPos = -1;
  for (let i = 0; i < 48; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos >= 0) {
    const n = 3;
    game.growTileLabels = game.growTileLabels || new Map();
    for (const [pos, lbl] of [...game.growTileLabels]) {
      if (lbl === n) game.growTileLabels.delete(pos);
    }
    game.growTileLabels.set(growPos, n);
    // Stand clear of the grow so this is a roll, not a landing.
    cur.position = (growPos + 5) % 48;
    // Own a farm in range so a successful fire actually grows bananas — the
    // glow (lastGrowFired) now records only when something grew.
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (growPos + off) % game.boardSize;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "farm" && pos !== cur.position) { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      cur.properties = [farmPos];
      const fp = game.properties.get(farmPos);
      fp.owner = cur.id;
      fp.bananaPile = 0;
      for (const p of game.players) p.revealedTiles.add(farmPos);
    }

    // Hidden grow + roll its number -> dormant: no fire, no reveal.
    game._processRolledGrow(cur, n);
    assert(!game.lastGrowFired, "Hidden grow does not fire when its number is rolled");
    assert(!cur.revealedTiles.has(growPos), "Rolling does not reveal a hidden grow tile");
    assert(
      game.players.every((p) => !p.revealedTiles.has(growPos)),
      "Hidden grow stays hidden for everyone after a roll",
    );

    // Reveal it (as landing would), then roll its number -> now it fires and grows.
    cur.revealedTiles.add(growPos);
    game._processRolledGrow(cur, n);
    assert(
      game.lastGrowFired && game.lastGrowFired.includes(growPos),
      "A revealed grow fires (and glows) when its number is rolled",
    );
  }
}

// ============================================================
section("77. Classic - Grow glows only when it grows stuff");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); }

  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos >= 0) {
    // No owned farms → landing fires the grow but grows nothing → no glow.
    cur.properties = [];
    cur.position = growPos;
    game.lastGrowFired = null;
    game._fireGrowAt(cur, growPos, "land");
    assert(!game.lastGrowFired, "A grow that grows 0 bananas does NOT glow");

    // Now own a farm in range and keep opponents off it → it grows → it glows.
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (growPos + off) % game.boardSize;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "farm") { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      cur.properties = [farmPos];
      const fp = game.properties.get(farmPos);
      fp.owner = cur.id;
      fp.bananaPile = 0;
      for (const p of game.players) p.revealedTiles.add(farmPos);
      cur.position = growPos; // stand on the grow, not the farm
      for (const p of game.players) if (p.id !== cur.id) p.position = growPos;
      game.lastGrowFired = null;
      game._fireGrowAt(cur, growPos, "land");
      assert(fp.bananaPile > 0, "The in-range farm actually grew");
      assert(
        game.lastGrowFired && game.lastGrowFired.includes(growPos),
        "A grow that grows bananas DOES glow",
      );
    }
  }
}

// ============================================================
section("77b. Classic - Grow fires on the dice SUM, not the faces");
// ============================================================

{
  // The GROW whose label equals the dice SUM fires (once). Sums with no matching
  // grow label (e.g. 7-12, since labels are 1-6) fire nothing.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); }

  const n = 5; // we'll label a grow 5 and match it with a sum of 5
  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos >= 0) {
    game.growTileLabels = game.growTileLabels || new Map();
    for (const [pos, lbl] of [...game.growTileLabels]) {
      if (lbl === n) game.growTileLabels.delete(pos);
    }
    game.growTileLabels.set(growPos, n);
    // Genuinely reveal the grow (rolled grows are dormant until discovered).
    for (const p of game.players) p.revealedTiles.add(growPos);

    // Own one farm in range, keep opponents off it, and stand clear of it.
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (growPos + off) % game.boardSize;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "farm") { farmPos = pos; break; }
    }
    const fp = game.properties.get(farmPos);
    fp.owner = cur.id; cur.properties = [farmPos];
    for (const p of game.players) p.revealedTiles.add(farmPos);
    // Stand on the grow tile itself — (growPos + 2) can be the farm when the
    // shuffle puts a non-farm at growPos + 1, and standing on your own farm
    // early-picks the growth, leaving the pile at 0.
    cur.position = growPos;
    for (const p of game.players) if (p.id !== cur.id) p.position = (growPos + 24) % game.boardSize;

    // A SUM of 5 fires G5.
    fp.bananaPile = 0;
    game.lastGrowFired = null;
    game._processRolledGrow(cur, 5);
    assert(
      game.lastGrowFired && game.lastGrowFired.includes(growPos),
      "Dice sum of 5 fires the G5 grow",
    );
    assert(fp.bananaPile > 0, "The in-range farm grew on the sum match");

    // A SUM of 9 (e.g. 4+5) matches no grow label (1-6), so nothing fires —
    // confirming matching is by SUM, not by the individual faces (4 or 5).
    fp.bananaPile = 0;
    game.lastGrowFired = null;
    game._processRolledGrow(cur, 9);
    assert(!game.lastGrowFired, "Dice sum of 9 fires no grow (labels are 1-6)");
    assert(fp.bananaPile === 0, "Sum 9 grew nothing");
  }
}

// ============================================================
section("77c. Classic - One-grow global fire grows ALL farms, even a desynced one");
// ============================================================
// User-reported bug: early in a game with only one grow tile revealed, the
// "last" farm sometimes failed to grow, especially when it was recently
// bought. The chain range is correct (whole board minus the grow tile), so
// every owned farm should grow. To make sure the chain can't be silently
// skipped by a desync between `prop.owner` and `player.properties`, the grow
// iteration walks the canonical properties map. This test simulates that
// desync (a farm with owner set but missing from `player.properties`) and
// asserts it STILL grows.

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.startPickPending = false; p.revealedTiles = new Set(); }

  // Pick one grow position, force its label to a known value, reveal it to
  // everyone. Make sure no other grow is revealed.
  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos < 0) throw new Error("no grow tile");
  const label = 3;
  for (const [pos, lbl] of [...game.growTileLabels]) {
    if (lbl === label && pos !== growPos) game.growTileLabels.delete(pos);
  }
  game.growTileLabels.set(growPos, label);
  for (const p of game.players) p.revealedTiles.add(growPos);

  // Find three farm positions: one near the grow tile (likely "last in chain"
  // visually, since it's right before growPos going backward) and two further
  // away.
  const findFarm = (skipSet) => {
    for (let i = 0; i < game.boardSize; i++) {
      if (skipSet.has(i)) continue;
      if (game.board[i].type !== "property") continue;
      const p = game.properties.get(i);
      if (p && p.group === "farm") return i;
    }
    return -1;
  };
  const oldFarmA = findFarm(new Set([growPos]));
  const oldFarmB = findFarm(new Set([growPos, oldFarmA]));
  // Recently-bought farm: right BEFORE growPos going clockwise (== growPos - 1)
  // is typically the last tile in the chain animation order.
  const recentFarmPos = (growPos - 1 + game.boardSize) % game.boardSize;
  // Skip if it isn't a farm — pick the nearest farm before growPos instead.
  let recentFarm = recentFarmPos;
  for (let off = 1; off < game.boardSize; off++) {
    const p = (growPos - off + game.boardSize) % game.boardSize;
    if (game.board[p].type === "property") { recentFarm = p; break; }
  }

  // Own the two "old" farms via player.properties + prop.owner (normal path).
  for (const pos of [oldFarmA, oldFarmB]) {
    const prop = game.properties.get(pos);
    prop.owner = cur.id;
    prop.bananaPile = 0;
    cur.properties.push(pos);
  }
  // Simulate a DESYNC for the "recently bought" farm: prop.owner is set but
  // it never made it into cur.properties (the user-reported symptom).
  {
    const prop = game.properties.get(recentFarm);
    prop.owner = cur.id;
    prop.bananaPile = 0;
    // Intentionally NOT pushing into cur.properties.
  }

  // Owned farms are revealed in real play — reveal all three.
  for (const pos of [oldFarmA, oldFarmB, recentFarm]) {
    for (const p of game.players) p.revealedTiles.add(pos);
  }

  // Move player off any owned farm so no early-pickup interference.
  cur.position = growPos; // standing on the grow tile is harmless

  // Fire the grow.
  game._processRolledGrow(cur, label);

  // Every farm owned by `cur` (including the desynced one) should have grown.
  for (const pos of [oldFarmA, oldFarmB, recentFarm]) {
    const prop = game.properties.get(pos);
    assert(
      prop.bananaPile === prop.price,
      `Farm at ${pos} (price ${prop.price}) grew (pile=${prop.bananaPile})`,
    );
  }
  assert(
    game.diceMatchTiles && game.diceMatchTiles.includes(recentFarm),
    "Recently-bought (desynced) farm is included in diceMatchTiles",
  );
}

// ============================================================
section("79. Ghost players - leave, auction");
// ============================================================
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b, c] = game.players;
  a.clientId = "dev-a";

  // A farm to keep through ghosting.
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = a.id;
  a.properties = [farmPos];
  a.money = 1234;
  a.rollCards = [1, 2, 3];

  assert(game.makeGhost(a.id) === true, "makeGhost flags a mid-game leaver");
  assert(a.ghost === true, "Player is now a ghost");
  assert(a.money === 1234 && a.properties.includes(farmPos), "Ghost keeps money + farms");
  assert(JSON.stringify(a.rollCards) === "[1,2,3]", "Ghost keeps its guaranteed-roll cards");
  assert(!game._eligibleBidderIds().includes(a.id), "Ghost is excluded from bidding in auctions");

  // Ghost lander prices a found tile at 0 → the others sealed-bid.
  let unowned = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && !pr.owner && i !== farmPos) { unowned = i; break; }
  }
  a.position = unowned;
  b.money = 500; c.money = 500;
  const opened = game._createAuctionForLander(a.id);
  assert(opened === true, "Ghost-found farm opens an auction");
  assert(game.auction && game.auction.sealedBid === true, "Ghost lander triggers a sealed bid");
  assert(!game.auction.bidders.includes(a.id), "Ghost is not a bidder in its own found-tile auction");
  if (game._auctionTimer) { clearTimeout(game._auctionTimer); game._auctionTimer = null; }
  game.auction = null;
}

// ============================================================
section("79b. Ghost reconnect rebinds the player id everywhere");
// ============================================================
{
  // 3 players so the leaver doesn't instantly concede the game (79d).
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a] = game.players;
  a.clientId = "dev-reconnect";
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = a.id;
  a.properties = [farmPos];
  const oldId = a.id;
  game.makeGhost(a.id);

  const rejoined = game.reconnectByClientId("new-socket-xyz", "dev-reconnect");
  assert(rejoined && rejoined.id === "new-socket-xyz", "reconnectByClientId rebinds to the new socket id");
  assert(a.ghost === false, "Reconnected player is no longer a ghost");
  assert(game.properties.get(farmPos).owner === "new-socket-xyz", "Farm ownership rebound to the new id");
  assert(game.players.find((p) => p.id === oldId) === undefined, "Old socket id no longer exists");
  assert(game.reconnectByClientId("another-socket", "dev-reconnect") === null, "No ghost to reclaim after reconnect");
}

// ============================================================
section("79c. Ghost landing is a plain no-op (no swipe, no transfer)");
// ============================================================
{
  // A LIVE player landing on a ghost does nothing special — the ghost keeps its
  // runes (the old rune-swipe was retired with the Rune Duel).
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.rollCards = [2, 4];
  live.rollCards = [1, 1, 1];
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = gh.id; // owned → no auction interference
  gh.position = farmPos;
  live.position = farmPos;
  game._processLanding(live, true);
  assert(live.rollCards.length === 3 && gh.rollCards.length === 2, "Live lander takes nothing from the ghost");
}
{
  // A GHOST landing on a live player does nothing either.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.rollCards = [2, 4];
  live.rollCards = [1, 1, 1];
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = live.id; // owned by live → no auction
  live.position = farmPos;
  gh.position = farmPos;
  game._processLanding(gh, true);
  assert(live.rollCards.length === 3 && gh.rollCards.length === 2, "Nothing transfers when a ghost lands on you");
}

// ============================================================
section("79d. Last live monkey among ghosts wins instantly");
// ============================================================
{
  // Classic, 3 players: two ghost out → the last live monkey wins on the spot.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b, c] = game.players;
  game.makeGhost(b.id);
  assert(game.state === "playing", "Two live players left — no win");
  game.makeGhost(c.id);
  assert(game.state === "finished" && game.lastStandingWinner === a.id, "Last live monkey wins instantly");
  assert(a.revealedTiles.size === game.boardSize, "All tiles revealed on the ghost-concede win");
}
{
  // 1v1: a leaver concedes immediately.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b] = game.players;
  game.makeGhost(a.id);
  assert(game.state === "finished" && game.lastStandingWinner === b.id, "1v1 leaver hands the win instantly");
}
{
  // One ghost among two live players: game continues and the ghost can return.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a] = game.players;
  a.clientId = "dev-llw";
  game.makeGhost(a.id);
  assert(game.state === "playing", "Two live players remain — game continues");
  const back = game.reconnectByClientId("llw-socket", "dev-llw");
  assert(back && !back.ghost, "Ghost reconnects and resumes control");
  assert(game.state === "playing", "Game continues after the reconnect");
}

// ============================================================
section("80. Super Banana stays hidden until landed on (no auto-expose)");
// ============================================================
{
  // Even when the Super Banana is the LAST hidden tile it is NOT auto-revealed
  // -- the process-of-elimination expose was removed. You only find it by landing.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a] = game.players;
  for (const p of game.players) p.startPickPending = false;
  let sbPos = null;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbPos = pos; break; }
  }
  for (let i = 0; i < game.boardSize; i++) {
    if (i === sbPos) continue;
    for (const p of game.players) p.revealedTiles.add(i);
  }
  game.currentPlayerIndex = game.players.indexOf(a);
  game.diceRolled = true;
  game.endTurn(a.id);
  assert(
    !game._isGenuinelyRevealed(sbPos),
    "80: the SB is NOT auto-exposed even as the last hidden tile",
  );
  assert(
    typeof game._maybeExposeSuperBanana === "undefined",
    "80: the auto-expose function is removed",
  );
}

// ============================================================
section("82. Landing-grow growth behind the walker stays on the farm");
// ============================================================
// rules.md: a grow you LAND on fires AFTER you arrive, and own-farm piles are
// collected only by crossing/landing DURING a move. So when a wrapped chain
// (one revealed grow) grows farms the player walked over THIS turn, those
// piles must remain on the farms - they sprouted after the move ended.
// (Regression: rollDice used to retroactively sweep them into money, making
// the end of the chain look like it never grew.)

function _forceDice(values) {
  const seq = [...values];
  const orig = Math.random;
  Math.random = () => ((seq.shift() - 1 + 0.5) / 6);
  return () => { Math.random = orig; };
}

function _setupOneGrowBoard(game, label) {
  const cur = game.getCurrentPlayer();
  for (const p of game.players) p.revealedTiles = new Set();
  let growPos = -1;
  for (const [pos] of game.growTileLabels) { if (pos >= 10) { growPos = pos; break; } }
  for (const [pos, lbl] of [...game.growTileLabels]) {
    if (pos !== growPos && lbl === label) game.growTileLabels.set(pos, label === 1 ? 2 : 1);
  }
  game.growTileLabels.set(growPos, label);
  for (const p of game.players) p.revealedTiles.add(growPos);
  const isFarm = (i) => { const pr = game.properties.get(i); return pr && pr.group === "farm"; };
  const endFarms = []; // just before the grow tile = end of a wrapped chain
  for (let off = 1; off <= 4 && endFarms.length < 2; off++) {
    const p = (growPos - off + game.boardSize) % game.boardSize;
    if (isFarm(p)) endFarms.push(p);
  }
  const farFarms = []; // well past the grow tile = start of the chain
  for (let off = 10; off <= 20 && farFarms.length < 2; off++) {
    const p = (growPos + off) % game.boardSize;
    if (isFarm(p)) farFarms.push(p);
  }
  for (const pos of [...endFarms, ...farFarms]) {
    const prop = game.properties.get(pos);
    prop.owner = cur.id; prop.bananaPile = 0;
    cur.properties.push(pos);
    for (const p of game.players) p.revealedTiles.add(pos);
  }
  return { cur, growPos, endFarms, farFarms };
}

{
  // Landing fire only (sum 7 != label 2): every owned farm in the wrapped
  // chain keeps its fresh pile, including the ones the player walked over.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const { cur, growPos, endFarms, farFarms } = _setupOneGrowBoard(game, 2);
  game.players.find((p) => p.id !== cur.id).position = (growPos + 30) % game.boardSize;
  cur.position = (growPos - 7 + game.boardSize) % game.boardSize;
  const moneyBefore = cur.money;
  const restore = _forceDice([3, 4]);
  try { game.rollDice(cur.id, 2); } finally { restore(); }
  game._cancelAutoEnd();
  assert(cur.position === growPos, "Walker landed exactly on the grow tile");
  for (const f of farFarms) {
    const prop = game.properties.get(f);
    assert(prop.bananaPile === prop.price, `Chain-start farm ${f} grew and keeps its pile`);
  }
  for (const f of endFarms) {
    const prop = game.properties.get(f);
    assert(prop.bananaPile === prop.price, `Walked-over farm ${f} KEEPS its landing-grow pile (was retro-collected)`);
  }
  assert(cur.money === moneyBefore, "No silent money credit from the landing grow");
}

{
  // Rolled (pre-move) fire still collects normally: the player walks over /
  // lands on a farm that grew BEFORE the move, pocketing those piles only.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const { cur, growPos, endFarms, farFarms } = _setupOneGrowBoard(game, 5);
  game.players.find((p) => p.id !== cur.id).position = (growPos + 30) % game.boardSize;
  const landFarm = farFarms[0];
  // Grow-match rule: sum 5 fires the revealed GROW 5, so the player hops 7-5=2.
  // Position the player so the 2-tile hop lands exactly on their own farm.
  const hop = 7 - 5;
  cur.position = (landFarm - hop + game.boardSize) % game.boardSize;
  const moneyBefore = cur.money;
  const restore = _forceDice([2, 3]); // sum 5 = label -> fires pre-move
  try { game.rollDice(cur.id, 2); } finally { restore(); }
  game._cancelAutoEnd();
  assert(cur.position === landFarm, "Walker hopped 7-sum and landed on their own farm");
  const landProp = game.properties.get(landFarm);
  const crossed = [];
  for (let s = 1; s <= hop; s++) {
    const pos = (cur.position - s + game.boardSize) % game.boardSize;
    if ([...endFarms, ...farFarms].includes(pos) && pos !== landFarm) crossed.push(pos);
  }
  let expected = landProp.price;
  for (const pos of crossed) expected += game.properties.get(pos).price;
  assert(landProp.bananaPile === 0, "Pre-move growth on the landing farm was collected");
  assert(cur.money - moneyBefore === expected, `Walk collected exactly the crossed pre-move piles (${expected})`);
  for (const f of endFarms) {
    const prop = game.properties.get(f);
    if (!crossed.includes(f)) assert(prop.bananaPile === prop.price, `Uncrossed farm ${f} keeps its pile`);
  }
}

// ============================================================
section("82c. A played Spell Card fires its GROW and moves 7 - value");
// ============================================================
{
  // Runes use the subtract base 7: playing a rune of value N fires the REVEALED
  // grow N (if any) and moves 7 - N.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const { cur, growPos, farFarms } = _setupOneGrowBoard(game, 4);
  game.players.find((p) => p.id !== cur.id).position = (growPos + 30) % game.boardSize;
  const landFarm = farFarms[0];
  const hop = 7 - 4; // rune value 4 fires the revealed GROW 4 and moves 7-4=3
  cur.position = (landFarm - hop + game.boardSize) % game.boardSize;
  cur.revealedTiles.add(cur.position);
  cur.rollCards = [4];
  game.diceRolled = false;
  cur.hasRolled = false;
  playCard(game, cur.id, 0);
  game._cancelAutoEnd();
  assert(cur.position === landFarm, "Rune value 4 fired revealed GROW 4 and moved 7-4=3 onto the farm");
  assert(game.properties.get(landFarm).bananaPile === 0, "Hop-landing farm pile collected (rune path)");
}

// ============================================================
section("83. Pitch cap with 3 players (richest opponent's bank)");
// ============================================================
// Pins down the pitch-cap behavior a code audit flagged as suspect; it's
// correct today, these keep it that way.

{
  // rules.md: max pitch = the RICHEST opponent's total. 3 players so the cap
  // and the lander's own bank are distinct numbers.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const [p0, p1, p2] = game.players;
  p0.money = 1000;
  p1.money = 300;
  p2.money = 600;
  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group === "farm") { propPos = i; break; }
  }
  const prop = game.properties.get(propPos);
  game.auction = {
    position: propPos,
    propName: prop.name,
    propPrice: prop.price,
    propGroup: prop.group || null,
    landingPlayer: p0.id,
    bidders: [p0.id, p1.id, p2.id],
    bids: {
      [p0.id]: { amount: 0, placed: false, passed: false },
      [p1.id]: { amount: 0, placed: false, passed: false },
      [p2.id]: { amount: 0, placed: false, passed: false },
    },
    phase: "pitch",
    highBid: 0,
    highBidder: null,
  };
  assert(!game.placeBid(p0.id, 601), "Pitch just above the richest opponent (600) rejected");
  assert(!game.placeBid(p0.id, 999), "Pitch between the cap and the lander's own bank rejected");
  assert(game.placeBid(p0.id, 600), "Pitch AT the richest opponent's bank accepted");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
}

{
  // A lander poorer than the cap is bound by their own bank first (they may
  // end up paying the pitch themselves).
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const [p0, p1, p2] = game.players;
  p0.money = 400;
  p1.money = 300;
  p2.money = 600;
  let propPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group === "farm") { propPos = i; break; }
  }
  const prop = game.properties.get(propPos);
  game.auction = {
    position: propPos,
    propName: prop.name,
    propPrice: prop.price,
    propGroup: prop.group || null,
    landingPlayer: p0.id,
    bidders: [p0.id, p1.id, p2.id],
    bids: {
      [p0.id]: { amount: 0, placed: false, passed: false },
      [p1.id]: { amount: 0, placed: false, passed: false },
      [p2.id]: { amount: 0, placed: false, passed: false },
    },
    phase: "pitch",
    highBid: 0,
    highBidder: null,
  };
  assert(!game.placeBid(p0.id, 500), "Pitch above the lander's own bank rejected");
  assert(game.placeBid(p0.id, 400), "Pitch at the lander's full bank accepted");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
}

// ============================================================
section("85f. 3v3 mode — teams, turn order, colors, 6-player classic");
// ============================================================
{
  // 3v3 builds two teams of three and interleaves turn order A,B,A,B,A,B.
  const { game } = createStartedGame(6, { gameMode: "3v3", startingMoney: 5000 });
  assert(game._isTeams() && game._teamSize() === 3 && game._teamPlayerCount() === 6, "3v3: team helpers");
  assert(game.maxPlayers === 6, "3v3: forces 6 players");
  assert(game.teams.A.length === 3 && game.teams.B.length === 3, "3v3: two teams of three");
  // Turn order alternates teams across the seating.
  const seatTeams = game.players.map((p) => game.getTeamOf(p.id));
  let alternates = true;
  for (let i = 1; i < seatTeams.length; i++) if (seatTeams[i] === seatTeams[i - 1]) alternates = false;
  assert(alternates, "3v3: turn order alternates between teams (A,B,A,B,A,B)");
  // Each player has a distinct color and every team member is on the same team.
  const cols = new Set(game.players.map((p) => p.color));
  assert(cols.size === 6, "3v3: six distinct colors");
}

{
  // 3v3 cannot start without exactly 6 players.
  const g = new MonkeyBusinessGame("T2", 6, 5000, "3v3", true, true);
  for (let i = 0; i < 5; i++) g.addPlayer(`q${i}`, `Q${i}`);
  assert(g.startGame("q0") === false, "3v3: won't start with 5 players");
  g.addPlayer("q5", "Q5");
  assert(g.startGame("q0") === true, "3v3: starts with the 6th player");
}

{
  // Free-for-all now allows up to 6 players, including the purple & pink slots.
  const { game } = createStartedGame(6, { gameMode: "classic", maxPlayers: 6, startingMoney: 5000 });
  assert(game.maxPlayers === 6, "classic: 6 max players allowed");
  assert(game.players.length === 6, "classic: 6 players seated");
  const cols = new Set(game.players.map((p) => p.color));
  assert(cols.size === 6, "classic: six unique colors assigned");
  assert(cols.has("purple") && cols.has("pink"), "classic: purple & pink are in play with 6 players");
  assert(!game._isTeams() && !game.teams, "classic: no teams");
}

// ============================================================
section("85g. 3v3 farm auction — 3 opponents race, 2 teammates race");
// ============================================================
{
  // Opponents race (first of 3 to accept wins); if all reject, the 2 teammates
  // race (first to accept wins); if all reject, the lander keeps it.
  const { game } = createStartedGame(6, { gameMode: "3v3", startingMoney: 5000 });
  game.noAuctionTimer = true;
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  const lander = game.players.find((p) => p.id === game.teams.A[0]);
  const mates = game.teams.A.slice(1).map((id) => game.players.find((p) => p.id === id));
  const opps = game.players.filter((p) => game.getTeamOf(p.id) === "B");
  const farm = _findUnownedFarm(game);
  lander.position = farm;
  game._createAuctionForLander(lander.id);
  assert(game.auction.teamFlow && game.auction.phase === "pitch", "85g: 3v3 farm pitch");
  assert(game.auction.teammateIds.length === 2 && game.auction.oppIds.length === 3, "85g: 2 teammates, 3 opponents");
  game.placeBid(lander.id, 100);
  assert(game.auction.phase === "respondOpp" && game.auction.affOppIds.length === 3, "85g: 3 opponents race");
  game.respondAuction(opps[0].id, false);
  game.respondAuction(opps[1].id, false);
  game.respondAuction(opps[2].id, false);
  assert(game.auction.phase === "teammateFinal" && game.auction.affMateIds.length === 2, "85g: all opponents passed → 2 teammates race");
  const m1Before = mates[1].money;
  assert(game.respondAuction(mates[1].id, true) === true, "85g: second teammate accepts first");
  assert(game.properties.get(farm).owner === mates[1].id && mates[1].money === m1Before - 100, "85g: that teammate buys at the pitched price");
  game._cancelAutoEnd();
}

{
  // All teammates also reject → the lander keeps the farm at the pitched price.
  const { game } = createStartedGame(6, { gameMode: "3v3", startingMoney: 5000 });
  game.noAuctionTimer = true;
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  const lander = game.players.find((p) => p.id === game.teams.A[0]);
  const mates = game.teams.A.slice(1).map((id) => game.players.find((p) => p.id === id));
  const opps = game.players.filter((p) => game.getTeamOf(p.id) === "B");
  const farm = _findUnownedFarm(game);
  lander.position = farm;
  game._createAuctionForLander(lander.id);
  game.placeBid(lander.id, 100);
  opps.forEach((o) => game.respondAuction(o.id, false));
  const lBefore = lander.money;
  game.respondAuction(mates[0].id, false);
  assert(game.respondAuction(mates[1].id, false) === true, "85g2: both teammates pass");
  assert(game.properties.get(farm).owner === lander.id && lander.money === lBefore - 100, "85g2: lander keeps it at the pitched price");
  game._cancelAutoEnd();
}

// ============================================================
section("85h. Fog of war is enforced server-side (hidden tiles redacted in getState)");
// ============================================================
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const p0 = game.players[0], p1 = game.players[1];
  // Find the (hidden) Super Banana internally.
  let sb = -1;
  for (const [pos, prop] of game.properties) if (prop.group === "superBanana") { sb = pos; break; }
  assert(sb >= 0, "85h: SB exists");
  assert(!p1.revealedTiles.has(sb), "85h: opponent hasn't revealed the SB");
  const st = game.getState(p1.id);
  // The SB's location must NOT be in the opponent's payload.
  assert(!st.properties.some((pr) => pr.group === "superBanana"), "85h: SB not leaked in properties");
  assert(!st.boardLayout.some((t) => t.group === "superBanana" || t.type === "special"), "85h: SB not leaked in boardLayout");
  assert(st.boardLayout[sb].type === "hidden", "85h: unrevealed SB tile is type 'hidden'");
  const hp = st.properties.find((pr) => pr.id === sb);
  assert(hp && hp.hidden === true && hp.name === null && hp.price === null && hp.group === null, "85h: hidden property fully redacted");
  // Composition is still public (location-free): exactly one SB + one desert.
  assert(st.boardComposition && st.boardComposition.special === 1 && st.boardComposition.desert === 1, "85h: boardComposition reports 1 SB + 1 desert");
  // Farms are type "property" spaces (regression: the count was always 0 because
  // the loop matched space.type, but farm spaces are type "property"). It must equal
  // the real farm-group property count, fog-independent.
  const realFarms = (() => { let n = 0; for (let i = 0; i < game.boardSize; i++) { const pr = game.properties.get(i); if (pr && pr.group === "farm") n++; } return n; })();
  assert(realFarms > 0 && st.boardComposition.farm === realFarms, "85h: boardComposition.farm counts all farms (was a 0 regression)");
  // A tile the viewer HAS revealed shows full content.
  let farm = -1;
  for (let i = 0; i < game.boardSize; i++) { const pr = game.properties.get(i); if (pr && pr.group === "farm") { farm = i; break; } }
  p1.revealedTiles.add(farm);
  const st2 = game.getState(p1.id);
  assert(st2.boardLayout[farm].group === "farm" && st2.boardLayout[farm].type !== "hidden", "85h: revealed farm shows content in boardLayout");
  assert((st2.properties.find((pr) => pr.id === farm) || {}).group === "farm", "85h: revealed farm shows content in properties");
}

{
  // The grow-animation channel (diceMatch* fields) is also fog-redacted: a
  // player growing their own (hidden-to-the-viewer) farm must not leak its
  // position or yield to a non-revealing opponent.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const p0 = game.players[0], p1 = game.players[1];
  let farm = -1;
  for (let i = 0; i < game.boardSize; i++) { const pr = game.properties.get(i); if (pr && pr.group === "farm") { farm = i; break; } }
  p0.revealedTiles.add(farm); // revealed to p0 only
  game.diceMatchTiles = [farm];
  game.diceMatchGrownAmounts = { [farm]: 17 };
  game.diceMatchEarlyPickup = farm;
  const stOwner = game.getState(p0.id);
  const stOther = game.getState(p1.id);
  assert(stOwner.diceMatchTiles.includes(farm) && stOwner.diceMatchGrownAmounts[farm] === 17, "85h: grow animation shows for a viewer who revealed the farm");
  assert(!stOther.diceMatchTiles.includes(farm), "85h: hidden farm position not leaked via diceMatchTiles");
  assert(!(String(farm) in (stOther.diceMatchGrownAmounts || {})), "85h: hidden farm yield not leaked via diceMatchGrownAmounts");
  assert(stOther.diceMatchEarlyPickup !== farm, "85h: hidden early-pickup tile not leaked via diceMatchEarlyPickup");
}

{
  // Leave-shuffle: pendingTileShuffles / lastTileShuffle positions are fog-filtered.
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const viewer = game.players[0];
  game.pendingTileShuffles = [{ color: "brown", leavingName: "X", positions: [11, 12], endsAt: 0 }];
  game.lastTileShuffle = { positions: [11, 12], ts: 1 };
  // viewer revealed only tile 11.
  viewer.revealedTiles.add(11);
  const stv = game.getState(viewer.id);
  assert(JSON.stringify(stv.pendingTileShuffles[0].positions) === "[11]", "85h: pendingTileShuffles positions filtered to revealed (11 kept, 12 dropped)");
  assert(JSON.stringify(stv.lastTileShuffle.positions) === "[11]", "85h: lastTileShuffle positions filtered to revealed");
  assert(stv.lastTileShuffle.ts === 1, "85h: shuffle sound stamp (ts) preserved");
}

// ============================================================
section("85i. Audit fixes (pitch cap, ghost cancel, refunds, reconnect, reset)");
// ============================================================
{
  // Team pitch cap counts OPPONENTS only, not the lander's teammate.
  const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: 5000 });
  game.noAuctionTimer = true;
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  const lander = game.players.find((p) => p.id === game.teams.A[0]);
  const mate = game.players.find((p) => p.id === game.teams.A[1]);
  const opps = game.players.filter((p) => game.getTeamOf(p.id) === "B");
  lander.money = 5000; mate.money = 5000; opps[0].money = 200; opps[1].money = 300;
  const farm = _findUnownedFarm(game);
  lander.position = farm;
  game._createAuctionForLander(lander.id);
  assert(game.placeBid(lander.id, 301) === false, "85i: can't pitch above the richest OPPONENT (300), even though teammate has 5000");
  assert(game.placeBid(lander.id, 300) === true, "85i: can pitch up to the richest opponent");
  game._cancelAutoEnd();
}

// (The old cancel ghost/reconnect sub-tests were removed with the cancel system;
// the Predict bluff's ghost handling is covered in section 68c + the fuzz driver.)

{
  // _resetToLobby clears the transient global-toast fields.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  game.lastCancelResult = { casterName: "x", targetName: "y", landed: true, seq: 1 };
  game.state = "finished";
  for (const p of game.players) game.playerReadyForLobby(p.id);
  assert(
    game.lastCancelResult == null,
    "85i: _resetToLobby cleared the transient global-toast fields",
  );
}

// ============================================================
section("86. Ghosts are ignored in richest-opponent pricing (pitch cap / Buy Now)");
// ============================================================
// Ruling 2026-06-10: ghosts are not part of auctions, so they don't count in
// the "richest opponent" calculation — pitch caps and the Buy Now price use
// live (non-ghost) opponents only.

{
  // Farm pitch cap ignores a rich ghost.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const [p0, p1, p2] = game.players;
  p0.money = 1000;
  p1.money = 5000;
  p1.ghost = true;
  p2.money = 600;
  p0.position = _findUnownedFarm(game);
  assert(game._createAuctionForLander(p0.id) === true, "Pitch auction opened with a ghost at the table");
  assert(!game.placeBid(p0.id, 601), "Pitch above the richest LIVE opponent rejected (ghost's 5000 ignored)");
  assert(game.placeBid(p0.id, 600), "Pitch at the richest live opponent's bank accepted");
  if (game._auctionTimer) { clearTimeout(game._auctionTimer); game._auctionTimer = null; }
  game.auction = null;
  game._cancelAutoEnd();
}

{
  // Buy Now prices off the richest LIVE opponent; a richer ghost neither
  // blocks the offer nor inflates the price.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const [p0, p1, p2] = game.players;
  p0.money = 1000;
  p1.money = 5000;
  p1.ghost = true;
  p2.money = 600;
  const farm = _findUnownedFarm(game);
  p0.position = farm;
  game._createAuctionForLander(p0.id);
  assert(game._buyNowPrice(p0.id) === 601, "Buy Now = richest live opponent + 1 (ghost doesn't block or price it)");
  assert(game.auctionBuyNow(p0.id) === true, "Richest live lander can Buy Now past a richer ghost");
  assert(game.properties.get(farm).owner === p0.id, "Buy Now: lander owns the farm");
  assert(p0.money === 1000 - 601, "Buy Now: lander paid richest live opponent + 1");
  game._cancelAutoEnd();
}

{
  // Every opponent a ghost -> only one eligible bidder, lander takes it free.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  game.noAuctionTimer = true;
  const [p0, p1, p2] = game.players;
  p0.money = 1000;
  p1.ghost = true;
  p2.ghost = true;
  const farm = _findUnownedFarm(game);
  p0.position = farm;
  assert(game._createAuctionForLander(p0.id) === false, "No auction when every opponent is a ghost");
  assert(game.properties.get(farm).owner === p0.id, "Lone live player claimed the farm for free");
  game._cancelAutoEnd();
}

// ============================================================
section("90. Seeded full-game fuzz — random play upholds global invariants");
// ============================================================
// Plays whole games through the public API with seeded randomness (Math.random
// is swapped for a PRNG, so runs are deterministic — see the flaky-test note in
// the 06-10 summaries). Invariants checked all game long: integer money, legal
// positions, property<->owner consistency, getState serializes for every
// viewer, and the game never deadlocks (some action always succeeds until it
// finishes or the step budget runs out).

function _fuzzRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function _fuzzInvariants(game, violations, deep) {
  for (const p of game.players) {
    if (!Number.isInteger(p.money))
      violations.add(`non-integer money ${p.money} (${p.name})`);
    if (!Number.isInteger(p.position) || p.position < 0 || p.position >= game.boardSize)
      violations.add(`bad position ${p.position} (${p.name})`);
  }
  for (const [pos, prop] of game.properties) {
    if (!prop.owner) continue;
    const o = game.players.find((q) => q.id === prop.owner);
    if (!o) violations.add(`tile ${pos} owned by unknown ${prop.owner}`);
    else if (!o.properties.includes(pos))
      violations.add(`tile ${pos} missing from ${o.name}'s property list`);
  }
  for (const p of game.players) {
    for (const pos of p.properties) {
      const prop = game.properties.get(pos);
      if (!prop || prop.owner !== p.id)
        violations.add(`${p.name} lists tile ${pos} they don't own`);
    }
  }
  if (deep) {
    for (const p of game.players) {
      try {
        JSON.stringify(game.getState(p.id));
      } catch (e) {
        violations.add(`getState(${p.name}) threw: ${e.message}`);
      }
    }
  }
  // rules.md (Leavers): a ghost never bids and never holds a phase open — a
  // ghost owing a response/top-up/pitch would stall a timer-off game forever.
  if (game.auction) {
    const a = game.auction;
    for (const id of a.bidders || []) {
      if (id === a.landingPlayer) continue;
      const p = game.players.find((q) => q.id === id);
      if (!p || !p.ghost) continue;
      const b = a.bids[id];
      if (a.phase === "respond" && b && !b.responded)
        violations.add(`ghost ${p.name} owes an auction response`);
      if (a.phase === "silentbid" && (a.acceptorIds || []).includes(id) && b && !b.submittedTopup)
        violations.add(`ghost ${p.name} owes a silent top-up`);
    }
  }
  // Banana conservation: bananas are created only by grows (ledger.minted)
  // and destroyed only by tracked sinks — auction/SB/bomb payments, trade
  // fees, vanished estates and wiped piles (ledger.burned). A live poker pot
  // is escrow. Any other change to the global total is a leak or a dupe.
  if (game.bananaLedger && (game.state === "playing" || game.state === "finished")) {
    let total = 0;
    for (const p of game.players) total += p.money;
    for (const [, prop] of game.properties) total += prop.bananaPile || 0;
    // (A Rune Duel never escrows bananas — the price is burned only on accept.)
    const L = game.bananaLedger;
    const expected = L.baseline + L.minted - L.burned;
    if (total !== expected)
      violations.add(
        `banana leak: on-board total ${total} != ${expected} (baseline ${L.baseline} + minted ${L.minted} - burned ${L.burned})`,
      );
  }
}

// Ghost support for the fuzz: the ghost driver schedules everything through
// _deferredSetTimeout, so capturing those callbacks in a queue and draining it
// synchronously plays ghost turns without real timers. Exceptions propagate
// (unlike the production wrapper) so they surface as fuzz violations.
function _fuzzGhostRig(game) {
  const q = [];
  game.__ghostQueue = q;
  game._deferredSetTimeout = (fn) => {
    q.push(fn);
    return 0;
  };
  game.players.forEach((p, i) => {
    p.clientId = `dev${i}`;
  });
}

function _fuzzFlushGhosts(game) {
  const q = game.__ghostQueue;
  if (!q || !q.length) return false;
  let n = 0;
  while (q.length && n < 80) {
    q.shift()();
    n++;
  }
  return true;
}

// One driver step: resolve whatever the game is waiting on, else play the
// current player's turn. Returns true if any API call succeeded.
function _fuzzStep(game, rng) {
  const ri = (n) => Math.floor(rng() * Math.max(1, n));

  // Queued ghost-driver callbacks run before anything else — they are what
  // production would have done first (on its timers).
  if (_fuzzFlushGhosts(game)) return true;

  // A missed cancel now DEFERS a CHOSEN 2-card discard to the caster when they
  // hold >2 cards (a real client pops a picker). Resolve it like a client would —
  // discard `need` random valid indices — so the gated caster can act on their
  // turn (otherwise the game deadlocks waiting on the unresolved pick).
  for (const p of game.players) {
    if (p.pendingCancelDiscard > 0) {
      const hand = Array.isArray(p.rollCards) ? p.rollCards.length : 0;
      const need = Math.min(p.pendingCancelDiscard, hand);
      const pool = [];
      for (let i = 0; i < hand; i++) pool.push(i);
      const picks = [];
      while (picks.length < need && pool.length) picks.push(pool.splice(ri(pool.length), 1)[0]);
      if (game.resolveCancelMissDiscard(p.id, picks)) return true;
    }
  }

  // A pending Super Banana teleport choice belongs to its lander; resolve it
  // like a client (sometimes hop to a random owned farm, sometimes stay put).
  if (game.sbTeleport) {
    const pid = game.sbTeleport.playerId;
    const farms = game.sbTeleport.farms || [];
    const dest = farms.length && rng() < 0.6 ? farms[ri(farms.length)] : null;
    if (game.resolveSbTeleport(pid, dest)) return true;
    return false;
  }

  if (game.auction) {
    const a = game.auction;
    if (a.phase === "pitch") {
      const lander = game.players.find((p) => p.id === a.landingPlayer);
      // A ghost lander has no client to pitch — the driver reprices at 0.
      if (lander && lander.ghost) {
        game._maybeDriveGhost();
        return game.auction !== a;
      }
      if (rng() < 0.08 && game.auctionBuyNow(a.landingPlayer)) return true;
      const amt = 1 + ri(Math.min(lander ? lander.money : 1, 600));
      return (
        game.placeBid(a.landingPlayer, amt) ||
        game.placeBid(a.landingPlayer, 1) ||
        game.placeBid(a.landingPlayer, 0)
      );
    }
    if (a.teamFlow) {
      // Team sequential: opponents race (respondOpp), then the teammate(s) race
      // (teammateFinal). Both phases iterate the affordable racer list.
      if (a.phase === "respondOpp" || a.phase === "teammateFinal") {
        const racers = a.phase === "respondOpp" ? a.affOppIds : a.affMateIds;
        for (const id of [...(racers || [])]) {
          if (!game.auction) return true;
          if ((game.players.find((p) => p.id === id) || {}).ghost) continue;
          const b = a.bids[id];
          if (!b || b.responded) continue;
          const acc = rng() < 0.5;
          if (game.respondAuction(id, acc) || game.respondAuction(id, !acc)) return true;
        }
        return false;
      }
      return false;
    }
    if (a.phase === "respond") {
      let progressed = false;
      for (const id of [...a.bidders]) {
        if (!game.auction) return true;
        if (id === a.landingPlayer) continue;
        if ((game.players.find((p) => p.id === id) || {}).ghost) continue;
        const b = a.bids[id];
        if (!b || b.responded) continue;
        const accept = rng() < 0.5;
        if (game.respondAuction(id, accept) || game.respondAuction(id, !accept)) {
          progressed = true;
          continue;
        }
        if (a.respondOpenedAt) {
          a.respondOpenedAt -= 6000; // 2v2 teammate anti-collusion gate
          if (game.respondAuction(id, accept)) progressed = true;
        }
      }
      return progressed;
    }
    if (a.phase === "silentbid") {
      let progressed = false;
      const ids = a.acceptorIds && a.acceptorIds.length ? a.acceptorIds : a.bidders;
      for (const id of [...ids]) {
        if (!game.auction) return true;
        if ((game.players.find((p) => p.id === id) || {}).ghost) continue;
        if (game.submitSilentBid(id, ri(400)) || game.submitSilentBid(id, 0))
          progressed = true;
      }
      return progressed;
    }
    return false;
  }

  const cur = game.getCurrentPlayer();
  if (!cur) return false;

  // Ghost turn: let the real driver act (it queues via _deferredSetTimeout).
  // If it has nothing to schedule (e.g. rolled, waiting on end-of-turn), fall
  // through — endTurn below is exactly what its auto-end timer would call.
  if (cur.ghost && game.__ghostQueue) {
    game._maybeDriveGhost();
    if (_fuzzFlushGhosts(game)) return true;
  }

  // Only the current player may take their start pick, and the pick counts as
  // the turn's roll — other players' picks wait for their own turns.
  if (cur.startPickPending) {
    for (let k = 0; k < 16; k++) {
      if (game.pickStartTile(cur.id, ri(game.boardSize))) return true;
    }
    return false;
  }

  if (!game.diceRolled) {
    // (The old cancel-cast fuzz path was removed with the cancel system. The
    // auto-commit wrapper resolves each turn's Predict window with all-"no".)
    // Sometimes TELEPORT to an owned farm instead of rolling (needs >=2 runes) —
    // routes the real teleport (inline own-pile harvest + _processLanding, or the
    // cancel-HIT default-dice roll) through the after-every-step banana-
    // conservation invariant.
    if (rng() < 0.15 && Array.isArray(cur.rollCards) && cur.rollCards.length >= 2) {
      const ownFarms = (cur.properties || []).filter((pos) => {
        const pr = game.properties.get(pos);
        return pr && pr.group === "farm" && pr.owner === cur.id;
      });
      if (ownFarms.length && game.teleportToFarm(cur.id, ownFarms[ri(ownFarms.length)])) {
        game._cancelAutoEnd();
        return true;
      }
    }
    // Sometimes play a spell card instead of rolling (when one is held).
    if (rng() < 0.25 && Array.isArray(cur.rollCards) && cur.rollCards.length) {
      if (playCard(game, cur.id, ri(cur.rollCards.length))) {
        game._cancelAutoEnd();
        return true;
      }
    }
    if (game.rollDice(cur.id)) {
      game._cancelAutoEnd();
      return true;
    }
    return false;
  }

  if (game.endTurn(cur.id)) {
    game._cancelAutoEnd();
    return true;
  }
  return false;
}

function _fuzzRunGame(seed, n, gameOpts) {
  const rng = _fuzzRng(seed);
  const realRandom = Math.random;
  Math.random = rng;
  const violations = new Set();
  let finished = false;
  let stalled = false;
  let steps = 0;
  let stallNote = "";
  let ghostings = 0;
  let reconnects = 0;
  try {
    const { game } = createStartedGame(n, gameOpts);
    game.noAuctionTimer = true;
    if (gameOpts.ghosts) _fuzzGhostRig(game);
    let idle = 0;
    for (steps = 0; steps < 4000; steps++) {
      if (game.state === "finished" || game.superBananaWin) {
        finished = true;
        break;
      }
      // Random mid-anything departures and reconnects. Keeps ≥2 live players
      // so games don't all collapse into instant last-live wins.
      if (gameOpts.ghosts) {
        if (rng() < 0.015) {
          const live = game.players.filter((p) => !p.bankrupt && !p.ghost);
          if (live.length > 2 && game.makeGhost(live[Math.floor(rng() * live.length)].id))
            ghostings++;
        }
        if (rng() < 0.02) {
          const gs = game.players.filter((p) => p.ghost && !p.bankrupt);
          if (gs.length) {
            const g = gs[Math.floor(rng() * gs.length)];
            if (game.reconnectByClientId(`${g.clientId}-s${steps}`, g.clientId))
              reconnects++;
          }
        }
      }
      const progressed = _fuzzStep(game, rng);
      _fuzzInvariants(game, violations, steps % 7 === 0);
      if (violations.size > 5) break;
      if (progressed) {
        idle = 0;
      } else if (++idle > 200) {
        stalled = true;
        stallNote =
          `turn=${game.turn} cur=${game.getCurrentPlayer()?.name} ` +
          `diceRolled=${game.diceRolled} auction=${game.auction?.phase} ` +
          `sbWin=${!!game.superBananaWin}`;
        break;
      }
    }
    game.cleanup();
  } catch (e) {
    violations.add(`exception: ${e.stack ? e.stack.split("\n")[0] : e}`);
  } finally {
    Math.random = realRandom;
  }
  return { violations, finished, stalled, steps, stallNote, ghostings, reconnects };
}

{
  const configs = [
    { seed: 11, n: 2, opts: {} },
    { seed: 22, n: 3, opts: {} },
    { seed: 33, n: 4, opts: {} },
    { seed: 44, n: 4, opts: { gameMode: "2v2" } },
    { seed: 55, n: 3, opts: { startingMoney: 300 } },
    { seed: 66, n: 4, opts: { gameMode: "2v2", skipStartPick: true } },
    { seed: 77, n: 4, opts: { ghosts: true } },
    { seed: 88, n: 4, opts: { gameMode: "2v2", ghosts: true } },
    { seed: 99, n: 3, opts: { startingMoney: 300, ghosts: true } },
    { seed: 111, n: 6, opts: { gameMode: "3v3" } },
    { seed: 122, n: 6, opts: { gameMode: "3v3", skipStartPick: true } },
    { seed: 133, n: 6, opts: { gameMode: "3v3", ghosts: true } },
    { seed: 144, n: 6, opts: {} },
  ];
  let finishes = 0;
  let ghostings = 0;
  let reconnects = 0;
  for (const c of configs) {
    const r = _fuzzRunGame(c.seed, c.n, c.opts);
    const tag = `fuzz seed ${c.seed} (${c.n}p ${c.opts.gameMode || "classic"}${c.opts.startingMoney ? " poor" : ""}${c.opts.ghosts ? " ghosts" : ""})`;
    assert(
      r.violations.size === 0,
      `${tag}: invariants held — ${[...r.violations].slice(0, 3).join(" | ") || "ok"}`,
    );
    assert(!r.stalled, `${tag}: no deadlock — ${r.stallNote || "ok"}`);
    assert(r.finished || r.steps > 50, `${tag}: game actually played (${r.steps} steps)`);
    if (r.finished) finishes++;
    ghostings += r.ghostings;
    reconnects += r.reconnects;
  }
  assert(finishes >= 2, `fuzz: at least 2 of 9 games ran to a win (got ${finishes})`);
  assert(ghostings >= 4, `fuzz: ghost games actually ghosted players (got ${ghostings})`);
  assert(reconnects >= 1, `fuzz: at least one ghost reconnected mid-game (got ${reconnects})`);
}

// ============================================================
section("91. makeGhost mid-auction — a new ghost rejects every pending offer (no stall)");
// ============================================================
// rules.md (Leavers): a ghost "never bids in anyone else's auction — as a
// non-lander it simply rejects every farm and item offer". Before this fix,
// only removePlayer (lobby/finished) disentangled a leaver; a mid-game
// disconnect (makeGhost) left their pending response counted, deadlocking
// timer-off games.

function _firstUnownedFarm(game) {
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && !pr.owner) return i;
  }
  return -1;
}

// (a) Respond phase, timer off: the straggler disconnects → counted as reject,
// the auction resolves to the lander.
{
  const { game } = createStartedGame(3);
  const [a, b, c] = game.players;
  game.noAuctionTimer = true;
  const pos = _firstUnownedFarm(game);
  a.position = pos;
  assert(game._createAuctionForLander(a.id), "91a: auction opens");
  assert(game.placeBid(a.id, 100), "91a: lander pitches 100");
  assert(game.auction.phase === "respond", "91a: respond phase");
  assert(game.respondAuction(b.id, false), "91a: B rejects");
  assert(game.makeGhost(c.id), "91a: C disconnects mid-respond");
  assert(game.auction === null, "91a: auction resolved despite the ghost (no stall)");
  assert(game.properties.get(pos).owner === a.id, "91a: lander keeps the farm (ghost counted as reject)");
  game.cleanup();
}

// (b) Silent tie-breaker, timer off: an acceptor disconnects → forced 0 top-up,
// the other acceptor wins at pitch + top-up.
{
  const { game } = createStartedGame(3);
  const [a, b, c] = game.players;
  game.noAuctionTimer = true;
  const pos = _firstUnownedFarm(game);
  a.position = pos;
  game._createAuctionForLander(a.id);
  game.placeBid(a.id, 100);
  game.respondAuction(b.id, true);
  game.respondAuction(c.id, true);
  assert(game.auction.phase === "silentbid", "91b: 2 acceptors → silent tie-breaker");
  assert(game.submitSilentBid(b.id, 50), "91b: B tops up 50");
  assert(game.makeGhost(c.id), "91b: C disconnects mid-silent-bid");
  assert(game.auction === null, "91b: silent bid resolved despite the ghost");
  assert(game.properties.get(pos).owner === b.id, "91b: live acceptor wins");
  assert(b.money === 5000 - 150, "91b: winner paid pitch + top-up (100+50)");
  game.cleanup();
}

// ============================================================
section("92. Ghost squatter / lone opponent doesn't block the tile (no swipe, no duel — tile resolves)");
// ============================================================

// (a) Unowned farm under a ghost: landing on the ghost does NOTHING special (the
// rune-swipe and duel were both retired) and the auction still opens on the tile.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [a, b, gh] = game.players;
  gh.ghost = true;
  gh.rollCards = [2, 4];
  a.rollCards = [1, 1, 1];
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && !pr.owner) { farmPos = i; break; }
  }
  gh.position = farmPos;
  b.position = (farmPos + 3) % game.boardSize;
  a.position = farmPos;
  game._processLanding(a, true);
  assert(a.rollCards.length === 3 && gh.rollCards.length === 2, "92a: no rune-swipe — both lander and ghost keep their runes");
  assert(
    game.auction && game.auction.landingPlayer === a.id,
    "92a: auction still opens on the unowned farm under the ghost",
  );
  game.cleanup();
}

// (b) Super Banana under a ghost, lander can afford: the SB win fires; the ghost
// is irrelevant and keeps its runes (no swipe exists).
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.rollCards = [2, 4];
  let sbPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "superBanana") { sbPos = i; break; }
  }
  const price = game.properties.get(sbPos).price;
  live.money = price + 1234; // enough to BUY + win the Super Banana
  gh.position = sbPos;
  live.position = sbPos;
  game._processLanding(live, true);
  assert(gh.rollCards.length === 2, "92b: the ghost keeps its runes (no swipe exists)");
  assert(
    game.superBananaWin !== null || game.state === "finished",
    "92b: Super Banana win sequence still triggers past the ghost",
  );
  assert(
    game.properties.get(sbPos).owner === live.id,
    "92b: lander owns the Super Banana",
  );
  assert(live.money === 1234, "92b: paid the full price (no swipe before a win)");
  game.cleanup();
}

// (c) Super Banana under a ghost, lander broke: the lander grabs the one-time
// +200 landing consolation, the ghost keeps its runes (no swipe), and the SB
// stays put.
{
  const { game } = createStartedGame(2, { startingMoney: 500 });
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.rollCards = [2, 4];
  live.rollCards = [1, 1, 1];
  let sbPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "superBanana") { sbPos = i; break; }
  }
  gh.position = sbPos;
  live.position = sbPos;
  game._processLanding(live, true);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(live.money === 700, "92c: the broke lander grabs the one-time +200 landing consolation (still no swipe from the ghost)");
  assert(live.rollCards.length >= 3 && gh.rollCards.length === 2, "92c: the ghost is NOT swiped (keeps its 2); the lone-eligible lander may take free draws");
  let sbNew = -1;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbNew = pos; break; }
  }
  assert(sbNew === sbPos && !game.properties.get(sbPos).owner, "92c: Super Banana stays put, unowned");
  game.cleanup();
}

// (d) Landing on a lone LIVE opponent on an unowned farm now FALLS THROUGH to the
// normal auction (Rune Duel retired — it no longer "replaces the tile").
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [a, b, c] = game.players;
  a.rollCards = [1, 1, 1];
  b.rollCards = [5, 6, 3];
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && !pr.owner) { farmPos = i; break; }
  }
  c.position = (farmPos + 5) % game.boardSize;
  b.position = farmPos;
  a.position = farmPos;
  game._processLanding(a, true);
  assert(
    game.auction !== null && game.auction.landingPlayer === a.id,
    "92d: a normal-roll landing on a lone opponent's unowned farm opens the auction (no duel)",
  );
  game.cleanup();
}

// ============================================================
section("94. Banana ledger — conservation across every money source and sink");
// ============================================================
// gameLogic now keeps bananaLedger { baseline, minted, burned }. The global
// invariant (checked continuously by the section-90 fuzz) is:
//   sum(money) + sum(piles) + live poker pot == baseline + minted - burned.
// This section pins each mint/burn site deterministically so a regression
// names the exact site instead of a generic fuzz leak.

function _ledgerTotal(game) {
  let total = 0;
  for (const p of game.players) total += p.money;
  for (const [, prop] of game.properties) total += prop.bananaPile || 0;
  // (A Rune Duel never escrows bananas — the price is burned only on accept.)
  return total;
}
function _ledgerExpected(game) {
  const L = game.bananaLedger;
  return L.baseline + L.minted - L.burned;
}

// (a) Ledger starts balanced; grows mint; collection/steal don't change totals.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  assert(game.bananaLedger && game.bananaLedger.baseline === 10000, "94a: baseline = sum of starting money");
  assert(_ledgerTotal(game) === _ledgerExpected(game), "94a: balanced at game start");
  const farm = _firstUnownedFarm(game);
  const prop = game.properties.get(farm);
  prop.owner = p0.id;
  p0.properties.push(farm);
  const growPos = game._findGrowByLabel(1);
  for (const p of game.players) p.revealedTiles.add(growPos).add(farm);
  game._fireGrowAt(p0, growPos, "roll");
  const grew = prop.bananaPile;
  assert(game.bananaLedger.minted >= grew && grew >= 0, "94a: grow minted into the ledger");
  assert(_ledgerTotal(game) === _ledgerExpected(game), "94a: balanced after grow");
  p1.position = farm;
  game._stealPileOnLand(p1, farm);
  assert(_ledgerTotal(game) === _ledgerExpected(game), "94a: balanced after steal (pure transfer)");
  game.cleanup();
}

// (b) Auction payment burns the price.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  const farm = _firstUnownedFarm(game);
  p0.position = farm;
  game.diceRolled = true;
  assert(game.startAuction(p0.id) === true, "94b: auction opened");
  assert(game.placeBid(p0.id, 100) === true, "94b: pitch placed");
  const burnedBefore = game.bananaLedger.burned;
  assert(game.respondAuction(p1.id, false) === true, "94b: opponent rejects");
  assert(game.properties.get(farm).owner === p0.id, "94b: lander bought at pitch price");
  assert(game.bananaLedger.burned === burnedBefore + 100, "94b: sale price burned exactly");
  assert(_ledgerTotal(game) === _ledgerExpected(game), "94b: balanced after auction");
  game.cleanup();
}

// (f) Super Banana purchase burns the price (win sequence is deferred).
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  let sbPos = null;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbPos = pos; break; }
  }
  game.superBananaPrice = 1600;
  game.properties.get(sbPos).price = 1600;
  p0.position = sbPos;
  p1.position = (sbPos + 1) % game.boardSize; // off the tile — no poker
  game._processLanding(p0);
  assert(game.properties.get(sbPos).owner === p0.id, "94f: Super Banana bought");
  assert(_ledgerTotal(game) === _ledgerExpected(game), "94f: balanced after the buy");
  game.cleanup();
}

// ============================================================
section("95. 2v2 sequential farm auction");
// ============================================================
{
  const find2v2 = (money) => {
    const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: money });
    for (const p of game.players) p.startPickPending = false;
    game.noAuctionTimer = true;
    const lander = game.getCurrentPlayer();
    const team = game.getTeamOf(lander.id);
    const teammate = game.players.find((p) => p.id !== lander.id && game.getTeamOf(p.id) === team);
    const opps = game.players.filter((p) => game.getTeamOf(p.id) !== team);
    let pos = -1;
    for (const [i, prop] of game.properties) {
      if (prop && !prop.owner && prop.group === "farm") { pos = i; break; }
    }
    return { game, lander, teammate, opps, pos };
  };
  const startAuc = (ctx) => {
    ctx.lander.position = ctx.pos;
    ctx.game.currentPlayerIndex = ctx.game.players.indexOf(ctx.lander);
    ctx.game._createAuctionForLander(ctx.lander.id);
  };
  const done = (game) => { if (game._cancelAutoEnd) game._cancelAutoEnd(); };

  // 1) First opponent to accept buys at P immediately — auction over.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, opps, pos } = ctx;
    assert(game.auction && game.auction.teamFlow && game.auction.phase === "pitch", "1: pitch started");
    assert(game.placeBid(lander.id, 100) === true, "1: lander pitches 100");
    assert(game.auction.phase === "respondOpp", "1: respondOpp after pitch");
    const oBefore = opps[0].money;
    assert(game.respondAuction(opps[0].id, true) === true, "1: opp0 accepts");
    done(game);
    assert(!game.auction, "1: auction over on first accept");
    assert(game.properties.get(pos).owner === opps[0].id && opps[0].money === oBefore - 100, "1: opp0 bought at 100");
  }

  // 2) First accept resolves WITHOUT waiting for the other opponent.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, opps, pos } = ctx;
    game.placeBid(lander.id, 100);
    game.respondAuction(opps[0].id, true); // opp1 never responded
    done(game);
    assert(!game.auction, "2: resolved immediately on first accept");
    assert(game.properties.get(pos).owner === opps[0].id, "2: opp0 won");
    assert(game.respondAuction(opps[1].id, true) === false, "2: opp1 can't act after it's over");
  }

  // 3) Both opponents reject -> teammate accepts -> teammate buys at P.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    game.placeBid(lander.id, 100);
    game.respondAuction(opps[0].id, false);
    assert(game.auction.phase === "respondOpp", "3: still respondOpp after 1 reject");
    game.respondAuction(opps[1].id, false);
    assert(game.auction.phase === "teammateFinal", "3: teammateFinal after both reject");
    const tBefore = teammate.money;
    assert(game.respondAuction(teammate.id, true) === true, "3: teammate accepts");
    done(game);
    assert(game.properties.get(pos).owner === teammate.id && teammate.money === tBefore - 100, "3: teammate bought at 100");
  }

  // 4) Both reject -> teammate rejects -> lander buys at P.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    game.placeBid(lander.id, 90);
    game.respondAuction(opps[0].id, false);
    game.respondAuction(opps[1].id, false);
    const lBefore = lander.money;
    assert(game.respondAuction(teammate.id, false) === true, "4: teammate rejects");
    done(game);
    assert(game.properties.get(pos).owner === lander.id && lander.money === lBefore - 90, "4: lander buys at P");
  }

  // 5) Both reject + teammate can't afford P -> lander buys (no teammate step).
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    teammate.money = 50; // can't afford 100
    game.placeBid(lander.id, 100);
    const lBefore = lander.money;
    game.respondAuction(opps[0].id, false);
    game.respondAuction(opps[1].id, false);
    done(game);
    assert(!game.auction, "5: resolved (teammate can't afford)");
    assert(game.properties.get(pos).owner === lander.id && lander.money === lBefore - 100, "5: lander buys at P");
  }

  // 6) Only one opponent can afford -> that opponent rejects -> teammate.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    opps[1].money = 50; // excluded
    game.placeBid(lander.id, 100);
    assert(game.auction.affOppIds.length === 1 && game.auction.affOppIds[0] === opps[0].id, "6: only opp0 in the race");
    game.respondAuction(opps[0].id, false);
    assert(game.auction.phase === "teammateFinal", "6: lone opponent rejects -> teammate");
    const tBefore = teammate.money;
    game.respondAuction(teammate.id, true);
    done(game);
    assert(game.properties.get(pos).owner === teammate.id && teammate.money === tBefore - 100, "6: teammate buys");
  }

  // 7) Lander Buy Now (richest opp + 1) prices opponents out -> teammate's say.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    lander.money = 5000; teammate.money = 4000; opps[0].money = 800; opps[1].money = 600;
    game.auction = null; startAuc(ctx);
    assert(game.getState(lander.id).auction.buyNowPrice === 801, "7: Buy Now = richest opponent + 1");
    assert(game.auctionBuyNow(lander.id) === true, "7: lander uses Buy Now");
    assert(game.auction.phase === "teammateFinal" && game.auction.landerOpenBid === 801, "7: opponents priced out -> teammate");
    const lBefore = lander.money;
    game.respondAuction(teammate.id, false);
    done(game);
    assert(game.properties.get(pos).owner === lander.id && lander.money === lBefore - 801, "7: teammate rejects -> lander buys at 801");
  }

  // 8) Lander Buy Now when the teammate also can't afford -> lander buys instantly.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    lander.money = 5000; teammate.money = 500; opps[0].money = 800; opps[1].money = 600;
    game.auction = null; startAuc(ctx);
    const lBefore = lander.money;
    assert(game.auctionBuyNow(lander.id) === true, "8: lander uses Buy Now");
    done(game);
    assert(!game.auction, "8: resolved instantly");
    assert(game.properties.get(pos).owner === lander.id && lander.money === lBefore - 801, "8: lander bought at 801");
  }

  // 9) Broke lander -> first opponent to accept gets it FREE.
  {
    const ctx = find2v2(5000);
    ctx.lander.money = 0;
    startAuc(ctx);
    const { game, opps, pos } = ctx;
    assert(game.auction && game.auction.teamFlow && game.auction.brokeLander && game.auction.phase === "respondOpp", "9: broke -> respondOpp");
    const oBefore = opps[0].money;
    game.respondAuction(opps[0].id, true);
    done(game);
    assert(game.properties.get(pos).owner === opps[0].id && opps[0].money === oBefore, "9: first opponent gets it free");
  }

  // 10) Broke lander + both opponents reject -> the CLOSEST opponent turn-wise
  // (next up after the lander) gets it free; the teammate is never asked.
  {
    const ctx = find2v2(5000);
    ctx.lander.money = 0;
    startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    // Expected winner: walking forward in turn order from the lander, the first opponent.
    const oppIds = opps.map((o) => o.id);
    const li = game.players.findIndex((p) => p.id === lander.id);
    let expected = null;
    for (let off = 1; off <= game.players.length; off++) {
      const p = game.players[(li + off) % game.players.length];
      if (p && oppIds.includes(p.id)) { expected = p.id; break; }
    }
    game.respondAuction(opps[0].id, false);
    game.respondAuction(opps[1].id, false);
    done(game);
    const owner = game.properties.get(pos).owner;
    assert(owner === expected, "10: the closest opponent turn-wise gets it");
    assert(owner !== teammate.id, "10: not the teammate (broke lander has no teammate step)");
    assert(opps[0].money === 5000 && opps[1].money === 5000, "10: won for free");
  }

  // 11) Shared shortcuts: 1 solvent player -> free to them; all broke -> lander free.
  {
    const ctx = find2v2(5000);
    ctx.lander.money = 0; ctx.teammate.money = 0; ctx.opps[1].money = 0; // only opp0 solvent
    startAuc(ctx);
    assert(!ctx.game.auction, "11a: no auction (1 solvent)");
    assert(ctx.game.properties.get(ctx.pos).owner === ctx.opps[0].id, "11a: only solvent player free");
  }
  {
    const ctx = find2v2(5000);
    for (const p of ctx.game.players) p.money = 0;
    startAuc(ctx);
    assert(!ctx.game.auction, "11b: no auction (all broke)");
    assert(ctx.game.properties.get(ctx.pos).owner === ctx.lander.id, "11b: lander free when all broke");
  }

  // 12) Turn enforcement: lander/teammate can't act in the race; no double response.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps } = ctx;
    game.placeBid(lander.id, 100);
    assert(game.respondAuction(lander.id, true) === false, "12: lander can't respond");
    assert(game.respondAuction(teammate.id, true) === false, "12: teammate can't act during the race");
    assert(game.respondAuction(opps[0].id, false) === true, "12: opponent responds");
    assert(game.respondAuction(opps[0].id, true) === false, "12: can't respond twice");
    done(game);
  }

  // 13) PRIVACY: during the race a viewer sees only their own + teammate's choice.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, opps } = ctx;
    game.placeBid(lander.id, 100);
    game.respondAuction(opps[0].id, false); // opp1 still pending -> live
    assert(game.auction && game.auction.phase === "respondOpp", "13: still live");
    const opp1View = game.getState(opps[1].id).auction.bids;
    assert(opp1View[opps[0].id] && opp1View[opps[0].id].accepted === false, "13: opp1 sees teammate opp0's reject");
    const landerView = game.getState(lander.id).auction.bids;
    assert(landerView[opps[0].id].accepted === undefined, "13: lander can't see opponents' status");
    done(game);
  }

  // 15) REGRESSION: a non-numeric / NaN pitch is rejected (not a free win).
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, pos } = ctx;
    assert(game.placeBid(lander.id, "abc") === false, "15: non-numeric pitch rejected");
    assert(game.placeBid(lander.id, NaN) === false, "15: NaN pitch rejected");
    assert(game.auction && game.auction.phase === "pitch", "15: still awaiting a valid pitch");
    assert(!game.properties.get(pos).owner, "15: nobody got it for free");
  }

  // 16) REGRESSION: an opponent ghosting during the race is dropped (no deadlock);
  // the lone remaining opponent rejecting falls to the teammate.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, teammate, opps, pos } = ctx;
    game.placeBid(lander.id, 100);
    game.makeGhost(opps[1].id); // dropped from the racers
    game.respondAuction(opps[0].id, false);
    assert(game.auction.phase === "teammateFinal", "16: ghost dropped -> teammate (no deadlock)");
    const tBefore = teammate.money;
    game.respondAuction(teammate.id, true);
    done(game);
    assert(game.properties.get(pos).owner === teammate.id && teammate.money === tBefore - 100, "16: teammate buys, no deadlock");
  }

  // 17) REGRESSION: the lander ghosting during the opponents' race abandons the
  // auction — it never resolves to (or charges) the gone/ghost lander.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, pos } = ctx;
    game.placeBid(lander.id, 100);
    assert(game.auction.phase === "respondOpp", "17: respondOpp");
    game.makeGhost(lander.id); // the lander (seller) ghosts mid-race
    done(game);
    assert(!game.auction, "17: auction abandoned when the lander ghosts");
    assert(!game.properties.get(pos).owner, "17: farm unowned (never awarded to the ghost lander)");
    assert(game.players.find((p) => p.id === lander.id).money === 5000, "17: ghost lander not charged");
  }

  // 18) REGRESSION: the lander ghosting during teammateFinal also abandons it.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, opps, pos } = ctx;
    game.placeBid(lander.id, 100);
    game.respondAuction(opps[0].id, false);
    game.respondAuction(opps[1].id, false);
    assert(game.auction.phase === "teammateFinal", "18: teammateFinal");
    game.makeGhost(lander.id);
    done(game);
    assert(!game.auction, "18: auction abandoned when the lander ghosts (teammateFinal)");
    assert(!game.properties.get(pos).owner, "18: farm unowned");
  }

  // 19) REGRESSION: the lander LEAVING (removePlayer) mid-race abandons the auction.
  {
    const ctx = find2v2(5000); startAuc(ctx);
    const { game, lander, opps, pos } = ctx;
    game.placeBid(lander.id, 100);
    game.respondAuction(opps[0].id, false);
    assert(game.auction && game.auction.phase === "respondOpp", "19: respondOpp");
    game.removePlayer(lander.id); // the lander disconnects/leaves
    done(game);
    assert(!game.auction, "19: auction abandoned when the lander leaves");
    assert(!game.properties.get(pos).owner, "19: farm unowned");
  }
}

// ============================================================
section("96. Audit fixes — ghost can't win SB, cancel refund on ghosting, reset transients, endTurn guards, leaver cash burn");
// ============================================================

// 96a: a SOLVENT ghost landing on the Super Banana must NOT buy or win it — it
// relocates instead (the server auto-drives ghost rolls; a disconnected player
// must never be handed the game).
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const ghost = game.players.find((p) => p.id !== game.getCurrentPlayer().id);
  let sbPos = -1;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbPos = pos; break; }
  }
  assert(game.makeGhost(ghost.id) === true, "96a: player becomes a ghost");
  ghost.money = 100000; // wildly able to afford the SB
  const moneyBefore = ghost.money;
  ghost.position = sbPos;
  game._processLanding(ghost);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(game.state !== "finished", "96a: a ghost landing on the SB does NOT end the game");
  assert(!game.superBananaWin, "96a: no super-banana win recorded for a ghost");
  const sbProp = game.properties.get(sbPos);
  assert(!sbProp || sbProp.owner !== ghost.id, "96a: ghost does not own the SB tile");
  assert(ghost.money === moneyBefore, "96a: no bonus on landing (it's paid only on leave) and no buy");
  // The Super Banana stays put — it never relocates.
  assert(sbProp && sbProp.group === "superBanana" && !sbProp.owner, "96a: the SB stays in place, unowned");
}

// 96a2: a ghost landing on a FREE Super Banana (no hidden tiles left) still does
// not win — the free SB is left in place for a live player.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) {
    p.startPickPending = false;
    for (let i = 0; i < game.boardSize; i++) p.revealedTiles.add(i);
  }
  const ghost = game.players.find((p) => p.id !== game.getCurrentPlayer().id);
  let sbPos = -1;
  for (const [pos, prop] of game.properties) {
    if (prop.group === "superBanana") { sbPos = pos; break; }
  }
  game.makeGhost(ghost.id);
  ghost.position = sbPos;
  game._processLanding(ghost);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(game.state !== "finished", "96a2: ghost on a FREE SB does not win");
  const sbProp = game.properties.get(sbPos);
  assert(sbProp && sbProp.group === "superBanana" && !sbProp.owner, "96a2: the free SB stays in place, unowned");
}

// (96c removed — the cancel system it tested no longer exists; the Predict bluff
// has no pre-armed state to clear on ghosting.)

// 96d: _resetToLobby nulls the start-pick animation hint so a rematch never
// replays the prior game's hint.
{
  const { game } = createStartedGame(2);
  game.lastStartPick = { playerId: "p0", position: 9, turn: 3 };
  game.state = "finished";
  game._resetToLobby();
  assert(game.lastStartPick === null, "96d: _resetToLobby nulls lastStartPick");
}

// 96e: endTurn refuses to advance while an auction is live (parity with
// notifyAnimsComplete) — prevents an orphaned auction.
{
  const { game } = createStartedGame(2);
  for (const p of game.players) p.startPickPending = false;
  const cur = game.getCurrentPlayer();
  game.diceRolled = true;
  game.auction = { phase: "pitch" };
  assert(game.endTurn(cur.id) === false, "96e: endTurn refuses while an auction is live");
  game.auction = null;
  assert(game.endTurn(cur.id) === true, "96e: endTurn advances once the auction is clear");
}

// 96e2: removePlayer mid-game burns the leaver's cash to the banana ledger
// (conservation) just like it already burns their farm piles.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  assert(game.bananaLedger, "96e2: banana ledger active mid-game");
  const [a] = game.players;
  const burnedBefore = game.bananaLedger.burned;
  const leaverMoney = a.money;
  game.removePlayer(a.id);
  assert(game.bananaLedger.burned >= burnedBefore + leaverMoney, "96e2: the leaver's cash is burned to the ledger");
}

// ============================================================
section("97. Audit-2 fixes — getState.currentPlayer redaction");
// ============================================================

// 97b: getState.currentPlayer is redacted exactly like a players[] entry — no
// clientId, no opponent cancel state, no foreign revealedTiles (which was a fog
// back-channel to a hidden Super Banana), and no foreign rollCards. Regression.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b] = game.players; // a is the current player
  a.clientId = "secret-token";
  a.rollCards = [1, 2, 3];
  a.cancelQueued = true;
  a.cancelQueuedBy = b.id;
  a.revealedTiles.add(5);
  const sB = game.getState(b.id); // the OPPONENT's view
  assert(sB.currentPlayer && sB.currentPlayer.id === a.id, "97b: currentPlayer present in opponent's state");
  assert(sB.currentPlayer.clientId === undefined, "97b: clientId not leaked via currentPlayer");
  assert(Array.isArray(sB.currentPlayer.rollCards) && sB.currentPlayer.rollCards.length === 0, "97b: opponent's rollCards redacted to [] in currentPlayer");
  assert(sB.currentPlayer.rollCardCount === 3, "97b: opponent's rollCardCount is still public");
  assert(sB.currentPlayer.cancelQueued === undefined && sB.currentPlayer.cancelQueuedBy === undefined, "97b: cancel state stripped from currentPlayer");
  assert(Array.isArray(sB.currentPlayer.revealedTiles) && sB.currentPlayer.revealedTiles.length === 0, "97b: opponent's revealedTiles not shipped via currentPlayer (no fog back-channel)");
  // players[] also no longer ships a non-viewer's revealedTiles or rollCards:
  const aEntryInB = sB.players.find((p) => p.id === a.id);
  assert(aEntryInB && aEntryInB.revealedTiles.length === 0, "97b: a non-viewer's revealedTiles are empty in players[]");
  assert(aEntryInB && aEntryInB.rollCards.length === 0 && aEntryInB.rollCardCount === 3, "97b: a non-viewer's rollCards are redacted ([], count only) in players[]");
  // the viewer still sees their OWN roll cards + revealed tiles on their turn:
  const sA = game.getState(a.id);
  assert(JSON.stringify(sA.currentPlayer.rollCards) === "[1,2,3]", "97b: the current player sees their own roll cards");
  assert(sA.currentPlayer.revealedTiles.includes(5), "97b: the viewer sees their own revealed tiles");
}
// 97c: a Super Banana win in progress is NOT overridden by last-monkey-standing
// when a player disconnects mid win-animation — the buyer's purchase win stands.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b] = game.players;
  game.superBananaWin = { phase: "found", playerId: a.id }; // a's purchase win sequence is running
  game.makeGhost(a.id); // the BUYER disconnects mid-animation
  assert(game.state !== "finished", "97c: buyer's in-progress SB win is not overridden by their disconnect");
  assert(game.lastStandingWinner !== b.id, "97c: the survivor is NOT credited the win over the SB buyer");

  // control: with NO SB win in progress, last-monkey-standing fires normally.
  const { game: g2 } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of g2.players) p.startPickPending = false;
  g2.makeGhost(g2.players[0].id);
  assert(g2.state === "finished" && g2.lastStandingWinner === g2.players[1].id, "97c: control — last-live win still fires when no SB win is in progress");
}

// (Section 98 "Cancel × ghost/leave hardening" removed — the armed-cancel
// mechanic it covered was replaced by the post-roll Predict bluff, which has no
// pre-armed cross-player state to scrub on ghost/leave.)

// ============================================================
section("100. Super Banana — crossing (rich: rune auction, broke: +200)");
// ============================================================
// Crossing (passing over without landing) a REVEALED Super Banana: a RICH
// crosser (can afford the SB) opens the MYSTERY rune auction — they pitch, an
// opponent wins the hidden 0-2 draw (same as a can't-afford landing); a BROKE
// crosser grabs a consolation +200 bananas (minted). Crossing a hidden SB, or a
// ghost crossing, does nothing.

// (a) afford + cross a REVEALED SB -> opens the mystery rune auction.
{
  const { game } = _quickStarted(3, { gameMode: "classic", startingMoney: 20000 });
  game.noAuctionTimer = true;
  const a = game.getCurrentPlayer();
  const sb = _sbPos(game);
  for (const p of game.players) p.revealedTiles.add(sb); // revealed by a prior landing
  game.auction = null; game.superBananaWin = null;
  a.rollCards = [];
  a.position = _wrap(game, sb + 1); // strictly crossed sb (oldPos = sb - 1)
  game._resolveSuperBananaCross(a, _wrap(game, sb - 1));
  assert(game.auction && game.auction.sbRune && game.auction.landingPlayer === a.id, "100a: a rich cross opens the mystery rune auction (crosser pitches)");
  assert(game.auction.runeCount >= 0 && game.auction.runeCount <= 2, "100a: the hidden draw count is 0..2");
  assert((a.pendingDraws || 0) === 0 && a.rollCards.length === 0, "100a: the crosser earns no rune (only the winner does)");
  assert(game.auction.position === sb, "100a: the auction is tagged to the Super Banana tile");
  assert(game.properties.get(sb).owner == null, "100a: the SB is not bought");
  game.cleanup();
}

// (a1) afford + cross, but the only opponent is broke -> no auction; by the
// farm 0/1-eligible free-award rule the lone-eligible crosser takes the draw free.
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  game.noAuctionTimer = true;
  const a = game.getCurrentPlayer();
  const b = game.players.find((p) => p.id !== a.id);
  const sb = _sbPos(game);
  for (const p of game.players) p.revealedTiles.add(sb);
  game.auction = null; game.superBananaWin = null;
  a.rollCards = []; b.money = 0; // the only opponent is broke -> not eligible
  a.position = _wrap(game, sb + 1);
  game._resolveSuperBananaCross(a, _wrap(game, sb - 1));
  assert(!game.auction, "100a1: a rich cross with no eligible opponents opens no auction");
  assert(a.rollCards.length >= 0 && a.rollCards.length <= 2, "100a1: the lone-eligible crosser takes the mystery draw free (0..2)");
  game.cleanup();
}

// (a2) afford + cross a HIDDEN SB -> nothing (no card), and never reveals it.
{
  const r = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const a = r.game.getCurrentPlayer();
  const sb = _sbPos(r.game);
  a.revealedTiles.delete(sb);
  a.rollCards = [];
  r.game.auction = null; r.game.superBananaWin = null;
  a.position = _wrap(r.game, sb + 1);
  r.game._resolveSuperBananaCross(a, _wrap(r.game, sb - 1));
  assert((a.pendingDraws || 0) === 0 && a.rollCards.length === 0 && !r.game.auction, "100a2: a rich cross of a HIDDEN SB does nothing");
  assert(!a.revealedTiles.has(sb), "100a2: crossing never reveals the SB");
  r.game.cleanup();
}

// (b) broke + cross a REVEALED SB -> consolation +200 bananas (minted, passive); no card, no auction.
{
  const r = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const b = r.game.getCurrentPlayer();
  const sb = _sbPos(r.game);
  b.money = r.game.properties.get(sb).price - 1; // broke
  b.revealedTiles.add(sb);
  b.rollCards = [];
  r.game.auction = null; r.game.superBananaWin = null;
  const before = b.money, mint = r.game.bananaLedger.minted;
  b.position = _wrap(r.game, sb + 1);
  r.game._resolveSuperBananaCross(b, _wrap(r.game, sb - 1));
  assert(b.money === before + 200, "100b: broke crosser of a revealed SB grabs a consolation +200");
  assert(r.game.bananaLedger.minted === mint + 200, "100b: the +200 is freshly minted (conservation)");
  assert(b.rollCards.length === 0 && !r.game.auction, "100b: broke crosser gets no card / no auction");
  r.game.cleanup();
}

// (b2) broke + cross a HIDDEN SB -> nothing.
{
  const r = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const b = r.game.getCurrentPlayer();
  const sb = _sbPos(r.game);
  b.money = r.game.properties.get(sb).price - 1;
  b.revealedTiles.delete(sb);
  r.game.auction = null; r.game.superBananaWin = null;
  const before = b.money;
  b.position = _wrap(r.game, sb + 1);
  r.game._resolveSuperBananaCross(b, _wrap(r.game, sb - 1));
  assert(b.money === before && !r.game.auction, "100b2: broke cross of a HIDDEN SB does nothing");
  r.game.cleanup();
}

// (c) GHOST cross of a revealed SB -> nothing (no card).
{
  const r = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const c = r.game.getCurrentPlayer();
  const sb = _sbPos(r.game);
  c.ghost = true; c.rollCards = [];
  for (const p of r.game.players) p.revealedTiles.add(sb);
  r.game.auction = null; r.game.superBananaWin = null;
  c.position = _wrap(r.game, sb + 1);
  r.game._resolveSuperBananaCross(c, _wrap(r.game, sb - 1));
  assert(c.rollCards.length === 0 && !r.game.auction, "100c: a ghost crossing gets nothing");
  r.game.cleanup();
}

// ============================================================
section("101. Magic-rune DRAW is IMMEDIATE (no keep/reroll modal)");
// ============================================================
{
  // _grantMagicDieDraw pushes ONE random rune straight into the hand — no session,
  // no keep/reroll, nothing deferred.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const a = game.getCurrentPlayer();
  a.rollCards = [];
  game._grantMagicDieDraw(a);
  assert(!game.redraw, "101: drawing a rune opens NO redraw modal");
  assert(a.rollCards.length === 1 && a.rollCards[0] >= 1 && a.rollCards[0] <= 6, "101: the rune (1..6) lands in the hand immediately");
  assert((a.pendingDraws || 0) === 0, "101: nothing is deferred (no pendingDraws)");
  game.cleanup();
}
{
  // N draws => N runes at once; a ghost is no different now (no modal anywhere).
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const a = game.getCurrentPlayer();
  a.rollCards = []; a.ghost = true;
  for (let i = 0; i < 3; i++) game._grantMagicDieDraw(a);
  assert(!game.redraw && a.rollCards.length === 3, "101: three draws add three runes outright");
  game.cleanup();
}
// (Removed the cancel-HIT draw test — the correct-Predict reward draw is covered
// in section 68c.)
{
  // getState no longer ships a per-player pendingDraws count, and no draw session
  // ever opens (the only redraw mode left is the missed-cancel penalty).
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const a = game.getCurrentPlayer();
  const st = JSON.parse(JSON.stringify(game.getState(a.id)));
  assert(st.players.every((p) => p.pendingDraws === undefined), "101: getState ships no pendingDraws (draws are immediate)");
  assert(st.redraw === null, "101: no draw session ever opens");
  game.cleanup();
}

// ============================================================
section("102. Pre-game reveal (no re-roll) + Super Banana mystery rune auction");
// ============================================================
{
  // startGame seeds 7 runes during "revealing"; the dealt hand is FINAL (the
  // pre-game re-roll / mulligan was removed); completeReveal KEEPS it (no reseed).
  const game = new MonkeyBusinessGame("MUL", 2, 5000, "classic", undefined, true);
  const p0 = game.addPlayer("m0", "M0");
  const p1 = game.addPlayer("m1", "M1");
  game.startGame("m0");
  assert(game.state === "revealing", "102: startGame enters the revealing phase");
  assert(p0.rollCards.length === 7 && p1.rollCards.length === 7, "102: 7 runes seeded at reveal-start");
  // The pre-game re-roll is GONE — no method, no per-player budget field.
  assert(typeof game.rerollStartingRune === "undefined", "102: rerollStartingRune method removed");
  assert(p0.mulligansLeft === undefined, "102: no mulligan budget on players");
  assert(game.getState("m0").players[0].mulligansLeft === undefined, "102: getState ships no mulligansLeft");
  const kept = p0.rollCards.slice();
  game.completeReveal();
  assert(game.state === "playing", "102: completeReveal -> playing");
  assert(JSON.stringify(p0.rollCards) === JSON.stringify(kept), "102: completeReveal keeps the dealt hand (no reseed)");
  game.cleanup();
}
// Helper: land a broke player on the SB to open the mystery rune auction.
function _openSbRuneAuction(opts) {
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  game.noAuctionTimer = true;
  const sb = _sbPos(game);
  const prop = game.properties.get(sb);
  const a = game.players[0], b = game.players[1];
  a.money = (prop.price || 10000) - 1; a.rollCards = []; a.position = sb;
  b.money = opts && opts.brokeOpp ? 0 : 5000; b.rollCards = []; b.position = _wrap(game, sb + 20);
  for (const p of game.players) p.revealedTiles.delete(sb);
  game._processLanding(a);
  return { game, a, b, sb, prop };
}
{
  // Landing on an unaffordable Super Banana opens the MYSTERY rune auction: the
  // lander rolls a hidden 0-2 draw count and names a price; opponents bid blind.
  const { game, a, sb, prop } = _openSbRuneAuction();
  assert(game.auction && game.auction.sbRune, "102: landing (can't afford) opens the mystery rune auction");
  assert(game.auction.landingPlayer === a.id, "102: the lander is the one who pitches");
  assert(game.auction.runeCount >= 0 && game.auction.runeCount <= 2, "102: the hidden draw count is 0..2");
  assert((a.pendingPick || 0) === 0 && (a.pendingDraws || 0) === 0, "102: the lander earns no rune (only the winner does)");
  assert(a.revealedTiles.has(sb) && prop.owner == null, "102: landing reveals the SB; it stays unowned");
  game.cleanup();
}
{
  // The 0-2 count is OWNER-ONLY: the lander sees it, opponents bid BLIND (null).
  const { game, a, b } = _openSbRuneAuction();
  const N = game.auction.runeCount;
  const asA = JSON.parse(JSON.stringify(game.getState(a.id)));
  const asB = JSON.parse(JSON.stringify(game.getState(b.id)));
  assert(asA.auction && asA.auction.sbRune && asA.auction.runeCount === N, "102: the lander sees the hidden draw count");
  assert(asB.auction && asB.auction.sbRune && asB.auction.runeCount === null, "102: opponents bid BLIND (count is null)");
  game.cleanup();
}
{
  // The hidden count is TWO 0/1 cards; their SUM is the draw count (so 0/1/2 with
  // odds 1/4, 1/2, 1/4). Both cards (and the sum) are owner-only until resolution.
  const { game, a, b } = _openSbRuneAuction();
  const cards = game.auction.runeCards;
  assert(Array.isArray(cards) && cards.length === 2, "102: two 0/1 cards are dealt");
  assert(cards.every((c) => c === 0 || c === 1), "102: each card is 0 or 1");
  assert(game.auction.runeCount === cards[0] + cards[1], "102: the draw count is the sum of the two cards");
  const asA2 = JSON.parse(JSON.stringify(game.getState(a.id)));
  const asB2 = JSON.parse(JSON.stringify(game.getState(b.id)));
  assert(Array.isArray(asA2.auction.runeCards) && asA2.auction.runeCards.length === 2, "102: the lander sees their two cards");
  assert(asB2.auction.runeCards === null && asB2.auction.runeCount === null, "102: opponents see neither the cards nor the count");
  game.cleanup();
}
{
  // Accept: the winner pays the pitched price (BURNED) and draws N runes
  // immediately; the SB is never bought. Works for N=0 too (pay for nothing).
  const { game, a, b, prop } = _openSbRuneAuction();
  const N = game.auction.runeCount;
  const burnedBefore = game.bananaLedger.burned;
  assert(game.placeBid(a.id, 100) === true, "102: the lander pitches a price (100)");
  assert(game.auction.phase === "respond", "102: pitching opens the accept/reject window");
  assert(game.respondAuction(b.id, true) === true, "102: the opponent accepts");
  assert(!game.auction, "102: accepting resolves the auction");
  assert(b.money === 4900, "102: the winner pays the pitched price");
  assert(game.bananaLedger.burned === burnedBefore + 100, "102: the payment is BURNED");
  assert(b.rollCards.length === N, "102: the winner draws N runes immediately (N may be 0)");
  assert(prop.owner == null, "102: the SB is never bought via the auction");
  game.cleanup();
}
{
  // The lander PARTICIPATES (farm-auction model): if the only opponent rejects,
  // the lander keeps the draw at their OWN pitched price (pays it, BURNED).
  const { game, a, b } = _openSbRuneAuction();
  const N = game.auction.runeCount;
  const burnedBefore = game.bananaLedger.burned;
  const aBefore = a.money;
  game.placeBid(a.id, 100);
  assert(game.respondAuction(b.id, false) === true, "102: the only opponent rejects");
  assert(!game.auction, "102: all rejected -> the auction resolves");
  assert(b.rollCards.length === 0 && b.money === 5000, "102: the rejector pays nothing and draws nothing");
  assert(a.rollCards.length === N, "102: the lander draws N runes when nobody takes it");
  assert(a.money === aBefore - 100 && game.bananaLedger.burned === burnedBefore + 100, "102: the lander pays their own pitched price (burned)");
  game.cleanup();
}
{
  // Only the lander is eligible (the opponent is broke) -> the lander takes the
  // mystery draw FREE (the farm 0/1-eligible rule); no auction opens.
  const { game, a } = _openSbRuneAuction({ brokeOpp: true });
  assert(!game.auction, "102: a lone eligible player -> no auction (free award)");
  assert(a.rollCards.length >= 0 && a.rollCards.length <= 2, "102: the lander draws the mystery runes free (0..2 immediately)");
  game.cleanup();
}
{
  // Landing WITH enough money still WINS the Super Banana (unchanged).
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const sb = _sbPos(game); const prop = game.properties.get(sb);
  const a = game.players[0];
  a.money = prop.price; a.position = sb;
  game._processLanding(a);
  assert(game.superBananaWin, "102: landing with enough money still WINS the Super Banana");
  assert(a.money === 0, "102: the winning lander paid the full price (money back to 0)");
  game.cleanup();
}
{
  // ONE-TIME +200 LANDING consolation (2026-06-23): a can't-afford LANDER grabs a
  // +200 banana consolation (minted), latches sbBonusTaken, and still opens the
  // mystery rune auction. The SB is not bought.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  game.noAuctionTimer = true;
  const sb = _sbPos(game); const price = game.properties.get(sb).price;
  const a = game.players[0], b = game.players[1];
  a.money = price - 1; a.rollCards = []; a.position = sb;
  b.money = 5000; b.position = _wrap(game, sb + 20);
  for (const p of game.players) p.revealedTiles.delete(sb);
  const before = a.money, mint = game.bananaLedger.minted;
  game._processLanding(a);
  assert(a.money === before + 200, "102: a can't-afford lander grabs the one-time +200 landing consolation");
  assert(game.bananaLedger.minted === mint + 200, "102: the +200 landing consolation is minted (conservation)");
  assert(a.sbBonusTaken === true, "102: the one-time SB consolation latch is set on the lander");
  assert(game.properties.get(sb).owner == null, "102: the lander does NOT buy the SB");
  assert(game.auction && game.auction.sbRune, "102: the lander still opens the mystery rune auction");
  game.cleanup();
}
{
  // ONE-TIME GATE (2026-06-23): a player who already grabbed the +200 by LANDING
  // does NOT get it again when they later walk OFF / ACROSS the SB. The broke-cross
  // consolation shares the same sbBonusTaken latch — no double-dip, no floater.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const sb = _sbPos(game); const price = game.properties.get(sb).price;
  const a = game.players[0], b = game.players[1];
  b.money = 5000; b.position = _wrap(game, sb + 20);
  // a already grabbed the landing +200 on a prior turn (latch set), is broke, and
  // has the SB revealed. Now a walks OFF / ACROSS it (oldPos = sb-1, lands sb+1).
  a.money = price - 1; a.sbBonusTaken = true; a.revealedTiles.add(sb);
  a.position = _wrap(game, sb + 1);
  const before = a.money, mint = game.bananaLedger.minted;
  game._resolveSuperBananaCross(a, _wrap(game, sb - 1));
  assert(a.money === before, "102: a player who took the landing +200 gets NO second +200 walking off/across the SB");
  assert(game.bananaLedger.minted === mint, "102: nothing minted on the already-taken second SB touch");
  assert(game.lastSuperBananaCross == null, "102: no cross-floater fires for the already-taken consolation");
  game.cleanup();
}

// ============================================================
section("104. getState boardLayout price reflects the live properties map");
// ============================================================
// Regression: board[sbPos].buyable.price is a frozen hardcoded 1600, while
// _initProperties stamps the lobby-configurable superBananaPrice into the
// properties map. getState's boardLayout must mirror the LIVE properties-map
// price (the real buy/win price checked in _processLanding), not the stale board
// default — else any frontend reading boardLayout's price gets a wrong number
// (this caused a false WINNING-MOVE hint). Appended at the END so it doesn't
// shift the seeded board-shuffle RNG for the sections above.

// 104a: every buyable tile's boardLayout price equals its live properties-map
// price, and the Super Banana specifically equals the configured price (not 1600).
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  const p0 = game.players[0];
  for (let i = 0; i < game.boardSize; i++) p0.revealedTiles.add(i); // reveal all so nothing is fog-redacted
  const layout = game.getState(p0.id).boardLayout;
  let allMatch = true;
  for (const e of layout) {
    if (e.price === undefined) continue;
    const prop = game.properties.get(e.id);
    if (!prop || e.price !== prop.price) { allMatch = false; break; }
  }
  assert(allMatch, "104a: every boardLayout buyable price matches its live properties-map price");
  const sbEntry = layout.find((e) => e.group === "superBanana");
  assert(!!sbEntry, "104a: revealed SB appears in boardLayout");
  assert(game.superBananaPrice === 10000, "104a: default configured SB price is 10000");
  assert(sbEntry.price === game.superBananaPrice, "104a: boardLayout SB price equals configured superBananaPrice");
  assert(sbEntry.price !== 1600, "104a: boardLayout SB price is NOT the stale hardcoded 1600");
  game.cleanup();
}

// 104b: boardLayout's SB price TRACKS a reconfigured superBananaPrice (proves it
// reads the live properties map, not a coincidental 4000 default).
{
  const { game } = _quickStarted(2, { gameMode: "classic", startingMoney: 20000 });
  game.superBananaPrice = 2500;
  game._initProperties();
  const p0 = game.players[0];
  const sb = _sbPos(game);
  p0.revealedTiles.add(sb);
  const sbEntry = game.getState(p0.id).boardLayout.find((e) => e.group === "superBanana");
  assert(sbEntry && sbEntry.price === 2500, "104b: boardLayout SB price follows a reconfigured superBananaPrice");
  game.cleanup();
}

// ============================================================
section("105. DEBUG Reveal-All view (revealAllView) lifts fog for that viewer only");
// ============================================================
// NOTE: appended at the END so createStartedGame's board shuffle doesn't shift the
// seeded RNG stream for board-layout-dependent tests above.
{
  // A viewer with revealAllView=true gets the UNREDACTED board (incl. the hidden
  // Super Banana); everyone else stays fogged. It's a pure VIEW flag — it must not
  // mutate revealedTiles or alter any other player's payload. (The flag is only
  // ever set via the DEBUG_TOOLS-gated set_reveal_all socket; here we set it
  // directly to exercise getState.)
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const p0 = game.players[0], p1 = game.players[1];
  const sb = _sbPos(game);
  assert(sb >= 0, "105: SB exists");

  // Baseline: p0 hasn't revealed the SB, so it's fogged for p0.
  assert(!p0.revealedTiles.has(sb), "105: SB not yet revealed to p0");
  assert(game.getState(p0.id).boardLayout[sb].type === "hidden", "105: SB fogged for p0 before reveal-all");

  // Enable the debug reveal-all view for p0 ONLY.
  p0.revealAllView = true;
  const stAll = game.getState(p0.id);
  assert(!stAll.boardLayout.some((t) => t.type === "hidden"), "105: reveal-all viewer sees NO hidden boardLayout tiles");
  assert(!stAll.properties.some((pr) => pr.hidden), "105: reveal-all viewer sees NO redacted properties");
  assert(stAll.boardLayout[sb].group === "superBanana", "105: reveal-all viewer sees the SB's real location");

  // Pure view flag: it must NOT have mutated revealedTiles (no game-logic effect).
  assert(!p0.revealedTiles.has(sb), "105: reveal-all does NOT add to revealedTiles");

  // Per-viewer, not global: the OTHER player stays fogged.
  assert(game.getState(p1.id).boardLayout[sb].type === "hidden", "105: reveal-all is per-viewer — p1 still fogged");

  // Turning it back off re-fogs p0.
  p0.revealAllView = false;
  assert(game.getState(p0.id).boardLayout[sb].type === "hidden", "105: turning reveal-all off re-fogs the board");
  game.cleanup();
}

// ============================================================
section("106. Armed spell card — no phantom highlight (armedRoll reconciliation)");
// ============================================================
// Regression: armedRoll is a sticky pre-selection cleared only by play / normal
// roll / disarm / reset. Several NON-play paths remove the armed rune from the
// hand (missed-cancel PENALTY, Rune Duel set-aside discard, going ghost), which
// used to leave armedRoll DANGLING — painting a phantom cyan armed-path on the
// board (and silently suppressing auto-roll). _reconcileArmedRoll + a getState
// backstop now clear/hide a stale arm. Appended at the END so it doesn't shift
// the seeded board-shuffle RNG of the sections above.

// 106a: the _reconcileArmedRoll invariant — clears only when the value isn't held.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const p = game.players[0];
  p.startPickPending = false;
  p.rollCards = [4];
  assert(game.armRollCard(p.id, 4) === true, "106a: arm a held value");
  game._reconcileArmedRoll(p);
  assert(p.armedRoll && p.armedRoll.value === 4, "106a: a held arm is NOT cleared");
  p.rollCards = [4, 4];
  game.armRollCard(p.id, 4);
  p.rollCards = [4]; // one copy removed, one remains
  game._reconcileArmedRoll(p);
  assert(p.armedRoll && p.armedRoll.value === 4, "106a: arm survives while a duplicate copy remains");
  p.rollCards = []; // last copy gone
  game._reconcileArmedRoll(p);
  assert(p.armedRoll == null, "106a: arm cleared once the value is no longer held");
  game.cleanup();
}

// (106b removed — it exercised the cancel-MISS penalty path; the wrong-Predict
// penalty + chosen discard is covered in section 68c.)

// 106d: going ghost clears the arm (a ghost never plays a rune).
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const p = game.players[1]; // not the current player, so makeGhost won't drive a turn
  p.startPickPending = false;
  p.rollCards = [4];
  game.armRollCard(p.id, 4);
  assert(p.armedRoll && p.armedRoll.value === 4, "106d: arm set before ghosting");
  assert(game.makeGhost(p.id) === true, "106d: player becomes a ghost");
  assert(p.armedRoll == null, "106d: ghosting clears the arm");
  game.cleanup();
}

// 106e: the getState backstop hides a stale arm without mutating the live player,
// and a valid arm is still shipped.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const p = game.players[0];
  p.startPickPending = false;
  p.rollCards = [3];
  game.armRollCard(p.id, 3);
  let seen = game.getState(p.id).players.find((pp) => pp.id === p.id);
  assert(seen && seen.armedRoll && seen.armedRoll.value === 3, "106e: a valid arm IS shipped to its owner");
  // Force a dangling arm directly (bypassing the source-site clears).
  p.armedRoll = { value: 5 }; // not in rollCards ([3])
  seen = game.getState(p.id).players.find((pp) => pp.id === p.id);
  assert(seen && seen.armedRoll == null, "106e: getState does NOT ship a stale arm");
  assert(p.armedRoll && p.armedRoll.value === 5, "106e: backstop is non-mutating (raw field untouched)");
  game.cleanup();
}

// ============================================================
section("107. Dodecahedron — d12 origin, single-die roll, pass-around, ghost, toggle");
// ============================================================
// ON by default: a single 12-sided die that REPLACES its owner's 2d6. It
// originates with the FIRST player to LAND on the Super Banana, then moves on any
// landing collision involving the owner (owner lands on someone → gives it;
// someone lands on the owner → takes it). A ghost owner keeps + rolls it.
// Appended at EOF so it doesn't shift the seeded fuzz RNG of the sections above.

function _unownedFarm(game) {
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && !pr.owner) return i;
  }
  return -1;
}

// 107a: ON by default; the admin can toggle it via updateSettings.
{
  const g = new MonkeyBusinessGame("D", 2, 5000, "classic", undefined, true);
  g.addPlayer("p0", "P0");
  assert(g.dodecahedron === true, "107a: dodecahedron is ON by default");
  g.updateSettings("p0", { dodecahedron: false });
  assert(g.dodecahedron === false, "107a: admin toggles the dodecahedron OFF");
  g.updateSettings("p0", { dodecahedron: true });
  assert(g.dodecahedron === true, "107a: ... and back ON");
}

// 107b: the d12 originates with the FIRST player to LAND on the Super Banana.
{
  const { game } = createStartedGame(2, { startingMoney: 100 });
  const [a] = game.players;
  for (const p of game.players) p.startPickPending = false;
  assert(game.d12OwnerId === null, "107b: nobody owns the d12 before an SB landing");
  const sb = _sbPos(game);
  a.money = 100; // can't afford the 4000 SB → reveals + grants, no win
  a.position = sb;
  game._processLanding(a, true);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(game.d12OwnerId === a.id, "107b: the first SB-lander claims the dodecahedron");
  assert(game.lastHexResult && game.lastHexResult.playerId === a.id, "107b: the SB-lander gets a 'hexed' notification");
  game.cleanup();
}

// 107c: the owner rolls a single uniform 1..12 (bounds), tagged diceIsD12; a
// non-owner rolls a normal 2d6.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a, b] = game.players;
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  game._processLanding = () => {};
  game.d12OwnerId = a.id;
  const real = Math.random;
  Math.random = () => 0; // low bound → d12 = 1 (a 2d6 can NEVER roll a 1)
  game.currentPlayerIndex = game.players.indexOf(a); game.diceRolled = false; a.position = 0;
  game.rollDice(a.id);
  assert(game.dice.length === 1 && game.dice[0] === 1 && game.diceIsD12 === true, "107c: d12 owner rolls a single 1 at the low bound (tagged d12)");
  Math.random = () => 0.9999; // high bound → d12 = 12
  game.currentPlayerIndex = game.players.indexOf(a); game.diceRolled = false; a.position = 0;
  game.rollDice(a.id);
  assert(game.dice.length === 1 && game.dice[0] === 12, "107c: hex d12 high bound is 12");
  Math.random = real;
  game.currentPlayerIndex = game.players.indexOf(b); game.diceRolled = false; b.position = 0;
  game.rollDice(b.id);
  assert(game.dice.length === 2 && game.diceIsD12 === false, "107c: a non-owner rolls a normal 2d6 (not tagged d12)");
  game.cleanup();
}

// 107d: the OWNER landing on someone GIVES them the d12.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [a, b, c] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.d12OwnerId = a.id;
  const farm = _unownedFarm(game);
  a.position = farm; b.position = farm; c.position = (farm + 6) % game.boardSize;
  game._processLanding(a, true); // owner a lands where b is
  assert(game.d12OwnerId === b.id, "107d: an owner landing on a player gives them the d12");
  game.cleanup();
}

// 107e: landing ON the owner TAKES the d12.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [a, b, c] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.d12OwnerId = a.id;
  const farm = _unownedFarm(game);
  a.position = farm; b.position = farm; c.position = (farm + 6) % game.boardSize;
  game._processLanding(b, true); // b lands where owner a is
  assert(game.d12OwnerId === b.id, "107e: landing on the owner takes the d12");
  game.cleanup();
}

// 107f: a GHOST owner keeps + still ROLLS the d12; landing on the ghost steals it.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a] = game.players;
  for (const p of game.players) { p.startPickPending = false; p.position = 0; }
  a.ghost = true;
  game.d12OwnerId = a.id;
  game._processLanding = () => {};
  game.currentPlayerIndex = game.players.indexOf(a); game.diceRolled = false; a.position = 0;
  game.rollDice(a.id);
  assert(game.dice.length === 1 && game.diceIsD12 === true, "107f: a ghost owner rolls the d12");
  game.cleanup();
}
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a, b] = game.players;
  for (const p of game.players) p.startPickPending = false;
  a.ghost = true;
  game.d12OwnerId = a.id;
  const farm = _unownedFarm(game);
  a.position = farm; b.position = farm;
  game._processLanding(b, true); // a live player lands on the ghost owner
  assert(game.d12OwnerId === b.id, "107f: landing on a ghost owner steals the d12");
  game.cleanup();
}

// 107g: with the toggle OFF, no d12 originates and even a forced owner rolls 2d6.
{
  const { game } = createStartedGame(2, { startingMoney: 100, dodecahedron: false });
  const [a] = game.players;
  for (const p of game.players) p.startPickPending = false;
  const sb = _sbPos(game);
  a.money = 100; a.position = sb;
  game._processLanding(a, true);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(game.d12OwnerId === null, "107g: toggle OFF → landing on the SB grants no dodecahedron");
  game._processLanding = () => {};
  game.d12OwnerId = a.id; // even if forced, the toggle gates the roll
  game.currentPlayerIndex = game.players.indexOf(a); game.diceRolled = false; a.position = 0;
  game.rollDice(a.id);
  assert(game.dice.length === 2 && game.diceIsD12 === false, "107g: toggle OFF → always a normal 2d6");
  game.cleanup();
}

// 107h: the d12 owner id rebinds on reconnect.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a] = game.players;
  game.d12OwnerId = a.id;
  game._rebindPlayerId(a.id, "new-a");
  assert(game.d12OwnerId === "new-a", "107h: d12 owner id rebinds when a player reconnects");
  game.cleanup();
}

// 107i: getState ships the toggle + owner + d12 tag (public to all viewers).
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a, b] = game.players;
  let st = game.getState(b.id);
  assert(st.dodecahedron === true, "107i: getState ships the dodecahedron toggle");
  assert(st.d12OwnerId === null && st.diceIsD12 === false, "107i: no owner / not a d12 roll initially");
  game.d12OwnerId = a.id;
  st = game.getState(b.id);
  assert(st.d12OwnerId === a.id, "107i: the d12 owner is public (shipped to all viewers)");
  game.cleanup();
}

// ============================================================
section("108. Super Banana — landing opens the rune auction this turn; d12 claim");
// ============================================================
// Landing on the SB you can't afford opens the MYSTERY rune auction RIGHT NOW
// (this turn) — it blocks the turn until resolved. The Dodecahedron still
// originates with the FIRST player to land on the SB, but landing no longer
// grants any pick/draw to the lander. Appended at EOF so it doesn't shift the
// seeded fuzz RNG.

// 108a: a can't-afford landing opens the rune auction immediately (this turn);
// the turn can't end while it's open.
{
  const { game } = createStartedGame(2, { startingMoney: 100 });
  const [a, b] = game.players;
  for (const p of game.players) { p.startPickPending = false; }
  game.noAuctionTimer = true;
  game.currentPlayerIndex = game.players.indexOf(a);
  game.diceRolled = true;
  const sb = _sbPos(game);
  a.money = 100; a.position = sb;
  b.money = 5000; b.position = _wrap(game, sb + 20);
  game._processLanding(a, true);
  assert(game.auction && game.auction.sbRune && game.auction.landingPlayer === a.id,
    "108a: a can't-afford landing opens the rune auction immediately");
  assert((a.pendingPick || 0) === 0 && (a.pendingDraws || 0) === 0, "108a: the lander gets no pick/draw");
  assert(game.endTurn(a.id) === false, "108a: the turn can't end while the auction is open");
  game.cleanup();
}

// 108b: the FIRST player to land on the SB claims the Dodecahedron (claim kept).
{
  const { game } = createStartedGame(2, { startingMoney: 100 });
  const [a, b] = game.players;
  for (const p of game.players) { p.startPickPending = false; }
  game.noAuctionTimer = true;
  game.dodecahedron = true; game.d12OwnerId = null;
  game.currentPlayerIndex = game.players.indexOf(a);
  game.diceRolled = true;
  const sb = _sbPos(game);
  a.money = 100; a.position = sb;
  b.money = 5000; b.position = _wrap(game, sb + 20);
  game._processLanding(a, true);
  assert(game.d12OwnerId === a.id, "108b: the first SB lander claims the Dodecahedron");
  game.cleanup();
}

// ============================================================
section("109. Super Banana - NO auto-teleport (lander/crosser stays put)");
// ============================================================
// The Super-Banana auto-teleport-back-to-a-farm feature was REMOVED: a broke
// LANDER stays ON the Super Banana, and a rich CROSSER stays where they walked
// to. No warp, no farm-pile collection, no Dodecahedron hand-off via a warp.

function _farmsBehindSb(game, sb, n) {
  const out = [];
  for (let off = 1; off <= game.boardSize && out.length < n; off++) {
    const pos = (sb - off + game.boardSize) % game.boardSize;
    const pr = game.properties.get(pos);
    if (pr && pr.group === "farm") out.push(pos);
  }
  return out;
}

// 109a: a broke LANDER stays on the Super Banana (no teleport); an owned farm
// behind the SB is NOT collected.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a, b] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.noAuctionTimer = true;
  const sb = _sbPos(game);
  const farms = _farmsBehindSb(game, sb, 1);
  game.properties.get(farms[0]).owner = a.id;
  game.properties.get(farms[0]).bananaPile = 25;
  a.properties = [farms[0]];
  a.money = 0; a.position = sb; a.revealedTiles.add(sb);
  b.money = 0; b.position = (sb + 20) % game.boardSize;
  game._processLanding(a, true);
  assert(a.position === sb, "109a: a broke lander STAYS on the Super Banana (no teleport)");
  assert(game.properties.get(farms[0]).bananaPile === 25, "109a: the owned farm behind the SB is NOT collected (no warp)");
  game.cleanup();
}

// 109b: a rich CROSSER stays where it crossed to, even after the mystery rune
// auction resolves - no warp back to a farm; the farm pile is untouched.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [a, b] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.noAuctionTimer = true;
  const sb = _sbPos(game);
  const price = game.properties.get(sb).price;
  const farms = _farmsBehindSb(game, sb, 1);
  game.properties.get(farms[0]).owner = a.id;
  game.properties.get(farms[0]).bananaPile = 25;
  a.properties = [farms[0]];
  a.money = price + 100; a.revealedTiles.add(sb);
  const landTile = (sb + 1) % game.boardSize;
  a.position = landTile;
  b.money = 5000; b.position = (sb + 10) % game.boardSize;
  game._resolveSuperBananaCross(a, (sb - 1 + game.boardSize) % game.boardSize);
  assert(game.auction && game.auction.sbRune, "109b: the rich cross still opens the mystery rune auction");
  game.placeBid(a.id, 100);
  game.respondAuction(b.id, true);
  assert(!game.auction, "109b: the auction resolved");
  assert(a.position === landTile, "109b: the crosser STAYS where it crossed to (no teleport to a farm)");
  assert(game.properties.get(farms[0]).bananaPile === 25, "109b: the owned farm behind the SB is NOT collected (no warp)");
  game.cleanup();
}

// ============================================================
section("111. Teleport turn-action — jump to an owned farm, discard 2 runes, cancel interaction");
// ============================================================

// 111a: a teleport JUMPS to the chosen owned farm, collects its pile, discards
// exactly two random spell cards, consumes the turn, and signals a no-walk jump.
{
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos);
  fp.owner = cur.id; fp.bananaPile = 30;
  cur.properties = [farmPos];
  cur.position = (farmPos + 5) % game.boardSize;
  cur.rollCards = [1, 2, 3, 4];
  other.position = (farmPos + 20) % game.boardSize;
  game.diceRolled = false;
  game._processLanding = () => {}; // isolate landing side-effects; pile collect is inline
  const _tot = (g) =>
    g.players.reduce((s, p) => s + p.money, 0) +
    [...g.properties.values()].reduce((s, pr) => s + (pr.bananaPile || 0), 0);
  const moneyBefore = cur.money;
  const mintBefore = game.bananaLedger.minted;
  const totBefore = _tot(game);
  const ok = tpFarm(game, cur.id, farmPos);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true, "111a: teleport to an owned farm succeeds");
  assert(cur.position === farmPos, "111a: the player JUMPS to the chosen owned farm");
  assert(cur.money === moneyBefore + 30 && fp.bananaPile === 0, "111a: collects the destination farm's own pile");
  assert(game.bananaLedger.minted === mintBefore, "111a: collecting a pile mints nothing");
  assert(_tot(game) === totBefore, "111a: total bananas conserved (pile moved into money)");
  assert(cur.rollCards.length === 3, "111a: an uncaught teleport nets -1 card (refund 1 of 2 staked)");
  assert(game.diceRolled === true && cur.hasRolled === true, "111a: teleport consumes the turn's action");
  assert(game.lastTeleport && game.lastTeleport.playerId === cur.id && game.lastTeleport.position === farmPos, "111a: lastTeleport signals the no-walk jump");
  assert(Array.isArray(game.dice) && game.dice.length === 0, "111a: no dice shown for a teleport");
}

// 111b: gating — teleport now needs a pending plain action (a roll), the current
// player, an owned FARM, >=2 cards, and no open auction.
{
  const { game } = _quickStarted(2, { manualTurns: true, startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let myFarm = -1, oppFarm = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") {
      if (myFarm < 0) myFarm = i;
      else { oppFarm = i; break; }
    }
  }
  game.properties.get(myFarm).owner = cur.id; cur.properties = [myFarm];
  game.properties.get(oppFarm).owner = other.id; other.properties = [oppFarm];
  cur.rollCards = [1, 2, 3];
  game._processLanding = () => {};
  // No pending action yet (haven't rolled) → can't teleport.
  assert(game.usePostRollAbility(cur.id, "teleport", { position: myFarm }) === false, "111b: can't teleport before rolling (no pending action)");
  // A non-current player can't teleport.
  assert(game.usePostRollAbility(other.id, "teleport", { position: oppFarm }) === false, "111b: a non-current player can't teleport");
  // Open the ability window (a held plain roll) for the current player.
  const _open = () => { game.pendingAction = { playerId: cur.id, turn: game.turn, rolledDice: [1, 1], rolledIsD12: false, kind: "plain", finalValue: 2, stakeValues: [], teleportPosition: null, cardValue: null, plusSix: false }; game.turnPhase = "ability"; };
  _open();
  assert(game.usePostRollAbility(cur.id, "teleport", { position: oppFarm }) === false, "111b: can't teleport to a farm you don't own");
  assert(game.usePostRollAbility(cur.id, "teleport", { position: _sbPos(game) }) === false, "111b: can't teleport to the Super Banana");
  cur.rollCards = []; // no cards — stake is 1, so 0 is rejected (1+ is fine)
  assert(game.usePostRollAbility(cur.id, "teleport", { position: myFarm }) === false, "111b: can't teleport with no cards (stake is 1)");
  cur.rollCards = [1, 2];
  game.auction = { dummy: true };
  assert(game.usePostRollAbility(cur.id, "teleport", { position: myFarm }) === false, "111b: can't teleport while an auction is open");
  game.auction = null;
  assert(game.usePostRollAbility(cur.id, "teleport", { position: myFarm }) === true, "111b: a legal teleport is accepted once every gate clears");
  forceResolveNoPredict(game);
  assert(cur.position === myFarm, "111b: the legal teleport commits the jump");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
}

// (111c/111d removed — the old cancel-HIT teleport behavior is gone. A teleport
// is now "caught" via the Predict bluff, which still completes the teleport but
// consumes both staked cards; that path is covered in section 68c.)

// 111e: teleporting with exactly two cards stakes both; uncaught it nets −1 (the
// teleport nerf refunds 1), so the hand ends at 1.
{
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = cur.id; cur.properties = [farmPos];
  game.properties.get(farmPos).bananaPile = 0;
  cur.position = (farmPos + 3) % game.boardSize;
  cur.rollCards = [4, 6];
  game.diceRolled = false;
  game._processLanding = () => {};
  const ok = tpFarm(game, cur.id, farmPos);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true && cur.position === farmPos, "111e: a 2-card teleport succeeds");
  assert(cur.rollCards.length === 1, "111e: stake 2, refund 1 (nerf) -> hand ends at 1");
}

// 111f: integration — the REAL _processLanding runs on the destination without
// error and the player ends on their own farm (owned tile -> no auction).
{
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = cur.id; cur.properties = [farmPos];
  game.properties.get(farmPos).bananaPile = 0;
  cur.position = (farmPos + 7) % game.boardSize;
  cur.rollCards = [2, 3, 5];
  other.position = (farmPos + 22) % game.boardSize;
  game.diceRolled = false;
  const ok = tpFarm(game, cur.id, farmPos);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true, "111f: real-_processLanding teleport resolves");
  assert(cur.position === farmPos, "111f: lands on the owned farm");
  assert(!game.auction, "111f: teleporting onto your OWN farm opens no auction");
  assert(cur.rollCards.length === 2, "111f: teleport nets -1 (3 -> 2)");
}

// 111g: leaving a SQUAT via teleport steals NOTHING — under the steal-on-LAND rule
// you only grab an opponent's pile by LANDING on it; teleporting away takes nothing
// (the pile stays with its owner).
{
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let myFarm = -1, oppFarm = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { if (myFarm < 0) myFarm = i; else { oppFarm = i; break; } }
  }
  game.properties.get(myFarm).owner = cur.id; cur.properties = [myFarm];
  game.properties.get(myFarm).bananaPile = 0;
  const opp = game.properties.get(oppFarm);
  opp.owner = other.id; other.properties = [oppFarm]; opp.bananaPile = 45;
  cur.position = oppFarm; // cur is SQUATTING on the opponent's farm (with a pile)
  cur.rollCards = [1, 2, 3];
  game.diceRolled = false;
  game._processLanding = () => {};
  const moneyBefore = cur.money;
  const ok = tpFarm(game, cur.id, myFarm);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true && cur.position === myFarm, "111g: teleport off a squat succeeds");
  assert(cur.money === moneyBefore && opp.bananaPile === 45, "111g: leaving a squat via teleport steals nothing — the pile stays with the owner");
}

// 111h: a TELEPORT does NOT trigger the dodecahedron hex pass-around — warping
// onto your own farm where an opponent stands KEEPS your hex (it's a dice curse).
{
  const { game } = _quickStarted(2, { startingMoney: 5000, dodecahedron: true });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = cur.id; cur.properties = [farmPos];
  game.properties.get(farmPos).bananaPile = 0;
  cur.position = (farmPos + 9) % game.boardSize;
  cur.rollCards = [1, 2, 3];
  game.dodecahedron = true; game.d12OwnerId = cur.id; // cur HOLDS the hex
  other.position = farmPos; // opponent standing on cur's destination farm
  game.diceRolled = false;
  const ok = tpFarm(game, cur.id, farmPos);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true, "111h: teleport onto an occupied owned farm resolves");
  assert(game.d12OwnerId === cur.id, "111h: the hex is NOT given away by a teleport jump");
}

// 111i: ...and a teleport does NOT let you GRAB the hex either — warping onto the
// hex-holder sitting on your farm leaves the hex with them.
{
  const { game } = _quickStarted(2, { startingMoney: 5000, dodecahedron: true });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = cur.id; cur.properties = [farmPos];
  game.properties.get(farmPos).bananaPile = 0;
  cur.position = (farmPos + 9) % game.boardSize;
  cur.rollCards = [1, 2, 3];
  game.dodecahedron = true; game.d12OwnerId = other.id; // OPPONENT holds the hex
  other.position = farmPos; // hex-holder standing on cur's destination farm
  game.diceRolled = false;
  const ok = tpFarm(game, cur.id, farmPos);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(ok === true, "111i: teleport onto the hex-holder resolves");
  assert(game.d12OwnerId === other.id, "111i: the hex is NOT taken by a teleport jump");
}

// 111j: the player CHOOSES which two cards to discard via discardIndices; a
// malformed pick falls back to RANDOM so the cost is still always paid.
{
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos);
  fp.owner = cur.id; cur.properties = [farmPos];
  cur.position = (farmPos + 5) % game.boardSize;
  other.position = (farmPos + 20) % game.boardSize;
  game._processLanding = () => {};
  cur.rollCards = [1, 2, 3, 4, 5];
  game.diceRolled = false; cur.hasRolled = false;
  assert(tpFarm(game, cur.id, farmPos, [0, 2]) === true, "111j: chosen-discard teleport succeeds");
  assert(cur.rollCards.length === 4, "111j: an uncaught teleport nets -1 (1 of the 2 staked refunded)");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
}
{
  // Malformed pick (duplicate index) -> random fallback still removes exactly two.
  const { game } = _quickStarted(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  const fp = game.properties.get(farmPos);
  fp.owner = cur.id; cur.properties = [farmPos];
  cur.position = (farmPos + 5) % game.boardSize;
  other.position = (farmPos + 20) % game.boardSize;
  game._processLanding = () => {};
  cur.rollCards = [1, 2, 3, 4, 5];
  game.diceRolled = false; cur.hasRolled = false;
  assert(tpFarm(game, cur.id, farmPos, [1, 1]) === true, "111j: a malformed pick still teleports");
  assert(cur.rollCards.length === 4, "111j: net -1 regardless of a malformed pick");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
}

// ============================================================
section("112. +6 mode — a played spell card rolls value + 6 (full move, no inversion/grow)");
// ============================================================
// While plusSixRolls is ON, playing a card of value N rolls N+6 (7..12): it walks
// its FULL value (no 7-N inversion) and never grow-matches (a value >= 7 fires no grow).
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;
  game._processLanding = () => {};
  if (other) other.position = 24;

  // OFF (default): card 2 walks 7-2 = 5.
  cur.position = 0;
  cur.rollCards = [2];
  game.diceRolled = false; cur.hasRolled = false;
  playCard(game, cur.id, 0);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.position === 5, "112: with +6 OFF, card 2 walks 7-2 = 5");
  assert(Array.isArray(game.dice) && game.dice[0] === 2, "112: +6 OFF rolls the face value (2)");

  // Toggle +6 ON: card 2 now rolls 2+6 = 8 → moves 8 (full value, no inversion).
  assert(game.setPlusSixRolls(cur.id, true) === true, "112: setPlusSixRolls(true) succeeds");
  assert(cur.plusSixRolls === true, "112: the +6 flag is set");
  cur.position = 0;
  cur.rollCards = [2];
  game.diceRolled = false; cur.hasRolled = false;
  playCard(game, cur.id, 0);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.position === 8, "112: with +6 ON, card 2 rolls 2+6=8 and moves 8 (no inversion)");
  assert(game.dice[0] === 8, "112: +6 ON rolls value+6 (8)");

  // Toggle OFF again.
  assert(game.setPlusSixRolls(cur.id, false) === true, "112: setPlusSixRolls(false) succeeds");
  assert(cur.plusSixRolls === false, "112: the +6 flag clears");
}

// ============================================================
section("113. Mega buttons — Matching / Alternative spell-card megas (Mega Mode only)");
// ============================================================
// In Mega Mode every spell card is a "Mega". The roller can auto-spend one via the
// ability modal: MATCHING spends a card whose value == the grow this roll FIRES
// (→ the card-matches-roll REDRAW); ALTERNATIVE spends the lowest NON-matching card
// (the only option when no grow fires) → NO redraw. Both route through the existing
// card-play pipeline (useRollCard), so the mega payoff = a kind:"card" commit.
{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.startPickPending = false; p.revealedTiles = new Set(); }
  game._processLanding = () => {};

  // Label + reveal a grow so a roll of V genuinely FIRES it.
  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i] && game.board[i].type === "grow") { growPos = i; break; }
  }
  assert(growPos >= 0, "113: found a grow tile");
  const V = 3;
  game.growTileLabels = game.growTileLabels || new Map();
  for (const [pos, lbl] of [...game.growTileLabels]) { if (lbl === V) game.growTileLabels.delete(pos); }
  game.growTileLabels.set(growPos, V);
  for (const p of game.players) p.revealedTiles.add(growPos);
  const home = (growPos + 5) % game.boardSize; // stand clear → a roll, not a landing
  assert(game._wouldRolledGrowFire(V) === true, "113: a roll of V fires the revealed grow");

  function openRoll(value) {
    game.pendingAction = {
      playerId: cur.id, turn: game.turn, rolledDice: [value, 0], rolledIsD12: false,
      kind: "plain", finalValue: value, stakeValues: [],
      teleportPosition: null, cardValue: null, plusSix: false,
    };
    game.turnPhase = "ability";
    game.diceRolled = false; cur.hasRolled = false; cur.position = home;
  }

  // (a) Mega Mode GATE — off → both rejected.
  game.megaMode = false;
  cur.rollCards = [V, 1];
  openRoll(V);
  assert(game.usePostRollAbility(cur.id, "matching_mega") === false, "113a: matching_mega rejected when Mega Mode OFF");
  assert(game.usePostRollAbility(cur.id, "alternative_mega") === false, "113a: alternative_mega rejected when Mega Mode OFF");
  game.megaMode = true;

  // (b) MATCHING — spend the card == fired grow; REDRAW keeps the hand net-neutral.
  cur.rollCards = [V, 1, 1];
  const beforeLen = cur.rollCards.length;
  openRoll(V);
  assert(game.usePostRollAbility(cur.id, "matching_mega") === true, "113b: matching_mega accepted (fired grow + held matching card)");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.rollCards.length === beforeLen, "113b: matching mega is net-neutral (spend 1 + redraw 1)");
  assert(cur.position === (home + (7 - V)) % game.boardSize, "113b: matching mega plays card V as a turtle move (walks 7-V)");

  // (c) ALTERNATIVE with NO grow fired — matching rejected; alternative spends the
  //     lowest card and does NOT redraw.
  cur.rollCards = [2, 5];
  openRoll(12); // a 1-6 card can never match 12, and 12 fires no grow
  assert(game.usePostRollAbility(cur.id, "matching_mega") === false, "113c: matching_mega rejected when no grow fires");
  assert(game.usePostRollAbility(cur.id, "alternative_mega") === true, "113c: alternative_mega accepted (a non-matching card exists)");
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.rollCards.length === 1 && cur.rollCards.includes(5) && !cur.rollCards.includes(2), "113c: alternative spends the lowest card (2), no redraw");
  assert(cur.position === (home + (7 - 2)) % game.boardSize, "113c: alternative plays the spent card as a turtle move");

  // (d) MATCHING needs a HELD matching card even when the grow fires.
  cur.rollCards = [1, 1];
  openRoll(V);
  assert(game.usePostRollAbility(cur.id, "matching_mega") === false, "113d: matching_mega rejected without a held card == fired grow");

  // (e) ALTERNATIVE needs a NON-matching card (a hand of only matching cards → none).
  cur.rollCards = [V];
  openRoll(V);
  assert(game.usePostRollAbility(cur.id, "alternative_mega") === false, "113e: alternative_mega rejected when every card matches the fired grow");
}

// ============================================================
// SUMMARY
// ============================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}`);

if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
