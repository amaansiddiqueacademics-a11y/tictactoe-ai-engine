---
review: verification (were committed decisions reality-checked, not asserted from memory?)
target: ../ARCHITECTURE-SPINE.md
context: ../../../prds/prd-Tic-Tac-Toe-2026-10-15/prd.md, addendum.md
date: 2026-10-15
verdict: PASS WITH ONE REQUIRED FIX (AD-7 paint-before-search mechanism)
---

# Verification Review: Architecture Spine

## Method

Every technology claim in the spine was either run on this machine or checked against a primary source. The experiments live in `C:/Users/user/AppData/Local/Temp/claude/ttt-verify/` (throwaway). The environment was Node v24.14.1, Chrome 155 (headless=new) and Edge 155 (headless=new) on Windows 10, driven over the Chrome DevTools Protocol with real `Input.dispatchMouseEvent` clicks. **Firefox is not installed on this machine, so no Firefox claim could be tested locally.**

## Verdict

The stack choices hold up, and so do the reference numbers. One committed mechanism is wrong as written: AD-7's `setTimeout(…, 0)` does **not** guarantee that "AI thinking…" is painted before the synchronous search starts (FR-10, SM-4). The fix is small. The other findings are clarifications.

## Findings

### F1 (HIGH, needs a fix): `setTimeout(0)` does not guarantee a paint before the search (AD-7)

**Claim in the spine:** AD-7 renders "AI thinking…", then calls `setTimeout(…, 0)`, then runs the search. FR-10 and the §7 step-5 gate require the indicator to be painted *before* the synchronous search.

**Why it fails:** In the HTML event loop, a page gets a rendering opportunity only at the display's frame cadence (about every 16 ms). A 0 ms timer task is often ready before that opportunity comes, so the browser can run it first. The 250–600 ms search then blocks the thread. The final render replaces the text before any frame is drawn, so "AI thinking…" is never seen.

**Evidence (real clicks dispatched over CDP, a 250 ms busy-loop standing in for the search; "frame first" means a `requestAnimationFrame` callback ran before the search started):**

| Scheduling | Chrome 155 | Edge 155 |
| --- | --- | --- |
| `setTimeout(run, 0)` (spine) | **13/15**: 2 runs started the search before any frame; there rAF fired at about 350 ms and 937 ms, after the search | 15/15 |
| `requestAnimationFrame(() => setTimeout(run, 0))` | 15/15 | 15/15 |
| `requestAnimationFrame(() => requestAnimationFrame(run))` | 15/15 | 15/15 |

So the approach fails intermittently, roughly 1 in 7 clicks in Chrome. That is enough to fail a live demo gate and the "no frozen paint" part of SM-4. The test was headless, so a real windowed browser will differ in rate. It cannot be *more* guaranteed, though, because the spec does not order timer tasks before rendering. Firefox is untested here; nothing in the spec makes it safe either.

**Fix:** In AD-7, replace `setTimeout(…, 0)` with `requestAnimationFrame(() => setTimeout(run, 0))`. The rAF callback runs during the rendering step of the next frame. The timeout queued from inside it runs only after that frame's style, layout and paint have finished. This is the standard "yield until after next paint" idiom. Keep the generation check inside `run`. Optionally, note that rAF does not fire in a background tab, so the AI move waits until the tab is visible. That is acceptable for a demo; say so in the spine so it is not "fixed" later. Update the sequence diagram and the Layer table ("Shell: controller … `setTimeout`" becomes "`requestAnimationFrame` + `setTimeout`").

### F2 (MEDIUM): NFR-1 timing is quoted from Node only; the browser's cold first search is about 2x slower

**Claim:** Deferred / Performance tuning says "the worst case is about 0.23 s in Node".

**Evidence:** With a straightforward implementation that follows AD-3/AD-4 (rules called through `Game.*`), the empty-Board Minimax plus Alpha-Beta took:
- Node 24.14.1: 222–296 ms on most runs, with outliers of 589 and 714 ms when the machine was busy.
- Chrome 155, file://, first search right after page load: **388, 475 and 604 ms** for Minimax, plus 13–53 ms for Alpha-Beta.

The worst case (AI moves first on an empty Board) is also the *first* search after load, which runs on not-yet-optimized code. It is still under NFR-1's "about 1 s", but the margin is about 2x, not 4x. The spine's figure should not be repeated as the browser number.

**Fix:** Change the Deferred line to "about 0.23 s in Node; about 0.4–0.6 s cold in Chrome on the dev machine; re-measure in Firefox". SM-4 is the gate. No architecture change is needed. The fact that it takes hundreds of ms is also exactly why F1 matters.

### F3 (MEDIUM): `checks.js` dual-environment loading is under-specified (AD-9 / AD-1)

**Verified true:**
- `vm.runInThisContext` puts the top-level `const`s in the **global lexical scope**. A CommonJS `checks.js` can then reference `Game` and the others by bare name. Tested in Node 24.14.1: `typeof Game === 'object'`.
- Redeclaring throws `SyntaxError: Identifier 'Game' has already been declared`, which confirms the author's own test.

**Gaps the spine leaves open:**
1. **`globalThis.Game` is `undefined`** in both Node and the browser, because top-level `const` does not create a global-object property. Any check written as `globalThis.Game` or `window.Game` will fail. The spine should say "refer to namespaces by bare identifier only".
2. The same `checks.js` file must run under `checks.html`, where `require` does not exist. The spine does not say how it detects its environment. Specify a guard, such as `if (typeof window === 'undefined') { const fs = require('fs'), vm = require('vm'), path = require('path'); … }`. Resolve the core files with `path.join(__dirname, f)` so that `node checks.js` works from any working directory. Pass `{filename: f}` so stack traces name the right file.
3. AD-1 says "each file declares exactly one top-level const". It should state whether that covers `checks.js`. In the browser, `checks.js` shares the global lexical scope with the four core scripts. Wrapping it in an IIFE (or `{ … }` block) prevents a stray `const E` from colliding with anything.
4. Node 24 uses syntax detection to decide module type. `checks.js` stays CommonJS only while it has no `import`/`export` and no `package.json` declares `"type": "module"`. Note this so no one adds a package.json later.

**Fix:** Add these four points to AD-9 as one or two lines.

### F4 (LOW): `performance.now()` resolution differs by browser; `< 0.10 ms` assumes Chrome's grain (AD-6 / FR-8)

**Verified:** `performance` and `performance.now` are globals in Node 24 (`typeof performance.now === 'function'`, with no `require('perf_hooks')`). So `metrics.js` can share the same bytes across Node and the browser, as AD-1 requires.

**Caveat:** On a file:// page (an opaque origin, never cross-origin isolated), MDN gives 100 µs resolution for non-isolated contexts. That matches the `< 0.10 ms` label. Firefox's resolution has historically been coarser (`privacy.reduceTimerPrecision`, cited as 1–2 ms by third-party sources). It also becomes about 100 ms if `privacy.resistFingerprinting` is on. In Firefox, late-Game searches may then show a delta of `0` (rendered as `< 0.10 ms`, which is misleading when the grain is 1 ms) or jump straight to `1.00 ms`. This could not be checked locally because Firefox is not installed.

**Fix:** No architecture change. Add an `[ASSUMPTION]` noting that the timer grain varies by browser and that node counts, not ms, are the primary evidence. Check in Firefox during the SM-5 run. Optionally render the zero case as "below timer resolution".

### F5 (INFO): Node 24 LTS status changes in 5 days

From the official schedule (nodejs/Release `schedule.json`): v24 is Active LTS until **2026-10-20**, then Maintenance until 2028-04-30. v26 becomes Active LTS on **2026-10-28**. "24.x LTS" stays accurate and supported through the project. To be precise, the Stack row could read "24.x (LTS; Maintenance from 2026-10-20)". No action needed for a one-day build.

## Claims verified as correct (no action)

| Claim | How verified | Result |
| --- | --- | --- |
| Classic-script top-level `const` is shared across `<script>` tags | Chrome 155 over file://: `b.js` read `Ns` declared in `a.js`; `window.Ns` was undefined | OK (per the HTML/ECMAScript global lexical environment). Firefox follows the same spec but was not tested locally |
| ES modules are blocked on file:// | Chrome 155: `<script type="module">` from file:// did not execute | OK. For Firefox, sources show file:// pages get a unique origin (`privacy.file_unique_origin`, `security.fileuri.strict_origin_policy`), which blocks module loads. NFR-3 forbids modules anyway |
| `vm.runInThisContext` shares top-level `const` across calls; a redeclare throws | Node 24.14.1 | OK (confirms the author's check) |
| `performance.now()` is global in Node 24 | Node 24.14.1 | OK |
| 549,946 / cell 0 (Minimax) and 20,866 / cell 0 (Alpha-Beta), 96.21% | Independent re-implementation from the PRD rules | OK, reproduced exactly |
| 4,520 AI-to-move Boards, 0 mismatches | Same re-implementation, both turn orders | OK, reproduced exactly |
| Names `Game`, `Minimax`, `AlphaBeta`, `Metrics`, `UI`, `App` do not clash with built-in globals | Chrome load test; spec rule: a lexical declaration fails only against a non-configurable own global property, and element-id named properties live on the prototype chain | OK. Keep the IIFE/const pattern |
| Node v24.14.1 installed | `node -v` | OK |

## Sources

- Node.js release schedule: https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
- MDN `performance.now()` (100 µs non-isolated / 5 µs isolated): https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- Firefox file:// unique origin prefs: https://docs.asciidoctor.org/browser-extension/firefox-known-issues/
- Firefox timer precision (third-party): https://incolumitas.com/2021/12/18/on-high-precision-javascript-timers/
- Local experiments: `C:/Users/user/AppData/Local/Temp/claude/ttt-verify/` (`checks.js`, `paint.html` + `cdp.mjs`, `load.html` + `cdp2.mjs`)
