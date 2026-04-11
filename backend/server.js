require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { MonopolyGame } = require("./gameLogic");
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

// Send personalized game state to each player (for poker card privacy)
function emitGameUpdate(gameId, game) {
  const room = io.sockets.adapter.rooms.get(gameId);
  if (!room) return;
  game.lastActivity = Date.now();
  for (const sid of room) {
    io.to(sid).emit("game_update", game.getState(sid));
  }
}

io.on("connection", (socket) => {
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
    const game = new MonopolyGame(
      code,
      data.maxPlayers,
      data.startingMoney,
      data.gameMode,
      data.teamTarget,
      data.bombMode,
      data.monkeyPoker,
      data.isPublic,
    );
    games.set(code, game);
    game.onUpdate = () => emitGameUpdate(code, game);

    const player = game.addPlayer(socket.id, data.playerName);
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

    const player = game.addPlayer(socket.id, data.playerName);
    if (player && player.error) {
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

  // ── Select pet (lobby) ────────────────────────────────────────
  socket.on("select_pet", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.selectPet(socket.id, data.petType)) {
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

  // ── Use pet ability (in-game) ──────────────────────────────────
  socket.on("use_pet", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.usePetAbility(socket.id, data.targetId || null)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Cancel pet ability ────────────────────────────────────────
  socket.on("cancel_pet", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.cancelPet(socket.id)) {
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
    game.noAuctionTimer = !!data.noTimer;
    // If turning on mid-auction, clear any running timer
    if (game.noAuctionTimer && game._auctionTimer) {
      clearTimeout(game._auctionTimer);
      game._auctionTimer = null;
      if (game.auction) {
        game.auction.respondDeadline = null;
        game.auction.respondStartTime = null;
      }
    }
    emitGameUpdate(data.gameId, game);
  });

  // ── Start game ───────────────────────────────────────────────
  socket.on("start_game", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.startGame(socket.id)) {
      emitGameUpdate(data.gameId, game);
      // Auto-complete reveal after 5 seconds
      setTimeout(() => {
        if (game.state === "revealing") {
          game.completeReveal();
          emitGameUpdate(data.gameId, game);
        }
      }, 5000);
    }
  });

  // ── Vine Swing move ──────────────────────────────────────────
  socket.on("vine_swing_move", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.vineSwingMove(socket.id, data.position)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Roll dice ────────────────────────────────────────────────
  socket.on("roll_dice", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const dc = data.diceCount;
    const result = game.rollDice(
      socket.id,
      dc === 1 || dc === 3 ? dc : undefined,
    );
    if (result) {
      emitGameUpdate(data.gameId, game);
      if (game.mushroomPending) {
        setTimeout(() => {
          if (game.mushroomPending) {
            game.completeMushroomSwap();
            emitGameUpdate(data.gameId, game);
          }
        }, 7000);
      }
    }
  });

  // ── Debug: teleport to tile ──────────────────────────────────
  socket.on("debug_move", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const result = game.debugMove(socket.id, data.position);
    if (result) {
      emitGameUpdate(data.gameId, game);
      if (game.mushroomPending) {
        setTimeout(() => {
          if (game.mushroomPending) {
            game.completeMushroomSwap();
            emitGameUpdate(data.gameId, game);
          }
        }, 7000);
      }
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

  // ── Debug: reset pet cooldown ──────────────────────────────
  socket.on("debug_reset_pet", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.debugResetPetCooldown(socket.id)) {
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

  // ── Pass Bid ─────────────────────────────────────────────────
  socket.on("pass_bid", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.passBid(socket.id)) {
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

  // ── End turn ─────────────────────────────────────────────────
  socket.on("end_turn", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.endTurn(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Poker action ──────────────────────────────────────────────
  socket.on("poker_action", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.pokerAction(socket.id, data.action, data.amount)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Poker dismiss ────────────────────────────────────────────
  socket.on("poker_dismiss", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.pokerDismiss(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Trade bananas ────────────────────────────────────────────
  socket.on("trade_bananas", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.tradeBananas(socket.id, data.recipientId, data.amount)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Buy bomb ─────────────────────────────────────────────────
  socket.on("buy_bomb", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.buyBomb(socket.id)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Place bomb ───────────────────────────────────────────────
  socket.on("place_bomb", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.placeBomb(socket.id, data.position)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Sell property (list for sale) ─────────────────────────────
  socket.on("sell_property", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.sellProperty(socket.id, data.propPos, data.price)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Buy a listed sale ───────────────────────────────────────
  socket.on("buy_sale", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    const result = game.buySale(socket.id, data.saleId);
    if (result) {
      io.to(data.gameId).emit("sale_completed", {
        propPos: result.propPos,
        buyerColor: result.buyerColor,
      });
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Cancel a sale listing ───────────────────────────────────
  socket.on("cancel_sale", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.cancelSale(socket.id, data.saleId)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Swap farm ──────────────────────────────────────────────
  socket.on("swap_farm", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.swapFarm(socket.id, data.myFarmPos, data.mateFarmPos)) {
      emitGameUpdate(data.gameId, game);
    }
  });

  // ── Give farm to teammate ─────────────────────────────────
  socket.on("give_farm", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.giveFarm(socket.id, data.propPos)) {
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
      (gme.bombWinner === sid ||
        (gme.bananaLoser && gme.bananaLoser !== sid) ||
        (!gme.bombWinner &&
          !gme.bananaLoser &&
          player.properties.some((pos) => {
            const prop = gme.properties.get(pos);
            return prop && prop.group === "mushroom" && prop.owner === sid;
          })));
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

  socket.on("leave_game", (data) => {
    const game = games.get(data.gameId);
    if (game) {
      if (game.state !== "waiting") trackPlayerStats(game, socket.id);
      game.removePlayer(socket.id);
      socket.leave(data.gameId);
      if (game.players.length === 0) {
        games.delete(data.gameId);
      } else {
        emitGameUpdate(data.gameId, game);
      }
    }
    currentGameId = null;
  });

  socket.on("disconnect", () => {
    socketUserMap.delete(socket.id);
    if (!currentGameId) return;
    const game = games.get(currentGameId);
    if (game) {
      if (game.state !== "waiting") trackPlayerStats(game, socket.id);
      game.removePlayer(socket.id);
      if (game.players.length === 0) {
        games.delete(currentGameId);
      } else {
        emitGameUpdate(currentGameId, game);
      }
    }
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
      games.delete(gameId);
    }
  }
}, 30 * 60 * 1000); // run every 30 minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Monopoly server running on port ${PORT}`),
);
