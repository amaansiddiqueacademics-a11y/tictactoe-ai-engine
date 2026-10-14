---
title: "Adversarial review: ARCHITECTURE-SPINE.md"
reviewed: ARCHITECTURE-SPINE.md (status draft, 2026-10-15)
lens: "Two units that each obey every AD to the letter yet build incompatibly"
created: 2026-10-15
---

# Adversarial Review — Architecture Spine

## Verdict

**Needs revision before build (no structural rework).** The paradigm, dependency graph and ownership split are sound. The core is well fenced. The holes are at the seams the spine names but does not pin down: the AI-turn scheduler in `main.js`, the Compare/record data shape, the view object, the `newGame` argument, and three Alpha-Beta details that decide whether the build gets 20,866. Each one lets two compliant implementations disagree. 14 findings: 4 high, 6 medium, 4 low. Every one comes with a rule to add.

Two counts were checked with a scratch prototype (not kept), using the PRD rules:

| Variant (each still compliant with AD-3/AD-4 as written) | Alpha-Beta Nodes, empty Board |
| --- | --- |
| Cutoff `alpha >= beta`, root alpha raised after each child | **20,866** (reference) |
| Cutoff `alpha > beta`, root alpha raised | 125,500 |
| Cutoff `alpha >= beta`, root alpha **not** raised | 34,203 |
| Cutoff `alpha > beta`, root alpha not raised | 130,871 |

All four pick cell 0, so the same-move check passes for each one while SM-3 fails for three of them.

Also checked: in Node 24, top-level `const` declared through separate `vm.runInThisContext` calls is visible to later scripts and to `checks.js`, and `performance` is a global. AD-1 and AD-9 work as written.

---

## Findings

Severity: **H** = the build will plausibly break a gate or a demo journey. **M** = integration rework or a visible inconsistency. **L** = hygiene.

### F1 (H) — Dropping an AI turn leaves `aiThinking` true: deadlock after Reset or mode change during the yield

**Clashing pair:** `main.js` scheduler (A) vs `main.js` handlers (B). Both follow AD-7.

- AD-7 ignores only cell clicks and Compare while `aiThinking` is true. Reset, mode, first-player and algorithm changes stay live during the `setTimeout` yield.
- The sequence diagram sets `aiThinking = false` only on the success path. The "drop the result" branch does not reset it.
- Scenario: AI-first Game, so the AI turn is scheduled. The user presses Reset during the yield. B calls `Game.newGame`, and the new Game is also AI-first, so B tries to schedule the next AI turn, but a natural `if (aiThinking) return` guard blocks it. The old timeout fires, sees a different generation and drops its result. Nothing ever clears `aiThinking`. The board is frozen showing "AI thinking…", and cell clicks are ignored forever.
- Without the guard, two timeouts are pending. The generation check saves the Board, but the code relies on luck.

**Rule (tighten AD-7):**
- `main.js` holds one `pendingTimer` id. `startGame()` (see F2) calls `clearTimeout(pendingTimer)` and sets `aiThinking = false` *before* `Game.newGame`.
- The timeout callback sets `aiThinking = false` on **every** exit path, including the drop.
- Keep the generation check as a second safeguard.

### F2 (H) — No single trigger for the AI turn; Game and Match history reset through separate paths

**Clashing pair:** `onReset` / `onMode` / `onFirst` / `onCell` handlers written separately.

- The spine never says *who* decides that it is the AI's turn. Each handler must remember to do it: after `newGame` when the AI moves first, after a human `play` in Player vs AI, and never in Player vs Player. One handler will forget. The likely one is `onFirst` (switching to "AI first" leaves the Board waiting for a human who cannot move) or `onMode` (switching from Player vs Player to Player vs AI).
- `Game.newGame` (state in `game.js`) and `Metrics.reset()` (history in `metrics.js`) are two state holders that must reset together for FR-9 ("Reset clears the Match history"). AD-6 and AD-2 each own half, and nothing ties them together. `onMode` can call one and not the other, and the summary then carries Move records from the previous Game.

**Rule (new AD-10, "One transition funnel in `main.js`"):**
- `startGame()` is the only caller of `Game.newGame` and `Metrics.reset`. It calls both, then calls `afterChange()`. Reset, a mode change and a first-player change all call `startGame()`. An algorithm change does **not** call it (FR-7).
- `afterChange()` is the only scheduler, and every Game change ends by calling it. It renders. Then, if `mode === 'pvai'` and `status === 'playing'` and `current === 'O'` and `!aiThinking`, it schedules the AI turn.
- Handlers never call `setTimeout` or `runAiTurn` directly.

### F3 (H) — The Alpha-Beta details that produce 20,866 are not in the spine

**Clashing pair:** `minimax.js` vs `alphabeta.js` (or two possible `alphabeta.js` builds). Both obey AD-3 and AD-4.

- **Cutoff operator:** the spine has none. `>` gives 125,500 Nodes instead of 20,866 (table above). The same-move check still passes, so the error shows up only at the SM-3 gate.
- **Root window:** only the PRD addendum mentions "root searched with a full window, then alpha raised after each child". The spine says only "Depth is 0 at the root". Not raising alpha gives 34,203. The spine claims to add the rules the PRD leaves open; the code shape that fixes this count is one of them.
- **Root counted twice or not at all:** the natural shape is `search()` with its own root loop calling a recursive `value()` helper. If `search` does not count the root, Minimax gives 549,945. If `search` counts it *and* also calls `value(board, 0)`, the root is counted twice. AD-4 allows both.
- **Terminal test:** `Game.score` returns `null` for "not over" and `0` for a draw. A falsy test such as `if (!s)` or `if (s)` treats a draw as "keep searching" and recurses from a full Board. That loop produces no children but changes the counts in other variants.

**Rule (tighten AD-4, giving the code shape):**
- `search(board, me)`: `b = board.slice(); nodes = 1` (the root is counted here); `if (Game.score(b, me, 0) !== null) return {bestMove: null, nodesVisited: 1}`.
- Root loop over `Game.legalMoves(b)` in Cell order, calling `value(b, 1, …)` on each child. Replace the best move only when `v > best`.
- `AlphaBeta` only: root `alpha = -Infinity`, `beta = +Infinity`, and after each root child `alpha = Math.max(alpha, v)`.
- `value(b, depth, toMove, …)` does `nodes++` as its first statement, then `const s = Game.score(b, me, depth); if (s !== null) return s;`.
- Inner cutoff: update `alpha` or `beta` first, then `if (alpha >= beta) break`. Use fail-soft returns.
- Add a gate to `checks.js` that asserts **125,500 ≠ result**, as a regression trap for the cutoff operator.
- Pin the side to move as an explicit parameter: `toMove`, flipped `'X'` ↔ `'O'` on each ply. It is never inferred from piece counts. This mirrors the convention that `current` is stored, not inferred.

### F4 (H) — The Compare result and Move record shapes are not defined, so the panel gets two shapes

**Clashing pair:** `metrics.js` vs `main.js` (and then `ui.js`).

- AD-6: `runAiTurn` returns `{move, record}`, and `compare` "returns the same measurements". That could be a full Move record (with what `turn`?), a `{mm:{move,nodes,ms}, ab:{…}}` pair, or two raw `{bestMove, nodesVisited, timeMs}` objects. AD-8 says the panel is built from "the latest record **or** Compare result", so `main.js` would need two mapping branches.
- There are also two names for one field: AD-5 says Metrics "adds `timeMs`", but the record stores it as `mmMs`/`abMs`. AD-4 uses `{bestMove, nodesVisited}`, but the PRD addendum says `{move, nodes}`.
- `turn` has no definition. It could be a 1-based AI-turn index (`history.length + 1`, set by Metrics) or a ply number (filled cells + 1, passed in by `main`). Both satisfy "the PRD field names".
- The same-move flag (FR-8) and `pctPruned` have no owner. `ui.js` could compare `mmMove === abMove` itself, which is a decision in the view.

**Rule (tighten AD-5 and AD-6):**
- Define `Measurement = {mmMove, mmNodes, mmMs, abMove, abNodes, abMs}`. `Metrics.compare(board, me)` returns a `Measurement`.
- A Move record is `{turn, board, …Measurement}`, where `turn` is the **1-based AI-turn index within the Game, assigned by Metrics** (`history.length + 1`).
- `runAiTurn` returns `{move, record}`.
- Internally, Metrics times each search and maps `{bestMove, nodesVisited}` + delta into the `mm*` and `ab*` fields. Drop the name `timeMs`.
- `Metrics.summary()` returns `{aiTurns, sameMoveTurns, mmTotal, abTotal, pctPruned}` (numbers) plus `last` (a copy of the latest record or `null`). `history()`, if it exists, returns copies.

### F5 (M) — The view object has no schema

**Clashing pair:** `main.js` (builds the view) vs `ui.js` (renders it). Both obey AD-8.

- Who formats? AD-6 says `formatMs` and `pctPruned` are "the only formatters", and the graph forbids `ui.js` from calling `Metrics`. A `ui.js` author who receives raw numbers will reach for `toFixed(2)`, which breaks the "only formatters" rule and the `< 0.10 ms` case.
- Is "Compare disabled when the Game has ended" (FR-11) a `disabled` attribute set by `ui.js` from `status`, which is a decision in the view, or a flag from `main`? The same question applies to "clicks ignored while thinking" (FR-10): does `main` ignore them, does `ui` stop listening, or both?
- Does a Compare result stay on screen after the next move? Does an AI-turn panel stay on screen after Reset? The spine does not say.

**Rule (new AD-8a, view schema):**
```text
view = {
  cells: ['X'|'O'|null ×9], winLine: [a,b,c] | null,
  status: 'playing'|'won'|'draw', turnText: string,        // "X to move" / "AI thinking…" / "O wins" / "Draw"
  settings: {mode, first, algorithm},
  controls: {cellsEnabled: bool, compareEnabled: bool},
  scoreboard: {x, o, draw},
  panel: null | {source: 'ai'|'compare', mmMove, abMove, mmNodes, abNodes,
                 mmTime: string, abTime: string, pctPruned: string, sameMove: bool},
  summary: {mmTotal, abTotal, pctPruned: string, sameText: string}   // "same move on 3 / 3 AI turns"
}
```
- All strings are formatted in `main.js` through `Metrics.formatMs` and `Metrics.pctPruned`. `ui.js` writes values and never computes or formats them.
- Any Game change clears a Compare panel. `startGame()` clears the panel completely.

### F6 (M) — `Game.newGame(first)` takes an unspecified kind of value

**Clashing pair:** `game.js` vs `main.js`.

- The settings convention says `first` is `'human'` or `'ai'`. If `game.js` accepts those, it learns about humans and the AI, which breaks the paradigm, and Player vs Player is undefined. If it accepts a mark, `main` must map it. Either reading is defensible from the spine.
- In Player vs Player, what does `first` mean? X always first, or the setting maps to X/O?
- What does `Game.play` return on success: `true`, a snapshot, or the result? The spine says only what it returns on failure.

**Rule (tighten AD-2):**
- `Game.newGame(firstMark)` with `firstMark` in `'X' | 'O'`.
- `main` maps: Player vs AI with `first === 'ai'` gives `'O'`, otherwise `'X'`; Player vs Player always gives `'X'` (or state explicitly that it follows the setting, but pick one).
- `Game.play(cell)` returns `true` on success and `false` on an illegal move or a finished Game.

### F7 (M) — The AI-turn sequence hard-codes `'O'`, and nothing says Compare uses `current`

**Clashing pair:** the `main.js` Compare handler vs AD-4's stated aim.

- AD-4 says `me` must be the side to move so that Compare works in Player vs Player when X is to move. But the only call site the spine shows (AD-7) passes the literal `'O'`. A `main` author who copies AD-7 for Compare passes `'O'` with X to move. In UJ-2 the result is then "the best move for O" in an X-to-move position: a wrong answer that still shows Same move ✓.
- Compare during the human's turn in Player vs AI has the same problem.

**Rule (AD-7 / AD-10):**
- `main` passes `snap.current` as `me` to **both** `runAiTurn` and `compare`.
- For an AI turn, `afterChange` already guarantees `current === 'O'`.
- `checks.js` adds one Compare-style case with X to move.

### F8 (M) — `setTimeout(…, 0)` does not guarantee a paint

**Clashing pair:** `ui.js` gate ("'AI thinking…' paints before the search") vs `main.js` per AD-7.

- A 0 ms timeout queued straight after a DOM write can run before the next frame in both Chrome and Firefox. A synchronous search of about 0.12 s or more then freezes with the old text still showing. SM-4 ("no frozen paint") then becomes flaky, and the `ui.js` step-5 gate can pass on one machine and fail on another.
- The brief addendum allows `setTimeout` or `requestAnimationFrame`. The spine picked the weaker option.

**Rule (AD-7):** schedule with `requestAnimationFrame(() => { pendingTimer = setTimeout(runAi, 0); })`, which yields one frame and then a task, so the frame is painted first. `clearTimeout` still works. Also track the rAF id and cancel it with `cancelAnimationFrame` in `startGame()`.

### F9 (M) — `ui.js` can query the DOM before it exists

**Clashing pair:** `index.html` vs `ui.js`. Both obey AD-1 and AD-8.

- AD-8 lets `ui.js` keep DOM references, and AD-1 says each file is an IIFE that runs at load. Collecting `document.getElementById` references in the IIFE body is natural. If `index.html` puts the scripts in `<head>` (still in the required order), every reference is `null`.
- AD-1 also does not say when `main.js` starts the app.

**Rule (AD-1 / Structural Seed):**
- Scripts go at the end of `<body>`, without `defer` or `async`.
- `ui.js` touches the DOM only inside `UI.bind`/`UI.init`, never in the IIFE body.
- `main.js` ends with exactly one start call: `App.start()`, which does `UI.bind(handlers)` and then `startGame()`.

### F10 (M) — Whether an algorithm change during the yield applies to that turn is open

**Clashing pair:** `onAlgo` vs the scheduler.

- The algorithm control is not locked while `aiThinking` is true. Does the pending turn use the setting from when it was scheduled or from when it runs? FR-7 says "from the next AI turn", which is ambiguous for a turn that has been scheduled but not run.
- This does not matter for the result (both algorithms pick the same cell), but the panel's "selected" highlight and the viva story differ.

**Rule:** `runAi` reads `settings.algorithm` when the callback runs. Alternatively, `controls` disables every settings input while `aiThinking`; choose one and write it into AD-7.

### F11 (L) — `pctPruned` and `formatMs` signatures are vague

- Does `pctPruned(mm, ab)` return a number or a 2-dp string? Does `formatMs` take a delta or a start and end? FR-9's overall % pruned comes "from the totals" (`pctPruned(mmTotal, abTotal)`), not as an average of each move's %. Averaging also obeys AD-6 as written.

**Rule:**
- `Metrics.pctPruned(mm, ab)` → string with 2 dp, such as `"96.21%"`, and it is applied only to totals or to one record.
- `Metrics.formatMs(deltaMs)` → `"0.00 ms"`-style string, with `"< 0.10 ms"` when `deltaMs === 0`.
- `summary()` exposes raw totals. Only these two functions turn them into strings.

### F12 (L) — The 4,520 Boards are not defined, so `checks.js` can test the wrong set

- Two `checks.js` builds can each claim "0 mismatches over 4,520" while enumerating different sets: with or without terminal Boards, with or without deduplication, and with or without the empty Board (AI first).
- **Rule (AD-9):**
  - Enumerate the reachable Boards for X-first and O-first by DFS from empty, with the AI fixed as `'O'`.
  - Keep the non-terminal Boards where O is to move, deduplicated per order by board string.
  - **Assert that the set size is 4,520** before checking mismatches.

### F13 (L) — The companion is out of step with the spine

- `viva-module-dataflow.md` shows `runAiTurn(board)` (one argument) and says `main.js` "gives a copy of the Board to metrics.js". The spine says `runAiTurn(board, me, selected)`.
- **Fix:** update the companion's labels when F4 and F7 land, so the viva one-pager does not contradict the code.

### F14 (L) — `Metrics` state is not fenced as strongly as `Game` state

- AD-2 says callers never receive the live array. AD-6 says nothing similar for the Match history or `summary().last`. If `main` keeps a reference to `record` and the view mutates it, `Metrics` is corrupted.
- **Rule:** Metrics returns copies of records, in the same way as `Game.snapshot()`.

---

## Requirements coverage

| Req | Covered by | Gap |
| --- | --- | --- |
| FR-1 | AD-2, AD-3 | OK. Rejecting a move "after the Game has ended" is implied by `play → false`. State this explicitly. |
| FR-2 | AD-3 | OK |
| FR-3 / FR-4 | AD-3, AD-4 | **F3**: cutoff, root window and root count are not pinned in the spine |
| FR-5 | AD-4 (via PRD) | Strict `>` lives only in the PRD; restate it in AD-4 because it is the one-character trap. The ">= breaks empty-Board" check is not listed in AD-9. Add it as a documented manual check or a mutation check. |
| FR-6 | AD-4, AD-7 | No gate. SM-1 is manual. Optionally add to `checks.js`: "from every human-to-move Board, no line for X after the AI replies". The same enumeration costs little. |
| FR-7 | AD-5, AD-6, AD-7 | F1, F2, F10 |
| FR-8 | AD-6, AD-8 | **F4, F5**: same-move flag and formatting owner |
| FR-9 | AD-6 | **F2**: Metrics.reset is not tied to newGame; F11 total % |
| FR-10 | AD-7, AD-8 | **Quietly dropped:** "Changing the mode or who moves first starts a new Game" appears nowhere in the spine (only as handler names). Winning-line highlight and draw announcement need `winLine` and `status` in the view (F5). Paint guarantee (F8). |
| FR-11 | AD-4, AD-6 | **F7**: `me` for Compare; **quietly dropped:** "disabled when the Game has ended" has no owner (F5) |
| FR-12 | AD-2, AD-8 | The `first` setting in Player vs Player is undefined (F6) |
| FR-13 | AD-2 | OK. Reset Scores → `Game.resetScores()`. It must not trigger `startGame()`; state that. |
| NFR-1 | AD-7 | F8 |
| NFR-2 / NFR-3 | AD-1 | F9 (script placement) |
| NFR-4 | Paradigm | OK |
| NFR-5 | AD-3 | F3: the shared *code shape* should be in the spine, not only the shared functions |

## Proposed additions, condensed

1. **AD-7 (tightened):** one `pendingTimer` and rAF id; `aiThinking = false` on every exit; yield with rAF followed by `setTimeout`; `me = snap.current`; read the algorithm when the callback runs.
2. **AD-10 (new):** `startGame()` is the only caller of `Game.newGame` and `Metrics.reset`; `afterChange()` is the only AI scheduler.
3. **AD-4 (tightened):** root counted in `search`, children through `value(…, depth + 1)`; `!== null` terminal test; explicit `toMove`; root window (−∞, +∞) with alpha raised after each child; cutoff `alpha >= beta` after the update; null `bestMove` on a terminal root.
4. **AD-5/AD-6 (tightened):** `Measurement` type; Move record = `{turn (1-based AI-turn index set by Metrics), board, …Measurement}`; `summary()` shape; formatter signatures; copies only.
5. **AD-8a (new):** fixed view schema; every string formatted in `main`; `controls` flags; panel lifetime.
6. **AD-2 (tightened):** `newGame('X'|'O')`; Player vs Player always starts with X; `play` returns `true`/`false`.
7. **AD-1 / Seed:** scripts at the end of `body`; no DOM access while the IIFE loads; a single `App.start()`.
8. **AD-9 (tightened):** an explicit 4,520 enumeration with a count assert; optional regression traps for the 125,500 (wrong cutoff) and 34,203 (root window not raised) counts.
