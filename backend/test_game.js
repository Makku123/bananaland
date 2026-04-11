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
      assert(game.auction.phase === "simple-bid", "2-player auction starts with simple-bid phase");
      assert(game.auction.landingPlayer === cur.id, "Landing player is lander");

      // Lander names a price
      assert(game.placeBid(cur.id, 100), "Lander can name a price");
      assert(game.auction && game.auction.phase === "simple-respond", "Moves to simple-respond phase");

      // Opponent accepts
      const other = game.players.find(p => p.id !== cur.id);
      assert(game.respondAuction(other.id, true), "Opponent can accept the price");

      // Auction should resolve - acceptor buys at lander's price
      const prop = game.properties.get(propPos);
      assert(prop && prop.owner === other.id, "Acceptor buys at lander's price");
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
      // Lander can't pass their opening bid in simple auction
      assert(!game.passBid(cur.id), "Lander can't pass opening bid");

      // Lander names a price
      game.placeBid(cur.id, 50);

      // Opponent declines
      const other = game.players.find(p => p.id !== cur.id);
      if (game.auction && game.auction.phase === "simple-respond") {
        assert(game.respondAuction(other.id, false), "Opponent can decline");
        // Lander keeps the farm at their price
        const prop = game.properties.get(propPos);
        assert(prop && prop.owner === cur.id, "Lander gets farm when opponent declines");
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
      assert(
        game.auction.phase === "team-bid",
        "3-player auction starts with team-bid"
      );

      // Lander names a price
      game.placeBid(cur.id, 100);

      // Opponents respond
      const others = game.players.filter(p => p.id !== cur.id && !p.bankrupt);
      if (game.auction && game.auction.phase === "team-respond") {
        // First opponent accepts
        assert(game.respondAuction(others[0].id, true), "Opponent can accept");
      }
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
  // Test that winning bid is capped at richest opponent's money + 1
  const { game } = createStartedGame(2, { startingMoney: 5000 });
  const p0 = game.players[0];
  const p1 = game.players[1];

  // Set up a resolved auction scenario manually
  p1.money = 100; // Opponent only has 100

  let propPos = -1;
  for (let i = 1; i < 52; i++) {
    const prop = game.properties.get(i);
    if (prop && !prop.owner && prop.group !== "mushroom") {
      propPos = i;
      break;
    }
  }

  if (propPos >= 0) {
    const prop = game.properties.get(propPos);

    // Simulate auction resolution
    game.auction = {
      position: propPos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group,
      landingPlayer: p0.id,
      bidders: [p0.id, p1.id],
      bids: {
        [p0.id]: { amount: 3000, placed: true },
        [p1.id]: { amount: 0, passed: true },
      },
      highBid: 3000,
      highBidder: p0.id,
    };

    const moneyBefore = p0.money;
    game._resolveAuction();

    // Price should be capped at opponent's money + 1 = 101
    assert(p0.money === moneyBefore - 101, `Auction price capped: paid 101 instead of 3000 (got ${moneyBefore - p0.money})`);
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
