// ── Init ───────────────────────────────────────────────────────────

function initFloaters() {
  const container = document.getElementById("bg-floaters");
  if (!container) return;
  const emojis = [
    "\ud83c\udf4c",
    "\ud83c\udf4c",
    "\ud83c\udf34",
    "\ud83d\udc12",
    "\ud83d\udc12",
    "\ud83d\udc35",
    "\ud83d\udc35",
    "\ud83d\ude48",
    "\ud83d\ude49",
    "\ud83d\ude4a",
    "\ud83e\udda7",
    "\ud83d\udcb0",
    "\ud83d\udcb5",
    "\ud83d\udcb8",
    "\ud83c\udf43",
    "\ud83c\udf3e",
    "\ud83c\udf4c",
    "\ud83c\udf4c",
  ];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement("span");
    el.className = "bg-floater";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.animationDuration = 12 + Math.random() * 20 + "s";
    el.style.animationDelay = -(Math.random() * 30) + "s";
    el.style.fontSize = 1.2 + Math.random() * 1.5 + "em";
    container.appendChild(el);
  }
}

// CONTRACT: call ONLY when the player's banana score has just increased.
// The general money-delta detector in the game_update handler is the
// authoritative caller; explicit callers during walk animations (pile
// collection, early pickup, post-walk reconciliation) are intentional and
// each already correspond to a real gain. The amount guard below silently
// no-ops on 0/negative amounts so a stray call can't draw stray banana rain.
// Pair with _showMoneyDeduction() for the inverse (score went down).
function bananaBurst(amount, playerId, anchorEl) {
  if (!amount || amount <= 0) return;
  // Only rain bananas when the player's ACTUAL money score has gone up.
  // Stepping on (or landing on) a grow tile bumps the "to be collected"
  // pile total but NOT player.money, so any phantom call from a pile
  // animation must not fire the rain. We compare the canonical server
  // money (gs.players[i].money) against the snapshot taken just before
  // the latest gs update (_prevPlayerMoney). If money didn't rise, skip.
  if (
    playerId &&
    typeof gs !== "undefined" &&
    gs &&
    gs.players &&
    window._prevPlayerMoney
  ) {
    const player = gs.players.find((p) => p && p.id === playerId);
    const prev = window._prevPlayerMoney[playerId];
    if (player && prev != null && player.money <= prev) return;
  }
  playBananaWhoosh();
  _bananaBurstImpl(amount, playerId, anchorEl);
  _bananaGainFloater(amount, playerId, anchorEl);
  // Hold the end-turn countdown until this landing FX has had time to play out
  // (rain ~0.85s + max ~0.25s delay + small buffer).
  _touchLandingFx(1200);
}

function _bananaBurstImpl(amount, playerId, anchorEl) {
  // Caller-supplied anchor takes priority — used for leave-steal so the
  // banana rain falls on the SQUATTED TILE the player is departing, not on
  // their moving token. Falls back to the player's token / "me" token / pstat
  // monkey icon otherwise so existing callers behave the same.
  let anchor = anchorEl || null;
  if (!anchor && playerId) {
    anchor = document.querySelector(`.token[data-player-id="${playerId}"]`);
  }
  if (!anchor && playerId === myId) {
    anchor = document.querySelector(".token-me");
  }
  if (!anchor && playerId) {
    const pstatMonkey = document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-monkey`);
    if (pstatMonkey) anchor = pstatMonkey;
  }
  if (!anchor) {
    const mePstat = document.querySelector(".pstat-me .pstat-monkey");
    if (mePstat) anchor = mePstat;
  }
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const count = Math.min(5, Math.max(1, Math.floor(amount)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "banana-burst-icon banana-burst-down";
    el.textContent = "\ud83c\udf4c";
    // Start above the token so bananas rain down onto it
    const dx = (Math.random() - 0.5) * 120;
    const dy = -(80 + Math.random() * 60);
    el.style.left = (originX + dx) + "px";
    el.style.top = (originY + dy) + "px";
    el.style.setProperty("--fall-dx", (Math.random() - 0.5) * 40 + "px");
    el.style.setProperty("--fall-dy", (-dy) + "px");
    el.style.fontSize = 0.9 + Math.random() * 0.9 + "em";
    el.style.animationDelay = Math.random() * 0.25 + "s";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// Green "+N\u{1F34C}" floater near the player's banana score (mirror of
// the red "-N\u{1F34C}" floater fired by _showMoneyDeduction for losses).
// Only meaningful when amount > 0; the guard in bananaBurst already
// enforces that.
function _bananaGainFloater(amount, playerId, anchorEl) {
  if (!amount || amount <= 0) return;
  const isMe = playerId === myId;
  const moneyAnchor = isMe
    ? document.getElementById("info-money")
    : document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-money`);
  // Green "+N🍌" near the player's banana score AND at the board (the second copy
  // adds the extra visual punch). A caller-supplied anchorEl (the Super Banana
  // tile on a cross, the squatted tile on a leave-steal) floats that second copy
  // THERE instead of on the moving token.
  const gainText = `+${amount}🍌`;
  _spawnDeltaFloat(moneyAnchor, gainText, "money-gain-float");
  _spawnDeltaFloat(anchorEl || _playerTokenEl(playerId), gainText, "money-gain-float");
}

// Count of a player's concealed spell cards — works whether we hold the values
// (own hand: rollCards[]) or only the public tally (opponents: rollCardCount).
function _runeCountOf(p) {
  if (!p) return 0;
  if (typeof p.rollCardCount === "number") return p.rollCardCount;
  return Array.isArray(p.rollCards) ? p.rollCards.length : 0;
}

// Fly `count` rune cards from the center proxy deck (#rune-deck) to a player's
// board token — the visual indicator for a spell-card DRAW (cancel HIT,
// Super-Banana award/auction, …). Source-agnostic: the caller detects a draw by
// diffing rune counts, so EVERY gain path funnels here. `faces` is the array of
// freshly-drawn values when it's the VIEWER's OWN draw (those cards flip to
// reveal the number); null for opponents (cards stay face-down). Body-appended
// fixed elements, like every other floater, so they survive renderBoard.
function flyRuneDraw(playerId, count, faces) {
  count = Math.max(1, Math.min(4, Math.floor(count) || 1));
  const deck = document.getElementById("rune-deck");
  const board = document.getElementById("board");
  // Origin = the deck's center; fall back to the board's center if the deck is
  // hidden/missing (e.g. a draw resolves while an auction overlay covers it).
  let oRect = deck && deck.getBoundingClientRect();
  if (!oRect || !oRect.width) {
    const br = board && board.getBoundingClientRect();
    if (!br || !br.width) return;
    oRect = {
      left: br.left + br.width / 2,
      top: br.top + br.height / 2,
      width: 0,
      height: 0,
    };
  }
  const ox = oRect.left + oRect.width / 2;
  const oy = oRect.top + oRect.height / 2;
  const RUNE_BACK = "🔮"; // spell-card back glyph
  for (let i = 0; i < count; i++) {
    const face = faces && faces[i] != null ? faces[i] : null;
    setTimeout(() => {
      // Resolve the destination at FIRE time — the token may have moved (walk).
      const tok =
        _playerTokenEl(playerId) ||
        document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-cards`) ||
        document.querySelector(`.pstat[data-player-id="${playerId}"] .pstat-monkey`);
      if (!tok) return;
      const tr = tok.getBoundingClientRect();
      const tx = tr.left + tr.width / 2;
      const ty = tr.top + tr.height / 2;
      const card = document.createElement("div");
      card.className = "rune-fly-card" + (face != null ? " reveal" : "");
      card.style.left = ox + "px";
      card.style.top = oy + "px";
      card.style.setProperty("--fly-dx", tx - ox + "px");
      card.style.setProperty("--fly-dy", ty - oy + "px");
      card.innerHTML =
        '<div class="rune-fly-inner">' +
        '<div class="rune-fly-face rune-fly-back">' + RUNE_BACK + "</div>" +
        (face != null
          ? '<div class="rune-fly-face rune-fly-front">' + face + "</div>"
          : "") +
        "</div>";
      document.body.appendChild(card);
      const done = () => card.remove();
      card.addEventListener("animationend", (e) => {
        if (e.target === card) done();
      });
      // Safety removal if animationend never fires (reduced motion / lost frame).
      setTimeout(done, 1700);
    }, i * 170);
  }
  // Hold the local end-turn countdown so an own-draw FX isn't cut short.
  if (playerId === myId && typeof _touchLandingFx === "function") {
    _touchLandingFx(900 + count * 170);
  }
}

function initBoardFloaters() {
  const container = document.getElementById("board-floaters");
  if (!container || container.children.length > 0) return;
  const emojis = [
    "\ud83c\udf4c",
    "\ud83c\udf4c",
    "\ud83d\udc12",
    "\ud83d\udc35",
    "\ud83c\udf4c",
  ];
  for (let i = 0; i < 15; i++) {
    const el = document.createElement("span");
    el.className = "board-floater";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.animationDuration = 14 + Math.random() * 18 + "s";
    el.style.animationDelay = -(Math.random() * 30) + "s";
    el.style.fontSize = 1 + Math.random() * 1.2 + "em";
    container.appendChild(el);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initSocket();
  initFloaters();
  initBoardFloaters();
  showScreen("screen-menu");

  // Fallback: dismiss loading overlay after 5s even if socket is slow
  setTimeout(dismissLoadingOverlay, 5000);

  // Sync twemoji toggle checkbox with saved preference
  var twToggle = document.getElementById("twemoji-toggle");
  if (twToggle && typeof twemojiIsEnabled === "function") {
    twToggle.checked = twemojiIsEnabled();
  }

  // Close auction tooltip when clicking outside
  document.addEventListener("click", (e) => {
    const icon = document.querySelector(".auction-info-icon.open");
    if (icon && !icon.contains(e.target)) icon.classList.remove("open");
  });

  // Clear auto-filled bid value on first keystroke so typing replaces it
  const bidAmountInput = document.getElementById("bid-amount");
  if (bidAmountInput) {
    bidAmountInput.addEventListener("keydown", (e) => {
      if (window._bidAutoFilled !== false && e.key >= "0" && e.key <= "9") {
        bidAmountInput.value = "";
        window._bidAutoFilled = false;
      }
    });
  }

  const chatForm = document.getElementById("board-chat-form");
  const chatInput = document.getElementById("board-chat-input");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || !socket || !gameId) return;
      socket.emit("chat_message", { gameId, message: text });
      chatInput.value = "";
    });
  }

  // Chat close / open
  const chatEl = document.getElementById("board-chat");
  const chatClose = document.getElementById("board-chat-close");
  const chatToggle = document.getElementById("board-chat-toggle");
  if (chatClose && chatEl) {
    chatClose.addEventListener("click", () => {
      chatEl.classList.add("board-chat-hidden");
    });
  }
  if (chatToggle && chatEl) {
    chatToggle.addEventListener("click", () => {
      if (chatEl.classList.contains("board-chat-hidden")) {
        chatEl.classList.remove("board-chat-hidden");
        chatToggle.classList.remove("has-unread");
        // Open near the toggle button (bottom-right of board)
        chatEl.style.left = "auto";
        chatEl.style.right = "2%";
        chatEl.style.top = "auto";
        chatEl.style.bottom = "12%";
        chatEl.style.transform = "none";
      } else {
        chatEl.classList.add("board-chat-hidden");
      }
    });
  }

  // Sound volume toggle + slider
  const sfxToggle = document.getElementById("sfx-toggle");
  const sfxPopup = document.getElementById("sfx-slider-popup");
  const sfxSlider = document.getElementById("sfx-slider");
  const sfxLabel = document.getElementById("sfx-slider-label");
  const sfxIcon = document.getElementById("sfx-toggle-icon");
  if (sfxToggle && sfxPopup && sfxSlider) {
    // Init slider to current volume
    sfxSlider.value = Math.round(_sfxVolume * 100);
    if (sfxLabel) sfxLabel.textContent = Math.round(_sfxVolume * 100) + "%";
    if (sfxIcon) sfxIcon.textContent = _sfxVolume === 0 ? "\uD83D\uDD07" : _sfxVolume < 0.5 ? "\uD83D\uDD09" : "\uD83D\uDD0A";
    sfxToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = sfxPopup.style.display !== "none";
      sfxPopup.style.display = visible ? "none" : "flex";
    });
    sfxSlider.addEventListener("input", () => {
      const v = parseInt(sfxSlider.value, 10) / 100;
      setSfxVolume(v);
      if (sfxLabel) sfxLabel.textContent = Math.round(v * 100) + "%";
    });
    // Close popup when clicking elsewhere
    document.addEventListener("click", (e) => {
      if (!sfxToggle.contains(e.target) && !sfxPopup.contains(e.target)) {
        sfxPopup.style.display = "none";
      }
    });
  }

  // Drag chat by header
  const chatHeader = document.getElementById("board-chat-header");
  if (chatHeader && chatEl) {
    let dragging = false,
      startX,
      startY,
      origX,
      origY;
    chatHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-chat-close")) return;
      dragging = true;
      const rect = chatEl.getBoundingClientRect();
      const parentRect = chatEl.parentElement.getBoundingClientRect();
      origX = rect.left - parentRect.left;
      origY = rect.top - parentRect.top;
      startX = e.clientX;
      startY = e.clientY;
      chatEl.style.transform = "none";
      chatEl.style.left = origX + "px";
      chatEl.style.top = origY + "px";
      chatHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      chatEl.style.left = origX + e.clientX - startX + "px";
      chatEl.style.top = origY + e.clientY - startY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      chatHeader.style.cursor = "";
    });
  }

  // ── Jungle Log toggle / close / drag ──────────────────────────
  const logEl = document.getElementById("board-log");
  const logClose = document.getElementById("board-log-close");
  const logToggle = document.getElementById("board-log-toggle");
  if (logClose && logEl) {
    logClose.addEventListener("click", () => {
      logEl.classList.add("board-log-hidden");
    });
  }
  if (logToggle && logEl) {
    logToggle.addEventListener("click", () => {
      logEl.classList.toggle("board-log-hidden");
    });
  }
  const logHeader = document.getElementById("board-log-header");
  if (logHeader && logEl) {
    let draggingLog = false,
      logStartX,
      logStartY,
      logOrigX,
      logOrigY;
    logHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-log-close")) return;
      draggingLog = true;
      const rect = logEl.getBoundingClientRect();
      const parentRect = logEl.parentElement.getBoundingClientRect();
      logOrigX = rect.left - parentRect.left;
      logOrigY = rect.top - parentRect.top;
      logStartX = e.clientX;
      logStartY = e.clientY;
      logEl.style.left = logOrigX + "px";
      logEl.style.top = logOrigY + "px";
      logEl.style.right = "auto";
      logEl.style.bottom = "auto";
      logHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingLog) return;
      logEl.style.left = logOrigX + e.clientX - logStartX + "px";
      logEl.style.top = logOrigY + e.clientY - logStartY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingLog) return;
      draggingLog = false;
      logHeader.style.cursor = "";
    });
  }

  // ── Debug Tools window toggle / close / drag ──────────────────
  const debugWin = document.getElementById("debug-window");
  const debugToggleBtn = document.getElementById("debug-toggle");
  const debugWinClose = document.getElementById("debug-window-close");
  const debugWinHeader = document.getElementById("debug-window-header");
  function setDebugWindowOpen(open) {
    if (!debugWin) return;
    debugWin.classList.toggle("debug-window-hidden", !open);
    if (debugToggleBtn) debugToggleBtn.classList.toggle("is-open", open);
  }
  if (debugToggleBtn && debugWin) {
    debugToggleBtn.addEventListener("click", () => {
      setDebugWindowOpen(debugWin.classList.contains("debug-window-hidden"));
    });
  }
  if (debugWinClose && debugWin) {
    debugWinClose.addEventListener("click", () => setDebugWindowOpen(false));
  }
  if (debugWinHeader && debugWin) {
    let draggingDebug = false,
      dbgStartX,
      dbgStartY,
      dbgOrigX,
      dbgOrigY;
    debugWinHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".debug-window-close")) return;
      draggingDebug = true;
      const rect = debugWin.getBoundingClientRect();
      dbgOrigX = rect.left;
      dbgOrigY = rect.top;
      dbgStartX = e.clientX;
      dbgStartY = e.clientY;
      debugWin.style.left = dbgOrigX + "px";
      debugWin.style.top = dbgOrigY + "px";
      debugWin.style.right = "auto";
      debugWin.style.bottom = "auto";
      debugWinHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingDebug) return;
      const nextLeft = dbgOrigX + e.clientX - dbgStartX;
      const nextTop = dbgOrigY + e.clientY - dbgStartY;
      const maxLeft = window.innerWidth - debugWin.offsetWidth - 4;
      const maxTop = window.innerHeight - debugWin.offsetHeight - 4;
      debugWin.style.left = Math.max(4, Math.min(nextLeft, maxLeft)) + "px";
      debugWin.style.top = Math.max(4, Math.min(nextTop, maxTop)) + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingDebug) return;
      draggingDebug = false;
      debugWinHeader.style.cursor = "";
    });
  }

  // How to Play toggle
  const helpToggle = document.getElementById("board-help-toggle");
  const helpEl = document.getElementById("board-help");
  const helpClose = document.getElementById("board-help-close");
  if (helpClose && helpEl) {
    helpClose.addEventListener("click", () => {
      helpEl.classList.add("board-help-hidden");
    });
  }
  if (helpToggle && helpEl) {
    helpToggle.addEventListener("click", () => {
      if (helpEl.classList.contains("board-help-hidden")) {
        helpEl.classList.remove("board-help-hidden");
        helpEl.style.left = "auto";
        helpEl.style.right = "2%";
        helpEl.style.top = "auto";
        helpEl.style.bottom = "12%";
        helpEl.style.transform = "none";
      } else {
        helpEl.classList.add("board-help-hidden");
      }
    });
  }
  // Make help panel draggable
  const helpHeader = document.getElementById("board-help-header");
  if (helpHeader && helpEl) {
    let draggingHelp = false, helpStartX, helpStartY, helpOrigX, helpOrigY;
    helpHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest(".board-help-close")) return;
      draggingHelp = true;
      const rect = helpEl.getBoundingClientRect();
      const parentRect = helpEl.parentElement.getBoundingClientRect();
      helpOrigX = rect.left - parentRect.left;
      helpOrigY = rect.top - parentRect.top;
      helpStartX = e.clientX;
      helpStartY = e.clientY;
      helpEl.style.left = helpOrigX + "px";
      helpEl.style.top = helpOrigY + "px";
      helpEl.style.right = "auto";
      helpEl.style.bottom = "auto";
      helpHeader.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!draggingHelp) return;
      helpEl.style.left = helpOrigX + e.clientX - helpStartX + "px";
      helpEl.style.top = helpOrigY + e.clientY - helpStartY + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!draggingHelp) return;
      draggingHelp = false;
      helpHeader.style.cursor = "";
    });
  }

  // Emoji reactions toggle
  const emojiToggle = document.getElementById("board-emoji-toggle");
  const emojiPicker = document.getElementById("emoji-picker");
  if (emojiToggle && emojiPicker) {
    // Restore saved position
    try {
      const saved = localStorage.getItem("emoji-picker-pos");
      if (saved) {
        const { left, top } = JSON.parse(saved);
        if (typeof left === "number" && typeof top === "number") {
          emojiPicker.style.left = left + "px";
          emojiPicker.style.top = top + "px";
          emojiPicker.style.right = "auto";
          emojiPicker.style.bottom = "auto";
        }
      }
    } catch (_) {}

    emojiToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = emojiPicker.style.display !== "none";
      emojiPicker.style.display = visible ? "none" : "flex";
    });

    // Track drag state so click-outside doesn't close the picker mid-drag,
    // and so a drag release that lands on an emoji doesn't fire sendReaction.
    let emojiDragging = false;
    let emojiDragMoved = false;
    let emojiStartX, emojiStartY, emojiOrigX, emojiOrigY;
    const EMOJI_DRAG_THRESHOLD = 3;
    const emojiHandle = document.getElementById("emoji-picker-handle");
    if (emojiHandle) {
      emojiHandle.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        emojiDragging = true;
        emojiDragMoved = false;
        const rect = emojiPicker.getBoundingClientRect();
        const parentRect = emojiPicker.parentElement.getBoundingClientRect();
        emojiOrigX = rect.left - parentRect.left;
        emojiOrigY = rect.top - parentRect.top;
        emojiStartX = e.clientX;
        emojiStartY = e.clientY;
        emojiPicker.style.left = emojiOrigX + "px";
        emojiPicker.style.top = emojiOrigY + "px";
        emojiPicker.style.right = "auto";
        emojiPicker.style.bottom = "auto";
        emojiHandle.style.cursor = "grabbing";
        e.preventDefault();
        e.stopPropagation();
      });
    }
    window.addEventListener("mousemove", (e) => {
      if (!emojiDragging) return;
      const dx = e.clientX - emojiStartX;
      const dy = e.clientY - emojiStartY;
      if (!emojiDragMoved && Math.hypot(dx, dy) > EMOJI_DRAG_THRESHOLD) {
        emojiDragMoved = true;
      }
      emojiPicker.style.left = emojiOrigX + dx + "px";
      emojiPicker.style.top = emojiOrigY + dy + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!emojiDragging) return;
      emojiDragging = false;
      if (emojiHandle) emojiHandle.style.cursor = "";
      if (emojiDragMoved) {
        // Save new position
        const parentRect = emojiPicker.parentElement.getBoundingClientRect();
        const rect = emojiPicker.getBoundingClientRect();
        const left = rect.left - parentRect.left;
        const top = rect.top - parentRect.top;
        try {
          localStorage.setItem(
            "emoji-picker-pos",
            JSON.stringify({ left, top })
          );
        } catch (_) {}
      }
      // Suppress the click event that follows mouseup after a real drag
      if (emojiDragMoved) {
        const suppress = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", suppress, true);
        };
        window.addEventListener("click", suppress, true);
      }
    });

    document.addEventListener("click", (e) => {
      if (emojiDragging || emojiDragMoved) return;
      if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
        emojiPicker.style.display = "none";
      }
    });
  }

  // Phone toggle — show/hide app buttons
  const phoneToggle = document.getElementById("phone-toggle");
  if (phoneToggle) {
    // ── Draggable phone button ───────────────────────────────────
    // The phone always starts at the CSS default position (bottom middle of
    // the board). It can be dragged around within a session, but the
    // position is intentionally NOT persisted — restarting the game resets
    // it to bottom middle. Clear any stale saved position from older builds.
    try { localStorage.removeItem("phone-toggle-pos"); } catch {}

    let phoneDragging = false;
    let phoneMoved = false;
    let phoneStartX, phoneStartY, phoneOrigX, phoneOrigY;
    const PHONE_DRAG_THRESHOLD = 4;

    phoneToggle.addEventListener("mousedown", (e) => {
      phoneDragging = true;
      phoneMoved = false;
      const rect = phoneToggle.getBoundingClientRect();
      const parentEl = phoneToggle.parentElement;
      if (!parentEl) return;
      const parentRect = parentEl.getBoundingClientRect();
      phoneOrigX = rect.left - parentRect.left;
      phoneOrigY = rect.top - parentRect.top;
      phoneStartX = e.clientX;
      phoneStartY = e.clientY;
      phoneToggle.style.left = phoneOrigX + "px";
      phoneToggle.style.top = phoneOrigY + "px";
      phoneToggle.style.bottom = "auto";
      phoneToggle.classList.add("phone-toggle-dragged");
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!phoneDragging) return;
      const dx = e.clientX - phoneStartX;
      const dy = e.clientY - phoneStartY;
      if (!phoneMoved && Math.hypot(dx, dy) > PHONE_DRAG_THRESHOLD) {
        phoneMoved = true;
        phoneToggle.style.cursor = "grabbing";
      }
      if (phoneMoved) {
        phoneToggle.style.left = phoneOrigX + dx + "px";
        phoneToggle.style.top = phoneOrigY + dy + "px";
        updatePhoneAppPositions();
      }
    });
    window.addEventListener("mouseup", () => {
      if (!phoneDragging) return;
      phoneDragging = false;
      phoneToggle.style.cursor = "";
    });
    // Suppress click if a drag just happened so the toggle doesn't fire
    phoneToggle.addEventListener("click", (e) => {
      if (phoneMoved) {
        phoneMoved = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);

    phoneToggle.addEventListener("click", () => {
      const board = document.getElementById("board");
      if (!board) return;
      const collapsed = board.classList.toggle("apps-collapsed");
      phoneToggle.classList.toggle("apps-hidden", collapsed);
      // Also close any open panels when hiding
      if (collapsed) {
        emojiPicker && (emojiPicker.style.display = "none");
      }
    });

    // Initial positioning of app buttons above the phone, plus resize tracking
    requestAnimationFrame(updatePhoneAppPositions);
    window.addEventListener("resize", updatePhoneAppPositions);
  }
});

// Position the 5 app buttons (chat, log, help, emoji, sfx) in a single
// HORIZONTAL row, evenly spaced and centred just above the phone-toggle so they
// follow it AND stay horizontal when the phone is dragged. Called on init, on
// phone drag, and on window resize. (Previously this stacked them in a vertical
// column, which is why dragging the phone flipped the row from horizontal to
// vertical.)
const PHONE_APP_BUTTON_IDS = [
  "board-chat-toggle",
  "board-log-toggle",
  "board-help-toggle",
  "board-emoji-toggle",
  "sfx-toggle",
];
function updatePhoneAppPositions() {
  const phoneToggle = document.getElementById("phone-toggle");
  if (!phoneToggle) return;
  const parentEl = phoneToggle.parentElement;
  if (!parentEl) return;
  const phoneRect = phoneToggle.getBoundingClientRect();
  if (phoneRect.width === 0 || phoneRect.height === 0) return;
  const parentRect = parentEl.getBoundingClientRect();
  const phoneLeft = phoneRect.left - parentRect.left;
  const phoneTop = phoneRect.top - parentRect.top;
  const phoneCenterX = phoneLeft + phoneRect.width / 2;

  const GAP = 14; // even gap BETWEEN app buttons
  const PHONE_GAP = 16; // gap ABOVE the phone

  const btns = PHONE_APP_BUTTON_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!btns.length) return;
  const rects = btns.map((b) => b.getBoundingClientRect());
  const widths = rects.map((r) => r.width || 40);
  const heights = rects.map((r) => r.height || 40);
  const rowWidth = widths.reduce((a, w) => a + w, 0) + GAP * (btns.length - 1);
  const rowH = Math.max.apply(null, heights);

  // Centre the row on the phone, one PHONE_GAP above it. Clamp so a phone dragged
  // near an edge keeps the whole horizontal row on the board.
  const M = 6;
  let rowLeft = phoneCenterX - rowWidth / 2;
  rowLeft = Math.max(M, Math.min(rowLeft, parentRect.width - rowWidth - M));
  let rowTop = phoneTop - rowH - PHONE_GAP;
  if (rowTop < M) rowTop = M;

  let x = rowLeft;
  btns.forEach((btn, i) => {
    btn.style.left = x + "px";
    // Vertically centre smaller buttons (e.g. the 40px sfx) within the row.
    btn.style.top = rowTop + (rowH - heights[i]) / 2 + "px";
    btn.style.bottom = "auto";
    btn.style.right = "auto";
    x += widths[i] + GAP;
  });
}

// ── Emoji Reactions ────────────────────────────────────────────────

let _reactionCooldown = false;

function sendReaction(emoji) {
  if (!socket || !gameId) return;
  if (_reactionCooldown) return;
  _reactionCooldown = true;
  setTimeout(() => { _reactionCooldown = false; }, 2000);
  socket.emit("player_reaction", { gameId, emoji });
}

function showEmojiReaction(playerId, emoji) {
  const tok = _tokenElements && _tokenElements[playerId];
  if (!tok || !tok.parentNode) return;
  const rect = tok.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "emoji-reaction-bubble";
  bubble.textContent = emoji;
  bubble.style.position = "fixed";
  bubble.style.left = (rect.left + rect.width / 2) + "px";
  bubble.style.top = rect.top + "px";
  bubble.style.zIndex = "9999";
  document.body.appendChild(bubble);
  bubble.addEventListener("animationend", () => bubble.remove());
}

// ── Board Preview ──────────────────────────────────────────────────

let _previewLayout = null;

function openBoardPreview() {
  const overlay = document.getElementById("board-preview-overlay");
  overlay.style.display = "flex";
  shuffleBoardPreview();
}

function closeBoardPreview() {
  document.getElementById("board-preview-overlay").style.display = "none";
}

function shuffleBoardPreview() {
  playShuffleSound();
  _previewLayout = buildPreviewLayout();
  renderPreviewBoard(_previewLayout);
}

