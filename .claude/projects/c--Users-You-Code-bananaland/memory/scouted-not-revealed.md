---
name: scouted-not-revealed
description: In bananaland simple mode, a tile revealed only via the Scout ability must NOT count as genuinely "revealed"
metadata:
  type: feedback
---

In simple mode, treat **scouted** tiles (revealed via the 🔭 Scout ability) as distinct from genuinely **revealed** tiles (discovered by landing/movement). A scouted-only tile shows on the scouter's board (fog of war) but must not count as a real discovery anywhere else: it does not anchor farms in the Owned-Farms chart, does not bound grow ranges, and a scouted-only grow stays dormant when its number is rolled.

**Why:** The user explicitly said "From now on, do not consider 'scouted' using the scout ability and revealed as the same thing." Scout is a peek, not a discovery; conflating them made farms misgroup and would let a merely-scouted grow affect gameplay.

**How to apply:** Backend tracks per-player `scoutedTiles` alongside `revealedTiles`; "genuinely revealed" = in `revealedTiles` but not `scoutedTiles` for some player. Landing on a tile clears its scouted flag. Helpers: `_isGenuinelyRevealed(pos)`, `_globalGenuineRevealed()`, `_genuineRevealedGrowPositions()`; getState exposes `genuineRevealedGrows`. The frontend grow chart groups by `gs.genuineRevealedGrows`.
