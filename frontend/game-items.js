// ── Spell Cards ─────────────────────────────────────────
// Each player holds CONCEALED spell cards (ints 1..6) in `rollCards`
// (private to the owner; 7 to start + more earned via draws). They're
// playable on your own turn (before you roll) and move you exactly that many
// tiles. The per-die buttons live in #magic-dice-list (rendered in
// game-screen.js); clicking one calls useRollCard(index).
function useRollCard(index) {
  if (!socket || !gameId) return;
  socket.emit("use_roll_card", { gameId, index });
}

// ── Arm / disarm a spell card (pre-selection) ─────────────────
// Arm a roll by value: a private queued selection that AUTO-ACTIVATES at the
// start of your turn (unless you disarm first). disarmRollCard clears it;
// re-arming a different value replaces it. Server validates you hold that value.
function armRollCard(value) {
  if (!socket || !gameId) return;
  socket.emit("arm_roll_card", { gameId, value });
  // Arming shows the cyan armed-roll path; switch the yellow Path Preview off so
  // the two overlays don't fight for attention.
  if (window._stepHiOn && typeof togglePathPreview === "function") {
    togglePathPreview(false);
  }
}

function disarmRollCard() {
  if (!socket || !gameId) return;
  socket.emit("disarm_roll_card", { gameId });
  // Optimistic clear: drop my armed state + repaint NOW so the cyan armed-path
  // outline vanishes immediately instead of lingering until the server's next
  // game_update (a re-render in that gap would otherwise still see armedRoll).
  const me =
    typeof _gsPlayerMap !== "undefined" && _gsPlayerMap ? _gsPlayerMap[myId] : null;
  if (me) me.armedRoll = null;
  if (!window._tokenWalking && typeof _renderBoardNow === "function") _renderBoardNow();
}

// ── "+6" mode toggle ──────────────────────────────────────────
// While ON, playing a spell card of value N rolls N + 6 (7..12): you walk its
// FULL value (no 7-N inversion) and it never grow-matches. Private per-player.
function togglePlusSix() {
  if (!socket || !gameId) return;
  const me =
    typeof _gsPlayerMap !== "undefined" && _gsPlayerMap ? _gsPlayerMap[myId] : null;
  const on = !(me && me.plusSixRolls);
  socket.emit("set_plus_six", { gameId, on });
  // Optimistic flip so the chips + button + subtitle update immediately; the
  // server's game_update re-renders authoritatively right after.
  if (me) me.plusSixRolls = on;
  if (typeof showGame === "function") showGame();
}

// ── Teleport to one of your own farms ─────────────────────────
// INSTEAD OF ROLLING you may teleport to a farm you own (costs two random
// Spell Cards). Clicking the Teleport button enters a board "pick mode": your
// owned farms glow cyan — click one to jump there. Clicking the button again
// cancels. If you've been cancelled this turn the jump is denied server-side —
// you still discard the two cards but roll your default dice instead.
function toggleTeleportMode() {
  if (!socket || !gameId || !gs) return;
  if (window._teleportPickMode) {
    window._teleportPickMode = false;
  } else {
    const me = _gsPlayerMap[myId];
    const runeCount = me
      ? (typeof me.rollCardCount === "number" ? me.rollCardCount : (me.rollCards || []).length)
      : 0;
    const farms = (gs.properties || []).filter(
      (p) => p && p.group === "farm" && p.owner === myId,
    );
    if (farms.length === 0) {
      showToast("You don't own any farms to teleport to yet.", "info", 2500);
      return;
    }
    if (runeCount < 2) {
      showToast("Teleporting costs two Spell Cards — you need at least 2.", "info", 2500);
      return;
    }
    window._teleportPickMode = true;
    showToast("✨ Click one of your glowing farms to teleport there (costs 2 cards).", "info", 3500);
  }
  if (typeof route === "function") route();
  else if (typeof _renderBoardNow === "function") _renderBoardNow();
}

// Emit the teleport once a destination farm tile is chosen (called from the
// board click delegation in board.js).
function emitTeleportToFarm(position) {
  if (!socket || !gameId) return;
  const me = _gsPlayerMap[myId];
  const cards = me && Array.isArray(me.rollCards) ? me.rollCards : [];
  // Teleport costs TWO spell cards — let the player CHOOSE which two, then emit
  // the jump with the chosen indices. Cancelling the picker keeps pick-mode on so
  // they can pick a different farm (or tap Teleport again to back out).
  openCardDiscardPicker({
    mode: "teleport",
    cards,
    count: 2,
    dismissible: true,
    onConfirm: (indices) => {
      socket.emit("teleport_to_farm", { gameId, position, discardIndices: indices });
      window._teleportPickMode = false;
    },
  });
}

// ── Cancel Opponent Card ability ──────────────────────────────
// Secretly predict that a chosen player plays a spell card on their NEXT turn.
// UNLIMITED casts — the only requirement is holding AT LEAST 3 spell cards. If
// they play a card that turn it's nullified (they roll 2d6) and you DRAW a card;
// if they don't, you LOSE two cards (with one deny). The result is private to
// you (your modal); the cancel itself stays secret until the target acts.
// Free-for-all targets any player; team mode (2v2/3v3) targets opponents only.
function useCancelItems() {
  if (!socket || !gameId || !gs) return;
  if (gs.gameMode !== "classic" && gs.gameMode !== "2v2" && gs.gameMode !== "3v3") return;
  const me = _gsPlayerMap[myId];
  const runeCount = me
    ? (typeof me.rollCardCount === "number" ? me.rollCardCount : (me.rollCards || []).length)
    : 0;
  if (!me || runeCount < 3) {
    showToast("You need at least 3 Spell Cards to cancel.", "info", 2500);
    return;
  }
  openCancelTargetPicker();
}

function _cancelTeamKeyOf(pid) {
  const t = gs && gs.teams;
  if (!t) return null;
  if (t.A && t.A.includes(pid)) return "A";
  if (t.B && t.B.includes(pid)) return "B";
  return null;
}

// Target chooser: pick whose next turn to predict. Free-for-all lists every
// other living player; 2v2 lists only opposing players. Targets are NOT filtered
// by who's already under a cancel — the cancel is secret, so the picker must not
// reveal it (a doubled-up cast just no-ops server-side).
function openCancelTargetPicker() {
  const isTeams = gs.gameMode === "2v2" || gs.gameMode === "3v3";
  const myTeam = isTeams ? _cancelTeamKeyOf(myId) : null;
  const opps = (gs.players || []).filter(
    (p) =>
      p.id !== myId &&
      !p.bankrupt &&
      !p.ghost && // a ghost only rolls a plain 2d6 — a cancel could never land
      (!isTeams || _cancelTeamKeyOf(p.id) !== myTeam),
  );
  if (opps.length === 0) {
    showToast("No one to cancel right now.", "info", 3000);
    return;
  }
  const prev = document.getElementById("cancel-target-overlay");
  if (prev) prev.remove();
  const emoji = (typeof MONKEY_EMOJI !== "undefined" && MONKEY_EMOJI) || {};
  const overlay = document.createElement("div");
  overlay.id = "cancel-target-overlay";
  overlay.className = "cancel-target-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  const box = document.createElement("div");
  box.className = "cancel-target-box";
  const title = document.createElement("div");
  title.className = "cancel-target-title";
  title.textContent = "🚫 Cancel whose spell card?";
  const sub = document.createElement("div");
  sub.className = "cancel-target-sub";
  sub.textContent =
    "Predict their NEXT turn: if they play a card it's blocked and you DRAW a card; if they don't, you LOSE two cards (with one deny). Needs 3+ cards to cast.";
  box.appendChild(title);
  box.appendChild(sub);
  for (const o of opps) {
    const b = document.createElement("button");
    b.className = "btn cancel-target-opt c-" + o.color;
    b.textContent = `${emoji[o.color] || "🐵"} ${o.name}`;
    b.addEventListener("click", () => {
      socket.emit("cancel_items", { gameId, targetId: o.id });
      showToast(`🚫 You're set to cancel ${o.name}'s next spell card.`, "info", 3000);
      overlay.remove();
    });
    box.appendChild(b);
  }
  const dismiss = document.createElement("button");
  dismiss.className = "btn cancel-target-dismiss";
  dismiss.textContent = "Never mind";
  dismiss.addEventListener("click", () => overlay.remove());
  box.appendChild(dismiss);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// Shared "choose which spell cards to discard" picker. Renders the viewer's hand
// as tappable chips; the player selects exactly `count`, then confirms. Used by
// TELEPORT (the 2-card cost) and the MISSED-CANCEL penalty (the cards you forfeit).
// onConfirm receives the chosen INDICES into the hand. A `dismissible` picker
// (teleport) can be backed out of; a non-dismissible one (cancel miss) must be
// resolved. If the hand is empty it resolves immediately with no UI.
function openCardDiscardPicker(opts) {
  opts = opts || {};
  const me = _gsPlayerMap[myId];
  const cards = Array.isArray(opts.cards)
    ? opts.cards
    : me && Array.isArray(me.rollCards)
      ? me.rollCards
      : [];
  const count = Math.max(1, Math.min(opts.count || 2, cards.length));
  const dismissible = !!opts.dismissible;
  const onConfirm = typeof opts.onConfirm === "function" ? opts.onConfirm : () => {};
  const onCancel = typeof opts.onCancel === "function" ? opts.onCancel : () => {};
  // Nothing to choose -> resolve immediately (the caller/server caps the loss).
  if (cards.length === 0) {
    onConfirm([]);
    return;
  }

  let defaultTitle = "Choose cards to discard";
  if (opts.mode === "teleport") defaultTitle = "✨ Teleport — discard 2 cards";
  else if (opts.mode === "cancel-miss") defaultTitle = "💢 Your cancel missed!";

  const prev = document.getElementById("card-discard-overlay");
  if (prev) prev.remove();

  const overlay = document.createElement("div");
  overlay.id = "card-discard-overlay";
  overlay.className = "card-discard-overlay";
  // Tag the picker so the per-frame render can tell a cancel-miss picker from a
  // teleport one and detect when the owed count changed (-> close + re-open).
  overlay.dataset.mode = opts.mode || "";
  overlay.dataset.discardCount = String(count);
  if (dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        onCancel();
      }
    });
  }
  const box = document.createElement("div");
  box.className = "card-discard-box";
  const title = document.createElement("div");
  title.className = "card-discard-title";
  title.textContent = opts.title || defaultTitle;
  const sub = document.createElement("div");
  sub.className = "card-discard-sub";
  box.appendChild(title);
  box.appendChild(sub);

  const grid = document.createElement("div");
  grid.className = "card-discard-chips";
  box.appendChild(grid);

  const selected = new Set();
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn card-discard-confirm";
  confirmBtn.disabled = true;

  const refresh = () => {
    sub.textContent =
      "Select " + count + " card" + (count === 1 ? "" : "s") +
      " to discard — " + selected.size + "/" + count + " chosen.";
    confirmBtn.disabled = selected.size !== count;
    confirmBtn.textContent =
      selected.size === count
        ? "Discard " + count + " card" + (count === 1 ? "" : "s")
        : "Pick " + (count - selected.size) + " more";
  };

  cards.forEach((v, i) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "roll-chip roll-chip-concealed roll-chip-split card-discard-chip";
    // Same GREEN value / PURPLE walk split as the hand chips so cards are
    // recognizable; you select by the green number (the card's value).
    chip.innerHTML =
      '<span class="roll-chip-grow">' + escapeHtml(String(v)) + "</span>" +
      '<span class="roll-chip-walk">' + escapeHtml(String(7 - v)) + "</span>";
    chip.setAttribute("aria-label", "spell card " + v);
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      if (selected.has(i)) {
        selected.delete(i);
        chip.classList.remove("is-selected");
        chip.setAttribute("aria-pressed", "false");
      } else if (selected.size < count) {
        selected.add(i);
        chip.classList.add("is-selected");
        chip.setAttribute("aria-pressed", "true");
      }
      refresh();
    });
    grid.appendChild(chip);
  });

  confirmBtn.addEventListener("click", () => {
    if (selected.size !== count) return;
    overlay.remove();
    onConfirm([...selected]);
  });
  box.appendChild(confirmBtn);

  if (dismissible) {
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn card-discard-dismiss";
    cancelBtn.textContent = "Never mind";
    cancelBtn.addEventListener("click", () => {
      overlay.remove();
      onCancel();
    });
    box.appendChild(cancelBtn);
  }

  refresh();
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leaveGame() {
  const goOverlay = document.getElementById("game-over-overlay");
  if (goOverlay) goOverlay.style.display = "none";
  if (gameId && gs && gs.state === "finished") {
    // Signal this player is ready to return to lobby
    window._returnedToLobby = true;
    socket.emit("return_to_lobby", { gameId });
    route();
  } else {
    if (gameId) socket.emit("leave_game", { gameId });
    gameId = null;
    gs = null;
    showScreen("screen-menu");
  }
}
