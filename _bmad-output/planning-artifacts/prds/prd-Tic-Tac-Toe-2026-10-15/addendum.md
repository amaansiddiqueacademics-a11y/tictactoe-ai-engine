---
title: "PRD Addendum: Tic-Tac-Toe using Minimax and Alpha-Beta"
created: 2026-10-15
updated: 2026-10-15
---

# PRD Addendum

This addendum holds technical depth for the Architect. It does not repeat the brief addendum's technical constraints (Node rule, Shadow run record, timing, script loading); those still apply.

## 1. Prototype evidence behind the reference numbers

A throwaway Node.js prototype (not part of the deliverable) implemented both algorithms using the PRD rules: Node counted on every entry including the root; Cell order 0→8; strict-improvement tie-break at the root; scoring `10 − depth` / `depth − 10` / `0` from the AI's perspective; root searched with a full window, then alpha raised after each child.

| Measurement | `10 − depth` scoring (chosen) | ±1 scoring (rejected) |
|---|---|---|
| Minimax Nodes, empty Board | 549,946 | 549,946 |
| Alpha-Beta Nodes, empty Board | **20,866** | 18,297 |
| % pruned, empty Board | 96.21% | 96.67% |
| Chosen cell, empty Board (both) | 0 | 0 |
| AI-turn Boards checked (both turn orders) | 4,520 | 4,520 |
| Move mismatches | **0** | 0 |
| Minimum % pruned seen | 0.00% (late Game) | 0.00% |
| Minimax empty-Board time (Node) | about 230 ms | n/a |

**Why `10 − depth` was chosen:** it makes the AI prefer faster wins and slower losses, which is easier to defend in a viva. The cost is a slightly higher Alpha-Beta count, which is fine because the brief only asks for a large reduction. The brief addendum required choosing one scoring scheme; this is that choice.

**Why the same-move guarantee holds:** at the root, a child pruned by Alpha-Beta returns a bound that is ≤ the current best and so is never *strictly* better. Children that could beat the best are searched exactly. With the same Cell order and strict `>`, the root picks the same cell as Minimax. If the root used `>=`, or a narrowed root window, this would break.

**Implication for the counts:** if the implementation counts Nodes differently (for example, not counting the root, or counting only expanded nodes), Minimax still gives 549,946 only under the "every entry, including the root" rule. Alpha-Beta's 20,866 also depends on alpha being updated at the root between children. If the build gets a different Alpha-Beta count while Minimax shows 549,946, compare the root loop with this description first.

## 2. Notes for the architecture step

- **Shared core:** both search modules should call the same `game.js` functions for legal moves, terminal checks and scoring. This is the simplest way to meet NFR-5. Neither search module should define its own win check.
- **Pure searches:** each search returns `{move, nodes}` and takes a Board copy. `metrics.js` wraps the calls with `performance.now()`, so timing code is not duplicated in the algorithms.
- **Load order:** `game.js` → `minimax.js` → `alphabeta.js` → `metrics.js` → `ui.js` → `main.js`. This matches the PRD's §7 build order.
- **Verification script (confirmed):** a small `checks.js` holds the step 1–4 gates (8 lines, 549,946, 20,866, same move on test Boards). It must run both in the browser console (after the classic scripts load) and in Node with no test framework. Because the modules are classic scripts, not ES modules, the Node runner can load them with `vm.runInThisContext` on each file in load order, or the modules can end with a guarded `if (typeof module !== 'undefined') module.exports = …`. The Architect picks one. Keep the script out of the graded UI.
