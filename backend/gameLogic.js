// --- Monkey Business Board Game Logic ---------------------------
// 48 spaces, cornerless square (12 per side)

const START_POSITION = 0;

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
          price: 1600,
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
  ) {
    this.gameId = gameId;
    this.isPublic = !!isPublic;
    this.gameMode =
      gameMode === "2v2" || gameMode === "3v3" ? gameMode : "classic";
    // (The old item-auction settings were removed with the item system. The
    // constructor keeps an ignored trailing `itemAuctionOpts` slot for callers.)
    void itemAuctionOpts;
    // (Monkey Poker was retired; the `monkeyPoker` positional slot is kept so
    // existing positional callers don't shift, but the value is ignored.)
    void monkeyPoker;
    this.lastTileSwap = null; // { a, b, turn } — swap anim hint
    this.pendingTileShuffles = null; // [{ color, leavingName, positions, endsAt }]
    this.lastTileShuffle = null; // { positions, ts } — sound-effect trigger
    if (this._isTeams()) {
      this.maxPlayers = this._teamPlayerCount();
    } else {
      this.maxPlayers = Math.min(Math.max(maxPlayers || 4, 2), 6);
    }
    this.startingMoney = Math.min(
      Math.max(Math.floor(startingMoney) || 5000, 100),
      99999,
    );
    this.noAuctionTimer = false;
    // Super Banana win-price (paid to claim the tile). Default 10000, range
    // 100–99999. Applied to the property at game-start in _initProperties.
    this.superBananaPrice = 10000;
    // Seconds each farm-auction phase (respond / silent tie-break) waits before
    // resolving. Default 15, range 5–60. Disabled entirely when noAuctionTimer.
    this.farmAuctionTimer = 15;
    // Dodecahedron: a single 12-sided die that REPLACES its owner's 2d6 (rolls a
    // uniform 1..12, so it can roll a 1). It originates with the FIRST player to
    // LAND on the Super Banana, then passes on any landing collision involving the
    // owner (owner lands on someone → gives it; someone lands on owner → takes it).
    // ON by default; the toggle is stamped post-construction (server create_game).
    this.dodecahedron = true;
    this.d12OwnerId = null; // current owner's player id, or null (not yet in play)
    this.diceIsD12 = false; // tags the last roll as a d12 (vs 2d6)
    this.lastSuperBananaCross = null; // {playerId, pos, amount, turn} — SB +N banana grab; drives the at-the-SB-tile banana floater
    // CREDIT SCORE (liar's dice): every player holds a PUBLIC credit score (blank
    // tokens). A turn is: roll HIDDEN under the cup → claim any steps 1-12 → walk
    // the CLAIM → opponents accuse yes/no → credit resolution. The real roll is
    // revealed ONLY if someone accused. See rollDice / submitClaim / _openAccuse.
    this.creditStart = 7; // lobby knob (like startingMoney): every player's starting credit, clamp 1..20
    this.pendingAction = null; // the roller's hidden roll + claim (roll SECRET — see getState)
    this.accuse = null;        // {turn, respondDeadline, respondStartTime, votes:{[oppId]:{eligible,answered,accuse}}}
    this.turnPhase = null;     // null | "claiming" | "accusing" | "resolved"
    this.lastMove = null;      // {playerId, steps, mode:"turtle"|"rabbit", turn} — PUBLIC move record (the walk/cup-label key)
    this.lastAccuseResult = null; // {seq, playerId, claim, mode, truthful, actualTotal, accusers, deltas, turn} — PUBLIC, set ONLY when someone accused
    this._accuseSeq = 0;
    this._accuseTimer = null;
    this._claimTimer = null;
    this.diceHidden = false;  // the current dice are a cup roll not yet revealed (redacted for non-rollers in getState)
    this.diceOwnerId = null;  // who rolled the current dice (sees through their own cup)
    this.superBananaWinnerId = null; // who won via the Super Banana (rich landing or the within-12 auto-win)
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
    this.itemMoveThisTurn = false; // movement this turn came from an item (Roll One / Vine Swing)
    // Banana conservation ledger, set at game start (completeReveal). Every
    // banana created (grows) bumps `minted`; every banana destroyed (auction
    // payments, purchases, trade fees, vanished estates/piles) bumps `burned`.
    // Invariant: sum(money) + sum(piles)
    //            == baseline + minted - burned. Checked by the test fuzz.
    this.bananaLedger = null;
    this.onUpdate = null; // callback to emit game state
    // Team mode: teams = { A: [id1, id2], B: [id3, id4] }
    this.teams = null;
  }

  _isTeams() {
    return this.gameMode === "2v2" || this.gameMode === "3v3";
  }

  // Players per team in team mode: 2 (2v2) or 3 (3v3).
  _teamSize() {
    return this.gameMode === "3v3" ? 3 : 2;
  }

  // Total players a team game requires (both teams full): 4 (2v2) or 6 (3v3).
  _teamPlayerCount() {
    return this._teamSize() * 2;
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

    const allColors = ["brown", "golden", "silver", "red", "purple", "pink"];
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
      // Cumulative bananas this player has SPENT over the whole game — auction
      // wins (farms + Super Banana mystery draws) and the Super Banana purchase,
      // the only money OUTFLOWS in the economy. Shown as a stat in the MONKEYS
      // list; PUBLIC to all viewers (like totalYield). Reset with money on every
      // new game (see completeReveal / reset).
      totalSpent: 0,
      properties: [],
      bankrupt: false,
      // One-time BROKE-CROSS Super Banana consolation latch: set true the first
      // time this player grabs the +200 by CROSSING the revealed SB while broke.
      // Once set, the cross never pays again. (LANDING +200 is unlatched — see
      // _processLanding.) Reset every new game (see completeReveal / _resetToLobby).
      sbBonusTaken: false,
      revealedTiles: new Set([START_POSITION]),
      hasRolled: false,
      startPickPending: false,
      // CREDIT SCORE (liar's dice): a stack of blank tokens. Integer, floor 0,
      // no cap. Seeded to the creditStart lobby knob (default 7) here and on
      // every new game (completeReveal / _resetToLobby). PUBLIC in getState —
      // everyone sees everyone's credit.
      credit: this.creditStart,
      // DEBUG-only "Reveal All Tiles" view: when true, getState skips fog
      // redaction FOR THIS VIEWER (they see the whole board incl. the hidden
      // Super Banana). Set only via the DEBUG_TOOLS-gated set_reveal_all socket,
      // so production clients can never enable it. Pure view flag — never touches
      // revealedTiles or game logic.
      revealAllView: false,
    };
    this.players.push(player);
    return player;
  }

  updateSettings(adminId, settings) {
    if (this.state !== "waiting" || this.admin !== adminId) return false;
    if (settings.startingMoney != null) {
      this.startingMoney = Math.min(
        Math.max(Math.floor(settings.startingMoney) || 5000, 100),
        99999,
      );
      for (const p of this.players) {
        p.money = this.startingMoney;
      }
    }
    if (
      settings.gameMode === "classic" ||
      settings.gameMode === "2v2" ||
      settings.gameMode === "3v3"
    ) {
      if (this.gameMode !== settings.gameMode) {
        this.gameMode = settings.gameMode;
      }
      if (this._isTeams()) this.maxPlayers = this._teamPlayerCount();
    }
    if (settings.maxPlayers != null && !this._isTeams()) {
      const mp = Math.min(Math.max(Math.floor(settings.maxPlayers) || 2, 2), 6);
      this.maxPlayers = Math.max(mp, this.players.length);
    }
    if (settings.noAuctionTimer != null) {
      this.noAuctionTimer = !!settings.noAuctionTimer;
    }
    if (settings.isPublic != null) {
      this.isPublic = !!settings.isPublic;
    }
    if (settings.superBananaPrice != null) {
      this.superBananaPrice = Math.min(
        Math.max(Math.floor(settings.superBananaPrice) || 10000, 100),
        99999,
      );
    }
    if (settings.dodecahedron != null) {
      this.dodecahedron = !!settings.dodecahedron;
    }
    if (settings.creditStart != null) {
      this.creditStart = Math.min(
        Math.max(Math.floor(settings.creditStart) || 7, 1),
        20,
      );
      for (const p of this.players) {
        p.credit = this.creditStart;
      }
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

  // Team-mode lobby team switcher: swap `socketId` with the player at the mirror
  // seat on the other team. The first half of the join order is Team A, the
  // second half Team B (used by startGame to seed the teams map). Only
  // meaningful with a full lobby (4 in 2v2, 6 in 3v3); before then the teams
  // aren't realised yet.
  switchTeam(socketId) {
    if (this.state !== "waiting" || !this._isTeams()) return false;
    if (this.players.length !== this._teamPlayerCount()) return false; // both teams full
    const size = this._teamSize();
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx < 0) return false;
    // Swap with the mirror seat on the other team (keeps both teams full).
    const mirror = idx < size ? idx + size : idx - size;
    const tmp = this.players[idx];
    this.players[idx] = this.players[mirror];
    this.players[mirror] = tmp;
    return true;
  }

  changeColor(socketId, color) {
    if (this.state !== "waiting") return false;
    const allColors = ["brown", "golden", "silver", "red", "purple", "pink"];
    if (!allColors.includes(color)) return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player) return false;
    const taken = this.players.filter((p) => p.id !== socketId).map((p) => p.color);
    if (taken.includes(color)) return false;
    player.color = color;
    return true;
  }

  // Called immediately after any action that will eventually trigger an end-
  // of-turn (submitClaim, auction resolves, etc.). We mark autoEndDelay
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
      if (
        cur &&
        cur.id === player.id &&
        this.diceRolled &&
        !this.auction
      ) {
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
    if (this.auction || this.superBananaWin) {
      return false;
    }
    // The accuse window runs AFTER the walk (diceRolled is already true), so the
    // anims-complete signal can arrive mid-window — refuse it; _resolveAccuse
    // re-arms a short auto-end so the turn still closes.
    if (this.pendingAction || this.accuse) return false;
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
    if (this._accuseTimer) clearTimeout(this._accuseTimer);
    this._accuseTimer = null;
    if (this._claimTimer) clearTimeout(this._claimTimer);
    this._claimTimer = null;
    this._cancelAutoEnd();
    this._clearDeferredTimers();
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx === -1) return;

    // If this player is in an active property auction, drop them cleanly
    // so it doesn't hang: lander leaving abandons it; otherwise count them as a
    // reject (respond) or a 0 top-up (silent bid).
    if (this.auction && this.auction.bids[socketId]) {
      const a = this.auction;
      if (a.teamFlow) {
        this._2v2DisentanglePlayer(socketId);
      } else if (socketId === a.landingPlayer) {
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
        } else if (a.phase === "pitch") {
          // Left before the lander priced the tile: drop this bidder out of the
          // auction entirely, or the pitch->respond transition re-arms them as a
          // bidder owing a response that never comes (a stall when the timer is off).
          a.bidders = a.bidders.filter((id) => id !== socketId);
          delete a.bids[socketId];
        }
        this._checkPhaseComplete();
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
      if (this.bananaLedger) this.bananaLedger.burned += prop.bananaPile || 0;
      prop.bananaPile = 0;
    }

    // The leaver's own cash also leaves circulation — burn it so the banana
    // ledger invariant (sum money + piles + pot == baseline + minted - burned)
    // still holds, mirroring the elimination loot burn. Guarded by
    // bananaLedger, which is non-null only during an active game.
    if (this.bananaLedger) {
      this.bananaLedger.burned += this.players[idx].money || 0;
    }

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
      this.itemMoveThisTurn = false;
      if (this.superBananaWin && this.superBananaWin.playerId === socketId)
        this.superBananaWin = null;
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
        this.lastStandingWinner = alive[0].id;
        this._log(
          `🏆 ${alive[0].name} is the last monkey standing and wins! 👑`,
        );
        this._revealAllTiles();
      } else {
        this._checkLastLiveWin();
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
    this._log(`👻 ${player.name} left — they're a ghost now, the spirits will play their turns.`);
    // Claim / accuse window hygiene. As an ACCUSER mid-window, a ghost auto-
    // answers "no" (a ghost never accuses) so the window can complete. As the
    // ROLLER still picking a claim, auto-claim the TRUE roll (a ghost never
    // bluffs) so the turn commits and the accuse window can run its course.
    if (
      this.accuse &&
      this.accuse.votes[player.id] &&
      !this.accuse.votes[player.id].answered
    ) {
      this.accuse.votes[player.id].answered = true;
      this.accuse.votes[player.id].accuse = false;
      this._checkAccuseComplete();
    }
    if (
      this.turnPhase === "claiming" &&
      this.pendingAction &&
      this.pendingAction.playerId === player.id
    ) {
      this.submitClaim(player.id, null);
    }
    // rules.md (Leavers): a ghost "never bids in anyone else's auction — as a
    // non-lander it simply rejects every farm and item offer". Same
    // disentangling removePlayer does, otherwise a phase keeps waiting on a
    // response that will never come (forever, when the auction timer is off).
    if (this.auction && this.auction.teamFlow && this.auction.bids[player.id]) {
      this._2v2DisentanglePlayer(player.id);
    } else if (
      this.auction &&
      this.auction.bids[player.id] &&
      this.auction.landingPlayer !== player.id
    ) {
      const a = this.auction;
      const b = a.bids[player.id];
      if (a.phase === "respond" && !b.responded) {
        b.responded = true;
        b.accepted = false;
      } else if (
        a.phase === "silentbid" &&
        a.acceptorIds &&
        a.acceptorIds.includes(player.id) &&
        !b.submittedTopup
      ) {
        b.topup = 0;
        b.submittedTopup = true;
      } else if (a.phase === "pitch") {
        // Ghosted before the lander even priced the tile: drop this bidder out of
        // the auction entirely. Otherwise the pitch->respond transition re-arms
        // them as a bidder owing a response that never comes (a stall forever
        // when the auction timer is off).
        a.bidders = a.bidders.filter((id) => id !== player.id);
        delete a.bids[player.id];
      }
      this._checkPhaseComplete();
    }
    this._checkLastLiveWin();
    // If it's their turn (or they're blocking an interaction), the driver takes
    // over and resolves it.
    this._maybeDriveGhost();
    return true;
  }

  // Drive the current player IF it's a ghost: resolve whatever it must act on
  // (super-banana hideout, mid-pitch auction), otherwise auto-roll. Safe
  // to call repeatedly — it no-ops unless a ghost genuinely needs to act.
  _maybeDriveGhost() {
    if (this.state !== "playing") return;
    const cur = this.getCurrentPlayer();
    if (!cur || !cur.ghost || cur.bankrupt) return;
    // Pause auto-play if every remaining player is a ghost — an all-ghost table
    // would loop forever. It resumes the moment someone reconnects.
    if (!this.players.some((p) => !p.bankrupt && !p.ghost)) return;

    // The ghost is the lander of a farm still in the pitch phase → restart it
    //    as a sealed bid among the other (non-ghost) eligible players (the ghost
    //    effectively prices it at 0).
    if (this.auction && this.auction.landingPlayer === cur.id && this.auction.phase === "pitch") {
      if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; }
      this.auction = null;
      this._createAuctionForLander(cur.id);
      if (this.onUpdate) this.onUpdate();
      return;
    }
    // 3) Start-tile pick (game began while they were already a ghost — rare).
    if (cur.startPickPending) {
      this._deferredSetTimeout(() => this._ghostAutoStartPick(cur.id), 800);
      return;
    }
    // 4) Nothing blocking and they haven't rolled → auto-roll, then immediately
    // CLAIM the true roll (a ghost never bluffs), which walks the move and opens
    // the accuse window for live opponents. diceRolled stays false through the
    // claiming phase, so also guard on pendingAction/accuse to avoid a
    // re-entrant double-roll.
    if (this.diceRolled || this.auction || this.pendingAction || this.accuse) return;
    this._deferredSetTimeout(() => {
      const c = this.getCurrentPlayer();
      if (!c || c.id !== cur.id || !c.ghost || this.diceRolled || this.state !== "playing") return;
      if (this.auction || this.pendingAction || this.accuse) return;
      this.rollDice(c.id);
      this.submitClaim(c.id, null); // ghost walks the TRUE roll → open the accuse window
      if (this.onUpdate) this.onUpdate();
      // Resolve anything the roll triggered (super-banana / etc.).
      this._maybeDriveGhost();
    }, 1400);
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
      !this.auction
    ) {
      this._scheduleAutoEnd(cur, 2000);
    }
    if (this.onUpdate) this.onUpdate();
    // If another ghost is up, keep things moving.
    this._maybeDriveGhost();
    return ghost;
  }

  // Rewrite every reference to a player's socket id (oldId → newId) across the
  // whole game: ownership, teams, the auction structures, super-banana state,
  // and bookkeeping scalars. Used by reconnect so a fresh socket seamlessly
  // inherits the ghost's identity.
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
    if (player) {
      player.id = newId;
    }

    if (this.admin === oldId) this.admin = newId;
    if (this.lastStandingWinner === oldId) this.lastStandingWinner = newId;
    // The dodecahedron owner is tracked by id at the game level, so a reconnecting
    // owner (including a ghost owner) keeps the die.
    if (this.d12OwnerId === oldId) this.d12OwnerId = newId;
    // Cup ownership: the current hidden roll's owner keeps seeing their own dice.
    if (this.diceOwnerId === oldId) this.diceOwnerId = newId;
    if (this.superBananaWinnerId === oldId) this.superBananaWinnerId = newId;

    for (const [, prop] of this.properties) scalar(prop, "owner");

    if (this.teams) { arr(this.teams.A); arr(this.teams.B); }

    // The open claim/accuse window is id-keyed — remap so a reconnected roller
    // can still claim and a reconnected accuser's (auto-)vote stays theirs.
    scalar(this.pendingAction, "playerId");
    if (this.accuse) keys(this.accuse.votes);
    scalar(this.lastMove, "playerId");
    if (this.lastAccuseResult) {
      scalar(this.lastAccuseResult, "playerId");
      keys(this.lastAccuseResult.deltas);
      for (const a of this.lastAccuseResult.accusers || []) {
        if (a.id === oldId) a.id = newId;
      }
    }

    if (this.auction) {
      scalar(this.auction, "landingPlayer");
      scalar(this.auction, "sealedLanderId");
      scalar(this.auction, "highBidder");
      arr(this.auction.bidders);
      arr(this.auction.acceptorIds);
      keys(this.auction.bids);
      // Team auction id fields, so a reconnect keeps their seat/role.
      arr(this.auction.teammateIds);
      arr(this.auction.oppIds);
      arr(this.auction.affOppIds);
      arr(this.auction.affMateIds);
    }
    // The just-resolved-auction banner also carries ids; remap so a reconnect
    // in the post-resolve window still shows the right winner/participants.
    if (this.lastResolvedAuction) {
      scalar(this.lastResolvedAuction, "winnerId");
      arr(this.lastResolvedAuction.participantIds);
    }
    if (this.superBananaWin) scalar(this.superBananaWin, "playerId");

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

  _resetToLobby() {
    this.state = "waiting";
    this._lobbyReady = null;
    this.currentPlayerIndex = 0;
    this.turn = 0;
    this.dice = [0, 0];
    this.diceRolled = false;
    this.diceIsD12 = false;
    // Keep the dodecahedron lobby TOGGLE (this.dodecahedron) across a reset, like
    // the other settings; just clear the in-play owner so the next game re-originates
    // it on the first Super Banana landing.
    this.d12OwnerId = null;
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
    this.itemMoveThisTurn = false;
    this.teams = null;
    this.revealAccepted = null;
    this.teamCoinFlip = null;
    this.lastStandingWinner = null;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.lastSuperBananaCross = null;
    this.superBananaWin = null;
    this.superBananaWinnerId = null;
    // Claim / accuse window — clear so a rematch never inherits a stale one.
    this.pendingAction = null;
    this.accuse = null;
    this.turnPhase = null;
    this.lastMove = null;
    this.lastAccuseResult = null;
    this.diceHidden = false;
    this.diceOwnerId = null;
    if (this._accuseTimer) { clearTimeout(this._accuseTimer); this._accuseTimer = null; }
    if (this._claimTimer) { clearTimeout(this._claimTimer); this._claimTimer = null; }
    // Transient global-toast fields (also cleared per-turn in endTurn) — null
    // them on reset too so a rematch never starts carrying a previous game's
    // hex/relocate announcement.
    this.lastHexResult = null;
    this.lastStartPick = null;
    this.autoEndDelay = false;
    this.autoEndDelayMs = 0;
    this.bananaLedger = null;
    if (this._autoEndTimer) {
      clearTimeout(this._autoEndTimer);
      this._autoEndTimer = null;
    }
    if (this._autoEndFireTimer) {
      clearTimeout(this._autoEndFireTimer);
      this._autoEndFireTimer = null;
    }
    this.lastTileSwap = null;
    this.pendingTileShuffles = null;
    this.lastTileShuffle = null;
    // Reset players to lobby state
    for (const p of this.players) {
      p.position = 0;
      p.money = this.startingMoney;
      p.totalSpent = 0;
      p.properties = [];
      p.bankrupt = false;
      p.sbBonusTaken = false;
      p.revealedTiles = new Set([START_POSITION]);
      p.hasRolled = false;
      p.startPickPending = false;
      // Credit Score resets to the lobby knob for a fresh game.
      p.credit = this.creditStart;
    }
    this._initProperties();
  }

  startGame(socketId) {
    if (socketId !== this.admin || this.players.length < 2) return false;
    if (this._isTeams() && this.players.length !== this._teamPlayerCount())
      return false;
    // Assign teams in team mode. The first half of the join order is Team A, the
    // second half Team B (2 each in 2v2, 3 each in 3v3).
    if (this._isTeams()) {
      const size = this._teamSize();
      this.teams = {
        A: this.players.slice(0, size).map((p) => p.id),
        B: this.players.slice(size, size * 2).map((p) => p.id),
      };
      // Coin flip to decide which team goes first
      const firstTeam = Math.random() < 0.5 ? "A" : "B";
      const secondTeam = firstTeam === "A" ? "B" : "A";
      this.teamCoinFlip = { firstTeam, secondTeam };
      // Reorder so turns alternate between teams: A,B,A,B(,A,B). The first team
      // takes the odd seats, the second team the even seats.
      const first = this.players.filter((p) =>
        this.teams[firstTeam].includes(p.id),
      );
      const second = this.players.filter((p) =>
        this.teams[secondTeam].includes(p.id),
      );
      const interleaved = [];
      for (let i = 0; i < size; i++) {
        interleaved.push(first[i], second[i]);
      }
      this.players = interleaved;
      this._log(
        `\u{1FA99} Coin flip! Team ${firstTeam} goes first, Team ${secondTeam} goes second — turns alternate between the teams!`,
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
    // Monkeys start off-board. Each player picks their first tile.
    this._assignGrowLabels();
    for (const p of this.players) {
      p.startPickPending = true;
      p.sbBonusTaken = false;
      p.revealedTiles = new Set();
      // Credit Score: everyone starts the game at the creditStart lobby knob.
      p.credit = this.creditStart;
    }
    this.bananaLedger = {
      baseline: this.players.reduce((s, p) => s + p.money, 0),
      minted: 0,
      burned: 0,
    };
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

  debugAddBananas(socketId) {
    if (this.state !== "playing") return false;
    const player = this.players.find((p) => p.id === socketId);
    if (!player || player.bankrupt) return false;
    player.money += 10000;
    if (this.bananaLedger) this.bananaLedger.minted += 10000;
    this._log(
      `\ud83c\udf4c ${player.name} received 10000\ud83c\udf4c! (debug)`,
    );
    return true;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  // -- Credit Score (liar's dice) ----------------------------------

  // Adjust a player's Credit Score by `delta`, flooring at 0 (no cap). Returns
  // the delta actually APPLIED (a floor-clamped loss applies less than asked).
  // Every credit change re-runs the Super Banana auto-win check — a fresh token
  // can put a rich player within winning reach on the spot.
  _adjustCredit(player, delta) {
    if (!player || !delta) return 0;
    const before = player.credit || 0;
    const after = Math.max(0, before + delta);
    player.credit = after;
    const applied = after - before;
    if (applied !== 0) this._checkSuperBananaAutoWin();
    return applied;
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

  // rollDice ALWAYS rolls exactly 2 dice (no dice tiers). Any extra argument is
  // ignored (kept for call-site compatibility). CUP TIER: the result stays
  // HIDDEN under the cup (getState redacts it for everyone but the roller) until
  // an accusation lifts it. PUBLIC TIER (credit < opponents holding >=1 credit):
  // the roll shows to all and there is no accuse window.
  rollDice(socketId) {
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.lastSuperBananaCross = null;
    this.lastMove = null;
    this.lastAccuseResult = null;
    const cur = this.getCurrentPlayer();
    if (
      !cur ||
      cur.id !== socketId ||
      this.diceRolled ||
      this.pendingAction || // a roll/claim is already pending this turn
      this.accuse ||        // opponents are mid-accuse
      cur.bankrupt ||
      cur.startPickPending
    )
      return null;

    // A HEXED player (holds the curse) rolls a single d12 (1..12) instead of 2d6.
    // Everyone else rolls a normal 2d6. The single-die roll is TAGGED so the
    // frontend renders the dodecahedron. A hexed roll goes under the SAME cup
    // with the same claim/accuse rules (truth = claim == the d12 value).
    let rolls;
    if (this.dodecahedron && this.d12OwnerId === cur.id) {
      rolls = [Math.floor(Math.random() * 12) + 1];
      this.diceIsD12 = true;
    } else {
      rolls = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
      this.diceIsD12 = false;
    }
    this.dice = rolls;
    cur.hasRolled = true;
    const total = rolls.reduce((a, b) => a + b, 0);

    // CREDIT TIER — computed ONCE here and frozen on the pendingAction (credit
    // changes mid-window never retro-change the tier). You keep the cup while
    // you hold ANY credit; only a STRICTLY ZERO Credit Score rolls in the open
    // (rule change 2026-07-03 — was: credit < count of solvent opponents).
    const cupPublic = (cur.credit || 0) < 1;
    this.diceOwnerId = cur.id;
    this.diceHidden = !cupPublic;

    // The MOVE is NOT committed yet. Hold the roll as a pendingAction and open
    // the CLAIMING phase — the roller picks the steps (1..12) they announce.
    // diceRolled stays FALSE until the claim commits the walk, so endTurn / the
    // auto-end safety net can't end the turn mid-window.
    this.pendingAction = {
      playerId: cur.id,
      turn: this.turn,
      rolledDice: rolls.slice(),
      rolledIsD12: this.diceIsD12,
      rolledTotal: total,
      cupPublic,
      claim: null,
      mode: null,
      committed: false, // the roller hasn't submitted a claim yet
      claimStartTime: null,
      claimDeadline: null,
    };
    this.turnPhase = "claiming";
    // LOG REDACTION: a cup-tier roll's real total must never reach the log.
    if (cupPublic) {
      this._log(
        this.diceIsD12
          ? `\u{1F3B2} ${cur.name} rolled the d12 in the open: ${total} — no Credit for a cup!`
          : `\u{1F3B2} ${cur.name} rolled in the open: ${rolls.join(" + ")} = ${total} — no Credit for a cup!`,
      );
    } else {
      this._log(
        this.diceIsD12
          ? `\u{1F964} ${cur.name} rolled the d12 under the cup...`
          : `\u{1F964} ${cur.name} rolled under the cup...`,
      );
    }
    // Idle-roller safety net: auto-claim the TRUE roll at the deadline.
    this._scheduleClaimTimeout(cur);
    return { rolled: true };
  }

  // -- The Claim + Accuse bluff (liar's dice) -------------------------------
  //
  // After rolling under the cup, the roller CLAIMS any steps 1..12 and the token
  // walks the CLAIM (the real roll stays hidden). Then every opponent holding
  // >=1 credit votes accuse yes/no. TRUTHFUL (claim == roll, or claim 1 on a
  // rolled 7) + accused → each accuser loses 1 credit. LIE + accused → each
  // accuser gains 1 and the roller loses a FLAT 1 (however many accused;
  // rule change 2026-07-03). Nobody accuses → no credit moves and the roll
  // is never revealed.

  // Safety net for the CLAIMING phase: if the roller never submits (idle or a
  // flaky client), auto-claim the TRUE roll at the deadline so the turn can't
  // hang. A ghosting roller is handled in makeGhost.
  _scheduleClaimTimeout(cur) {
    if (this._claimTimer) { clearTimeout(this._claimTimer); this._claimTimer = null; }
    if (this.noAuctionTimer) return; // timers globally off → rely on explicit claim / ghost
    const pid = cur.id, turn = this.turn;
    if (this.pendingAction) {
      this.pendingAction.claimStartTime = Date.now();
      this.pendingAction.claimDeadline = Date.now() + this.farmAuctionTimer * 1000;
    }
    this._claimTimer = setTimeout(() => {
      this._claimTimer = null;
      if (
        this.turnPhase === "claiming" &&
        this.pendingAction &&
        this.pendingAction.playerId === pid &&
        this.turn === turn
      ) {
        this.submitClaim(pid, null); // idle roller walks the truth
        if (this.onUpdate) this.onUpdate();
      }
    }, this.farmAuctionTimer * 1000);
  }

  // The roller announces their claim. steps = 1..12, or null to walk the TRUE
  // roll (works in every tier, always free). Tier rules:
  //   - CUP tier: any claim 1..12, free — that's the bluff.
  //   - PUBLIC tier (cup lost, credit > 0): a claim differing from the roll
  //     costs 1 credit, paid here.
  //   - 0 credit: the exact roll only.
  //   - A rolled 7 grants a FREE "walk 1 instead" in EVERY tier (even at 0
  //     credit) — and claiming 1 on a real 7 counts as TRUTHFUL if accused.
  // The token walks the claim immediately; the accuse window opens after the
  // move (skipped for public rolls, no eligible accusers, or a winning move).
  submitClaim(socketId, steps) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    const pa = this.pendingAction;
    if (!pa || pa.playerId !== cur.id || pa.committed) return false;
    if (this.turnPhase !== "claiming") return false;
    if (this.auction) return false;
    const truth = pa.rolledTotal;
    const claim = steps == null ? truth : Number(steps);
    if (!Number.isInteger(claim) || claim < 1 || claim > 12) return false;
    const isTruth = claim === truth;
    const isFreeSeven = truth === 7 && claim === 1; // the standing 7→1 option
    if (!isTruth && !isFreeSeven) {
      // 0 credit (== the public tier, since only zero credit loses the cup):
      // exact roll only (+ the free 7→1). Cupped rollers claim anything free.
      if ((cur.credit || 0) < 1) return false;
    }
    if (this._claimTimer) { clearTimeout(this._claimTimer); this._claimTimer = null; }
    pa.claim = claim;
    pa.mode = claim <= 6 ? "turtle" : "rabbit"; // 7 counts as rabbit
    pa.committed = true;
    // The claim is the ONLY public number on a cup roll; a public-tier roll was
    // already logged with its true total.
    if (pa.cupPublic) {
      this._log(`\u{1F463} ${cur.name} walks ${claim} [${pa.mode}].`);
    } else {
      this._log(`\u{1F964} ${cur.name} claims "${claim} [${pa.mode}]".`);
    }
    this.diceRolled = true; // the move commits NOW — the walk starts client-side
    cur.hasRolled = true;
    this._commitClaimMove(cur, pa);
    // A WINNING move (legit rich SB landing / the within-12 auto-win) ends the
    // game on the spot and SKIPS the accuse window.
    if (this.state !== "playing" || this.superBananaWin) {
      this.pendingAction = null;
      this.turnPhase = "resolved";
      return true;
    }
    if (pa.cupPublic || pa.sbRichLandingResolved) {
      // Public roll: everyone saw it — nothing to accuse. A rich SB landing
      // already lifted the cup itself (win or +1-Credit consolation) — the
      // reveal happened, so the accuse window is skipped there too.
      this.pendingAction = null;
      this.turnPhase = "resolved";
      return true;
    }
    this._openAccuse(cur); // resolves instantly when nobody can accuse
    return true;
  }

  // The MOVE pipeline for a committed claim: grow (turtle) → walk → path
  // collection → landing → SB cross → auto-win check. The dice stay under the
  // cup (this.dice is per-viewer redacted); the frontend walks off lastMove.
  _commitClaimMove(cur, pa) {
    const steps = pa.claim;
    const isTurtle = steps <= 6;
    const oldPos = cur.position;
    // PUBLIC move record — the frontend cup label / walk / pile animations key
    // off this (the real dice stay hidden for everyone but the roller).
    this.lastMove = { playerId: cur.id, steps, mode: pa.mode, turn: this.turn };
    // MODES (derived from the WALKED steps): <=6 = TURTLE — can fire the
    // matching GROW at the walked number, always 1×. 7+ = RABBIT — never
    // grow-matches (grows are labelled 1..6).
    if (isTurtle) this._processRolledGrow(cur, steps);
    cur.position = (cur.position + steps) % this.boardSize;
    cur.revealedTiles.add(cur.position);
    // The ONLY mode difference on the path: TURTLE skips its OWN piles on a
    // cross (land-only). BOTH modes land-steal opponents and take unclaimed
    // piles on landing.
    this._collectBananasOnPath(cur, oldPos, cur.position, isTurtle);
    this._processLanding(cur, true);
    this._resolveSuperBananaCross(cur, oldPos);
    // AUTO-WIN sweep after every move: any RICH player (money >= the SB price)
    // holding >=1 credit with the REVEALED Super Banana 1..12 steps ahead wins
    // instantly — even if this move wasn't theirs (it may have revealed the SB).
    this._checkSuperBananaAutoWin();

    const dmMs = this.diceMatchTiles && this.diceMatchTiles.length > 0 ? 1200 : 0;
    const epMs = this.diceMatchEarlyPickup != null ? 1000 : 0;
    const walkAnimMs = 550 + dmMs + epMs + steps * 150 + 500;
    if (!this.auction && this.state === "playing" && !this.superBananaWin)
      this._scheduleAutoEnd(cur, walkAnimMs + 3000, 2000);
  }

  // Open the simultaneous ACCUSE window AFTER the claimed walk (modeled on the
  // auction respond phase — same respondDeadline/farmAuctionTimer machinery).
  // Every non-bankrupt opponent votes accuse yes/no; only a player holding >=1
  // credit may accuse, so ineligible / ghost players are pre-seeded auto-"no".
  // TEAMS get no special rules — teammates vote too (and may accuse each other).
  // With nobody eligible the window is skipped: the turn resolves and the cup
  // never lifts.
  _openAccuse(cur) {
    const votes = {};
    for (const p of this.players) {
      if (p.id === cur.id || p.bankrupt) continue;
      const eligible = !p.ghost && (p.credit || 0) >= 1;
      votes[p.id] = { eligible, answered: !eligible, accuse: false };
    }
    if (!Object.values(votes).some((v) => v.eligible)) {
      // No eligible accusers → nothing to resolve; the roll stays under the cup.
      this.pendingAction = null;
      this.turnPhase = "resolved";
      return;
    }
    this.turnPhase = "accusing";
    this.accuse = {
      turn: this.turn,
      respondStartTime: null,
      respondDeadline: null,
      votes,
    };
    if (this._accuseTimer) { clearTimeout(this._accuseTimer); this._accuseTimer = null; }
    if (!this.noAuctionTimer) {
      this.accuse.respondStartTime = Date.now();
      this.accuse.respondDeadline = Date.now() + this.farmAuctionTimer * 1000;
      const turn = this.turn;
      this._accuseTimer = setTimeout(() => {
        this._accuseTimer = null;
        if (this.accuse && this.accuse.turn === turn) {
          // Deadline hit: any opponent who didn't vote is counted "no" (auto-no).
          for (const id of Object.keys(this.accuse.votes)) {
            if (!this.accuse.votes[id].answered) this.accuse.votes[id].answered = true;
          }
          this._resolveAccuse();
          if (this.onUpdate) this.onUpdate();
        }
      }, this.farmAuctionTimer * 1000);
    }
  }

  // An opponent submits their accuse vote. Re-checks eligibility at answer time
  // (accusing needs >=1 credit). accuse=true means "I say the claim was a lie".
  submitAccuse(socketId, accuse) {
    if (!this.accuse) return false;
    const v = this.accuse.votes[socketId];
    if (!v || v.answered) return false;
    if (accuse) {
      const p = this.players.find((pl) => pl.id === socketId);
      if (!p || p.ghost || (p.credit || 0) < 1) return false; // no credit → no accusing
    }
    v.answered = true;
    v.accuse = !!accuse;
    this._checkAccuseComplete();
    return true;
  }

  // True once every opponent vote is in (or there's no accuse window at all).
  _allAccusesIn() {
    const ac = this.accuse;
    if (!ac) return true;
    return Object.values(ac.votes).every((v) => v.answered);
  }

  // Resolve as soon as every opponent has voted. Called after each vote
  // (submitAccuse) and from the ghost auto-no in makeGhost.
  _checkAccuseComplete() {
    if (this._allAccusesIn()) this._resolveAccuse();
  }

  // Score the accusation and settle the credit deltas. TRUTHFUL (claim == real
  // roll, or claim 1 on a real 7) + accused → each yes-accuser loses 1 credit,
  // roller unchanged. LIE + accused → each yes-accuser gains 1 AND the roller
  // loses 1 PER yes-accuser (floor 0). Nobody accuses → no credit changes and
  // the real roll is NEVER revealed.
  _resolveAccuse() {
    if (this._accuseTimer) { clearTimeout(this._accuseTimer); this._accuseTimer = null; }
    const pa = this.pendingAction;
    const ac = this.accuse;
    const cur = this.players.find((p) => p.id === (pa && pa.playerId));
    this.accuse = null;
    if (!pa || !cur) { this.pendingAction = null; this.turnPhase = null; return; }

    const yesIds = ac
      ? Object.keys(ac.votes).filter((id) => ac.votes[id].accuse)
      : [];
    if (yesIds.length > 0) {
      const truthful =
        pa.claim === pa.rolledTotal || (pa.claim === 1 && pa.rolledTotal === 7);
      const deltas = {};
      const accusers = [];
      for (const id of yesIds) {
        const p = this.players.find((pl) => pl.id === id);
        if (!p) continue;
        const applied = this._adjustCredit(p, truthful ? -1 : 1);
        accusers.push({ id, delta: applied });
        deltas[id] = (deltas[id] || 0) + applied;
      }
      if (!truthful) {
        // A caught lie costs the roller a FLAT 1 Credit — no matter how many
        // opponents piled on (each accuser still gains their own +1).
        const applied = this._adjustCredit(cur, -1);
        deltas[cur.id] = (deltas[cur.id] || 0) + applied;
      }
      // The cup LIFTS: an accusation is the only thing that ever reveals the
      // real roll — publicly, to everyone, including the log.
      this.diceHidden = false;
      const names = yesIds
        .map((id) => this.players.find((p) => p.id === id)?.name || "?")
        .join(", ");
      this._log(
        truthful
          ? `\u{1F50D} ${names} accused — the cup lifts: ${cur.name} really rolled ${pa.rolledTotal}. TRUTH! Each accuser loses 1 Credit.`
          : `\u{1F50D} ${names} accused — the cup lifts: ${cur.name} actually rolled ${pa.rolledTotal}, not ${pa.claim}. LIE! Each accuser gains 1 Credit; ${cur.name} loses 1.`,
      );
      this._accuseSeq = (this._accuseSeq || 0) + 1;
      this.lastAccuseResult = {
        seq: this._accuseSeq,
        playerId: cur.id,
        claim: pa.claim,
        mode: pa.mode,
        truthful,
        actualTotal: pa.rolledTotal,
        accusers,
        deltas,
        turn: this.turn,
      };
    }
    // No accusation → no credit moves, no reveal, no lastAccuseResult: the
    // actual total stays under the cup forever.

    this.pendingAction = null;
    this.turnPhase = "resolved";
    // Un-stick the turn: the walk's anim-complete signal may have arrived (and
    // been refused) while the window was open, so re-arm a short auto-end.
    // Skipped when an auction/win is still blocking — those re-arm on resolve.
    if (!this.auction && !this.superBananaWin && this.state === "playing") {
      this._scheduleAutoEnd(cur, 2500, 2000);
    }
  }

  debugMove(socketId, targetPos) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || this.diceRolled || cur.bankrupt)
      return null;
    const pos = Math.max(0, Math.min(Math.floor(targetPos), this.boardSize - 1));
    this.dice = [0, 0];
    this.diceIsD12 = false;
    this.diceHidden = false; // a debug jump has no cup
    this.diceOwnerId = null;
    this.diceRolled = true;
    const oldPos = cur.position;
    cur.position = pos;
    cur.revealedTiles.add(cur.position);
    this._collectBananasOnPath(cur, oldPos, cur.position);
    this._processLanding(cur);
    this._resolveSuperBananaCross(cur, oldPos);
    this._checkSuperBananaAutoWin(); // a (debug) move is still a move
    const debugSteps =
      (((pos - oldPos) % this.boardSize) + this.boardSize) % this.boardSize || 1;
    const debugWalkMs = 550 + debugSteps * 150 + 500;
    if (
      !this.auction
    ) {
      this._scheduleAutoEnd(cur, debugWalkMs + 2000, 2000);
    }
    return { dice: this.dice, moved: true };
  }

  // viaNormalRoll: true only when the landing came from a claimed WALK (a real
  // dice turn). A start-pick or a debug jump is NOT a normal roll. (The flag is
  // retained for future landing mechanics that only trigger on a normal roll.)
  _processLanding(player, viaNormalRoll = false) {
    const space = this.board[player.position];
    if (!space) return;

    // Dodecahedron owner AS OF entry — captured before any effect of this landing,
    // so the first-Super-Banana-landing grant below can't instantly give the die
    // away via the pass-around block.
    const d12OwnerAtEntry = this.dodecahedron ? this.d12OwnerId : null;

    // GROW always fires first — even if an opponent is on the tile.
    // Uses the labeled-grow range-limited path. Fall through so the
    // landing checks below still run.
    if (space.type === "grow") {
      this._fireGrowAt(player, player.position, "land");
    }

    // SUPER BANANA (Credit Score redesign): no auction, no ownership, no
    // purchase. Landing always REVEALS it. EVERY non-ghost lander grabs +200
    // bananas (minted, every landing — not latched). A RICH lander (money >= the
    // SB price BEFORE the +200) must PROVE the landing (rule 2026-07-03): their
    // cup ALWAYS lifts (real roll revealed to everyone) and the accuse window is
    // SKIPPED. Legitimately rolled (claim == roll, or the free 7→1) → they WIN —
    // no credit requirement. An alternative/bluffed walk → NO win, +1 Credit
    // consolation, play continues. A ghost gets nothing and can never win.
    // Broke landers just pocket the +200 (cup stays DOWN, normal accuse window)
    // and play continues. The SB stays put, never relocates.
    {
      const sbProp = this.properties.get(player.position);
      if (sbProp && sbProp.group === "superBanana" && !sbProp.owner) {
        // Landing always REVEALS the Super Banana to everyone.
        for (const p of this.players) p.revealedTiles.add(player.position);
        // The DODECAHEDRON originates with the FIRST player to LAND on the Super
        // Banana (whoever they are — even if they go on to win). After this it
        // moves only by landing collisions (the pass-around block below).
        if (this.dodecahedron && this.d12OwnerId === null && !player.bankrupt) {
          this.d12OwnerId = player.id;
          this._log(`🎲 ${player.name} landed on the unrevealed Super Banana and has been HEXED — their 2d6 is now a single d12!`);
          this._setHexNotice(player, null);
        }
        if (!player.ghost) {
          // RICH check uses the money AS OF landing (before the +200 grab).
          const rich = player.money >= sbProp.price;
          player.money += 200;
          if (this.bananaLedger) this.bananaLedger.minted += 200;
          // Marker so the frontend rains the +200 floater AT THE SB TILE. Landing
          // already revealed the SB to everyone above, so getState ships this to
          // all viewers (no fog leak).
          this.lastSuperBananaCross = { playerId: player.id, pos: player.position, amount: 200, turn: this.turn };
          this._log(`⭐ ${player.name} landed on the Super Banana — grabbed 200🍌!`);
          if (rich) {
            // PROVE THE LANDING: a rich lander's cup ALWAYS lifts. When the
            // landing came from a live claim, the win needs a LEGIT roll
            // (claim == real roll, or the free 7→1); a bluffed walk gets the
            // +1 Credit consolation instead. No claim context (debug moves,
            // start picks) counts as legit. The accuse window is skipped
            // either way — submitClaim checks pa.sbRichLandingResolved.
            const pa =
              this.pendingAction && this.pendingAction.playerId === player.id
                ? this.pendingAction
                : null;
            const legit =
              !pa ||
              pa.claim == null ||
              pa.claim === pa.rolledTotal ||
              (pa.claim === 1 && pa.rolledTotal === 7);
            if (pa) {
              pa.sbRichLandingResolved = true;
              // Lift the cup for EVERYONE (a public-tier roll already was).
              this.diceHidden = false;
              this._accuseSeq = (this._accuseSeq || 0) + 1;
              this.lastAccuseResult = {
                seq: this._accuseSeq,
                playerId: player.id,
                claim: pa.claim,
                mode: pa.mode,
                truthful: legit,
                actualTotal: pa.rolledTotal,
                accusers: [],
                deltas: {},
                sbLanding: true, // no accusation — the SB landing forced the reveal
                turn: this.turn,
              };
            }
            if (legit) {
              if (pa) this._log(`⭐ ${player.name} lifts the cup: ${pa.rolledTotal}. A LEGITIMATE landing!`);
              this._awardSuperBananaWin(player, player.position, "landing");
              return;
            }
            const applied = this._adjustCredit(player, 1);
            if (this.lastAccuseResult && this.lastAccuseResult.sbLanding) {
              this.lastAccuseResult.deltas[player.id] = applied;
            }
            this._log(
              `⭐ ${player.name} lifts the cup: ${pa.rolledTotal}, not the claimed ${pa.claim} — no win! +1 Credit consolation.`,
            );
          } else if ((player.credit || 0) < 1) {
            // MERCY CREDIT (rule 2026-07-03): a BROKE lander at STRICTLY ZERO
            // Credit gets +1 mercy Credit on top of the +200 — their next roll
            // goes back under the cup. Broke landers holding >=1 credit don't.
            this._adjustCredit(player, 1);
            this._log(`🥤 ${player.name} landed on the Super Banana broke with 0 Credit — +1 mercy Credit!`);
          }
        }
      }
    }

    // DODECAHEDRON pass-around: a landing collision involving the owner moves the
    // die to the OTHER party. If the OWNER lands on someone → they GIVE it to that
    // player; if a NON-owner lands on the OWNER → they TAKE it. Keyed on the owner
    // AS OF entry so a fresh first-SB grant above doesn't immediately give it away.
    // Bankrupt players are skipped (out of play); ghosts can hold/keep rolling it.
    if (this.dodecahedron && d12OwnerAtEntry) {
      const here = this.players.filter(
        (p) => p.position === player.position && p.id !== player.id && !p.bankrupt,
      );
      if (player.id === d12OwnerAtEntry) {
        if (here.length > 0) this._transferD12(here[0].id); // owner landed on someone → give
      } else if (here.some((p) => p.id === d12OwnerAtEntry)) {
        this._transferD12(player.id); // landed on the owner → take
      }
    }

    // GROW already handled above
    if (space.type === "grow") return;

    const prop = this.properties.get(player.position);
    if (!prop) return;

    if (prop.owner && prop.owner !== player.id) {
      // No rent in this game — just a visit.
      // Reveal the tile to all players so the owner (and any teammate) can
      // see their partner / opponent standing on the farm.
      for (const p of this.players) p.revealedTiles.add(player.position);
    } else if (prop.group === "superBanana") {
      // The Super Banana already resolved above (it resolves before the
      // visit/auction block) and is never auctioned.
    } else if (!prop.owner) {
      // Open an auction, or hand the tile over for free when 0 or 1 players can
      // bid. _createAuctionForLander applies the 0-banana exclusion rule and
      // logs the outcome; the turn auto-end is handled by the caller via its
      // `this.auction` check (an immediate award leaves no auction).
      this.startAuction(player.id);
    }
  }

  // Move the dodecahedron to a new owner (no-op if unchanged). One die, one owner.
  _transferD12(newOwnerId) {
    if (!newOwnerId || this.d12OwnerId === newOwnerId) return;
    const from = this.players.find((p) => p.id === this.d12OwnerId);
    const to = this.players.find((p) => p.id === newOwnerId);
    this.d12OwnerId = newOwnerId;
    if (to) {
      this._log(
        `🎲 ${to.name} has been HEXED — the single-d12 curse passed to them${from ? ` (from ${from.name})` : ""}!`,
      );
      this._setHexNotice(to, from ? from.name : null);
    }
  }

  // Transient PUBLIC toast: someone just became HEXED (single-d12 curse) — on the
  // first Super Banana landing or when it passes to them. Seq-deduped like
  // lastAccuseResult; the frontend toasts "You have been hexed!" to the hexee.
  _setHexNotice(player, fromName) {
    this._hexEventSeq = (this._hexEventSeq || 0) + 1;
    this.lastHexResult = {
      playerId: player.id,
      name: player.name,
      from: fromName || null,
      seq: this._hexEventSeq,
    };
  }

  // Passive landing — only handles non-interactive effects (grow, reveals).
  // Used when a player is pushed onto a tile by an external effect so it
  // doesn't trigger auctions or super banana swaps.

  // Award the Super Banana win to `player` and run the found → won → finished
  // celebration. No purchase, no ownership — the win itself is the prize. Two
  // paths: how="landing" (a RICH lander stopped on the SB) and how="auto" (the
  // within-12 auto-win: rich + >=1 credit + the revealed SB 1..12 steps ahead).
  _awardSuperBananaWin(player, pos, how) {
    // `pos` defaults to where the player is standing (a landing win).
    if (typeof pos !== "number") pos = player.position;
    for (const p of this.players) p.revealedTiles.add(pos);
    this.superBananaWinnerId = player.id;

    // Phase 1: "Found the Super Banana!" (4s)
    this.superBananaWin = { phase: "found", playerId: player.id, how: how || "landing" };
    this._log(
      how === "auto"
        ? `⭐ ${player.name} has the Super Banana within reach — nothing can stop them!`
        : `⭐ ${player.name} found the Super Banana!`,
    );
    if (this.onUpdate) this.onUpdate();

    this._deferredSetTimeout(() => {
      // Phase 2: claimed (3s)
      this.superBananaWin = { phase: "bought", playerId: player.id, how: how || "landing" };
      this._log(
        `⭐ ${player.name} claimed the Super Banana and became Monkey God! 👑`,
      );
      if (this.onUpdate) this.onUpdate();

      this._deferredSetTimeout(() => {
        // Phase 3: game over
        this.superBananaWin = null;
        this.state = "finished";
        if (this._isTeams() && this.teams) {
          const teamKey = this.getTeamOf(player.id);
          const teamMembers = teamKey && this.teams[teamKey];
          const names = teamMembers
            ? teamMembers.map((id) => this.players.find((p) => p.id === id)?.name || "?").join(" & ")
            : player.name;
          this._log(
            `🏆 Team ${teamKey || "?"} (${names}) won the Super Banana! ⭐👑`,
          );
          this._log(
            `✨ ${names} found the Super Banana, they now have good luck for all eternity! ✨`,
          );
        } else {
          this._log(`🏆 ${player.name} is the Monkey God! ⭐👑`);
          this._log(
            `✨ ${player.name} found the Super Banana, ${player.name} now has good luck for all eternity! ✨`,
          );
        }
        this._revealAllTiles();
        if (this.onUpdate) this.onUpdate();
      }, 3000);
    }, 4000);
  }

  // AUTO-WIN sweep — run after EVERY move and EVERY credit change: any player
  // who is RICH (money >= the SB price), holds >=1 credit, and has the REVEALED
  // Super Banana 1..12 forward steps ahead of them wins instantly. Nothing fires
  // off a fogged SB (same global reveal state the hex origination keys off).
  // Ghosts can never win; players still off-board (start pick pending) don't
  // have a real position yet. Returns true if a win fired.
  _checkSuperBananaAutoWin() {
    if (this.state !== "playing" || this.superBananaWin) return false;
    let sbPos = -1;
    for (const [pos, prop] of this.properties) {
      if (prop && prop.group === "superBanana") { sbPos = pos; break; }
    }
    if (sbPos < 0) return false;
    if (!this._isGenuinelyRevealed(sbPos)) return false;
    for (const p of this.players) {
      if (p.bankrupt || p.ghost || p.startPickPending) continue;
      if ((p.money || 0) < this.superBananaPrice) continue;
      if ((p.credit || 0) < 1) continue;
      const dist = (sbPos - p.position + this.boardSize) % this.boardSize;
      if (dist >= 1 && dist <= 12) {
        this._log(
          `⭐ ${p.name} is RICH, has Credit to spare, and the Super Banana is ${dist} step${dist === 1 ? "" : "s"} ahead — INSTANT WIN!`,
        );
        this._awardSuperBananaWin(p, sbPos, "auto");
        return true;
      }
    }
    return false;
  }

  // -- Auction System ---------------------------------------------


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
    if (!a) return null;
    if (a.phase !== "pitch") return null;
    if (socketId !== a.landingPlayer) return null;
    const lander = this.players.find((p) => p.id === socketId);
    if (!lander || lander.bankrupt) return null;
    // Ghosts never bid, so they can't set the Buy Now price. In 2v2 the lander's
    // teammate is NOT an opponent — Buy Now locks out the other TEAM, so it's
    // priced off the richest opponent only (never your own partner's bank).
    const landerTeam = this._isTeams() ? this.getTeamOf(socketId) : null;
    const opponents = this.players.filter(
      (p) =>
        !p.bankrupt &&
        !p.ghost &&
        p.id !== socketId &&
        (!landerTeam || this.getTeamOf(p.id) !== landerTeam),
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
    if (a.teamFlow) {
      // 2v2: this isn't an instant win. It pitches the lock-out price (highest
      // opponent + 1) so no opponent can afford it, then runs the normal
      // post-pitch flow — which hands the call to the teammate (accept = the
      // teammate buys; reject = the lander buys). When the teammate can't afford
      // the price either, _2v2AfterPitch awards it to the lander automatically.
      const lb = a.bids[a.landingPlayer];
      lb.amount = price;
      lb.placed = true;
      lb.bidTime = Date.now();
      this._log(
        `🏷️ ${lander.name} priced it at ${price}🍌 (highest opponent +1).`,
      );
      this._2v2AfterPitch();
      return true;
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

  // Crossing the Super Banana (passing OVER it without LANDING) does something
  // ONLY when the tile is already REVEALED (a prior landing exposed it — the
  // same global reveal state the hex origination and the auto-win key off).
  // Crossing a still-hidden SB does NOTHING (rich or broke), and crossing NEVER
  // reveals it (you must still LAND to expose it). Once it's revealed:
  //   - RICH (money >= the SB price) -> +1 Credit — EVERY cross, repeatable.
  //   - BROKE -> the existing ONE-TIME consolation +200 bananas (sbBonusTaken).
  // Ghosts and bankrupt players do nothing. Called right after _processLanding at
  // every move site.
  _resolveSuperBananaCross(player, oldPos) {
    if (!player || player.ghost || player.bankrupt) return;
    if (this.state !== "playing") return;
    const newPos = player.position;
    const steps = (newPos - oldPos + this.boardSize) % this.boardSize;
    // Find the Super Banana among the STRICTLY-crossed tiles (oldPos+1 ..
    // newPos-1). The landing tile (newPos) is _processLanding's job, not crossing.
    let sbPos = -1;
    for (let s = 1; s < steps; s++) {
      const pos = (oldPos + s) % this.boardSize;
      const prop = this.properties.get(pos);
      if (prop && prop.group === "superBanana") { sbPos = pos; break; }
    }
    if (sbPos < 0) return; // didn't cross the Super Banana
    // Crossing matters ONLY once the SB is revealed — a hidden SB crossed does
    // nothing (for rich and broke alike) and is never revealed by the cross.
    if (!this._isGenuinelyRevealed(sbPos)) return;
    if (player.money >= this.properties.get(sbPos).price) {
      // RICH crosser: +1 Credit per cross (every lap, repeatable). The credit
      // bump re-runs the auto-win check via _adjustCredit.
      this._adjustCredit(player, 1);
      this._log(`⭐ ${player.name} crossed the Super Banana — +1 Credit! 🪙`);
      return;
    }
    // BROKE -> the ONE-TIME consolation +200 bananas. Gated on sbBonusTaken: a
    // player who already grabbed the cross consolation doesn't get it again.
    // PASSIVE (fires regardless of what the landing tile did). Freshly minted,
    // so pair it onto the banana ledger to keep conservation (money/piles/pot
    // == baseline + minted - burned).
    if (player.sbBonusTaken) return;
    player.money += 200;
    if (this.bananaLedger) this.bananaLedger.minted += 200;
    player.sbBonusTaken = true;
    // Transient marker so the frontend can rain the +200 floater AT THE SUPER
    // BANANA TILE the instant the token crosses it (not on the moving piece).
    // Carries the SB position, so getState fog-redacts it to non-revealers.
    this.lastSuperBananaCross = { playerId: player.id, pos: sbPos, amount: 200, turn: this.turn };
    this._log(`⭐ ${player.name} couldn't afford the Super Banana but grabbed 200🍌 crossing it!`);
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
      this._startSealedAuction(prop, pos, others, landerId);
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

    // 2v2 uses a sequential team negotiation (see _create2v2Auction). The
    // free-award shortcuts above (0 or 1 eligible) are shared with classic.
    if (this._isTeams() && this.teams) {
      return this._create2v2Auction(lander, prop, pos);
    }

    if (lander.money > 0) {
      this._startPitchAuction(prop, pos, lander.id, eligibleIds);
    } else {
      this._startSealedAuction(prop, pos, eligibleIds, landerId);
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
  _startSealedAuction(prop, pos, bidderIds, landerId) {
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
      sealedLanderId: landerId || null,
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
      // The 2v2 teammate accept-wait keys off this, so it must exist even
      // with the auction timer off (respondStartTime stays null then).
      a.respondOpenedAt = Date.now();
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
      // rules.md: a sealed-bid tie gives the LANDER the property — free, since
      // a sealed bid only runs when the lander can't pay. Earliest tied bidder
      // only if the lander is gone.
      const lander = this.players.find(
        (p) => p.id === a.sealedLanderId && !p.bankrupt,
      );
      if (lander) {
        a.highBidder = lander.id;
        a.highBid = 0;
        this._log(
          `🤝 Tie at the top — ${lander.name} (the lander) takes ${a.propName}!`,
        );
      } else {
        a.highBidder = this._earliestByTurnOrder(top);
        a.highBid = a.landerOpenBid + maxTopup;
      }
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

    if (a.highBidder) {
      const winner = this.players.find((p) => p.id === a.highBidder);
      if (winner && prop) {
        const finalPrice = a.highBid;
        winner.money -= finalPrice;
        winner.totalSpent = (winner.totalSpent || 0) + finalPrice;
        if (this.bananaLedger) this.bananaLedger.burned += finalPrice;
        prop.owner = winner.id;
        winner.properties.push(a.position);
        for (const p of this.players) p.revealedTiles.add(a.position);
        const typeLabel = prop.group === "desert" ? "desert" : "farm";
        this._log(
          `🔨 ${winner.name} bought the ${typeLabel} ${prop.name} for ${finalPrice}🍌!`,
        );
      }
    } else {
      this._log(`💨 No bids — Farm #${a.position} remains unclaimed.`);
    }

    if (this._auctionTimer) {
      clearTimeout(this._auctionTimer);
      this._auctionTimer = null;
    }
    // Snapshot the resolved auction so every viewer (incl. blind bidders) can
    // fire the BOUGHT/MISSED tile flip with the correct farm. Keyed on resolvedAt
    // (fires once); cleared a few seconds later so a reconnect never replays it.
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

  // ============================================================
  // 2v2 FARM AUCTION (a.teamFlow = true). A simple sequential team auction.
  // Classic auctions use the separate pitch/respond/silentbid machine and are
  // untouched.
  //
  // A1 pitches a price P (or "Buy Now" = richest opponent + 1):
  //   1. The opponents race: the FIRST to accept buys at P and the auction
  //      ends immediately. Opponents who can't afford P are out.
  //   2. If ALL opponents reject (or time out), the lander's teammate(s) race:
  //      the FIRST teammate to Accept buys at P; if all reject (or can't
  //      afford P), the lander (A1) buys at P. (2 teammates race in 3v3.)
  // Broke A1 (0 bananas) can't price it: the farm goes up free — the first
  // opponent to accept gets it; if none accept by the timer the closest
  // opponent does (no teammate step).
  // Privacy: a player sees only their OWN and their TEAMMATE's accept/reject.
  // ============================================================
  _create2v2Auction(lander, prop, pos) {
    const landerTeam = this.getTeamOf(lander.id);
    // Ghost/bankrupt teammates can't participate. Any number of teammates (1 in
    // 2v2, 2 in 3v3) form the fallback race after the opponents pass.
    const teammates = this.players.filter(
      (p) => p.id !== lander.id && !p.bankrupt && !p.ghost && this.getTeamOf(p.id) === landerTeam,
    );
    const oppPlayers = this.players.filter(
      (p) => !p.bankrupt && !p.ghost && this.getTeamOf(p.id) !== landerTeam,
    );
    const a = {
      position: pos,
      propName: prop.name,
      propPrice: prop.price,
      propGroup: prop.group || null,
      teamFlow: true,
      landingPlayer: lander.id,
      teammateIds: teammates.map((p) => p.id),
      oppIds: oppPlayers.map((p) => p.id),
      bidders: [
        lander.id,
        ...teammates.map((p) => p.id),
        ...oppPlayers.map((p) => p.id),
      ],
      bids: {},
      phase: "pitch",
      brokeLander: false,
      landerOpenBid: 0,
      affOppIds: [],        // opponents who can afford P (the racers)
      affMateIds: [],       // teammates who can afford P (the fallback racers)
      highBid: 0,
      highBidder: null,
      stepDeadline: null,
      stepStartTime: null,
    };
    for (const id of a.bidders) {
      a.bids[id] = { amount: 0, placed: false, accepted: null, responded: false };
    }
    this.auction = a;

    if (lander.money > 0) {
      this._log(`🍌 Banana bid! ${lander.name}, name your price.`);
    } else {
      // Broke lander can't price it — the farm goes up free to the opponents.
      a.brokeLander = true;
      this._log(`${lander.name} is broke — ${prop.name} is up for grabs! Opponents, claim it free!`);
      this._2v2OpenOppRespond(0);
    }
    return true;
  }

  _2v2Name(id) {
    const p = this.players.find((x) => x.id === id);
    return p ? p.name : "?";
  }

  // Arm the per-step countdown (configurable farm timer). On expiry, onExpire
  // runs the passive resolution for whatever step is active. No timer in
  // noAuctionTimer mode (the step waits for the actor; leave/ghost disentangles).
  _2v2ArmStepTimer(onExpire) {
    const a = this.auction;
    if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; }
    if (this.noAuctionTimer) { a.stepDeadline = null; a.stepStartTime = null; return; }
    a.stepDeadline = Date.now() + this.farmAuctionTimer * 1000;
    a.stepStartTime = Date.now();
    const phaseAtArm = a.phase;
    this._auctionTimer = setTimeout(() => {
      this._auctionTimer = null;
      if (!this.auction || this.auction.phase !== phaseAtArm) return;
      onExpire();
      if (this.onUpdate) this.onUpdate();
    }, this.farmAuctionTimer * 1000);
  }

  _2v2Award(winnerId, price) {
    const a = this.auction;
    a.highBidder = winnerId;
    a.highBid = Math.max(0, Math.floor(price) || 0);
    this._resolveAuction();
  }

  // A player who can still take a sequential turn (present, not bankrupt, not a
  // ghost). Used so a 2v2 step never waits forever on someone who can't act.
  _2v2Actable(id) {
    const p = id && this.players.find((x) => x.id === id);
    return !!(p && !p.bankrupt && !p.ghost);
  }

  // Re-arm the step timer for whichever 2v2 phase is active (used when the
  // auction timer is toggled back on mid-auction). _2v2ArmStepTimer no-ops
  // under noAuctionTimer.
  _2v2RearmStepTimer() {
    const a = this.auction;
    if (!a || !a.teamFlow) return;
    if (a.phase === "respondOpp") this._2v2ArmStepTimer(() => this._2v2OppRaceTimeout());
    else if (a.phase === "teammateFinal") this._2v2ArmStepTimer(() => this._2v2MateRaceTimeout());
  }

  // Called from placeBid after the lander prices the farm (2v2 pitch).
  _2v2AfterPitch() {
    const a = this.auction;
    this._2v2OpenOppRespond(a.bids[a.landingPlayer].amount);
  }

  // Open the opponents' accept/reject race at price P. Eligible opponents are
  // present and can afford P (for a broke lander, P is 0 so all present
  // opponents qualify — the farm is free). The first to accept wins immediately;
  // if all reject, a normal lander hands it to the teammate while a broke lander
  // gives it to a random opponent. With no eligible opponent, skip straight to
  // that step.
  _2v2OpenOppRespond(price) {
    const a = this.auction;
    a.landerOpenBid = price;
    const canTake = (id) => {
      const p = this.players.find((x) => x.id === id);
      return !!(p && !p.bankrupt && !p.ghost && p.money >= price);
    };
    a.affOppIds = a.oppIds.filter(canTake);

    const excluded = a.oppIds.filter((id) => !a.affOppIds.includes(id));
    if (excluded.length > 0) {
      this._log(
        `${excluded.map((id) => this._2v2Name(id)).join(", ")} can't afford ${price}🍌 — out of the auction.`,
      );
    }

    if (a.affOppIds.length === 0) {
      this._2v2OnAllOppRejected();
      return;
    }
    a.phase = "respondOpp";
    for (const id of a.affOppIds) { a.bids[id].accepted = null; a.bids[id].responded = false; }
    this._log(`Priced at ${price}🍌 — opponents, accept to claim it or reject!`);
    this._2v2ArmStepTimer(() => this._2v2OppRaceTimeout());
  }

  // Timer expiry during the opponents' race: every opponent who hasn't answered
  // counts as a reject, then the all-rejected path runs.
  _2v2OppRaceTimeout() {
    const a = this.auction;
    if (a.phase !== "respondOpp") return;
    for (const id of a.affOppIds) {
      if (a.bids[id] && !a.bids[id].responded) { a.bids[id].responded = true; a.bids[id].accepted = false; }
    }
    this._2v2OnAllOppRejected();
  }

  // Accept/reject dispatcher for the two 2v2 steps.
  _2v2Respond(socketId, accept) {
    const a = this.auction;
    if (a.phase === "respondOpp") {
      if (!a.affOppIds.includes(socketId)) return false;
      const b = a.bids[socketId];
      if (!b || b.responded) return false;
      b.responded = true;
      b.accepted = !!accept;
      if (accept) {
        // First opponent to accept wins immediately — auction over.
        this._2v2Award(socketId, a.landerOpenBid);
      } else if (
        a.affOppIds.every((id) => a.bids[id] && a.bids[id].responded && a.bids[id].accepted === false)
      ) {
        this._2v2OnAllOppRejected();
      }
      return true;
    }
    if (a.phase === "teammateFinal") {
      if (!a.affMateIds || !a.affMateIds.includes(socketId)) return false;
      const b = a.bids[socketId];
      if (!b || b.responded) return false;
      b.responded = true;
      b.accepted = !!accept;
      if (accept) {
        // First teammate to accept buys at P — auction over.
        this._2v2Award(socketId, a.landerOpenBid);
      } else if (
        a.affMateIds.every((id) => a.bids[id] && a.bids[id].responded && a.bids[id].accepted === false)
      ) {
        // All teammates passed → the lander keeps it at P.
        this._2v2Award(a.landingPlayer, a.landerOpenBid);
      }
      return true;
    }
    return false;
  }

  // Timer expiry during the teammates' race: every teammate who hasn't answered
  // counts as a reject, then the lander keeps the farm at P.
  _2v2MateRaceTimeout() {
    const a = this.auction;
    if (a.phase !== "teammateFinal") return;
    for (const id of a.affMateIds || []) {
      if (a.bids[id] && !a.bids[id].responded) { a.bids[id].responded = true; a.bids[id].accepted = false; }
    }
    this._2v2Award(a.landingPlayer, a.landerOpenBid);
  }

  // Both opponents rejected (or none could afford). Normal lander -> the
  // teammate's final say; broke lander -> a random opponent gets it free.
  _2v2OnAllOppRejected() {
    const a = this.auction;
    if (a.brokeLander) { this._2v2BrokeClosestAward(); return; }
    this._2v2ToTeammate();
  }

  // Normal lander, opponents passed: the teammate(s) race to buy at P. The first
  // to accept wins; if all reject (or none can afford P), the lander buys at P.
  _2v2ToTeammate() {
    const a = this.auction;
    const price = a.landerOpenBid;
    const canTake = (id) => {
      const p = this.players.find((x) => x.id === id);
      return !!(p && !p.bankrupt && !p.ghost && p.money >= price);
    };
    a.affMateIds = (a.teammateIds || []).filter(canTake);
    if (a.affMateIds.length === 0) {
      this._2v2Award(a.landingPlayer, price);
      return;
    }
    a.phase = "teammateFinal";
    for (const id of a.affMateIds) { a.bids[id].accepted = null; a.bids[id].responded = false; }
    const names = a.affMateIds.map((id) => this._2v2Name(id)).join(" / ");
    this._log(
      `No opponent took it — ${names}, buy it for ${price}🍌 or pass to ${this._2v2Name(a.landingPlayer)}?`,
    );
    this._2v2ArmStepTimer(() => this._2v2MateRaceTimeout());
  }

  // Broke lander, opponents passed: the farm goes to the CLOSEST opponent
  // turn-wise — i.e. walking forward in turn order from the lander, the first
  // eligible opponent to take a turn — for free.
  _2v2BrokeClosestAward() {
    const a = this.auction;
    const pool = (a.affOppIds || []).filter((id) => this._2v2Actable(id));
    if (pool.length === 0) {
      // No opponent left to take it — the broke lander keeps it for free.
      this._2v2Award(a.landingPlayer, 0);
      return;
    }
    const landerIdx = this.players.findIndex((p) => p.id === a.landingPlayer);
    const n = this.players.length;
    let winner = null;
    if (landerIdx >= 0) {
      for (let off = 1; off <= n; off++) {
        const p = this.players[(landerIdx + off) % n];
        if (p && pool.includes(p.id)) { winner = p.id; break; }
      }
    }
    if (!winner) winner = pool[0];
    this._log(`No opponent claimed it — ${this._2v2Name(winner)} (next up) gets ${a.propName} for free!`);
    this._2v2Award(winner, 0);
  }

  // A player who leaves or becomes a ghost mid-2v2-auction auto-takes the
  // passive (reject/pass) action for the step they owe, so the auction never
  // stalls waiting on someone who can't act.
  _2v2DisentanglePlayer(playerId) {
    const a = this.auction;
    if (!a || !a.teamFlow) return;
    // The lander is the seller: if they leave/ghost at ANY phase, abandon the
    // auction (mirrors classic). There's no valid "lander buys" fallback, and
    // the farm must never resolve to a gone/ghost lander.
    if (a.landingPlayer === playerId) {
      if (this._auctionTimer) { clearTimeout(this._auctionTimer); this._auctionTimer = null; }
      this.auction = null;
      return;
    }
    if (a.phase === "pitch") return; // only the lander acts during pitch
    if (a.phase === "respondOpp") {
      // Auto-reject the leaver and drop them from the racers; if every remaining
      // racer has rejected, run the all-rejected path.
      if (a.affOppIds.includes(playerId)) {
        if (a.bids[playerId] && !a.bids[playerId].responded) {
          a.bids[playerId].responded = true;
          a.bids[playerId].accepted = false;
        }
        a.affOppIds = a.affOppIds.filter((id) => id !== playerId);
        if (
          a.affOppIds.length === 0 ||
          a.affOppIds.every((id) => a.bids[id] && a.bids[id].responded && a.bids[id].accepted === false)
        ) {
          this._2v2OnAllOppRejected();
        }
      }
      return;
    }
    if (a.phase === "teammateFinal") {
      // Auto-reject the leaver and drop them from the teammate racers; if every
      // remaining teammate has rejected, the lander keeps the farm at P.
      if (a.affMateIds && a.affMateIds.includes(playerId)) {
        if (a.bids[playerId] && !a.bids[playerId].responded) {
          a.bids[playerId].responded = true;
          a.bids[playerId].accepted = false;
        }
        a.affMateIds = a.affMateIds.filter((id) => id !== playerId);
        if (
          a.affMateIds.length === 0 ||
          a.affMateIds.every((id) => a.bids[id] && a.bids[id].responded && a.bids[id].accepted === false)
        ) {
          this._2v2Award(a.landingPlayer, a.landerOpenBid);
        }
      }
      return;
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
    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount)) return false; // reject NaN / non-numeric pitches
    if (!player || amount > player.money || amount < 0) return false;

    // Cap at richest OPPONENT's money so the lander can't name an impossible
    // price. Ghosts never bid; in team mode the lander's own teammate(s) are not
    // opponents and must not raise the cap (mirrors the team Buy Now price).
    const landerTeam = this._isTeams() ? this.getTeamOf(socketId) : null;
    const others = this.players.filter(
      (p) =>
        p.id !== socketId &&
        !p.bankrupt &&
        !p.ghost &&
        (!landerTeam || this.getTeamOf(p.id) !== landerTeam),
    );
    if (others.length > 0) {
      const maxOtherMoney = Math.max(...others.map((p) => p.money));
      // (amount <= player.money is already enforced above)
      if (amount > maxOtherMoney) {
        return false;
      }
    }

    // Minimum bid is 1 banana; 0 only allowed when lander is broke
    if (amount < 1 && player.money !== 0) return false;

    b.amount = amount;
    b.placed = true;
    b.bidTime = Date.now();
    this._log(`${player.name} set the price for Farm #${a.position}.`);

    if (a.teamFlow) this._2v2AfterPitch();
    else this._checkPhaseComplete();
    return true;
  }


  respondAuction(socketId, accept) {
    if (!this.auction) return false;
    const a = this.auction;
    // Team mode routes every accept/reject through its sequential dispatcher
    // (respondOpp / teammateFinal races) — the classic "respond" phase below is
    // free-for-all only, so there's no teammate to gate.
    if (a.teamFlow) return this._2v2Respond(socketId, accept);
    if (a.phase !== "respond") return false;
    if (socketId === a.landingPlayer) return false;
    const b = a.bids[socketId];
    if (!b || b.responded) return false;

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

  // Note: a player's first turn is picking any tile to start on.
  // The chosen tile is treated like a normal landing (auction if a farm, etc).
  pickStartTile(socketId, position) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (!cur.startPickPending) return false;
    if (this.auction)
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
    // A start-pick is a move too: it may have revealed the SB (or landed rich
    // players near it) — run the auto-win sweep.
    this._checkSuperBananaAutoWin();

    if (!this.auction && !this.superBananaWin) {
      this._scheduleAutoEnd(cur, 1000);
    }
    return true;
  }

  // Random first-turn pick: choose a uniformly random tile that ISN'T occupied
  // by another player already on the board (so the 2nd/3rd/4th picks never land
  // on someone), then resolve it through the normal pickStartTile path.
  pickStartTileRandom(socketId) {
    if (this.state !== "playing") return false;
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId) return false;
    if (!cur.startPickPending) return false;
    if (this.auction) return false;
    const occupied = new Set();
    for (const p of this.players) {
      if (p.id !== cur.id && !p.bankrupt && !p.startPickPending) {
        occupied.add(p.position);
      }
    }
    const candidates = [];
    for (let i = 0; i < this.boardSize; i++) {
      if (!occupied.has(i)) candidates.push(i);
    }
    if (candidates.length === 0) return false;
    const pos = candidates[Math.floor(Math.random() * candidates.length)];
    return this.pickStartTile(socketId, pos);
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
  // Mirrors the frontend `_growRangePath` in frontend/game-lobby.js — they MUST stay
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
    // spell cards → pulse before the walk) or on arrival (land).
    this.lastGrowActivated = (this.lastGrowActivated || []).concat([
      { pos: growPos, source },
    ]);

    // rules.md: only revealed farms OWNED BY THE PLAYER WHO FIRED the grow
    // grow piles — opponents' and unowned farms in range get nothing. The
    // range is bounded by the next revealed grow tile (see _growRange).
    //
    // Use the canonical properties map rather than the player's `properties`
    // array, so an owner/list desync can't drop a farm.
    const range = this._growRange(growPos);
    const farmsInRange = [];
    for (const [propId, prop] of this.properties) {
      if (!prop || prop.owner !== player.id) continue;
      if (!range.has(propId)) continue;
      if (prop.group !== "farm") continue;
      if (!this._isGenuinelyRevealed(propId)) continue;
      farmsInRange.push(propId);
    }

    const label =
      this.growTileLabels && this.growTileLabels.has(growPos)
        ? this.growTileLabels.get(growPos)
        : "?";

    let totalGrown = 0;
    let totalEarlyPicked = 0;
    let earlyPickupTile = null;
    // Every farm that grew this fire, plus the fresh amount per tile. These
    // feed the dice-match animation pipeline (see below) so the frontend pops
    // the piles in.
    const grownTiles = [];
    const grownAmounts = {};
    for (const propId of farmsInRange) {
      const prop = this.properties.get(propId);
      const amount = prop.price; // = 100% of the farm's yield (grows are always 1× now)
      if (amount <= 0) continue;
      if (this.bananaLedger) this.bananaLedger.minted += amount;
      grownTiles.push(propId);
      grownAmounts[propId] = amount;

      // Early pickup: standing on your own farm when it grows pockets the
      // bananas immediately — the fresh growth plus any pile already sitting
      // there — instead of leaving a pile.
      if (
        !player.bankrupt &&
        player.position === propId &&
        !player.startPickPending
      ) {
        const pickup = amount + (prop.bananaPile || 0);
        prop.bananaPile = 0;
        player.money += pickup;
        totalEarlyPicked += pickup;
        earlyPickupTile = propId;
        continue;
      }

      // Grown bananas always land in the farm's pile — a squatter does NOT grab
      // them the instant they sprout, and (under the steal-on-LAND rule) they
      // never collect growth that accrues AFTER they landed. The OWNER reclaims it
      // by crossing/landing on the farm; a fresh visitor STEALS the pile only by
      // LANDING on it.
      prop.bananaPile = (prop.bananaPile || 0) + amount;
      totalGrown += amount;
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
      source === "roll" ? `walked ${label} — GROW ${label} fired` : `landed on GROW ${label}`;
    if (totalEarlyPicked > 0) {
      this._log(
        `${player.name} ${verb} — early-picked ${totalEarlyPicked}🍌 from the farm under them! 🌱🐒`,
      );
    }
    if (totalGrown > 0) {
      this._log(
        `${player.name} ${verb} — ${totalGrown}🍌 grew on their farms in range! 🌱`,
      );
    }
    if (totalGrown === 0 && totalEarlyPicked === 0) {
      this._log(`${player.name} ${verb} — none of their farms in range! 🌱`);
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

  // A WALKED number in 1..6 (a TURTLE move) fires the matching GROW tile's
  // effect (grow tiles are labelled 1..6) — always 1× — but ONLY if that grow
  // tile has already been revealed (landed on). A still-hidden grow stays
  // dormant. Values outside 1..6 (a RABBIT walk of 7..12) match no grow and are
  // ignored. Grows key off the CLAIMED/walked steps, never the hidden roll.
  // Returns true if a grow actually FIRED.
  _processRolledGrow(player, value) {
    if (value < 1 || value > 6) return false;
    const growPos = this._findGrowByLabel(value);
    if (growPos == null) return false;
    if (!this._isGenuinelyRevealed(growPos)) return false;
    this._fireGrowAt(player, growPos, "roll");
    return true;
  }

  // -- Banana Pile Collection -------------------------------------


  // Land-steal (rules.md "Steal logic"): LANDING on someone else's farm grabs its
  // WHOLE pile right now. No-ops on your own / unowned / empty tiles. SILENT — no
  // log; the frontend shows a "Stolen" floater (detected client-side from the pile
  // diff). Returns the amount stolen.
  _stealPileOnLand(player, pos) {
    const prop = this.properties.get(pos);
    if (!prop || prop.bananaPile <= 0 || !prop.owner || prop.owner === player.id)
      return 0;
    const stolen = prop.bananaPile;
    prop.bananaPile = 0;
    player.money += stolen;
    return stolen;
  }

  _collectBananasOnPath(player, oldPos, newPos, isTurtle = false) {
    // Walk every tile from oldPos+1 to newPos (wrapping around the board).
    // isTurtle (a walked-<=6 move): the ONLY mode difference — you do NOT collect
    // OWN piles by CROSSING (only by LANDING). Everything else is identical for
    // turtle and rabbit: unclaimed piles are collected on LANDING only, and an
    // opponent's pile is STOLEN on LANDING only (BOTH modes land-steal).
    const steps = (newPos - oldPos + this.boardSize) % this.boardSize;
    if (steps === 0) return;
    let collected = 0; // own + unclaimed piles — logged as a harvest

    for (let s = 1; s <= steps; s++) {
      const pos = (oldPos + s) % this.boardSize;

      const prop = this.properties.get(pos);
      if (!prop || prop.bananaPile <= 0) continue;

      const isLanding = pos === newPos;

      if (prop.owner === player.id) {
        // Your OWN farm — collect the WHOLE pile (every stack). RABBIT on CROSS
        // or LAND; TURTLE only on LANDING: walking PAST your own pile in turtle
        // mode collects nothing.
        if (isLanding || !isTurtle) {
          collected += prop.bananaPile;
          prop.bananaPile = 0;
        }
      } else if (!prop.owner && isLanding) {
        // Unclaimed pile — collected on LANDING only (both modes).
        collected += prop.bananaPile;
        prop.bananaPile = 0;
      } else if (prop.owner && prop.owner !== player.id && isLanding) {
        // STEAL an opponent's pile on LANDING — BOTH modes (the old turtle
        // no-land-steal rule is repealed). Kept OUT of `collected` so the
        // frontend shows a per-tile "Stolen" floater (pile-decrement detector),
        // not the harvest log.
        this._stealPileOnLand(player, pos);
      }
    }

    if (collected > 0) {
      player.money += collected;
      this._log(
        `${player.name} harvested ${collected}\ud83c\udf4c from banana piles! \ud83d\udc35`,
      );
    }
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

  // rules.md (Leavers): "If every remaining player is a ghost except for one,
  // that one live player just wins" \u2014 immediately.
  _checkLastLiveWin() {
    if (this.state !== "playing" && this.state !== "revealing") return false;
    // A Super Banana win already in progress (the purchase win sequence is
    // running) must NOT be overridden by the last-monkey-standing rule if the
    // buyer disconnects mid-animation — their completed purchase win stands.
    if (this.superBananaWin) return false;
    const alive = this.players.filter((p) => !p.bankrupt);
    const live = alive.filter((p) => !p.ghost);
    if (alive.length < 2 || live.length !== 1) return false;
    const winner = live[0];
    this.state = "finished";
    this.lastStandingWinner = winner.id;
    const teamKey =
      this._isTeams() && this.teams ? this.getTeamOf(winner.id) : null;
    this._log(
      teamKey
        ? `\ud83c\udfc6 ${winner.name} is the only monkey still here \u2014 the spirits concede. Team ${teamKey} wins! \ud83d\udc51\ud83d\udc7b`
        : `\ud83c\udfc6 ${winner.name} is the only monkey still here \u2014 the spirits concede the game! \ud83d\udc51\ud83d\udc7b`,
    );
    this._revealAllTiles();
    return true;
  }

  _revealAllTiles() {
    for (const p of this.players) {
      for (let i = 0; i < this.boardSize; i++) p.revealedTiles.add(i);
    }
  }

  endTurn(socketId) {
    const cur = this.getCurrentPlayer();
    if (!cur || cur.id !== socketId || !this.diceRolled) return false;
    if (this.superBananaWin) return false;
    // A blocking interaction must fully resolve before the turn can advance.
    // notifyAnimsComplete already refuses during these; endTurn must too, or an
    // out-of-band/internal caller could cross a turn boundary mid-auction
    // (skewing turn order).
    if (this.auction) return false;
    // The claim/accuse window must fully resolve before the turn can advance
    // (the walk happens at claim time, so diceRolled is true mid-window).
    if (this.pendingAction || this.accuse) return false;
    this._cancelAutoEnd();
    this.itemMoveThisTurn = false;
    this.diceMatchTiles = null;
    this.diceMatchGrownAmounts = null;
    this.diceMatchEarlyPickup = null;
    this.lastGrowFired = null;
    this.lastGrowActivated = null;
    this.lastSuperBananaCross = null;
    this.lastStartPick = null;
    this.lastMove = null;
    this.lastHexResult = null;
    this.lastTileSwap = null;

    // Clamp all players to 0 minimum (no negatives, no bankruptcy)
    for (const p of this.players) {
      if (p.money < 0) {
        // Defensive net: no path should overdraw a player, so if this fires it
        // signals an upstream accounting bug. Warn so a genuine overdraw surfaces
        // instead of being silently absorbed into bananaLedger.minted.
        console.warn(
          `[bananaLedger] negative-money clamp fired for ${p.id} (${p.money}) — an upstream subtraction overdrew them.`,
        );
        if (this.bananaLedger) this.bananaLedger.minted += -p.money;
        p.money = 0;
      }
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
    // Clear the claim/accuse window for the new turn (the just-ended turn's
    // pendingAction/accuse were consumed at resolve; this is a defensive reset
    // so a half-open window can never leak into the next player's turn).
    this.turnPhase = null;
    this.pendingAction = null;
    this.accuse = null;
    if (this._accuseTimer) { clearTimeout(this._accuseTimer); this._accuseTimer = null; }
    if (this._claimTimer) { clearTimeout(this._claimTimer); this._claimTimer = null; }

    // (Wins fire IMMEDIATELY now — the rich Super Banana landing and the
    // within-12 auto-win both run _awardSuperBananaWin on the spot — so there
    // is no end-of-turn win sweep anymore.)
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

  // -- Action log -------------------------------------------------

  // Log entries are usually plain strings, but some carry a color tag so the
  // frontend can theme the line. Pass { color: "green" | "red" | ... } as the
  // second arg to flag a line.
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
    // Fog of war is enforced HERE (server-side), not just hidden in the UI: a
    // tile's contents are redacted for any viewer who hasn't revealed it. This
    // is what keeps the relocated Super Banana's location (and hidden farm
    // yields) genuinely secret — see rules.md "Super Banana". Only applied
    // during active play; the pre-game reveal and the end-game reveal both
    // populate revealedTiles so nothing is hidden then.
    const _viewer = this.players.find((p) => p.id === viewerId);
    // Fog is off during play for a viewer who enabled the DEBUG-only "Reveal All
    // Tiles" view (revealAllView) — they get the unredacted board. Everyone else
    // stays fogged. The flag can only be set in debug builds (set_reveal_all is
    // DEBUG_TOOLS-gated server-side), so this is never a production cheat.
    const _fog = this.state === "playing" && !(_viewer && _viewer.revealAllView);
    // No matching viewer during play → redact everything (secure default).
    const _seen = _viewer && _viewer.revealedTiles ? _viewer.revealedTiles : new Set();
    const _hidden = (i) => _fog && !_seen.has(i);

    const properties = [];
    for (const [id, prop] of this.properties) {
      if (_hidden(id)) {
        // Redacted: keep the id + a marker so the frontend can render the fog
        // cover, but leak no identity (name/type/group/price) or pile/owner.
        properties.push({
          id,
          owner: null,
          price: null,
          type: null,
          name: null,
          group: null,
          bananaPile: 0,
          hidden: true,
        });
        continue;
      }
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

    // Public board composition (counts only — never positions), so the tile
    // legend can show "the board has a Super Banana / desert" without leaking
    // WHERE they are. Invariant under the board shuffle.
    const boardComposition = { farm: 0, grow: 0, desert: 0, special: 0 };
    for (const space of this.board) {
      // Real farms are spaces of type "property" (the desert & Super Banana carry
      // their OWN space.type and only NEST a buyable), so count those into `farm`;
      // grow / desert / special match their space.type directly.
      if (space.type === "property") boardComposition.farm++;
      else if (boardComposition[space.type] !== undefined) boardComposition[space.type]++;
    }

    // Fog also covers the grow-animation channel: a player growing their OWN
    // farms must not reveal a hidden-to-the-viewer farm's position or yield via
    // the dice-match pile animation. Filter these to tiles the viewer has
    // revealed (grow TILE positions in lastGrowFired/lastGrowActivated are safe
    // — a fired grow is revealed to everyone).
    let _dmTiles = this.diceMatchTiles || null;
    let _dmAmounts = this.diceMatchGrownAmounts || null;
    let _dmEarly = this.diceMatchEarlyPickup != null ? this.diceMatchEarlyPickup : null;
    if (_fog) {
      if (_dmTiles) _dmTiles = _dmTiles.filter((pos) => _seen.has(pos));
      if (_dmAmounts) {
        const _f = {};
        for (const k of Object.keys(_dmAmounts)) {
          if (_seen.has(Number(k))) _f[k] = _dmAmounts[k];
        }
        _dmAmounts = _f;
      }
      if (_dmEarly != null && !_seen.has(_dmEarly)) _dmEarly = null;
    }

    // Other transient channels that carry tile POSITIONS must be fog-filtered
    // too, or they leak a hidden tile's location (the leave-shuffle covers).
    // Positions the viewer hasn't revealed are dropped.
    let _pendingShuffles = this.pendingTileShuffles || null;
    let _lastShuffle = this.lastTileShuffle || null;
    if (_fog) {
      if (Array.isArray(_pendingShuffles)) {
        _pendingShuffles = _pendingShuffles.map((s) => ({
          ...s,
          positions: (s.positions || []).filter((p) => _seen.has(p)),
        }));
      }
      if (_lastShuffle && Array.isArray(_lastShuffle.positions)) {
        _lastShuffle = {
          ..._lastShuffle,
          positions: _lastShuffle.positions.filter((p) => _seen.has(p)),
        };
      }
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
      // Redacted for a viewer who hasn't revealed this tile: emit a neutral
      // "hidden" entry (the frontend already renders type==="hidden" as a fog
      // cover, reading only the index). Leaks no name/group/price/type/yield.
      if (_hidden(i)) return { id: i, type: "hidden" };
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
        // Prefer the live properties-map price over the board's hardcoded
        // default. The Super Banana's board price is a stale 1600, while
        // _initProperties stamps the configurable superBananaPrice into the
        // properties map (farms/desert are identical in both, so this only
        // corrects the SB). Keeps boardLayout in sync with the real buy check
        // in _processLanding (player.money >= sbProp.price).
        const liveProp = this.properties.get(i);
        entry.price =
          liveProp && liveProp.price != null
            ? liveProp.price
            : space.buyable.price;
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

    // Redact each player ONCE and reuse for both `players` and `currentPlayer`,
    // so currentPlayer can never leak more than a redacted players[] entry
    // (previously currentPlayer was the RAW player object, exposing clientId, the
    // cancel state, and their raw revealedTiles). Other players' revealedTiles
    // are NOT shipped — the frontend only reads the viewer's own
    // `me.revealedTiles`, and sending everyone's was a fog back-channel that
    // could leak a relocated hidden Super Banana's position.
    const _redactedPlayers = this.players.map((p) => {
      const isViewer = p.id === viewerId;
      // Total banana YIELD of every farm this player owns across the WHOLE map
      // (sum of each owned farm's yield = prop.price). Computed from the
      // authoritative property map, so it is the TRUE total regardless of fog,
      // and shipped for EVERY player (not redacted) so anyone can see each
      // player's map-wide yield at all times.
      const totalYield = (Array.isArray(p.properties) ? p.properties : []).reduce(
        (sum, tileId) => {
          const prop = this.properties.get(tileId);
          return sum + (prop && prop.group === "farm" ? prop.price || 0 : 0);
        },
        0,
      );
      return {
        ...p,
        revealedTiles: isViewer ? [...p.revealedTiles] : [],
        // clientId is a private reconnect token — never broadcast it.
        clientId: undefined,
        // Map-wide farm-yield total (see computation above) — PUBLIC to all viewers.
        totalYield,
        // Cumulative bananas spent (auction wins) — PUBLIC to all viewers.
        // Already carried by ...p, but defaulted here so a pre-field player
        // object never ships undefined.
        totalSpent: p.totalSpent || 0,
        // CREDIT SCORE — PUBLIC: everyone sees everyone's credit (the UI draws
        // it as blank tokens). Integer, floor 0, no cap.
        credit: p.credit || 0,
      };
    });
    const _cur = this.getCurrentPlayer();

    return {
      gameId: this.gameId,
      state: this.state,
      admin: this.admin,
      isPublic: this.isPublic,
      maxPlayers: this.maxPlayers,
      startingMoney: this.startingMoney,
      // Credit Score lobby knob — like startingMoney; every player starts a
      // game with this many credits.
      creditStart: this.creditStart,
      noAuctionTimer: this.noAuctionTimer,
      // The RICH threshold: the SB landing win, the within-12 auto-win, and the
      // rich-cross +1 credit all key off money >= this price.
      superBananaPrice: this.superBananaPrice,
      farmAuctionTimer: this.farmAuctionTimer,
      dodecahedron: this.dodecahedron,
      d12OwnerId: this.d12OwnerId,
      diceIsD12: this.diceIsD12,
      lastHexResult: this.lastHexResult,
      turn: this.turn,
      currentPlayer: _cur
        ? _redactedPlayers.find((rp) => rp.id === _cur.id) || null
        : null,
      players: _redactedPlayers,
      // THE CUP (liar's dice redaction): a cup-tier roll's dice are visible ONLY
      // to the roller. Every other viewer gets dice: [] + diceHidden: true — no
      // field anywhere leaks the total. The redaction PERSISTS after resolution
      // (an unaccused roll stays under the cup forever); an accusation flips
      // diceHidden off for everyone (see _resolveAccuse). Public-tier rolls ship
      // normally to all.
      dice: this.diceHidden && this.diceOwnerId !== viewerId ? [] : this.dice,
      diceHidden: !!(this.diceHidden && this.diceOwnerId !== viewerId),
      diceRolled: this.diceRolled,
      // The claim/accuse window. turnPhase: "claiming" (roller picking steps) →
      // "accusing" (walk done, opponents voting) → "resolved"/null. The
      // pendingAction ships its roll fields ONLY to the roller (or to everyone
      // when the roll is public-tier); the claim itself is public once made.
      // cupPublic is PUBLIC so viewers know whether to draw a cup. The accuse
      // window ships each viewer ONLY their own vote.
      turnPhase: this.turnPhase || null,
      pendingAction: this.pendingAction
        ? (this.pendingAction.playerId === viewerId ||
           this.pendingAction.cupPublic
            ? { ...this.pendingAction }
            : {
                playerId: this.pendingAction.playerId,
                turn: this.pendingAction.turn,
                // NOT a cup leak: the die TYPE is public-derivable anyway (the
                // hexed player — d12OwnerId — always rolls the d12). Only the
                // VALUES (rolledDice/rolledTotal) are stripped below.
                rolledIsD12: this.pendingAction.rolledIsD12,
                cupPublic: !!this.pendingAction.cupPublic,
                claim: this.pendingAction.claim,
                mode: this.pendingAction.mode || null,
                committed: !!this.pendingAction.committed,
                claimStartTime: this.pendingAction.claimStartTime || null,
                claimDeadline: this.pendingAction.claimDeadline || null,
              })
        : null,
      accuse: this.accuse
        ? {
            turn: this.accuse.turn,
            respondDeadline: this.accuse.respondDeadline || null,
            respondStartTime: this.accuse.respondStartTime || null,
            myVote: this.accuse.votes[viewerId] || null,
            answeredCount: Object.values(this.accuse.votes).filter((v) => v.answered).length,
            total: Object.keys(this.accuse.votes).length,
          }
        : null,
      // PUBLIC move record — {playerId, steps, mode, turn}; the frontend cup
      // label + walk + pile animations key off this, never off the hidden dice.
      lastMove: this.lastMove || null,
      // PUBLIC accusation reveal — set ONLY when at least one player accused
      // (an unaccused roll's actualTotal is never shipped, ever).
      lastAccuseResult: this.lastAccuseResult || null,
      properties,
      boardLayout,
      boardComposition,
      genuineRevealedGrows,
      auction: this.auction
        ? (() => {
            const a = this.auction;
            const isAcceptor = !!(
              a.acceptorIds && a.acceptorIds.includes(viewerId)
            );
            // A viewer always sees their OWN accept/reject + top-up. In 2v2 a
            // viewer ALSO sees their TEAMMATE's accept/reject (but never their
            // teammate's secret silent-bid top-up). Everyone else's status is
            // withheld during the live phases.
            const myTeam =
              a.teamFlow && this.teams && this.getTeamOf(viewerId);
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
              } else if (myTeam && this.getTeamOf(id) === myTeam) {
                // Teammate visibility: accept/reject only (no top-up).
                entry.responded = !!b.responded;
                entry.accepted = b.accepted ?? null;
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
                a.phase === "silentbid" ||
                a.teamFlow) &&
              viewerId !== a.landingPlayer
            ) {
              const isTeamMate =
                this._isTeams() &&
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
              phase: a.phase,
              sealedBid: !!a.sealedBid,
              // Buy Now price for the richest lander (null for everyone else).
              buyNowPrice: this._buyNowPrice(viewerId),
              landingPlayer: a.landingPlayer,
              landerOpenBid: a.landerOpenBid ?? null,
              respondDeadline: a.respondDeadline || null,
              respondStartTime: a.respondStartTime || null,
              respondOpenedAt: a.respondOpenedAt || null,
              silentDeadline: a.silentDeadline || null,
              silentStartTime: a.silentStartTime || null,
              iAmAcceptor: isAcceptor,
              // --- team sequential-auction fields (null/false in classic) ---
              teamFlow: !!a.teamFlow,
              teammateIds: a.teammateIds || null,
              oppIds: a.oppIds || null,
              affOppIds: a.affOppIds || null,
              affMateIds: a.affMateIds || null,
              brokeLander: !!a.brokeLander,
              stepDeadline: a.stepDeadline || null,
              stepStartTime: a.stepStartTime || null,
              bids,
            };
          })()
        : null,
      lastResolvedAuction: this.lastResolvedAuction || null,
      autoEndDelay: this.autoEndDelay || false,
      autoEndDelayMs: this.autoEndDelayMs || 0,
      itemMoveThisTurn: this.itemMoveThisTurn || false,
      revealAccepted: this.revealAccepted ? [...this.revealAccepted] : [],
      log: this.log.slice(-20),
      gameMode: this.gameMode,
      teams: this.teams,
      teamCoinFlip: this.teamCoinFlip || null,
      lastStandingWinner: this.lastStandingWinner || null,
      diceMatchTiles: _dmTiles,
      diceMatchGrownAmounts: _dmAmounts,
      diceMatchEarlyPickup: _dmEarly,
      lastGrowFired: this.lastGrowFired || null,
      lastGrowActivated: this.lastGrowActivated || null,
      // Broke-cross +N floater marker — shipped ONLY to viewers who can see the
      // Super Banana tile (else it would leak the fogged SB's position).
      lastSuperBananaCross:
        this.lastSuperBananaCross && !_hidden(this.lastSuperBananaCross.pos)
          ? this.lastSuperBananaCross
          : null,
      lastStartPick: this.lastStartPick || null,
      lastTileSwap: this.lastTileSwap || null,
      pendingTileShuffles: Array.isArray(_pendingShuffles)
        ? _pendingShuffles.map((p) => ({
            color: p.color,
            leavingName: p.leavingName,
            positions: [...p.positions],
            endsAt: p.endsAt,
          }))
        : null,
      lastTileShuffle: _lastShuffle,
      superBananaWin: this.superBananaWin || null,
      lobbyReady: this._lobbyReady ? [...this._lobbyReady] : [],
    };
  }

}

module.exports = { MonkeyBusinessGame, BOARD };

