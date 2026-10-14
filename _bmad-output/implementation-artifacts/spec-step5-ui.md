---
title: 'Step 5: ui.js view, index.html and style.css'
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

**Problem:** The demonstration needs a screen: the Board, the turn indicator, the controls, the Scoreboard, the per-move metrics panel, the Game summary and the Compare panel (PRD FR-8 panel, FR-10, FR-11, FR-12, FR-13 rendering; spine AD-8, AD-11).

**Approach:** Build `ui.js` as the `UI` namespace with `bind(handlers)` and `render(view)` only: it draws one pre-formatted view object and reports user intents, never calling `Game`, `Metrics` or the searches. Static markup in `index.html` (scripts at the end of `<body>`), styling in `style.css`. Gate: a headless-Chrome harness renders sample views and checks the Board, the panels and that clicks reach the handlers.

</frozen-after-approval>

## Implementation Notes

- Test-first: headless-Chrome harness (scratchpad `ui-test.js`, injected into a copy of `index.html` with `main.js` removed) run red (`UI is not defined`), then `ui.js` turned it green.
- Files: `ui.js`, `index.html`, `style.css` (all new). The harness stays outside the deliverable.
- Decision: view field `lastMove.played` ('minimax' | 'alphabeta') added to the AD-8 shape, so the "played" tag shows the algorithm that actually played, not the current setting (FR-7).
- Decision: Scoreboard labels read "You (X)" / "AI (O)" in Player vs AI; "X wins" / "O wins" in Player vs Player.
- Verified: harness PASS 25/25 (render, routing, win line, locked Board, empty states, equal row heights, bind-once).

## Review Triage Log

- Blind Hunter: rows resize as marks are placed — medium, real (reviewer measured 151/87 px). Patched: `grid-template-rows`; harness checks equal heights.
- Blind Hunter: "played" tag follows current setting — medium, real (contradicts FR-7). Patched: `lastMove.played`.
- Blind Hunter: New Game dark-mode contrast ~2.6:1 — low, real. Patched: `--on-accent` dark text in dark mode.
- Blind Hunter: win shown by colour only — low, real. Patched: outline + "winning line" in aria-label.
- Blind Hunter: cell index hidden once played — low, real (panels cite cells). Patched: index always shown.
- Blind Hunter: `bind` unguarded — low, real. Patched: bind-once + clear error for missing ids.
- Blind Hunter: locked Board looks clickable — low, real. Patched: `.board.locked` style.
- Blind Hunter: live region rewritten every render — low, real. Patched: write only on change. Panel rebuild resetting selection — low, rejected (rare; fix adds diffing).
- Blind Hunter: harness gaps — low, real. Patched: played tag, same/differs, aria-labels, geometry, bind-twice.
- Blind Hunter: labels/semantics (% twice, ✓ read aloud, no thead, scoreboard roles, noscript) — low, real. Patched all.
- Blind Hunter: run-harness.sh only works by absolute path — low, real (scratch tool, not deliverable). Rejected.
