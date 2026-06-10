// Comprehensive game mechanics test suite
const { MonkeyBusinessGame } = require("./gameLogic");

let passed = 0;
let failed = 0;
const failures = [];

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
    opts.bombMode !== undefined ? opts.bombMode : true,
    opts.monkeyPoker !== undefined ? opts.monkeyPoker : true,
  );
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
  return { game, players };
}

// Park the roller one tile past the Super Banana — no roll sum (max 18 with
// 3 dice) wraps the board back to it — and move everyone else out of landing
// reach. Landing on the Super Banana wins the game (rich) or demands a
// hideout pick (broke), blocking endTurn and changing money; landing on an
// opponent fires poker. Tests doing REAL rolls call this first so the
// landing stays effect-neutral on a shuffled board.
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
  assert(game.bombMode === true, "Bomb mode on");
  assert(game.monkeyPoker === true, "Monkey poker on");

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
section("5. Paid Dice (1 or 3 dice)");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  cur.cards.rabbitDice = 1; // Turtle Dice (1 die)
  parkForNeutralRoll(game, cur);

  const moneyBefore = cur.money;
  const result = game.rollDice(cur.id, 1);
  assert(result !== null, "Can roll with 1 die using Turtle Dice item");
  assert(result.dice.length === 1, "Got 1 die result");
  assert(cur.money === moneyBefore, "Rolling with items is always free");
  assert(cur.cards.rabbitDice === 0, "Turtle Dice item consumed");
}

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  cur.cards.cheetahDice = 1; // Rabbit Dice (3 dice)
  parkForNeutralRoll(game, cur);

  const moneyBefore = cur.money;
  const result = game.rollDice(cur.id, 3);
  assert(result !== null, "Can roll with 3 dice using Rabbit Dice item");
  assert(result.dice.length === 3, "Got 3 dice result");
  assert(cur.money === moneyBefore, "Rolling with items is always free");
  assert(cur.cards.cheetahDice === 0, "Rabbit Dice item consumed");
}

// ============================================================
section("6. End Turn");
// ============================================================

{
  const { game } = createStartedGame(2);
  const firstPlayer = game.getCurrentPlayer().id;

  // Can't end turn before rolling
  assert(!game.endTurn(firstPlayer), "Can't end turn before rolling");

  parkForNeutralRoll(game, game.getCurrentPlayer());
  game.rollDice(firstPlayer);

  // Cancel auto-end timer for testing
  game._cancelAutoEnd();

  assert(game.endTurn(firstPlayer), "Can end turn after rolling");
  assert(game.getCurrentPlayer().id !== firstPlayer, "Turn advanced to next player");
  assert(game.diceRolled === false, "Dice reset for next player");
}

// ============================================================
section("7. Debug Move & Teleport");
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
      // passBid is retired in the new system — always returns false
      assert(!game.passBid(cur.id), "passBid is disabled");

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

function _setupItemAuction(game, starterId) {
  game.itemAuction = {
    phase: "wheel", item: "teleport", startedBy: starterId,
    wheelStartedAt: 0, wheelEndsAt: 0, listPrice: null,
    respondDeadline: null, respondStartTime: null,
    silentDeadline: null, silentStartTime: null,
    bids: {}, participantIds: [], excludedIds: [], acceptorIds: [], result: null,
  };
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

// Item auction: broke spinner, moneyed opponent → opponent gets the item free.
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const [p0, p1] = game.players;
  p0.money = 0; p1.money = 5000;
  _setupItemAuction(game, p0.id);
  game._beginItemAuctionPitch();
  const a = game.itemAuction;
  assert(a && a.result && a.result.winnerId === p1.id, "item: broke spinner -> moneyed opponent gets the item free");
  assert(a.result.pricePaid === 0, "item awarded free");
  if (game._itemAuctionTimer) clearTimeout(game._itemAuctionTimer);
  game.itemAuction = null;
}

// Item auction: moneyed spinner, all others broke → spinner keeps it free.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  p0.money = 5000; p1.money = 0; p2.money = 0;
  _setupItemAuction(game, p0.id);
  game._beginItemAuctionPitch();
  const a = game.itemAuction;
  assert(a && a.result && a.result.winnerId === p0.id, "item: moneyed spinner, others broke -> spinner keeps item free");
  if (game._itemAuctionTimer) clearTimeout(game._itemAuctionTimer);
  game.itemAuction = null;
}

// Item auction: broke spinner + 2 moneyed → sealed item bid; highest wins.
{
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  const [p0, p1, p2] = game.players;
  p0.money = 0; p1.money = 5000; p2.money = 2000;
  _setupItemAuction(game, p0.id);
  game._beginItemAuctionPitch();
  const a = game.itemAuction;
  assert(a && a.phase === "silentbid" && a.sealedBid === true, "item: broke spinner + 2 moneyed -> sealed item bid");
  assert(
    a.acceptorIds.includes(p1.id) && a.acceptorIds.includes(p2.id) && !a.acceptorIds.includes(p0.id),
    "only moneyed players bid on the item",
  );
  assert(game.submitItemBid(p1.id, 300), "p1 submits a sealed item bid");
  assert(game.submitItemBid(p2.id, 150), "p2 submits a sealed item bid");
  const res = game.itemAuction && game.itemAuction.result;
  assert(res && res.winnerId === p1.id, "highest sealed item bid wins");
  assert(res.pricePaid === 300, "sealed item-bid winner pays their bid");
  assert(p1.cards && p1.cards.teleport >= 1, "winner receives the item");
  if (game._itemAuctionTimer) clearTimeout(game._itemAuctionTimer);
  game.itemAuction = null;
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
section("11. Poker - Monkey Poker");
// ============================================================

{
  const { game } = createStartedGame(2, { monkeyPoker: true, startingMoney: 5000 });

  // Put both players on the same tile to trigger poker
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  // Move other player to a specific tile first
  other.position = 5;

  // Move current player to the same tile
  game.debugMove(cur.id, 5);
  game._cancelAutoEnd();

  if (game.poker) {
    assert(game.poker.monkeyPoker === true, "Monkey poker mode active");
    // The challenger (landing player) posts the small blind; opponent the big.
    assert(game.poker.sbPlayer === cur.id, "Challenger (lander) is SB");
    assert(game.poker.bbPlayer === other.id, "Opponent is BB");
    assert(game.poker.pot > 0, "Pot has blinds");

    // SB (challenger) acts first preflop
    assert(game.poker.currentTurn === cur.id, "SB (challenger) acts first preflop");

    // Play it out via the current turn (SB calls, BB checks, etc.)
    let safety = 0;
    while (game.poker && !game.poker.resolved && safety < 20) {
      const turn = game.poker.currentTurn;
      const toCall = game.poker.currentBet - game.poker.players[turn].bet;
      if (toCall > 0) {
        game.pokerAction(turn, "call");
      } else {
        game.pokerAction(turn, "check");
      }
      safety++;
    }

    if (game.poker) {
      assert(game.poker.resolved === true, "Poker eventually resolves");
      assert(game.poker.winner !== null, "Winner determined");
    }
  } else {
    console.log("  (Poker didn't trigger - players may not be on same tile after landing effects)");
  }
}

// ============================================================
section("12. Poker - Fold");
// ============================================================

{
  const { game } = createStartedGame(2, { monkeyPoker: true, startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  other.position = 7;
  game.debugMove(cur.id, 7);
  game._cancelAutoEnd();

  if (game.poker) {
    const sbId = game.poker.currentTurn;
    const bbId = sbId === cur.id ? other.id : cur.id;

    assert(game.pokerAction(sbId, "fold"), "Player can fold");
    assert(game.poker.resolved === true, "Poker resolves on fold");
    assert(game.poker.winner === bbId, "Non-folding player wins");
  }
}

// ============================================================
section("13. Poker - Raise");
// ============================================================

{
  const { game } = createStartedGame(2, { monkeyPoker: true, startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  other.position = 9;
  game.debugMove(cur.id, 9);
  game._cancelAutoEnd();

  if (game.poker) {
    const sbId = game.poker.currentTurn;
    const bbId = sbId === cur.id ? other.id : cur.id;

    // No-limit static raises: amount = total to raise TO this round.
    // Opening stake is 10% of the defender's 5000 = 500, so min raise-to is
    // 1000 (current bet + previous bet size).
    const stake = game.poker.currentBet;
    assert(!game.pokerAction(sbId, "raise", stake + 1), "Rejects raise below NL minimum");
    assert(!game.pokerAction(sbId, "raise", 0), "Rejects 0 raise");
    assert(game.pokerAction(sbId, "raise", stake * 2), "Challenger can raise to 2x stake");
    assert(game.poker.currentBet === stake * 2, "Current bet updated to raise-to amount");
    assert(game.poker.currentTurn === bbId, "Turn passes to defender after raise");
    // Defender re-raise must add at least the previous raise size again.
    assert(!game.pokerAction(bbId, "raise", stake * 2 + 1), "Rejects under-sized re-raise");
    assert(game.pokerAction(bbId, "raise", stake * 3), "Defender can re-raise");
  }
}

// ============================================================
section("17. Bomb System - Buy & Place");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 20000, bombMode: true });
  const cur = game.getCurrentPlayer();

  assert(game.bombCost === 666, "Bomb cost defaults to 666");
  game.bombCost = 5000; // pin a known cost for the deduction maths below

  assert(game.buyBomb(cur.id), "Can buy bomb with 20000 bananas");
  assert(cur.bomb === 1, "Player has 1 bomb");
  assert(cur.money === 15000, "5000 deducted");

  // Can buy additional bombs (no per-player cap)
  assert(game.buyBomb(cur.id), "Can buy second bomb");
  assert(cur.bomb === 2, "Player now holds 2 bombs");
  assert(cur.money === 10000, "Another 5000 deducted");

  // Place one bomb (decrements held count)
  assert(game.placeBomb(cur.id, 10), "Can place bomb on tile 10");
  assert(cur.bomb === 1, "Held bomb count decremented after placement");
  assert(game.bombs.length === 1, "Bomb on board");
  assert(game.bombs[0].position === 10, "Bomb at correct position");
  assert(game.bombs[0].turnsLeft === 3, "Bomb has 3 turns left");
}

// ============================================================
section("18. Bomb System - Can't afford");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 1000, bombMode: true });
  const cur = game.getCurrentPlayer();
  game.bombCost = 2000; // more than the player's 1000 bananas
  assert(!game.buyBomb(cur.id), "Can't buy bomb with insufficient funds");
}

// ============================================================
section("19. Bomb Detonation");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000, bombMode: true });
  const p0 = game.players[0];
  const p1 = game.players[1];

  // Place bomb manually
  game.bombs.push({ placedBy: p0.id, position: 10, turnsLeft: 1 });

  // Move other player to bomb tile
  p1.position = 10;

  // Trigger detonation check
  const detonated = game._checkBombDetonation(p1);
  assert(detonated === true, "Bomb detonates when player lands on it");
  assert(p1.bankrupt === true, "Victim is eliminated");
  assert(game.bombs.length === 0, "Bomb removed after detonation");
}

// ============================================================
section("20. Vine Swing");
// ============================================================

{
  const { game } = createStartedGame(2);
  const cur = game.getCurrentPlayer();

  // Give player a property
  const propPos = 5;
  const prop = game.properties.get(propPos);
  if (prop) {
    prop.owner = cur.id;
    cur.properties.push(propPos);

    // Simulate vine swing state
    game.vineSwing = cur.id;

    // Can swing to own property
    assert(game.vineSwingMove(cur.id, propPos), "Can swing to own property");
    assert(cur.position === propPos, "Player moved to property");
    assert(game.vineSwing === null, "Vine swing cleared");

    // Can't swing to non-owned tile
    game.vineSwing = cur.id;
    assert(!game.vineSwingMove(cur.id, propPos + 1), "Can't swing to non-owned tile");
  }
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
    game._collectBananasAtTile(cur, farmPos);
    assert(cur.money === moneyBefore + 500, "Collected own banana pile");
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
    if (prop && prop.group !== "superBanana") {
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
    game._collectBananasAtTile(cur, farmPos);
    assert(cur.money === moneyBefore + 300, "Stole opponent's banana pile");
    assert(prop.bananaPile === 0, "Opponent's pile cleared");
  }
}

// ============================================================
section("25. Trading (2v2) - cap + fee");
// ============================================================

{
  const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: 5000 });

  // In team mode, teams are assigned. Find teammates
  const teamA = game.teams.A;
  const p0 = game.players.find(p => p.id === teamA[0]);
  const p1 = game.players.find(p => p.id === teamA[1]);

  if (p0 && p1) {
    const moneyBefore0 = p0.money;
    const moneyBefore1 = p1.money;

    // Fee = 5% of starting bananas (5000 here) = 250
    const fee = Math.max(1, Math.floor(game.startingMoney * 0.05));
    assert(fee === 250, "Fee is 5% of starting bananas");
    assert(game.tradeBananas(p0.id, p1.id, 1000), "Teammates can trade bananas");
    assert(p0.money === moneyBefore0 - 1000 - fee, "Sender loses amount + 5% fee");
    assert(p1.money === moneyBefore1 + 1000, "Recipient gets full amount");
  }
}

// ============================================================
section("26. Trading - Cross-team rejected");
// ============================================================

{
  const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: 5000 });
  const teamA = game.teams.A;
  const teamB = game.teams.B;

  assert(!game.tradeBananas(teamA[0], teamB[0], 1000), "Cross-team trading rejected");
}

// ============================================================
section("27. Sell Property");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  // Give player a property
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

    // List for sale
    assert(game.sellProperty(cur.id, farmPos, 2000), "Can list property for sale");
    assert(game.sellListings.length === 1, "Listing created");

    // Other player buys
    const otherMoney = other.money;
    const curMoney = cur.money;
    const result = game.buySale(other.id, game.sellListings[0].id);
    assert(result !== false, "Other player can buy listed property");
    assert(other.money === otherMoney - 2000, "Buyer pays the price");
    assert(cur.money === curMoney + 2000, "Seller receives the money");
    assert(prop.owner === other.id, "Property ownership transferred");
    assert(game.sellListings.length === 0, "Listing removed after sale");
  }
}

// ============================================================
section("28. Cancel Sale");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

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

    game.sellProperty(cur.id, farmPos, 2000);
    const saleId = game.sellListings[0].id;

    // Other player can't cancel
    const other = game.players.find(p => p.id !== cur.id);
    assert(!game.cancelSale(other.id, saleId), "Non-seller can't cancel");

    // Seller can cancel
    assert(game.cancelSale(cur.id, saleId), "Seller can cancel own listing");
    assert(game.sellListings.length === 0, "Listing removed");
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
  assert(state.bombMode !== undefined, "State has bomb mode flag");
}

// ============================================================
section("33. Poker Privacy - Cards Hidden");
// ============================================================

{
  const { game } = createStartedGame(2, { monkeyPoker: true, startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  other.position = 15;
  game.debugMove(cur.id, 15);
  game._cancelAutoEnd();

  if (game.poker && !game.poker.resolved) {
    const stateP0 = game.getState(cur.id);
    const stateP1 = game.getState(other.id);

    if (stateP0.poker && stateP1.poker) {
      assert(stateP0.poker.players[cur.id].cards !== null, "Player can see own cards");
      assert(stateP0.poker.players[other.id].cards === null, "Player can't see opponent's cards");
      assert(stateP1.poker.players[other.id].cards !== null, "Other player sees own cards");
    }
  }
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
section("39. Tax Tile");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Find a tax tile
  let taxPos = -1;
  for (let i = 0; i < 48; i++) {
    if (game.board[i].type === "tax10") {
      taxPos = i;
      break;
    }
  }

  if (taxPos >= 0) {
    cur.position = taxPos;
    const before = cur.money;
    game._processLanding(cur);
    const expected = Math.floor(before * 0.9);
    assert(cur.money === expected, `Tax 10% applied correctly (${before} -> ${cur.money}, expected ${expected})`);
  } else {
    console.log("  (No tax tile found)");
  }
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
section("44. Bomb Timer Ticking");
// ============================================================

{
  const { game } = createStartedGame(2, { bombMode: true });

  game.bombs.push({ placedBy: "p0", position: 10, turnsLeft: 3 });

  const cur = game.getCurrentPlayer();
  // No real roll: a random roll can land on the (shuffled) Super Banana and
  // win, blocking endTurn. Ticking only needs a legal endTurn.
  game.diceRolled = true;
  game.endTurn(cur.id);

  assert(game.bombs[0].turnsLeft === 2, "Bomb timer ticks down on end turn");
}

// ============================================================
section("45. Placer steps on own bomb -> defused, no damage");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000, bombMode: true });
  const p0 = game.players[0];

  game.bombs.push({ placedBy: p0.id, position: 10, turnsLeft: 1 });
  p0.position = 10;

  const before = p0.money;
  game._checkBombDetonation(p0);

  assert(p0.bankrupt === false, "Self-bomb doesn't eliminate placer");
  assert(p0.money === before, "Self-bomb takes no damage");
  assert(game.bombs.length === 0, "Bomb is defused (removed from board)");
}

// ============================================================
section("45b. Placer stepping on own bomb does NOT eliminate adjacent players");
// ============================================================

{
  const { game } = createStartedGame(3, { startingMoney: 10000, bombMode: true });
  const p0 = game.players[0];
  const p1 = game.players[1];

  game.bombs.push({ placedBy: p0.id, position: 10, turnsLeft: 1 });
  p0.position = 10;
  p1.position = 11; // adjacent to bomb

  game._checkBombDetonation(p0);

  assert(p0.bankrupt === false, "Placer not eliminated");
  assert(p1.bankrupt === false, "Adjacent player not eliminated when placer steps on own bomb");
  assert(game.bombs.length === 0, "Bomb defused when placer walks back onto it");
}

// ============================================================
section("45c. Non-placer landing on active bomb eliminates them and adjacent players");
// ============================================================

{
  const { game } = createStartedGame(3, { startingMoney: 10000, bombMode: true });
  const p0 = game.players[0];
  const p1 = game.players[1];
  const p2 = game.players[2];

  game.bombs.push({ placedBy: p0.id, position: 10, turnsLeft: 1 });
  p1.position = 10; // lands on bomb
  p2.position = 9;  // adjacent to bomb

  const detonated = game._checkBombDetonation(p1);

  assert(detonated === true, "Bomb detonated");
  assert(p1.bankrupt === true, "Player who landed on bomb is eliminated");
  assert(p2.bankrupt === true, "Player on adjacent tile is eliminated");
  assert(game.bombs.length === 0, "Bomb removed after detonation");
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
section("47. Multiple Sell Listings Limit");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 50000 });
  const cur = game.getCurrentPlayer();

  // Give player 6 properties
  const positions = [];
  let count = 0;
  for (let i = 1; i < 48 && count < 6; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "superBanana") {
      prop.owner = cur.id;
      cur.properties.push(i);
      positions.push(i);
      count++;
    }
  }

  if (positions.length >= 6) {
    // List 5 properties
    for (let i = 0; i < 5; i++) {
      assert(game.sellProperty(cur.id, positions[i], 100), `Listing ${i + 1} succeeds`);
    }
    // 6th should fail
    assert(!game.sellProperty(cur.id, positions[5], 100), "6th listing rejected (limit 5)");
  }
}

// ============================================================
section("48. Duplicate Sell Listing Prevention");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

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

    assert(game.sellProperty(cur.id, farmPos, 100), "First listing succeeds");
    assert(!game.sellProperty(cur.id, farmPos, 200), "Duplicate listing rejected");
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
  assert(game.bombWinner === "p0", "Last player is winner");
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
section("51. Super Banana - Can't Afford (Swap)");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 500 });
  const cur = game.getCurrentPlayer();

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
    // Keep opponents off the super banana tile so landing triggers the Super
    // Banana flow, not poker (createStartedGame parks everyone on tile 0).
    for (const p of game.players) {
      if (p.id !== cur.id) p.position = (superBananaPos + 1) % game.boardSize;
    }
    game._processLanding(cur);

    assert(game.superBananaPending !== null, "Super Banana pending swap initiated when can't afford");
    assert(game.superBananaPending.superBananaPos === superBananaPos, "Correct super banana position in pending");
  } else {
    console.log("  (No super banana property found)");
  }
}

// ============================================================
section("51b. Super Banana swap reveals the swapped-in tile to all players");
// ============================================================
// The swapped-in tile (whatever its type — grow, desert, tax, property)
// must be revealed to every player after the swap completes. Previously this
// was only guaranteed for buyable property tiles; grow / desert tiles
// stayed hidden from non-landers.

function _testSwapReveal(targetType) {
  const { game } = createStartedGame(2, { startingMoney: 500 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);

  let superBananaPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "superBanana") { superBananaPos = i; break; }
  }
  if (superBananaPos < 0) return null;

  // Find a tile of the desired type that nobody has revealed.
  let swapPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (i === superBananaPos) continue;
    if (game.board[i].type !== targetType) continue;
    let anyRevealed = false;
    for (const p of game.players) {
      if (p.revealedTiles.has(i)) { anyRevealed = true; break; }
    }
    if (!anyRevealed) { swapPos = i; break; }
  }
  if (swapPos < 0) return null;

  // Stand on the Super Banana and ensure we can't afford it.
  cur.position = superBananaPos;
  cur.money = 0;
  game._processLanding(cur);
  if (!game.superBananaPending) return null;
  // Force the swap target so we exercise the type we care about.
  game.superBananaPending.swapPos = swapPos;
  game.completeSuperBananaSwap();

  return { game, cur, other, superBananaPos, swapPos };
}

{
  const ctx = _testSwapReveal("grow");
  if (ctx) {
    const { game, cur, other, superBananaPos } = ctx;
    assert(
      cur.revealedTiles.has(superBananaPos),
      "Swap with grow tile: lander sees the swapped-in tile",
    );
    assert(
      other.revealedTiles.has(superBananaPos),
      "Swap with grow tile: opponents see the swapped-in tile too",
    );
  } else {
    console.log("  (Could not set up grow-swap scenario)");
  }
}

{
  const ctx = _testSwapReveal("desert");
  if (ctx) {
    const { game, cur, other, superBananaPos } = ctx;
    assert(
      cur.revealedTiles.has(superBananaPos),
      "Swap with desert tile: lander sees the swapped-in tile",
    );
    assert(
      other.revealedTiles.has(superBananaPos),
      "Swap with desert tile: opponents see the swapped-in tile too",
    );
  } else {
    console.log("  (Could not set up desert-swap scenario)");
  }
}

{
  const ctx = _testSwapReveal("property");
  if (ctx) {
    const { game, cur, other, superBananaPos } = ctx;
    assert(
      cur.revealedTiles.has(superBananaPos),
      "Swap with property tile: lander sees the swapped-in tile",
    );
    assert(
      other.revealedTiles.has(superBananaPos),
      "Swap with property tile: opponents see the swapped-in tile too",
    );
  } else {
    console.log("  (Could not set up property-swap scenario)");
  }
}

// ============================================================
section("51c. Super Banana - player chooses the hideout + private rainbow hint");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 500 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);

  let superBananaPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "superBanana") { superBananaPos = i; break; }
  }

  if (superBananaPos >= 0) {
    cur.position = superBananaPos;
    // Keep opponents off the super banana tile so landing triggers the Super
    // Banana flow, not poker (createStartedGame parks everyone on tile 0).
    for (const p of game.players) {
      if (p.id !== cur.id) p.position = (superBananaPos + 1) % game.boardSize;
    }
    game._processLanding(cur); // money 500 < 777 price → can't afford

    assert(
      game.superBananaPending && game.superBananaPending.awaitingPick === true,
      "Can't-afford queues a player pick (no auto random swap)",
    );
    assert(
      game.superBananaPending.swapPos == null,
      "No hideout is chosen until the player picks",
    );
    assert(
      game.superBananaPending.playerId === cur.id,
      "The landing player is the one who must pick",
    );

    // A genuinely hidden tile that isn't the Super Banana's tile.
    let hideout = -1;
    for (let i = 0; i < game.boardSize; i++) {
      if (i === superBananaPos) continue;
      if (game.players.some((p) => p.revealedTiles.has(i))) continue;
      hideout = i;
      break;
    }
    assert(hideout >= 0, "A hidden hideout tile exists");

    // Opponents can't pick; the super banana tile itself isn't a valid hideout.
    assert(
      game.pickSuperBananaSwap(other.id, hideout) === false,
      "Only the landing player may pick the hideout",
    );
    assert(
      game.pickSuperBananaSwap(cur.id, superBananaPos) === false,
      "Can't hide the Super Banana on its own tile",
    );

    // Valid pick: completes the swap and moves the Super Banana to the hideout.
    assert(
      game.pickSuperBananaSwap(cur.id, hideout) === true,
      "Landing player picks a hidden tile to hide it",
    );
    assert(game.superBananaPending === null, "Pending cleared after the pick");
    const movedProp = game.properties.get(hideout);
    assert(
      movedProp && movedProp.group === "superBanana",
      "Super Banana now lives on the chosen hideout tile",
    );
    const oldProp = game.properties.get(superBananaPos);
    assert(
      !oldProp || oldProp.group !== "superBanana",
      "Super Banana no longer sits on its original tile",
    );

    // The rainbow hint is private to the hider only.
    assert(
      game.getState(cur.id).superBananaHintPos === hideout,
      "Hider sees the rainbow hint at the hideout",
    );
    assert(
      game.getState(other.id).superBananaHintPos == null,
      "Opponents never see the rainbow hint",
    );
  } else {
    console.log("  (No super banana property found)");
  }
}

// ============================================================
section("52. Vine Swing - No Properties");
// ============================================================

{
  const { game } = createStartedGame(2);
  const cur = game.getCurrentPlayer();

  // Find bus/vine swing tile
  let busPos = -1;
  for (let i = 0; i < 48; i++) {
    if (game.board[i].type === "bus") {
      busPos = i;
      break;
    }
  }

  if (busPos >= 0) {
    cur.position = busPos;
    cur.properties = []; // No properties
    game.vineSwing = null;
    game._processLanding(cur);
    // When player has no properties, vine swing should NOT be set
    // The game logs a message but doesn't set vineSwing
    assert(game.vineSwing === null || game.vineSwing === undefined,
      "Vine swing not set when player has no properties");
  }
}

// ============================================================
section("53. Vine Swing - Has Properties");
// ============================================================

{
  const { game } = createStartedGame(2);
  const cur = game.getCurrentPlayer();

  // Give property first
  let farmPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "superBanana") {
      farmPos = i;
      break;
    }
  }

  let busPos = -1;
  for (let i = 0; i < 48; i++) {
    if (game.board[i].type === "bus") {
      busPos = i;
      break;
    }
  }

  if (farmPos >= 0 && busPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = cur.id;
    cur.properties.push(farmPos);

    cur.position = busPos;
    game._processLanding(cur);
    assert(game.vineSwing === cur.id, "Vine swing activated when player has properties");
  }
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
section("55. Classic - No Trading");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });

  assert(!game.tradeBananas("p0", "p1", 1000), "Trading not allowed outside team modes");
}

// ============================================================
section("56. Held bombs do NOT expire across turns");
// ============================================================

{
  // Regression: previously a held bomb would auto-refund after one full
  // round, so a player sitting in "Place Pineapple Bomb" state across
  // turns would lose all their bombs. Bombs are now held indefinitely
  // until placed (or the player goes bankrupt).
  const { game } = createStartedGame(4, { startingMoney: 50000, bombMode: true });
  const cur = game.getCurrentPlayer();

  // Buy 8 bombs up front
  for (let i = 0; i < 8; i++) assert(game.buyBomb(cur.id), `Buy bomb #${i + 1}`);
  assert(cur.bomb === 8, "Has 8 bombs");
  const moneyAfterBuying = cur.money;

  // Simulate many full rounds of turn rotation without the player placing
  for (let i = 0; i < 20; i++) {
    const who = game.getCurrentPlayer();
    who.hasRolled = true;
    game.diceRolled = true;
    game.endTurn();
  }

  assert(cur.bomb === 8, "All 8 bombs still held after many rounds");
  assert(cur.money === moneyAfterBuying, "No refund — money unchanged");
}

// ============================================================
section("57. Squatter Steal on GROW");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const p0 = game.players[0];
  const p1 = game.players[1];

  // Give p0 a farm
  let farmPos = -1;
  for (let i = 1; i < 48; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group && prop.group !== "desert" && prop.group !== "superBanana") {
      farmPos = i;
      break;
    }
  }

  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    p0.properties.push(farmPos);

    // Put opponent on the farm tile (squatter)
    p1.position = farmPos;

    // Move p0 to GROW 25% (position 0)
    p0.position = 0;
    const p1Before = p1.money;
    game._processLanding(p0);

    // Squatter should have received the growth bananas
    if (game.growSquatterSteals && game.growSquatterSteals.length > 0) {
      assert(p1.money > p1Before, "Squatter stole grow bananas");
      assert(prop.bananaPile === 0, "No bananas left on pile (squatter took them)");
    }
  }
}

// ============================================================
section("58. Poker - Real Poker (Texas Hold'em)");
// ============================================================

{
  const { game } = createStartedGame(2, { monkeyPoker: false, startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find(p => p.id !== cur.id);

  other.position = 20;
  game.debugMove(cur.id, 20);
  game._cancelAutoEnd();

  if (game.poker) {
    assert(game.poker.monkeyPoker === false, "Real poker mode");
    assert(game.poker.players[cur.id].cards.length === 2, "SB (challenger) gets 2 hole cards");
    assert(game.poker.players[other.id].cards.length === 2, "BB (opponent) gets 2 hole cards");

    // Play through
    let safety = 0;
    while (game.poker && !game.poker.resolved && safety < 30) {
      const turn = game.poker.currentTurn;
      const p = game.poker.players[turn];
      const toCall = game.poker.currentBet - p.bet;
      if (toCall > 0) {
        game.pokerAction(turn, "call");
      } else {
        game.pokerAction(turn, "check");
      }
      safety++;
    }

    if (game.poker) {
      assert(game.poker.resolved, "Real poker resolves");
      assert(game.poker.communityCards.length === 5, "5 community cards dealt");
      assert(game.poker.bbHandName !== null, "BB hand name set");
      assert(game.poker.sbHandName !== null, "SB hand name set");
    }
  }
}

// ============================================================
section("60. Bomb Visibility - Only Own Bombs");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000, bombMode: true });

  game.bombs.push({ placedBy: "p0", position: 10, turnsLeft: 3 });
  game.bombs.push({ placedBy: "p1", position: 20, turnsLeft: 2 });

  const stateP0 = game.getState("p0");
  assert(stateP0.bombs.length === 1, "P0 only sees own bombs");
  assert(stateP0.bombs[0].position === 10, "P0 sees correct bomb position");

  const stateP1 = game.getState("p1");
  assert(stateP1.bombs.length === 1, "P1 only sees own bombs");
  assert(stateP1.bombs[0].position === 20, "P1 sees correct bomb position");
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
  game.auction = game.poker = game.vineSwing = null;
  game.superBananaPending = null;
  game.itemAuction = null;
  game.diceRolled = false;
  const BSZ = game.boardSize;

  // Force a default 2d6 roll summing to 4 (two 2s). face = floor(r*6)+1; for
  // r=0.25 that's floor(1.5)+1 = 2, so both dice show 2 → sum 4 → fires G4.
  const realRandom = Math.random;
  Math.random = () => 0.25;
  try {
    const sum = 4;
    // A start farm (player stands on it) and a path farm exactly `sum` ahead,
    // both owned by cur.
    let start = -1, pathPos = -1;
    for (let s = 0; s < BSZ; s++) {
      const sp = game.properties.get(s);
      if (!sp || sp.group !== "farm") continue;
      const pp = (s + sum) % BSZ;
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

      // The GROW matching the SUM fires BEFORE the move. Start farm (under the
      // player) is early-picked; path farm is collected as the token walks on.
      assert(cur.position === pathPos, "Rolled sum 4 moved to the path farm");
      assert(cur.money === before + startProp.price + pathProp.price,
        "Pre-move grow: start farm early-picked AND path farm collected during walk");
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
section("65. Classic - Squatter collects growth only on LEAVING (TODO line 56)");
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

    // The growth piles up on the farm — the squatter does NOT grab it on the
    // spot, and no premature 'Steal!' is recorded.
    assert(p1.money === b1, "Squatter does NOT steal the growth the instant it grows");
    assert(p0.money === b0, "Owner (off the tile) gets nothing yet");
    assert(prop.bananaPile === prop.price, "Fresh growth lands in the farm pile");
    assert(!game.growSquatterSteals, "No instant steal recorded (no premature 'Steal!' text)");

    // The squatter collects the pile only when they LEAVE the tile.
    const pile = prop.bananaPile;
    const dest = (farmPos + 3) % game.boardSize;
    game._collectBananasOnPath(p1, farmPos, dest);
    assert(prop.bananaPile === 0, "Pile cleared once the squatter leaves the tile");
    assert(p1.money === b1 + pile, "Squatter collects the pile on departure");
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

    // Now the squatter leaves — nothing remains to take.
    game._collectBananasOnPath(p1, farmPos, (farmPos + 3) % game.boardSize);
    assert(p1.money === b1, "Squatter gets nothing (owner already reclaimed)");
  }
}

// ============================================================
section("65c. Classic - Landing on an opponent's pile defers the steal until you leave");
// ============================================================

{
  const { game, p0, p1, farmPos } = setupGrow();
  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;     // p0 owns the farm
    prop.bananaPile = 250;  // a pile already sitting on it (grown earlier)
    p0.properties.push(farmPos);

    // p1 (opponent) LANDS on p0's farm (newPos === farmPos).
    const b1 = p1.money;
    const landFrom = (farmPos - 2 + game.boardSize) % game.boardSize;
    p1.position = landFrom;
    game._collectBananasOnPath(p1, landFrom, farmPos);
    assert(p1.money === b1, "Landing on an opponent's pile does NOT collect it immediately");
    assert(prop.bananaPile === 250, "Pile stays on the farm after the opponent lands");

    // p1 is now squatting; on their next move they steal it as they leave.
    p1.position = farmPos;
    game._collectBananasOnPath(p1, farmPos, (farmPos + 3) % game.boardSize);
    assert(p1.money === b1 + 250, "Squatter steals the landed-on pile only when leaving");
    assert(prop.bananaPile === 0, "Pile cleared once the squatter leaves");
  }
}

// ============================================================
section("65d. Classic - Merely crossing an opponent's pile never collects it");
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
    assert(prop.bananaPile === 180, "Crossing an opponent's pile leaves it untouched");
    assert(p1.money === b1, "No bananas gained from merely crossing an opponent's farm");
  }
}

// ============================================================
section("65e. Classic - Vine Swing off a squatted farm steals its pile on the way out");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupGrow();
  // Find a farm p1 can swing TO (their own), distinct from the squatted farm.
  let destPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm" && i !== farmPos && i !== growPos) { destPos = i; break; }
  }
  if (farmPos >= 0 && destPos >= 0) {
    const squatted = game.properties.get(farmPos);
    squatted.owner = p0.id;       // p0 owns the squatted farm
    squatted.bananaPile = 220;    // pile waiting on it
    p0.properties.push(farmPos);

    const dest = game.properties.get(destPos);
    dest.owner = p1.id;           // p1 owns the swing destination
    dest.bananaPile = 0;
    p1.properties.push(destPos);

    p1.position = farmPos;        // p1 is squatting on p0's farm
    p0.position = growPos;        // keep p0 clear of the destination (no poker)
    const b1 = p1.money;
    game._useTeleportCard(p1, destPos);

    assert(squatted.bananaPile === 0, "Vine Swing clears the squatted pile on departure");
    assert(p1.money === b1 + 220, "Swinging off a squatted farm steals its pile");
    assert(p1.position === destPos, "Vine Swing lands on the chosen own farm");
  }
}

// ============================================================
section("66. Classic - Cornerless 48-tile board");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });

  assert(game.board.length === 48, "Board has 48 tiles");
  assert(game.boardSize === 48, "boardSize is 48");

  const counts = { grow: 0, bus: 0, special: 0, tax10: 0, desert: 0, farm: 0 };
  for (let i = 0; i < game.board.length; i++) {
    const t = game.board[i];
    if (t.type === "grow") counts.grow++;
    else if (t.type === "bus") counts.bus++;
    else if (t.type === "special") counts.special++;
    else if (t.type === "tax10") counts.tax10++;
    else if (t.type === "desert") counts.desert++;
    else if (t.buyable && t.buyable.group === "farm") counts.farm++;
  }
  assert(counts.grow === 6, "Board has 6 GROW tiles");
  assert(counts.farm === 40, "Board has 40 farm tiles");
  assert(counts.bus === 0, "Board has no Vine Swing tile (now an ability)");
  assert(counts.special === 1, "Board has 1 Super Banana tile");
  assert(counts.tax10 === 0, "Board has no -10% tax tile");
  assert(counts.desert === 1, "Board has 1 Desert tile");

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
section("67. Classic - Roll One item (guaranteed move of 1)");
// ============================================================

{
  const { game } = createStartedGame(2, {
    gameMode: "classic",
    startingMoney: 5000,
    bombMode: false,
    monkeyPoker: false,
  });

  const cur = game.getCurrentPlayer();
  cur.startPickPending = false;
  cur.position = 0;
  for (const p of game.players) p.startPickPending = false;
  game.auction = game.poker = game.vineSwing = null;
  game.superBananaPending = null;
  game.itemAuction = null;
  game.diceRolled = false;

  // Players start with one of each special item.
  assert(cur.cards.magicDice === 1, "Players start with one Roll One item");
  // With no item held, Roll One is unusable.
  cur.cards.magicDice = 0;
  assert(game.useMagicDice(cur.id, 1) === null, "Roll One unusable with no item held");
  assert(game.diceRolled === false, "A failed Roll One attempt didn't consume the roll");

  // Grant two Roll One items.
  cur.cards.magicDice = 2;

  // Roll One always moves EXACTLY 1 — the steps argument is ignored.
  const startPos = cur.position;
  const res = game.useMagicDice(cur.id, 99);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(res && res.moved === true, "Roll One moves the player");
  assert(cur.position === (startPos + 1) % game.boardSize, "Roll One moves exactly 1 space");
  assert(game.diceRolled === true, "Roll One consumed the roll");
  assert(cur.cards.magicDice === 1, "Roll One spends exactly one item");

  // Upgrades are gone: upgradeMagicDice is a no-op.
  const upgrader = game.players[1];
  upgrader.money = 5000;
  assert(game.upgradeMagicDice(upgrader.id) === false, "Upgrade is a no-op (returns false)");
  assert(upgrader.money === 5000, "Upgrade does not charge bananas");
}

// ============================================================
section("68. Classic - Vine Swing ability (your OWN farms only)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;
  game.diceRolled = false;
  game.cardUsedThisTurn = false;
  game.auction = game.poker = game.vineSwing = null;
  game.superBananaPending = null;
  game.itemAuction = null;
  const BSZ = game.boardSize;

  // Players start with one Vine Swing item (granted at game start).
  assert(cur.cards.teleport === 1, "Players start with one Vine Swing item");

  // Unusable with no owned farm.
  cur.properties = [];
  assert(
    game.canUseCard(cur, "teleport") === false,
    "Vine Swing unusable with no owned farm",
  );

  // First farm tile on the board.
  let farmA = -1;
  for (let i = 0; i < game.board.length; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "farm") { farmA = i; break; }
  }
  // A grow tile is never an ownable farm — a safe "not your farm" target.
  let notOwned = -1;
  for (let i = 0; i < game.board.length; i++) {
    if (game.board[i].type === "grow") { notOwned = i; break; }
  }

  // Own farmA with a pile waiting; keep both monkeys off it.
  const propA = game.properties.get(farmA);
  propA.owner = cur.id;
  propA.bananaPile = 150;
  cur.properties.push(farmA);
  cur.position = (farmA + 4) % BSZ;
  other.position = (farmA + 13) % BSZ;

  assert(
    game.canUseCard(cur, "teleport") === true,
    "Vine Swing usable once you own a farm",
  );

  // Reject a tile you don't own.
  const rej = game.useCard(cur.id, "teleport", { pos: notOwned });
  assert(rej === null, "Vine Swing rejects a tile you don't own");
  assert(game.diceRolled === false, "Rejected swing didn't consume the roll");
  assert(cur.cards.teleport === 1, "Rejected swing didn't spend the item");

  // Swing to your own farm: move there, collect its 150 pile, spend the item.
  const beforeMoney = cur.money;
  const res = game.useCard(cur.id, "teleport", { pos: farmA });
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(res && res.moved === true, "Vine Swing to own farm moves the player");
  assert(cur.position === farmA, "Player swung to their own farm");
  assert(cur.money === beforeMoney + 150, "Swinging home collected the farm's pile");
  assert(game.properties.get(farmA).bananaPile === 0, "Pile cleared after swing");
  assert(cur.cards.teleport === 0, "Vine Swing item consumed");
  assert(game.diceRolled === true, "Vine Swing replaced the dice roll");
}

// ============================================================
section("68b. Classic - Arming abilities (off-turn, private, server-side)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;

  // Arming on your own turn BEFORE rolling is allowed (the ability fires on
  // the upcoming roll).
  assert(game.armAbility(cur.id, "rabbitDice") === true, "Arming allowed on own turn before rolling");
  assert(cur.armedAbility === "rabbitDice", "Armed ability stored on own turn before roll");

  // Arming AFTER rolling on your own turn is also allowed — the item persists
  // across endTurn and fires on the player's NEXT roll.
  cur.armedAbility = null;
  game.diceRolled = true;
  assert(game.armAbility(cur.id, "rabbitDice") === true, "Arming allowed on own turn after rolling (fires next roll)");
  assert(cur.armedAbility === "rabbitDice", "Armed ability stored after rolling");
  game.diceRolled = false;
  cur.armedAbility = null;

  // Off-turn arming works (other is not the current player).
  assert(game.armAbility(other.id, "magicDice") === true, "Arming allowed off-turn");
  assert(other.armedAbility === "magicDice", "Armed ability stored on the player");

  // Arming an item you don't own is rejected.
  other.cards.teleport = 0;
  assert(game.armAbility(other.id, "teleport") === false, "Can't arm an item you don't own");
  assert(other.armedAbility === "magicDice", "Failed arm left the previous choice intact");

  // Disarm (null) is allowed anytime — even after rolling on your own turn.
  cur.armedAbility = "cheetahDice";
  game.diceRolled = true;
  assert(game.armAbility(cur.id, null) === true, "Disarm allowed even after rolling");
  assert(cur.armedAbility === null, "Disarm clears the armed ability");
  game.diceRolled = false;

  // Arming is BLOCKED during the first-pick phase.
  cur.armedAbility = null;
  cur.startPickPending = true;
  assert(game.armAbility(cur.id, "rabbitDice") === false, "Arming blocked while startPickPending");
  assert(cur.armedAbility === null, "No ability armed during first-pick");
  // Disarm is also blocked during first-pick (consistent rule).
  cur.armedAbility = "rabbitDice";
  assert(game.armAbility(cur.id, null) === false, "Disarming blocked while startPickPending");
  assert(cur.armedAbility === "rabbitDice", "First-pick leaves the armed slot untouched");
  cur.armedAbility = null;
  cur.startPickPending = false;

  // Armed item PERSISTS across endTurn (so a player who arms after rolling
  // still has it queued for their next roll).
  const savedIdx = game.currentPlayerIndex;
  cur.armedAbility = "rabbitDice";
  game.diceRolled = true;
  cur.hasRolled = true;
  game.superBananaPending = null;
  game.superBananaWin = null;
  game.itemAuction = null;
  assert(game.endTurn(cur.id) === true, "endTurn succeeds with armed item still set");
  assert(cur.armedAbility === "rabbitDice", "Armed ability persists across endTurn");
  cur.armedAbility = null;
  // Restore turn so the next assertion (rollDice clears armedAbility) sees cur
  // as the current player.
  game.currentPlayerIndex = savedIdx;
  game.diceRolled = false;
  cur.hasRolled = false;

  // Armed ability is PRIVATE — only the owner sees it.
  assert(
    game.getState(other.id).players.find((p) => p.id === other.id).armedAbility === "magicDice",
    "Owner sees their own armed ability",
  );
  assert(
    game.getState(cur.id).players.find((p) => p.id === other.id).armedAbility === null,
    "Opponents never see your armed ability",
  );

  // Rolling clears the armed ability (it's spent/moot once you roll).
  cur.armedAbility = "rabbitDice";
  cur.cards.rabbitDice = 1;
  cur.startPickPending = false;
  game.diceRolled = false;
  game.auction = game.poker = game.vineSwing = null;
  game.superBananaPending = null;
  game.itemAuction = null;
  game.rollDice(cur.id, 2);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.armedAbility === null, "Rolling clears the armed ability");
}

// ============================================================
section("69. Classic - Bomb blast spans grow to grow");
// ============================================================

{
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;

  // Side helper still exists for legacy callers (no longer used by bombs).
  assert(JSON.stringify(game._sideTiles(5)) === JSON.stringify([0,1,2,3,4,5,6,7,8,9,10,11]), "Side of tile 5 = bottom (0-11)");
  assert(game._sideTiles(20)[0] === 12 && game._sideTiles(20)[11] === 23, "Side of tile 20 = left (12-23)");

  // Corner tiles sit at 0, 12, 24, 36. A blast spreads from a non-corner bomb
  // tile to the next CORNER (inclusive) in each direction, independently.
  const isCorner = (pos) => pos % 12 === 0;
  // Pick a non-corner bomb tile.
  let bombPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (!isCorner(i)) { bombPos = i; break; }
  }
  assert(bombPos !== -1, "Found a non-corner tile to host the bomb");
  // Walk to the next corner in each direction.
  let cwCorner = -1, ccwCorner = -1;
  for (let d = 1; d < game.boardSize; d++) {
    const p = (bombPos + d) % game.boardSize;
    if (isCorner(p)) { cwCorner = p; break; }
  }
  for (let d = 1; d < game.boardSize; d++) {
    const p = (bombPos - d + game.boardSize) % game.boardSize;
    if (isCorner(p)) { ccwCorner = p; break; }
  }
  assert(cwCorner !== -1 && ccwCorner !== -1, "Both directions terminate on a corner");

  // Blast tiles should cover from ccwCorner → bombPos → cwCorner (inclusive).
  const blast = new Set(game._bombBlastTiles(bombPos));
  assert(blast.has(bombPos), "Blast includes the bomb tile");
  assert(blast.has(cwCorner), "Blast extends clockwise to the next corner (inclusive)");
  assert(blast.has(ccwCorner), "Blast extends counter-clockwise to the next corner (inclusive)");
  // The tile JUST PAST each corner must NOT be in the blast.
  const pastCw = (cwCorner + 1) % game.boardSize;
  const pastCcw = (ccwCorner - 1 + game.boardSize) % game.boardSize;
  assert(!blast.has(pastCw), "Blast stops at the clockwise corner — past it is safe");
  assert(!blast.has(pastCcw), "Blast stops at the counter-clockwise corner — past it is safe");

  // Bombs can't be placed on a corner tile.
  const placerForRules = game.players[0];
  placerForRules.bomb = 1;
  game.bombMode = true;
  assert(game.placeBomb(placerForRules.id, 0) === false, "Cannot place a bomb on corner tile 0");
  assert(game.placeBomb(placerForRules.id, 12) === false, "Cannot place a bomb on corner tile 12");
  assert(game.bombs.length === 0, "No bomb placed on a corner");

  // Find a tile far away from the blast for the survivor.
  let safePos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (!blast.has(i)) { safePos = i; break; }
  }
  assert(safePos !== -1, "Found a tile outside the blast");

  const [placer, victim, survivor] = game.players;
  placer.position = bombPos;
  victim.position = cwCorner; // sits on the bounding corner → killed
  survivor.position = safePos;

  game.bombs.push({ placedBy: placer.id, position: bombPos, turnsLeft: 0, pending: false });
  const placerMoneyBefore = placer.money;

  const exploded = game._explodeExpiredBombs();
  assert(exploded === true, "Bomb detonates when its fuse expires");
  assert(victim.bankrupt === true, "Opponent on the bounding corner is eliminated");
  assert(survivor.bankrupt === false, "Player outside the blast survives");
  assert(placer.bankrupt === false, "Placer is NOT eliminated by their own bomb");
  assert(placer.money >= placerMoneyBefore, "Placer loses no money from self-bomb (no-op)");
  assert(game.bombs.length === 0, "Bomb consumed after detonating");

  // Landing on an armed bomb detonates it.
  const g2 = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 }).game;
  for (const p of g2.players) p.startPickPending = false;
  let landPos = -1;
  for (let i = 0; i < g2.boardSize; i++) { if (!isCorner(i)) { landPos = i; break; } }
  const [pl2, vic2] = g2.players;
  pl2.position = (landPos + 6) % g2.boardSize;
  g2.bombs.push({ placedBy: pl2.id, position: landPos, turnsLeft: 3, pending: false });
  vic2.position = landPos; // lands on the bomb
  const det = g2._checkBombDetonation(vic2);
  assert(det === true, "Landing on a bomb detonates it");
  assert(vic2.bankrupt === true, "Lander on the bomb is eliminated");
}

// ============================================================
section("69b. Bomb placement timing + 2v2 teammate/bomb-win rules");
// ============================================================

{
  // Unified placement timing: a bomb stays pending until the END of the
  // placer's next turn, then spawns + arms. Placing on your OWN turn needs two
  // of your turn-ends (armCountdown 2); placing on someone else's needs one.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  game.bombMode = true;
  const a = game.players[0];
  const b = game.players[1];
  a.bomb = 1;
  let tile = -1;
  for (let i = 0; i < game.boardSize; i++) { if (i % 12 !== 0) { tile = i; break; } }
  // a places on a's own turn (a is current).
  game.currentPlayerIndex = 0;
  assert(game.placeBomb(a.id, tile) === true, "Placed bomb on own turn");
  const bomb = game.bombs[0];
  assert(bomb.pending === true && bomb.armCountdown === 2, "Own-turn bomb pending with armCountdown 2");
  // a's turn ends (this turn) → still pending.
  game.diceRolled = true; game.endTurn(a.id);
  assert(bomb.pending === true && bomb.armCountdown === 1, "Still pending after this turn ends");
  // b's turn ends → not a's bomb, no change.
  game.diceRolled = true; game.endTurn(b.id);
  assert(bomb.pending === true, "Unchanged on the other player's turn end");
  // a's NEXT turn ends → spawns + arms.
  game.diceRolled = true; game.endTurn(a.id);
  assert(bomb.pending === false && bomb.turnsLeft === 3, "Bomb spawns + arms at end of placer's next turn");
}

{
  // 2v2: a teammate caught in the blast takes NO damage; eliminating BOTH
  // opposing players via bombs wins the game for the placer's team.
  const { game } = createStartedGame(4, { gameMode: "2v2", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  game.bombMode = true;
  const A = game.teams.A, B = game.teams.B;
  const placer = game.players.find((p) => p.id === A[0]);
  const ally = game.players.find((p) => p.id === A[1]);
  const foe1 = game.players.find((p) => p.id === B[0]);
  const foe2 = game.players.find((p) => p.id === B[1]);
  let tile = -1;
  for (let i = 0; i < game.boardSize; i++) { if (i % 12 !== 0) { tile = i; break; } }
  const blast = new Set(game._bombBlastTiles(tile));
  // Put the ally and both foes inside the blast.
  const inBlast = [...blast].filter((t) => t !== tile);
  ally.position = inBlast[0];
  foe1.position = inBlast[1] != null ? inBlast[1] : inBlast[0];
  foe2.position = inBlast[2] != null ? inBlast[2] : inBlast[0];
  placer.position = (tile + (game.boardSize >> 1)) % game.boardSize;
  if (blast.has(placer.position)) placer.position = [...Array(game.boardSize).keys()].find((i) => !blast.has(i));
  const allyMoneyBefore = ally.money;
  game.bombs.push({ placedBy: placer.id, position: tile, turnsLeft: 0, pending: false });
  game._explodeExpiredBombs();
  assert(ally.bankrupt === false && ally.money === allyMoneyBefore, "Teammate in the blast takes NO damage");
  assert(foe1.bankrupt === true && foe2.bankrupt === true, "Both opposing players are eliminated");
  assert(game.state === "finished", "Team wins by bombing out the opposing team");
  assert(game.bombWinner === placer.id || game.bombWinner === ally.id, "bombWinner points at a surviving team member");
}

// ============================================================
section("70. Classic - Won dice items: Turtle (1 die) / Rabbit (3 dice)");
// ============================================================

{
  // Default roll is 2d6. A Turtle Dice item (legacy key rabbitDice) drops you to
  // 1 die; a Rabbit Dice item (legacy key cheetahDice) bumps you to 3 — each
  // spent in _resolveDiceCount. No money is charged.
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const p = game.getCurrentPlayer();
  // Everyone starts the game with one of each item.
  assert(p.cards.rabbitDice === 1 && p.cards.cheetahDice === 1, "Players start with one Turtle + one Rabbit dice");
  p.money = 5000;
  p.cards.rabbitDice = 0;
  p.cards.cheetahDice = 0;

  // Without the item, every pick falls back to the default 2d6 — no money.
  assert(game._resolveDiceCount(p, 1) === 2 && p.money === 5000, "No Turtle item -> default 2d6");
  assert(game._resolveDiceCount(p, 3) === 2 && p.money === 5000, "No Rabbit item -> default 2d6");
  assert(game._resolveDiceCount(p, undefined) === 2, "Default roll is 2d6");

  // With items, a Turtle pick rolls 1 die and a Rabbit pick rolls 3 (still free).
  p.cards.rabbitDice = 2;
  p.cards.cheetahDice = 1;
  assert(game._resolveDiceCount(p, 1) === 1 && p.cards.rabbitDice === 1, "Turtle Dice -> 1 die, spends one");
  assert(game._resolveDiceCount(p, 3) === 3 && p.cards.cheetahDice === 0, "Rabbit Dice -> 3 dice, spends one");
  assert(p.money === 5000, "Won dice items cost no money");

  // Out of Rabbit items -> the x3 pick falls back to the default 2d6.
  assert(game._resolveDiceCount(p, 3) === 2, "Out of Rabbit items -> default 2d6");
  assert(game._resolveDiceCount(p, 1) === 1 && p.cards.rabbitDice === 0, "Last Turtle item still spends");
  assert(game._resolveDiceCount(p, 1) === 2, "Out of Turtle items -> default 2d6");
}

// ============================================================
section("71. Classic - Item auction item hidden from non-starters");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const [a, b] = game.players;

  // The roller whose dice run the counter to 0 is recorded as the starter.
  game.itemAuctionCounter = 5;
  game._subtractItemAuctionCounter(5); // current player is `a`
  assert(game._itemAuctionQueued === true, "Auction queued when counter hits 0");
  assert(game._itemAuctionStarterId === a.id, "Starter = the roller who hit 0");

  // Build an active auction (bidding) with a known item + starter.
  const now = Date.now();
  game.itemAuction = {
    phase: "bidding",
    item: "magicDice",
    startedBy: a.id,
    wheelStartedAt: now,
    wheelEndsAt: now,
    deadline: now + 15000,
    bids: {
      [a.id]: { submitted: false, autoPass: false, amount: null },
      [b.id]: { submitted: false, autoPass: false, amount: null },
    },
    participantIds: [a.id, b.id],
    result: null,
  };

  const starterView = game.getState(a.id).itemAuction;
  const blindView = game.getState(b.id).itemAuction;
  assert(starterView.item === "magicDice", "Starter sees the spun item while bidding");
  assert(blindView.item === null, "Non-starter does NOT see the item while bidding");
  assert(blindView.startedBy === a.id, "Non-starter still knows who started it");

  // The result phase reveals the item to everyone.
  game.itemAuction.phase = "result";
  const blindResult = game.getState(b.id).itemAuction;
  assert(blindResult.item === "magicDice", "Item revealed to everyone at the result");
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
section("73. Classic - Item auction starter-as-lander flow");
// ============================================================

{
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a, b, c] = game.players;
  game._itemAuctionStarterId = a.id;
  game._startItemAuction();
  if (game._itemAuctionTimer) { clearTimeout(game._itemAuctionTimer); game._itemAuctionTimer = null; }
  game._beginItemAuctionPitch(); // simulate the wheel finishing
  assert(game.itemAuction && game.itemAuction.phase === "pitch", "Item auction reaches pitch phase");

  const item = game.itemAuction.item;
  // Winners now also start with one of each item, so check the win INCREMENTS
  // their count rather than asserting an absolute value.
  const bItemBefore = (game.players.find((p) => p.id === b.id).cards[item] || 0);
  assert(game.pitchItemPrice(a.id, 50), "Starter names a price");
  assert(game.itemAuction.phase === "respond", "Moves to respond phase");
  assert(game.getState(b.id).itemAuction.item === null, "Blind bidder can't see the item during respond");
  assert(game.getState(a.id).itemAuction.item === item, "Starter still sees the item");
  assert(game.getState(b.id).itemAuction.listPrice === 50, "Blind bidder sees the price");

  // Both accept -> silent tie-breaker, distinct top-ups
  assert(game.respondItemAuction(b.id, true), "B accepts");
  assert(game.respondItemAuction(c.id, true), "C accepts");
  assert(game.itemAuction.phase === "silentbid", "2+ acceptors trigger the item silent tie-breaker");
  game.submitItemBid(b.id, 30);
  game.submitItemBid(c.id, 10);
  const r = game.itemAuction.result;
  assert(r && r.winnerId === b.id, "Highest item top-up wins");
  assert(r.pricePaid === 80, "Item winner pays price + top-up (50+30)");
  assert(game.players.find(p => p.id === b.id).cards[item] === bItemBefore + 1, "Winner receives one more of the item");
  if (game._itemAuctionTimer) { clearTimeout(game._itemAuctionTimer); game._itemAuctionTimer = null; }

  // Tie -> starter keeps the item at the list price.
  const { game: g2 } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a2, b2, c2] = g2.players;
  g2._itemAuctionStarterId = a2.id;
  g2._startItemAuction();
  if (g2._itemAuctionTimer) { clearTimeout(g2._itemAuctionTimer); g2._itemAuctionTimer = null; }
  g2._beginItemAuctionPitch();
  g2.pitchItemPrice(a2.id, 50);
  g2.respondItemAuction(b2.id, true);
  g2.respondItemAuction(c2.id, true);
  g2.submitItemBid(b2.id, 25);
  g2.submitItemBid(c2.id, 25);
  const r2 = g2.itemAuction.result;
  assert(r2 && r2.winnerId === a2.id && r2.viaStarter, "Item silent-bid tie -> starter keeps it");
  assert(r2.pricePaid === 50, "Starter pays only the list price on a tie");
  if (g2._itemAuctionTimer) { clearTimeout(g2._itemAuctionTimer); g2._itemAuctionTimer = null; }
}

// ============================================================
section("73b. Classic - endTurn defers turn advance until queued item auction resolves");
// ============================================================
// When a player's roll trips the item-auction counter, calling endTurn must
// NOT advance the turn yet — the auction has to play out first so the next
// player doesn't get their "your turn" UI fired underneath the auction
// overlay. Once _resolveItemAuction's hold timer expires, the deferred
// endTurn is replayed and the turn advances normally.

{
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a, b, c] = game.players;
  for (const p of game.players) p.startPickPending = false;
  // Pretend A just rolled (their dice subtracted the counter to 0). The
  // queued state is what `_subtractItemAuctionCounter` would have set.
  game.diceRolled = true;
  game._itemAuctionQueued = true;
  game._itemAuctionStarterId = a.id;
  const aIndex = game.currentPlayerIndex;
  const turnBefore = game.turn;

  // A clicks End Turn while the auction is queued.
  assert(game.endTurn(a.id) === true, "endTurn accepted while an item auction is queued");
  assert(game.currentPlayerIndex === aIndex, "Turn does NOT advance while the queued auction starts");
  assert(game.turn === turnBefore, "gs.turn does not increment yet");
  assert(game.itemAuction != null, "Item auction is now active");
  assert(game._pendingEndTurnSocketId === a.id, "Deferred endTurn is recorded against the lander");

  // Drive the auction to resolution synchronously: skip the wheel-spin
  // timer, pitch, and have everyone reject so the starter keeps the item.
  if (game._itemAuctionTimer) { clearTimeout(game._itemAuctionTimer); game._itemAuctionTimer = null; }
  game._beginItemAuctionPitch();
  assert(game.itemAuction.phase === "pitch", "Auction reached pitch phase");
  game.pitchItemPrice(a.id, 1);
  game.respondItemAuction(b.id, false);
  game.respondItemAuction(c.id, false);
  // After all reject, _resolveItemAuction has scheduled the RESULT_MS clear.
  // Pull the trigger synchronously to simulate that timeout firing.
  assert(game.itemAuction && game.itemAuction.phase === "result", "Auction reached result phase");
  if (game._itemAuctionTimer) clearTimeout(game._itemAuctionTimer);
  game._itemAuctionTimer = null;
  // Mirror the resolve timeout's body (clear + resume deferred endTurn).
  game.itemAuction = null;
  game.itemAuctionCounter = game.itemAuctionStartValue;
  const resumeId = game._pendingEndTurnSocketId;
  game._pendingEndTurnSocketId = null;
  if (resumeId) game.endTurn(resumeId);

  assert(game.currentPlayerIndex !== aIndex, "Turn advances AFTER the auction fully resolves");
  assert(game.turn === turnBefore + 1, "gs.turn increments exactly once for this endTurn");
  assert(game._pendingEndTurnSocketId === null, "Pending endTurn id is cleared after resume");
  assert(game.itemAuction === null, "Item auction is gone by the time the turn advances");
}

// ============================================================
section("73c. Classic - Cancelled queued item auction still releases endTurn");
// ============================================================
// If the auction is cancelled before it resolves (e.g. starter goes bankrupt
// or disconnects mid-pitch), the deferred endTurn must still finish so the
// game doesn't hang on the lander.

{
  const { game } = createStartedGame(3, { gameMode: "classic", startingMoney: 1000 });
  const [a] = game.players;
  for (const p of game.players) p.startPickPending = false;
  game.diceRolled = true;
  game._itemAuctionQueued = true;
  game._itemAuctionStarterId = a.id;
  const aIndex = game.currentPlayerIndex;
  const turnBefore = game.turn;

  assert(game.endTurn(a.id) === true, "endTurn accepted while auction queued");
  assert(game.itemAuction != null, "Item auction started");
  assert(game._pendingEndTurnSocketId === a.id, "endTurn is deferred");

  // Force the in-flight auction to cancel.
  game._cancelItemAuction();

  assert(game.itemAuction === null, "Auction cleared by cancel");
  assert(game._pendingEndTurnSocketId === null, "Pending endTurn id was consumed by cancel");
  assert(game.currentPlayerIndex !== aIndex, "Turn advanced via the cancel-triggered endTurn");
  assert(game.turn === turnBefore + 1, "gs.turn incremented once");
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
  game.itemAuction = { phase: "wheel" };
  assert(game.notifyAnimsComplete(a.id, turnBefore) === false, "Item auction blocks the signal");
  game.itemAuction = null;
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
section("78. Classic - Dice never cost money; shop & item-pool are item-only");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "classic", startingMoney: 5000 });
  const p = game.getCurrentPlayer();
  p.money = 5000;
  // Even holding Turtle/Rabbit items, rolling them charges no money.
  p.cards.rabbitDice = 1; // Turtle (1 die)
  p.cards.cheetahDice = 1; // Rabbit (3 dice)
  assert(game._resolveDiceCount(p, 1) === 1 && p.money === 5000, "Turtle roll (1 die) never charges money");
  assert(game._resolveDiceCount(p, 3) === 3 && p.money === 5000, "Rabbit roll (3 dice) never charges money");
  assert(game._resolveDiceCount(p, undefined) === 2 && p.money === 5000, "Default 2d6 is free");
  // The item-auction pool only spins the four current items.
  game._itemAuctionStarterId = p.id;
  game._startItemAuction();
  if (game._itemAuctionTimer) { clearTimeout(game._itemAuctionTimer); game._itemAuctionTimer = null; }
  assert(
    ["rabbitDice", "cheetahDice", "magicDice", "teleport"].includes(game.itemAuction.item),
    "Item auction only spins Turtle/Rabbit/Roll One/Vine Swing",
  );
  game.itemAuction = null;
}

// ============================================================
section("79. Ghost players - leave, auction, bomb");
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
  a.cards.teleport = 2;

  assert(game.makeGhost(a.id) === true, "makeGhost flags a mid-game leaver");
  assert(a.ghost === true, "Player is now a ghost");
  assert(a.money === 1234 && a.properties.includes(farmPos), "Ghost keeps money + farms");
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

  // Bombing a ghost takes money + farms + items.
  game.bombMode = true;
  const ghostMoney = a.money;
  b.money = 100; b.cards.teleport = 0;
  game._bombEliminate(a, b);
  assert(a.bankrupt === true, "Bombed ghost is eliminated");
  assert(b.money === 100 + ghostMoney, "Placer took the ghost's bananas");
  assert(game.properties.get(farmPos).owner === b.id, "Placer took the ghost's farm");
  assert(b.cards.teleport === 2, "Placer took the ghost's items");
}

// ============================================================
section("79b. Ghost reconnect rebinds the player id everywhere");
// ============================================================
{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
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
  game.bombs.push({ placedBy: a.id, position: 5, turnsLeft: 3, pending: false, armCountdown: 0 });
  const oldId = a.id;
  game.makeGhost(a.id);

  const rejoined = game.reconnectByClientId("new-socket-xyz", "dev-reconnect");
  assert(rejoined && rejoined.id === "new-socket-xyz", "reconnectByClientId rebinds to the new socket id");
  assert(a.ghost === false, "Reconnected player is no longer a ghost");
  assert(game.properties.get(farmPos).owner === "new-socket-xyz", "Farm ownership rebound to the new id");
  assert(game.bombs[0].placedBy === "new-socket-xyz", "Bomb placedBy rebound to the new id");
  assert(game.players.find((p) => p.id === oldId) === undefined, "Old socket id no longer exists");
  assert(game.reconnectByClientId("another-socket", "dev-reconnect") === null, "No ghost to reclaim after reconnect");
}

// ============================================================
section("79c. Ghost landing interactions (skim 10% / no poker)");
// ============================================================
{
  // A LIVE player landing on a ghost skims 10% of the ghost's bananas, no poker.
  const { game } = createStartedGame(2, { startingMoney: 5000, monkeyPoker: true });
  for (const p of game.players) p.startPickPending = false;
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.money = 1000;
  live.money = 2000;
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = gh.id; // owned → no auction interference
  gh.position = farmPos;
  live.position = farmPos;
  game.poker = null;
  game._processLanding(live);
  assert(game.poker === null, "No poker when a live player lands on a ghost");
  assert(live.money === 2100, "Live lander skims 10% (100) of the ghost");
  assert(gh.money === 900, "Ghost loses the skimmed 10%");
}
{
  // A GHOST landing on a live player does nothing (no poker, no skim).
  const { game } = createStartedGame(2, { startingMoney: 5000, monkeyPoker: true });
  for (const p of game.players) p.startPickPending = false;
  const [live, gh] = game.players;
  gh.ghost = true;
  gh.money = 1000;
  live.money = 2000;
  let farmPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "farm") { farmPos = i; break; }
  }
  game.properties.get(farmPos).owner = live.id; // owned by live → no auction
  live.position = farmPos;
  gh.position = farmPos;
  game.poker = null;
  game._processLanding(gh);
  assert(game.poker === null, "A ghost landing on a live player starts no poker");
  assert(live.money === 2000 && gh.money === 1000, "Nothing transfers when a ghost lands on you");
}

// ============================================================
section("79d. Last live monkey among ghosts wins (grace window)");
// ============================================================
{
  // Classic, 3 players: two ghost out → win goes pending, then resolves.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b, c] = game.players;
  game.makeGhost(b.id);
  assert(game.state === "playing" && !game._lastLiveWinTimer, "Two live players left — no win pending");
  game.makeGhost(c.id);
  assert(game.state === "playing", "Win is NOT instant — grace window first");
  assert(!!game._lastLiveWinTimer, "Lone live player schedules the win");
  game._cancelLastLiveWin();
  assert(game._resolveLastLiveWin() === true, "Grace expiry resolves the win");
  assert(game.state === "finished" && game.bombWinner === a.id, "Last live monkey wins the game");
  assert(a.revealedTiles.size === game.boardSize, "All tiles revealed on the ghost-concede win");
}
{
  // Reconnect during the grace window cancels the win.
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a] = game.players;
  a.clientId = "dev-llw";
  game.makeGhost(a.id);
  assert(!!game._lastLiveWinTimer && game.state === "playing", "1v1 leaver puts the win on the clock");
  const back = game.reconnectByClientId("llw-socket", "dev-llw");
  assert(back && !game._lastLiveWinTimer, "Reconnect cancels the pending win");
  assert(game._resolveLastLiveWin() === false, "No win once everyone is live again");
  assert(game.state === "playing", "Game continues after the reconnect");
}
{
  // Bombing a live player so only one live + a ghost remain also triggers it.
  const { game } = createStartedGame(3, { startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;
  const [a, b, c] = game.players;
  game.makeGhost(c.id);
  game._bombEliminate(b, a);
  game._checkBombWin();
  assert(game.state === "playing" && !!game._lastLiveWinTimer, "Bomb leaving 1 live + 1 ghost schedules the win");
  game._cancelLastLiveWin();
  assert(game._resolveLastLiveWin() === true && game.bombWinner === a.id, "Bomber wins once the grace expires");
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
