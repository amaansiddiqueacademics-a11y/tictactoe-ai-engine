---
title: 'Step 4: metrics.js shadow run, Match history and summary'
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

**Problem:** Each AI turn must run both searches on the same Board, play the selected one's move, and keep the evidence (Nodes, time, same move) for the per-move panel, the Game summary and Compare (PRD FR-7, FR-8 data, FR-9, FR-11; spine AD-5, AD-6).

**Approach:** Build `metrics.js` as the `Metrics` namespace: the only place that times searches (`performance.now()`), the only append path for Move records (`runAiTurn`), a read-only `compare`, `summary()` derived from the history at read time, `reset`, and the only formatters (`pctPruned`, `formatMs`, `formatPct`). Extend `checks.js` first with the step-4 gate.

</frozen-after-approval>

## Implementation Notes

- Test-first: gate added, run red against a stub (crashed on null), then `metrics.js` turned it green.
- Files: `metrics.js` (new), `checks.js` (`gateMetrics`, guarded call site with try/catch).
- Decision: `pctPruned(0, 0)` returns null (no AI turns yet, e.g. Player vs Player) and `formatPct(null)` shows `—`.
- Decision: added `Metrics.formatNodes(n)` (thousands separators, `549,946`) so main.js never formats numbers itself (AD-8).
- Decision: `formatMs` follows the PRD literally: exactly 0 → `< 0.10 ms`; non-finite or negative → `—`.
- Decision: `compare` on a finished Board returns a Measurement with null moves and 1 Node each; main.js never calls it then (Compare disabled, FR-11).
- Verified: `node checks.js` → PASS 143/143. Mutants: timer stubbed to 0 fails "record times wrap the searches"; `runAiTurn` returning null fails cleanly with the summary line still printed.

## Review Triage Log

- Blind Hunter: gateMetrics not guarded by search modules — low, real. Patched.
- Blind Hunter: null result crashes run before summary — low, real. Patched: try/catch → one FAIL line.
- Blind Hunter: fixed timing order biases Alpha-Beta — low, real (time is secondary evidence). Patched comment; no reordering (keeps panel times stable).
- Blind Hunter: `formatMs` diverges from PRD (< 0.1 vs === 0), no bad-input guard — medium, real. Patched to PRD literal + `—` for bad input.
- Blind Hunter: spine AD-6 not updated for null pctPruned / formatNodes — medium, real. Deferred (spec edit) to deferred-work.md.
- Blind Hunter: missing tests (input Board copy, invalid side in runAiTurn, compare on finished Board) — low, real. Patched.
- Blind Hunter: timing assertion too weak — low, real. Patched: `mmMs > 1`.
- Blind Hunter: runAiTurn accepts malformed Board / wrong side — low, real but caller's contract (AD-7). Patched with a contract comment; no validation added.
