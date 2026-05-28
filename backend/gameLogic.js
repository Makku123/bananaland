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
// 48 tiles arranged as a CORNERLESS square (12 tiles per side, no corner
// slots):
//   40 farm tiles (yields 10..400 in steps of 10, all "simple" group),
//   6 grow tiles (all 100%, labelled 1..6 in play),
//   2 special tiles (Super Banana, +500 Free Bananas).
// No tax (-10%), no Vine Swing tile (it's now an ability), no corners. Every
// tile is shuffled at game start, so these initial positions only matter for
// the pre-shuffle reveal.
const SIMPLE_BOARD_SIZE = 48;
const SIMPLE_GROW_POSITIONS = [0, 8, 16, 24, 32, 40]; // 6 grow tiles
const SIMPLE_SUPER_BANANA_POS = 12;
const SIMPLE_FREE_BANANAS_POS = 36;

const SIMPLE_SPECIAL_POSITIONS = new Set([
  ...SIMPLE_GROW_POSITIONS,
  SIMPLE_SUPER_BANANA_POS,
  SIMPLE_FREE_BANANAS_POS,
]);

const SIMPLE_FARM_POSITIONS = [];
for (let i = 0; i < SIMPLE_BOARD_SIZE; i++) {
  if (!SIMPLE_SPECIAL_POSITIONS.has(i)) SIMPLE_FARM_POSITIONS.push(i);
}

const PROPERTIES_SIMPLE = SIMPLE_FARM_POSITIONS.map((pos, idx) => ({
  id: pos,
  // F1..F40 — sequential index (there are 40 farms). The yield (`price`) equals
  // the F-number: 1..40, ascending with the index. The board shows "F"+price.
  name: `F${idx + 1}`,
  group: "simple",
  price: idx + 1,
  rent: [0, 0, 0, 0, 0, 0],
}));

const _BUYABLE_MAP_SIMPLE = new Map();
PROPERTIES_SIMPLE.forEach((p) =>
  _BUYABLE_MAP_SIMPLE.set(p.id, { ...p, type: "property" }),
);

const BOARD_SIMPLE = (() => {
  const board = [];
  const growSet = new Set(SIMPLE_GROW_POSITIONS);
  for (let i = 0; i < SIMPLE_BOARD_SIZE; i++) {
    if (growSet.has(i)) {
      board.push({
        id: i,
        name: "🌴 GROW 100%",
        type: "grow",
        growPct: 1.0,
      });
    } else if (i === SIMPLE_SUPER_BANANA_POS) {
      board.push({
        id: i,
        name: "⭐",
        type: "special",
        buyable: {
          name: "⭐ Super Banana",
          type: "property",
          group: "mushroom",
          price: 777,
          rent: [0, 0, 0, 0, 0, 0],
        },
      });
    } else if (i === SIMPLE_FREE_BANANAS_POS) {
      board.push({ id: i, name: "+25", type: "freebananas" });
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

// Simple-mode special-item labels (emoji + name), shared by the log and the
// item auction. These are the four biddable items — won only via the item
// auction, held as consumables, spent one per use. Keys are canonical.
const SIMPLE_CARD_LABELS = {
  // Internal keys are legacy; the displayed items are:
  rabbitDice: "🐢 Turtle Dice", // roll 1 die
  cheetahDice: "🐇 Rabbit Dice", // roll 3 dice
  magicDice: "1️⃣ Roll One", // guaranteed move of 1
  // Internal key stays "teleport"; displayed as Vine Swing in simple mode.
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
    bombCost,
  ) {
    this.gameId = gameId;
    this.isPublic = !!isPublic;
    this.gameMode =
      gameMode === "teams" || gameMode === "simple" ? gameMode : "ffa";
    // Simple-mode item auction settings
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
    // Simple-mode ability bookkeeping
    this.simpleCardUsedThisTurn = false; // at most one card use per turn
    this.lastTeleport = null; // { playerId, position, turn } — no-walk anim hint
    this.lastTileSwap = null; // { a, b, turn } — swap anim hint
    this.pendingTileShuffles = null; // [{ color, leavingName, positions, endsAt }]
    this.lastTileShuffle = null; // { positions, ts } — sound-effect trigger
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
    // Cost to buy a pineapple bomb. Adjustable (create page / lobby); default 666.
    this.bombCost = Math.min(Math.max(Math.floor(bombCost) || 666, 0), 99999);
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
    // Number of tiles in this game's loop: 52 (classic) or 48 (simple,
    // cornerless). All movement/wrap math uses this instead of BOARD_SIZE.
    this.boardSize = this.board.length;
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
      // Tiles revealed only as fog-of-war hints (not genuine discoveries for
      // grow ranges, rolled-grow firing, or the Owned-Farms chart). A tile
      // leaves this set the moment it is genuinely revealed (landed on). Kept
      // for grow-anchoring logic even though the Scout ability is retired.
      scoutedTiles: new Set(),
      // Simple mode auto-selects the strong pet internally; the Magic Dice it
      // backs is now a won consumable, not an always-on cooldown ability.
      pet: this.gameMode === "simple" ? "strong" : null,
      petCooldown: 0,
      pendingPet: null,
      bomb: 0,
      hasRolled: false,
      startPickPending: false,
      // Magic Dice picker offers all six numbers 1..6 (no "stay put" / 0 step).
      magicDiceMaxSteps: this.gameMode === "simple" ? 6 : 0,
      // Simple mode special-item inventory. Won via the item auction only,
      // stockpiled, spent one per use. Players start empty.
      cards: {
        rabbitDice: 0,
        cheetahDice: 0,
        magicDice: 0,
        teleport: 0,
      },
      // Simple mode: the special item armed (during others' turns) to fire when
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
      settings.gameMode === "teams" ||
      settings.gameMode === "ffa" ||
      settings.gameMode === "simple"
    ) {
      if (this.gameMode !== settings.gameMode) {
        this.gameMode = settings.gameMode;
        this.board =
          this.gameMode === "simple" ? [...BOARD_SIMPLE] : [...BOARD];
        this.boardSize = this.board.length;
        this._initProperties();
        // Simple mode auto-assigns the strong pet ("Magic Dice"); leaving
        // other modes wipes pets so players can re-pick from the full set.
        if (this.gameMode === "simple") {
          for (const p of this.players) {
            p.pet = "strong";
            p.magicDiceMaxSteps = 6; // fixed at 6 (no upgrades)
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
    // SIMPLE MODE (active game): the leaver's tiles get their owner cleared
    // and any bananaPile wiped to 0. The now-empty tiles are then SHUFFLED
    // into random hidden positions — visually "covered back up" so the rest
    // of the game has to rediscover and auction them. Any player who happens
    // to be sitting on one of those tiles is NOT auto-auctioned — they
    // didn't land on the new tile, so it stays hidden under them until
    // someone actually lands on it via dice. This avoids back-to-back
    // auctions when multiple players are sitting on leaver tiles.
    //
    // OTHER MODES: the legacy behaviour — owner cleared, pile wiped, tile
    // auctionable again at its original position.
    const _shuffleInSimple =
      this.gameMode === "simple" && this.state === "playing";
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

    // Simple mode leave-shuffle:
    // 1) IMMEDIATELY cover the leaver's tiles with their colour (un-reveal +
    //    publish a pendingTileShuffles entry the frontend renders as coloured
    //    covers + a "Bob left — tiles will be reshuffled" notification).
    // 2) After a 2s pause, shuffle the leaver tiles AMONG THEMSELVES (other
    //    hidden tiles are no longer dragged into the swap) and broadcast a
    //    lastTileShuffle stamp so the frontend plays the shuffle sound.
    // Wrapped so a bug in the deferred branch never tears down the server —
    // worst case the tiles stay where they are (still unowned, still covered).
    if (_shuffleInSimple && _leaverTilePositions.length > 0) {
      try {
        // Un-reveal the leaver's tiles right away so the cover is visible
        // while the notification holds. Other tiles are left alone.
        for (const pos of _leaverTilePositions) {
          for (const p of this.players) {
            if (p.revealedTiles) p.revealedTiles.delete(pos);
            if (p.scoutedTiles) p.scoutedTiles.delete(pos);
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

        setTimeout(() => {
          try {
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
                if (p.scoutedTiles) p.scoutedTiles.delete(pos);
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
          } catch (err) {
            console.error(
              "[removePlayer] deferred shuffle failed:",
              (err && err.stack) || err,
            );
          }
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
    this.boardSize = this.board.length;
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
    this.pendingTileShuffles = null;
    this.lastTileShuffle = null;
    // Reset players to lobby state
    for (const p of this.players) {
      p.position = 0;
      p.money = this.startingMoney;
      p.properties = [];
      p.bankrupt = false;
      p.revealedTiles = new Set([START_POSITION]);
      p.scoutedTiles = new Set();
      // Simple mode auto-selects the strong pet (it has no lobby pet picker), so
      // restore it here — otherwise every player returns to the lobby pet-less and
      // startGame's "all players must have a pet" check blocks the host from ever
      // starting again. FFA/teams keep null so players re-pick in the lobby.
      p.pet = this.gameMode === "simple" ? "strong" : null;
      p.petCooldown = 0;
      p.pendingPet = null;
      p.bomb = 0;
      p.hasRolled = false;
      p.startPickPending = false;
      // Simple mode: Magic Dice fixed at 6 (no upgrades); other modes don't use it.
      p.magicDiceMaxSteps = this.gameMode === "simple" ? 6 : 0;
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
        p.scoutedTiles = new Set();
        // Everyone starts with one of each special item. They can't be used on
        // the start-pick (first) turn — that turn is consumed by the pick and
        // diceRolled is set — so they're usable from each player's second turn.
        p.cards = { rabbitDice: 1, cheetahDice: 1, magicDice: 1, teleport: 1 };
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

  // Decide how many dice `player` rolls, consuming a won item where needed.
  //   Simple mode: the FREE default is 2d6. A Turtle Dice item drops you to 1
  //   die; a Rabbit Dice item bumps you to 3 dice — each spent on the roll.
  //   (Legacy card keys: rabbitDice = Turtle Dice / 1 die, cheetahDice = Rabbit
  //   Dice / 3 dice.) With no matching item, you roll the default 2 dice.
  //   Other modes: 2 dice default; pay 300 to drop to 1 or bump to 3.
  _resolveDiceCount(player, diceCount) {
    if (this.gameMode === "simple") {
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
    if (diceCount === 1 && player.money >= 300) {
      player.money -= 300;
      return 1;
    }
    if (diceCount === 3 && player.money >= 300) {
      player.money -= 300;
      return 3;
    }
    return 2;
  }

  rollDice(socketId, diceCount) {
    this.lastExplosion = null;
    this.bombSelfDamage = null;
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
    // Simple-mode item auction: every dice value subtracts from the counter.
    this._subtractItemAuctionCounter(diceSum);
    const oldPos = cur.position;

    // Simple mode: the GROW tile whose label matches the dice SUM fires BEFORE
    // the player moves — the player still moves the full sum. (Grows are labeled
    // 1..6, so sums 7..12 match none.) Fresh piles on the start tile are
    // early-picked, and piles it creates on farms along the path are collected
    // during the walk below. (A GROW tile the player physically lands on still
    // fires after the move, in _processLanding.)
    this._processSimpleRolledGrow(cur, diceSum);

    cur.position = (cur.position + diceSum) % this.boardSize;
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
      cur.money += crossedFreeBananas.length * this._freeBananasAmount();
    }

    // Dice-match grow: if dice sum matches a farm label number you own, 100% grow
    this._processDiceMatchGrow(cur, diceSum);

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
      !this.mushroomPending
    ) {
      // Defer the log/UI notification for crossed freebananas until after walk animation
      // (money was already applied above so landing checks like super banana use the right balance)
      setTimeout(() => {
        for (const pos of crossedFreeBananas) {
          this._log(
            `${cur.name} crossed Free Bananas +${this._freeBananasAmount()} and collected ${this._freeBananasAmount()}\ud83c\udf4c! \ud83c\udf4c`,
          );
          if (this.onUpdate) this.onUpdate();
        }
      }, walkAnimMs);
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 2000);
    }

    return { dice: this.dice, moved: true };
  }

  // Simple-mode "Roll One" item (legacy key magicDice): a guaranteed move of
  // exactly 1 space — walks one tile and fires GROW 1 (sum 1) just like rolling
  // a 1. Spends one item. The `steps` argument is ignored (always 1).
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
    // Must hold a won Roll One item to use it.
    if (!cur.cards || (cur.cards.magicDice || 0) <= 0) return null;
    const n = 1; // Roll One always moves exactly 1

    // Reset per-turn transient state (mirrors rollDice).
    this.lastExplosion = null;
    this.bombSelfDamage = null;
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
    // Simple-mode item auction: Magic Dice counts as a dice roll.
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

    // Simple mode: the chosen number fires its labeled GROW tile BEFORE the
    // player moves (see rollDice for the rationale). A GROW tile the player
    // physically lands on still fires after the move, in _processLanding.
    this._processSimpleRolledGrow(cur, n);

    cur.position = (cur.position + n) % this.boardSize;
    cur.revealedTiles.add(cur.position);

    const crossedFreeBananas = this._collectBananasOnPath(
      cur,
      oldPos,
      cur.position,
    );
    if (crossedFreeBananas.length > 0) {
      cur.money += crossedFreeBananas.length * this._freeBananasAmount();
    }

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
            `${cur.name} crossed Free Bananas +${this._freeBananasAmount()} and collected ${this._freeBananasAmount()}🍌! 🍌`,
          );
          if (this.onUpdate) this.onUpdate();
        }
      }, walkAnimMs);
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  // Magic Dice no longer upgrades — it's fixed at level 6 (all numbers 1..6).
  // Kept as a no-op so the legacy upgrade_magic_dice event does nothing.
  upgradeMagicDice() {
    return false;
  }

  // -- Simple Mode Special Items (won via the item auction) --------
  // Four items, won at the item auction (or one of each free at game start),
  // stockpiled and spent one per use. The dice items go through the roll path
  // (rollDice 1/3 dice and useMagicDice); only Vine Swing flows through useCard.
  // (Legacy keys → current items: rabbitDice = Turtle Dice / 1 die, cheetahDice
  //  = Rabbit Dice / 3 dice, magicDice = Roll One / guaranteed move 1.)
  //   teleport — "Vine Swing": swing (no walking) to one of your OWN farms;
  //              landing effects fire (collect that farm's pile, poker if an
  //              opponent squats there). Replaces your roll. Needs an owned farm.
  // Each replaces your move for the turn, so at most one is used per turn.

  canUseSimpleCard(player, cardType) {
    if (!player || player.bankrupt) return false;
    if (!player.cards || player.cards[cardType] === undefined) return false;
    if (player.cards[cardType] <= 0) return false;
    if (cardType === "teleport") {
      // Vine Swing needs at least one farm YOU own to swing to.
      return this._ownedFarmPositions(player).length > 0;
    }
    return false;
  }

  // Board positions of the simple-mode farm tiles a player currently owns.
  _ownedFarmPositions(player) {
    if (!player || !player.properties) return [];
    return player.properties.filter((pos) => {
      const prop = this.properties.get(pos);
      return prop && prop.group === "simple";
    });
  }

  // Special items are won via the item auction only — there is no shop. Kept as
  // a no-op so the legacy buy_card socket event does nothing.
  buyCard() {
    return false;
  }

  // Simple mode: arm a special item to fire when YOUR turn starts. Arming a
  // (non-null) item is only allowed when it's NOT your turn and you own it;
  // passing null disarms (allowed anytime — e.g. cancelling on your turn).
  armAbility(socketId, ability) {
    if (this.gameMode !== "simple") return false;
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    if (ability === null || ability === undefined) {
      player.armedAbility = null;
      return true;
    }
    if (!["rabbitDice", "cheetahDice", "magicDice", "teleport"].includes(ability)) {
      return false;
    }
    if ((player.cards && player.cards[ability]) <= 0) return false; // must own it
    const cur = this.getCurrentPlayer();
    if (cur && cur.id === socketId) return false; // arm only before your turn
    player.armedAbility = ability;
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
    if (this.gameMode !== "simple") return null;
    if (this.state !== "playing") return null;
    if (cardType !== "teleport") return null;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return null;
    if (!this.canUseSimpleCard(player, cardType)) return null;

    // Vine Swing: only on your turn, before rolling.
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return null;
    if (this.diceRolled) return null;
    if (this.petResolving) return null;
    if (cur.startPickPending) return null;
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
      return null;
    if (this.itemAuction) return null;
    if (this.simpleCardUsedThisTurn) return null;

    if (!this._validateTeleportTarget(cur, data)) return null;

    cur.cards.teleport = Math.max(0, (cur.cards.teleport || 0) - 1);
    this.simpleCardUsedThisTurn = true;
    return this._useTeleportCard(cur, Math.floor(data.pos));
  }

  _validateTeleportTarget(player, data) {
    if (!data) return false;
    const pos = Math.floor(data.pos);
    if (!Number.isFinite(pos) || pos < 0 || pos >= this.boardSize) return false;
    // Vine Swing only swings to a farm YOU own — nothing else. Occupied is
    // allowed (a squatting opponent there triggers poker, like a normal landing).
    const prop = this.properties.get(pos);
    if (!prop || prop.owner !== player.id || prop.group !== "simple") return false;
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
  // GROW, win on Super Banana, +500 on Free Bananas, detonate a bomb, start
  // poker if a player stands there, or open a banana-bid auction on an unowned
  // farm. Replaces the dice roll for the turn.
  _useTeleportCard(cur, pos) {
    this._beginCardTurn(cur);
    // Swinging away from a tile counts as LEAVING it: if you were squatting on
    // an opponent's farm, you take its accumulated pile as you swing off (the
    // squat steal-on-leave rule, TODO line 56 — also applied in
    // _collectBananasOnPath for walked moves).
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
    if (cur.scoutedTiles) cur.scoutedTiles.delete(pos); // genuine reveal, no veil
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
    a.phase = "pitch";
    this._log(`🎁 An item is up for auction — the starter is naming a price...`);
    // Broke starter auto-lists for free, then straight to responses.
    if (starter.money <= 0) {
      a.listPrice = 0;
      this._beginItemAuctionRespond();
    }
    if (this.onUpdate) this.onUpdate();
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
      (p) => !p.bankrupt && p.id !== a.startedBy,
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
    return { ...SIMPLE_CARD_LABELS };
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
      !this.mushroomPending
    ) {
      this._scheduleAutoEnd(cur, debugWalkMs + 2000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  _processLanding(player) {
    const space = this.board[player.position];
    if (!space) return;
    // Landing here is a genuine discovery — drop any scouted-only veil on it.
    if (player.scoutedTiles) player.scoutedTiles.delete(player.position);

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
    // Monkey Poker is a duel: if 2+ opponents are already on this tile, the
    // landing player joins a crowd — no poker fires.
    const opponents = this.players.filter(
      (p) =>
        p.id !== player.id &&
        !p.bankrupt &&
        !p.startPickPending &&
        p.position === player.position &&
        (this.gameMode !== "teams" ||
          this.getTeamOf(p.id) !== this.getTeamOf(player.id)),
    );
    if (opponents.length === 1 && player.money > 0 && opponents[0].money > 0) {
      this._startPoker(player.id, opponents[0].id);
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
      const fb = this._freeBananasAmount();
      if (wasHidden) {
        // Tile was hidden: reveal first, then award bananas after 1 second
        this._log(
          `${player.name} landed on a hidden tile and revealed Free Bananas +${fb}!`,
        );
        if (this.onUpdate) this.onUpdate();
        const pos = player.position;
        setTimeout(() => {
          // Make sure the player is still in the game
          const p = this.players.find((pl) => pl.id === player.id);
          if (p) {
            p.money += fb;
            this._log(
              `${p.name} collected ${fb}\ud83c\udf4c from Free Bananas +${fb}! \ud83c\udf4c`,
            );
            if (this.onUpdate) this.onUpdate();
          }
        }, 1000);
      } else {
        // Tile was already revealed: award immediately
        player.money += fb;
        this._log(
          `${player.name} landed on Free Bananas +${fb} and collected ${fb}\ud83c\udf4c! \ud83c\udf4c`,
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
      for (let i = 0; i < this.boardSize; i++) {
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
    // Landing here is a genuine discovery — drop any scouted-only veil on it.
    if (player.scoutedTiles) player.scoutedTiles.delete(player.position);

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
      const fb = this._freeBananasAmount();
      player.money += fb;
      this._log(
        `${player.name} was pushed onto Free Bananas +${fb} and collected ${fb}\ud83c\udf4c! \ud83c\udf4c`,
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

    // Simple-mode grow labels must follow their tiles too. The Super Banana can
    // swap with a hidden GROW tile; if growTileLabels isn't moved, the relocated
    // grow tile loses its "G N" label and falls back to its raw "GROW N" name.
    if (this.growTileLabels) {
      const mushGrow = this.growTileLabels.get(mushroomPos);
      const swapGrow = this.growTileLabels.get(swapPos);
      this.growTileLabels.delete(mushroomPos);
      this.growTileLabels.delete(swapPos);
      if (mushGrow !== undefined) this.growTileLabels.set(swapPos, mushGrow);
      if (swapGrow !== undefined) this.growTileLabels.set(mushroomPos, swapGrow);
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
    for (let i = 0; i < this.boardSize; i++) {
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
    return this._createAuctionForLander(socketId);
  }

  // Create an auction for an arbitrary lander (not necessarily the current
  // player). Used by the shuffle-on-leave flow when a tile shifts under a
  // sitting player and must be put up for bid by them. Caller is responsible
  // for guarding when this should fire \u2014 this method only checks that the
  // lander exists, the tile is buyable + unowned, and no auction is already
  // running.
  _createAuctionForLander(landerId) {
    if (this.auction) return false;
    const lander = this.players.find((p) => p && p.id === landerId);
    if (!lander || lander.bankrupt) return false;
    const pos = lander.position;
    const prop = this.properties.get(pos);
    if (!prop || prop.owner) return false;

    const bidders = [];
    bidders.push(lander.id);
    for (const p of this.players) {
      if (!p.bankrupt && p.id !== lander.id) bidders.push(p.id);
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
    if (lander.money === 0) {
      const lb = this.auction.bids[lander.id];
      lb.amount = 0;
      lb.placed = true;
      lb.bidTime = Date.now();
      this._log(`${lander.name} has 0\ud83c\udf4c \u2014 auto-listed for free!`);
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
        a.respondDeadline = Date.now() + 15000;
        a.respondStartTime = Date.now();
        this._log(
          `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 15 seconds to decide!`,
        );
      }

      // Start the 15s timer — when it expires, lander buys (unless noTimer is on)
      if (this._auctionTimer) clearTimeout(this._auctionTimer);
      if (!this.noAuctionTimer) {
        this._auctionTimer = setTimeout(() => {
          this._auctionTimer = null;
          if (!this.auction || this.auction.phase !== "respond") return;
          // Timer expired — lander buys
          this._log(`\u23f0 Time's up!`);
          this._closeRespondPhase();
          if (this.onUpdate) this.onUpdate();
        }, 15000);
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
      a.silentDeadline = Date.now() + 15000;
      a.silentStartTime = Date.now();
      this._log(
        `Multiple takers — silent tie-breaker! 15s to bid on top of ${a.landerOpenBid}🍌.`,
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
      }, 15000);
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
    if (!b || b.responded) return false;

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

  // Simple mode: a player's first turn is picking any tile to start on.
  // The chosen tile is treated like a normal landing (auction if a farm, etc).
  pickStartTile(socketId, position) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (!cur.startPickPending) return false;
    if (this.auction || this.poker || this.vineSwing || this.mushroomPending)
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

    if (!this.auction && !this.vineSwing && !this.poker && !this.mushroomPending) {
      this._scheduleAutoEnd(cur, 1000);
    }
    return true;
  }

  // -- Simple-mode Grow Helpers -----------------------------------

  // Assign random 1..6 labels to the 6 grow tiles and rewrite each tile's
  // display name to "GROW N". Called once at game start (after shuffle).
  _assignSimpleGrowLabels() {
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

  _findSimpleGrowByLabel(label) {
    if (!this.growTileLabels) return null;
    for (const [pos, lbl] of this.growTileLabels) {
      if (lbl === label) return pos;
    }
    return null;
  }

  // A board position is "genuinely revealed" if at least one player has it in
  // revealedTiles for a real reason (landing/movement) — NOT merely via the
  // Scout ability. Scout reveals a tile to its user's fog of war but must not
  // act as a genuine discovery for grow ranges, rolled-grow firing, or the
  // Owned-Farms chart. Genuine grow reveals broadcast to every player, so this
  // is effectively global.
  _isGenuinelyRevealed(pos) {
    for (const p of this.players) {
      if (!p.revealedTiles || !p.revealedTiles.has(pos)) continue;
      if (p.scoutedTiles && p.scoutedTiles.has(pos)) continue;
      return true;
    }
    return false;
  }

  // The set of all board positions genuinely revealed by any player (i.e. each
  // player's revealedTiles minus the tiles they only scouted). See above.
  _globalGenuineRevealed() {
    const set = new Set();
    for (const p of this.players) {
      if (!p.revealedTiles) continue;
      for (const pos of p.revealedTiles) {
        if (p.scoutedTiles && p.scoutedTiles.has(pos)) continue;
        set.add(pos);
      }
    }
    return set;
  }

  // Grow-tile positions that are genuinely revealed (not merely scouted) by any
  // player. The Owned-Farms chart groups farms by the nearest such grow.
  _genuineRevealedGrowPositions() {
    const out = [];
    if (!this.growTileLabels) return out;
    for (const pos of this.growTileLabels.keys()) {
      if (this._isGenuinelyRevealed(pos)) out.push(pos);
    }
    return out;
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
      for (let off = 1; off < this.boardSize; off++) {
        range.add((growPos + off) % this.boardSize);
      }
      return range;
    }
    for (let off = 1; off < this.boardSize; off++) {
      const p = (growPos + off) % this.boardSize;
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
    // The glow is recorded at the END of this method, and ONLY if the grow
    // actually produced bananas — see lastGrowFired below. Firing on an empty
    // range (no farms in range) grows nothing and must not glow.
    // Landing on a grow genuinely reveals it to everyone for the run, clearing
    // any prior scouted-only status. A roll never reveals a hidden grow: by the
    // time a roll reaches here the tile is already genuinely revealed (see the
    // dormant check in _processSimpleRolledGrow).
    if (source === "land") {
      for (const p of this.players) {
        p.revealedTiles.add(growPos);
        if (p.scoutedTiles) p.scoutedTiles.delete(growPos);
      }
    }

    // Record EVERY fire (even one that grows nothing) so the frontend can play
    // the grow-pulse animation for it — empty fires just pulse quickly. Tagged
    // with the source so the frontend knows whether it fired pre-move (roll /
    // magic dice → pulse before the walk) or on arrival (land).
    this.lastGrowActivated = (this.lastGrowActivated || []).concat([
      { pos: growPos, source },
    ]);

    // Use the globally GENUINELY-revealed set as the boundary — any grow truly
    // discovered by any player bounds the range. A merely-scouted grow does NOT
    // bound the range. Prevents the "whole board grows" case when the activating
    // player hasn't personally revealed grows that others already have.
    const range = this._simpleGrowRange(growPos, this._globalGenuineRevealed());
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
    let totalEarlyPicked = 0;
    let earlyPickupTile = null;
    // Every owned farm that grew (or was stolen from) this fire, plus the fresh
    // amount per non-stolen tile. These feed the dice-match animation pipeline
    // (see below) so the frontend pops the piles in and collects them along the
    // walk — exactly like classic mode's dice-match grows.
    const grownTiles = [];
    const grownAmounts = {};
    for (const propId of ownedInRange) {
      const prop = this.properties.get(propId);
      const amount = prop.price; // simple mode = 100%
      if (amount <= 0) continue;
      grownTiles.push(propId);

      // Early pickup: if the owner is standing on their own farm when it
      // grows, they pocket the bananas immediately instead of leaving a pile to
      // loop back around for. Sweeps the whole tile — the fresh growth plus any
      // pile already sitting there — and takes priority over any opponent
      // squatting on the tile (mirrors classic mode's owner-on-tile rule).
      if (player.position === propId && !player.startPickPending) {
        const pickup = amount + (prop.bananaPile || 0);
        prop.bananaPile = 0;
        player.money += pickup;
        totalEarlyPicked += pickup;
        earlyPickupTile = propId;
        grownAmounts[propId] = amount; // fresh growth (pre-existing handled by walk collection)
        continue;
      }

      // Squat / quick-steal rule (TODO line 56): grown bananas always land in
      // the farm's pile — a squatter NO LONGER grabs them the instant they
      // sprout. Whoever reaches the pile first collects it: the owner by
      // crossing/landing on the farm (so they can reclaim a grow on the same
      // turn it fired), or the squatter when they LEAVE the tile (handled by
      // _collectBananasOnPath's leave-steal).
      prop.bananaPile += amount;
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

  // Simple mode: each die face fires its own labeled GROW tile. Doubles fire
  // once (deduped). Movement still uses the dice sum (handled by the caller).
  // This makes every die value 1..6 map to a grow, instead of the dice sum
  // (which is 2..12 with two dice, so it could never hit labels 1 or 7..12).
  _processSimpleRolledGrows(player, rolls) {
    if (this.gameMode !== "simple") return;
    const fired = new Set();
    for (const d of rolls) {
      if (fired.has(d)) continue;
      fired.add(d);
      this._processSimpleRolledGrow(player, d);
    }
  }

  // Simple mode: a die face in 1..6 fires the matching GROW tile's effect (grow
  // tiles are labelled 1..6), but ONLY if that grow tile has already been
  // genuinely revealed (landed on). A still-hidden or merely-scouted grow stays
  // dormant. Values outside 1..6 (e.g. a Magic Dice step > 6) match no grow and
  // are ignored; the player still walks normally afterwards.
  _processSimpleRolledGrow(player, value) {
    if (this.gameMode !== "simple") return;
    if (value < 1 || value > 6) return;
    const growPos = this._findSimpleGrowByLabel(value);
    if (growPos == null) return;
    // Dormant until genuinely discovered: a hidden grow does nothing (no growth,
    // no reveal) when its number is rolled — it must be revealed by landing
    // first. A grow that has only been scouted stays dormant (scouting reveals
    // the tile to its user but is not a genuine discovery).
    if (!this._isGenuinelyRevealed(growPos)) return;
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
          (cur - 1 + this.boardSize) % this.boardSize,
          (cur + 1) % this.boardSize,
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
    const steps = (newPos - oldPos + this.boardSize) % this.boardSize;
    if (steps === 0) return [];
    let collected = 0;
    let stolen = 0;
    const stolenVictims = new Set();
    const crossedFreeBananas = [];

    // Squat / quick-steal rule, simple mode: collect the pile on the tile
    // you're LEAVING if you don't own it. While you squatted there grown
    // bananas piled up (instead of being stolen the instant they grew), so
    // you grab that pile as you depart — unless the owner already reclaimed
    // it by crossing the farm first, in which case the pile is 0 and nothing
    // moves.
    if (this.gameMode === "simple") {
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
        // Own tile — collect on any crossed or landed-on tile.
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && !prop.owner) {
        // Collect unclaimed banana piles when landing on them
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (isLanding && prop.owner && prop.owner !== player.id) {
        if (this.gameMode === "simple") {
          // Simple mode: landing on an opponent's banana pile does NOT collect
          // it. You're now squatting on their farm — like a grow that happens
          // while you squat, the pile is yours to steal only when you LEAVE the
          // tile (the leave-steal above), and the owner can reclaim it first if
          // they cross/land here. So leave the pile sitting on the farm.
        } else {
          // Other modes: collect teammate piles; steal from opponents on landing.
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

  // Free Bananas tile payout: +25 in simple mode, +500 elsewhere.
  _freeBananasAmount() {
    return this.gameMode === "simple" ? 25 : 500;
  }

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

  // The 12 tile positions on the same cornerless-board side as `pos`
  // (bottom 0-11, left 12-23, top 24-35, right 36-47). Simple mode only.
  _simpleSideTiles(pos) {
    const side = Math.floor(pos / 12);
    const start = side * 12;
    const tiles = [];
    for (let i = start; i < start + 12 && i < this.boardSize; i++) tiles.push(i);
    return tiles;
  }

  // Tiles caught in a bomb blast. Simple mode blows the entire 12-tile side the
  // bomb sits on; classic mode blows the bomb tile and its two neighbours.
  _bombBlastTiles(position) {
    if (this.gameMode === "simple") return this._simpleSideTiles(position);
    return [
      position,
      (position - 1 + this.boardSize) % this.boardSize,
      (position + 1) % this.boardSize,
    ];
  }

  _checkBombDetonation(player) {
    if (!this.bombMode || this.bombs.length === 0) return false;
    const bombIndex = this.bombs.findIndex(
      (b) => !b.pending && b.position === player.position,
    );
    if (bombIndex === -1) return false;
    const bomb = this.bombs[bombIndex];

    // Classic mode: placer stepping on their own armed bomb keeps it armed and
    // just takes 50% self-damage, so they can't self-trigger to nuke neighbours.
    // Simple mode: landing on your own bomb DOES detonate the whole side — the
    // placer still only loses 50% (handled below in the victim loop), but
    // opponents on that side are eliminated.
    if (bomb.placedBy === player.id && this.gameMode !== "simple") {
      this._bombSelfDamage(player);
      this._checkBombWin();
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
        if (this.gameMode === "simple") {
          // Simple mode: bombing yourself is a no-op. The bomb still
          // detonates (so enemies in the blast still go down), but the placer
          // takes no damage and doesn't leave the game.
          continue;
        }
        this._bombSelfDamage(v);
      } else if (
        this.gameMode === "teams" &&
        this.teams &&
        this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
      ) {
        this._bombSelfDamage(v);
      } else {
        // Enemy victim \u2014 eliminated normally. In simple mode the placer
        // always survives their own blast, so enemy farms transfer to the
        // placer per the standard kill rule.
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
              if (this.gameMode === "simple") {
                // Simple mode: bombing yourself is a no-op. The bomb still
                // detonates (so enemies in the blast still go down), but the
                // placer takes no damage.
                continue;
              }
              this._bombSelfDamage(v);
            } else if (
              this.gameMode === "teams" &&
              this.teams &&
              this.getTeamOf(v.id) === this.getTeamOf(bomb.placedBy)
            ) {
              this._bombSelfDamage(v);
            } else {
              // Enemy victim — eliminated normally. In simple mode the placer
              // is immune to their own blast so enemy farms transfer to the
              // placer per the standard kill rule.
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

    // Swap simple-mode grow labels (G1..G6) so they follow their tile
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
    // Transfer path \u2014 classic kill: properties + loot move to the placer. In
    // simple mode the placer is immune to their own bomb, so a successful
    // enemy bomb still rewards the bomber the standard way.
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
      for (let i = 0; i < this.boardSize; i++) p.revealedTiles.add(i);
      // Everything is now genuinely on display — nothing remains scouted-only.
      if (p.scoutedTiles) p.scoutedTiles.clear();
    }
  }

  endTurn(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || !this.diceRolled) return false;
    if (this.mushroomPending) return false;
    if (this.superBananaWin) return false;
    if (this.itemAuction) return false;
    this._cancelAutoEnd();
    cur.armedAbility = null; // safety: drop any unconsumed armed item at turn end
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

    // Simple mode: grow tiles genuinely revealed (by landing, not merely
    // scouted) by ANY player. The Owned-Farms chart anchors each farm to the
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
      turn: this.turn,
      currentPlayer: this.getCurrentPlayer(),
      players: this.players.map((p) => {
        const isViewer = p.id === viewerId;
        const hidePet = this.state === "waiting" && !isViewer && p.pet;
        return {
          ...p,
          revealedTiles: [...p.revealedTiles],
          // Scouting is private ("visible only to you"), so only the viewer
          // gets their scouted-only set — used to render a translucent veil.
          scoutedTiles: isViewer ? [...(p.scoutedTiles || [])] : [],
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
            return {
              position: a.position,
              propName: a.propName,
              propPrice: a.propPrice,
              propGroup: a.propGroup,
              phase: a.phase, // 'pitch' | 'respond' | 'silentbid'
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
      simpleCardUsedThisTurn: !!this.simpleCardUsedThisTurn,
      superBananaWin: this.superBananaWin || null,
      sellListings: this.sellListings.map((l) => ({ ...l })),
      lobbyReady: this._lobbyReady ? [...this._lobbyReady] : [],
      // Simple-mode item auction
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
