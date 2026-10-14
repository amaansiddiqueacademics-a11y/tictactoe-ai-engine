- source_spec: `_bmad-output/implementation-artifacts/spec-step4-metrics.md`
  summary: Update ARCHITECTURE-SPINE.md AD-6 to record that `Metrics.pctPruned` returns null when Minimax Nodes are 0, `formatPct(null)` shows `—`, and `formatNodes` is a fourth formatter.
  evidence: metrics.js implements these (checked by checks.js); the spine still says pctPruned returns a number and lists three formatters, so a future builder could write a second Node formatter or miss the null case.
- source_spec: `_bmad-output/implementation-artifacts/spec-step6-main.md`
  summary: Update ARCHITECTURE-SPINE.md AD-7/AD-8 for what the build added — the 200 ms fallback timer in `afterPaint`, the "Comparing…" busy state, the AI-turn error state, the algorithm captured at turn start, the `lastMove.played` view field, and `Metrics.formatSame`.
  evidence: main.js, ui.js and metrics.js implement these and the headless harnesses check them; the spine still describes rAF→setTimeout only and the original view shape.
