---
title: "Product Brief: Tic-Tac-Toe using Minimax and Alpha-Beta"
status: final
created: 2026-10-15
updated: 2026-10-15
---

# Product Brief: Tic-Tac-Toe using Minimax and Alpha-Beta

**Author:** Amaan Siddique (solo developer)
**Context:** College AI course mini-project, graded during a live code demonstration and viva
**Deadline:** Implementation complete on 2026-10-15

## Executive Summary

This is a browser-based Tic-Tac-Toe game whose real purpose is to *demonstrate* game-tree search. The AI opponent plays using standard Minimax or Minimax with Alpha-Beta Pruning, whichever the user selects. For every AI move, the app shows how much work each algorithm did. By the end of a match, the evidence is on screen: both algorithms always choose the same optimal move, and Alpha-Beta reaches it while exploring a fraction of the nodes.

The seminar is done. What remains to be graded is a working implementation the professor can watch, test and question. The project optimizes for three things: correctness that can be shown on demand, metrics that make the Minimax vs Alpha-Beta trade-off obvious, and a modular codebase that is easy to explain line by line in the viva.

## The Problem

Alpha-Beta Pruning is usually taught as a claim: "same result as Minimax, fewer nodes." On paper, students accept it without seeing it. In a viva, a game that merely plays well proves nothing about the algorithm underneath. An evaluator needs to see:

- that the AI is optimal (it never loses);
- that pruning does not change the decision;
- how much search pruning saves, in concrete numbers, on real board states.

A plain Tic-Tac-Toe game shows none of this, and metrics buried in console logs are hard to present live.

## The Solution

The app is a single page built with HTML, CSS and vanilla JavaScript. It has no dependencies and opens directly in a browser with zero setup.

**The game**
- A 3×3 board with **Player vs AI** and **Player vs Player** modes.
- The human is always **X** and the AI is always **O**. The user chooses who moves first.
- The interface has a turn indicator, win and draw detection, a winning-line highlight, a scoreboard and a reset button. The scoreboard persists across rounds within the session.

**The AI engine**
- The user can select either **Standard Minimax** or **Minimax with Alpha-Beta Pruning**.
- Both algorithms play perfectly, so the AI never loses.
- Tie-breaking is deterministic. Both algorithms scan cells in the same fixed order and switch to a new move only when it scores strictly better. This makes the "same optimal move" claim hold: without it, the two algorithms can legitimately choose different moves that score the same.

**The comparison layer (the core of the grade)**

To keep every comparison fair, **both algorithms run on every AI turn**, whichever one is selected to play. The selected algorithm makes the move. The other runs in the background on the same board, only to be measured. Otherwise the percentages and totals would compare different boards.

- **Per-move metrics** for every AI move:
  - nodes explored;
  - execution time in milliseconds;
  - percentage of nodes pruned, calculated as `(Minimax nodes − Alpha-Beta nodes) ÷ Minimax nodes` on the same board.

  Node count and percentage pruned are the primary metrics. Time comes from `performance.now()` and is shown to 2 decimal places. When the browser rounds a time to zero, the app shows `< 0.10 ms`.
- **Side-by-side compare.** A button runs *both* algorithms on the current board and shows each one's chosen move, node count and time next to each other. It works on any turn, in both modes.
- **Cumulative match summary.** This shows the total nodes explored by Minimax and by Alpha-Beta across the whole match. It also confirms that the two algorithms chose the same move on every turn.

## What Makes This Different

This is not a novel product, and it doesn't need to be. Its edge over a typical submission is **evidence instead of assertion**:

- the metrics are part of the gameplay, not hidden in logs;
- the "same move" claim is checked automatically on every turn, not just stated;
- the percentage pruned is measured on the exact same board state, not estimated.

## Who This Serves

- **The professor (primary).** Has a few minutes of live demo to verify correctness and understanding, and may ask for a specific board position. Side-by-side compare lets any position be tested on the spot.
- **The developer, in the viva.** Must explain any line on request. Small, single-purpose modules with readable names and no frameworks make that possible.
- **Classmates and future learners (secondary).** Can use the app as a visual aid for how pruning works.

## Success Criteria

1. **The AI is unbeatable.** In Player vs AI mode, the human can never win. This holds for both algorithms and both turn orders; at best, the human draws.
2. **Decisions match.** On every compared board, Minimax and Alpha-Beta choose the same move. The match summary shows a match on 100% of AI turns.
3. **The savings are visible.** On an empty board, standard Minimax explores the full game tree of **549,946 nodes**. This known figure doubles as a correctness check for the node counter. Alpha-Beta explores far fewer, with an expected reduction of 90% or more. The exact count will be measured during the build.
4. **Moves are responsive.** Every AI move finishes in under about 1 second on a typical laptop, without freezing the page. This includes the worst case: Minimax on an empty board.
5. **Setup takes zero steps.** Opening `index.html` runs the app, with no install, build step or server.
6. **The code is ready for the viva.** Game rules, the two algorithms, metrics and UI are in separate modules. The developer can walk through each one without notes.

## Scope

**In scope for v1:**
- everything under *The Solution*;
- a modular file structure that keeps game state and rules, each search algorithm, metrics and UI separate.

**Out of scope:**
- board sizes other than 3×3;
- difficulty levels or a deliberately weakened AI;
- depth-limited search and heuristic evaluation, which are unnecessary because the full tree is small;
- move-ordering optimizations, transposition tables and memoization, which would change the node counts and muddy the comparison;
- search-tree visualization, so the focus stays on the board, the node counters and the percentage pruned;
- online multiplayer, user accounts, saving scores across browser sessions, and mobile apps.

**Same-day delivery:** with a solo developer and a deadline of 2026-10-15, this scope is fixed. Nothing is added during implementation.
