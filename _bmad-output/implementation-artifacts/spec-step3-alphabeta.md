---
title: 'Step 3: alphabeta.js Minimax with Alpha-Beta Pruning'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-Tic-Tac-Toe-2026-10-15/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Tic-Tac-Toe-2026-10-15/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The project's claim is that pruning saves search without changing the decision; that needs an Alpha-Beta search that is directly comparable with `minimax.js` (PRD FR-4, FR-5, SM-2, SM-3; spine AD-4, AD-9).

**Approach:** Build `alphabeta.js` as the `AlphaBeta` namespace, mirroring `minimax.js` line for line plus the window: root window (−∞, +∞) with alpha raised after each root child, cutoff `alpha >= beta` after the update. Extend `checks.js` first: empty Board = 20,866 Nodes and cell 0; the shared search checks; Alpha-Beta never visits more Nodes than Minimax; and 0 move mismatches over the 4,520-Board AI-turn set, whose size is asserted.

</frozen-after-approval>

## Implementation Notes

- Test-first: gate added, run red against an unpruned stub (549,946 ≠ 20,866), then `alphabeta.js` turned it green.
- Files: `alphabeta.js` (new), `checks.js` (`aiTurnBoards`, `gateSameMove`, AlphaBeta call site).
- Verified: empty Board = 20,866 Nodes, cell 0 (96.21% pruned). AI-turn set = 2,097 (X first) + 2,423 (O first) = 4,520; 0 mismatches; AB never > MM; set totals MM 2,125,535 vs AB 309,653 (85.43%).
- Mutation-tested: `>` cutoff (hint 125,500), no root alpha raise (hint 34,203), root `>=`, hard-coded 'O', flipped maximizing — all fail. `node checks.js` → PASS 113/113 in ~6 s.

## Review Triage Log

- Blind Hunter: mismatch check runs on a wrong-size set — medium, real (contradicts AD-9 order). Patched: returns early if sizes wrong.
- Blind Hunter: only total size asserted — low, real. Patched: 2,097 / 2,423 checked separately.
- Blind Hunter: "min % pruned = 0" passes for broken builds — medium, real. Patched: replaced by exact Node totals over the set.
- Blind Hunter: missing 20,867 hint — low, real. Patched.
- Blind Hunter: mismatch log unreadable / silently capped — low, real. Patched: text Board form + "N more not shown".
- Blind Hunter: alphabeta.js lacks Node-rule header and known-wrong counts — low, real. Patched header.
- Blind Hunter: root tie-break comment omits the alpha == bestScore dependency — low, real. Patched comment.
- Blind Hunter: slow gate runs after failures, no progress line — low, real. Patched: runs only on a clean run, logs a start line.
- Blind Hunter: `aiTurnBoards` uses `score` as game-over test — low, real. Patched: `winner`/`isFull`.
