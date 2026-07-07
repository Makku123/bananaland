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

// The current pendingAction's PUBLIC claim once submitted — {steps, mode} or
// null. The claim (and its derived turtle/rabbit mode) is the only number a
// cup roll ever publishes; every viewer's pendingAction carries it.
function pendingClaimOf(gs) {
  const pa = gs && gs.pendingAction;
  return pa && pa.claim != null
    ? { steps: pa.claim, mode: pa.mode || (pa.claim <= 6 ? "turtle" : "rabbit") }
    : null;
}

// ── Claim screen (roller) + Accuse modal (opponents) — Credit Score UI ─────
// Liar's-dice turn: the roller rolls HIDDEN (cup tier), then during turnPhase
// 'claiming' picks the steps they ANNOUNCE (1..12) — the token walks the CLAIM.
// After the walk, turnPhase 'accusing' lets every opponent holding >=1 credit
// vote Accuse yes/no on the claim. Panels are (re)built per state key and
// shown/hidden per frame; handlers emit submit_claim / submit_accuse.
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

  // (a) ROLLER — the CLAIM screen, up only during their own claiming window
  // (the walk + accuse window need the board visible, so no modal after commit).
  // The per-viewer pendingAction ships rolledTotal only to the roller (or to
  // everyone when the roll is public-tier), so `truth` is always present here.
  const pa = gs.pendingAction;
  const claiming =
    isMyTurn && gs.turnPhase === "claiming" && gs.state === "playing" &&
    pa && pa.playerId === myId && !pa.committed &&
    me && !me.bankrupt && !me.ghost && !me.startPickPending;
  if (claiming) {
    const truth = pa.rolledTotal;
    const cupPublic = !!pa.cupPublic;
    // Alternative walks (Random / pick-a-tile / any non-true claim): free under
    // the cup. The cup is only lost at STRICTLY ZERO credit (public tier), and
    // at 0 the exact roll is the only move — plus the 7→1 Go-1, free in EVERY
    // tier, matching submitClaim.
    const altOk = !cupPublic;
    const key = "claim:" + pa.turn + ":" + truth + ":" + (cupPublic ? "p" : "c");
    if (panel.dataset.key !== key) {
      panel.dataset.key = key;
      panel.innerHTML =
        (cupPublic
          ? '<div class="prp-public-banner">🔓 0 credit — your roll is public</div>'
          : "") +
        '<div class="prp-title" id="prp-title">You rolled <b>' + truth + "</b> — pick your steps</div>" +
        '<button class="btn prp-btn prp-continue" id="prp-walk" onclick="prClaim(null)">➡️ Continue' +
          '<span class="prp-note">walk ' + truth + "</span></button>" +
        '<div class="prp-row">' +
          (truth === 7
            ? '<button class="btn prp-btn prp-go1" id="prp-go1" onclick="prClaim(1)">🐢 Go 1 step<span class="prp-note">free on a 7</span></button>'
            : "") +
          '<button class="btn prp-btn prp-random" id="prp-random" onclick="prClaimRandom()"' +
            (altOk ? "" : " disabled") + ">🎲 Random" +
            '<span class="prp-note">claim 1–12</span></button>' +
        "</div>" +
        '<div class="prp-sub" id="prp-sub">' +
          (altOk
            ? "…or tap a glowing tile (≤12 ahead) to walk that far"
            : "0 💳 — you must walk your exact roll" + (truth === 7 ? " (or the free Go 1)" : "")) +
        "</div>" +
        '<div class="prp-timer" id="prp-rtimer"></div>';
    }
    _setPredictTimer(panel.querySelector("#prp-rtimer"), pa.claimDeadline);
    panel.style.display = "";
    // Auto Continue (toggle): auto-claim the TRUE roll (steps null — free in
    // every tier, exactly what the idle-roller server timeout does).
    const autoCont = document.getElementById("chk-auto-continue");
    if (autoCont && autoCont.checked && !window._autoContinueQueued) {
      window._autoContinueQueued = true;
      setTimeout(() => {
        window._autoContinueQueued = false;
        if (
          document.getElementById("chk-auto-continue").checked &&
          gs && gs.turnPhase === "claiming" &&
          gs.pendingAction && !gs.pendingAction.committed &&
          gs.currentPlayer && gs.currentPlayer.id === myId
        ) prClaim(null);
      }, 600);
    }
  } else {
    panel.style.display = "none";
    if (panel.dataset.key) panel.dataset.key = "";
  }

  // (b) OPPONENT — the ACCUSE prompt during 'accusing'. The title quotes the
  // PUBLIC move record (lastMove) — the real roll stays under the cup. After
  // voting it locks ("waiting") until every vote is in. Ineligible (0-credit)
  // opponents are pre-answered server-side, but the disabled-Yes state is kept
  // defensively.
  const ac = gs.accuse;
  const myVote = ac && ac.myVote;
  const iAmOpponent = !!(ac && myVote && gs.currentPlayer && gs.currentPlayer.id !== myId);
  const mvAcc = gs.lastMove;
  const rollerName = gs.currentPlayer ? gs.currentPlayer.name : "They";
  if (iAmOpponent && !myVote.answered) {
    const canYes = !!myVote.eligible;
    if (predict.dataset.key !== "vote") {
      predict.dataset.key = "vote";
      predict.innerHTML =
        '<div class="prp-crystal" aria-hidden="true">🥤</div>' +
        '<div class="prp-title" id="prp-ptitle"></div>' +
        '<div class="prp-row prp-predict-row">' +
          '<button class="btn prp-btn prp-yes" id="prp-yes" onclick="prAccuse(true)">✅ Yes</button>' +
          '<button class="btn prp-btn prp-no" id="prp-no" onclick="prAccuse(false)">❌ No</button>' +
        '</div>' +
        '<div class="prp-sub" id="prp-psub"></div>' +
        '<div class="prp-timer" id="prp-ptimer"></div>';
    }
    predict.querySelector("#prp-ptitle").innerHTML = mvAcc
      ? rollerName + ' walked <b>"' + mvAcc.steps + " [" + mvAcc.mode + ']"</b> — Accuse?'
      : rollerName + " made a claim — Accuse?";
    predict.querySelector("#prp-yes").disabled = !canYes;
    predict.querySelector("#prp-psub").innerHTML = canYes
      ? "Right → <b>+1 💳</b> · Wrong → <b>−1 💳</b> · No is free"
      : "Need ≥1 credit";
    _setPredictTimer(predict.querySelector("#prp-ptimer"), ac.respondDeadline);
    predict.style.display = "";
    // Auto No (toggle): auto-answer "No" (free) instead of clicking.
    const autoNo = document.getElementById("chk-auto-no");
    if (autoNo && autoNo.checked && !window._autoNoQueued) {
      window._autoNoQueued = true;
      setTimeout(() => {
        window._autoNoQueued = false;
        if (
          document.getElementById("chk-auto-no").checked &&
          gs && gs.accuse && gs.accuse.myVote && !gs.accuse.myVote.answered
        ) prAccuse(false);
      }, 600);
    }
  } else if (iAmOpponent && myVote.answered && myVote.eligible) {
    // Voted → locked in, waiting for the other accusers. Nothing is revealed.
    if (predict.dataset.key !== "locked") {
      predict.dataset.key = "locked";
      predict.innerHTML =
        '<div class="prp-title">🔒 Locked in</div>' +
        '<div class="prp-sub">Waiting for the other accusers — nobody can see your vote.</div>' +
        '<div class="prp-timer" id="prp-ptimer"></div>';
    }
    _setPredictTimer(predict.querySelector("#prp-ptimer"), ac.respondDeadline);
    predict.style.display = "";
  } else {
    predict.style.display = "none";
    if (predict.dataset.key) predict.dataset.key = "";
  }

  // ROLLER outcome note: remember an accuse window opened on MY claim; when the
  // turn resolves with no lastAccuseResult for it, nobody accused — a subtle
  // toast instead of a banner (the lie quietly succeeded / truth stood).
  if (isMyTurn && gs.turnPhase === "accusing") {
    window._myAccuseWindowTurn = gs.turn;
  } else if (window._myAccuseWindowTurn != null) {
    const t = window._myAccuseWindowTurn;
    if (isMyTurn && gs.turn === t && gs.turnPhase === "resolved" && !gs.accuse) {
      window._myAccuseWindowTurn = null;
      if (!gs.lastAccuseResult || gs.lastAccuseResult.turn !== t) {
        showToast("🥤 Nobody accused — your claim stands.", "info", 2600);
      }
    } else if (gs.turn !== t) {
      window._myAccuseWindowTurn = null;
    }
  }
}

// The roller's claim: steps = 1..12, or null to walk the TRUE roll (free in
// every tier). The token walks the claim the moment the server commits it.
function prClaim(steps) {
  if (typeof socket !== "undefined" && socket && gameId)
    socket.emit("submit_claim", { gameId, steps: steps == null ? null : Number(steps) });
}
// Random claim: the CLIENT picks 1..12 uniformly and submits it as the claim
// (truthful only by luck — normal stakes if it lands on a lie).
function prClaimRandom() {
  const n = 1 + Math.floor(Math.random() * 12);
  const sub = document.getElementById("prp-sub");
  if (sub) sub.innerHTML = "🎲 claiming <b>" + n + "</b>…";
  prClaim(n);
}
// An opponent's accuse vote (accuse=true says "the claim was a lie").
function prAccuse(yes) { if (socket && gameId) socket.emit("submit_accuse", { gameId, accuse: !!yes }); }

// Centered verdict banner for a resolved accusation — shown to ALL players
// (called from the game_update handler, deduped on lastAccuseResult.seq).
// Also flips the cup-lift so viewers who had this roll under the cup see the
// cup tip over and the real dice appear (game_update ships them unredacted
// once an accusation reveals the roll).
function _showAccuseVerdict(res) {
  if (!res) return;
  const roller = _gsPlayerMap[res.playerId];
  const name = roller ? roller.name : "The roller";
  // A caught lie costs the roller a FLAT 1 💳 (never 1-per-accuser) — show the
  // APPLIED delta from the result so the banner can't drift from the backend.
  const rollerLoss = Math.abs((res.deltas && res.deltas[res.playerId]) || 1);
  const el = document.getElementById("accuse-verdict");
  if (el) {
    // SB LANDING reveal (no accusation): a rich lander's cup lifts itself —
    // a legit roll wins, a bluffed walk gets the +1 💳 consolation.
    el.innerHTML = res.sbLanding
      ? (res.truthful
          ? "⭐ " + name + " lifts the cup: <b>" + res.actualTotal + "</b> — a LEGITIMATE landing. " + name + " WINS! 👑"
          : "⭐ " + name + " lifts the cup: rolled <b>" + res.actualTotal + "</b>, not the claimed <b>" + res.claim + "</b> — no win, +1 💳")
      : res.truthful
        ? "🛡️ " + name + " told the truth (rolled <b>" + res.actualTotal + "</b>) — accusers lose 1 💳"
        : "🤥 " + name + " LIED — claimed <b>" + res.claim + "</b>, rolled <b>" + res.actualTotal + "</b>! Accusers +1 💳, " + name + " −" + rollerLoss + " 💳";
    el.classList.toggle("verdict-truth", !!res.truthful);
    el.classList.toggle("verdict-lie", !res.truthful);
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(window._accuseVerdictTimer);
    window._accuseVerdictTimer = setTimeout(() => el.classList.remove("show"), 5000);
  }
  // Cup-lift: only for viewers who actually had THIS roll hidden under the cup.
  if (window._hadCupTurn === res.turn) {
    window._cupLift = { until: Date.now() + 4200, turn: res.turn, res };
    clearTimeout(window._cupLiftTimer);
    window._cupLiftTimer = setTimeout(() => {
      window._cupLift = null;
      if (typeof route === "function" && typeof gs !== "undefined" && gs) route();
    }, 4300);
  }
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

// ── Credit Score panel (the #magic-dice box shell) ──────────────────────────
// Renders the VIEWER's credit as BLANK tokens (one poker-chip div per point,
// no numbers — wrap handled by CSS at ~10/row), a "Credit Score: N" line, and
// a tier hint. The tier mirrors the backend EXACTLY (rollDice): you keep the
// cup while you hold ANY credit; only a strictly ZERO Credit Score rolls in
// the open (exact rolls only, plus the free 7→1).
function _renderCreditPanel(gs, me) {
  const box = document.getElementById("magic-dice");
  if (!box) return;
  const list = document.getElementById("magic-dice-list");
  const show = !!(gs && gs.state === "playing" && me && !me.bankrupt);
  box.style.display = show ? "" : "none";
  if (!show || !list) return;
  const credit = me.credit || 0;
  const cupPublic = credit < 1; // the backend cup-tier rule: only 0 credit is public
  const hint = !cupPublic
    ? "🥤 You roll under the cup"
    : "🔓 0 credit — you roll in the open, exact rolls only";
  // Cheap re-render guard: token count + tier fully determine the markup.
  const key = credit + ":" + (cupPublic ? "1" : "0");
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  let tokens = "";
  for (let i = 0; i < credit; i++) {
    tokens += '<span class="credit-token" aria-hidden="true"></span>';
  }
  list.innerHTML =
    '<div class="credit-tokens" id="credit-tokens">' +
      (credit > 0 ? tokens : '<span class="credit-tokens-empty">no credit</span>') +
    "</div>" +
    '<div class="credit-score-line">Credit Score: <b id="credit-score-num">' + credit + "</b></div>" +
    '<div class="credit-hint" id="credit-hint">' + hint + "</div>";
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
  const d12Scene = document.getElementById("d12-scene");
  const diceSum = document.getElementById("dice-sum");
  const diceSumNum = document.getElementById("dice-sum-num");
  const diceAnimal = document.getElementById("dice-animal");
  // Show/hide die scenes based on dice count. A single-element gs.dice ([N])
  // tagged gs.diceIsD12 is a HEXED roll and renders the 12-sided DODECAHEDRON
  // (#d12-scene); a normal roll is a real 2d6 (length 2) -> cubes.
  const numDice = gs.dice ? gs.dice.length : 2;
  // A HEXED roll (single d12, tagged diceIsD12) renders as the blue dodecahedron.
  const isD12Roll = !!(gs && gs.diceIsD12 && gs.dice && gs.dice.length === 1);
  const die1Value = gs.dice ? gs.dice[0] : 0;
  // PUBLIC move record for THIS turn — the walk / Total-badge / cup-label key.
  // A cup roll's dice are [] for every viewer but the roller, so everything
  // step-derived keys off lastMove.steps (the claim), never the dice sum.
  const mvMove =
    gs.lastMove && cur && gs.lastMove.playerId === cur.id && gs.lastMove.turn === gs.turn
      ? gs.lastMove
      : null;
  // THE CUP (liar's dice): this viewer can't see the current roll (diceHidden)
  // — hide the dice entirely and render the cup, from the roll (claiming)
  // through the walk + accuse window. An accusation reveals the roll for
  // everyone (diceHidden flips off) — the transient cup-LIFT then shows the
  // real dice + verdict before the normal cubes return.
  const cupScene = document.getElementById("cup-scene");
  const cupLift = !!(window._cupLift && Date.now() < window._cupLift.until &&
    window._cupLift.turn === gs.turn);
  const showCup = gs.state === "playing" && (
    cupLift ||
    (gs.diceHidden &&
      (gs.turnPhase === "claiming" || gs.turnPhase === "accusing" ||
        (gs.diceRolled && mvMove))));
  if (cupScene) {
    if (showCup) {
      cupScene.style.display = "";
      cupScene.classList.toggle("cup-wobble", gs.turnPhase === "claiming" && !cupLift);
      cupScene.classList.toggle("cup-lifted", cupLift);
      // Remember this roll sat under the cup for this viewer — the accuse
      // reveal keys the cup-lift off it.
      if (gs.diceHidden) window._hadCupTurn = gs.turn;
      // Stamp the claim ON the cup once it's public: '"6 [turtle]" 🐢'.
      const claimNow =
        pendingClaimOf(gs) ||
        (mvMove ? { steps: mvMove.steps, mode: mvMove.mode } : null);
      const cupClaimEl = document.getElementById("cup-claim");
      if (cupClaimEl) {
        if (claimNow) {
          cupClaimEl.style.display = "";
          cupClaimEl.textContent =
            '"' + claimNow.steps + " [" + claimNow.mode + ']" ' +
            (claimNow.mode === "turtle" ? "🐢" : "🐇");
        } else {
          cupClaimEl.style.display = "none";
          cupClaimEl.textContent = "";
        }
      }
      // Cup-lift reveal: the real dice/total + the LIED!/TRUTH verdict.
      const cupRevealEl = document.getElementById("cup-reveal");
      if (cupRevealEl) {
        if (cupLift && window._cupLift.res) {
          const res = window._cupLift.res;
          const diceTxt =
            gs.dice && gs.dice.length > 1
              ? gs.dice.join("+") + " = " + res.actualTotal
              : String(res.actualTotal);
          cupRevealEl.style.display = "";
          cupRevealEl.innerHTML =
            '<span class="cup-reveal-dice">🎲 ' + diceTxt + "</span>" +
            '<span class="cup-reveal-verdict ' + (res.truthful ? "cup-truth" : "cup-lie") + '">' +
            (res.truthful ? "TRUTH" : "LIED!") + "</span>";
        } else {
          cupRevealEl.style.display = "none";
          cupRevealEl.innerHTML = "";
        }
      }
    } else {
      cupScene.style.display = "none";
      cupScene.classList.remove("cup-wobble", "cup-lifted");
    }
  }
  if (showCup) {
    // Cup shown — every die scene hides (the roller keeps their cubes: their
    // own diceHidden is always false, so showCup never fires for them).
    if (dieScene1) dieScene1.style.display = "none";
    if (dieScene2) dieScene2.style.display = "none";
    if (dieScene3) dieScene3.style.display = "none";
    if (d12Scene) d12Scene.style.display = "none";
  } else if (isD12Roll) {
    if (dieScene1) dieScene1.style.display = "none";
    if (dieScene2) dieScene2.style.display = "none";
    if (dieScene3) dieScene3.style.display = "none";
    if (d12Scene) {
      d12Scene.style.display = "";
      const n = d12Scene.querySelector(".d12-num");
      if (n) n.textContent = String(gs.dice[0]);
    }
  } else {
    if (d12Scene) d12Scene.style.display = "none";
    if (dieScene1) {
      dieScene1.style.display = "";
      // A HEXED roll (single d12) tints the cube PURPLE; a normal 2d6 clears it.
      dieScene1.classList.toggle("hex-die", !!(gs && gs.diceIsD12));
    }
    if (dieScene2) dieScene2.style.display = numDice >= 2 ? "" : "none";
    if (dieScene3) dieScene3.style.display = numDice >= 3 ? "" : "none";
  }
  // The 🐢/🐰 speed indicator shows for EVERY settled roll — 2d6 and the d12 hex
  // — keyed on the move value (< 7 turtle, >= 7 rabbit). A FRESH roll (key not
  // yet recorded) or one still spinning stays hidden; the dice-landing branch
  // re-pops them the moment the dice settle.
  if (diceSum) {
    const diceKeyNow = gs.dice ? gs.dice.join("-") + "-" + gs.turn : "";
    const d12El = d12Scene && d12Scene.querySelector(".d12-die");
    const spinning =
      !!(die1El && die1El.classList.contains("rolling")) ||
      !!(d12El && d12El.classList.contains("rolling"));
    // The dice are REVEALED at ROLL time (see the roll-time reveal block below)
    // for the roller/public rolls, so the Total + 🐢/🐰 must persist through the
    // claiming window AND commit. Shown once the reveal for THIS exact roll has
    // settled (_rollRevealKey matches), or at a normal commit.
    const committedNow = gs.diceRolled && diceKeyNow === window._lastDiceKey;
    const revealedNow = window._rollRevealKey === diceKeyNow;
    // The badge keys on the WALKED steps (the claim) for EVERYONE once the move
    // commits — for a hidden roll the claim IS the only public number (never
    // the roller's true total). Pre-commit (the roller's private claiming
    // window) it shows their real roll.
    const badgeVal =
      gs.diceRolled && mvMove
        ? mvMove.steps
        : gs.dice && gs.dice.length
          ? (numDice >= 2 ? gs.dice.reduce((a, b) => a + b, 0) : gs.dice[0])
          : null;
    const settled = (committedNow || revealedNow) && !spinning && badgeVal != null;
    // Speed animal — always (turtle/rabbit by the WALKED value, any roll type).
    if (settled && diceAnimal) {
      _showDiceAnimal(diceAnimal, badgeVal, false);
    } else if (diceAnimal) {
      diceAnimal.classList.remove("show");
    }
    // Running TOTAL — 2d6, d12, and the cup's claimed walk.
    if (settled && ((gs.diceRolled && mvMove) || isD12Roll || numDice >= 2)) {
      if (diceSumNum) diceSumNum.textContent = String(badgeVal);
      diceSum.classList.toggle("is-low", badgeVal < 7); // green digit when below 7
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
    !gs.turnPhase && // no re-roll while a post-roll / predict window is open
    !gs.superBananaPending &&
    !needsStartPick &&
    rollDelayDone;
  document.getElementById("btn-roll").disabled = !canRoll;
  document.getElementById("btn-debug-move").disabled = !canRoll;

  // Start-pick prompt + Random Start button — centered in the board, shown only
  // on the player's own start-pick turn (the Roll button is disabled then). The
  // server picks a random unoccupied tile so 2nd/3rd/4th picks never collide.
  const startRandomWrap = document.getElementById("board-random-start");
  if (startRandomWrap) {
    startRandomWrap.style.display = isMyTurn && needsStartPick ? "flex" : "none";
  }

  // Roll-button label.
  const rollBtn = document.getElementById("btn-roll");
  if (rollBtn) {
    rollBtn.textContent = "Roll Dice";
  }

  // Auto-roll: trigger dice roll when it's our turn and we haven't rolled yet.
  if (
    canRoll &&
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
    // Die faces are always 1..6 — rotate the 3D cube to that face.
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
  // Start picks place the token instantly, so skip the walk animation path.
  const diceNotif = document.getElementById("dice-roll-notification");
  const isStartPickTeleport =
    !!(gs.lastStartPick && gs.lastStartPick.turn === gs.turn);
  // ── ROLL-TIME dice reveal ──────────────────────────────────────────────
  // The turn HOLDS after a roll (turnPhase 'claiming', diceRolled stays FALSE
  // until the claim commits). The ROLLER wants to SEE their roll the instant
  // they roll — the spin, the running Total, and the 🐢/🐰 indicator — BEFORE
  // picking their claim. So spin + reveal the dice HERE, purely visually: no
  // freeze, no walk, no token move (those wait for commit in the block below).
  // Fires ONLY for the roller / public-tier rolls: a cup roll ships dice: []
  // to every other viewer, so the length gate keeps it silent for them. Keyed
  // on _rollRevealKey; the commit-time walk block skips its own re-spin when
  // the dice are unchanged (they always are now — the claim never rewrites
  // gs.dice, it only sets lastMove).
  if (
    gs.dice && gs.dice.length &&
    !gs.diceRolled &&
    gs.turnPhase === "claiming" &&
    !gs.itemMoveThisTurn &&
    !isStartPickTeleport &&
    cur
  ) {
    const revealKey = gs.dice.join("-") + "-" + gs.turn;
    if (revealKey !== window._rollRevealKey) {
      window._rollRevealKey = revealKey;
      const d12DieElR = d12Scene && d12Scene.querySelector(".d12-die");
      const d12NumElR = d12Scene && d12Scene.querySelector(".d12-num");
      const settleReveal = () => {
        // Bail if the turn has since COMMITTED (diceRolled) or a new roll superseded
        // this one — otherwise a fast Continue / a teleport (which never reaches the
        // walk block) would let this fire mid-walk and blink the badge / flash a
        // stale "0"🐢 landing after the token already moved.
        if (!gs || gs.diceRolled || window._rollRevealKey !== revealKey ||
            !gs.dice || !gs.dice.length) return;
        if (isD12Roll) {
          if (d12NumElR) d12NumElR.textContent = String(gs.dice[0]);
          if (d12DieElR) {
            d12DieElR.classList.remove("rolling");
            void d12DieElR.offsetWidth;
            d12DieElR.classList.add("landed");
          }
          if (diceSum) {
            const _v = gs.dice[0];
            if (diceSumNum) diceSumNum.textContent = String(_v);
            diceSum.classList.toggle("is-low", _v < 7);
            diceSum.classList.remove("show");
            void diceSum.offsetWidth;
            diceSum.classList.add("show");
            _showDiceAnimal(diceAnimal, _v, true);
          }
        } else {
          setDieFace(die1El, die1Value);
          if (numDice >= 2) setDieFace(die2El, gs.dice[1]);
          if (numDice >= 3) setDieFace(die3El, gs.dice[2]);
          die1El.classList.remove("rolling");
          if (numDice >= 2) die2El.classList.remove("rolling");
          if (numDice >= 3) die3El.classList.remove("rolling");
          fireDieLanding(die1El);
          if (numDice >= 2) fireDieLanding(die2El);
          if (numDice >= 3) fireDieLanding(die3El);
          if (diceSum && numDice >= 2) {
            const _sum = gs.dice.reduce((a, b) => a + b, 0);
            if (diceSumNum) diceSumNum.textContent = String(_sum);
            diceSum.classList.toggle("is-low", _sum < 7);
            diceSum.classList.remove("show");
            void diceSum.offsetWidth;
            diceSum.classList.add("show");
            _showDiceAnimal(diceAnimal, _sum, true);
          }
        }
      };
      // Kick off the spin (hex d12 or the 2d6 cubes), then settle after the tumble.
      if (isD12Roll) {
        if (d12DieElR) {
          d12DieElR.classList.remove("landed", "rolling");
          void d12DieElR.offsetWidth;
          d12DieElR.classList.add("rolling");
        }
      } else {
        resetDieOverlay(die1El);
        die1El.classList.add("rolling");
        if (numDice >= 2) die2El.classList.add("rolling");
        if (numDice >= 3) die3El.classList.add("rolling");
      }
      const revDur = 550, revInt = 70;
      let revElapsed = 0;
      clearInterval(window._rollRevealTicker);
      window._rollRevealTicker = setInterval(() => {
        revElapsed += revInt;
        if (isD12Roll && d12NumElR && revElapsed < revDur) {
          d12NumElR.textContent = String(1 + Math.floor(Math.random() * 12));
        }
        if (revElapsed >= revDur) {
          clearInterval(window._rollRevealTicker);
          settleReveal();
        }
      }, revInt);
    }
  }
  if (
    diceNotif &&
    gs.diceRolled &&
    !gs.itemMoveThisTurn &&
    !isStartPickTeleport &&
    cur
  ) {
    const diceKey = gs.dice.join("-") + "-" + gs.turn;
    if (diceKey !== window._lastDiceKey) {
      window._lastDiceKey = diceKey;
      // Already spun+revealed at ROLL time (see the roll-time reveal block above)?
      // Only true for an UNCHANGED value — i.e. a plain "Continue" (this.dice ===
      // pa.rolledDice). switch/steady/card commit a NEW single value, so the key
      // differs and we spin fresh to show it. When preRevealed we skip the visible
      // re-spin and walk straight away (no jarring second roll).
      const preRevealed = window._rollRevealKey === diceKey;
      // The roll-time reveal ticker has done its job (or is about to be superseded):
      // cancel it UNCONDITIONALLY at commit so it can't fire settleReveal() mid-walk
      // (a fast plain Continue would otherwise leave it running — see the guard in
      // settleReveal for the belt-and-suspenders).
      clearInterval(window._rollRevealTicker);
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
      // Start the physical dice roll: the hex d12 tumbles, a normal roll spins
      // the dice cube(s).
      const d12DieEl = d12Scene && d12Scene.querySelector(".d12-die");
      const d12NumEl = d12Scene && d12Scene.querySelector(".d12-num");
      if (!preRevealed) {
        // Not yet revealed (a changed value, or an opponent whose reveal was
        // skipped) → spin fresh to show the committed value.
        if (isD12Roll) {
          if (d12DieEl) {
            d12DieEl.classList.remove("landed", "rolling");
            void d12DieEl.offsetWidth; // restart the tumble
            d12DieEl.classList.add("rolling");
          }
        } else {
          resetDieOverlay(die1El);
          die1El.classList.add("rolling");
          if (numDice >= 2) die2El.classList.add("rolling");
          if (numDice >= 3) die3El.classList.add("rolling");
        }
      }
      // preRevealed (plain Continue): the dice already spun+settled at roll time, so
      // settle IMMEDIATELY (no visible re-spin) and go straight to the walk.
      const rollDuration = preRevealed ? 0 : 550;
      const rollInterval = 70;
      let elapsed = 0;
      const ticker = setInterval(() => {
        if (!_walkAlive()) {
          clearInterval(ticker);
          return;
        }
        elapsed += rollInterval;
        if (isD12Roll && d12NumEl && elapsed < rollDuration) {
          // Slot-machine the d12 value while the die tumbles.
          d12NumEl.textContent = String(1 + Math.floor(Math.random() * 12));
        }
        if (elapsed >= rollDuration) {
          clearInterval(ticker);
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
          setDieFace(die1El, die1Value);
          if (numDice >= 2) setDieFace(die2El, gs.dice[1]);
          if (numDice >= 3) setDieFace(die3El, gs.dice[2]);
          die1El.classList.remove("rolling");
          if (numDice >= 2) die2El.classList.remove("rolling");
          if (numDice >= 3) die3El.classList.remove("rolling");
          // preRevealed (plain Continue) already fired the landing flourish + popped
          // the Total/🐢🐰 at ROLL time and the badge stayed up through the ability
          // window, so DON'T re-fire them (that would blink the settled badge). For a
          // fresh spin (changed value / opponent) reveal them the instant cubes land.
          if (!preRevealed) {
            // Landing flourish on the OUTER scene (overlaps the walk; geometry-safe).
            fireDieLanding(die1El);
            if (numDice >= 2) fireDieLanding(die2El);
            if (numDice >= 3) fireDieLanding(die3El);
            // Reveal the clear running TOTAL + the cute 🐢/🐰 speed indicator the
            // instant the cubes settle. Keyed on the WALKED steps (lastMove —
            // the claim) when the move committed one: a cup roll's dice are []
            // for opponents, so the claim is the only number to show, and it's
            // what everyone's token actually walks.
            if (diceSum && (numDice >= 2 || mvMove)) {
              const _sum = mvMove ? mvMove.steps : gs.dice.reduce((a, b) => a + b, 0);
              if (diceSumNum) diceSumNum.textContent = String(_sum);
              diceSum.classList.toggle("is-low", _sum < 7); // green digit when below 7
              diceSum.classList.remove("show");
              void diceSum.offsetWidth; // restart the pop animation
              diceSum.classList.add("show");
              _showDiceAnimal(diceAnimal, _sum, true);
            }
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
          // Step-by-step token walk to final position. The walk is keyed on the
          // PUBLIC lastMove.steps (the claim) — a cup roll's dice are [] for
          // every viewer but the roller, and even the roller walks the claim.
          const total = gs.dice.reduce((a, b) => a + b, 0);
          const walkSteps = mvMove ? mvMove.steps : total;
          // Cup roll (this viewer can't see the dice): announce the CLAIM.
          // Roller/public view of a claim that differs from the roll: show both.
          // Otherwise the classic "rolled X+Y = N" line.
          const rollText = mvMove && gs.diceHidden
            ? `🥤 ${cur.name} walks "${mvMove.steps} [${mvMove.mode}]"`
            : mvMove && gs.dice.length && mvMove.steps !== total
              ? `🎲 ${cur.name} rolled ${gs.dice.length === 1 ? gs.dice[0] : gs.dice.join("+") + " = " + total} — walks ${mvMove.steps}`
              : gs.dice.length === 1
                ? `🎲 ${cur.name} rolled a ${gs.dice[0]}`
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
          const steps = walkBackward ? backwardDist : forwardDist || walkSteps;
          // Delay walk start when dice-match animation needs to play, and when
          // an early-pickup floater is shown, so the pickup is visible before
          // the walk.
          // With a grow pulse in play the pulse drives the timing (grown piles
          // are gated until it sweeps; landing-grow piles reveal after arrival),
          // so skip the dice-match pre-walk pause.
          const walkDelay = anyGrowPulse
            ? 0
            : hasDiceMatch
              ? (1200 + (hasEarlyPickup ? 1000 : 0))
              : (hasEarlyPickup ? 1000 : 0);
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
              if (window._prevBananaPileState && typeof _showStealFloaterAt === "function") {
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
  } else if (!(die1El && die1El.classList.contains("rolling"))) {
    // Static face-set for the non-walk states (pre-roll, off-turn, teleport). SKIP
    // while a die is mid-spin — during the roll-time reveal spin this else runs every
    // re-render (diceRolled is false through the hold), and stamping the final face
    // now would pre-commit the result under the spin (currently masked by the
    // .rolling keyframe, but don't rely on that).
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

  // Post-roll shell (active player) + Predict prompt (opponents).
  _renderPostRollUI(gs, me, isMyTurn);

  // Banana Gadget (with its built-in Path Preview toggle) — recompute every frame
  // so it tracks position; the box shows/hides with play state.
  updateBananaGadget();

  // #magic-dice box → the CREDIT SCORE panel: the viewer's credit as blank
  // tokens + total + the cup/public tier hint.
  _renderCreditPanel(gs, me);

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
          `<span class="pstat-credit" title="Credit Score (public — blank tokens, 1 per point)">💳${p.credit || 0}</span>` +
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
        `<span class="pstat-credit" title="Credit Score (public — blank tokens, 1 per point)">💳${p.credit || 0}</span>` +
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

  // The Super Banana's RICH threshold (the win price) + what a revealed SB pays
  // — shown HERE instead of on the board tile. Win: land on it while RICH
  // (money >= the price), or the auto-win (rich + >=1 credit + the revealed SB
  // within 12 steps ahead). A rich CROSS earns +1 credit every lap; a broke
  // crosser gets the one-time +200🍌 consolation.
  if (special > 0) {
    const target = gs.superBananaPrice != null ? gs.superBananaPrice : 0;
    const TOUCH_BONUS = 200;
    const stats = document.createElement("div");
    stats.className = "legend-sb-stats";
    stats.innerHTML =
      `<div class="legend-sb-stat"><span class="legend-sb-label">🎯 Rich at (win money)</span>` +
      `<span class="legend-sb-val">${target}🍌</span></div>` +
      `<div class="legend-sb-stat"><span class="legend-sb-label">💳 Rich cross</span>` +
      `<span class="legend-sb-val legend-sb-val--bonus">+1 credit</span></div>` +
      `<div class="legend-sb-stat"><span class="legend-sb-label">↩️ Broke cross bonus</span>` +
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
  const creditStartEl = document.getElementById("create-credit-start");
  const creditStart = creditStartEl ? (parseInt(creditStartEl.value) || 7) : 7;
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
    creditStart,
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
    titleEl.textContent = a.sealedBid
      ? "🤫 SEALED BID 🤫"
      : "🏷️ PRICE IT 🏷️";
  box.style.display = "block";

  const propEl = document.getElementById("auction-prop");
  if (a.propName) {
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

