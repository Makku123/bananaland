// ——— Board Data & Rendering (48-tile cornerless square) ————————————

const BOARD_SIZE = 48;

// ——— Layout: 48-tile full square loop ————————————————————————————————
// A 13×13 grid whose entire perimeter is filled (4·13 − 4 = 48): 4 real
// corner tiles + 11 tiles per side, all the same size. Numbered
// counter-clockwise from the bottom-right corner: 0 = BR corner,
// 1–11 bottom (R→L), 12 = BL corner, 13–23 left (B→T), 24 = TL corner,
// 25–35 top (L→R), 36 = TR corner, 37–47 right (T→B).
function spaceRect(i) {
  const C = 100 / 13; // all tiles same size (square), corners included
  const S = C;
  // Corners (no `side`)
  if (i === 0) return { l: 100 - C, t: 100 - C, w: C, h: C }; // bottom-right
  if (i === 12) return { l: 0, t: 100 - C, w: C, h: C }; // bottom-left
  if (i === 24) return { l: 0, t: 0, w: C, h: C }; // top-left
  if (i === 36) return { l: 100 - C, t: 0, w: C, h: C }; // top-right
  // Bottom row (1–11): right to left
  if (i >= 1 && i <= 11) {
    const idx = 11 - i;
    return { l: C + idx * S, t: 100 - C, w: S, h: C, side: "bottom" };
  }
  // Left column (13–23): bottom to top
  if (i >= 13 && i <= 23) {
    const idx = 23 - i;
    return { l: 0, t: C + idx * S, w: C, h: S, side: "left" };
  }
  // Top row (25–35): left to right
  if (i >= 25 && i <= 35) {
    const idx = i - 25;
    return { l: C + idx * S, t: 0, w: S, h: C, side: "top" };
  }
  // Right column (37–47): top to bottom
  if (i >= 37 && i <= 47) {
    const idx = i - 37;
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

// On-board pile chip label. Shows a compact grow multiplier (×N = pile ÷
// farm yield = how many un-collected grows are stacked) instead of the raw
// banana count, so the board stays readable. Hover reveals the breakdown
// via a styled tooltip (see .banana-pile[data-tooltip] in styles.css).
function _pileChipLabel(tileIndex, amount) {
  if (gs && (gs.gameMode === "classic" || gs.gameMode === "2v2")) {
    const layout = gs.boardLayout && gs.boardLayout[tileIndex];
    const yieldVal = layout && layout.price ? layout.price : 0;
    if (yieldVal > 0) {
      const count = Math.max(1, Math.round(amount / yieldVal));
      return {
        text: "×" + count,
        mult: true,
        // Single-line tooltip — yield × count = total.
        title: `${yieldVal}🍌 × ${count} = ${amount}🍌`,
      };
    }
  }
  return { text: amount + "🍌", mult: false, title: "" };
}

// Fire the "Steal!" text floater at a tile immediately (no walk-end delay).
// game.js calls this at walk-start when the player leaves a squatted tile, so
// the steal reads at departure rather than at the end of the walk. Marks the
// tile in _stealShown so the walk-end pile-decrease detector won't re-fire it.
// Also marks the tile in _walkStartStealTiles so the pile counter chip drops
// to 0 on the next walk frame — the box disappears in sync with the floater
// instead of lingering on the squatted tile until the walk ends.
function _showStealFloaterAt(tileIndex) {
  if (_stealShown.has(tileIndex)) return;
  _stealShown.add(tileIndex);
  if (!window._walkStartStealTiles) window._walkStartStealTiles = new Set();
  window._walkStartStealTiles.add(tileIndex);
  const board = document.getElementById("board");
  if (!board) return;
  const r = spaceRect(tileIndex);
  const stealFloater = document.createElement("div");
  stealFloater.className = "steal-floater";
  stealFloater.textContent = "Steal!";
  const boardRect = board.getBoundingClientRect();
  stealFloater.style.position = "fixed";
  stealFloater.style.left =
    boardRect.left + (r.l + r.w / 2) / 100 * boardRect.width + "px";
  stealFloater.style.top =
    boardRect.top + (r.t + r.h / 2) / 100 * boardRect.height + "px";
  stealFloater.style.zIndex = "9999";
  document.body.appendChild(stealFloater);
  setTimeout(() => stealFloater.remove(), 2200);
  if (typeof _touchLandingFx === "function") _touchLandingFx(1400);
}

// Place a banana-pile chip relative to its tile. In every pile sits
// OUTSIDE the board ring (away from centre), matching the corner tiles, so it
// never sits on top of the tile's yield / ×N text. Other modes keep the original
// interior placement. Corner tiles always push straight out (top→up, bottom→down).
function _positionPileChip(pileEl, r) {
  const cx = r.l + r.w / 2;
  const cy = r.t + r.h / 2;
  const outside = !!(gs && (gs.gameMode === "classic" || gs.gameMode === "2v2"));
  const above = () => {
    pileEl.style.top = r.t - 0.3 + "%";
    pileEl.style.setProperty("--pile-transform", "translate(-50%, -100%)");
  };
  const below = () => {
    pileEl.style.top = r.t + r.h + 0.3 + "%";
    pileEl.style.setProperty("--pile-transform", "translate(-50%, 0)");
  };
  const leftOf = () => {
    pileEl.style.left = r.l - 0.3 + "%";
    pileEl.style.setProperty("--pile-transform", "translate(-100%, -50%)");
  };
  const rightOf = () => {
    pileEl.style.left = r.l + r.w + 0.3 + "%";
    pileEl.style.setProperty("--pile-transform", "translate(0, -50%)");
  };
  if (!r.side) {
    // Corner: straight out vertically (already outside on every board).
    pileEl.style.left = cx + "%";
    if (cy < 50) above(); else below();
  } else if (r.side === "bottom") {
    pileEl.style.left = cx + "%";
    outside ? below() : above(); // interior of a bottom tile is UP
  } else if (r.side === "top") {
    pileEl.style.left = cx + "%";
    outside ? above() : below(); // interior of a top tile is DOWN
  } else if (r.side === "left") {
    pileEl.style.top = cy + "%";
    outside ? leftOf() : rightOf(); // interior of a left tile is RIGHT
  } else if (r.side === "right") {
    pileEl.style.top = cy + "%";
    outside ? rightOf() : leftOf(); // interior of a right tile is LEFT
  }
}
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
  window._lastGrowFiredKey = null;
  // sale_completed sets _pendingSaleFlash and the next renderBoard consumes
  // it; if the player bounces to the lobby before that render, the flag would
  // survive into the next game and flash a wrong tile on the first render.
  window._pendingSaleFlash = null;
}

// Reset the per-walk dedup sets at the start of a new walk. Called by game.js
// from the dice-rolled handler BEFORE _showStealFloaterAt fires the leave-steal
// — otherwise the in-renderBoard reset would clobber that tile from _stealShown
// and the walk-end pile-decrement detector would fire a second "Steal!".
// Also pre-flips _wasTokenWalking so renderBoard's reset block becomes a no-op
// for this walk, and clears the per-walk leave-steal-tile set used by the pile
// rendering to hide the squatter-stolen counter the moment the player departs.
function resetWalkDedup() {
  _stealShown = new Set();
  _collectShown = new Set();
  _freeBananasShown = new Set();
  window._freeBananasShown = _freeBananasShown;
  window._walkStartStealTiles = new Set();
  _wasTokenWalking = true;
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
    // Simple mode: pick starting tile on first turn
    if (
      (gs.gameMode === "classic" || gs.gameMode === "2v2") &&
      gs.currentPlayer &&
      gs.currentPlayer.id === myId &&
      gs.currentPlayer.startPickPending &&
      !window._tokenWalking
    ) {
      // Block picks on tiles already occupied by another player
      const occupied =
        gs.players &&
        gs.players.some(
          (p) =>
            p.id !== myId &&
            !p.bankrupt &&
            !p.startPickPending &&
            p.position === i,
        );
      if (occupied) return;
      if (socket && gameId)
        socket.emit("pick_start_tile", { gameId, position: i });
      return;
    }
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
    // ability target selection (Vine Swing / Magic Dice)
    if (window._abilityTargetMode && !window._tokenWalking) {
      if (typeof handleAbilityTileClick === "function") {
        handleAbilityTileClick(i);
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

// Mirror a tile's live banana pile into the owned-farms chart chip so it counts
// down in sync with the walk animation. The chart panel isn't rebuilt mid-walk,
// so we update the chip (matched by data-tile) directly. No-op if the tile has
// no chip (unowned).
function _syncFarmChartPile(tileId, amount) {
  const chip = document.querySelector(`.owner-farm-pile[data-tile="${tileId}"]`);
  if (!chip) return;
  chip.textContent = amount + "🍌";
  chip.classList.toggle("has-pile", amount > 0);
}

// ——— Lightweight walk-step update (skips full tile rebuild) ————————
// Only updates token positions and banana pile collection visuals.
// Call this instead of renderBoard() for intermediate walk steps.
function walkStepUpdate(gs) {
  window._gs = gs;
  const _boardLen =
    (gs && gs.boardLayout && gs.boardLayout.length) || BOARD_SIZE;
  // Capture flag before pile detection clears it — used for steal suppression
  const vineSwingLanding = !!window._vineSwingJustLanded;
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
    for (let i = 0; i < _boardLen; i++) {
      const prop = _propById[i];
      let pileAmount = prop ? prop.bananaPile : 0;
      if (window._frozenBananaPiles) {
        const frozenVal = window._frozenBananaPiles[i] || 0;
        const isDiceMatchTile =
          window._diceMatchUnfrozen &&
          gs.diceMatchTiles &&
          gs.diceMatchTiles.includes(i) &&
          // grow pulse: a grown pile only appears once the pulse has
          // swept over its tile. Null set = no pulse gating (show immediately).
          (!window._pulseRevealedTiles || window._pulseRevealedTiles.has(i));
        // Leave-steal: the player departed this tile and stole the pile. Clear
        // the counter chip the moment the floater appears, instead of leaving
        // it visible until the walk ends.
        const isLeaveStolen =
          window._walkStartStealTiles &&
          window._walkStartStealTiles.has(i);
        if (isLeaveStolen) {
          pileAmount = 0;
        } else if (window._tokenVisitedTiles && window._tokenVisitedTiles.has(i)) {
          const isOwn = prop && prop.owner === window._walkingPlayerId;
          const isLanding = i === window._walkingLandingPos;
          // Simple mode: landing on an OPPONENT's farm no longer collects its
          // pile — the steal is deferred until you LEAVE. Keep the pile
          // visible on arrival instead of clearing it and snapping it back
          // at walk-end.
          const simpleDeferLanding =
            gs && (gs.gameMode === "classic" || gs.gameMode === "2v2") && isLanding &&
            prop && prop.owner && prop.owner !== window._walkingPlayerId;
          if ((isOwn || isLanding) && !simpleDeferLanding) {
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
      // Keep the owned-farms chart chip in sync as piles are collected.
      _syncFarmChartPile(i, pileAmount);
    }
  }

  // Remove old banana pile elements and re-render
  board.querySelectorAll(".banana-pile").forEach((el) => el.remove());
  for (const pile of _bananaPiles) {
    const r = spaceRect(pile.tileIndex);
    const pileEl = document.createElement("div");
    pileEl.className = "banana-pile";
    if (pile.ownerColor) pileEl.classList.add("pile-" + pile.ownerColor);
    // Bounce the count box when the grow chain reaches this farm (even if it
    // already had bananas). The tile stays in _pileBounceTiles for ~one bounce.
    if (window._pileBounceTiles && window._pileBounceTiles.has(pile.tileIndex)) {
      pileEl.classList.add("pile-bounce");
      // Resume the bounce at the right frame after a mid-pulse chip rebuild, so
      // it plays through once instead of restarting on every pulse step.
      const _bStart = window._pileBounceStart && window._pileBounceStart[pile.tileIndex];
      if (_bStart != null)
        pileEl.style.animationDelay = -(performance.now() - _bStart) + "ms";
    }
    const _chip = _pileChipLabel(pile.tileIndex, pile.amount);
    pileEl.textContent = _chip.text;
    if (_chip.mult) pileEl.classList.add("pile-mult");
    if (_chip.title) pileEl.setAttribute("data-tooltip", _chip.title);
    _positionPileChip(pileEl, r);
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
      // Prefer the walking token's player over gs.currentPlayer: the backend's
      // auto-end can advance the turn mid-animation (long grow pulses + walks
      // can run past the auto-end delay), which would otherwise flip every
      // owned-pile pickup into a phantom "Steal!" from the next player's view.
      const collectorId =
        window._walkingPlayerId ||
        (gs.currentPlayer && gs.currentPlayer.id);
      // Flying banana burst for pile collection — delayed to sync with token arrival
      const stolenProp = _propById[Number(idx)];
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !gs.vineSwing && !vineSwingLanding && !_stealShown.has(Number(idx));
      if (isSteal) _stealShown.add(Number(idx));
      // Leave-steal: the squatter is departing and just stole the tile's pile.
      // Rain the bananas on the TILE the player is leaving (not the moving
      // token), and fire immediately so it lines up visually with the "Steal!"
      // floater and the counter chip disappearing.
      const isLeaveStolen =
        window._walkStartStealTiles &&
        window._walkStartStealTiles.has(Number(idx));
      const stealAnchorEl = isLeaveStolen
        ? document.getElementById("space-" + Number(idx))
        : null;
      const fireBurst = () => {
        // bananaBurst now handles the canonical gain bundle (banana rain on
        // the piece + green "+N\uD83C\uDF4C" floater near the player's score).
        bananaBurst(collected, collectorId, stealAnchorEl);
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
      // Leave-steal fires immediately so the rain syncs with the "Steal!" text
      // and the counter chip drop; other collections wait 150ms for the token
      // CSS transition to complete so bananas land on top of the arrived token.
      if (isLeaveStolen) fireBurst();
      else setTimeout(fireBurst, 150);
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
        // Flash the tile itself so the source of the bananas is obvious \u2014 the
        // floater near the banana box alone doesn't tell you which tile fired.
        const _fbTile = document.getElementById("space-" + pos);
        if (_fbTile) {
          _fbTile.classList.remove("freebananas-triggered");
          void _fbTile.offsetWidth; // restart the animation
          _fbTile.classList.add("freebananas-triggered");
          _fbTile.addEventListener(
            "animationend",
            () => _fbTile.classList.remove("freebananas-triggered"),
            { once: true },
          );
        }
        // Rain bananas on the tile (anchored to the source) so the payout
        // reads visually at the tile. bananaBurst also fires the green
        // "+25\uD83C\uDF4C" floater near the player's score, which is the canonical
        // gain text. Tracked in a window counter so the post-walk
        // reconciliation in game.js doesn't double-burst the same amount on
        // the walker's token.
        const _fbAmount = 25;
        if (typeof bananaBurst === "function" && _fbTile) {
          bananaBurst(_fbAmount, playerId, _fbTile);
          if (window._tokenWalking) {
            window._walkFreeBananasBursted = (window._walkFreeBananasBursted || 0) + _fbAmount;
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
    // Keep bomb victims visible while walking and until the explosion plays.
    // During the bomb-chain sweep, each victim is held in
    // _bombChainHeldVictims until the chain reaches their tile.
    const bombPendingExplosion =
      !!(gs.lastExplosion && !window._explosionShown);
    const heldByChain = window._bombChainHeldVictims;
    const posMap = {};
    gs.players.forEach((p) => {
      const chainHeld = heldByChain && heldByChain.has(p.id);
      if (p.bankrupt && !bombPendingExplosion && !chainHeld) return;
      if (p.startPickPending) return;
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

// Animate the item-auction counter dropping after a dice-step subtraction:
// a "-N" floater rises and fades above the number while the number itself
// tweens down from `from` to `to`. Resilient to mid-tween re-renders — the
// floater lives on document.body and the number is looked up fresh each frame.
function _animateAuctionCounter(from, to) {
  window._auctionCounterAnimating = true;
  const drop = from - to;
  const duration = 650;
  const start = performance.now();

  // "-N" floater (deferred one frame so the counter element is in the DOM).
  requestAnimationFrame(() => {
    const el = document.getElementById("auction-counter-value");
    if (el && drop > 0) {
      const rect = el.getBoundingClientRect();
      const floater = document.createElement("div");
      floater.className = "auction-counter-floater";
      floater.textContent = "-" + drop;
      floater.style.position = "fixed";
      floater.style.left = rect.left + rect.width / 2 + "px";
      floater.style.top = rect.top + "px";
      floater.style.pointerEvents = "none";
      floater.style.zIndex = "1200";
      document.body.appendChild(floater);
      floater.addEventListener("animationend", () => floater.remove());
    }
  });

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out
    const val = Math.round(from - drop * eased);
    window._auctionCounterShown = val;
    const el = document.getElementById("auction-counter-value");
    if (el) el.textContent = String(val);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      window._auctionCounterShown = to;
      const done = document.getElementById("auction-counter-value");
      if (done) {
        done.textContent = String(to);
        done.classList.remove("counting");
      }
      window._auctionCounterAnimating = false;
    }
  }
  requestAnimationFrame(frame);
}

// ——— Render Board ——————————————————————————————————————————————————

function renderBoard(gs) {
  window._gs = gs;
  const _boardLen =
    (gs && gs.boardLayout && gs.boardLayout.length) || BOARD_SIZE;
  // Capture vine-swing-just-landed flag before pile detection clears it —
  // needed later for token no-transition (teleport) and steal suppression.
  const vineSwingLanding = !!window._vineSwingJustLanded;
  // Teleport card: token jumps to the destination without a walk animation.
  const teleportLanding = !!(gs && gs.lastTeleport && gs.lastTeleport.turn === gs.turn);
  // Capture bomb-pending state BEFORE the explosion animation block sets
  // _explosionShown — used by the player-token block below to keep victims
  // visible until the explosion fires on the same frame.
  const _bombWasPendingThisFrame =
    !!(gs && gs.lastExplosion && !window._explosionShown);
  const board = document.getElementById("board");
  if (board) board.classList.add("board-mode-simple");
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
  const itemAuctionBox = document.getElementById("item-auction-box");
  const helpPanel = document.getElementById("board-help");
  const helpToggle = document.getElementById("board-help-toggle");
  const emojiToggle = document.getElementById("board-emoji-toggle");
  const emojiPicker = document.getElementById("emoji-picker");
  const phoneToggle = document.getElementById("phone-toggle");
  if (chat) chat.remove();
  if (chatToggle) chatToggle.remove();
  if (logPanel) logPanel.remove();
  if (logToggle) logToggle.remove();
  if (tradeDealsPanel) tradeDealsPanel.remove();
  if (tradeDealsToggle) tradeDealsToggle.remove();
  if (pokerTable) pokerTable.remove();
  if (auctionBox) auctionBox.remove();
  if (itemAuctionBox) itemAuctionBox.remove();
  if (helpPanel) helpPanel.remove();
  if (helpToggle) helpToggle.remove();
  if (emojiToggle) emojiToggle.remove();
  if (emojiPicker) emojiPicker.remove();
  if (phoneToggle) phoneToggle.remove();
  // Detach persistent token layer before clearing
  let tokenLayer = document.getElementById("token-layer");
  if (tokenLayer) tokenLayer.remove();
  // Floaters (steal, collect) are NOT preserved across re-renders — re-appending
  // restarts CSS animations causing visible flashing. Instead, dedup sets
  // (_collectShown, _stealShown) prevent re-creation, and popups on document.body
  // (money-gain-float / money-deduction-float) naturally survive re-renders.
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
  if (helpToggle) board.appendChild(helpToggle);
  if (helpPanel) board.appendChild(helpPanel);
  if (emojiToggle) board.appendChild(emojiToggle);
  if (emojiPicker) board.appendChild(emojiPicker);
  if (phoneToggle) board.appendChild(phoneToggle);
  if (pokerTable) board.appendChild(pokerTable);
  if (auctionBox) board.appendChild(auctionBox);
  if (itemAuctionBox) board.appendChild(itemAuctionBox);

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

  // Tiles the viewer has only SCOUTED (peeked, not genuinely discovered). These
  // render like revealed tiles but under a translucent leafy veil, so you can
  // see what's there without it counting as fully revealed. Landing on a tile
  // clears its scouted flag server-side, so this set is scouted-only.
  let myScouted = null;
  if (gs && gs.players && typeof myId !== "undefined") {
    const me = _playerById[myId];
    if (me && me.scoutedTiles && me.scoutedTiles.length) {
      myScouted = new Set(me.scoutedTiles);
    }
  }

  // Compute chain multipliers (cached — only recompute when ownership changes)
  // Build a key from owned tile positions to detect changes
  let _chainMultipliers;
  const _isSimpleMode = gs && (gs.gameMode === "classic" || gs.gameMode === "2v2");
  if (gs && gs.properties && !_isSimpleMode) {
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
              if (visited.has(n) || !posSet.has(n)) continue;
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

  // start pick: tiles already occupied by another player can't be picked.
  const _occupiedPositions = new Set();
  if (gs && gs.players) {
    for (const p of gs.players) {
      if (!p.bankrupt && !p.startPickPending) _occupiedPositions.add(p.position);
    }
  }

  // Pending leaver-shuffle covers: each entry holds the leaver's color +
  // positions of the tiles they abandoned. While the 2s notification window
  // is open, those tiles render with a colored cover so everyone can see
  // which player's farms are about to get reshuffled.
  const _leaverCoverByPos = new Map();
  if (gs && Array.isArray(gs.pendingTileShuffles)) {
    const colorMap =
      (typeof SIMPLE_PLAYER_COLOR_HEX !== "undefined" &&
        SIMPLE_PLAYER_COLOR_HEX) ||
      window.SIMPLE_PLAYER_COLOR_HEX || {
        brown: "#e23b3b",
        golden: "#2e7fe0",
        silver: "#ff8c00",
        red: "#8e44ad",
      };
    for (const pending of gs.pendingTileShuffles) {
      const hex = colorMap[pending.color] || "#888888";
      for (const pos of pending.positions || []) {
        _leaverCoverByPos.set(pos, hex);
      }
    }
  }

  // Grow tile glow: flash any grow tile that just fired this turn (landed-on or
  // rolled-match) IN SYNC with the banana-grow animation — i.e. on the
  // dice-settle "pop-in" render where the grown piles bounce in (signalled by
  // _diceMatchUnfrozen), rather than deferred to the end of the walk. Outside a
  // walk (_tokenWalking false) it still fires on the next render. Deduped by
  // turn+positions so it plays once rather than on every re-render.
  let growGlowSet = null;
  if (
    gs &&
    // Simple mode: the grow PULSE lights the grow tile itself, at the right
    // moment (when its chain fires / when you land on it), so don't auto-glow
    // it here — that made a grow you're about to land on glow during the walk.
    gs.gameMode !== "classic" &&
    gs.gameMode !== "2v2" &&
    Array.isArray(gs.lastGrowFired) &&
    gs.lastGrowFired.length > 0 &&
    (window._diceMatchUnfrozen || !window._tokenWalking)
  ) {
    const growKey = (gs.turn || 0) + ":" + gs.lastGrowFired.join(",");
    if (growKey !== window._lastGrowFiredKey) {
      window._lastGrowFiredKey = growKey;
      growGlowSet = new Set(gs.lastGrowFired);
    }
  }

  for (let i = 0; i < _boardLen; i++) {
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

    // Fog of war: only the start tile (where players begin) is auto-revealed.
    const tileType = layout ? layout[i].type : null;
    const isRevealed =
      tileType !== "hidden" &&
      (!myRevealed ||
        myRevealed.has(i) ||
        (typeof revealAll !== "undefined" && revealAll));

    // Simple mode start-pick: current player can click ANY tile to land there.
    const startPickActive =
      gs &&
      (gs.gameMode === "classic" || gs.gameMode === "2v2") &&
      gs.currentPlayer &&
      gs.currentPlayer.id === myId &&
      gs.currentPlayer.startPickPending &&
      !window._tokenWalking;

    if (!isRevealed) {
      el.classList.add("space-hidden");
      const leaverHex = _leaverCoverByPos.get(i);
      if (leaverHex) {
        el.classList.add("leaver-cover-on");
        el.style.setProperty("--leaver-color", leaverHex);
      }
      el.innerHTML = `<span class="sname">${i}</span>`;
      // Vine Swing: hidden tiles are also clickable (only own properties)
      if (gs && gs.vineSwing && gs.vineSwing === myId && !window._tokenWalking) {
        const ownsProp = _propById[i] && _propById[i].owner === myId;
        if (ownsProp) {
          el.classList.add("space-pickable");
        }
      }
      if (startPickActive && !_occupiedPositions.has(i)) {
        el.classList.add("space-pickable", "start-pick-target");
      }
      // Bomb placement mode: make hidden tiles clickable
      if (window._bombPlacementMode) {
        el.classList.add("space-pickable", "bomb-target");
      }
      // Sell mode: make hidden owned tiles clickable too
      if (
        typeof isSellMode === "function" &&
        isSellMode() &&
        window._sellState
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

    // Scouted-only tiles render their full content but under a translucent
    // veil (see .space-scouted in CSS). Skip when everything is revealed at
    // game end so the veil doesn't linger.
    if (myScouted && myScouted.has(i) && !(typeof revealAll !== "undefined" && revealAll)) {
      el.classList.add("space-scouted");
    }

    if (layout) {
      // Use the dynamic board layout from the server
      const tile = layout[i];
      const isCorner = tile.type === "grow";

      if (isCorner) {
        el.classList.add("corner");
        // Simple mode: grow tiles show only their number (0-7), not "GROW N".
        if (gs && (gs.gameMode === "classic" || gs.gameMode === "2v2") && tile.growLabel != null) {
          el.innerHTML = `<span class="grow-yield">G${tile.growLabel}</span>`;
        } else {
          el.textContent = tile.name;
        }
        // Glow if this grow tile just fired (landed-on or rolled-match).
        if (growGlowSet && growGlowSet.has(i)) {
          el.classList.add("grow-fired");
          el.addEventListener(
            "animationend",
            () => el.classList.remove("grow-fired"),
            { once: true },
          );
        }
      } else if (tile.tileName) {
        // Buyable tile (property, railroad, utility)
        const label = tile.tileLabel || tile.tileName;
        if (tile.group === "farm") {
          // Simple mode: each farm tile shows its own yield in large white text.
          el.classList.add("g-simple");
          el.innerHTML = `<span class="simple-yield">F${tile.price}</span>`;
        } else if (tile.group === "desert") {
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
    }

    // Vine Swing: make revealed owned tiles clickable
    if (gs && gs.vineSwing && gs.vineSwing === myId && !window._tokenWalking) {
      const ownsProp = _propById[i] && _propById[i].owner === myId;
      if (ownsProp) {
        el.classList.add("space-pickable");
      }
    }

    // Bomb placement mode: make tiles clickable
    if (window._bombPlacementMode) {
      el.classList.add("space-pickable", "bomb-target");
    }

    // ability target selection (Vine Swing / Magic Dice)
    if (window._abilityTargetMode) {
      const mode = window._abilityTargetMode;
      if (_isAbilityTileSelectable(mode, i, gs)) {
        el.classList.add("space-pickable", "ability-target");
      }
      if (mode.picks && mode.picks.includes(i)) {
        el.classList.add("ability-picked");
      }
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
          gs.diceMatchTiles.includes(i) &&
          // grow pulse: a grown pile only appears once the pulse has
          // swept over its tile. Null set = no pulse gating (show immediately).
          (!window._pulseRevealedTiles || window._pulseRevealedTiles.has(i));
        // Leave-steal: the player departed this tile and stole the pile. Drop
        // the counter chip the moment the floater appears, in sync with the
        // departure — the pile shouldn't linger on the squatted tile.
        const isLeaveStolen =
          window._walkStartStealTiles &&
          window._walkStartStealTiles.has(i);
        if (isLeaveStolen) {
          pileAmount = 0;
        } else if (window._tokenVisitedTiles && window._tokenVisitedTiles.has(i)) {
          // Token walked past this tile — collect visually (overrides dice-match display)
          const isOwn = prop && prop.owner === window._walkingPlayerId;
          const isLanding = i === window._walkingLandingPos;
          // Simple mode: landing on an OPPONENT's farm no longer collects its
          // pile — the steal is deferred until you LEAVE. Keep the pile
          // visible on arrival instead of clearing it and snapping it back
          // at walk-end.
          const simpleDeferLanding =
            gs && (gs.gameMode === "classic" || gs.gameMode === "2v2") && isLanding &&
            prop && prop.owner && prop.owner !== window._walkingPlayerId;
          if ((isOwn || isLanding) && !simpleDeferLanding) {
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
      // Mid-walk renders (dice-match / GROW unfreeze) don't rebuild the chart
      // panel, so keep its pile chip in sync here too. Outside a walk the chart
      // rebuilds itself from authoritative state, so this is walk-only.
      if (window._tokenWalking) _syncFarmChartPile(i, pileAmount);
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

    // start pick: visually mark revealed tiles as pickable too
    // (but skip tiles a player has already chosen).
    if (startPickActive && !_occupiedPositions.has(i)) {
      el.classList.add("space-pickable", "start-pick-target");
    }

    board.appendChild(el);
  }

  const diceMatchSet = new Set(gs && gs.diceMatchTiles ? gs.diceMatchTiles : []);

  // Detect which piles grew since last render.
  // Bounce ONLY the piles that genuinely grew this turn (per
  // diceMatchGrownAmounts), so landing on a GROW tile doesn't bounce every
  // unrelated pile box.
  const isGrowUnfreeze = !!window._growUnfreezeRender;
  window._growUnfreezeRender = false;
  const isDiceMatchSteal = !!window._diceMatchStealRender;
  window._diceMatchStealRender = false;
  const grownAmtFor = (idx) =>
    (gs && gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[idx]) || 0;
  const grewTiles = new Map(); // tileIndex -> delta
  for (const pile of _bananaPiles) {
    let prev;
    if (isGrowUnfreeze) {
      const g = grownAmtFor(pile.tileIndex);
      prev = g > 0 ? pile.amount - g : pile.amount;
    } else {
      prev = _prevBananaPiles[pile.tileIndex] || 0;
    }
    if (pile.amount > prev) {
      grewTiles.set(pile.tileIndex, pile.amount - prev);
    }
  }

  // Render banana pile indicators next to their tiles (see _positionPileChip).
  for (const pile of _bananaPiles) {
    const r = spaceRect(pile.tileIndex);
    const pileEl = document.createElement("div");
    pileEl.className = "banana-pile";
    if (pile.ownerColor) pileEl.classList.add("pile-" + pile.ownerColor);
    // Bounce the count box when the grow chain reaches this farm (even if it
    // already had bananas). The tile stays in _pileBounceTiles for ~one bounce.
    if (window._pileBounceTiles && window._pileBounceTiles.has(pile.tileIndex)) {
      pileEl.classList.add("pile-bounce");
      // Resume the bounce at the right frame after a mid-pulse chip rebuild, so
      // it plays through once instead of restarting on every pulse step.
      const _bStart = window._pileBounceStart && window._pileBounceStart[pile.tileIndex];
      if (_bStart != null)
        pileEl.style.animationDelay = -(performance.now() - _bStart) + "ms";
    }
    const _chip = _pileChipLabel(pile.tileIndex, pile.amount);
    pileEl.textContent = _chip.text;
    if (_chip.mult) pileEl.classList.add("pile-mult");
    if (_chip.title) pileEl.setAttribute("data-tooltip", _chip.title);

    // Place the chip relative to its tile (outside the board ring in simple mode).
    _positionPileChip(pileEl, r);

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
      // Prefer the walking token's player over gs.currentPlayer: the backend's
      // auto-end can advance the turn mid-animation (long grow pulses + walks
      // can run past the auto-end delay), which would otherwise flip every
      // owned-pile pickup into a phantom "Steal!" from the next player's view.
      const collectorId =
        window._walkingPlayerId ||
        (gs.currentPlayer && gs.currentPlayer.id);
      // Flying banana burst for pile collection — delayed to sync with token arrival
      const stolenProp = _propById[Number(idx)];
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !gs.vineSwing && !vineSwingLanding && !_stealShown.has(Number(idx));
      if (isSteal) _stealShown.add(Number(idx));
      // Leave-steal: the squatter is departing and just stole the tile's pile.
      // Rain the bananas on the TILE the player is leaving (not the moving
      // token), and fire immediately so it lines up visually with the "Steal!"
      // floater and the counter chip disappearing.
      const isLeaveStolen =
        window._walkStartStealTiles &&
        window._walkStartStealTiles.has(Number(idx));
      const stealAnchorEl = isLeaveStolen
        ? document.getElementById("space-" + Number(idx))
        : null;
      const fireBurst = () => {
        // bananaBurst now handles the canonical gain bundle (banana rain on
        // the piece + green "+N\uD83C\uDF4C" floater near the player's score).
        bananaBurst(collected, collectorId, stealAnchorEl);
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
      // Leave-steal fires immediately so the rain syncs with the "Steal!" text
      // and the counter chip drop; other collections wait 150ms for the token
      // CSS transition to complete so bananas land on top of the arrived token.
      if (isLeaveStolen) fireBurst();
      else setTimeout(fireBurst, 150);
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
          // Tile bounce + banana rain \u2014 mirrors the walkStepUpdate path so the
          // visual feedback is the same regardless of which detector wins.
          const _fbTile = document.getElementById("space-" + pos);
          if (_fbTile) {
            _fbTile.classList.remove("freebananas-triggered");
            void _fbTile.offsetWidth;
            _fbTile.classList.add("freebananas-triggered");
            _fbTile.addEventListener(
              "animationend",
              () => _fbTile.classList.remove("freebananas-triggered"),
              { once: true },
            );
          }
          const _fbAmount = 25;
          if (typeof bananaBurst === "function" && _fbTile) {
            // bananaBurst handles the green "+25\uD83C\uDF4C" floater near the
            // player's score as part of the canonical gain bundle.
            bananaBurst(_fbAmount, playerId, _fbTile);
            if (window._tokenWalking) {
              window._walkFreeBananasBursted = (window._walkFreeBananasBursted || 0) + _fbAmount;
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
            // Tile bounce + banana rain on the source tile. No walk in progress,
            // so no reconciliation tracking is needed — money landed via passive
            // push and won't be reconciled by the post-walk burst.
            const _fbTile = document.getElementById("space-" + pos);
            if (_fbTile) {
              _fbTile.classList.remove("freebananas-triggered");
              void _fbTile.offsetWidth;
              _fbTile.classList.add("freebananas-triggered");
              _fbTile.addEventListener(
                "animationend",
                () => _fbTile.classList.remove("freebananas-triggered"),
                { once: true },
              );
            }
            const _fbAmount = 25;
            if (typeof bananaBurst === "function" && _fbTile) {
              // bananaBurst handles the green "+25\uD83C\uDF4C" floater near the
              // player's score as part of the canonical gain bundle.
              bananaBurst(_fbAmount, currentPlayer.id, _fbTile);
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
  const showAuctionCounter =
    gs &&
    (gs.gameMode === "classic" || gs.gameMode === "2v2") &&
    gs.itemAuctionEnabled &&
    (gs.state === "playing" || gs.state === "revealing");
  if (showAuctionCounter) {
    centerTitle.classList.add("with-auction-counter");
    const target = Number(gs.itemAuctionCounter ?? gs.itemAuctionStartValue ?? 50);
    // Track the value the player currently sees so dice-step subtractions can be
    // animated (counting down + a "-N" floater) instead of snapping.
    if (typeof window._auctionCounterShown !== "number") {
      window._auctionCounterShown = target;
    }
    let displayVal = window._auctionCounterShown;
    let animateFrom = null;
    if (!window._auctionCounterAnimating) {
      if (target > window._auctionCounterShown) {
        // Counter refilled after an auction (or otherwise grew) — snap up.
        window._auctionCounterShown = target;
        displayVal = target;
      } else if (target < window._auctionCounterShown && !window._tokenWalking) {
        // Decrement: animate down once the token has finished walking.
        animateFrom = window._auctionCounterShown;
        displayVal = window._auctionCounterShown;
      } else {
        // Equal, or decremented while a token is still walking → hold the old
        // value until the walk ends, then a post-walk render animates it.
        displayVal = window._auctionCounterShown;
      }
    }
    const countingClass =
      animateFrom != null || window._auctionCounterAnimating ? " counting" : "";
    centerTitle.innerHTML =
      '<div class="jungle-canopy">🌴🌳🍌🌳🌴</div>' +
      '<div class="auction-counter" title="Click for item abilities" onclick="toggleAbilitiesPopover(event)">' +
      '<div class="auction-counter-label">Next item in</div>' +
      '<div class="auction-counter-value' + countingClass + '" id="auction-counter-value">' +
      String(displayVal) +
      '</div>' +
      '<div class="auction-counter-sub">dice steps</div>' +
      '<div class="auction-counter-hint">ⓘ Abilities</div>' +
      '</div>' +
      '<div class="jungle-floor">🍌🌿🌿🍌</div>';
    if (animateFrom != null) _animateAuctionCounter(animateFrom, target);
  } else {
    // Counter hidden — reset tracking so it re-initializes cleanly next time.
    window._auctionCounterShown = undefined;
    window._auctionCounterAnimating = false;
    centerTitle.innerHTML =
      '<div class="jungle-canopy">🌴🌳🍌🌳🌴</div>' +
      '<span class="banana-land-name">MONKEY<br>BUSINESS</span>' +
      '<div class="jungle-floor">🍌🌿🌿🍌</div>' +
      '<div class="center-vine">🌱🍃🌱</div>';
  }
  board.appendChild(centerTitle);

  // Bomb indicators
  if (gs && gs.bombs) {
    for (const bomb of gs.bombs) {
      const r = spaceRect(bomb.position);
      const bombEl = document.createElement("div");
      const isArming = bomb.pending || bomb.turnsLeft > 5;
      bombEl.className = "bomb-indicator" + (isArming ? " bomb-arming" : "");
      bombEl.textContent = "\uD83C\uDF4D";
      const activeTurns = isArming ? 0 : bomb.turnsLeft;
      bombEl.title = bomb.pending
        ? "Pineapple Bomb (activates on your next turn)"
        : isArming
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

  // Keep showing bombs at each explosion position until the explosion animation fires
  if (
    gs &&
    gs.lastExplosion &&
    Array.isArray(gs.lastExplosion.explosions) &&
    gs.lastExplosion.explosions.length > 0 &&
    !window._explosionShown
  ) {
    for (const exp of gs.lastExplosion.explosions) {
      const r = spaceRect(exp.position);
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
  }

  // Defuse: keep the bomb visible at its position until the defuser visually
  // walks onto it, then play the defuse poof + sound. The backend has already
  // removed the bomb from gs.bombs, so without this phantom render the bomb
  // would vanish mid-walk and the player would land on an empty tile.
  if (
    gs &&
    gs.lastDefuse &&
    typeof gs.lastDefuse.position === "number" &&
    !window._defuseShown
  ) {
    const dr = spaceRect(gs.lastDefuse.position);
    const phantomBomb = document.createElement("div");
    phantomBomb.className = "bomb-indicator";
    phantomBomb.textContent = "\uD83C\uDF4D";
    phantomBomb.style.left = dr.l + dr.w - 2 + "%";
    phantomBomb.style.top = dr.t + dr.h - 2 + "%";
    const timerBadge = document.createElement("span");
    timerBadge.className = "bomb-timer";
    timerBadge.textContent = "0";
    phantomBomb.appendChild(timerBadge);
    board.appendChild(phantomBomb);
  }

  // Defuse animation (wait for the walking token to arrive on the bomb tile).
  if (
    gs &&
    gs.lastDefuse &&
    typeof gs.lastDefuse.position === "number" &&
    !window._defuseShown &&
    !window._tokenWalking &&
    !window._diceRollingPositions
  ) {
    window._defuseShown = true;
    if (typeof playDefuseSound === "function") playDefuseSound();
    const dr = spaceRect(gs.lastDefuse.position);
    const cx = dr.l + dr.w / 2;
    const cy = dr.t + dr.h / 2;
    // Three puffs of smoke staggered slightly.
    const puffs = ["\uD83D\uDCA8", "\uD83D\uDCA8", "\uD83D\uDCA8"];
    puffs.forEach((emoji, i) => {
      const puff = document.createElement("div");
      puff.className = "bomb-defuse-puff";
      puff.textContent = emoji;
      puff.style.left = cx + (i - 1) * 1.4 + "%";
      puff.style.top = cy + "%";
      puff.style.animationDelay = i * 0.08 + "s";
      board.appendChild(puff);
      puff.addEventListener("animationend", () => puff.remove());
    });
    const floater = document.createElement("div");
    floater.className = "bomb-defuse-floater";
    floater.textContent = "\uD83D\uDEE0\uFE0F Defused!";
    floater.style.left = cx + "%";
    floater.style.top = cy + "%";
    board.appendChild(floater);
    floater.addEventListener("animationend", () => floater.remove());
    // Block turn_anims_complete until the poof / sound settle.
    if (typeof _touchLandingFx === "function") _touchLandingFx(1400);
  }

  // Bomb explosion animation (wait for token walk to finish)
  if (
    gs &&
    gs.lastExplosion &&
    Array.isArray(gs.lastExplosion.explosions) &&
    gs.lastExplosion.explosions.length > 0 &&
    !window._explosionShown &&
    !window._tokenWalking &&
    !window._diceRollingPositions
  ) {
    window._explosionShown = true;

    // Explosion sound effect (once for the whole batch)
    if (typeof playExplosionSound === "function") playExplosionSound();

    // Screen shake (once for the whole batch)
    board.classList.add("board-shake");
    setTimeout(() => board.classList.remove("board-shake"), 800);

    // Full-board flash overlay (once for the whole batch)
    const flash = document.createElement("div");
    flash.className = "bomb-flash";
    board.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());

    // Per-explosion effects: fiery chain sweep + kills.
    //
    // The chain starts at the bomb tile and spreads outward in both
    // directions at 5 tiles per second (STEP_MS = 200). It naturally
    // stops at the edge of the blast (the corner tiles bounding the side).
    let killCounter = 0;
    const STEP_MS = 200;
    const TILE_FLAME_MS = 600;
    const SIMPLE_PLAYER_COLOR_HEX_FALLBACK = {
      brown: "#e23b3b",
      golden: "#2e7fe0",
      silver: "#ff8c00",
      red: "#8e44ad",
    };
    const colorHex = (window.SIMPLE_PLAYER_COLOR_HEX ||
      (typeof SIMPLE_PLAYER_COLOR_HEX !== "undefined"
        ? SIMPLE_PLAYER_COLOR_HEX
        : SIMPLE_PLAYER_COLOR_HEX_FALLBACK));

    if (!window._bombChainHeldVictims) window._bombChainHeldVictims = new Set();
    let chainEndsAt = 0;

    for (const exp of gs.lastExplosion.explosions) {
      const bombPos = exp.position;
      const blastTiles = Array.isArray(exp.tiles) ? exp.tiles : [];
      const boardSize =
        (gs.boardLayout && gs.boardLayout.length) || BOARD_SIZE;
      const placer = (gs.players || []).find((p) => p.id === exp.placerId);
      const placerColor = placer && placer.color ? placer.color : null;
      const hex =
        (placerColor && colorHex && colorHex[placerColor]) || "#ff7020";

      // Distance map: walk outward through the blast tiles until we exit them.
      const tilesSet = new Set(blastTiles);
      const distByTile = new Map();
      distByTile.set(bombPos, 0);
      for (let d = 1; d < boardSize; d++) {
        const p = (bombPos + d) % boardSize;
        if (!tilesSet.has(p)) break;
        distByTile.set(p, d);
      }
      for (let d = 1; d < boardSize; d++) {
        const p = (bombPos - d + boardSize) % boardSize;
        if (!tilesSet.has(p)) break;
        if (!distByTile.has(p) || distByTile.get(p) > d) {
          distByTile.set(p, d);
        }
      }

      // Shockwave + flying debris fire immediately at the bomb tile \u2014
      // the "boom" feel at detonation, before the chain sweeps outward.
      const cr = spaceRect(bombPos);
      const shockwave = document.createElement("div");
      shockwave.className = "bomb-shockwave";
      shockwave.style.left = cr.l + cr.w / 2 + "%";
      shockwave.style.top = cr.t + cr.h / 2 + "%";
      board.appendChild(shockwave);
      shockwave.addEventListener("animationend", () => shockwave.remove());

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
      for (let i = 0; i < 14; i++) {
        const particle = document.createElement("div");
        particle.className = "bomb-particle";
        particle.textContent = debris[i % debris.length];
        const angle =
          (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
        const dist = 12 + Math.random() * 18;
        particle.style.left = cx + "%";
        particle.style.top = cy + "%";
        particle.style.setProperty("--fly-x", Math.cos(angle) * dist + "%");
        particle.style.setProperty("--fly-y", Math.sin(angle) * dist + "%");
        particle.style.animationDelay = Math.random() * 0.15 + "s";
        board.appendChild(particle);
        particle.addEventListener("animationend", () => particle.remove());
      }

      // Light up each tile in the chain at dist * STEP_MS.
      const lightTile = (pos, isCenter) => {
        const el = document.getElementById("space-" + pos);
        if (el) {
          el.style.setProperty("--pulse-color", hex);
          el.classList.add("bomb-chain-on");
          if (el._bombChainTimer) clearTimeout(el._bombChainTimer);
          el._bombChainTimer = setTimeout(() => {
            el.classList.remove("bomb-chain-on");
            el._bombChainTimer = null;
          }, TILE_FLAME_MS);
        }
        const tr = spaceRect(pos);
        const flame = document.createElement("div");
        flame.className = "bomb-chain-flame";
        flame.textContent = isCenter ? "\ud83d\udca5" : "\ud83d\udd25";
        flame.style.setProperty("--pulse-color", hex);
        flame.style.left = tr.l + "%";
        flame.style.top = tr.t + "%";
        flame.style.width = tr.w + "%";
        flame.style.height = tr.h + "%";
        if (isCenter) flame.style.fontSize = "30px";
        board.appendChild(flame);
        flame.addEventListener("animationend", () => flame.remove());
      };

      let maxDist = 0;
      for (const [pos, dist] of distByTile.entries()) {
        if (dist > maxDist) maxDist = dist;
        if (dist === 0) {
          lightTile(pos, true);
        } else {
          setTimeout(() => lightTile(pos, false), dist * STEP_MS);
        }
      }
      const chainTotalMs = maxDist * STEP_MS + TILE_FLAME_MS;
      if (chainTotalMs > chainEndsAt) chainEndsAt = chainTotalMs;

      // Kill handling: defer victim removal + announcement until the chain
      // reaches each victim's tile. The bomb-trigger (player who landed on
      // it) and any victim somehow off the blast path go immediately.
      const kills = Array.isArray(exp.kills) ? exp.kills : [];
      for (const kill of kills) {
        const vp = kill.victimPosition;
        const isTrigger = exp.triggerId && kill.victimId === exp.triggerId;
        const onChain = vp != null && distByTile.has(vp);
        const dist = onChain ? distByTile.get(vp) : 0;
        const delay = isTrigger || !onChain ? 0 : dist * STEP_MS;
        if (delay > 0) window._bombChainHeldVictims.add(kill.victimId);

        // When the chain reaches this victim's tile, drop their token by
        // removing them from the held set and re-rendering.
        setTimeout(() => {
          if (window._bombChainHeldVictims)
            window._bombChainHeldVictims.delete(kill.victimId);
          if (typeof walkStepUpdate === "function") walkStepUpdate(gs);
        }, delay);
      }

      // Kill announcements + transferred-tile glow (delayed per chain hit).
      for (let k = 0; k < kills.length; k++) {
        const kill = kills[k];
        const vp = kill.victimPosition;
        const onChain = vp != null && distByTile.has(vp);
        const isTrigger = exp.triggerId && kill.victimId === exp.triggerId;
        const chainDelayMs =
          isTrigger || !onChain ? 0 : distByTile.get(vp) * STEP_MS;
        const placerColor = placer && placer.color ? placer.color : null;

        // Announcement banner \u2014 fires when the chain arrives, then staggers
        // sequentially across multiple kills.
        const banner = document.createElement("div");
        banner.className = "bomb-kill-announcement";
        if (placerColor) banner.classList.add("kill-c-" + placerColor);
        banner.style.animationDelay =
          chainDelayMs / 1000 + 0.05 + killCounter * 0.9 + "s";
        const icon = document.createElement("span");
        icon.className = "bomb-kill-icon";
        icon.textContent = "\uD83D\uDCA5";
        const text = document.createElement("span");
        text.className = "bomb-kill-text";
        const placerEl = document.createElement("span");
        placerEl.className = "bomb-kill-name bomb-kill-placer";
        placerEl.textContent = kill.placerName || "Someone";
        const verbEl = document.createElement("span");
        verbEl.className = "bomb-kill-verb";
        verbEl.textContent =
          kill.mode === "steal" ? " BOMBED " : " ELIMINATED ";
        const victimEl = document.createElement("span");
        victimEl.className = "bomb-kill-name bomb-kill-victim";
        victimEl.textContent = kill.victimName || "someone";
        const bang = document.createElement("span");
        bang.textContent = "!";
        text.appendChild(placerEl);
        text.appendChild(verbEl);
        text.appendChild(victimEl);
        text.appendChild(bang);
        banner.appendChild(icon);
        banner.appendChild(text);
        if (kill.loot || (kill.tiles && kill.tiles.length)) {
          const loot = document.createElement("div");
          loot.className = "bomb-kill-loot";
          const tileCount = (kill.tiles || []).length;
          loot.textContent =
            "+" +
            (kill.loot || 0) +
            "\uD83C\uDF4C" +
            (tileCount
              ? " and " + tileCount + " farm" + (tileCount !== 1 ? "s" : "")
              : "") +
            " stolen!";
          banner.appendChild(loot);
        }
        board.appendChild(banner);
        const thisKillIdx = killCounter;
        setTimeout(
          () => banner.remove(),
          3600 + thisKillIdx * 900,
        );

        // Glow transferred tiles sequentially — start after the chain hits
        // the victim so the takeover follows the elimination visually.
        (kill.tiles || []).forEach((pos, idx) => {
          const tr = spaceRect(pos);
          const glow = document.createElement("div");
          glow.className = "bomb-kill-glow";
          if (placerColor) glow.classList.add("glow-c-" + placerColor);
          glow.style.left = tr.l + "%";
          glow.style.top = tr.t + "%";
          glow.style.width = tr.w + "%";
          glow.style.height = tr.h + "%";
          glow.style.animationDelay =
            chainDelayMs / 1000 + 0.5 + thisKillIdx * 0.2 + idx * 0.07 + "s";
          board.appendChild(glow);
          glow.addEventListener("animationend", () => glow.remove());
        });
        killCounter++;
      }
    }

    // Defer the bomb-win game-over to AFTER the chain finishes so the win
    // announcement doesn't pop in over a half-finished chain sweep.
    if (typeof _runDeferredBombGameOver === "function") {
      setTimeout(() => _runDeferredBombGameOver(), chainEndsAt);
    }

    // Block turn_anims_complete until the explosion finishes — without this
    // the lander emits the signal while the chain sweep / kill banners are
    // still playing and the server advances to the next player.
    const lastBannerEndMs =
      killCounter > 0 ? 3600 + (killCounter - 1) * 900 : 0;
    const bombAnimMs = Math.max(chainEndsAt, lastBannerEndMs, 800);
    if (typeof _touchLandingFx === "function") {
      _touchLandingFx(bombAnimMs);
    }
  }
  if (gs && !gs.lastExplosion) {
    window._explosionShown = null;
    window._bombChainHeldVictims = null;
  }
  if (gs && !gs.lastDefuse) {
    window._defuseShown = null;
  }

  // Player tokens (persistent for smooth animation)
  // Re-attach token layer BEFORE updating positions so transitions fire
  board.appendChild(tokenLayer);
  const activePlayerIds = new Set();
  if (gs && gs.players) {
    // Group players by position for stacking
    // If dice are still rolling, use the pre-roll positions to freeze tokens
    const frozenPos = window._diceRollingPositions || null;
    // Keep bomb victims visible while walking and until the explosion plays.
    // Captured before the explosion block above (which sets _explosionShown)
    // so the victims still render on the same frame the explosion fires —
    // they then disappear on the next render once _explosionShown is set.
    // After detonation, _bombChainHeldVictims keeps each victim's token on
    // their tile until the fiery chain sweep reaches it.
    const bombPendingExplosion = _bombWasPendingThisFrame;
    const heldByChain = window._bombChainHeldVictims;
    const posMap = {};
    gs.players.forEach((p) => {
      const chainHeld = heldByChain && heldByChain.has(p.id);
      if (p.bankrupt && !bombPendingExplosion && !chainHeld) return;
      // Simple mode: hide tokens for players who haven't taken their start pick yet.
      if (p.startPickPending) return;
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
        // vineSwingLanding catches the completion frame where gs.vineSwing is
        // already null but the player just teleported to a new tile.
        if (gs.vineSwing || vineSwingLanding || teleportLanding || isNew) {
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
        if (gs.vineSwing || vineSwingLanding || teleportLanding || isNew) {
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


// board variation (mirrors backend BOARD_SIMPLE): 48 tiles —
// 40 farms with yields 1..40 (shown as F1..F40), 6 GROW tiles (labelled 1-6
// like in play), and 2 special tiles (Super Banana 777🍌, +25 Free Bananas).
// No tax, no Vine Swing tile (it's an ability now), no corners. All shuffled.
function buildSimplePreviewLayout() {
  const allTiles = [];
  for (let i = 0; i < 40; i++) {
    allTiles.push({
      type: "property",
      group: "farm",
      tileName: `F${i + 1}`,
      price: i + 1,
    });
  }
  for (let i = 0; i < 6; i++) {
    allTiles.push({ type: "grow", name: "🌴 GROW 100%", growPct: 1.0 });
  }
  allTiles.push({
    type: "special",
    name: "⭐",
    tileName: "⭐ Super Banana",
    group: "mushroom",
    price: 777,
  });
  allTiles.push({ type: "freebananas", name: "+25" });

  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  // Shuffle grow labels 1..6 across the grow tiles, matching the real game.
  const growLabels = [1, 2, 3, 4, 5, 6];
  for (let i = growLabels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [growLabels[i], growLabels[j]] = [growLabels[j], growLabels[i]];
  }

  const layout = [];
  let gIdx = 0;
  for (let i = 0; i < allTiles.length; i++) {
    const tile = { ...allTiles[i], id: i };
    if (tile.type === "grow") tile.growLabel = growLabels[gIdx++];
    layout.push(tile);
  }
  return layout;
}

function renderPreviewTileList(layout) {
  const panel = document.getElementById("board-preview-tiles");
  if (!panel) return;
  panel.innerHTML = "";

  // The board has a single "farm" group.
  if (layout.some((t) => t.group === "farm")) {
    renderSimplePreviewTileList(layout, panel);
    return;
  }

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

  // Grow tiles (shuffled into the board like every other tile)
  const growSection = document.createElement("div");
  growSection.className = "bp-group";
  growSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:#2e7d32"></span>` +
    `Grow Tiles \ud83c\udf34 ` +
    `<span class="bp-group-meta">4 tiles (shuffled)</span>` +
    `</div>`;
  for (const tile of layout) {
    if (tile.type !== "grow") continue;
    const row = document.createElement("div");
    row.className = "bp-tile";
    row.innerHTML =
      `<span class="bp-tile-dot" style="background:#2e7d32"></span>` +
      `<span class="bp-tile-name">${tile.name.replace(/\n/g, " ")}</span>`;
    growSection.appendChild(row);
  }
  panel.appendChild(growSection);
}

// Tile list panel for the board variation: 40 farms (compact yield
// grid), 6 GROW tiles (1-6), and the 2 special tiles.
function renderSimplePreviewTileList(layout, panel) {
  const farms = layout
    .filter((t) => t.group === "farm")
    .sort((a, b) => a.price - b.price);
  const grows = layout
    .filter((t) => t.type === "grow")
    .sort((a, b) => (a.growLabel || 0) - (b.growLabel || 0));

  // Farms — 40 chips in a compact yellow grid that matches the on-board
  // colour, so the section reads as "the farms" at a glance.
  const farmSection = document.createElement("div");
  farmSection.className = "bp-group bp-group--farms";
  const lo = farms.length ? farms[0].price : 0;
  const hi = farms.length ? farms[farms.length - 1].price : 0;
  farmSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:#ffd633"></span>` +
    `Farms 🌾 ` +
    `<span class="bp-group-meta">${farms.length} farms · yields ${lo}–${hi}🍌</span>` +
    `</div>`;
  const farmGrid = document.createElement("div");
  farmGrid.className = "bp-yield-grid";
  // Labelled F1..F40 to match the board (the number is also the yield).
  farmGrid.innerHTML = farms
    .map((f) => `<span class="bp-yield-chip bp-yield-chip--farm">F${f.price}</span>`)
    .join("");
  farmSection.appendChild(farmGrid);
  panel.appendChild(farmSection);

  // Grow tiles 1-6 — green chips that match the corner colour on the board.
  const growSection = document.createElement("div");
  growSection.className = "bp-group bp-group--grows";
  growSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:#2e7d32"></span>` +
    `Grow Tiles 🌴 ` +
    `<span class="bp-group-meta">${grows.length} tiles · roll the number to fire</span>` +
    `</div>`;
  const growGrid = document.createElement("div");
  growGrid.className = "bp-yield-grid";
  growGrid.innerHTML = grows
    .map((g) => `<span class="bp-yield-chip bp-yield-chip--grow">G${g.growLabel}</span>`)
    .join("");
  growSection.appendChild(growGrid);
  panel.appendChild(growSection);

  // Special tiles — +25 and Super Banana grouped together, with their own
  // icon-coded swatches so they read distinctly from farms/grows.
  const specials = [
    { icon: "🍌", name: "+25 Free Bananas", dot: "#ffd633" },
    { icon: "⭐", name: "Super Banana — 777🍌 to win", dot: "#d24cff" },
  ];
  const specialSection = document.createElement("div");
  specialSection.className = "bp-group bp-group--specials";
  specialSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:linear-gradient(135deg,#ffd633,#d24cff)"></span>` +
    `Special Tiles ✨ ` +
    `<span class="bp-group-meta">${specials.length} tiles</span>` +
    `</div>`;
  for (const s of specials) {
    const row = document.createElement("div");
    row.className = "bp-tile bp-tile--special";
    row.innerHTML =
      `<span class="bp-tile-dot" style="background:${s.dot}"></span>` +
      `<span class="bp-tile-name">${s.icon} ${s.name}</span>`;
    specialSection.appendChild(row);
  }
  panel.appendChild(specialSection);

}

function renderPreviewBoard(layout) {
  const board = document.getElementById("board-preview");
  board.innerHTML = "";

  // Mirror the live board: tag the preview with the mode class so the
  // tile colour rules apply here too (hidden cover, farm/grow text).
  board.classList.add("board-mode-simple");
  for (let i = 0; i < layout.length; i++) {
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
      // grow tiles show just their number (0-7), like in play.
      if (tile.growLabel != null) {
        el.innerHTML = `<span class="grow-yield">G${tile.growLabel}</span>`;
      } else {
        el.textContent = tile.name;
      }
    } else if (tile.tileName) {
      const label = tile.tileLabel || tile.tileName;
      if (tile.group === "farm") {
        el.classList.add("g-simple");
        el.innerHTML = `<span class="simple-yield">F${tile.price}</span>`;
      } else if (tile.group === "desert") {
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
