# TODO

## High Priority

### Security
- [ ] **Restrict CORS origins** — `backend/server.js:50` currently has `origin: "*"`, which allows any site to make requests. Set to specific domains in production via env var.
- [ ] **Persist JWT secret** — `backend/auth.js:9-10` generates a new random secret on every server restart, invalidating all existing tokens. Require `JWT_SECRET` in environment or store persistently.
- [ ] **Disable debug socket commands in production** — `backend/server.js:202-245` exposes `debug_move`, `debug_add_bananas`, etc. with no environment check. Gate these behind a dev-only flag.
- [ ] **Validate all socket event inputs** — `backend/server.js` accepts `diceCount`, player names, bid amounts, and other data without validation. Add range/type checks on all handlers.
- [ ] **Fix XSS via innerHTML** — `frontend/game.js`, `frontend/board.js`, `frontend/auth.js` use `innerHTML` 70+ times with unsanitized player names and game data. Replace with `textContent` or proper escaping. The winner display (`game.js:322`) and player list (`game.js:719`) are the most exposed.
- [ ] **Fix avatar XSS** — `frontend/auth.js:131` escapes `displayName` but injects `avatar` raw into HTML. Escape or whitelist avatar values.

### Data & State
- [ ] **Replace JSON file storage** — `backend/auth.js` reads/writes `users.json` synchronously on every auth request. Blocking I/O will stall the event loop under any load. Move to a real database (PostgreSQL, MongoDB, SQLite at minimum).
- [ ] **Add rate limiting** — No throttle on socket events or HTTP endpoints. A single client can spam actions indefinitely. Add per-socket cooldowns and HTTP rate limiting on `/auth/*` routes.
- [ ] **Clean up abandoned games** — `backend/server.js:53`: the `games` Map is never pruned for idle/abandoned sessions. Add a TTL or cleanup job for games with no activity.

---

## Medium Priority

### Code Quality
- [ ] **Split gameLogic.js into modules** — At 4,038 lines and 133 KB, the file is unmaintainable. Break into logical modules: `property.js`, `auction.js`, `pets.js`, `poker.js`, `teams.js`, `board.js`.
- [ ] **Split game.js into modules** — The frontend `game.js` is 4,071 lines mixing socket handling, UI rendering, audio synthesis, and state management.
- [ ] **Add error feedback on socket failures** — Currently handlers silently `return` on bad input (`server.js` throughout). Emit an error event back to the client so users know why an action failed.
- [ ] **Fix race conditions in game timeouts** — `gameLogic.js` has overlapping async timeouts for `petTurnDelay`, `mushroomPending`, and `vineSwing` with no guard against simultaneous fires.
- [ ] **Add `.env` support** — Install `dotenv`, add a `.env.example` listing all required vars (`JWT_SECRET`, `PORT`, `ALLOWED_ORIGINS`, etc.), and document setup.

### Performance
- [ ] **Send game state deltas, not full snapshots** — Every `game_update` emits the entire game state (potentially 10–100 KB). Diffing or partial updates would significantly reduce bandwidth.
- [ ] **Avoid full UI re-renders on every update** — `frontend/game.js` rebuilds the entire UI on each `game_update`. Use targeted DOM updates instead of wholesale replacement.
- [ ] **Move to async file I/O** — `auth.js:45,52` uses `readFileSync`/`writeFileSync`. Replace with async equivalents even before the DB migration to stop blocking the event loop.

### Auth & Tokens
- [ ] **Move JWT tokens to HttpOnly cookies** — `frontend/auth.js:40` stores tokens in `localStorage`, making them accessible to any XSS. HttpOnly cookies are immune to JS access.
- [ ] **Broaden email validation** — `backend/auth.js:57-62` only accepts `@gmail.com` addresses. Either support all valid emails or make the domain restriction configurable.

### Missing Infrastructure
- [ ] **Add structured logging** — The backend has almost no logging. Add a logger (e.g., `pino` or `winston`) with log levels so production issues can be diagnosed.
- [ ] **Add a health check endpoint** — No `/health` or `/status` route. Required for load balancers and uptime monitors.

---

## Low Priority

### Testing
- [ ] **Add unit tests for game logic** — Zero tests exist. The highest-value targets are rent calculation, auction logic, property ownership transfers, and win conditions in `gameLogic.js`.
- [ ] **Add auth tests** — Cover registration, login, duplicate username, invalid passwords, and token expiry flows.

### Features & UX
- [ ] **Implement Community Chest / Chance cards** — Listed in README as future feature, no implementation exists.
- [ ] **Add property mortgage mechanic** — Currently players must sell to raise cash; mortgage is a standard Monopoly mechanic.
- [ ] **Add in-game rules/help panel** — Poker mini-game rules, pet ability descriptions, and bomb mode win conditions are not explained anywhere in the UI.
- [ ] **Add leaderboard UI** — Auth system tracks stats but there is no leaderboard view exposed to players.
- [ ] **Persist games across server restarts** — All game state is in-memory; a restart wipes all active games.

### Build & Developer Experience
- [ ] **Add a build step for frontend assets** — JS and CSS files are served as-is (no minification, no bundling). A simple Vite or esbuild setup would cut load times significantly.
- [ ] **Run `npm audit`** — Audit `package-lock.json` for known vulnerabilities in `bcryptjs`, `socket.io`, and `express`. Pin or update as needed.
- [ ] **Add a linter** — No ESLint or similar configured. Given the file sizes, a linter would catch many of the silent-failure patterns and inconsistencies.
- [ ] **Add architecture diagram** — The documentation describes the system in prose but has no visual diagram of data flow or component relationships.
