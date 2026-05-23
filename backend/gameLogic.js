// --- Monkey Bidniz Board Game Logic ----------------------------
// 52 spaces, 4 corners at 0/13/26/39, 12 non-corner per side

const BOARD_SIZE = 52;
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

const PROPERTIES = [
  // Cavendish (12)
  {
    id: 1,
    name: "CV1",
    group: "yellow",
    price: 40,
    rent: [40, 200, 600, 1800, 3200, 5000],
  },
  {
    id: 3,
    name: "CV2",
    group: "yellow",
    price: 40,
    rent: [40, 200, 600, 1800, 3200, 4500],
  },
  {
    id: 4,
    name: "CV3",
    group: "yellow",
    price: 40,
    rent: [40, 200, 600, 1600, 2800, 3800],
  },
  {
    id: 15,
    name: "CV4",
    group: "yellow",
    price: 40,
    rent: [40, 200, 600, 1600, 2800, 3800],
  },
  {
    id: 35,
    name: "CV5",
    group: "yellow",
    price: 40,
    rent: [40, 187, 533, 1467, 2533, 3333],
  },
  {
    id: 47,
    name: "CV6",
    group: "yellow",
    price: 40,
    rent: [40, 187, 533, 1467, 2533, 3333],
  },
  // Blue Java (7)
  {
    id: 6,
    name: "BJ1",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1200, 3600, 5333, 7333],
  },
  {
    id: 7,
    name: "BJ2",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1200, 3600, 5333, 7333],
  },
  {
    id: 9,
    name: "BJ3",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1200, 3600, 5333, 7333],
  },
  {
    id: 10,
    name: "BJ4",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1000, 3000, 4500, 6000],
  },
  {
    id: 11,
    name: "BJ5",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 960, 2800, 4000, 5200],
  },
  {
    id: 19,
    name: "BJ6",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1200, 3600, 5333, 7333],
  },
  {
    id: 32,
    name: "BJ7",
    group: "lightblue",
    price: 80,
    rent: [80, 400, 1200, 3600, 5333, 7333],
  },
  // Red Dacca (5)
  {
    id: 14,
    name: "RD1",
    group: "red",
    price: 160,
    rent: [160, 800, 2400, 7200, 10000, 12000],
  },
  {
    id: 16,
    name: "RD2",
    group: "red",
    price: 160,
    rent: [160, 800, 2400, 7200, 10000, 12000],
  },
  {
    id: 17,
    name: "RD3",
    group: "red",
    price: 160,
    rent: [160, 800, 2400, 6667, 9333, 12000],
  },
  {
    id: 18,
    name: "RD4",
    group: "red",
    price: 160,
    rent: [160, 800, 2286, 6286, 8571, 10857],
  },
  // Lady Finger (5)
  {
    id: 20,
    name: "LF1",
    group: "pink",
    price: 160,
    rent: [160, 800, 2286, 6286, 8571, 10857],
  },
  {
    id: 22,
    name: "LF2",
    group: "pink",
    price: 160,
    rent: [160, 800, 2286, 6286, 8571, 10857],
  },
  {
    id: 23,
    name: "LF3",
    group: "pink",
    price: 160,
    rent: [160, 800, 2200, 6000, 8000, 10000],
  },
  {
    id: 24,
    name: "LF4",
    group: "pink",
    price: 160,
    rent: [160, 800, 2133, 5778, 7556, 9333],
  },
  {
    id: 27,
    name: "CV7",
    group: "yellow",
    price: 40,
    rent: [40, 200, 556, 1556, 1944, 2333],
  },
  {
    id: 29,
    name: "CV8",
    group: "yellow",
    price: 40,
    rent: [40, 200, 556, 1556, 1944, 2333],
  },
  {
    id: 30,
    name: "CV9",
    group: "yellow",
    price: 40,
    rent: [40, 200, 600, 1500, 1850, 2200],
  },
  {
    id: 31,
    name: "CV10",
    group: "yellow",
    price: 40,
    rent: [40, 200, 582, 1455, 1773, 2091],
  },
  {
    id: 46,
    name: "CV11",
    group: "yellow",
    price: 40,
    rent: [40, 187, 533, 1467, 2533, 3333],
  },
  {
    id: 5,
    name: "CV12",
    group: "yellow",
    price: 40,
    rent: [40, 171, 486, 1314, 2229, 2914],
  },
  // Gros Michel (4)
  {
    id: 33,
    name: "GM1",
    group: "darkblue",
    price: 320,
    rent: [320, 1600, 4800, 11636, 14182, 16727],
  },
  {
    id: 34,
    name: "GM2",
    group: "darkblue",
    price: 320,
    rent: [320, 1600, 4800, 11333, 13667, 16000],
  },
  {
    id: 36,
    name: "GM3",
    group: "darkblue",
    price: 320,
    rent: [320, 1600, 4736, 11200, 13440, 15680],
  },
  {
    id: 37,
    name: "GM4",
    group: "darkblue",
    price: 320,
    rent: [320, 1576, 4504, 10667, 12741, 14815],
  },
  // Red Dacca (5th)
  {
    id: 40,
    name: "RD5",
    group: "red",
    price: 160,
    rent: [160, 800, 2240, 6133, 8267, 10400],
  },
  // Lady Finger (5th)
  {
    id: 41,
    name: "LF5",
    group: "pink",
    price: 160,
    rent: [160, 800, 2105, 5684, 7368, 9053],
  },
  // Goldfinger (3)
  {
    id: 48,
    name: "GF1",
    group: "orange",
    price: 480,
    rent: [480, 2400, 6857, 15086, 17829, 20571],
  },
  {
    id: 49,
    name: "GF2",
    group: "orange",
    price: 480,
    rent: [480, 2149, 6286, 14286, 16571, 20000],
  },
  {
    id: 51,
    name: "GF3",
    group: "orange",
    price: 480,
    rent: [480, 1920, 5760, 13440, 16320, 19200],
  },
];

// Build BOARD with buyable data embedded in each tile
const _BUYABLE_MAP = new Map();
PROPERTIES.forEach((p) => _BUYABLE_MAP.set(p.id, { ...p, type: "property" }));

const BOARD = [
  // -- Bottom row: GO -> JAIL (positions 0-12) --
  { id: 0, name: "\ud83c\udf34 GROW 25%", type: "grow", growPct: 0.25 },
  { id: 1, type: "property", buyable: _BUYABLE_MAP.get(1) },
  { id: 2, name: "\ud83c\udf4c -10%", type: "tax10" },
  { id: 3, type: "property", buyable: _BUYABLE_MAP.get(3) },
  { id: 4, type: "property", buyable: _BUYABLE_MAP.get(4) },
  { id: 5, type: "property", buyable: _BUYABLE_MAP.get(5) },
  { id: 6, type: "property", buyable: _BUYABLE_MAP.get(6) },
  { id: 7, type: "property", buyable: _BUYABLE_MAP.get(7) },
  {
    id: 8,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  { id: 9, type: "property", buyable: _BUYABLE_MAP.get(9) },
  { id: 10, type: "property", buyable: _BUYABLE_MAP.get(10) },
  { id: 11, type: "property", buyable: _BUYABLE_MAP.get(11) },
  {
    id: 12,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  // -- Left column: CAGE -> BANANA BREAK (positions 13-25) --
  { id: 13, name: "\ud83c\udf34 GROW 50%", type: "grow", growPct: 0.5 },
  { id: 14, type: "property", buyable: _BUYABLE_MAP.get(14) },
  { id: 15, type: "property", buyable: _BUYABLE_MAP.get(15) },
  { id: 16, type: "property", buyable: _BUYABLE_MAP.get(16) },
  { id: 17, type: "property", buyable: _BUYABLE_MAP.get(17) },
  { id: 18, type: "property", buyable: _BUYABLE_MAP.get(18) },
  { id: 19, type: "property", buyable: _BUYABLE_MAP.get(19) },
  { id: 20, type: "property", buyable: _BUYABLE_MAP.get(20) },
  {
    id: 21,
    name: "\u2b50",
    type: "special",
    buyable: {
      name: "\u2b50 Super Banana",
      type: "property",
      group: "mushroom",
      price: 7777,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  { id: 22, type: "property", buyable: _BUYABLE_MAP.get(22) },
  { id: 23, type: "property", buyable: _BUYABLE_MAP.get(23) },
  { id: 24, type: "property", buyable: _BUYABLE_MAP.get(24) },
  { id: 25, name: "Vine Swing", type: "bus" },
  // -- Top row: BANANA BREAK -> GO TO CAGE (positions 26-38) --
  { id: 26, name: "\ud83c\udf34 GROW 75%", type: "grow", growPct: 0.75 },
  { id: 27, type: "property", buyable: _BUYABLE_MAP.get(27) },
  {
    id: 28,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  { id: 29, type: "property", buyable: _BUYABLE_MAP.get(29) },
  { id: 30, type: "property", buyable: _BUYABLE_MAP.get(30) },
  { id: 31, type: "property", buyable: _BUYABLE_MAP.get(31) },
  { id: 32, type: "property", buyable: _BUYABLE_MAP.get(32) },
  { id: 33, type: "property", buyable: _BUYABLE_MAP.get(33) },
  { id: 34, type: "property", buyable: _BUYABLE_MAP.get(34) },
  { id: 35, type: "property", buyable: _BUYABLE_MAP.get(35) },
  { id: 36, type: "property", buyable: _BUYABLE_MAP.get(36) },
  { id: 37, type: "property", buyable: _BUYABLE_MAP.get(37) },
  {
    id: 38,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  // -- Right column: GO TO CAGE -> GO BANANAS (positions 39-51) --
  { id: 39, name: "\ud83c\udf34 GROW 100%", type: "grow", growPct: 1.0 },
  { id: 40, type: "property", buyable: _BUYABLE_MAP.get(40) },
  { id: 41, type: "property", buyable: _BUYABLE_MAP.get(41) },
  { id: 42, name: "+500", type: "freebananas" },
  {
    id: 43,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 44,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  {
    id: 45,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  { id: 46, type: "property", buyable: _BUYABLE_MAP.get(46) },
  { id: 47, type: "property", buyable: _BUYABLE_MAP.get(47) },
  { id: 48, type: "property", buyable: _BUYABLE_MAP.get(48) },
  { id: 49, type: "property", buyable: _BUYABLE_MAP.get(49) },
  {
    id: 50,
    name: "\ud83c\udf35",
    type: "desert",
    buyable: {
      name: "\ud83c\udf35",
      type: "property",
      group: "desert",
      price: 0,
      rent: [0, 0, 0, 0, 0, 0],
    },
  },
  { id: 51, type: "property", buyable: _BUYABLE_MAP.get(51) },
];

// Legacy lookup (kept for exports)
const BUYABLE = _BUYABLE_MAP;

// --- Simple Mode Board ---------------------------------------------
// 40 farm tiles (yields 10..400 in steps of 10, all "simple" group),
// 8 grow tiles (all 100%), 4 special tiles (vine swing, +500, -10% tax,
// super banana). No set/chain multipliers, no dice-match growth.
const SIMPLE_FARM_POSITIONS = [
  1, 3, 4, 5, 7, 8, 9, 10, 11, 12,
  14, 15, 16, 17, 18, 20, 22, 23, 24,
  27, 28, 29, 30, 31,
  33, 34, 35, 36, 37, 38,
  40, 41, 43, 44, 46, 47, 48, 49, 50, 51,
];
const SIMPLE_GROW_POSITIONS = [0, 6, 13, 19, 26, 32, 39, 45];

const PROPERTIES_SIMPLE = SIMPLE_FARM_POSITIONS.map((pos, idx) => ({
  id: pos,
  // F1..F40 — sequential index (there are 40 farms). Value/yield is the
  // separate `price` field (10..400), ascending with the index.
  name: `F${idx + 1}`,
  group: "simple",
  price: (idx + 1) * 10,
  rent: [0, 0, 0, 0, 0, 0],
}));

const _BUYABLE_MAP_SIMPLE = new Map();
PROPERTIES_SIMPLE.forEach((p) =>
  _BUYABLE_MAP_SIMPLE.set(p.id, { ...p, type: "property" }),
);

const BOARD_SIMPLE = (() => {
  const board = [];
  const growSet = new Set(SIMPLE_GROW_POSITIONS);
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (growSet.has(i)) {
      board.push({
        id: i,
        name: "🌴 GROW 100%",
        type: "grow",
        growPct: 1.0,
      });
    } else if (i === 2) {
      board.push({ id: i, name: "🍌 -10%", type: "tax10" });
    } else if (i === 21) {
      board.push({
        id: i,
        name: "⭐",
        type: "special",
        buyable: {
          name: "⭐ Super Banana",
          type: "property",
          group: "mushroom",
          price: 7777,
          rent: [0, 0, 0, 0, 0, 0],
        },
      });
    } else if (i === 25) {
      board.push({ id: i, name: "Vine Swing", type: "bus" });
    } else if (i === 42) {
      board.push({ id: i, name: "+500", type: "freebananas" });
    } else {
      board.push({
        id: i,
        type: "property",
        buyable: _BUYABLE_MAP_SIMPLE.get(i),
      });
    }
  }
  return board;
})();

// Simple-mode ability labels (emoji + name), shared by the shop log and the
// item auction. Keys are the canonical card types.
const SIMPLE_CARD_LABELS = {
  refreshDice: "🔄 Refresh Magic Dice",
  swapTiles: "🔀 Swap Tiles",
  scout: "🔭 Scout",
  teleport: "🌀 Teleport",
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

class MonopolyGame {
  constructor(
    gameId,
    maxPlayers,
    startingMoney,
    gameMode,
    teamTarget,
    bombMode,
    monkeyPoker,
    isPublic,
    itemAuctionOpts,
  ) {
    this.gameId = gameId;
    this.isPublic = !!isPublic;
    this.gameMode =
      gameMode === "teams" || gameMode === "simple" ? gameMode : "ffa";
    // Simple-mode item auction settings
    const ia = itemAuctionOpts || {};
    this.itemAuctionEnabled = ia.enabled !== false; // default ON
    this.itemAuctionVickrey = !!ia.vickrey; // default OFF
    this.itemAuctionTimer = Math.min(
      Math.max(Math.floor(ia.timerSec) || 15, 5),
      60,
    );
    this.itemAuctionStartValue = Math.min(
      Math.max(Math.floor(ia.startValue) || 50, 5),
      500,
    );
    this.itemAuctionCounter = this.itemAuctionStartValue;
    this.itemAuction = null; // { phase, item, deadline, bids, ... }
    this._itemAuctionTimer = null;
    this._itemAuctionQueued = false;
    // Simple-mode ability bookkeeping
    this.simpleCardUsedThisTurn = false; // at most one card use per turn
    this.lastTeleport = null; // { playerId, position, turn } — no-walk anim hint
    this.lastTileSwap = null; // { a, b, turn } — swap anim hint
    if (this.gameMode === "teams") {
      this.maxPlayers = 4;
    } else {
      this.maxPlayers = Math.min(Math.max(maxPlayers || 4, 2), 4);
    }
    this.startingMoney = Math.min(
      Math.max(Math.floor(startingMoney) || 2222, 100),
      99999,
    );
    this.bombMode = bombMode !== false; // on by default
    this.monkeyPoker = monkeyPoker !== false; // on by default
    this.noAuctionTimer = false;
    this.state = "waiting"; // waiting | playing | finished
    this.admin = null;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.turn = 0;
    this.dice = [0, 0];
    this.diceRolled = false;
    this.log = []; // recent action log
    this.properties = new Map();
    this.board =
      this.gameMode === "simple" ? [...BOARD_SIMPLE] : [...BOARD]; // will be shuffled on start
    this.auction = null;
    this._auctionTimer = null;
    this.mushroomPending = null; // { mushroomPos, swapPos } — waiting for 3s delay before swap
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
    this.teamTarget =
      this.gameMode === "teams"
        ? Math.min(Math.max(Math.floor(teamTarget) || 5000, 2000), 20000)
        : null;
  }

  _initProperties() {
    this.properties.clear();
    // Build properties map based on the (possibly shuffled) board
    for (let pos = 0; pos < this.board.length; pos++) {
      const space = this.board[pos];
      if (space.buyable) {
        this.properties.set(pos, {
          ...space.buyable,
          owner: null,
          bananaPile: 0,
        });
      }
    }
  }

  // -- Player management ------------------------------------------

  addPlayer(socketId, name) {
    if (this.state !== "waiting") return { error: "already_started" };
    if (this.players.length >= this.maxPlayers) return { error: "full" };
    if (!this.admin) this.admin = socketId;

    const allColors = ["brown", "golden", "silver", "red"];
    const taken = new Set(this.players.map((p) => p.color));
    const available = allColors.filter((c) => !taken.has(c));
    const color = available[Math.floor(Math.random() * available.length)];

    const player = {
      id: socketId,
      name: String(name).substring(0, 16) || "Player",
      color,
      position: 0,
      money: this.startingMoney,
      properties: [],
      bankrupt: false,
      revealedTiles: new Set([START_POSITION]),
      // Simple mode only offers the strong pet ("Magic Dice") — auto-select it
      // so no pet-picker UI is needed.
      pet: this.gameMode === "simple" ? "strong" : null,
      petCooldown: 0,
      pendingPet: null,
      bomb: 0,
      hasRolled: false,
      startPickPending: false,
      // Simple mode "Magic Dice" upgrade level. Starts at 0 — players must
      // pay 1000🍌 to unlock the first step.
      magicDiceMaxSteps: 0,
      // Simple mode ability inventory. Stockpile, 1 use per card.
      cards: {
        refreshDice: 0,
        swapTiles: 0,
        scout: 0,
        teleport: 0,
      },
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
      settings.gameMode === "teams" ||
      settings.gameMode === "ffa" ||
      settings.gameMode === "simple"
    ) {
      if (this.gameMode !== settings.gameMode) {
        this.gameMode = settings.gameMode;
        this.board =
          this.gameMode === "simple" ? [...BOARD_SIMPLE] : [...BOARD];
        this._initProperties();
        // Simple mode auto-assigns the strong pet ("Magic Dice"); leaving
        // other modes wipes pets so players can re-pick from the full set.
        if (this.gameMode === "simple") {
          for (const p of this.players) {
            p.pet = "strong";
            p.magicDiceMaxSteps = 0;
          }
        } else {
          for (const p of this.players) {
            p.pet = null;
            p.magicDiceMaxSteps = 0;
          }
        }
      }
      if (this.gameMode === "teams") this.maxPlayers = 4;
    }
    if (settings.maxPlayers != null && this.gameMode !== "teams") {
      const mp = Math.min(Math.max(Math.floor(settings.maxPlayers) || 2, 2), 4);
      this.maxPlayers = Math.max(mp, this.players.length);
    }
    if (settings.teamTarget != null && this.gameMode === "teams") {
      this.teamTarget = Math.min(
        Math.max(Math.floor(settings.teamTarget) || 5000, 2000),
        20000,
      );
    }
    if (settings.bombMode != null) {
      this.bombMode = !!settings.bombMode;
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
    if (settings.itemAuctionVickrey != null) {
      this.itemAuctionVickrey = !!settings.itemAuctionVickrey;
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
    // Simple mode forces the strong pet ("Magic Dice") — ignore other choices.
    if (this.gameMode === "simple" && petType !== "strong") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    player.pet = petType;
    player.petCooldown = 0;
    return true;
  }

  usePetAbility(socketId, targetId) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt || !player.pet) return false;
    if (player.petCooldown > 0) return false;

    const petType = player.pet;
    const cooldown = PET_TYPES[petType].cooldown;

    // Energy pet: activate OFF-turn. Coin flip + move resolves at start of player's next turn.
    if (petType === "energy") {
      const cur = this.getCurrentPlayer();
      // Energy pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      // Cooldown is set when coin flip resolves at start of next turn, not here
      player.pendingPet = { type: "energy", cooldown };
      this.lastPetUsed = { playerId: player.id, playerName: player.name, petType: "energy" };
      this._log();
      return true;
    }

    // Strong pet: activate OFF-turn. Move forward 1 resolves at start of player's next turn (no coin flip).
    if (petType === "strong") {
      // Simple mode handles "Magic Dice" via useMagicDice() (on-turn activation,
      // pick a step count). The off-turn +1 flow is FFA/Teams only.
      if (this.gameMode === "simple") return false;
      const cur = this.getCurrentPlayer();
      // Strong pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      // Cooldown is set when effect resolves at start of next turn, not here
      player.pendingPet = { type: "strong", cooldown };
      this.lastPetUsed = { playerId: player.id, playerName: player.name, petType: "strong" };
      this._log();
      return true;
    }

    // Devil (Magic Pet): activate OFF-turn. Coin flip + move resolves at start of player's next turn.
    if (petType === "magic") {
      // Magic pet requires the player to have rolled at least once
      if (!player.hasRolled) return false;
      const cur = this.getCurrentPlayer();
      // Magic pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      player.pendingPet = { type: "magic", cooldown };
      this.lastPetUsed = { playerId: player.id, playerName: player.name, petType: "magic" };
      this._log();
      return true;
    }

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
        !this.mushroomPending
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
    target.position = (target.position + 1) % BOARD_SIZE;
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
      player.position = (player.position + 1) % BOARD_SIZE;
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
    player.position = (player.position + 1) % BOARD_SIZE;
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

    // If an interactive element started (auction, poker, vine swing, mushroom),
    // stop pet resolution and let it play out. Pet counts as the roll.
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending) {
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
      player.position = (player.position + 1) % BOARD_SIZE;
      player.revealedTiles.add(player.position);
      this._collectBananasOnPath(player, oldPos, player.position);
      this._log(
        `\u{1F984} ${player.name}'s Magic Pet flipped HEADS \u2014 moved forward 1!`,
      );
    } else {
      player.position = (player.position - 1 + BOARD_SIZE) % BOARD_SIZE;
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

    if (this.auction || this.poker || this.vineSwing || this.mushroomPending) {
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

  _scheduleAutoEnd(player, delayMs, displayDelayMs) {
    if (this._autoEndTimer) clearTimeout(this._autoEndTimer);
    this.autoEndDelay = true;
    this.autoEndDelayMs = displayDelayMs != null ? displayDelayMs : delayMs;
    this._autoEndTimer = setTimeout(() => {
      this._autoEndTimer = null;
      this.autoEndDelay = false;
      this.autoEndDelayMs = 0;
      const cur = this.getCurrentPlayer();
      if (cur && cur.id === player.id && this.diceRolled) {
        this.endTurn(player.id);
      }
      if (this.onUpdate) this.onUpdate();
    }, delayMs);
  }

  _cancelAutoEnd() {
    if (this._autoEndTimer) {
      clearTimeout(this._autoEndTimer);
      this._autoEndTimer = null;
      this.autoEndDelay = false;
      this.autoEndDelayMs = 0;
    }
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

    // If this player is in an active auction, mark them as passed
    if (this.auction && this.auction.bids[socketId]) {
      this.auction.bids[socketId].passed = true;
      this._checkPhaseComplete();
    }

    // If this player is in an active item auction, force-submit a 0 bid
    // so the auction doesn't hang waiting on them.
    if (this.itemAuction && this.itemAuction.bids[socketId]) {
      const b = this.itemAuction.bids[socketId];
      if (!b.submitted) {
        b.submitted = true;
        b.autoPass = true;
        b.amount = 0;
        if (this.itemAuction.phase === "bidding") {
          const allIn = Object.values(this.itemAuction.bids).every(
            (x) => x.submitted,
          );
          if (allIn) {
            this._resolveItemAuction();
          }
        }
      }
    }

    // Track whether this player is the one whose turn it currently is
    const wasCurrentPlayer =
      this.state === "playing" && idx === this.currentPlayerIndex;
    const leavingName = this.players[idx].name;

    // Release properties and clear banana piles
    for (const pid of this.players[idx].properties) {
      const prop = this.properties.get(pid);
      if (prop) {
        prop.owner = null;
        prop.bananaPile = 0;
      }
    }

    // Remove any pending magic pets that involve this player (as caster or target)
    this.pendingMagicPets = this.pendingMagicPets.filter(
      (mp) => mp.userId !== socketId && mp.targetId !== socketId,
    );

    this.players.splice(idx, 1);
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
      if (this.mushroomPending && this.mushroomPending.playerId === socketId)
        this.mushroomPending = null;
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
    this.board =
      this.gameMode === "simple" ? [...BOARD_SIMPLE] : [...BOARD];
    if (this._auctionTimer) clearTimeout(this._auctionTimer);
    this.auction = null;
    this._auctionTimer = null;
    this.mushroomPending = null;
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
    this.bombSelfDamage = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
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
    if (this._itemAuctionTimer) {
      clearTimeout(this._itemAuctionTimer);
      this._itemAuctionTimer = null;
    }
    this.itemAuction = null;
    this._itemAuctionQueued = false;
    this.itemAuctionCounter = this.itemAuctionStartValue;
    this.simpleCardUsedThisTurn = false;
    this.lastTeleport = null;
    this.lastTileSwap = null;
    // Reset players to lobby state
    for (const p of this.players) {
      p.position = 0;
      p.money = this.startingMoney;
      p.properties = [];
      p.bankrupt = false;
      p.revealedTiles = new Set([START_POSITION]);
      p.pet = null;
      p.petCooldown = 0;
      p.pendingPet = null;
      p.bomb = 0;
      p.hasRolled = false;
      p.startPickPending = false;
      p.magicDiceMaxSteps = 0;
      p.cards = {
        refreshDice: 0,
        swapTiles: 0,
        scout: 0,
        teleport: 0,
      };
    }
    this._initProperties();
  }

  startGame(socketId) {
    if (socketId !== this.admin || this.players.length < 2) return false;
    if (this.gameMode === "teams" && this.players.length !== 4) return false;
    // All players must have selected a pet
    if (this.players.some((p) => !p.pet)) return false;
    // Assign teams in team mode (players 0,1 = Team A, players 2,3 = Team B)
    if (this.gameMode === "teams") {
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
    // Simple mode: monkeys start off-board. Each player picks their first tile.
    if (this.gameMode === "simple") {
      this._assignSimpleGrowLabels();
      for (const p of this.players) {
        p.startPickPending = true;
        p.revealedTiles = new Set();
      }
    }
    this._log(`Tiles shuffled! Game started! \uD83C\uDF4C`);
    return true;
  }

  _initTileLabelNumbers() {
    this.tileLabelNumbers = new Map();
    // Simple mode doesn't use group-letter labels (each tile shows its own yield)
    if (this.gameMode === "simple") return;
    // Collect board positions per group
    const groupPositions = {};
    for (let i = 0; i < this.board.length; i++) {
      const space = this.board[i];
      if (space.buyable) {
        const g = space.buyable.group;
        if (g && g !== "desert" && g !== "mushroom") {
          if (!groupPositions[g]) groupPositions[g] = [];
          groupPositions[g].push(i);
        }
      }
    }
    // For each group, create [1..N], shuffle it, and assign to positions
    for (const [g, positions] of Object.entries(groupPositions)) {
      const nums = positions.map((_, idx) => idx + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }
      for (let i = 0; i < positions.length; i++) {
        this.tileLabelNumbers.set(positions[i], nums[i]);
      }
    }
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

  rollDice(socketId, diceCount) {
    this.lastExplosion = null;
    this.bombSelfDamage = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
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

    // Validate paid dice override (1 or 3)
    let numDice = 2;
    if (diceCount === 1 && cur.money >= 300) {
      cur.money -= 300;
      numDice = 1;
    } else if (diceCount === 3 && cur.money >= 300) {
      cur.money -= 300;
      numDice = 3;
    }

    const rolls = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    this.dice = rolls;
    this.diceRolled = true;
    cur.hasRolled = true;
    this.petCoinFlip = null;

    // Tick pet cooldowns for all players
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }

    const diceSum = rolls.reduce((a, b) => a + b, 0);
    // Simple-mode item auction: every dice value subtracts from the counter.
    this._subtractItemAuctionCounter(diceSum);
    const oldPos = cur.position;
    cur.position = (cur.position + diceSum) % BOARD_SIZE;
    cur.revealedTiles.add(cur.position);

    // Collect own banana piles on crossed/landed tiles & steal opponent piles on landing
    const crossedFreeBananas = this._collectBananasOnPath(
      cur,
      oldPos,
      cur.position,
    );

    // Award crossed freebananas money immediately so that landing checks (e.g. super banana
    // affordability) use the correct post-collection balance. The log/UI notification is still
    // deferred below so the animation fires at the right visual moment.
    if (crossedFreeBananas.length > 0) {
      cur.money += crossedFreeBananas.length * 500;
    }

    // Dice-match grow: if dice sum matches a farm label number you own, 100% grow
    this._processDiceMatchGrow(cur, diceSum);
    // Simple mode: dice sum 0..7 also fires the matching labeled GROW tile.
    this._processSimpleRolledGrow(cur, diceSum);

    // Flag early pickup: player was sitting on a dice-match tile they own
    if (this.diceMatchTiles && this.diceMatchTiles.includes(oldPos)) {
      const prop = this.properties.get(oldPos);
      if (prop && prop.owner === cur.id) {
        this.diceMatchEarlyPickup = oldPos;
      }
    }

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
      const pathSteps = (cur.position - oldPos + BOARD_SIZE) % BOARD_SIZE;
      for (let s = 1; s <= pathSteps; s++) {
        pathTiles.add((oldPos + s) % BOARD_SIZE);
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
      !this.mushroomPending
    ) {
      // Defer the log/UI notification for crossed freebananas until after walk animation
      // (money was already applied above so landing checks like super banana use the right balance)
      setTimeout(() => {
        for (const pos of crossedFreeBananas) {
          this._log(
            `${cur.name} crossed Free Bananas +500 and collected 500\ud83c\udf4c! \ud83c\udf4c`,
          );
          if (this.onUpdate) this.onUpdate();
        }
      }, walkAnimMs);
      this._scheduleAutoEnd(cur, walkAnimMs + 2000, 2000);
    }

    return { dice: this.dice, moved: true };
  }

  // Simple-mode Magic Dice: replaces the normal dice roll with a player-chosen
  // step count (0..magicDiceMaxSteps). 10-roll cooldown. Walks normally and
  // fires GROW(steps) just like a regular roll. Step 0 is always available
  // regardless of upgrade level — the player stays put but still fires
  // GROW 0 (if labeled) and skips the landing effect on their current tile.
  useMagicDice(socketId, steps) {
    if (this.gameMode !== "simple") return null;
    if (this.state !== "playing") return null;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || cur.bankrupt) return null;
    if (this.diceRolled) return null;
    if (this.petResolving) return null;
    if (cur.startPickPending) return null;
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
      return null;
    if (this.itemAuction) return null;
    const max = Number(cur.magicDiceMaxSteps) || 0;
    const n = Math.floor(steps);
    if (!Number.isFinite(n) || n < 0 || n > max) return null;
    if ((cur.petCooldown || 0) > 0) return null;

    // Reset per-turn transient state (mirrors rollDice).
    this.lastExplosion = null;
    this.bombSelfDamage = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;

    this.dice = [n];
    this.diceRolled = true;
    cur.hasRolled = true;
    this.petCoinFlip = null;
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }
    cur.petCooldown = 10;
    this.petUsedThisTurn = true;
    // Simple-mode item auction: Magic Dice counts as a dice roll.
    this._subtractItemAuctionCounter(n);
    this.lastPetUsed = {
      playerId: cur.id,
      playerName: cur.name,
      petType: "strong",
    };
    this._log(`🎲 ${cur.name} used Magic Dice and chose ${n}!`);

    // Step 0 — stay put, fire GROW 0 if appropriate, skip landing.
    if (n === 0) {
      this._processSimpleRolledGrow(cur, 0);
      if (
        !this.auction &&
        !this.vineSwing &&
        !this.poker &&
        !this.mushroomPending
      ) {
        this._scheduleAutoEnd(cur, 2000, 2000);
      }
      return { dice: this.dice, moved: false };
    }

    const oldPos = cur.position;
    cur.position = (cur.position + n) % BOARD_SIZE;
    cur.revealedTiles.add(cur.position);

    const crossedFreeBananas = this._collectBananasOnPath(
      cur,
      oldPos,
      cur.position,
    );
    if (crossedFreeBananas.length > 0) {
      cur.money += crossedFreeBananas.length * 500;
    }

    // Simple mode: dice value of n fires GROW n.
    this._processSimpleRolledGrow(cur, n);

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
      !this.mushroomPending
    ) {
      setTimeout(() => {
        for (const _ of crossedFreeBananas) {
          this._log(
            `${cur.name} crossed Free Bananas +500 and collected 500🍌! 🍌`,
          );
          if (this.onUpdate) this.onUpdate();
        }
      }, walkAnimMs);
      this._scheduleAutoEnd(cur, walkAnimMs + 2000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  // Simple-mode Magic Dice upgrade: 1000🍌 per +1 step (no cap).
  // Starts at 0 — the first upgrade unlocks the picker.
  upgradeMagicDice(socketId) {
    if (this.gameMode !== "simple") return false;
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    if (player.money < 1000) return false;
    const max = Number(player.magicDiceMaxSteps) || 0;
    player.money -= 1000;
    player.magicDiceMaxSteps = max + 1;
    this._log(
      `🎲 ${player.name} upgraded Magic Dice to ${player.magicDiceMaxSteps} steps! (-1000🍌)`,
    );
    return true;
  }

  // -- Simple Mode Abilities (won via the item auction) ------------
  // Four abilities, won via the item auction, stockpiled (hold multiple),
  // consumed one per use:
  //   refreshDice — reset your Magic Dice cooldown. Usable ANY time (even on
  //                 another player's turn). Requires being on cooldown. Free.
  //   swapTiles   — swap two unoccupied tiles. Tile type, owner, banana pile,
  //                 grow label and reveal-status all travel. Free action.
  //   scout       — reveal one hidden tile, to you only. Free action.
  //   teleport    — move to any tile (no walking); landing effects fire.
  //                 Replaces your dice roll for the turn.
  // "Free action" = does NOT consume your dice roll. At most one card may be
  // used per turn (refresh used OFF-turn is exempt — gated by the cooldown).

  canUseSimpleCard(player, cardType) {
    if (!player || player.bankrupt) return false;
    if (!player.cards || player.cards[cardType] === undefined) return false;
    if (player.cards[cardType] <= 0) return false;
    if (cardType === "refreshDice") {
      return (player.petCooldown || 0) > 0;
    }
    if (cardType === "scout") {
      return (player.revealedTiles ? player.revealedTiles.size : 0) < BOARD_SIZE;
    }
    if (cardType === "swapTiles" || cardType === "teleport") {
      return true;
    }
    return false;
  }

  buyCard(socketId, cardType) {
    if (this.gameMode !== "simple") return false;
    if (this.state !== "playing") return false;
    if (!["refreshDice", "swapTiles", "scout", "teleport"].includes(cardType)) {
      return false;
    }
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    const price = 500;
    if (player.money < price) return false;
    if (!player.cards) {
      player.cards = { refreshDice: 0, swapTiles: 0, scout: 0, teleport: 0 };
    }
    player.money -= price;
    player.cards[cardType] = (player.cards[cardType] || 0) + 1;
    this._log(
      `${player.name} bought a ${SIMPLE_CARD_LABELS[cardType]} for ${price}🍌!`,
    );
    return true;
  }

  // Shared per-turn-start scrub used by useMagicDice / rollDice / teleport when
  // they replace a roll. Suppresses the dice-roll animation on the frontend.
  _beginCardTurn(cur) {
    this.lastExplosion = null;
    this.bombSelfDamage = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.petCoinFlip = null;
    cur.hasRolled = true;
    this.diceRolled = true;
    this.petUsedThisTurn = true;
    for (const p of this.players) {
      if (p.petCooldown > 0) p.petCooldown--;
    }
  }

  _isTileOccupied(pos) {
    return this.players.some(
      (p) => !p.bankrupt && !p.startPickPending && p.position === pos,
    );
  }

  // useCard accepts an optional `data` payload carrying ability targets:
  //   swapTiles  → { posA, posB }
  //   scout      → { pos }
  //   teleport   → { pos }
  //   refreshDice→ (none)
  useCard(socketId, cardType, data) {
    if (this.gameMode !== "simple") return null;
    if (this.state !== "playing") return null;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return null;
    if (!this.canUseSimpleCard(player, cardType)) return null;

    // refreshDice: usable any time (on or off turn). Never consumes the roll.
    if (cardType === "refreshDice") {
      if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
        return null;
      if (this.itemAuction) return null;
      if (this.petResolving) return null;
      const cur = this.getCurrentPlayer();
      const isMyTurn = !!(cur && cur.id === socketId);
      if (isMyTurn) {
        if (player.startPickPending) return null;
        if (this.simpleCardUsedThisTurn) return null;
      }
      player.cards[cardType] = Math.max(0, (player.cards[cardType] || 0) - 1);
      if (isMyTurn) this.simpleCardUsedThisTurn = true;
      return this._useRefreshDiceCard(player);
    }

    // swapTiles / scout / teleport: only on your turn, before rolling.
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return null;
    if (this.diceRolled) return null;
    if (this.petResolving) return null;
    if (cur.startPickPending) return null;
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
      return null;
    if (this.itemAuction) return null;
    if (this.simpleCardUsedThisTurn) return null;

    // Validate targets before spending the card.
    if (cardType === "swapTiles") {
      if (!this._validateSwapTargets(data)) return null;
    } else if (cardType === "scout") {
      if (!this._validateScoutTarget(cur, data)) return null;
    } else if (cardType === "teleport") {
      if (!this._validateTeleportTarget(data)) return null;
    } else {
      return null;
    }

    cur.cards[cardType] = Math.max(0, (cur.cards[cardType] || 0) - 1);
    this.simpleCardUsedThisTurn = true;

    if (cardType === "swapTiles")
      return this._useSwapTilesCard(cur, Math.floor(data.posA), Math.floor(data.posB));
    if (cardType === "scout") return this._useScoutCard(cur, Math.floor(data.pos));
    if (cardType === "teleport") return this._useTeleportCard(cur, Math.floor(data.pos));
    return null;
  }

  _validateSwapTargets(data) {
    if (!data) return false;
    const a = Math.floor(data.posA);
    const b = Math.floor(data.posB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a < 0 || a >= BOARD_SIZE || b < 0 || b >= BOARD_SIZE) return false;
    if (a === b) return false;
    if (this._isTileOccupied(a) || this._isTileOccupied(b)) return false;
    return true;
  }

  _validateScoutTarget(player, data) {
    if (!data) return false;
    const pos = Math.floor(data.pos);
    if (!Number.isFinite(pos) || pos < 0 || pos >= BOARD_SIZE) return false;
    if (player.revealedTiles.has(pos)) return false; // only hidden tiles
    return true;
  }

  _validateTeleportTarget(data) {
    if (!data) return false;
    const pos = Math.floor(data.pos);
    if (!Number.isFinite(pos) || pos < 0 || pos >= BOARD_SIZE) return false;
    return true; // can teleport anywhere (occupied tiles trigger poker)
  }

  _useRefreshDiceCard(player) {
    player.petCooldown = 0;
    this._log(`🔄 ${player.name} refreshed their Magic Dice cooldown!`);
    return { card: "refreshDice", moved: false };
  }

  _useScoutCard(player, pos) {
    player.revealedTiles.add(pos);
    // Keep the scouted location private — log without naming the tile.
    this._log(`🔭 ${player.name} scouted a hidden tile!`);
    return { card: "scout", moved: false, scoutedPos: pos };
  }

  // Swap two board positions. Tile contents (type/name), property (owner +
  // banana pile), grow label and per-player reveal-status all travel with the
  // tile. Requires both tiles unoccupied (validated by caller).
  _useSwapTilesCard(player, a, b) {
    const tmp = this.board[a];
    this.board[a] = this.board[b];
    this.board[b] = tmp;

    const propA = this.properties.get(a);
    const propB = this.properties.get(b);
    this.properties.delete(a);
    this.properties.delete(b);
    if (propB) this.properties.set(a, propB);
    if (propA) this.properties.set(b, propA);

    // Update every player's owned-position list.
    for (const p of this.players) {
      if (!p.properties) continue;
      p.properties = p.properties.map((pos) =>
        pos === a ? b : pos === b ? a : pos,
      );
    }

    // Swap grow-tile labels.
    if (this.growTileLabels) {
      const la = this.growTileLabels.get(a);
      const lb = this.growTileLabels.get(b);
      this.growTileLabels.delete(a);
      this.growTileLabels.delete(b);
      if (lb !== undefined) this.growTileLabels.set(a, lb);
      if (la !== undefined) this.growTileLabels.set(b, la);
    }

    // Reveal-status travels with the tile content.
    for (const p of this.players) {
      const hadA = p.revealedTiles.has(a);
      const hadB = p.revealedTiles.has(b);
      if (hadB) p.revealedTiles.add(a);
      else p.revealedTiles.delete(a);
      if (hadA) p.revealedTiles.add(b);
      else p.revealedTiles.delete(b);
    }

    this.lastTileSwap = { a, b, turn: this.turn };
    this._log(`🔀 ${player.name} swapped two tiles on the board!`);
    return { card: "swapTiles", moved: false, swap: { a, b } };
  }

  // Teleport: jump to any tile without walking. Landing effects fire fully
  // (grow, poker, mushroom, etc.). Replaces the dice roll for the turn.
  _useTeleportCard(cur, pos) {
    this._beginCardTurn(cur);
    this.dice = [0];
    cur.position = pos;
    cur.revealedTiles.add(pos);
    // Signal a no-walk teleport to the frontend (reuse the lastStartPick shape).
    this.lastTeleport = { playerId: cur.id, position: pos, turn: this.turn };
    this._log(`🌀 ${cur.name} teleported across the board!`);

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
    if (!this.auction && !this.vineSwing && !this.poker && !this.mushroomPending) {
      this._scheduleAutoEnd(cur, 1500, 2000);
    }
    return { card: "teleport", moved: true };
  }

  // -- Simple Mode Item Auction ---------------------------------------
  // Counter ticks down on every dice roll (regular dice, magic dice, banana
  // collector card). When it hits 0, after the turn fully ends, a wheel spins
  // and lands on one of 4 cards; all non-bankrupt players submit silent bids
  // (capped at their money), highest unique bidder wins. Ties at the top =
  // nobody wins. Counter resets to start value.

  _itemAuctionActive() {
    return !!(this.itemAuction);
  }

  _subtractItemAuctionCounter(amount) {
    if (this.gameMode !== "simple") return;
    if (!this.itemAuctionEnabled) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.itemAuctionCounter <= 0) return; // already pending
    this.itemAuctionCounter = Math.max(0, this.itemAuctionCounter - amount);
    if (this.itemAuctionCounter <= 0) {
      this._itemAuctionQueued = true;
    }
  }

  _maybeStartQueuedItemAuction() {
    if (!this._itemAuctionQueued) return;
    if (this._itemAuctionActive()) return;
    if (this.state !== "playing") return;
    if (this.gameMode !== "simple") return;
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
    const ITEMS = ["refreshDice", "swapTiles", "scout", "teleport"];
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const now = Date.now();
    const WHEEL_MS = 2800;
    const participants = this.players
      .filter((p) => !p.bankrupt)
      .map((p) => p.id);
    const bids = {};
    for (const id of participants) {
      const p = this.players.find((pl) => pl.id === id);
      const auto = !p || p.money <= 0;
      bids[id] = {
        submitted: auto,
        autoPass: auto,
        amount: auto ? 0 : null,
      };
    }
    this.itemAuction = {
      phase: "wheel",
      item,
      wheelStartedAt: now,
      wheelEndsAt: now + WHEEL_MS,
      deadline: null,
      bids,
      participantIds: participants,
      result: null,
    };
    const labels = this._itemAuctionLabels();
    this._log(`🎡 Item auction! The wheel is spinning... 🎡`);
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      this._beginItemAuctionBidding();
    }, WHEEL_MS);
  }

  _beginItemAuctionBidding() {
    const a = this.itemAuction;
    if (!a) return;
    if (this.state !== "playing") {
      this._cancelItemAuction();
      return;
    }
    const now = Date.now();
    const ms = (this.itemAuctionTimer || 15) * 1000;
    a.phase = "bidding";
    a.deadline = now + ms;
    const labels = this._itemAuctionLabels();
    this._log(`🎁 ${labels[a.item]} is up for auction! Submit a silent bid!`);
    // If everyone is auto-passed (all broke), resolve immediately.
    const anyAvailable = Object.values(a.bids).some((b) => !b.submitted);
    if (!anyAvailable) {
      this._resolveItemAuction();
      return;
    }
    if (this._itemAuctionTimer) clearTimeout(this._itemAuctionTimer);
    this._itemAuctionTimer = setTimeout(() => {
      this._itemAuctionTimer = null;
      this._resolveItemAuction();
    }, ms);
    if (this.onUpdate) this.onUpdate();
  }

  _itemAuctionLabels() {
    return { ...SIMPLE_CARD_LABELS };
  }

  submitItemBid(socketId, amount) {
    const a = this.itemAuction;
    if (!a) return false;
    if (a.phase !== "bidding") return false;
    if (!a.bids[socketId]) return false;
    if (a.bids[socketId].submitted) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 0) return false;
    const cap = Math.max(0, player.money || 0);
    const final = Math.min(n, cap);
    a.bids[socketId] = { submitted: true, autoPass: false, amount: final };
    // Early resolution: every participant has submitted.
    const allIn = Object.values(a.bids).every((b) => b.submitted);
    if (allIn) {
      if (this._itemAuctionTimer) {
        clearTimeout(this._itemAuctionTimer);
        this._itemAuctionTimer = null;
      }
      this._resolveItemAuction();
    }
    return true;
  }

  _resolveItemAuction() {
    const a = this.itemAuction;
    if (!a) return;
    // Backfill any unsubmitted bids as 0.
    for (const [id, b] of Object.entries(a.bids)) {
      if (!b.submitted) {
        a.bids[id] = { submitted: true, autoPass: true, amount: 0 };
      }
    }
    const entries = Object.entries(a.bids).map(([id, b]) => ({
      id,
      amount: b.amount || 0,
    }));
    // Find highest bid.
    let highest = -1;
    for (const e of entries) if (e.amount > highest) highest = e.amount;
    const top = entries.filter((e) => e.amount === highest);
    const labels = this._itemAuctionLabels();
    let result;
    if (top.length === 1) {
      const winnerId = top[0].id;
      const winner = this.players.find((p) => p.id === winnerId);
      // Vickrey: pay 2nd-highest, otherwise pay own bid.
      let pricePaid = highest;
      if (this.itemAuctionVickrey) {
        const sorted = entries
          .map((e) => e.amount)
          .sort((x, y) => y - x);
        pricePaid = sorted[1] != null ? sorted[1] : 0;
      }
      if (winner) {
        winner.money = Math.max(0, (winner.money || 0) - pricePaid);
        if (!winner.cards) {
          winner.cards = {
            refreshDice: 0,
            swapTiles: 0,
            scout: 0,
            teleport: 0,
          };
        }
        winner.cards[a.item] = (winner.cards[a.item] || 0) + 1;
        this._log(
          `🏆 ${winner.name} won ${labels[a.item]} for ${pricePaid}🍌!`,
        );
      }
      result = {
        winnerId,
        winnerName: winner ? winner.name : "?",
        pricePaid,
        tied: false,
      };
    } else {
      // Tie at the top (including any tie at 0) — nobody wins.
      const names = top
        .map((e) => this.players.find((p) => p.id === e.id)?.name || "?")
        .join(" & ");
      this._log(
        `🤝 Tie at ${highest}🍌 between ${names} — nobody wins ${labels[a.item]}!`,
      );
      result = {
        winnerId: null,
        winnerName: null,
        pricePaid: 0,
        tied: true,
        tiedAt: highest,
        tiedNames: names,
      };
    }
    // Reveal all bid amounts on result.
    result.bids = Object.entries(a.bids).map(([id, b]) => ({
      playerId: id,
      name: this.players.find((p) => p.id === id)?.name || "?",
      amount: b.amount || 0,
      autoPass: !!b.autoPass,
    }));
    a.phase = "result";
    a.result = result;
    a.deadline = null;
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
  }

  debugMove(socketId, targetPos) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || this.diceRolled || cur.bankrupt)
      return null;
    const pos = Math.max(0, Math.min(Math.floor(targetPos), BOARD_SIZE - 1));
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
      (((pos - oldPos) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE || 1;
    const debugWalkMs = 550 + debugSteps * 150 + 500;
    if (
      !this.auction &&
      !this.vineSwing &&
      !this.poker &&
      !this.mushroomPending
    ) {
      this._scheduleAutoEnd(cur, debugWalkMs + 2000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  _processLanding(player) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW always fires first — even if an opponent is on the tile
    if (space.type === "grow" || space.type === "easygrow") {
      // Simple mode uses the labeled-grow range-limited path.
      if (this.gameMode === "simple" && space.type === "grow") {
        this._fireSimpleGrowAt(player, player.position, "land");
        // Fall through so the poker check below still runs.
      } else {
      // Reveal grow tiles to everyone the first time anyone lands on one
      for (const p of this.players) p.revealedTiles.add(player.position);
      const pct =
        space.type === "easygrow"
          ? 0.1
          : space.growPct || 0;
      const pctLabel = Math.round(pct * 100);
      const easyGrowBase = space.type === "easygrow" ? 25 : 0;

      // 1) Collect all farm properties owned by this player (and teammates in team mode)
      const teamIds = new Set([player.id]);
      if (this.gameMode === "teams" && this.teams) {
        const teamKey = this.getTeamOf(player.id);
        if (teamKey && this.teams[teamKey]) {
          for (const id of this.teams[teamKey]) teamIds.add(id);
        }
      }

      const teamProps = [];
      for (const p of this.players) {
        if (!teamIds.has(p.id)) continue;
        for (const propId of p.properties) {
          const prop = this.properties.get(propId);
          if (!prop || !prop.group || prop.group === "desert") continue;
          teamProps.push(propId);
        }
      }

      // 2) Chain multiplier: adjacent same-group farms multiply yield by chain length
      const chainMultipliers = this._computeChainMultipliers(teamIds);

      // Each farm grows price * chainMult * growPct
      //    If an opponent is sitting on the farm, they collect the bananas instead
      let totalGrown = 0;
      let totalStolen = 0;
      const stolenBy = {}; // playerId -> amount
      const squatterSteals = []; // { tileId, amount, squatterId }
      for (const propId of teamProps) {
        const prop = this.properties.get(propId);
        if (!prop) continue;
        const chainMult = chainMultipliers[propId] || 1;
        const amount = Math.floor(
          easyGrowBase +
            prop.price * chainMult * pct,
        );
        if (amount > 0) {
          // Check if a non-teammate opponent is sitting on this tile.
          // Players still pending their simple-mode start pick are off-board.
          const squatter = this.players.find(
            (p) =>
              !p.bankrupt &&
              !p.startPickPending &&
              p.position === propId &&
              !teamIds.has(p.id),
          );
          if (squatter) {
            squatter.money += amount;
            totalStolen += amount;
            stolenBy[squatter.id] = (stolenBy[squatter.id] || 0) + amount;
            squatterSteals.push({ tileId: propId, amount, squatterId: squatter.id });
          } else {
            prop.bananaPile += amount;
            totalGrown += amount;
          }
        }
      }
      if (squatterSteals.length > 0) {
        this.growSquatterSteals = squatterSteals;
      }

      if (totalGrown > 0) {
        this._log(
          `${player.name} landed on GROW ${pctLabel}% \u2014 ${totalGrown}\ud83c\udf4c grew on their farms! \ud83c\udf31`,
        );
      }
      if (totalStolen > 0) {
        const theftLines = Object.entries(stolenBy).map(([id, amt]) => {
          const p = this.players.find((pl) => pl.id === id);
          return `${p?.name || "?"} collected ${amt}\ud83c\udf4c`;
        });
        this._log(
          `${player.name} landed on GROW ${pctLabel}% but opponents on their farms grabbed the bananas! ${theftLines.join(", ")} \ud83d\udc12`,
        );
      }
      if (totalGrown === 0 && totalStolen === 0) {
        this._log(
          `${player.name} landed on GROW ${pctLabel}% \u2014 no farms to grow! \ud83c\udf31`,
        );
      }
      } // end else (non-simple grow path)
      // Don't return — fall through to poker check below
    }

    // Check if another monkey is on the same tile — start poker!
    // In team mode, teammates don't trigger poker against each other.
    // Simple mode: players who haven't taken their start pick are off-board.
    const opponent = this.players.find(
      (p) =>
        p.id !== player.id &&
        !p.bankrupt &&
        !p.startPickPending &&
        p.position === player.position &&
        (this.gameMode !== "teams" ||
          this.getTeamOf(p.id) !== this.getTeamOf(player.id)),
    );
    if (opponent && player.money > 0 && opponent.money > 0) {
      this._startPoker(player.id, opponent.id);
      return;
    }

    // GROW/easygrow already handled above — nothing else to do on corners
    if (space.type === "grow" || space.type === "easygrow") return;

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

    if (space.type === "freebananas") {
      const wasHidden = !player.revealedTiles.has(player.position);
      // Reveal to all players
      for (const p of this.players) p.revealedTiles.add(player.position);
      if (wasHidden) {
        // Tile was hidden: reveal first, then award bananas after 1 second
        this._log(
          `${player.name} landed on a hidden tile and revealed Free Bananas +500!`,
        );
        if (this.onUpdate) this.onUpdate();
        const pos = player.position;
        setTimeout(() => {
          // Make sure the player is still in the game
          const p = this.players.find((pl) => pl.id === player.id);
          if (p) {
            p.money += 500;
            this._log(
              `${p.name} collected 500\ud83c\udf4c from Free Bananas +500! \ud83c\udf4c`,
            );
            if (this.onUpdate) this.onUpdate();
          }
        }, 1000);
      } else {
        // Tile was already revealed: award immediately
        player.money += 500;
        this._log(
          `${player.name} landed on Free Bananas +500 and collected 500\ud83c\udf4c! \ud83c\udf4c`,
        );
      }
      return;
    }

    const prop = this.properties.get(player.position);
    if (!prop) return;

    // Super Banana: auto-buy and win if player has enough
    if (
      prop.group === "mushroom" &&
      !prop.owner &&
      player.money >= prop.price
    ) {
      player.money -= prop.price;
      prop.owner = player.id;
      player.properties.push(player.position);
      for (const p of this.players) p.revealedTiles.add(player.position);

      // Phase 1: "Found the Super Banana!" (4s)
      this.superBananaWin = { phase: "found", playerId: player.id };
      this._log(`\u2b50 ${player.name} found the Super Banana!`);
      if (this.onUpdate) this.onUpdate();

      setTimeout(() => {
        // Phase 2: "Bought it! Became Monkey God!" (3s)
        this.superBananaWin = { phase: "bought", playerId: player.id };
        this._log(
          `\u2b50 ${player.name} bought the Super Banana for ${prop.price}\ud83c\udf4c and became Monkey God! \ud83d\udc51`,
        );
        if (this.onUpdate) this.onUpdate();

        setTimeout(() => {
          // Phase 3: Game over
          this.superBananaWin = null;
          this.state = "finished";
          if (this.gameMode === "teams" && this.teams) {
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

    // Super Banana: can't afford — queue a pending swap (3s delay handled by server)
    if (prop.group === "mushroom" && !prop.owner) {
      const mushroomPos = player.position;
      const globalRevealed = new Set();
      for (const p of this.players) {
        for (const t of p.revealedTiles) globalRevealed.add(t);
      }
      const candidates = [];
      for (let i = 0; i < BOARD_SIZE; i++) {
        if (i === mushroomPos) continue;
        if (globalRevealed.has(i)) continue;
        candidates.push(i);
      }
      if (candidates.length > 0) {
        const swapPos =
          candidates[Math.floor(Math.random() * candidates.length)];
        // Reveal mushroom to all players temporarily
        for (const p of this.players) p.revealedTiles.add(mushroomPos);
        this.mushroomPending = { mushroomPos, swapPos, playerId: player.id };
        this._log(
          `\u2b50 ${player.name} found the Super Banana but can't afford it!`,
        );
      } else {
        // No hidden tiles left - richest player wins
        for (const p of this.players) p.revealedTiles.add(mushroomPos);
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
      if (player.money <= 0) {
        // Broke player -- give to opponent if they have money, otherwise landing player gets it free
        const opponents = this.players.filter(
          (p) => !p.bankrupt && p.id !== player.id,
        );
        const richOpponent = opponents.find((p) => p.money > 0);
        if (richOpponent) {
          prop.owner = richOpponent.id;
          richOpponent.properties.push(player.position);
          for (const p of this.players) p.revealedTiles.add(player.position);
          this._log(
            `${player.name} is broke! ${richOpponent.name} claimed ${prop.name} for free! \ud83d\udc4d`,
          );
        } else {
          prop.owner = player.id;
          player.properties.push(player.position);
          for (const p of this.players) p.revealedTiles.add(player.position);
          this._log(
            `Everyone is broke! ${player.name} claimed ${prop.name} for free! \ud83c\udf4c`,
          );
        }
      } else {
        // Check if all opponents are broke — skip auction, landing player wins for free
        const opponents = this.players.filter(
          (p) => !p.bankrupt && p.id !== player.id,
        );
        const allOpponentsBroke = opponents.every((p) => p.money <= 0);
        if (allOpponentsBroke) {
          prop.owner = player.id;
          player.properties.push(player.position);
          for (const p of this.players) p.revealedTiles.add(player.position);
          this._log(
            `All opponents are broke! ${player.name} claimed ${prop.name} for free! 🍌`,
          );
        } else {
          this._log(
            `${player.name} landed on a tile \u2014 banana bid starting!`,
          );
          this.startAuction(player.id);
        }
      }
    }
  }

  // Passive landing — only handles non-interactive effects (tax, rent, grow).
  // Used when a player is pushed onto a tile by an opponent's pet so it
  // doesn't trigger poker, vine swing, auctions, or mushroom swaps.
  _processLandingPassive(player, magicUserId = null) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW fires passively
    if (space.type === "grow" || space.type === "easygrow") {
      if (this.gameMode === "simple" && space.type === "grow") {
        this._fireSimpleGrowAt(player, player.position, "land");
        return;
      }
      // Reveal grow tiles to everyone the first time anyone lands on one
      for (const p of this.players) p.revealedTiles.add(player.position);
      const pct =
        space.type === "easygrow"
          ? 0.1
          : space.growPct || 0;
      const pctLabel = Math.round(pct * 100);
      const easyGrowBase = space.type === "easygrow" ? 25 : 0;
      const teamIds = new Set([player.id]);
      if (this.gameMode === "teams" && this.teams) {
        const teamKey = this.getTeamOf(player.id);
        if (teamKey && this.teams[teamKey]) {
          for (const id of this.teams[teamKey]) teamIds.add(id);
        }
      }
      const teamProps = [];
      for (const p of this.players) {
        if (!teamIds.has(p.id)) continue;
        for (const propId of p.properties) {
          const prop = this.properties.get(propId);
          if (!prop || !prop.group || prop.group === "desert") continue;
          teamProps.push(propId);
        }
      }
      const chainMultipliers = this._computeChainMultipliers(teamIds);
      let totalGrown = 0;
      for (const propId of teamProps) {
        const prop = this.properties.get(propId);
        if (!prop) continue;
        const chainMult = chainMultipliers[propId] || 1;
        const amount = Math.floor(
          easyGrowBase +
            prop.price * chainMult * pct,
        );
        if (amount > 0) {
          prop.bananaPile += amount;
          totalGrown += amount;
        }
      }
      this._log(
        `${player.name} was pushed onto GROW ${pctLabel}% — ${totalGrown}\ud83c\udf4c grew on their farms! \ud83c\udf31`,
      );
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

    if (space.type === "freebananas") {
      // Reveal to all players (passive landing is still a landing)
      for (const p of this.players) p.revealedTiles.add(player.position);
      player.money += 500;
      this._log(
        `${player.name} was pushed onto Free Bananas +500 and collected 500\ud83c\udf4c! \ud83c\udf4c`,
      );
      return;
    }

    // Rent applies passively (but no auction/poker/vine/mushroom)
    const prop = this.properties.get(player.position);
    if (!prop) return;
    // No rent in this game

    // Magic auction: pushed onto unowned tile
    if (!prop.owner && magicUserId && player.money > 0) {
      this._startDevilAuction(player, magicUserId);
    }
  }

  completeMushroomSwap() {
    if (!this.mushroomPending) return false;
    const { mushroomPos, swapPos, playerId } = this.mushroomPending;
    this.mushroomPending = null;
    const player = this.players.find((p) => p.id === playerId);

    // Swap board entries
    const tmpBoard = this.board[mushroomPos];
    this.board[mushroomPos] = this.board[swapPos];
    this.board[swapPos] = tmpBoard;

    // Swap tile label numbers so labels follow their tiles
    if (this.tileLabelNumbers) {
      const mushLabel = this.tileLabelNumbers.get(mushroomPos);
      const swapLabel = this.tileLabelNumbers.get(swapPos);
      this.tileLabelNumbers.delete(mushroomPos);
      this.tileLabelNumbers.delete(swapPos);
      if (mushLabel !== undefined) this.tileLabelNumbers.set(swapPos, mushLabel);
      if (swapLabel !== undefined) this.tileLabelNumbers.set(mushroomPos, swapLabel);
    }

    // Swap properties entries (preserving owner/bananaPile state)
    const mushroomProp = this.properties.get(mushroomPos);
    const swapProp = this.properties.get(swapPos);
    this.properties.delete(mushroomPos);
    this.properties.delete(swapPos);
    if (mushroomProp) this.properties.set(swapPos, mushroomProp);
    if (swapProp) this.properties.set(mushroomPos, swapProp);

    // Update any player property lists that reference the swapped positions
    for (const p of this.players) {
      p.properties = p.properties.map((pos) => {
        if (pos === mushroomPos) return swapPos;
        if (pos === swapPos) return mushroomPos;
        return pos;
      });
    }

    // Un-reveal the old mushroom position for all players
    for (const p of this.players) p.revealedTiles.delete(mushroomPos);
    // Reveal the swapped-in tile to the landing player
    if (player) player.revealedTiles.add(mushroomPos);

    this._log(
      `\u2b50 The Super Banana vanished and hid somewhere else on the board...`,
    );

    // After swap, check if there are any hidden tiles left besides the banana's new position
    const postSwapRevealed = new Set();
    for (const p of this.players) {
      for (const t of p.revealedTiles) postSwapRevealed.add(t);
    }
    let hiddenRemaining = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (i === swapPos) continue; // exclude the banana's new position
      if (!postSwapRevealed.has(i)) hiddenRemaining++;
    }
    if (hiddenRemaining === 0) {
      // No more hidden tiles � reveal the Super Banana at its new location
      for (const p of this.players) p.revealedTiles.add(swapPos);
      this._log(
        `\u2b50 There's nowhere left to hide! The Super Banana is revealed! \ud83c\udf4c`,
      );
    }

    // Auction the tile that swapped into this position (if buyable & unowned)
    const newProp = this.properties.get(mushroomPos);
    const newSpace = this.board[mushroomPos];
    if (newProp && !newProp.owner && player) {
      const opponents = this.players.filter(
        (p) => !p.bankrupt && p.id !== player.id,
      );
      if (player.money <= 0) {
        const richOpponent = opponents.find((p) => p.money > 0);
        if (richOpponent) {
          newProp.owner = richOpponent.id;
          richOpponent.properties.push(mushroomPos);
          for (const p of this.players) p.revealedTiles.add(mushroomPos);
          this._log(
            `${player.name} is broke! ${richOpponent.name} claimed ${newProp.name} for free! 👍`,
          );
        } else {
          newProp.owner = player.id;
          player.properties.push(mushroomPos);
          for (const p of this.players) p.revealedTiles.add(mushroomPos);
          this._log(
            `Everyone is broke! ${player.name} claimed ${newProp.name} for free! 🍌`,
          );
        }
      } else if (opponents.every((p) => p.money <= 0)) {
        newProp.owner = player.id;
        player.properties.push(mushroomPos);
        for (const p of this.players) p.revealedTiles.add(mushroomPos);
        this._log(
          `All opponents are broke! ${player.name} claimed ${newProp.name} for free! 🍌`,
        );
      } else {
        this._log(
          `${player.name} landed on a tile \u2014 banana bid starting!`,
        );
        this.startAuction(player.id);
      }
    } else {
      // Apply peel tax if the swapped-in tile is a tax tile
      if (player && newSpace) {
        if (newSpace.type === "tax10") {
          const taxAmount = Math.min(
            Math.floor(player.money * 0.1),
            player.money,
          );
          player.money -= taxAmount;
          this._log(
            `${player.name} slipped on ${newSpace.name}: ${taxAmount}\ud83c\udf4c (10%).`,
          );
        } else if (newSpace.type === "easygrow") {
          for (const p of this.players) p.revealedTiles.add(mushroomPos);
          this._processEasyGrow(player);
        }
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

    const bidders = [];
    bidders.push(pushedPlayer.id);
    for (const p of this.players) {
      if (!p.bankrupt && p.id !== pushedPlayer.id) bidders.push(p.id);
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

    const pos = cur.position;
    const prop = this.properties.get(pos);
    if (!prop) return false;

    const bidders = [];
    bidders.push(cur.id);
    for (const p of this.players) {
      if (!p.bankrupt && p.id !== cur.id) bidders.push(p.id);
    }

    const bids = {};
    for (const id of bidders)
      bids[id] = { amount: 0, placed: false, passed: false };

    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: bidders[0],
      bidders,
      bids,
      phase: "pitch",
      highBid: 0,
      highBidder: null,
    };

    this._log(`\ud83c\udf4c Banana bid! Lander, name your price.`);

    // Auto-list at 0 if lander is broke
    if (cur.money === 0) {
      const lb = this.auction.bids[cur.id];
      lb.amount = 0;
      lb.placed = true;
      lb.bidTime = Date.now();
      this._log(`${cur.name} has 0\ud83c\udf4c \u2014 auto-listed for free!`);
      this._checkPhaseComplete();
    }

    return true;
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
        a.bids[id].placed = false;
        a.bids[id].passed = false;
      }
      a.phase = "respond";
      if (this.noAuctionTimer) {
        a.respondDeadline = null;
        a.respondStartTime = null;
        this._log(
          `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 accept or reject!`,
        );
      } else {
        a.respondDeadline = Date.now() + 15000;
        a.respondStartTime = Date.now();
        this._log(
          `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 15 seconds to accept!`,
        );
      }

      // Start the 15s timer — when it expires, lander buys (unless noTimer is on)
      if (this._auctionTimer) clearTimeout(this._auctionTimer);
      if (!this.noAuctionTimer) {
        this._auctionTimer = setTimeout(() => {
          this._auctionTimer = null;
          if (!this.auction || this.auction.phase !== "respond") return;
          // Timer expired — lander buys
          this._log(`\u23f0 Time's up! Lander buys the farm!`);
          this.auction.highBidder = this.auction.landingPlayer;
          this.auction.highBid = this.auction.landerOpenBid;
          this._resolveAuction();
          if (this.onUpdate) this.onUpdate();
        }, 15000);
      }
      return;
    }

    // -- Respond phase: first accept wins, all reject = lander buys --
    if (a.phase === "respond") {
      const others = a.bidders.filter((id) => id !== a.landingPlayer);

      // Check if someone accepted — first accept wins (by bidTime)
      const acceptors = others.filter((id) => a.bids[id].placed);
      if (acceptors.length > 0) {
        // First player to accept (earliest bidTime) wins
        acceptors.sort((x, y) => (a.bids[x].bidTime || 0) - (a.bids[y].bidTime || 0));
        const winnerId = acceptors[0];
        a.highBidder = winnerId;
        a.highBid = a.landerOpenBid;
        const winner = this.players.find((p) => p.id === winnerId);
        const reactionMs = a.respondStartTime ? (a.bids[winnerId].bidTime - a.respondStartTime) : 0;
        const reactionSec = (reactionMs / 1000).toFixed(1);
        a.acceptTime = reactionSec;
        this._log(
          `${winner?.name || "?"} accepted in ${reactionSec}s \u2014 they buy the farm!`,
        );
        // Clear the timer
        if (this._auctionTimer) {
          clearTimeout(this._auctionTimer);
          this._auctionTimer = null;
        }
        this._resolveAuction();
        return;
      }

      // Check if everyone rejected
      const allDone = others.every(
        (id) => a.bids[id].placed || a.bids[id].passed,
      );
      if (allDone) {
        // Everyone rejected — lander buys
        a.highBidder = a.landingPlayer;
        a.highBid = a.landerOpenBid;
        this._log(`Everyone rejected \u2014 lander buys the farm!`);
        if (this._auctionTimer) {
          clearTimeout(this._auctionTimer);
          this._auctionTimer = null;
        }
        this._resolveAuction();
        return;
      }

      // Otherwise, still waiting for responses (timer still running)
      return;
    }

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
        if (prop.group === "mushroom") {
          this.state = "finished";
          if (this.gameMode === "teams" && this.teams) {
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
    if (!b || b.placed || b.passed) return false;

    // In teams mode, the lander's teammate must wait 5 seconds before accepting
    if (accept && this.gameMode === "teams" && this.teams && a.respondStartTime) {
      const landerTeam = this.getTeamOf(a.landingPlayer);
      const responderTeam = this.getTeamOf(socketId);
      if (landerTeam && landerTeam === responderTeam) {
        const elapsed = Date.now() - a.respondStartTime;
        if (elapsed < 5000) {
          return false; // too early — teammate must wait
        }
      }
    }

    if (accept) {
      b.placed = true;
      b.bidTime = Date.now();
      const player = this.players.find((p) => p.id === socketId);
      this._log(`${player?.name || "?"} accepted the price!`);
    } else {
      b.passed = true;
      const player = this.players.find((p) => p.id === socketId);
      this._log(`${player?.name || "?"} declined.`);
    }

    this._checkPhaseComplete();
    return true;
  }

  vineSwingMove(socketId, position) {
    if (!this.vineSwing || this.vineSwing !== socketId) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    if (position < 0 || position >= BOARD_SIZE) return false;

    // Can only swing to a property the player owns
    const prop = this.properties.get(position);
    if (!prop || prop.owner !== socketId) return false;

    this.vineSwing = null;
    // Clear any lingering grow-squatter-steal state from this turn so the
    // frontend doesn't re-trigger the steal animation on the vine landing.
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
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

  // Simple mode: a player's first turn is picking any tile to start on.
  // The chosen tile is treated like a normal landing (auction if a farm, etc).
  pickStartTile(socketId, position) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (!cur.startPickPending) return false;
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
      return false;
    if (typeof position !== "number" || position < 0 || position >= BOARD_SIZE)
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

    if (!this.auction && !this.vineSwing && !this.poker && !this.mushroomPending) {
      this._scheduleAutoEnd(cur, 1000);
    }
    return true;
  }

  // -- Simple-mode Grow Helpers -----------------------------------

  // Assign random 0..7 labels to the 8 grow tiles and rewrite each tile's
  // display name to "GROW N". Called once at game start (after shuffle).
  _assignSimpleGrowLabels() {
    const growPositions = [];
    for (let i = 0; i < this.board.length; i++) {
      if (this.board[i].type === "grow") growPositions.push(i);
    }
    const labels = growPositions.map((_, idx) => idx);
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

  _findSimpleGrowByLabel(label) {
    if (!this.growTileLabels) return null;
    for (const [pos, lbl] of this.growTileLabels) {
      if (lbl === label) return pos;
    }
    return null;
  }

  // Returns the set of board positions strictly between `growPos` and the
  // next revealed grow tile clockwise (both endpoints excluded). If only the
  // anchor grow is revealed, the range wraps the whole board (51 positions).
  // If the next revealed grow is adjacent, the range is empty.
  _simpleGrowRange(growPos, revealedTiles) {
    const revealedGrows = new Set();
    for (const pos of revealedTiles) {
      if (pos === growPos) continue;
      const space = this.board[pos];
      if (space && space.type === "grow") revealedGrows.add(pos);
    }
    const range = new Set();
    if (revealedGrows.size === 0) {
      for (let off = 1; off < BOARD_SIZE; off++) {
        range.add((growPos + off) % BOARD_SIZE);
      }
      return range;
    }
    for (let off = 1; off < BOARD_SIZE; off++) {
      const p = (growPos + off) % BOARD_SIZE;
      if (revealedGrows.has(p)) break;
      range.add(p);
    }
    return range;
  }

  // Fire a grow effect on a specific grow-tile position at 100% (the only
  // pct used in simple mode). Applies the "between revealed grows" range,
  // sends bananas to opponent squatters, logs results. Logs are tagged
  // (`source: "roll" | "land"`) so messages read sensibly.
  _fireSimpleGrowAt(player, growPos, source) {
    if (this.gameMode !== "simple") return;
    // Record the activated grow tile so the frontend can glow it (landed-on or
    // rolled-match). Accumulates within an action so a roll + a walked landing
    // can both glow this turn. Reset alongside growSquatterSteals.
    this.lastGrowFired = (this.lastGrowFired || []).concat([growPos]);
    // Make the grow tile visible to everyone for the run
    for (const p of this.players) p.revealedTiles.add(growPos);

    // Use the globally-revealed set as the boundary — any grow revealed by
    // any player bounds the range. Prevents the "whole board grows" case
    // when the activating player hasn't personally revealed grows that
    // other players already have.
    const globalRevealed = new Set();
    for (const p of this.players) {
      for (const t of p.revealedTiles) globalRevealed.add(t);
    }
    const range = this._simpleGrowRange(growPos, globalRevealed);
    // TEMP DEBUG: remove once grow-blocking is confirmed correct
    {
      const revealedGrowsOther = [];
      for (const pos of globalRevealed) {
        if (pos === growPos) continue;
        const sp = this.board[pos];
        if (sp && sp.type === "grow") revealedGrowsOther.push(pos);
      }
      const sortedRange = [...range].sort((a, b) => a - b);
      console.log(
        `[grow-debug] fire at pos=${growPos} (label=${this.growTileLabels && this.growTileLabels.get(growPos)}), ` +
          `otherRevealedGrows=[${revealedGrowsOther.sort((a, b) => a - b).join(",")}], ` +
          `rangeSize=${range.size}, range=[${sortedRange.join(",")}], ` +
          `player=${player.name} ownedFarms=[${player.properties.slice().sort((a, b) => a - b).join(",")}]`,
      );
    }
    const ownedInRange = [];
    for (const propId of player.properties) {
      if (!range.has(propId)) continue;
      const prop = this.properties.get(propId);
      if (!prop || !prop.group || prop.group === "desert") continue;
      ownedInRange.push(propId);
    }

    const label =
      this.growTileLabels && this.growTileLabels.has(growPos)
        ? this.growTileLabels.get(growPos)
        : "?";

    let totalGrown = 0;
    let totalStolen = 0;
    const stolenBy = {};
    const squatterSteals = [];
    for (const propId of ownedInRange) {
      const prop = this.properties.get(propId);
      const amount = prop.price; // simple mode = 100%
      if (amount <= 0) continue;
      const squatter = this.players.find(
        (p) =>
          !p.bankrupt &&
          !p.startPickPending &&
          p.position === propId &&
          p.id !== player.id,
      );
      if (squatter) {
        squatter.money += amount;
        totalStolen += amount;
        stolenBy[squatter.id] = (stolenBy[squatter.id] || 0) + amount;
        squatterSteals.push({ tileId: propId, amount, squatterId: squatter.id });
      } else {
        prop.bananaPile += amount;
        totalGrown += amount;
      }
    }
    if (squatterSteals.length > 0) {
      // Append to any existing steals so a rolled grow + walked grow can both
      // animate on the frontend in the same turn.
      const prev = this.growSquatterSteals || [];
      this.growSquatterSteals = prev.concat(squatterSteals);
    }

    const verb =
      source === "roll" ? `rolled ${label} — GROW ${label} fired` : `landed on GROW ${label}`;
    if (totalGrown > 0) {
      this._log(
        `${player.name} ${verb} — ${totalGrown}🍌 grew on their farms! 🌱`,
      );
    }
    if (totalStolen > 0) {
      const theftLines = Object.entries(stolenBy).map(([id, amt]) => {
        const p = this.players.find((pl) => pl.id === id);
        return `${p?.name || "?"} collected ${amt}🍌`;
      });
      this._log(
        `${player.name} ${verb} but opponents on their farms grabbed the bananas! ${theftLines.join(", ")} 👲`,
      );
    }
    if (totalGrown === 0 && totalStolen === 0) {
      this._log(`${player.name} ${verb} — no farms in range! 🌱`);
    }
    return { totalGrown, totalStolen };
  }

  // Simple mode: rolling a sum in 0..7 fires the matching GROW tile's effect.
  // Sums 8+ are ignored. The player still walks normally afterwards.
  _processSimpleRolledGrow(player, diceSum) {
    if (this.gameMode !== "simple") return;
    if (diceSum < 0 || diceSum > 7) return;
    const growPos = this._findSimpleGrowByLabel(diceSum);
    if (growPos == null) return;
    this._fireSimpleGrowAt(player, growPos, "roll");
  }

  // -- Banana Pile Collection -------------------------------------

  // Returns chainMultipliers: { boardPos: chainLength } for all non-desert team farms.
  // Adjacent same-group owned farms form chains; each farm's multiplier = chain length.
  _computeChainMultipliers(teamIds) {
    // Simple mode has no chain bonuses — every farm yields its own price.
    if (this.gameMode === "simple") return {};
    // Build map: boardPos -> group (using map keys, not prop.id which is the pre-shuffle buyable id)
    const posGroup = new Map();
    for (const p of this.players) {
      if (!teamIds.has(p.id)) continue;
      for (const boardPos of p.properties) {
        const prop = this.properties.get(boardPos);
        if (prop && prop.group && prop.group !== "desert") {
          posGroup.set(boardPos, prop.group);
        }
      }
    }
    const chainMultipliers = {};
    const visited = new Set();
    for (const [boardPos, group] of posGroup) {
      if (visited.has(boardPos)) continue;
      const chain = [];
      const queue = [boardPos];
      visited.add(boardPos);
      while (queue.length > 0) {
        const cur = queue.shift();
        chain.push(cur);
        const neighbors = [
          (cur - 1 + BOARD_SIZE) % BOARD_SIZE,
          (cur + 1) % BOARD_SIZE,
        ];
        for (const n of neighbors) {
          if (visited.has(n) || !posGroup.has(n)) continue;
          if (posGroup.get(n) !== group) continue;
          visited.add(n);
          queue.push(n);
        }
      }
      for (const c of chain) chainMultipliers[c] = chain.length;
    }
    return chainMultipliers;
  }

  // Returns a map: position -> label number (e.g. CV6 -> 6)
  _getTileLabelNumbers() {
    return this.tileLabelNumbers || new Map();
  }

  _processDiceMatchGrow(player, diceSum) {
    // Simple mode has no dice-roll/tile-number matching mechanic.
    if (this.gameMode === "simple") return;
    const labelNumbers = this._getTileLabelNumbers();
    const teamIds = new Set([player.id]);
    if (this.gameMode === "teams" && this.teams) {
      const teamKey = this.getTeamOf(player.id);
      if (teamKey && this.teams[teamKey]) {
        for (const id of this.teams[teamKey]) teamIds.add(id);
      }
    }

    // Find all owned farms where the label number matches the dice sum
    const matchedTiles = [];
    for (const p of this.players) {
      if (!teamIds.has(p.id)) continue;
      for (const propId of p.properties) {
        const num = labelNumbers.get(propId);
        if (num === diceSum) {
          matchedTiles.push(propId);
        }
      }
    }

    if (matchedTiles.length === 0) return;

    // Chain multipliers: adjacent same-group farms multiply yield by chain length
    const chainMultipliers = this._computeChainMultipliers(teamIds);

    // Apply 100% grow to each matched tile
    let totalGrown = 0;
    let totalStolen = 0;
    const stolenBy = {};
    const squatterSteals = [];
    const tileNames = [];
    const grownAmounts = {};
    for (const propId of matchedTiles) {
      const prop = this.properties.get(propId);
      if (!prop || !prop.group || prop.group === "desert") continue;
      const chainMult = chainMultipliers[propId] || 1;
      const amount = Math.floor(
        prop.price * chainMult,
      );
      if (amount > 0) {
        // If the tile owner is standing on their own tile, they get the bananas
        // (pile grows normally), regardless of any opponent also being present.
        const ownerOnTile = prop.owner && this.players.some(
          (p) => !p.bankrupt && p.position === propId && p.id === prop.owner,
        );
        // Otherwise, check if a non-teammate opponent is sitting on this tile
        const squatter = ownerOnTile ? null : this.players.find(
          (p) => !p.bankrupt && p.position === propId && !teamIds.has(p.id),
        );
        if (squatter) {
          squatter.money += amount;
          totalStolen += amount;
          stolenBy[squatter.id] = (stolenBy[squatter.id] || 0) + amount;
          squatterSteals.push({ tileId: propId, amount, squatterId: squatter.id });
        } else {
          prop.bananaPile += amount;
          totalGrown += amount;
          grownAmounts[propId] = amount;
        }
        // Build label for log
        const groupLetters = {
          pink: "LF",
          lightblue: "BJ",
          red: "RD",
          yellow: "CV",
          orange: "GF",
          darkblue: "GM",
        };
        const prefix = groupLetters[prop.group] || "";
        tileNames.push(prefix + diceSum);
      }
    }
    if (squatterSteals.length > 0) {
      this.growSquatterSteals = squatterSteals;
    }

    if (totalGrown > 0 || totalStolen > 0) {
      this.diceMatchTiles = matchedTiles;
      this.diceMatchGrownAmounts = grownAmounts;
      if (totalGrown > 0) {
        this._log(
          `\ud83c\udfb2 ${player.name} rolled ${diceSum} and owns ${tileNames.join(", ")}! 100% grow \u2014 ${totalGrown}\ud83c\udf4c sprouted! \ud83c\udf31`,
        );
      }
      if (totalStolen > 0) {
        const theftLines = Object.entries(stolenBy).map(([id, amt]) => {
          const p = this.players.find((pl) => pl.id === id);
          return `${p?.name || "?"} collected ${amt}\ud83c\udf4c`;
        });
        this._log(
          `\ud83c\udfb2 ${player.name} rolled ${diceSum} but opponents on their farms grabbed the bananas! ${theftLines.join(", ")} \ud83d\udc12`,
        );
      }
    }
  }

  _processEasyGrow(player) {
    const pct = 0.1;
    const easyGrowBase = 25;
    const teamIds = new Set([player.id]);
    if (this.gameMode === "teams" && this.teams) {
      const teamKey = this.getTeamOf(player.id);
      if (teamKey && this.teams[teamKey]) {
        for (const id of this.teams[teamKey]) teamIds.add(id);
      }
    }
    const teamProps = [];
    for (const p of this.players) {
      if (!teamIds.has(p.id)) continue;
      for (const propId of p.properties) {
        const prop = this.properties.get(propId);
        if (!prop || !prop.group || prop.group === "desert") continue;
        teamProps.push(propId);
      }
    }
    const chainMultipliers = this._computeChainMultipliers(teamIds);
    let totalGrown = 0;
    for (const propId of teamProps) {
      const prop = this.properties.get(propId);
      if (!prop) continue;
      const chainMult = chainMultipliers[propId] || 1;
      const amount = Math.floor(
        easyGrowBase +
          prop.price * chainMult * pct,
      );
      if (amount > 0) {
        prop.bananaPile += amount;
        totalGrown += amount;
      }
    }
    if (totalGrown > 0) {
      this._log(
        `${player.name} crossed Easy Grow +10% \u2014 ${totalGrown}\ud83c\udf4c grew on their farms! \ud83c\udf31`,
      );
    }
  }

  _collectBananasOnPath(player, oldPos, newPos) {
    // Walk every tile from oldPos+1 to newPos (wrapping around the board)
    const steps = (newPos - oldPos + BOARD_SIZE) % BOARD_SIZE;
    if (steps === 0) return [];
    let collected = 0;
    let stolen = 0;
    const stolenVictims = new Set();
    const crossedFreeBananas = [];

    for (let s = 1; s <= steps; s++) {
      const pos = (oldPos + s) % BOARD_SIZE;

      // Free Bananas +500: only award when crossing if tile is already revealed
      const space = this.board[pos];
      if (
        space &&
        space.type === "freebananas" &&
        pos !== newPos &&
        player.revealedTiles.has(pos)
      ) {
        crossedFreeBananas.push(pos);
      }

      const prop = this.properties.get(pos);
      if (!prop || prop.bananaPile <= 0) continue;

      const isLanding = pos === newPos;

      if (prop.owner === player.id) {
        // Collect own bananas on any tile crossed or landed on
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && !prop.owner) {
        // Collect unclaimed banana piles when landing on them
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && prop.owner && prop.owner !== player.id) {
        // In team mode, collect teammate piles; steal from opponents
        const isTeammate =
          this.gameMode === "teams" &&
          this.getTeamOf(prop.owner) === this.getTeamOf(player.id);
        if (isTeammate) {
          collected += prop.bananaPile;
        } else {
          stolen += prop.bananaPile;
          stolenVictims.add(prop.owner);
        }
        prop.bananaPile = 0;
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
      this._log(
        `${player.name} stole ${stolen}\ud83c\udf4c from ${names}'s banana pile! \ud83d\udc12`,
      );
    }
    return crossedFreeBananas;
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
        this.gameMode === "teams" &&
        this.getTeamOf(prop.owner) === this.getTeamOf(player.id);
      if (isTeammate) {
        player.money += prop.bananaPile;
        const mate = this.players.find((p) => p.id === prop.owner);
        this._log(
          `${player.name} harvested ${prop.bananaPile}\ud83c\udf4c from teammate ${mate?.name || "?"}'s pile! \ud83d\udc35`,
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

    const BB_AMOUNT = 200;
    const SB_AMOUNT = 100;
    const bbActual = Math.min(BB_AMOUNT, lander.money);
    const sbActual = Math.min(SB_AMOUNT, other.money);
    lander.money -= bbActual;
    other.money -= sbActual;

    if (this.monkeyPoker) {
      // Monkey Poker: each player gets cards valued 1-10, one per round
      const mkCard = () => ({ value: Math.floor(Math.random() * 10) + 1 });
      this.poker = {
        monkeyPoker: true,
        bbPlayer: landingPlayerId,
        sbPlayer: otherPlayerId,
        players: {
          [landingPlayerId]: {
            cards: [mkCard()],
            bet: bbActual,
            totalBet: bbActual,
            folded: false,
            allIn: lander.money === 0,
            hasActed: false,
          },
          [otherPlayerId]: {
            cards: [mkCard()],
            bet: sbActual,
            totalBet: sbActual,
            folded: false,
            allIn: other.money === 0,
            hasActed: false,
          },
        },
        communityCards: [],
        pot: bbActual + sbActual,
        currentBet: bbActual,
        round: "preflop",
        currentTurn: otherPlayerId,
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
        bbPlayer: landingPlayerId,
        sbPlayer: otherPlayerId,
        players: {
          [landingPlayerId]: {
            cards: [deck.pop(), deck.pop()],
            bet: bbActual,
            totalBet: bbActual,
            folded: false,
            allIn: lander.money === 0,
            hasActed: false,
          },
          [otherPlayerId]: {
            cards: [deck.pop(), deck.pop()],
            bet: sbActual,
            totalBet: sbActual,
            folded: false,
            allIn: other.money === 0,
            hasActed: false,
          },
        },
        communityCards: [],
        deck,
        pot: bbActual + sbActual,
        currentBet: bbActual,
        round: "preflop",
        currentTurn: otherPlayerId,
        winner: null,
        resolved: false,
        bbHandName: null,
        sbHandName: null,
      };
    }

    this._log(
      `\uD83C\uDCCF ${this.monkeyPoker ? "Monkey Poker" : "Poker"} match! ${lander.name} (BB: ${bbActual}\uD83C\uDF4C) vs ${other.name} (SB: ${sbActual}\uD83C\uDF4C)`,
    );

    // If both are all-in from blinds, run it out
    if (
      this.poker.players[landingPlayerId].allIn &&
      this.poker.players[otherPlayerId].allIn
    ) {
      this._pokerRunout();
    }
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
        p.hasActed = true;
        this._log(`${player.name} calls ${callAmt}\uD83C\uDF4C.`);
        break;
      }

      case "raise": {
        if (poker.monkeyPoker) {
          amount = poker.currentBet + 100;
        } else {
          amount = Math.floor(amount || 0);
        }
        if (amount <= poker.currentBet) return false;
        const needed = amount - p.bet;
        if (needed > player.money) return false;
        player.money -= needed;
        p.bet = amount;
        p.totalBet += needed;
        poker.pot += needed;
        poker.currentBet = amount;
        if (player.money === 0) p.allIn = true;
        p.hasActed = true;
        opp.hasActed = false; // Opponent must respond to raise
        this._log(`${player.name} raises to ${amount}\uD83C\uDF4C.`);
        poker.currentTurn = opId;
        return true;
      }

      default:
        return false;
    }

    // Check if round should advance
    const betsEqual = p.bet === opp.bet || p.allIn || opp.allIn;
    const bothActed = p.hasActed && opp.hasActed;

    if (betsEqual && bothActed) {
      this._advancePokerRound();
    } else {
      poker.currentTurn = opId;
    }
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
    poker.currentTurn = poker.bbPlayer; // BB acts first post-flop

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
    const price = 5000;
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
    if (idx < 0 || idx >= BOARD_SIZE) return false;
    // Can't place on a tile that already has a bomb
    if (this.bombs.some((b) => b.position === idx)) return false;
    const cur = this.getCurrentPlayer();
    const isOwnTurn = !!(cur && cur.id === player.id);
    player.bomb = Math.max(0, (player.bomb || 0) - 1);
    this.bombs.push({
      placedBy: player.id,
      position: idx,
      turnsLeft: 3,
      pending: isOwnTurn,
    });
    if (isOwnTurn) {
      this._log(
        `${player.name} planted a pineapple bomb! \ud83c\udf4d (will be placed at the start of your next turn!)`,
      );
    } else {
      this._log(
        `${player.name} planted a pineapple bomb! \ud83c\udf4d (arms after your next turn, detonates in 3!)`,
      );
    }
    return true;
  }

  _addExplosion(explosion) {
    if (!this.lastExplosion || !Array.isArray(this.lastExplosion.explosions)) {
      this.lastExplosion = { explosions: [] };
    }
    this.lastExplosion.explosions.push(explosion);
  }

  _checkBombDetonation(player) {
    if (!this.bombMode || this.bombs.length === 0) return false;
    const bombIndex = this.bombs.findIndex(
      (b) => !b.pending && b.position === player.position,
    );
    if (bombIndex === -1) return false;
    const bomb = this.bombs[bombIndex];

    // Placer stepping on their own armed bomb: the bomb stays armed; the placer
    // just takes 50% self-damage so they can't nuke adjacent opponents by
    // triggering their own bomb.
    if (bomb.placedBy === player.id) {
      this._bombSelfDamage(player);
      this._checkBombWin();
      return true;
    }

    const placer = this.players.find((p) => p.id === bomb.placedBy);
    this.bombs.splice(bombIndex, 1);
    const blastTiles = [
      bomb.position,
      (bomb.position - 1 + BOARD_SIZE) % BOARD_SIZE,
      (bomb.position + 1) % BOARD_SIZE,
    ];
    const explosion = { position: bomb.position, tiles: blastTiles, kills: [] };
    this._addExplosion(explosion);
    const victims = this.players.filter(
      (p) => !p.bankrupt && blastTiles.includes(p.position),
    );
    if (victims.length === 0) return false;
    this._log(
      `\ud83d\udca5 BOOM! ${player.name} landed on a pineapple bomb! \ud83c\udf4d`,
    );
    for (const v of victims) {
      if (v.id === bomb.placedBy) {
        this._bombSelfDamage(v);
      } else if (
        this.gameMode === "teams" &&
        this.teams &&
        this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
      ) {
        this._bombSelfDamage(v);
      } else {
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
        const blastTiles = [
          bomb.position,
          (bomb.position - 1 + BOARD_SIZE) % BOARD_SIZE,
          (bomb.position + 1) % BOARD_SIZE,
        ];
        const explosion = { position: bomb.position, tiles: blastTiles, kills: [] };
        this._addExplosion(explosion);
        const victims = this.players.filter(
          (p) => !p.bankrupt && blastTiles.includes(p.position),
        );
        if (victims.length > 0) {
          this._log(
            `\ud83d\udca5 BOOM! A pineapple bomb exploded on tile ${bomb.position}! \ud83c\udf4d`,
          );
          const placer = this.players.find((p) => p.id === bomb.placedBy);
          for (const v of victims) {
            if (v.id === bomb.placedBy) {
              this._bombSelfDamage(v);
            } else if (
              this.gameMode === "teams" &&
              this.teams &&
              this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
            ) {
              this._bombSelfDamage(v);
            } else {
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

  _bombEliminate(victim, placer) {
    const loot = victim.money;
    const transferredTiles = [...victim.properties];
    victim.bankrupt = true;
    victim.money = 0;
    let kill = null;
    // Transfer properties to placer
    if (placer && !placer.bankrupt && placer.id !== victim.id) {
      placer.money += loot;
      for (const pos of transferredTiles) {
        const prop = this.properties.get(pos);
        if (prop) {
          prop.owner = placer.id;
          if (!placer.properties.includes(pos)) placer.properties.push(pos);
        }
      }
      this._log(
        `\ud83d\udca5 ${victim.name} was eliminated! ${placer.name} took ${loot}\ud83c\udf4c and all their farms!`,
      );
      kill = {
        victimId: victim.id,
        victimName: victim.name,
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
        placerId: placer ? placer.id : null,
        placerName: placer ? placer.name : null,
        loot: 0,
        tiles: [],
      };
    }
    victim.properties = [];
    return kill;
  }

  _bombSelfDamage(player) {
    const lost = Math.floor(player.money / 2);
    if (lost <= 0) return;
    player.money -= lost;
    this.bombSelfDamage = {
      playerId: player.id,
      playerName: player.name,
      lost,
    };
    this._log(
      `\ud83d\udca5 ${player.name} got caught in their own bomb and lost ${lost}\ud83c\udf4c!`,
    );
  }

  _checkBombWin() {
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
      for (let i = 0; i < BOARD_SIZE; i++) p.revealedTiles.add(i);
    }
  }

  endTurn(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || !this.diceRolled) return false;
    if (this.mushroomPending) return false;
    if (this.superBananaWin) return false;
    if (this.itemAuction) return false;
    this._cancelAutoEnd();
    this.petCoinFlip = null;
    this.petUsedThisTurn = false;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.growSquatterSteals = null;
    this.lastGrowFired = null;
    this.lastPetUsed = null;
    this.lastStartPick = null;
    this.lastTeleport = null;
    this.lastTileSwap = null;
    this.simpleCardUsedThisTurn = false;

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

    // Tick bomb timers — only bombs placed by the player whose turn just ended
    // (explosion happens after next roll in rollDice). Skip pending bombs —
    // they haven't been "placed" yet and won't tick until they activate.
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      if (!this.bombs[i].pending && this.bombs[i].placedBy === cur.id) {
        this.bombs[i].turnsLeft--;
      }
    }

    // Activate any pending bombs belonging to the new current player — a
    // bomb placed on the placer's own turn only becomes real at the start
    // of their next turn, so they can't benefit from it on the same turn.
    const activatingPlayer = this.players[this.currentPlayerIndex];
    if (activatingPlayer) {
      for (const b of this.bombs) {
        if (b.pending && b.placedBy === activatingPlayer.id) {
          b.pending = false;
        }
      }
    }

    // Win check — only Super Banana purchase wins
    if (this.gameMode === "teams" && this.teams) {
      // Team mode: check if any player bought the Super Banana
      for (const teamKey of ["A", "B"]) {
        const teamWon = this.teams[teamKey].some((id) => {
          const p = this.players.find((pl) => pl.id === id);
          return (
            p &&
            p.properties.some((pos) => {
              const prop = this.properties.get(pos);
              return prop && prop.group === "mushroom";
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

    // Simple-mode item auction: if a counter-zero was queued during this
    // player's turn (after any property auction etc.), kick off the wheel
    // spin + bidding flow now that the turn has fully ended.
    this._maybeStartQueuedItemAuction();

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
    // Trading only allowed in team mode
    if (this.gameMode !== "teams") return false;
    const sender = this.players.find((p) => p.id === senderId);
    const recipient = this.players.find((p) => p.id === recipientId);
    if (!sender || !recipient) return false;
    if (sender.bankrupt || recipient.bankrupt) return false;
    if (senderId === recipientId) return false;
    // Only teammates can trade
    if (this.getTeamOf(senderId) !== this.getTeamOf(recipientId)) return false;

    const TRADE_FEE = 150;
    amount = Math.floor(amount);
    if (amount <= 0) return false;
    const totalCost = amount + TRADE_FEE;
    if (sender.money < totalCost) return false;

    sender.money -= totalCost;
    recipient.money += amount;
    this._log(
      `\uD83D\uDCE6 ${sender.name} sent ${amount}\uD83C\uDF4C to ${recipient.name} (fee: ${TRADE_FEE}\uD83C\uDF4C)`,
    );
    return true;
  }

  // -- Swap farm between teammates --------------------------------

  swapFarm(socketId, myFarmPos, mateFarmPos) {
    if (this.state !== "playing") return false;
    if (this.gameMode !== "teams") return false;
    // Can't trade on your own turn
    const cur = this.getCurrentPlayer();
    if (cur && cur.id === socketId) return false;

    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;

    const SWAP_FEE = 100;
    if (player.money < SWAP_FEE) return false;

    // Find teammate
    const myTeam = this.getTeamOf(socketId);
    if (!myTeam) return false;
    const mateId = this.teams[myTeam].find((id) => id !== socketId);
    const mate = this.players.find((p) => p.id === mateId);
    if (!mate || mate.bankrupt) return false;

    myFarmPos = Math.floor(myFarmPos);
    mateFarmPos = Math.floor(mateFarmPos);

    // Validate ownership
    if (!player.properties.includes(myFarmPos)) return false;
    if (!mate.properties.includes(mateFarmPos)) return false;

    const myProp = this.properties.get(myFarmPos);
    const mateProp = this.properties.get(mateFarmPos);
    if (!myProp || !mateProp) return false;

    // Charge swap fee
    player.money -= SWAP_FEE;

    // Swap ownership
    myProp.owner = mateId;
    mateProp.owner = socketId;

    // Update property arrays
    player.properties = player.properties.filter((p) => p !== myFarmPos);
    player.properties.push(mateFarmPos);
    mate.properties = mate.properties.filter((p) => p !== mateFarmPos);
    mate.properties.push(myFarmPos);

    this._log(
      `\uD83D\uDD04 ${player.name} swapped ${myProp.name} for ${mate.name}'s ${mateProp.name} (fee: ${SWAP_FEE}\uD83C\uDF4C)`,
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

  // -- Give farm to teammate (teams only, free transfer) ---------

  giveFarm(giverId, propPos) {
    if (this.state !== "playing") return false;
    if (this.gameMode !== "teams") return false;

    const GIVE_FEE = 300;
    const giver = this.players.find((p) => p.id === giverId);
    if (!giver || giver.bankrupt) return false;
    if (giver.money < GIVE_FEE) return false;

    propPos = Math.floor(propPos);
    if (!giver.properties.includes(propPos)) return false;

    const prop = this.properties.get(propPos);
    if (!prop) return false;

    // Find teammate
    const myTeam = this.getTeamOf(giverId);
    if (!myTeam) return false;
    const mateId = this.teams[myTeam].find((id) => id !== giverId);
    const mate = this.players.find((p) => p.id === mateId);
    if (!mate || mate.bankrupt) return false;

    // Charge fee
    giver.money -= GIVE_FEE;

    // Transfer ownership
    prop.owner = mateId;
    giver.properties = giver.properties.filter((p) => p !== propPos);
    mate.properties.push(propPos);

    this._log(
      `🎁 ${giver.name} gave ${prop.name} to ${mate.name} (fee: ${GIVE_FEE}🍌)`,
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

  _log(msg) {
    this.log.push(msg);
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
      // Simple mode: expose the GROW tile's 0-7 label so the Grow Chart can
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

    return {
      gameId: this.gameId,
      state: this.state,
      admin: this.admin,
      isPublic: this.isPublic,
      maxPlayers: this.maxPlayers,
      startingMoney: this.startingMoney,
      bombMode: this.bombMode,
      noAuctionTimer: this.noAuctionTimer,
      monkeyPoker: this.monkeyPoker,
      turn: this.turn,
      currentPlayer: this.getCurrentPlayer(),
      players: this.players.map((p) => {
        const isViewer = p.id === viewerId;
        const hidePet = this.state === "waiting" && !isViewer && p.pet;
        return {
          ...p,
          revealedTiles: [...p.revealedTiles],
          pet: hidePet ? "hidden" : p.pet,
          petCooldown: hidePet ? 0 : p.petCooldown,
          pendingPet: p.pendingPet ? p.pendingPet.type : null,
        };
      }),
      dice: this.dice,
      diceRolled: this.diceRolled,
      properties,
      boardLayout,
      auction: this.auction
        ? {
            position: this.auction.position,
            propName: this.auction.propName,
            propPrice: this.auction.propPrice,
            propGroup: this.auction.propGroup,
            phase: this.auction.phase,
            landingPlayer: this.auction.landingPlayer,
            magicUser: this.auction.magicUser || null,
            landerOpenBid: this.auction.landerOpenBid ?? null,
            respondDeadline: this.auction.respondDeadline || null,
            respondStartTime: this.auction.respondStartTime || null,
            acceptTime: this.auction.acceptTime || null,
            bids: Object.fromEntries(
              Object.entries(this.auction.bids).map(([id, b]) => [
                id,
                { placed: b.placed, passed: b.passed },
              ]),
            ),
          }
        : null,
      mushroomPending: this.mushroomPending
        ? { mushroomPos: this.mushroomPending.mushroomPos }
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
      teamTarget: this.teamTarget,
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
      bombSelfDamage: this.bombSelfDamage || null,
      diceMatchTiles: this.diceMatchTiles || null,
      diceMatchGrownAmounts: this.diceMatchGrownAmounts || null,
      diceMatchEarlyPickup: this.diceMatchEarlyPickup != null ? this.diceMatchEarlyPickup : null,
      growSquatterSteals: this.growSquatterSteals || null,
      lastGrowFired: this.lastGrowFired || null,
      lastStartPick: this.lastStartPick || null,
      lastTeleport: this.lastTeleport || null,
      lastTileSwap: this.lastTileSwap || null,
      simpleCardUsedThisTurn: !!this.simpleCardUsedThisTurn,
      superBananaWin: this.superBananaWin || null,
      sellListings: this.sellListings.map((l) => ({ ...l })),
      lobbyReady: this._lobbyReady ? [...this._lobbyReady] : [],
      // Simple-mode item auction
      itemAuctionEnabled: !!this.itemAuctionEnabled,
      itemAuctionVickrey: !!this.itemAuctionVickrey,
      itemAuctionTimer: this.itemAuctionTimer,
      itemAuctionStartValue: this.itemAuctionStartValue,
      itemAuctionCounter: this.itemAuctionCounter,
      itemAuction: this._serializeItemAuction(viewerId),
    };
  }

  _serializeItemAuction(viewerId) {
    const a = this.itemAuction;
    if (!a) return null;
    const showAllAmounts = a.phase === "result";
    const bids = {};
    for (const [id, b] of Object.entries(a.bids || {})) {
      bids[id] = {
        submitted: !!b.submitted,
        autoPass: !!b.autoPass,
        amount:
          showAllAmounts || id === viewerId ? (b.amount ?? null) : null,
      };
    }
    return {
      phase: a.phase, // 'wheel' | 'bidding' | 'result'
      item: a.item || null,
      wheelStartedAt: a.wheelStartedAt || null,
      wheelEndsAt: a.wheelEndsAt || null,
      deadline: a.deadline || null,
      bids,
      participantIds: a.participantIds || [],
      result: a.result || null,
      vickrey: !!this.itemAuctionVickrey,
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

module.exports = { MonopolyGame, BOARD, BUYABLE, PET_TYPES };
