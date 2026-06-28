# Technical Documentation

## Architecture overview

Monkey Business is a client–server game with three main components:

- **`backend/server.js`** — Express + Socket.io server. Serves the frontend
  statically, exposes REST endpoints for auth (`/api/auth/*`), and handles all
  game traffic over WebSockets. Holds the in-memory map of active games.
- **`backend/gameLogic.js`** — the `MonkeyBusinessGame` class. All rules and
  state live here: board, auctions, grows, steals, poker, items, bombs,
  ghosts, and win conditions. The server is a thin event layer over this
  class. `rules.md` is the source of truth this class implements.
- **`frontend/`** — vanilla JS single-page app. The client game flow lives in
  the `game-*.js` modules, loaded in sequence by index.html into one shared
  global scope (order matters): `game-core.js` (state/sound/screens),
  `game-socket.js` (socket + routing + reveal), `game-lobby.js` (lobby +
  animations), `game-screen.js` (game screen + actions), `game-poker.js`,
  `game-items.js` (items + item auction), `game-init.js` (init wiring),
  `game-tutorial.js`. `board.js` renders the board, `auth.js` handles login
  UI. No frameworks; state arrives as full game-state snapshots over
  Socket.io.

Supporting modules: `auth.js` (accounts, JWT, email verification, SQLite via
better-sqlite3), `oauth.js` (Google/Facebook/GitHub/Discord), `email.js`
(nodemailer SMTP).

## The board

Defined in `gameLogic.js` (`BOARD_SIZE = 48`):

- 40 farm tiles, `F1`–`F40` — yield equals the F-number (1–40🍌 per grow)
- 6 grow tiles (`G1`–`G6`)
- 1 Super Banana tile (buy it to win, default 1600🍌)
- 1 desert tile (buyable, yields nothing)

The board is shuffled at game start; tiles begin hidden and are revealed
through play. See `tiles.txt` for the initial layout and `rules.md` for how
grows, collects, and steals work.

## Game state

A game progresses through states: `waiting` (lobby) → `revealing` (pre-shuffle
board reveal) → `playing` → `finished`. Each player tracks bananas (money),
position, owned farms, special items, bombs, and ghost status.
Disconnected players become server-driven ghosts rather than leaving the game
(see rules.md, "Leavers").

## Game modes

- `classic` — free-for-all, 2–6 players (colours: brown, golden, silver, red,
  purple, pink)
- `2v2` — two teams of two, exactly 4 players; team turn order alternates
- `3v3` — two teams of three, exactly 6 players; same team rules as 2v2 (farm and
  item auctions both use the team pipeline: opponents race → teammates race →
  lander/starter keeps). `_isTeams()` covers both team modes; `_teamSize()` is 2
  or 3.

## Socket.io events (client → server)

Lobby: `auth_socket`, `create_game`, `join_game`, `get_public_lobbies`,
`change_color`, `transfer_host`, `kick_player`, `switch_team`,
`update_settings`, `toggle_no_timer`, `start_game`.

Turn flow: `roll_dice`, `pick_start_tile`,
`use_magic_dice`, `arm_ability`, `use_card`, `buy_card`,
`cancel_items`, `end_turn`, `turn_anims_complete`.

Auctions: `start_auction`, `place_bid`, `auction_buy_now`,
`respond_auction`, `submit_silent_bid`; item auctions: `pitch_item_price`,
`respond_item_auction`, `submit_item_bid`.

Poker: `poker_action`, `poker_dismiss`.

Bombs: `place_bomb` (`{ side }`) — buys + places a pineapple bomb on a board side
in one turn-gated action (no separate buy event).

The Super Banana relocates automatically (random hidden tile) — there is no
client event for it.

Misc: `chat_message`, `player_reaction`, `return_to_lobby`, `leave_game`,
plus `debug_*` events (`debug_move`, `debug_shuffle`,
`debug_add_bananas`). The debug events are only wired up when
`NODE_ENV !== "production"` (see `DEBUG_TOOLS` in server.js).

The server responds with full `game_update` snapshots plus targeted events for
animations (dice, grow pulses, auctions, poker, explosions).

## Auth & persistence

- Guest play needs no account; accounts add persistent names, avatars, stats.
- Email/password signup with verification, or OAuth (Google, Facebook,
  GitHub, Discord) — providers appear automatically when their env vars are
  set (see `.env.example`).
- JWT for sessions (`JWT_SECRET`), SQLite (`backend/bananaland.db`) for
  storage.

## Testing

- `node backend/test_game.js` — game-logic assertions (lobby flow, settings,
  modes, auctions, etc.)
- `node backend/oauth.test.js` — OAuth flow tests

## Adding features

Game rules belong in `gameLogic.js`; keep `server.js` to event plumbing and
validation. Check changes against `rules.md` — and update it if the rules
themselves change. The client re-renders from each `game_state` snapshot, so
new state usually only needs render support in the `game-*.js` modules
(most often `game-screen.js`) and `board.js`.
