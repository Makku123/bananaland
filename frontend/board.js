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

// ——— Banana pile tracking for collection animation ————————————————
let _prevBananaPiles = {}; // { tileIndex: amount }

// On-board pile chip label. Shows a compact grow multiplier (×N = pile ÷
// farm yield = how many un-collected grows are stacked) instead of the raw
// banana count, so the board stays readable. Hover reveals the breakdown
// via a styled tooltip (see .banana-pile[data-tooltip] in styles.css).
function _pileChipLabel(tileIndex, amount) {
  if (gs && (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3")) {
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

// "Friendly steal" (2v2): stealing a teammate's pile shows a green
// "Friendly Steal!" floater instead of the red "Steal!" — the bananas came off
// your own teammate's farm.
function _teamOfPlayer(playerId) {
  if (!gs || !gs.teams || !playerId) return null;
  if (gs.teams.A && gs.teams.A.includes(playerId)) return "A";
  if (gs.teams.B && gs.teams.B.includes(playerId)) return "B";
  return null;
}
function _isFriendlySteal(collectorId, ownerId) {
  if (!gs || (gs.gameMode !== "2v2" && gs.gameMode !== "3v3")) return false;
  const a = _teamOfPlayer(collectorId);
  const b = _teamOfPlayer(ownerId);
  return !!a && a === b;
}
// Style the "Stolen" floater as either a normal (red) or friendly (green, 2v2
// teammate) steal. Fires when you LAND on someone else's farm and take its pile.
function _applyStealFloaterStyle(el, friendly) {
  el.className = friendly
    ? "steal-floater steal-floater-friendly"
    : "steal-floater";
  el.textContent = "Stolen";
}

// Fire the "Stolen" text floater at a tile immediately. game-screen.js calls this
// when the player LANDS on someone else's farm and takes its WHOLE pile (the
// steal-on-land rule). Marks the tile in _stealShown so the walk-end pile-decrease
// detector won't re-handle it, and in _walkStartStealTiles so the pile counter
// chip drops to 0 + the collected-burst anchors to the tile, in sync with the floater.
function _showStealFloaterAt(tileIndex) {
  if (_stealShown.has(tileIndex)) return;
  _stealShown.add(tileIndex);
  if (!window._walkStartStealTiles) window._walkStartStealTiles = new Set();
  window._walkStartStealTiles.add(tileIndex);
  const board = document.getElementById("board");
  if (!board) return;
  const r = spaceRect(tileIndex);
  const tookAllFloater = document.createElement("div");
  const _collectorId =
    window._walkingPlayerId || (gs && gs.currentPlayer && gs.currentPlayer.id);
  const _ownerProp = gs && gs.properties && gs.properties.find((p) => p.id === tileIndex);
  _applyStealFloaterStyle(tookAllFloater, _isFriendlySteal(_collectorId, _ownerProp && _ownerProp.owner));
  const boardRect = board.getBoundingClientRect();
  tookAllFloater.style.position = "fixed";
  tookAllFloater.style.left =
    boardRect.left + (r.l + r.w / 2) / 100 * boardRect.width + "px";
  tookAllFloater.style.top =
    boardRect.top + (r.t + r.h / 2) / 100 * boardRect.height + "px";
  tookAllFloater.style.zIndex = "9999";
  document.body.appendChild(tookAllFloater);
  setTimeout(() => tookAllFloater.remove(), 2200);
  if (typeof _touchLandingFx === "function") _touchLandingFx(1400);
}

// Place a banana-pile chip relative to its tile. In every pile sits
// OUTSIDE the board ring (away from centre), matching the corner tiles, so it
// never sits on top of the tile's yield / ×N text. Other modes keep the original
// interior placement. Corner tiles always push straight out (top→up, bottom→down).
function _positionPileChip(pileEl, r) {
  const cx = r.l + r.w / 2;
  const cy = r.t + r.h / 2;
  const outside = !!(gs && (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3"));
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

// Reconcile the on-board .banana-pile count-box chips IN PLACE against the
// desired `piles` list, reusing the existing chip element for each tile rather
// than removing and recreating every chip on every render. Keeping the same
// node alive is what stops the boxes from blinking: at turn-end the client
// fires several full renders back-to-back across separate timers/socket events
// (walk-end cleanup → grow-unfreeze → route refresh → next-turn update), and
// recreating the chips meant a chip could be absent from a painted frame and
// its infinite glow restarted every pass. With reuse the node never leaves the
// DOM and its animation runs continuously. Each chip is tagged data-tile and
// data-pile-color so updates stay surgical (we never blow away its animation
// classes). Returns a Map of tileIndex → chip element so callers can layer
// extra animation on top (e.g. the grow bounce in renderBoard).
function _reconcileBananaPiles(board, piles) {
  const existing = new Map();
  board.querySelectorAll(".banana-pile").forEach((el) => {
    const t = el.getAttribute("data-tile");
    if (t == null) { el.remove(); return; } // untagged legacy chip — drop
    existing.set(Number(t), el);
  });

  const chips = new Map();
  const wanted = new Set();
  for (const pile of piles) {
    wanted.add(pile.tileIndex);
    const r = spaceRect(pile.tileIndex);
    let pileEl = existing.get(pile.tileIndex);
    if (!pileEl) {
      pileEl = document.createElement("div");
      pileEl.className = "banana-pile";
      pileEl.setAttribute("data-tile", String(pile.tileIndex));
      // A chip re-created moments after its removal is a blink (a transient
      // render dropped the pile), not a fresh pile. Re-seed the last shown
      // amount so the grow-bounce guard in renderBoard (prevShown >= amount)
      // still knows this value already animated — without this, a blink also
      // replayed the bounce because the new node reset prevShown to 0.
      const mem = _pileChipMemory[pile.tileIndex];
      if (mem && Date.now() - mem.at < PILE_CHIP_MEMORY_MS) {
        pileEl.dataset.shown = String(mem.amount);
      }
      board.appendChild(pileEl);
    }
    // Owner-colour class: swap it surgically so we never strip the chip's other
    // (animation) classes, which would restart the glow or cut a bounce short.
    const wantColor = pile.ownerColor ? "pile-" + pile.ownerColor : "";
    const haveColor = pileEl.getAttribute("data-pile-color") || "";
    if (haveColor !== wantColor) {
      if (haveColor) pileEl.classList.remove(haveColor);
      if (wantColor) pileEl.classList.add(wantColor);
      pileEl.setAttribute("data-pile-color", wantColor);
    }
    // Track the amount shown before/after this render — the grow bounce keys
    // off a real on-screen increase, not the render bookkeeping.
    pileEl.dataset.prevShown = pileEl.dataset.shown || "0";
    pileEl.dataset.shown = String(pile.amount);
    const _chip = _pileChipLabel(pile.tileIndex, pile.amount);
    if (pileEl.textContent !== _chip.text) pileEl.textContent = _chip.text;
    pileEl.classList.toggle("pile-mult", !!_chip.mult);
    if (_chip.title) pileEl.setAttribute("data-tooltip", _chip.title);
    else pileEl.removeAttribute("data-tooltip");
    _positionPileChip(pileEl, r);
    // Grow-chain bounce while the tile sits in _pileBounceTiles. Add it ONCE
    // (resuming at the right frame for a chip that entered the set mid-bounce);
    // re-adding it to a chip already bouncing would restart the animation.
    const wantBounce = !!(
      window._pileBounceTiles && window._pileBounceTiles.has(pile.tileIndex)
    );
    const hasBounce = pileEl.classList.contains("pile-bounce");
    if (wantBounce && !hasBounce) {
      pileEl.classList.add("pile-bounce");
      const _bStart =
        window._pileBounceStart && window._pileBounceStart[pile.tileIndex];
      if (_bStart != null)
        pileEl.style.animationDelay = -(performance.now() - _bStart) + "ms";
    } else if (!wantBounce && hasBounce) {
      pileEl.classList.remove("pile-bounce");
      pileEl.style.animationDelay = "";
    }
    chips.set(pile.tileIndex, pileEl);
  }

  // Drop chips whose tile no longer has a pile. Remember what each showed so
  // a blink-recreation within PILE_CHIP_MEMORY_MS keeps its bounce guard.
  for (const [tile, el] of existing) {
    if (!wanted.has(tile)) {
      _pileChipMemory[tile] = {
        amount: Number(el.dataset.shown || 0),
        at: Date.now(),
      };
      el.remove();
    }
  }
  return chips;
}

let _stealShown = new Set(); // tile indices where "Steal!" floater already fired this turn
let _collectShown = new Set(); // tile indices where collect floater/popup already fired this turn
let _wasTokenWalking = false; // tracks previous walk state to detect walk-start transitions
// Last shown amount of recently-removed chips, so a blink (remove + recreate
// across back-to-back renders) doesn't reset the grow-bounce guard.
let _pileChipMemory = {}; // tileIndex → { amount, at }
const PILE_CHIP_MEMORY_MS = 2500;

// ——— Dice-match grow: track which tile set has already been animated ——

// ——— Reset all between-game animation state (call when returning to lobby) ———
function resetBoardAnimationState() {
  _prevBananaPiles = {};
  _stealShown = new Set();
  _collectShown = new Set();
  _wasTokenWalking = false;
  _pileChipMemory = {};
  window._pulseRevealedAmounts = null;
  window._lastGrowFiredKey = null;
  window._sbCrossFloaterFired = null; // Super Banana cross-floater dedup key
}

// Reset the per-walk dedup sets at the start of a new walk. Called by game-screen.js
// from the dice-rolled handler BEFORE _showStealFloaterAt fires the leave-steal
// — otherwise the in-renderBoard reset would clobber that tile from _stealShown
// and the walk-end pile-decrement detector would fire a second "Steal!".
// Also pre-flips _wasTokenWalking so renderBoard's reset block becomes a no-op
// for this walk, and clears the per-walk leave-steal-tile set used by the pile
// rendering to hide the squatter-stolen counter the moment the player departs.
function resetWalkDedup() {
  _stealShown = new Set();
  _collectShown = new Set();
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
    // Teleport pick-mode: click one of YOUR OWN FARMS to jump there (instead of
    // rolling). Costs two random Spell Cards. Clicking any other tile is
    // ignored (you stay in pick mode until you pick a farm or toggle it off).
    if (
      window._teleportPickMode &&
      gs.currentPlayer &&
      gs.currentPlayer.id === myId &&
      !gs.diceRolled &&
      !window._tokenWalking
    ) {
      const prop = gs.properties && gs.properties.find((p) => p && p.id === i);
      if (prop && prop.owner === myId && prop.group === "farm") {
        if (typeof emitTeleportToFarm === "function") emitTeleportToFarm(i);
      } else if (typeof showToast === "function") {
        showToast("Pick one of your glowing farms, or tap Teleport again to cancel.", "info", 2200);
      }
      return;
    }
    // Pick starting tile on first turn
    if (
      (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3") &&
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
          // MEGA RABBIT (+6) vacuums EVERY pile on its path — crossed opponent &
          // unclaimed piles too — so zero them all as the token passes (backend
          // already collected/stole them). Flagged publicly via gs.lastMegaRabbit
          // since opponents' plusSixRolls is owner-only. Zeroing here also lets the
          // pile-decrement detector below fire the burst + tick the victim's chip.
          const isMegaVacuum =
            gs && gs.lastMegaRabbit &&
            gs.lastMegaRabbit.playerId === window._walkingPlayerId;
          // Mirror the backend pile rules exactly. A TURTLE move (gs.lastGrowMatchHop
          // set — value < 7, walked 7-value) does NOT collect your OWN pile by
          // CROSSING (only by LANDING) and does NOT steal opponents' piles at all; a
          // RABBIT move collects own on cross/land and steals on landing; a MEGA
          // RABBIT sweep grabs every pile on the path.
          const isTurtle = !!(gs && gs.lastGrowMatchHop);
          let taken;
          if (isMegaVacuum) taken = true;
          else if (isOwn) taken = isLanding || !isTurtle;
          else if (!prop || !prop.owner) taken = isLanding; // unclaimed — landing only
          else taken = isLanding && !isTurtle; // opponent — steal only on a rabbit landing
          pileAmount = taken ? 0 : frozenVal;
        } else if (isDiceMatchTile) {
          const grownAmount = gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[i] || 0;
          pileAmount = frozenVal + grownAmount;
          // Remember what this reveal showed: the gate above depends on
          // gs.diceMatchTiles / diceMatchGrownAmounts, which the server NULLS
          // on the next roll. If that roll's update renders before the dice
          // handler installs the fresh freeze, the gate fails and the pile
          // would blink out — this memory keeps it on screen (see below).
          if (!window._pulseRevealedAmounts) window._pulseRevealedAmounts = {};
          window._pulseRevealedAmounts[i] = pileAmount;
        } else if (
          window._pulseRevealedAmounts &&
          window._pulseRevealedAmounts[i] != null
        ) {
          pileAmount = Math.max(frozenVal, window._pulseRevealedAmounts[i]);
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
        // The board is FROZEN during a walk (tiles aren't rebuilt), so a cyan
        // armed-rune path painted before the walk — or one whose rune fired/
        // cleared mid-walk — would linger as a phantom. Strip it every step;
        // renderBoard repaints it after the walk only if still validly armed.
        tileEl.classList.remove("armed-path", "armed-path-dest", "armed-grow-path", "armed-grow-tile");
      }
      // Keep the owned-farms chart chip in sync as piles are collected.
      _syncFarmChartPile(i, pileAmount);
    }
  }

  // Reconcile the pile chips in place (reuse existing nodes — see
  // _reconcileBananaPiles) so they never blink across the walk's many updates.
  // Skipped when gs has no properties: reconciling against an empty list
  // would silently drop every chip for one frame.
  if (gs && gs.properties) _reconcileBananaPiles(board, _bananaPiles);

  // Detect collected piles and show floating animation (once per tile per turn)
  // Delay burst by 150ms so the token CSS transition finishes before the burst
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
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !_stealShown.has(Number(idx));
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
        // bananaBurst handles the canonical gain bundle (banana rain on the
        // piece + green "+N" floater near the player's score). The "Stolen"
        // text floater fires SEPARATELY for a land-steal (via _showStealFloaterAt
        // on ARRIVAL); own-pile harvests just rain bananas here with no text.
        bananaBurst(collected, collectorId, stealAnchorEl);
      };
      // Leave-steal fires immediately so the rain syncs with the "Steal!" text
      // and the counter chip drop; other collections wait 150ms for the token
      // CSS transition to complete so bananas land on top of the arrived token.
      if (isLeaveStolen) fireBurst();
      else setTimeout(fireBurst, 150);
      window._walkPileCollected = (window._walkPileCollected || 0) + collected;
      // Sync pstat-pile counter: the frozen totals are keyed by the pile's
      // OWNER, so subtract the collected/stolen amount from the OWNER's total \u2014
      // for a steal the owner is NOT the thief (so the victim's counter drops,
      // not the thief's); for an own-collect they're the same id.
      const pileOwnerId = (stolenProp && stolenProp.owner) || collectorId;
      if (window._frozenPileTotals && pileOwnerId) {
        window._frozenPileTotals[pileOwnerId] = Math.max(0,
          (window._frozenPileTotals[pileOwnerId] || 0) - collected);
        const pileEl = document.querySelector(`.pstat[data-player-id="${pileOwnerId}"] .pstat-grown`);
        if (pileEl) {
          const remaining = window._frozenPileTotals[pileOwnerId];
          pileEl.textContent = remaining + "\uD83C\uDF4C";
        }
        // Keep the board-wide TOTAL GROWN ON BOARD footer ticking down in sync.
        const grownTotalEl = document.querySelector(".players-grown-total-val");
        if (grownTotalEl) {
          grownTotalEl.textContent =
            Object.values(window._frozenPileTotals).reduce((a, b) => a + b, 0) + "\uD83C\uDF4C";
        }
      }
    }
  }
  _prevBananaPiles = currentPiles;

  // Update token positions (reuse persistent token layer)
  let tokenLayer = document.getElementById("token-layer");
  if (!tokenLayer) return;
  const activePlayerIds = new Set();
  if (gs && gs.players) {
    const frozenPos = window._diceRollingPositions || null;
    const posMap = {};
    gs.players.forEach((p) => {
      if (p.bankrupt) return;
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
          _tokenElements[p.id] = tok;
        }
        // Ghosts (players who left mid-game) show a ghost emoji until they reconnect.
        tok.textContent = p.ghost ? "\ud83d\udc7b" : "\ud83d\udc35";
        tok.className = "token c-" + p.color + (p.ghost ? " token-ghost" : "");
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
  const _boardLen =
    (gs && gs.boardLayout && gs.boardLayout.length) || BOARD_SIZE;

  const board = document.getElementById("board");
  if (board) board.classList.add("board-mode-standard");
  _setupBoardDelegation();
  // Preserve overlays across re-renders
  const chat = document.getElementById("board-chat");
  const chatToggle = document.getElementById("board-chat-toggle");
  const logPanel = document.getElementById("board-log");
  const logToggle = document.getElementById("board-log-toggle");
  const pokerTable = document.getElementById("poker-table");
  const auctionBox = document.getElementById("auction-box");
  const boardRandomStart = document.getElementById("board-random-start");
  const redrawOverlay = document.getElementById("redraw-overlay");
  const runeDeck = document.getElementById("rune-deck");
  const helpPanel = document.getElementById("board-help");
  const helpToggle = document.getElementById("board-help-toggle");
  const emojiToggle = document.getElementById("board-emoji-toggle");
  const emojiPicker = document.getElementById("emoji-picker");
  const phoneToggle = document.getElementById("phone-toggle");
  const sfxToggle = document.getElementById("sfx-toggle");
  const sfxPopup = document.getElementById("sfx-slider-popup");
  if (chat) chat.remove();
  if (chatToggle) chatToggle.remove();
  if (logPanel) logPanel.remove();
  if (logToggle) logToggle.remove();
  if (pokerTable) pokerTable.remove();
  if (auctionBox) auctionBox.remove();
  if (helpPanel) helpPanel.remove();
  if (helpToggle) helpToggle.remove();
  if (emojiToggle) emojiToggle.remove();
  if (emojiPicker) emojiPicker.remove();
  if (phoneToggle) phoneToggle.remove();
  // sfx-toggle (+ its slider popup) live inside #board too — detach them here so
  // the child-clear below doesn't drop the sound button for good (it has no
  // re-append otherwise), then re-add them with the rest.
  if (sfxToggle) sfxToggle.remove();
  if (sfxPopup) sfxPopup.remove();
  // Detach persistent token layer before clearing
  let tokenLayer = document.getElementById("token-layer");
  if (tokenLayer) tokenLayer.remove();
  // Keep the banana-pile count-box chips ATTACHED through the teardown:
  // detaching + re-appending a node restarts its CSS animations, so the boxes
  // blinked (glow restart) or re-bounced on every turn-end render. The chips
  // are position:absolute with their own z-index, so being before the tiles in
  // DOM order doesn't change painting. _reconcileBananaPiles updates them in
  // place below and drops any whose pile is gone.
  // Floaters (steal, collect) are NOT preserved across re-renders — re-appending
  // restarts CSS animations causing visible flashing. Instead, dedup sets
  // (_collectShown, _stealShown) prevent re-creation, and popups on document.body
  // (money-gain-float / money-deduction-float) naturally survive re-renders.
  for (const child of Array.from(board.children)) {
    if (!child.classList.contains("banana-pile")) child.remove();
  }
  // Create token layer if first render
  if (!tokenLayer) {
    tokenLayer = document.createElement("div");
    tokenLayer.id = "token-layer";
  }
  if (chatToggle) board.appendChild(chatToggle);
  if (chat) board.appendChild(chat);
  if (logToggle) board.appendChild(logToggle);
  if (logPanel) board.appendChild(logPanel);
  if (helpToggle) board.appendChild(helpToggle);
  if (helpPanel) board.appendChild(helpPanel);
  if (emojiToggle) board.appendChild(emojiToggle);
  if (emojiPicker) board.appendChild(emojiPicker);
  if (phoneToggle) board.appendChild(phoneToggle);
  if (sfxToggle) board.appendChild(sfxToggle);
  if (sfxPopup) board.appendChild(sfxPopup);
  if (pokerTable) board.appendChild(pokerTable);
  if (auctionBox) board.appendChild(auctionBox);
  if (boardRandomStart) board.appendChild(boardRandomStart);
  if (redrawOverlay) board.appendChild(redrawOverlay);
  if (runeDeck) board.appendChild(runeDeck);
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

  // ARMED-ROLL PATH PREVIEW: if the VIEWER has a spell card ARMED, light up
  // the tiles they'd travel over (.armed-path) and the tile they'd land on
  // (.armed-path-dest), so they can see where the armed roll takes them. armedRoll
  // is owner-only, so only the armer sees their own path. Recomputed each render
  // (tiles are recreated below).
  let _armedPathSet = null;
  let _armedDest = -1;
  // When the armed rune (value v) would fire a REVEALED grow, also preview that
  // grow tile + the clockwise sweep range it would grow (yellow). -1 / null = none.
  let _armedGrowTile = -1;
  let _armedGrowPathSet = null;
  if (
    gs &&
    gs.state === "playing" &&
    typeof myId !== "undefined" &&
    // ONLY on the armer's OWN turn — an armed rune auto-fires at the start of
    // your turn, so showing the path on opponents' turns is a misleading
    // "phantom" highlight (the rune can't fire then).
    gs.currentPlayer &&
    gs.currentPlayer.id === myId &&
    // NEVER paint during a token walk: the board is frozen but meArm.position is
    // the LIVE (post-move) position, so the path would be drawn from the wrong
    // tile, and walkStepUpdate doesn't rebuild tiles to clear it.
    !window._tokenWalking
  ) {
    const meArm = _playerById[myId];
    // Only preview a rune the viewer ACTUALLY HOLDS — a stale arm (its value
    // removed by a penalty / swipe without a play) must not paint a phantom
    // path. Mirrors the auto-activation hold-check in game-screen.js.
    if (
      meArm &&
      meArm.armedRoll &&
      Array.isArray(meArm.rollCards) &&
      meArm.rollCards.includes(meArm.armedRoll.value)
    ) {
      const v = Number(meArm.armedRoll.value);
      // Highlight the ACTUAL distance walked, not the rune's face/grow number:
      // a rune of value v walks 7 - v (the low-roll inversion; runes are 1..6).
      const steps = v < 7 ? 7 - v : v;
      if (Number.isFinite(steps) && steps > 0) {
        _armedPathSet = new Set();
        const startP = meArm.position || 0;
        for (let s = 1; s <= steps; s++) _armedPathSet.add((startP + s) % _boardLen);
        _armedDest = (startP + steps) % _boardLen;
      }
      // GROW PREVIEW: a rune of value v fires the grow labelled v IF that grow is
      // REVEALED (a revealed grow appears in boardLayout as type "grow" + numeric
      // growLabel). Highlight that grow tile + the clockwise sweep range it would
      // grow, reusing _growRangePath (the same path the real grow-chain pulse uses).
      // Gate on genuineRevealedGrows too — the EXACT condition the backend uses to
      // decide the grow fires (_processRolledGrow → _isGenuinelyRevealed). For a
      // grow this is equivalent to "in my boardLayout" (grow reveals broadcast to
      // all players), but keying on the same field keeps the preview honest if the
      // per-viewer boardLayout redaction ever drifts.
      const _layout = (gs && gs.boardLayout) || [];
      const _revGrows = (gs && Array.isArray(gs.genuineRevealedGrows)) ? gs.genuineRevealedGrows : [];
      for (let gi = 0; gi < _layout.length; gi++) {
        const t = _layout[gi];
        if (t && t.type === "grow" && t.growLabel === v && _revGrows.includes(gi)) {
          _armedGrowTile = gi;
          if (typeof _growRangePath === "function") {
            _armedGrowPathSet = new Set(_growRangePath(gs, gi));
          }
          break;
        }
      }
    }
  }

  // PATH PREVIEW (yellow): the viewer's next N tiles, when their Path Preview
  // toggle is on. N is the Banana Gadget distance (the toggle lives in that box).
  // Owner-only (reads the viewer's own position + window state).
  let _stepAheadSet = null;
  if (gs && gs.state === "playing" && typeof myId !== "undefined" && window._stepHiOn) {
    const meStep = _playerById[myId];
    if (meStep && typeof meStep.position === "number" && !meStep.bankrupt && !meStep.ghost) {
      const n = Math.max(1, Math.min(47, window._bananaGadgetN || 6));
      _stepAheadSet = new Set();
      for (let s = 1; s <= n; s++) _stepAheadSet.add((meStep.position + s) % _boardLen);
    }
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
    // The grow PULSE lights the grow tile itself, at the right
    // moment (when its chain fires / when you land on it), so don't auto-glow
    // it here — that made a grow you're about to land on glow during the walk.
    gs.gameMode !== "classic" &&
    gs.gameMode !== "2v2" &&
    gs.gameMode !== "3v3" &&
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

    // Armed-roll path preview (applies to hidden tiles too — a glow on the fog
    // cover, no content leak).
    if (_armedPathSet && _armedPathSet.has(i)) {
      el.classList.add(i === _armedDest ? "armed-path-dest" : "armed-path");
    }
    // Armed-rune GROW preview: the (revealed) grow it would fire + the clockwise
    // sweep range it would grow (yellow). Applies to hidden in-range tiles too.
    if (_armedGrowPathSet && _armedGrowPathSet.has(i)) el.classList.add("armed-grow-path");
    if (i === _armedGrowTile) el.classList.add("armed-grow-tile");
    // Path Preview (yellow) overlay — the viewer's next N tiles when toggled on.
    if (_stepAheadSet && _stepAheadSet.has(i)) el.classList.add("step-ahead-path");

    // Fog of war: only the start tile (where players begin) is auto-revealed.
    const tileType = layout ? layout[i].type : null;
    const isRevealed =
      tileType !== "hidden" &&
      (!myRevealed ||
        myRevealed.has(i) ||
        (typeof revealAll !== "undefined" && revealAll));

    // Start pick: current player can click ANY tile to land there.
    const startPickActive =
      gs &&
      (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3") &&
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
      if (startPickActive && !_occupiedPositions.has(i)) {
        el.classList.add("space-pickable", "start-pick-target");
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
        // Grow tiles show only their number (0-7), not "GROW N".
        if (gs && (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3") && tile.growLabel != null) {
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
          // Each farm tile shows its own yield in large white text.
          el.classList.add("g-farm");
          el.innerHTML = `<span class="farm-yield">F${tile.price}</span>`;
        } else if (tile.group === "desert") {
          el.classList.add("type-desert");
          el.innerHTML = `<span class="sname desert-icon">${tile.tileName}<span class="desert-zero">0</span></span>`;
        } else if (tile.group === "superBanana") {
          el.classList.add("g-super-banana");
          el.innerHTML =
            `<span class="sname"><svg class="rainbow-banana" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
            `<defs><linearGradient id="rbg${i}" x1="0.15" y1="0.05" x2="0.85" y2="0.95">` +
            `<stop offset="0%" stop-color="#ff3340"/>` +
            `<stop offset="18%" stop-color="#ff8a1e"/>` +
            `<stop offset="37%" stop-color="#ffe23a"/>` +
            `<stop offset="56%" stop-color="#2fdf66"/>` +
            `<stop offset="76%" stop-color="#2fa4ff"/>` +
            `<stop offset="100%" stop-color="#c44dff"/>` +
            `</linearGradient>` +
            `<linearGradient id="rbh${i}" x1="0.1" y1="0" x2="0.45" y2="0.9">` +
            `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>` +
            `<stop offset="35%" stop-color="#ffffff" stop-opacity="0.28"/>` +
            `<stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>` +
            `</linearGradient>` +
            `<linearGradient id="rbsh${i}" x1="0.5" y1="1" x2="0.5" y2="0.4">` +
            `<stop offset="0%" stop-color="#2a1240" stop-opacity="0.5"/>` +
            `<stop offset="100%" stop-color="#2a1240" stop-opacity="0"/>` +
            `</linearGradient>` +
            `<linearGradient id="rbst${i}" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0%" stop-color="#8a5a2b"/>` +
            `<stop offset="100%" stop-color="#4f2f14"/>` +
            `</linearGradient>` +
            `<clipPath id="rbcl${i}"><path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z"/></clipPath></defs>` +
            `<g transform="rotate(45,32,32) translate(64,0) scale(-1,1)">` +
            `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>` +
            `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#rbg${i})" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.4" stroke-linejoin="round"/>` +
            `<g clip-path="url(#rbcl${i})"><path d="M16 56 C16 46 24 36 40 24 C24 42 22 50 25 58Z" fill="url(#rbsh${i})"/><path d="M36 10 C30 12 24 18 18 28 C24 22 31 17 38 14 C41 12 41 10 39 9Z" fill="url(#rbh${i})"/></g>` +
            `<path d="M34.5 15 C29 21 22 32 18.5 45" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.2" stroke-linecap="round"/>` +
            `<path d="M36 10 C38 6 41 3 44 2 C46 1 47.5 3 46 5 C44.5 7 42 9 39 10Z" fill="url(#rbst${i})" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.2" stroke-linejoin="round"/>` +
            `</g>` +
            `<g><path d="M51 9 L53 16 L60 18 L53 20 L51 27 L49 20 L42 18 L49 16 Z" fill="#ffffff"/><path d="M51 13 L52 17 L56 18 L52 19 L51 23 L50 19 L46 18 L50 17 Z" fill="#fff3a0"/></g>` +
            `</svg></span>`;
          // The Super Banana's price (the "target") AND the cross bonus are shown
          // in the Tile Legend, not on the tile \u2014 keeps the win tile clean
          // (just the rainbow banana, no text).
        } else {
          el.classList.add("g-" + (tile.group || "railroad"));
          // Show the farm's yield.
          const priceDisplay = `${tile.price}🍌`;
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
        el.innerHTML = `<span class="sname">${rawName}</span>`;
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
          const isMegaVacuum =
            gs && gs.lastMegaRabbit &&
            gs.lastMegaRabbit.playerId === window._walkingPlayerId;
          // Mirror the backend (see the other copy of this logic): a TURTLE move
          // (gs.lastGrowMatchHop) collects own piles only on LANDING and never steals;
          // a MEGA RABBIT grabs everything; otherwise own collects on cross/land and
          // opponents are stolen on landing.
          const isTurtle = !!(gs && gs.lastGrowMatchHop);
          let taken;
          if (isMegaVacuum) taken = true;
          else if (isOwn) taken = isLanding || !isTurtle;
          else if (!prop || !prop.owner) taken = isLanding;
          else taken = isLanding && !isTurtle;
          pileAmount = taken ? 0 : frozenVal;
        } else if (isDiceMatchTile) {
          // Show pre-roll pile + grown amount (pile may already be 0 if collected on path)
          const grownAmount = gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[i] || 0;
          pileAmount = frozenVal + grownAmount;
          // Remember the revealed amount — the gate above reads
          // gs.diceMatchTiles, which the NEXT roll nulls; without this memory
          // a render in the gap between that roll's update and its re-freeze
          // dropped every revealed pile for one frame (blink + re-bounce).
          if (!window._pulseRevealedAmounts) window._pulseRevealedAmounts = {};
          window._pulseRevealedAmounts[i] = pileAmount;
        } else if (
          window._pulseRevealedAmounts &&
          window._pulseRevealedAmounts[i] != null
        ) {
          pileAmount = Math.max(frozenVal, window._pulseRevealedAmounts[i]);
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
      // Teleport pick-mode: highlight MY OWN FARMS as cyan teleport destinations.
      // (Inside this revealed-tile block is where `prop` is in scope; owned farms
      // are always revealed to their owner, so they always reach here.)
      if (
        window._teleportPickMode &&
        prop &&
        prop.owner === myId &&
        prop.group === "farm"
      ) {
        el.classList.add("teleport-target");
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
  // Reconcile in place (reuse existing chip nodes) so the boxes don't blink when
  // several renders fire back-to-back at turn-end \u2014 see _reconcileBananaPiles.
  const _pileChips =
    gs && gs.properties
      ? _reconcileBananaPiles(board, _bananaPiles)
      : new Map();

  // Pile-grew animation: a pile whose amount increased since the last render
  // pops with a bounce. Skip during the walk UNLESS this is a dice-match or
  // GROW unfreeze render. Because chips are now reused, replay the bounce by
  // clearing the class, forcing a reflow, then re-adding it.
  for (const pile of _bananaPiles) {
    if (!grewTiles.has(pile.tileIndex)) continue;
    if (window._tokenWalking && !isGrowUnfreeze && !isDiceMatchSteal) continue;
    const pileEl = _pileChips.get(pile.tileIndex);
    // Bounce ONLY on a real on-screen increase. Turn-end renders can re-flag
    // tiles (grow-unfreeze recomputes "grew" from diceMatchGrownAmounts, which
    // the server only clears on the NEXT roll) and were replaying the bounce
    // + "+N" floater on piles whose number never changed.
    if (pileEl && Number(pileEl.dataset.prevShown || 0) >= pile.amount) continue;
    const isDiceMatch = diceMatchSet.has(pile.tileIndex);
    if (pileEl) {
      pileEl.classList.remove("dice-match-grow", "pile-grew");
      void pileEl.offsetWidth; // reflow so the re-added class replays the bounce
      pileEl.classList.add(isDiceMatch ? "dice-match-grow" : "pile-grew");
      // The chip node is reused across renders now, so the grow class (which
      // carries a bright box-shadow) must be cleared once the bounce finishes —
      // otherwise it would stick permanently. One persistent listener per chip.
      if (!pileEl._growClearBound) {
        pileEl._growClearBound = true;
        pileEl.addEventListener("animationend", (e) => {
          if (e.animationName === "pile-grow-bounce")
            pileEl.classList.remove("dice-match-grow", "pile-grew");
        });
      }
    }
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


  // Detect collected piles and show floating animation (once per tile per turn)
  // Delay burst by 150ms so the token CSS transition finishes before the burst
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
      const isSteal = stolenProp && stolenProp.owner && stolenProp.owner !== collectorId && !_stealShown.has(Number(idx));
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
        // bananaBurst handles the canonical gain bundle (banana rain on the
        // piece + green "+N" floater near the player's score). The "Stolen"
        // text floater fires SEPARATELY for a land-steal (via _showStealFloaterAt
        // on ARRIVAL); own-pile harvests just rain bananas here with no text.
        bananaBurst(collected, collectorId, stealAnchorEl);
      };
      // Leave-steal fires immediately so the rain syncs with the "Steal!" text
      // and the counter chip drop; other collections wait 150ms for the token
      // CSS transition to complete so bananas land on top of the arrived token.
      if (isLeaveStolen) fireBurst();
      else setTimeout(fireBurst, 150);
      window._walkPileCollected = (window._walkPileCollected || 0) + collected;
      // Sync pstat-pile counter: the frozen totals are keyed by the pile's
      // OWNER, so subtract the collected/stolen amount from the OWNER's total \u2014
      // for a steal the owner is NOT the thief (so the victim's counter drops,
      // not the thief's); for an own-collect they're the same id.
      const pileOwnerId = (stolenProp && stolenProp.owner) || collectorId;
      if (window._frozenPileTotals && pileOwnerId) {
        window._frozenPileTotals[pileOwnerId] = Math.max(0,
          (window._frozenPileTotals[pileOwnerId] || 0) - collected);
        const pileEl = document.querySelector(`.pstat[data-player-id="${pileOwnerId}"] .pstat-grown`);
        if (pileEl) {
          const remaining = window._frozenPileTotals[pileOwnerId];
          pileEl.textContent = remaining + "\uD83C\uDF4C";
        }
        // Keep the board-wide TOTAL GROWN ON BOARD footer ticking down in sync.
        const grownTotalEl = document.querySelector(".players-grown-total-val");
        if (grownTotalEl) {
          grownTotalEl.textContent =
            Object.values(window._frozenPileTotals).reduce((a, b) => a + b, 0) + "\uD83C\uDF4C";
        }
      }
    }
  }
  _prevBananaPiles = currentPiles;

  {
    // Reset dedup sets when a NEW walk starts (not when walk ends, because
    // post-walk renderBoard calls still need the sets to block duplicates)
    const walking = !!window._tokenWalking;
    if (walking && !_wasTokenWalking) {
      _stealShown = new Set();
      _collectShown = new Set();
    }
    _wasTokenWalking = walking;
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

  // The center "MONKEY BUSINESS" title + jungle emojis were removed per request;
  // the board centre now shows only the jungle background + decorative rings.

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
      // Hide tokens for players who haven't taken their start pick yet.
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
          _tokenElements[p.id] = tok;
        }
        // Ghosts (players who left mid-game) show a ghost emoji until they reconnect.
        tok.textContent = p.ghost ? "\ud83d\udc7b" : "\ud83d\udc35";
        tok.className = "token c-" + p.color + (p.ghost ? " token-ghost" : "");
        tok.dataset.playerId = p.id;
        if (p.id === myId) tok.classList.add("token-me");
        if (gs.currentPlayer && gs.currentPlayer.id === p.id)
          tok.classList.add("token-active");

        // Disable transition for brand new tokens (so they don't slide in
        // from the corner on first render).
        if (isNew) {
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
        if (isNew) {
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

// ——— Board Preview (client-side shuffle) ——————————————————————————


// board variation (mirrors backend BOARD_SIMPLE): 48 tiles —
// 40 farms with yields 1..40 (shown as F1..F40), 6 GROW tiles (labelled 1-6
// like in play), 1 Super Banana (10000🍌), and 1 Desert (an inert cactus tile).
// No tax, no corners. All shuffled.
function buildPreviewLayout() {
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
    group: "superBanana",
    price: 10000,
  });
  allTiles.push({ type: "desert", name: "🌵" });

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
  // Every board variation is the single-"farm"-group board (see
  // buildPreviewLayout); the old multi-group renderer was unreachable.
  renderFarmTileList(layout, panel);
}

// Tile list panel for the board variation: 40 farms (compact yield
// grid), 6 GROW tiles (1-6), and the 2 special tiles. Must NOT share the
// dispatcher's name — a duplicate `function` declaration silently overwrites
// it (this is exactly what broke the variations chart).
function renderFarmTileList(layout, panel) {
  const farms = layout
    .filter((t) => t.group === "farm")
    .sort((a, b) => a.price - b.price);
  const grows = layout
    .filter((t) => t.type === "grow")
    .sort((a, b) => (a.growLabel || 0) - (b.growLabel || 0));
  // The desert is a 0-yield farm — it lives in the Farms section, not on its own.
  const deserts = layout.filter((t) => t.group === "desert" || t.type === "desert");

  // Farms — 40 chips in a compact yellow grid that matches the on-board
  // colour, so the section reads as "the farms" at a glance.
  const farmSection = document.createElement("div");
  farmSection.className = "bp-group bp-group--farms";
  const lo = deserts.length ? 0 : farms.length ? farms[0].price : 0;
  const hi = farms.length ? farms[farms.length - 1].price : 0;
  const desertNote = deserts.length ? ` + ${deserts.length} D0 desert` : "";
  farmSection.innerHTML =
    `<div class="bp-group-header">` +
    `<span class="bp-group-dot" style="background:#ffd633"></span>` +
    `Farms 🌾 ` +
    `<span class="bp-group-meta">${farms.length} farms${desertNote} · yields ${lo}–${hi}🍌</span>` +
    `</div>`;
  const farmGrid = document.createElement("div");
  farmGrid.className = "bp-yield-grid";
  // Labelled F1..F40 to match the board (the number is also the yield); the
  // desert rides along as a "D0" chip (a 0-yield farm — matches the F#/G# codes).
  farmGrid.innerHTML =
    farms
      .map((f) => `<span class="bp-yield-chip bp-yield-chip--farm">F${f.price}</span>`)
      .join("") +
    deserts
      .map(() => `<span class="bp-yield-chip bp-yield-chip--desert" title="Desert — a 0-yield farm">D0</span>`)
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

  // Super Banana — a plain row (the Desert now rides in the Farms section above).
  const miscGroup = document.createElement("div");
  miscGroup.className = "bp-group";
  const miscRows = [
    {
      cls: "bp-tile--special",
      dot: "linear-gradient(135deg,#ffd633,#d24cff)",
      name: "⭐ Super Banana — 10000🍌 to win",
    },
  ];
  for (const m of miscRows) {
    const row = document.createElement("div");
    row.className = `bp-tile ${m.cls}`;
    row.innerHTML =
      `<span class="bp-tile-dot" style="background:${m.dot}"></span>` +
      `<span class="bp-tile-name">${m.name}</span>`;
    miscGroup.appendChild(row);
  }
  panel.appendChild(miscGroup);
}

function renderPreviewBoard(layout) {
  const board = document.getElementById("board-preview");
  board.innerHTML = "";

  // Mirror the live board: tag the preview with the mode class so the
  // tile colour rules apply here too (hidden cover, farm/grow text).
  board.classList.add("board-mode-standard");
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
        el.classList.add("g-farm");
        el.innerHTML = `<span class="farm-yield">F${tile.price}</span>`;
      } else if (tile.group === "desert") {
        el.classList.add("type-desert");
        el.innerHTML =
          `<span class="sname desert-icon">${tile.tileName}<span class="desert-zero">0</span></span>` +
          (tile.price > 0
            ? `<span class="sprice desert-price">${tile.price}\ud83c\udf4c</span>`
            : "");
      } else if (tile.group === "superBanana") {
        el.classList.add("g-super-banana");
        el.innerHTML =
          `<span class="sname"><svg class="rainbow-banana" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
          `<defs><linearGradient id="rbgprev" x1="0.15" y1="0.05" x2="0.85" y2="0.95">` +
          `<stop offset="0%" stop-color="#ff3340"/>` +
          `<stop offset="18%" stop-color="#ff8a1e"/>` +
          `<stop offset="37%" stop-color="#ffe23a"/>` +
          `<stop offset="56%" stop-color="#2fdf66"/>` +
          `<stop offset="76%" stop-color="#2fa4ff"/>` +
          `<stop offset="100%" stop-color="#c44dff"/>` +
          `</linearGradient>` +
          `<linearGradient id="rbhprev" x1="0.1" y1="0" x2="0.45" y2="0.9">` +
          `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>` +
          `<stop offset="35%" stop-color="#ffffff" stop-opacity="0.28"/>` +
          `<stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>` +
          `</linearGradient>` +
          `<linearGradient id="rbshprev" x1="0.5" y1="1" x2="0.5" y2="0.4">` +
          `<stop offset="0%" stop-color="#2a1240" stop-opacity="0.5"/>` +
          `<stop offset="100%" stop-color="#2a1240" stop-opacity="0"/>` +
          `</linearGradient>` +
          `<linearGradient id="rbstprev" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0%" stop-color="#8a5a2b"/>` +
          `<stop offset="100%" stop-color="#4f2f14"/>` +
          `</linearGradient>` +
          `<clipPath id="rbclprev"><path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z"/></clipPath></defs>` +
          `<g transform="rotate(45,32,32) translate(64,0) scale(-1,1)">` +
          `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>` +
          `<path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#rbgprev)" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.4" stroke-linejoin="round"/>` +
          `<g clip-path="url(#rbclprev)"><path d="M16 56 C16 46 24 36 40 24 C24 42 22 50 25 58Z" fill="url(#rbshprev)"/><path d="M36 10 C30 12 24 18 18 28 C24 22 31 17 38 14 C41 12 41 10 39 9Z" fill="url(#rbhprev)"/></g>` +
          `<path d="M34.5 15 C29 21 22 32 18.5 45" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2.2" stroke-linecap="round"/>` +
          `<path d="M36 10 C38 6 41 3 44 2 C46 1 47.5 3 46 5 C44.5 7 42 9 39 10Z" fill="url(#rbstprev)" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.2" stroke-linejoin="round"/>` +
          `</g>` +
          `<g><path d="M51 9 L53 16 L60 18 L53 20 L51 27 L49 20 L42 18 L49 16 Z" fill="#ffffff"/><path d="M51 13 L52 17 L56 18 L52 19 L51 23 L50 19 L46 18 L50 17 Z" fill="#fff3a0"/></g>` +
          `</svg></span>`;
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
