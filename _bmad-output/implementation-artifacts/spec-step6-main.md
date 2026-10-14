---
title: 'Step 6: main.js controller and live acceptance'
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

**Problem:** The modules exist but nothing wires them: settings, turn flow, the AI turn with its Shadow run, Compare and the Scoreboard must work together live from `file://` (PRD FR-6, FR-7, FR-10, FR-11, FR-12, FR-13, §8 Success Metrics; spine AD-7, AD-8, AD-10, AD-11).

**Approach:** Build `main.js` as the `App` namespace: owns settings and `aiThinking`; `startGame()` is the only caller of `Game.newGame`/`Metrics.reset`; `afterChange()` is the only scheduler of the AI turn (requestAnimationFrame then setTimeout, generation guard, pending handles cancelled on a new Game); builds the formatted view for `UI.render`. Gate: a headless-Chrome harness drives the real `index.html` through the PRD journeys.

</frozen-after-approval>

## Implementation Notes

- Test-first: headless-Chrome harness (scratchpad `app-test.js`, real `index.html` with `App.start()`) run red (`App is not defined`), then `main.js` turned it green.
- Files: `main.js` (new); `metrics.js` (+`formatSame`); `checks.js` (+formatSame check).
- Surprise: in headless Chrome under virtual time, `requestAnimationFrame` callbacks sometimes never fired (instrumented: requests > fires with `document.hidden` false), leaving "AI thinking…" forever. Real browsers can do the same in background tabs. Fix: `afterPaint(fn)` = rAF→setTimeout(0) as AD-7 requires, plus a 200 ms fallback timer; first to fire wins, both cancelled by `startGame()`. Harness proves the AI moves exactly once with frames stubbed out.
- Decision: the algorithm is captured when an AI turn starts (FR-7 "applies from the next AI turn" also holds mid-yield).
- Decision: Compare paints "Comparing…" first via the same `afterPaint`, and locks the Board while it runs.
- Decision: an AI turn that throws, returns null or yields an illegal move shows "The AI could not move. Press New Game." and never retries.
- Verified: app harness PASS 36/36 (×2 runs), UI harness 25/25, `node checks.js` 144/144, `checks.html` in Chrome, real `index.html` loads from file:// with no console errors. Covered live: UJ-1 (549,946 / 20,866 / 96.21%, same move), UJ-2, UJ-3, FR-7 algorithm switch, FR-10 new Game on mode/first change, FR-11 Compare read-only and disabled after the Game, FR-13 Scoreboard kept and Reset Scores, stale-turn drop on New Game / mode switch mid-thinking, SM-1 0 human wins over 12 scripted Games (both orders × both algorithms), SM-2 N / N in every Game.

## Review Triage Log

- Blind Hunter: illegal AI move loops forever; null result stuck; exception leaves "AI thinking…" — one root cause (unhandled AI-turn failure), low (searches verified on all 4,520 Boards, so unreachable in practice) but the failure mode is a hang. Patched: try/catch, check `Game.play`, error status, no retry.
- Blind Hunter: Compare freezes with no feedback — medium, real (~0.5 s on an empty Board). Patched: "Comparing…" painted first.
- Blind Hunter: failed Compare silent — false: `main.js` always passes `snapshot.current`, so `Metrics.compare` cannot return null here.
- Blind Hunter: main.js formats the same-move percentage — low, real (AD-8). Patched: `Metrics.formatSame`.
- Blind Hunter: keyboard focus lost after each AI turn — low, real; rejected: rare in the mouse-driven demo, fix needs UI state between renders (AD-8).
- Blind Hunter: mode change keeps Scoreboard across modes — false: required by FR-13 and confirmed decision §10.3.
- Blind Hunter: fallback path untested — low, real. Patched: rAF stubbed to never fire → AI moves once.
- Blind Hunter: failure/mid-turn paths untested; algo change mid-thinking changes the in-flight turn — medium, real (contradicts FR-7). Patched: algorithm captured at turn start; tests for mid-turn algo change, thrown search, fallback. `App.start()` twice — rejected (page calls it once; a second call only starts a new Game).
