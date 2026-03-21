const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { MonopolyGame } = require("./gameLogic");
const auth = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ── Auth REST API ──────────────────────────────────────────────────

app.post("/api/auth/register", (req, res) => {
  const { email, password, displayName } = req.body;
  const result = auth.register(email, password, displayName);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const result = auth.login(email, password);
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
      data.scouting,
      data.gameMode,
      data.teamTarget,
      data.petMode,
      data.simpleAuction,
      data.bombMode,
      data.monkeyPoker,
    );
    games.set(code, game);
    game.onUpdate = () => emitGameUpdate(code, game);

    const player = game.addPlayer(socket.id, data.playerName);
    if (!player)
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
    if (!player)
      return socket.emit("game_error", {
        message: "Cannot join — game full or already started.",
      });

    currentGameId = data.gameId;
    socket.join(data.gameId);
    emitGameUpdate(data.gameId, game);
  });

  // ── Select pet (lobby) ────────────────────────────────────────
  socket.on("select_pet", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.selectPet(socket.id, data.petType)) {
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

  // ── Update settings (host only, in lobby) ────────────────────
  socket.on("update_settings", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.updateSettings(socket.id, data)) {
      emitGameUpdate(data.gameId, game);
    }
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

  // ── Pick tile (scouting phase) ────────────────────────────────
  socket.on("pick_tile", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (game.pickTile(socket.id, data.position)) {
      emitGameUpdate(data.gameId, game);
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
    const result = game.rollDice(socket.id);
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

  // ── Respond to Simple Auction ────────────────────────────────
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

  // ── Trade property ───────────────────────────────────────────
  socket.on("trade_property", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    if (
      game.tradeProperty(
        socket.id,
        data.recipientId,
        data.propertyPos,
        data.theirPropertyPos,
      )
    ) {
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
    const fs = require("fs");
    const frontendDir = path.join(__dirname, "..", "frontend");
    let reloadTimer = null;
    fs.watch(frontendDir, { recursive: true }, (_, filename) => {
      if (!filename || !/\.(js|css|html)$/.test(filename)) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => io.emit("dev:reload"), 300);
    });
  } catch (_) {
    /* ignore watch errors */
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Monopoly server running on port ${PORT}`),
);
