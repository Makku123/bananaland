// ── Lobby ──────────────────────────────────────────────────────────

function showLobby() {
  showScreen("screen-lobby");
  _revealShown = false;
  _shufflePlayed = false;
  resetBoardAnimationState();

  // Game code (click to copy)
  const codeEl = document.getElementById("lobby-code");
  codeEl.textContent = gs.gameId;
  codeEl.parentElement.onclick = () => {
    navigator.clipboard.writeText(gs.gameId).then(() => {
      codeEl.classList.add("copied");
      setTimeout(() => codeEl.classList.remove("copied"), 1200);
    });
  };

  // Settings summary (non-host read-only view)
  const settingsEl = document.getElementById("lobby-settings");
  const modeLabel =
    gs.gameMode === "3v3" ? "3v3" : gs.gameMode === "2v2" ? "2v2" : "Classic";
  settingsEl.innerHTML = `
    <div class="lobby-setting">\ud83c\udf4c <span class="lobby-setting-val">${gs.startingMoney || 5000}</span></div>
    <div class="lobby-setting">\ud83d\udc65 <span class="lobby-setting-val">${gs.maxPlayers || 4} max</span></div>
    <div class="lobby-setting">\ud83c\udfae <span class="lobby-setting-val">${modeLabel}</span></div>
    <div class="lobby-setting">\u2b50 <span class="lobby-setting-val">Win: land on the Super Banana while rich, or get within 12 of it rich with credit (rich = ${gs.superBananaPrice || 10000}\ud83c\udf4c)</span></div>
    <div class="lobby-setting">\ud83d\udcb3 <span class="lobby-setting-val">${gs.creditStart != null ? gs.creditStart : 7} starting credit</span></div>
    ${gs.isPublic ? '<div class="lobby-setting">\ud83c\udf10 <span class="lobby-setting-val">Public</span></div>' : '<div class="lobby-setting">\ud83d\udd12 <span class="lobby-setting-val">Private</span></div>'}
  `;

  // Host settings controls (hide while waiting for players to return from finished game)
  const controlsEl = document.getElementById("lobby-settings-controls");
  const isHost = myId === gs.admin;
  if (isHost && gs.state === "waiting") {
    controlsEl.style.display = "";
    settingsEl.style.display = "none";
    const lobbyBananas = document.getElementById("lobby-bananas");
    const lobbyMode = document.getElementById("lobby-mode");
    const lobbyMax = document.getElementById("lobby-max");
    // Sync controls to current game state without triggering events
    _syncingLobby = true;
    try {
      lobbyBananas.value = String(gs.startingMoney || 5000);
      document.getElementById("lobby-bananas-display").textContent =
        gs.startingMoney || 5000;
      lobbyMode.value = gs.gameMode || "classic";
      if (gs.gameMode === "2v2" || gs.gameMode === "3v3") {
        lobbyMax.value = gs.gameMode === "3v3" ? "6" : "4";
        lobbyMax.disabled = true;
      } else {
        lobbyMax.value = String(gs.maxPlayers || 4);
        lobbyMax.disabled = false;
      }
      document.getElementById("lobby-public").checked = !!gs.isPublic;
      const lobbySuper = document.getElementById("lobby-super-banana-price");
      if (lobbySuper && gs.superBananaPrice != null) lobbySuper.value = gs.superBananaPrice;
      const lobbyAuctTimer = document.getElementById("lobby-farm-auction-timer");
      if (lobbyAuctTimer && gs.farmAuctionTimer != null) lobbyAuctTimer.value = gs.farmAuctionTimer;
      const lobbyCredit = document.getElementById("lobby-credit-start");
      if (lobbyCredit && gs.creditStart != null) lobbyCredit.value = gs.creditStart;
      const lobbyDodeca = document.getElementById("lobby-dodecahedron");
      if (lobbyDodeca) lobbyDodeca.checked = gs.dodecahedron === undefined ? true : !!gs.dodecahedron;
    } finally {
      _syncingLobby = false;
    }
  } else {
    controlsEl.style.display = "none";
    settingsEl.style.display = "";
  }

  // Player count
  const countEl = document.getElementById("lobby-count");
  countEl.textContent = `(${gs.players.length}/${gs.maxPlayers || 4})`;

  // Monkey emoji map
  const monkeyEmoji = {
    brown: "\ud83d\udc35",
    golden: "\ud83d\udc12",
    silver: "\ud83e\udda7",
    red: "\ud83e\udde8",
    purple: "\ud83d\udfe3",
    pink: "\ud83c\udf38",
  };
  const colorNames = {
    brown: "Brown",
    golden: "Golden",
    silver: "Silver",
    red: "Red",
    purple: "Purple",
    pink: "Pink",
  };

  // Player list
  const waitingForLobby = gs.state === "finished" && gs.lobbyReady;
  const list = document.getElementById("lobby-players");
  list.innerHTML = "";
  gs.players.forEach((p, idx) => {
    const div = document.createElement("div");
    const isMe = p.id === myId;
    const notReturned = waitingForLobby && !gs.lobbyReady.includes(p.id);
    div.className = "lobby-player" + (isMe ? " lobby-player-me" : "") + (notReturned ? " lobby-player-away" : "");
    const emoji = monkeyEmoji[p.color] || "\ud83d\udc35";
    const role =
      p.id === gs.admin
        ? '<span class="lobby-player-role">\ud83d\udc51 Host</span>'
        : "";
    const editHint = "";
    const isTeamMode = gs.gameMode === "2v2" || gs.gameMode === "3v3";
    const teamSize = gs.gameMode === "3v3" ? 3 : 2;
    const teamTag = isTeamMode
      ? `<span class="lobby-team-tag lobby-team-tag--${idx < teamSize ? "a" : "b"}">${idx < teamSize ? "Team A" : "Team B"}</span>`
      : "";
    // Team mode: any player can swap themselves to the other team once the
    // lobby is full (matches the backend rule). The button only renders on your
    // own row; for others it's display-only.
    const teamSwitchBtn =
      isTeamMode && isMe && gs.state === "waiting" && gs.players.length === teamSize * 2
        ? `<button class="lobby-btn-switch-team" title="Switch teams">↔️ Switch</button>`
        : "";
    const hostActions = (isHost && !isMe && gs.state === "waiting")
      ? `<div class="lobby-host-actions">
           <button class="lobby-btn-transfer" data-id="${p.id}" title="Transfer host">👑</button>
           <button class="lobby-btn-kick" data-id="${p.id}" title="Kick player">✕</button>
         </div>`
      : "";
    div.innerHTML = `
      <div class="lobby-player-avatar c-${p.color}">${emoji}</div>
      <div class="lobby-player-info">
        <div class="lobby-player-name">${p.name}${editHint}</div>
        ${role}${teamTag}
      </div>
      ${teamSwitchBtn}
      ${hostActions}
    `;

    if (isMe && gs.state === "waiting") {
      const avatar = div.querySelector(".lobby-player-avatar");
      avatar.classList.add("lobby-avatar-clickable");
      avatar.title = "Change color";
      avatar.onclick = (e) => {
        e.stopPropagation();
        toggleColorPicker(div, p.color);
      };
    }

    list.appendChild(div);
  });

  // Empty slots
  const maxP = gs.maxPlayers || 4;
  for (let i = gs.players.length; i < maxP; i++) {
    const slot = document.createElement("div");
    slot.className = "lobby-slot-empty";
    const teamTag =
      gs.gameMode === "2v2" || gs.gameMode === "3v3"
        ? `<span class="lobby-team-tag">${i < (gs.gameMode === "3v3" ? 3 : 2) ? "Team A" : "Team B"}</span>`
        : "";
    slot.innerHTML =
      '<div class="lobby-slot-empty-dot">?</div><span>Waiting\u2026</span>' +
      teamTag;
    list.appendChild(slot);
  }

  // Host action buttons
  list.querySelectorAll(".lobby-btn-transfer").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.id;
      const target = gs.players.find((p) => p.id === targetId);
      if (target && confirm(`Transfer host to ${target.name}?`)) {
        socket.emit("transfer_host", { gameId, targetId });
      }
    };
  });
  list.querySelectorAll(".lobby-btn-kick").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.id;
      const target = gs.players.find((p) => p.id === targetId);
      if (target && confirm(`Remove ${target.name} from the lobby?`)) {
        socket.emit("kick_player", { gameId, targetId });
      }
    };
  });
  list.querySelectorAll(".lobby-btn-switch-team").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      socket.emit("switch_team", { gameId });
    };
  });

  // Waiting indicator
  const waitingEl = document.getElementById("lobby-waiting");
  const waitingTextEl = document.getElementById("lobby-waiting-text");
  if (waitingForLobby) {
    const readyCount = gs.lobbyReady.length;
    const totalCount = gs.players.length;
    waitingEl.style.display = "flex";
    waitingTextEl.textContent =
      `Waiting for players to return (${readyCount}/${totalCount})`;
  } else if (gs.gameMode === "2v2" || gs.gameMode === "3v3") {
    waitingEl.style.display =
      gs.players.length < (gs.maxPlayers || 4) ? "flex" : "none";
    waitingTextEl.textContent = "Waiting for players";
  } else {
    waitingEl.style.display = gs.players.length < 2 ? "flex" : "none";
    waitingTextEl.textContent = "Waiting for players";
  }

  const btn = document.getElementById("btn-start");
  if (waitingForLobby) {
    btn.disabled = true;
  } else if (gs.gameMode === "2v2" || gs.gameMode === "3v3") {
    btn.disabled = !(myId === gs.admin && gs.players.length === (gs.maxPlayers || 4));
  } else {
    btn.disabled = !(myId === gs.admin && gs.players.length >= 2);
  }
  btn.title = "";
}

function toggleColorPicker(playerEl, currentColor) {
  // If picker already open, close it
  const existing = playerEl.querySelector(".lobby-color-picker");
  if (existing) {
    existing.remove();
    return;
  }
  // Close any other open picker
  document.querySelectorAll(".lobby-color-picker").forEach((el) => el.remove());

  const monkeyEmoji = {
    brown: "\ud83d\udc35",
    golden: "\ud83d\udc12",
    silver: "\ud83e\udda7",
    red: "\ud83e\udde8",
    purple: "\ud83d\udfe3",
    pink: "\ud83c\udf38",
  };
  const colors = ["brown", "golden", "silver", "red", "purple", "pink"];

  const picker = document.createElement("div");
  picker.className = "lobby-color-picker";
  colors.forEach((c) => {
    const opt = document.createElement("button");
    opt.className =
      "lobby-color-option" + (c === currentColor ? " active" : "");
    opt.innerHTML = `<span class="lobby-color-dot c-${c}">${monkeyEmoji[c]}</span>`;
    opt.onclick = (e) => {
      e.stopPropagation();
      if (c !== currentColor) {
        socket.emit("change_color", { gameId, color: c });
      }
      picker.remove();
    };
    picker.appendChild(opt);
  });
  playerEl.appendChild(picker);
}

// ── GROW pulse animation ──────────────────────────────
// When a grow tile fires on a rolled number (pre-move), a glow of the roller's
// colour starts on that grow tile and chains clockwise, one tile at a time, to
// the next genuinely-revealed grow (its range). Each of the roller's farms the
// pulse crosses pops its banana pile in at that moment. All grows fired this
// roll pulse simultaneously; longer ranges step a bit faster; a grow that grew
// nothing still pulses, just quickly. This plays BEFORE the token walks.
const SIMPLE_PLAYER_COLOR_HEX = {
  brown: "#e23b3b", // red slot
  golden: "#2e7fe0", // blue slot
  silver: "#ff8c00", // orange slot (was green)
  red: "#8e44ad", // purple slot (was black)
  purple: "#9b59b6", // matches .c-purple (grow pulse / leaver cover)
  pink: "#ff5fa2", // matches .c-pink
};

// Grow positions fired this turn for a given source ("roll" = rolled-number
// match, fires pre-walk; "land" = a grow you landed on, fires after arrival),
// de-duplicated.
function _computeGrowPulseBySource(gs, source) {
  if (
    !gs ||
    (gs.gameMode !== "classic" && gs.gameMode !== "2v2" && gs.gameMode !== "3v3")
  ) {
    return [];
  }
  const act = gs.lastGrowActivated;
  if (!Array.isArray(act) || act.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const a of act) {
    if (!a || a.source !== source || a.pos == null) continue;
    if (seen.has(a.pos)) continue;
    seen.add(a.pos);
    out.push(a.pos);
  }
  return out;
}
function _computePreWalkGrowPulse(gs) {
  return _computeGrowPulseBySource(gs, "roll");
}
function _computeLandGrowPulse(gs) {
  return _computeGrowPulseBySource(gs, "land");
}

// Tiles strictly clockwise after growPos up to (excluding) the next genuinely
// revealed grow. Wraps almost the whole board if no other grow is known yet.
// Mirrors the backend _growRange.
function _growRangePath(gs, growPos) {
  const boardSize = (gs.boardLayout || []).length || 48;
  const revealedGrows = new Set(
    (gs.genuineRevealedGrows || []).filter((p) => p !== growPos),
  );
  const path = [];
  for (let off = 1; off < boardSize; off++) {
    const p = (growPos + off) % boardSize;
    if (revealedGrows.has(p)) break;
    path.push(p);
  }
  return path;
}

function _lightPulseTile(pos, hex, ttlMs) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.style.setProperty("--pulse-color", hex);
  el.classList.add("grow-pulse-on");
  if (el._growPulseTimer) clearTimeout(el._growPulseTimer);
  el._growPulseTimer = setTimeout(() => {
    el.classList.remove("grow-pulse-on");
    el._growPulseTimer = null;
  }, ttlMs);
}

function _growPopTile(pos) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.classList.remove("grow-pop");
  void el.offsetWidth; // restart the animation
  el.classList.add("grow-pop");
  el.addEventListener("animationend", () => el.classList.remove("grow-pop"), {
    once: true,
  });
}

// Fire the "Early Pickup!" floater + burst for a farm the roller stood on when
// it grew (synced to the pulse crossing it). Marks the tile visited so its pile
// renders as collected.
function _firePulseEarlyPickup(gs, cur, pos) {
  const el = document.getElementById("space-" + pos);
  if (el) {
    const r = el.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "early-pickup-floater";
    f.textContent = "Early Pickup!";
    f.style.position = "fixed";
    f.style.left = r.left + r.width / 2 + "px";
    f.style.top = r.top + r.height / 2 + "px";
    f.style.pointerEvents = "none";
    f.style.zIndex = "9999";
    document.body.appendChild(f);
    f.addEventListener("animationend", () => f.remove());
  }
  if (typeof bananaBurst === "function") {
    bananaBurst((gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[pos]) || 1, cur.id);
  }
  if (window._tokenVisitedTiles) window._tokenVisitedTiles.add(pos);
}

// Light a grow TILE's "fired" pop (bouncy scale + yellow G-number) — applied by
// the pulse when its chain fires, so a grow you're about to land on no longer
// glows during the approach walk.
function _fireGrowTileGlow(pos) {
  const el = document.getElementById("space-" + pos);
  if (!el) return;
  el.classList.remove("grow-fired");
  void el.offsetWidth;
  el.classList.add("grow-fired");
  el.addEventListener("animationend", () => el.classList.remove("grow-fired"), {
    once: true,
  });
}

// Bounce a farm's banana count box (even if it already had bananas). The tile
// sits in _pileBounceTiles for one bounce; board.js adds the .pile-bounce class
// while it's there (surviving the chip recreation walkStepUpdate does).
const PILE_BOUNCE_MS = 1000; // pronounced grow bounce duration (see .pile-bounce)
function _bounceFarmPile(pos) {
  if (!window._pileBounceTiles) window._pileBounceTiles = new Set();
  if (!window._pileBounceStart) window._pileBounceStart = {};
  window._pileBounceTiles.add(pos);
  // Record when the bounce began so board.js can resume it (negative
  // animation-delay) after each chip rebuild rather than restarting it.
  window._pileBounceStart[pos] = performance.now();
  setTimeout(() => {
    if (window._pileBounceTiles) window._pileBounceTiles.delete(pos);
    if (window._pileBounceStart) delete window._pileBounceStart[pos];
    // Strip the class directly too: reconcile only removes it on the NEXT
    // render, and if the board idles the chip would keep .pile-bounce's
    // bright box-shadow (and a stale inline animation-delay that would
    // mangle a future .pile-grew bounce) indefinitely.
    const chip = document.querySelector(
      `#board .banana-pile[data-tile="${pos}"]`,
    );
    if (chip) {
      chip.classList.remove("pile-bounce");
      chip.style.animationDelay = "";
    }
  }, PILE_BOUNCE_MS + 80);
}

// Animate the pulse(s) for `growPositions` (simultaneous), then call onAllDone.
// The chain sweep advances at 7 steps/second (≈143ms per tile) by default and
// stays linear. If a chain is long enough that 7/sec would run past 2s, the per-
// tile time shrinks just enough to fit the whole sweep into 2s (still linear) —
// so the sweep never takes longer than 2 seconds. opts.earlyPickup (default
// true) controls the "Early Pickup!" floater — only the pre-walk pulse handles
// it; the landing pulse must not re-fire it.
const GROW_PULSE_RATE = 7; // default steps per second
// Empty fires (no farms in range to grow) zip past at 20 tiles/sec — no piles
// pop in along the chain, so there's nothing for the player to watch and the
// pulse just becomes wasted time.
const GROW_PULSE_RATE_EMPTY = 20;
const GROW_PULSE_MAX_MS = 2000; // hard cap on the whole sweep (then compress, linear)
const GROW_PULSE_BOUNCE_TAIL = 480; // let the last count-box bounce finish
function _runGrowPulse(gs, growPositions, cur, onAllDone, opts) {
  // Stamp the walk generation this pulse belongs to. If a newer roll arrives
  // while the sweep timers are pending (auto-roll, background-tab timer
  // flush), the stale timers must not bounce chips or re-render the old gs
  // over the new walk's frozen board.
  const _pulseGen = window._walkGen;
  const _pulseAlive = () => window._walkGen === _pulseGen;
  const hex = (cur && SIMPLE_PLAYER_COLOR_HEX[cur.color]) || "#ffe135";
  const grownSet = new Set(gs.diceMatchTiles || []);
  const firedSet = new Set(gs.lastGrowFired || []); // grows that actually grew
  const handleEP = !opts || opts.earlyPickup !== false;
  const epTile = handleEP ? gs.diceMatchEarlyPickup : null;
  let epFired = false;
  if (!window._pulseRevealedTiles) window._pulseRevealedTiles = new Set();
  // Track active grow-pulse animation count so the End-Turn countdown can wait
  // for the chain to finish before starting its own 2s tick.
  window._growPulseActive = (window._growPulseActive || 0) + 1;

  let maxTotal = 0;
  for (const growPos of growPositions) {
    const fullPath = [growPos, ..._growRangePath(gs, growPos)];
    const len = fullPath.length || 1;
    const grew = firedSet.has(growPos); // this grow produced bananas
    // 7 tiles/sec normally, but shrink the step so a long chain still fits
    // within 2s. Empty fires (no farms in range) sweep at 20 tiles/sec so the
    // animation doesn't slow the game down when there's nothing to watch.
    const rate = grew ? GROW_PULSE_RATE : GROW_PULSE_RATE_EMPTY;
    const stepMs = Math.min(1000 / rate, GROW_PULSE_MAX_MS / len);
    const totalMs = len * stepMs; // ≤ GROW_PULSE_MAX_MS, linear
    maxTotal = Math.max(maxTotal, totalMs);
    const trailMs = Math.round(stepMs + 350); // glow lingers → comet tail
    for (let k = 0; k < fullPath.length; k++) {
      const pos = fullPath[k];
      const t = Math.round(k * stepMs);
      setTimeout(() => {
        if (!_pulseAlive()) return;
        _lightPulseTile(pos, hex, trailMs);
        // The grow tile itself lights (bouncy pop + text glow) the moment its
        // chain fires — but only when it actually grew something.
        if (k === 0 && grew) _fireGrowTileGlow(pos);
        if (grownSet.has(pos) && !window._pulseRevealedTiles.has(pos)) {
          window._pulseRevealedTiles.add(pos);
          _growPopTile(pos); // per-tile flash (kept alongside the box bounce)
          _bounceFarmPile(pos); // bounce the count box as the chain reaches it
          if (pos === epTile && !epFired) {
            epFired = true;
            _firePulseEarlyPickup(gs, cur, pos);
          }
          if (typeof walkStepUpdate === "function") walkStepUpdate(gs);
        }
      }, t);
    }
    // Small "bump" the moment the chain hits its stop — only for chains that
    // actually grew something. Empty fires zip past silently so a long board
    // of barren grows doesn't become a thud-fest.
    if (grew) {
      setTimeout(() => {
        if (_pulseAlive() && typeof playGrowChainStop === "function")
          playGrowChainStop();
      }, Math.round((len - 1) * stepMs));
    }
  }

  setTimeout(() => {
    // Safety net: if the early-pickup tile somehow wasn't on a pulse path, still
    // fire it so the pickup reads before the walk.
    if (epTile != null && !epFired && _pulseAlive())
      _firePulseEarlyPickup(gs, cur, epTile);
    // ALWAYS release the active counter (even when stale) so the end-turn
    // ticker never wedges on an abandoned pulse.
    window._growPulseActive = Math.max(0, (window._growPulseActive || 1) - 1);
    if (typeof onAllDone === "function" && _pulseAlive()) onAllDone();
  }, maxTotal + GROW_PULSE_BOUNCE_TAIL);
}

// ── End-of-turn signal ─────────────────────────────────────────────────
// There is no End Turn button and no countdown — the lander's client emits
// turn_anims_complete the instant every visible animation for the turn has
// settled (walk, dice spin, pre-walk grow chain pulse, post-walk grow chain
// pulse, landing FX), and the server advances to the next player on receipt.
// A 100 ms ticker watches the anim flags so we fire the moment they clear.
function _ensureEndTurnTicker() {
  if (window._endTurnTicker) return;
  window._endTurnTicker = setInterval(_tickEndTurnCountdown, 100);
}
function _tickEndTurnCountdown() {
  if (!gs || !gs.players) return;
  const isMyTurnNow =
    gs.currentPlayer && gs.currentPlayer.id === myId && !gs.gameOver;
  const overlayOpen =
    !!gs.auction ||
    !!gs.poker ||
    !!gs.superBananaPending ||
    // The claim/accuse window: the walk commits at claim time (diceRolled is
    // already true mid-window), but the server REFUSES turn_anims_complete
    // while pendingAction/accuse are open — and the signal is latched
    // once-per-turn, so firing it early would leave the turn to the 30s
    // safety net. Hold it until the window fully resolves.
    !!gs.pendingAction ||
    !!gs.accuse ||
    gs.turnPhase === "claiming" ||
    gs.turnPhase === "accusing";
  const animsBlocking = !!(
    window._tokenWalking ||
    window._diceRollingPositions ||
    (window._growPulseActive && window._growPulseActive > 0) ||
    // _growPulsePending bridges the 250 ms gap between walk-end and the
    // post-landing grow chain pulse starting. Without it the ticker fires
    // turn_anims_complete during that gap.
    (window._growPulsePending && window._growPulsePending > 0) ||
    (window._landingFxBusyUntil && Date.now() < window._landingFxBusyUntil)
  );
  // Reset the per-turn latch when the turn changes.
  if (window._endTurnTurnKey !== gs.turn) {
    window._endTurnTurnKey = gs.turn;
    window._endTurnSignalSent = false;
  }
  // Fire the signal once per turn, the instant every animation settles.
  const canSignal =
    isMyTurnNow && gs.diceRolled && !overlayOpen && !animsBlocking;
  if (canSignal && !window._endTurnSignalSent) {
    window._endTurnSignalSent = true;
    if (socket && gameId) {
      socket.emit("turn_anims_complete", { gameId, turn: gs.turn });
    }
  }
}

// ── Money Deduction Popup ──────────────────────────────────────────
// CONTRACT: call ONLY when the player's banana score has just decreased.
// The general money-delta detector in the game_update handler is the
// authoritative caller; other call sites must already know money went down
// (e.g. deferred deductions from that same detector). The amount guard below
// silently no-ops on 0/negative amounts so a stray call can't draw stray
// flying bananas. Pair with bananaBurst() for the inverse (score went up).
// Fires the canonical loss visual bundle: bananas flying OUT of the player's
// piece (capped at 5 emojis) + red "-N🍌" floater near their score. The
// red score-wheel flash is driven by _animateMoneyWheel on the actual money
// element update.
// Push out the "no animations running" deadline so the End-Turn countdown waits
// for landing FX (banana rain, +/- money floaters, steal text) to settle.
function _touchLandingFx(ms) {
  const dur = Math.max(0, Number(ms) || 0);
  const until = Date.now() + dur;
  if (!window._landingFxBusyUntil || window._landingFxBusyUntil < until) {
    window._landingFxBusyUntil = until;
  }
}

// Spawn a floating "+N🍌"/"-N🍌" delta centered on a given anchor element.
// Used both near the player's banana score AND at their board token (the latter
// adds extra punch right on the piece).
function _spawnDeltaFloat(anchorEl, text, cls) {
  if (!anchorEl) return;
  const r = anchorEl.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.className = cls;
  popup.textContent = text;
  popup.style.position = "fixed";
  popup.style.left = r.left + r.width / 2 + "px";
  popup.style.top = r.top + "px";
  popup.style.pointerEvents = "none";
  popup.style.zIndex = "1000";
  document.body.appendChild(popup);
  popup.addEventListener("animationend", () => popup.remove());
}

// The player's on-board token, or null when they have no piece on the board.
function _playerTokenEl(playerId) {
  let a = playerId
    ? document.querySelector(`.token[data-player-id="${playerId}"]`)
    : null;
  if (!a && playerId === myId) a = document.querySelector(".token-me");
  return a;
}

function _showMoneyDeduction(playerId, amount) {
  if (!amount || amount <= 0) return;
  _touchLandingFx(1200);
  const player = gs && gs.players && gs.players.find((p) => p.id === playerId);
  if (player != null) {
    let anchor = document.querySelector(`.token[data-player-id="${playerId}"]`);
    if (!anchor && playerId === myId) anchor = document.querySelector(".token-me");
    if (!anchor) {
      const pstat = document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-monkey`);
      if (pstat) anchor = pstat;
    }
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const count = Math.min(5, Math.max(1, Math.floor(amount)));
      for (let i = 0; i < count; i++) {
        const el = document.createElement("span");
        el.className = "banana-burst-icon";
        el.textContent = "\ud83c\udf4c";
        el.style.left = originX + "px";
        el.style.top = originY + "px";
        const dx = (Math.random() - 0.5) * 160;
        const dy = -(60 + Math.random() * 140);
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--dy", dy + "px");
        el.style.fontSize = 0.9 + Math.random() * 0.9 + "em";
        el.style.animationDelay = Math.random() * 0.2 + "s";
        document.body.appendChild(el);
        el.addEventListener("animationend", () => el.remove());
      }
    }
    // Red negative text near the player's banana total AND at their board token.
    const isMe = playerId === myId;
    const moneyAnchor = isMe
      ? document.getElementById("info-money")
      : document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-money`);
    const lossText = `-${amount}\ud83c\udf4c`;
    _spawnDeltaFloat(moneyAnchor, lossText, "money-deduction-float");
    _spawnDeltaFloat(_playerTokenEl(playerId), lossText, "money-deduction-float");
  }
}

// ── Animated Money Counter ─────────────────────────────────────────

function _animateMoneyEl(el, targetVal, suffix) {
  if (!el) return;
  suffix = suffix || "\ud83c\udf4c";
  // Per-digit slot-machine wheel \u2014 each reel spins upward on a gain,
  // downward on a loss.
  if (typeof gs !== "undefined" && gs) {
    _animateMoneyWheel(el, targetVal, suffix);
    return;
  }
  // Skip if already displaying or animating toward this target
  if (el._moneyAnimTarget === targetVal) return;
  el._moneyAnimTarget = targetVal;
  // Parse current displayed number
  const currentText = el.textContent || "";
  const currentVal = parseInt(currentText.replace(/[^\d-]/g, ""), 10);
  if (isNaN(currentVal) || currentVal === targetVal) {
    el.textContent = `${targetVal}${suffix}`;
    return;
  }
  // Cancel any in-progress animation on this element
  if (el._moneyAnimFrame) cancelAnimationFrame(el._moneyAnimFrame);
  if (el._moneyFlashTimer) clearTimeout(el._moneyFlashTimer);

  const diff = targetVal - currentVal;
  const absDiff = Math.abs(diff);
  // Scale duration with the change amount: small changes ~400ms, large changes up to 1200ms
  const duration = Math.min(1200, Math.max(400, absDiff * 2));
  const startTime = performance.now();
  const startVal = currentVal;

  // Add color flash class
  if (diff > 0) {
    el.classList.add("money-anim-up");
    el.classList.remove("money-anim-down");
  } else {
    el.classList.add("money-anim-down");
    el.classList.remove("money-anim-up");
  }

  let prevDisplayVal = startVal;
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    // Ease-in-out: fast in the middle, slows at both ends for a realistic counter feel
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const val = Math.round(startVal + diff * eased);
    if (val !== prevDisplayVal) {
      el.textContent = `${val}${suffix}`;
      prevDisplayVal = val;
    }
    if (t < 1) {
      el._moneyAnimFrame = requestAnimationFrame(tick);
    } else {
      el.textContent = `${targetVal}${suffix}`;
      el._moneyAnimFrame = null;
      // Remove color flash after a brief hold
      el._moneyFlashTimer = setTimeout(() => {
        el._moneyFlashTimer = null;
        el.classList.remove("money-anim-up", "money-anim-down");
      }, 400);
    }
  }
  el._moneyAnimFrame = requestAnimationFrame(tick);
}

// ── Slot-machine money wheel ───────────────────────
//
// Each digit position is its own reel: a vertical strip of digits that
// slides through the visible 1-em-tall window. Gains spin the reels
// UPWARD (digits scroll up out of view, new digits rise in from below);
// losses spin DOWNWARD. After the animation settles the element's text
// content is reset to the plain `${target}${suffix}` string so anything
// that reads textContent (the parser at the top of _animateMoneyEl, for
// example) sees a normal number again.
function _animateMoneyWheel(el, targetVal, suffix) {
  if (!el) return;
  suffix = suffix || "🍌";
  if (typeof targetVal !== "number" || !Number.isFinite(targetVal)) return;
  targetVal = Math.round(targetVal);

  // Treat a re-call with the same target as a no-op so frequent renders
  // don't restart the spin from scratch.
  if (el._wheelTarget === targetVal) return;

  // Resolve current value: prefer the cached "last target" (accurate even
  // mid-spin) over parsing textContent (which during a spin contains every
  // digit on every reel concatenated).
  let currentVal = el._wheelTarget;
  if (currentVal == null) {
    const raw = (el.textContent || "").replace(/[^\d-]/g, "");
    currentVal = parseInt(raw, 10);
  }
  if (!Number.isFinite(currentVal)) currentVal = targetVal;

  el._wheelTarget = targetVal;

  if (currentVal === targetVal) {
    if (el._wheelTimer) {
      clearTimeout(el._wheelTimer);
      el._wheelTimer = null;
    }
    el.textContent = `${targetVal}${suffix}`;
    return;
  }

  // Cancel any settle timer from a prior spin so we don't snap text away
  // while the new spin is running.
  if (el._wheelTimer) {
    clearTimeout(el._wheelTimer);
    el._wheelTimer = null;
  }

  const direction = targetVal > currentVal ? "up" : "down";
  const currentAbs = Math.abs(currentVal);
  const targetAbs = Math.abs(targetVal);
  const currentStr = String(currentAbs);
  const targetStr = String(targetAbs);
  const maxLen = Math.max(currentStr.length, targetStr.length);
  const padCurrent = currentStr.padStart(maxLen, "0");
  const padTarget = targetStr.padStart(maxLen, "0");

  // Per-step duration (~70 ms feels like a real slot reel), with a min and
  // max so tiny changes don't feel instant and huge ones don't drag.
  const absDiff = Math.abs(targetVal - currentVal);
  const baseMs = Math.min(950, Math.max(450, 350 + Math.log10(absDiff + 1) * 220));

  // Rebuild the element: optional sign, N reels, suffix.
  el.innerHTML = "";
  if (targetVal < 0) {
    const sign = document.createElement("span");
    sign.className = "money-sign";
    sign.textContent = "-";
    el.appendChild(sign);
  }

  const reelAnimators = [];
  for (let i = 0; i < maxLen; i++) {
    // A leading position that only exists because of padStart (the number
    // genuinely has no digit there) is rendered as a blank — NOT a literal
    // "0" — so a shorter→longer or longer→shorter change doesn't flash a
    // stray zero at the most significant position. Interior positions always
    // have a real digit on both sides.
    const currentHasDigit = i >= maxLen - currentStr.length;
    const targetHasDigit = i >= maxLen - targetStr.length;
    const fromChar = currentHasDigit ? padCurrent[i] : "";
    const toChar = targetHasDigit ? padTarget[i] : "";
    const built = _buildMoneyReel(fromChar, toChar, direction);
    el.appendChild(built.reel);
    reelAnimators.push(built.animate);
  }

  const sfx = document.createElement("span");
  sfx.className = "money-suffix";
  sfx.textContent = suffix;
  el.appendChild(sfx);

  if (direction === "up") {
    el.classList.add("money-anim-up");
    el.classList.remove("money-anim-down");
  } else {
    el.classList.add("money-anim-down");
    el.classList.remove("money-anim-up");
  }

  // Kick off the CSS transitions on the next frame so the initial transform
  // is committed first (otherwise the browser would collapse start+end into
  // a single repaint and skip the animation).
  requestAnimationFrame(() => {
    for (const fn of reelAnimators) fn(baseMs);
  });

  // After the spin settles, flatten back to plain text so future reads
  // (or callers that snapshot textContent) see a clean number.
  el._wheelTimer = setTimeout(() => {
    el._wheelTimer = null;
    // Guard against a newer spin having claimed the element already.
    if (el._wheelTarget !== targetVal) return;
    el.textContent = `${targetVal}${suffix}`;
    setTimeout(() => {
      if (el._wheelTarget !== targetVal) return;
      el.classList.remove("money-anim-up", "money-anim-down");
    }, 380);
  }, baseMs + 120);
}

// `fromChar`/`toChar` are single-character strings: a digit "0".."9", or ""
// for a leading position that doesn't exist on that side of the change (a
// digit appearing or vanishing). Blank ends produce a single-step slide so
// no stray "0" is ever shown at the most significant position.
function _buildMoneyReel(fromChar, toChar, direction) {
  const reel = document.createElement("span");
  reel.className = "money-digit-reel";

  if (fromChar === toChar) {
    const digit = document.createElement("span");
    digit.className = "money-digit";
    digit.textContent = toChar;
    reel.appendChild(digit);
    return { reel, animate: () => {} };
  }

  // Build the sequence of characters the reel passes through (rendered top to
  // bottom in `sequence` order). A blank endpoint — a digit sliding into or
  // out of existence — is a simple two-entry slide rather than a 0..9 roll.
  let sequence;
  if (fromChar === "" || toChar === "") {
    sequence = [fromChar, toChar];
  } else {
    // Walk the digits from `fromChar` toward `toChar` in the chosen direction
    // (wrapping 0..9). Sequence always starts with fromChar and ends with
    // toChar; for a 1-step change that's two entries.
    const fromDigit = parseInt(fromChar, 10);
    const toDigit = parseInt(toChar, 10);
    const digits = [fromDigit];
    let cur = fromDigit;
    const advance =
      direction === "up"
        ? (d) => (d + 1) % 10
        : (d) => (d - 1 + 10) % 10;
    while (cur !== toDigit) {
      cur = advance(cur);
      digits.push(cur);
    }
    sequence = digits.map(String);
  }

  // UP: strip in natural order, scroll up (translateY 0 → -(N-1)em) so the
  //     visible digit climbs through higher values.
  // DOWN: strip reversed, scroll down (translateY -(N-1)em → 0) so visible
  //       digits appear to fall toward smaller values.
  const stripItems = direction === "up" ? sequence : [...sequence].reverse();
  const totalSteps = sequence.length - 1;

  const strip = document.createElement("span");
  strip.className = "money-digit-strip";
  for (const d of stripItems) {
    const digit = document.createElement("span");
    digit.className = "money-digit";
    digit.textContent = String(d);
    strip.appendChild(digit);
  }
  reel.appendChild(strip);

  // Set the initial transform so the strip starts with fromDigit in view.
  const startTransform =
    direction === "up" ? "translateY(0)" : `translateY(-${totalSteps}em)`;
  const endTransform =
    direction === "up" ? `translateY(-${totalSteps}em)` : "translateY(0)";
  strip.style.transform = startTransform;

  return {
    reel,
    animate: (durationMs) => {
      // Force layout so the start transform is committed before we set the
      // end transform — otherwise the browser short-circuits the transition.
      void strip.offsetHeight;
      strip.style.transition = `transform ${durationMs}ms cubic-bezier(0.34, 0.04, 0.18, 1)`;
      strip.style.transform = endTransform;
    },
  };
}

// ── Property Card Flip Animation ───────────────────────────────────

function _showPropertyCardFlip(propName, propGroup, propPrice, timeStr, isWin) {
  // Remove any existing card flip overlay
  const existing = document.getElementById("prop-card-flip-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "prop-card-flip-overlay";
  overlay.className = "prop-card-flip-overlay";

  const card = document.createElement("div");
  card.className = "prop-card-flip" + (isWin ? " prop-card-flip-win" : " prop-card-flip-miss");

  // Front face (question mark)
  const front = document.createElement("div");
  front.className = "prop-card-face prop-card-front";
  front.innerHTML = `<span class="prop-card-q">?</span>`;

  // Back face (property details). Structure:
  //   header  \u2014 "FARM" label sits inside the group-coloured banner
  //   name    \u2014 the big farm name (focal point)
  //   yield   \u2014 pill showing the per-grow yield
  //   stamp   \u2014 diagonal BOUGHT / MISSED sticker overlaid on top
  //   time    \u2014 optional small "(Xs)" footer for accept speed
  const back = document.createElement("div");
  back.className =
    "prop-card-face prop-card-back" + (propGroup ? " g-" + propGroup : "");
  const header = `<div class="prop-card-header">FARM</div>`;
  const safeName = String(propName || "").replace(/[<&>]/g, (c) =>
    ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" })[c],
  );
  // Long names shrink to fit so the card doesn't overflow.
  const nameSizeClass =
    safeName.length > 10
      ? " prop-card-name-xs"
      : safeName.length > 6
        ? " prop-card-name-sm"
        : "";
  const name = `<div class="prop-card-name${nameSizeClass}">${safeName}</div>`;
  const yieldPill = propPrice
    ? `<div class="prop-card-yield">
         <span class="prop-card-yield-num">${propPrice}\ud83c\udf4c</span>
         <span class="prop-card-yield-label">per grow</span>
       </div>`
    : "";
  const stamp = isWin
    ? `<div class="prop-card-stamp">BOUGHT</div>`
    : `<div class="prop-card-stamp prop-card-stamp-miss">MISSED</div>`;
  const time =
    isWin && timeStr ? `<div class="prop-card-time">${timeStr}</div>` : "";
  back.innerHTML = header + name + yieldPill + stamp + time;

  card.appendChild(front);
  card.appendChild(back);
  overlay.appendChild(card);

  const boardWrap = document.querySelector(".board-wrap");
  (boardWrap || document.body).appendChild(overlay);

  // Trigger flip after brief delay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add("flipped");
    });
  });

  // Auto-remove after animation
  setTimeout(() => {
    overlay.classList.add("prop-card-flip-out");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 600);
  }, isWin ? 3200 : 2800);
}

