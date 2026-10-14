---
title: "Addendum: Tic-Tac-Toe using Minimax and Alpha-Beta"
created: 2026-10-15
updated: 2026-10-15
---

# Addendum

This holds depth for the downstream architecture and story work that is too detailed for the brief.

## Technical constraints for implementation

- **Node-count definition.** Count a node every time the search function is entered, including the root and terminal states. Apply this identically in both algorithms, or the comparison is invalid.
- **Tie-breaking.** Both algorithms iterate the cells in the same fixed order (0 → 8) and replace the best move only on a *strictly* better score. This guarantees the same chosen move when several moves score equally.
- **Scoring.** Win = +10 − depth, loss = depth − 10, draw = 0 (or an equivalent). Depth-adjusted scores make the AI prefer faster wins and slower losses. Use the same function in both algorithms. Note: depth adjustment also changes the node count compared with plain ±1 scoring under Alpha-Beta. Pick one and keep it.
- **Shadow run.** On each AI turn, run both algorithms on a *copy* of the board. Log `{turn, board, mmMove, mmNodes, mmMs, abMove, abNodes, abMs}` to a match-history array that drives both the per-move panel and the cumulative summary.
- **Sanity check.** Minimax from the empty board should report 549,946 nodes under the counting rule above. If it doesn't, the counter or move generation is wrong. This is useful to show in the viva.
- **Timing display.** Format `performance.now()` deltas to 2 decimal places. If a measured delta is 0, display `< 0.10 ms`. Node count and % pruned are the primary metrics. Time is secondary.
- **Responsiveness.** Use `setTimeout`/`requestAnimationFrame` to let the "AI thinking…" state paint before the synchronous search starts.
- **Script loading.** Load the modules as plain `<script>` tags in dependency order. ES modules served over `file://` are blocked in some browsers, so plain scripts are the safer zero-setup choice.

## Suggested module split (for the architecture step)

Solo developer: the split exists for maintainability and for explaining the code in the viva, not for dividing ownership.

| Module | Responsibility |
|---|---|
| `game.js` | Board state, legal moves, win/draw detection, winning line |
| `minimax.js` | Standard Minimax with a node counter |
| `alphabeta.js` | Alpha-Beta Minimax with a node counter |
| `metrics.js` | Timing, % pruned, match history, cumulative totals |
| `ui.js` | Rendering, events, turn indicator, scoreboard, panels |
| `main.js` | Wiring: mode, turn order, algorithm selection |
