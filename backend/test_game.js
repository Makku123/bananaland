// Comprehensive game mechanics test suite
const { MonopolyGame, BOARD, BUYABLE, PET_TYPES } = require("./gameLogic");

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

// Helper: create a game with N players, all with strong pet, and start it
function createStartedGame(n = 2, opts = {}) {
  const game = new MonopolyGame(
    "TEST",
    opts.maxPlayers || n,
    opts.startingMoney || 5000,
    opts.gameMode || "ffa",
    opts.teamTarget || 5000,
    opts.bombMode !== undefined ? opts.bombMode : true,
    opts.monkeyPoker !== undefined ? opts.monkeyPoker : true,
  );
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push(game.addPlayer(`p${i}`, `Player${i}`));
  }
  // Select pets for all players
  for (let i = 0; i < n; i++) {
    game.selectPet(`p${i}`, opts.pet || "strong");
  }
  // Start game
  game.startGame("p0");
  game.completeReveal();
  return { game, players };
}

// ============================================================
section("1. Game Creation & Player Management");
// ============================================================

{
  const game = new MonopolyGame("G1", 4, 2222, "ffa", 5000, false, true, true);
  assert(game.state === "waiting", "Game starts in waiting state");
  assert(game.maxPlayers === 4, "Max players set correctly");
  assert(game.startingMoney === 2222, "Starting money set correctly");
  assert(game.gameMode === "ffa", "Game mode set correctly");
  assert(game.bombMode === true, "Bomb mode on by default");
  assert(game.monkeyPoker === true, "Monkey poker on by default");

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
  const game = new MonopolyGame("G2", 4, 2222, "ffa", 5000, false, true, true);
  game.addPlayer("s1", "Alice");
  game.addPlayer("s2", "Bob");

  assert(game.updateSettings("s1", { startingMoney: 5000 }), "Admin can update settings");
  assert(game.startingMoney === 5000, "Starting money updated");
  assert(game.players[0].money === 5000, "Player money updated with setting");

  assert(!game.updateSettings("s2", { startingMoney: 9999 }), "Non-admin cannot update settings");

  assert(game.updateSettings("s1", { gameMode: "teams" }), "Can switch to teams mode");
  assert(game.maxPlayers === 4, "Teams mode forces 4 players");
}

// ============================================================
section("3. Pet Selection & Game Start");
// ============================================================

{
  const game = new MonopolyGame("G3", 2, 2222, "ffa", 5000, false, true, true);
  game.addPlayer("s1", "Alice");
  game.addPlayer("s2", "Bob");

  // Can't start without pets
  assert(!game.startGame("s1"), "Can't start without pet selection");

  game.selectPet("s1", "strong");
  assert(!game.startGame("s1"), "Can't start if not all have pets");

  game.selectPet("s2", "energy");
  assert(game.startGame("s1"), "Can start when all have pets");
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

  // Roll with 1 die (costs 300)
  const moneyBefore = cur.money;
  const result = game.rollDice(cur.id, 1);
  assert(result !== null, "Can roll with 1 die");
  assert(result.dice.length === 1, "Got 1 die result");
  assert(cur.money === moneyBefore - 300, "1 die costs 300 bananas");
}

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Roll with 3 dice (costs 300)
  const moneyBefore = cur.money;
  const result = game.rollDice(cur.id, 3);
  assert(result !== null, "Can roll with 3 dice");
  assert(result.dice.length === 3, "Got 3 dice result");
  assert(cur.money === moneyBefore - 300, "3 dice costs 300 bananas");
}

// ============================================================
section("6. End Turn");
// ============================================================

{
  const { game } = createStartedGame(2);
  const firstPlayer = game.getCurrentPlayer().id;

  // Can't end turn before rolling
  assert(!game.endTurn(firstPlayer), "Can't end turn before rolling");

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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom") {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom") {
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
section("10. Simple Auction - Accept with multiple players");
// ============================================================

{
  const { game } = createStartedGame(3);

  let propPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom") {
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
    assert(game.poker.bbPlayer === cur.id, "Landing player is BB");
    assert(game.poker.sbPlayer === other.id, "Other player is SB");
    assert(game.poker.pot > 0, "Pot has blinds");

    // SB acts first in preflop
    const sbPlayer = game.poker.currentTurn;
    assert(sbPlayer === other.id, "SB acts first preflop");

    // SB calls
    assert(game.pokerAction(other.id, "call"), "SB can call");

    // If game continues...
    if (game.poker && !game.poker.resolved) {
      // BB checks
      game.pokerAction(cur.id, "check");
    }

    // Should eventually resolve
    // Let it play through remaining rounds
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

    // SB raises
    assert(game.pokerAction(sbId, "raise"), "SB can raise");
    assert(game.poker.currentTurn === bbId, "Turn passes to BB after raise");
  }
}

// ============================================================
section("14. Pet System - Strong Pet");
// ============================================================

{
  const { game } = createStartedGame(2, { pet: "strong" });

  // Roll first so player has hasRolled = true
  const cur = game.getCurrentPlayer();
  const curId = cur.id;
  game.rollDice(curId);
  game._cancelAutoEnd();
  game.endTurn(curId);

  // Now it's the other player's turn; first player can use pet off-turn
  const offTurn = curId;
  const onTurnId = game.getCurrentPlayer().id;

  // Need to have rolled at least once
  const offPlayer = game.players.find(p => p.id === offTurn);
  assert(offPlayer.hasRolled === true, "Player has rolled flag set");

  // Make sure no auction/poker/vineSwing is blocking
  game.auction = null;
  game.poker = null;
  game.vineSwing = null;

  // Use strong pet off-turn
  const result = game.usePetAbility(offTurn);
  if (!result) {
    console.log(`  DEBUG: offTurn=${offTurn}, onTurn=${onTurnId}, pet=${offPlayer.pet}, cooldown=${offPlayer.petCooldown}, hasRolled=${offPlayer.hasRolled}, pendingPet=${JSON.stringify(offPlayer.pendingPet)}`);
  }
  assert(result === true, "Strong pet activates off-turn");
  if (offPlayer.pendingPet) {
    assert(offPlayer.pendingPet.type === "strong", "Pending pet is strong type");
  } else {
    assert(false, "Pending pet should be set after activation");
  }
}

// ============================================================
section("15. Pet System - Can't use on own turn");
// ============================================================

{
  const { game } = createStartedGame(2, { pet: "strong" });
  const cur = game.getCurrentPlayer();

  // Roll first
  game.rollDice(cur.id);
  game._cancelAutoEnd();

  // Try to use pet on own turn
  assert(!game.usePetAbility(cur.id), "Can't use strong pet on own turn");
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

  // Give player a property with known price
  let farmPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group && prop.group !== "desert" && prop.group !== "mushroom") {
      farmPos = i;
      break;
    }
  }

  if (farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = cur.id;
    cur.properties.push(farmPos);

    // Move to GROW 25% (position 0)
    const oldMoney = cur.money;
    game._processLanding(cur); // Landing at position 0 (GROW 25%)

    // Check that banana pile grew on the farm
    if (cur.position === 0) {
      assert(prop.bananaPile > 0, "Farm grew bananas on GROW tile");
    }
  }
}

// ============================================================
section("22. Chain Multiplier");
// ============================================================

{
  const { game } = createStartedGame(2);
  const cur = game.getCurrentPlayer();

  // Give player two adjacent properties of the same group
  // Find two adjacent positions with same group
  let pos1 = -1, pos2 = -1;
  for (let i = 1; i < 51; i++) {
    const p1 = game.properties.get(i);
    const p2 = game.properties.get(i + 1);
    if (p1 && p2 && p1.group && p2.group && p1.group === p2.group &&
        p1.group !== "desert" && p1.group !== "mushroom") {
      pos1 = i;
      pos2 = i + 1;
      break;
    }
  }

  if (pos1 >= 0) {
    const prop1 = game.properties.get(pos1);
    const prop2 = game.properties.get(pos2);
    prop1.owner = cur.id;
    prop2.owner = cur.id;
    cur.properties = [pos1, pos2];

    const multipliers = game._computeChainMultipliers(new Set([cur.id]));
    assert(multipliers[pos1] === 2, "Adjacent same-group farms have chain multiplier of 2");
    assert(multipliers[pos2] === 2, "Both farms in chain get multiplier");
  } else {
    console.log("  (No adjacent same-group properties found)");
  }
}

// ============================================================
section("23. Banana Pile Collection");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Set up a banana pile on owned property
  let farmPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
section("25. Trading (Team Mode)");
// ============================================================

{
  const { game } = createStartedGame(4, { gameMode: "teams", startingMoney: 5000 });

  // In team mode, teams are assigned. Find teammates
  const teamA = game.teams.A;
  const p0 = game.players.find(p => p.id === teamA[0]);
  const p1 = game.players.find(p => p.id === teamA[1]);

  if (p0 && p1) {
    const moneyBefore0 = p0.money;
    const moneyBefore1 = p1.money;

    assert(game.tradeBananas(p0.id, p1.id, 1000), "Teammates can trade bananas");
    assert(p0.money === moneyBefore0 - 1000 - 150, "Sender loses amount + 150 fee");
    assert(p1.money === moneyBefore1 + 1000, "Recipient gets full amount");
  }
}

// ============================================================
section("26. Trading - Cross-team rejected");
// ============================================================

{
  const { game } = createStartedGame(4, { gameMode: "teams", startingMoney: 5000 });
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
section("29. Give Farm (Team Mode)");
// ============================================================

{
  const { game } = createStartedGame(4, { gameMode: "teams", startingMoney: 5000 });

  const teamA = game.teams.A;
  const giver = game.players.find(p => p.id === teamA[0]);
  const mate = game.players.find(p => p.id === teamA[1]);

  // Give giver a property
  let farmPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
      farmPos = i;
      break;
    }
  }

  if (farmPos >= 0 && giver && mate) {
    const prop = game.properties.get(farmPos);
    prop.owner = giver.id;
    giver.properties.push(farmPos);

    const moneyBefore = giver.money;
    assert(game.giveFarm(giver.id, farmPos), "Can give farm to teammate");
    assert(giver.money === moneyBefore - 300, "Give farm costs 300 fee");
    assert(prop.owner === mate.id, "Farm transferred to teammate");
    assert(mate.properties.includes(farmPos), "Teammate's properties updated");
    assert(!giver.properties.includes(farmPos), "Giver's properties updated");
  }
}

// ============================================================
section("30. Team Mode - Game Setup");
// ============================================================

{
  const game = new MonopolyGame("T1", 4, 5000, "teams", 5000, "cooldown", false, true, true);

  for (let i = 0; i < 4; i++) {
    game.addPlayer(`t${i}`, `Team${i}`);
    game.selectPet(`t${i}`, "strong");
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
  assert(state.boardLayout.length === 52, "Board has 52 tiles");
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
  const game = new MonopolyGame("R1", 2, 2222, "ffa", 5000, "cooldown", false, true, true);
  game.addPlayer("r0", "R0");
  game.addPlayer("r1", "R1");
  game.selectPet("r0", "strong");
  game.selectPet("r1", "strong");

  game.startGame("r0");
  assert(game.state === "revealing", "Game enters reveal phase");

  game.acceptReveal("r0");
  assert(game.state === "revealing", "Still revealing until all accept");

  game.acceptReveal("r1");
  assert(game.state === "playing", "Game starts when all accept");
}

// ============================================================
section("35. Board Shuffle");
// ============================================================

{
  const { game } = createStartedGame(2);

  // Check corners are fixed
  assert(game.board[0].type === "grow", "Position 0 is GROW");
  assert(game.board[13].type === "grow", "Position 13 is GROW");
  assert(game.board[26].type === "grow", "Position 26 is GROW");
  assert(game.board[39].type === "grow", "Position 39 is GROW");
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
section("37. Debug Reset Pet Cooldown");
// ============================================================

{
  const { game } = createStartedGame(2, { pet: "strong" });
  const cur = game.getCurrentPlayer();
  cur.petCooldown = 10;

  assert(game.debugResetPetCooldown(cur.id), "Debug reset pet cooldown works");
  assert(cur.petCooldown === 0, "Pet cooldown reset to 0");
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
  for (let i = 0; i < 52; i++) {
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
section("40. Free Bananas Tile");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const cur = game.getCurrentPlayer();

  // Find free bananas tile
  let freePos = -1;
  for (let i = 0; i < 52; i++) {
    if (game.board[i].type === "freebananas") {
      freePos = i;
      break;
    }
  }

  if (freePos >= 0) {
    cur.position = freePos;
    cur.revealedTiles.add(freePos); // Already revealed
    const before = cur.money;
    game._processLanding(cur);
    assert(cur.money === before + 500, "Free bananas +500 awarded");
  } else {
    console.log("  (No free bananas tile found)");
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom" && prop.group !== "desert") {
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
section("43. Pet Cooldown Ticking");
// ============================================================

{
  const { game } = createStartedGame(2, { pet: "strong" });
  const p0 = game.players.find(p => p.id === "p0");
  const p1 = game.players.find(p => p.id === "p1");

  // Set cooldown manually
  p0.petCooldown = 5;
  p1.petCooldown = 3;

  // Roll dice (ticks cooldowns)
  const cur = game.getCurrentPlayer();
  game.rollDice(cur.id);
  game._cancelAutoEnd();

  assert(p0.petCooldown === 4, "P0 cooldown decremented on dice roll");
  assert(p1.petCooldown === 2, "P1 cooldown decremented on dice roll");
}

// ============================================================
section("44. Bomb Timer Ticking");
// ============================================================

{
  const { game } = createStartedGame(2, { bombMode: true });

  game.bombs.push({ placedBy: "p0", position: 10, turnsLeft: 3 });

  const cur = game.getCurrentPlayer();
  game.rollDice(cur.id);
  game._cancelAutoEnd();
  game.endTurn(cur.id);

  assert(game.bombs[0].turnsLeft === 2, "Bomb timer ticks down on end turn");
}

// ============================================================
section("45. Bomb Self-Damage");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000, bombMode: true });
  const p0 = game.players[0];

  game.bombs.push({ placedBy: p0.id, position: 10, turnsLeft: 1 });
  p0.position = 10;

  const before = p0.money;
  game._checkBombDetonation(p0);

  // Placer stepping on their own armed bomb: lose half, bomb stays armed.
  assert(p0.bankrupt === false, "Self-bomb doesn't eliminate placer");
  assert(p0.money === before - Math.floor(before / 2), "Self-bomb loses half money");
  assert(game.bombs.length === 1, "Bomb stays on board when placer lands on it");
  assert(game.bombs[0].position === 10, "Bomb still at the same tile");
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
  assert(game.bombs.length === 1, "Bomb not removed");
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom") {
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
  for (let i = 1; i < 52 && count < 6; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
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
section("50. Mushroom/Super Banana - Can Afford");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 10000 });
  const cur = game.getCurrentPlayer();

  // Find super banana position
  let mushroomPos = -1;
  for (let i = 0; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "mushroom") {
      mushroomPos = i;
      break;
    }
  }

  if (mushroomPos >= 0) {
    cur.position = mushroomPos;
    const prop = game.properties.get(mushroomPos);

    // Ensure player can afford it
    cur.money = prop.price + 1000;

    game._processLanding(cur);

    // Super banana triggers a delayed win - check superBananaWin
    assert(game.superBananaWin !== null || game.state === "finished",
      "Super Banana triggers win sequence");
  } else {
    console.log("  (No mushroom property found)");
  }
}

// ============================================================
section("51. Mushroom/Super Banana - Can't Afford (Swap)");
// ============================================================

{
  const { game } = createStartedGame(2, { startingMoney: 1000 });
  const cur = game.getCurrentPlayer();

  let mushroomPos = -1;
  for (let i = 0; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "mushroom") {
      mushroomPos = i;
      break;
    }
  }

  if (mushroomPos >= 0) {
    cur.position = mushroomPos;
    game._processLanding(cur);

    assert(game.mushroomPending !== null, "Mushroom pending swap initiated when can't afford");
    assert(game.mushroomPending.mushroomPos === mushroomPos, "Correct mushroom position in pending");
  } else {
    console.log("  (No mushroom property found)");
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
  for (let i = 0; i < 52; i++) {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group !== "mushroom") {
      farmPos = i;
      break;
    }
  }

  let busPos = -1;
  for (let i = 0; i < 52; i++) {
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom" && prop.price > 0) {
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
section("55. FFA Mode - No Trading");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "ffa", startingMoney: 5000 });

  assert(!game.tradeBananas("p0", "p1", 1000), "Trading not allowed in FFA mode");
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
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group && prop.group !== "desert" && prop.group !== "mushroom") {
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
    assert(game.poker.players[cur.id].cards.length === 2, "BB gets 2 hole cards");
    assert(game.poker.players[other.id].cards.length === 2, "SB gets 2 hole cards");

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
section("59. Pet Hidden in Lobby");
// ============================================================

{
  const game = new MonopolyGame("H1", 2, 2222, "ffa", 5000, "cooldown", false, true, true);
  game.addPlayer("h0", "H0");
  game.addPlayer("h1", "H1");
  game.selectPet("h0", "strong");
  game.selectPet("h1", "energy");

  const state = game.getState("h0");
  const p0State = state.players.find(p => p.id === "h0");
  const p1State = state.players.find(p => p.id === "h1");

  assert(p0State.pet === "strong", "Own pet visible in lobby");
  assert(p1State.pet === "hidden", "Other's pet hidden in lobby");
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
section("61. Simple Mode - Early Pickup on own farm");
// ============================================================

// Helper: set up a simple-mode game with the current player owning a farm,
// a known grow tile, and the whole board in grow-range. Returns the pieces.
function setupSimpleGrow(opts = {}) {
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  // Clear reveals so the grow range spans the whole board (only the fired
  // grow tile gets revealed inside _fireSimpleGrowAt).
  for (const p of game.players) {
    p.revealedTiles = new Set();
    p.startPickPending = false; // simulate a mid-game grow, not the first pick
  }
  let growPos = -1;
  for (let i = 0; i < 52; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  let farmPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group && prop.group !== "desert" && prop.group !== "mushroom" && i !== growPos) {
      farmPos = i; break;
    }
  }
  return { game, p0: game.players[0], p1: game.players[1], growPos, farmPos };
}

{
  const { game, p0, growPos, farmPos } = setupSimpleGrow();
  if (growPos >= 0 && farmPos >= 0) {
    const prop = game.properties.get(farmPos);
    prop.owner = p0.id;
    prop.bananaPile = 250; // a pre-existing pile already sitting on the tile
    p0.properties.push(farmPos);

    // Player is standing ON their own farm when the grow fires.
    p0.position = farmPos;
    const before = p0.money;

    game._fireSimpleGrowAt(p0, growPos, "roll");

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
section("62. Simple Mode - No early pickup when standing elsewhere");
// ============================================================

{
  const { game, p0, growPos, farmPos } = setupSimpleGrow();
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

    game._fireSimpleGrowAt(p0, growPos, "roll");

    assert(prop.bananaPile === prop.price, "Pile grows normally when owner is not on the farm");
    assert(p0.money === before, "No money credited when owner is not standing on the farm");
    assert(game.diceMatchEarlyPickup == null, "No early pickup recorded");
    assert(game.diceMatchTiles && game.diceMatchTiles.includes(farmPos), "Grown farm recorded in diceMatchTiles for the walk animation");
  }
}

// ============================================================
section("63. Simple Mode - Early pickup beats a squatting opponent");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupSimpleGrow();
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

    game._fireSimpleGrowAt(p0, growPos, "roll");

    assert(p0.money === before0 + prop.price, "Owner early-picks even with an opponent present");
    assert(p1.money === before1, "Squatter gets nothing when owner is on their own tile");
    assert(prop.bananaPile === 0, "No pile left after owner-priority early pickup");
  }
}

// ============================================================
section("64. Simple Mode - Rolled grow fires BEFORE move (path collection)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) {
    p.revealedTiles = new Set();
    p.scoutedTiles = new Set();
    p.startPickPending = false;
  }
  game.auction = game.poker = game.vineSwing = null;
  game.mushroomPending = null;
  game.itemAuction = null;
  game.diceRolled = false;
  game.petResolving = false;
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
      if (!sp || sp.group !== "simple") continue;
      const pp = (s + sum) % BSZ;
      const pprop = game.properties.get(pp);
      if (pp !== s && pprop && pprop.group === "simple") { start = s; pathPos = pp; break; }
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
      for (const p of game.players) p.revealedTiles.add(growPos);
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
section("65. Simple Mode - Squatter collects growth only on LEAVING (TODO line 56)");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupSimpleGrow();
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

    game._fireSimpleGrowAt(p0, growPos, "roll");

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
section("65b. Simple Mode - Owner reclaims a grown pile by crossing before the squatter leaves");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupSimpleGrow();
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
    game._fireSimpleGrowAt(p0, growPos, "roll");
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
section("65c. Simple Mode - Landing on an opponent's pile defers the steal until you leave");
// ============================================================

{
  const { game, p0, p1, farmPos } = setupSimpleGrow();
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
section("65d. Simple Mode - Merely crossing an opponent's pile never collects it");
// ============================================================

{
  const { game, p0, p1, farmPos } = setupSimpleGrow();
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
section("65e. Simple Mode - Vine Swing off a squatted farm steals its pile on the way out");
// ============================================================

{
  const { game, p0, p1, growPos, farmPos } = setupSimpleGrow();
  // Find a farm p1 can swing TO (their own), distinct from the squatted farm.
  let destPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    const pr = game.properties.get(i);
    if (pr && pr.group === "simple" && i !== farmPos && i !== growPos) { destPos = i; break; }
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
section("66. Simple Mode - Cornerless 48-tile board");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });

  assert(game.board.length === 48, "Simple board has 48 tiles");
  assert(game.boardSize === 48, "boardSize is 48 in simple mode");

  const counts = { grow: 0, bus: 0, special: 0, tax10: 0, freebananas: 0, farm: 0 };
  for (let i = 0; i < game.board.length; i++) {
    const t = game.board[i];
    if (t.type === "grow") counts.grow++;
    else if (t.type === "bus") counts.bus++;
    else if (t.type === "special") counts.special++;
    else if (t.type === "tax10") counts.tax10++;
    else if (t.type === "freebananas") counts.freebananas++;
    else if (t.buyable && t.buyable.group === "simple") counts.farm++;
  }
  assert(counts.grow === 6, "Simple board has 6 GROW tiles");
  assert(counts.farm === 40, "Simple board has 40 farm tiles");
  assert(counts.bus === 0, "Simple board has no Vine Swing tile (now an ability)");
  assert(counts.special === 1, "Simple board has 1 Super Banana tile");
  assert(counts.tax10 === 0, "Simple board has no -10% tax tile");
  assert(counts.freebananas === 1, "Simple board has 1 +500 Free Bananas tile");

  // Grow tiles are labelled 1..6 (no 0, no 7).
  const labels = [...game.growTileLabels.values()].sort((a, b) => a - b);
  assert(labels.length === 6, "Six grow labels assigned");
  assert(labels[0] === 1 && labels[5] === 6, "Grow labels span 1..6");
  assert(!labels.includes(0) && !labels.includes(7), "No grow label 0 or 7");

  // Movement wraps around the 48-tile loop, not 52.
  const cur = game.getCurrentPlayer();
  cur.startPickPending = false;
  cur.position = 47;
  const wrapped = (cur.position + 3) % game.boardSize;
  assert(wrapped === 2, "Position wraps mod 48 (47 + 3 -> 2)");

  // Classic mode is unaffected: still 52 tiles with corner GROW tiles.
  const classic = createStartedGame(2).game;
  assert(classic.board.length === 52, "Classic board still has 52 tiles");
  assert(classic.boardSize === 52, "Classic boardSize is 52");
}

// ============================================================
section("67. Simple Mode - Roll One item (guaranteed move of 1)");
// ============================================================

{
  const { game } = createStartedGame(2, {
    gameMode: "simple",
    startingMoney: 5000,
    bombMode: false,
    monkeyPoker: false,
  });

  const cur = game.getCurrentPlayer();
  cur.startPickPending = false;
  cur.petCooldown = 0;
  cur.position = 0;
  for (const p of game.players) p.startPickPending = false;
  game.auction = game.poker = game.vineSwing = null;
  game.mushroomPending = null;
  game.itemAuction = null;
  game.diceRolled = false;
  game.petResolving = false;

  // Players start with one of each special item in simple mode.
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
  assert((cur.petCooldown || 0) === 0, "Roll One sets no cooldown");

  // Upgrades are gone: upgradeMagicDice is a no-op.
  const upgrader = game.players[1];
  upgrader.money = 5000;
  assert(game.upgradeMagicDice(upgrader.id) === false, "Upgrade is a no-op (returns false)");
  assert(upgrader.money === 5000, "Upgrade does not charge bananas");
}

// ============================================================
section("68. Simple Mode - Vine Swing ability (your OWN farms only)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;
  cur.petCooldown = 0;
  game.diceRolled = false;
  game.petResolving = false;
  game.simpleCardUsedThisTurn = false;
  game.auction = game.poker = game.vineSwing = null;
  game.mushroomPending = null;
  game.itemAuction = null;
  const BSZ = game.boardSize;

  // Players start with one Vine Swing item (granted at game start).
  assert(cur.cards.teleport === 1, "Players start with one Vine Swing item");

  // Unusable with no owned farm.
  cur.properties = [];
  assert(
    game.canUseSimpleCard(cur, "teleport") === false,
    "Vine Swing unusable with no owned farm",
  );

  // First farm tile on the board.
  let farmA = -1;
  for (let i = 0; i < game.board.length; i++) {
    const prop = game.properties.get(i);
    if (prop && prop.group === "simple") { farmA = i; break; }
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
    game.canUseSimpleCard(cur, "teleport") === true,
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
section("68b. Simple Mode - Arming abilities (off-turn, private, server-side)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  const other = game.players.find((p) => p.id !== cur.id);
  for (const p of game.players) p.startPickPending = false;

  // Can't arm on your own turn.
  assert(game.armAbility(cur.id, "rabbitDice") === false, "Arming rejected on your own turn");
  assert(cur.armedAbility == null, "No ability armed on your own turn");

  // Off-turn arming works (other is not the current player).
  assert(game.armAbility(other.id, "magicDice") === true, "Arming allowed off-turn");
  assert(other.armedAbility === "magicDice", "Armed ability stored on the player");

  // Arming an item you don't own is rejected.
  other.cards.teleport = 0;
  assert(game.armAbility(other.id, "teleport") === false, "Can't arm an item you don't own");
  assert(other.armedAbility === "magicDice", "Failed arm left the previous choice intact");

  // Disarm (null) is allowed anytime — even on your own turn.
  cur.armedAbility = "cheetahDice";
  assert(game.armAbility(cur.id, null) === true, "Disarm allowed on your own turn");
  assert(cur.armedAbility === null, "Disarm clears the armed ability");

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
  game.petResolving = false;
  game.auction = game.poker = game.vineSwing = null;
  game.mushroomPending = null;
  game.itemAuction = null;
  game.rollDice(cur.id, 2);
  if (game._cancelAutoEnd) game._cancelAutoEnd();
  assert(cur.armedAbility === null, "Rolling clears the armed ability");
}

// ============================================================
section("69. Simple Mode - Bomb blows the whole side");
// ============================================================

{
  const { game } = createStartedGame(3, { gameMode: "simple", startingMoney: 5000 });
  for (const p of game.players) p.startPickPending = false;

  // Side helper: 4 sides of 12 (bottom 0-11, left 12-23, top 24-35, right 36-47).
  assert(JSON.stringify(game._simpleSideTiles(5)) === JSON.stringify([0,1,2,3,4,5,6,7,8,9,10,11]), "Side of tile 5 = bottom (0-11)");
  assert(game._simpleSideTiles(20)[0] === 12 && game._simpleSideTiles(20)[11] === 23, "Side of tile 20 = left (12-23)");
  assert(game._simpleSideTiles(30)[0] === 24 && game._simpleSideTiles(40)[0] === 36, "Sides of 30/40 = top/right");

  const [placer, victim, survivor] = game.players;
  placer.position = 3;    // bottom side (with the bomb)
  victim.position = 9;    // bottom side -> killed
  survivor.position = 20; // left side -> safe

  // Armed bomb on the bottom side, fuse expired.
  game.bombs.push({ placedBy: placer.id, position: 5, turnsLeft: 0, pending: false });
  const placerMoneyBefore = placer.money;

  const exploded = game._explodeExpiredBombs();
  assert(exploded === true, "Bomb detonates when its fuse expires");
  assert(victim.bankrupt === true, "Opponent on the bomb's side is eliminated");
  assert(survivor.bankrupt === false, "Player on a different side survives");
  assert(placer.bankrupt === false, "Placer is NOT eliminated by their own bomb");
  // Self-bomb is a no-op in simple mode now: the placer takes no damage and
  // no bombSelfDamage state is recorded. The bomb still detonates so enemies
  // in the blast still go down (and their farms + loot still transfer to
  // the placer per the standard enemy-kill rule — placer's money may
  // increase, but it never DECREASES from self-damage).
  assert(placer.money >= placerMoneyBefore, "Placer loses no money from self-bomb (no-op)");
  assert(!game.bombSelfDamage, "No bombSelfDamage state recorded for self-bomb");
  assert(game.bombs.length === 0, "Bomb consumed after detonating");

  // Landing on a bomb also blows the whole side.
  const g2 = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 }).game;
  for (const p of g2.players) p.startPickPending = false;
  const [pl2, vic2] = g2.players;
  pl2.position = 0;
  g2.bombs.push({ placedBy: pl2.id, position: 8, turnsLeft: 3, pending: false });
  vic2.position = 8; // lands on the bomb (bottom side)
  const det = g2._checkBombDetonation(vic2);
  assert(det === true, "Landing on a bomb detonates it");
  assert(vic2.bankrupt === true, "Lander on the bomb (its side) is eliminated");
}

// ============================================================
section("70. Simple Mode - Won dice items: Turtle (1 die) / Rabbit (3 dice)");
// ============================================================

{
  // Default roll is 2d6. A Turtle Dice item (legacy key rabbitDice) drops you to
  // 1 die; a Rabbit Dice item (legacy key cheetahDice) bumps you to 3 — each
  // spent in _resolveDiceCount. No money is charged.
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
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
section("71. Simple Mode - Item auction item hidden from non-starters");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
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
  for (let i = 1; i < 52; i++) {
    const p = game.properties.get(i);
    if (p && !p.owner && p.group !== "mushroom" && p.price > 0) { pos = i; break; }
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
section("73. Simple Mode - Item auction starter-as-lander flow");
// ============================================================

{
  const { game } = createStartedGame(3, { gameMode: "simple", startingMoney: 1000 });
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
  const { game: g2 } = createStartedGame(3, { gameMode: "simple", startingMoney: 1000 });
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
section("74. Simple Mode - Hidden grow is dormant on a roll");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
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
      if (prop && prop.group === "simple" && pos !== cur.position) { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      cur.properties = [farmPos];
      const fp = game.properties.get(farmPos);
      fp.owner = cur.id;
      fp.bananaPile = 0;
    }

    // Hidden grow + roll its number -> dormant: no fire, no reveal.
    game._processSimpleRolledGrow(cur, n);
    assert(!game.lastGrowFired, "Hidden grow does not fire when its number is rolled");
    assert(!cur.revealedTiles.has(growPos), "Rolling does not reveal a hidden grow tile");
    assert(
      game.players.every((p) => !p.revealedTiles.has(growPos)),
      "Hidden grow stays hidden for everyone after a roll",
    );

    // Reveal it (as landing would), then roll its number -> now it fires and grows.
    cur.revealedTiles.add(growPos);
    game._processSimpleRolledGrow(cur, n);
    assert(
      game.lastGrowFired && game.lastGrowFired.includes(growPos),
      "A revealed grow fires (and glows) when its number is rolled",
    );
  }
}

// ============================================================
section("75. Simple Mode - Scouted grow is not a genuine reveal");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); p.scoutedTiles = new Set(); }

  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos >= 0) {
    const n = 3;
    game.growTileLabels = game.growTileLabels || new Map();
    for (const [pos, lbl] of [...game.growTileLabels]) {
      if (lbl === n) game.growTileLabels.delete(pos);
    }
    game.growTileLabels.set(growPos, n);
    cur.position = (growPos + 5) % game.boardSize; // stand clear of the grow
    // Own a farm in range so a successful fire grows bananas (the glow only
    // records when something grew).
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (growPos + off) % game.boardSize;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "simple" && pos !== cur.position) { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      cur.properties = [farmPos];
      const fp = game.properties.get(farmPos);
      fp.owner = cur.id;
      fp.bananaPile = 0;
    }

    // Mark it scouted-only (fog-of-war hint, not a genuine discovery). The
    // Scout ability is retired, but the scoutedTiles mechanism still feeds the
    // grow-anchoring logic exercised below.
    cur.revealedTiles.add(growPos);
    cur.scoutedTiles.add(growPos);
    assert(cur.revealedTiles.has(growPos), "Scouted grow shows on the scouter's board");
    assert(cur.scoutedTiles.has(growPos), "Grow is flagged as scouted-only");
    assert(!game._isGenuinelyRevealed(growPos), "A scouted-only grow is NOT genuinely revealed");
    assert(
      !game._genuineRevealedGrowPositions().includes(growPos),
      "A scouted-only grow is excluded from the genuine-revealed grow list",
    );
    const state = game.getState(cur.id);
    assert(
      Array.isArray(state.genuineRevealedGrows) && !state.genuineRevealedGrows.includes(growPos),
      "getState omits a scouted-only grow from genuineRevealedGrows",
    );

    // Rolling its number stays dormant (scouted != revealed).
    game.lastGrowFired = null;
    game._processSimpleRolledGrow(cur, n);
    assert(!game.lastGrowFired, "A scouted-only grow stays dormant when its number is rolled");

    // Landing on it genuinely reveals it and clears the scouted-only flag.
    game._fireSimpleGrowAt(cur, growPos, "land");
    assert(!cur.scoutedTiles.has(growPos), "Landing clears the scouted-only flag");
    assert(game._isGenuinelyRevealed(growPos), "Landing makes the grow genuinely revealed");
    assert(
      game._genuineRevealedGrowPositions().includes(growPos),
      "A genuinely-revealed grow appears in the genuine-revealed grow list",
    );

    // Now its number fires on a roll.
    game.lastGrowFired = null;
    game._processSimpleRolledGrow(cur, n);
    assert(
      game.lastGrowFired && game.lastGrowFired.includes(growPos),
      "A genuinely-revealed grow fires when its number is rolled",
    );
  }
}

// ============================================================
section("76. Simple Mode - Scouted grow does not bound a grow range");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); p.scoutedTiles = new Set(); }

  // Two grow tiles, scanning clockwise so g2 sits after g1.
  const grows = [];
  for (let i = 0; i < game.boardSize && grows.length < 2; i++) {
    if (game.board[i].type === "grow") grows.push(i);
  }
  if (grows.length >= 2) {
    const g1 = grows[0];
    const g2 = grows[1];
    // First owned-able farm strictly clockwise of g2 (before wrapping to g1).
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (g2 + off) % game.boardSize;
      if (pos === g1) break;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "simple") { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      // g1 genuinely revealed; g2 only scouted (so it must NOT bound the range).
      for (const p of game.players) p.revealedTiles.add(g1);
      cur.revealedTiles.add(g2);
      cur.scoutedTiles.add(g2);
      // cur owns the far farm and stands clear; opponents off the farm tile.
      if (!cur.properties.includes(farmPos)) cur.properties.push(farmPos);
      const prop = game.properties.get(farmPos);
      prop.owner = cur.id;
      prop.bananaPile = 0;
      cur.position = g1;
      for (const p of game.players) if (p.id !== cur.id) p.position = g1;

      game.lastGrowFired = null;
      game._fireSimpleGrowAt(cur, g1, "roll");
      assert(
        prop.bananaPile > 0,
        "A farm beyond a scouted-only grow still grows (the scouted grow does not bound the range)",
      );
    }
  }
}

// ============================================================
section("77. Simple Mode - Grow glows only when it grows stuff");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); p.scoutedTiles = new Set(); }

  let growPos = -1;
  for (let i = 0; i < game.boardSize; i++) {
    if (game.board[i].type === "grow") { growPos = i; break; }
  }
  if (growPos >= 0) {
    // No owned farms → landing fires the grow but grows nothing → no glow.
    cur.properties = [];
    cur.position = growPos;
    game.lastGrowFired = null;
    game._fireSimpleGrowAt(cur, growPos, "land");
    assert(!game.lastGrowFired, "A grow that grows 0 bananas does NOT glow");

    // Now own a farm in range and keep opponents off it → it grows → it glows.
    let farmPos = -1;
    for (let off = 1; off < game.boardSize; off++) {
      const pos = (growPos + off) % game.boardSize;
      const prop = game.properties.get(pos);
      if (prop && prop.group === "simple") { farmPos = pos; break; }
    }
    if (farmPos >= 0) {
      cur.properties = [farmPos];
      const fp = game.properties.get(farmPos);
      fp.owner = cur.id;
      fp.bananaPile = 0;
      cur.position = growPos; // stand on the grow, not the farm
      for (const p of game.players) if (p.id !== cur.id) p.position = growPos;
      game.lastGrowFired = null;
      game._fireSimpleGrowAt(cur, growPos, "land");
      assert(fp.bananaPile > 0, "The in-range farm actually grew");
      assert(
        game.lastGrowFired && game.lastGrowFired.includes(growPos),
        "A grow that grows bananas DOES glow",
      );
    }
  }
}

// ============================================================
section("77b. Simple Mode - Grow fires on the dice SUM, not the faces");
// ============================================================

{
  // The GROW whose label equals the dice SUM fires (once). Sums with no matching
  // grow label (e.g. 7-12, since labels are 1-6) fire nothing.
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const cur = game.getCurrentPlayer();
  for (const p of game.players) { p.revealedTiles = new Set(); p.scoutedTiles = new Set(); }

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
      if (prop && prop.group === "simple") { farmPos = pos; break; }
    }
    const fp = game.properties.get(farmPos);
    fp.owner = cur.id; cur.properties = [farmPos];
    cur.position = (growPos + 2) % game.boardSize;
    for (const p of game.players) if (p.id !== cur.id) p.position = (growPos + 24) % game.boardSize;

    // A SUM of 5 fires G5.
    fp.bananaPile = 0;
    game.lastGrowFired = null;
    game._processSimpleRolledGrow(cur, 5);
    assert(
      game.lastGrowFired && game.lastGrowFired.includes(growPos),
      "Dice sum of 5 fires the G5 grow",
    );
    assert(fp.bananaPile > 0, "The in-range farm grew on the sum match");

    // A SUM of 9 (e.g. 4+5) matches no grow label (1-6), so nothing fires —
    // confirming matching is by SUM, not by the individual faces (4 or 5).
    fp.bananaPile = 0;
    game.lastGrowFired = null;
    game._processSimpleRolledGrow(cur, 9);
    assert(!game.lastGrowFired, "Dice sum of 9 fires no grow (labels are 1-6)");
    assert(fp.bananaPile === 0, "Sum 9 grew nothing");
  }
}

// ============================================================
section("78. Simple Mode - Dice never cost money; shop & item-pool are item-only");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "simple", startingMoney: 5000 });
  const p = game.getCurrentPlayer();
  p.money = 5000;
  // Even holding Turtle/Rabbit items, rolling them charges no money.
  p.cards.rabbitDice = 1; // Turtle (1 die)
  p.cards.cheetahDice = 1; // Rabbit (3 dice)
  assert(game._resolveDiceCount(p, 1) === 1 && p.money === 5000, "Turtle roll (1 die) never charges money");
  assert(game._resolveDiceCount(p, 3) === 3 && p.money === 5000, "Rabbit roll (3 dice) never charges money");
  assert(game._resolveDiceCount(p, undefined) === 2 && p.money === 5000, "Default 2d6 is free");
  // The shop is gone — buyCard is a no-op and never grants an item or spends money.
  p.money = 5000;
  p.cards.rabbitDice = 0;
  assert(game.buyCard(p.id, "rabbitDice") === false, "buyCard is a no-op (no shop)");
  assert(p.cards.rabbitDice === 0 && p.money === 5000, "buyCard grants nothing and charges nothing");
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
section("79. Classic Mode - Dice unchanged (2 default; pay 300 for 1 or 3)");
// ============================================================

{
  const { game } = createStartedGame(2, { gameMode: "ffa", startingMoney: 5000 });
  const p = game.getCurrentPlayer();
  p.money = 5000;
  assert(game._resolveDiceCount(p, undefined) === 2 && p.money === 5000, "Classic: default is 2 dice, free");
  assert(game._resolveDiceCount(p, 1) === 1 && p.money === 4700, "Classic: pay 300 for 1 die");
  assert(game._resolveDiceCount(p, 3) === 3 && p.money === 4400, "Classic: pay 300 for 3 dice");
  // The simple-mode x2 tier doesn't exist in classic -> default 2, no charge.
  p.money = 5000;
  assert(game._resolveDiceCount(p, 2) === 2 && p.money === 5000, "Classic ignores an x2 request");
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
