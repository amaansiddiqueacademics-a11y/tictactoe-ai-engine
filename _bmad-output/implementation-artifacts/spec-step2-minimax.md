---
title: 'Step 2: minimax.js standard Minimax with Node counting'
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

**Problem:** The AI needs the reference algorithm: full-depth Minimax whose Node count proves the counter is correct (PRD FR-3, FR-5; spine AD-3, AD-4).

**Approach:** Build `minimax.js` as the `Minimax` namespace with `search(board, me)` → `{bestMove, nodesVisited}`, using only `Game` rule functions, a private Board copy with make/undo, root counted once, Cell order and strict `>` at the root. Extend `checks.js` first with the step-2 gate: empty Board = 549,946 Nodes and cell 0.

</frozen-after-approval>

## Implementation Notes

- Test-first: gate added to `checks.js`, run red against a stub, then `minimax.js` turned it green.
- Files: `minimax.js` (new), `checks.js` (`gateSearch`, shared with step 3).
- Verified: empty Board = 549,946 Nodes, cell 0. Changing the root `>` to `>=` picks cell 8, so FR-5 is enforced, not accidental.
- Decision: `search` returns null for any `me` other than 'X'/'O' (spine convention: illegal input returns null).
- Added FR-6 exhaustive check: every human line of play against the AI, AI as O and as X, moving first and second → 0 human wins.
- Mutation-tested the gate: hard-coded 'O', flipped maximizing, flat (depth-free) scoring, falsy draw check, `>=` tie-break, first-legal-move all fail; unmutated passes. `node checks.js` → PASS 85/85 in ~1.2 s.

## Review Triage Log

- Blind Hunter: gate misses hard-coded 'O' — high, real (verified by mutant). Patched: X-to-move tactical positions + AI-as-X never-loses check.
- Blind Hunter: gate misses flipped perspective — high, real. Patched: non-trivial tactical positions + exhaustive never-loses check.
- Blind Hunter: all bestMove checks pass for "first legal move" — high, real. Patched: positions whose answer is not the lowest empty cell.
- Blind Hunter: depth weighting untested through the search — medium, real. Patched: `XOX.O.X..` (immediate win 7 vs slower 3).
- Blind Hunter: falsy draw check and drawn root untested — medium, real. Patched: drawn-root check; falsy mutant now fails.
- Blind Hunter: checks print no detail — low, real. Patched: result passed to every check.
- Blind Hunter: no-mutation check only on empty Board — low, real. Patched: checked on every tactical position.
- Blind Hunter: no known-wrong count hints — low, real. Patched: `hints` map (549,945 / 549,947).
- Blind Hunter: equal non-zero tie-break untested — low, real. Patched: `XOXOO.X..` two immediate wins → earlier cell 5.
- Blind Hunter: `me` unvalidated — low, real. Patched: returns null; checked.
- Blind Hunter: closure `value(depth, toMove)` differs from AD-4 shape — low, real (viva comparability). Patched: `value(b, depth, toMove)`.
