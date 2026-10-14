---
title: 'Step 1: game.js rules engine and checks.js gate'
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

**Problem:** Nothing exists yet. Every later module (searches, metrics, UI) depends on one shared, pure rules engine and one owner of game state (PRD FR-1, FR-2; spine AD-1, AD-2, AD-3).

**Approach:** Build `game.js` as the single `Game` namespace: pure rule functions (`legalMoves`, `winner`, `isFull`, `score`) plus the private game state and Scoreboard, changed only through `newGame`, `play` and `resetScores`, and read through `snapshot()`. Write `checks.js` first as the step-1 gate (8 lines, draw, legal moves 0–8 on an empty Board) that runs with `node checks.js` and in the browser through `checks.html`.

</frozen-after-approval>

## Implementation Notes

- Test-first: `checks.js` written first and run red (`game.js loaded` failed), then `game.js` turned it green.
- Files: `game.js` (new), `checks.js` (new), `checks.html` (new).
- Decision: `Game.snapshot()` also returns a `scoreboard` copy `{x, o, draw}` so `main.js` builds the view from one call (AD-2 names only `snapshot()` as the read path).
- Decision: before the first `newGame`, state is a valid empty Game with `generation: 0`, so `snapshot()` is safe at boot.
- Decision: `newGame` returns `false` for anything other than `'X'`/`'O'` and changes nothing, matching `play` and the spine's "illegal input returns false" convention.
- `checks.js` loads only the core files that exist and prints a SKIPPED line, so each gated step can run before later modules are built.
- Verified: `node checks.js` → PASS 61/61; `checks.html` in headless Chrome → PASS 61/61.

## Review Triage Log

- Blind Hunter: checks.html loads only game.js — low, real (spine AD-9 says four scripts). Patched: all four core scripts listed.
- Blind Hunter: missing modules skip silently — medium, real (a misspelled CORE entry would still pass). Patched: SKIPPED line names untested modules.
- Blind Hunter: no 9th-move-win test — medium, real (swapping win/full checks would go unnoticed). Patched: `score` on a full winning Board, and a `play` sequence won on the 9th move.
- Blind Hunter: winLine/scoreboard/winner-line copies untested — low, real. Patched with three copy checks.
- Blind Hunter: `newGame` coerces bad input to 'X' — low, real. Patched: returns false, state unchanged; checks added.
- Blind Hunter: `resetScores` check too loose — low, real. Patched: whole snapshot except scoreboard compared.
- Blind Hunter: score edges and turn alternation untested — low, real. Patched: O-win, depth-0 bounds, faster-win ordering, X/O/X alternation, O-first alternation.
