// ── Socket setup ───────────────────────────────────────────────────

function initSocket() {
  if (socket) return;
  socket = io();
  myId = socket.id; // will be set after connect

  socket.on("server_info", (info) => {
    if (!info || info.debugTools !== false) return;
    const t = document.getElementById("debug-toggle");
    const w = document.getElementById("debug-window");
    if (t) t.style.display = "none";
    if (w) w.classList.add("debug-window-hidden");
    // "Reveal All Tiles" is a fog bypass (DEBUG builds only) — hide the toggle in
    // production so it isn't offered as a player-facing cheat. The server also
    // ignores set_reveal_all when DEBUG_TOOLS is off, so this is defense-in-depth.
    const r = document.getElementById("chk-reveal");
    const rl = r && r.closest("label");
    if (rl) rl.style.display = "none";
  });

  socket.on("connect", () => {
    myId = socket.id;
    // Authenticate socket if user is logged in
    const token = localStorage.getItem("banana_auth_token");
    if (token) socket.emit("auth_socket", { token });
    // Dismiss loading overlay once connected
    dismissLoadingOverlay();
    // Reconnect: if we were in a game when the socket dropped, re-join with our
    // device id so the server hands our GHOST back to us (or re-seats us in the
    // lobby). The server resolves whether this is a reconnect or a fresh join.
    if (gameId && _joinedName) {
      socket.emit("join_game", {
        gameId,
        playerName: _joinedName,
        clientId: getClientId(),
      });
    }
  });

  socket.on("public_lobbies", _handlePublicLobbies);


  socket.on("game_update", (state) => {
    // Player-position snapshot: ALWAYS taken from the outgoing gs, even mid-walk —
    // same reasoning as the pile/revealed snapshots below. The frozen token-walk
    // reads _prevPlayerPositions[cur.id] (game-screen.js) for each player's pre-move
    // tile; behind the old !_tokenWalking guard this went STALE during an
    // overlapping / auto-roll / backgrounded-tab update, so the walk rendered the
    // token from the wrong position. An in-flight walk is unaffected: it froze its
    // own _diceRollingPositions reference and a _walkStartPositions copy at
    // walk-START, and each update reassigns a fresh _prevPlayerPositions object (the
    // old one it holds is never mutated).
    if (gs && gs.players) {
      window._prevPlayerPositions = {};
      gs.players.forEach((p) => {
        window._prevPlayerPositions[p.id] = p.position;
      });
    }
    // Money snapshots stay behind the walk guard: the money-popup deferral relies on
    // a stable PRE-walk baseline (re-snapshotting mid-walk would reset it).
    if (gs && gs.players && !window._tokenWalking) {
      // Snapshot money before state update
      const meSnap = _gsPlayerMap[socket.id];
      if (meSnap) window._prevMoney = meSnap.money;
      // Snapshot all players' money for deduction popups
      window._prevPlayerMoney = {};
      for (const p of gs.players) {
        window._prevPlayerMoney[p.id] = p.money;
      }
    }
    // Pile snapshot: ALWAYS taken from the outgoing gs, even mid-walk (each
    // rebuild is a fresh object, so an in-flight walk's _frozenBananaPiles
    // reference to the older snapshot is untouched). This used to sit behind
    // the !_tokenWalking guard above: when a roll update arrived while the
    // previous walk was still animating (throttled background tab, overlapping
    // turns), the new walk froze to a PRE-previous-turn snapshot and every
    // pile grown since then vanished from the board until unfreeze.
    if (gs && gs.properties) {
      window._prevBananaPileState = {};
      gs.properties.forEach((p) => {
        if (p.bananaPile > 0)
          window._prevBananaPileState[p.id] = p.bananaPile;
      });
    }
    // Revealed-tiles snapshot: ALWAYS taken from the outgoing gs, even mid-walk —
    // same reasoning as the pile snapshot above (the walk freezes fog by copying
    // this into a fresh _diceRollingRevealed Set, so refreshing it on a later
    // update can't corrupt an in-flight freeze). Behind the old !_tokenWalking
    // guard this went STALE during an overlapping / auto-roll sequence, so the
    // destination tile un-fogged BEFORE the token arrived. Must read the
    // PRE-update player map (before `gs = state` and the _gsPlayerMap rebuild).
    if (gs && gs.players) {
      const meRev = _gsPlayerMap[socket.id];
      if (meRev && meRev.revealedTiles) {
        window._prevRevealedTiles = new Set(meRev.revealedTiles);
      }
    }
    // Rune-count snapshot: ALWAYS from the outgoing gs (even mid-walk), like the
    // pile/revealed snapshots above — a spell-card DRAW can land during ANOTHER
    // player's walk (an off-turn cancel HIT), so we must not miss it. Diffed
    // after `gs = state` to fly a card from the center deck to the gainer
    // (below). Left undefined on the very first state, so a reload/reconnect
    // never re-fires for runes already in hand.
    if (gs && gs.players && typeof _runeCountOf === "function") {
      window._prevRuneCounts = {};
      for (const p of gs.players) {
        window._prevRuneCounts[p.id] = _runeCountOf(p);
      }
    }
    // Ghost notification: a player who just turned into a ghost (left/disconnected
    // mid-game). Show a toast so the change is unmistakable.
    if (gs && gs.players && Array.isArray(state.players)) {
      const _prevGhosts = new Set(gs.players.filter((p) => p.ghost).map((p) => p.id));
      for (const p of state.players) {
        if (p.ghost && !_prevGhosts.has(p.id)) {
          showToast(`👻 ${p.name} left — the spirits will play their turns until they return.`, "info", 3000);
        }
      }
    }

    // Cancel result: a HIT is revealed to EVERYONE the moment the targeted
    // player plays a spell card that gets nullified. A MISS is private — the
    // server ships it ONLY to the caster (so the target never learns they were
    // targeted) and the caster simply loses two random runes. Dedup by seq; seed
    // on the first state so a reload mid-turn never re-toasts.
    if (window._lastCancelResultSeq === undefined) {
      window._lastCancelResultSeq = state.lastCancelResult ? state.lastCancelResult.seq : 0;
    } else if (state.lastCancelResult && state.lastCancelResult.seq !== window._lastCancelResultSeq) {
      window._lastCancelResultSeq = state.lastCancelResult.seq;
      const cr = state.lastCancelResult;
      if (cr.landed) {
        showToast(`🚫 ${cr.casterName} canceled ${cr.targetName}'s spell card!`, "warning", 4000);
      } else if (cr.runesLost > 0) {
        // Caster-only (the server redacts misses to the caster).
        showToast(`💢 Your cancel missed — you lost ${cr.runesLost} spell card${cr.runesLost === 1 ? "" : "s"}!`, "warning", 4000);
      }
    }

    // Clear the missed-cancel discard "resolving" guard on EVERY update so the
    // picker can re-open whenever the debt still stands — a rejected/stale pick or
    // a 2nd missed cancel that bumped the owed count. Without this the flag could
    // latch true and soft-lock the caster (gated from all actions until reload).
    window._cancelDiscardResolving = false;

    // Hex notification: a player just became HEXED (single-d12 curse) — on the
    // first Super Banana landing, or when the curse passes to them. Public; the
    // hexee sees "You have been hexed!", everyone else sees who got it. Dedup by
    // seq, seeded on first state so a reload never re-toasts.
    if (window._lastHexResultSeq === undefined) {
      window._lastHexResultSeq = state.lastHexResult ? state.lastHexResult.seq : 0;
    } else if (state.lastHexResult && state.lastHexResult.seq !== window._lastHexResultSeq) {
      window._lastHexResultSeq = state.lastHexResult.seq;
      const hx = state.lastHexResult;
      showToast(
        hx.playerId === socket.id
          ? "🎲 You have been HEXED! Your 2d6 is now a single d12."
          : `🎲 ${hx.name} has been hexed — down to a single d12!`,
        "warning",
        4500
      );
    }

    // Shuffle sound: fires once when a new lastTileShuffle stamp arrives
    // (the deferred shuffle finished). Dedup by timestamp so repeated state
    // updates with the same stamp don't re-trigger the sound.
    if (state.lastTileShuffle && state.lastTileShuffle.ts) {
      if (window._lastTileShuffleTs !== state.lastTileShuffle.ts) {
        window._lastTileShuffleTs = state.lastTileShuffle.ts;
        if (typeof playShuffleSound === "function") playShuffleSound();
      }
    }
    gs = state;
    gameId = state.gameId;
    myId = socket.id;
    // Player colours are skinned Red/Green/Blue/Black
    // (scoped CSS overrides hang off this body class).
    document.body.classList.toggle(
      "mode-standard",
      state.gameMode === "classic" ||
        state.gameMode === "2v2" ||
        state.gameMode === "3v3",
    );
    // Sync no-timer toggle with server state
    const noTimerChk = document.getElementById("chk-no-timer");
    if (noTimerChk) noTimerChk.checked = !!gs.noAuctionTimer;
    // Rebuild lookup maps for O(1) access
    _gsPlayerMap = {};
    if (gs.players) for (const p of gs.players) _gsPlayerMap[p.id] = p;
    _gsPropMap = {};
    if (gs.properties) for (const p of gs.properties) _gsPropMap[p.id] = p;

    route();

    // General money-loss detection: show red deduction popup for ANY player
    // whose money decreased (tax, farm purchase, poker, etc.)
    // If a walk animation is in progress, defer the walking player's deduction
    // until they visually land on the tile.
    // If poker just started, defer BOTH poker players' deductions until the
    // poker table visually appears.
    if (window._prevPlayerMoney) {
      // Start picks set diceRolled=true but never trigger a walk animation, so
      // the normal "defer until walk lands" path would strand the gain/loss
      // bundle entirely. Treat start picks as immediate.
      const isStartPick =
        !!(gs.lastStartPick && gs.lastStartPick.turn === gs.turn);
      // A farm teleport also jumps instantly (no walk), so — like a start pick —
      // its money effects (the harvested own-pile) must fire immediately, not be
      // deferred to a walk that never happens.
      const isTeleport =
        !!(gs.lastTeleport && gs.lastTeleport.turn === gs.turn);
      // Detect if a brand-new dice roll just arrived (walk animation hasn't started yet)
      const isNewDiceRoll = gs.diceRolled && gs.dice && !gs.itemMoveThisTurn &&
        gs.currentPlayer && !isStartPick && !isTeleport &&
        (gs.dice.join("-") + "-" + gs.turn) !== window._lastDiceKey;
      const walkInProgress = window._tokenWalking || isNewDiceRoll;
      const pokerJustStarted = gs.poker && !gs.poker.resolved && walkInProgress;
      const walkingId = window._walkingPlayerId || (isNewDiceRoll && gs.currentPlayer ? gs.currentPlayer.id : null);

      for (const p of gs.players) {
        const prev = window._prevPlayerMoney[p.id];

        // ── Money LOSS detection ──
        if (prev != null && p.money < prev) {
          const diff = prev - p.money;
          if (pokerJustStarted && gs.poker.players[p.id]) {
            // Defer poker deductions until poker table appears
            if (!window._pendingPokerDeductions) window._pendingPokerDeductions = [];
            window._pendingPokerDeductions.push({ playerId: p.id, amount: diff });
          } else if (walkInProgress && p.id === walkingId) {
            // Defer walking player's deduction until visual landing
            window._pendingLandingDeduction = { playerId: p.id, amount: diff };
          } else if (isNewDiceRoll && p.id !== walkingId) {
            // Defer other players' deductions (e.g. rent loss) until visual landing
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "loss", playerId: p.id, amount: diff });
          } else {
            _showMoneyDeduction(p.id, diff);
          }
        }

        // ── Money GAIN detection ──
        // Skip the walking player — pile collections are handled in board.js,
        // and non-pile gains fire from the post-walk handler.
        if (prev != null && p.money > prev) {
          const gain = p.money - prev;
          if (walkInProgress && p.id === walkingId) {
            // Walking player gains handled by post-walk handler
          } else if (isNewDiceRoll) {
            // Defer other players' gains (e.g. rent income) until visual landing
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "gain", playerId: p.id, amount: gain });
          } else if (window._tokenWalking && !isTeleport && !isStartPick) {
            // Walk mid-progress updates — defer. But an instant teleport / start
            // pick never walks, so its harvested-pile gain must burst NOW even if
            // a prior walk left _tokenWalking stale-true (else the +N🍌 floater is
            // deferred to the next walk or dropped).
            if (!window._pendingLandingOtherEffects) window._pendingLandingOtherEffects = [];
            window._pendingLandingOtherEffects.push({ type: "gain", playerId: p.id, amount: gain });
          } else {
            bananaBurst(gain, p.id);
          }
        }
      }
    }

    // Magic-rune DRAW detection: any player whose concealed rune count rose
    // since the previous state just drew — fly a card from the center proxy
    // deck to their token. Source-agnostic: every gain (cancel HIT, Super-Banana
    // award / auction, …) funnels through the rune count, so this one diff
    // covers them all. Seeded reconnect-safe: _prevRuneCounts is undefined on
    // the first state, so runes already in hand never re-fire on reload.
    if (
      window._prevRuneCounts &&
      gs.state === "playing" &&
      gs.players &&
      typeof flyRuneDraw === "function"
    ) {
      for (const p of gs.players) {
        const prevC = window._prevRuneCounts[p.id];
        const nowC = _runeCountOf(p);
        if (prevC != null && nowC > prevC) {
          const gained = nowC - prevC;
          // Own draw: reveal the freshly-drawn value(s). New runes are
          // push-appended, so the last `gained` entries of rollCards are newest.
          const faces =
            p.id === myId && Array.isArray(p.rollCards)
              ? p.rollCards.slice(-gained)
              : null;
          flyRuneDraw(p.id, gained, faces);
        }
      }
    }

  });

  socket.on("game_error", (data) => {
    showToast(data.message, "error");
  });

  socket.on("kicked", (data) => {
    showToast(data.message || "You were kicked from the lobby.", "error");
    gameId = null;
    gs = null;
    showScreen("screen-menu");
  });

  socket.on("player_reaction", (data) => {
    showEmojiReaction(data.playerId, data.emoji);
  });

  socket.on("chat_message", (data) => {
    const container = document.getElementById("board-chat-messages");
    if (!container) return;
    const msg = document.createElement("div");
    msg.className = "board-chat-msg";

    // Colored dot + player name
    const nameWrap = document.createElement("span");
    nameWrap.className = "board-chat-name-wrap";
    const dot = document.createElement("span");
    dot.className = "board-chat-dot c-" + (data.color || "brown");
    const nameSpan = document.createElement("span");
    nameSpan.className = "board-chat-name c-" + (data.color || "brown");
    nameSpan.textContent = data.name;
    nameWrap.appendChild(dot);
    nameWrap.appendChild(nameSpan);

    // Timestamp
    const timeSpan = document.createElement("span");
    timeSpan.className = "board-chat-time";
    const now = new Date();
    timeSpan.textContent = now.getHours().toString().padStart(2, "0") + ":" +
      now.getMinutes().toString().padStart(2, "0");

    // Message text — parse @mentions
    const textSpan = document.createElement("span");
    textSpan.className = "board-chat-text";
    const mentionRegex = /@(\S+)/g;
    let lastIdx = 0;
    let match;
    const messageText = data.message;
    let hasMention = false;
    while ((match = mentionRegex.exec(messageText)) !== null) {
      // Add text before the mention
      if (match.index > lastIdx) {
        textSpan.appendChild(document.createTextNode(messageText.slice(lastIdx, match.index)));
      }
      const mentionName = match[1];
      const mentionSpan = document.createElement("span");
      // Find matching player for color
      const matchedPlayer = gs && gs.players
        ? gs.players.find((p) => p.name.toLowerCase() === mentionName.toLowerCase())
        : null;
      if (matchedPlayer) {
        mentionSpan.className = "board-chat-mention c-" + matchedPlayer.color;
        if (matchedPlayer.id === myId) {
          mentionSpan.classList.add("board-chat-mention-me");
          hasMention = true;
        }
      } else {
        mentionSpan.className = "board-chat-mention";
      }
      mentionSpan.textContent = "@" + mentionName;
      textSpan.appendChild(mentionSpan);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < messageText.length) {
      textSpan.appendChild(document.createTextNode(messageText.slice(lastIdx)));
    }
    if (hasMention) {
      msg.classList.add("board-chat-msg-mentioned");
    }

    msg.appendChild(nameWrap);
    msg.appendChild(timeSpan);
    msg.appendChild(textSpan);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    playChatNotif();
    // Show unread badge if chat is hidden
    const chatEl = document.getElementById("board-chat");
    const toggle = document.getElementById("board-chat-toggle");
    if (chatEl && chatEl.classList.contains("board-chat-hidden") && toggle) {
      toggle.classList.add("has-unread");
    }
  });

  socket.on("dev:reload", () => location.reload());
}

// ── Routing: pick correct screen based on state ────────────────────

function route() {
  if (!gs) return;
  if (gs.state === "waiting") {
    window._returnedToLobby = false;
    showLobby();
  } else if (gs.state === "finished" && window._returnedToLobby) {
    // Player clicked "Back to Lobby" but game hasn't fully reset yet
    // Show lobby screen while waiting for other players
    showLobby();
  } else if (gs.state === "revealing") {
    showReveal();
    updateRevealAcceptStatus();
    updateRevealRunes();
  } else {
    hideReveal();
    if (!_shufflePlayed) {
      _shufflePlayed = true;
      playShuffleSound();
    }
    showGame();
    if (gs.state === "finished") {
      showGameOver();
    }
  }
}

function showGameOver() {
  const overlay = document.getElementById("game-over-overlay");
  if (!overlay || overlay.style.display === "flex") return;
  overlay.style.display = "flex";

  // Spawn confetti particles
  const confettiEmojis = ["\uD83C\uDF4C", "\uD83C\uDF1F", "\u2728", "\uD83C\uDF89", "\uD83C\uDF8A", "\uD83D\uDC51", "\uD83C\uDF4C", "\u2B50"];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement("span");
    el.className = "game-over-confetti";
    el.textContent = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
    el.style.left = Math.random() * 100 + "vw";
    el.style.top = -(Math.random() * 10) + "%";
    el.style.animationDuration = 2.5 + Math.random() * 3 + "s";
    el.style.animationDelay = Math.random() * 2 + "s";
    el.style.fontSize = 1 + Math.random() * 1.2 + "em";
    overlay.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // Find the winner (the super banana owner, or the last monkey standing)
  let winnerPlayer;
  if (gs.lastStandingWinner) {
    winnerPlayer = _gsPlayerMap[gs.lastStandingWinner];
  } else {
    winnerPlayer = gs.players.find((p) =>
      p.properties.some((pos) => {
        const prop = _gsPropMap[pos];
        return prop && prop.group === "superBanana";
      }),
    );
  }

  const winnerEl = document.getElementById("game-over-winner");
  if (winnerPlayer && gs.lastStandingWinner) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Monkey King! \uD83D\uDC51\uD83D\uDCA5`;
  } else if (winnerPlayer) {
    const emoji = MONKEY_EMOJI[winnerPlayer.color] || "\uD83D\uDC35";
    winnerEl.innerHTML = `${emoji} <span class="winner-name">${winnerPlayer.name}</span><br>is the Monkey God! \uD83D\uDC51\u2b50`;
  }

  // Standings sorted by money (winner always first, bankrupt players last)
  const standingsEl = document.getElementById("game-over-standings");
  const winnerId = winnerPlayer ? winnerPlayer.id : null;
  const sorted = [...gs.players].sort((a, b) => {
    if (winnerId) {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
    }
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return b.money - a.money;
  });
  const superBananaSvg = `<svg class="super-banana-icon" viewBox="0 0 64 64" width="28" height="28"><defs><linearGradient id="sbrb" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="#ff3333"/><stop offset="20%" stop-color="#ff9933"/><stop offset="40%" stop-color="#ffee33"/><stop offset="60%" stop-color="#33dd55"/><stop offset="80%" stop-color="#3399ff"/><stop offset="100%" stop-color="#cc44ff"/></linearGradient></defs><g transform="rotate(45,32,32) translate(64,0) scale(-1,1)"><path d="M36 10 C34 10 31 14 28 20 C23 30 16 40 16 48 C16 52 18 55 22 55 C25 55 27 53 27 50 C27 44 30 36 34 28 C38 20 42 14 42 11 C42 9 39 8 36 10Z" fill="url(#sbrb)" stroke="#fff" stroke-width="1.5"/><path d="M36 10 C38 6 41 3 44 2 C46 1 47 3 46 5 C45 7 42 9 39 10Z" fill="#5a3a1a" stroke="#3d2510" stroke-width="0.8" stroke-linejoin="round"/><path d="M24 38 C22 42 21 46 22 50" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round"/></g></svg>`;

  standingsEl.innerHTML = sorted
    .map((p, i) => {
      const emoji = MONKEY_EMOJI[p.color] || "\uD83D\uDC35";
      const medal =
        i === 0
          ? "\uD83E\uDD47"
          : i === 1
            ? "\uD83E\uDD48"
            : i === 2
              ? "\uD83E\uDD49"
              : "";
      const status = p.bankrupt ? " \uD83D\uDCA5" : "";
      const isWinner = winnerId && p.id === winnerId;
      const bananaIcon = isWinner ? superBananaSvg : "";
      return `<div class="standing-row">${medal} ${emoji} <span style="flex:1;margin-left:6px">${p.name}${status}</span>${bananaIcon}<span>${p.money}\uD83C\uDF4C</span></div>`;
    })
    .join("");
}

// ── Reveal Phase ───────────────────────────────────────────────────

let _revealShown = false;
let _shufflePlayed = false;

function showReveal() {
  showScreen("screen-game");
  const overlay = document.getElementById("reveal-overlay");
  if (_revealShown) return; // already rendered
  _revealShown = true;
  _shufflePlayed = false;
  overlay.style.display = "flex";
  overlay.innerHTML = "";

  const content = document.createElement("div");
  content.className = "reveal-content reveal-content--farms";

  const title = document.createElement("div");
  title.className = "reveal-title";
  title.innerHTML = "\ud83c\udf4c THE BOARD \ud83c\udf4c";
  content.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.className = "reveal-subtitle";
  subtitle.textContent = "Here's every tile in this run \u2014 shuffled fresh.";
  content.appendChild(subtitle);

  _renderRevealContent(content);

  // Your starting Spell Cards: dealt in with an animation. Display only — the
  // dealt hand is final (no pre-game re-roll).
  const runesWrap = document.createElement("div");
  runesWrap.className = "reveal-runes";
  runesWrap.innerHTML =
    '<span class="reveal-runes-corner tl"></span>' +
    '<span class="reveal-runes-corner tr"></span>' +
    '<span class="reveal-runes-corner bl"></span>' +
    '<span class="reveal-runes-corner br"></span>' +
    '<div class="reveal-runes-title">🔮 Your Spell Cards</div>' +
    '<div class="reveal-runes-list" id="reveal-runes-list"></div>';
  content.appendChild(runesWrap);

  _attachRevealCountdown(content, overlay);
  updateRevealRunes();
}

// Render the viewer's starting runes on the reveal screen (display only — runes
// can't be re-rolled). Built ONCE with a staggered deal-in; called again on each
// "revealing" game_update (a no-op after the first build, since the hand is fixed).
function updateRevealRunes() {
  const list = document.getElementById("reveal-runes-list");
  if (!list || !gs || !gs.players) return;
  const me = gs.players.find((p) => p.id === myId);
  const runes = (me && Array.isArray(me.rollCards)) ? me.rollCards : [];
  if (list.childElementCount === runes.length) return;
  // Deal the whole hand in with a stagger.
  list.innerHTML = "";
  runes.forEach((v, i) => {
    const card = document.createElement("div");
    card.className = "reveal-rune-card roll-chip roll-chip-concealed";
    card.style.animationDelay = `${i * 70}ms`;
    card.dataset.idx = String(i);
    card.dataset.val = String(v);
    card.innerHTML = `<span class="roll-chip-val">${v}</span>`;
    list.appendChild(card);
  });
}

// Build and attach the countdown footer + start the reveal timer (5s, matching
// the server's reveal auto-complete). Players just study the board + their hand.
function _attachRevealCountdown(content, overlay) {
  const acceptBar = document.createElement("div");
  acceptBar.className = "reveal-accept-bar";
  acceptBar.id = "reveal-accept-bar";

  const countdownEl = document.createElement("div");
  countdownEl.className = "reveal-countdown";
  countdownEl.id = "reveal-countdown";
  countdownEl.textContent = "Memorize the board\u2026 starting in 5";
  acceptBar.appendChild(countdownEl);

  const progressBar = document.createElement("div");
  progressBar.className = "reveal-progress-bar";
  const progressFill = document.createElement("div");
  progressFill.className = "reveal-progress-fill";
  progressBar.appendChild(progressFill);
  acceptBar.appendChild(progressBar);

  content.appendChild(acceptBar);
  overlay.appendChild(content);

  const TOTAL = 5;
  let remaining = TOTAL;
  countdownEl.textContent = `Memorize the board\u2026 starting in ${remaining}`;
  clearInterval(window._revealCountdownTimer);
  window._revealCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(window._revealCountdownTimer);
      countdownEl.textContent = "\uD83C\uDF4C Shuffling\u2026";
    } else {
      countdownEl.textContent = `Memorize the board\u2026 starting in ${remaining}`;
    }
    progressFill.style.width = `${((TOTAL - remaining) / TOTAL) * 100}%`;
  }, 1000);
}

// Reveal: 40 farms (F1\u2013F40), 6 grow tiles (G1\u2013G6), and 2 special tiles
// (Super Banana, Desert).
function _renderRevealContent(content) {
  const tilesGrid = document.createElement("div");
  tilesGrid.className = "reveal-grid reveal-grid--farms";

  const farms = [];
  const grows = [];
  const deserts = [];
  const specials = [];
  for (const tile of gs.boardLayout || []) {
    if (tile.type === "grow") {
      grows.push(tile);
    } else if (tile.group === "farm") {
      farms.push(tile);
    } else if (tile.type === "desert") {
      deserts.push(tile);
    } else if (tile.type === "special") {
      specials.push(tile);
    }
  }
  farms.sort((a, b) => (a.price || 0) - (b.price || 0));
  grows.sort((a, b) => (a.growLabel || 0) - (b.growLabel || 0));

  // Farms \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (farms.length > 0 || deserts.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const lo = deserts.length ? 0 : farms[0] ? farms[0].price : 0;
    const hi = farms.length ? farms[farms.length - 1].price : 0;
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#ffd633"></span>' +
      ' Farms \uD83C\uDF3E <span class="reveal-group-meta">' +
      farms.length + ' farms \u00B7 yields ' + lo + '\u2013' + hi + '\uD83C\uDF4C</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles";
    for (const t of farms) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile--farm";
      el.innerHTML = '<span class="reveal-tile-yield">F' + t.price + '</span>';
      row.appendChild(el);
    }
    // The desert rides along in the Farms group (a 0-yield farm) — shown as a
    // "D0" chip to match the F#/G# tile codes.
    for (const t of deserts) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile--desert";
      el.innerHTML = '<span class="reveal-tile-yield">D0</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Grow tiles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (grows.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:#2e7d32"></span>' +
      ' Grow Tiles \uD83C\uDF34 <span class="reveal-group-meta">' +
      grows.length + ' tiles \u00B7 roll the number to fire</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles";
    for (const t of grows) {
      const el = document.createElement("div");
      el.className = "reveal-tile reveal-tile--grow";
      const label = t.growLabel != null ? "G" + t.growLabel : "\uD83C\uDF34";
      el.innerHTML = '<span class="reveal-tile-yield">' + label + '</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // Special tiles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Super Banana — its own category (no longer a generic "special tiles" group).
  if (specials.length > 0) {
    const section = document.createElement("div");
    section.className = "reveal-group";
    const header = document.createElement("div");
    header.className = "reveal-group-header";
    header.innerHTML =
      '<span class="reveal-group-dot" style="background:linear-gradient(135deg,#ffd633,#d24cff)"></span>' +
      ' Super Banana \u2b50 <span class="reveal-group-meta">' +
      specials.length + (specials.length === 1 ? ' tile' : ' tiles') +
      ' \u00b7 buy it to win</span>';
    section.appendChild(header);
    const row = document.createElement("div");
    row.className = "reveal-group-tiles reveal-group-tiles--specials";
    for (const t of specials) {
      const el = document.createElement("div");
      // Super Banana (super-banana-style special).
      el.className = "reveal-tile reveal-tile--special reveal-tile--super";
      el.innerHTML =
        '<span class="reveal-tile-icon">\u2B50</span>' +
        '<span class="reveal-tile-name">Super Banana</span>';
      row.appendChild(el);
    }
    section.appendChild(row);
    tilesGrid.appendChild(section);
  }

  // (The Desert is now shown inside the Farms group above — it's a 0-yield farm.)

  content.appendChild(tilesGrid);
}

function updateRevealAcceptStatus() {
  // No-op: reveal now uses a timed countdown
}

function hideReveal() {
  const overlay = document.getElementById("reveal-overlay");
  if (overlay.style.display !== "flex") return;
  if (window._revealCountdownTimer) {
    clearInterval(window._revealCountdownTimer);
    window._revealCountdownTimer = null;
  }
  overlay.style.display = "none";
  overlay.innerHTML = "";
  _revealShown = false;
}

