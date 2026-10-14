---
title: "PRD: Tic-Tac-Toe using Minimax and Alpha-Beta"
status: final
created: 2026-10-15
updated: 2026-10-15
---

# PRD: Tic-Tac-Toe using Minimax and Alpha-Beta

**Author:** Amaan Siddique (solo developer) · **Facilitated by:** John (PM)
**Inputs:** [Product Brief](../../briefs/brief-Tic-Tac-Toe-2026-10-15/brief.md) and [Brief Addendum](../../briefs/brief-Tic-Tac-Toe-2026-10-15/addendum.md), both final
**Deadline:** implementation complete on 2026-10-15. The scope below is fixed.

## 0. Document Purpose

This PRD turns the final brief into prioritized, testable requirements and a gated build order. It is written for the Architect, who designs the module structure next, and for the developer during the build and the viva. It does not repeat the brief's argument for the project; it states what must be true and how to check it. Terms in §3 are used exactly as defined. Decisions confirmed during drafting are listed in §10. Technical detail and the prototype evidence behind the numbers below are in [addendum.md](addendum.md).

## 1. Vision

A browser-based Tic-Tac-Toe game that demonstrates game-tree search and does not just claim it works. The AI plays perfectly using Standard Minimax or Alpha-Beta Pruning, and on every AI turn the app shows on screen that both algorithms pick the same move and how much search Alpha-Beta saved. The professor can test any position live, and the developer can explain every module line by line.

## 2. Target User

### 2.1 Jobs To Be Done
- **Professor (evaluator):** in a few minutes of live demo, check that the AI is optimal, that pruning does not change the decision, and that the savings are real and measured.
- **Developer (in the viva):** explain any line on request, from small single-purpose modules.
- **Learners (secondary):** see pruning savings as concrete numbers.

### 2.2 Key User Journeys
- **UJ-1. The professor tries to beat the AI.** They choose Player vs AI, let the AI move first, and pick Standard Minimax. The first AI move shows 549,946 nodes for Minimax and 20,866 for Alpha-Beta, 96.21% pruned, with **Same move ✓**. They play to a draw, switch to Alpha-Beta, play again, and lose or draw. The match summary shows the same move on 100% of AI turns.
- **UJ-2. The professor sets a specific position.** They switch to Player vs Player, play a few moves for both sides into a position they want to test, and press **Compare**. Both algorithms' moves, node counts and times appear side by side. The moves are identical and the node counts differ.
- **UJ-3. The developer defends the counter.** Asked "how do you know your node counter is right?", the developer runs Compare on an empty board and points to 549,946, the known size of the full Tic-Tac-Toe game tree.

## 3. Glossary

- **Board**: the 3×3 grid. Cells are indexed **0–8**, row-major from the top-left.
- **Cell order**: the fixed scan order 0 → 8 that both algorithms use to generate moves.
- **Game**: one play from an empty Board to a win or a draw. The brief calls this a "match".
- **Session**: all Games played since the page loaded. The Scoreboard lasts for the Session.
- **AI turn**: a turn in Player vs AI mode where the AI (O) moves.
- **Selected algorithm**: the algorithm the user chose. Its move is played.
- **Shadow run**: on each AI turn, running the *non-selected* algorithm on a copy of the same Board for measurement only.
- **Node**: one entry into the search function, including the root and terminal states. Both algorithms count Nodes the same way.
- **% pruned**: `(Minimax Nodes − Alpha-Beta Nodes) ÷ Minimax Nodes × 100`, computed on the same Board.
- **Move record**: `{turn, board, mmMove, mmNodes, mmMs, abMove, abNodes, abMs}` for one AI turn.
- **Match history**: the list of Move records for the current Game.
- **Compare**: an on-demand run of both algorithms on the current Board, shown side by side.

## 4. Features and Priorities

Priority is **build and cut order**. P0 is what is graded: without it there is no demonstration. P1 makes the demonstration usable live. P2 completes the brief but is the first thing to simplify if time runs short. The whole brief is still in scope (§6).

| Pri | Feature | Why at this priority |
|---|---|---|
| P0 | 4.1 Game rules engine | Everything else depends on it |
| P0 | 4.2 Search algorithms (Minimax and Alpha-Beta) | The subject of the grade |
| P0 | 4.3 Shadow run and per-move metrics | The evidence: same move, Nodes, % pruned |
| P0 | 4.4 Cumulative Game summary | Shows the 100% same-move claim |
| P1 | 4.5 Player vs AI play loop and controls | The live demo surface |
| P1 | 4.6 Compare (side by side) | Lets the professor test any position (UJ-2, UJ-3) |
| P2 | 4.7 Player vs Player mode, Scoreboard, polish | Needed for UJ-2's position setup; otherwise cosmetic |

### 4.1 Game rules engine (P0)
Pure Board logic with no UI or DOM access.

#### FR-1: Board state and legal moves
The system represents the Board and lists legal moves in Cell order.
- Legal moves on an empty Board are `[0,1,2,3,4,5,6,7,8]`, in that order.
- A move on an occupied cell, or after the Game has ended, is rejected and leaves the Board unchanged.

#### FR-2: Win and draw detection with winning line
The system detects all 8 winning lines and draws, and reports the winning line.
- Each of the 8 lines, filled by X or by O, is reported as a win with that line's three cell indices.
- A full Board with no line is a draw. A Board that is not full and has no line is still in progress.

### 4.2 Search algorithms (P0)

#### FR-3: Standard Minimax
The AI chooses a move using full-depth Minimax with Node counting, with no depth limit, move ordering or memoization.
- **Sanity check:** from an empty Board, the reported Node count is exactly **549,946**.
- Scoring, from the AI's perspective: AI win = `10 − depth`, AI loss = `depth − 10`, draw = `0`. Both algorithms use the same scoring function.

#### FR-4: Minimax with Alpha-Beta Pruning
The AI chooses a move using Alpha-Beta with the same Node rule, scoring and Cell order as FR-3.
- From an empty Board, the Node count is exactly **20,866** (96.21% pruned). This is the reference value from the prototype ([addendum](addendum.md) §1).
- The Alpha-Beta Node count is never greater than the Minimax Node count on the same Board.

#### FR-5: Deterministic tie-breaking
Both algorithms scan root moves in Cell order and replace the best move only when a new move scores **strictly better**. Equal scores keep the earlier cell.
- From an empty Board, both algorithms choose **cell 0**. Every move from the empty Board leads to a draw, so the first cell is kept.
- Over every reachable Board where it is the AI's turn, under both turn orders (4,520 Boards), the two algorithms choose the same cell. The prototype found 0 mismatches.
- Changing `>` to `>=` in the root loop breaks the empty-Board check. This shows the rule is enforced and not accidental.

#### FR-6: The AI never loses
In Player vs AI mode, with either Selected algorithm and either turn order, the human cannot win.
- The best the human can achieve is a draw. Given a winning move, the AI takes it, and it always blocks an immediate threat.

### 4.3 Shadow run and per-move metrics (P0)

#### FR-7: Shadow run on every AI turn
On each AI turn, both algorithms run on copies of the same Board. The Selected algorithm's move is played, and the other is measured only. Realizes UJ-1.
- The live Board is never mutated by either search.
- Exactly one Move record is appended to the Match history per AI turn, whichever algorithm is selected.
- If the user changes the Selected algorithm mid-Game, the change applies from the next AI turn, and earlier Move records stay valid.

#### FR-8: Per-move metrics panel
After each AI turn, the panel shows, for both algorithms: chosen cell, Nodes and time; plus % pruned and a same-move indicator.
- The Nodes and % pruned values match the latest Move record. % pruned is shown to 2 decimal places.
- Time comes from `performance.now()` and is shown to 2 decimal places. A measured delta of 0 is shown as `< 0.10 ms`.
- % pruned can legitimately be 0.00% late in a Game, for example with one empty cell. The panel shows 0.00% and does not hide it or show an error.

### 4.4 Cumulative Game summary (P0)

#### FR-9: Cumulative totals and same-move check
The system shows, for the current Game, total Minimax Nodes, total Alpha-Beta Nodes, overall % pruned (computed from the totals), and "same move on N / N AI turns".
- The totals equal the sums of the Move records in the Match history.
- After any full Game in Player vs AI mode, the same-move line reads N / N (100%).
- Only AI turns count toward the totals. Compare runs (FR-11) are excluded, so the totals reflect Games as played. Compare is read-only analysis.
- Reset clears the Match history and the summary.

### 4.5 Player vs AI play loop and controls (P1)

#### FR-10: Game setup and turn flow
The user picks the mode (Player vs AI or Player vs Player), who moves first, and the Selected algorithm. The human is always X and the AI is always O.
- A turn indicator always shows whose move it is. During an AI turn it shows "AI thinking…", which is painted *before* the synchronous search starts.
- Human clicks are ignored while the AI is thinking and after the Game ends.
- The winning line is highlighted. A draw is announced.
- Reset starts a new Game with the current settings. Changing the mode or who moves first also starts a new Game and keeps the Scoreboard counts.

### 4.6 Compare (P1)

#### FR-11: Side-by-side compare
A Compare button runs both algorithms on the current Board and shows each one's chosen cell, Nodes and time next to each other. It works in both modes and on any turn. Realizes UJ-2 and UJ-3.
- Compare on an empty Board shows 549,946 vs 20,866 and cell 0 for both.
- Compare does not change the Board, the turn or the Match history.
- Compare is disabled when the Game has ended, whether by a win or a draw.

### 4.7 Player vs Player mode, Scoreboard and polish (P2)

#### FR-12: Player vs Player
Two humans alternate X and O on one device. No AI turns occur, so the cumulative summary stays empty, and Compare (FR-11) still works.

#### FR-13: Scoreboard
The Scoreboard counts X wins, O wins and draws across the Session. Reset and changes to the mode or turn order do not clear it, and a page reload does.
- *Optional (P2, build last):* a separate **Reset Scores** control that zeroes the Scoreboard only.

## 5. Cross-Cutting NFRs

- **NFR-1 Responsiveness:** each AI turn completes in under about 1 s on a typical laptop, *including* the Shadow run. The worst case is an AI-first empty Board: about 0.23 s for Minimax plus Alpha-Beta in Node; check it in the target browser.
- **NFR-2 Zero setup:** double-clicking `index.html` over `file://` runs the app, with no install, build step, server or network.
- **NFR-3 No dependencies:** plain HTML, CSS and vanilla JS, loaded as classic `<script>` tags in dependency order, with no ES modules.
- **NFR-4 Explainability:** each module has one responsibility, and the search modules contain no DOM code.
- **NFR-5 Comparison fairness:** both algorithms share the Node rule, scoring function, Cell order and tie-breaking rule. Any change to one is applied to both.

## 6. MVP Scope

**In scope:** FR-1 to FR-13 and NFR-1 to NFR-5. This is everything in the brief's *Solution*.

**Out of scope** (from the brief; fixed): Boards other than 3×3; difficulty levels or a weakened AI; depth limits and heuristics; move ordering, transposition tables and memoization (they would change the Node counts); search-tree visualization; online play, accounts, cross-session persistence and mobile apps.

## 7. Build Order

Each step ends with a gate that must pass before the next step starts. Gates are checked with a small verification script that runs in Node and in the browser console, with no external test framework. The order follows the dependencies, so a working, demonstrable core exists as early as possible.

| # | Module | Delivers | Gate (must pass) |
|---|---|---|---|
| 1 | `game.js` | FR-1, FR-2 | All 8 lines detected; draw detected; legal moves are 0–8 on an empty Board |
| 2 | `minimax.js` | FR-3, FR-5 (Minimax side) | **Empty Board = 549,946 Nodes**, move = cell 0 |
| 3 | `alphabeta.js` | FR-4, FR-5 | **Empty Board = 20,866 Nodes**, move = cell 0; same move as Minimax on a set of test Boards |
| 4 | `metrics.js` | FR-7, FR-8 data, FR-9 | One Move record per AI turn; totals equal the sum of records; % pruned is correct; `< 0.10 ms` formatting |
| 5 | `ui.js` | FR-8 panel, FR-10, FR-11, FR-12, FR-13 rendering | The Board renders; clicks are routed; "AI thinking…" paints before the search |
| 6 | `main.js` + `index.html` | Wiring: mode, turn order, Selected algorithm | Every Success Metric in §8 is checked live from `file://` |

Steps 1–4 contain no DOM code and can be checked before any UI exists. If time runs short, cut P2 polish within steps 5–6. Steps 1–4 are never cut.

## 8. Success Metrics (acceptance)

- **SM-1 Unbeatable:** 0 human wins over manual Games covering both algorithms × both turn orders. Validates FR-6.
- **SM-2 Decisions match:** same-move N / N on 100% of AI turns in every Game, and 0 mismatches over the 4,520 AI-turn Boards. Validates FR-5, FR-7 and FR-9.
- **SM-3 Counter correct:** empty Board = 549,946 (Minimax) and 20,866 (Alpha-Beta), i.e. 96.21% pruned. Validates FR-3 and FR-4.
- **SM-4 Responsive:** worst-case AI turn under about 1 s, with no frozen paint. Validates NFR-1.
- **SM-5 Zero setup:** the app opens from `file://` in Chrome and in Firefox. Validates NFR-2.
- **SM-C1 (counter-metric) — do not optimize % pruned.** Adding move ordering or memoization would raise % pruned, break parity with the reference counts, and make the comparison unfair. Counterbalances SM-3.

## 9. Open Questions

None. All assumptions were confirmed by the developer on 2026-10-15 (§10).

## 10. Confirmed Decisions

1. FR-7: changing the Selected algorithm mid-Game takes effect on the next AI turn.
2. FR-9: Compare runs are read-only analysis and are excluded from the cumulative totals.
3. FR-10 and FR-13: changing the mode or turn order starts a new Game and keeps the Scoreboard counts. A separate Reset Scores control is optional (P2).
4. FR-11: Compare is disabled once the Game has ended (win or draw).
5. §7: the gates (including 549,946 and 20,866) are checked by a small verification script that runs in Node or the browser console, with no external test framework, and is not part of the graded UI.
