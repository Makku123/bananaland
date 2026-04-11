# Monkey Business -- Game Review & Improvements

A thorough play-through audit of the entire codebase: backend game logic, server networking, auth system, and frontend client. Issues are ranked by severity.

---

## CRITICAL BUGS (game-breaking)

### 1. `gamesLost` and `auctionsWon` stats never increment

`server.js:trackPlayerStats()` calls `auth.updateStats()` but never passes `gamesLost` or `auctionsWon`. The `auth.updateStats()` function defaults these to `0`, so these database columns are always zero for every player. The profile page displays them but they are permanently stuck at 0.

**Fix:** Calculate `gamesLost` in `trackPlayerStats` (if the game is finished and the player didn't win, increment `gamesLost: 1`). Track `auctionsWon` inside `_resolveAuction()` and pass it through the stats update path.

### 2. Ghost player deadlock -- disconnected current player can stall the game

When the current player disconnects mid-turn, `removePlayer()` attempts to reset turn state. However, if the disconnect happens _during_ an auction, poker hand, mushroom swap, or pet resolution, several of those subsystems are not fully cleaned up:

- An active auction where the lander disconnects leaves `this.auction` non-null with no one to respond.
- A poker game where the current turn player disconnects can leave `this.poker` hanging.
- `mushroomPending` and `superBananaWin` timeouts (using `setTimeout`) still fire after the player is removed, operating on stale references.

**Fix:** In `removePlayer()`, fully tear down auctions (auto-resolve to next bidder or cancel), poker (auto-fold the disconnected player), and clear all pending timeouts. Consider storing timeout IDs so they can be cleared.

### 3. `costLabel` variable declared but never used (3 occurrences)

In `usePetAbility()`, the variable `costLabel` is computed at lines ~797, ~819, ~840 but never referenced. This is dead code, but more importantly, it means the game log never shows the player how many pet uses they have left or what the cooldown is. Players get no feedback on pet ability cost.

**Fix:** Either use `costLabel` in the `_log()` call or remove the dead code and add proper feedback.

### 4. No timer-based bomb detonation check on pet moves

`_checkBombDetonation()` and `_explodeExpiredBombs()` are called in `rollDice()` and `debugMove()`, but NOT after pet-triggered moves (`_executeOwnEnergyPetOnTurn`, `_executeOwnDevilPetOnTurn`, `_executeMagicPetOnTurn`). A pet that moves a player onto a bomb tile will not detonate it.

**Fix:** Call `_checkBombDetonation(player)` after each pet-triggered position change.

---

## HIGH SEVERITY (significantly impacts gameplay or security)

### 5. AudioContext leak -- creates ~17 new AudioContexts per session [FIXED]

Most sound functions (`playTickSound`, `playChatNotif`, `playTurnChime`, `playDiceRoll`, `playAuctionLoss`, `playTaxSound`, `playBananaWhoosh`, `playVineSwing`) each create `new AudioContext()` on every call. Browsers limit the number of concurrent AudioContexts (Chrome: 6 per tab). After a few dice rolls and events, new sounds silently fail.

The `_sharedAudioCtx` pattern already exists and is used by `playMoveTickSound()` -- the other functions just don't use it.

**Fix:** Reuse `_getAudioCtx()` (the shared AudioContext) for all sound functions, same as `playMoveTickSound` does. All 14 sound functions in `frontend/game.js` (the 8 above plus `playShuffleSound`, `playAuctionTimerStart`, `playAuctionTimerTick`, `playAuctionTimerEnd`, `playPokerAnnounce`, `playPokerWin`, `playCardDraw`) now share a single AudioContext via `_getAudioCtx()`. The unused `_shuffleAudioCtx` cache variable was removed.

### 6. CORS is wide open (`origin: "*"`) in production

Both Express (`app.use(cors())`) and Socket.io (`cors: { origin: "*" }`) accept requests from any origin. This allows any website to make authenticated API calls and establish WebSocket connections to your server.

**Fix:** Set CORS origin to `process.env.BASE_URL` or a whitelist of allowed domains.

### 7. No rate limiting on auth endpoints

`/api/auth/login` has no rate limiting, allowing brute-force password attacks. `/api/auth/register` has no rate limiting, allowing mass account creation. `/api/auth/forgot-password` has no rate limiting, enabling email bombing.

**Fix:** Add `express-rate-limit` middleware to all auth endpoints.

### 8. No chat rate limiting

The `chat_message` socket event has a 200-character cap per message but no frequency limit. A client can emit thousands of messages per second, flooding all players in the room.

**Fix:** Track last message time per socket and reject messages sent faster than 1 per 500ms.

### 9.

### 10. `toggle_no_timer` can be toggled by ANY player, not just the host

The `toggle_no_timer` socket event has no admin/host check:

```js
socket.on("toggle_no_timer", (data) => {
    const game = games.get(data.gameId);
    if (!game) return;
    game.noAuctionTimer = !!data.noTimer;
```

Any player can disable the auction timer mid-game to grief other players during auctions.

**Fix:** Add `if (game.admin !== socket.id) return;` or restrict to host only.

---

## MEDIUM SEVERITY (noticeable gameplay/UX issues)

### 11. Vine Swing is useless if you own no farms

When a player lands on Vine Swing with no properties, the log says "owns no farms to swing to!" but the player's turn effectively does nothing interesting. The tile is wasted.

**Consider:** Allow Vine Swing to any revealed tile, or give an alternate bonus (e.g., free 500 bananas) when the player has no farms.

### 12. Board data duplicated between frontend and backend

`SPACE_DATA` in `frontend/board.js` and `PROPERTIES`/`BOARD` in `backend/gameLogic.js` define the same tiles independently with **different names** (e.g., backend has "CV1" while frontend has "Mediterranean"). The frontend `SPACE_DATA` prices also differ from the backend (`SPACE_DATA` shows 50/100/200/360/500 while backend has 40/80/160/320/480). The backend is authoritative, so `SPACE_DATA` is misleading and could cause confusion.

**Fix:** Remove `SPACE_DATA` from the frontend and rely entirely on `boardLayout` sent from the server.

### 13. Bomb placement on any tile with no owner check

`placeBomb()` allows placing bombs on any valid tile index, including tiles owned by the placing player, corner tiles, or the Super Banana tile. A player could bomb their own high-value farm.

**Consider:** Prevent placing bombs on corners or on tiles the player owns.

### 14. No validation that `data.gameId` matches `currentGameId`

Most socket events use `data.gameId` from the client to look up the game. A malicious client could send actions to a game they're not in by guessing game codes. While the game checks if the player exists in the game for most actions, several events like `toggle_no_timer` don't verify player membership at all.

**Fix:** Validate `data.gameId === currentGameId` at the start of each handler, or use `currentGameId` directly instead of trusting the client.

### 15. Mushroom swap timeout fires even if game ended

The `setTimeout` for `completeMushroomSwap()` in the `roll_dice` handler (7 seconds) fires regardless of whether the game has ended in the meantime. If the game finishes during that 7-second window (e.g., bomb elimination), the swap will execute on a finished game.

**Fix:** Check `game.state !== "finished"` at the start of `completeMushroomSwap()` (partially done, but the board swap still executes).

### 16. `_processLandingPassive` doesn't handle squatter stealing on GROW

The passive landing handler (used for pet pushes) always adds to `bananaPile` without checking for squatters on those tiles, unlike the full `_processLanding` GROW handler which does check. This means pet pushes onto GROW tiles always grow piles even if opponents are sitting on the farms.

**Fix:** Add squatter logic to `_processLandingPassive` matching the main handler.

### 17. Poker blind amounts are hardcoded and can bankrupt players unfairly

BB=200 and SB=100 are fixed constants. In a game with `startingMoney: 100`, a single poker match takes the entire starting balance. The `Math.min()` caps help, but a player with 50 bananas posting a 50-banana blind is effectively all-in from the start.

**Consider:** Scale blinds relative to `startingMoney` (e.g., 5% and 10%), or skip poker when either player has fewer than 300 bananas.

### 18. `reveal` phase has no timeout fallback

If a player AFK's during the reveal phase, `completeReveal()` is called by a 5-second `setTimeout` in `start_game`. But if that timeout fires and the state has already changed (e.g., player disconnected causing game end), it could complete the reveal on an invalid state.

**Fix:** The 5-second timeout already checks `game.state === "revealing"` which is correct, but consider adding a manual "Skip" button for the host.

### 19. Sell listing price has no minimum relative to property value

A player can list a 480-banana Goldfinger property for 1 banana. While this could be intentional (gift to a friend), in competitive games it's an exploit.

**Consider:** Enforce a minimum sale price (e.g., 50% of base price) or add a confirmation dialog on the frontend.

---

## LOW SEVERITY (polish, minor UX, code quality)

### 20. `_log()` messages silently dropped after 30 entries

The game log caps at 30 entries. In long games with lots of events, early-game actions disappear. Players have no way to scroll back.

**Fix:** Increase the cap, or let the frontend request older log entries.

### 21. Desert tiles are owned but do nothing

Desert tiles have `group: "desert"`, `price: 0`, `rent: [0,0,0,0,0,0]` and can be won in auctions. They take up a property slot for the player, clog up property lists, and grow 0 bananas on GROW. They exist as board filler but confuse players who win them.

**Consider:** Either skip auctions on desert tiles entirely, or give them a small benefit to make them worth owning (e.g., a tiny grow value, or blocking opponents from landing).

### 22. Monkey Poker raise is always exactly `currentBet + 100`

In `pokerAction`, Monkey Poker raises are forced to `poker.currentBet + 100` regardless of what the player requests. This removes any strategic depth from the raise action -- it's effectively "raise by 100" or "don't raise."

**Consider:** Allow custom raise amounts in Monkey Poker too, or at minimum document this limitation to players.

### 23. Team assignment is based on join order, not player choice

Teams are always `[player0, player1]` vs `[player2, player3]`. If 4 friends join and want specific team pairings, they have to leave and rejoin in the right order. No UI exists to swap teams.

**Fix:** Add team-picking in the lobby, or at least a "swap teams" button.

### 24. No feedback when pet ability fails

If a player tries to use their pet and it's on cooldown, or it's their turn (energy/strong/magic require off-turn use), `usePetAbility()` silently returns `false`. The frontend gets no error message.

**Fix:** Return an error reason object instead of just `false`, and emit a `game_error` to the player.

### 25. `bombSelfDamage` loses half of all money regardless of context

When a player steps on their own bomb, they lose exactly 50% of their entire balance. There's no cap, so a player with 50,000 bananas loses 25,000. Combined with the 5,000 purchase cost, this makes self-bombs extremely punishing.

**Consider:** Cap self-damage at the bomb purchase price (5,000) or a fixed percentage of purchase price.

### 26. `passBid()` always returns false

The `passBid` method unconditionally returns `false` with a comment "No passing in the new auction system." Yet the server still has a `pass_bid` socket handler that calls it. Dead code that should be removed.

**Fix:** Remove the `pass_bid` socket handler and the `passBid` method.

### 27. Frontend `SPACE_DATA` contains Monopoly-themed names

Names like "Mediterranean", "Baltic Ave", "Park Place", "Boardwalk", "B&O Ave" are from Monopoly and could present trademark issues. The backend uses short codes (CV1, BJ3, etc.) which are fine, but the frontend still shows these classic names in some contexts.

**Fix:** Replace with banana-themed names consistent with the game's identity.

### 28. No input validation on `create-bananas` slider value

The frontend slider goes 100-4000 and sends the value directly to the server. A malicious client could send `startingMoney: 999999` via the socket. The server does clamp to `[100, 99999]`, but the upper bound is 99999, far beyond the UI's 4000 max. This could imbalance games.

**Consider:** Tighten the server-side upper bound to match the intended range, or document 99999 as intentional.

### 29. `trackPlayerStats` win detection is unreliable

The win detection logic in `server.js:trackPlayerStats` checks three conditions but misses the Super Banana purchase case when the player bought it during `_processLanding` (the `mushroom` property check only works if the game ended before the player disconnected). Also, `gamesLost` is never set (see bug #1).

**Fix:** Store the winner ID directly on the game object when the game ends, and use that in `trackPlayerStats`.

### 30. Karma stat tracked in database but never awarded

The `karma` column exists in the users table and is displayed on the profile, but no code path ever calls `updateStats` with a non-zero `karma` value. It's always 0 for every player.

**Fix:** Either implement karma events (good sportsmanship, finishing games, etc.) or remove the field from the UI to avoid confusion.

---

## FRONTEND-SPECIFIC ISSUES

### 31. No mobile responsiveness for the game board

The 14x14 grid board uses percentage-based positioning that breaks on narrow viewports. On phones, tiles overlap and become unreadable. Chat and action panels overlap the board.

### 32. No keyboard shortcuts

Players must click buttons for every action. No `Space` to roll, `Enter` to end turn, `Escape` to close popups. This slows down gameplay significantly.

### 33. Dice count buttons (1 die / 3 dice for 500 bananas) have no tooltip

The 1/3 dice option costs 500 bananas but this isn't clearly communicated in the UI. Players might accidentally spend bananas.

### 34. No confirmation before buying a bomb (5,000 bananas)

Clicking "Buy Bomb" immediately deducts 5,000 bananas with no "Are you sure?" prompt. This is a massive purchase that could be accidental.

### 35. Chat panel has no message history persistence

When switching screens or reconnecting, all chat messages are lost. There's no server-side chat storage.

### 36. Auction keypad for the lander has no visual max indicator

The lander can type any price but has no clear indication of what the maximum allowed bid is (capped at richest opponent's money). The bid silently fails if too high.

### 37. Sell property modal has no suggested price

When listing a property for sale, there's no hint about what a fair price would be. A "suggested price" based on base value + banana pile would help new players.

---

## ARCHITECTURE & CODE QUALITY

### 38. `gameLogic.js` is ~4100 lines in a single file

This file handles board setup, player management, dice rolling, movement, auctions, poker, pets, bombs, trading, selling, teams, and state serialization. It should be split into focused modules.

### 39. `game.js` (frontend) is massive with global state

All game state, UI rendering, socket handling, and sound effects live in global scope in a single file. This makes debugging difficult and risks naming collisions.

### 40. Magic numbers everywhere

Bomb cost (5000), bomb timer (6 turns), poker blinds (200/100), trade fee (150), swap fee (100), give fee (300), Super Banana price (7777), free bananas amount (500), etc. are all hardcoded inline. Changing any requires searching the entire codebase.

### 41. No test coverage

`test_game.js` exists but there's no test runner configured in `package.json`. `oauth.test.js` exists but it's unclear if it runs. Critical game logic (auction resolution, bomb detonation, poker showdown, chain multiplier calculation) has zero automated tests.

### 42. No TypeScript or JSDoc type annotations

Game state objects are complex nested structures passed between server and client with no type documentation. It's easy to introduce bugs when properties are added or renamed.

---

## SUMMARY BY PRIORITY

| Priority     | Count | Key Items                                                                           |
| ------------ | ----- | ----------------------------------------------------------------------------------- |
| Critical     | 4     | Stats never update, ghost player deadlock, bombs ignore pet moves, dead code        |
| High         | 6     | AudioContext leak, open CORS, no rate limiting, Gmail restriction, no-timer exploit |
| Medium       | 9     | Vine Swing UX, data duplication, bomb placement, poker balance, sell pricing        |
| Low          | 12    | Log cap, desert confusion, team assignment, karma, keyboard shortcuts               |
| Architecture | 5     | File splitting, global state, magic numbers, no tests, no types                     |
