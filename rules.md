# Bananaland — Rules Reference

A guide to how the trickier systems actually work. Defaults shown are the
out-of-the-box values; most are adjustable from the lobby settings (shown as
_"default X (range A–B)"_).

## The board at a glance

The board is a 48-tile square loop:

- **40 farm tiles** — each has a yield from **1🍌 to 40🍌** (a farm labelled `F12`
  yields 12🍌 every time it grows).
- **6 grow tiles** (`G1`–`G6`) — these fire the grow chains (see below).
- **1 desert tile** (🌵) — a buyable **"0 farm"**: landing on it unowned starts
  a normal auction like any farm, but it **grows nothing** (yield 0) and never
  earns its owner a banana.
- **1 Super Banana tile** (⭐) — claim it to win the game.

Goal: **win by claiming the Super Banana** — be the first to **afford and buy it**
for its price (10000🍌 by default). In team mode, either teammate buying it wins
for the whole team. (If everyone else leaves the game, the **last monkey
standing** wins by default.)

**Modes & players:** **Classic** is free-for-all, **2–6 monkeys** (six player
colours: brown, golden, silver, red, purple, pink). **Team mode** is two teams —
**2v2** (4 players) or **3v3** (6 players); turns alternate between the teams and
either teammate buying the Super Banana wins for the whole team.

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

_(The Pitch→Respond→Silent and Sealed-bid flows above are how **free-for-all**
games run. **Team mode** (2v2 and 3v3) uses the team auction below instead.)_

### Team mode (2v2 & 3v3) — team auction

In team mode a farm auction is a short sequential negotiation. The lander
(**A1**) and their teammate(s) face the opposing team (2 each in 2v2, 3 each in
3v3):

1. **Pitch.** A1 names a price **P** (same 1🍌 minimum, richest-other cap). Only
   players who can **afford P** take part.
   - **"Highest opponent score +1"** (the team form of Buy Now): if A1 can
     out-bid every opponent, A1 can one-click pitch exactly _(richest
     **opponent's** money + 1)_ — teammates' banks are never counted. It prices
     all opponents out, so the call falls to A1's teammate(s).
2. **Opponents race.** Any opponent may **Accept** — the **first to accept** buys
   at P and the auction is **over immediately**. Opponents who can't afford P are
   out.
3. **Teammates race.** If **all** opponents reject (or time out), A1's
   teammate(s) race: the **first teammate to Accept** buys at P (in 3v3 the two
   teammates race each other). If **all** teammates reject (or can't afford P),
   **A1 buys at P**.

**Privacy.** During the races you only ever see your **own** and your
**teammates'** accept/reject — never the other team's.

**Broke lander:** A1 can't price it, so the farm goes up **free**: the first
opponent to accept gets it, and if no opponent accepts by the timer it goes to
the **closest opponent turn-wise** (the one up next after A1) automatically — the
teammates get no say here. The usual shortcuts still apply first — if only one
player has bananas they get it free; if nobody does, A1 keeps it.

### Who's eligible / edge cases

- Only players with **more than 0🍌** (and not bankrupt) can bid.
- **Ghosts are not part of auctions** — they never bid, and they're ignored when
  computing the pitch cap and the Buy Now price ("richest opponent" means
  richest **non-ghost** opponent).
- If **nobody** has any bananas, the lander takes the farm for free; if exactly
  **one** player has bananas, they get it free.
- **Team-mode farm auctions** use the team auction above.

---

## Dice & movement

Each turn you either **roll** (2d6 — or a single **d6** if you've been **hexed**)
or **play a spell card**. Your **roll number** is the dice sum, the hex d6 face,
or the card's value.

**The Hex.** The **first** player to **land on the still-unrevealed Super Banana**
is **hexed** ("You have been hexed!") — their **2d6 becomes a single d6**. The hex
then **passes by landing collision**: if the hexed player lands on someone, or
someone lands on the hexed player, the curse moves to the other player. (It can be
toggled off in the lobby.)

**Low-roll inversion.** Whenever your roll number is **below 7**, you walk
**`7 − roll`** tiles instead of the roll. A 6 moves **1**, a 2 moves **5**, a
card `1` moves **6**. A roll of **7 or more** (only possible from a 2d6 sum) walks
its full value. This applies to **every** move — 2d6, the hex d6, and spell
cards alike — and is **separate from grows**: a low roll inverts whether or
not it fires a grow. (A hex d6 is always `1`–`6`, so it **always inverts** — a
brutal curse that caps your move at 6 tiles.)

Because cards are always `1`–`6`, **every card always inverts** — which is why a
spell card shows **two numbers**: a **green** one (the grow it would trigger, only
if that grow is revealed) and a **purple** one (`7 − value`, the steps it walks).

## Grow logic

Farms don't earn passively — they **grow** in bursts fired from the grow tiles.

**When a grow fires (two ways):**

1. **Rolled grow (number match).** If your **roll number** this turn (your
   **dice sum**, or the value of a **spell card** you play) is `1`–`6` and equals
   a **revealed** grow's label, that grow fires **before you move**. With 2 dice
   the sum is `2`–`12`, so sums of 7+ match nothing; a card of `1`–`6` always
   matches its label (a `1` die is the only way to fire Grow 1, since two dice
   can never sum to 1). A grow that's still **hidden** stays dormant and won't
   fire. (The grow matches on the **roll number**, but you then walk the inverted
   **`7 − roll`** distance — see _Dice & movement_ above.)
2. **Landing grow.** Landing **on** a grow tile fires it **after you arrive**, and
   reveals it to everyone.

**What a grow does — the grow chain / pulse.** A fired grow sweeps **clockwise**
from its tile and grows **every revealed farm in range owned by the player who
fired it**, all at once. Opponents' farms, unowned farms, and unrevealed farms
in range grow **nothing**. The sweep stops when it hits the **next revealed
grow tile** (which acts as a wall); if there isn't one, it wraps all the way
around the board.

**How much each farm grows.** Every farm that grows adds its **full yield**
(`F20` adds 20🍌). There's no cap on how many farms a single grow can hit.

**Early pickup.** If you're **standing on your own farm when it grows**, you
**pocket the bananas instantly** (fresh growth _plus_ any pile already there)
instead of leaving a pile — and a squatter can't grab them.

---

## Collect logic

Grown bananas sit on the farm as an **uncollected pile**. A pile is made of
**stacks** — each grow adds one stack equal to the farm's yield (an `F12` that has
grown 3 times holds a pile of 36 = three stacks of 12).

- **Your own farm:** you collect the **whole pile** (every stack) whenever you
  **cross over or land on** it during a move.
- Collection is **1:1** — every banana goes straight to your money. There is **no
  cap** on pile size; piles grow until collected or stolen.
- Bananas keep piling on a farm even while another player is squatting on it.

---

## Steal logic

Stealing is about grabbing **someone else's** uncollected bananas. You grab them by
**landing on** their farm — not by crossing it.

- **LANDING on an opponent's farm STEALS its whole pile** immediately, the instant
  you arrive — and a **"Stolen"** floater pops on the tile. (The backend transfer is
  silent; the floater is client-side.)
- **CROSSING an opponent's farm collects NOTHING** — you have to STOP (land) on it.
- **Growth after you land stays with the OWNER.** Bananas that grow on the farm
  while you sit there are not yours — you took what was there when you landed, and
  **leaving steals nothing more**. The owner reclaims that growth by crossing/landing
  on their own farm; if they're standing on it when it grows, they pocket it (early
  pickup).

**2v2:** a teammate's farm works like any other player's — landing on it steals its
pile too (shown as a green **"Stolen"**).

---

## Rune Duel

Rune Duels are an **optional lobby toggle, OFF by default** — the host turns them
on in the create-game page or the lobby. (When they're off, none of the below
happens: landing on a lone opponent does nothing special, and landing on a ghost
does **not** swipe a card.)

When enabled: when you **land on a tile where exactly one opponent is standing**
(via a **normal dice roll**), the two of you are pulled into a **Rune Duel** over
one of the defender's Spell Cards.

- **Doesn't fire if:** nobody (or 2+ players) is already on the tile, the
  defender holds **no cards left**, the other player is a **👻 ghost** (you swipe
  one of their cards instead — see Leavers), or — in **2v2** — the other player is
  your **teammate**. Landing into a crowd of 2+ players — **teammates included** —
  does not start a duel. A **card-roll** (playing a Spell Card to move) never
  starts a duel — only a normal roll does.
- **Who's who:** the player who **landed** is the **challenger**; the player
  **already there** is the **defender**.

**How it works:**

1. The defender's hand gives up one **random** card, set aside for discard.
   **Only the defender** can see what number it is.
2. A second, **face-down** card is dealt fresh (1–6). **Neither player** sees its
   number — it's the mystery prize.
3. The **defender names a price** (in bananas) for that mystery card.
4. The **challenger** then **accepts** or **rejects**:
   - **Accept:** the challenger **pays the price** (those bananas are **burned**,
     out of the game), **gains the face-down card**, and the defender's set-aside
     card is **discarded** for good.
   - **Reject:** the defender simply **gets their set-aside card back**, the
     challenger pays nothing, and the mystery card is **not** handed over.

**Keep my card (Buy Now):** the defender can price the card at **the challenger's
whole bank + 1** — an amount the challenger can never afford — which instantly
ends the duel with the defender **keeping their card**. (Any price above what the
challenger can pay works the same way: a forced reject.)

**The duel replaces the tile:** landing into a duel skips the tile's own effects
for that landing — an unowned farm is **not** auctioned and the Super Banana is
**not** bought, even if the lander could afford it. (A grow tile still fires;
growth happens before the duel.) The result shows briefly (either player can
dismiss it), then play continues. If a player disconnects mid-duel, the duel is
**called off** and the defender keeps their card.

---

## Super Banana (the win tile)

The Super Banana is the ⭐ tile and **buying it is how you win the game**.
**Default price 10000🍌** (range 100–99999).

It starts **hidden** (fog of war, like every tile) and **never hides, relocates,
or auto-reveals** — the only way it's revealed is by someone **landing** on it
(even when it's the last hidden tile, it stays hidden until a monkey lands).
Once revealed it stays put on that tile for the rest of the game. **Crossing
never reveals it — only landing does.**

What happens depends on whether you **LAND on it** or **CROSS over it**, and
whether you can **afford the price**:

- **Land + can afford it:** you **buy it and win** — a short sequence plays
  ("Found it!" → "Monkey God!") and the game ends (in team mode the **whole team
  wins**). Same in free-for-all and team modes.
- **Land + can't afford it (non-ghost):** you don't win, but you grab a **one-time
  consolation +200 bananas** — the same +200 you'd get for crossing it. Take it
  once (by landing or crossing) and you won't get it again the other way. The
  Super Banana also deals you **two hidden 0/1 cards** (each a coin flip). Their **sum** — 0, 1, or
  2 (odds 1/4, 1/2, 1/4) — is how many random Spell Cards the **winner of an
  auction** will draw. The mystery draw goes up for auction using the normal
  farm-auction rules, except **only you can see your two cards** (everyone else
  bids blind) until it resolves — and **you take part and can win it yourself**.
  The winner pays their bid (**burned**) and immediately draws that many random
  cards (1–6 each) straight into their hand. Even a **sum of 0** can be sold (they
  pay for nothing — bluff it!). The two cards are **revealed to everyone** when the
  auction resolves. The tile is revealed but never bought. Either way you then
  **warp back to your closest owned farm behind the Super Banana** (scooping its
  pile) — the same warp a rich crosser gets.
- **Cross — but only once the Super Banana is already REVEALED** (a prior landing
  exposed it). Crossing a **still-hidden** Super Banana does **nothing at all**
  (rich or broke), and never reveals it — you can't react to a tile you haven't
  found. Once it's revealed:
  - **Cross + can afford it:** you open the **mystery card auction** (you pitch a
    price and an opponent wins the hidden 0–2 draw, like a can't-afford landing)
    **and** you **warp back to your closest owned farm behind the Super Banana**,
    scooping its pile. (If the tile you stopped on already started an auction, the
    card auction is skipped — the warp still happens.)
  - **Cross + can't afford it:** a consolation **+200 bananas** — but **only once**.
    If you already grabbed the +200 by landing on (or previously crossing) the
    Super Banana, walking across it again pays nothing.

A **ghost** (disconnected player) never buys/wins the Super Banana and **gets no
Spell Card** — landing on it just reveals the tile and falls through to
the Rune Duel; crossing does nothing.

Landing on the Super Banana resolves **before** the Rune Duel: it's revealed (and
a win is settled if you can afford it; otherwise a non-ghost lander is granted a
random concealed Spell Card); either way, if exactly one opponent is also on the tile,
the duel still fires afterwards.

This applies to **both** free-for-all and team modes.

The Super Banana **tile itself is unchanged** — it stays put, stays unowned,
never relocates or auto-reveals, and you still must **land on and afford** it to
win the game.

---

## Spell Cards 🔮

Instead of rolling the dice, you can spend a **spell card** for a **deterministic
move** — you pick which card, and (since cards are `1`–`6`) you always walk
**`7 − value`** tiles. It's certainty on demand: no luck, you choose the move.

Every spell card is **concealed** — your own hand is **face-up to you**,
but opponents only ever see **how many** dice you're holding, never the numbers.
Playing a die briefly shows its number that turn (as the dice result), then it's
consumed.

The details:

- **Your starting hand.** Every player begins with **7 spell cards**. Each
  card is an **independent random number 1–6** (duplicates are common). A fresh
  hand of 7 is dealt at the start of every game (and on any reset / new game).
- **Pre-game reveal.** During the pre-game reveal (a short countdown before play
  starts) you see your 7 starting cards — each dealt in with a draw animation —
  while the board is shuffled. **The hand you're dealt is final** (there is no
  re-roll); when the countdown ends the game begins with it.
- **Playing a die (your move for the turn).** On your turn, **before you've
  rolled**, click one of your dice. That die is **removed from your hand** and
  you move **exactly that many tiles** — it counts as your roll for the turn:
  - The matching **Grow fires first** (playing a `4` fires Grow 4 before you move,
    exactly like rolling a dice-sum of 4 would), then you move that many tiles,
    **collecting your own piles** and **stealing from opponents' farms** along the
    path just like a normal move, and the landing tile resolves as usual (auction / Rune Duel /
    Super Banana / etc.). (A card-move never triggers a Rune Duel — only a normal
    roll does.)
  - **One die per turn.** Playing a die is your roll — once you've played one or
    rolled the dice, you can't do either again that turn. The **Cancel Magic
    Die** interception applies.
- **Arming (queue a roll for next turn).** The Spell Cards box is **always
  accessible** — even during or after your turn. Whenever you can't play right now
  (off-turn, or after you've already rolled), tapping a die **arms** it: a private
  queued selection. An armed die **auto-activates at the start of your next turn**
  — it plays itself after a short window — **unless you disarm it first** (tap it
  again, or pick a different die). So you can line up next turn's move the moment
  you finish this one.
- **Earning more cards.** You earn extra cards by **winning the Super Banana
  mystery auction** (the buyer draws the hidden 0–2 cards — see the Super Banana
  section) and from a **successful Cancel Spell Card** (see below).
  - Each earned card is **drawn at random (1–6) and added straight to your hand** —
    there's no keep/reroll modal. The numbers stay concealed (yours alone).
  - **Timing:** all card draws apply **immediately**. There is no shared counter —
    cards are personal.

There are **no other items** — no dice tiers, no *playable* teleports (the only
warp is the automatic Super Banana one above). A turn is simply:
play a die for a guaranteed move (or let an armed one auto-play), **or** roll the
2 dice and take your chances.

---

## Cancel Spell Card 🚫

A prediction ability that lets you **spoil an opponent's spell card** before
they play it.

- **Unlimited — but you need 3+ cards.** There's **no charge**: you may cancel as
  often as you like. The **only requirement** is that you currently **hold at least
  3 Spell Cards** to initiate one (casting doesn't spend any). Hold fewer than 3
  and the button is disabled.
- **Casting.** Click the **Cancel Spell Card** button, then pick **one**
  player from the list. In **free-for-all** you may target **any** other player;
  in **team mode** any **opponent** (never your own teammate). The cast is
  **secret** — the target and everyone else are not told. You can't target a
  **👻 ghost** (a ghost only ever rolls a plain 2d6 and never plays a Spell Card, so a
  cancel could never land). One cancel per target at a time.
- **It applies to the target's _next_ turn** (not the turn in progress).
- **Resolution — right after the target acts** (the outcome is yours, and it pops
  for you **immediately**):
  - **HIT** — if they **play a spell card** that turn, your prediction lands: the
    card is **wasted** (removed from their hand, its number ignored) and they
    instead **roll a normal 2d6**. **You instantly draw a random spell card** — your
    reward for the read. Announced to everyone.
  - **MISS** — if they instead **roll the dice normally** (play no Spell Card),
    **YOU immediately lose TWO random cards** from your hand.

The only difference between the modes is the target rule: free-for-all = any
player; team mode = opponents only (no teammates).

---

## Leavers — the Ghost Player

When a player leaves or disconnects **during a game**, they don't vanish and
their stuff isn't redistributed — they become a **👻 ghost** that the server
plays automatically until they come back.

A ghost:

- **Keeps everything** — their farms, bananas, and spell cards are
  untouched, and their piece stays on the board (now shown as a ghost).
- **Auto-plays each turn** — on its turn it just **rolls a plain 2d6** (never
  plays a spell card) and moves. It **collects its own piles and
  steals** from others exactly like a live player.
- **Prices any tile it finds at 0** — when a ghost lands on an unowned/hidden
  farm it doesn't buy it; instead the **other players sealed-bid** for it (if only
  one other player has bananas, they get it free). A **tie** for the highest bid
  leaves the tile with the **ghost, free** — the usual lander-wins-tie rule.
- **Never bids in anyone else's auction** — as a non-lander it simply rejects
  every farm offer.
- **Never wins the Super Banana** — a ghost is auto-played, so it can never be
  handed the game, and a can't-afford landing **grants it no die** either.
  Landing on the Super Banana just reveals the tile for it (it never buys/wins,
  even if it could afford the price).
**Landing on a ghost (no duel):** if Rune Duels are **enabled** and you land on a
tile where a ghost is standing, you **immediately swipe one of that ghost's Magic
Cards** (a random one) — there's no Rune Duel against a ghost. (With Rune Duels
off, landing on a ghost does nothing.) (In 2v2 you don't swipe a ghost on
your own team, and a ghost with no cards left gives you nothing.) The swipe only
replaces the duel — **the tile itself still resolves as normal**: an unowned farm
under the ghost still goes to auction, and the Super Banana can still be bought
right past the squatting ghost.

**A ghost landing on you:** **nothing happens** — no duel, no swipe. The ghost
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
- **Winning.** **Either teammate buys the Super Banana** and the whole team wins.
  (Remember: you must **land** on the Super Banana to buy it — crossing it does
  nothing in any mode.)
- **You can steal from a teammate.** A teammate's farm works like anyone else's —
  you don't auto-collect it; you skim a stack crossing it and take the whole pile
  on a leave, exactly the same way (and silently — there is no steal notification).
- **Auctions.** Farm auctions are a **team auction**: the lander pitches, the
  opponents race (first to accept wins immediately), and if both reject the
  lander's teammate may take it (else the lander does) — see the Auctions
  section.
- **Rune Duels** only happen against a **non-teammate** sharing your tile.
- **Magic cards & Cancel.** Your dice are your own in team mode too; the
  only difference is **Cancel Spell Card** can target **opponents only**,
  never your teammate.
