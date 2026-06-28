// ── Poker UI ───────────────────────────────────────────────────────

function pokerFold() {
  if (socket && gameId) socket.emit("poker_action", { gameId, action: "fold" });
}

function pokerCheck() {
  if (socket && gameId)
    socket.emit("poker_action", { gameId, action: "check" });
}

function pokerCall() {
  if (socket && gameId) socket.emit("poker_action", { gameId, action: "call" });
}

// Validate the typed raise-to amount and show how many bananas it commits
// (the amount on top of what you've already bet this round). Also enables /
// disables the Raise button.
function updatePokerRaiseDisplay() {
  const input = document.getElementById("poker-raise-input");
  const disp = document.getElementById("poker-raise-display");
  if (!input || !disp) return;
  const me = _gsPlayerMap[myId];
  const pk = gs && gs.poker;
  const myPk = pk && pk.players && pk.players[myId];
  const raiseBtn = document.querySelector(".poker-btn-raise");
  if (!me || !pk || !myPk) {
    disp.textContent = "";
    return;
  }
  const val = parseInt(input.value);
  const minRaiseTo = parseInt(input.min) || 1;
  const maxRaiseTo = parseInt(input.max) || 0;
  const valid = !isNaN(val) && val >= minRaiseTo && val <= maxRaiseTo;
  if (raiseBtn) raiseBtn.disabled = input.disabled || !valid;
  if (!valid) {
    disp.textContent = `min ${minRaiseTo}🍌`;
    return;
  }
  const commit = val - myPk.bet;
  disp.textContent =
    commit >= me.money ? "ALL IN" : `+${commit}🍌`;
}

function pokerRaise() {
  const input = document.getElementById("poker-raise-input");
  const amount = input ? parseInt(input.value) : NaN;
  if (socket && gameId && !isNaN(amount))
    socket.emit("poker_action", { gameId, action: "raise", amount });
}

function pokerAllIn() {
  // Shove everything you have. If that isn't enough to out-raise the current
  // bet, it's a call for less (all-in call).
  const me = _gsPlayerMap[myId];
  const pk = gs && gs.poker;
  const myPk = pk && pk.players && pk.players[myId];
  if (!socket || !gameId || !me || !pk || !myPk) return;
  const shoveTo = myPk.bet + me.money;
  if (shoveTo > pk.currentBet) {
    socket.emit("poker_action", { gameId, action: "raise", amount: shoveTo });
  } else {
    socket.emit("poker_action", { gameId, action: "call" });
  }
}

function pokerDismiss() {
  if (socket && gameId) socket.emit("poker_dismiss", { gameId });
}

// ── On-screen bet keypad ───────────────────────────────────────────
// A clickable numpad for the raise input, toggled by the 🔢 button in the
// raise row. Lives in static HTML (index.html) so the live poker re-render
// never blows away its open/closed state.
function togglePokerKeypad() {
  const pad = document.getElementById("poker-keypad");
  const toggle = document.getElementById("poker-keypad-toggle");
  if (!pad) return;
  const open = pad.classList.toggle("open");
  if (toggle) {
    toggle.classList.toggle("active", open);
    toggle.title = open ? "Close bet keypad" : "Open bet keypad";
  }
}

function pokerKeypadPress(key) {
  const input = document.getElementById("poker-raise-input");
  if (!input || input.disabled) return;
  if (key === "clear") {
    input.value = "";
  } else if (key === "back") {
    input.value = input.value.slice(0, -1);
  } else if (key === "min") {
    input.value = input.min || "";
  } else if (key === "max") {
    input.value = input.max || "";
  } else {
    // Digit: append. Cap the length so a held-down key can't build an
    // absurd number (max raise is always well under 7 digits).
    if (input.value.length < 7) input.value += key;
  }
  updatePokerRaiseDisplay();
}

function togglePokerGuide() {
  const guide = document.getElementById("poker-guide");
  guide.style.display = guide.style.display === "none" ? "" : "none";
}

function toggleAutoAll(on) {
  // Only affect checkboxes inside the toggles panel, and skip Auto All itself.
  const panel = document.getElementById("toggles-panel");
  if (!panel) return;
  const boxes = panel.querySelectorAll('input[type="checkbox"]');
  for (const box of boxes) {
    if (box.id === "chk-auto-all") continue;
    if (box.checked === on) continue;
    box.checked = on;
    // Fire change events so onchange handlers (Reveal All, No Timer) run.
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function toggleNoTimer() {
  const checked = document.getElementById("chk-no-timer").checked;
  if (socket && gameId) {
    socket.emit("toggle_no_timer", { gameId, noTimer: checked });
  }
}

function toggleRevealAll() {
  revealAll = document.getElementById("chk-reveal").checked;
  // The server fogs unrevealed tiles before sending them, so the client flag
  // alone can't reveal anything — ask the server to (un)redact the board for us.
  // It re-sends our state (a game_update re-render follows); honored in DEBUG
  // builds only. The local renderBoard is an immediate pass for already-revealed
  // tiles; the full reveal lands when the fresh state arrives.
  if (socket && gameId) socket.emit("set_reveal_all", { gameId, on: revealAll });
  if (gs) renderBoard(gs);
}

function toggleTogglesPanel(force) {
  const panel = document.getElementById("toggles-panel");
  const btn = document.getElementById("btn-toggles");
  if (!panel || !btn) return;
  const shouldShow = typeof force === "boolean" ? force : panel.hasAttribute("hidden");
  if (shouldShow) {
    panel.removeAttribute("hidden");
    btn.setAttribute("aria-expanded", "true");
  } else {
    panel.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", "false");
  }
}

function updateLobbySettings() {
  if (_syncingLobby) return;
  if (!gameId || !gs || myId !== gs.admin) return;
  const money =
    parseInt(document.getElementById("lobby-bananas").value) || 5000;
  const mode = document.getElementById("lobby-mode").value;
  const lobbyMax = document.getElementById("lobby-max");
  if (mode === "2v2" || mode === "3v3") {
    lobbyMax.value = mode === "3v3" ? "6" : "4"; // team mode forces the full count
    lobbyMax.disabled = true;
  } else {
    lobbyMax.disabled = false;
  }
  const max = parseInt(lobbyMax.value) || 4;
  const isPublic = document.getElementById("lobby-public").checked;
  const superBananaEl = document.getElementById("lobby-super-banana-price");
  const superBananaPrice = superBananaEl ? (parseInt(superBananaEl.value) || 10000) : 10000;
  const farmAuctionTimerEl = document.getElementById("lobby-farm-auction-timer");
  const farmAuctionTimer = farmAuctionTimerEl ? (parseInt(farmAuctionTimerEl.value) || 15) : 15;
  const dodecahedron = document.getElementById("lobby-dodecahedron") ? document.getElementById("lobby-dodecahedron").checked : true;
  const megaMode = document.getElementById("lobby-mega-mode") ? document.getElementById("lobby-mega-mode").checked : true;
  socket.emit("update_settings", {
    gameId,
    startingMoney: money,
    gameMode: mode,
    maxPlayers: max,
    isPublic,
    superBananaPrice,
    farmAuctionTimer,
    dodecahedron,
    megaMode,
  });
}

// Drive the visual mode-chooser on the create-game screen. The hidden
// <select id="create-mode"> stays the source of truth so toggleModeSettings()
// and createGame() don't need to know about the cards.
function selectGameMode(mode) {
  const sel = document.getElementById("create-mode");
  if (!sel) return;
  sel.value = mode;
  const chooser = document.getElementById("mode-chooser");
  if (chooser) {
    const isTeams = mode === "2v2" || mode === "3v3";
    chooser.querySelectorAll(".mode-card").forEach((card) => {
      // The combined Team card (data-mode="team") covers BOTH team sizes; the
      // size itself lives in its #team-size dropdown, so it stays active for
      // either 2v2 or 3v3.
      const on =
        card.dataset.mode === "team" ? isTeams : card.dataset.mode === mode;
      card.classList.toggle("active", on);
    });
  }
  toggleModeSettings();
}

// Combined Team card: the 2v2/3v3 size is chosen by the in-card #team-size
// dropdown. Clicking the card (or changing the dropdown) selects that size and
// activates Team mode. Falls back to the dropdown's current value.
function selectTeamMode(size) {
  const teamSel = document.getElementById("team-size");
  const mode = size || (teamSel && teamSel.value) || "2v2";
  if (teamSel && teamSel.value !== mode) teamSel.value = mode;
  selectGameMode(mode);
}

function toggleModeSettings() {
  const mode = document.getElementById("create-mode").value;
  const teamSettings = document.getElementById("team-settings");
  const maxSelect = document.getElementById("create-max");
  const isTeams = mode === "2v2" || mode === "3v3";
  if (isTeams) {
    teamSettings.style.display = "";
    maxSelect.value = mode === "3v3" ? "6" : "4"; // 3v3 = 6 players, 2v2 = 4
    maxSelect.disabled = true;
  } else {
    teamSettings.style.display = "none";
    maxSelect.disabled = false;
  }
  const bananasEl = document.getElementById("create-bananas");
  const bananasDisp = document.getElementById("bananas-display");
  if (bananasEl) {
    bananasEl.value = 1000;
    if (bananasDisp) bananasDisp.textContent = bananasEl.value;
  }
}
