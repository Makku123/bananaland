// ── Game Screen ────────────────────────────────────────────────────

// ── Banana Gadget ───────────────────────────────────────────────────
// A what-if travel preview: pick a distance 1–47 and see how many bananas
// you'd collect from YOUR OWN farm piles on the tiles you'd cross/land on,
// moving that many tiles from your current position. Matches the real
// collect rule ("own piles on the path"); only counts tiles you've revealed
// (own farms are always revealed to you, so fog never hides your own piles).
function setBananaGadget(n) {
  n = Math.max(1, Math.min(47, parseInt(n, 10) || 1));
  window._bananaGadgetN = n;
  const stepsEl = document.getElementById("banana-gadget-steps");
  if (stepsEl) stepsEl.textContent = String(n);
  const rangeEl = document.getElementById("banana-gadget-range");
  if (rangeEl) {
    if (Number(rangeEl.value) !== n) rangeEl.value = String(n);
    _syncGadgetFill(rangeEl, n);
  }
  updateBananaGadget();
  // The Path Preview highlight spans this same distance, so re-render the board
  // when the gadget changes while the preview is on.
  if (window._stepHiOn) _renderBoardNow();
}

// Paint the slider's "filled" portion up to the thumb by setting the --gadget-fill
// CSS var the track gradient reads (bright gold left of the thumb, dark groove
// right of it). Approximate — the thumb width offsets the extremes slightly,
// which is visually fine.
function _syncGadgetFill(rangeEl, n) {
  const min = Number(rangeEl.min) || 1;
  const max = Number(rangeEl.max) || 47;
  const pct = max > min ? ((n - min) / (max - min)) * 100 : 0;
  rangeEl.style.setProperty("--gadget-fill", pct.toFixed(2) + "%");
}

// Close / reopen the Banana Gadget. Closing (the x inside the box) hides the panel
// and swaps in a compact reopen button in the SAME slot; clicking that reopens it
// in place. updateBananaGadget honours the flag (so the per-frame refresh can't
// re-show a dismissed gadget) and switches between the two states. Closing also
// turns off the Path Preview (its toggle lives inside the gadget, so the yellow
// highlight would otherwise be orphaned with no visible control).
function toggleBananaGadget(show) {
  window._bananaGadgetClosed = !show;
  if (!show && window._stepHiOn) togglePathPreview(false);
  updateBananaGadget();
}

function _bananaGadgetTotal(n) {
  if (!gs || !Array.isArray(gs.properties) || !myId) return 0;
  const me = _gsPlayerMap[myId];
  if (!me || typeof me.position !== "number") return 0;
  const boardLen = (gs.boardLayout && gs.boardLayout.length) || 48;
  const propById = {};
  for (const p of gs.properties) propById[p.id] = p;
  const myRevealed = Array.isArray(me.revealedTiles)
    ? new Set(me.revealedTiles)
    : null;
  let total = 0;
  for (let s = 1; s <= n; s++) {
    const pos = (me.position + s) % boardLen;
    if (myRevealed && !myRevealed.has(pos)) continue; // fog-safe
    const prop = propById[pos];
    if (prop && prop.owner === myId && (prop.bananaPile || 0) > 0) {
      // CROSS your own farm (s < n) collects only ONE yield; LANDING on it
      // (s === n) collects the whole pile (matches _collectBananasOnPath).
      total += s === n
        ? prop.bananaPile
        : Math.min(prop.price || 0, prop.bananaPile);
    }
  }
  return total;
}

function updateBananaGadget() {
  const box = document.getElementById("banana-gadget");
  if (!box) return;
  const openPill = document.getElementById("banana-gadget-open");
  const me = gs && _gsPlayerMap[myId];
  // "active" = the gadget is relevant (you're an in-play, live player). When active
  // we show EITHER the full panel or, if dismissed, the compact reopen pill in the
  // same slot. When inactive, both are hidden.
  const active = !!(gs && gs.state === "playing" && me && !me.bankrupt && !me.ghost);
  const closed = !!window._bananaGadgetClosed;
  const show = active && !closed;
  box.style.display = show ? "" : "none";
  if (openPill) openPill.style.display = active && closed ? "" : "none";
  if (!show) return;
  const n = window._bananaGadgetN || 6;
  // Keep the slider knob/value and its gold fill in sync with the current N even
  // when the panel is (re)shown without a fresh drag.
  const rangeEl = document.getElementById("banana-gadget-range");
  if (rangeEl) {
    if (Number(rangeEl.value) !== n) rangeEl.value = String(n);
    _syncGadgetFill(rangeEl, n);
  }
  const total = _bananaGadgetTotal(n);
  const resultEl = document.getElementById("banana-gadget-result");
  if (resultEl) {
    resultEl.innerHTML =
      `Travel <b>${n}</b> → collect <b>${total}</b>🍌 from your farms`;
  }
  // Steps to the Super Banana — only once the viewer has REVEALED it. The SB tile
  // carries group "superBanana" in boardLayout only when revealed (fog redacts it
  // to a typeless "hidden" entry otherwise), so finding it == it's revealed.
  const sbEl = document.getElementById("banana-gadget-sb");
  if (sbEl) {
    const layout = (gs && gs.boardLayout) || [];
    const boardLen = layout.length || 48;
    let sbPos = -1;
    for (let i = 0; i < layout.length; i++) {
      if (layout[i] && layout[i].group === "superBanana") { sbPos = i; break; }
    }
    if (sbPos >= 0 && typeof me.position === "number") {
      const steps = (sbPos - me.position + boardLen) % boardLen;
      sbEl.style.display = "";
      sbEl.innerHTML =
        steps === 0
          ? `⭐ You're on the Super Banana!`
          : `⭐ Super Banana: <b>${steps}</b> step${steps === 1 ? "" : "s"} away`;
    } else {
      sbEl.style.display = "none";
      sbEl.innerHTML = "";
    }
  }
}

// ── Path Preview ──────────────────────────────────────────────────
// A YELLOW highlight of the viewer's next N tiles, toggled from inside the Banana
// Gadget box. N is the Banana Gadget distance (window._bananaGadgetN). The board
// reads window._stepHiOn in renderBoard; toggling re-renders.
function _renderBoardNow() {
  if (typeof renderBoard === "function" && typeof gs !== "undefined" && gs) {
    renderBoard(gs);
  }
}
function togglePathPreview(on) {
  window._stepHiOn = !!on;
  // Keep the checkbox in sync when toggled programmatically (e.g. auto-off on arm).
  const cb = document.getElementById("path-preview-on");
  if (cb && cb.checked !== window._stepHiOn) cb.checked = window._stepHiOn;
  _renderBoardNow();
}

// GROW-MATCH hop animation: when a rolled number (1..6) matches a REVEALED GROW,
// the player hops (base - rolled) instead of the rolled number — base is 7 for a
// dice/d12 roll, 13 for a played spell card. Pop a brief centered overlay showing
// "base - rolled = hop" and the new walk number, then auto-remove it. Built
// ASCII-only (decorative glyphs live in CSS) and appended to <body> with fixed
// positioning over the board, so it survives renderBoard's child-purge and never
// touches the fragile token-walk timers.
function _showGrowMatchHop(rolled, hop, base, theme) {
  document.querySelectorAll(".grow-match-hop").forEach((n) => n.remove());
  const el = document.createElement("div");
  // theme: undefined = the gold grow-match overlay (default); "turtle" = a played
  // card BELOW 7 (turtle mode, walks 7 - N); "rabbit" = a played card ABOVE 7
  // (rabbit / +6 mode, walks its full value N + 6). The 🐢/🐇 mascot + mode glyphs
  // are injected by CSS per theme class, so keep this markup ASCII-only.
  const isRabbit = theme === "rabbit";
  el.className = "grow-match-hop" + (theme ? " gmh-" + theme : "");
  const title = isRabbit ? "ABOVE 7!" : "BELOW 7!";
  const op = isRabbit ? "+" : "-";
  const verb = isRabbit ? "leaping" : "walking";
  // Mode label: MEGA Turtle/Rabbit only when the game is in Mega Mode; otherwise
  // plain Turtle/Rabbit. (The no-theme default-roll overlay shows neither.)
  const mega = !!(typeof gs !== "undefined" && gs && gs.megaMode);
  const modeLabel =
    theme === "turtle" ? (mega ? "Mega Turtle" : "Turtle")
    : isRabbit ? (mega ? "Mega Rabbit" : "Rabbit")
    : "";
  // "Mega" effect blurb — ONLY in Mega Mode (normal turtle/rabbit have no special
  // payoff to advertise): turtle GROWS 5×, rabbit VACUUMS every pile on its path.
  const megaEffect = !mega
    ? ""
    : theme === "turtle" ? "🌱 Grows piles 5×!"
    : isRabbit ? "🧹 Steals every pile on the path!"
    : "";
  el.innerHTML =
    '<div class="gmh-flash"></div>' +
    (theme ? '<span class="gmh-critter" aria-hidden="true"></span>' : "") +
    (modeLabel ? '<div class="gmh-mode">' + modeLabel + '</div>' : "") +
    '<div class="gmh-title">' + title + '</div>' +
    // A turtle right UNDER the "BELOW 7!" title on the default-roll (no-theme)
    // overlay — that overlay is always the below-7 / slow case.
    (!theme ? '<div class="gmh-undertitle" aria-hidden="true">🐢</div>' : "") +
    '<div class="gmh-eq">' +
    '<span class="gmh-n gmh-seven">' + (base || 7) + '</span>' +
    '<span class="gmh-op">' + op + '</span>' +
    '<span class="gmh-n gmh-rolled">' + rolled + '</span>' +
    '<span class="gmh-arrow"></span>' +
    '<span class="gmh-hop-wrap"><span class="gmh-n gmh-hop">' + hop + '</span></span>' +
    '</div>' +
    '<div class="gmh-walk">' + verb + ' <b>' + hop + '</b></div>' +
    (megaEffect ? '<div class="gmh-effect">' + megaEffect + '</div>' : "");
  // Pop the notification in the MIDDLE of the board (the play area) — NOT near the
  // dice/roll button. Append first so offsetWidth/Height report the panel's natural
  // size (those ignore the entrance scale transform), then centre it on the board
  // and clamp into the viewport.
  document.body.appendChild(el);
  const board = document.getElementById("board");
  const r = board && board.getBoundingClientRect();
  if (r && r.width) {
    const halfW = el.offsetWidth / 2;
    const halfH = el.offsetHeight / 2;
    let cx = r.left + r.width / 2;
    let cy = r.top + r.height / 2;
    cx = Math.max(halfW + 8, Math.min(window.innerWidth - halfW - 8, cx));
    cy = Math.max(halfH + 8, Math.min(window.innerHeight - halfH - 8, cy));
    el.style.left = cx + "px";
    el.style.top = cy + "px";
  } else {
    el.style.left = "50%";
    el.style.top = "50%";
  }
  el.addEventListener("animationend", (e) => {
    // Remove ONLY when the panel's own MASTER animation finishes (growMatchHop,
    // or gmhFadeRM under reduced-motion). The decorative ::before (shockwave
    // ~0.8s) and ::after (shimmer ~1.3s) are pseudo-element animations whose
    // animationend ALSO reports e.target === el — without keying on the master
    // animation NAME, the earliest of them yanked the panel after ~0.8s, so it
    // only blinked in and out instead of holding for its full ~4.5s.
    if (e.target === el && (e.animationName === "growMatchHop" || e.animationName === "gmhFadeRM")) el.remove();
  });
  // Safety removal in case animationend doesn't fire (e.g. reduced motion).
  // Kept just above the 4500ms display animation so it never cuts it short.
  setTimeout(() => { if (el.parentNode) el.remove(); }, 4900);
}

// ── Win-hint ──────────────────────────────────────────────────────
// Tell the viewer they have a GUARANTEED win available: the Super Banana is
// revealed + unowned, they can afford it, they hold a Spell Card that lands
// EXACTLY on it (you must LAND to buy — crossing doesn't), and NOBODY can cancel
// the play (every player holds < 3 runes, the cancel minimum). Names the rune to
// play. Computed client-side each frame.
function updateWinHint() {
  const box = document.getElementById("win-hint");
  if (!box) return;
  const hide = () => {
    box.style.display = "none";
  };
  if (!gs || gs.state !== "playing" || !gs.boardLayout || !myId) return hide();
  const me = _gsPlayerMap[myId];
  if (!me || me.bankrupt || me.ghost) return hide();
  const myRunes = Array.isArray(me.rollCards) ? me.rollCards : [];
  if (!myRunes.length) return hide();

  // A rune-play can only be stopped by a Cancel, and only a LIVE, non-teammate
  // opponent can cast one — and only if they hold >= 3 runes. Count only those
  // players (a bankrupt/ghost player, a teammate, or yourself can never cancel
  // your play, so their rune count is irrelevant). If none can cancel, the play
  // is safe. (Note: a cancel pre-cast on a prior turn is redacted from the
  // client, so this can't catch that rare case — see the win-hint comment.)
  const isTeams = gs.gameMode === "2v2" || gs.gameMode === "3v3";
  const teamOf = (pid) => {
    const t = gs.teams;
    if (!t) return null;
    if (t.A && t.A.includes(pid)) return "A";
    if (t.B && t.B.includes(pid)) return "B";
    return null;
  };
  const myTeam = isTeams ? teamOf(myId) : null;
  const runeCount = (p) =>
    typeof p.rollCardCount === "number"
      ? p.rollCardCount
      : Array.isArray(p.rollCards)
        ? p.rollCards.length
        : 0;
  const canCancelMe = (gs.players || []).filter(
    (p) =>
      p.id !== myId &&
      !p.bankrupt &&
      !p.ghost &&
      (!isTeams || teamOf(p.id) !== myTeam),
  );
  if (!canCancelMe.every((p) => runeCount(p) < 3)) return hide();

  // Find the revealed, unowned Super Banana.
  const boardLen = gs.boardLayout.length || 48;
  let sbPos = -1;
  for (let i = 0; i < gs.boardLayout.length; i++) {
    const t = gs.boardLayout[i];
    if (t && t.group === "superBanana") {
      sbPos = i;
      break;
    }
  }
  if (sbPos < 0) return hide(); // not revealed to me yet
  const sbProp = _gsPropMap[sbPos];
  if (sbProp && sbProp.owner) return hide(); // already bought
  // Use the ACTUAL charged price — the properties-map value (= the configured
  // superBananaPrice). boardLayout's SB price is a stale hardcoded number and
  // must NOT be used for the affordability gate.
  const sbPrice =
    sbProp && typeof sbProp.price === "number"
      ? sbProp.price
      : gs.superBananaPrice || 0;
  if ((me.money || 0) < sbPrice) return hide(); // can't afford it

  // Steps to land EXACTLY on the SB (must LAND, not cross). A rune walks 7 - value,
  // so reachable distances are 1..6 (rune 6 → 1 step … rune 1 → 6 steps).
  const needed = (((sbPos - me.position) % boardLen) + boardLen) % boardLen;
  if (needed < 1 || needed > 6) return hide();

  // Which held rune lands there? It walks 7 - value, so to walk `needed` tiles you
  // play the rune of value 7 - needed (needed is 1..6, so this is 6..1).
  const winValue = 7 - needed;
  if (!myRunes.includes(winValue)) return hide();

  const canPlayNow =
    gs.currentPlayer && gs.currentPlayer.id === myId && !gs.diceRolled;
  const when = canPlayNow ? "now" : "on your next turn";
  const body = document.getElementById("win-hint-body");
  if (body) {
    body.innerHTML =
      `Play your <b>${winValue}</b> Spell Card ${when} to land on the ⭐ Super Banana and <b>win the game</b>!`;
  }
  box.style.display = "";
}

// ── Rune session modal (removed) ──────────────────────────────────
// There is no interactive rune session anymore — spell-card draws AND the
// missed-cancel penalty (you simply lose two random cards) are both immediate.
// gs.redraw is always null; this just keeps the overlay hidden.
function updateRedrawModal() {
  const ov = document.getElementById("redraw-overlay");
  if (ov) ov.style.display = "none";
}

// Spell Cards summary for a player's panel entry. Dice are CONCEALED
// (private to the owner) — for other players the backend ships only
// rollCardCount, so we never show the numbers. We show a single face-down
// mini-die stamped with the count.
function _rollCardPanelHTML(p) {
  const concealedCount =
    typeof p.rollCardCount === "number"
      ? p.rollCardCount
      : Array.isArray(p.rollCards)
        ? p.rollCards.length
        : 0;
  if (concealedCount === 0) return "";
  const noun = concealedCount === 1 ? "Spell Card" : "Spell Cards";
  // The fancy hover tooltip is a real child (.rune-tip "spell plaque"): an
  // ornamental header + big count + flavor line, styled in styles.css. Shown on
  // .pstat-cards:hover; anchored below-right so the left panel's overflow can't
  // clip it. Public count (own + opponents), so the flavor stays player-neutral.
  return (
    `<span class="pstat-cards">` +
    `<span class="mini-roll-card mini-roll-card-back">` +
    `<span class="mini-roll-card-back-mark">🔮</span>` +
    `<span class="mini-roll-card-back-count">${concealedCount}</span>` +
    `</span>` +
    `<span class="rune-tip-notch"></span>` +
    `<span class="rune-tip">` +
    `<span class="rune-tip-head">${noun}</span>` +
    `<span class="rune-tip-body">` +
    `<span class="rune-tip-count">${concealedCount}</span>` +
    `<span class="rune-tip-flavor">concealed in hand</span>` +
    `</span></span></span>`
  );
}

// Cute speed indicator beside the dice: 🐢 (turtle) for a LOW total (≤6, i.e.
// below 7), 🐰 (rabbit) for a HIGH one (7+). Used for the 2d6 sum AND the
// dodecahedron (d12) value. Shows for EVERY player's roll (the gate is
// gs.dice-based, no isMyTurn). `pop` re-triggers the entrance animation.
function _showDiceAnimal(el, sum, pop) {
  if (!el) return;
  const glyph = sum <= 6 ? "🐢" : "🐰"; // below 7 = turtle, 7+ = rabbit (no gap)
  if (!glyph) { el.classList.remove("show"); el.textContent = ""; return; }
  el.textContent = glyph;
  if (pop) { el.classList.remove("show"); void el.offsetWidth; }
  el.classList.add("show");
}

// ── Post-roll abilities + Predict bluff UI ──────────────────────────────────
// The backend now holds a turn after the roll: turnPhase goes 'ability' →
// 'predicting' → 'resolved', and diceRolled stays FALSE until commit (so the
// spin/walk and end-turn are already held by their diceRolled gates). This
// renders the ACTIVE player's ability choices during 'ability', and every
// OPPONENT's yes/no Predict prompt during 'predicting'. Panels are built once
// and shown/hidden per frame. Handlers below emit the matching sockets.
function _renderPostRollUI(gs, me, isMyTurn) {
  const rollBtn = document.getElementById("btn-roll");
  const host = rollBtn && rollBtn.parentNode;
  if (!host) return;
  let panel = document.getElementById("post-roll-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "post-roll-panel";
    panel.className = "post-roll-panel";
    panel.style.display = "none";
    host.appendChild(panel);
  }
  let predict = document.getElementById("predict-panel");
  if (!predict) {
    predict = document.createElement("div");
    predict.id = "predict-panel";
    predict.className = "predict-panel";
    predict.style.display = "none";
    host.appendChild(predict);
  }
  const myCards = typeof me.rollCardCount === "number" ? me.rollCardCount
    : Array.isArray(me.rollCards) ? me.rollCards.length : 0;

  // (a) ACTIVE PLAYER — the ability box. ALWAYS visible during play (a fixed
  // square box with the 3 abilities + Walk in a 2x2 grid); the buttons only become
  // USABLE after you roll (the post-roll 'ability' window). No pre-roll arming.
  const inPlay = gs.state === "playing" && me && !me.bankrupt && !me.ghost && !me.startPickPending;
  if (inPlay) {
    if (panel.dataset.built !== "1") {
      panel.dataset.built = "1";
      panel.innerHTML =
        '<div class="prp-title" id="prp-title"></div>' +
        '<div class="prp-grid">' +
          '<button class="btn prp-btn" id="prp-walk" onclick="prPass()"></button>' +
          '<button class="btn prp-btn" id="prp-switch" onclick="prSwitch()"></button>' +
          '<button class="btn prp-btn" id="prp-steady" onclick="prSteadyOpen()"></button>' +
          '<button class="btn prp-btn" id="prp-teleport" onclick="prTeleportOpen()"></button>' +
          '<button class="btn prp-btn prp-mega" id="prp-mega-match" onclick="prMatchingMega()"></button>' +
          '<button class="btn prp-btn prp-mega" id="prp-mega-alt" onclick="prAlternativeMega()"></button>' +
        '</div>' +
        '<div class="prp-sub" id="prp-sub"></div>' +
        '<div class="prp-timer" id="prp-rtimer"></div>';
    }
    const abilityPhase = isMyTurn && gs.turnPhase === "ability";
    const dice = Array.isArray(gs.dice) ? gs.dice : [];
    const value = dice.reduce((a, b) => a + b, 0);
    const ownFarms = (gs.properties || []).filter((p) => p.owner === myId && p.group === "farm");
    const swBtn = panel.querySelector("#prp-switch");
    const stBtn = panel.querySelector("#prp-steady");
    const tpBtn = panel.querySelector("#prp-teleport");
    const wkBtn = panel.querySelector("#prp-walk");
    const mmBtn = panel.querySelector("#prp-mega-match");
    const maBtn = panel.querySelector("#prp-mega-alt");
    // The two MEGA buttons exist only in Mega Mode (→ a 2×3 grid; otherwise 2×2).
    const megaOn = !!gs.megaMode;
    mmBtn.style.display = megaOn ? "" : "none";
    maBtn.style.display = megaOn ? "" : "none";
    if (abilityPhase) {
      const switchTo = value < 7 ? value + 6 : value - 6;
      const switchWalk = switchTo < 7 ? 7 - switchTo : switchTo;
      const walk = value < 7 ? 7 - value : value;
      panel.querySelector("#prp-title").innerHTML = "You rolled <b>" + value + "</b> — use an ability?";
      wkBtn.textContent = "➡️ Continue (" + walk + ")";
      swBtn.textContent = "🔀 Switch → " + switchTo + " (walk " + switchWalk + ")";
      stBtn.textContent = "⚖️ Weighted Dice (1)";
      tpBtn.textContent = "🌿 Vine Swing (1)";
      wkBtn.disabled = false;
      swBtn.disabled = myCards < 1;
      stBtn.disabled = myCards < 1;
      tpBtn.disabled = myCards < 1 || ownFarms.length === 0;
      // MEGA enable mirrors the backend gate: MATCHING needs the roll to FIRE a grow
      // AND a held card equal to that grow's number (→ redraw); ALTERNATIVE needs any
      // NON-matching card (every card counts when no grow fires) → no redraw.
      const handVals = Array.isArray(me.rollCards) ? me.rollCards : [];
      const firesGrow = _rollFiresGrow(value);
      const hasMatch = firesGrow && handVals.includes(value);
      const hasAlt = handVals.some((cv) => !(firesGrow && cv === value));
      mmBtn.textContent = "⚡ Matching Mega";
      maBtn.textContent = "⚡ Alternative Mega";
      mmBtn.disabled = !megaOn || !hasMatch;
      maBtn.disabled = !megaOn || !hasAlt;
    } else {
      const waiting = isMyTurn && gs.turnPhase === "predicting";
      panel.querySelector("#prp-title").textContent = waiting
        ? "⏳ Opponents are predicting…"
        : isMyTurn
          ? "Abilities — roll first to use"
          : "Abilities (use after you roll)";
      wkBtn.textContent = "➡️ Continue";
      swBtn.textContent = "🔀 Switch Pets (1)";
      stBtn.textContent = "⚖️ Weighted Dice (1)";
      tpBtn.textContent = "🌿 Vine Swing (1)";
      mmBtn.textContent = "⚡ Matching Mega";
      maBtn.textContent = "⚡ Alternative Mega";
      swBtn.disabled = stBtn.disabled = tpBtn.disabled = wkBtn.disabled = true;
      mmBtn.disabled = maBtn.disabled = true;
      const sub = panel.querySelector("#prp-sub");
      if (sub && sub.innerHTML) sub.innerHTML = ""; // clear any stale steady/teleport picker
    }
    // Auto Continue (toggle): the roller auto-passes the post-roll window (walks the
    // plain roll) instead of clicking Continue — mirrors Auto Roll.
    if (abilityPhase) {
      const autoCont = document.getElementById("chk-auto-continue");
      if (autoCont && autoCont.checked && !window._autoContinueQueued) {
        window._autoContinueQueued = true;
        setTimeout(() => {
          window._autoContinueQueued = false;
          if (
            document.getElementById("chk-auto-continue").checked &&
            gs && gs.turnPhase === "ability" &&
            gs.currentPlayer && gs.currentPlayer.id === myId
          ) prPass();
        }, 600);
      }
    }
    // Shared countdown — the SAME deadline the opponents' predict modal shows.
    _setPredictTimer(panel.querySelector("#prp-rtimer"), gs.prediction && gs.prediction.respondDeadline);
    // A centered modal that POPS UP for the roller during their post-roll window
    // (the ability choice + while opponents predict); hidden for everyone else.
    const showModal = isMyTurn && (gs.turnPhase === "ability" || gs.turnPhase === "predicting");
    panel.style.display = showModal ? "" : "none";
  } else {
    panel.style.display = "none";
  }

  // (b) OPPONENT — Predict prompt. It now opens at ROLL time and runs CONCURRENTLY
  // with the roller's choice (a centered modal like the farm accept/reject box). After
  // voting it stays up as a "locked in — waiting" modal (nothing is revealed) until
  // both sides resolve. Ineligible (<2-card) opponents are auto-no → no modal.
  const pred = gs.prediction;
  const myVote = pred && pred.myVote;
  const iAmOpponent = !!(pred && myVote && gs.currentPlayer && gs.currentPlayer.id !== myId);
  const rolledSum = Array.isArray(gs.dice) ? gs.dice.reduce((a, b) => a + b, 0) : 0;
  if (iAmOpponent && !myVote.answered) {
    const canYes = myCards >= 2;
    if (predict.dataset.key !== "vote") {
      predict.dataset.key = "vote";
      predict.innerHTML =
        '<div class="prp-title" id="prp-ptitle"></div>' +
        '<div class="prp-row">' +
          '<button class="btn prp-btn prp-yes" id="prp-yes" onclick="prPredict(true)">Yes</button>' +
          '<button class="btn prp-btn prp-no" onclick="prPredict(false)">No</button>' +
        '</div>' +
        '<div class="prp-sub" id="prp-psub"></div>' +
        '<div class="prp-timer" id="prp-ptimer"></div>';
    }
    predict.querySelector("#prp-ptitle").innerHTML =
      "🔮 They rolled <b>" + rolledSum + "</b> — did they use an ability?";
    predict.querySelector("#prp-yes").disabled = !canYes;
    predict.querySelector("#prp-psub").textContent = canYes
      ? "Right → draw a card · Wrong → discard 2 · No is free"
      : "Need ≥2 cards to bet Yes";
    _setPredictTimer(predict.querySelector("#prp-ptimer"), pred.respondDeadline);
    predict.style.display = "";
    // Auto No (toggle): auto-predict "No" instead of clicking — mirrors Auto Accept.
    const autoNo = document.getElementById("chk-auto-no");
    if (autoNo && autoNo.checked && !window._autoNoQueued) {
      window._autoNoQueued = true;
      setTimeout(() => {
        window._autoNoQueued = false;
        if (
          document.getElementById("chk-auto-no").checked &&
          gs && gs.prediction && gs.prediction.myVote && !gs.prediction.myVote.answered
        ) prPredict(false);
      }, 600);
    }
  } else if (iAmOpponent && myVote.answered && myVote.eligible) {
    // Voted → locked in, waiting for the roller / the others. Nothing is revealed.
    if (predict.dataset.key !== "locked") {
      predict.dataset.key = "locked";
      predict.innerHTML =
        '<div class="prp-title">🔒 Locked in</div>' +
        '<div class="prp-sub">Waiting for the others — nobody can see your pick.</div>' +
        '<div class="prp-timer" id="prp-ptimer"></div>';
    }
    _setPredictTimer(predict.querySelector("#prp-ptimer"), pred.respondDeadline);
    predict.style.display = "";
  } else {
    predict.style.display = "none";
    if (predict.dataset.key) predict.dataset.key = "";
  }
}

function prPass() { if (typeof socket !== "undefined" && socket && gameId) socket.emit("pass_post_roll", { gameId }); }
function prSwitch() { if (socket && gameId) socket.emit("use_post_roll_ability", { gameId, ability: "switch" }); }
function prSteadyOpen() {
  const sub = document.getElementById("prp-sub");
  if (!sub) return;
  let html = '<div class="prp-pickhint">Pick a number (below-7 rules apply):</div><div class="prp-nums">';
  for (let n = 1; n <= 12; n++) html += '<button class="btn prp-num" onclick="prSteady(' + n + ')">' + n + "</button>";
  sub.innerHTML = html + "</div>";
}
function prSteady(n) { if (socket && gameId) socket.emit("use_post_roll_ability", { gameId, ability: "steady", value: n }); }
function prTeleportOpen() {
  const sub = document.getElementById("prp-sub");
  if (!sub || typeof gs === "undefined" || !gs) return;
  const farms = (gs.properties || []).filter((p) => p.owner === myId && p.group === "farm");
  if (!farms.length) { sub.textContent = "You own no farms to teleport to."; return; }
  let html = '<div class="prp-pickhint">Teleport to (stake 1; denied + forfeit if predicted):</div><div class="prp-nums">';
  for (const f of farms) html += '<button class="btn prp-num" onclick="prTeleport(' + f.id + ')">' + (f.name || "#" + f.id) + "</button>";
  sub.innerHTML = html + "</div>";
}
function prTeleport(pos) { if (socket && gameId) socket.emit("use_post_roll_ability", { gameId, ability: "teleport", position: pos }); }
function prPredict(yes) { if (socket && gameId) socket.emit("submit_prediction", { gameId, predict: !!yes }); }
function prMatchingMega() { if (socket && gameId) socket.emit("use_post_roll_ability", { gameId, ability: "matching_mega" }); }
function prAlternativeMega() { if (socket && gameId) socket.emit("use_post_roll_ability", { gameId, ability: "alternative_mega" }); }

// Does the active roll FIRE a grow? True iff the rolled value (1..6) labels a grow
// tile that is genuinely revealed — the client mirror of the backend's
// _wouldRolledGrowFire (same condition as board.js's armed-grow preview). Used to
// enable "Matching Mega" (a card can only "match the grow your roll fires").
function _rollFiresGrow(v) {
  if (typeof gs === "undefined" || !gs) return false;
  if (!Number.isInteger(v) || v < 1 || v > 6) return false;
  const layout = Array.isArray(gs.boardLayout) ? gs.boardLayout : [];
  const rev = Array.isArray(gs.genuineRevealedGrows) ? gs.genuineRevealedGrows : [];
  for (let i = 0; i < layout.length; i++) {
    const t = layout[i];
    if (t && t.type === "grow" && t.growLabel === v && rev.includes(i)) return true;
  }
  return false;
}

// Shared post-roll countdown (the prediction deadline). A single interval ticks every
// VISIBLE .prp-timer element from a deadline stored on it, and self-stops when none are
// visible. Used by both the roller's ability modal and the opponents' predict modal so
// they show the SAME shared timer.
let _predTimerInterval = null;
function _setPredictTimer(el, deadline) {
  if (!el) return;
  if (!deadline) { el.textContent = ""; el.removeAttribute("data-deadline"); return; }
  el.setAttribute("data-deadline", String(deadline));
  _tickPredTimers();
  if (!_predTimerInterval) _predTimerInterval = setInterval(_tickPredTimers, 250);
}
function _tickPredTimers() {
  const els = document.querySelectorAll(".prp-timer[data-deadline]");
  let anyVisible = false;
  els.forEach((el) => {
    if (el.offsetParent === null) return; // its modal is hidden
    anyVisible = true;
    const dl = Number(el.getAttribute("data-deadline"));
    const s = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
    el.textContent = "⏳ " + s + "s";
  });
  if (!anyVisible && _predTimerInterval) { clearInterval(_predTimerInterval); _predTimerInterval = null; }
}

function showGame() {
  showScreen("screen-game");

  // Welcome message on first render
  if (!window._chatWelcomeSent) {
    window._chatWelcomeSent = true;
    const container = document.getElementById("board-chat-messages");
    if (container) {
      const msg = document.createElement("div");
      msg.className = "board-chat-msg";
      const nameSpan = document.createElement("span");
      nameSpan.className = "board-chat-name";
      nameSpan.style.color = "#ffe135";
      nameSpan.textContent = "🍌";
      const textSpan = document.createElement("span");
      textSpan.className = "board-chat-text";
      textSpan.textContent = "Welcome To Monkey Bidniz!";
      msg.appendChild(nameSpan);
      msg.appendChild(textSpan);
      container.appendChild(msg);
    }
  }

  const cur = gs.currentPlayer;
  const me = _gsPlayerMap[myId];
  const isMyTurn = cur && cur.id === myId;

  // Caster-private: a MISSED cancel YOU cast owes you a CHOSEN discard. Pop the
  // shared picker the instant the owner-only count appears (non-dismissible — you
  // must pick which cards to forfeit), and RE-open it if the owed count changes (a
  // 2nd missed cancel can bump the debt while the picker is already up). The
  // resolving guard suppresses a re-open only in the gap between confirming and the
  // next server update (game-socket clears it on every game_update, so it can't
  // latch). dataset.mode guards against colliding with a stray teleport picker.
  if (me && me.pendingCancelDiscard > 0) {
    const dpOverlay = document.getElementById("card-discard-overlay");
    const isCancelPicker = dpOverlay && dpOverlay.dataset.mode === "cancel-miss";
    const shownCount = isCancelPicker ? Number(dpOverlay.dataset.discardCount) : -1;
    if (
      !window._cancelDiscardResolving &&
      (!isCancelPicker || shownCount !== me.pendingCancelDiscard)
    ) {
      openCardDiscardPicker({
        mode: "cancel-miss",
        cards: me.rollCards || [],
        count: me.pendingCancelDiscard,
        dismissible: false,
        onConfirm: (indices) => {
          window._cancelDiscardResolving = true;
          socket.emit("cancel_discard_pick", { gameId, indices });
        },
      });
    }
  }

  // Turn info
  {
    const isMyTurnLabel = cur && cur.id === myId;
    const startPickLabel =
      cur &&
      cur.startPickPending &&
      (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3");
    document.getElementById("turn-name").textContent = cur
      ? isMyTurnLabel
        ? startPickLabel
          ? "Pick your start tile!"
          : "Your turn!"
        : startPickLabel
          ? `${cur.name} is picking a tile\u2026`
          : cur.name
      : "—";
    document.getElementById("turn-name").style.color = isMyTurnLabel
      ? "#ffe135"
      : cur
        ? ""
        : "#888";
    const turnInfoEl = document.querySelector(".turn-info");
    if (turnInfoEl) turnInfoEl.classList.toggle("my-turn", !!isMyTurnLabel);
  }

  // Dice
  const die1El = document.getElementById("die1");
  const die2El = document.getElementById("die2");
  const die3El = document.getElementById("die3");
  const dieScene1 = document.getElementById("die-scene1");
  const dieScene2 = document.getElementById("die-scene2");
  const dieScene3 = document.getElementById("die-scene3");
  const rollCardScene = document.getElementById("roll-card-scene");
  const d12Scene = document.getElementById("d12-scene");
  const diceSum = document.getElementById("dice-sum");
  const diceSumNum = document.getElementById("dice-sum-num");
  const diceAnimal = document.getElementById("dice-animal");
  // Show/hide die scenes based on dice count. A single-element gs.dice ([N]) is
  // either a played SPELL CARD (untagged) or a HEXED roll (tagged gs.diceIsD12).
  // Both go through the length-1 "card" branch: the hex sub-branch renders the
  // actual 12-sided DODECAHEDRON (#d12-scene); a spell card deals the CARD
  // (#roll-card-scene). A cancelled card / normal roll is a real 2d6 (length 2) -> cubes.
  const numDice = gs.dice ? gs.dice.length : 2;
  const isCardPlay = !!(gs.dice && gs.dice.length === 1);
  // A HEXED roll (single d12, tagged diceIsD12) renders as the blue dodecahedron.
  const isD12Roll = !!(gs && gs.diceIsD12 && isCardPlay);
  // For a played spell card, the dealt card shows the WALK number via die1Value
  // (turtle: 7 - value; rabbit/+6: the value itself, already >= 7 because the
  // backend set gs.dice[0] = N + 6). For a normal/hex roll, die1Value is just
  // the raw die value (gs.dice[0]).
  const isSorceryPlay = isCardPlay && !isD12Roll;
  const die1Value = isSorceryPlay
    ? (gs.dice[0] < 7 ? 7 - gs.dice[0] : gs.dice[0])
    : (gs.dice ? gs.dice[0] : 0);
  if (isCardPlay) {
    if (dieScene2) dieScene2.style.display = "none";
    if (dieScene3) dieScene3.style.display = "none";
    if (isD12Roll) {
      if (dieScene1) dieScene1.style.display = "none";
      if (rollCardScene) rollCardScene.style.display = "none";
      if (d12Scene) {
        d12Scene.style.display = "";
        const n = d12Scene.querySelector(".d12-num");
        if (n) n.textContent = String(gs.dice[0]);
      }
    } else {
      // Spell card: deal the CARD bearing the WALK number (die1Value handles both
      // modes). No die is shown.
      if (d12Scene) d12Scene.style.display = "none";
      if (dieScene1) {
        dieScene1.style.display = "none";
        dieScene1.classList.remove("sorcery-die", "hex-die");
      }
      if (rollCardScene) {
        rollCardScene.style.display = "";
        const numEl = rollCardScene.querySelector(".roll-play-card-num");
        if (numEl) numEl.textContent = String(die1Value);
      }
    }
  } else {
    if (rollCardScene) rollCardScene.style.display = "none";
    if (d12Scene) d12Scene.style.display = "none";
    if (dieScene1) {
      dieScene1.style.display = "";
      // A HEXED roll (single d12) tints the cube PURPLE; a normal 2d6 clears both
      // skins (sorcery-die is only for a played card).
      dieScene1.classList.toggle("hex-die", !!(gs && gs.diceIsD12));
      dieScene1.classList.remove("sorcery-die");
    }
    if (dieScene2) dieScene2.style.display = numDice >= 2 ? "" : "none";
    if (dieScene3) dieScene3.style.display = numDice >= 3 ? "" : "none";
  }
  // The 🐢/🐰 speed indicator shows for EVERY settled roll — 2d6, the d12 hex,
  // AND a played spell card — keyed on the move value (< 7 turtle, >= 7 rabbit).
  // The running TOTAL badge stays 2d6 + d12 only (it's redundant on a single
  // card). A FRESH roll (key not yet recorded) or one still spinning stays hidden;
  // the dice-landing branch re-pops them the moment the dice settle.
  if (diceSum) {
    const diceKeyNow = gs.dice ? gs.dice.join("-") + "-" + gs.turn : "";
    const d12El = d12Scene && d12Scene.querySelector(".d12-die");
    // A spell card sets diceRolled=true + _lastDiceKey at the START of its 0.55s
    // deal, so its mid-deal ".dealing" state must count as spinning too — else a
    // re-render could pop the 🐢/🐰 before the card lands (spoiling the result).
    const cardDealEl = rollCardScene && rollCardScene.querySelector(".roll-play-card");
    const spinning =
      !!(die1El && die1El.classList.contains("rolling")) ||
      !!(d12El && d12El.classList.contains("rolling")) ||
      !!(cardDealEl && cardDealEl.classList.contains("dealing"));
    const settled =
      gs.diceRolled && diceKeyNow === window._lastDiceKey && !spinning &&
      gs.dice && gs.dice.length;
    // Speed animal — always (turtle/rabbit by the move value, any roll type).
    if (settled && diceAnimal) {
      const animalVal = numDice >= 2 ? gs.dice.reduce((a, b) => a + b, 0) : gs.dice[0];
      _showDiceAnimal(diceAnimal, animalVal, false);
    } else if (diceAnimal) {
      diceAnimal.classList.remove("show");
    }
    // Running TOTAL — 2d6 + d12 only.
    if (settled && (isD12Roll || (!isCardPlay && numDice >= 2))) {
      const _sum = isD12Roll ? gs.dice[0] : gs.dice.reduce((a, b) => a + b, 0);
      if (diceSumNum) diceSumNum.textContent = String(_sum);
      diceSum.classList.toggle("is-low", _sum < 7); // green digit when below 7
      diceSum.classList.add("show");
    } else {
      diceSum.classList.remove("show");
    }
  }
  const coinEl = document.getElementById("coin");
  // Brief delay before allowing dice roll at the start of each turn
  const ROLL_DELAY = 2000;
  const turnKey2 = `${gs.turn}-${isMyTurn}`;
  if (isMyTurn && !gs.diceRolled && turnKey2 !== window._lastRollDelayKey) {
    window._lastRollDelayKey = turnKey2;
    window._rollReady = false;
    clearTimeout(window._rollDelayTimer);
    window._rollDelayTimer = setTimeout(() => {
      window._rollReady = true;
      // Re-render to enable roll button
      route();
    }, ROLL_DELAY);
  }
  const rollDelayDone = window._rollReady || gs.diceRolled;
  const needsStartPick =
    (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3") &&
    gs.currentPlayer &&
    !!gs.currentPlayer.startPickPending;
  const canRoll =
    isMyTurn &&
    !gs.diceRolled &&
    !gs.turnPhase && // no re-roll while a post-roll ability / predict window is open
    !gs.superBananaPending &&
    !needsStartPick &&
    !gs.redraw && // a pending spell-card redraw must be resolved first
    rollDelayDone;
  document.getElementById("btn-roll").disabled = !canRoll;
  document.getElementById("btn-debug-move").disabled = !canRoll;

  // Pre-roll "Teleport to Farm" button REMOVED (it was redundant + caused flicker).
  // Teleport is now a POST-ROLL ability — "Vine Swing" in the centered ability modal
  // (see _renderPostRollUI / prTeleportOpen). Keep the board pick-mode flag pinned
  // off so the old "pick a farm" pre-roll path can never re-arm.
  window._teleportPickMode = false;

  // Start-pick prompt + Random Start button — centered in the board, shown only
  // on the player's own start-pick turn (the Roll button is disabled then). The
  // server picks a random unoccupied tile so 2nd/3rd/4th picks never collide.
  const startRandomWrap = document.getElementById("board-random-start");
  if (startRandomWrap) {
    startRandomWrap.style.display = isMyTurn && needsStartPick ? "flex" : "none";
  }

  // Proxy rune deck — a face-down draw pile centered in the board. Purely a
  // visual indicator: when any player gains a spell card, a card flies from
  // here to their token (see flyRuneDraw in game-init.js). Hidden during
  // start-pick and while a center overlay (poker / auction) occupies the
  // middle, so it never clutters those.
  const runeDeck = document.getElementById("rune-deck");
  if (runeDeck) {
    const startVisible =
      startRandomWrap && startRandomWrap.style.display !== "none";
    const pokerEl = document.getElementById("poker-table");
    const auctionEl = document.getElementById("auction-box");
    const centerBusy =
      startVisible ||
      (pokerEl && pokerEl.style.display && pokerEl.style.display !== "none") ||
      (auctionEl && auctionEl.style.display && auctionEl.style.display !== "none");
    runeDeck.style.display =
      gs.state === "playing" && !centerBusy ? "flex" : "none";
  }

  // Roll-button label.
  const rollBtn = document.getElementById("btn-roll");
  if (rollBtn) {
    rollBtn.textContent = "Roll Dice";
  }

  // Auto-roll: trigger dice roll when it's our turn and we haven't rolled yet.
  // An ARMED spell card takes precedence (it auto-plays instead — see the
  // armed auto-activation in the Spell Cards section below), so skip auto-roll
  // while a roll is armed.
  if (
    canRoll &&
    !(me && me.armedRoll) &&
    !window._teleportPickMode && // don't auto-roll while choosing a teleport farm
    document.getElementById("chk-auto-roll").checked
  ) {
    if (!window._autoRollQueued) {
      window._autoRollQueued = true;
      setTimeout(() => {
        window._autoRollQueued = false;
        if (document.getElementById("chk-auto-roll").checked) rollDice();
      }, 100);
    }
  }

  // 3D die transform map: rotate cube so the correct face points toward viewer
  const DIE_TRANSFORMS = {
    1: "rotateX(0deg) rotateY(0deg)",
    2: "rotateX(0deg) rotateY(-90deg)",
    3: "rotateX(-90deg) rotateY(0deg)",
    4: "rotateX(90deg) rotateY(0deg)",
    5: "rotateX(0deg) rotateY(90deg)",
    6: "rotateX(0deg) rotateY(180deg)",
  };
  function setDieFace(dieEl, value) {
    const v = parseInt(value, 10);
    // Dice and spell cards are always 1..6 — rotate the 3D cube to that face.
    if (v >= 1 && v <= 6) {
      dieEl.style.transform = DIE_TRANSFORMS[v];
      dieEl.style.visibility = "";
    }
  }

  // Restore a die to a clean, visible 3D-cube state. Used at spin start and on a
  // no-roll render (e.g. after a game reset ships gs.dice=[0,0]).
  function resetDieOverlay(dieEl) {
    if (!dieEl) return;
    dieEl.style.visibility = "";
  }

  // Fire the landing flourish (squash/bounce + brightness flash + gold bloom &
  // shockwave ring) on a die's OUTER .die-scene. Geometry-safe: only touches
  // scene.classList — never the inner cube's transform — so the settled face is
  // untouched. The flourish (CSS) plays CONCURRENTLY with the token walk; no
  // pre-walk pause is added. Cleanup drops .landed after the longest sub-anim
  // (dieShockwave, 0.6s), guarded on the walk generation stamp so a stale
  // cleanup from a previous roll can't cut a fresh flourish short.
  function fireDieLanding(dieEl) {
    if (!dieEl) return;
    const scene = dieEl.closest(".die-scene");
    if (!scene) return;
    scene.classList.remove("landed");
    void scene.offsetWidth; // restart cleanly if a stale .landed lingers
    scene.classList.add("landed");
    const gen = window._walkGen;
    setTimeout(() => {
      if (window._walkGen === gen) scene.classList.remove("landed");
    }, 650);
  }

  // Universal dice roll notification — show for all players when dice are rolled.
  // Start picks teleport instantly, so skip the walk animation path. A played
  // spell card walks step-by-step exactly like a normal roll (the
  // backend sets gs.dice = [N] and does NOT set itemMoveThisTurn).
  const diceNotif = document.getElementById("dice-roll-notification");
  const isStartPickTeleport =
    !!(gs.lastStartPick && gs.lastStartPick.turn === gs.turn);
  // A farm teleport also jumps instantly (no walk) — skip the walk-animation
  // path so renderBoard just places the token at the destination.
  const isTeleportJump =
    !!(gs.lastTeleport && gs.lastTeleport.turn === gs.turn);
  // Because the teleport skips the walk block (which is the ONLY place that nulls
  // the frozen-walk globals), a previous walk whose deferred cleanup is still
  // pending could leave window._diceRollingPositions holding the OLD tile — and
  // renderBoard would then paint the token at that stale frozen spot instead of
  // the teleport destination (the JUMP appears not to happen). Proactively clear
  // the freeze the instant a NEW teleport arrives so the token lands correctly.
  if (
    isTeleportJump &&
    window._teleportJumpKey !==
      `${gs.lastTeleport.playerId}:${gs.lastTeleport.turn}`
  ) {
    window._teleportJumpKey = `${gs.lastTeleport.playerId}:${gs.lastTeleport.turn}`;
    window._walkGen = (window._walkGen || 0) + 1; // invalidate any pending walk timers
    window._tokenWalking = false;
    window._diceRollingPositions = null;
    window._walkStartPositions = null;
    window._frozenBananaPiles = null;
    window._walkingPlayerId = null;
    // A teleport JUMP no longer fires a steal visual: under the steal-on-LAND rule
    // leaving a squat takes nothing, and a teleport destination is always your OWN
    // farm (so there's no opponent land-steal). Any own-pile harvest at the
    // destination still shows via the normal pile-decrement path.
  }
  if (
    diceNotif &&
    gs.diceRolled &&
    !gs.itemMoveThisTurn &&
    !isStartPickTeleport &&
    !isTeleportJump &&
    cur
  ) {
    const diceKey = gs.dice.join("-") + "-" + gs.turn;
    if (diceKey !== window._lastDiceKey) {
      window._lastDiceKey = diceKey;
      // Walk generation stamp. Every deferred callback this handler schedules
      // (dice spin ticker, walk interval, landing cleanup, grow-unfreeze,
      // finishLanding, pulse timers) belongs to THIS walk. When the next roll
      // arrives — possibly while these timers are still pending (auto-roll,
      // quick manual rolls, or a background tab flushing throttled timers on
      // refocus) — the generation advances and every stale callback must
      // no-op instead of mutating the shared walk/freeze globals. Without
      // this, a stale _growUnfreeze nulls the NEW walk's _frozenBananaPiles
      // and walk tracking mid-walk, which is what made pile boxes blink out,
      // reappear, and replay their grow bounce at turn handoff.
      window._walkGen = (window._walkGen || 0) + 1;
      const _walkGen = window._walkGen;
      const _walkAlive = () => window._walkGen === _walkGen;
      // Mark walk in progress immediately so subsequent game_updates
      // defer money effects (closes the gap between _lastDiceKey set and walk start)
      window._tokenWalking = true;
      window._walkPileCollected = 0;
      // Super Banana CROSS floater amount burst AT THE SB TILE mid-walk — tracked
      // so the walk-end money reconciliation subtracts it (never burst on the token).
      window._walkSbCrossBurst = 0;
      window._sbCrossFloaterFired = null; // fresh dedup key per walk
      // Freeze token positions and tile reveals at pre-roll state during animation
      window._diceRollingPositions = window._prevPlayerPositions || null;
      window._walkStartPositions = window._prevPlayerPositions ? Object.assign({}, window._prevPlayerPositions) : null;
      window._diceRollingRevealed = window._prevRevealedTiles || null;
      // Freeze banana piles and track which tiles the token has visited
      window._frozenBananaPiles = window._prevBananaPileState || null;
      window._tokenVisitedTiles = new Set();
      // Clear any stale grow-pulse gating from a prior turn (set fresh below if
      // a rolled grow fires this turn). The revealed-amounts memory clears
      // here too: the fresh _frozenBananaPiles snapshot installed above
      // already carries last turn's grown piles, so the memory has done its
      // job (bridging renders that arrive before this re-freeze).
      window._pulseRevealedTiles = null;
      window._pulseRevealedAmounts = null;
      // Freeze per-player pile totals so pstat-pile decreases in sync with board collection
      if (gs.properties) {
        window._frozenPileTotals = {};
        for (const prop of gs.properties) {
          if (prop.owner && window._prevBananaPileState && window._prevBananaPileState[prop.id] > 0) {
            window._frozenPileTotals[prop.owner] =
              (window._frozenPileTotals[prop.owner] || 0) + window._prevBananaPileState[prop.id];
          }
        }
      }
      window._walkingPlayerId = cur.id;
      window._walkingLandingPos = cur.position;
      // Reset the per-walk dedup sets here, before the pile-decrement detector and
      // the land-steal "Stolen" floater (fired on ARRIVAL — see the landing block
      // below) mark their tiles. Otherwise renderBoard's own reset block would fire
      // on the first frame of this walk and clobber those marks.
      if (typeof resetWalkDedup === "function") resetWalkDedup();
      window._walkPreMoney = window._prevPlayerMoney && window._prevPlayerMoney[cur.id] != null
        ? window._prevPlayerMoney[cur.id] : (cur.money || 0);
      // Freeze money display at pre-roll value
      window._frozenMoney =
        window._prevMoney != null ? window._prevMoney : null;
      // Start the physical dice roll. Spell Cards rolls EXACTLY like a normal
      // roll (same spin, sound, and notification) so opponents can't tell it was
      // used — its only tell, the cooldown, is shown to its own user alone.
      // A spell card now spins a single die (no dealt card); a normal roll spins
      // the dice cube(s).
      const d12DieEl = d12Scene && d12Scene.querySelector(".d12-die");
      const d12NumEl = d12Scene && d12Scene.querySelector(".d12-num");
      const playCardEl = rollCardScene && rollCardScene.querySelector(".roll-play-card");
      if (isCardPlay) {
        if (isD12Roll) {
          if (d12DieEl) {
            d12DieEl.classList.remove("landed", "rolling");
            void d12DieEl.offsetWidth; // restart the tumble
            d12DieEl.classList.add("rolling");
          }
        } else if (playCardEl) {
          // Spell card: deal the card in (no die).
          playCardEl.classList.remove("landed", "dealing");
          void playCardEl.offsetWidth; // restart the deal animation
          playCardEl.classList.add("dealing");
        }
      } else {
        resetDieOverlay(die1El);
        die1El.classList.add("rolling");
        if (numDice >= 2) die2El.classList.add("rolling");
        if (numDice >= 3) die3El.classList.add("rolling");
      }
      const rollDuration = 550;
      const rollInterval = 70;
      let elapsed = 0;
      const ticker = setInterval(() => {
        if (!_walkAlive()) {
          clearInterval(ticker);
          return;
        }
        elapsed += rollInterval;
        if (isCardPlay && isD12Roll && d12NumEl && elapsed < rollDuration) {
          // Slot-machine the d12 value while the die tumbles.
          d12NumEl.textContent = String(1 + Math.floor(Math.random() * 12));
        }
        if (elapsed >= rollDuration) {
          clearInterval(ticker);
          if (isCardPlay) {
            if (isD12Roll) {
              // Settle the dodecahedron: stamp the value and bounce.
              if (d12NumEl) d12NumEl.textContent = String(gs.dice[0]);
              if (d12DieEl) {
                d12DieEl.classList.remove("rolling");
                void d12DieEl.offsetWidth;
                d12DieEl.classList.add("landed");
              }
              // Reveal the Total badge + 🐢/🐰 indicator for the d12, exactly like a
              // settled 2d6 (the d12 value IS its total). Green when below 7.
              if (diceSum) {
                const _v = gs.dice[0];
                if (diceSumNum) diceSumNum.textContent = String(_v);
                diceSum.classList.toggle("is-low", _v < 7);
                diceSum.classList.remove("show");
                void diceSum.offsetWidth; // restart the pop animation
                diceSum.classList.add("show");
                _showDiceAnimal(diceAnimal, _v, true);
              }
            } else {
              // Settle the dealt card: stamp the WALK number and pop it.
              const numEl = rollCardScene && rollCardScene.querySelector(".roll-play-card-num");
              if (numEl) numEl.textContent = String(die1Value);
              if (playCardEl) {
                playCardEl.classList.remove("dealing");
                void playCardEl.offsetWidth;
                playCardEl.classList.add("landed");
              }
              // 🐢/🐰 speed indicator for a played spell card too — keyed on the
              // card value (< 7 turtle, >= 7 rabbit, i.e. the +6 rabbit toggle).
              _showDiceAnimal(diceAnimal, gs.dice[0], true);
            }
          } else {
          setDieFace(die1El, die1Value);
          if (numDice >= 2) setDieFace(die2El, gs.dice[1]);
          if (numDice >= 3) setDieFace(die3El, gs.dice[2]);
          die1El.classList.remove("rolling");
          if (numDice >= 2) die2El.classList.remove("rolling");
          if (numDice >= 3) die3El.classList.remove("rolling");
          // Landing flourish on the OUTER scene (overlaps the walk; geometry-safe).
          fireDieLanding(die1El);
          if (numDice >= 2) fireDieLanding(die2El);
          if (numDice >= 3) fireDieLanding(die3El);
          // Reveal the clear running TOTAL + the cute 🐢/🐰 speed indicator the
          // instant the cubes settle (default 2d6 only — a single-die rune/d12 took
          // the isCardPlay branch above).
          if (diceSum && numDice >= 2) {
            const _sum = gs.dice.reduce((a, b) => a + b, 0);
            if (diceSumNum) diceSumNum.textContent = String(_sum);
            diceSum.classList.toggle("is-low", _sum < 7); // green digit when below 7
            diceSum.classList.remove("show");
            void diceSum.offsetWidth; // restart the pop animation
            diceSum.classList.add("show");
            _showDiceAnimal(diceAnimal, _sum, true);
          }
          }
          // GROW pulse: a coloured glow chains from each fired grow
          // along its range, popping in grown piles as it crosses. Rolled-number
          // grows pulse BEFORE the walk; a grow you LAND on pulses after you
          // arrive (see the walk-end grow branch). While any pulse is in play
          // the grown piles stay hidden until the pulse sweeps over them (gated
          // by _pulseRevealedTiles).
          const pulseGrows = _computePreWalkGrowPulse(gs);
          const landGrows = _computeLandGrowPulse(gs);
          const usePulse = pulseGrows.length > 0;
          const anyGrowPulse =
            (gs.gameMode === "classic" || gs.gameMode === "2v2" || gs.gameMode === "3v3") &&
            (pulseGrows.length > 0 || landGrows.length > 0);
          // Show dice-match pile grows immediately when dice settle
          const hasDiceMatch = gs.diceMatchTiles && gs.diceMatchTiles.length > 0;
          if (anyGrowPulse) window._pulseRevealedTiles = new Set();
          if (hasDiceMatch) {
            window._diceMatchUnfrozen = true;
            window._diceMatchStealRender = true;
            renderBoard(gs); // pulse case: grown piles stay hidden (gated)
          }
          // Early Pickup: the player was standing on a farm of theirs that
          // grew (rolled grow sets diceMatchEarlyPickup). Show a floater on
          // that tile, burst the fresh growth, mark it visited so its pile
          // clears, and add a short delay before the walk so the pickup
          // reads clearly. In the pulse case this is fired by the pulse
          // when it crosses the tile (see _runGrowPulse).
          const hasEarlyPickup = gs.diceMatchEarlyPickup != null;
          if (hasEarlyPickup && !usePulse) {
            const epTile = document.getElementById("space-" + gs.diceMatchEarlyPickup);
            if (epTile) {
              const epRect = epTile.getBoundingClientRect();
              const epFloater = document.createElement("div");
              epFloater.className = "early-pickup-floater";
              epFloater.textContent = "Early Pickup!";
              epFloater.style.position = "fixed";
              epFloater.style.left = epRect.left + epRect.width / 2 + "px";
              epFloater.style.top = epRect.top + epRect.height / 2 + "px";
              epFloater.style.pointerEvents = "none";
              epFloater.style.zIndex = "9999";
              document.body.appendChild(epFloater);
              epFloater.addEventListener("animationend", () => epFloater.remove());
            }
            // Trigger pile collection burst at the starting tile
            bananaBurst(gs.diceMatchGrownAmounts && gs.diceMatchGrownAmounts[gs.diceMatchEarlyPickup] || 1, cur.id);
            // Mark the early-pickup tile as visited so the pile disappears immediately
            if (window._tokenVisitedTiles) {
              window._tokenVisitedTiles.add(gs.diceMatchEarlyPickup);
            }
            walkStepUpdate(gs);
          }
          // BELOW 7 / inversion overlay ("7 - N -> hop"): a dice/d12 roll below 7
          // walks 7 - rolled; a played SPELL CARD (value N) ALSO always inverts and
          // walks 7 - N — so show the same overlay for cards too.
          const growHop = gs.lastGrowMatchHop;
          const isRunePlay = !!(gs.dice && gs.dice.length === 1 && !gs.diceIsD12);
          const hasGrowHop = !!(growHop && typeof growHop.rolled === "number");
          const cardN = (isRunePlay && typeof gs.dice[0] === "number") ? gs.dice[0] : null;
          // A played card always pops a mode banner (turtle below-7 / rabbit +6),
          // so hold the walk a beat longer (see walkDelay) for ANY card play.
          const showCardHop = cardN != null;
          if (cardN != null && cardN <= 6) {
            // TURTLE MODE (below 7): a played card of value N inverts to walk 7 - N.
            _showGrowMatchHop(cardN, 7 - cardN, 7, "turtle");
          } else if (cardN != null && cardN >= 7) {
            // RABBIT MODE (above 7, +6): a played card walks its FULL value N + 6.
            // gs.dice[0] is already N + 6, so the original card value is cardN - 6.
            _showGrowMatchHop(6, cardN, cardN - 6, "rabbit");
          } else if (hasGrowHop && !isRunePlay) {
            // Default 2d6 roll whose SUM matched a grow → the "BELOW 7!" overlay.
            // The dice cubes stay WHITE (like the rabbit/+6 dice); only the Total
            // badge below them turns green for the low roll.
            _showGrowMatchHop(growHop.rolled, growHop.hop, growHop.base);
          }
          // Step-by-step token walk to final position
          const total = gs.dice.reduce((a, b) => a + b, 0);
          // A single die means a played spell card (gs.dice = [N]);
          // two dice is a normal roll.
          const megaOn = !!gs.megaMode;
          const rollText = isRunePlay
            ? (gs.dice[0] <= 6
                ? (megaOn
                    ? `🐢 ${cur.name} played MEGA TURTLE — walks ${7 - gs.dice[0]}, grows 5×`
                    : `🐢 ${cur.name} played TURTLE — walks ${7 - gs.dice[0]}`)
                : (megaOn
                    ? `🐇 ${cur.name} played MEGA RABBIT — leaps ${gs.dice[0]}, steals every pile`
                    : `🐇 ${cur.name} played RABBIT — leaps ${gs.dice[0]}`))
            : gs.dice.length === 1
              ? `🎲 ${cur.name} played a ${gs.dice[0]}`
              : `🎲 ${cur.name} rolled ${gs.dice.join("+")} = ${total}`;
          const startPos =
            window._diceRollingPositions &&
            window._diceRollingPositions[cur.id] != null
              ? window._diceRollingPositions[cur.id]
              : cur.position;
          // Board loop length: 48 (cornerless).
          const BSZ = (gs.boardLayout && gs.boardLayout.length) || 48;
          // Detect backward movement (e.g. a backward push): if forward distance > half the board, walk backward instead
          const forwardDist = (cur.position - startPos + BSZ) % BSZ;
          const backwardDist = (startPos - cur.position + BSZ) % BSZ;
          const walkBackward = forwardDist > BSZ / 2 && backwardDist <= 3;
          const steps = walkBackward ? backwardDist : forwardDist || total;
          // Delay walk start when dice-match animation needs to play, and when
          // an early-pickup floater is shown, so the pickup is visible before
          // the walk.
          // With a grow pulse in play the pulse drives the timing (grown piles
          // are gated until it sweeps; landing-grow piles reveal after arrival),
          // so skip the dice-match pre-walk pause.
          const baseWalkDelay = anyGrowPulse
            ? 0
            : hasDiceMatch
              ? (1200 + (hasEarlyPickup ? 1000 : 0))
              : (hasEarlyPickup ? 1000 : 0);
          // Hold the walk so the GROW-match "7 - N = M" animation plays BEFORE the
          // token moves (even in pulse mode, where the base delay is 0). Held ~1s
          // longer so the calculator stays up a beat longer before the hop.
          const walkDelay = (hasGrowHop || showCardHop)
            ? Math.max(baseWalkDelay, 2300)
            : baseWalkDelay;
          const startWalk = () => {
          let step = 0;
          // Keep reveals frozen during walk, but let token move
          window._diceRollingRevealed = window._diceRollingRevealed || null;
          const walkInterval = setInterval(() => {
            if (!_walkAlive()) {
              clearInterval(walkInterval);
              return;
            }
            step++;
            if (step >= steps) {
              clearInterval(walkInterval);

              // ── Smooth landing: move token to final position via the
              // lightweight walk-step path first, then defer the heavy
              // full-board rebuild so the CSS transition finishes cleanly.
              const finalPos = walkBackward
                ? (startPos - step + BSZ) % BSZ
                : (startPos + step) % BSZ;
              window._diceRollingPositions = window._diceRollingPositions || {};
              window._diceRollingPositions[cur.id] = finalPos;
              if (window._tokenVisitedTiles) {
                window._tokenVisitedTiles.add(finalPos);
              }
              // LAND-STEAL: if the token just LANDED on an OPPONENT's farm that had a
              // pile, the backend stole it on arrival — pop the "Stolen" floater AT
              // THE LANDED TILE. Fire it BEFORE walkStepUpdate so it seeds _stealShown
              // + _walkStartStealTiles FIRST; otherwise the pile-decrement detector
              // inside walkStepUpdate marks _stealShown and the floater short-circuits.
              // Detected client-side: the landed tile's pre-move pile was > 0 and it's
              // owned by someone else (the lander revealed it → fog-safe; other viewers
              // gate on the owner being visible to them).
              // A TURTLE move (value < 7, walked 7-value) does NOT steal on landing
              // (backend suppresses it), so don't show the "Stolen" floater either.
              // gs.lastGrowMatchHop is set iff the committed move was a turtle move.
              if (window._prevBananaPileState && typeof _showStealFloaterAt === "function" && !gs.lastGrowMatchHop) {
                const _stealPrev = window._prevBananaPileState[finalPos] || 0;
                const _stealProp =
                  gs.properties && gs.properties.find((p) => p && p.id === finalPos);
                if (
                  _stealPrev > 0 &&
                  _stealProp && _stealProp.owner && _stealProp.owner !== cur.id
                ) {
                  _showStealFloaterAt(finalPos);
                }
              }
              walkStepUpdate(gs);
              playMoveTickSound();
              // Landing pulse on the final tile
              const landedEl = document.getElementById("space-" + finalPos);
              if (landedEl) {
                landedEl.classList.remove("space-stepped", "space-landed");
                void landedEl.offsetWidth;
                landedEl.classList.add("space-landed");
                landedEl.addEventListener("animationend", () => landedEl.classList.remove("space-landed"), { once: true });
              }
              // Super Banana LAND: if the token LANDED on the SB tile and grabbed
              // the +200 consolation, rain it AT THE SB TILE too (same as a cross),
              // not on the piece. Accumulate so the walk-end reconciliation below
              // doesn't ALSO burst it on the token.
              const _sbcLand = gs.lastSuperBananaCross;
              if (_sbcLand && _sbcLand.pos === finalPos && _sbcLand.playerId === cur.id) {
                const _sbkLand = _sbcLand.playerId + ":" + _sbcLand.turn + ":" + _sbcLand.pos;
                if (window._sbCrossFloaterFired !== _sbkLand) {
                  window._sbCrossFloaterFired = _sbkLand;
                  bananaBurst(_sbcLand.amount, _sbcLand.playerId, landedEl || document.getElementById("space-" + finalPos));
                  window._walkSbCrossBurst = (window._walkSbCrossBurst || 0) + _sbcLand.amount;
                }
              }

              // After the token transition completes, do the heavy cleanup
              setTimeout(() => {
              // A newer roll owns the walk globals now — this walk's landing
              // cleanup must not unfreeze or re-render over it.
              if (!_walkAlive()) return;
              // Fully unfreeze positions and reveals
              window._diceRollingPositions = null;
              window._diceRollingRevealed = null;
              window._tokenWalking = false;
              // Fire banana burst for non-pile money gains during walk so the
              // player gets visual feedback on EVERY gain. Pile collections
              // are already burst per-tile by the pile-decrement detector in
              // board.js, so subtract their total here and only burst what's
              // left (landed-grow path-on contributions, rent
              // income, etc.). The burst is
              // anchored to the player's token so it appears above their
              // piece in sync with the walk landing.
              const _walkPlayer = gs.players && gs.players.find(p => p.id === window._walkingPlayerId);
              if (_walkPlayer && window._walkPreMoney != null) {
                const totalGain = _walkPlayer.money - window._walkPreMoney;
                const pileGain = window._walkPileCollected || 0;
                // Early pickup (rolled grow that fired while the player was
                // standing on their own farm) already fires its own burst via
                // the pulse — or via the pre-walk floater in non-pulse mode.
                // The fresh-growth portion was credited straight to money
                // without flowing through a pile-decrement, so we must subtract
                // it here or the post-walk reconciliation rains a second time.
                let earlyPickupGain = 0;
                if (gs.diceMatchEarlyPickup != null) {
                  earlyPickupGain =
                    (gs.diceMatchGrownAmounts &&
                      gs.diceMatchGrownAmounts[gs.diceMatchEarlyPickup]) ||
                    0;
                }
                // A Super Banana CROSS already rained its +N AT THE SB TILE mid-walk
                // (see the walk loop), so subtract it here or it rains a second time
                // on the token.
                const sbCrossGain = window._walkSbCrossBurst || 0;
                const nonPileGain = totalGain - pileGain - earlyPickupGain - sbCrossGain;
                if (nonPileGain > 0) {
                  bananaBurst(nonPileGain, _walkPlayer.id);
                }
              }
              window._walkPreMoney = null;
              window._walkPileCollected = 0;
              window._walkSbCrossBurst = 0;
              // NOTE: _walkingPlayerId, _walkingLandingPos, and _frozenPileTotals
              // are intentionally NOT cleared here — the frozen renderBoard below
              // (for GROW landings) needs them so picked-up piles render as 0
              // instead of resurrecting to their pre-pickup frozen value. They are
              // cleared after that render fires (see grow/non-grow branches).
              // Fire deferred effects for other players (rent, etc.)
              if (window._pendingLandingOtherEffects) {
                for (const fx of window._pendingLandingOtherEffects) {
                  if (fx.type === "gain") {
                    bananaBurst(fx.amount, fx.playerId);
                  } else {
                    _showMoneyDeduction(fx.playerId, fx.amount);
                  }
                }
                window._pendingLandingOtherEffects = null;
              }
              // If poker is about to start, keep money frozen for poker players
              // until the poker table visually appears
              const _pokerPending = gs && gs.poker && !gs.poker.resolved;
              if (_pokerPending) {
                window._pokerMoneyFrozen = {};
                if (window._prevPlayerMoney) {
                  for (const pid of Object.keys(gs.poker.players)) {
                    if (window._prevPlayerMoney[pid] != null) {
                      window._pokerMoneyFrozen[pid] = window._prevPlayerMoney[pid];
                    }
                  }
                }
                // Keep own money frozen if we're in the poker
                if (window._frozenMoney != null && gs.poker.players[myId]) {
                  window._pokerMoneyFrozen._myFrozen = window._frozenMoney;
                }
              }
              window._frozenMoney = null;
              // Fire deferred deduction popup (e.g. tax) now that the token has landed
              // But skip poker deductions — those fire when the poker table appears
              if (window._pendingLandingDeduction) {
                const _ded = window._pendingLandingDeduction;
                window._pendingLandingDeduction = null;
                if (!(_pokerPending && gs.poker.players[_ded.playerId])) {
                  _showMoneyDeduction(_ded.playerId, _ded.amount);
                }
              }
              // Update all players' banana scores immediately on landing
              // (but keep poker players' money frozen)
              if (gs && gs.players) {
                const _landingMe = _gsPlayerMap[myId];
                if (_landingMe) {
                  const _moneyEl = document.getElementById("info-money");
                  if (_moneyEl) {
                    const _displayMoney = (window._pokerMoneyFrozen && window._pokerMoneyFrozen._myFrozen != null)
                      ? window._pokerMoneyFrozen._myFrozen : _landingMe.money;
                    _animateMoneyEl(_moneyEl, _displayMoney);
                  }
                }
                for (const _p of gs.players) {
                  const _pstat = document.querySelector(`.pstat[data-player-id="${_p.id}"]`);
                  if (_pstat) {
                    const _pm = _pstat.querySelector(".pstat-money");
                    if (_pm) {
                      const _dispMoney = (window._pokerMoneyFrozen && window._pokerMoneyFrozen[_p.id] != null)
                        ? window._pokerMoneyFrozen[_p.id] : _p.money;
                      _animateMoneyEl(_pm, _dispMoney);
                    }
                  }
                }
              }
              // Check if landing on a GROW tile — keep piles frozen briefly
              const landTile = gs.boardLayout && gs.boardLayout[cur.position];
              // The grow(s) you LAND on this turn (chain their pulse now that
              // you've arrived). Their grown piles were gated during the walk.
              const _landGrowsNow = _computeLandGrowPulse(gs);
              const finishLanding = () => {
                updateAuctionPanel();
                // Re-run showGame to update money display + pending notifications
                route();
              };
              const _growUnfreeze = (isGrow) => {
                if (!_walkAlive()) return; // superseded by a newer roll
                window._frozenBananaPiles = null;
                window._diceMatchUnfrozen = false;
                window._tokenVisitedTiles = null;
                window._walkingPlayerId = null;
                window._walkingLandingPos = null;
                window._frozenPileTotals = null;
                window._pulseRevealedTiles = null; // ungate everything for the final render
                window._pulseRevealedAmounts = null;
                if (isGrow) window._growUnfreezeRender = true;
                renderBoard(gs);
              };
              let _landingPulseRan = false;
              if (
                landTile &&
                landTile.type === "grow" &&
                window._frozenBananaPiles
              ) {
                // Show token on GROW first (piles still gated), then chain the
                // landing pulse from the grow tile, popping grown piles in as it
                // sweeps. Keep _tokenVisitedTiles / _walkingPlayerId / etc. alive
                // so collected piles stay rendered as 0 during the pulse.
                renderBoard(gs);
                if (_landGrowsNow.length > 0) {
                  // Defer the landing's auction/poker/route refresh until the
                  // pulse finishes so it doesn't re-render and cut the glow.
                  _landingPulseRan = true;
                  if (!window._pulseRevealedTiles) window._pulseRevealedTiles = new Set();
                  // Pre-flag a pending pulse so the End-of-turn ticker keeps
                  // waiting through the 250 ms gap between walk-end and the
                  // pulse start. Without this, animsBlocking briefly clears
                  // (token done walking, dice settled, _growPulseActive still
                  // 0) and the server ends the turn before the landing grow
                  // chain ever runs.
                  window._growPulsePending = (window._growPulsePending || 0) + 1;
                  setTimeout(() => {
                    window._growPulsePending = Math.max(
                      0,
                      (window._growPulsePending || 1) - 1,
                    );
                    if (!_walkAlive()) return;
                    _runGrowPulse(
                      gs,
                      _landGrowsNow,
                      cur,
                      () => {
                        // false: the pulse already bounced each box, so skip the
                        // all-at-once grow-unfreeze bounce (avoids double-bounce).
                        setTimeout(() => {
                          if (!_walkAlive()) return;
                          _growUnfreeze(false);
                          finishLanding();
                        }, 200);
                      },
                      { earlyPickup: false }, // EP belongs to the pre-walk pulse
                    );
                  }, 250);
                } else {
                  // _growUnfreeze self-checks _walkAlive: if the next roll
                  // lands inside this 600ms window (auto-roll regularly does),
                  // the stale unfreeze must not null the new walk's freeze.
                  setTimeout(() => _growUnfreeze(true), 600);
                }
              } else {
                // Not landing on a grow — ungate immediately (any pre-walk grow
                // piles are already revealed) and do the authoritative render.
                _growUnfreeze(false);
              }
              // Brief pause so the player sees the landing before auction/poker/
              // notifications — unless a landing pulse is running (it finishes
              // the landing itself via finishLanding above).
              if (!_landingPulseRan) {
                setTimeout(() => {
                  if (_walkAlive()) finishLanding();
                }, 500);
              }
              }, 160); // wait for token CSS transition (140ms) to finish
            } else {
              // Move token one tile forward (or backward)
              const intermediatePos = walkBackward
                ? (startPos - step + BSZ) % BSZ
                : (startPos + step) % BSZ;
              window._diceRollingPositions = window._diceRollingPositions || {};
              window._diceRollingPositions[cur.id] = intermediatePos;
              // Mark this tile as visited so its banana pile disappears
              if (window._tokenVisitedTiles) {
                window._tokenVisitedTiles.add(intermediatePos);
              }
              walkStepUpdate(gs);
              playMoveTickSound();
              // Brief glow on the tile being stepped on
              const steppedEl = document.getElementById("space-" + intermediatePos);
              if (steppedEl) {
                steppedEl.classList.remove("space-stepped");
                void steppedEl.offsetWidth;
                steppedEl.classList.add("space-stepped");
                steppedEl.addEventListener("animationend", () => steppedEl.classList.remove("space-stepped"), { once: true });
              }
              // Super Banana CROSS: the instant the token steps onto the crossed
              // SB tile, rain the +N consolation AT THE SB TILE (in sync with the
              // crossing) — not on the moving piece. Once per walk; accumulate so
              // the walk-end reconciliation doesn't ALSO burst it on the token.
              // (Fog-redacted: gs.lastSuperBananaCross is null for viewers who
              // haven't revealed the SB, so they get the generic token burst.)
              const _sbc = gs.lastSuperBananaCross;
              if (_sbc && _sbc.pos === intermediatePos && _sbc.playerId === cur.id) {
                const _sbk = _sbc.playerId + ":" + _sbc.turn + ":" + _sbc.pos;
                if (window._sbCrossFloaterFired !== _sbk) {
                  window._sbCrossFloaterFired = _sbk;
                  bananaBurst(_sbc.amount, _sbc.playerId, steppedEl || document.getElementById("space-" + intermediatePos));
                  window._walkSbCrossBurst = (window._walkSbCrossBurst || 0) + _sbc.amount;
                }
              }
            }
          }, 150);
          }; // end startWalk
          // _tokenWalking and _walkPileCollected already set at dice roll detection time
          if (usePulse) {
            // Pre-walk pulse first, then walk. Keep the gate so a grow you LAND
            // on stays hidden until its post-arrival pulse (see walk-end). The
            // gate is cleared at walk-end.
            _runGrowPulse(gs, pulseGrows, cur, () => {
              if (!_walkAlive()) return; // superseded — don't start a stale walk
              if (typeof walkStepUpdate === "function") walkStepUpdate(gs);
              startWalk();
            });
          } else if (walkDelay > 0) {
            setTimeout(() => {
              if (_walkAlive()) startWalk();
            }, walkDelay);
          } else {
            startWalk();
          }
          // Show result notification after dice settle
          diceNotif.innerHTML = rollText;
          diceNotif.classList.remove("show");
          void diceNotif.offsetWidth;
          diceNotif.classList.add("show");
          clearTimeout(window._diceNotifTimer);
          window._diceNotifTimer = setTimeout(
            () => diceNotif.classList.remove("show"),
            2000,
          );
        }
      }, rollInterval);
      playDiceRoll();
      // Show rolling text immediately (identical to a normal roll).
      diceNotif.textContent = `🎲 ${cur.name} is rolling...`;
      diceNotif.classList.remove("show");
      void diceNotif.offsetWidth;
      diceNotif.classList.add("show");
    } else {
      if (gs.dice[0]) setDieFace(die1El, die1Value);
      else resetDieOverlay(die1El);
      if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
      if (gs.dice[2]) setDieFace(die3El, gs.dice[2]);
    }
  } else {
    if (gs.dice[0]) setDieFace(die1El, die1Value);
    else resetDieOverlay(die1El);
    if (gs.dice[1]) setDieFace(die2El, gs.dice[1]);
    if (gs.dice[2]) setDieFace(die3El, gs.dice[2]);
  }

  // Start-pick grow chain: when a player picks a grow tile as their first
  // landing, the regular dice-roll path is skipped (no walk to attach the
  // pulse to). Detect the pick + a "land"-source grow on the same tile and
  // run the chain animation here so the chain visibly fires off the picked
  // grow. Keyed by lastStartPick so it only fires once per pick.
  if (
    gs.lastStartPick &&
    gs.lastStartPick.turn === gs.turn &&
    window._lastStartPickGrowKey !==
      `${gs.lastStartPick.playerId}:${gs.lastStartPick.turn}`
  ) {
    const pickPos = gs.lastStartPick.position;
    const landGrows = Array.isArray(gs.lastGrowActivated)
      ? gs.lastGrowActivated
          .filter((a) => a && a.source === "land" && a.pos === pickPos)
          .map((a) => a.pos)
      : [];
    if (landGrows.length > 0) {
      window._lastStartPickGrowKey = `${gs.lastStartPick.playerId}:${gs.lastStartPick.turn}`;
      const pickedCur = gs.players.find(
        (p) => p.id === gs.lastStartPick.playerId,
      );
      if (typeof _runGrowPulse === "function" && pickedCur) {
        _runGrowPulse(gs, landGrows, pickedCur, null, { earlyPickup: false });
      }
    }
  }

  // Super-Banana swap onto a grow tile: like the start pick, there's no dice
  // roll/walk to attach the chain pulse to. Detect the swap + a "land"-source
  // grow on the swapped-in tile and run the chain here. Keyed by
  // lastSuperBananaSwap so it fires once per swap.
  if (
    gs.lastSuperBananaSwap &&
    gs.lastSuperBananaSwap.turn === gs.turn &&
    window._lastSwapGrowKey !==
      `${gs.lastSuperBananaSwap.playerId}:${gs.lastSuperBananaSwap.turn}:${gs.lastSuperBananaSwap.pos}`
  ) {
    const swapPos = gs.lastSuperBananaSwap.pos;
    const landGrows = Array.isArray(gs.lastGrowActivated)
      ? gs.lastGrowActivated
          .filter((a) => a && a.source === "land" && a.pos === swapPos)
          .map((a) => a.pos)
      : [];
    if (landGrows.length > 0) {
      window._lastSwapGrowKey = `${gs.lastSuperBananaSwap.playerId}:${gs.lastSuperBananaSwap.turn}:${gs.lastSuperBananaSwap.pos}`;
      const swapper = gs.players.find(
        (p) => p.id === gs.lastSuperBananaSwap.playerId,
      );
      if (typeof _runGrowPulse === "function" && swapper) {
        _runGrowPulse(gs, landGrows, swapper, null, { earlyPickup: false });
      }
    }
  }

  // Turn notification — show once per turn, keep visible for 1.5s
  const notif = document.getElementById("turn-notification");

  if (notif) {
    const turnKey = isMyTurn ? gs.turn : null;
    if (isMyTurn && turnKey !== window._lastNotifTurn) {
      window._lastNotifTurn = turnKey;
      notif.classList.remove("show");
      void notif.offsetWidth; // reset animation
      notif.classList.add("show");
      playTurnChime();
      clearTimeout(window._turnNotifTimer);
      window._turnNotifTimer = setTimeout(
        () => notif.classList.remove("show"),
        1500,
      );
    }
  }

  // Super Banana WIN notification (delayed until the token walk finishes). The
  // can't-afford case is a silent random relocate shown as a global toast in
  // game-socket.js — it never uses this banner, so there is no "pending" state.
  const sbNotif = document.getElementById("super-banana-notification");
  if (sbNotif) {
    if (
      gs.superBananaWin &&
      !window._diceRollingPositions &&
      !window._tokenWalking
    ) {
      // Super banana win phased notifications
      const textEl = document.getElementById("super-banana-notif-text");
      if (
        gs.superBananaWin.phase === "found" &&
        !window._superBananaFoundShown
      ) {
        window._superBananaFoundShown = true;
        if (textEl) textEl.textContent = "⭐ Super Banana Found! ⭐";
        sbNotif.classList.remove("show");
        void sbNotif.offsetWidth;
        sbNotif.classList.add("show");
      } else if (
        gs.superBananaWin.phase === "bought" &&
        !window._superBananaBoughtShown
      ) {
        window._superBananaBoughtShown = true;
        const buyer = _gsPlayerMap[gs.superBananaWin.playerId];
        const name = buyer ? buyer.name : "Someone";
        if (textEl)
          textEl.textContent = gs.superBananaWin.free
            ? `⭐ ${name} grabbed the FREE Super Banana and became Monkey God! 👑`
            : `⭐ ${name} can afford it! ${name} bought the Super Banana and became Monkey God! 👑`;
      }
    } else if (!gs.superBananaWin) {
      // The win notification finished (or never started) — reset and hide.
      window._superBananaFoundShown = false;
      window._superBananaBoughtShown = false;
      sbNotif.classList.remove("show");
    }
  }

  // Auction win/loss card — driven by the public lastResolvedAuction snapshot
  // so non-landers (who bid blind and never see the farm in gs.auction) still
  // get the BOUGHT/MISSED card with the right name + group colour. Fires once
  // per resolved auction, keyed on resolvedAt.
  const resolved = gs.lastResolvedAuction;
  if (
    resolved &&
    resolved.resolvedAt !== window._lastShownResolvedAt
  ) {
    window._lastShownResolvedAt = resolved.resolvedAt;
    const wasParticipant =
      Array.isArray(resolved.participantIds) &&
      resolved.participantIds.includes(myId);
    const propLabel = resolved.propName || `Farm #${resolved.position}`;
    if (resolved.winnerId && resolved.winnerId === myId) {
      _showPropertyCardFlip(
        propLabel,
        resolved.propGroup,
        resolved.propPrice,
        "",
        true
      );
    } else if (wasParticipant) {
      playAuctionLoss();
      _showPropertyCardFlip(
        propLabel,
        resolved.propGroup,
        resolved.propPrice,
        "",
        false
      );
    }
  }

  // Auto-roll disabled for debugging
  if (window._autoRollQueued && !canRoll) {
    window._autoRollQueued = false;
  }

  // My info
  if (me) {
    const displayMoney =
      (window._diceRollingPositions || window._tokenWalking) &&
      window._frozenMoney != null
        ? window._frozenMoney
        : (window._pokerMoneyFrozen && window._pokerMoneyFrozen._myFrozen != null)
          ? window._pokerMoneyFrozen._myFrozen
          : me.money;
    _animateMoneyEl(document.getElementById("info-money"), displayMoney);
    document.getElementById("info-position").textContent =
      `Position: ${me.position}`;
  }

  // There is no End Turn button anymore — the server advances the turn the
  // moment _ensureEndTurnTicker's anim-complete signal arrives.
  _ensureEndTurnTicker();

  // The old "Cancel Opponent Card" button was replaced by the post-roll Predict
  // Ability bluff — keep it hidden (markup may still exist in index.html).
  const cancelItemsBtn = document.getElementById("btn-cancel-items");
  if (cancelItemsBtn) cancelItemsBtn.style.display = "none";

  // Post-roll abilities (active player) + Predict prompt (opponents).
  _renderPostRollUI(gs, me, isMyTurn);

  // +6 mode toggle — shown whenever the viewer is in play and holds spell cards.
  // While ON, a played card of value N rolls N+6 (moves its full value 7-12, no
  // inversion, no grow-match). Reflects the current ON/OFF state.
  const plusSixBtn = document.getElementById("btn-plus-six");
  if (plusSixBtn) {
    const heldCards =
      typeof me.rollCardCount === "number"
        ? me.rollCardCount
        : Array.isArray(me.rollCards)
          ? me.rollCards.length
          : 0;
    const modeEl = document.getElementById("magic-dice-mode");
    if (gs.state === "playing" && !me.startPickPending && heldCards > 0) {
      const on = !!me.plusSixRolls;
      // Mode mascot beside the "Spell Cards" title: 🐇 rabbit (+6) / 🐢 turtle (default).
      if (modeEl) modeEl.textContent = on ? "🐇" : "🐢";
      plusSixBtn.style.display = "";
      // Build the segmented-pill toggle markup ONCE (idempotent + cheap). Per
      // render we only flip .is-on + aria so CSS owns the OFF<->ON slide.
      // Mega Mode prefixes the mode names; normal mode is just Turtle / Rabbit.
      // Key the (idempotent) build on the mode so it rebuilds if megaMode differs.
      const megaMode = !!gs.megaMode;
      const p6Key = megaMode ? "mega" : "norm";
      if (plusSixBtn.dataset.p6Built !== p6Key) {
        const tWord = megaMode ? "Mega Turtle" : "Turtle";
        const rWord = megaMode ? "Mega Rabbit" : "Rabbit";
        plusSixBtn.innerHTML =
          '<span class="p6-track" aria-hidden="true">' +
            '<span class="p6-thumb"></span>' +
            '<span class="p6-seg p6-seg--turtle">' +
              '<span class="p6-mascot">🐢</span>' +
              '<span class="p6-word">' + tWord + '</span>' +
            '</span>' +
            '<span class="p6-seg p6-seg--rabbit">' +
              '<span class="p6-mascot">🐇</span>' +
              '<span class="p6-word">' + rWord + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="p6-hint" aria-hidden="true">tap to switch</span>';
        plusSixBtn.dataset.p6Built = p6Key;
      }
      plusSixBtn.classList.toggle("is-on", on);
      plusSixBtn.setAttribute("aria-pressed", String(on));
      plusSixBtn.setAttribute(
        "aria-label",
        on
          ? (megaMode
              ? "Mega Rabbit on — cards move their value plus 6 and steal every banana pile on the path. Tap to switch to Mega Turtle."
              : "Rabbit on — cards move their value plus 6. Tap to switch to Turtle.")
          : (megaMode
              ? "Mega Turtle on — cards walk 7 minus their value and grow piles 5×. Tap to switch to Mega Rabbit."
              : "Turtle on — cards walk 7 minus their value. Tap to switch to Rabbit.")
      );
    } else {
      if (modeEl) modeEl.textContent = "";
      plusSixBtn.style.display = "none";
    }
  }

  // Banana Gadget (with its built-in Path Preview toggle) — recompute every frame
  // so it tracks position; the box shows/hides with play state.
  updateBananaGadget();

  // Guaranteed-win hint (you can win next turn by playing a rune onto the SB).
  updateWinHint();

  // Magic-rune redraw modal (shown only to the drawing player at their turn start).
  updateRedrawModal();

  // Spell Cards — grouped chips (me.rollCards, the viewer's CONCEALED hand,
  // played via useRollCard(i)). STAYS VISIBLE off-turn whenever the viewer holds
  // >=1 card and the game is in "playing"; chips render DISABLED with a hint when
  // the viewer can't play. Duplicates are grouped (one chip per value, sorted
  // ASCENDING, with an ×N pill when count > 1). Clicking plays the FIRST
  // occurrence of that value. Render is idempotent
  // (clear + rebuild every frame — no listener leaks, no per-frame growth).
  const rollCardsList = document.getElementById("magic-dice-list");
  const rollCardsBox = document.getElementById("magic-dice");
  const rollCardsSub = document.getElementById("magic-dice-sub");
  if (rollCardsList) {
    const concealed = (me && Array.isArray(me.rollCards)) ? me.rollCards : [];
    const hasCards = concealed.length > 0;
    const inPlaying = gs.state === "playing";
    // Spell cards are now a POST-ROLL play: you can tap a card to play it only in
    // the post-roll ABILITY window (turnPhase === "ability"), after you've rolled.
    // (Tapping a chip BEFORE rolling / off-turn ARMS it instead — see canArm.)
    const canPlayCard =
      isMyTurn &&
      inPlaying &&
      gs.turnPhase === "ability" &&
      me &&
      !me.startPickPending &&
      !me.bankrupt &&
      !me.ghost &&
      !gs.auction &&
      !me.pendingCancelDiscard; // resolve an owed discard first

    // ARMING (queue). The box is ALWAYS accessible to a live player: whenever you
    // can't play right now (off-turn, or on-turn AFTER you've rolled), tapping a
    // chip ARMS it — a private selection (me.armedRoll = { value } | null) that
    // AUTO-ACTIVATES at the start of your turn (it auto-plays after the roll-delay
    // window unless you disarm first; see the armed auto-activation below). It
    // persists across turn-ends, so a roll armed after your move fires next turn.
    // Disarm any time. (On your turn BEFORE rolling, chips play immediately
    // instead — that's canPlayCard.)
    const armed = (me && me.armedRoll) ? me.armedRoll : null;
    const canArm =
      inPlaying &&
      hasCards &&
      me &&
      !me.bankrupt &&
      !me.ghost &&
      !me.startPickPending &&
      !canPlayCard;

    // ARMED AUTO-ACTIVATION: once it's your turn and you can act (canPlayCard is
    // true only after the roll-delay window — your chance to disarm), a roll you
    // armed auto-plays. Plays via useRollCard (consumes the card + clears the arm
    // server-side). Mirrors the auto-roll queue. If you disarmed during the
    // window, me.armedRoll is null here and nothing fires.
    if (canPlayCard && armed) {
      const armIdx = concealed.indexOf(armed.value);
      if (armIdx >= 0 && !window._autoArmQueued) {
        window._autoArmQueued = true;
        setTimeout(() => {
          window._autoArmQueued = false;
          // Re-validate at fire time (state may have changed in the meantime):
          // still my turn, not yet rolled, no blocking interaction, still armed
          // with the same selection, and the card is still held.
          const m = gs && _gsPlayerMap[myId];
          // Mirror canPlayCard: only fire on YOUR turn, before rolling, with no
          // blocking interaction (auction / poker / redraw / SB) — otherwise the
          // server rejects the play (no game_update) and the armed path lingers.
          if (
            !gs ||
            gs.diceRolled ||
            gs.auction ||
            gs.poker ||
            gs.superBananaWin ||
            gs.superBananaPending ||
            gs.redraw ||
            !gs.currentPlayer ||
            gs.currentPlayer.id !== myId
          ) return;
          if (!m || m.ghost || m.bankrupt || m.startPickPending || !m.armedRoll) return;
          const i = (m.rollCards || []).indexOf(m.armedRoll.value);
          if (i >= 0) useRollCard(i);
        }, 120);
      }
    } else if (window._autoArmQueued) {
      // Can't act / nothing armed -> drop any stale queued activation.
      window._autoArmQueued = false;
    }

    // Always rebuild from scratch so there are no leaks / duplicate listeners.
    rollCardsList.innerHTML = "";

    // Visible whenever the viewer holds cards and the game is playing —
    // regardless of whose turn it is.
    if (hasCards && inPlaying) {
      if (rollCardsBox) {
        rollCardsBox.style.display = "";
        // "Locked" only when chips are neither playable now nor armable.
        rollCardsBox.classList.toggle("is-locked", !canPlayCard && !canArm);
      }
      rollCardsList.style.display = "";
      if (rollCardsSub) {
        const subText = me.plusSixRolls
          ? (gs.megaMode
              ? "🐇 MEGA RABBIT — cards leap value + 6 & steal every pile on the path"
              : "🐇 Rabbit — cards leap their value + 6")
          : canPlayCard
            ? (armed ? "Auto-playing your armed roll — tap to play now, or disarm" : "Play one to move exactly that many tiles")
            : canArm
              ? (armed ? "Armed — auto-plays on your next turn (tap it to disarm)" : "")
              : "Not available right now";
        rollCardsSub.textContent = subText;
        // Collapse the line when there's nothing to say (the "tap to arm" hint was
        // removed) so it leaves no empty gap above the chips.
        rollCardsSub.style.display = subText ? "" : "none";
      }

      // Group a collection by value → ascending [{ value, count, firstIndex }].
      // firstIndex is the index of the FIRST occurrence of that value in the
      // ORIGINAL array — exactly what useRollCard(index) needs to play one of
      // that value. Sorting only reorders the display list.
      const groupCards = (arr) => {
        const byVal = new Map(); // value → { count, firstIndex }
        arr.forEach((n, i) => {
          const v = byVal.get(n);
          if (v) v.count += 1;
          else byVal.set(n, { count: 1, firstIndex: i });
        });
        return Array.from(byVal.entries())
          .map(([value, info]) => ({ value, count: info.count, firstIndex: info.firstIndex }))
          .sort((a, b) => a.value - b.value);
      };

      const makeChip = (group, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "roll-chip roll-chip-concealed";
        const v = group.value;
        const c = group.count;
        const isArmed = !!(armed && armed.value === v);
        // Normally a card walks 7 - v (the low-roll inversion): GREEN = the GROW
        // it would trigger (v), PURPLE = the walk steps (7 - v). In +6 MODE the
        // card rolls v + 6 (>= 7): it walks its full value with NO inversion and
        // never grow-matches, so show a single PURPLE walk number (no grow).
        const plusSix = !!(me && me.plusSixRolls);
        const walk = plusSix ? v + 6 : 7 - v;
        btn.setAttribute(
          "aria-label",
          plusSix
            ? "spell card: moves " + walk +
                (c > 1 ? ", " + c + " held" : "") + (isArmed ? ", armed" : "")
            : "spell card: grows " + v + ", walks " + walk +
                (c > 1 ? ", " + c + " held" : "") + (isArmed ? ", armed" : "")
        );
        let html;
        if (plusSix) {
          btn.classList.add("roll-chip-plussix");
          // +6 mode: only the walk number (value increased to v+6), with the
          // clockwise arrow above it (no grow side / no tree).
          html =
            '<span class="roll-chip-walk"><span class="rc-ico">🔃</span>' +
            '<span class="rc-n">' + escapeHtml(String(walk)) + "</span></span>";
        } else {
          // A split card: GREEN grow trigger (🌴 tree over the grow number) |
          // OFFWHITE walk steps (🔃 clockwise arrow over the walk number).
          btn.classList.add("roll-chip-split");
          html =
            '<span class="roll-chip-grow"><span class="rc-ico">🌴</span>' +
            '<span class="rc-n">' + escapeHtml(String(v)) + "</span></span>" +
            '<span class="roll-chip-walk"><span class="rc-ico">🔃</span>' +
            '<span class="rc-n">' + escapeHtml(String(walk)) + "</span></span>";
        }
        if (c > 1) {
          html += '<span class="roll-chip-mult">×' + escapeHtml(String(c)) + "</span>";
        }
        html +=
          '<span class="chip-tip" aria-hidden="true">×' + escapeHtml(String(c)) + '</span>' +
          '<span class="chip-tip-notch" aria-hidden="true"></span>';
        btn.innerHTML = html;
        // Show the armed ring ONLY on an interactive chip (playable or armable),
        // never on a disabled one — a greyed chip with a bright ring reads as a
        // glitch.
        const markArmed = () => {
          btn.classList.add("roll-chip-armed");
          btn.setAttribute("aria-pressed", "true");
        };
        if (canPlayCard) {
          // Your turn: tap plays one of this value. (The armed highlight just
          // points at your pre-selection; playing clears the arm server-side.)
          if (isArmed) markArmed();
          const fi = group.firstIndex;
          btn.onclick = () => useRollCard(fi);
        } else if (canArm) {
          // Off your turn: tap ARMS this value, or DISARMS it if already armed.
          if (isArmed) markArmed();
          btn.onclick = () => {
            if (isArmed) disarmRollCard();
            else armRollCard(v);
          };
        } else {
          btn.classList.add("is-disabled");
          btn.disabled = true;
          btn.onclick = null;
        }
        return btn;
      };

      const concealedGroups = groupCards(concealed);
      concealedGroups.forEach((g, i) => rollCardsList.appendChild(makeChip(g, i)));
    } else {
      if (rollCardsBox) {
        rollCardsBox.style.display = "none";
        rollCardsBox.classList.remove("is-locked");
      }
      rollCardsList.style.display = "none";
    }
  }

  // Jungle log always visible.
  const logBox = document.querySelector(".log-box");
  if (logBox) logBox.style.display = "";

  // Auction panel
  updateAuctionPanel();

  // Players list
  // Compute per-player uncollected banana piles
  // During walk animation, use frozen totals so the counter decreases in sync with board collection
  const playerPiles = {};
  if (window._frozenPileTotals && window._tokenWalking) {
    for (const [pid, total] of Object.entries(window._frozenPileTotals)) {
      if (total > 0) playerPiles[pid] = total;
    }
  } else if (gs.properties) {
    for (const prop of gs.properties) {
      if (prop.owner && prop.bananaPile > 0) {
        playerPiles[prop.owner] =
          (playerPiles[prop.owner] || 0) + prop.bananaPile;
      }
    }
  }

  const plist = document.getElementById("players-list");
  plist.innerHTML = "";
  const isAnimating = !!(window._diceRollingPositions || window._tokenWalking);
  const frozenPlayerMoney = isAnimating ? window._prevPlayerMoney : window._pokerMoneyFrozen || null;
  if ((gs.gameMode === "2v2" || gs.gameMode === "3v3") && gs.teams) {
    // Section off by team
    for (const teamKey of ["A", "B"]) {
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-section team-section-" + teamKey;
      const teamHeader = document.createElement("div");
      teamHeader.className = "team-section-header";
      teamHeader.innerHTML = `<span class="team-section-dot team-${teamKey}"></span> Team ${teamKey}`;
      teamDiv.appendChild(teamHeader);
      const members = gs.teams[teamKey];
      members.forEach((id) => {
        const p = _gsPlayerMap[id];
        if (!p) return;
        const div = document.createElement("div");
        const isMe = p.id === myId;
        div.className = "pstat" + (isMe ? " pstat-me" : "") + (p.ghost ? " pstat-ghost" : "");
        div.setAttribute("data-player-id", p.id);
        div.innerHTML =
          `<div class="pstat-top">` +
          `<div class="pstat-monkey c-${p.color}">${p.ghost ? GHOST_EMOJI : (MONKEY_EMOJI[p.color] || "\uD83D\uDC35")}</div>` +
          `<span class="pstat-name">${p.name}${p.ghost ? " " + GHOST_EMOJI : ""}<span class="team-badge team-${teamKey}">T${teamKey}</span></span>` +
          (p.id === gs.d12OwnerId ? '<span class="d12-badge" title="Hexed — rolls a single d12"></span>' : '') +
          _rollCardPanelHTML(p) +
          `<span class="pstat-yield" title="Total farm yield across the whole map (bananas added each time a grow sweeps this player's farms)">${p.totalYield || 0}🍌</span>` +
          `</div>` +
          `<span class="pstat-money">${frozenPlayerMoney && frozenPlayerMoney[p.id] != null ? frozenPlayerMoney[p.id] : p.money}🍌</span>` +
          `<span class="pstat-spent" title="Total bananas this player has spent over the game (auction wins + the Super Banana)">${p.totalSpent || 0}🍌</span>` +
          `<span class="pstat-grown" title="Bananas grown on this player's farms, waiting to be collected">${playerPiles[p.id] || 0}🍌</span>`;
        teamDiv.appendChild(div);
      });
      plist.appendChild(teamDiv);
    }
  } else {
    gs.players.forEach((p) => {
      const div = document.createElement("div");
      const isMe = p.id === myId;
      div.className = "pstat" + (isMe ? " pstat-me" : "") + (p.ghost ? " pstat-ghost" : "");
      div.setAttribute("data-player-id", p.id);
      div.innerHTML =
        `<div class="pstat-top">` +
        `<div class="pstat-monkey c-${p.color}">${p.ghost ? GHOST_EMOJI : (MONKEY_EMOJI[p.color] || "\uD83D\uDC35")}</div>` +
        `<span class="pstat-name">${p.name}${p.ghost ? " " + GHOST_EMOJI : ""}</span>` +
        (p.id === gs.d12OwnerId ? '<span class="d12-badge" title="Hexed — rolls a single d12"></span>' : '') +
        _rollCardPanelHTML(p) +
        `<span class="pstat-yield" title="Total farm yield across the whole map (bananas added each time a grow sweeps this player's farms)">${p.totalYield || 0}🍌</span>` +
        `</div>` +
        `<span class="pstat-money">${frozenPlayerMoney && frozenPlayerMoney[p.id] != null ? frozenPlayerMoney[p.id] : p.money}🍌</span>` +
        `<span class="pstat-spent" title="Total bananas this player has spent over the game (auction wins + the Super Banana)">${p.totalSpent || 0}🍌</span>` +
        `<span class="pstat-grown" title="Bananas grown on this player's farms, waiting to be collected">${playerPiles[p.id] || 0}🍌</span>`;
      plist.appendChild(div);
    });
  }

  // Footer row below the player stats: TOTAL bananas grown on the board and
  // waiting to be collected — the board-wide sum of the per-player .pstat-pile
  // "to be collected" values. NOT a .pstat, so the money-animation snapshot
  // below ignores it. Uses the same (frozen-during-walk) playerPiles totals, so
  // it ticks down in sync as piles are collected.
  {
    const totalGrownOnBoard = Object.values(playerPiles).reduce((a, b) => a + b, 0);
    const grownFooter = document.createElement("div");
    grownFooter.className = "players-grown-total";
    grownFooter.innerHTML =
      `TOTAL GROWN ON BOARD: <span class="players-grown-total-val">${totalGrownOnBoard}🍌</span>`;
    plist.appendChild(grownFooter);
  }

  // (Per-player total farm yield is shown inline in each .pstat row above as
  // .pstat-yield — fed by the server's fog-independent p.totalYield, so every
  // player's whole-map yield is visible to everyone at all times.)

  // Snapshot target values BEFORE animation modifies textContent, then animate
  const oldPstatMoney = window._prevPstatMoney;
  window._prevPstatMoney = {};
  document.querySelectorAll(".pstat").forEach((div) => {
    const pid = div.getAttribute("data-player-id");
    const moneyEl = div.querySelector(".pstat-money");
    if (moneyEl && pid) {
      const val = parseInt(moneyEl.textContent.replace(/[^\d-]/g, ""), 10);
      if (!isNaN(val)) window._prevPstatMoney[pid] = val;
    }
  });
  // Animate only players whose money actually changed
  if (oldPstatMoney) {
    document.querySelectorAll(".pstat").forEach((div) => {
      const pid = div.getAttribute("data-player-id");
      const moneyEl = div.querySelector(".pstat-money");
      if (moneyEl && pid && oldPstatMoney[pid] != null) {
        const target = window._prevPstatMoney[pid];
        if (target != null && oldPstatMoney[pid] !== target) {
          moneyEl.textContent = `${oldPstatMoney[pid]}\ud83c\udf4c`;
          _animateMoneyEl(moneyEl, target);
        }
      }
    });
  }

  // Team info: hide (super banana win replaces team target)
  const teamInfoEl = document.getElementById("team-info");
  if (teamInfoEl) {
    teamInfoEl.style.display = "none";
  }

  // Ownership panel
  updateOwnerPanel();

  // Property chart
  updatePropertyChart();

  // Log (floating panel). Entries are strings, or { text, color } when the
  // backend wants to theme a line (e.g. friendly steals render green).
  const logEl = document.getElementById("board-log-messages");
  if (logEl) {
    logEl.innerHTML = "";
    (gs.log || [])
      .slice()
      .reverse()
      .forEach((msg) => {
        const d = document.createElement("div");
        if (msg && typeof msg === "object") {
          d.textContent = msg.text || "";
          if (msg.color) d.classList.add("log-color-" + msg.color);
        } else {
          d.textContent = msg;
        }
        logEl.appendChild(d);
      });
    logEl.scrollTop = 0;
  }


  // Board
  renderBoard(gs);
}

// ── Owner Panel ────────────────────────────────────────────────────

function updateOwnerPanel() {
  const el = document.getElementById("owner-list");
  if (!el) return;
  el.innerHTML = "";
  gs.players.forEach((player) => {
    const section = document.createElement("div");
    section.className = "owner-section";

    const ownedIds = player.properties || [];
    const propsHTML = ownedIds.length === 0
      ? '<div class="owner-empty">No farms yet</div>'
      : buildGrowGroupedProps(player);

    section.innerHTML =
      `<div class="owner-header"><div class="owner-monkey c-${player.color}">${MONKEY_EMOJI[player.color] || "🐵"}</div>${player.name}</div>` +
      propsHTML;
    el.appendChild(section);
  });
}

// Group a player's owned farms by the grow tile whose range they
// fall in \u2014 the nearest grow tile counterclockwise (the one whose number, when
// rolled, grows them). Only REVEALED grow tiles count, matching how grows
// actually fire. "Revealed by anyone" is global (reveals broadcast to all
// players).
//   - If >=1 grow tile is revealed, every farm anchors to one (the
//     nearest revealed grow counterclockwise, wrapping the board), so a farm is
//     NEVER shown as "undiscovered".
//   - If no grow tile is revealed yet, all farms list under a single
//     "No grow tiles revealed yet" header.
// Groups sort by grow label (1-6); farms within a group sort by yield desc.
function buildGrowGroupedProps(player) {
  const ownedIds = player.properties || [];
  const N = (gs.boardLayout && gs.boardLayout.length) || 48;

  // Current banana pile sitting on each tile (by board position), so each farm
  // row can show its to-be-collected bananas — like the monkeys-section pile.
  const pileById = {};
  if (gs.properties) {
    for (const p of gs.properties) pileById[p.id] = p.bananaPile || 0;
  }

  // Grow tile labels (all grows). Anchoring uses only the grows revealed by
  // anyone (genuineRevealedGrows, server-side, matching how grows actually
  // fire). A grow reveal broadcasts to every player, so it's already on the
  // viewer's board — using the global set leaks no fog-of-war info.
  const growLabelByPos = {};
  if (gs.boardLayout) {
    gs.boardLayout.forEach((t, pos) => {
      if (t && t.type === "grow") growLabelByPos[pos] = t.growLabel;
    });
  }
  const revealedGrows = new Set(gs.genuineRevealedGrows || []);

  // Nearest genuinely-revealed grow tile counterclockwise from a board position.
  // When >=1 grow is revealed this always finds one (it wraps the whole board),
  // so no farm is "undiscovered"; when none are revealed it returns null.
  const anchorGrowOf = (p) => {
    for (let off = 1; off <= N; off++) {
      const pos = (p - off + N) % N;
      if (revealedGrows.has(pos)) return pos;
    }
    return null;
  };

  const byLabel = new Map(); // growLabel -> farms[]
  const undiscovered = []; // only populated when NO grow is revealed yet
  for (const id of ownedIds) {
    const tile = gs.boardLayout && gs.boardLayout[id];
    if (!tile || tile.group !== "farm") continue;
    const anchor = anchorGrowOf(id);
    if (anchor != null && growLabelByPos[anchor] != null) {
      const label = growLabelByPos[anchor];
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(tile);
    } else {
      undiscovered.push(tile);
    }
  }

  if (byLabel.size === 0 && undiscovered.length === 0) {
    return '<div class="owner-empty">No farms yet</div>';
  }

  const byYield = (a, b) => (b.price || 0) - (a.price || 0);
  const farmRow = (f) => {
    const pile = pileById[f.id] || 0;
    const price = f.price || 0;
    // How many grows' worth of bananas sit on this farm. The pile is always
    // a whole multiple of the yield (grows by price each fire, resets to 0
    // when collected), so pile / price is the grow multiplier behind the
    // to-collect total, e.g. 36x2=72.
    const mult = price > 0 && pile > 0 && pile % price === 0 ? pile / price : 0;
    // Just the COUNT of grows' worth piled on this farm (pile / yield), shown big.
    const multTag = mult > 0
      ? `<span class="owner-farm-mult" title="${mult} grow(s) of ${price} = ${pile}\uD83C\uDF4C waiting to collect">×${mult}</span>`
      : `<span class="owner-farm-mult owner-farm-mult--empty" title="Empty - no bananas waiting to collect">×0</span>`;
    // Always show the pile chip (even 0\uD83C\uDF4C) so the column is constant and easy to
    // scan. data-tile lets the walk animation count it down in sync (board.js).
    const pileTag = `<span class="owner-farm-pile${pile > 0 ? " has-pile" : ""}" data-tile="${f.id}" title="Bananas waiting on this farm">${pile}\uD83C\uDF4C</span>`;
    return `<div class="owner-set-farm"><span class="owner-farm-name">${f.tileLabel || f.tileName || f.name}</span>${multTag}${pileTag}</div>`;
  };

  // Total yield of a group's farms \u2014 what that grow pays out when it fires
  // (each owned farm in its bounds grows by its own yield). Shown per category.
  const groupTotal = (farms) => farms.reduce((s, f) => s + (f.price || 0), 0);
  // Total bananas currently piled on this group's farms (sum of each farm's
  // pile) - what the player would collect from this grow's range right now.
  const groupCollect = (farms) => farms.reduce((s, f) => s + (pileById[f.id] || 0), 0);

  let html = '<div class="owner-props">';
  for (const label of [...byLabel.keys()].sort((a, b) => a - b)) {
    const farms = byLabel.get(label).slice().sort(byYield);
    const total = groupTotal(farms);
    const collect = groupCollect(farms);
    html +=
      `<div class="owner-set-group">` +
      `<div class="owner-set-header"><span class="owner-prop-dot" style="background:#2e7d32"></span><span class="owner-set-name">\ud83c\uDF34 GROW ${label}</span> <span class="owner-set-count">${farms.length}</span><span class="owner-set-fmark" title="Farm yield">YIELD</span><span class="owner-set-total" title="Total yield of your farms in GROW ${label}'s range">${total}\ud83c\udf4c</span><span class="owner-set-totlabel">TOTAL GROWN:</span><span class="owner-set-collect${collect > 0 ? " has-collect" : ""}" title="Bananas waiting to be collected from your GROW ${label} farms (sum of each farm's pile)">${collect}\ud83c\udf4c</span></div>` +
      farms.map(farmRow).join("") +
      `</div>`;
  }
  if (undiscovered.length > 0) {
    // Reached only when no grow tile is genuinely revealed yet \u2014 relabel the
    // bucket instead of calling these farms "Undiscovered".
    const farms = undiscovered.slice().sort(byYield);
    const total = groupTotal(farms);
    const collect = groupCollect(farms);
    html +=
      `<div class="owner-set-group">` +
      `<div class="owner-set-header"><span class="owner-prop-dot" style="background:#555"></span><span class="owner-set-name">\ud83c\udf31 No grow tiles revealed yet</span> <span class="owner-set-count">${farms.length}</span><span class="owner-set-fmark" title="Farm yield">YIELD</span><span class="owner-set-total" title="Total yield of these farms">${total}\ud83c\udf4c</span><span class="owner-set-totlabel">TOTAL GROWN:</span><span class="owner-set-collect${collect > 0 ? " has-collect" : ""}" title="Bananas waiting to be collected from these farms">${collect}\ud83c\udf4c</span></div>` +
      farms.map(farmRow).join("") +
      `</div>`;
  }
  html += "</div>";
  return html;
}

// ── Actions ────────────────────────────────────────────────────────

const CHART_GROUPS = [{ key: "farm", label: "F — Farms" }];

function updatePropertyChart() {
  const el = document.getElementById("property-chart");
  if (!el) return;
  el.innerHTML = "";
  if (!gs || !gs.boardLayout) return;

  const chartGroups = CHART_GROUPS;

  // Build map: group -> [{name, price, owner, ownerColor}]
  const grouped = {};
  chartGroups.forEach((g) => (grouped[g.key] = []));

  // Build set of tiles revealed to current player
  const me = _gsPlayerMap[socket.id];
  const myRevealed = me && me.revealedTiles ? new Set(me.revealedTiles) : null;

  gs.boardLayout.forEach((tile, pos) => {
    if (!tile.tileName || !tile.group) return;
    const prop = _gsPropMap[pos];
    const ownerPlayer =
      prop && prop.owner ? _gsPlayerMap[prop.owner] : null;
    // The desert is a 0-yield "farm" (auctioned like one) — list it INSIDE the
    // Farm Chart rather than in the Tile Legend.
    const isDesert = tile.group === "desert";
    const chartKey = isDesert ? "farm" : tile.group;
    if (!grouped[chartKey]) grouped[chartKey] = [];
    const revealed = !myRevealed || myRevealed.has(pos);
    grouped[chartKey].push({
      pos,
      name: tile.tileName,
      label: tile.tileLabel || null,
      price: tile.price,
      owner: ownerPlayer,
      revealed,
      isDesert,
    });
  });

  // "Farms LEFT" = farms left to be REVEALED (not yet discovered). A farm's
  // identity is fogged until someone reveals it (no label/price/position to show
  // yet), so each unrevealed farm renders as an anonymous fogged placeholder row,
  // mirroring the Grow Chart's "?" cells. The list is FULL at game start (nothing
  // revealed) and each row drops off as that farm is revealed. (Deserts are
  // tracked separately below.)
  const totalFarms = (gs.boardComposition && gs.boardComposition.farm) || 0;
  if (totalFarms > 0) {
    const revealedFarms = (grouped.farm || []).filter((i) => !i.isDesert).length;
    const farmsToReveal = Math.max(0, totalFarms - revealedFarms);

    const head = document.createElement("div");
    head.className = "chart-group-label";
    head.innerHTML =
      `<span class="chart-group-dot g-farm"></span>` +
      `${farmsToReveal} farm${farmsToReveal === 1 ? "" : "s"} left to reveal`;
    el.appendChild(head);

    if (farmsToReveal > 0) {
      const div = document.createElement("div");
      div.className = "chart-group";
      let html = "";
      for (let i = 0; i < farmsToReveal; i++) {
        html +=
          `<div class="chart-item chart-item--fogged">` +
          `<span class="chart-item-name">🌾 ??? farm</span>` +
          `<span class="chart-item-price">not revealed</span>` +
          `</div>`;
      }
      div.innerHTML = html;
      el.appendChild(div);
    }
  }

  // Deserts remaining to be found: the fog-independent total (boardComposition)
  // minus the deserts the viewer has already discovered. Deserts hide among the
  // fogged tiles until a player lands on one (a fogged tile is skipped above, so
  // grouped.farm's isDesert entries are exactly the ones the viewer has revealed).
  const totalDeserts = (gs.boardComposition && gs.boardComposition.desert) || 0;
  if (totalDeserts > 0) {
    const foundDeserts = (grouped.farm || []).filter((i) => i.isDesert).length;
    const remainingDeserts = Math.max(0, totalDeserts - foundDeserts);
    const dRow = document.createElement("div");
    dRow.className = "chart-deserts-remaining";
    dRow.innerHTML =
      `<span class="chart-deserts-label">🌵 Deserts to find</span>` +
      `<span class="chart-deserts-count">${remainingDeserts}</span>`;
    el.appendChild(dRow);
  }

  updateTileLegend();
  updateGrowChart();
}

// only: a discovery tracker for the 8 GROW tiles (labeled 0-7).
// Lists every grow label; ones you've revealed show their board tile, the rest
// stay "?" so the fog of war is preserved.
function updateGrowChart() {
  const section = document.getElementById("grow-chart-section");
  const el = document.getElementById("grow-chart");
  if (!section || !el) return;
  // Only meaningful once play has started — grow labels (0-7) are assigned at
  // that point; before then tiles still read "GROW 100%".
  if (
    !gs ||
    (gs.gameMode !== "classic" && gs.gameMode !== "2v2" && gs.gameMode !== "3v3") ||
    gs.state !== "playing" ||
    !gs.boardLayout
  ) {
    section.style.display = "none";
    el.innerHTML = "";
    return;
  }

  // Match the Farm Chart: reveal status is the viewer's own fog of war.
  const me = _gsPlayerMap[socket.id];
  const myRevealed = me && me.revealedTiles ? new Set(me.revealedTiles) : null;

  const tiles = [];
  gs.boardLayout.forEach((tile, pos) => {
    if (tile.type !== "grow") return;
    let label = tile.growLabel;
    if (label == null && typeof tile.name === "string") {
      const m = tile.name.match(/GROW\s+(\d+)/);
      if (m) label = parseInt(m[1], 10);
    }
    tiles.push({
      pos,
      label: label == null ? "?" : label,
      revealed: !myRevealed || myRevealed.has(pos),
    });
  });

  // Total grow tiles comes from the location-free composition (fog redacts
  // unrevealed grows out of boardLayout, so we can't count them here); the
  // surviving `tiles` are exactly the viewer's revealed grows.
  const total = (gs.boardComposition && gs.boardComposition.grow) || tiles.length;
  if (total === 0) {
    section.style.display = "none";
    el.innerHTML = "";
    return;
  }
  section.style.display = "";

  tiles.sort((a, b) => (Number(a.label) || 0) - (Number(b.label) || 0));
  const foundCount = tiles.length; // every surviving tile is a revealed grow

  let html = `<div class="grow-chart-count">${foundCount}/${total} found</div>`;
  html += '<div class="grow-chart-grid">';
  tiles.forEach((t) => {
    html += `<div class="grow-cell found"><span class="grow-cell-label">🌴 ${t.label}</span><span class="grow-cell-pos">tile ${t.pos}</span></div>`;
  });
  // Placeholder "?" cells for grows the viewer hasn't revealed yet.
  for (let h = 0; h < total - foundCount; h++) {
    html += `<div class="grow-cell hidden"><span class="grow-cell-label">🌴 ?</span><span class="grow-cell-pos">?</span></div>`;
  }
  html += "</div>";
  el.innerHTML = html;
}

// Collapse/expand a left-panel chart by clicking its header. The content div is
// the header's next sibling; toggling its inline display survives chart
// re-renders (those only rewrite innerHTML, not the display style).
function toggleChartCollapse(headerEl) {
  const content = headerEl.nextElementSibling;
  if (!content) return;
  const collapsed = headerEl.classList.toggle("collapsed");
  content.style.display = collapsed ? "none" : "";
  headerEl.setAttribute("aria-expanded", String(!collapsed));
}

function updateTileLegend() {
  const el = document.getElementById("tile-legend");
  if (!el || !gs || !gs.boardLayout) return;
  el.innerHTML = "";

  // The Super Banana now has its OWN panel header (index.html's "Super Banana"
  // <h3>) instead of being listed as a Tile Legend row, so here we render only
  // its win stats. Use the server's location-free composition count (fog-of-war
  // redacts the tile's location from boardLayout, so we can't count it here).
  const special = (gs.boardComposition && gs.boardComposition.special) || 0;

  // The Super Banana's win price (your "target") + the one-time bonus for landing
  // on OR crossing a revealed one — shown HERE instead of on the board tile.
  // Target is the configured win price (fog-independent); the touch bonus is a
  // flat +200, paid once per player whether they land on or cross it (matches
  // _processLanding + _resolveSuperBananaCross's shared sbBonusTaken latch).
  if (special > 0) {
    const target = gs.superBananaPrice != null ? gs.superBananaPrice : 0;
    const TOUCH_BONUS = 200;
    const stats = document.createElement("div");
    stats.className = "legend-sb-stats";
    stats.innerHTML =
      `<div class="legend-sb-stat"><span class="legend-sb-label">🎯 Target bananas</span>` +
      `<span class="legend-sb-val">${target}🍌</span></div>` +
      `<div class="legend-sb-stat"><span class="legend-sb-label">↩️ Cross/land bonus</span>` +
      `<span class="legend-sb-val legend-sb-val--bonus">+${TOUCH_BONUS}🍌</span></div>`;
    el.appendChild(stats);
  }
}

// ── Actions (cont.) ────────────────────────────────────────────────

function createGame() {
  const name = document.getElementById("create-name").value.trim() || "Player";
  const max = parseInt(document.getElementById("create-max").value);
  const bananas =
    parseInt(document.getElementById("create-bananas").value) || 5000;
  const gameMode = document.getElementById("create-mode").value;
  const isPublic = document.getElementById("create-public").checked;
  const superBananaEl = document.getElementById("create-super-banana-price");
  const superBananaPrice = superBananaEl ? (parseInt(superBananaEl.value) || 10000) : 10000;
  const farmAuctionTimerEl = document.getElementById("create-farm-auction-timer");
  const farmAuctionTimer = farmAuctionTimerEl ? (parseInt(farmAuctionTimerEl.value) || 15) : 15;
  const dodecahedron = document.getElementById("create-dodecahedron") ? document.getElementById("create-dodecahedron").checked : true;
  const megaMode = document.getElementById("create-mega-mode") ? document.getElementById("create-mega-mode").checked : true;
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  _joinedName = name;
  socket.emit("create_game", {
    playerName: name,
    clientId: getClientId(),
    maxPlayers: max,
    startingMoney: bananas,
    gameMode,
    isPublic,
    superBananaPrice,
    farmAuctionTimer,
    dodecahedron,
    megaMode,
  });
}

function pasteCode() {
  const input = document.getElementById("join-code");
  function apply(raw) {
    if (!raw) return false;
    const code = raw.trim().replace(/\D/g, "").substring(0, 6);
    if (code) { input.value = code; return true; }
    return false;
  }
  function askUser() {
    const text = prompt("Paste your game code:");
    apply(text);
  }
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then((text) => {
      if (!apply(text)) askUser();
    }).catch(() => askUser());
  } else {
    askUser();
  }
}

function joinGame() {
  const code = document.getElementById("join-code").value.trim();
  const name = document.getElementById("join-name").value.trim() || "Player";
  if (!code) return showToast("Enter a game code.", "warning");
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  gameId = code;
  _joinedName = name;
  socket.emit("join_game", {
    gameId: code,
    playerName: name,
    clientId: getClientId(),
  });
}

function switchJoinTab(tab) {
  document.querySelectorAll(".join-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("join-tab-browse").classList.toggle("active", tab === "browse");
  document.getElementById("join-tab-code").classList.toggle("active", tab === "code");
  if (tab === "browse") refreshPublicLobbies();
}

function refreshPublicLobbies() {
  if (!socket) return;
  socket.emit("get_public_lobbies");
}

function _handlePublicLobbies(lobbies) {
  const container = document.getElementById("public-lobbies");
  if (!container) return;
  if (!lobbies || lobbies.length === 0) {
    container.innerHTML = '<div class="public-lobbies-empty">No public lobbies available right now.<br>Create one or join with a code!</div>';
    return;
  }
  container.innerHTML = lobbies.map(l => {
    const modeLabel =
      l.gameMode === "3v3" ? "3v3" : l.gameMode === "2v2" ? "2v2" : "Classic";
    return `<button class="public-lobby-item" onclick="joinPublicLobby('${l.gameId}')">
      <div class="public-lobby-host">${l.hostName}'s game</div>
      <div class="public-lobby-details">
        <span>👥 ${l.playerCount}/${l.maxPlayers}</span>
        <span>🎮 ${modeLabel}</span>
        <span>🍌 ${l.startingMoney}</span>
      </div>
    </button>`;
  }).join("");
}

function joinPublicLobby(code) {
  const name = document.getElementById("join-name").value.trim() || "Player";
  if (!socket.connected)
    return showToast("Connecting to server, please try again.", "warning");
  gameId = code;
  _joinedName = name;
  socket.emit("join_game", { gameId: code, playerName: name, clientId: getClientId() });
}

function startGame() {
  socket.emit("start_game", { gameId });
}

function rollDice() {
  // Always a normal 2d6 roll — dice tiers and armed items are gone.
  socket.emit("roll_dice", { gameId });
}

// First-turn pick: let the server choose a random unoccupied start tile (so the
// 2nd/3rd/4th picks never land on another player).
function pickRandomStart() {
  if (socket && gameId) socket.emit("pick_start_tile_random", { gameId });
}

function debugMove() {
  const pos = parseInt(document.getElementById("debug-tile").value);
  const max = ((gs && gs.boardLayout) || []).length || 48;
  if (isNaN(pos) || pos < 0 || pos >= max) return;
  socket.emit("debug_move", { gameId, position: pos });
}

function debugShuffle() {
  socket.emit("debug_shuffle", { gameId });
}

function debugAddBananas() {
  socket.emit("debug_add_bananas", { gameId });
}

function _getMyTeamKey() {
  if (!gs || !gs.teams) return null;
  if (gs.teams.A && gs.teams.A.includes(myId)) return "A";
  if (gs.teams.B && gs.teams.B.includes(myId)) return "B";
  return null;
}

function _getLanderTeamKey(a) {
  if (!gs || !gs.teams || !a) return null;
  if (gs.teams.A && gs.teams.A.includes(a.landingPlayer)) return "A";
  if (gs.teams.B && gs.teams.B.includes(a.landingPlayer)) return "B";
  return null;
}

function _getBidMax() {
  const me = gs ? _gsPlayerMap[myId] : null;
  if (!me) return 500;
  let max = me.money;
  // Super Banana mystery rune auction: the LANDER names a price the WINNER pays,
  // so it's capped at the richest opponent's bank — not the lander's (who may be
  // broke, having just failed to afford the Super Banana).
  if (
    gs.auction &&
    gs.auction.sbRune &&
    gs.auction.phase === "pitch" &&
    myId === gs.auction.landingPlayer
  ) {
    const others = (gs.players || []).filter(
      (p) => p.id !== myId && !p.bankrupt && !p.ghost,
    );
    return others.length ? Math.max(...others.map((p) => p.money)) : 0;
  }
  // Silent tie-breaker: the top-up is capped at what's left after the list price.
  if (gs.auction && gs.auction.phase === "silentbid") {
    return Math.max(0, me.money - (gs.auction.landerOpenBid || 0));
  }
  // When lander is pitching a price, cap at richest OPPONENT's money — in team
  // mode the lander's own teammate(s) are not opponents (mirrors the backend).
  if (
    gs.auction &&
    gs.auction.phase === "pitch" &&
    myId === gs.auction.landingPlayer
  ) {
    const myTeam = _getMyTeamKey();
    const _teamKeyOf = (id) =>
      gs.teams
        ? gs.teams.A && gs.teams.A.includes(id)
          ? "A"
          : gs.teams.B && gs.teams.B.includes(id)
            ? "B"
            : null
        : null;
    const others = gs.players.filter(
      (p) =>
        p.id !== myId &&
        !p.bankrupt &&
        !p.ghost &&
        (!myTeam || _teamKeyOf(p.id) !== myTeam),
    );
    if (others.length > 0) {
      const maxOtherMoney = Math.max(...others.map((p) => p.money));
      if (me.money >= maxOtherMoney) {
        max = maxOtherMoney;
      }
    }
  }
  return max;
}

function bidKeyPress(digit) {
  playTickSound();
  const input = document.getElementById("bid-amount");
  // If the value was auto-filled, clear it so the user starts fresh
  let cur;
  if (window._bidAutoFilled) {
    cur = "";
    window._bidAutoFilled = false;
  } else {
    cur = input.value === "0" ? "" : input.value;
  }
  const next = cur + digit;
  const num = parseInt(next) || 0;
  const max = _getBidMax();
  input.value = String(Math.min(num, max));
}

function bidKeyClear() {
  playTickSound();
  window._bidAutoFilled = false;
  document.getElementById("bid-amount").value = "0";
}

function bidKeyBackspace() {
  playTickSound();
  window._bidAutoFilled = false;
  const input = document.getElementById("bid-amount");
  const cur = input.value;
  input.value = cur.length <= 1 ? "0" : cur.slice(0, -1);
}

function setBidHalf() {
  playTickSound();
  window._bidAutoFilled = false;
  const input = document.getElementById("bid-amount");
  const half = Math.max(0, Math.floor(_getBidMax() / 2));
  input.value = String(half);
}

function setBidMax() {
  playTickSound();
  window._bidAutoFilled = false;
  document.getElementById("bid-amount").value = String(_getBidMax());
}

function showBidToast(msg) {
  const toast = document.getElementById("bid-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(window._bidToastTimer);
  window._bidToastTimer = setTimeout(
    () => toast.classList.remove("show"),
    2000,
  );
}

function placeBid() {
  const input = document.getElementById("bid-amount");
  const amount = parseInt(input.value) || 0;
  if (amount < 0) return;

  // The silent tie-breaker reuses this keypad; a 0 top-up is valid there.
  if (gs && gs.auction && gs.auction.phase === "silentbid") {
    window._myLastBid = amount;
    socket.emit("submit_silent_bid", { gameId, amount });
    input.value = "0";
    return;
  }

  // Minimum 1 banana (unless player is broke)
  const me = gs && _gsPlayerMap[myId];
  if (amount < 1 && me && me.money > 0) {
    showBidToast("1🍌 minimum!");
    return;
  }

  // Client-side check: pitch price capped at richest opponent's money
  if (
    gs &&
    gs.auction &&
    gs.auction.phase === "pitch" &&
    myId === gs.auction.landingPlayer
  ) {
    const maxAllowed = _getBidMax();
    if (amount > maxAllowed) {
      showBidToast(
        `Max price is ${maxAllowed}🍌 (richest opponent's bank)`,
      );
      input.value = String(maxAllowed);
      return;
    }
  }

  window._myLastBid = amount;
  socket.emit("place_bid", { gameId, amount });
  input.value = "0";
}


function auctionBuyNow() {
  if (!socket || !gameId) return;
  socket.emit("auction_buy_now", { gameId });
}

function respondAuction(accept) {
  socket.emit("respond_auction", { gameId, accept });
}

function playAuctionTimerStart() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Quick rising sweep to signal timer start
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.25);
  } catch (e) {}
}

function playAuctionTimerTick() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, t);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.03);
  } catch (e) {}
}

function playAuctionTimerEnd() {
  try {
    if (_sfxVolume === 0) return;
    const ctx = _getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    // Descending buzz
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(_sfxDest(ctx));
    osc.start(t);
    osc.stop(t + 0.35);
  } catch (e) {}
}

function _startAuctionTimer() {
  if (window._auctionTimerRAF) cancelAnimationFrame(window._auctionTimerRAF);
  window._auctionTimerStarted = true;
  window._lastTimerTick = -1;
  playAuctionTimerStart();

  function tick() {
    const _aa = gs && gs.auction;
    const _deadline = _aa
      ? _aa.teamFlow
        ? _aa.stepDeadline
        : _aa.phase === "respond"
          ? _aa.respondDeadline
          : _aa.phase === "silentbid"
            ? _aa.silentDeadline
            : null
      : null;
    if (!_aa || !_deadline) {
      // Timer done
      const timerWrap = document.getElementById("auction-timer-wrap");
      if (timerWrap) timerWrap.style.display = "none";
      window._auctionTimerStarted = false;
      return;
    }
    const now = Date.now();
    const deadline = _deadline;
    const remaining = Math.max(0, deadline - now);
    const pct = Math.max(0, Math.min(100, (remaining / 15000) * 100));
    const secs = (remaining / 1000).toFixed(1);

    const bar = document.getElementById("auction-timer-bar");
    const text = document.getElementById("auction-timer-text");
    const ring = document.getElementById("auction-timer-ring");
    const timerWrap = document.getElementById("auction-timer-wrap");
    if (timerWrap) timerWrap.style.display = "";

    const urgencyClass = pct <= 20 ? " timer-urgent" : pct <= 40 ? " timer-low" : "";

    if (bar) {
      bar.style.width = pct + "%";
      bar.className = "auction-timer-bar" + urgencyClass;
    }
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      const offset = circumference * (1 - pct / 100);
      ring.style.strokeDashoffset = offset;
      ring.className.baseVal = "auction-timer-ring-progress" + urgencyClass;
    }
    if (text) {
      text.textContent = Math.ceil(remaining / 1000);
      text.className = "auction-timer-text" + urgencyClass;
    }
    if (timerWrap) {
      timerWrap.className = "auction-timer-wrap" + urgencyClass;
    }

    // Tick sound each second
    const secFloor = Math.floor(remaining / 1000);
    if (secFloor !== window._lastTimerTick && secFloor >= 0 && remaining > 0) {
      window._lastTimerTick = secFloor;
      if (secFloor <= 2) playAuctionTimerTick();
    }

    if (remaining <= 0) {
      playAuctionTimerEnd();
      window._auctionTimerStarted = false;
      return;
    }

    window._auctionTimerRAF = requestAnimationFrame(tick);
  }
  tick();
}

function updateAuctionPanel() {
  const box = document.getElementById("auction-box");
  if (!gs || !gs.auction) {
    box.style.display = "none";
    window._auctionBidPhase = null;
    window._myLastBid = null;
    window._auctionDelayShown = false;
    window._auctionTimerStarted = false;
    if (window._auctionTimerRAF) cancelAnimationFrame(window._auctionTimerRAF);
    if (window._teammateDelayTimer) {
      clearTimeout(window._teammateDelayTimer);
      window._teammateDelayTimer = null;
    }
    const timerWrap = document.getElementById("auction-timer-wrap");
    if (timerWrap) timerWrap.style.display = "none";
    return;
  }
  // Delay showing the auction until the dice animation finishes.
  if (
    (window._diceRollingPositions || window._tokenWalking) &&
    !window._auctionDelayShown
  ) {
    box.style.display = "none";
    return;
  }
  window._auctionDelayShown = true;

  const a = gs.auction;
  const myBid = a.bids[myId];
  const iAmLander = myId === a.landingPlayer;
  const iAmAcceptor = !!a.iAmAcceptor;

  const titleEl = document.getElementById("auction-title");
  if (titleEl)
    titleEl.textContent = a.sbRune
      ? "⭐ MYSTERY CARD DRAW ⭐"
      : a.sealedBid
        ? "🤫 SEALED BID 🤫"
        : "🏷️ PRICE IT 🏷️";
  box.style.display = "block";

  const propEl = document.getElementById("auction-prop");
  if (a.sbRune) {
    // The lander sees their two secret 0/1 cards (sum = how many runes the winner
    // draws); everyone else bids blind.
    if (iAmLander && Array.isArray(a.runeCards) && a.runeCards.length === 2) {
      const c1 = a.runeCards[0], c2 = a.runeCards[1], n = c1 + c2;
      propEl.textContent =
        `Super Banana — your cards [${c1}] [${c2}] = ${n} Spell Card draw${n === 1 ? "" : "s"} to the winner` +
        (n === 0 ? " (bluff it! 😈)" : " 🔮");
    } else {
      propEl.textContent = "Super Banana — a MYSTERY number of Spell Card draws (0–2) 🔮";
    }
    propEl.className = "auction-prop";
  } else if (a.propName) {
    propEl.textContent = `${a.propName} — ${a.propPrice}🍌 yield`;
    propEl.className = a.propGroup
      ? "auction-prop g-" + a.propGroup
      : "auction-prop";
  } else if (a.position != null) {
    propEl.textContent = `Farm #${a.position} (hidden)`;
    propEl.className = "auction-prop";
  } else {
    propEl.textContent = "Mystery farm (hidden)";
    propEl.className = "auction-prop";
  }

  const highEl = document.getElementById("auction-high");
  const respondControls = document.getElementById("auction-respond-controls");
  if (respondControls) respondControls.style.display = "none";
  const controls = document.getElementById("auction-controls");
  const timerWrap = document.getElementById("auction-timer-wrap");
  if (timerWrap) timerWrap.style.display = "none";

  let showKeypad = false;
  let keypadLabel = "Bid";

  if (a.phase === "pitch") {
    if (iAmLander) {
      highEl.textContent = "You landed here — name your price! 🍌";
      showKeypad = true;
      keypadLabel = "Set Price";
    } else {
      highEl.textContent = "Waiting for the lander to name a price...";
    }
  } else if (a.phase === "respond") {
    if (!window._auctionTimerStarted && !gs.noAuctionTimer && a.respondDeadline) {
      _startAuctionTimer();
    }
    if (!gs.noAuctionTimer && a.respondDeadline && timerWrap) {
      timerWrap.style.display = "";
    }
    if (iAmLander) {
      highEl.textContent = `You priced it at ${a.landerOpenBid}🍌 — waiting for responses...`;
    } else if (!myBid) {
      highEl.textContent = `You can't afford ${a.landerOpenBid}🍌 — excluded from this auction.`;
    } else if (myBid.responded) {
      highEl.textContent = "Choice locked in — waiting for the others (nobody can see it).";
    } else {
      const respondOpenedAt = a.respondOpenedAt || a.respondStartTime;
      const isTeammate =
        (gs.gameMode === "2v2" || gs.gameMode === "3v3") &&
        gs.teams &&
        respondOpenedAt &&
        _getMyTeamKey() === _getLanderTeamKey(a);
      const teammateDelay = isTeammate
        ? Math.max(0, respondOpenedAt + 5000 - Date.now())
        : 0;
      highEl.textContent = `Priced at ${a.landerOpenBid}🍌 — accept or reject. Your choice stays hidden.`;
      if (respondControls) {
        respondControls.style.display = "flex";
        const acceptBtn = respondControls.querySelector(".btn-accept");
        if (acceptBtn) {
          if (teammateDelay > 0) {
            acceptBtn.disabled = true;
            acceptBtn.textContent = `⏳ Wait ${Math.ceil(teammateDelay / 1000)}s...`;
            if (!window._teammateDelayTimer) {
              window._teammateDelayTimer = setTimeout(() => {
                window._teammateDelayTimer = null;
                if (gs && gs.auction) updateAuctionPanel();
              }, teammateDelay);
            }
          } else {
            acceptBtn.disabled = false;
            acceptBtn.textContent = "✅ Accept";
          }
        }
      }
    }
  } else if (a.phase === "silentbid") {
    // The 2v2 broke-lander silent bid uses the generic step deadline.
    const _sbDeadline = a.teamFlow ? a.stepDeadline : a.silentDeadline;
    if (!window._auctionTimerStarted && !gs.noAuctionTimer && _sbDeadline) {
      _startAuctionTimer();
    }
    if (!gs.noAuctionTimer && _sbDeadline && timerWrap) {
      timerWrap.style.display = "";
    }
    if (iAmAcceptor && myBid && !myBid.submittedTopup) {
      highEl.textContent = a.sealedBid
        ? "Sealed bid! The lander is broke — secretly name your price, highest wins."
        : `Tie-breaker! Secretly bid extra on top of ${a.landerOpenBid}🍌 — you'd pay ${a.landerOpenBid}+your bid.`;
      showKeypad = true;
      keypadLabel = a.sealedBid ? "Submit Bid" : "Submit Bid";
    } else if (iAmAcceptor && myBid && myBid.submittedTopup) {
      highEl.textContent = a.sealedBid
        ? "🔒 Sealed bid locked in — waiting for the others..."
        : "🔒 Tie-breaker bid locked in — waiting for the others...";
    } else {
      highEl.textContent = a.sealedBid
        ? "Sealed bid underway — highest bidder wins the tile..."
        : "Multiple players accepted — a silent tie-breaker is underway...";
    }
  } else if (a.phase === "respondOpp") {
    // 2v2: the opponents race — the first to accept wins immediately, or both
    // reject and it moves to the lander's teammate.
    if (!gs.noAuctionTimer && a.stepDeadline) {
      if (!window._auctionTimerStarted) _startAuctionTimer();
      if (timerWrap) timerWrap.style.display = "";
    }
    const iCanRespond = (a.affOppIds || []).includes(myId);
    // You can see your OWN teammate's choice (the backend only sends it to you).
    let mateNote = "";
    if (gs.teams) {
      const teamOf = (id) => {
        for (const k of Object.keys(gs.teams)) {
          if (gs.teams[k] && gs.teams[k].includes(id)) return k;
        }
        return null;
      };
      const myTeam = teamOf(myId);
      const mates = (a.affOppIds || []).filter(
        (id) => id !== myId && teamOf(id) === myTeam && a.bids[id],
      );
      if (mates.length) {
        mateNote =
          " (" +
          mates
            .map((id) => {
              const mb = a.bids[id];
              const nm = (_gsPlayerMap[id] || {}).name || "Teammate";
              const st = !mb.responded
                ? "deciding…"
                : mb.accepted
                  ? "accepted ✅"
                  : "rejected ✖";
              return `${nm}: ${st}`;
            })
            .join(", ") +
          ")";
      }
    }
    if (iCanRespond && myBid && !myBid.responded) {
      highEl.textContent = `Priced at ${a.landerOpenBid}🍌 — accept to claim it, or reject!${mateNote}`;
      if (respondControls) {
        respondControls.style.display = "flex";
        const ab = respondControls.querySelector(".btn-accept");
        if (ab) { ab.disabled = false; ab.textContent = "✅ Accept"; }
        const db = respondControls.querySelector(".btn-decline");
        if (db) db.textContent = "✖ Reject";
      }
    } else if (iCanRespond && myBid && myBid.responded) {
      highEl.textContent = `Choice locked in — waiting for the other opponent.${mateNote}`;
    } else if (iAmLander) {
      highEl.textContent = `You priced it at ${a.landerOpenBid}🍌 — waiting for the opponents...`;
    } else if ((a.teammateIds || []).includes(myId)) {
      highEl.textContent = `Priced at ${a.landerOpenBid}🍌 — waiting for the opponents to decide...`;
    } else {
      highEl.textContent = `You can't afford ${a.landerOpenBid}🍌 — excluded from this auction.`;
    }
  } else if (a.phase === "teammateFinal") {
    // All opponents passed — the lander's teammate(s) race for the final say.
    if (!gs.noAuctionTimer && a.stepDeadline) {
      if (!window._auctionTimerStarted) _startAuctionTimer();
      if (timerWrap) timerWrap.style.display = "";
    }
    const iCanBuy = (a.affMateIds || []).includes(myId);
    // Show fellow teammates' choices (3v3 has two teammates racing).
    let mateNote = "";
    const mates = (a.affMateIds || []).filter((id) => id !== myId && a.bids[id]);
    if (mates.length) {
      mateNote =
        " (" +
        mates
          .map((id) => {
            const mb = a.bids[id];
            const nm = (_gsPlayerMap[id] || {}).name || "Teammate";
            const st = !mb.responded ? "deciding…" : mb.accepted ? "accepted ✅" : "rejected ✖";
            return `${nm}: ${st}`;
          })
          .join(", ") +
        ")";
    }
    if (iCanBuy && (!a.bids[myId] || !a.bids[myId].responded)) {
      highEl.textContent = `No opponent took it — Buy it for ${a.landerOpenBid}🍌, or pass to the lander?${mateNote}`;
      if (respondControls) {
        respondControls.style.display = "flex";
        const ab = respondControls.querySelector(".btn-accept");
        if (ab) { ab.disabled = false; ab.textContent = `✅ Buy (${a.landerOpenBid}🍌)`; }
        const db = respondControls.querySelector(".btn-decline");
        if (db) db.textContent = "✖ Pass";
      }
    } else if (iCanBuy) {
      highEl.textContent = `Choice locked in — waiting for your teammate.${mateNote}`;
    } else {
      highEl.textContent = `No opponent took it — waiting for the lander's teammate(s)...`;
    }
  }

  document.getElementById("auction-turn").textContent = "";

  // Keypad: used by the lander while pitching, and by acceptors in the
  // tie-breaker. placeBid() routes to the right socket event by phase.
  controls.style.display = showKeypad ? "flex" : "none";
  const bidBtn = document.getElementById("btn-bid");
  if (bidBtn) bidBtn.textContent = keypadLabel;
  // Buy Now: the richest lander can instantly win at second-highest + 1,
  // skipping the auction. The backend sends the price (null when unavailable).
  const buyNowBtn = document.getElementById("btn-buynow");
  if (buyNowBtn) {
    if (showKeypad && a.phase === "pitch" && a.buyNowPrice != null) {
      buyNowBtn.style.display = "";
      // In 2v2 this isn't an instant win — it pitches the lock-out price and
      // lets the teammate accept/reject — so it's labelled by what it does.
      buyNowBtn.textContent = a.teamFlow
        ? `🏷️ Highest opponent score +1 (${a.buyNowPrice}🍌)`
        : `💰 Buy Now (${a.buyNowPrice}🍌)`;
    } else {
      buyNowBtn.style.display = "none";
    }
  }

  const bidInput = document.getElementById("bid-amount");
  const maxBid = _getBidMax();
  if (parseInt(bidInput.value) > maxBid) bidInput.value = String(maxBid);
  const phaseKey = a.phase + (showKeypad ? ":kp" : "");
  if (showKeypad && window._auctionBidPhase !== phaseKey) {
    const defaultBid = a.phase === "pitch" ? Math.min(1, maxBid) : 0;
    bidInput.value = String(defaultBid);
    window._bidAutoFilled = defaultBid > 0;
    window._auctionBidPhase = phaseKey;
  }
  if (!showKeypad) window._auctionBidPhase = null;

  // Debug auto-toggles.
  const autoBid = document.getElementById("chk-auto-bid");
  const autoAccept = document.getElementById("chk-auto-accept");
  if (showKeypad && autoBid && autoBid.checked) {
    if (!window._autoBidQueued) {
      window._autoBidQueued = true;
      const dv = a.phase === "pitch" ? "1" : "0";
      setTimeout(() => {
        window._autoBidQueued = false;
        if (autoBid.checked) {
          document.getElementById("bid-amount").value = dv;
          placeBid();
        }
      }, 600);
    }
  }
  if (
    a.phase === "respond" &&
    !iAmLander &&
    myBid &&
    !myBid.responded &&
    autoAccept &&
    autoAccept.checked
  ) {
    if (!window._autoAcceptQueued) {
      window._autoAcceptQueued = true;
      setTimeout(() => {
        window._autoAcceptQueued = false;
        if (autoAccept.checked) respondAuction(true);
      }, 600);
    }
  }

  // Privacy: never render per-opponent accept/reject status. Show only a
  // neutral note.
  const bidsEl = document.getElementById("auction-bids");
  if (bidsEl) {
    bidsEl.innerHTML = "";
    const note = document.createElement("div");
    note.className = "auction-participant-note";
    if (a.phase === "pitch") {
      note.textContent = "Players will accept or reject privately.";
    } else if (a.phase === "respondOpp" || a.phase === "teammateFinal") {
      note.textContent =
        "Hidden from the other team — only your teammate sees your choice.";
    } else if (a.phase === "respond") {
      note.textContent =
        "Each player decides in secret — revealed only at the end.";
    } else if (a.phase === "silentbid") {
      note.textContent = "Sealed bids — amounts stay hidden until it resolves.";
    }
    bidsEl.appendChild(note);
  }
}

