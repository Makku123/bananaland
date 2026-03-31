// ——— Board Data & Rendering (MEGA EDITION — 52 spaces) ————————————

const BOARD_SIZE = 52;

const SPACE_DATA = {
  // Cavendish (12)
  1: { name: "Mediterranean", group: "yellow", price: 50 },
  3: { name: "Baltic Ave", group: "yellow", price: 50 },
  4: { name: "Vine Street", group: "yellow", price: 50 },
  5: { name: "CV12", group: "yellow", price: 50 },
  15: { name: "Lady Finger Ln", group: "yellow", price: 50 },
  35: { name: "Banana Bend", group: "yellow", price: 50 },
  47: { name: "Monkey Trail", group: "yellow", price: 50 },
  // Blue Java (7)
  6: { name: "Reading Ave", group: "lightblue", price: 100 },
  7: { name: "Oriental Ave", group: "lightblue", price: 100 },
  9: { name: "Vermont Ave", group: "lightblue", price: 100 },
  10: { name: "Connecticut", group: "lightblue", price: 100 },
  11: { name: "Belmont Ave", group: "lightblue", price: 100 },
  19: { name: "Penn. Ave", group: "lightblue", price: 100 },
  32: { name: "B&O Ave", group: "lightblue", price: 100 },
  // Red Dacca (5)
  14: { name: "St. Charles", group: "red", price: 200 },
  16: { name: "States Ave", group: "red", price: 200 },
  17: { name: "Virginia Ave", group: "red", price: 200 },
  18: { name: "Festival Ave", group: "red", price: 200 },
  // Lady Finger (5)
  20: { name: "St. James", group: "pink", price: 200 },
  22: { name: "Tennessee", group: "pink", price: 200 },
  23: { name: "New York Ave", group: "pink", price: 200 },
  24: { name: "Riverside Dr", group: "pink", price: 200 },
  27: { name: "Kentucky Ave", group: "yellow", price: 50 },
  29: { name: "Indiana Ave", group: "yellow", price: 50 },
  30: { name: "Illinois Ave", group: "yellow", price: 50 },
  31: { name: "Sunset Strip", group: "yellow", price: 50 },
  // Gros Michel (4)
  33: { name: "Atlantic Ave", group: "darkblue", price: 360 },
  34: { name: "Ventnor Ave", group: "darkblue", price: 360 },
  36: { name: "Marvin Gdns", group: "darkblue", price: 360 },
  37: { name: "Lakeshore Dr", group: "darkblue", price: 360 },
  // Red Dacca (5th)
  40: { name: "Red Dacca Ln", group: "red", price: 200 },
  // Lady Finger (5th)
  41: { name: "Cavendish Dr", group: "pink", price: 200 },
  // Goldfinger (3)
  48: { name: "Park Place", group: "orange", price: 500 },
  49: { name: "Fifth Avenue", group: "orange", price: 500 },
  51: { name: "Boardwalk", group: "orange", price: 500 },
};

const SPECIAL_SPACES = {
  // Corners
  0: { name: "GROW\n100%", type: "corner" },
  13: { name: "GROW\n25%", type: "corner" },
  26: { name: "GROW\n50%", type: "corner" },
  39: { name: "GROW\n75%", type: "corner" },
  // Community Chest
  2: { name: "\ud83c\udf4c\n-10%", type: "tax10" },
  21: { name: "\u2b50", type: "special" },
  42: { name: "+500", type: "freebananas" },
  // Desert
  8: { name: "\ud83c\udf35", type: "desert" },
  28: { name: "\ud83c\udf35", type: "desert" },
  46: { name: "\ud83c\udf35", type: "desert" },
  // Mega specials
  12: { name: "\ud83c\udf35", type: "desert" },
  25: { name: "Vine", fullName: "Vine Swing", type: "bus" },
  38: { name: "\ud83c\udf35", type: "desert" },
  43: { name: "\ud83c\udf35", type: "desert" },
  44: { name: "\ud83c\udf35", type: "desert" },
  45: { name: "\ud83c\udf35", type: "desert" },
  50: { name: "\ud83c\udf35", type: "desert" },
};

// ——— Layout calculation (52 spaces, 14×14 grid) ———————————————————

function spaceRect(i) {
  const C = 100 / 14; // all tiles same size (square)
  const S = C; // side tiles same as corner

  // Corners: 0=bottom-right, 13=bottom-left, 26=top-left, 39=top-right
  if (i === 0) return { l: 100 - C, t: 100 - C, w: C, h: C };
  if (i === 13) return { l: 0, t: 100 - C, w: C, h: C };
  if (i === 26) return { l: 0, t: 0, w: C, h: C };
  if (i === 39) return { l: 100 - C, t: 0, w: C, h: C };

  // Bottom row (1–12): right to left
  if (i >= 1 && i <= 12) {
    const idx = 11 - (i - 1);
    return { l: C + idx * S, t: 100 - C, w: S, h: C, side: "bottom" };
  }
  // Left column (14–25): bottom to top
  if (i >= 14 && i <= 25) {
    const idx = 11 - (i - 14);
    return { l: 0, t: C + idx * S, w: C, h: S, side: "left" };
  }
  // Top row (27–38): left to right
  if (i >= 27 && i <= 38) {
    const idx = i - 27;
    return { l: C + idx * S, t: 0, w: S, h: C, side: "top" };
  }
  // Right column (40–51): top to bottom
  if (i >= 40 && i <= 51) {
    const idx = i - 40;
    return { l: 100 - C, t: C + idx * S, w: C, h: S, side: "right" };
  }
  return { l: 0, t: 0, w: 0, h: 0 };
}

// ——— Free Bananas popup tracking ——————————————————————————————————
let _prevFreeBananasTiles = new Set(); // positions where freebananas is known
let _freeBananasShown = new Set(); // positions already shown this walk
window._freeBananasShown = _freeBananasShown;

// ——— Banana pile tracking for collection animation ————————————————
let _prevBananaPiles = {}; // { tileIndex: amount }
let _stealShown = new Set(); // tile indices where "Steal!" floater already fired this turn
let _collectShown = new Set(); // tile indices where collect floater/popup already fired this turn
let _wasTokenWalking = false; // tracks previous walk state to detect walk-start transitions

// ——— Dice-match grow: track which tile set has already been animated ——

// ——— Chain multiplier cache ——————————————————————————————————————————
let _chainCache = null;     // { multipliers: {pos: mult}, key: string }

// ——— Reset all between-game animation state (call when returning to lobby) ———
function resetBoardAnimationState() {
  _prevBananaPiles = {};
  _stealShown = new Set();
  _collectShown = new Set();
  _wasTokenWalking = false;
  _prevFreeBananasTiles = new Set();
  _freeBananasShown = new Set();
  _chainCache = null;
}

// ——— Shared helper: show a floating popup at the "Your Bananas" box ——
function showPopupAtBananaBox(text, cssClass) {
  const moneyEl = document.getElementById("info-money");
  if (!moneyEl) return;
  const rect = moneyEl.getBoundingClientRect();
  const floater = document.createElement("div");
  floater.className = cssClass;
  floater.textContent = text;
  floater.style.position = "fixed";
  floater.style.left = rect.left + rect.width / 2 + "px";
  floater.style.top = rect.top + "px";
  floater.style.pointerEvents = "none";
  floater.style.zIndex = "1000";
  document.body.appendChild(floater);
  floater.addEventListener("animationend", () => floater.remove());
}

// ——— Persistent token elements for smooth animation ———————————————
const _tokenElements = {}; // { playerId: HTMLElement }

// ——— Event delegation for board tile clicks ——————————————————————
let _boardDelegationSetup = false;
function _setupBoardDelegation() {
  if (_boardDelegationSetup) return;
  const board = document.getElementById("board");
  if (!board) return;
  _boardDelegationSetup = true;
  board.addEventListener("click", (e) => {
    const tile = e.target.closest(".space[data-tile]");
    if (!tile) return;
    const i = parseInt(tile.dataset.tile, 10);
    if (isNaN(i)) return;
    const gs = window._gs;
    if (!gs) return;
    // Vine swing mode
    if (gs.vineSwing && gs.vineSwing === myId && !window._tokenWalking) {
      if (tile.classList.contains("space-pickable")) {
        if (socket && gameId)
          socket.emit("vine_swing_move", { gameId, position: i });
        return;
      }
    }
    // Bomb placement mode
    if (window._bombPlacementMode && tile.classList.contains("bomb-target")) {
      if (socket && gameId) {
        socket.emit("place_bomb", { gameId, position: i });
        closeBombPlacement();
      }
      return;
    }
    // Sell mode
    if (tile.classList.contains("trade-clickable")) {
      handleSellTileClick(i);
      return;
    }
  });
}

// ——— Lightweight walk-step update (skips full tile rebuild) ————————
// Only updates token positions and banana pile collection visuals.
// Call this instead of renderBoard() for intermediate walk steps.
function walkStepUpdate(gs) {
  window._gs = gs;
  const board = document.getElementById("board");
  if (!board) return;

  const _propById = {};
  if (gs && gs.properties) {
    for (const p of gs.properties) _propById[p.id] = p;
  }
  const _playerById = {};
  if (gs && gs.players) {
    for (const p of gs.players) _playerById[p.id] = p;
  }

  // Recalculate banana piles with frozen/visited logic
  const _bananaPiles = [];
  if (gs && gs.properties) {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const prop = _propById[i];
      let pileAmount = prop ? prop.bananaPile : 0;
      if (window._frozenBananaPiles) {
        const frozenVal = window._frozenBananaPiles[i] || 0;
        const isDiceMatchTile =
          window._diceMatchUnfrozen &&
          gs.diceMatchTiles &&
          gs.diceMatchTiles.includes(i);
        if (window._tokenVisitedTiles && window._tokenVisitedTiles.has(i)) {
          const isOwn = prop && prop.owner === window._walkingPlayerId;
          const isLanding = i === window._walkingLandingPos;
          if (isOwn || isLanding) {
            pileAmount = 0;
          } else {
            pileAmount = frozenVal;
          }
        } else if (isDiceMatchTile) {
          const grownAmount = gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[i] || 0;
          pileAmount = frozenVal + grownAmount;
        } else {
          pileAmount = frozenVal;
        }
      }
      if (pileAmount > 0) {
        const owner = prop && prop.owner ? _playerById[prop.owner] : null;
        _bananaPiles.push({
          tileIndex: i,
          amount: pileAmount,
          ownerColor: owner ? owner.color : null,
        });
      }
      // Update has-banana-pile class on existing tile element
      const tileEl = document.getElementById("space-" + i);
      if (tileEl) {
        if (pileAmount > 0) {
          tileEl.classList.add("has-banana-pile");
        } else {
          tileEl.classList.remove("has-banana-pile");
        }
      }
    }
  }

  // Remove old banana pile elements and re-render
  board.querySelectorAll(".banana-pile").forEach((el) => el.remove());
  for (const pile of _bananaPiles) {
    const r = spaceRect(pile.tileIndex);
    const pileEl = document.createElement("div");
    pileEl.className = "banana-pile";
    if (pile.ownerColor) pileEl.classList.add("pile-" + pile.ownerColor);
    pileEl.textContent = pile.amount + "\ud83c\udf4c";
    if (r.side === "bottom") {
      pileEl.style.left = r.l + r.w / 2 + "%";
      pileEl.style.top = r.t - 0.3 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-50%, -100%)");
    } else if (r.side === "top") {
      pileEl.style.left = r.l + r.w / 2 + "%";
      pileEl.style.top = r.t + r.h + 0.3 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-50%, 0)");
    } else if (r.side === "left") {
      pileEl.style.left = r.l + r.w + 0.3 + "%";
      pileEl.style.top = r.t + r.h / 2 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(0, -50%)");
    } else if (r.side === "right") {
      pileEl.style.left = r.l - 0.3 + "%";
      pileEl.style.top = r.t + r.h / 2 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-100%, -50%)");
    } else {
      const cx = r.l + r.w / 2;
      const cy = r.t + r.h / 2;
      pileEl.style.left = (cx < 50 ? r.l + r.w + 0.3 : r.l - 0.3) + "%";
      pileEl.style.top = (cy < 50 ? r.t + r.h + 0.3 : r.t - 0.3) + "%";
      pileEl.style.setProperty(
        "--pile-transform",
        (cx < 50 ? "translateX(0)" : "translateX(-100%)") +
          " " +
          (cy < 50 ? "translateY(0)" : "translateY(-100%)"),
      );
    }
    board.appendChild(pileEl);
  }

  // Detect collected piles and show floating animation (once per tile per turn)
  // Delay burst by 150ms so the token CSS transition finishes before the explosion
  const currentPiles = {};
  for (const pile of _bananaPiles) {
    currentPiles[pile.tileIndex] = pile.amount;
  }
  for (const [idx, oldAmount] of Object.entries(_prevBananaPiles)) {
    const newAmount = currentPiles[idx] || 0;
    if (oldAmount > 0 && newAmount < oldAmount && !_collectShown.has(Number(idx))) {
      _collectShown.add(Number(idx));
      const collected = oldAmount - newAmount;
      const r = spaceRect(Number(idx));
      const collectorId = gs.currentPlayer && gs.currentPlayer.id;
      // Flying banana burst for pile collection — delayed to sync with token arrival
      const stolenProp = _propById[Number(idx)];
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !gs.vineSwing && !window._vineSwingJustLanded && !_stealShown.has(Number(idx));
      if (isSteal) _stealShown.add(Number(idx));
      const fireBurst = () => {
        bananaBurst(collected, collectorId);
        // Show floater near the collector's account score
        const _isMe = typeof myId !== "undefined" && collectorId === myId;
        if (_isMe) {
          showPopupAtBananaBox("+" + collected + "\uD83C\uDF4C", "free-bananas-popup-player");
        } else if (collectorId) {
          const _pstat = document.querySelector(`.pstat[data-player-id="${collectorId}"]`);
          const _anchor = _pstat && _pstat.querySelector(".pstat-money");
          if (_anchor) {
            const _aRect = _anchor.getBoundingClientRect();
            const _floater = document.createElement("div");
            _floater.className = "free-bananas-popup-player";
            _floater.textContent = "+" + collected + "\uD83C\uDF4C";
            _floater.style.position = "fixed";
            _floater.style.left = _aRect.left + _aRect.width / 2 + "px";
            _floater.style.top = _aRect.top + "px";
            _floater.style.pointerEvents = "none";
            _floater.style.zIndex = "1000";
            document.body.appendChild(_floater);
            _floater.addEventListener("animationend", () => _floater.remove());
          }
        }
        if (isSteal) {
          const stealFloater = document.createElement("div");
          stealFloater.className = "steal-floater";
          stealFloater.textContent = "Steal!";
          const boardRect = board.getBoundingClientRect();
          stealFloater.style.position = "fixed";
          stealFloater.style.left = boardRect.left + (r.l + r.w / 2) / 100 * boardRect.width + "px";
          stealFloater.style.top = boardRect.top + (r.t + r.h / 2) / 100 * boardRect.height + "px";
          stealFloater.style.zIndex = "9999";
          document.body.appendChild(stealFloater);
          setTimeout(() => stealFloater.remove(), 2200);
        }
      };
      setTimeout(fireBurst, 150);
      window._walkPileCollected = (window._walkPileCollected || 0) + collected;
      // Sync pstat-pile counter: subtract collected amount from frozen total
      if (window._frozenPileTotals && collectorId) {
        window._frozenPileTotals[collectorId] = Math.max(0,
          (window._frozenPileTotals[collectorId] || 0) - collected);
        const pileEl = document.querySelector(`.pstat[data-player-id="${collectorId}"] .pstat-pile`);
        if (pileEl) {
          const remaining = window._frozenPileTotals[collectorId];
          pileEl.textContent = remaining > 0 ? remaining + "\uD83C\uDF4C" : "";
        }
      }
    }
  }
  _prevBananaPiles = currentPiles;
  window._vineSwingJustLanded = false;

  // Free Bananas pass-through detection
  const layout = gs && gs.boardLayout;
  const me = gs && gs.players && gs.players.find((p) => p.id === myId);
  const myRevealed = me && me.revealedTiles ? new Set(me.revealedTiles) : null;
  if (layout && window._diceRollingPositions) {
    const currentFB = new Set();
    layout.forEach((tile, idx) => {
      if (tile.type === "freebananas") currentFB.add(idx);
    });
    for (const [playerId, pos] of Object.entries(window._diceRollingPositions)) {
      const isStartPos =
        window._walkStartPositions &&
        window._walkStartPositions[playerId] === pos;
      if (isStartPos) continue;
      const tileRevealed = !myRevealed || myRevealed.has(pos);
      if (currentFB.has(pos) && !_freeBananasShown.has(pos) && tileRevealed) {
        _freeBananasShown.add(pos);
        const isMe = typeof myId !== "undefined" && playerId === myId;
        if (isMe) {
          showPopupAtBananaBox("+500\uD83C\uDF4C", "free-bananas-popup-player");
        } else {
          const pstat = document.querySelector(`.pstat[data-player-id="${playerId}"]`);
          const anchor = pstat && pstat.querySelector(".pstat-money");
          if (anchor) {
            const rect = anchor.getBoundingClientRect();
            const floater = document.createElement("div");
            floater.className = "free-bananas-popup-player";
            floater.textContent = "+500\uD83C\uDF4C";
            floater.style.position = "fixed";
            floater.style.left = rect.left + rect.width / 2 + "px";
            floater.style.top = rect.top + "px";
            floater.style.pointerEvents = "none";
            floater.style.zIndex = "1000";
            document.body.appendChild(floater);
            floater.addEventListener("animationend", () => floater.remove());
          }
        }
      }
    }
  }

  // Update token positions (reuse persistent token layer)
  let tokenLayer = document.getElementById("token-layer");
  if (!tokenLayer) return;
  const activePlayerIds = new Set();
  if (gs && gs.players) {
    const frozenPos = window._diceRollingPositions || null;
    const posMap = {};
    gs.players.forEach((p) => {
      if (p.bankrupt) return;
      const pos =
        frozenPos && frozenPos[p.id] != null ? frozenPos[p.id] : p.position;
      if (!posMap[pos]) posMap[pos] = [];
      posMap[pos].push({ ...p, _renderPos: pos });
    });
    for (const pos in posMap) {
      const players = posMap[pos];
      const r = spaceRect(Number(pos));
      const cx = r.l + r.w / 2;
      const cy = r.t + r.h / 2;
      players.forEach((p, idx) => {
        activePlayerIds.add(p.id);
        let tok = _tokenElements[p.id];
        if (!tok) {
          tok = document.createElement("div");
          tok.textContent = "\ud83d\udc35";
          _tokenElements[p.id] = tok;
        }
        tok.className = "token c-" + p.color;
        if (p.id === myId) tok.classList.add("token-me");
        if (gs.currentPlayer && gs.currentPlayer.id === p.id)
          tok.classList.add("token-active");
        const offsetX = (idx % 2) * 3 - 1.5;
        const offsetY = Math.floor(idx / 2) * 3 - 1.5;
        const half = p.id === myId ? 18 : 14;
        tok.style.left = `calc(${cx + offsetX}% - ${half}px)`;
        tok.style.top = `calc(${cy + offsetY}% - ${half}px)`;
        if (!tok.parentNode) tokenLayer.appendChild(tok);
      });
    }
  }
  for (const id in _tokenElements) {
    if (!activePlayerIds.has(id)) {
      if (_tokenElements[id].parentNode) _tokenElements[id].remove();
      delete _tokenElements[id];
    }
  }
}

// ——— Render Board ——————————————————————————————————————————————————

function renderBoard(gs) {
  window._gs = gs;
  const board = document.getElementById("board");
  _setupBoardDelegation();
  // Preserve overlays across re-renders
  const chat = document.getElementById("board-chat");
  const chatToggle = document.getElementById("board-chat-toggle");
  const logPanel = document.getElementById("board-log");
  const logToggle = document.getElementById("board-log-toggle");
  const tradeDealsPanel = document.getElementById("board-trade-deals");
  const tradeDealsToggle = document.getElementById("board-trade-deals-toggle");
  const pokerTable = document.getElementById("poker-table");
  const auctionBox = document.getElementById("auction-box");
  if (chat) chat.remove();
  if (chatToggle) chatToggle.remove();
  if (logPanel) logPanel.remove();
  if (logToggle) logToggle.remove();
  if (tradeDealsPanel) tradeDealsPanel.remove();
  if (tradeDealsToggle) tradeDealsToggle.remove();
  if (pokerTable) pokerTable.remove();
  if (auctionBox) auctionBox.remove();
  // Detach persistent token layer before clearing
  let tokenLayer = document.getElementById("token-layer");
  if (tokenLayer) tokenLayer.remove();
  // Floaters (steal, collect) are NOT preserved across re-renders — re-appending
  // restarts CSS animations causing visible flashing. Instead, dedup sets
  // (_collectShown, _stealShown) prevent re-creation, and popups on document.body
  // (pile-collect-popup-player) naturally survive re-renders.
  board.innerHTML = "";
  // Create token layer if first render
  if (!tokenLayer) {
    tokenLayer = document.createElement("div");
    tokenLayer.id = "token-layer";
  }
  if (chatToggle) board.appendChild(chatToggle);
  if (chat) board.appendChild(chat);
  if (logToggle) board.appendChild(logToggle);
  if (logPanel) board.appendChild(logPanel);
  if (tradeDealsToggle) board.appendChild(tradeDealsToggle);
  if (tradeDealsPanel) board.appendChild(tradeDealsPanel);
  if (pokerTable) board.appendChild(pokerTable);
  if (auctionBox) board.appendChild(auctionBox);

  // Use server's board layout if available, otherwise fall back to static data
  const layout = gs && gs.boardLayout;

  const _bananaPiles = [];

  // Build fast lookup maps for properties and players (avoids O(n) .find() per tile)
  const _propById = {};  // { tileIndex: property }
  if (gs && gs.properties) {
    for (const p of gs.properties) _propById[p.id] = p;
  }
  const _playerById = {};  // { playerId: player }
  if (gs && gs.players) {
    for (const p of gs.players) _playerById[p.id] = p;
  }

  // Build set of tiles revealed by the current player (fog of war)
  // If dice are rolling, use pre-roll revealed tiles to avoid spoiling the destination
  let myRevealed = null;
  if (window._diceRollingRevealed) {
    myRevealed = window._diceRollingRevealed;
  } else if (gs && gs.players && typeof myId !== "undefined") {
    const me = _playerById[myId];
    if (me && me.revealedTiles) {
      myRevealed = new Set(me.revealedTiles);
    }
  }

  // Compute chain multipliers (cached — only recompute when ownership changes)
  // Build a key from owned tile positions to detect changes
  let _chainMultipliers;
  if (gs && gs.properties) {
    let chainKey = "";
    for (const prop of gs.properties) {
      if (prop.owner) chainKey += prop.id + ":" + prop.owner + ",";
    }
    if (_chainCache && _chainCache.key === chainKey) {
      _chainMultipliers = _chainCache.multipliers;
    } else {
      _chainMultipliers = {};
      const ownerPositions = {};
      for (const prop of gs.properties) {
        if (prop.owner && prop.group && prop.group !== "desert" && prop.group !== "mushroom") {
          if (!ownerPositions[prop.owner]) ownerPositions[prop.owner] = [];
          ownerPositions[prop.owner].push(prop);
        }
      }
      const CORNERS_SET = [0, 13, 26, 39];
      for (const ownerId of Object.keys(ownerPositions)) {
        const props = ownerPositions[ownerId];
        const posSet = new Set(props.map((p) => p.id));
        const visited = new Set();
        for (const prop of props) {
          if (visited.has(prop.id)) continue;
          const chain = [];
          const queue = [prop.id];
          visited.add(prop.id);
          while (queue.length > 0) {
            const cur = queue.shift();
            chain.push(cur);
            const prev = (cur - 1 + 52) % 52;
            const next = (cur + 1) % 52;
            for (const n of [prev, next]) {
              if (visited.has(n) || !posSet.has(n) || CORNERS_SET.includes(n)) continue;
              const nProp = _propById[n];
              if (!nProp || nProp.group !== prop.group) continue;
              visited.add(n);
              queue.push(n);
            }
          }
          for (const c of chain) _chainMultipliers[c] = chain.length;
        }
      }
      _chainCache = { multipliers: _chainMultipliers, key: chainKey };
    }
  } else {
    _chainMultipliers = {};
  }

  for (let i = 0; i < BOARD_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "space";
    el.id = "space-" + i;
    el.dataset.tile = i;

    const r = spaceRect(i);
    el.style.left = r.l + "%";
    el.style.top = r.t + "%";
    el.style.width = r.w + "%";
    el.style.height = r.h + "%";

    if (r.side) el.classList.add("side-" + r.side);

    // Fog of war: hide unrevealed non-corner tiles
    const isCornerPos = i === 0 || i === 13 || i === 26 || i === 39;
    const tileType = layout ? layout[i].type : null;
    const isRevealed =
      tileType !== "hidden" &&
      (isCornerPos ||
        !myRevealed ||
        myRevealed.has(i) ||
        (typeof revealAll !== "undefined" && revealAll));

    if (!isRevealed) {
      el.classList.add("space-hidden");
      el.innerHTML = `<span class="sname">${i}</span>`;
      // Vine Swing: hidden tiles are also clickable (only own properties)
      if (gs && gs.vineSwing && gs.vineSwing === myId && !isCornerPos && !window._tokenWalking) {
        const ownsProp = _propById[i] && _propById[i].owner === myId;
        if (ownsProp) {
          el.classList.add("space-pickable");
        }
      }
      // Bomb placement mode: make hidden non-corner tiles clickable
      if (window._bombPlacementMode && !isCornerPos) {
        el.classList.add("space-pickable", "bomb-target");
      }
      // Sell mode: make hidden owned tiles clickable too
      if (
        typeof isSellMode === "function" &&
        isSellMode() &&
        window._sellState &&
        !isCornerPos
      ) {
        const sState = window._sellState;
        const tProp = _propById[i];
        if (tProp && tProp.owner === myId) {
          el.classList.add("trade-clickable");
          el.classList.add("trade-clickable-mine");
          if (sState.selectedTile === i) {
            el.classList.add("trade-selected");
            el.classList.add("trade-selected-mine");
          }
        }
      }
      board.appendChild(el);
      continue;
    }

    if (layout) {
      // Use the dynamic board layout from the server
      const tile = layout[i];
      const isCorner = tile.type === "grow";

      if (isCorner) {
        el.classList.add("corner");
        el.textContent = tile.name;
      } else if (tile.tileName) {
        // Buyable tile (property, railroad, utility)
        const label = tile.tileLabel || tile.tileName;
        if (tile.group === "desert") {
          el.classList.add("type-desert");
          el.innerHTML = `<span class="sname desert-icon">${tile.tileName}</span>`;
        } else if (tile.group === "mushroom") {
          el.classList.add("g-mushroom");
          el.innerHTML =
            `<span class="sname"><svg class="rainbow-banana" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
            `<defs><linearGradient id="rb${i}" x1="0.2" y1="0" x2="0.8" y2="1">` +
            `<stop offset="0%" stop-color="#ff3333"/>` +
            `<stop offset="20%" stop-color="#ff9933"/>` +
            `<stop offset="40%" stop-color="#ffee33"/>` +
            `<stop offset="60%" stop-color="#33dd55"/>` +
            `<stop offset="80%" stop-color="#3399ff"/>` +
            `<stop offset="100%" stop-color="#cc44ff"/>` +
            `</linearGradient>` +
            `<linearGradient id="rb-hi${i}" x1="0" y1="0" x2="0.5" y2="1">` +
            `<stop offset="0%" stop-color="rgba(255,255,255,0.6)"/>` +
            `<stop offset="50%" stop-color="rgba(255,255,255,0)"/>` +
            `</linearGradient></defs>` +
            `<g transform="rotate(45,32,32) translate(64,0) scale(-1,1)">` +
            `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#rb${i})" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>` +
            `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#rb-hi${i})" stroke="none"/>` +
            `<path d="M36 10 C38 6 41 3 44 2 C46 1 47 3 46 5 C45 7 42 9 39 10Z" fill="#6a4520" stroke="#3d2510" stroke-width="0.8" stroke-linejoin="round"/>` +
            `<path d="M35 16 C33 20 30 28 27 36 C25 40 23 44 23 47" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round"/>` +
            `<path d="M37 14 C36 18 34 24 32 30" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-linecap="round"/>` +
            `</g></svg></span>` +
            `<span class="sprice">${tile.price}\ud83c\udf4c</span>`;
        } else {
          el.classList.add("g-" + (tile.group || "railroad"));
          // Show effective yield with chain multiplier
          const chainMult = _chainMultipliers[i] || 1;
          const effectiveYield = Math.round(tile.price * chainMult);
          const priceDisplay = `${effectiveYield}🍌`;
          const labelMatch = label.match(/^([A-Za-z]+)(\d+)$/);
          const labelHTML = labelMatch
            ? `${labelMatch[1]}<span class="sname-num">${labelMatch[2]}</span>`
            : label;
          el.innerHTML =
            `<span class="sname">${labelHTML}</span>` +
            `<span class="sprice">${priceDisplay}</span>`;
        }
      } else {
        // Non-buyable special tile (chest, chance, tax)
        el.classList.add("type-" + tile.type);
        const rawName = tile.name || tile.type;
        const displayName = rawName === "Vine Swing" ? "Vine" : rawName;
        el.innerHTML = `<span class="sname">${displayName}</span>`;
        if (displayName !== rawName) el.title = rawName;
      }
    } else {
      // Fallback: use static SPACE_DATA / SPECIAL_SPACES (pre-game)
      const special = SPECIAL_SPACES[i];
      const prop = SPACE_DATA[i];

      if (special && special.type === "corner") {
        el.classList.add("corner");
        el.textContent = special.name;
      } else if (prop) {
        el.classList.add("g-" + prop.group);
        el.innerHTML =
          `<span class="sname">${prop.name}</span>` +
          `<span class="sprice">$${prop.price}</span>`;
      } else if (special) {
        el.classList.add("type-" + special.type);
        el.innerHTML = `<span class="sname">${special.name}</span>`;
        if (special.fullName) el.title = special.fullName;
      }
    }

    // Vine Swing: make revealed owned tiles clickable
    if (gs && gs.vineSwing && gs.vineSwing === myId && !isCornerPos && !window._tokenWalking) {
      const ownsProp = _propById[i] && _propById[i].owner === myId;
      if (ownsProp) {
        el.classList.add("space-pickable");
      }
    }

    // Bomb placement mode: make non-corner tiles clickable
    if (window._bombPlacementMode && !isCornerPos) {
      el.classList.add("space-pickable", "bomb-target");
    }

    // Banana pile — collect for board-level rendering below
    if (gs && gs.properties) {
      const prop = _propById[i];
      // During dice animation, use frozen banana piles (remove only when token walks over)
      let pileAmount = prop ? prop.bananaPile : 0;
      if (window._frozenBananaPiles) {
        const frozenVal = window._frozenBananaPiles[i] || 0;
        const isDiceMatchTile =
          window._diceMatchUnfrozen &&
          gs.diceMatchTiles &&
          gs.diceMatchTiles.includes(i);
        if (window._tokenVisitedTiles && window._tokenVisitedTiles.has(i)) {
          // Token walked past this tile — collect visually (overrides dice-match display)
          const isOwn = prop && prop.owner === window._walkingPlayerId;
          const isLanding = i === window._walkingLandingPos;
          if (isOwn || isLanding) {
            pileAmount = 0;
          } else {
            pileAmount = frozenVal;
          }
        } else if (isDiceMatchTile) {
          // Show pre-roll pile + grown amount (pile may already be 0 if collected on path)
          const grownAmount = gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[i] || 0;
          pileAmount = frozenVal + grownAmount;
        } else {
          pileAmount = frozenVal; // use frozen amount (0 if tile had no pile)
        }
      }
      if (pileAmount > 0) {
        const owner = prop && prop.owner ? _playerById[prop.owner] : null;
        _bananaPiles.push({
          tileIndex: i,
          amount: pileAmount,
          ownerColor: owner ? owner.color : null,
        });
        el.classList.add("has-banana-pile");
      }
      // Ownership border
      if (prop && prop.owner) {
        const owner = _playerById[prop.owner];
        if (owner) el.classList.add("owned-" + owner.color);
      }
    }

    // Sell mode: make own tiles clickable and highlight selected tile
    if (typeof isSellMode === "function" && isSellMode() && window._sellState) {
      const sState = window._sellState;
      const tProp = _propById[i];
      if (tProp && tProp.owner === myId) {
        el.classList.add("trade-clickable");
        el.classList.add("trade-clickable-mine");
        if (sState.selectedTile === i) {
          el.classList.add("trade-selected");
          el.classList.add("trade-selected-mine");
        }
      }
    }

    board.appendChild(el);
  }

  const diceMatchSet = new Set(gs && gs.diceMatchTiles ? gs.diceMatchTiles : []);

  // Detect which piles grew since last render
  // _growUnfreezeRender: set when GROW corner unfreeze fires — treat all current piles as new
  const isGrowUnfreeze = !!window._growUnfreezeRender;
  window._growUnfreezeRender = false;
  const isDiceMatchSteal = !!window._diceMatchStealRender;
  window._diceMatchStealRender = false;
  const grewTiles = new Map(); // tileIndex -> delta
  for (const pile of _bananaPiles) {
    const prev = isGrowUnfreeze ? 0 : (_prevBananaPiles[pile.tileIndex] || 0);
    if (pile.amount > prev) {
      grewTiles.set(pile.tileIndex, pile.amount - prev);
    }
  }

  // Render banana pile indicators outside tiles, toward board interior
  for (const pile of _bananaPiles) {
    const r = spaceRect(pile.tileIndex);
    const pileEl = document.createElement("div");
    pileEl.className = "banana-pile";
    if (pile.ownerColor) pileEl.classList.add("pile-" + pile.ownerColor);
    pileEl.textContent = pile.amount + "\ud83c\udf4c";

    // Position toward board interior based on which side the tile is on
    if (r.side === "bottom") {
      pileEl.style.left = r.l + r.w / 2 + "%";
      pileEl.style.top = r.t - 0.3 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-50%, -100%)");
    } else if (r.side === "top") {
      pileEl.style.left = r.l + r.w / 2 + "%";
      pileEl.style.top = r.t + r.h + 0.3 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-50%, 0)");
    } else if (r.side === "left") {
      pileEl.style.left = r.l + r.w + 0.3 + "%";
      pileEl.style.top = r.t + r.h / 2 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(0, -50%)");
    } else if (r.side === "right") {
      pileEl.style.left = r.l - 0.3 + "%";
      pileEl.style.top = r.t + r.h / 2 + "%";
      pileEl.style.setProperty("--pile-transform", "translate(-100%, -50%)");
    } else {
      // Corner — place toward center
      const cx = r.l + r.w / 2;
      const cy = r.t + r.h / 2;
      pileEl.style.left = (cx < 50 ? r.l + r.w + 0.3 : r.l - 0.3) + "%";
      pileEl.style.top = (cy < 50 ? r.t + r.h + 0.3 : r.t - 0.3) + "%";
      pileEl.style.setProperty(
        "--pile-transform",
        (cx < 50 ? "translateX(0)" : "translateX(-100%)") +
          " " +
          (cy < 50 ? "translateY(0)" : "translateY(-100%)"),
      );
    }

    // Pile-grew animation: pile amount increased since last render
    // Skip during walk animation UNLESS this is a dice-match or GROW unfreeze render
    if (grewTiles.has(pile.tileIndex) && (!window._tokenWalking || isGrowUnfreeze || isDiceMatchSteal)) {
      const isDiceMatch = diceMatchSet.has(pile.tileIndex);
      pileEl.classList.add(isDiceMatch ? "dice-match-grow" : "pile-grew");
      const tileEl = document.getElementById("space-" + pile.tileIndex);
      if (tileEl) tileEl.classList.add("pile-grew-tile");
      if (isDiceMatch && tileEl) {
        const numEl = tileEl.querySelector(".sname-num");
        if (numEl) {
          numEl.classList.add("dice-match-glow");
          setTimeout(() => numEl.classList.remove("dice-match-glow"), 2500);
        }
      }
      const delta = grewTiles.get(pile.tileIndex);
      const floater = document.createElement("div");
      floater.className = "pile-grow-floater";
      floater.textContent = "+" + delta + "\uD83C\uDF4C";
      const r2 = spaceRect(pile.tileIndex);
      if (r2.side === "bottom") {
        floater.style.left = r2.l + r2.w / 2 + "%";
        floater.style.top = r2.t - 0.3 + "%";
      } else if (r2.side === "top") {
        floater.style.left = r2.l + r2.w / 2 + "%";
        floater.style.top = r2.t + r2.h + 0.3 + "%";
      } else if (r2.side === "left") {
        floater.style.left = r2.l + r2.w + 0.3 + "%";
        floater.style.top = r2.t + r2.h / 2 + "%";
      } else if (r2.side === "right") {
        floater.style.left = r2.l - 0.3 + "%";
        floater.style.top = r2.t + r2.h / 2 + "%";
      } else {
        const cx = r2.l + r2.w / 2;
        const cy = r2.t + r2.h / 2;
        floater.style.left = (cx < 50 ? r2.l + r2.w + 0.3 : r2.l - 0.3) + "%";
        floater.style.top = (cy < 50 ? r2.t + r2.h + 0.3 : r2.t - 0.3) + "%";
      }
      board.appendChild(floater);
      floater.addEventListener("animationend", () => floater.remove());
    }

    board.appendChild(pileEl);
  }

  // Grow-then-steal animation for squatters on GROW corner tiles or dice-match grows
  if ((isGrowUnfreeze || isDiceMatchSteal) && gs && gs.growSquatterSteals && gs.growSquatterSteals.length > 0) {
    for (const steal of gs.growSquatterSteals) {
      const r = spaceRect(steal.tileId);
      // Show a temporary "grow" floater on the squatted tile
      const growFloater = document.createElement("div");
      growFloater.className = "pile-grow-floater";
      growFloater.textContent = "+" + steal.amount + "\uD83C\uDF4C";
      if (r.side === "bottom") {
        growFloater.style.left = r.l + r.w / 2 + "%";
        growFloater.style.top = r.t - 0.3 + "%";
      } else if (r.side === "top") {
        growFloater.style.left = r.l + r.w / 2 + "%";
        growFloater.style.top = r.t + r.h + 0.3 + "%";
      } else if (r.side === "left") {
        growFloater.style.left = r.l + r.w + 0.3 + "%";
        growFloater.style.top = r.t + r.h / 2 + "%";
      } else if (r.side === "right") {
        growFloater.style.left = r.l - 0.3 + "%";
        growFloater.style.top = r.t + r.h / 2 + "%";
      } else {
        growFloater.style.left = r.l + r.w / 2 + "%";
        growFloater.style.top = r.t + r.h / 2 + "%";
      }
      board.appendChild(growFloater);
      growFloater.addEventListener("animationend", () => growFloater.remove());
      // After 1 second, show "Steal!" floater and banana burst for squatter
      setTimeout(() => {
        const stealFloater = document.createElement("div");
        stealFloater.className = "steal-floater";
        stealFloater.textContent = "Steal!";
        const boardRect = board.getBoundingClientRect();
        stealFloater.style.position = "fixed";
        stealFloater.style.left = boardRect.left + (r.l + r.w / 2) / 100 * boardRect.width + "px";
        stealFloater.style.top = boardRect.top + (r.t + r.h / 2) / 100 * boardRect.height + "px";
        stealFloater.style.zIndex = "9999";
        document.body.appendChild(stealFloater);
        setTimeout(() => stealFloater.remove(), 2200);
        bananaBurst(steal.amount, steal.squatterId);
      }, 1000);
    }
  }

  // Detect collected piles and show floating animation (once per tile per turn)
  // Delay burst by 150ms so the token CSS transition finishes before the explosion
  const currentPiles = {};
  for (const pile of _bananaPiles) {
    currentPiles[pile.tileIndex] = pile.amount;
  }
  for (const [idx, oldAmount] of Object.entries(_prevBananaPiles)) {
    const newAmount = currentPiles[idx] || 0;
    if (oldAmount > 0 && newAmount < oldAmount && !_collectShown.has(Number(idx))) {
      _collectShown.add(Number(idx));
      const collected = oldAmount - newAmount;
      const r = spaceRect(Number(idx));
      const collectorId = gs.currentPlayer && gs.currentPlayer.id;
      // Flying banana burst for pile collection — delayed to sync with token arrival
      const stolenProp = _propById[Number(idx)];
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !gs.vineSwing && !window._vineSwingJustLanded && !_stealShown.has(Number(idx));
      if (isSteal) _stealShown.add(Number(idx));
      const fireBurst = () => {
        bananaBurst(collected, collectorId);
        // Show floater near the collector's account score
        const _isMe = typeof myId !== "undefined" && collectorId === myId;
        if (_isMe) {
          showPopupAtBananaBox("+" + collected + "\uD83C\uDF4C", "free-bananas-popup-player");
        } else if (collectorId) {
          const _pstat = document.querySelector(`.pstat[data-player-id="${collectorId}"]`);
          const _anchor = _pstat && _pstat.querySelector(".pstat-money");
          if (_anchor) {
            const _aRect = _anchor.getBoundingClientRect();
            const _floater = document.createElement("div");
            _floater.className = "free-bananas-popup-player";
            _floater.textContent = "+" + collected + "\uD83C\uDF4C";
            _floater.style.position = "fixed";
            _floater.style.left = _aRect.left + _aRect.width / 2 + "px";
            _floater.style.top = _aRect.top + "px";
            _floater.style.pointerEvents = "none";
            _floater.style.zIndex = "1000";
            document.body.appendChild(_floater);
            _floater.addEventListener("animationend", () => _floater.remove());
          }
        }
        if (isSteal) {
          const stealFloater = document.createElement("div");
          stealFloater.className = "steal-floater";
          stealFloater.textContent = "Steal!";
          const boardRect = board.getBoundingClientRect();
          stealFloater.style.position = "fixed";
          stealFloater.style.left = boardRect.left + (r.l + r.w / 2) / 100 * boardRect.width + "px";
          stealFloater.style.top = boardRect.top + (r.t + r.h / 2) / 100 * boardRect.height + "px";
          stealFloater.style.zIndex = "9999";
          document.body.appendChild(stealFloater);
          setTimeout(() => stealFloater.remove(), 2200);
        }
      };
      setTimeout(fireBurst, 150);
      window._walkPileCollected = (window._walkPileCollected || 0) + collected;
      // Sync pstat-pile counter: subtract collected amount from frozen total
      if (window._frozenPileTotals && collectorId) {
        window._frozenPileTotals[collectorId] = Math.max(0,
          (window._frozenPileTotals[collectorId] || 0) - collected);
        const pileEl = document.querySelector(`.pstat[data-player-id="${collectorId}"] .pstat-pile`);
        if (pileEl) {
          const remaining = window._frozenPileTotals[collectorId];
          pileEl.textContent = remaining > 0 ? remaining + "\uD83C\uDF4C" : "";
        }
      }
    }
  }
  _prevBananaPiles = currentPiles;
  window._vineSwingJustLanded = false;

  // Free Bananas +500 popup — show at player's banana score when triggered
  if (layout) {
    // Track known freebananas positions
    const currentFB = new Set();
    layout.forEach((tile, idx) => {
      if (tile.type === "freebananas") currentFB.add(idx);
    });

    // Reset dedup sets when a NEW walk starts (not when walk ends, because
    // post-walk renderBoard calls still need the sets to block duplicates)
    const walking = !!window._tokenWalking;
    if (walking && !_wasTokenWalking) {
      _freeBananasShown = new Set();
      window._freeBananasShown = _freeBananasShown;
      _stealShown = new Set();
      _collectShown = new Set();
    }
    _wasTokenWalking = walking;

    // Check if any walking token is currently on a freebananas tile
    // Only show popup if the tile is revealed (hidden tiles don't award bananas)
    if (window._diceRollingPositions) {
      for (const [playerId, pos] of Object.entries(
        window._diceRollingPositions,
      )) {
        // Skip if this is still the pre-walk starting position — the player is
        // leaving, not passing through.  The landing case is handled separately
        // in game.js at the end of the walk interval.
        const isStartPos =
          window._walkStartPositions &&
          window._walkStartPositions[playerId] === pos;
        if (isStartPos) continue;
        const tileRevealed = !myRevealed || myRevealed.has(pos);
        if (currentFB.has(pos) && !_freeBananasShown.has(pos) && tileRevealed) {
          _freeBananasShown.add(pos);
          const isMe = typeof myId !== "undefined" && playerId === myId;
          if (isMe) {
            showPopupAtBananaBox("+500\uD83C\uDF4C", "free-bananas-popup-player");
          } else {
            const pstat = document.querySelector(`.pstat[data-player-id="${playerId}"]`);
            const anchor = pstat && pstat.querySelector(".pstat-money");
            if (anchor) {
              const rect = anchor.getBoundingClientRect();
              const floater = document.createElement("div");
              floater.className = "free-bananas-popup-player";
              floater.textContent = "+500\uD83C\uDF4C";
              floater.style.position = "fixed";
              floater.style.left = rect.left + rect.width / 2 + "px";
              floater.style.top = rect.top + "px";
              floater.style.pointerEvents = "none";
              floater.style.zIndex = "1000";
              document.body.appendChild(floater);
              floater.addEventListener("animationend", () => floater.remove());
            }
          }
        }
      }
    }

    // Also trigger for newly revealed tiles when no walk is happening (e.g. passive push)
    if (!window._tokenWalking) {
      for (const pos of currentFB) {
        if (!_prevFreeBananasTiles.has(pos) && !_freeBananasShown.has(pos)) {
          _freeBananasShown.add(pos);
          // For passive reveal, show at the player who is on the tile
          const currentPlayer = gs.players.find((p) => p.position === pos);
          if (currentPlayer) {
            const isMe = typeof myId !== "undefined" && currentPlayer.id === myId;
            if (isMe) {
              showPopupAtBananaBox("+500\uD83C\uDF4C", "free-bananas-popup-player");
            } else {
              const pstat = document.querySelector(`.pstat[data-player-id="${currentPlayer.id}"]`);
              const anchor = pstat && pstat.querySelector(".pstat-money");
              if (anchor) {
                const rect = anchor.getBoundingClientRect();
                const floater = document.createElement("div");
                floater.className = "free-bananas-popup-player";
                floater.textContent = "+500\uD83C\uDF4C";
                floater.style.position = "fixed";
                floater.style.left = rect.left + rect.width / 2 + "px";
                floater.style.top = rect.top + "px";
                floater.style.pointerEvents = "none";
                floater.style.zIndex = "1000";
                document.body.appendChild(floater);
                floater.addEventListener("animationend", () => floater.remove());
              }
            }
          }
        }
      }
    }
    _prevFreeBananasTiles = currentFB;
  }

  // Center decoration: jungle scene with decorative rings
  const centerBg = document.createElement("div");
  centerBg.className = "board-center-jungle";
  board.appendChild(centerBg);

  const ring1 = document.createElement("div");
  ring1.className = "board-center-ring board-center-ring-1";
  board.appendChild(ring1);
  const ring2 = document.createElement("div");
  ring2.className = "board-center-ring board-center-ring-2";
  board.appendChild(ring2);

  const centerTitle = document.createElement("div");
  centerTitle.className = "board-center-title";
  centerTitle.innerHTML =
    '<div class="jungle-canopy">🌴🌳🍌🌳🌴</div>' +
    '<span class="banana-land-emoji"><span class="monkey-caller">🐒<span class="monkey-phone">📱</span></span></span>' +
    '<span class="banana-land-name">MONKEY<br>BUSINESS</span>' +
    '<div class="jungle-floor">🍌🌿🐵🌿🍌</div>' +
    '<div class="center-vine">🌱🍃🌱</div>';
  board.appendChild(centerTitle);

  // Bomb indicators
  if (gs && gs.bombs) {
    for (const bomb of gs.bombs) {
      const r = spaceRect(bomb.position);
      const bombEl = document.createElement("div");
      const isArming = bomb.turnsLeft > 5;
      bombEl.className = "bomb-indicator" + (isArming ? " bomb-arming" : "");
      bombEl.textContent = "\uD83C\uDF4D";
      const activeTurns = isArming ? 0 : bomb.turnsLeft;
      bombEl.title = isArming
        ? "Pineapple Bomb (arming...)"
        : `Pineapple Bomb (${activeTurns} turn${activeTurns !== 1 ? "s" : ""} until detonation)`;
      bombEl.style.left = r.l + r.w - 2 + "%";
      bombEl.style.top = r.t + r.h - 2 + "%";
      const timerBadge = document.createElement("span");
      timerBadge.className = "bomb-timer";
      timerBadge.textContent = isArming ? "~" : activeTurns;
      bombEl.appendChild(timerBadge);
      board.appendChild(bombEl);
    }
  }

  // Keep showing the bomb at the explosion position until the explosion animation fires
  if (
    gs &&
    gs.lastExplosion &&
    !window._explosionShown
  ) {
    const r = spaceRect(gs.lastExplosion.position);
    const phantomBomb = document.createElement("div");
    phantomBomb.className = "bomb-indicator";
    phantomBomb.textContent = "\uD83C\uDF4D";
    phantomBomb.style.left = r.l + r.w - 2 + "%";
    phantomBomb.style.top = r.t + r.h - 2 + "%";
    const timerBadge = document.createElement("span");
    timerBadge.className = "bomb-timer";
    timerBadge.textContent = "0";
    phantomBomb.appendChild(timerBadge);
    board.appendChild(phantomBomb);
  }

  // Bomb explosion animation (wait for token walk to finish)
  if (
    gs &&
    gs.lastExplosion &&
    !window._explosionShown &&
    !window._tokenWalking &&
    !window._diceRollingPositions
  ) {
    window._explosionShown = gs.lastExplosion.position;

    // Screen shake
    board.classList.add("board-shake");
    setTimeout(() => board.classList.remove("board-shake"), 800);

    // Full-board flash overlay
    const flash = document.createElement("div");
    flash.className = "bomb-flash";
    board.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());

    // Shockwave ring from center tile
    const cr = spaceRect(gs.lastExplosion.position);
    const shockwave = document.createElement("div");
    shockwave.className = "bomb-shockwave";
    shockwave.style.left = cr.l + cr.w / 2 + "%";
    shockwave.style.top = cr.t + cr.h / 2 + "%";
    board.appendChild(shockwave);
    shockwave.addEventListener("animationend", () => shockwave.remove());

    // Tile overlays (existing behavior, enhanced)
    for (const tile of gs.lastExplosion.tiles) {
      const r = spaceRect(tile);
      const fx = document.createElement("div");
      fx.className =
        tile === gs.lastExplosion.position
          ? "bomb-explosion bomb-explosion-center"
          : "bomb-explosion";
      fx.style.left = r.l + "%";
      fx.style.top = r.t + "%";
      fx.style.width = r.w + "%";
      fx.style.height = r.h + "%";
      fx.textContent = tile === gs.lastExplosion.position ? "\ud83d\udca5" : "";
      fx.style.display = "flex";
      fx.style.alignItems = "center";
      fx.style.justifyContent = "center";
      fx.style.fontSize = tile === gs.lastExplosion.position ? "28px" : "18px";
      board.appendChild(fx);
      fx.addEventListener("animationend", () => fx.remove());
    }

    // Flying debris particles from the center
    const cx = cr.l + cr.w / 2;
    const cy = cr.t + cr.h / 2;
    const debris = [
      "\ud83c\udf4d",
      "\ud83d\udca5",
      "\ud83d\udd25",
      "\u2728",
      "\ud83c\udf4c",
      "\ud83d\udca8",
    ];
    for (let i = 0; i < 18; i++) {
      const particle = document.createElement("div");
      particle.className = "bomb-particle";
      particle.textContent = debris[i % debris.length];
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.4;
      const dist = 12 + Math.random() * 20;
      particle.style.left = cx + "%";
      particle.style.top = cy + "%";
      particle.style.setProperty("--fly-x", Math.cos(angle) * dist + "%");
      particle.style.setProperty("--fly-y", Math.sin(angle) * dist + "%");
      particle.style.animationDelay = Math.random() * 0.15 + "s";
      board.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove());
    }
  }
  if (gs && !gs.lastExplosion) {
    window._explosionShown = null;
  }

  // Player tokens (persistent for smooth animation)
  // Re-attach token layer BEFORE updating positions so transitions fire
  board.appendChild(tokenLayer);
  const activePlayerIds = new Set();
  if (gs && gs.players) {
    // Group players by position for stacking
    // If dice are still rolling, use the pre-roll positions to freeze tokens
    const frozenPos = window._diceRollingPositions || null;
    const posMap = {};
    gs.players.forEach((p) => {
      if (p.bankrupt) return;
      const pos =
        frozenPos && frozenPos[p.id] != null ? frozenPos[p.id] : p.position;
      if (!posMap[pos]) posMap[pos] = [];
      posMap[pos].push({ ...p, _renderPos: pos });
    });

    for (const pos in posMap) {
      const players = posMap[pos];
      const r = spaceRect(Number(pos));
      const cx = r.l + r.w / 2;
      const cy = r.t + r.h / 2;

      players.forEach((p, idx) => {
        activePlayerIds.add(p.id);
        let tok = _tokenElements[p.id];
        const isNew = !tok;
        if (!tok) {
          tok = document.createElement("div");
          tok.textContent = "\ud83d\udc35";
          _tokenElements[p.id] = tok;
        }
        tok.className = "token c-" + p.color;
        tok.dataset.playerId = p.id;
        if (p.id === myId) tok.classList.add("token-me");
        if (gs.currentPlayer && gs.currentPlayer.id === p.id)
          tok.classList.add("token-active");

        // Disable transition for vine swing (teleport) or brand new tokens
        if (gs.vineSwing || isNew) {
          tok.classList.add("token-notransition");
        }

        // Offset multiple tokens so they don't overlap
        const offsetX = (idx % 2) * 3 - 1.5;
        const offsetY = Math.floor(idx / 2) * 3 - 1.5;
        const half = p.id === myId ? 18 : 14;
        tok.style.left = `calc(${cx + offsetX}% - ${half}px)`;
        tok.style.top = `calc(${cy + offsetY}% - ${half}px)`;

        if (!tok.parentNode) tokenLayer.appendChild(tok);

        // Re-enable transition after layout paint
        if (gs.vineSwing || isNew) {
          void tok.offsetWidth;
          tok.classList.remove("token-notransition");
        }
      });
    }
  }
  // Clean up tokens for removed/bankrupt players
  for (const id in _tokenElements) {
    if (!activePlayerIds.has(id)) {
      if (_tokenElements[id].parentNode) _tokenElements[id].remove();
      delete _tokenElements[id];
    }
  }
}

// ——— Lightweight trade highlight updater (no full re-render) ——————
// Toggles trade CSS classes on existing tile elements without rebuilding the board.
function updateSellHighlights() {
  const gs = window._gs;
  if (!gs) return;
  const sState = window._sellState;
  // Build local property lookup (the renderBoard-scoped _propById isn't accessible here)
  const _propById = {};
  if (gs.properties) {
    for (const p of gs.properties) _propById[p.id] = p;
  }
  const sellClasses = [
    "trade-clickable",
    "trade-clickable-mine",
    "trade-selected",
    "trade-selected-mine",
  ];

  for (let i = 0; i < BOARD_SIZE; i++) {
    const el = document.getElementById("space-" + i);
    if (!el) continue;

    // Remove all sell classes first
    sellClasses.forEach((c) => el.classList.remove(c));

    if (!sState) continue;

    const prop = _propById[i];
    if (!prop || prop.owner !== myId) continue;

    el.classList.add("trade-clickable");
    el.classList.add("trade-clickable-mine");

    if (sState.selectedTile === i) {
      el.classList.add("trade-selected");
      el.classList.add("trade-selected-mine");
    }
  }
}

// ——— Draggable sell-listings panel ———————————————————————————————
(function initSellListingsDrag() {
  let dragging = false,
    startX,
    startY,
    startLeft,
    startTop;
  function onMouseDown(e) {
    const panel = document.getElementById("board-trade-deals");
    if (!panel) return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    const boardRect = panel.offsetParent
      ? panel.offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left - boardRect.left;
    startTop = rect.top - boardRect.top;
    // Switch from right/bottom positioning to left/top for dragging
    panel.style.left = startLeft + "px";
    panel.style.top = startTop + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    e.preventDefault();
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const panel = document.getElementById("board-trade-deals");
    if (!panel) return;
    panel.style.left = startLeft + e.clientX - startX + "px";
    panel.style.top = startTop + e.clientY - startY + "px";
  }
  function onMouseUp() {
    dragging = false;
  }
  document.addEventListener("mousedown", function (e) {
    if (
      e.target.closest("#board-trade-deals-header") &&
      !e.target.closest(".board-trade-deals-close")
    ) {
      onMouseDown(e);
    }
  });
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
})();

// ——— Board Preview (client-side shuffle) ——————————————————————————

function buildPreviewLayout() {
  // Build a tile array matching the server's BOARD structure
  const groupLetters = {
    pink: "LF",
    lightblue: "BJ",
    red: "RD",
    yellow: "CV",
    orange: "GF",
    darkblue: "GM",
  };

  const corners = new Set([0, 13, 26, 39]);
  const cornerData = {
    0: { id: 0, type: "grow", name: "GROW\n100%" },
    13: { id: 13, type: "grow", name: "GROW\n25%" },
    26: { id: 26, type: "grow", name: "GROW\n50%" },
    39: { id: 39, type: "grow", name: "GROW\n75%" },
  };

  // Collect non-corner tiles from SPACE_DATA and SPECIAL_SPACES
  const nonCornerTiles = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (corners.has(i)) continue;
    const prop = SPACE_DATA[i];
    const special = SPECIAL_SPACES[i];
    if (prop) {
      nonCornerTiles.push({
        tileName: prop.name,
        group: prop.group,
        price: prop.price,
        type: "property",
      });
    } else if (special) {
      const entry = { type: special.type, name: special.name };
      if (special.fullName) entry.fullName = special.fullName;
      // Desert cacti are buyable
      if (special.type === "desert") {
        entry.tileName = special.name;
        entry.group = "desert";
        entry.price = 0;
      }
      // Mushroom
      if (special.type === "special") {
        entry.tileName = special.name;
        entry.group = "mushroom";
        entry.price = 7777;
      }
      nonCornerTiles.push(entry);
    }
  }

  // Fisher-Yates shuffle
  for (let i = nonCornerTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonCornerTiles[i], nonCornerTiles[j]] = [
      nonCornerTiles[j],
      nonCornerTiles[i],
    ];
  }

  // Build the full 52-tile layout with tileLabels
  const layout = [];
  const groupCounters = {};
  let ti = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (corners.has(i)) {
      layout.push(cornerData[i]);
    } else {
      const tile = { ...nonCornerTiles[ti], id: i };
      // Add tileLabel for property groups
      if (tile.group && groupLetters[tile.group]) {
        groupCounters[tile.group] = (groupCounters[tile.group] || 0) + 1;
        tile.tileLabel = groupLetters[tile.group] + groupCounters[tile.group];
      }
      layout.push(tile);
      ti++;
    }
  }
  return layout;
}

function renderPreviewTileList(layout) {
  const panel = document.getElementById("board-preview-tiles");
  if (!panel) return;
  panel.innerHTML = "";

  const groupNames = {
    yellow: "Cavendish",
    lightblue: "Blue Java",
    red: "Red Dacca",
    pink: "Lady Finger",
    orange: "Goldfinger",
    darkblue: "Gros Michel",
  };
  const groupColors = {
    yellow: "var(--gc-yellow)",
    lightblue: "var(--gc-lightblue)",
    red: "var(--gc-red)",
    pink: "var(--gc-pink)",
    orange: "var(--gc-orange)",
    darkblue: "var(--gc-darkblue)",
  };
  const groupOrder = [
    "yellow",
    "lightblue",
    "red",
    "pink",
    "orange",
    "darkblue",
  ];

  const groups = {};
  const cacti = [];
  const others = [];
  let mushroom = null;

  for (const tile of layout) {
    if (tile.type === "grow") continue;
    if (tile.group === "desert") {
      cacti.push(tile);
      continue;
    }
    if (tile.group === "mushroom") {
      mushroom = tile;
      continue;
    }
    if (tile.group && groupNames[tile.group]) {
      if (!groups[tile.group]) groups[tile.group] = [];
      groups[tile.group].push(tile);
    } else {
      others.push(tile);
    }
  }

  // Farm groups
  for (const g of groupOrder) {
    const tiles = groups[g];
    if (!tiles || tiles.length === 0) continue;
    const section = document.createElement("div");
    section.className = "bp-group";
    section.innerHTML =
      `<div class="bp-group-header">` +
      `<span class="bp-group-dot" style="background:${groupColors[g]}"></span>` +
      `${groupNames[g]} \ud83c\udf34 ` +
      `<span class="bp-group-meta">${tiles.length} farms \u00b7 ${tiles[0].price}\ud83c\udf4c</span>` +
      `</div>`;
    for (const t of tiles) {
      const row = document.createElement("div");
      row.className = "bp-tile";
      row.innerHTML =
        `<span class="bp-tile-dot" style="background:${groupColors[g]}"></span>` +
        `<span class="bp-tile-name">${t.tileLabel || "Farm"}</span>` +
        `<span class="bp-tile-price">${t.price}\ud83c\udf4c</span>`;
      section.appendChild(row);
    }
    panel.appendChild(section);
  }

  // Cacti
  if (cacti.length > 0) {
    const section = document.createElement("div");
    section.className = "bp-group";
    section.innerHTML =
      `<div class="bp-group-header">` +
      `<span class="bp-group-dot" style="background:#5a8a3c"></span>` +
      `Desert \ud83c\udf35 ` +
      `<span class="bp-group-meta">${cacti.length} tiles</span>` +
      `</div>`;
    for (const t of cacti) {
      const row = document.createElement("div");
      row.className = "bp-tile";
      row.innerHTML =
        `<span class="bp-tile-dot" style="background:#5a8a3c"></span>` +
        `<span class="bp-tile-name">\ud83c\udf35 Desert</span>`;
      section.appendChild(row);
    }
    panel.appendChild(section);
  }

  // Mushroom
  if (mushroom) {
    const section = document.createElement("div");
    section.className = "bp-group";
    section.innerHTML =
      `<div class="bp-group-header">` +
      `<span class="bp-group-dot" style="background:conic-gradient(#ff3333,#ff9933,#ffee33,#33dd55,#3399ff,#cc44ff,#ff3333)"></span>` +
      `Super Banana \u2b50` +
      `</div>`;
    const row = document.createElement("div");
    row.className = "bp-tile";
    row.innerHTML =
      `<span class="bp-tile-dot" style="background:conic-gradient(#ff3333,#ff9933,#ffee33,#33dd55,#3399ff,#cc44ff,#ff3333)"></span>` +
      `<span class="bp-tile-name">\u2b50 Super Banana</span>` +
      `<span class="bp-tile-price">${mushroom.price}\ud83c\udf4c</span>`;
    section.appendChild(row);
    panel.appendChild(section);
  }

  // Others (tax, bus, etc.)
  if (others.length > 0) {
    const section = document.createElement("div");
    section.className = "bp-group";
    section.innerHTML =
      `<div class="bp-group-header">` +
      `<span class="bp-group-dot" style="background:#666"></span>` +
      `Other Tiles ` +
      `<span class="bp-group-meta">${others.length} tiles</span>` +
      `</div>`;
    for (const t of others) {
      const row = document.createElement("div");
      row.className = "bp-tile";
      const label = (t.name || t.type || "").replace(/\n/g, " ");
      row.innerHTML =
        `<span class="bp-tile-dot" style="background:#666"></span>` +
        `<span class="bp-tile-name">${label}</span>`;
      section.appendChild(row);
    }
    panel.appendChild(section);
  }

  // Corners
  const cornerSection = document.createElement("div");
  cornerSection.className = "bp-group";
  cornerSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:#2e7d32"></span>` +
    `Corners \ud83c\udf34 ` +
    `<span class="bp-group-meta">4 tiles (fixed)</span>` +
    `</div>`;
  for (const tile of layout) {
    if (tile.type !== "grow") continue;
    const row = document.createElement("div");
    row.className = "bp-tile";
    row.innerHTML =
      `<span class="bp-tile-dot" style="background:#2e7d32"></span>` +
      `<span class="bp-tile-name">${tile.name.replace(/\n/g, " ")}</span>`;
    cornerSection.appendChild(row);
  }
  panel.appendChild(cornerSection);
}

function renderPreviewBoard(layout) {
  const board = document.getElementById("board-preview");
  board.innerHTML = "";

  for (let i = 0; i < BOARD_SIZE; i++) {
    const el = document.createElement("div");
    el.className = "space";

    const r = spaceRect(i);
    el.style.left = r.l + "%";
    el.style.top = r.t + "%";
    el.style.width = r.w + "%";
    el.style.height = r.h + "%";
    if (r.side) el.classList.add("side-" + r.side);

    const tile = layout[i];
    if (tile.type === "grow") {
      el.classList.add("corner");
      el.textContent = tile.name;
    } else if (tile.tileName) {
      const label = tile.tileLabel || tile.tileName;
      if (tile.group === "desert") {
        el.classList.add("type-desert");
        el.innerHTML =
          `<span class="sname desert-icon">${tile.tileName}</span>` +
          (tile.price > 0
            ? `<span class="sprice desert-price">${tile.price}\ud83c\udf4c</span>`
            : "");
      } else if (tile.group === "mushroom") {
        el.classList.add("g-mushroom");
        el.innerHTML =
          `<span class="sname"><svg class="rainbow-banana" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
          `<defs><linearGradient id="rb-prev" x1="0.2" y1="0" x2="0.8" y2="1">` +
          `<stop offset="0%" stop-color="#ff3333"/>` +
          `<stop offset="20%" stop-color="#ff9933"/>` +
          `<stop offset="40%" stop-color="#ffee33"/>` +
          `<stop offset="60%" stop-color="#33dd55"/>` +
          `<stop offset="80%" stop-color="#3399ff"/>` +
          `<stop offset="100%" stop-color="#cc44ff"/>` +
          `</linearGradient></defs>` +
          `<g transform="rotate(45,32,32) translate(64,0) scale(-1,1)">` +
          `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#rb-prev)" stroke="#fff" stroke-width="1.5"/>` +
          `<path d="M36 10 C38 6 41 3 44 2 C46 1 47 3 46 5 C45 7 42 9 39 10Z" fill="#5a3a1a" stroke="#3d2510" stroke-width="0.8" stroke-linejoin="round"/>` +
          `<path d="M24 38 C22 42 21 46 22 50" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round"/>` +
          `</g></svg></span>` +
          `<span class="sprice">${tile.price}\ud83c\udf4c</span>`;
      } else {
        el.classList.add("g-" + (tile.group || "railroad"));
        el.innerHTML =
          `<span class="sname">${label}</span>` +
          `<span class="sprice">${tile.price}\ud83c\udf4c</span>`;
      }
    } else {
      el.classList.add("type-" + tile.type);
      const displayName = (tile.name || tile.type || "").replace(/\n/g, "<br>");
      el.innerHTML = `<span class="sname">${displayName}</span>`;
      if (tile.fullName) el.title = tile.fullName;
    }

    board.appendChild(el);
  }

  renderPreviewTileList(layout);
}
