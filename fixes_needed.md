# Fixes Needed — Gameplay & UI Audit

A fresh pass over the current code. Issues that are **already documented** in `IMPROVEMENTS.md` and still present in the code are marked `[confirmed still broken]`. New findings not in that doc are marked `[new]`. Items are grouped by category and ranked by impact.

---

## CRITICAL — active cheating vectors / game-breaking

### C1. Debug socket handlers are exposed to every client  `[new]`
`backend/server.js:416-458` wires `debug_move`, `debug_shuffle`, `debug_reset_pet`, and `debug_add_bananas` with **zero authentication**. The frontend (`frontend/index.html:1980-1988`, `frontend/game.js:3237-3253`) also hands every player a visible `🛠️ Debug Tools` button that calls them. Any player can:
- Teleport to any tile (including Super Banana) via `debugMove`
- Give themselves unlimited bananas (`debugAddBananas`)
- Reset pet cooldowns at will
- Reshuffle the board to erase other players' revealed tiles

**Fix:** Either (a) gate the debug panel and the four socket handlers behind `process.env.NODE_ENV !== "production"`, or (b) check `socket.id === game.admin` server-side and hide the toggle button unless the player is the host.

### C2. `gamesLost` / `auctionsWon` / `karma` stats never increment  `[confirmed still broken]`
`server.js:632-655 trackPlayerStats()` still passes only `gamesPlayed`, `gamesWon`, `bananasEarned`, `highestBananas`, `farmsOwned`. The profile UI shows `gamesLost`, `auctionsWon`, and `karma` columns but they are permanently stuck at 0 for every user.

**Fix:** Calculate `gamesLost` in the same function (`isWinner === false && gme.state === "finished"`). Hook `auctionsWon` into `_resolveAuction()` so the winning socket's stat gets bumped. Either implement karma events or remove the column from the UI.

### C3. `toggle_no_timer` has no host check — any player can grief auctions  `[confirmed still broken]`
`server.js:352-366` still lets *any* socket flip `game.noAuctionTimer`, including mid-auction. A malicious player can disable the countdown every time another player is winning to drag games out indefinitely.

**Fix:** Add `if (game.admin !== socket.id) return;` and validate `data.gameId === currentGameId`.

### C4. Ghost-player deadlock paths still incomplete  `[confirmed still broken]`
`removePlayer()` at `gameLogic.js:1240-1342` handles auctions, poker, and magic pets, but the `setTimeout` bodies scheduled from `server.js:roll_dice` (7s mushroom swap) and `server.js:start_game` (5s reveal) do not clear when the player who triggered them disconnects. The timeouts fire on stale references and will either no-op awkwardly or mutate a `finished` game.

**Fix:** Store the timeout IDs on the game object (`game._mushroomSwapTimer`, `game._revealCompleteTimer`) and `clearTimeout` them in `removePlayer()`. Also short-circuit at the top of each timeout callback if `game.state === "finished"`.

---

## HIGH — gameplay correctness & security

### H1. All socket handlers trust client-supplied `gameId`  `[confirmed still broken]`
Every handler in `server.js` (`place_bid`, `roll_dice`, `buy_bomb`, `chat_message`, etc.) looks up `games.get(data.gameId)` instead of the server-tracked `currentGameId`. A malicious client can send actions against any game code they can guess, and several handlers (`toggle_no_timer`, chat) don't even verify membership.

**Fix:** At the top of each handler, replace `data.gameId` with `currentGameId`, and reject calls where `data.gameId !== currentGameId`.

### H2. `passBid` / `pass_bid` is dead code with no gameplay effect  `[confirmed still broken]`
`gameLogic.js:2637-2640` returns `false` unconditionally. The comment even says "No passing in the new auction system." Yet `server.js:479-485` still wires a `pass_bid` socket handler that calls it. If the frontend ever emits `pass_bid`, nothing happens silently.

**Fix:** Delete `passBid()`, the `pass_bid` handler, and any frontend emitters. The test at `test_game.js:278` also needs updating.

### H3. CORS is still wide open (`origin: "*"`)  `[confirmed still broken]`
`server.js:13 app.use(cors())` and `server.js:184 cors: { origin: "*" }`. Any third-party site can establish WebSocket connections and make authenticated API calls against the server.

**Fix:** Set CORS origin to a whitelist (`process.env.BASE_URL`) in production.

### H4. No rate limiting on chat  `[confirmed still broken]`
`server.js:601-615 chat_message` only caps length to 200 chars. A scripted client can emit thousands of messages per second and flood all players in the room. Same applies to `/api/auth/login`, `/api/auth/register`, and `/api/auth/forgot-password`, which have no `express-rate-limit` middleware.

**Fix:** Track per-socket last-message timestamps (e.g., 500ms minimum interval) and add `express-rate-limit` to auth endpoints.

### H5. `_processLandingPassive` GROW handler still ignores squatters  `[confirmed still broken]`
At `gameLogic.js:2103-2154`, pet-pushed GROW landings skip the squatter-stealing logic that the main `_processLanding` applies. Pet pushes onto GROW tiles always add to `bananaPile` even when an opponent is camping the farm.

**Fix:** Port the squatter check (from `_processLanding`'s GROW branch) into `_processLandingPassive`.

---

## MEDIUM — gameplay balance & visible UX issues

### M1. `pet-used-notification` and the new `turn-notification` now crowd the top-center  `[new]`
After our recent edit, `turn-notification` sits at `top: 35%` (`styles.css:3188`). `pet-used-notification` sits at `top: 18%` (`styles.css:3508`). `bomb-self-notification` stays at `top: 50%`. On fast turns where a player uses a pet and gets an immediate "Your Turn" burst, the two labels stack awkwardly because they both live in the upper half of the board.

**Fix:** Either align both to the same y-coordinate and stagger fade-out timing, or move `pet-used-notification` to `top: 22%` and bump `turn-notification` to `top: 32%` so the gap is visually even.

### M2. Notification z-index tier is inconsistent  `[new]`
`styles.css` places `pet-used-notification` at `z-index: 99`, `#reveal-overlay` at `100`, `auction-won-notification` at `101`, `mushroom-notification` at `102`, `pet-coin-notification` at `103`, `auction-tied-notification` at `104`, and `turn-notification` at a wildly out-of-band `10002`. The reveal overlay (`100`) will paint **over** the pet-used notification (`99`), which is probably not intended.

**Fix:** Pick a single "notification tier" range (e.g. 200-210) and renumber them with clear priority.

### M3. Chat window can't be dragged on touch devices  `[new]`
`game.js:5254-5278` wires `mousedown`/`mousemove`/`mouseup` only. The same applies to `logHeader` (`5302`), `debugWinHeader` (`5354`), `helpHeader` (`5412`), and `phoneToggle` (`5472, 5552`). On touchscreens the drag silently does nothing and the panel is stuck wherever it opened.

**Fix:** Add matching `touchstart`/`touchmove`/`touchend` handlers, or use Pointer Events (`pointerdown`/`pointermove`/`pointerup`) for a single code path.

### M4. Chat "unread" dot resets only on toggle click  `[new]`
`game.js:5201-5214` removes `has-unread` when the toggle button is clicked. But when the chat is already open and the user clicks *inside* the chat, the unread indicator logic isn't re-evaluated. If the chat is open when a new message arrives, the dot may still flash. Worth verifying the incoming-message handler also skips `has-unread` when `!chatEl.classList.contains("board-chat-hidden")`.

### M5. Vine Swing on an empty portfolio still wastes the turn  `[confirmed still broken]`
Landing on Vine Swing with zero owned farms logs "owns no farms to swing to!" and the turn is effectively a no-op. This is tracked in IMPROVEMENTS.md #11 but never addressed.

**Fix:** Either (a) grant a 500-banana consolation payout when the lander has no farms, or (b) let Vine Swing move to any revealed non-owned tile.

### M6. Mushroom swap fires on finished games  `[confirmed still broken]`
`server.js:404-411` schedules `completeMushroomSwap()` after 7 seconds. If a bomb detonates during that window and the game reaches `state === "finished"`, the swap still executes and mutates the finished game's board state.

**Fix:** Gate the callback body on `game.state !== "finished"` at entry, and also `clearTimeout` it in `removePlayer()` / `game over` paths.

### M7. Bomb placement allows self-bombing own high-value farms  `[confirmed still broken]`
`gameLogic.js placeBomb()` accepts any tile index. Players can intentionally bomb their own Goldfinger farm to trap opponents, losing half their money in exchange. This is documented in IMPROVEMENTS.md #13 and #25 and both remain unfixed.

**Fix:** Either reject `placeBomb()` on tiles the placer owns, or cap self-damage at a fixed amount (e.g., the 5,000 bomb purchase price).

### M8. Poker blinds (BB=200 / SB=100) bankrupt low-stakes games  `[confirmed still broken]`
IMPROVEMENTS.md #17. With `startingMoney: 100`, a single poker hand can drain a player's entire stack before they can act.

**Fix:** Scale blinds to `Math.round(startingMoney * 0.05)` / `0.10`, or skip Monkey Poker when the smaller stack is below a threshold.

### M9. Sell listings have no minimum price floor  `[confirmed still broken]`
A player can list a 480-banana farm for 1 banana and a teammate can buy it, circumventing any team-trade fees. Documented in IMPROVEMENTS.md #19.

**Fix:** Enforce `price >= Math.floor(baseprice * 0.5)` server-side in `sellProperty()`.

### M10. `startingMoney` server clamp (99999) is 25× the UI max (4000)  `[confirmed still broken]`
A crafted socket payload can create games with `startingMoney: 99999`. IMPROVEMENTS.md #28.

**Fix:** Tighten the server clamp in `create_game` to `Math.min(4000, Math.max(100, data.startingMoney))`.

---

## LOW — polish, dead code, and minor UX

### L1. `board-chat` drag state can escape the board  `[new]`
`game.js:5254-5278` sets `chatEl.style.left/top` in absolute pixels without clamping to the parent's bounds. A user can drag the chat so its header is off-screen, at which point there's no way to recover except refreshing.

**Fix:** Clamp the drag values to `[0, parentRect.width - chatRect.width]` and same for y.

### L2. Debug panel "Teleport" accepts 0..51 but board is 52 tiles (0..51), fine — except it's not disabled when `!isMyTurn`  `[new]`
`frontend/index.html:2020` `disabled` attribute is static. The server rejects the call via `debugMove()`'s `cur.id !== socketId` check, but the button visually looks enabled.

**Fix:** Toggle `disabled` based on `isMyTurn && !gs.diceRolled` the same way `btn-roll` is handled.

### L3. Toast system auto-dismiss can double-remove  `[new]`
`frontend/toast.js:20-22`: when the 6th toast pushes off `container.firstChild`, the removed element's `setTimeout` is NOT cleared, so it still fires `dismissToast` which then tries `toast.classList.add(...)` on an element no longer in the DOM. Not a crash but it's sloppy.

**Fix:** Before `removeChild`, read the child and `clearTimeout(child._timeout)`.

### L4. `board-chat` stacking below notifications assumes no ancestor stacking context  `[new]`
After our z-index drop to `1`, chat is only behind other siblings within `board-wrap`. If any ancestor above `board-wrap` ever gets a `transform` or `filter`, the stacking context would trap chat. This isn't broken today, just fragile — worth documenting or moving chat out of `board-wrap` entirely.

### L5. Window-level cached keys leak between games  `[new]`
`game.js:2180 window._lastPetNotifKey`, `window._lastNotifTurn`, `window._turnNotifTimer`, `window._petNotifTimer`, `window._buyBombKeyHandler`, `window._bidAutoFilled`, etc. are never reset when the player leaves and rejoins a lobby. If a player finishes a game and starts a new one in the same tab, the first turn of game 2 can be suppressed because `_lastNotifTurn` still holds game 1's value.

**Fix:** Add a `resetClientGameState()` that clears all `window._*` caches and call it from `leaveGame()` / on `game_update` when `gs.state === "waiting"`.

### L6. Desert tiles still clog auction lists  `[confirmed still broken]`
IMPROVEMENTS.md #21. Desert tiles with `price: 0, rent: [0,0,0,0,0,0]` can be "won" in auctions and take up a property slot with no upside. Players are confused.

**Fix:** Skip auctions on desert tiles entirely, or give them a symbolic 25-banana passive per landing.

### L7. Team assignment still fixed by join order  `[confirmed still broken]`
IMPROVEMENTS.md #23. No swap-teams UI in the lobby. Friends who want custom team pairings have to leave and rejoin.

**Fix:** Add a "swap teams" button visible to the host, or let each player click their own team badge to move.

### L8. `BIGTODOS.md` still lists unshipped items
The file lists ghost-player chost, karma system, auto vine causing steal animation, early pickup text animation size, and teammate farm visibility. These are tracked but none appear to have been started in the current diff.

---

## Suggested triage order

1. **C1 debug cheat vectors** — critical; close the exploit first (ship today).
2. **C3 `toggle_no_timer` host check** — one-line fix, major griefing surface.
3. **C2 stats tracking** — users see broken counts on their profiles.
4. **H1 gameId validation** — cross-game attacks.
5. **H4 chat rate limiting** — trivial to add, meaningful protection.
6. **M1 / M2** — clean up the notification positioning I just touched.
7. Everything else as scheduled work.
