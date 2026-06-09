# Bananaland — Rules Reference

A guide to how the trickier systems actually work. Defaults shown are the
out-of-the-box values; most are adjustable from the lobby settings (shown as
_"default X (range A–B)"_).

## The board at a glance

The board is a 48-tile square loop:

- **40 farm tiles** — each has a yield from **1🍌 to 40🍌** (a farm labelled `F12`
  yields 12🍌 every time it grows).
- **6 grow tiles** (`G1`–`G6`) — these fire the grow chains (see below).
- **1 desert tile** (🌵) — does nothing; a "0 farm" you just pass over.
- **1 Super Banana tile** (⭐) — buy it to win the game.

Goal: **win by buying the Super Banana** (777🍌 by default). You
can also win by being the **last monkey standing** (everyone else eliminated by
bombs). In 2v2, you can win by being the **last team standing**.

---

## Auctions (property / "Banana Bid")

When a player lands on an **unowned farm**, it doesn't get bought at a fixed
price — it goes to a live auction. The player who landed is the **lander**.

**Timer:** default **15s** (range 5–60) per phase. An admin can switch the timer
off, in which case phases only resolve once everyone has responded.

### If the lander has bananas — Pitch → Respond → Silent

1. **Pitch.** The lander names a price for the farm.
   - Minimum bid **1🍌** (0 only if the lander is broke).
   - Maximum bid is capped at the **richest opponent's total** — you can't pitch
     a number nobody could ever match.
   - **Buy Now:** if the lander is _strictly_ the richest player, they can
     instantly take the farm for _(richest opponent's money + 1)_, skipping the
     rest.
2. **Respond.** Every other eligible player who can afford the pitch privately
   chooses **Accept** or **Reject**. Responses are hidden until the window closes.
   - **0 accept** → the lander buys it at the pitch price.
   - **1 accepts** → that player buys it at the pitch price.
   - **2+ accept** → go to a silent tie-breaker.
3. **Silent tie-breaker.** Each acceptor secretly adds a **top-up** on top of the
   pitch price. Highest top-up wins and pays _pitch + top-up_. **If the top is
   tied, the lander keeps the farm** at the pitch price.

### If the lander is broke — Sealed bid

Every eligible player secretly names a price in one round. Highest bid wins and
pays it. **If there is a tie for the highest bid, the lander gets the property.**

### Who's eligible / edge cases

- Only players with **more than 0🍌** (and not bankrupt) can bid.
- If **nobody** has any bananas, the lander takes the farm for free.
- **2v2:** the lander's **teammate must wait 5 seconds** before they're allowed
  to Accept, to stop instant same-team collusion.

---

## Grow logic

Farms don't earn passively — they **grow** in bursts fired from the grow tiles.

**When a grow fires (two ways):**

1. **Rolled grow (dice match).** If your dice **sum** equals a grow's label
   (`1`–`6`), that grow fires **before you move**. (Sums of 7+ match nothing.)
   The grow must already be **revealed** — a grow that's still hidden stays
   dormant and won't fire.
2. **Landing grow.** Landing **on** a grow tile fires it **after you arrive**, and
   reveals it to everyone.

**What a grow does — the grow chain / pulse.** A fired grow sweeps **clockwise**
from its tile and grows **every farm in range at once**. The sweep stops when it
hits the **next revealed grow tile** (which acts as a wall); if there isn't one,
it wraps all the way around the board.

**How much each farm grows.** Every farm in range grows by its **full yield**
(`F20` adds 20🍌). There's no cap on how many farms a single grow can hit.

**Early pickup.** If you're **standing on your own farm when it grows**, you
**pocket the bananas instantly** (fresh growth _plus_ any pile already there)
instead of leaving a pile — and a squatter can't grab them.

---

## Collect logic

Grown bananas sit on the farm as an **uncollected pile** until someone takes them.

- **Your own farm:** you collect its pile whenever you **cross over or land on**
  it during a move.
- Collection is **1:1** — every banana in the pile goes straight to your money.
  There is **no cap** on pile size; piles grow until collected or stolen.
- Bananas keep piling on a farm even while another player is squatting on it.

(Items like Vine Swing also collect the single tile you teleport to.)

---

## Steal logic

Stealing is about grabbing **someone else's** uncollected pile.

- **Landing on an opponent's farm does NOT instantly take the pile** — you become
  a **squatter** sitting on top of it.
- **Leave-steal:** when a squatter **leaves** an opponent's farm that still has a
  pile, they **steal that pile** on the way out.
- The owner can **deny the steal** by reaching the tile first — if the owner
  crosses or lands on it before the squatter leaves, they collect their own pile
  and the squatter gets nothing.
- Crossing _over_ an opponent's farm (without it being a leave) doesn't steal.

**2v2:** a teammate's farm is treated like any other player's — you **don't
auto-collect** it, you **steal** its pile the same way (on leave). The steal is
flagged **friendly** and shows a **green "Friendly Steal!"** floater instead of
the usual red one, since the bananas came off your own teammate's farm.

---

## Monkey Poker

When you **land on a tile where exactly one opponent is standing**, the two of
you are pulled into a quick heads-up poker duel for a pot. (This can be turned
off in the lobby — it's **on by default**.)

- **Doesn't fire if:** nobody (or 2+ players) is already on the tile, **either
  player has 0🍌** (a broke monkey can't challenge and can't be challenged), the
  other player is a **👻 ghost** (you skim 10% of them instead — see Leavers),
  or — in **2v2** — the other player is your **teammate**. Landing into a crowd
  of 2+ players does not start monkey poker.
- **Who's who:** the player who **landed** is the **challenger**; the player
  **already there** is the **defender**. Only the defender puts anything up
  front: **10% of their own bananas** (min 1) goes into the pot as the opening
  stake. The challenger risks **nothing** initially.

**The opening (challenger acts first):** the challenger looks at their cards and
can:

- **Call** — match the defender's 10% stake.
- **Fold** — walk away **free**; the defender simply takes their stake back.
- **Raise** — put in more than the stake (no-limit, see Betting below).

If the challenger called or raised, the defender then gets their say: **check**
(only after a plain call), **call**, **fold**, or **re-raise**. From there the
hand plays out as usual.

**Short-stacked challenger:** if the challenger can't even cover the 10% stake,
their only options are **fold** or **all-in** with everything they have. On the
all-in, the defender's stake is trimmed to **match the same amount** (the excess
is refunded) and all remaining cards are dealt out automatically — a normal
poker all-in.

**Two variants** (lobby setting):

- **Monkey Poker (default):** dead simple — each player is dealt a card over
  three rounds (3 cards each), and the **higher total wins**. Bet between rounds.
- **Texas Hold'em:** standard rules — 2 hole cards each, a 5-card community board
  (flop/turn/river), best 5-card hand wins.

Both variants use the same opening and betting rules.

**Betting (no-limit):** each round you can **Check**, **Call**, **Raise**, or
**Fold**. Raises are **static banana amounts — bet any whole number you like**,
like no-limit Texas Hold'em:

- A raise must be at least the **size of the previous bet or raise** that round
  (min 1🍌 when opening a round) — standard NL minimum-raise rule.
- Going **all-in** is always allowed, even if it's less than a legal raise.
- You can never bet more than your opponent could match (bets are capped at the
  smaller stack); if someone calls all-in for less, the excess is refunded.

Folding hands the pot to your opponent immediately. Once a player is all-in and
called, the rest is dealt out automatically.

**Payout:** the winner takes the whole pot; a **tie splits** it. After the
showdown the result shows for a few seconds (either player can dismiss it early),
then play continues. If a player disconnects mid-hand, the other takes the pot.

---

## Super Banana (the win tile)

The Super Banana is the ⭐ tile. **Default price 777🍌** (range 100–99999).

**If you can afford it when you land:** you buy it and **win immediately**. A
short win sequence plays ("Found it!" → "Bought it — Monkey God!") and the game
ends. In 2v2 the **whole team wins**.

**If you can't afford it — the hide/swap:** you don't lose the chance, you
**hide it**. You must pick any **hidden** tile (one no player has revealed, and
not the Super Banana's own tile). The Super Banana **swaps positions** with the
tile you chose:

- The ordinary tile that swapped _into_ the old spot is revealed to everyone (and
  auctioned off if it's an unowned farm).
- **Only you** see a private **rainbow cover** marking where you hid it, so you
  can remember the spot. That hint clears if you later claim it, or if every
  other tile ends up revealed (at which point the Super Banana is exposed to all).
- If you go AFK and don't pick in time, the server **auto-picks a random hidden
  tile** for you so the game never stalls.

---

## Items & the item auction

**The four items:**

| Item                         | Effect                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| 🐢 **Turtle Dice**           | Roll **1 die** this turn instead of 2                        |
| 🐇 **Rabbit Dice**           | Roll **3 dice** this turn instead of 2                       |
| 1️⃣ **Roll One** (Magic Dice) | Move exactly **1 space** (and fires Grow 1)                  |
| 🌿 **Vine Swing**            | Teleport to **any farm you own**; landing effects still fire |

- Every player **starts with one of each**. The **only** way to get more is by
  winning the item auction.
- Items are used on your turn. Dice items are consumed when you roll; you can use
  **at most one item per turn**. Vine Swing requires owning at least one farm and
  teleports you with no walking. You may **arm** a dice item to fire on your next
  turn instead (this is private to you).

**The item auction (wheel & bid).** A shared **counter** starts at **50** (range
5–500) and **every dice roll subtracts the amount rolled** (Roll One subtracts 1).
When it hits **0**, an item auction is queued and runs **after the current turn
fully ends** (the next player's turn is held until it resolves).

1. **Wheel** (~2.8s) randomly picks one of the four items. **Only the player whose
   roll zeroed the counter (the "starter") sees which item it is** — everyone
   else bids blind on "???".
2. **Bidding** mirrors property auctions: if the starter has bananas, it's
   **Pitch → Respond → Silent tie-breaker**; if the starter is broke, it's a
   **sealed bid**. Same caps and tie rules (a tie keeps the item with the
   starter; a sealed-bid tie goes to earliest seating order).
3. **Result** (~3.5s) reveals the item and winner; the winner pays and gets the
   item. The counter resets to its start value.

If only one player could possibly bid, they get the item **free**. Timer per
bidding phase: default **15s** (range 5–60).

---

## Pineapple Bomb 🍍💥

Bombs are an optional mode (can be turned off in the lobby).

- **Buying:** purchase bombs during play. Default cost **666🍌** in classic,
  **1000🍌** in 2v2 (range 0–99999). You hold them in inventory.
- **Placing:** drop a bomb on any tile (one bomb per tile max) **except a corner
  tile** — bombs can't go on the four corners. Whether you place it on your own
  turn or on someone else's, the bomb stays **hidden and inactive** and only
  **spawns at the chosen tile when your next turn ends**. It can't catch anyone
  before then.
- **Countdown:** once it spawns, an armed bomb detonates after **3 turns**, or
  **instantly when anyone lands on its tile** — whichever comes first.

**Blast radius — "corner to corner":** the explosion spreads **outward in both
directions** from the bomb tile until each side hits a **corner tile (inclusive)**.
Each direction stops at its _own_ corner.

**Who gets hit (anyone standing in the blast):**

- **Enemy** → **eliminated** (bankrupt, 0🍌). The placer **takes all their
  bananas and all their farms**.
- **The placer themselves** → **immune**, takes no damage and stays in the game
  (the bomb still kills enemies caught in it).
- **Teammate (2v2)** → **nothing happens.** Allies are unharmed by your bomb (and
  by their own) — no elimination, no banana loss.

**Defusing (no damage to anyone):**

- The **placer walking back onto their own bomb** defuses it.
- In 2v2, a **teammate landing on the placer's bomb** also defuses it.

**Winning by bomb:**

- **Classic:** if a blast leaves only **one** non-bankrupt player, that player
  wins as the **Monkey King**.
- **2v2:** if your team's bombs **eliminate both players on the opposing team**,
  **your team wins**.

---

## Leavers — the Ghost Player

When a player leaves or disconnects **during a game**, they don't vanish and
their stuff isn't redistributed — they become a **👻 ghost** that the server
plays automatically until they come back.

A ghost:

- **Keeps everything** — their farms, bananas, items, and bombs are untouched,
  and their piece stays on the board (now shown as a ghost).
- **Auto-plays each turn** — on its turn it just **rolls a plain 2d6** (never uses
  any special item) and moves. It **collects its own piles and steals** from
  others exactly like a live player.
- **Prices any tile it finds at 0** — when a ghost lands on an unowned/hidden
  farm it doesn't buy it; instead the **other players sealed-bid** for it (if only
  one other player has bananas, they get it free). The same applies to an **item
  auction** a ghost triggers.
- **Never bids in anyone else's auction** — as a non-lander it simply rejects
  every farm and item offer.
- **Can still win the Super Banana** — if a ghost lands on it with enough bananas
  it buys it and wins (rare, but possible). If it can't afford it, the Super
  Banana **auto-swaps with a random hidden tile** (a ghost can't pick a hideout).
- **Can be bombed like anyone** — bombing a ghost takes **all** of their bananas,
  farms, **and items**.

**Landing on a ghost (no poker):** if you land on a tile where a ghost is
standing, you **immediately skim 10%** of that ghost's bananas — there's no
Monkey Poker against a ghost. (In 2v2 you don't skim a ghost on your own team.)

**A ghost landing on you:** **nothing happens** — no poker, no skim. The ghost
just carries on with its own turn.

**Reconnecting:** if you come back (same device, or refresh) you reclaim your
ghost and resume as a normal player — able to use items and price farms again —
right where the game is now.

If **every** remaining player is a ghost except for one, that one live player just wins.

Leaving in the **lobby** (before the game starts) still just removes you — no
ghost — and the game can start once enough players remain.

---

## 2v2 mode — what's different

2v2 is **exactly 4 players in two teams** (A and B). Key differences vs classic:

- **Teams & turn order.** Teams are auto-formed (and you can switch sides in the
  lobby). A coin flip decides who starts, and turns **alternate across teams**:
  Team A → Team B → Team A → Team B.
- **Winning.** Two ways: **either teammate buys the Super Banana** (the whole team
  wins), **or** your team's **bombs eliminate both opposing players** (your team
  wins).
- **Send bananas to your teammate.** You can transfer bananas to your partner for
  a fee of **5% of the game's starting bananas** (min 1🍌), and you can send **at
  most half your current stash** per transfer. (With the default 2222🍌 start,
  the fee is 111🍌 — sending 100🍌 costs 211🍌 total.) Cross-team transfers
  aren't allowed.
- **You can steal from a teammate.** A teammate's farm works like anyone else's —
  you don't auto-collect it, you **steal** its pile on leave. The steal is shown
  as a **green "Friendly Steal!"** floater to mark that it came off your own
  teammate's farm.
- **Bombs don't touch teammates.** A teammate caught in your blast takes **no
  damage at all**, and a teammate can **defuse** your bomb by landing on it. Bombs
  cost more here (**1000🍌**).
- **Auctions.** Your teammate must wait **5 seconds** before they can Accept your
  pitch (anti-collusion).
- **Poker** only happens against a **non-teammate** sharing your tile.
