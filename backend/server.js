require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { MonkeyBusinessGame } = require("./gameLogic");
const auth = require("./auth");
const oauth = require("./oauth");
const email = require("./email");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ── Auth REST API ──────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { email: regEmail, password, displayName } = req.body;
  const result = auth.register(regEmail, password, displayName);
  if (result.error) return res.status(400).json(result);

  // Send verification email
  try {
    await email.sendVerificationEmail(result.email, result.verifyToken);
  } catch (err) {
    console.error("[email] Failed to send verification email:", err.message);
  }

  res.json({ needsVerification: true, message: "Account created! Check your email to verify your account." });
});

app.post("/api/auth/login", async (req, res) => {
  const { email: loginEmail, password } = req.body;
  const result = auth.login(loginEmail, password);
  if (result.unverified) {
    // Resend verification email
    try {
      await email.sendVerificationEmail(result.email, result.verifyToken);
    } catch (err) {
      console.error("[email] Failed to resend verification email:", err.message);
    }
    return res.status(403).json({ error: result.error, unverified: true });
  }
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.get("/api/auth/profile", (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const result = auth.getProfile(token);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.put("/api/auth/profile", (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const result = auth.updateProfile(token, req.body);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get("/api/auth/avatars", (_req, res) => {
  res.json({ avatars: auth.DEFAULT_AVATARS });
});

// ── Email verification ──────────────────────────────────────────

app.get("/api/auth/verify-email", (req, res) => {
  const result = auth.verifyEmail(req.query.token);
  if (result.error) {
    return res.redirect(`/?verify_error=${encodeURIComponent(result.error)}`);
  }
  res.redirect(`/?verified=1&token=${result.token}`);
});

// ── Password reset ──────────────────────────────────────────────

app.post("/api/auth/forgot-password", async (req, res) => {
  const result = auth.requestPasswordReset(req.body.email);
  if (result.error) return res.status(400).json(result);

  if (result.resetToken) {
    try {
      await email.sendPasswordResetEmail(result.email, result.resetToken);
    } catch (err) {
      console.error("[email] Failed to send reset email:", err.message);
    }
  }

  // Always return success to prevent email enumeration
  res.json({ message: "If an account exists with that email, a reset link has been sent." });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, password } = req.body;
  const result = auth.resetPassword(token, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// ── OAuth REST API ────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

app.get("/api/auth/providers", (_req, res) => {
  res.json({
    providers: oauth.getEnabledProviders(),
    googleClientId: oauth.getConfig("google")?.clientId || null,
    facebookAppId: oauth.getConfig("facebook")?.clientId || null,
  });
});

// Google (frontend SDK sends idToken)
app.post("/api/auth/oauth/google", async (req, res) => {
  try {
    const profile = await oauth.verifyGoogleToken(req.body.idToken);
    const result = auth.oauthLoginOrRegister("google", profile);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message || "Google auth failed." });
  }
});

// Facebook (frontend SDK sends accessToken)
app.post("/api/auth/oauth/facebook", async (req, res) => {
  try {
    const profile = await oauth.verifyFacebookToken(req.body.accessToken);
    const result = auth.oauthLoginOrRegister("facebook", profile);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message || "Facebook auth failed." });
  }
});

// GitHub (server-side redirect flow)
app.get("/api/auth/oauth/github", (_req, res) => {
  const cfg = oauth.getConfig("github");
  if (!cfg || !cfg.clientId) return res.status(404).json({ error: "GitHub OAuth not configured." });
  const redirectUri = `${BASE_URL}/api/auth/oauth/github/callback`;
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`,
  );
});

app.get("/api/auth/oauth/github/callback", async (req, res) => {
  try {
    const profile = await oauth.exchangeGitHubCode(req.query.code);
    const result = auth.oauthLoginOrRegister("github", profile);
    if (result.error) return res.redirect(`/?auth_error=${encodeURIComponent(result.error)}`);
    res.redirect(`/?token=${result.token}`);
  } catch (err) {
    res.redirect(`/?auth_error=${encodeURIComponent(err.message || "GitHub auth failed.")}`);
  }
});

// Discord (server-side redirect flow)
app.get("/api/auth/oauth/discord", (_req, res) => {
  const cfg = oauth.getConfig("discord");
  if (!cfg || !cfg.clientId) return res.status(404).json({ error: "Discord OAuth not configured." });
  const redirectUri = `${BASE_URL}/api/auth/oauth/discord/callback`;
  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify+email&response_type=code`,
  );
});

app.get("/api/auth/oauth/discord/callback", async (req, res) => {
  try {
    const redirectUri = `${BASE_URL}/api/auth/oauth/discord/callback`;
    const profile = await oauth.exchangeDiscordCode(req.query.code, redirectUri);
    const result = auth.oauthLoginOrRegister("discord", profile);
    if (result.error) return res.redirect(`/?auth_error=${encodeURIComponent(result.error)}`);
    res.redirect(`/?token=${result.token}`);
  } catch (err) {
    res.redirect(`/?auth_error=${encodeURIComponent(err.message || "Discord auth failed.")}`);
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const games = new Map();

// Map socket.id → userId for authenticated players
const socketUserMap = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Send personalized game state to each player (per-viewer redaction: fog of
// war + the liar's-dice cup — a hidden roll is visible only to its roller)
function emitGameUpdate(gameId, game) {
  const room = io.sockets.adapter.rooms.get(gameId);
  if (!room) return;
  game.lastActivity = Date.now();
  for (const sid of room) {
    io.to(sid).emit("game_update", game.getState(sid));
  }
}

// Debug socket events are only wired up outside production.
const DEBUG_TOOLS = process.env.NODE_ENV !== "production";

io.on("connection", (socket) => {
  socket.emit("server_info", { debugTools: DEBUG_TOOLS });
  let currentGameId = null;

  // ── Authenticate socket (optional — guests skip this) ────────
  socket.on("auth_socket", (data) => {
    if (data && data.token) {
      const user = auth.getUserByToken(data.token);
      if (user) {
        socketUserMap.set(socket.id, user.id);
        socket.emit("auth_ok", { userId: user.id });
      }
    }
  });

  // ── Create game (creates + joins creator as admin) ───────────
  socket.on("create_game", (data) => {
    const code = generateCode();
    const game = new MonkeyBusinessGame(
      code,
      data.maxPlayers,
      data.startingMoney,
      data.gameMode,
      undefined, // bombMode removed (bombs no longer exist)
      data.monkeyPoker,
      data.isPublic,
    );
    games.set(code, game);
    game.onUpdate = () => emitGameUpdate(code, game);

    // Lobby-adjustable knobs that aren't part of the constructor signature.
    // Stamp them onto the fresh game so they survive the first emit and any
    // _initProperties run before the admin opens the lobby settings panel.
    if (data.superBananaPrice != null) {
      game.superBananaPrice = Math.min(
        Math.max(Math.floor(data.superBananaPrice) || 10000, 100),
        99999,
      );
    }
    if (data.farmAuctionTimer != null) {
      game.farmAuctionTimer = Math.min(
        Math.max(Math.floor(data.farmAuctionTimer) || 15, 5),
        60,
      );
    }
    // Dodecahedron is ON by default; absent (older clients) keeps it on.
    game.dodecahedron = data.dodecahedron !== false;
    // Credit Score starting stack — a lobby knob like startingMoney (default 7,
    // clamped 1..20). Every player's credit is (re)seeded from it at game start.
    if (data.creditStart != null) {
      game.creditStart = Math.min(
        Math.max(Math.floor(data.creditStart) || 7, 1),
        20,
      );
      for (const p of game.players) p.credit = game.creditStart;
    }

    const player = game.addPlayer(socket.id, data.playerName, data.clientId);
    if (!player || player.error)
      return socket.emit("game_error", { message: "Failed to create game." });

    currentGameId = code;
    socket.join(code);
    emitGameUpdate(code, game);
  });

  // ── Join game ────────────────────────────────────────────────
  socket.on("join_game", (data) => {
    const game = games.get(data.gameId);
    if (!game) return socket.emit("game_error", { message: "Game not found." });

    const player = game.addPlayer(socket.id, data.playerName, data.clientId);
    if (player && player.error) {
      // Game already in progress: this may be a reconnect — if their device id
      // matches a ghost, hand them back control of it instead of erroring.
      if (player.error === "already_started" && data.clientId) {
        const rejoined = game.reconnectByClientId(socket.id, data.clientId);
        if (rejoined) {
          currentGameId = data.gameId;
          socket.join(data.gameId);
          emitGameUpdate(data.gameId, game);
          return;
        }
      }
      const msg = player.error === "full"
        ? "This game is full. Please try joining another game or create your own!"
        : "This game has already started. Please try joining another game or create your own!";
      return socket.emit("game_error", { message: msg });
    }

    currentGameId = data.gameId;
    socket.join(data.gameId);
    emitGameUpdate(data.gameId, game);
  });

  // ── List public lobbies ─────────────────────────────────────────
  socket.on("get_public_lobbies", () => {
    const lobbies = [];
    for (const [code, game] of games) {
      if (game.isPublic && game.state === "waiting" && game.players.length < game.maxPlayers) {
        lobbies.push({
          gameId: code,
          hostName: game.players.length > 0 ? game.players[0].name : "???",
          playerCount: game.players.length,
          maxPlayers: game.maxPlayers,
          gameMode: game.gameMode,
          startingMoney: game.startingMoney,
        });
      }
    }
    socket.emit("public_lobbies", lobbies);
  });

  // ── Change color (lobby) ──────────────────────────────────────
  socket.on("change_color", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.changeColor(socket.id, data.color)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Transfer host (lobby) ────────────────────────────────────────
  socket.on("transfer_host", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.transferHost(socket.id, data.targetId)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Kick player (lobby) ────────────────────────────────────────
  socket.on("kick_player", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const target = game.players.find((p) => p.id === data.targetId);
    if (!target) return;
    const targetName = target.name;
    if (game.kickPlayer(socket.id, data.targetId)) {
      // Notify the kicked player before removing them from the room
      io.to(data.targetId).emit("kicked", { message: `You were removed from the lobby by the host.` });
      const targetSocket = io.sockets.sockets.get(data.targetId);
      if (targetSocket) targetSocket.leave(data.gameId);
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── 2v2 lobby team switch ─────────────────────────────────────
  socket.on("switch_team", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.switchTeam(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Update settings (host only, in lobby) ────────────────────
  socket.on("update_settings", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.updateSettings(socket.id, data)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Toggle no-auction-timer (any player, any time) ──────────
  socket.on("toggle_no_timer", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const wasOn = !!game.noAuctionTimer;
    game.noAuctionTimer = !!data.noTimer;
    if (game.noAuctionTimer && !wasOn) {
      // Turning OFF the timer mid-auction: cancel the pending timer and
      // null out whichever deadline the current phase is using so the
      // frontend stops showing a countdown.
      if (game._auctionTimer) {
        clearTimeout(game._auctionTimer);
        game._auctionTimer = null;
      }
      if (game.auction) {
        game.auction.respondDeadline = null;
        game.auction.respondStartTime = null;
        game.auction.silentDeadline = null;
        game.auction.silentStartTime = null;
        game.auction.stepDeadline = null;
        game.auction.stepStartTime = null;
      }
    } else if (!game.noAuctionTimer && wasOn && game.auction) {
      // Turning the timer back ON mid-auction: re-schedule the timer for
      // the current phase. Without this, a silent tie-breaker can hang
      // forever after a toggle-off / toggle-on, because the deadline that
      // got cleared above is never restored.
      const a = game.auction;
      if (a.teamFlow) {
        // 2v2 sequential phases re-arm their own step timer (correct passive
        // action + the configured farm timer).
        game._2v2RearmStepTimer();
      } else if (a.phase === "respond") {
        a.respondDeadline = Date.now() + 15000;
        a.respondStartTime = Date.now();
        game._auctionTimer = setTimeout(() => {
          game._auctionTimer = null;
          if (!game.auction || game.auction.phase !== "respond") return;
          game._log(`⏰ Time's up!`);
          game._closeRespondPhase();
          if (game.onUpdate) game.onUpdate();
        }, 15000);
      } else if (a.phase === "silentbid") {
        a.silentDeadline = Date.now() + 15000;
        a.silentStartTime = Date.now();
        game._auctionTimer = setTimeout(() => {
          game._auctionTimer = null;
          if (!game.auction || game.auction.phase !== "silentbid") return;
          game._resolveSilentBid();
          if (game.onUpdate) game.onUpdate();
        }, 15000);
      }
    }
    emitGameUpdate(data.gameId, game);
  });

  // ── Reveal All Tiles (DEBUG builds only) ─────────────────────
  // A per-viewer fog bypass: when on, getState sends THIS player the unredacted
  // board (incl. the hidden Super Banana). Gated by DEBUG_TOOLS so it can never be
  // enabled in production — the frontend also hides the toggle there. Re-send just
  // this socket's state so the (un)redacted board arrives immediately.
  socket.on("set_reveal_all", (data) => {
    if (!DEBUG_TOOLS) return;
    const game = games.get(data && data.gameId);
    if (!game) return;
    const p = game.players.find((pl) => pl.id === socket.id);
    if (!p) return;
    p.revealAllView = !!(data && data.on);
    io.to(socket.id).emit("game_update", game.getState(socket.id));
  });

  // ── Start game ───────────────────────────────────────────────
  socket.on("start_game", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.startGame(socket.id)) {
      emitGameUpdate(data.gameId, game);
      // Auto-complete the reveal after a fixed 5s window (players inspect the
      // board tiles before the shuffle).
      setTimeout(() => {
        if (game.state === "revealing") {
          game.completeReveal();
          emitGameUpdate(data.gameId, game);
        }
      }, 5000);
    }
  });

  // ── Pick starting tile (first turn only) ─────────────────────
  socket.on("pick_start_tile", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.pickStartTile(socket.id, data.position)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Random starting tile (the player presses "Random") ───────
  // Server picks a random tile that no other on-board player occupies, so the
  // 2nd/3rd/4th picks never land on someone.
  socket.on("pick_start_tile_random", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.pickStartTileRandom(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Roll dice (always 2d6; a hexed player rolls the d12) ─────
  // Cup tier: the result is HIDDEN from opponents (per-viewer getState
  // redaction) and the roller must follow up with submit_claim.
  socket.on("roll_dice", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.rollDice(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Submit the roller's CLAIM (liar's dice) ──────────────────
  // {gameId, steps}: steps = 1..12, or null to walk the TRUE roll (works in
  // every tier, always free). The token walks the claim immediately; the
  // accuse window opens after the move (cup tier only).
  socket.on("submit_claim", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.submitClaim(socket.id, data && data.steps != null ? data.steps : null)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Accuse vote: an opponent calls the roller's claim a lie (or not) ──
  // {gameId, accuse:bool}. Only players holding >=1 credit may accuse; voting
  // "no" is always free. Resolution: truthful → each accuser -1 credit; lie →
  // each accuser +1 and the roller -1 per accuser.
  socket.on("submit_accuse", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.submitAccuse(socket.id, !!(data && data.accuse))) {
      emitGameUpdate(data.gameId, game);
    }
  });

  if (DEBUG_TOOLS) {
    // ── Debug: teleport to tile ──────────────────────────────────
    socket.on("debug_move", (data) => {
      const game = games.get(data.gameId);
      if (!game) return;
      const result = game.debugMove(socket.id, data.position);
      if (result) {
        emitGameUpdate(data.gameId, game);
      }
    });

    // ── Debug: reshuffle board ─────────────────────────────────
    socket.on("debug_shuffle", (data) => {
      const game = games.get(data.gameId);
      if (!game) return;
      if (game.debugShuffle()) {
        emitGameUpdate(data.gameId, game);
      }
    });

    // ── Debug: add bananas ─────────────────────────────────────────
    socket.on("debug_add_bananas", (data) => {
      const game = games.get(data.gameId);
      if (!game) return;
      if (game.debugAddBananas(socket.id)) {
        emitGameUpdate(data.gameId, game);
      }
    });
  }

  // ── Start Auction ─────────────────────────────────────────────
  socket.on("start_auction", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.startAuction(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Place Bid ────────────────────────────────────────────────
  socket.on("place_bid", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.placeBid(socket.id, data.amount)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Buy Now (richest lander skips the auction) ───────────────
  socket.on("auction_buy_now", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.auctionBuyNow(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });


  // ── Respond to Auction (accept/reject) ──────────────────────
  socket.on("respond_auction", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.respondAuction(socket.id, data.accept)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Submit silent top-up bid (property auction tie-breaker) ──
  socket.on("submit_silent_bid", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.submitSilentBid(socket.id, data.amount)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Animations-complete signal from the lander ────────────────
  // Emitted by the active player's client once every visible animation for
  // the turn has settled (walk, dice spin, pre-walk grow chain pulse, post-
  // walk grow chain pulse, landing FX). The server ends the turn the moment
  // this arrives — there is no End Turn button and no auto-end countdown.
  socket.on("turn_anims_complete", (data) => {
    if (!data) return;
    const game = games.get(data.gameId);
    if (!game) return;
    const turn = typeof data.turn === "number" ? data.turn : null;
    if (game.notifyAnimsComplete(socket.id, turn)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Chat message ─────────────────────────────────────────────
  socket.on("chat_message", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    const text = String(data.message || "")
      .trim()
      .slice(0, 200);
    if (!text) return;
    io.to(data.gameId).emit("chat_message", {
      name: player.name,
      color: player.color,
      message: text,
    });
  });

  // ── Emoji reactions ──────────────────────────────────────────
  socket.on("player_reaction", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    const allowed = ["\uD83D\uDC4D", "\uD83C\uDF4C", "\uD83D\uDE24", "\uD83C\uDF89"];
    if (!allowed.includes(data.emoji)) return;
    io.to(data.gameId).emit("player_reaction", {
      playerId: socket.id,
      emoji: data.emoji,
    });
  });

  // ── Leave / disconnect ───────────────────────────────────────
  function trackPlayerStats(gme, sid) {
    const userId = socketUserMap.get(sid);
    if (!userId || !gme) return;
    const player = gme.players.find((p) => p.id === sid);
    if (!player) return;
    const ownedFarms = (player.properties || []).length;
    const isWinner =
      gme.state === "finished" &&
      (gme.lastStandingWinner === sid ||
        (!gme.lastStandingWinner && gme.superBananaWinnerId === sid));
    auth.updateStats(userId, {
      gamesPlayed: 1,
      gamesWon: isWinner ? 1 : 0,
      bananasEarned: Math.max(0, player.money || 0),
      highestBananas: player.money || 0,
      farmsOwned: ownedFarms,
    });
  }

  socket.on("return_to_lobby", (data) => {
    const game = games.get(data.gameId);
    if (game && game.playerReadyForLobby(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // A mid-game departure (leave or disconnect) turns the player into a GHOST —
  // the server keeps their monkey and auto-plays until they reconnect. Only a
  // lobby (pre-game) departure removes them outright.
  function departGame(game, sid, gameId) {
    if (!game) return;
    if (game.state === "playing" || game.state === "revealing") {
      // Record stats once per player per game (a flaky connection can ghost +
      // reconnect repeatedly — don't double-count).
      const p = game.players.find((pl) => pl.id === sid);
      if (p && !p._statsRecorded) {
        trackPlayerStats(game, sid);
        p._statsRecorded = true;
      }
      game.makeGhost(sid);
      emitGameUpdate(gameId, game);
      return;
    }
    if (game.state !== "waiting") trackPlayerStats(game, sid);
    game.removePlayer(sid);
    if (game.players.length === 0) {
      if (typeof game.cleanup === "function") game.cleanup();
      games.delete(gameId);
    } else {
      emitGameUpdate(gameId, game);
    }
  }

  socket.on("leave_game", (data) => {
    const game = games.get(data.gameId);
    departGame(game, socket.id, data.gameId);
    if (game) socket.leave(data.gameId);
    currentGameId = null;
  });

  socket.on("disconnect", () => {
    socketUserMap.delete(socket.id);
    if (!currentGameId) return;
    departGame(games.get(currentGameId), socket.id, currentGameId);
  });
});

// ── Dev auto-reload ──────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  try {
    const chokidar = require("chokidar");
    const frontendDir = path.join(__dirname, "..", "frontend");
    let reloadTimer = null;
    chokidar
      .watch(frontendDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        ignoreInitial: true,
      })
      .on("change", (filePath) => {
        if (!/\.(js|css|html)$/.test(filePath)) return;
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => io.emit("dev:reload"), 300);
      });
  } catch (_) {
    /* ignore watch errors */
  }
}

// ── Stale game cleanup ────────────────────────────────────────────
// Remove games that have been idle for over 2 hours (finished games
// where players stayed connected, or abandoned in-progress games).
const GAME_IDLE_TTL = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
  const cutoff = Date.now() - GAME_IDLE_TTL;
  for (const [gameId, game] of games) {
    const idle = !game.lastActivity || game.lastActivity < cutoff;
    if (idle) {
      console.log(`[cleanup] Removing stale game ${gameId} (${game.players.length} players, state=${game.state})`);
      if (typeof game.cleanup === "function") game.cleanup();
      games.delete(gameId);
    }
  }
}, 30 * 60 * 1000); // run every 30 minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Monkey Business server running on port ${PORT}`),
);
