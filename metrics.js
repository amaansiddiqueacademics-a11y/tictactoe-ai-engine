// Shadow run, Match history and the only number formatters.
// This is the only place that times the searches, so both use the same clock and wrapper.
// Minimax always runs first, so Alpha-Beta may gain slightly from a warmer JIT; Node counts,
// not times, are the primary evidence.
const Metrics = (function () {
  'use strict';

  let history = [];

  function copyRecord(r) {
    return Object.assign({}, r, { board: r.board.slice() });
  }

  function timed(search, board, me) {
    const start = performance.now();
    const result = search(board, me);
    return { result: result, ms: performance.now() - start };
  }

  // Both searches on the same Board. Returns a Measurement, or null for an invalid side to move.
  function measure(board, me) {
    const mm = timed(Minimax.search, board, me);
    const ab = timed(AlphaBeta.search, board, me);
    if (mm.result === null || ab.result === null) return null;
    return {
      mmMove: mm.result.bestMove,
      mmNodes: mm.result.nodesVisited,
      mmMs: mm.ms,
      abMove: ab.result.bestMove,
      abNodes: ab.result.nodesVisited,
      abMs: ab.ms
    };
  }

  // The only path that appends a Move record. `selected` is 'minimax' or 'alphabeta';
  // its move is the one played, the other algorithm is the Shadow run.
  // The caller passes a legal Board and the side actually to move (main.js uses Game.snapshot()).
  function runAiTurn(board, me, selected) {
    if (selected !== 'minimax' && selected !== 'alphabeta') return null;
    const m = measure(board, me);
    if (m === null || m.mmMove === null) return null;

    const record = Object.assign({ turn: history.length + 1, board: board.slice() }, m);
    history.push(record);
    return {
      move: selected === 'minimax' ? m.mmMove : m.abMove,
      record: copyRecord(record)
    };
  }

  // Read-only analysis: never appended, so Compare runs stay out of the Game totals.
  function compare(board, me) {
    return measure(board, me);
  }

  function summary() {
    let mmTotal = 0;
    let abTotal = 0;
    let sameCount = 0;
    for (const r of history) {
      mmTotal += r.mmNodes;
      abTotal += r.abNodes;
      if (r.mmMove === r.abMove) sameCount++;
    }
    return {
      aiTurns: history.length,
      mmTotal: mmTotal,
      abTotal: abTotal,
      pctPruned: pctPruned(mmTotal, abTotal),
      sameCount: sameCount
    };
  }

  function getHistory() {
    return history.map(copyRecord);
  }

  function reset() {
    history = [];
  }

  function pctPruned(mmNodes, abNodes) {
    if (mmNodes === 0) return null;
    return (mmNodes - abNodes) / mmNodes * 100;
  }

  // Browsers clamp performance.now() to about 0.1 ms, so a measured delta of 0 means
  // "faster than the clock can tell" and is shown as a bound.
  function formatMs(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '—';
    return ms === 0 ? '< 0.10 ms' : ms.toFixed(2) + ' ms';
  }

  function formatPct(pct) {
    return pct === null ? '—' : pct.toFixed(2) + '%';
  }

  function formatNodes(n) {
    return n.toLocaleString('en-US');
  }

  // "N / M (P%)" for the same-move line of the Game summary.
  function formatSame(sameCount, aiTurns) {
    if (aiTurns === 0) return '—';
    return sameCount + ' / ' + aiTurns + ' (' + Math.round(sameCount / aiTurns * 100) + '%)';
  }

  return {
    runAiTurn: runAiTurn,
    compare: compare,
    summary: summary,
    history: getHistory,
    reset: reset,
    pctPruned: pctPruned,
    formatMs: formatMs,
    formatPct: formatPct,
    formatNodes: formatNodes,
    formatSame: formatSame
  };
})();
