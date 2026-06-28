# Monkey Business 🍌

An online multiplayer board game of banana farming, cut-throat auctions, and
the occasional pineapple bomb. Built with Node.js, Express, Socket.io, and
vanilla JavaScript — no frontend frameworks.

2–4 players race around a 48-tile board buying farms at auction, firing grow
chains, stealing each other's banana piles, and hunting the **Super Banana** —
buy it and you win.

## Game modes

- **Classic** — free-for-all, 2–4 players.
- **2v2** — exactly 4 players in two teams; turns alternate across teams. Win
  by buying the Super Banana or eliminating the opposing team with bombs.

## Key mechanics

- **Auctions, not price tags.** Landing on an unowned farm starts a live
  Pitch → Respond → Silent-tie-breaker auction against the other players.
- **Grows.** Farms only earn when a grow tile fires — by dice match or by
  landing on it — sweeping clockwise and growing every farm until the next
  revealed grow tile.
- **Collects & steals.** Grown bananas pile up on the farm. Cross your own farm
  to collect; squat on an opponent's farm and steal the pile when you leave.
- **Monkey Poker.** Land on a tile occupied by exactly one opponent and you're
  pulled into a heads-up poker duel (simple 3-card or Texas Hold'em).
- **Special items.** Turtle Dice, Rabbit Dice, Roll One, and Vine Swing — won
  in blind item auctions triggered by a shared dice counter.
- **Pineapple Bombs.** Optional. Plant one, wait for the blast, take everything
  from anyone caught in it.
- **Ghosts.** Players who disconnect become auto-playing ghosts and keep all
  their stuff until they return.

The full rules live in [rules.md](rules.md).

## Quick start

```bash
cd backend
npm install
npm start
```

Open http://localhost:3000. On Windows you can run `start.bat` from the
project root instead; on Mac/Linux, `./start.sh`.

Play as a guest, or create an account (email or OAuth) — see
[Configuration](#configuration).

## Project structure

```
backend/
  server.js      Express + Socket.io server, lobby and game event handlers
  gameLogic.js   MonkeyBusinessGame class — all game rules and state
  auth.js        Accounts, JWT sessions, email verification
  oauth.js       Google / Facebook / GitHub / Discord login
  email.js       SMTP mail for verification and password reset
  test_game.js   Game-logic test suite (node test_game.js)
frontend/
  index.html       Single-page UI (lobby, board, tutorial, help)
  game-core.js     Client state, sound, screen helpers
  game-socket.js   Socket setup, routing, reveal phase
  game-lobby.js    Lobby UI + dice/grow/money animations
  game-screen.js   Game screen render, owner panel, actions
  game-poker.js    Poker UI
  game-items.js    Special items, ability targeting, item auction
  game-init.js     Init wiring, emoji reactions, board preview
  game-tutorial.js Tutorial mode
  board.js         Board rendering
  auth.js          Login / signup UI
  styles.css       All styling
rules.md         Rules reference — the source of truth for game behavior
tiles.txt        Board tile listing (initial pre-shuffle layout)
```

## Configuration

Copy `.env.example` to `backend/.env` and fill in what you need. Everything is
optional for local guest play:

- `PORT` — defaults to 3000
- `BASE_URL` — public URL, used in OAuth callbacks and emails
- `JWT_SECRET` — set this in production
- `SMTP_*` — email verification and password reset
- `GOOGLE_/FACEBOOK_/GITHUB_/DISCORD_*` — OAuth login providers

Accounts and stats are stored in a local SQLite database
(`backend/bananaland.db`).

## Deployment

It's a standard Node.js app: deploy the `backend/` server (a `Procfile` is
included for Heroku-style platforms), set the environment variables above, and
the server serves the frontend statically. WebSockets must be supported by the
host.

## Testing

```bash
cd backend
node test_game.js      # game-logic suite
node oauth.test.js     # oauth flow tests
```
