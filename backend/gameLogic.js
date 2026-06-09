// --- Monkey Business Board Game Logic ---------------------------
// 48 spaces, cornerless square (12 per side)

const START_POSITION = 0;

// --- Poker Helpers -----------------------------------------------
const POKER_SUITS = ["h", "d", "c", "s"];
const POKER_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const HAND_NAMES = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

function createPokerDeck() {
  const deck = [];
  for (const suit of POKER_SUITS) {
    for (const rank of POKER_RANKS) {
      deck.push({ suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function combinations5(arr) {
  const result = [];
  const n = arr.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            result.push([arr[a], arr[b], arr[c], arr[d], arr[e]]);
  return result;
}

function evaluateFiveCards(cards) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const rankCounts = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const counts = Object.entries(rankCounts)
    .map(([r, c]) => ({ rank: parseInt(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const isFlush = suits.every((s) => s === suits[0]);
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false,
    straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    }
    if (unique[0] === 14 && unique[1] === 5 && unique[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }
  if (isFlush && isStraight) return [8, straightHigh];
  if (counts[0].count === 4) return [7, counts[0].rank, counts[1].rank];
  if (counts[0].count === 3 && counts[1].count === 2)
    return [6, counts[0].rank, counts[1].rank];
  if (isFlush) return [5, ...ranks];
  if (isStraight) return [4, straightHigh];
  if (counts[0].count === 3)
    return [
      3,
      counts[0].rank,
      ...counts
        .slice(1)
        .map((c) => c.rank)
        .sort((a, b) => b - a),
    ];
  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairs = [counts[0].rank, counts[1].rank].sort((a, b) => b - a);
    return [2, ...pairs, counts[2].rank];
  }
  if (counts[0].count === 2)
    return [
      1,
      counts[0].rank,
      ...counts
        .slice(1)
        .map((c) => c.rank)
        .sort((a, b) => b - a),
    ];
  return [0, ...ranks];
}

function compareHands(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
}

function bestHand(sevenCards) {
  const combos = combinations5(sevenCards);
  let bestVal = null;
  for (const combo of combos) {
    const val = evaluateFiveCards(combo);
    if (!bestVal || compareHands(val, bestVal) > 0) bestVal = val;
  }
  return bestVal;
}

// --- Board ---------------------------------------------------------
// 48 tiles arranged as a CORNERLESS square (12 tiles per side, no corner
// slots):
//   40 farm tiles (yields 1..40, equal to the F-number, all in the "farm" group),
//   6 grow tiles (all 100%, labelled 1..6 in play),
//   1 Super Banana tile, 1 Desert tile (a buyable "0 farm" — a cactus that
//   grows nothing but still goes to auction when landed on).
// No tax (-10%), no Vine Swing tile (it's now an ability), no corners. Every
// tile is shuffled at game start, so these initial positions only matter for
// the pre-shuffle reveal.
const BOARD_SIZE = 48;
const GROW_POSITIONS = [0, 8, 16, 24, 32, 40]; // 6 grow tiles
const SUPER_BANANA_POS = 12;
const DESERT_POS = 36;

const SPECIAL_POSITIONS = new Set([
  ...GROW_POSITIONS,
  SUPER_BANANA_POS,
  DESERT_POS,
]);

const FARM_POSITIONS = [];
for (let i = 0; i < BOARD_SIZE; i++) {
  if (!SPECIAL_POSITIONS.has(i)) FARM_POSITIONS.push(i);
}

const PROPERTIES = FARM_POSITIONS.map((pos, idx) => ({
  id: pos,
  // F1..F40 — sequential index (there are 40 farms). The yield (`price`) equals
  // the F-number: 1..40, ascending with the index. The board shows "F"+price.
  name: `F${idx + 1}`,
  group: "farm",
  price: idx + 1,
  rent: [0, 0, 0, 0, 0, 0],
}));

const _BUYABLE_MAP = new Map();
PROPERTIES.forEach((p) =>
  _BUYABLE_MAP.set(p.id, { ...p, type: "property" }),
);

const BOARD = (() => {
  const board = [];
  const growSet = new Set(GROW_POSITIONS);
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (growSet.has(i)) {
      board.push({
        id: i,
        name: "🌴 GROW 100%",
        type: "grow",
        growPct: 1.0,
      });
    } else if (i === SUPER_BANANA_POS) {
      board.push({
        id: i,
        name: "⭐",
        type: "special",
        buyable: {
          name: "⭐ Super Banana",
          type: "property",
          group: "superBanana",
          price: 777,
          rent: [0, 0, 0, 0, 0, 0],
        },
      });
    } else if (i === DESERT_POS) {
      // Desert: a buyable "0 farm". It grows nothing (yield/price 0) but still
      // goes to a banana-bid auction when an unowned-tile lander stops on it.
      // Keeps type "desert" (for reveal/legend grouping) plus a buyable so it
      // lands in the properties map and auctions like a farm.
      board.push({
        id: i,
        name: "🌵",
        type: "desert",
        buyable: {
          name: "🌵",
          type: "property",
          group: "desert",
          price: 0,
          rent: [0, 0, 0, 0, 0, 0],
        },
      });
    } else {
      board.push({
        id: i,
        type: "property",
        buyable: _BUYABLE_MAP.get(i),
      });
    }
  }
  return board;
})();

// special-item labels (emoji + name), shared by the log and the
// item auction. These are the four biddable items — won only via the item
// auction, held as consumables, spent one per use. Keys are canonical.
const CARD_LABELS = {
  // Internal keys are legacy; the displayed items are:
  rabbitDice: "🐢 Turtle Dice", // roll 1 die
  cheetahDice: "🐇 Rabbit Dice", // roll 3 dice
  magicDice: "1️⃣ Roll One", // guaranteed move of 1
  // Internal key stays "teleport"; displayed as Vine Swing.
  teleport: "🌿 Vine Swing",
};

// --- Pet Definitions -----------------------------------------------
const PET_TYPES = {
  strong: {
    name: "Strong Pet",
    emoji: "🦁",
    cooldown: 15,
    description: "Move forward 1 space (guaranteed). 15 roll cooldown.",
  },
  energy: {
    name: "Energy Pet",
    emoji: "??",
    cooldown: 7,
    description: "Flip a coin to move forward 1 space. 7 roll cooldown.",
  },
  magic: {
    name: "Magic Pet",
    emoji: "??",
    cooldown: 15,
    description:
      "Flip a coin: heads move forward 1, tails move backward 1. 15 roll cooldown.",
  },
};

// --- Game Class ----------------------------------------------------

class MonkeyBusinessGame {
  constructor(
    gameId,
    maxPlayers,
    startingMoney,
    gameMode,
    bombMode,
    monkeyPoker,
    isPublic,
    itemAuctionOpts,
    bombCost,
  ) {
    this.gameId = gameId;
    this.isPublic = !!isPublic;
    this.gameMode = gameMode === "2v2" ? "2v2" : "classic";
    // Item auction settings
    const ia = itemAuctionOpts || {};
    this.itemAuctionEnabled = ia.enabled !== false; // default ON
    this.itemAuctionTimer = Math.min(
      Math.max(Math.floor(ia.timerSec) || 15, 5),
      60,
    );
    this.itemAuctionStartValue = Math.min(
      Math.max(Math.floor(ia.startValue) || 50, 5),
      500,
    );
    this.itemAuctionCounter = this.itemAuctionStartValue;
    this.itemAuction = null; // { phase, item, startedBy, deadline, bids, ... }
    this._itemAuctionTimer = null;
    this._itemAuctionQueued = false;
    this._itemAuctionStarterId = null; // who triggered the queued/active auction
    // When endTurn is called while a counter-zero auction is queued, the turn
    // advance is held until the auction fully resolves so the next player's
    // "your turn" UI never overlaps the auction. Stored as the lander's
    // socketId so the resolve callback can re-invoke endTurn(socketId).
    this._pendingEndTurnSocketId = null;
    // ability bookkeeping
    this.cardUsedThisTurn = false; // at most one card use per turn
    this.lastTeleport = null; // { playerId, position, turn } — no-walk anim hint
    this.lastTileSwap = null; // { a, b, turn } — swap anim hint
    this.pendingTileShuffles = null; // [{ color, leavingName, positions, endsAt }]
    this.lastTileShuffle = null; // { positions, ts } — sound-effect trigger
    if (this._isTeams()) {
      this.maxPlayers = 4;
    } else {
      this.maxPlayers = Math.min(Math.max(maxPlayers || 4, 2), 4);
    }
    this.startingMoney = Math.min(
      Math.max(Math.floor(startingMoney) || 2222, 100),
      99999,
    );
    this.bombMode = bombMode !== false; // on by default
    // Cost to buy a pineapple bomb. Adjustable (create page / lobby); default
    // 666 in classic, 1000 in 2v2.
    const defaultBombCost = this.gameMode === "2v2" ? 1000 : 666;
    this.bombCost = Math.min(
      Math.max(Math.floor(bombCost) || defaultBombCost, 0),
      99999,
    );
    this.monkeyPoker = monkeyPoker !== false; // on by default
    this.noAuctionTimer = false;
    // Super Banana win-price (paid to claim the tile). Default 777, range
    // 100–99999. Applied to the property at game-start in _initProperties.
    this.superBananaPrice = 777;
    // Seconds each farm-auction phase (respond / silent tie-break) waits before
    // resolving. Default 15, range 5–60. Disabled entirely when noAuctionTimer.
    this.farmAuctionTimer = 15;
    this.state = "waiting"; // waiting | playing | finished
    this.admin = null;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.turn = 0;
    this.dice = [0, 0];
    this.diceRolled = false;
    this.log = []; // recent action log
    this.properties = new Map();
    this.board = [...BOARD]; // will be shuffled on start
    this.boardSize = this.board.length;
    this.auction = null;
    this._auctionTimer = null;
    // Snapshot of the most recently resolved property auction, broadcast to
    // every viewer so non-landers (who bid blind) can still see the BOUGHT /
    // MISSED card with the correct farm. Cleared shortly after resolution.
    this.lastResolvedAuction = null;
    this._lastResolvedAuctionTimer = null;
    // Pool of "fire and forget" setTimeouts (deferred tile shuffle on leave,
    // delayed free-bananas log/payout, super-banana win sequence). Tracked so
    // they can be cleared in _resetToLobby / cleanup() — otherwise they fire
    // on a deleted game and emit no-op updates to an empty socket room.
    this._deferredTimers = new Set();
    this.superBananaPending = null; // { superBananaPos, playerId, awaitingPick, swapPos? } — broke lander must pick a hideout
    // Private hint marking where the Super Banana is currently hidden, shown
    // (as a rainbow tile cover) ONLY to the player who last hid it there.
    this.superBananaHint = null; // { pos, playerId }
    this.petCoinFlip = null; // { playerName, petType, result: "heads"|"tails", targetName? }
    this.pendingPetMove = null; // deferred move after coin flip animation
    this.pendingMagicPets = []; // queued magic pet effects for target's turn
    this.petResolving = false; // true while a pet effect plays at start of turn
    this.petUsedThisTurn = false; // true when own pet fired this turn (skips dice)
    this.onUpdate = null; // callback to emit game state
    this.bombs = []; // { placedBy, position, turnsLeft }
    this.sellListings = []; // { id, sellerId, sellerName, propPos, propName, price }
    this._sellListingId = 0;
    // Team mode: teams = { A: [id1, id2], B: [id3, id4] }
    this.teams = null;
  }

  _isTeams() {
    return this.gameMode === "2v2";
  }

  _initProperties() {
    this.properties.clear();
    // Build properties map based on the (possibly shuffled) board. The Super
    // Banana price is sourced from the configurable lobby setting rather than
    // the board's hardcoded default — same tile, just a different sticker.
    for (let pos = 0; pos < this.board.length; pos++) {
      const space = this.board[pos];
      if (space.buyable) {
        const buyable =
          space.buyable.group === "superBanana"
            ? { ...space.buyable, price: this.superBananaPrice }
            : { ...space.buyable };
        this.properties.set(pos, {
          ...buyable,
          owner: null,
          bananaPile: 0,
        });
      }
    }
  }

  // -- Player management ------------------------------------------

  addPlayer(socketId, name, clientId) {
    if (this.state !== "waiting") return { error: "already_started" };
    if (this.players.length >= this.maxPlayers) return { error: "full" };
    if (!this.admin) this.admin = socketId;

    const allColors = ["brown", "golden", "silver", "red"];
    const taken = new Set(this.players.map((p) => p.color));
    const available = allColors.filter((c) => !taken.has(c));
    const color = available[Math.floor(Math.random() * available.length)];

    const player = {
      id: socketId,
      // Stable per-device id (browser localStorage / account). Lets a player
      // reconnect to their GHOST after a disconnect — never sent to clients.
      clientId: clientId || null,
      // A player who left/disconnected mid-game becomes a "ghost": their piece
      // stays on the board and the server auto-plays their turns until they
      // reconnect (see makeGhost / reconnectByClientId / the ghost driver).
      ghost: false,
      name: String(name).substring(0, 16) || "Player",
      color,
      position: 0,
      money: this.startingMoney,
      properties: [],
      bankrupt: false,
      revealedTiles: new Set([START_POSITION]),
      // Auto-selects the strong pet internally; the Magic Dice it
      // backs is a won consumable, not an always-on cooldown ability.
      pet: "strong",
      petCooldown: 0,
      pendingPet: null,
      bomb: 0,
      hasRolled: false,
      startPickPending: false,
      // Magic Dice picker offers all six numbers 1..6 (no "stay put" / 0 step).
      magicDiceMaxSteps: 6,
      // special-item inventory. Won via the item auction only,
      // stockpiled, spent one per use. Players start empty.
      cards: {
        rabbitDice: 0,
        cheetahDice: 0,
        magicDice: 0,
        teleport: 0,
      },
      // Note: the special item armed (during others' turns) to fire when
      // this player's turn starts. One of the card keys, or null. Private —
      // only this player sees it (see getState).
      armedAbility: null,
    };
    this.players.push(player);
    return player;
  }

  updateSettings(adminId, settings) {
    if (this.state !== "waiting" || this.admin !== adminId) return false;
    if (settings.startingMoney != null) {
      this.startingMoney = Math.min(
        Math.max(Math.floor(settings.startingMoney) || 2222, 100),
        99999,
      );
      for (const p of this.players) {
        p.money = this.startingMoney;
      }
    }
    if (
      settings.gameMode === "classic" ||
      settings.gameMode === "2v2"
    ) {
      if (this.gameMode !== settings.gameMode) {
        this.gameMode = settings.gameMode;
      }
      if (this._isTeams()) this.maxPlayers = 4;
    }
    if (settings.maxPlayers != null && !this._isTeams()) {
      const mp = Math.min(Math.max(Math.floor(settings.maxPlayers) || 2, 2), 4);
      this.maxPlayers = Math.max(mp, this.players.length);
    }
    if (settings.bombMode != null) {
      this.bombMode = !!settings.bombMode;
    }
    if (settings.bombCost != null) {
      this.bombCost = Math.min(
        Math.max(Math.floor(settings.bombCost) || 666, 0),
        99999,
      );
    }
    if (settings.monkeyPoker != null) {
      this.monkeyPoker = !!settings.monkeyPoker;
    }
    if (settings.noAuctionTimer != null) {
      this.noAuctionTimer = !!settings.noAuctionTimer;
    }
    if (settings.isPublic != null) {
      this.isPublic = !!settings.isPublic;
    }
    if (settings.itemAuctionEnabled != null) {
      this.itemAuctionEnabled = !!settings.itemAuctionEnabled;
    }
    if (settings.itemAuctionTimer != null) {
      this.itemAuctionTimer = Math.min(
        Math.max(Math.floor(settings.itemAuctionTimer) || 15, 5),
        60,
      );
    }
    if (settings.itemAuctionStartValue != null) {
      this.itemAuctionStartValue = Math.min(
        Math.max(Math.floor(settings.itemAuctionStartValue) || 50, 5),
        500,
      );
      // While still in the lobby, keep the live counter in sync with the setting.
      if (this.state === "waiting") {
        this.itemAuctionCounter = this.itemAuctionStartValue;
      }
    }
    if (settings.superBananaPrice != null) {
      this.superBananaPrice = Math.min(
        Math.max(Math.floor(settings.superBananaPrice) || 777, 100),
        99999,
      );
    }
    if (settings.farmAuctionTimer != null) {
      this.farmAuctionTimer = Math.min(
        Math.max(Math.floor(settings.farmAuctionTimer) || 15, 5),
        60,
      );
    }
    return true;
  }

  transferHost(adminId, targetId) {
    if (this.state !== "waiting" || this.admin !== adminId) return false;
    if (adminId === targetId) return false;
    const target = this.players.find((p) => p.id === targetId);
    if (!target) return false;
    this.admin = targetId;
    return true;
  }

  kickPlayer(adminId, targetId) {
    if (this.state !== "waiting" || this.admin !== adminId) return false;
    if (adminId === targetId) return false;
    const idx = this.players.findIndex((p) => p.id === targetId);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    return true;
  }

  // 2v2 lobby team switcher: swap `socketId` with the player at the mirror
  // index on the other team. Team A is player indices 0/1, Team B is 2/3
  // (used by startGame to seed the teams map). Only meaningful with a full
  // 4-player lobby; before then the teams aren't realised yet.
  switchTeam(socketId) {
    if (this.state !== "waiting" || !this._isTeams()) return false;
    if (this.players.length !== 4) return false; // both teams must be filled
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx < 0) return false;
    const mirror = idx < 2 ? idx + 2 : idx - 2;
    const tmp = this.players[idx];
    this.players[idx] = this.players[mirror];
    this.players[mirror] = tmp;
    return true;
  }

  changeColor(socketId, color) {
    if (this.state !== "waiting") return false;
    const allColors = ["brown", "golden", "silver", "red"];
    if (!allColors.includes(color)) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    const taken = this.players.filter((p) => p.id !== socketId).map((p) => p.color);
    if (taken.includes(color)) return false;
    player.color = color;
    return true;
  }

  selectPet(socketId, petType) {
    if (this.state !== "waiting") return false;
    if (!PET_TYPES[petType]) return false;
    // Strong pet ("Magic Dice") is the only option.
    if (petType !== "strong") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    player.pet = petType;
    player.petCooldown = 0;
    return true;
  }

  usePetAbility() {
    // The strong pet (Magic Dice) is consumed via useMagicDice() on-turn;
    // there is no off-turn pet flow.
    return false;
  }

  cancelPet(socketId) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || !player.pendingPet) return false;
    player.pendingPet = null;
    this.lastPetUsed = null;
    this._log(`${player.name} cancelled their pet ability.`);
    return true;
  }

  _resolvePendingPets() {
    if (this.state === "finished") return;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.bankrupt) {
      this.petResolving = false;
      if (this.onUpdate) this.onUpdate();
      return;
    }

    // 1. Flip waitForCasterTurn flag when it's the caster's turn
    if (this.pendingMagicPets && this.pendingMagicPets.length > 0) {
      for (const mp of this.pendingMagicPets) {
        if (mp.waitForCasterTurn && mp.userId === cur.id) {
          mp.waitForCasterTurn = false;
        }
      }
    }

    // 2. Check magic pets targeting current player (only if past caster's turn)
    if (this.pendingMagicPets && this.pendingMagicPets.length > 0) {
      const idx = this.pendingMagicPets.findIndex(
        (mp) => mp.targetId === cur.id && !mp.waitForCasterTurn,
      );
      if (idx >= 0) {
        const mp = this.pendingMagicPets.splice(idx, 1)[0];
        this._triggerMagicPetOnTurn(mp);
        return;
      }
    }

    // 3. Check own pending pet (strong/energy)
    if (cur.pendingPet) {
      const pp = cur.pendingPet;
      cur.pendingPet = null;
      this._triggerOwnPetOnTurn(cur, pp);
      return;
    }

    // Nothing to resolve
    this.petResolving = false;
    if (this.petUsedThisTurn) {
      this.diceRolled = true;
      this._log(`\u{1F43E} Pet used!`);
      const cur2 = this.getCurrentPlayer();
      if (
        cur2 &&
        !this.auction &&
        !this.poker &&
        !this.vineSwing &&
        !this.superBananaPending
      ) {
        this._scheduleAutoEnd(cur2, 2000);
      }
    }
    if (this.onUpdate) this.onUpdate();
  }

  _triggerMagicPetOnTurn(mp) {
    this.petResolving = true;
    // Show "Your Turn" for 2s before coin flip
    this.petTurnDelay = true;
    if (this.onUpdate) this.onUpdate();
    setTimeout(() => {
      this.petTurnDelay = false;
      const coinFlip = Math.random() < 0.5;
      this.petCoinFlip = {
        playerName: mp.userName,
        petType: "magic",
        result: coinFlip ? "heads" : "tails",
        targetName: mp.targetName,
      };
      if (coinFlip) {
        this.pendingPetMove = {
          type: "magic_on_turn",
          playerId: mp.userId,
          userName: mp.userName,
          targetId: mp.targetId,
          targetName: mp.targetName,
          cooldown: mp.cooldown,
        };
        if (this.onUpdate) this.onUpdate();
        setTimeout(() => {
          this._executeMagicPetOnTurn();
        }, 9500);
      } else {
        this._log(
          `\u{1F984} ${mp.userName}'s Magic Pet flipped TAILS \u2014 ${mp.targetName} is safe!`,
        );
        if (this.onUpdate) this.onUpdate();
        setTimeout(() => {
          this.petCoinFlip = null;
          this._resolvePendingPets();
        }, 9500);
      }
    }, 2000);
  }

  _executeMagicPetOnTurn() {
    const pending = this.pendingPetMove;
    if (!pending || pending.type !== "magic_on_turn") {
      this._resolvePendingPets();
      return;
    }
    this.pendingPetMove = null;
    this.petCoinFlip = null;

    const target = this.players.find((p) => p.id === pending.targetId);
    if (!target || target.bankrupt) {
      this._resolvePendingPets();
      return;
    }

    const oldPos = target.position;
    target.position = (target.position + 1) % this.boardSize;
    target.revealedTiles.add(target.position);
    this._collectBananasOnPath(target, oldPos, target.position);
    this._log(
      `\u{1F984} ${pending.userName}'s Magic Pet flipped HEADS \u2014 pushed ${pending.targetName} forward 1!`,
    );
    if (this._checkBombDetonation(target)) {
      if (target.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    if (this._explodeExpiredBombs()) {
      if (target.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    this._processLandingPassive(target, pending.playerId);
    this._resolvePendingPets();
    if (this.onUpdate) this.onUpdate();
  }

  _triggerOwnPetOnTurn(player, pp) {
    this.petResolving = true;
    this.petUsedThisTurn = true;

    if (pp.type === "strong") {
      // Set cooldown now that the effect is resolving
      player.petCooldown = pp.cooldown;
      const oldPos = player.position;
      player.position = (player.position + 1) % this.boardSize;
      player.revealedTiles.add(player.position);
      this._collectBananasOnPath(player, oldPos, player.position);
      this._log(
        `\u{1F981} ${player.name}'s Strong Pet pushed them forward 1 space! (${pp.cooldown} roll cooldown)`,
      );
      if (this._checkBombDetonation(player)) {
        if (player.bankrupt || this.state === "finished") {
          this._resolvePendingPets();
          if (this.onUpdate) this.onUpdate();
          return;
        }
      }
      if (this._explodeExpiredBombs()) {
        if (player.bankrupt || this.state === "finished") {
          this._resolvePendingPets();
          if (this.onUpdate) this.onUpdate();
          return;
        }
      }
      this._processLandingPassive(player, player.id);
      this._resolvePendingPets();
      if (this.onUpdate) this.onUpdate();
      return;
    }

    if (pp.type === "energy") {
      // Set cooldown now that the coin flip is resolving
      player.petCooldown = pp.cooldown;
      // Show "Your Turn" for 2s before coin flip
      this.petTurnDelay = true;
      if (this.onUpdate) this.onUpdate();
      setTimeout(() => {
        this.petTurnDelay = false;
        const coinFlip = Math.random() < 0.5;
        this.petCoinFlip = {
          playerName: player.name,
          petType: "energy",
          result: coinFlip ? "heads" : "tails",
        };
        if (coinFlip) {
          this.pendingPetMove = {
            type: "energy_on_turn",
            playerId: player.id,
            cooldown: pp.cooldown,
          };
          if (this.onUpdate) this.onUpdate();
          // Show coin flip result first, then move after animation finishes
          setTimeout(() => {
            this._executeOwnEnergyPetOnTurn();
          }, 5000);
        } else {
          if (this.onUpdate) this.onUpdate();
          // Show coin flip result first, then resolve after animation finishes + 1s pause
          setTimeout(() => {
            this.petCoinFlip = null;
            this._log(
              `\u{1F406} ${player.name}'s Energy Pet flipped TAILS \u2014 no movement!`,
            );
            if (this.onUpdate) this.onUpdate();
            setTimeout(() => {
              this._resolvePendingPets();
            }, 1000);
          }, 5000);
        }
      }, 2000);
      return;
    }

    if (pp.type === "magic") {
      // Set cooldown now that the coin flip is resolving
      player.petCooldown = pp.cooldown;
      // Show "Your Turn" for 2s before coin flip
      this.petTurnDelay = true;
      if (this.onUpdate) this.onUpdate();
      setTimeout(() => {
        this.petTurnDelay = false;
        const coinFlip = Math.random() < 0.5;
        this.petCoinFlip = {
          playerName: player.name,
          petType: "magic",
          result: coinFlip ? "heads" : "tails",
        };
        if (coinFlip) {
          this.pendingPetMove = {
            type: "magic_self_forward",
            playerId: player.id,
            cooldown: pp.cooldown,
          };
          if (this.onUpdate) this.onUpdate();
          setTimeout(() => {
            this._executeOwnDevilPetOnTurn(true);
          }, 5000);
        } else {
          this.pendingPetMove = {
            type: "magic_self_backward",
            playerId: player.id,
            cooldown: pp.cooldown,
          };
          if (this.onUpdate) this.onUpdate();
          setTimeout(() => {
            this._executeOwnDevilPetOnTurn(false);
          }, 5000);
        }
      }, 2000);
      return;
    }

    // Unknown type, just resolve
    this._resolvePendingPets();
  }

  _executeOwnEnergyPetOnTurn() {
    const pending = this.pendingPetMove;
    if (!pending || pending.type !== "energy_on_turn") {
      this._resolvePendingPets();
      return;
    }
    this.pendingPetMove = null;
    this.petCoinFlip = null;

    const player = this.players.find((p) => p.id === pending.playerId);
    if (!player || player.bankrupt) {
      this._resolvePendingPets();
      return;
    }

    const oldPos = player.position;
    player.position = (player.position + 1) % this.boardSize;
    player.revealedTiles.add(player.position);
    this._collectBananasOnPath(player, oldPos, player.position);
    this._log(
      `\u{1F406} ${player.name}'s Energy Pet flipped HEADS \u2014 moved forward 1! (${pending.cooldown} roll cooldown)`,
    );
    if (this._checkBombDetonation(player)) {
      if (player.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    if (this._explodeExpiredBombs()) {
      if (player.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    // Full landing: allows auctions/pitching on unowned tiles
    this._processLanding(player);

    // If an interactive element started (auction, poker, vine swing, super banana),
    // stop pet resolution and let it play out. Pet counts as the roll.
    if (this.auction || this.poker || this.vineSwing || this.superBananaPending) {
      this.petResolving = false;
      this.diceRolled = true;
      if (this.onUpdate) this.onUpdate();
      return;
    }

    // Wait 1s after move before unlocking dice
    if (this.onUpdate) this.onUpdate();
    setTimeout(() => {
      this._resolvePendingPets();
    }, 1000);
  }

  _executeOwnDevilPetOnTurn(isForward) {
    const pending = this.pendingPetMove;
    if (
      !pending ||
      (pending.type !== "magic_self_forward" &&
        pending.type !== "magic_self_backward")
    ) {
      this._resolvePendingPets();
      return;
    }
    this.pendingPetMove = null;
    this.petCoinFlip = null;

    const player = this.players.find((p) => p.id === pending.playerId);
    if (!player || player.bankrupt) {
      this._resolvePendingPets();
      return;
    }

    const oldPos = player.position;
    if (isForward) {
      player.position = (player.position + 1) % this.boardSize;
      player.revealedTiles.add(player.position);
      this._collectBananasOnPath(player, oldPos, player.position);
      this._log(
        `\u{1F984} ${player.name}'s Magic Pet flipped HEADS \u2014 moved forward 1!`,
      );
    } else {
      player.position = (player.position - 1 + this.boardSize) % this.boardSize;
      player.revealedTiles.add(player.position);
      this._collectBananasAtTile(player, player.position);
      this._log(
        `\u{1F984} ${player.name}'s Magic Pet flipped TAILS \u2014 moved backward 1!`,
      );
    }
    if (this._checkBombDetonation(player)) {
      if (player.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    if (this._explodeExpiredBombs()) {
      if (player.bankrupt || this.state === "finished") {
        this._resolvePendingPets();
        if (this.onUpdate) this.onUpdate();
        return;
      }
    }
    this._processLanding(player);

    if (this.auction || this.poker || this.vineSwing || this.superBananaPending) {
      this.petResolving = false;
      this.diceRolled = true;
      if (this.onUpdate) this.onUpdate();
      return;
    }

    if (this.onUpdate) this.onUpdate();
    setTimeout(() => {
      this._resolvePendingPets();
    }, 1000);
  }

  _autoEndAfterPet(player) {
    // Auto-end turn after pet use with a brief pause so the result is visible
    if (!this.auction && !this.poker && !this.vineSwing) {
      this._scheduleAutoEnd(player, 0);
    }
  }

  // Called immediately after any action that will eventually trigger an end-
  // of-turn (rollDice, useMagicDice, vine swing, etc.). We mark autoEndDelay
  // so the End Turn button stays disabled until either:
  //   1. The lander emits turn_anims_complete (the dynamic, accurate trigger
  //      — see notifyAnimsComplete), OR
  //   2. The long safety net below fires endTurn, for disconnected / idle
  //      / browser-throttled landers who never send the signal.
  // The delayMs / displayDelayMs arguments are kept for backwards compat with
  // the dozen-plus call sites but are no longer the source of timing truth —
  // they only set the initial autoEndDelayMs value the client shows as a
  // fallback before the real anim-complete signal arrives.
  _scheduleAutoEnd(player, delayMs, displayDelayMs) {
    if (this._autoEndTimer) clearTimeout(this._autoEndTimer);
    if (this._autoEndFireTimer) clearTimeout(this._autoEndFireTimer);
    this.autoEndDelay = true;
    this.autoEndDelayMs = displayDelayMs != null ? displayDelayMs : delayMs;
    // Safety net: 30 s from now. Normal play replaces this with the 2 s
    // anim-complete timer in notifyAnimsComplete before it ever fires.
    // GHOSTS have no client to send that signal, so for them this timer IS the
    // real end-of-turn — fire it right after the animation window (delayMs).
    const isGhost = !!(player && player.ghost);
    const fireMs = isGhost
      ? Math.min(30000, Math.max(1500, (delayMs || 0) + 800))
      : 30000;
    this._autoEndFireTimer = setTimeout(() => {
      this._autoEndFireTimer = null;
      const cur = this.getCurrentPlayer();
      if (cur && cur.id === player.id && this.diceRolled) {
        this.endTurn(player.id);
      }
      if (this.onUpdate) this.onUpdate();
    }, fireMs);
  }

  // Called by the lander's client (via socket "turn_anims_complete") once
  // every animation for this turn has settled — walking, dice spin, pre-walk
  // grow chain pulse, post-walk grow chain pulse, landing FX. The turn ends
  // immediately on receipt: there is no manual End Turn button and no auto-
  // end countdown — the moment animations finish, the next player is up.
  notifyAnimsComplete(socketId, turn) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (turn != null && turn !== this.turn) return false; // stale signal
    if (!this.diceRolled) return false;
    if (
      this.auction ||
      this.poker ||
      this.vineSwing ||
      this.superBananaPending ||
      this.itemAuction ||
      this.superBananaWin
    ) {
      return false;
    }
    // Cancel the long safety net armed by _scheduleAutoEnd. We're about to
    // end the turn synchronously, so the timer would be a no-op anyway —
    // clearing it keeps the timer set tidy.
    if (this._autoEndTimer) {
      clearTimeout(this._autoEndTimer);
      this._autoEndTimer = null;
    }
    if (this._autoEndFireTimer) {
      clearTimeout(this._autoEndFireTimer);
      this._autoEndFireTimer = null;
    }
    this.autoEndDelay = false;
    this.autoEndDelayMs = 0;
    this.endTurn(socketId);
    return true;
  }

  _cancelAutoEnd() {
    if (this._autoEndTimer) {
      clearTimeout(this._autoEndTimer);
      this._autoEndTimer = null;
    }
    if (this._autoEndFireTimer) {
      clearTimeout(this._autoEndFireTimer);
      this._autoEndFireTimer = null;
    }
    this.autoEndDelay = false;
    this.autoEndDelayMs = 0;
  }

  // Schedule a deferred callback (anim-coordination, delayed log/payout, etc.)
  // and track its ID so it can be cancelled on _resetToLobby / cleanup().
  // Without this, the callback fires on a deleted game and emits a no-op
  // update to an empty socket room.
  _deferredSetTimeout(fn, ms) {
    const id = setTimeout(() => {
      this._deferredTimers.delete(id);
      try {
        fn();
      } catch (err) {
        console.error(
          "[deferred timer] callback failed:",
          (err && err.stack) || err,
        );
      }
    }, ms);
    this._deferredTimers.add(id);
    return id;
  }

  _clearDeferredTimers() {
    for (const id of this._deferredTimers) clearTimeout(id);
    this._deferredTimers.clear();
  }

  // Called by the server before deleting this game from its map. Cancels every
  // tracked timer so nothing fires on a dead game.
  cleanup() {
    if (this._auctionTimer) clearTimeout(this._auctionTimer);
    this._auctionTimer = null;
    if (this._lastResolvedAuctionTimer) clearTimeout(this._lastResolvedAuctionTimer);
    this._lastResolvedAuctionTimer = null;
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = null;
    if (this._pokerDismissTimer) clearTimeout(this._pokerDismissTimer);
    this._pokerDismissTimer = null;
    this._cancelAutoEnd();
    this._clearDeferredTimers();
  }

  _petReady(player) {
    if (!player || !player.pet) return false;
    return player.petCooldown <= 0;
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx === -1) return;

    // If this player is in an active poker game, resolve it
    if (this.poker && !this.poker.resolved) {
      const poker = this.poker;
      if (socketId === poker.bbPlayer || socketId === poker.sbPlayer) {
        const otherId =
          socketId === poker.bbPlayer ? poker.sbPlayer : poker.bbPlayer;
        const other = this.players.find((p) => p.id === otherId);
        if (other) other.money += poker.pot;
        if (this._pokerDismissTimer) {
          clearTimeout(this._pokerDismissTimer);
          this._pokerDismissTimer = null;
        }
        this.poker = null;
      }
    } else if (this.poker && this.poker.resolved) {
      if (
        socketId === this.poker.bbPlayer ||
        socketId === this.poker.sbPlayer
      ) {
        if (this._pokerDismissTimer) {
          clearTimeout(this._pokerDismissTimer);
          this._pokerDismissTimer = null;
        }
        this.poker = null;
      }
    }

    // If this player is in an active property auction, drop them cleanly so it
    // doesn't hang: lander leaving abandons it; otherwise count them as a
    // reject (respond) or a 0 top-up (silent bid).
    if (this.auction && this.auction.bids[socketId]) {
      const a = this.auction;
      if (socketId === a.landingPlayer) {
        if (this._auctionTimer) {
          clearTimeout(this._auctionTimer);
          this._auctionTimer = null;
        }
        this.auction = null;
      } else {
        const b = a.bids[socketId];
        if (a.phase === "respond" && !b.responded) {
          b.responded = true;
          b.accepted = false;
        } else if (
          a.phase === "silentbid" &&
          a.acceptorIds &&
          a.acceptorIds.includes(socketId) &&
          !b.submittedTopup
        ) {
          b.topup = 0;
          b.submittedTopup = true;
        }
        this._checkPhaseComplete();
      }
    }

    // Same for the item auction: the starter leaving abandons it; otherwise
    // count the leaver as a reject / 0 top-up.
    if (this.itemAuction) {
      const a = this.itemAuction;
      if (socketId === a.startedBy) {
        this._cancelItemAuction();
      } else if (a.bids && a.bids[socketId]) {
        const b = a.bids[socketId];
        if (a.phase === "respond" && !b.responded) {
          b.responded = true;
          b.accepted = false;
          this._checkItemPhaseComplete();
        } else if (
          a.phase === "silentbid" &&
          a.acceptorIds &&
          a.acceptorIds.includes(socketId) &&
          !b.submittedTopup
        ) {
          b.topup = 0;
          b.submittedTopup = true;
          this._checkItemPhaseComplete();
        }
      }
    }

    // Track whether this player is the one whose turn it currently is
    const wasCurrentPlayer =
      this.state === "playing" && idx === this.currentPlayerIndex;
    const leavingName = this.players[idx].name;

    // Release properties.
    //
    // Active game: the leaver's tiles get their owner cleared and any
    // bananaPile wiped to 0. The now-empty tiles are then SHUFFLED into
    // random hidden positions — visually "covered back up" so the rest of
    // the game has to rediscover and auction them. Any player who happens
    // to be sitting on one of those tiles is NOT auto-auctioned — they
    // didn't land on the new tile, so it stays hidden under them until
    // someone actually lands on it via dice. This avoids back-to-back
    // auctions when multiple players are sitting on leaver tiles.
    const _inProgress = this.state === "playing";
    const _leaverColor = this.players[idx].color;
    const _leaverTilePositions = Array.isArray(this.players[idx].properties)
      ? [...this.players[idx].properties]
      : [];
    for (const pid of _leaverTilePositions) {
      const prop = this.properties.get(pid);
      if (!prop) continue;
      prop.owner = null;
      prop.bananaPile = 0;
    }

    // Remove any pending magic pets that involve this player (as caster or target)
    this.pendingMagicPets = this.pendingMagicPets.filter(
      (mp) => mp.userId !== socketId && mp.targetId !== socketId,
    );

    // Splice the leaver out BEFORE the shuffle so player.properties lists are
    // adjusted by _swapTilePositions only for the remaining players.
    this.players.splice(idx, 1);

    // leave-shuffle:
    // 1) IMMEDIATELY cover the leaver's tiles with their colour (un-reveal +
    //    publish a pendingTileShuffles entry the frontend renders as coloured
    //    covers + a "Bob left — tiles will be reshuffled" notification).
    // 2) After a 2s pause, shuffle the leaver tiles AMONG THEMSELVES (other
    //    hidden tiles are no longer dragged into the swap) and broadcast a
    //    lastTileShuffle stamp so the frontend plays the shuffle sound.
    // Wrapped so a bug in the deferred branch never tears down the server —
    // worst case the tiles stay where they are (still unowned, still covered).
    if (_inProgress && _leaverTilePositions.length > 0) {
      try {
        // Un-reveal the leaver's tiles right away so the cover is visible
        // while the notification holds. Other tiles are left alone.
        for (const pos of _leaverTilePositions) {
          for (const p of this.players) {
            if (p.revealedTiles) p.revealedTiles.delete(pos);
          }
        }

        const pending = {
          color: _leaverColor,
          leavingName,
          positions: [..._leaverTilePositions],
          scheduledAt: Date.now(),
          endsAt: Date.now() + 2000,
        };
        if (!this.pendingTileShuffles) this.pendingTileShuffles = [];
        this.pendingTileShuffles.push(pending);

        this._log(
          `🌪️ ${leavingName} left the game! Their tiles will be reshuffled in 2 seconds...`,
        );

        this._deferredSetTimeout(() => {
          // Drop this entry from the pending list (frontend cover goes away).
          if (Array.isArray(this.pendingTileShuffles)) {
            this.pendingTileShuffles = this.pendingTileShuffles.filter(
              (p) => p !== pending,
            );
            if (this.pendingTileShuffles.length === 0) {
              this.pendingTileShuffles = null;
            }
          }
          // Shuffle the leaver tiles AMONG THEMSELVES only. Fisher–Yates
          // over the positions array, swapping pair-wise via the existing
          // _swapTilePositions helper so all bookkeeping (properties Map,
          // tile labels, grow labels, player.properties) follows the move.
          const positions = [...pending.positions];
          for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            if (j !== i) this._swapTilePositions(positions[i], positions[j]);
          }
          // Re-un-reveal in case another player revealed one of these
          // positions during the 2s notification window.
          for (const pos of pending.positions) {
            for (const p of this.players) {
              if (p.revealedTiles) p.revealedTiles.delete(pos);
            }
          }
          this.lastTileShuffle = {
            positions: [...pending.positions],
            ts: Date.now(),
          };
          this._log(
            `🔀 ${leavingName}'s ${pending.positions.length} farm${pending.positions.length === 1 ? "" : "s"} got shuffled and covered!`,
          );
          if (this.onUpdate) this.onUpdate();
        }, 2000);
      } catch (err) {
        console.error(
          "[removePlayer] leave-shuffle setup failed:",
          (err && err.stack) || err,
        );
      }
    }
    if (this.currentPlayerIndex >= this.players.length)
      this.currentPlayerIndex = 0;
    if (this.admin === socketId && this.players.length > 0)
      this.admin = this.players[0].id;

    // If the current player left mid-turn, clear their turn state so the next
    // player isn't stuck waiting for actions that will never arrive.
    if (wasCurrentPlayer && this.players.length > 0) {
      this._cancelAutoEnd();
      this.diceRolled = false;
      this.petUsedThisTurn = false;
      this.petResolving = false;
      this.petCoinFlip = null;
      this.lastPetUsed = null;
      if (this.vineSwing === socketId) this.vineSwing = null;
      if (this.superBananaPending && this.superBananaPending.playerId === socketId)
        this.superBananaPending = null;
      if (this.superBananaHint && this.superBananaHint.playerId === socketId)
        this.superBananaHint = null;
      if (this.superBananaWin && this.superBananaWin.playerId === socketId)
        this.superBananaWin = null;
      if (
        this.pendingPetMove &&
        (this.pendingPetMove.playerId === socketId ||
          this.pendingPetMove.targetId === socketId)
      )
        this.pendingPetMove = null;
      const next = this.players[this.currentPlayerIndex];
      if (next) {
        this._log(
          `⚠️ ${leavingName} disconnected — ${next.name}'s turn now.`,
        );
      }
    }

    // If only one non-bankrupt player remains during an active game, they win
    if (this.state === "playing" || this.state === "revealing") {
      const alive = this.players.filter((p) => !p.bankrupt);
      if (alive.length === 1) {
        this.state = "finished";
        this.bombWinner = alive[0].id;
        this._log(
          `🏆 ${alive[0].name} is the last monkey standing and wins! 👑`,
        );
        this._revealAllTiles();
      }
    }
  }

  // ── Ghost players ────────────────────────────────────────────────
  //
  // When a player leaves/disconnects DURING a game they don't vanish — they
  // become a "ghost": their piece stays put, they keep all farms/bananas/items,
  // and the server auto-plays their turns (plain 2d6, no items, never bids in
  // others' auctions). They turn back into a normal player if they reconnect
  // (matched by clientId — see reconnectByClientId). Leaving in the lobby still
  // removes them outright (handled by removePlayer at the server layer).
  makeGhost(socketId) {
    if (this.state !== "playing" && this.state !== "revealing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.ghost) return false;
    player.ghost = true;
    player.armedAbility = null;
    this._log(`👻 ${player.name} left — they're a ghost now, the spirits will play their turns.`);
    // If it's their turn (or they're blocking an interaction), the driver takes
    // over and resolves it.
    this._maybeDriveGhost();
    return true;
  }

  isGhost(socketId) {
    const p = this.players.find((pl) => pl.id === socketId);
    return !!(p && p.ghost);
  }

  // Drive the current player IF it's a ghost: resolve whatever it must act on
  // (super-banana hideout, mid-pitch auction, poker), otherwise auto-roll. Safe
  // to call repeatedly — it no-ops unless a ghost genuinely needs to act.
  _maybeDriveGhost() {
    if (this.state !== "playing") return;
    const cur = this.getCurrentPlayer();
    if (!cur || !cur.ghost || cur.bankrupt) return;
    // Pause auto-play if every remaining player is a ghost — an all-ghost table
    // would loop forever. It resumes the moment someone reconnects.
    if (!this.players.some((p) => !p.bankrupt && !p.ghost)) return;

    // 1) Super Banana hideout pick awaiting this ghost → auto random swap.
    if (this.superBananaPending && this.superBananaPending.playerId === cur.id) {
      this._deferredSetTimeout(() => {
        if (this.superBananaPending && this.superBananaPending.playerId === cur.id) {
          this.forceSuperBananaSwap();
          if (this.onUpdate) this.onUpdate();
          this._maybeDriveGhost();
        }
      }, 900);
      return;
    }
    // 2) The ghost is the lander of a farm still in the pitch phase → restart it
    //    as a sealed bid among the other (non-ghost) eligible players (the ghost
    //    effectively prices it at 0).
    if (this.auction && this.auction.landingPlayer === cur.id && this.auction.phase === "pitch") {
      if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; }
      this.auction = null;
      this._createAuctionForLander(cur.id);
      if (this.onUpdate) this.onUpdate();
      return;
    }
    // 3) Poker awaiting the ghost's action.
    if (this.poker && !this.poker.resolved && this.poker.currentTurn === cur.id) {
      this._maybeDriveGhostPoker();
      return;
    }
    // 4) Start-tile pick (game began while they were already a ghost — rare).
    if (cur.startPickPending) {
      this._deferredSetTimeout(() => this._ghostAutoStartPick(cur.id), 800);
      return;
    }
    // 5) Nothing blocking and they haven't rolled → auto-roll a plain 2d6.
    if (
      this.diceRolled || this.auction || this.poker ||
      this.itemAuction || this.vineSwing || this.superBananaPending
    ) return;
    this._deferredSetTimeout(() => {
      const c = this.getCurrentPlayer();
      if (!c || c.id !== cur.id || !c.ghost || this.diceRolled || this.state !== "playing") return;
      if (this.auction || this.poker || this.itemAuction || this.superBananaPending || this.vineSwing) return;
      this.rollDice(c.id, 2);
      if (this.onUpdate) this.onUpdate();
      // Resolve anything the roll triggered (poker / super-banana / etc.).
      this._maybeDriveGhost();
    }, 1400);
  }

  // Auto-play poker for a ghost: passive — calls when facing a bet, otherwise
  // checks, never raises or folds, so the hand resolves on the cards. Loops in
  // case the next player to act is also a ghost.
  _maybeDriveGhostPoker() {
    if (!this.poker || this.poker.resolved) return;
    const turnId = this.poker.currentTurn;
    const actor = this.players.find((p) => p.id === turnId);
    if (!actor || !actor.ghost) return;
    this._deferredSetTimeout(() => {
      if (!this.poker || this.poker.resolved || this.poker.currentTurn !== turnId) return;
      const pk = this.poker.players[turnId];
      if (!pk) return;
      const toCall = this.poker.currentBet - pk.bet;
      // pokerAction re-invokes _maybeDriveGhostPoker at its end, so the loop
      // continues naturally if it's still (or now) a ghost's turn.
      if (toCall > 0) this.pokerAction(turnId, "call");
      else this.pokerAction(turnId, "check");
      if (this.onUpdate) this.onUpdate();
    }, 1100);
  }

  // Best-effort auto start-pick for a ghost: claim the first revealed/free tile.
  _ghostAutoStartPick(ghostId) {
    const g = this.players.find((p) => p.id === ghostId);
    if (!g || !g.ghost || !g.startPickPending) return;
    const occupied = new Set(this.players.map((p) => p.position));
    let pick = g.position;
    for (let i = 0; i < this.boardSize; i++) {
      if (!occupied.has(i)) { pick = i; break; }
    }
    this.pickStartTile(ghostId, pick);
    if (this.onUpdate) this.onUpdate();
    this._maybeDriveGhost();
  }

  // Reconnect: a player whose device matches a ghost's clientId reclaims it.
  // Their new socket id is rebound across the whole game state and the ghost
  // flag is cleared, so they resume play exactly where the ghost left off.
  reconnectByClientId(newSocketId, clientId) {
    if (!clientId) return null;
    const ghost = this.players.find(
      (p) => p.ghost && p.clientId && p.clientId === clientId,
    );
    if (!ghost) return null;
    const oldId = ghost.id;
    this._rebindPlayerId(oldId, newSocketId);
    ghost.ghost = false;
    this._log(`✨ ${ghost.name} reconnected — back in control of their monkey!`);
    // If they reconnected mid-turn after rolling, the ghost-fast auto-end timer
    // would snap their turn shut — replace it with the normal human safety net
    // so they get time to act.
    const cur = this.getCurrentPlayer();
    if (
      cur && cur.id === newSocketId && this.diceRolled &&
      !this.auction && !this.poker && !this.itemAuction && !this.superBananaPending
    ) {
      this._scheduleAutoEnd(cur, 2000);
    }
    if (this.onUpdate) this.onUpdate();
    // If another ghost is up, keep things moving.
    this._maybeDriveGhost();
    return ghost;
  }

  // Rewrite every reference to a player's socket id (oldId → newId) across the
  // whole game: ownership, teams, bombs, the three auction/poker structures,
  // super-banana state, pending pet effects, and bookkeeping scalars. Used by
  // reconnect so a fresh socket seamlessly inherits the ghost's identity.
  _rebindPlayerId(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const scalar = (obj, field) => {
      if (obj && obj[field] === oldId) obj[field] = newId;
    };
    const arr = (a) => {
      if (Array.isArray(a)) for (let i = 0; i < a.length; i++) if (a[i] === oldId) a[i] = newId;
    };
    const keys = (obj) => {
      if (obj && Object.prototype.hasOwnProperty.call(obj, oldId)) {
        obj[newId] = obj[oldId];
        delete obj[oldId];
      }
    };

    const player = this.players.find((p) => p.id === oldId);
    if (player) player.id = newId;

    if (this.admin === oldId) this.admin = newId;
    if (this.bombWinner === oldId) this.bombWinner = newId;
    if (this.bananaLoser === oldId) this.bananaLoser = newId;
    if (this._itemAuctionStarterId === oldId) this._itemAuctionStarterId = newId;

    for (const [, prop] of this.properties) scalar(prop, "owner");

    if (this.teams) { arr(this.teams.A); arr(this.teams.B); }
    for (const b of this.bombs) scalar(b, "placedBy");

    if (this.auction) {
      scalar(this.auction, "landingPlayer");
      scalar(this.auction, "highBidder");
      arr(this.auction.bidders);
      arr(this.auction.acceptorIds);
      keys(this.auction.bids);
    }
    if (this.itemAuction) {
      scalar(this.itemAuction, "startedBy");
      arr(this.itemAuction.participantIds);
      arr(this.itemAuction.excludedIds);
      arr(this.itemAuction.acceptorIds);
      keys(this.itemAuction.bids);
      if (this.itemAuction.result) scalar(this.itemAuction.result, "winnerId");
    }
    if (this.poker) {
      scalar(this.poker, "bbPlayer");
      scalar(this.poker, "sbPlayer");
      scalar(this.poker, "currentTurn");
      scalar(this.poker, "winner");
      keys(this.poker.players);
    }
    if (this.superBananaPending) scalar(this.superBananaPending, "playerId");
    if (this.superBananaHint) scalar(this.superBananaHint, "playerId");
    if (this.superBananaWin) scalar(this.superBananaWin, "playerId");

    if (Array.isArray(this.pendingMagicPets)) {
      for (const mp of this.pendingMagicPets) { scalar(mp, "userId"); scalar(mp, "targetId"); }
    }
    if (this.pendingPetMove) {
      scalar(this.pendingPetMove, "playerId");
      scalar(this.pendingPetMove, "targetId");
    }
    if (this._lobbyReady && this._lobbyReady.has(oldId)) {
      this._lobbyReady.delete(oldId);
      this._lobbyReady.add(newId);
    }
  }

  playerReadyForLobby(socketId) {
    if (this.state !== "finished") return false;
    if (!this._lobbyReady) this._lobbyReady = new Set();
    this._lobbyReady.add(socketId);
    // Check if all non-disconnected players are ready
    const allReady = this.players.every((p) => this._lobbyReady.has(p.id));
    if (allReady) {
      this._resetToLobby();
    }
    return true;
  }

  isLobbyReady() {
    return this.state === "waiting";
  }

  _resetToLobby() {
    this.state = "waiting";
    this._lobbyReady = null;
    this.currentPlayerIndex = 0;
    this.turn = 0;
    this.dice = [0, 0];
    this.diceRolled = false;
    this.log = [];
    this.properties = new Map();
    this.board = [...BOARD];
    this.boardSize = this.board.length;
    if (this._auctionTimer) clearTimeout(this._auctionTimer);
    this.auction = null;
    this._auctionTimer = null;
    if (this._lastResolvedAuctionTimer) {
      clearTimeout(this._lastResolvedAuctionTimer);
      this._lastResolvedAuctionTimer = null;
    }
    this.lastResolvedAuction = null;
    this._clearDeferredTimers();
    this.superBananaPending = null;
    this.superBananaHint = null;
    this.petCoinFlip = null;
    this.pendingPetMove = null;
    this.pendingMagicPets = [];
    this.petResolving = false;
    this.petUsedThisTurn = false;
    this.bombs = [];
    this.sellListings = [];
    this._sellListingId = 0;
    this.teams = null;
    this.revealAccepted = null;
    this.teamCoinFlip = null;
    this.bombWinner = null;
    this.bananaLoser = null;
    this.poker = null;
    this.vineSwing = null;
    this.lastExplosion = null;
    this.lastDefuse = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.superBananaWin = null;
    this.autoEndDelay = false;
    this.autoEndDelayMs = 0;
    this.lastPetUsed = null;
    this.petTurnDelay = false;
    if (this._pokerDismissTimer) {
      clearTimeout(this._pokerDismissTimer);
      this._pokerDismissTimer = null;
    }
    if (this._autoEndTimer) {
      clearTimeout(this._autoEndTimer);
      this._autoEndTimer = null;
    }
    if (this._autoEndFireTimer) {
      clearTimeout(this._autoEndFireTimer);
      this._autoEndFireTimer = null;
    }
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    this.itemAuction = null;
    this._itemAuctionQueued = false;
    this.itemAuctionCounter = this.itemAuctionStartValue;
    this._pendingEndTurnSocketId = null;
    this.cardUsedThisTurn = false;
    this.lastTeleport = null;
    this.lastTileSwap = null;
    this.pendingTileShuffles = null;
    this.lastTileShuffle = null;
    // Reset players to lobby state
    for (const p of this.players) {
      p.position = 0;
      p.money = this.startingMoney;
      p.properties = [];
      p.bankrupt = false;
      p.revealedTiles = new Set([START_POSITION]);
      // Auto-restore the strong pet so the "all players must have a pet"
      // check in startGame doesn't block re-starting from the lobby.
      p.pet = "strong";
      p.petCooldown = 0;
      p.pendingPet = null;
      p.bomb = 0;
      p.hasRolled = false;
      p.startPickPending = false;
      // Magic Dice fixed at 6 (no upgrades).
      p.magicDiceMaxSteps = 6;
      p.cards = {
        rabbitDice: 0,
        cheetahDice: 0,
        magicDice: 0,
        teleport: 0,
      };
      p.armedAbility = null;
    }
    this._initProperties();
  }

  startGame(socketId) {
    if (socketId !== this.admin || this.players.length < 2) return false;
    if (this._isTeams() && this.players.length !== 4) return false;
    // All players must have selected a pet
    if (this.players.some((p) => !p.pet)) return false;
    // Assign teams in team mode (players 0,1 = Team A, players 2,3 = Team B)
    if (this._isTeams()) {
      this.teams = {
        A: [this.players[0].id, this.players[1].id],
        B: [this.players[2].id, this.players[3].id],
      };
      // Coin flip to decide which team goes first
      const firstTeam = Math.random() < 0.5 ? "A" : "B";
      const secondTeam = firstTeam === "A" ? "B" : "A";
      this.teamCoinFlip = { firstTeam, secondTeam };
      // Reorder: first team gets positions 1 & 3, second team gets 2 & 4
      const first = this.players.filter((p) =>
        this.teams[firstTeam].includes(p.id),
      );
      const second = this.players.filter((p) =>
        this.teams[secondTeam].includes(p.id),
      );
      this.players = [first[0], second[0], first[1], second[1]];
      this._log(
        `\u{1FA99} Coin flip! Team ${firstTeam} goes first (positions 1 & 3). Team ${secondTeam} goes second (positions 2 & 4)!`,
      );
    }
    // Enter reveal phase - show tiles before shuffling
    this.state = "revealing";
    this.revealAccepted = new Set();
    this._log("Take a look at all the tiles...");
    return true;
  }

  acceptReveal(socketId) {
    if (this.state !== "revealing") return null;
    if (!this.players.find((p) => p.id === socketId)) return null;
    this.revealAccepted.add(socketId);
    // If all players accepted, complete the reveal
    if (this.revealAccepted.size >= this.players.length) {
      this.completeReveal();
      return "complete";
    }
    return "accepted";
  }

  completeReveal() {
    if (this.state !== "revealing") return false;
    this._shuffleBoard();
    this._initTileLabelNumbers();
    this._initProperties();
    this.state = "playing";
    // Reset item-auction state for the fresh game.
    this.itemAuctionCounter = this.itemAuctionStartValue;
    this._itemAuctionQueued = false;
    this.itemAuction = null;
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    // Monkeys start off-board. Each player picks their first tile.
    this._assignGrowLabels();
    for (const p of this.players) {
      p.startPickPending = true;
      p.revealedTiles = new Set();
      // Everyone starts with one of each special item. They can't be used on
      // the start-pick (first) turn — that turn is consumed by the pick and
      // diceRolled is set — so they're usable from each player's second turn.
      p.cards = { rabbitDice: 1, cheetahDice: 1, magicDice: 1, teleport: 1 };
    }
    this._log(`Tiles shuffled! Game started! \uD83C\uDF4C`);
    return true;
  }

  _initTileLabelNumbers() {
    // Tiles show their own yield; no group-letter labels.
    this.tileLabelNumbers = new Map();
  }

  _shuffleBoard() {
    // Shuffle every tile (including grow tiles) into any position.
    const tiles = [...this.board];
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    for (let i = 0; i < this.board.length; i++) {
      const tile = { ...tiles[i] };
      tile.id = i;
      this.board[i] = tile;
    }
  }

  debugShuffle() {
    if (this.state !== "playing") return false;
    this._shuffleBoard();
    this._initTileLabelNumbers();
    this._initProperties();
    // Clear player property lists since positions changed
    for (const p of this.players) p.properties = [];
    this._log("\ud83d\udd00 Board reshuffled! (debug)");
    return true;
  }

  debugResetPetCooldown(socketId) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || !player.pet) return false;
    player.petCooldown = 0;
    this._log(`\ud83d\udc3e ${player.name}'s pet cooldown reset! (debug)`);
    return true;
  }

  debugAddBananas(socketId) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    player.money += 10000;
    this._log(
      `\ud83c\udf4c ${player.name} received 10000\ud83c\udf4c! (debug)`,
    );
    return true;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  // -- Dice & Movement --------------------------------------------

  // Returns true if the current player can start an auction on the space they're on
  canAuction(socketId) {
    if (this.auction) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    const prop = this.properties.get(player.position);
    return prop && prop.owner === null;
  }

  // Decide how many dice `player` rolls, consuming a won item where needed.
  // The FREE default is 2d6. A Turtle Dice item drops you to 1 die; a Rabbit
  // Dice item bumps you to 3 dice — each spent on the roll. (Legacy card
  // keys: rabbitDice = Turtle Dice / 1 die, cheetahDice = Rabbit Dice / 3
  // dice.) With no matching item, you roll the default 2 dice.
  _resolveDiceCount(player, diceCount) {
    if (!player.cards) {
      player.cards = { rabbitDice: 0, cheetahDice: 0, magicDice: 0, teleport: 0 };
    }
    if (diceCount === 1 && (player.cards.rabbitDice || 0) > 0) {
      player.cards.rabbitDice -= 1; // Turtle Dice → 1 die
      return 1;
    }
    if (diceCount === 3 && (player.cards.cheetahDice || 0) > 0) {
      player.cards.cheetahDice -= 1; // Rabbit Dice → 3 dice
      return 3;
    }
    return 2; // default 2d6
  }

  rollDice(socketId, diceCount) {
    this.lastExplosion = null;
    this.lastDefuse = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    const cur = this.getCurrentPlayer();
    if (
      !cur ||
      cur.id !== socketId ||
      this.diceRolled ||
      cur.bankrupt ||
      this.petResolving ||
      cur.startPickPending ||
      this.itemAuction
    )
      return null;

    // Charge for the chosen dice tier and decide how many dice to roll.
    const numDice = this._resolveDiceCount(cur, diceCount);

    const rolls = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    this.dice = rolls;
    this.diceRolled = true;
    cur.hasRolled = true;
    cur.armedAbility = null; // an armed item (if any) is spent/moot once you roll
    this.petCoinFlip = null;

    // Tick pet cooldowns for all players
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }

    const diceSum = rolls.reduce((a, b) => a + b, 0);
    // item auction: every dice value subtracts from the counter.
    this._subtractItemAuctionCounter(diceSum);
    const oldPos = cur.position;

    // Note: the GROW tile whose label matches the dice SUM fires BEFORE
    // the player moves — the player still moves the full sum. (Grows are labeled
    // 1..6, so sums 7..12 match none.) Fresh piles on the start tile are
    // early-picked, and piles it creates on farms along the path are collected
    // during the walk below. (A GROW tile the player physically lands on still
    // fires after the move, in _processLanding.)
    this._processRolledGrow(cur, diceSum);

    cur.position = (cur.position + diceSum) % this.boardSize;
    cur.revealedTiles.add(cur.position);

    // Collect own banana piles on crossed/landed tiles & steal opponent piles on landing
    this._collectBananasOnPath(cur, oldPos, cur.position);

    // Check if player landed on a bomb (eliminates victims, placer takes loot)
    if (this._checkBombDetonation(cur)) {
      if (cur.bankrupt || this.state === "finished") {
        // If the current player got eliminated but the game isn't over,
        // schedule an auto-end so the next player can take their turn.
        // Without this the game freezes: the bankrupt player can no longer
        // act, and endTurn is only callable by the current player.
        if (cur.bankrupt && this.state !== "finished") {
          const walkMs = 550 + diceSum * 150 + 500;
          const explosionMs = 1500;
          this._scheduleAutoEnd(cur, walkMs + explosionMs + 1000, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }

    // Timer-based bomb explosion: explode any bomb whose timer has expired
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          const walkMs = 550 + diceSum * 150 + 500;
          const explosionMs = 1500;
          this._scheduleAutoEnd(cur, walkMs + explosionMs + 1000, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }

    this._processLanding(cur);

    // Collect dice-match-grown piles if the player walked past or started on those tiles
    // (runs after _processLanding so GROW tile growth stacks on top of dice-match growth)
    if (this.diceMatchTiles && this.diceMatchTiles.length > 0) {
      const pathTiles = new Set();
      // Include the starting tile — the player was standing here when the grow happened
      pathTiles.add(oldPos);
      const pathSteps = (cur.position - oldPos + this.boardSize) % this.boardSize;
      for (let s = 1; s <= pathSteps; s++) {
        pathTiles.add((oldPos + s) % this.boardSize);
      }
      let diceMatchCollected = 0;
      for (const tileId of this.diceMatchTiles) {
        if (!pathTiles.has(tileId)) continue;
        const prop = this.properties.get(tileId);
        if (!prop || prop.bananaPile <= 0) continue;
        // Collect own piles on crossed/landed tiles, steal opponent piles only on landing
        const isLanding = tileId === cur.position;
        if (prop.owner === cur.id || isLanding) {
          diceMatchCollected += prop.bananaPile;
          prop.bananaPile = 0;
        }
      }
      if (diceMatchCollected > 0) {
        cur.money += diceMatchCollected;
        this._log(
          `${cur.name} harvested ${diceMatchCollected}\ud83c\udf4c from freshly sprouted dice-match piles! \ud83c\udf31\ud83d\udc35`,
        );
      }
    }

    // Auto-end turn if no auction, vine swing, or poker was started
    // Delay accounts for frontend dice animation (550ms) + dice-match anim (1200ms if applicable) + token walk (steps*150ms) + post-walk pause (500ms) + buffer
    const diceMatchDelayMs =
      this.diceMatchTiles && this.diceMatchTiles.length > 0 ? 1200 : 0;
    const earlyPickupDelayMs = this.diceMatchEarlyPickup != null ? 1000 : 0;
    const walkAnimMs = 550 + diceMatchDelayMs + earlyPickupDelayMs + diceSum * 150 + 500;
    if (
      !this.auction &&
      !this.vineSwing &&
      !this.poker &&
      !this.superBananaPending
    ) {
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 2000);
    }

    return { dice: this.dice, moved: true };
  }

  // "Roll One" item (legacy key magicDice): a guaranteed move of exactly 1
  // space — walks one tile and fires GROW 1 (sum 1) just like rolling a 1.
  // Spends one item. The `steps` argument is ignored (always 1).
  useMagicDice(socketId, steps) {
    if (this.state !== "playing") return null;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || cur.bankrupt) return null;
    if (this.diceRolled) return null;
    if (this.petResolving) return null;
    if (cur.startPickPending) return null;
    if (this.auction || this.poker || this.vineSwing || this.superBananaPending)
      return null;
    if (this.itemAuction) return null;
    // Must hold a won Roll One item to use it.
    if (!cur.cards || (cur.cards.magicDice || 0) <= 0) return null;
    const n = 1; // Roll One always moves exactly 1

    // Reset per-turn transient state (mirrors rollDice).
    this.lastExplosion = null;
    this.lastDefuse = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;

    // Consume the item now that the use is committed.
    cur.cards.magicDice -= 1;
    cur.armedAbility = null;

    this.dice = [n];
    this.diceRolled = true;
    cur.hasRolled = true;
    this.petCoinFlip = null;
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }
    this.petUsedThisTurn = true;
    // item auction: Magic Dice counts as a dice roll.
    this._subtractItemAuctionCounter(n);
    this.lastPetUsed = {
      playerId: cur.id,
      playerName: cur.name,
      petType: "strong",
    };
    // No shared log line here on purpose: a Magic Dice roll must be
    // indistinguishable from a normal roll to opponents. (A grow it fires still
    // logs the same "rolled N — GROW N fired" line a normal roll would.)

    const oldPos = cur.position;

    // Note: the chosen number fires its labeled GROW tile BEFORE the
    // player moves (see rollDice for the rationale). A GROW tile the player
    // physically lands on still fires after the move, in _processLanding.
    this._processRolledGrow(cur, n);

    cur.position = (cur.position + n) % this.boardSize;
    cur.revealedTiles.add(cur.position);

    this._collectBananasOnPath(cur, oldPos, cur.position);

    if (this._checkBombDetonation(cur)) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          const walkMs = 550 + n * 150 + 500;
          this._scheduleAutoEnd(cur, walkMs + 1500 + 1000, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          const walkMs = 550 + n * 150 + 500;
          this._scheduleAutoEnd(cur, walkMs + 1500 + 1000, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }

    this._processLanding(cur);

    const walkAnimMs = 550 + n * 150 + 500;
    if (
      !this.auction &&
      !this.vineSwing &&
      !this.poker &&
      !this.superBananaPending
    ) {
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  // Magic Dice no longer upgrades — it's fixed at level 6 (all numbers 1..6).
  // Kept as a no-op so the legacy upgrade_magic_dice event does nothing.
  upgradeMagicDice() {
    return false;
  }

  // -- Special Items (won via the item auction) --------
  // Four items, won at the item auction (or one of each free at game start),
  // stockpiled and spent one per use. The dice items go through the roll path
  // (rollDice 1/3 dice and useMagicDice); only Vine Swing flows through useCard.
  // (Legacy keys → current items: rabbitDice = Turtle Dice / 1 die, cheetahDice
  //  = Rabbit Dice / 3 dice, magicDice = Roll One / guaranteed move 1.)
  //   teleport — "Vine Swing": swing (no walking) to one of your OWN farms;
  //              landing effects fire (collect that farm's pile, poker if an
  //              opponent squats there). Replaces your roll. Needs an owned farm.
  // Each replaces your move for the turn, so at most one is used per turn.

  canUseCard(player, cardType) {
    if (!player || player.bankrupt) return false;
    if (!player.cards || player.cards[cardType] === undefined) return false;
    if (player.cards[cardType] <= 0) return false;
    if (cardType === "teleport") {
      // Vine Swing needs at least one farm YOU own to swing to.
      return this._ownedFarmPositions(player).length > 0;
    }
    return false;
  }

  // Board positions of the farm tiles a player currently owns.
  _ownedFarmPositions(player) {
    if (!player || !player.properties) return [];
    return player.properties.filter((pos) => {
      const prop = this.properties.get(pos);
      return prop && prop.group === "farm";
    });
  }

  // Special items are won via the item auction only — there is no shop. Kept as
  // a no-op so the legacy buy_card socket event does nothing.
  buyCard() {
    return false;
  }

  // Arm a special item so it fires when the next roll happens. Allowed at any
  // point in the game EXCEPT during the first-pick phase. If armed mid-turn
  // after the player has already rolled, the item just persists across endTurn
  // and is consumed on their NEXT roll. Passing null disarms (same rules).
  armAbility(socketId, ability) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    if (player.startPickPending) return false;
    if (ability === null || ability === undefined) {
      player.armedAbility = null;
      return true;
    }
    if (!["rabbitDice", "cheetahDice", "magicDice", "teleport"].includes(ability)) {
      return false;
    }
    if ((player.cards && player.cards[ability]) <= 0) return false; // must own it
    player.armedAbility = ability;
    return true;
  }

  // Shared per-turn-start scrub used by useMagicDice / rollDice / teleport when
  // they replace a roll. Suppresses the dice-roll animation on the frontend.
  _beginCardTurn(cur) {
    this.lastExplosion = null;
    this.lastDefuse = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.petCoinFlip = null;
    cur.hasRolled = true;
    this.diceRolled = true;
    cur.armedAbility = null;
    this.petUsedThisTurn = true;
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }
  }

  // useCard handles only Vine Swing now (internal key "teleport"):
  //   teleport → { pos }
  // The dice items (rabbit/cheetah/magic) are used through the roll path.
  useCard(socketId, cardType, data) {
    if (this.state !== "playing") return null;
    if (cardType !== "teleport") return null;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return null;
    if (!this.canUseCard(player, cardType)) return null;

    // Vine Swing: only on your turn, before rolling.
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return null;
    if (this.diceRolled) return null;
    if (this.petResolving) return null;
    if (cur.startPickPending) return null;
    if (this.auction || this.poker || this.vineSwing || this.superBananaPending)
      return null;
    if (this.itemAuction) return null;
    if (this.cardUsedThisTurn) return null;

    if (!this._validateTeleportTarget(cur, data)) return null;

    cur.cards.teleport = Math.max(0, (cur.cards.teleport || 0) - 1);
    this.cardUsedThisTurn = true;
    return this._useTeleportCard(cur, Math.floor(data.pos));
  }

  _validateTeleportTarget(player, data) {
    if (!data) return false;
    const pos = Math.floor(data.pos);
    if (!Number.isFinite(pos) || pos < 0 || pos >= this.boardSize) return false;
    // Vine Swing only swings to a farm YOU own — nothing else. Occupied is
    // allowed (a squatting opponent there triggers poker, like a normal landing).
    const prop = this.properties.get(pos);
    if (!prop || prop.owner !== player.id || prop.group !== "farm") return false;
    return true;
  }

  // True if any player has revealed this board position.
  _isRevealedToAnyone(pos) {
    for (const p of this.players) {
      if (p.revealedTiles && p.revealedTiles.has(pos)) return true;
    }
    return false;
  }

  // Vine Swing (internal key "teleport"): jump to ANY tile without walking, then
  // the destination's full landing effects fire — collect/steal its pile, fire
  // GROW, win on Super Banana, detonate a bomb, start
  // poker if a player stands there, or open a banana-bid auction on an unowned
  // farm. Replaces the dice roll for the turn.
  _useTeleportCard(cur, pos) {
    this._beginCardTurn(cur);
    // Swinging away from a tile counts as LEAVING it: if you were squatting on
    // an opponent's farm, you take its accumulated pile as you swing off (the
    // squat steal-on-leave rule — also applied in _collectBananasOnPath for
    // walked moves).
    const leftProp = this.properties.get(cur.position);
    if (
      leftProp &&
      leftProp.bananaPile > 0 &&
      leftProp.owner &&
      leftProp.owner !== cur.id
    ) {
      const victim = this.players.find((p) => p.id === leftProp.owner);
      cur.money += leftProp.bananaPile;
      this._log(
        `🌿 ${cur.name} swung off ${victim?.name || "?"}'s farm and grabbed ${leftProp.bananaPile}🍌 on the way out! 👲`,
      );
      leftProp.bananaPile = 0;
    }
    this.dice = [0];
    cur.position = pos;
    cur.revealedTiles.add(pos);
    // Signal a no-walk jump to the frontend (reuse the lastStartPick shape).
    this.lastTeleport = { playerId: cur.id, position: pos, turn: this.turn };
    this._log(`🌿 ${cur.name} swung the vines across the jungle!`);
    // No walking, so collect/steal the destination pile here (a normal landing
    // would do this during the walk). _processLanding below handles the rest.
    this._collectBananasAtTile(cur, pos);

    if (this._checkBombDetonation(cur)) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          this._scheduleAutoEnd(cur, 1500 + 1000, 2000);
        }
        return { card: "teleport", moved: true };
      }
    }
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          this._scheduleAutoEnd(cur, 1500 + 1000, 2000);
        }
        return { card: "teleport", moved: true };
      }
    }
    this._processLanding(cur);
    if (!this.auction && !this.vineSwing && !this.poker && !this.superBananaPending) {
      this._scheduleAutoEnd(cur, 1500, 2000);
    }
    return { card: "teleport", moved: true };
  }

  // -- Item Auction ---------------------------------------
  // Counter ticks down on every dice roll (regular dice, magic dice, banana
  // collector card). When it hits 0, after the turn fully ends, a wheel spins
  // and lands on one of 4 cards; all non-bankrupt players submit silent bids
  // (capped at their money), highest unique bidder wins. Ties at the top =
  // nobody wins. Counter resets to start value.

  _itemAuctionActive() {
    return !!(this.itemAuction);
  }

  _subtractItemAuctionCounter(amount) {
    if (!this.itemAuctionEnabled) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.itemAuctionCounter <= 0) return; // already pending
    this.itemAuctionCounter = Math.max(0, this.itemAuctionCounter - amount);
    if (this.itemAuctionCounter <= 0) {
      this._itemAuctionQueued = true;
      // The roller whose dice ran the counter to 0 "started" this auction — only
      // they get to see the spun item; everyone else bids blind.
      const roller = this.getCurrentPlayer();
      this._itemAuctionStarterId = roller ? roller.id : null;
    }
  }

  _maybeStartQueuedItemAuction() {
    if (!this._itemAuctionQueued) return;
    if (this._itemAuctionActive()) return;
    if (this.state !== "playing") return;
    if (!this.itemAuctionEnabled) return;
    // Need at least 2 non-bankrupt players to bother holding an auction
    const alive = this.players.filter((p) => !p.bankrupt);
    if (alive.length < 1) {
      this._itemAuctionQueued = false;
      this.itemAuctionCounter = this.itemAuctionStartValue;
      return;
    }
    this._itemAuctionQueued = false;
    this._startItemAuction();
  }

  _startItemAuction() {
    const ITEMS = ["rabbitDice", "cheetahDice", "magicDice", "teleport"];
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const now = Date.now();
    const WHEEL_MS = 2800;
    this.itemAuction = {
      phase: "wheel",
      item,
      // Only the starter sees `item` before the result is revealed.
      startedBy: this._itemAuctionStarterId || null,
      wheelStartedAt: now,
      wheelEndsAt: now + WHEEL_MS,
      listPrice: null,
      respondDeadline: null,
      respondStartTime: null,
      silentDeadline: null,
      silentStartTime: null,
      bids: {},
      participantIds: [],
      excludedIds: [],
      acceptorIds: [],
      result: null,
    };
    this._log(`🎡 Item auction! The wheel is spinning... 🎡`);
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      this._beginItemAuctionPitch();
    }, WHEEL_MS);
  }

  // The starter (who alone sees the spun item) is the "lander": they name a
  // price for the mystery item that everyone else accepts or rejects blind.
  _beginItemAuctionPitch() {
    const a = this.itemAuction;
    if (!a) return;
    if (this.state !== "playing") {
      this._cancelItemAuction();
      return;
    }
    const starter = this.players.find(
      (p) => p.id === a.startedBy && !p.bankrupt,
    );
    if (!starter) {
      this._cancelItemAuction();
      return;
    }
    // 0-banana players AND ghosts are excluded from bidding on an item auction.
    const eligible = this.players.filter(
      (p) => !p.bankrupt && p.money > 0 && !p.ghost,
    );

    // Ghost starter: prices the spun item at 0, so the OTHER eligible players
    // sealed-bid for it. None eligible → the item is lost; one → free to them.
    if (starter.ghost) {
      if (eligible.length === 0) {
        this._cancelItemAuction();
        return;
      }
      if (eligible.length === 1) {
        this._resolveItemAuction(eligible[0].id, 0, false);
        return;
      }
      this._startSealedItemAuction(eligible.map((p) => p.id));
      if (this.onUpdate) this.onUpdate();
      return;
    }

    if (eligible.length === 0) {
      // Everyone is broke — the spinner keeps the item for free.
      this._resolveItemAuction(a.startedBy, 0, true);
      return;
    }
    if (eligible.length === 1) {
      // Only one player can pay — they get the item immediately, no pricing.
      this._resolveItemAuction(
        eligible[0].id,
        0,
        eligible[0].id === a.startedBy,
      );
      return;
    }

    if (starter.money > 0) {
      // Normal pitch: the spinner (who alone sees the item) names a price.
      a.phase = "pitch";
      this._log(
        `🎁 An item is up for auction — the starter is naming a price...`,
      );
      if (this.onUpdate) this.onUpdate();
      return;
    }

    // Broke spinner can't price it → sealed bid among the eligible players.
    this._startSealedItemAuction(eligible.map((p) => p.id));
    if (this.onUpdate) this.onUpdate();
  }

  // Sealed item bid: the spinner is broke, so every eligible player secretly
  // names a price and the highest wins. Reuses the silent-bid phase with a base
  // price of 0 and no leader.
  _startSealedItemAuction(bidderIds) {
    const a = this.itemAuction;
    if (!a) return;
    a.phase = "silentbid";
    a.sealedBid = true;
    a.listPrice = 0;
    a.participantIds = [...bidderIds];
    a.excludedIds = [];
    a.acceptorIds = [...bidderIds];
    a.bids = {};
    for (const id of bidderIds) {
      a.bids[id] = {
        accepted: true,
        responded: true,
        topup: null,
        submittedTopup: false,
      };
    }
    this._log(
      `🤫 Sealed item bid! The spinner is broke — everyone bids, highest wins.`,
    );
    const ms = (this.itemAuctionTimer || 15) * 1000;
    a.silentDeadline = Date.now() + ms;
    a.silentStartTime = Date.now();
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      if (!this.itemAuction || this.itemAuction.phase !== "silentbid") return;
      this._resolveItemSilentBid();
      if (this.onUpdate) this.onUpdate();
    }, ms);
  }

  pitchItemPrice(socketId, amount) {
    const a = this.itemAuction;
    if (!a || a.phase !== "pitch") return false;
    if (socketId !== a.startedBy) return false;
    const starter = this.players.find((p) => p.id === socketId);
    if (!starter) return false;
    let n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) return false;
    if (n > starter.money) return false;
    // Cap at richest opponent's bank so the price isn't impossible for everyone.
    const others = this.players.filter((p) => p.id !== socketId && !p.bankrupt);
    if (others.length > 0) {
      const maxOther = Math.max(...others.map((p) => p.money));
      if (starter.money >= maxOther && n > maxOther) return false;
    }
    // Minimum price is 1 (0 only allowed when the starter is broke).
    if (n < 1 && starter.money !== 0) return false;
    a.listPrice = n;
    this._beginItemAuctionRespond();
    if (this.onUpdate) this.onUpdate();
    return true;
  }

  _beginItemAuctionRespond() {
    const a = this.itemAuction;
    if (!a) return;
    const price = a.listPrice || 0;
    const others = this.players.filter(
      (p) => !p.bankrupt && !p.ghost && p.id !== a.startedBy,
    );
    const eligible = [];
    const excluded = [];
    for (const p of others) {
      if (p.money >= price) eligible.push(p.id);
      else excluded.push(p.id);
    }
    a.participantIds = eligible;
    a.excludedIds = excluded;
    a.bids = {};
    for (const id of eligible) {
      a.bids[id] = {
        accepted: null,
        responded: false,
        topup: null,
        submittedTopup: false,
      };
    }
    if (eligible.length === 0) {
      // Nobody can afford it — the starter keeps the item.
      this._resolveItemAuction(a.startedBy, price, true);
      return;
    }
    a.phase = "respond";
    const ms = (this.itemAuctionTimer || 15) * 1000;
    a.respondDeadline = Date.now() + ms;
    a.respondStartTime = Date.now();
    this._log(`🎁 Item priced at ${price}🍌 — accept or reject the mystery item!`);
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      if (!this.itemAuction || this.itemAuction.phase !== "respond") return;
      this._closeItemRespondPhase();
      if (this.onUpdate) this.onUpdate();
    }, ms);
    if (this.onUpdate) this.onUpdate();
  }

  respondItemAuction(socketId, accept) {
    const a = this.itemAuction;
    if (!a || a.phase !== "respond") return false;
    if (socketId === a.startedBy) return false;
    const b = a.bids[socketId];
    if (!b || b.responded) return false;
    // Recorded privately — no log entry while the window is open.
    b.accepted = !!accept;
    b.responded = true;
    this._checkItemPhaseComplete();
    return true;
  }

  _checkItemPhaseComplete() {
    const a = this.itemAuction;
    if (!a) return;
    if (a.phase === "respond") {
      const all = (a.participantIds || []).every(
        (id) => a.bids[id] && a.bids[id].responded,
      );
      if (all) this._closeItemRespondPhase();
      return;
    }
    if (a.phase === "silentbid") {
      const all = (a.acceptorIds || []).every(
        (id) => a.bids[id] && a.bids[id].submittedTopup,
      );
      if (all) this._resolveItemSilentBid();
      return;
    }
  }

  _closeItemRespondPhase() {
    const a = this.itemAuction;
    if (!a) return;
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    const price = a.listPrice || 0;
    const acceptors = (a.participantIds || []).filter(
      (id) => a.bids[id] && a.bids[id].accepted === true,
    );
    if (acceptors.length === 0) {
      this._resolveItemAuction(a.startedBy, price, true);
      return;
    }
    if (acceptors.length === 1) {
      this._resolveItemAuction(acceptors[0], price, false);
      return;
    }
    // 2+ acceptors — silent tie-breaker on top of the listed price.
    a.phase = "silentbid";
    a.acceptorIds = acceptors;
    for (const id of acceptors) {
      const p = this.players.find((pl) => pl.id === id);
      const maxTopup = Math.max(0, (p ? p.money : 0) - price);
      if (maxTopup <= 0) {
        a.bids[id].topup = 0;
        a.bids[id].submittedTopup = true;
      } else {
        a.bids[id].topup = null;
        a.bids[id].submittedTopup = false;
      }
    }
    const ms = (this.itemAuctionTimer || 15) * 1000;
    a.silentDeadline = Date.now() + ms;
    a.silentStartTime = Date.now();
    this._log(`🤫 Multiple takers — silent tie-breaker! Bid extra on top of ${price}🍌.`);
    if (a.acceptorIds.every((id) => a.bids[id].submittedTopup)) {
      this._resolveItemSilentBid();
      return;
    }
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      if (!this.itemAuction || this.itemAuction.phase !== "silentbid") return;
      this._resolveItemSilentBid();
      if (this.onUpdate) this.onUpdate();
    }, ms);
    if (this.onUpdate) this.onUpdate();
  }

  _itemAuctionLabels() {
    return { ...CARD_LABELS };
  }

  // Silent top-up (amount on top of the list price). Only acceptors take part.
  submitItemBid(socketId, amount) {
    const a = this.itemAuction;
    if (!a || a.phase !== "silentbid") return false;
    if (!a.acceptorIds || !a.acceptorIds.includes(socketId)) return false;
    const b = a.bids[socketId];
    if (!b || b.submittedTopup) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    let n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) n = 0;
    const maxTopup = Math.max(0, (player.money || 0) - (a.listPrice || 0));
    b.topup = Math.min(n, maxTopup);
    b.submittedTopup = true;
    this._checkItemPhaseComplete();
    return true;
  }

  _resolveItemSilentBid() {
    const a = this.itemAuction;
    if (!a) return;
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    const acceptors = a.acceptorIds || [];
    for (const id of acceptors) {
      if (a.bids[id] && !a.bids[id].submittedTopup) {
        a.bids[id].topup = 0;
        a.bids[id].submittedTopup = true;
      }
    }
    let maxTopup = -1;
    for (const id of acceptors) {
      const t = (a.bids[id] && a.bids[id].topup) || 0;
      if (t > maxTopup) maxTopup = t;
    }
    const top = acceptors.filter(
      (id) => ((a.bids[id] && a.bids[id].topup) || 0) === maxTopup,
    );
    const price = a.listPrice || 0;
    if (top.length === 1) {
      this._resolveItemAuction(top[0], price + maxTopup, false);
    } else if (a.sealedBid) {
      // Sealed bid has no leader to fall back to — earliest tied bidder wins.
      this._resolveItemAuction(
        this._earliestByTurnOrder(top),
        price + maxTopup,
        false,
      );
    } else {
      // Tie at the top — the starter keeps the item at the listed price.
      this._resolveItemAuction(a.startedBy, price, true);
    }
  }

  // Award the item to the winner (`viaStarter` when the starter kept it on a
  // tie / no-takers). Only the winner + price are revealed.
  _resolveItemAuction(winnerId, pricePaid, viaStarter) {
    const a = this.itemAuction;
    if (!a) return;
    const labels = this._itemAuctionLabels();
    const winner = this.players.find((p) => p.id === winnerId);
    let result;
    if (winner) {
      winner.money = Math.max(0, (winner.money || 0) - (pricePaid || 0));
      if (!winner.cards) {
        winner.cards = { rabbitDice: 0, cheetahDice: 0, magicDice: 0, teleport: 0 };
      }
      winner.cards[a.item] = (winner.cards[a.item] || 0) + 1;
      if (viaStarter && winnerId === a.startedBy) {
        this._log(`🏆 ${winner.name} kept ${labels[a.item]} for ${pricePaid}🍌!`);
      } else {
        this._log(`🏆 ${winner.name} won ${labels[a.item]} for ${pricePaid}🍌!`);
      }
      result = {
        winnerId,
        winnerName: winner.name,
        pricePaid: pricePaid || 0,
        viaStarter: !!viaStarter,
      };
    } else {
      this._log(`💨 The item auction ended with no winner.`);
      result = { winnerId: null, winnerName: null, pricePaid: 0, viaStarter: false };
    }
    a.phase = "result";
    a.result = result;
    a.respondDeadline = null;
    a.silentDeadline = null;
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    if (this.onUpdate) this.onUpdate();
    // Hold result on screen briefly, then clear + reset counter.
    const RESULT_MS = 3500;
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      this.itemAuction = null;
      this.itemAuctionCounter = this.itemAuctionStartValue;
      // Finish the endTurn that was deferred while this auction ran. Doing
      // this AFTER itemAuction is cleared lets endTurn pass its own
      // `if (this.itemAuction) return false` guard and advance the turn.
      const resumeId = this._pendingEndTurnSocketId;
      this._pendingEndTurnSocketId = null;
      if (resumeId && this.state === "playing") {
        this.endTurn(resumeId);
      }
      if (this.onUpdate) this.onUpdate();
    }, RESULT_MS);
  }

  _cancelItemAuction() {
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    this.itemAuction = null;
    this._itemAuctionQueued = false;
    this.itemAuctionCounter = this.itemAuctionStartValue;
    // If endTurn was deferred for this auction, complete it now so the game
    // doesn't stall (e.g. starter went bankrupt mid-pitch, or the auction
    // aborted before it could resolve). When the starter has actually left,
    // removePlayer has already advanced the turn and the re-call will be a
    // safe no-op (cur.id !== socketId).
    const resumeId = this._pendingEndTurnSocketId;
    this._pendingEndTurnSocketId = null;
    if (resumeId && this.state === "playing") {
      this.endTurn(resumeId);
    }
  }

  debugMove(socketId, targetPos) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || this.diceRolled || cur.bankrupt)
      return null;
    const pos = Math.max(0, Math.min(Math.floor(targetPos), this.boardSize - 1));
    this.dice = [0, 0];
    this.diceRolled = true;
    const oldPos = cur.position;
    cur.position = pos;
    cur.revealedTiles.add(cur.position);
    this._collectBananasOnPath(cur, oldPos, cur.position);
    if (this._checkBombDetonation(cur)) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          this._scheduleAutoEnd(cur, 2500, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
        if (cur.bankrupt && this.state !== "finished") {
          this._scheduleAutoEnd(cur, 2500, 2000);
        }
        return { dice: this.dice, moved: true };
      }
    }
    this._processLanding(cur);
    const debugSteps =
      (((pos - oldPos) % this.boardSize) + this.boardSize) % this.boardSize || 1;
    const debugWalkMs = 550 + debugSteps * 150 + 500;
    if (
      !this.auction &&
      !this.vineSwing &&
      !this.poker &&
      !this.superBananaPending
    ) {
      this._scheduleAutoEnd(cur, debugWalkMs + 2000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  _processLanding(player) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW always fires first — even if an opponent is on the tile.
    // Uses the labeled-grow range-limited path. Fall through so the poker
    // check below still runs.
    if (space.type === "grow") {
      this._fireGrowAt(player, player.position, "land");
    }

    // Landing on a GHOST: a live lander skims 10% of the ghost's bananas
    // immediately (in place of Monkey Poker), then stops — no poker, no auction.
    // A GHOST lander does nothing here (handled by the !player.ghost guards).
    if (!player.ghost) {
      const ghostsHere = this.players.filter(
        (p) =>
          p.id !== player.id &&
          !p.bankrupt &&
          p.ghost &&
          !p.startPickPending &&
          p.position === player.position &&
          (!this._isTeams() ||
            this.getTeamOf(p.id) !== this.getTeamOf(player.id)),
      );
      if (ghostsHere.length > 0) {
        for (const g of ghostsHere) {
          const take = Math.floor((g.money || 0) * 0.1);
          if (take > 0) {
            g.money -= take;
            player.money += take;
            this._log(
              `👻 ${player.name} landed on ${g.name}'s ghost and skimmed ${take}🍌 (10%)!`,
            );
          }
        }
        return;
      }
    }

    // Check if another monkey is on the same tile — start poker!
    // In team mode, teammates don't trigger poker against each other.
    // Note: players who haven't taken their start pick are off-board.
    // Ghosts are excluded above (landing on a ghost skims 10% instead of poker),
    // and a ghost lander never starts poker.
    // Monkey Poker is a duel: if 2+ opponents are already on this tile, the
    // landing player joins a crowd — no poker fires.
    const opponents = this.players.filter(
      (p) =>
        p.id !== player.id &&
        !p.bankrupt &&
        !p.ghost &&
        !p.startPickPending &&
        p.position === player.position &&
        (!this._isTeams() ||
          this.getTeamOf(p.id) !== this.getTeamOf(player.id)),
    );
    if (!player.ghost && opponents.length === 1 && player.money > 0 && opponents[0].money > 0) {
      this._startPoker(player.id, opponents[0].id);
      return;
    }

    // GROW already handled above
    if (space.type === "grow") return;

    // Reveal non-buyable event tiles to all players immediately
    if (["bus", "tax10"].includes(space.type)) {
      for (const p of this.players) p.revealedTiles.add(player.position);
    }

    if (space.type === "bus") {
      const hasOwned = player.properties.length > 0;
      if (!hasOwned) {
        this._log(
          `${player.name} grabbed the Vine Swing but owns no farms to swing to! 🌿`,
        );
        return;
      }
      this.vineSwing = player.id;
      this._log(
        `${player.name} grabbed the Vine Swing! \ud83e\udea2 Pick any tile to swing to!`,
      );
      return;
    }

    if (space.type === "tax10") {
      const taxAmount = Math.min(Math.floor(player.money * 0.1), player.money);
      player.money -= taxAmount;
      this._log(
        `${player.name} slipped on ${space.name}: ${taxAmount}\ud83c\udf4c (10%).`,
      );
      return;
    }

    const prop = this.properties.get(player.position);
    if (!prop) return;

    // Super Banana: auto-buy and win if player has enough
    if (
      prop.group === "superBanana" &&
      !prop.owner &&
      player.money >= prop.price
    ) {
      player.money -= prop.price;
      prop.owner = player.id;
      player.properties.push(player.position);
      for (const p of this.players) p.revealedTiles.add(player.position);
      // The banana is claimed — no one needs the hideout hint anymore.
      this.superBananaHint = null;

      // Phase 1: "Found the Super Banana!" (4s)
      this.superBananaWin = { phase: "found", playerId: player.id };
      this._log(`\u2b50 ${player.name} found the Super Banana!`);
      if (this.onUpdate) this.onUpdate();

      this._deferredSetTimeout(() => {
        // Phase 2: "Bought it! Became Monkey God!" (3s)
        this.superBananaWin = { phase: "bought", playerId: player.id };
        this._log(
          `\u2b50 ${player.name} bought the Super Banana for ${prop.price}\ud83c\udf4c and became Monkey God! \ud83d\udc51`,
        );
        if (this.onUpdate) this.onUpdate();

        this._deferredSetTimeout(() => {
          // Phase 3: Game over
          this.superBananaWin = null;
          this.state = "finished";
          if (this._isTeams() && this.teams) {
            const teamKey = this.getTeamOf(player.id);
            const teamMembers = teamKey && this.teams[teamKey];
            const names = teamMembers
              ? teamMembers.map((id) => this.players.find((p) => p.id === id)?.name || "?").join(" & ")
              : player.name;
            this._log(
              `\ud83c\udfc6 Team ${teamKey || "?"} (${names}) bought the Super Banana and won! \u2b50\ud83d\udc51`,
            );
            this._log(
              `\u2728 ${names} found the Super Banana, they now have good luck for all eternity! \u2728`,
            );
          } else {
            this._log(
              `\ud83c\udfc6 ${player.name} is the Monkey God! \u2b50\ud83d\udc51`,
            );
            this._log(
              `\u2728 ${player.name} found the Super Banana, ${player.name} now has good luck for all eternity! \u2728`,
            );
          }
          this._revealAllTiles();
          if (this.onUpdate) this.onUpdate();
        }, 3000);
      }, 4000);
      return;
    }

    // Super Banana: can't afford — let the lander choose a hidden tile to hide
    // it under (resolved by pickSuperBananaSwap, or an AFK fallback on the server).
    if (prop.group === "superBanana" && !prop.owner) {
      const superBananaPos = player.position;
      const globalRevealed = new Set();
      for (const p of this.players) {
        for (const t of p.revealedTiles) globalRevealed.add(t);
      }
      const candidates = [];
      for (let i = 0; i < this.boardSize; i++) {
        if (i === superBananaPos) continue;
        if (globalRevealed.has(i)) continue;
        candidates.push(i);
      }
      if (candidates.length > 0) {
        // Reveal super banana to all players temporarily so everyone sees it was
        // found, then wait for the lander to pick where to hide it.
        for (const p of this.players) p.revealedTiles.add(superBananaPos);
        this.superBananaPending = {
          superBananaPos,
          playerId: player.id,
          awaitingPick: true,
        };
        this._log(
          `\u2b50 ${player.name} found the Super Banana but can't afford it! They must hide it on a tile of their choice.`,
        );
      } else {
        // No hidden tiles left - richest player wins
        for (const p of this.players) p.revealedTiles.add(superBananaPos);
        this._log(
          `? ${player.name} can't afford the Super Banana and there's nowhere to hide it!`,
        );
        const activePlayers = this.players.filter((p) => !p.bankrupt);
        const winner = activePlayers.sort((a, b) => b.money - a.money)[0];
        this.state = "finished";
        this.bananaLoser = player.id;
        if (winner) {
          this._log(`?? ${winner.name} is the richest monkey and wins! ???`);
        }
        this._revealAllTiles();
      }
      return;
    }

    if (prop.owner && prop.owner !== player.id) {
      // No rent in this game — just a visit.
      // Reveal the tile to all players so the owner (and any teammate) can
      // see their partner / opponent standing on the farm.
      for (const p of this.players) p.revealedTiles.add(player.position);
    } else if (!prop.owner) {
      // Open an auction, or hand the tile over for free when 0 or 1 players can
      // bid. _createAuctionForLander applies the 0-banana exclusion rule and
      // logs the outcome; the turn auto-end is handled by the caller via its
      // `this.auction` check (an immediate award leaves no auction).
      this.startAuction(player.id);
    }
  }

  // Passive landing — only handles non-interactive effects (tax, rent, grow).
  // Used when a player is pushed onto a tile by an opponent's pet so it
  // doesn't trigger poker, vine swing, auctions, or super banana swaps.
  _processLandingPassive(player, magicUserId = null) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW fires passively
    if (space.type === "grow") {
      this._fireGrowAt(player, player.position, "land");
      return;
    }

    // Reveal non-buyable tiles
    if (["bus", "tax10"].includes(space.type)) {
      for (const p of this.players) p.revealedTiles.add(player.position);
    }

    // Tax effects apply passively
    if (space.type === "tax10") {
      const taxAmount = Math.min(Math.floor(player.money * 0.1), player.money);
      player.money -= taxAmount;
      this._log(
        `${player.name} slipped on ${space.name}: ${taxAmount}\ud83c\udf4c (10%).`,
      );
      return;
    }

    if (space.type === "desert") {
      // Desert pays nothing; a passive push just reveals it.
      for (const p of this.players) p.revealedTiles.add(player.position);
      this._log(
        `${player.name} was pushed into the Desert \ud83c\udf35 \u2014 nothing grows here.`,
      );
      return;
    }

    // Rent applies passively (but no auction/poker/vine/super banana)
    const prop = this.properties.get(player.position);
    if (!prop) return;
    // No rent in this game

    // Magic auction: pushed onto unowned tile
    if (!prop.owner && magicUserId && player.money > 0) {
      this._startDevilAuction(player, magicUserId);
    }
  }

  // The broke lander chooses which hidden tile to hide the Super Banana under.
  // Only that player may pick, and only a tile nobody has revealed yet (and not
  // the Super Banana's own tile) is a valid hideout.
  pickSuperBananaSwap(socketId, position) {
    const mp = this.superBananaPending;
    if (!mp || !mp.awaitingPick) return false;
    if (mp.playerId !== socketId) return false;
    const pos = Math.floor(position);
    if (!Number.isInteger(pos) || pos < 0 || pos >= this.boardSize) return false;
    if (pos === mp.superBananaPos) return false;
    // Must be a genuinely hidden tile (not revealed by anyone).
    for (const p of this.players) {
      if (p.revealedTiles.has(pos)) return false;
    }
    mp.swapPos = pos;
    mp.awaitingPick = false;
    return this.completeSuperBananaSwap();
  }

  // AFK fallback: if the lander never picks, hide the Super Banana on a random
  // hidden tile so the turn can proceed. Picks a hideout only if one isn't set.
  forceSuperBananaSwap() {
    const mp = this.superBananaPending;
    if (!mp) return false;
    if (mp.swapPos == null) {
      const globalRevealed = new Set();
      for (const p of this.players) {
        for (const t of p.revealedTiles) globalRevealed.add(t);
      }
      const candidates = [];
      for (let i = 0; i < this.boardSize; i++) {
        if (i === mp.superBananaPos) continue;
        if (globalRevealed.has(i)) continue;
        candidates.push(i);
      }
      if (candidates.length === 0) {
        this.superBananaPending = null;
        return false;
      }
      mp.swapPos = candidates[Math.floor(Math.random() * candidates.length)];
    }
    mp.awaitingPick = false;
    return this.completeSuperBananaSwap();
  }

  completeSuperBananaSwap() {
    if (!this.superBananaPending) return false;
    // Needs a chosen hideout (set by pickSuperBananaSwap / forceSuperBananaSwap).
    if (this.superBananaPending.swapPos == null) return false;
    const { superBananaPos, swapPos, playerId } = this.superBananaPending;
    this.superBananaPending = null;
    const player = this.players.find((p) => p.id === playerId);

    // Remember where this player hid the Super Banana so we can show them a
    // private rainbow cover on that tile (cleared below if it ends up public).
    this.superBananaHint = { pos: swapPos, playerId };

    // Swap board entries
    const tmpBoard = this.board[superBananaPos];
    this.board[superBananaPos] = this.board[swapPos];
    this.board[swapPos] = tmpBoard;

    // Swap tile label numbers so labels follow their tiles
    if (this.tileLabelNumbers) {
      const mushLabel = this.tileLabelNumbers.get(superBananaPos);
      const swapLabel = this.tileLabelNumbers.get(swapPos);
      this.tileLabelNumbers.delete(superBananaPos);
      this.tileLabelNumbers.delete(swapPos);
      if (mushLabel !== undefined) this.tileLabelNumbers.set(swapPos, mushLabel);
      if (swapLabel !== undefined) this.tileLabelNumbers.set(superBananaPos, swapLabel);
    }

    // grow labels must follow their tiles too. The Super Banana can
    // swap with a hidden GROW tile; if growTileLabels isn't moved, the relocated
    // grow tile loses its "G N" label and falls back to its raw "GROW N" name.
    if (this.growTileLabels) {
      const mushGrow = this.growTileLabels.get(superBananaPos);
      const swapGrow = this.growTileLabels.get(swapPos);
      this.growTileLabels.delete(superBananaPos);
      this.growTileLabels.delete(swapPos);
      if (mushGrow !== undefined) this.growTileLabels.set(swapPos, mushGrow);
      if (swapGrow !== undefined) this.growTileLabels.set(superBananaPos, swapGrow);
    }

    // Swap properties entries (preserving owner/bananaPile state)
    const superBananaProp = this.properties.get(superBananaPos);
    const swapProp = this.properties.get(swapPos);
    this.properties.delete(superBananaPos);
    this.properties.delete(swapPos);
    if (superBananaProp) this.properties.set(swapPos, superBananaProp);
    if (swapProp) this.properties.set(superBananaPos, swapProp);

    // Update any player property lists that reference the swapped positions
    for (const p of this.players) {
      p.properties = p.properties.map((pos) => {
        if (pos === superBananaPos) return swapPos;
        if (pos === swapPos) return superBananaPos;
        return pos;
      });
    }

    // Reveal the swapped-in tile to every player. The Super Banana vacated
    // superBananaPos and a different tile took its place — that tile should be
    // permanently visible so grow / free-bananas / tax tiles don't end up
    // silently hidden after the swap (buyable swap-ins were already revealed
    // via the auction / broke-claim branches below, but those cover only the
    // property tiles).
    for (const p of this.players) p.revealedTiles.add(superBananaPos);

    this._log(
      `\u2b50 The Super Banana vanished and hid somewhere else on the board...`,
    );

    // After swap, check if there are any hidden tiles left besides the banana's new position
    const postSwapRevealed = new Set();
    for (const p of this.players) {
      for (const t of p.revealedTiles) postSwapRevealed.add(t);
    }
    let hiddenRemaining = 0;
    for (let i = 0; i < this.boardSize; i++) {
      if (i === swapPos) continue; // exclude the banana's new position
      if (!postSwapRevealed.has(i)) hiddenRemaining++;
    }
    if (hiddenRemaining === 0) {
      // No more hidden tiles � reveal the Super Banana at its new location
      for (const p of this.players) p.revealedTiles.add(swapPos);
      // It's public now, so the private rainbow hint is no longer needed.
      this.superBananaHint = null;
      this._log(
        `\u2b50 There's nowhere left to hide! The Super Banana is revealed! \ud83c\udf4c`,
      );
    }

    // Auction the tile that swapped into this position (if buyable & unowned)
    const newProp = this.properties.get(superBananaPos);
    const newSpace = this.board[superBananaPos];
    if (newProp && !newProp.owner && player) {
      // Open an auction for the swapped-in tile (or award it for free when 0 or
      // 1 players can bid). Honors the 0-banana exclusion rule; auto-end fires
      // here when the award is immediate (no auction opened).
      this.startAuction(player.id);
      if (!this.auction) this._scheduleAutoEnd(player, 1000);
    } else {
      // Apply peel tax if the swapped-in tile is a tax tile
      if (player && newSpace && newSpace.type === "tax10") {
        const taxAmount = Math.min(
          Math.floor(player.money * 0.1),
          player.money,
        );
        player.money -= taxAmount;
        this._log(
          `${player.name} slipped on ${newSpace.name}: ${taxAmount}\ud83c\udf4c (10%).`,
        );
      }
      // Non-buyable tile swapped in, or player left � schedule auto-end
      if (player) {
        this._scheduleAutoEnd(player, 1000);
      }
    }
    return true;
  }

  // -- Auction System ---------------------------------------------

  _startDevilAuction(pushedPlayer, magicUserId) {
    const pos = pushedPlayer.position;
    const prop = this.properties.get(pos);
    if (!prop || prop.owner) return;

    // 0-banana players are excluded from the auction. The pushed player always
    // has money (the caller guards money > 0), so they remain the pitcher.
    const bidders = [];
    bidders.push(pushedPlayer.id);
    for (const p of this.players) {
      if (!p.bankrupt && p.id !== pushedPlayer.id && p.money > 0)
        bidders.push(p.id);
    }

    const bids = {};
    for (const id of bidders)
      bids[id] = { amount: 0, placed: false, passed: false };

    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: pushedPlayer.id,
      magicUser: magicUserId,
      bidders,
      bids,
      phase: "pitch",
      highBid: 0,
      highBidder: null,
    };

    this._log(
      `\ud83d\udd2e Magic auction! ${pushedPlayer.name} was pushed onto an unowned farm! Name your price!`,
    );

    // Auto-list at 0 if lander is broke
    if (pushedPlayer.money === 0) {
      const lb = this.auction.bids[pushedPlayer.id];
      lb.amount = 0;
      lb.placed = true;
      lb.bidTime = Date.now();
      this._log(
        `${pushedPlayer.name} has 0\ud83c\udf4c \u2014 auto-listed for free!`,
      );
      this._checkPhaseComplete();
    }
  }

  startAuction(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || this.auction) return false;
    if (!this.canAuction(socketId)) return false;
    return this._createAuctionForLander(socketId);
  }

  // The Buy Now price the lander can pay to instantly win a pitch auction:
  // one more than the richest opponent (the most anyone else could ever bid),
  // so it guarantees the buy. Only offered to a lander who is strictly the
  // richest player (so they can afford it). Returns null when unavailable.
  _buyNowPrice(socketId) {
    const a = this.auction;
    if (!a || a.phase !== "pitch") return null;
    if (socketId !== a.landingPlayer) return null;
    const lander = this.players.find((p) => p.id === socketId);
    if (!lander || lander.bankrupt) return null;
    const opponents = this.players.filter(
      (p) => !p.bankrupt && p.id !== socketId,
    );
    if (opponents.length === 0) return null;
    const maxOpp = Math.max(...opponents.map((p) => p.money));
    // Must be STRICTLY the richest, otherwise second-highest + 1 is unaffordable.
    if (lander.money <= maxOpp) return null;
    return maxOpp + 1;
  }

  // Lander instantly buys the farm for second-highest banana score + 1,
  // skipping the auction. Only valid for the richest lander in the pitch phase.
  auctionBuyNow(socketId) {
    const a = this.auction;
    const price = this._buyNowPrice(socketId);
    if (price == null) return false;
    const lander = this.players.find((p) => p.id === socketId);
    if (!lander || lander.money < price) return false;
    if (this._auctionTimer) {
      clearTimeout(this._auctionTimer);
      this._auctionTimer = null;
    }
    a.highBidder = lander.id;
    a.highBid = price;
    a.buyNow = true;
    this._log(
      `💰 ${lander.name} used Buy Now — out-bidding everyone at ${price}🍌!`,
    );
    this._resolveAuction();
    return true;
  }

  // Create an auction for an arbitrary lander (not necessarily the current
  // player). Used by the shuffle-on-leave flow when a tile shifts under a
  // sitting player and must be put up for bid by them. Caller is responsible
  // for guarding when this should fire \u2014 this method only checks that the
  // lander exists, the tile is buyable + unowned, and no auction is already
  // running.
  // Players with 0 bananas are excluded from every auction. Returns the ids of
  // players who can still take part (not bankrupt, money > 0).
  _eligibleBidderIds() {
    // Ghosts never bid in auctions — they only ever price their OWN found tiles
    // at 0 (handled in _createAuctionForLander), and always "reject" otherwise.
    return this.players
      .filter((p) => !p.bankrupt && p.money > 0 && !p.ghost)
      .map((p) => p.id);
  }

  // Among the given ids, the one earliest in seating order \u2014 used as the
  // deterministic tie-break winner for sealed bids (which have no leader to
  // fall back to).
  _earliestByTurnOrder(ids) {
    for (const p of this.players) {
      if (ids.includes(p.id)) return p.id;
    }
    return ids[0];
  }

  // Hand an unowned tile to a player for free (no bidding). Used when 0 or 1
  // players are eligible to bid.
  _awardUnownedFree(prop, pos, winner, logMsg) {
    prop.owner = winner.id;
    winner.properties.push(pos);
    for (const p of this.players) p.revealedTiles.add(pos);
    this._log(logMsg);
  }

  // Decide what happens to an unowned tile the lander stopped on, honoring the
  // 0-banana exclusion rule:
  //   - 0 eligible  -> lander takes it free (everyone is broke)
  //   - 1 eligible  -> that player takes it free (no one to bid against)
  //   - 2+ eligible -> auction: a normal pitch if the lander can pay, or a
  //                    sealed bid among the eligible if the lander is broke.
  // Returns true if an auction was opened, false if the tile was awarded now.
  _createAuctionForLander(landerId) {
    if (this.auction) return false;
    const lander = this.players.find((p) => p && p.id === landerId);
    if (!lander || lander.bankrupt) return false;
    const pos = lander.position;
    const prop = this.properties.get(pos);
    if (!prop || prop.owner) return false;

    const eligibleIds = this._eligibleBidderIds();

    // Ghost lander: a ghost prices any tile it finds at 0, so the OTHER eligible
    // (non-ghost) players sealed-bid for it. One eligible \u2192 free to them; none
    // \u2192 the tile is just revealed and left unowned (nobody can pay).
    if (lander.ghost) {
      const others = eligibleIds.filter((id) => id !== landerId);
      if (others.length === 0) {
        for (const p of this.players) p.revealedTiles.add(pos);
        this._log(`\ud83d\udc7b ${lander.name}'s ghost found ${prop.name} \u2014 nobody can afford it, it stays wild.`);
        return false;
      }
      if (others.length === 1) {
        const w = this.players.find((p) => p.id === others[0]);
        this._awardUnownedFree(
          prop, pos, w,
          `\ud83d\udc7b ${lander.name}'s ghost found ${prop.name} and ${w.name} grabbed it for free! \ud83d\udc4d`,
        );
        return false;
      }
      this._startSealedAuction(prop, pos, others);
      this._log(`\ud83d\udc7b ${lander.name}'s ghost found ${prop.name} \u2014 everyone bids, highest wins!`);
      return true;
    }

    if (eligibleIds.length === 0) {
      this._awardUnownedFree(
        prop,
        pos,
        lander,
        `Everyone is broke! ${lander.name} claimed ${prop.name} for free! \ud83c\udf4c`,
      );
      return false;
    }
    if (eligibleIds.length === 1) {
      const w = this.players.find((p) => p.id === eligibleIds[0]);
      const msg =
        w.id === lander.id
          ? `All opponents are broke! ${w.name} claimed ${prop.name} for free! \ud83c\udf4c`
          : `${lander.name} is broke! ${w.name} claimed ${prop.name} for free! \ud83d\udc4d`;
      this._awardUnownedFree(prop, pos, w, msg);
      return false;
    }

    if (lander.money > 0) {
      this._startPitchAuction(prop, pos, lander.id, eligibleIds);
    } else {
      this._startSealedAuction(prop, pos, eligibleIds);
    }
    return true;
  }

  // Normal "name your price" auction: the lander pitches, the other eligible
  // players accept/reject. Broke players are already filtered out of bidderIds.
  _startPitchAuction(prop, pos, landerId, bidderIds) {
    const bidders = [landerId, ...bidderIds.filter((id) => id !== landerId)];
    const bids = {};
    for (const id of bidders)
      bids[id] = { amount: 0, placed: false, passed: false };
    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: landerId,
      bidders,
      bids,
      phase: "pitch",
      highBid: 0,
      highBidder: null,
    };
    this._log(`\ud83c\udf4c Banana bid! Lander, name your price.`);
  }

  // Sealed bid: the lander is broke (can't price it), so every eligible player
  // secretly names a price and the highest wins. Reuses the silent-bid phase
  // with a base price of 0 and no leader.
  _startSealedAuction(prop, pos, bidderIds) {
    const bids = {};
    for (const id of bidderIds) {
      bids[id] = {
        amount: 0,
        placed: false,
        passed: false,
        accepted: true,
        responded: true,
        topup: null,
        submittedTopup: false,
      };
    }
    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: null,
      sealedBid: true,
      bidders: [...bidderIds],
      bids,
      phase: "silentbid",
      acceptorIds: [...bidderIds],
      landerOpenBid: 0,
      highBid: 0,
      highBidder: null,
    };
    this._log(
      `\ud83c\udf4c Sealed banana bid! The lander is broke \u2014 everyone bids, highest wins.`,
    );
    if (this.noAuctionTimer) {
      this.auction.silentDeadline = null;
      this.auction.silentStartTime = null;
    } else {
      this.auction.silentDeadline = Date.now() + this.farmAuctionTimer * 1000;
      this.auction.silentStartTime = Date.now();
      if (this._auctionTimer) clearTimeout(this._auctionTimer);
      this._auctionTimer = setTimeout(() => {
        this._auctionTimer = null;
        if (!this.auction || this.auction.phase !== "silentbid") return;
        this._resolveSilentBid();
        if (this.onUpdate) this.onUpdate();
      }, this.farmAuctionTimer * 1000);
    }
  }

  _checkPhaseComplete() {
    const a = this.auction;
    if (!a) return;

    // -- Pitch phase: Lander names a price --
    if (a.phase === "pitch") {
      const lb = a.bids[a.landingPlayer];
      if (!lb.placed) return;

      a.landerOpenBid = lb.amount;
      a.highBid = lb.amount;
      a.highBidder = a.landingPlayer;

      // Filter out players who can't afford the pitched price
      const cantAffordIds = a.bidders.filter((id) => {
        if (id === a.landingPlayer) return false;
        const p = this.players.find((pl) => pl.id === id);
        return !p || p.money < lb.amount;
      });
      if (cantAffordIds.length > 0) {
        const names = cantAffordIds
          .map((id) => this.players.find((p) => p.id === id)?.name || "?")
          .join(", ");
        this._log(
          `${names} can't afford ${lb.amount}\ud83c\udf4c \u2014 excluded from the auction.`,
        );
        a.bidders = a.bidders.filter((id) => !cantAffordIds.includes(id));
        for (const id of cantAffordIds) delete a.bids[id];
      }

      const others = a.bidders.filter((id) => id !== a.landingPlayer);

      if (others.length === 0) {
        // No one else can afford it — lander buys automatically
        this._log(`No one else can afford it \u2014 lander buys the farm!`);
        this._resolveAuction();
        return;
      }

      // Move to respond phase — start 10s timer
      for (const id of others) {
        a.bids[id].accepted = null;
        a.bids[id].responded = false;
        a.bids[id].topup = null;
        a.bids[id].submittedTopup = false;
      }
      a.phase = "respond";
      if (this.noAuctionTimer) {
        a.respondDeadline = null;
        a.respondStartTime = null;
        this._log(
          `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 accept or reject!`,
        );
      } else {
        a.respondDeadline = Date.now() + this.farmAuctionTimer * 1000;
        a.respondStartTime = Date.now();
        this._log(
          `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 ${this.farmAuctionTimer} seconds to decide!`,
        );
      }

      // Start the configurable bid timer — when it expires, lander buys (unless noTimer is on)
      if (this._auctionTimer) clearTimeout(this._auctionTimer);
      if (!this.noAuctionTimer) {
        this._auctionTimer = setTimeout(() => {
          this._auctionTimer = null;
          if (!this.auction || this.auction.phase !== "respond") return;
          // Timer expired — lander buys
          this._log(`\u23f0 Time's up!`);
          this._closeRespondPhase();
          if (this.onUpdate) this.onUpdate();
        }, this.farmAuctionTimer * 1000);
      }
      return;
    }

    // -- Respond phase: any number may accept; resolve only once everyone has
    // responded (the deadline timer treats stragglers as rejects). --
    if (a.phase === "respond") {
      const others = a.bidders.filter((id) => id !== a.landingPlayer);
      const allResponded = others.every(
        (id) => a.bids[id] && a.bids[id].responded,
      );
      if (allResponded) this._closeRespondPhase();
      return;
    }

    // -- Silent-bid phase: resolve once every acceptor submitted a top-up. --
    if (a.phase === "silentbid") {
      const allIn = (a.acceptorIds || []).every(
        (id) => a.bids[id] && a.bids[id].submittedTopup,
      );
      if (allIn) this._resolveSilentBid();
      return;
    }

  }

  // Close the accept/reject window and decide what happens next:
  //   0 acceptors  -> lander keeps it at the listed price
  //   1 acceptor   -> that player buys at the listed price
  //   2+ acceptors -> silent top-up tie-breaker
  _closeRespondPhase() {
    const a = this.auction;
    if (!a) return;
    if (this._auctionTimer) {
      clearTimeout(this._auctionTimer);
      this._auctionTimer = null;
    }
    const others = a.bidders.filter((id) => id !== a.landingPlayer);
    const acceptors = others.filter(
      (id) => a.bids[id] && a.bids[id].accepted === true,
    );

    if (acceptors.length === 0) {
      a.highBidder = a.landingPlayer;
      a.highBid = a.landerOpenBid;
      this._log(`No takers — lander keeps the farm for ${a.landerOpenBid}🍌!`);
      this._resolveAuction();
      return;
    }
    if (acceptors.length === 1) {
      a.highBidder = acceptors[0];
      a.highBid = a.landerOpenBid;
      this._resolveAuction();
      return;
    }

    // 2+ acceptors — silent tie-breaker on top of the listed price.
    a.phase = "silentbid";
    a.acceptorIds = acceptors;
    for (const id of acceptors) {
      const p = this.players.find((pl) => pl.id === id);
      const maxTopup = Math.max(0, (p ? p.money : 0) - a.landerOpenBid);
      if (maxTopup <= 0) {
        a.bids[id].topup = 0;
        a.bids[id].submittedTopup = true;
      } else {
        a.bids[id].topup = null;
        a.bids[id].submittedTopup = false;
      }
    }
    if (this.noAuctionTimer) {
      a.silentDeadline = null;
      a.silentStartTime = null;
      this._log(
        `Multiple takers — silent tie-breaker! Bid extra on top of ${a.landerOpenBid}🍌.`,
      );
    } else {
      a.silentDeadline = Date.now() + this.farmAuctionTimer * 1000;
      a.silentStartTime = Date.now();
      this._log(
        `Multiple takers — silent tie-breaker! ${this.farmAuctionTimer}s to bid on top of ${a.landerOpenBid}🍌.`,
      );
    }
    // Everyone may already be auto-submitted (too poor to add anything).
    if (a.acceptorIds.every((id) => a.bids[id].submittedTopup)) {
      this._resolveSilentBid();
      return;
    }
    if (this._auctionTimer) clearTimeout(this._auctionTimer);
    if (!this.noAuctionTimer) {
      this._auctionTimer = setTimeout(() => {
        this._auctionTimer = null;
        if (!this.auction || this.auction.phase !== "silentbid") return;
        this._resolveSilentBid();
        if (this.onUpdate) this.onUpdate();
      }, this.farmAuctionTimer * 1000);
    }
  }

  // Highest top-up wins (pays listed + top-up). A tie at the very top sends the
  // property to the lander for the listed price.
  _resolveSilentBid() {
    const a = this.auction;
    if (!a) return;
    if (this._auctionTimer) {
      clearTimeout(this._auctionTimer);
      this._auctionTimer = null;
    }
    const acceptors = a.acceptorIds || [];
    for (const id of acceptors) {
      if (a.bids[id] && !a.bids[id].submittedTopup) {
        a.bids[id].topup = 0;
        a.bids[id].submittedTopup = true;
      }
    }
    let maxTopup = -1;
    for (const id of acceptors) {
      const t = (a.bids[id] && a.bids[id].topup) || 0;
      if (t > maxTopup) maxTopup = t;
    }
    const top = acceptors.filter(
      (id) => ((a.bids[id] && a.bids[id].topup) || 0) === maxTopup,
    );
    if (top.length === 1) {
      a.highBidder = top[0];
      a.highBid = a.landerOpenBid + maxTopup;
    } else if (a.sealedBid) {
      // Sealed bid has no leader to fall back to — earliest tied bidder wins
      // at their bid.
      a.highBidder = this._earliestByTurnOrder(top);
      a.highBid = a.landerOpenBid + maxTopup;
      a.silentTie = true;
    } else {
      // Tie at the top — lander gets it at the listed price.
      a.highBidder = a.landingPlayer;
      a.highBid = a.landerOpenBid;
      a.silentTie = true;
    }
    this._resolveAuction();
  }

  _resolveAuction() {
    const a = this.auction;
    const prop = this.properties.get(a.position);
    this.petCoinFlip = null;

    if (a.highBidder) {
      const winner = this.players.find((p) => p.id === a.highBidder);
      if (winner && prop) {
        let finalPrice = a.highBid;
        winner.money -= finalPrice;
        prop.owner = winner.id;
        winner.properties.push(a.position);
        for (const p of this.players) p.revealedTiles.add(a.position);
        const typeLabel = prop.group === "desert" ? "desert" : "farm";
        this._log(
          `\ud83d\udd28 ${winner.name} bought the ${typeLabel} ${prop.name} for ${finalPrice}\ud83c\udf4c!`,
        );
        // Super Banana win condition
        if (prop.group === "superBanana") {
          this.state = "finished";
          if (this._isTeams() && this.teams) {
            const teamKey = this.getTeamOf(winner.id);
            const teamMembers = teamKey && this.teams[teamKey];
            const names = teamMembers
              ? teamMembers.map((id) => this.players.find((p) => p.id === id)?.name || "?").join(" & ")
              : winner.name;
            this._log(
              `\ud83c\udfc6 Team ${teamKey || "?"} (${names}) bought the Super Banana and won! \u2b50\ud83d\udc51`,
            );
            this._log(
              `\u2728 ${names} found the Super Banana, they now have good luck for all eternity! \u2728`,
            );
          } else {
            this._log(
              `\ud83c\udfc6 ${winner.name} bought the Super Banana and is the Banana King! \u2b50\ud83d\udc51`,
            );
            this._log(
              `\u2728 ${winner.name} found the Super Banana, ${winner.name} now has good luck for all eternity! \u2728`,
            );
          }
          this._revealAllTiles();
        }
      }
    } else {
      this._log(
        `\ud83d\udca8 No bids \u2014 Farm #${a.position} remains unclaimed.`,
      );
    }

    if (this._auctionTimer) {
      clearTimeout(this._auctionTimer);
      this._auctionTimer = null;
    }
    // Snapshot the resolved auction so every viewer (including non-landers who
    // bid blind) can fire the BOUGHT/MISSED card flip with the correct farm.
    // The frontend keys on resolvedAt to fire once; we clear the snapshot a
    // few seconds later so a refresh/reconnect doesn't replay an old card.
    if (this._lastResolvedAuctionTimer) {
      clearTimeout(this._lastResolvedAuctionTimer);
      this._lastResolvedAuctionTimer = null;
    }
    this.lastResolvedAuction = {
      position: a.position,
      propName: a.propName,
      propPrice: a.propPrice,
      propGroup: a.propGroup || null,
      winnerId: a.highBidder || null,
      participantIds: Object.keys(a.bids || {}),
      resolvedAt: Date.now(),
    };
    this._lastResolvedAuctionTimer = setTimeout(() => {
      this._lastResolvedAuctionTimer = null;
      this.lastResolvedAuction = null;
      if (this.onUpdate) this.onUpdate();
    }, 10000);
    const turnPlayer = this.getCurrentPlayer();
    this.auction = null;
    if (turnPlayer) {
      this._scheduleAutoEnd(turnPlayer, 2000);
    }
  }

  placeBid(socketId, amount) {
    if (!this.auction) return false;
    const a = this.auction;
    if (a.phase !== "pitch") return false; // only lander pitches
    if (socketId !== a.landingPlayer) return false;
    const b = a.bids[socketId];
    if (!b || b.placed || b.passed) return false;

    const player = this.players.find((p) => p.id === socketId);
    amount = Math.floor(amount);
    if (!player || amount > player.money || amount < 0) return false;

    // Cap at richest opponent's money so lander can't name an impossible price
    const others = this.players.filter(
      (p) => p.id !== socketId && !p.bankrupt,
    );
    if (others.length > 0) {
      const maxOtherMoney = Math.max(...others.map((p) => p.money));
      if (player.money >= maxOtherMoney && amount > maxOtherMoney) {
        return false;
      }
    }

    // Minimum bid is 1 banana; 0 only allowed when lander is broke
    if (amount < 1 && player.money !== 0) return false;

    b.amount = amount;
    b.placed = true;
    b.bidTime = Date.now();
    this._log(`${player.name} set the price for Farm #${a.position}.`);

    this._checkPhaseComplete();
    return true;
  }

  passBid(socketId) {
    // No passing in the new auction system — use respondAuction to reject
    return false;
  }

  respondAuction(socketId, accept) {
    if (!this.auction) return false;
    const a = this.auction;
    if (a.phase !== "respond") return false;
    if (socketId === a.landingPlayer) return false;
    const b = a.bids[socketId];
    if (!b || b.responded) return false;

    // In teams mode, the lander's teammate must wait 5 seconds before accepting
    if (accept && this._isTeams() && this.teams && a.respondStartTime) {
      const landerTeam = this.getTeamOf(a.landingPlayer);
      const responderTeam = this.getTeamOf(socketId);
      if (landerTeam && landerTeam === responderTeam) {
        const elapsed = Date.now() - a.respondStartTime;
        if (elapsed < 5000) {
          return false; // too early — teammate must wait
        }
      }
    }

    // Accept/reject is recorded privately (no log entry) so nobody can infer
    // who is in or out during the window.
    b.accepted = !!accept;
    b.responded = true;
    this._checkPhaseComplete();
    return true;
  }

  // Submit the silent top-up (amount on top of the listed price) during a
  // tie-breaker. Only the players who accepted participate.
  submitSilentBid(socketId, amount) {
    const a = this.auction;
    if (!a || a.phase !== "silentbid") return false;
    if (!a.acceptorIds || !a.acceptorIds.includes(socketId)) return false;
    const b = a.bids[socketId];
    if (!b || b.submittedTopup) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    let n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) n = 0;
    const maxTopup = Math.max(0, (player.money || 0) - a.landerOpenBid);
    b.topup = Math.min(n, maxTopup);
    b.submittedTopup = true;
    this._checkPhaseComplete();
    return true;
  }

  vineSwingMove(socketId, position) {
    if (!this.vineSwing || this.vineSwing !== socketId) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    if (position < 0 || position >= this.boardSize) return false;

    // Can only swing to a property the player owns
    const prop = this.properties.get(position);
    if (!prop || prop.owner !== socketId) return false;

    this.vineSwing = null;
    // Clear any lingering grow-squatter-steal state from this turn so the
    // frontend doesn't re-trigger the steal animation on the vine landing.
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    player.position = position;
    player.revealedTiles.add(position);
    // Reveal the vine-swing destination to all players
    for (const p of this.players) p.revealedTiles.add(position);
    this._log(`${player.name} swung to tile ${position}! \ud83e\udea2`);

    // Vine Swing is a teleport — only steal/collect at landing tile, no crossing
    this._collectBananasAtTile(player, position);

    this._processLanding(player);

    if (!this.auction && !this.vineSwing && !this.poker) {
      this._scheduleAutoEnd(player, 1000);
    }
    return true;
  }

  // Note: a player's first turn is picking any tile to start on.
  // The chosen tile is treated like a normal landing (auction if a farm, etc).
  pickStartTile(socketId, position) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (!cur.startPickPending) return false;
    if (this.auction || this.poker || this.vineSwing || this.superBananaPending)
      return false;
    if (typeof position !== "number" || position < 0 || position >= this.boardSize)
      return false;
    // First-turn picks can't share a tile with a player who's already on the board.
    const occupied = this.players.some(
      (p) =>
        p.id !== cur.id &&
        !p.bankrupt &&
        !p.startPickPending &&
        p.position === position,
    );
    if (occupied) return false;

    cur.startPickPending = false;
    cur.position = position;
    cur.revealedTiles.add(position);
    cur.hasRolled = true;
    this.diceRolled = true;
    // Signal to the frontend that this move is a teleport (no walk animation).
    this.lastStartPick = { playerId: cur.id, position, turn: this.turn };
    this._log(`${cur.name} chose to start on tile ${position}! 🐒`);

    // Treat the chosen tile as a landing — same flow as a regular roll.
    this._processLanding(cur);

    if (!this.auction && !this.vineSwing && !this.poker && !this.superBananaPending) {
      this._scheduleAutoEnd(cur, 1000);
    }
    return true;
  }

  // -- Grow Helpers -----------------------------------

  // Assign random 1..6 labels to the 6 grow tiles and rewrite each tile's
  // display name to "GROW N". Called once at game start (after shuffle).
  _assignGrowLabels() {
    const growPositions = [];
    for (let i = 0; i < this.board.length; i++) {
      if (this.board[i].type === "grow") growPositions.push(i);
    }
    const labels = growPositions.map((_, idx) => idx + 1);
    for (let i = labels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    this.growTileLabels = new Map();
    for (let i = 0; i < growPositions.length; i++) {
      const pos = growPositions[i];
      const label = labels[i];
      this.growTileLabels.set(pos, label);
      this.board[pos].name = `🌴 GROW ${label}`;
    }
  }

  _findGrowByLabel(label) {
    if (!this.growTileLabels) return null;
    for (const [pos, lbl] of this.growTileLabels) {
      if (lbl === label) return pos;
    }
    return null;
  }

  // A board position is "revealed" if at least one player has it in
  // revealedTiles (via landing/movement). Grow reveals broadcast to every
  // player, so this is effectively global. Used for grow ranges, rolled-grow
  // firing, and the Owned-Farms chart.
  _isGenuinelyRevealed(pos) {
    for (const p of this.players) {
      if (p.revealedTiles && p.revealedTiles.has(pos)) return true;
    }
    return false;
  }

  // The set of all board positions revealed by any player.
  _globalGenuineRevealed() {
    const set = new Set();
    for (const p of this.players) {
      if (!p.revealedTiles) continue;
      for (const pos of p.revealedTiles) set.add(pos);
    }
    return set;
  }

  // Grow-tile positions that are revealed by any player. The Owned-Farms chart
  // groups farms by the nearest such grow.
  _genuineRevealedGrowPositions() {
    const out = [];
    if (!this.growTileLabels) return out;
    for (const pos of this.growTileLabels.keys()) {
      if (this._isGenuinelyRevealed(pos)) out.push(pos);
    }
    return out;
  }

  // Set of board positions a grow at `growPos` can fertilise. The chain of
  // light walks step-by-step CLOCKWISE from growPos+1 until it hits the next
  // genuinely-revealed grow tile (which acts as a wall). If no other grow is
  // revealed yet, the chain wraps almost all the way around the board —
  // stopping just before growPos itself so the firing tile is excluded.
  //
  // Mirrors the frontend `_growRangePath` in frontend/game.js — they MUST stay
  // in sync, otherwise the visual chain pulse and the actual banana growth
  // disagree (the source of the "all farms grow but only some pulse" and
  // "last farm in chain didn't grow" bugs).
  _growRange(growPos) {
    const otherRevealedGrows = new Set();
    if (this.growTileLabels) {
      for (const pos of this.growTileLabels.keys()) {
        if (pos === growPos) continue;
        if (this._isGenuinelyRevealed(pos)) otherRevealedGrows.add(pos);
      }
    }
    const range = new Set();
    for (let off = 1; off < this.boardSize; off++) {
      const p = (growPos + off) % this.boardSize;
      if (otherRevealedGrows.has(p)) break;
      range.add(p);
    }
    return range;
  }

  // Fire a grow effect on a specific grow-tile position at 100%. Applies the
  // "between revealed grows" range, sends bananas to opponent squatters,
  // logs results. Logs are tagged (`source: "roll" | "land"`) so messages
  // read sensibly.
  _fireGrowAt(player, growPos, source) {
    // The glow is recorded at the END of this method, and ONLY if the grow
    // actually produced bananas — see lastGrowFired below. Firing on an empty
    // range (no farms in range) grows nothing and must not glow.
    // Landing on a grow reveals it to everyone for the run. A roll never reveals
    // a hidden grow: by the time a roll reaches here the tile is already revealed
    // (see the dormant check in _processRolledGrow).
    if (source === "land") {
      for (const p of this.players) {
        p.revealedTiles.add(growPos);
      }
    }

    // Record EVERY fire (even one that grows nothing) so the frontend can play
    // the grow-pulse animation for it — empty fires just pulse quickly. Tagged
    // with the source so the frontend knows whether it fired pre-move (roll /
    // magic dice → pulse before the walk) or on arrival (land).
    this.lastGrowActivated = (this.lastGrowActivated || []).concat([
      { pos: growPos, source },
    ]);

    // Whole-board fertilise: every owned farm grows on every grow fire. The
    // earlier "next revealed grow bounds the range" rule made the firing
    // player's range collapse as soon as anyone discovered a second grow,
    // which the user reported as grows "cutting short". The range is now
    // always the entire board minus the grow tile itself.
    //
    // Use the canonical properties map (keyed by owner) rather than the
    // player's `properties` array. Otherwise any subtle desync between
    // `prop.owner` and `player.properties` (e.g. a recently-bought farm
    // that ended up owned but not in the list) silently drops the farm
    // from the chain — the user-reported symptom was the LAST-bought farm
    // sometimes not growing even though it should have.
    const range = this._growRange(growPos);
    const ownedInRange = [];
    for (const [propId, prop] of this.properties) {
      if (!prop || prop.owner !== player.id) continue;
      if (!range.has(propId)) continue;
      if (prop.group !== "farm") continue;
      ownedInRange.push(propId);
    }

    const label =
      this.growTileLabels && this.growTileLabels.has(growPos)
        ? this.growTileLabels.get(growPos)
        : "?";

    let totalGrown = 0;
    let totalEarlyPicked = 0;
    let earlyPickupTile = null;
    // Every owned farm that grew (or was stolen from) this fire, plus the fresh
    // amount per non-stolen tile. These feed the dice-match animation pipeline
    // (see below) so the frontend pops the piles in and collects them along
    // the walk.
    const grownTiles = [];
    const grownAmounts = {};
    for (const propId of ownedInRange) {
      const prop = this.properties.get(propId);
      const amount = prop.price; // = 100%
      if (amount <= 0) continue;
      grownTiles.push(propId);

      // Early pickup: if the owner is standing on their own farm when it
      // grows, they pocket the bananas immediately instead of leaving a pile to
      // loop back around for. Sweeps the whole tile — the fresh growth plus any
      // pile already sitting there — and takes priority over any opponent
      // squatting on the tile.
      if (player.position === propId && !player.startPickPending) {
        const pickup = amount + (prop.bananaPile || 0);
        prop.bananaPile = 0;
        player.money += pickup;
        totalEarlyPicked += pickup;
        earlyPickupTile = propId;
        grownAmounts[propId] = amount; // fresh growth (pre-existing handled by walk collection)
        continue;
      }

      // Squat / quick-steal rule: grown bananas always land in the farm's
      // pile — a squatter does NOT grab them the instant they sprout.
      // Whoever reaches the pile first collects it: the owner by
      // crossing/landing on the farm (so they can reclaim a grow on the same
      // turn it fired), or the squatter when they LEAVE the tile (handled by
      // _collectBananasOnPath's leave-steal).
      prop.bananaPile = (prop.bananaPile || 0) + amount;
      totalGrown += amount;
      grownAmounts[propId] = amount;
    }
    // Drive the frontend grow animation through the shared dice-match fields:
    // the grown piles pop in, then get collected (with a per-tile burst) as the
    // token walks through them, and the tile the player stands on plays the
    // "Early Pickup!" floater. Accumulates across fires (rolled + landed grow).
    if (grownTiles.length > 0) {
      this.diceMatchTiles = (this.diceMatchTiles || []).concat(grownTiles);
      this.diceMatchGrownAmounts = Object.assign(
        this.diceMatchGrownAmounts || {},
        grownAmounts,
      );
    }
    if (earlyPickupTile != null) {
      this.diceMatchEarlyPickup = earlyPickupTile;
    }

    const verb =
      source === "roll" ? `rolled ${label} — GROW ${label} fired` : `landed on GROW ${label}`;
    if (totalEarlyPicked > 0) {
      this._log(
        `${player.name} ${verb} — early-picked ${totalEarlyPicked}🍌 from the farm under them! 🌱🐒`,
      );
    }
    if (totalGrown > 0) {
      this._log(
        `${player.name} ${verb} — ${totalGrown}🍌 grew on their farms! 🌱`,
      );
    }
    if (totalGrown === 0 && totalEarlyPicked === 0) {
      this._log(`${player.name} ${verb} — no farms in range! 🌱`);
    }

    // Glow the grow tile ONLY when it actually grew bananas — whether they
    // landed in the owner's pile or were early-picked. A fire that grows
    // nothing (no farms in range) does not glow. Accumulates across fires so a
    // rolled grow + a walked landing both glow.
    if (totalGrown > 0 || totalEarlyPicked > 0) {
      this.lastGrowFired = (this.lastGrowFired || []).concat([growPos]);
    }
    return { totalGrown, totalEarlyPicked };
  }

  // A die face in 1..6 fires the matching GROW tile's effect (grow tiles are
  // labelled 1..6), but ONLY if that grow tile has already been revealed
  // (landed on). A still-hidden grow stays
  // dormant. Values outside 1..6 (e.g. a Magic Dice step > 6) match no grow
  // and are ignored; the player still walks normally afterwards.
  _processRolledGrow(player, value) {
    if (value < 1 || value > 6) return;
    const growPos = this._findGrowByLabel(value);
    if (growPos == null) return;
    // Dormant until revealed: a hidden grow does nothing (no growth, no reveal)
    // when its number is rolled — it must be revealed by landing first.
    if (!this._isGenuinelyRevealed(growPos)) return;
    this._fireGrowAt(player, growPos, "roll");
  }

  // -- Banana Pile Collection -------------------------------------


  _collectBananasOnPath(player, oldPos, newPos) {
    // Walk every tile from oldPos+1 to newPos (wrapping around the board)
    const steps = (newPos - oldPos + this.boardSize) % this.boardSize;
    if (steps === 0) return;
    let collected = 0;
    let stolen = 0;
    const stolenVictims = new Set();

    // Squat / quick-steal rule: collect the pile on the tile you're LEAVING
    // if you don't own it. While you squatted there grown bananas piled up
    // (instead of being stolen the instant they grew), so you grab that pile
    // as you depart — unless the owner already reclaimed it by crossing the
    // farm first, in which case the pile is 0 and nothing moves.
    {
      const leftProp = this.properties.get(oldPos);
      if (
        leftProp &&
        leftProp.bananaPile > 0 &&
        leftProp.owner &&
        leftProp.owner !== player.id
      ) {
        stolen += leftProp.bananaPile;
        stolenVictims.add(leftProp.owner);
        leftProp.bananaPile = 0;
      }
    }

    for (let s = 1; s <= steps; s++) {
      const pos = (oldPos + s) % this.boardSize;

      const prop = this.properties.get(pos);
      if (!prop || prop.bananaPile <= 0) continue;

      const isLanding = pos === newPos;

      if (prop.owner === player.id) {
        // Own tile — collect on any crossed or landed-on tile.
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && !prop.owner) {
        // Collect unclaimed banana piles when landing on them
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && prop.owner && prop.owner !== player.id) {
        // Landing on an opponent's banana pile does NOT collect it. You're
        // now squatting on their farm — like a grow that happens while you
        // squat, the pile is yours to steal only when you LEAVE the tile
        // (the leave-steal above), and the owner can reclaim it first if
        // they cross/land here. So leave the pile sitting on the farm.
      }
    }

    if (collected > 0) {
      player.money += collected;
      this._log(
        `${player.name} harvested ${collected}\ud83c\udf4c from banana piles! \ud83d\udc35`,
      );
    }
    if (stolen > 0) {
      player.money += stolen;
      const names = [...stolenVictims]
        .map((id) => this.players.find((p) => p.id === id)?.name || "?")
        .join(" & ");
      // 2v2: every victim is on the player's team => "friendly"
      // steal, render green. Mixed steals (rare: cross-team-mate split tile)
      // fall back to the normal red theft message.
      const allFriendly =
        this._isTeams() &&
        this.teams &&
        [...stolenVictims].every(
          (id) => this.getTeamOf(id) === this.getTeamOf(player.id),
        );
      if (allFriendly) {
        this._log(
          `${player.name} stole ${stolen}\ud83c\udf4c from teammate ${names}'s banana pile! \ud83e\udd1d`,
          { color: "green" },
        );
      } else {
        this._log(
          `${player.name} stole ${stolen}\ud83c\udf4c from ${names}'s banana pile! \ud83d\udc12`,
        );
      }
    }
  }

  _collectBananasAtTile(player, pos) {
    // Single-tile collection (for teleports like Vine Swing)
    const prop = this.properties.get(pos);
    if (!prop || prop.bananaPile <= 0) return;

    if (prop.owner === player.id) {
      player.money += prop.bananaPile;
      this._log(
        `${player.name} harvested ${prop.bananaPile}\ud83c\udf4c from a banana pile! \ud83d\udc35`,
      );
      prop.bananaPile = 0;
    } else if (!prop.owner) {
      player.money += prop.bananaPile;
      this._log(
        `${player.name} picked up ${prop.bananaPile}\ud83c\udf4c from the ground! \ud83d\udc35`,
      );
      prop.bananaPile = 0;
    } else if (prop.owner && prop.owner !== player.id) {
      const isTeammate =
        this._isTeams() &&
        this.getTeamOf(prop.owner) === this.getTeamOf(player.id);
      if (isTeammate) {
        // Teammates don't auto-collect each other's piles \u2014 they STEAL them,
        // shown as a friendly (green) steal.
        player.money += prop.bananaPile;
        const mate = this.players.find((p) => p.id === prop.owner);
        this._log(
          `${player.name} stole ${prop.bananaPile}\ud83c\udf4c from teammate ${mate?.name || "?"}'s banana pile! \ud83e\udd1d`,
          { color: "green" },
        );
      } else {
        const victim = this.players.find((p) => p.id === prop.owner);
        player.money += prop.bananaPile;
        this._log(
          `${player.name} stole ${prop.bananaPile}\ud83c\udf4c from ${victim?.name || "?"}'s banana pile! \ud83d\udc12`,
        );
      }
      prop.bananaPile = 0;
    }
  }

  // -- Poker System ------------------------------------------------

  _startPoker(landingPlayerId, otherPlayerId) {
    const lander = this.players.find((p) => p.id === landingPlayerId);
    const other = this.players.find((p) => p.id === otherPlayerId);
    if (!lander || !other) return false;

    // Opening stake: only the DEFENDER (the player landed on) puts up bananas
    // \u2014 10% of their own stack (min 1, never more than they have). The
    // challenger (lander) posts nothing and acts first: call the stake, fold
    // (free \u2014 the defender just gets their stake back), or raise. If the
    // challenger can't cover the stake, calling puts them all-in for less and
    // the defender's uncalled excess is refunded.
    const bbActual = Math.min(
      other.money,
      Math.max(1, Math.floor(other.money * 0.1)),
    );
    other.money -= bbActual;
    // The bet to match is the defender's stake.
    const startBet = bbActual;

    // Challenger (lander) acts first preflop.
    const landerSeat = {
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      hasActed: false,
    };
    const otherSeat = {
      bet: bbActual,
      totalBet: bbActual,
      folded: false,
      allIn: other.money === 0,
      hasActed: false,
    };

    if (this.monkeyPoker) {
      // Monkey Poker: each player gets cards valued 1-10, one per round
      const mkCard = () => ({ value: Math.floor(Math.random() * 10) + 1 });
      this.poker = {
        monkeyPoker: true,
        bbPlayer: otherPlayerId,
        sbPlayer: landingPlayerId,
        players: {
          [landingPlayerId]: { cards: [mkCard()], ...landerSeat },
          [otherPlayerId]: { cards: [mkCard()], ...otherSeat },
        },
        communityCards: [],
        pot: bbActual,
        currentBet: startBet,
        lastRaiseSize: startBet,
        round: "preflop",
        currentTurn: landingPlayerId,
        winner: null,
        resolved: false,
        bbHandName: null,
        sbHandName: null,
      };
    } else {
      // Real Poker (Texas Hold'em)
      const deck = createPokerDeck();
      this.poker = {
        monkeyPoker: false,
        bbPlayer: otherPlayerId,
        sbPlayer: landingPlayerId,
        players: {
          [landingPlayerId]: { cards: [deck.pop(), deck.pop()], ...landerSeat },
          [otherPlayerId]: { cards: [deck.pop(), deck.pop()], ...otherSeat },
        },
        communityCards: [],
        deck,
        pot: bbActual,
        currentBet: startBet,
        lastRaiseSize: startBet,
        round: "preflop",
        currentTurn: landingPlayerId,
        winner: null,
        resolved: false,
        bbHandName: null,
        sbHandName: null,
      };
    }

    this._log(
      `\uD83C\uDCCF ${this.monkeyPoker ? "Monkey Poker" : "Poker"} match! ${lander.name} challenges ${other.name} (stake: ${bbActual}\uD83C\uDF4C)`,
    );

    // If the player to act first is a ghost, drive it.
    this._maybeDriveGhostPoker();
    return true;
  }

  pokerAction(socketId, action, amount) {
    if (!this.poker || this.poker.resolved) return false;
    if (this.poker.currentTurn !== socketId) return false;

    const poker = this.poker;
    const p = poker.players[socketId];
    const opId = socketId === poker.bbPlayer ? poker.sbPlayer : poker.bbPlayer;
    const opp = poker.players[opId];
    const player = this.players.find((pl) => pl.id === socketId);
    if (!player || !p || p.folded) return false;

    const toCall = poker.currentBet - p.bet;

    switch (action) {
      case "fold":
        p.folded = true;
        poker.winner = opId;
        this._log(`${player.name} folded! \uD83C\uDCCF`);
        this._resolvePoker();
        return true;

      case "check":
        if (toCall > 0) return false;
        p.hasActed = true;
        this._log(`${player.name} checks.`);
        break;

      case "call": {
        if (toCall <= 0) return false;
        const callAmt = Math.min(toCall, player.money);
        player.money -= callAmt;
        p.bet += callAmt;
        p.totalBet += callAmt;
        poker.pot += callAmt;
        if (player.money === 0) p.allIn = true;
        // All-in for less than the bet: refund the opponent's uncalled excess
        // so both players have the same amount in (normal all-in situation).
        if (p.allIn && p.bet < opp.bet) {
          const excess = opp.bet - p.bet;
          const oppPlayer = this.players.find((pl) => pl.id === opId);
          if (oppPlayer) oppPlayer.money += excess;
          opp.bet -= excess;
          opp.totalBet -= excess;
          poker.pot -= excess;
          poker.currentBet = p.bet;
          if (oppPlayer && oppPlayer.money > 0) opp.allIn = false;
        }
        p.hasActed = true;
        this._log(
          `${player.name} calls ${callAmt}\uD83C\uDF4C${p.allIn ? " (ALL IN)" : ""}.`,
        );
        break;
      }

      case "raise": {
        // No-limit raises: bet any whole amount of bananas. `amount` is the
        // total this player raises TO for the current betting round. Standard
        // NL minimum raise: at least the size of the previous bet/raise (min
        // 1\uD83C\uDF4C when opening), unless the raise puts the player all-in.
        let target = Math.floor(amount || 0);
        if (target <= poker.currentBet) return false;
        const oppPlayer = this.players.find((pl) => pl.id === opId);
        // Can't bet more than the opponent could ever match (effective stack).
        const oppMax = opp.bet + (oppPlayer ? oppPlayer.money : 0);
        if (target > oppMax) target = oppMax;
        if (target <= poker.currentBet) return false;
        const commit = target - p.bet;
        if (commit <= 0 || commit > player.money) return false;
        const isAllIn = commit === player.money;
        const minRaiseTo =
          poker.currentBet + Math.max(poker.lastRaiseSize || 0, 1);
        if (target < minRaiseTo && !isAllIn) return false;
        player.money -= commit;
        poker.lastRaiseSize = target - poker.currentBet;
        p.bet = target;
        p.totalBet += commit;
        poker.pot += commit;
        poker.currentBet = target;
        if (player.money === 0) p.allIn = true;
        p.hasActed = true;
        opp.hasActed = false; // Opponent must respond to raise
        this._log(
          `${player.name} ${p.allIn ? "goes ALL IN, raising" : "raises"} to ${target}\uD83C\uDF4C.`,
        );
        poker.currentTurn = opId;
        this._maybeDriveGhostPoker();
        return true;
      }

      default:
        return false;
    }

    // Check if round should advance. Heads-up: once a player is all-in and
    // the bets are matched, no more betting is possible \u2014 run out the cards.
    const betsEqual = p.bet === opp.bet;
    const bothActed = p.hasActed && opp.hasActed;

    if (betsEqual && (p.allIn || opp.allIn)) {
      this._pokerRunout();
    } else if (betsEqual && bothActed) {
      this._advancePokerRound();
    } else {
      poker.currentTurn = opId;
    }
    // If the next player to act is a ghost, the server plays for them.
    this._maybeDriveGhostPoker();
    return true;
  }

  _advancePokerRound() {
    const poker = this.poker;
    const bbP = poker.players[poker.bbPlayer];
    const sbP = poker.players[poker.sbPlayer];

    bbP.bet = 0;
    sbP.bet = 0;
    bbP.hasActed = false;
    sbP.hasActed = false;
    poker.currentBet = 0;
    poker.lastRaiseSize = 0; // new round: opening bet can be any amount (min 1🍌)
    poker.currentTurn = poker.bbPlayer; // defender acts first post-flop

    if (poker.monkeyPoker) {
      // Monkey Poker: 3 rounds (preflop, flop, river), deal 1 card to each player per round
      const mkRounds = ["preflop", "flop", "river"];
      const idx = mkRounds.indexOf(poker.round);
      if (idx >= 2) {
        this._pokerShowdown();
        return;
      }
      poker.round = mkRounds[idx + 1];
      const mkCard = () => ({ value: Math.floor(Math.random() * 10) + 1 });
      bbP.cards.push(mkCard());
      sbP.cards.push(mkCard());
      if (bbP.allIn && sbP.allIn) {
        this._advancePokerRound();
      }
    } else {
      // Real Poker
      const rounds = ["preflop", "flop", "turn", "river"];
      const idx = rounds.indexOf(poker.round);
      if (idx >= 3) {
        this._pokerShowdown();
        return;
      }
      poker.round = rounds[idx + 1];
      if (poker.round === "flop") {
        poker.communityCards.push(
          poker.deck.pop(),
          poker.deck.pop(),
          poker.deck.pop(),
        );
      } else {
        poker.communityCards.push(poker.deck.pop());
      }
      if (bbP.allIn && sbP.allIn) {
        this._advancePokerRound();
      }
    }
  }

  _pokerRunout() {
    const poker = this.poker;
    if (poker.monkeyPoker) {
      // Deal remaining cards to each player until they have 3
      const mkCard = () => ({ value: Math.floor(Math.random() * 10) + 1 });
      const bbP = poker.players[poker.bbPlayer];
      const sbP = poker.players[poker.sbPlayer];
      while (bbP.cards.length < 3) bbP.cards.push(mkCard());
      while (sbP.cards.length < 3) sbP.cards.push(mkCard());
    } else {
      while (poker.communityCards.length < 5) {
        poker.communityCards.push(poker.deck.pop());
      }
    }
    poker.round = "showdown";
    this._pokerShowdown();
  }

  _pokerShowdown() {
    const poker = this.poker;
    poker.round = "showdown";

    if (poker.monkeyPoker) {
      // Monkey Poker: sum of card values
      const bbSum = poker.players[poker.bbPlayer].cards.reduce(
        (s, c) => s + c.value,
        0,
      );
      const sbSum = poker.players[poker.sbPlayer].cards.reduce(
        (s, c) => s + c.value,
        0,
      );
      poker.bbHandName = `Sum: ${bbSum}`;
      poker.sbHandName = `Sum: ${sbSum}`;
      if (bbSum > sbSum) {
        poker.winner = poker.bbPlayer;
      } else if (sbSum > bbSum) {
        poker.winner = poker.sbPlayer;
      } else {
        poker.winner = "tie";
      }
    } else {
      const bbCards = [
        ...poker.players[poker.bbPlayer].cards,
        ...poker.communityCards,
      ];
      const sbCards = [
        ...poker.players[poker.sbPlayer].cards,
        ...poker.communityCards,
      ];

      const bbVal = bestHand(bbCards);
      const sbVal = bestHand(sbCards);
      const cmp = compareHands(bbVal, sbVal);

      poker.bbHandName = HAND_NAMES[bbVal[0]];
      poker.sbHandName = HAND_NAMES[sbVal[0]];

      if (cmp > 0) {
        poker.winner = poker.bbPlayer;
      } else if (cmp < 0) {
        poker.winner = poker.sbPlayer;
      } else {
        poker.winner = "tie";
      }
    }

    this._resolvePoker();
  }

  _resolvePoker() {
    const poker = this.poker;
    poker.resolved = true;

    const bbPlayer = this.players.find((p) => p.id === poker.bbPlayer);
    const sbPlayer = this.players.find((p) => p.id === poker.sbPlayer);

    if (poker.winner === "tie") {
      const half = Math.floor(poker.pot / 2);
      if (bbPlayer) bbPlayer.money += half;
      if (sbPlayer) sbPlayer.money += poker.pot - half;
      this._log(
        `\uD83C\uDCCF Poker tie! Pot split — ${half}\uD83C\uDF4C each!`,
      );
    } else {
      const winner = this.players.find((p) => p.id === poker.winner);
      if (winner) {
        winner.money += poker.pot;
        this._log(
          `\uD83C\uDCCF ${winner.name} wins ${poker.pot}\uD83C\uDF4C at poker!`,
        );
      } else {
        // Winner disconnected — return pot to remaining player
        const remaining = bbPlayer || sbPlayer;
        if (remaining) {
          remaining.money += poker.pot;
          this._log(
            `\uD83C\uDCCF Opponent left — ${remaining.name} gets the ${poker.pot}\uD83C\uDF4C pot!`,
          );
        }
      }
    }

    // Auto-dismiss poker after a short delay so players see the result
    if (this._pokerDismissTimer) clearTimeout(this._pokerDismissTimer);
    this._pokerDismissTimer = setTimeout(() => {
      this._pokerDismissTimer = null;
      if (!this.poker || !this.poker.resolved) return;
      this.poker = null;
      const cur = this.getCurrentPlayer();
      if (cur && !this.auction && !this.vineSwing) {
        this._scheduleAutoEnd(cur, 2000);
      }
      if (this.onUpdate) this.onUpdate();
    }, 3000);
  }

  pokerDismiss(socketId) {
    if (!this.poker || !this.poker.resolved) return false;
    if (socketId !== this.poker.bbPlayer && socketId !== this.poker.sbPlayer)
      return false;

    if (this._pokerDismissTimer) {
      clearTimeout(this._pokerDismissTimer);
      this._pokerDismissTimer = null;
    }
    this.poker = null;
    const cur = this.getCurrentPlayer();
    if (cur && !this.auction && !this.vineSwing) {
      this._scheduleAutoEnd(cur, 2000);
    }
    return true;
  }

  // -- Bomb mechanic -----------------------------------------------

  buyBomb(socketId) {
    if (!this.bombMode || this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    const price = this.bombCost;
    if (player.money < price) return false;
    player.money -= price;
    player.bomb = (player.bomb || 0) + 1;
    this._log(
      `${player.name} bought a pineapple bomb for ${price}\ud83c\udf4c! \ud83c\udf4d`,
    );
    return true;
  }

  placeBomb(socketId, tileIndex) {
    if (!this.bombMode || this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt || !player.bomb) return false;
    const idx = Math.floor(tileIndex);
    if (idx < 0 || idx >= this.boardSize) return false;
    // Bombs can't be placed on a corner tile (a blast terminates AT the corners,
    // so a corner bomb would have no room to spread).
    if (this._isCornerTile(idx)) return false;
    // Can't place on a tile that already has a bomb
    if (this.bombs.some((b) => b.position === idx)) return false;
    const cur = this.getCurrentPlayer();
    const isOwnTurn = !!(cur && cur.id === player.id);
    player.bomb = Math.max(0, (player.bomb || 0) - 1);
    // Unified timing: every bomb stays hidden + inactive until the placer's NEXT
    // turn ends, then it spawns at the tile and starts its 3-turn countdown.
    // `armCountdown` counts placer-turn-ends down to that spawn moment: placing
    // on your own turn needs 2 (skip this turn's end, arm at the next), placing
    // on someone else's turn needs 1 (arm at the end of your upcoming turn).
    this.bombs.push({
      placedBy: player.id,
      position: idx,
      turnsLeft: 3,
      pending: true,
      armCountdown: isOwnTurn ? 2 : 1,
    });
    this._log(
      `${player.name} planted a pineapple bomb! \ud83c\udf4d (spawns when your next turn ends, then detonates in 3!)`,
    );
    return true;
  }

  // Corner tiles sit at the four corners of the square loop (every 12th tile:
  // 0, 12, 24, 36). Bomb blasts terminate at them.
  _isCornerTile(pos) {
    return pos % 12 === 0;
  }

  _addExplosion(explosion) {
    if (!this.lastExplosion || !Array.isArray(this.lastExplosion.explosions)) {
      this.lastExplosion = { explosions: [] };
    }
    this.lastExplosion.explosions.push(explosion);
  }

  // The 12 tile positions on the same cornerless-board side as `pos`
  // (bottom 0-11, left 12-23, top 24-35, right 36-47). only.
  _sideTiles(pos) {
    const side = Math.floor(pos / 12);
    const start = side * 12;
    const tiles = [];
    for (let i = start; i < start + 12 && i < this.boardSize; i++) tiles.push(i);
    return tiles;
  }

  // Tiles caught in a bomb blast. The blast spreads outward from the bomb
  // position and each side terminates at the next CORNER tile (inclusive),
  // independently — both directions walk all the way to their own corner, even
  // if one finds a corner sooner than the other. Bombs can't be placed on a
  // corner (see placeBomb), so the bomb tile itself is never a corner.
  _bombBlastTiles(position) {
    const tiles = [position];
    for (let d = 1; d < this.boardSize; d++) {
      const p = (position + d) % this.boardSize;
      tiles.push(p);
      if (this._isCornerTile(p)) break;
    }
    for (let d = 1; d < this.boardSize; d++) {
      const p = (position - d + this.boardSize) % this.boardSize;
      tiles.push(p);
      if (this._isCornerTile(p)) break;
    }
    return tiles;
  }

  _checkBombDetonation(player) {
    if (!this.bombMode || this.bombs.length === 0) return false;
    const bombIndex = this.bombs.findIndex(
      (b) => !b.pending && b.position === player.position,
    );
    if (bombIndex === -1) return false;
    const bomb = this.bombs[bombIndex];

    // Placer stepping on their own bomb DEFUSES it — the bomb is removed
    // from the board, nobody takes damage, nobody dies. Gives the placer a
    // clean out if they walked back onto their own trap.
    // 2v2: same defuse also applies when a teammate of the placer
    // lands on it, so allies can clear each other's traps without going down.
    if (bomb.placedBy === player.id) {
      this.bombs.splice(bombIndex, 1);
      this.lastDefuse = {
        position: bomb.position,
        defuserId: player.id,
        placerId: bomb.placedBy,
        ts: Date.now(),
      };
      this._log(
        `\u{1F6E0}️ ${player.name} walked back over their own pineapple bomb and defused it! \u{1F4A4}\u{1F34D}`,
      );
      return true;
    }
    if (
      this.gameMode === "2v2" &&
      this.teams &&
      this.getTeamOf(bomb.placedBy) &&
      this.getTeamOf(bomb.placedBy) === this.getTeamOf(player.id)
    ) {
      this.bombs.splice(bombIndex, 1);
      const placerName =
        (this.players.find((p) => p.id === bomb.placedBy) || {}).name || "their teammate";
      this.lastDefuse = {
        position: bomb.position,
        defuserId: player.id,
        placerId: bomb.placedBy,
        ts: Date.now(),
      };
      this._log(
        `\u{1F6E0}️ ${player.name} found ${placerName}'s pineapple bomb and defused it! \u{1F4A4}\u{1F34D}`,
      );
      return true;
    }

    const placer = this.players.find((p) => p.id === bomb.placedBy);
    this.bombs.splice(bombIndex, 1);
    const blastTiles = this._bombBlastTiles(bomb.position);
    const explosion = {
      position: bomb.position,
      tiles: blastTiles,
      placerId: bomb.placedBy,
      triggerId: player.id,
      kills: [],
    };
    this._addExplosion(explosion);
    const victims = this.players.filter(
      (p) => !p.bankrupt && !p.startPickPending && blastTiles.includes(p.position),
    );
    if (victims.length === 0) return false;
    this._log(
      `\ud83d\udca5 BOOM! ${player.name} landed on a pineapple bomb! \ud83c\udf4d`,
    );
    for (const v of victims) {
      if (v.id === bomb.placedBy) {
        // Bombing yourself is a no-op. The bomb still detonates (so enemies
        // in the blast still go down), but the placer takes no damage and
        // doesn't leave the game.
        continue;
      } else if (
        this._isTeams() &&
        this.teams &&
        this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
      ) {
        // Teammate caught in the blast \u2014 no damage at all (allies are immune to
        // each other's bombs, just like the placer is to their own).
        continue;
      } else {
        // Enemy victim \u2014 eliminated normally. The placer always survives
        // their own blast, so enemy farms transfer to the placer per the
        // standard kill rule.
        explosion.kills.push(this._bombEliminate(v, placer));
      }
    }
    this._checkBombWin();
    return true;
  }

  _explodeExpiredBombs() {
    if (!this.bombMode || this.bombs.length === 0) return false;
    let anyExploded = false;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      if (!this.bombs[i].pending && this.bombs[i].turnsLeft <= 0) {
        const bomb = this.bombs[i];
        this.bombs.splice(i, 1);
        const blastTiles = this._bombBlastTiles(bomb.position);
        const explosion = {
          position: bomb.position,
          tiles: blastTiles,
          placerId: bomb.placedBy,
          triggerId: null,
          kills: [],
        };
        this._addExplosion(explosion);
        const victims = this.players.filter(
          (p) => !p.bankrupt && !p.startPickPending && blastTiles.includes(p.position),
        );
        if (victims.length > 0) {
          this._log(
            `\ud83d\udca5 BOOM! A pineapple bomb exploded on tile ${bomb.position}! \ud83c\udf4d`,
          );
          const placer = this.players.find((p) => p.id === bomb.placedBy);
          for (const v of victims) {
            if (v.id === bomb.placedBy) {
              // Bombing yourself is a no-op. The bomb still detonates (so
              // enemies in the blast still go down), but the placer takes no
              // damage.
              continue;
            } else if (
              this._isTeams() &&
              this.teams &&
              this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
            ) {
              // Teammate caught in the blast — no damage at all.
              continue;
            } else {
              // Enemy victim — eliminated normally. The placer is immune to
              // their own blast so enemy farms transfer to the placer per
              // the standard kill rule.
              explosion.kills.push(this._bombEliminate(v, placer));
            }
          }
          this._checkBombWin();
        } else {
          this._log(
            `\ud83d\udca5 A pineapple bomb exploded on tile ${bomb.position} but no one was nearby! \ud83c\udf4d`,
          );
        }
        anyExploded = true;
      }
    }
    return anyExploded;
  }

  // Swap the board entry, label numbers, grow label, and properties Map entry
  // between two board positions. Player property lists are updated so each
  // player still owns the same TILE at its new position. Caller handles any
  // reveal/visibility bookkeeping.
  _swapTilePositions(posA, posB) {
    if (posA === posB) return;
    if (posA < 0 || posA >= this.boardSize) return;
    if (posB < 0 || posB >= this.boardSize) return;

    // Swap board entries
    const tmpBoard = this.board[posA];
    this.board[posA] = this.board[posB];
    this.board[posB] = tmpBoard;

    // Swap tile label numbers (CV1, BJ2, etc.) so they follow their tile
    if (this.tileLabelNumbers) {
      const a = this.tileLabelNumbers.get(posA);
      const b = this.tileLabelNumbers.get(posB);
      this.tileLabelNumbers.delete(posA);
      this.tileLabelNumbers.delete(posB);
      if (a !== undefined) this.tileLabelNumbers.set(posB, a);
      if (b !== undefined) this.tileLabelNumbers.set(posA, b);
    }

    // Swap grow labels (G1..G6) so they follow their tile
    if (this.growTileLabels) {
      const a = this.growTileLabels.get(posA);
      const b = this.growTileLabels.get(posB);
      this.growTileLabels.delete(posA);
      this.growTileLabels.delete(posB);
      if (a !== undefined) this.growTileLabels.set(posB, a);
      if (b !== undefined) this.growTileLabels.set(posA, b);
    }

    // Swap properties Map entries (preserves owner/bananaPile state)
    const propA = this.properties.get(posA);
    const propB = this.properties.get(posB);
    this.properties.delete(posA);
    this.properties.delete(posB);
    if (propA) this.properties.set(posB, propA);
    if (propB) this.properties.set(posA, propB);

    // Update player property lists to follow the swap
    for (const p of this.players) {
      if (!p.properties) continue;
      p.properties = p.properties.map((pos) => {
        if (pos === posA) return posB;
        if (pos === posB) return posA;
        return pos;
      });
    }
  }

  _bombEliminate(victim, placer) {
    const loot = victim.money;
    const transferredTiles = [...victim.properties];
    const victimPosition = victim.position;
    victim.bankrupt = true;
    victim.money = 0;
    let kill = null;
    // Transfer path: properties + loot move to the placer. The placer is
    // immune to their own bomb, so a successful enemy bomb still rewards the
    // bomber the standard way.
    if (placer && !placer.bankrupt && placer.id !== victim.id) {
      placer.money += loot;
      for (const pos of transferredTiles) {
        const prop = this.properties.get(pos);
        if (prop) {
          prop.owner = placer.id;
          if (!placer.properties.includes(pos)) placer.properties.push(pos);
        }
      }
      // Special items (won dice items) and any held bombs transfer to the
      // placer too \u2014 bombing a player (ghost or not) takes everything.
      if (victim.cards && placer.cards) {
        for (const k of Object.keys(victim.cards)) {
          placer.cards[k] = (placer.cards[k] || 0) + (victim.cards[k] || 0);
          victim.cards[k] = 0;
        }
      }
      if (victim.bomb) {
        placer.bomb = (placer.bomb || 0) + victim.bomb;
        victim.bomb = 0;
      }
      this._log(
        `\ud83d\udca5 ${victim.name} was eliminated! ${placer.name} took ${loot}\ud83c\udf4c, all their farms, and their items!`,
      );
      kill = {
        victimId: victim.id,
        victimName: victim.name,
        victimPosition,
        placerId: placer.id,
        placerName: placer.name,
        loot,
        tiles: transferredTiles,
      };
    } else {
      this._log(
        `\ud83d\udca5 ${victim.name} was caught in the explosion and eliminated!`,
      );
      kill = {
        victimId: victim.id,
        victimName: victim.name,
        victimPosition,
        placerId: placer ? placer.id : null,
        placerName: placer ? placer.name : null,
        loot: 0,
        tiles: [],
      };
    }
    victim.properties = [];
    return kill;
  }

  _checkBombWin() {
    if (this.state === "finished") return;
    // 2v2: a team wins the moment BOTH opposing players are eliminated, even
    // though Super Banana is the usual win \u2014 bomb elimination is the exception.
    if (this._isTeams() && this.teams) {
      for (const teamKey of ["A", "B"]) {
        const otherKey = teamKey === "A" ? "B" : "A";
        const teamAlive = this.teams[teamKey].some((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return p && !p.bankrupt;
        });
        const otherDead = this.teams[otherKey].every((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return !p || p.bankrupt;
        });
        if (teamAlive && otherDead) {
          this.state = "finished";
          // bombWinner drives the game-over screen; point it at a surviving
          // member of the winning team.
          const survivor = this.teams[teamKey]
            .map((id) => this.players.find((pl) => pl.id === id))
            .find((p) => p && !p.bankrupt);
          if (survivor) this.bombWinner = survivor.id;
          const names = this.teams[teamKey]
            .map((id) => this.players.find((p) => p.id === id)?.name || "?")
            .join(" & ");
          this._log(
            `\ud83c\udfc6 Team ${teamKey} (${names}) bombed the other team out and won! \ud83d\udc51\ud83d\udca5`,
          );
          this._revealAllTiles();
          return;
        }
      }
      return;
    }
    const alive = this.players.filter((p) => !p.bankrupt);
    if (alive.length === 1) {
      this.state = "finished";
      this.bombWinner = alive[0].id;
      this._log(
        `\ud83c\udfc6 ${alive[0].name} is the last monkey standing and is the Monkey King! \ud83d\udc51\ud83d\udca5`,
      );
      this._revealAllTiles();
    }
  }

  _revealAllTiles() {
    for (const p of this.players) {
      for (let i = 0; i < this.boardSize; i++) p.revealedTiles.add(i);
    }
  }

  endTurn(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || !this.diceRolled) return false;
    if (this.superBananaPending) return false;
    if (this.superBananaWin) return false;
    if (this.itemAuction) return false;
    this._cancelAutoEnd();

    // If the lander's roll queued an item auction (counter hit 0), kick it off
    // BEFORE advancing the turn. The auction's resolve callback will re-invoke
    // endTurn(socketId) so the turn doesn't advance — and the next player's
    // "your turn" notification doesn't fire — until the auction is fully done.
    if (
      this._itemAuctionQueued &&
      this.itemAuctionEnabled &&
      this.state === "playing" &&
      !this._pendingEndTurnSocketId
    ) {
      this._pendingEndTurnSocketId = socketId;
      this._maybeStartQueuedItemAuction();
      // If an auction actually started, hold here. Otherwise (e.g. queue was
      // dropped because not enough players to bother), fall through and
      // advance the turn normally.
      if (this.itemAuction) return true;
      this._pendingEndTurnSocketId = null;
    }
    // armedAbility intentionally persists across turn end — if armed mid-turn
    // after rolling, it fires on the player's NEXT roll. Consumed on use in
    // rollDice / useMagicDice / _beginCardTurn.
    this.petCoinFlip = null;
    this.petUsedThisTurn = false;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.lastPetUsed = null;
    this.lastStartPick = null;
    this.lastTeleport = null;
    this.lastTileSwap = null;
    this.cardUsedThisTurn = false;

    // Clamp all players to 0 minimum (no negatives, no bankruptcy)
    for (const p of this.players) {
      if (p.money < 0) p.money = 0;
    }

    // Next player — skip bankrupt players (eliminated via bomb mode). Guard
    // against an infinite loop if somehow every other player is bankrupt.
    const totalPlayers = this.players.length;
    let advanced = 0;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % totalPlayers;
      advanced++;
    } while (
      advanced < totalPlayers &&
      this.players[this.currentPlayerIndex] &&
      this.players[this.currentPlayerIndex].bankrupt
    );

    this.turn++;
    this.diceRolled = false;

    // Bomb lifecycle, processed at the END of each turn for bombs the player
    // whose turn just ended (`cur`) placed:
    //   • Pending bombs count down `armCountdown`; when it reaches 0 the bomb
    //     SPAWNS at its tile and arms (pending → false) with a fresh 3-turn
    //     timer. A bomb that spawns this turn does NOT also tick this turn.
    //   • Already-armed bombs tick `turnsLeft` toward detonation (the actual
    //     explosion happens on the next roll, in rollDice).
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      if (b.placedBy !== cur.id) continue;
      if (b.pending) {
        b.armCountdown = (b.armCountdown || 1) - 1;
        if (b.armCountdown <= 0) {
          b.pending = false; // spawn + arm now (end of placer's next turn)
          b.turnsLeft = 3;
        }
      } else {
        b.turnsLeft--;
      }
    }

    // Win check — only Super Banana purchase wins
    if (this._isTeams() && this.teams) {
      // Team mode: check if any player bought the Super Banana
      for (const teamKey of ["A", "B"]) {
        const teamWon = this.teams[teamKey].some((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return (
            p &&
            p.properties.some((pos) => {
              const prop = this.properties.get(pos);
              return prop && prop.group === "superBanana";
            })
          );
        });
        if (teamWon && this.state !== "finished") {
          this.state = "finished";
          const names = this.teams[teamKey]
            .map((id) => this.players.find((p) => p.id === id)?.name || "?")
            .join(" & ");
          this._log(
            `\ud83c\udfc6 Team ${teamKey} (${names}) bought the Super Banana and won! \u2b50\ud83d\udc51`,
          );
          this._log(
            `\u2728 ${names} found the Super Banana, they now have good luck for all eternity! \u2728`,
          );
          this._revealAllTiles();
          break;
        }
      }
    } else {
      // FFA: only Super Banana purchase wins (no bankruptcy)
    }

    // Trigger any pending pet effects for the new current player
    if (this.state !== "finished") {
      const newCur = this.getCurrentPlayer();
      if (newCur && !newCur.bankrupt) {
        // Flip waitForCasterTurn when caster's turn arrives
        if (this.pendingMagicPets) {
          for (const mp of this.pendingMagicPets) {
            if (mp.waitForCasterTurn && mp.userId === newCur.id) {
              mp.waitForCasterTurn = false;
            }
          }
        }
        const hasMagicPet =
          this.pendingMagicPets &&
          this.pendingMagicPets.some(
            (mp) => mp.targetId === newCur.id && !mp.waitForCasterTurn,
          );
        const hasOwnPet = !!newCur.pendingPet;
        if (hasMagicPet || hasOwnPet) {
          this.petResolving = true;
          this._resolvePendingPets();
        }
      }
    }

    // item auction: if a counter-zero was queued during this
    // player's turn (after any property auction etc.), kick off the wheel
    // spin + bidding flow now that the turn has fully ended.
    this._maybeStartQueuedItemAuction();

    // If the new current player is a ghost, the server takes their turn.
    this._maybeDriveGhost();

    return true;
  }

  // -- Trade bananas -----------------------------------------------

  getTeamOf(playerId) {
    if (!this.teams) return null;
    if (this.teams.A.includes(playerId)) return "A";
    if (this.teams.B.includes(playerId)) return "B";
    return null;
  }

  getTeamBananas(teamKey) {
    if (!this.teams || !this.teams[teamKey]) return 0;
    return this.teams[teamKey].reduce((sum, id) => {
      const p = this.players.find((pl) => pl.id === id);
      return sum + (p ? p.money : 0);
    }, 0);
  }

  tradeBananas(senderId, recipientId, amount) {
    if (this.state !== "playing") return false;
    // Trading only allowed in team modes
    if (!this._isTeams()) return false;
    const sender = this.players.find((p) => p.id === senderId);
    const recipient = this.players.find((p) => p.id === recipientId);
    if (!sender || !recipient) return false;
    if (sender.bankrupt || recipient.bankrupt) return false;
    if (senderId === recipientId) return false;
    // Only teammates can trade
    if (this.getTeamOf(senderId) !== this.getTeamOf(recipientId)) return false;

    // Fee is 5% of the game's starting bananas (min 1), plus a cap of half
    // the sender's bananas, so trades can't trivially funnel everything to
    // one player.
    const TRADE_FEE = Math.max(1, Math.floor(this.startingMoney * 0.05));
    amount = Math.floor(amount);
    if (amount <= 0) return false;
    const cap = Math.floor(sender.money / 2);
    if (amount > cap) return false;
    const totalCost = amount + TRADE_FEE;
    if (sender.money < totalCost) return false;

    sender.money -= totalCost;
    recipient.money += amount;
    this._log(
      `\uD83D\uDCE6 ${sender.name} sent ${amount}\uD83C\uDF4C to ${recipient.name} (fee: ${TRADE_FEE}\uD83C\uDF4C)`,
    );
    return true;
  }

  // -- Trade property between any players (1-for-1 swap, no fee) --

  tradeProperty(senderId, recipientId, senderPropPos, recipientPropPos) {
    if (this.state !== "playing") return false;
    // Can't trade on your own turn
    const cur = this.getCurrentPlayer();
    if (cur && cur.id === senderId) return false;
    const sender = this.players.find((p) => p.id === senderId);
    const recipient = this.players.find((p) => p.id === recipientId);
    if (!sender || !recipient) return false;
    if (sender.bankrupt || recipient.bankrupt) return false;
    if (senderId === recipientId) return false;

    senderPropPos = Math.floor(senderPropPos);
    recipientPropPos = Math.floor(recipientPropPos);
    if (!sender.properties.includes(senderPropPos)) return false;
    if (!recipient.properties.includes(recipientPropPos)) return false;

    const senderProp = this.properties.get(senderPropPos);
    const recipientProp = this.properties.get(recipientPropPos);
    if (!senderProp || !recipientProp) return false;

    // Swap ownership
    senderProp.owner = recipientId;
    recipientProp.owner = senderId;

    sender.properties = sender.properties.filter((p) => p !== senderPropPos);
    sender.properties.push(recipientPropPos);
    recipient.properties = recipient.properties.filter(
      (p) => p !== recipientPropPos,
    );
    recipient.properties.push(senderPropPos);

    this._log(
      `\uD83E\uDD1D ${sender.name} swapped ${senderProp.name} for ${recipient.name}'s ${recipientProp.name}`,
    );
    return true;
  }

  // -- Sell property (list for sale at a set price) ---------------

  sellProperty(sellerId, propPos, price) {
    if (this.state !== "playing") return false;
    const seller = this.players.find((p) => p.id === sellerId);
    if (!seller || seller.bankrupt) return false;

    propPos = Math.floor(propPos);
    price = Math.floor(price);
    if (price <= 0 || price > 100000) return false;
    if (!seller.properties.includes(propPos)) return false;

    const prop = this.properties.get(propPos);
    if (!prop) return false;

    // Don't allow duplicate listing for the same property
    if (this.sellListings.some((l) => l.propPos === propPos)) return false;

    // Limit pending listings per seller
    const sellerListings = this.sellListings.filter(
      (l) => l.sellerId === sellerId,
    );
    if (sellerListings.length >= 5) return false;

    this._sellListingId++;
    const groupLetters = {
      pink: "LF",
      lightblue: "BJ",
      red: "RD",
      yellow: "CV",
      orange: "GF",
      darkblue: "GM",
    };
    let tileLabel = prop.name;
    if (this.tileLabelNumbers && prop.group && groupLetters[prop.group]) {
      const num = this.tileLabelNumbers.get(propPos);
      if (num !== undefined) tileLabel = groupLetters[prop.group] + num;
    }
    this.sellListings.push({
      id: this._sellListingId,
      sellerId,
      sellerName: seller.name,
      propPos,
      propName: tileLabel,
      price,
    });

    this._log(`🏷️ ${seller.name} listed ${tileLabel} for sale at ${price}🍌`);
    return true;
  }

  // -- Buy a listed sale (first come first served) -----------------

  buySale(buyerId, saleId) {
    if (this.state !== "playing") return false;
    const idx = this.sellListings.findIndex((l) => l.id === saleId);
    if (idx === -1) return false;
    const listing = this.sellListings[idx];

    // Can't buy your own listing
    if (listing.sellerId === buyerId) return false;

    const buyer = this.players.find((p) => p.id === buyerId);
    const seller = this.players.find((p) => p.id === listing.sellerId);
    if (!buyer || !seller) {
      this.sellListings.splice(idx, 1);
      return false;
    }
    if (buyer.bankrupt || seller.bankrupt) {
      this.sellListings.splice(idx, 1);
      return false;
    }

    // Check buyer can afford it
    if (buyer.money < listing.price) return false;

    // Re-validate ownership
    if (!seller.properties.includes(listing.propPos)) {
      this.sellListings.splice(idx, 1);
      this._log(
        `❌ Sale cancelled — ${seller.name} no longer owns ${listing.propName}`,
      );
      return false;
    }

    const prop = this.properties.get(listing.propPos);
    if (!prop) {
      this.sellListings.splice(idx, 1);
      return false;
    }

    // Execute the sale
    buyer.money -= listing.price;
    seller.money += listing.price;
    prop.owner = buyerId;
    seller.properties = seller.properties.filter((p) => p !== listing.propPos);
    buyer.properties.push(listing.propPos);

    this._log(
      `💰 ${buyer.name} bought ${listing.propName} from ${seller.name} for ${listing.price}🍌`,
    );
    this.sellListings.splice(idx, 1);
    return { propPos: listing.propPos, buyerColor: buyer.color };
  }

  // -- Cancel a sale listing ----------------------------------------

  cancelSale(playerId, saleId) {
    if (this.state !== "playing") return false;
    const idx = this.sellListings.findIndex((l) => l.id === saleId);
    if (idx === -1) return false;
    const listing = this.sellListings[idx];
    // Only the seller can cancel
    if (listing.sellerId !== playerId) return false;
    this._log(
      `❌ ${listing.sellerName} cancelled the sale of ${listing.propName}`,
    );
    this.sellListings.splice(idx, 1);
    return true;
  }

  // -- Action log -------------------------------------------------

  // Log entries are usually plain strings, but some carry a color tag so the
  // frontend can theme the line (e.g. friendly steals in 2v2 render
  // green instead of red). Pass { color: "green" | "red" | ... } as the second
  // arg to flag a line.
  _log(msg, opts) {
    if (opts && opts.color) {
      this.log.push({ text: msg, color: opts.color });
    } else {
      this.log.push(msg);
    }
    if (this.log.length > 30) this.log.shift();
  }

  // -- State snapshot ---------------------------------------------

  getState(viewerId) {
    const properties = [];
    for (const [id, prop] of this.properties) {
      properties.push({
        id,
        owner: prop.owner,
        price: prop.price,
        type: prop.type,
        name: prop.name,
        group: prop.group || null,
        bananaPile: prop.bananaPile || 0,
      });
    }

    // Send board layout so frontend can render shuffled tiles
    const groupOrder = [
      "brown",
      "lightblue",
      "pink",
      "orange",
      "red",
      "yellow",
      "green",
      "darkblue",
      "railroad",
    ];
    const groupLetters = {
      pink: "LF",
      lightblue: "BJ",
      red: "RD",
      yellow: "CV",
      orange: "GF",
      darkblue: "GM",
    };
    const boardLayout = this.board.map((space, i) => {
      const entry = { id: i, type: space.type };
      if (space.name) entry.name = space.name;
      if (space.amount) entry.amount = space.amount;
      if (space.growPct != null) entry.growPct = space.growPct;
      // Note: expose the GROW tile's 0-7 label so the Grow Chart can
      // track it without parsing the display name.
      if (
        space.type === "grow" &&
        this.growTileLabels &&
        this.growTileLabels.has(i)
      ) {
        entry.growLabel = this.growTileLabels.get(i);
      }
      if (space.buyable) {
        entry.tileName = space.buyable.name;
        entry.group = space.buyable.group || null;
        entry.price = space.buyable.price;
        const g = space.buyable.group;
        if (g && groupLetters[g] && this.tileLabelNumbers) {
          const num = this.tileLabelNumbers.get(i);
          if (num !== undefined) entry.tileLabel = groupLetters[g] + num;
        }
      }
      return entry;
    });

    // Note: grow tiles revealed (by landing) by ANY player. The Owned-Farms
    // chart anchors each farm to the
    // nearest such grow, so grouping matches how grows actually fire.
    const genuineRevealedGrows = this._genuineRevealedGrowPositions();

    return {
      gameId: this.gameId,
      state: this.state,
      admin: this.admin,
      isPublic: this.isPublic,
      maxPlayers: this.maxPlayers,
      startingMoney: this.startingMoney,
      bombMode: this.bombMode,
      bombCost: this.bombCost,
      noAuctionTimer: this.noAuctionTimer,
      monkeyPoker: this.monkeyPoker,
      superBananaPrice: this.superBananaPrice,
      farmAuctionTimer: this.farmAuctionTimer,
      turn: this.turn,
      currentPlayer: this.getCurrentPlayer(),
      players: this.players.map((p) => {
        const isViewer = p.id === viewerId;
        const hidePet = this.state === "waiting" && !isViewer && p.pet;
        return {
          ...p,
          revealedTiles: [...p.revealedTiles],
          // clientId is a private reconnect token — never broadcast it.
          clientId: undefined,
          pet: hidePet ? "hidden" : p.pet,
          petCooldown: hidePet ? 0 : p.petCooldown,
          pendingPet: p.pendingPet ? p.pendingPet.type : null,
          // Your armed item is private until it fires — only you see it.
          armedAbility: isViewer ? p.armedAbility || null : null,
        };
      }),
      dice: this.dice,
      diceRolled: this.diceRolled,
      properties,
      boardLayout,
      genuineRevealedGrows,
      auction: this.auction
        ? (() => {
            const a = this.auction;
            const isAcceptor = !!(
              a.acceptorIds && a.acceptorIds.includes(viewerId)
            );
            // Each viewer only ever sees their OWN accept/reject + top-up;
            // everyone else's status is withheld during the live phases.
            const bids = {};
            for (const [id, b] of Object.entries(a.bids)) {
              const entry = { isLander: id === a.landingPlayer };
              if (id === viewerId) {
                entry.placed = !!b.placed;
                entry.responded = !!b.responded;
                entry.accepted = b.accepted ?? null;
                entry.submittedTopup = !!b.submittedTopup;
                entry.topup = b.topup ?? null;
                entry.isAcceptor = isAcceptor;
              }
              bids[id] = entry;
            }
            // Farm visibility:
            //   - Lander always sees the farm.
            //   - 2v2: lander's teammate also sees the farm.
            //   - Everyone else (opponents, or any non-lander) bids blind
            //     during pitch/respond. Silent tie-break still hides it; the
            //     resolved auction broadcasts the position so the
            //     log/animation reads correctly.
            let hideFarm = false;
            if (
              (a.phase === "pitch" ||
                a.phase === "respond" ||
                a.phase === "silentbid") &&
              viewerId !== a.landingPlayer
            ) {
              const isTeamMate =
                this.gameMode === "2v2" &&
                this.teams &&
                this.getTeamOf(a.landingPlayer) &&
                this.getTeamOf(a.landingPlayer) === this.getTeamOf(viewerId);
              if (!isTeamMate) hideFarm = true;
            }
            return {
              position: hideFarm ? null : a.position,
              propName: hideFarm ? null : a.propName,
              propPrice: hideFarm ? null : a.propPrice,
              propGroup: hideFarm ? null : a.propGroup,
              hideFarm,
              phase: a.phase, // 'pitch' | 'respond' | 'silentbid'
              sealedBid: !!a.sealedBid,
              // Buy Now price for the richest lander (null for everyone else).
              buyNowPrice: this._buyNowPrice(viewerId),
              landingPlayer: a.landingPlayer,
              magicUser: a.magicUser || null,
              landerOpenBid: a.landerOpenBid ?? null,
              respondDeadline: a.respondDeadline || null,
              respondStartTime: a.respondStartTime || null,
              silentDeadline: a.silentDeadline || null,
              silentStartTime: a.silentStartTime || null,
              iAmAcceptor: isAcceptor,
              bids,
            };
          })()
        : null,
      lastResolvedAuction: this.lastResolvedAuction || null,
      superBananaPending: this.superBananaPending
        ? {
            superBananaPos: this.superBananaPending.superBananaPos,
            playerId: this.superBananaPending.playerId,
            awaitingPick: !!this.superBananaPending.awaitingPick,
          }
        : null,
      // Private hideout marker: only the player who hid the Super Banana sees
      // its position (rendered as a rainbow cover on that hidden tile).
      superBananaHintPos:
        this.superBananaHint && this.superBananaHint.playerId === viewerId
          ? this.superBananaHint.pos
          : null,
      vineSwing: this.vineSwing || null,
      autoEndDelay: this.autoEndDelay || false,
      autoEndDelayMs: this.autoEndDelayMs || 0,
      petCoinFlip: this.petCoinFlip || null,
      petResolving: this.petResolving || false,
      petTurnDelay: this.petTurnDelay || false,
      petUsedThisTurn: this.petUsedThisTurn || false,
      lastPetUsed: this.lastPetUsed || null,
      poker: this.poker ? this._getPokerState(viewerId) : null,
      revealAccepted: this.revealAccepted ? [...this.revealAccepted] : [],
      log: this.log.slice(-20),
      gameMode: this.gameMode,
      teams: this.teams,
      teamCoinFlip: this.teamCoinFlip || null,
      bombWinner: this.bombWinner || null,
      bananaLoser: this.bananaLoser || null,
      bombs: this.bombs
        .filter((b) => b.placedBy === viewerId)
        .map((b) => ({
          position: b.position,
          turnsLeft: b.turnsLeft,
          pending: !!b.pending,
        })),
      lastExplosion: this.lastExplosion || null,
      lastDefuse: this.lastDefuse || null,
      diceMatchTiles: this.diceMatchTiles || null,
      diceMatchGrownAmounts: this.diceMatchGrownAmounts || null,
      diceMatchEarlyPickup: this.diceMatchEarlyPickup != null ? this.diceMatchEarlyPickup : null,
      growSquatterSteals: this.growSquatterSteals || null,
      lastGrowFired: this.lastGrowFired || null,
      lastGrowActivated: this.lastGrowActivated || null,
      lastStartPick: this.lastStartPick || null,
      lastTeleport: this.lastTeleport || null,
      lastTileSwap: this.lastTileSwap || null,
      pendingTileShuffles: Array.isArray(this.pendingTileShuffles)
        ? this.pendingTileShuffles.map((p) => ({
            color: p.color,
            leavingName: p.leavingName,
            positions: [...p.positions],
            endsAt: p.endsAt,
          }))
        : null,
      lastTileShuffle: this.lastTileShuffle || null,
      cardUsedThisTurn: !!this.cardUsedThisTurn,
      superBananaWin: this.superBananaWin || null,
      sellListings: this.sellListings.map((l) => ({ ...l })),
      lobbyReady: this._lobbyReady ? [...this._lobbyReady] : [],
      // item auction
      itemAuctionEnabled: !!this.itemAuctionEnabled,
      itemAuctionTimer: this.itemAuctionTimer,
      itemAuctionStartValue: this.itemAuctionStartValue,
      itemAuctionCounter: this.itemAuctionCounter,
      itemAuction: this._serializeItemAuction(viewerId),
    };
  }

  _serializeItemAuction(viewerId) {
    const a = this.itemAuction;
    if (!a) return null;
    // The spun item is secret until the result; only the starter sees it
    // during wheel/pitch/respond/silentbid.
    const revealItem = a.phase === "result" || viewerId === a.startedBy;
    const isAcceptor = !!(a.acceptorIds && a.acceptorIds.includes(viewerId));
    const myBid = a.bids && a.bids[viewerId] ? a.bids[viewerId] : null;
    return {
      phase: a.phase, // 'wheel' | 'pitch' | 'respond' | 'silentbid' | 'result'
      sealedBid: !!a.sealedBid,
      item: revealItem ? a.item || null : null,
      startedBy: a.startedBy || null,
      wheelStartedAt: a.wheelStartedAt || null,
      wheelEndsAt: a.wheelEndsAt || null,
      listPrice: a.listPrice ?? null,
      respondDeadline: a.respondDeadline || null,
      respondStartTime: a.respondStartTime || null,
      silentDeadline: a.silentDeadline || null,
      silentStartTime: a.silentStartTime || null,
      participantCount: (a.participantIds || []).length,
      excludedIds: a.excludedIds || [],
      iAmStarter: viewerId === a.startedBy,
      iAmParticipant: !!(
        a.participantIds && a.participantIds.includes(viewerId)
      ),
      iAmExcluded: !!(a.excludedIds && a.excludedIds.includes(viewerId)),
      iAmAcceptor: isAcceptor,
      // Viewer's own status only — never leak others' accept/reject or top-ups.
      myResponded: myBid ? !!myBid.responded : false,
      myAccepted: myBid ? (myBid.accepted ?? null) : null,
      mySubmittedTopup: myBid ? !!myBid.submittedTopup : false,
      myTopup: myBid ? (myBid.topup ?? null) : null,
      itemAuctionTimer: this.itemAuctionTimer,
      result: a.result || null, // winner + price only
    };
  }

  _getPokerState(viewerId) {
    const poker = this.poker;
    const isShowdown = poker.round === "showdown";
    const players = {};
    for (const [id, p] of Object.entries(poker.players)) {
      players[id] = {
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        cards: id === viewerId || isShowdown ? p.cards : null,
      };
    }
    return {
      monkeyPoker: poker.monkeyPoker || false,
      bbPlayer: poker.bbPlayer,
      sbPlayer: poker.sbPlayer,
      communityCards: poker.communityCards,
      pot: poker.pot,
      currentBet: poker.currentBet,
      lastRaiseSize: poker.lastRaiseSize || 0,
      round: poker.round,
      currentTurn: poker.currentTurn,
      resolved: poker.resolved,
      winner: poker.winner,
      bbHandName: poker.bbHandName,
      sbHandName: poker.sbHandName,
      players,
    };
  }
}

module.exports = { MonkeyBusinessGame, BOARD, PET_TYPES };

