// --- Monkey Bidniz Board Game Logic ----------------------------
// 52 spaces, 4 corners at 0/13/26/39, 12 non-corner per side

const BOARD_SIZE = 52;
const CORNER_POSITIONS = new Set([0, 13, 26, 39]);
const GROW_PERCENTAGES = { 0: 1.0, 13: 0.25, 26: 0.5, 39: 0.75 };

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
    price: 50,
    rent: [2, 10, 30, 90, 160, 250],
  },
  {
    id: 3,
    name: "CV2",
    group: "yellow",
    price: 50,
    rent: [4, 20, 60, 180, 320, 450],
  },
  {
    id: 4,
    name: "CV3",
    group: "yellow",
    price: 50,
    rent: [5, 25, 75, 200, 350, 475],
  },
  {
    id: 15,
    name: "CV4",
    group: "yellow",
    price: 50,
    rent: [5, 25, 75, 200, 350, 475],
  },
  {
    id: 35,
    name: "CV5",
    group: "yellow",
    price: 50,
    rent: [6, 28, 80, 220, 380, 500],
  },
  {
    id: 47,
    name: "CV6",
    group: "yellow",
    price: 50,
    rent: [6, 28, 80, 220, 380, 500],
  },
  // Blue Java (7)
  {
    id: 6,
    name: "BJ1",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
  },
  {
    id: 7,
    name: "BJ2",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
  },
  {
    id: 9,
    name: "BJ3",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
  },
  {
    id: 10,
    name: "BJ4",
    group: "lightblue",
    price: 100,
    rent: [8, 40, 100, 300, 450, 600],
  },
  {
    id: 11,
    name: "BJ5",
    group: "lightblue",
    price: 100,
    rent: [10, 50, 120, 350, 500, 650],
  },
  {
    id: 19,
    name: "BJ6",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
  },
  {
    id: 32,
    name: "BJ7",
    group: "lightblue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
  },
  // Red Dacca (5)
  {
    id: 14,
    name: "RD1",
    group: "red",
    price: 200,
    rent: [10, 50, 150, 450, 625, 750],
  },
  {
    id: 16,
    name: "RD2",
    group: "red",
    price: 200,
    rent: [10, 50, 150, 450, 625, 750],
  },
  {
    id: 17,
    name: "RD3",
    group: "red",
    price: 200,
    rent: [12, 60, 180, 500, 700, 900],
  },
  {
    id: 18,
    name: "RD4",
    group: "red",
    price: 200,
    rent: [14, 70, 200, 550, 750, 950],
  },
  // Lady Finger (5)
  {
    id: 20,
    name: "LF1",
    group: "pink",
    price: 200,
    rent: [14, 70, 200, 550, 750, 950],
  },
  {
    id: 22,
    name: "LF2",
    group: "pink",
    price: 200,
    rent: [14, 70, 200, 550, 750, 950],
  },
  {
    id: 23,
    name: "LF3",
    group: "pink",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
  },
  {
    id: 24,
    name: "LF4",
    group: "pink",
    price: 200,
    rent: [18, 90, 240, 650, 850, 1050],
  },
  {
    id: 27,
    name: "CV7",
    group: "yellow",
    price: 50,
    rent: [18, 90, 250, 700, 875, 1050],
  },
  {
    id: 29,
    name: "CV8",
    group: "yellow",
    price: 50,
    rent: [18, 90, 250, 700, 875, 1050],
  },
  {
    id: 30,
    name: "CV9",
    group: "yellow",
    price: 50,
    rent: [20, 100, 300, 750, 925, 1100],
  },
  {
    id: 31,
    name: "CV10",
    group: "yellow",
    price: 50,
    rent: [22, 110, 320, 800, 975, 1150],
  },
  {
    id: 46,
    name: "CV11",
    group: "yellow",
    price: 50,
    rent: [6, 28, 80, 220, 380, 500],
  },
  {
    id: 5,
    name: "CV12",
    group: "yellow",
    price: 50,
    rent: [7, 30, 85, 230, 390, 510],
  },
  // Gros Michel (4)
  {
    id: 33,
    name: "GM1",
    group: "darkblue",
    price: 360,
    rent: [22, 110, 330, 800, 975, 1150],
  },
  {
    id: 34,
    name: "GM2",
    group: "darkblue",
    price: 360,
    rent: [24, 120, 360, 850, 1025, 1200],
  },
  {
    id: 36,
    name: "GM3",
    group: "darkblue",
    price: 360,
    rent: [25, 125, 370, 875, 1050, 1225],
  },
  {
    id: 37,
    name: "GM4",
    group: "darkblue",
    price: 360,
    rent: [27, 133, 380, 900, 1075, 1250],
  },
  // Red Dacca (5th)
  {
    id: 40,
    name: "RD5",
    group: "red",
    price: 200,
    rent: [15, 75, 210, 575, 775, 975],
  },
  // Lady Finger (5th)
  {
    id: 41,
    name: "LF5",
    group: "pink",
    price: 200,
    rent: [19, 95, 250, 675, 875, 1075],
  },
  // Goldfinger (3)
  {
    id: 48,
    name: "GF1",
    group: "orange",
    price: 500,
    rent: [35, 175, 500, 1100, 1300, 1500],
  },
  {
    id: 49,
    name: "GF2",
    group: "orange",
    price: 500,
    rent: [42, 188, 550, 1250, 1450, 1750],
  },
  {
    id: 51,
    name: "GF3",
    group: "orange",
    price: 500,
    rent: [50, 200, 600, 1400, 1700, 2000],
  },
];

// Build BOARD with buyable data embedded in each tile
const _BUYABLE_MAP = new Map();
PROPERTIES.forEach((p) => _BUYABLE_MAP.set(p.id, { ...p, type: "property" }));

const BOARD = [
  // -- Bottom row: GO -> JAIL (positions 0-12) --
  { id: 0, name: "\ud83c\udf34 GROW 100%", type: "grow" },
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
  { id: 13, name: "\ud83c\udf34 GROW 25%", type: "grow" },
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
  { id: 26, name: "\ud83c\udf34 GROW 50%", type: "grow" },
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
  { id: 39, name: "\ud83c\udf34 GROW 75%", type: "grow" },
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
  devil: {
    name: "Magic Pet",
    emoji: "??",
    cooldown: 10,
    description:
      "Flip a coin: heads move forward 1, tails move backward 1. 10 roll cooldown.",
  },
};

const PET_LIMITED_USES = {
  strong: 1,
  energy: 3,
  devil: 2,
};

// --- Game Class ----------------------------------------------------

class MonopolyGame {
  constructor(
    gameId,
    maxPlayers,
    startingMoney,
    gameMode,
    teamTarget,
    petMode,
    simpleAuction,
    bombMode,
    monkeyPoker,
    sideBonuses,
  ) {
    this.gameId = gameId;
    this.gameMode = gameMode === "teams" ? "teams" : "ffa";
    this.petMode = petMode === "limited" ? "limited" : "cooldown";
    if (this.gameMode === "teams") {
      this.maxPlayers = 4;
    } else {
      this.maxPlayers = Math.min(Math.max(maxPlayers || 4, 2), 4);
    }
    // Simple auction allowed for FFA games (2-4 players)
    this.simpleAuction = simpleAuction === true && this.gameMode === "ffa";
    this.startingMoney = Math.min(
      Math.max(Math.floor(startingMoney) || 2222, 100),
      99999,
    );
    this.bombMode = bombMode !== false; // on by default
    this.monkeyPoker = monkeyPoker !== false; // on by default
    this.sideBonuses = sideBonuses === true; // off by default
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
    this.auction = null; // { position, propName, bids: {playerId: {amount, count}}, order: [], currentIndex, highBid, highBidder }
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
    if (this.players.length >= this.maxPlayers || this.state !== "waiting")
      return null;
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
      revealedTiles: new Set([...CORNER_POSITIONS, 0]),
      pet: null,
      petCooldown: 0,
      petUses: 0,
      pendingPet: null,
      bomb: false,
      hasRolled: false,
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
    if (settings.gameMode === "teams" || settings.gameMode === "ffa") {
      this.gameMode = settings.gameMode;
      if (this.gameMode === "teams") this.maxPlayers = 4;
    }
    if (settings.maxPlayers != null && this.gameMode !== "teams") {
      const mp = Math.min(Math.max(Math.floor(settings.maxPlayers) || 2, 2), 4);
      this.maxPlayers = Math.max(mp, this.players.length);
    }
    if (settings.petMode === "limited" || settings.petMode === "cooldown") {
      this.petMode = settings.petMode;
    }
    return true;
  }

  selectPet(socketId, petType) {
    if (this.state !== "waiting") return false;
    if (!PET_TYPES[petType]) return false;
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
    // Check availability based on pet mode
    if (this.petMode === "limited") {
      if ((player.petUses || 0) <= 0) return false;
    } else {
      if (player.petCooldown > 0) return false;
    }
    // Pet usage costs 100 bananas (magic pet only)
    const petCost = player.pet === "devil" ? 100 : 0;
    if (player.money < petCost) return false;
    // Must have rolled at least once before using pet
    if (!player.hasRolled) return false;
    player.money -= petCost;

    const petType = player.pet;
    const cooldown = PET_TYPES[petType].cooldown;
    const isLimited = this.petMode === "limited";

    // Energy pet: activate OFF-turn. Coin flip + move resolves at start of player's next turn.
    if (petType === "energy") {
      const cur = this.getCurrentPlayer();
      // Energy pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      if (isLimited) {
        player.petUses = Math.max(0, (player.petUses || 0) - 1);
      }
      // Cooldown is set when coin flip resolves at start of next turn, not here
      const costLabel = isLimited
        ? `${player.petUses} use${player.petUses !== 1 ? "s" : ""} left`
        : `${cooldown} roll cooldown`;
      player.pendingPet = { type: "energy", cooldown };
      this.lastPetUsed = { playerName: player.name, petType: "energy" };
      this._log();
      return true;
    }

    // Strong pet: activate OFF-turn. Move forward 1 resolves at start of player's next turn (no coin flip).
    if (petType === "strong") {
      const cur = this.getCurrentPlayer();
      // Strong pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      if (isLimited) {
        player.petUses = Math.max(0, (player.petUses || 0) - 1);
      }
      // Cooldown is set when effect resolves at start of next turn, not here
      const costLabel = isLimited
        ? `${player.petUses} use${player.petUses !== 1 ? "s" : ""} left`
        : `${cooldown} roll cooldown`;
      player.pendingPet = { type: "strong", cooldown };
      this.lastPetUsed = { playerName: player.name, petType: "strong" };
      this._log();
      return true;
    }

    // Devil (Magic Pet): activate OFF-turn. Coin flip + move resolves at start of player's next turn.
    if (petType === "devil") {
      const cur = this.getCurrentPlayer();
      // Magic pet can only be activated when it's NOT your turn
      if (cur && cur.id === socketId) return false;
      // Can't activate if already pending
      if (player.pendingPet) return false;
      if (this.auction || this.poker || this.vineSwing) return false;

      if (isLimited) {
        player.petUses = Math.max(0, (player.petUses || 0) - 1);
      }
      const costLabel = isLimited
        ? `${player.petUses} use${player.petUses !== 1 ? "s" : ""} left`
        : `${cooldown} roll cooldown`;
      player.pendingPet = { type: "devil", cooldown };
      this.lastPetUsed = { playerName: player.name, petType: "devil" };
      this._log();
      return true;
    }

    return false;
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
        this._scheduleAutoEnd(cur2, 3000);
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
        petType: "devil",
        result: coinFlip ? "heads" : "tails",
        targetName: mp.targetName,
      };
      if (coinFlip) {
        this.pendingPetMove = {
          type: "devil_on_turn",
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
    if (!pending || pending.type !== "devil_on_turn") {
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
    this._processLandingPassive(target, pending.playerId);
    this._resolvePendingPets();
    if (this.onUpdate) this.onUpdate();
  }

  _triggerOwnPetOnTurn(player, pp) {
    this.petResolving = true;
    this.petUsedThisTurn = true;

    if (pp.type === "strong") {
      // Set cooldown now that the effect is resolving
      if (this.petMode !== "limited") {
        player.petCooldown = pp.cooldown;
      }
      const oldPos = player.position;
      player.position = (player.position + 1) % BOARD_SIZE;
      player.revealedTiles.add(player.position);
      this._collectBananasOnPath(player, oldPos, player.position);
      this._log(
        `\u{1F981} ${player.name}'s Strong Pet pushed them forward 1 space! (${pp.cooldown} roll cooldown)`,
      );
      this._processLandingPassive(player, player.id);
      this._resolvePendingPets();
      if (this.onUpdate) this.onUpdate();
      return;
    }

    if (pp.type === "energy") {
      // Set cooldown now that the coin flip is resolving
      if (this.petMode !== "limited") {
        player.petCooldown = pp.cooldown;
      }
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

    if (pp.type === "devil") {
      // Set cooldown now that the coin flip is resolving
      if (this.petMode !== "limited") {
        player.petCooldown = pp.cooldown;
      }
      // Show "Your Turn" for 2s before coin flip
      this.petTurnDelay = true;
      if (this.onUpdate) this.onUpdate();
      setTimeout(() => {
        this.petTurnDelay = false;
        const coinFlip = Math.random() < 0.5;
        this.petCoinFlip = {
          playerName: player.name,
          petType: "devil",
          result: coinFlip ? "heads" : "tails",
        };
        if (coinFlip) {
          this.pendingPetMove = {
            type: "devil_self_forward",
            playerId: player.id,
            cooldown: pp.cooldown,
          };
          if (this.onUpdate) this.onUpdate();
          setTimeout(() => {
            this._executeOwnDevilPetOnTurn(true);
          }, 5000);
        } else {
          this.pendingPetMove = {
            type: "devil_self_backward",
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
      (pending.type !== "devil_self_forward" &&
        pending.type !== "devil_self_backward")
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
    if (this.petMode === "limited") return (player.petUses || 0) > 0;
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

    // Release properties and clear banana piles
    for (const pid of this.players[idx].properties) {
      const prop = this.properties.get(pid);
      if (prop) {
        prop.owner = null;
        prop.bananaPile = 0;
      }
    }
    this.players.splice(idx, 1);
    if (this.currentPlayerIndex >= this.players.length)
      this.currentPlayerIndex = 0;
    if (this.admin === socketId && this.players.length > 0)
      this.admin = this.players[0].id;
  }

  startGame(socketId) {
    if (socketId !== this.admin || this.players.length < 2) return false;
    if (this.gameMode === "teams" && this.players.length !== 4) return false;
    // All players must have selected a pet
    if (this.players.some((p) => !p.pet)) return false;
    for (const p of this.players) {
      // Initialize pet uses for limited mode
      p.petUses = PET_LIMITED_USES[p.pet] || 0;
    }
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
    this._initProperties();
    this.state = "playing";
    this._log(`Tiles shuffled! Game started! \uD83C\uDF4C`);
    return true;
  }

  _shuffleBoard() {
    // Corners stay fixed at 0, 13, 26, 39
    const tiles = [];
    for (let i = 0; i < this.board.length; i++) {
      if (!CORNER_POSITIONS.has(i)) tiles.push(this.board[i]);
    }
    // Fisher-Yates shuffle
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    // Place shuffled tiles back, updating their id to match new position
    let ti = 0;
    for (let i = 0; i < this.board.length; i++) {
      if (!CORNER_POSITIONS.has(i)) {
        const tile = { ...tiles[ti] };
        tile.id = i;
        this.board[i] = tile;
        ti++;
      }
    }
  }

  debugShuffle() {
    if (this.state !== "playing") return false;
    this._shuffleBoard();
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
    if (this.petMode === "limited") {
      player.petUses = PET_TYPES[player.pet].uses || 3;
    }
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
    const cur = this.getCurrentPlayer();
    if (
      !cur ||
      cur.id !== socketId ||
      this.diceRolled ||
      cur.bankrupt ||
      this.petResolving
    )
      return null;

    // Validate paid dice override (1 or 3)
    let numDice = 2;
    if (diceCount === 1 && cur.money >= 500) {
      cur.money -= 500;
      numDice = 1;
    } else if (diceCount === 3 && cur.money >= 1000) {
      cur.money -= 1000;
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

    // Tick pet cooldowns for all players (cooldown mode only)
    if (this.petMode !== "limited") {
      for (const p of this.players) {
        if (p.petCooldown > 0) p.petCooldown--;
      }
    }

    const diceSum = rolls.reduce((a, b) => a + b, 0);
    const oldPos = cur.position;
    cur.position = (cur.position + diceSum) % BOARD_SIZE;
    cur.revealedTiles.add(cur.position);

    // Dice-match grow: if dice sum matches a farm label number you own, 100% grow
    this._processDiceMatchGrow(cur, diceSum);

    // Collect own banana piles on crossed/landed tiles & steal opponent piles on landing
    this._collectBananasOnPath(cur, oldPos, cur.position);

    // Check if player landed on a bomb (eliminates victims, placer takes loot)
    if (this._checkBombDetonation(cur)) {
      if (cur.bankrupt || this.state === "finished") {
        return { dice: this.dice, moved: true };
      }
    }

    // Timer-based bomb explosion: explode any bomb whose timer has expired
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
        return { dice: this.dice, moved: true };
      }
    }

    this._processLanding(cur);

    // Auto-end turn if no auction, vine swing, or poker was started
    // Delay accounts for frontend dice animation (550ms) + token walk (steps*150ms) + post-walk pause (500ms) + buffer
    const walkAnimMs = 550 + diceSum * 150 + 500;
    if (
      !this.auction &&
      !this.vineSwing &&
      !this.poker &&
      !this.mushroomPending
    ) {
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 3000);
    }

    return { dice: this.dice, moved: true };
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
        return { dice: this.dice, moved: true };
      }
    }
    if (this._explodeExpiredBombs()) {
      if (cur.bankrupt || this.state === "finished") {
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
      this._scheduleAutoEnd(cur, debugWalkMs + 3000, 3000);
    }
    return { dice: this.dice, moved: true };
  }

  _processLanding(player) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW always fires first — even if an opponent is on the corner
    if (space.type === "grow" || space.type === "easygrow") {
      // Easy Grow: reveal to all players on first landing
      if (space.type === "easygrow") {
        for (const p of this.players) p.revealedTiles.add(player.position);
      }
      const pct =
        space.type === "easygrow"
          ? 0.1
          : GROW_PERCENTAGES[player.position] || 0;
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
      const groupCount = {}; // count of owned farms per color group
      for (const p of this.players) {
        if (!teamIds.has(p.id)) continue;
        for (const propId of p.properties) {
          const prop = this.properties.get(propId);
          if (!prop || !prop.group || prop.group === "desert") continue;
          teamProps.push(propId);
          groupCount[prop.group] = (groupCount[prop.group] || 0) + 1;
        }
      }

      // 2) Side bonus based on which row/column the farm tile sits on
      const getSideBonus = (pos) => {
        if (!this.sideBonuses) return 0;
        if (pos >= 14 && pos <= 25) return 0.1; // left column
        if (pos >= 27 && pos <= 38) return 0.25; // top row
        if (pos >= 40 && pos <= 51) return 0.5; // right column
        return 0; // bottom row (1-12)
      };

      // 3) Set bonus: each farm grows (price � (1 + sideBonus)) � setMultiplier � growPct
      //    Side bonus is applied to the base yield first, then set bonus and grow %
      //    If an opponent is sitting on the farm, they collect the bananas instead
      let totalGrown = 0;
      let totalStolen = 0;
      const stolenBy = {}; // playerId -> amount
      for (const propId of teamProps) {
        const prop = this.properties.get(propId);
        if (!prop) continue;
        const owned = groupCount[prop.group] || 1;
        const setMultiplier = 1 + (owned - 1) * 0.1;
        const amount = Math.floor(
          easyGrowBase +
            prop.price * (1 + getSideBonus(propId)) * setMultiplier * pct,
        );
        if (amount > 0) {
          // Check if a non-teammate opponent is sitting on this tile
          const squatter = this.players.find(
            (p) => !p.bankrupt && p.position === propId && !teamIds.has(p.id),
          );
          if (squatter) {
            squatter.money += amount;
            totalStolen += amount;
            stolenBy[squatter.id] = (stolenBy[squatter.id] || 0) + amount;
          } else {
            prop.bananaPile += amount;
            totalGrown += amount;
          }
        }
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
      // Don't return — fall through to poker check below
    }

    // Check if another monkey is on the same tile — start poker!
    // In team mode, teammates don't trigger poker against each other
    const opponent = this.players.find(
      (p) =>
        p.id !== player.id &&
        !p.bankrupt &&
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
            const names = this.teams[teamKey]
              .map((id) => this.players.find((p) => p.id === id)?.name || "?")
              .join(" & ");
            this._log(
              `\ud83c\udfc6 Team ${teamKey} (${names}) bought the Super Banana and won! \u2b50\ud83d\udc51`,
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
        if (CORNER_POSITIONS.has(i)) continue;
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
      }
      return;
    }

    if (prop.owner && prop.owner !== player.id) {
      // In team mode, no rent for landing on teammate's property
      const isTeammate =
        this.gameMode === "teams" &&
        this.getTeamOf(prop.owner) === this.getTeamOf(player.id);
      if (!isTeammate) {
        const rent = this._calcRent(prop);
        const owner = this.players.find((p) => p.id === prop.owner);
        const actualRent = Math.min(rent, player.money);
        player.money -= actualRent;
        if (owner) owner.money += actualRent;
        this._log(
          `${player.name} paid ${actualRent}\ud83c\udf4c yield to ${owner?.name || "?"} for ${prop.name}.`,
        );
      } else {
        const owner = this.players.find((p) => p.id === prop.owner);
        this._log(
          `${player.name} visited teammate ${owner?.name || "?"}'s farm \ud83c\udf34 \u2014 no yield!`,
        );
      }
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
  _processLandingPassive(player, devilUserId = null) {
    const space = this.board[player.position];
    if (!space) return;

    // GROW fires passively
    if (space.type === "grow" || space.type === "easygrow") {
      // Easy Grow: reveal to all players on first landing
      if (space.type === "easygrow") {
        for (const p of this.players) p.revealedTiles.add(player.position);
      }
      const pct =
        space.type === "easygrow"
          ? 0.1
          : GROW_PERCENTAGES[player.position] || 0;
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
      const groupCount = {};
      for (const p of this.players) {
        if (!teamIds.has(p.id)) continue;
        for (const propId of p.properties) {
          const prop = this.properties.get(propId);
          if (!prop || !prop.group || prop.group === "desert") continue;
          teamProps.push(propId);
          groupCount[prop.group] = (groupCount[prop.group] || 0) + 1;
        }
      }
      const getSideBonus = (pos) => {
        if (!this.sideBonuses) return 0;
        if (pos >= 14 && pos <= 25) return 0.1;
        if (pos >= 27 && pos <= 38) return 0.25;
        if (pos >= 40 && pos <= 51) return 0.5;
        return 0;
      };
      let totalGrown = 0;
      for (const propId of teamProps) {
        const prop = this.properties.get(propId);
        if (!prop) continue;
        const owned = groupCount[prop.group] || 1;
        const setMultiplier = 1 + (owned - 1) * 0.1;
        const amount = Math.floor(
          easyGrowBase +
            prop.price * (1 + getSideBonus(propId)) * setMultiplier * pct,
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
    if (prop.owner && prop.owner !== player.id) {
      const isTeammate =
        this.gameMode === "teams" &&
        this.getTeamOf(prop.owner) === this.getTeamOf(player.id);
      if (!isTeammate) {
        const rent = this._calcRent(prop);
        const owner = this.players.find((p) => p.id === prop.owner);
        const actualRent = Math.min(rent, player.money);
        player.money -= actualRent;
        if (owner) owner.money += actualRent;
        this._log(
          `${player.name} paid ${actualRent}\ud83c\udf4c yield to ${owner?.name || "?"} for ${prop.name}.`,
        );
      }
    }

    // Magic auction: pushed onto unowned tile
    if (!prop.owner && devilUserId && player.money > 0) {
      this._startDevilAuction(player, devilUserId);
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
      if (CORNER_POSITIONS.has(i)) continue;
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

  _calcRent(prop) {
    const owner = this.players.find((p) => p.id === prop.owner);
    if (!owner) return 0;

    if (prop.rent) {
      return prop.rent[0];
    }
    return 0;
  }

  // -- Auction System ---------------------------------------------

  _startDevilAuction(pushedPlayer, devilUserId) {
    const pos = pushedPlayer.position;
    const prop = this.properties.get(pos);
    if (!prop || prop.owner) return;

    const bidders = [];
    const n = this.players.length;
    if (this.gameMode === "teams" && this.teams) {
      // Team mode: all non-bankrupt players participate
      bidders.push(pushedPlayer.id);
      for (const p of this.players) {
        if (!p.bankrupt && p.id !== pushedPlayer.id) bidders.push(p.id);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const idx = (this.currentPlayerIndex + i) % n;
        const p = this.players[idx];
        if (!p.bankrupt) bidders.push(p.id);
      }
    }

    const bids = {};
    for (const id of bidders)
      bids[id] = { amount: 0, placed: false, passed: false };

    this.silentAuctionTied = false;

    // Use price-it auction when there are 3+ bidders
    const usePriceIt = bidders.length >= 3;
    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: pushedPlayer.id,
      devilUser: devilUserId,
      bidders,
      bids,
      phase: usePriceIt ? "team-bid" : "lander-bid",
      highBid: 0,
      highBidder: null,
      teamAuction: usePriceIt,
    };

    this._log(
      usePriceIt
        ? `\ud83d\udd2e Magic auction! ${pushedPlayer.name} was pushed onto an unowned farm! Name your price!`
        : `\ud83d\udd2e Magic auction! ${pushedPlayer.name} was pushed onto an unowned farm! Lander bids first.`,
    );

    // Auto-list at 0 if lander is broke in price-it auction
    if (usePriceIt && pushedPlayer.money === 0) {
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
    const n = this.players.length;

    if (this.gameMode === "teams" && this.teams) {
      // Team mode: all non-bankrupt players participate
      bidders.push(cur.id);
      for (const p of this.players) {
        if (!p.bankrupt && p.id !== cur.id) bidders.push(p.id);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const idx = (this.currentPlayerIndex + i) % n;
        const p = this.players[idx];
        if (!p.bankrupt) bidders.push(p.id);
      }
    }

    const bids = {};
    for (const id of bidders)
      bids[id] = { amount: 0, placed: false, passed: false };

    // Use price-it auction when there are 3+ bidders
    const usePriceIt = bidders.length >= 3;
    this.auction = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      landingPlayer: bidders[0],
      bidders,
      bids,
      phase: usePriceIt
        ? "team-bid"
        : this.simpleAuction
          ? "simple-bid"
          : "lander-bid",
      highBid: 0,
      highBidder: null,
      simple: !usePriceIt && (this.simpleAuction || false),
      teamAuction: usePriceIt,
    };

    this._log(
      usePriceIt
        ? `\ud83c\udf4c Banana bid! Lander, name your price.`
        : this.simpleAuction
          ? `\ud83c\udf4c Banana bid! Lander, name your price.`
          : `\ud83c\udf4c Banana bid started! Lander places their bid first.`,
    );

    // Auto-list at 0 if lander is broke in price-it/simple auction
    if ((usePriceIt || this.simpleAuction) && cur.money === 0) {
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

    // -- Team Auction: Lander names a price --
    if (a.phase === "team-bid") {
      const lb = a.bids[a.landingPlayer];
      if (!lb.placed) return;

      a.landerOpenBid = lb.amount;
      a.highBid = lb.amount;
      a.highBidder = a.landingPlayer;

      // Move to team response phase (all others accept/reject)
      a.phase = "team-respond";
      const others = a.bidders.filter((id) => id !== a.landingPlayer);
      for (const id of others) {
        a.bids[id].placed = false;
        a.bids[id].passed = false;
      }
      this._log(
        `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 accept or reject?`,
      );
      return;
    }

    // -- Team Auction: Others respond (odd-one-out logic) --
    if (a.phase === "team-respond") {
      const others = a.bidders.filter((id) => id !== a.landingPlayer);
      const allDone = others.every(
        (id) => a.bids[id].placed || a.bids[id].passed,
      );
      if (!allDone) return;

      const acceptors = others.filter((id) => a.bids[id].placed);
      const rejecters = others.filter((id) => a.bids[id].passed);

      if (
        acceptors.length === others.length ||
        rejecters.length === others.length
      ) {
        // Everyone agreed or everyone rejected → lander buys
        a.highBidder = a.landingPlayer;
        a.highBid = a.landerOpenBid;
        if (acceptors.length === others.length) {
          this._log(`Everyone accepted \u2014 lander buys the farm!`);
        } else {
          this._log(`Everyone rejected \u2014 lander buys the farm!`);
        }
      } else if (acceptors.length === 1) {
        // Only one person accepted → that person buys
        a.highBidder = acceptors[0];
        a.highBid = a.landerOpenBid;
        const winner = this.players.find((p) => p.id === acceptors[0]);
        this._log(
          `${winner?.name || "?"} was the only one to accept \u2014 they buy the farm!`,
        );
      } else if (rejecters.length === 1) {
        // Only one person rejected → that person buys
        a.highBidder = rejecters[0];
        a.highBid = a.landerOpenBid;
        const winner = this.players.find((p) => p.id === rejecters[0]);
        this._log(
          `${winner?.name || "?"} was the only one to reject \u2014 they buy the farm!`,
        );
      }

      this._resolveAuction();
      return;
    }

    // -- Simple Auction: Lander names a price --
    if (a.phase === "simple-bid") {
      const lb = a.bids[a.landingPlayer];
      if (!lb.placed) return;

      a.landerOpenBid = lb.amount;
      a.highBid = lb.amount;
      a.highBidder = a.landingPlayer;

      // Move to opponent response phase
      a.phase = "simple-respond";
      const opponents = a.bidders.filter((id) => id !== a.landingPlayer);
      for (const id of opponents) {
        a.bids[id].placed = false;
        a.bids[id].passed = false;
      }
      this._log(
        `Lander priced it at ${lb.amount}\ud83c\udf4c \u2014 accept or decline?`,
      );
      return;
    }

    // -- Simple Auction: Opponents respond --
    if (a.phase === "simple-respond") {
      const opponents = a.bidders.filter((id) => id !== a.landingPlayer);
      const allDone = opponents.every(
        (id) => a.bids[id].placed || a.bids[id].passed,
      );
      if (!allDone) return;

      const acceptors = opponents.filter((id) => a.bids[id].placed);
      if (acceptors.length > 1) {
        // Multiple acceptors go into silent auction
        a.phase = "simple-tiebreak";
        a.tiebreakBidders = acceptors;
        for (const id of acceptors) {
          a.bids[id].placed = false;
          a.bids[id].passed = false;
          a.bids[id].amount = 0;
        }
        this._log(
          `More than one person accepted, it's time for silent auction!`,
        );
        return;
      } else if (acceptors.length === 1) {
        a.highBidder = acceptors[0];
        a.highBid = a.landerOpenBid;
      } else {
        // All opponents declined � lander pays and gets the farm
        a.highBidder = a.landingPlayer;
        a.highBid = a.landerOpenBid;
      }

      this._resolveAuction();
      return;
    }

    // -- Simple Auction: Tiebreak silent bid --
    if (a.phase === "simple-tiebreak") {
      const tb = a.tiebreakBidders || [];
      const allDone = tb.every((id) => a.bids[id].placed || a.bids[id].passed);
      if (!allDone) return;

      // Find highest tiebreak bid (ties award farm to lander)
      let highBid = -1;
      let winner = null;
      let tied = false;
      for (const id of tb) {
        const b = a.bids[id];
        if (!b.placed) continue;
        if (b.amount > highBid) {
          highBid = b.amount;
          winner = id;
          tied = false;
        } else if (b.amount === highBid) {
          tied = true;
        }
      }

      if (tied) {
        // Acceptors tied — farm goes to the lander at their original price
        a.highBidder = a.landingPlayer;
        a.highBid = a.landerOpenBid;
        this.silentAuctionTied = true;
        this._log(`Bidders tied! Lander buys the farm.`);
      } else if (winner) {
        a.highBidder = winner;
        a.highBid = highBid;
      } else {
        // All tiebreakers passed � lander gets it
        a.highBidder = a.landingPlayer;
        a.highBid = a.landerOpenBid;
      }

      this._resolveAuction();
      return;
    }

    // -- FFA Phase 1: Lander submits visible opening bid --
    if (a.phase === "lander-bid") {
      const lb = a.bids[a.landingPlayer];
      if (!lb.placed) return;

      a.landerOpenBid = lb.amount;
      a.highBid = lb.amount;
      a.highBidder = a.landingPlayer;

      // Move challengers to blind bid phase
      const challengers = a.bidders.filter((id) => id !== a.landingPlayer);
      if (challengers.length === 0) {
        this._resolveAuction();
        return;
      }
      a.phase = "challenger-bid";
      for (const id of challengers) {
        a.bids[id].placed = false;
        a.bids[id].passed = false;
      }
      this._log(
        `Lander bid ${lb.amount}\ud83c\udf4c \u2014 challengers, bid or pass!`,
      );
      return;
    }

    // -- FFA Phase 2: Challengers bid blindly (must beat lander) or pass --
    if (a.phase === "challenger-bid") {
      const challengers = a.bidders.filter((id) => id !== a.landingPlayer);
      const allDone = challengers.every(
        (id) => a.bids[id].placed || a.bids[id].passed,
      );
      if (!allDone) return;

      // Find highest challenger bid (ties broken by earliest submission)
      let anyChallenger = false;
      for (const id of challengers) {
        const b = a.bids[id];
        if (b.placed && b.amount > a.highBid) {
          a.highBid = b.amount;
          a.highBidder = id;
          anyChallenger = true;
        } else if (
          b.placed &&
          b.amount === a.highBid &&
          a.highBidder !== a.landingPlayer
        ) {
          // Tie between challengers � whoever bid first wins
          const currentWinner = a.bids[a.highBidder];
          if (currentWinner && b.bidTime < currentWinner.bidTime) {
            a.highBidder = id;
          }
          anyChallenger = true;
        } else if (b.placed) {
          anyChallenger = true;
        }
      }

      if (!anyChallenger) {
        // All challengers passed � lander wins at their opening bid
        this._resolveAuction();
        return;
      }

      // Skip lander second bid on desert tiles
      if (a.propGroup === "desert") {
        this._resolveAuction();
        return;
      }

      // Give lander a second blind bid
      a.phase = "lander-second";
      const lb = a.bids[a.landingPlayer];
      lb.placed = false;
      lb.passed = false;
      this._log(
        `Challenger(s) outbid you! Pass or place your second bid. \ud83c\udf4c`,
      );
      return;
    }

    // -- FFA Phase 3: Lander second bid --
    if (a.phase === "lander-second") {
      const lb = a.bids[a.landingPlayer];
      if (!lb.placed && !lb.passed) return;

      if (lb.placed && lb.amount >= a.highBid) {
        // Lander wins ties
        a.highBid = lb.amount;
        a.highBidder = a.landingPlayer;
      }

      this._resolveAuction();
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
        // Cap the price: if the winning bid exceeds all opponents' money,
        // the winner only pays (richest opponent's money + 1)
        let finalPrice = a.highBid;
        const opponents = this.players.filter(
          (p) => !p.bankrupt && p.id !== winner.id,
        );
        if (opponents.length > 0) {
          const maxOpponentMoney = Math.max(...opponents.map((p) => p.money));
          if (finalPrice > maxOpponentMoney && maxOpponentMoney >= 0) {
            finalPrice = maxOpponentMoney + 1;
          }
        }
        winner.money -= finalPrice;
        prop.owner = winner.id;
        winner.properties.push(a.position);
        for (const p of this.players) p.revealedTiles.add(a.position);
        const typeLabel = prop.group === "desert" ? "desert" : "farm";
        this._log(
          a.simple
            ? `\ud83d\udd28 ${winner.name} bought the ${typeLabel} ${prop.name} for ${finalPrice}\ud83c\udf4c!`
            : `\ud83d\udd28 ${winner.name} won the banana bid for ${prop.name} at ${finalPrice}\ud83c\udf4c!`,
        );
        // Super Banana win condition
        if (prop.group === "mushroom") {
          this.state = "finished";
          if (this.gameMode === "teams" && this.teams) {
            const teamKey = this.getTeamOf(winner.id);
            const names = this.teams[teamKey]
              .map((id) => this.players.find((p) => p.id === id)?.name || "?")
              .join(" & ");
            this._log(
              `\ud83c\udfc6 Team ${teamKey} (${names}) bought the Super Banana and won! \u2b50\ud83d\udc51`,
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
        }
      }
    } else {
      this._log(
        `\ud83d\udca8 No bids \u2014 Farm #${a.position} remains unclaimed.`,
      );
    }

    const turnPlayer = this.getCurrentPlayer();
    this.auction = null;
    this.silentAuctionTied = false;
    if (turnPlayer) {
      this._scheduleAutoEnd(turnPlayer, 3000);
    }
  }

  placeBid(socketId, amount) {
    if (!this.auction) return false;
    const a = this.auction;
    const b = a.bids[socketId];
    if (!b || b.placed || b.passed) return false;

    // Phase-based access control
    if (a.phase === "team-bid" && socketId !== a.landingPlayer) return false;
    if (a.phase === "team-respond") return false; // use respondAuction instead
    if (a.phase === "simple-bid" && socketId !== a.landingPlayer) return false;
    if (a.phase === "simple-respond") return false; // use respondAuction instead
    if (
      a.phase === "simple-tiebreak" &&
      !(a.tiebreakBidders || []).includes(socketId)
    )
      return false;
    if (a.phase === "lander-bid" && socketId !== a.landingPlayer) return false;
    if (a.phase === "challenger-bid" && socketId === a.landingPlayer)
      return false;
    if (a.phase === "lander-second" && socketId !== a.landingPlayer)
      return false;

    const player = this.players.find((p) => p.id === socketId);
    amount = Math.floor(amount);
    if (!player || amount > player.money || amount < 0) return false;

    // Minimum bid is 1 banana; 0 only allowed when lander is broke in simple-bid or team-bid
    if (
      amount < 1 &&
      !(
        (a.phase === "simple-bid" || a.phase === "team-bid") &&
        player.money === 0
      )
    )
      return false;

    // Silent auction tiebreak bids must be at least the lander's price
    if (a.phase === "simple-tiebreak" && amount < (a.landerOpenBid || 0))
      return false;

    // Challenger bids must exceed the lander's opening bid
    if (a.phase === "challenger-bid" && amount <= (a.landerOpenBid || 0))
      return false;

    // Lander second bid must exceed their opening bid
    if (a.phase === "lander-second" && amount <= (a.landerOpenBid || 0))
      return false;

    b.amount = amount;
    b.placed = true;
    b.bidTime = Date.now();
    this._log(`${player.name} placed a bid for Farm #${a.position}.`);

    this._checkPhaseComplete();
    return true;
  }

  passBid(socketId) {
    if (!this.auction) return false;
    const a = this.auction;
    const b = a.bids[socketId];
    if (!b || b.placed || b.passed) return false;

    // Lander cannot pass their opening bid
    if (a.phase === "team-bid") return false;
    if (a.phase === "team-respond") return false; // use respondAuction instead
    if (a.phase === "simple-bid") return false;
    if (a.phase === "simple-respond") return false; // use respondAuction instead
    if (
      a.phase === "simple-tiebreak" &&
      !(a.tiebreakBidders || []).includes(socketId)
    )
      return false;
    if (a.phase === "lander-bid") return false;
    // Challengers can pass
    if (a.phase === "challenger-bid" && socketId === a.landingPlayer)
      return false;
    // Lander can pass their second bid (keeps current highest)
    if (a.phase === "lander-second" && socketId !== a.landingPlayer)
      return false;

    b.passed = true;
    const player = this.players.find((p) => p.id === socketId);
    this._log(`${player?.name || "?"} passed on Farm #${a.position}.`);

    this._checkPhaseComplete();
    return true;
  }

  respondAuction(socketId, accept) {
    if (!this.auction) return false;
    const a = this.auction;
    if (a.phase !== "simple-respond" && a.phase !== "team-respond")
      return false;
    if (socketId === a.landingPlayer) return false;
    const b = a.bids[socketId];
    if (!b || b.placed || b.passed) return false;

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
    if (CORNER_POSITIONS.has(position)) return false;

    // Can only swing to a property the player owns
    const prop = this.properties.get(position);
    if (!prop || prop.owner !== socketId) return false;

    this.vineSwing = null;
    player.position = position;
    player.revealedTiles.add(position);
    this._log(`${player.name} swung to tile ${position}! \ud83e\udea2`);

    // Vine Swing is a teleport — only steal/collect at landing tile, no crossing
    this._collectBananasAtTile(player, position);

    this._processLanding(player);

    if (!this.auction && !this.vineSwing && !this.poker) {
      this._scheduleAutoEnd(player, 1000);
    }
    return true;
  }

  // -- Banana Pile Collection -------------------------------------

  // Returns a map: position -> label number (e.g. CV6 -> 6)
  _getTileLabelNumbers() {
    const groupLetters = {
      pink: "LF",
      lightblue: "BJ",
      red: "RD",
      yellow: "CV",
      orange: "GF",
      darkblue: "GM",
    };
    const groupCounters = {};
    const labelNumbers = new Map();
    for (let i = 0; i < this.board.length; i++) {
      const space = this.board[i];
      if (space.buyable) {
        const g = space.buyable.group;
        if (g && groupLetters[g]) {
          groupCounters[g] = (groupCounters[g] || 0) + 1;
          labelNumbers.set(i, groupCounters[g]);
        }
      }
    }
    return labelNumbers;
  }

  _processDiceMatchGrow(player, diceSum) {
    const labelNumbers = this._getTileLabelNumbers();
    const teamIds = new Set([player.id]);
    if (this.gameMode === "teams" && this.teams) {
      const teamKey = this.getTeamOf(player.id);
      if (teamKey && this.teams[teamKey]) {
        for (const id of this.teams[teamKey]) teamIds.add(id);
      }
    }

    const getSideBonus = (pos) => {
      if (!this.sideBonuses) return 0;
      if (pos >= 14 && pos <= 25) return 0.1;
      if (pos >= 27 && pos <= 38) return 0.25;
      if (pos >= 40 && pos <= 51) return 0.5;
      return 0;
    };

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

    // Build chain multipliers for all team-owned farms (same logic as frontend board.js)
    // Adjacent same-group farms form a chain; each tile's multiplier = chain length.
    const allTeamProps = [];
    for (const p of this.players) {
      if (!teamIds.has(p.id)) continue;
      for (const propId of p.properties) {
        const prop = this.properties.get(propId);
        if (prop && prop.group && prop.group !== "desert" && prop.group !== "mushroom") {
          allTeamProps.push(prop);
        }
      }
    }
    const teamPosSet = new Set(allTeamProps.map((p) => p.id));
    const chainMultipliers = {};
    const visitedChain = new Set();
    for (const prop of allTeamProps) {
      if (visitedChain.has(prop.id)) continue;
      const chain = [];
      const queue = [prop.id];
      visitedChain.add(prop.id);
      while (queue.length > 0) {
        const cur = queue.shift();
        chain.push(cur);
        const neighbors = [(cur - 1 + 52) % 52, (cur + 1) % 52];
        for (const n of neighbors) {
          if (visitedChain.has(n) || !teamPosSet.has(n) || CORNER_POSITIONS.has(n)) continue;
          const nProp = allTeamProps.find((p) => p.id === n);
          if (!nProp || nProp.group !== prop.group) continue;
          visitedChain.add(n);
          queue.push(n);
        }
      }
      for (const c of chain) chainMultipliers[c] = chain.length;
    }

    // Apply 100% grow to each matched tile
    let totalGrown = 0;
    const tileNames = [];
    for (const propId of matchedTiles) {
      const prop = this.properties.get(propId);
      if (!prop || !prop.group || prop.group === "desert") continue;
      const chainMult = chainMultipliers[propId] || 1;
      const amount = Math.floor(prop.price * (1 + getSideBonus(propId)) * chainMult);
      if (amount > 0) {
        prop.bananaPile += amount;
        totalGrown += amount;
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

    if (totalGrown > 0) {
      this.diceMatchTiles = matchedTiles;
      this._log(
        `\ud83c\udfb2 ${player.name} rolled ${diceSum} and owns ${tileNames.join(", ")}! 100% grow \u2014 ${totalGrown}\ud83c\udf4c sprouted! \ud83c\udf31`,
      );
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
    const groupCount = {};
    for (const p of this.players) {
      if (!teamIds.has(p.id)) continue;
      for (const propId of p.properties) {
        const prop = this.properties.get(propId);
        if (!prop || !prop.group || prop.group === "desert") continue;
        teamProps.push(propId);
        groupCount[prop.group] = (groupCount[prop.group] || 0) + 1;
      }
    }
    const getSideBonus = (pos) => {
      if (!this.sideBonuses) return 0;
      if (pos >= 14 && pos <= 25) return 0.1;
      if (pos >= 27 && pos <= 38) return 0.25;
      if (pos >= 40 && pos <= 51) return 0.5;
      return 0;
    };
    let totalGrown = 0;
    for (const propId of teamProps) {
      const prop = this.properties.get(propId);
      if (!prop) continue;
      const owned = groupCount[prop.group] || 1;
      const setMultiplier = 1 + (owned - 1) * 0.1;
      const amount = Math.floor(
        easyGrowBase +
          prop.price * (1 + getSideBonus(propId)) * setMultiplier * pct,
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
    if (steps === 0) return;
    let collected = 0;
    let stolen = 0;
    const stolenVictims = new Set();

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
        player.money += 500;
        this._log(
          `${player.name} crossed Free Bananas +500 and collected 500\ud83c\udf4c! \ud83c\udf4c`,
        );
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
    if (player.money < 5000) return false;
    if (player.bomb) return false; // already holding a bomb
    player.money -= 5000;
    player.bomb = true;
    player.bombBoughtTurn = this.turn;
    this._log(
      `${player.name} bought a pineapple bomb for 5000\ud83c\udf4c! \ud83c\udf4d`,
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
    player.bomb = false;
    player.bombBoughtTurn = null;
    this.bombs.push({
      placedBy: player.id,
      position: idx,
      turnsLeft: 5,
    });
    this._log(
      `${player.name} planted a pineapple bomb! \ud83c\udf4d (arms after your next turn, detonates in 5!)`,
    );
    return true;
  }

  _checkBombDetonation(player) {
    if (!this.bombMode || this.bombs.length === 0) return false;
    const bombIndex = this.bombs.findIndex(
      (b) => b.position === player.position && b.turnsLeft <= 2,
    );
    if (bombIndex === -1) return false;
    const bomb = this.bombs[bombIndex];
    const placer = this.players.find((p) => p.id === bomb.placedBy);
    this.bombs.splice(bombIndex, 1);
    const blastTiles = [
      bomb.position,
      (bomb.position - 1 + BOARD_SIZE) % BOARD_SIZE,
      (bomb.position + 1) % BOARD_SIZE,
    ];
    this.lastExplosion = { position: bomb.position, tiles: blastTiles };
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
        this._bombEliminate(v, placer);
      }
    }
    this._checkBombWin();
    return true;
  }

  _explodeExpiredBombs() {
    if (!this.bombMode || this.bombs.length === 0) return false;
    let anyExploded = false;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      if (this.bombs[i].turnsLeft <= 0) {
        const bomb = this.bombs[i];
        this.bombs.splice(i, 1);
        const blastTiles = [
          bomb.position,
          (bomb.position - 1 + BOARD_SIZE) % BOARD_SIZE,
          (bomb.position + 1) % BOARD_SIZE,
        ];
        this.lastExplosion = { position: bomb.position, tiles: blastTiles };
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
              this._bombEliminate(v, placer);
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
    victim.bankrupt = true;
    victim.money = 0;
    // Transfer properties to placer
    if (placer && !placer.bankrupt && placer.id !== victim.id) {
      placer.money += loot;
      for (const pos of victim.properties) {
        const prop = this.properties.get(pos);
        if (prop) {
          prop.owner = placer.id;
          if (!placer.properties.includes(pos)) placer.properties.push(pos);
        }
      }
      this._log(
        `\ud83d\udca5 ${victim.name} was eliminated! ${placer.name} took ${loot}\ud83c\udf4c and all their farms!`,
      );
    } else {
      this._log(
        `\ud83d\udca5 ${victim.name} was caught in the explosion and eliminated!`,
      );
    }
    victim.properties = [];
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
    }
  }

  endTurn(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || !this.diceRolled) return false;
    if (this.mushroomPending) return false;
    if (this.superBananaWin) return false;
    this._cancelAutoEnd();
    this.petCoinFlip = null;
    this.petUsedThisTurn = false;
    this.diceMatchTiles = null;
    this.lastPetUsed = null;

    // Clamp all players to 0 minimum (no negatives, no bankruptcy)
    for (const p of this.players) {
      if (p.money < 0) p.money = 0;
    }

    // Next player
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;

    this.turn++;
    this.diceRolled = false;

    // Cancel held bomb if the player has had a full round to place it
    const newCurBomb = this.players[this.currentPlayerIndex];
    if (
      newCurBomb &&
      newCurBomb.bomb &&
      newCurBomb.bombBoughtTurn != null &&
      this.turn - newCurBomb.bombBoughtTurn >= this.players.length
    ) {
      newCurBomb.bomb = false;
      newCurBomb.bombBoughtTurn = null;
      newCurBomb.money += 5000;
      this._log(
        `${newCurBomb.name}'s pineapple bomb expired \u2014 5000\ud83c\udf4c refunded! \ud83c\udf4d`,
      );
    }

    // Tick bomb timers (explosion happens after next roll in rollDice)
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      this.bombs[i].turnsLeft--;
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
    // Compute the tile label (e.g. "BJ2") using the same logic as getState/boardLayout
    const groupLetters = {
      pink: "LF",
      lightblue: "BJ",
      red: "RD",
      yellow: "CV",
      orange: "GF",
      darkblue: "GM",
    };
    const groupCounters = {};
    let tileLabel = prop.name;
    for (let i = 0; i < this.board.length; i++) {
      const sp = this.board[i];
      if (sp.buyable && sp.buyable.group && groupLetters[sp.buyable.group]) {
        groupCounters[sp.buyable.group] =
          (groupCounters[sp.buyable.group] || 0) + 1;
        if (i === propPos) {
          tileLabel =
            groupLetters[sp.buyable.group] + groupCounters[sp.buyable.group];
          break;
        }
      }
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
    const groupCounters = {};
    const boardLayout = this.board.map((space, i) => {
      const entry = { id: i, type: space.type };
      if (space.name) entry.name = space.name;
      if (space.amount) entry.amount = space.amount;
      if (space.buyable) {
        entry.tileName = space.buyable.name;
        entry.group = space.buyable.group || null;
        entry.price = space.buyable.price;
        const g = space.buyable.group;
        if (g && groupLetters[g]) {
          groupCounters[g] = (groupCounters[g] || 0) + 1;
          entry.tileLabel = groupLetters[g] + groupCounters[g];
        }
      }
      return entry;
    });

    return {
      gameId: this.gameId,
      state: this.state,
      admin: this.admin,
      maxPlayers: this.maxPlayers,
      startingMoney: this.startingMoney,
      simpleAuction: this.simpleAuction,
      bombMode: this.bombMode,
      monkeyPoker: this.monkeyPoker,
      sideBonuses: this.sideBonuses,
      petMode: this.petMode,
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
            simple: this.auction.simple || false,
            teamAuction: this.auction.teamAuction || false,
            landingPlayer: this.auction.landingPlayer,
            devilUser: this.auction.devilUser || null,
            landerOpenBid: this.auction.landerOpenBid ?? null,
            tiebreakBidders: this.auction.tiebreakBidders || null,
            highBid: null,
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
        })),
      lastExplosion: this.lastExplosion || null,
      bombSelfDamage: this.bombSelfDamage || null,
      diceMatchTiles: this.diceMatchTiles || null,
      superBananaWin: this.superBananaWin || null,
      sellListings: this.sellListings.map((l) => ({ ...l })),
      silentAuctionTied: this.silentAuctionTied || false,
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
