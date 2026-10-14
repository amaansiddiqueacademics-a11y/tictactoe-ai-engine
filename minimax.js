// Standard Minimax: full depth, no pruning, no move ordering, no memoization.
// A Node is one entry into the search, including the root and terminal states,
// so the empty Board reports the full game-tree size of 549,946.
const Minimax = (function () {
  'use strict';

  function other(mark) {
    return mark === 'X' ? 'O' : 'X';
  }

  // `me` is the side to move at the root ('X' or 'O'); every score is from `me`'s point of view.
  // Returns null for any other `me`.
  function search(board, me) {
    if (me !== 'X' && me !== 'O') return null;
    const b = board.slice();
    let nodes = 1;

    if (Game.score(b, me, 0) !== null) {
      return { bestMove: null, nodesVisited: nodes };
    }

    function value(b, depth, toMove) {
      nodes++;
      const s = Game.score(b, me, depth);
      if (s !== null) return s;

      const maximizing = toMove === me;
      let best = maximizing ? -Infinity : Infinity;
      for (const cell of Game.legalMoves(b)) {
        b[cell] = toMove;
        const v = value(b, depth + 1, other(toMove));
        b[cell] = null;
        if (maximizing ? v > best : v < best) best = v;
      }
      return best;
    }

    let bestMove = null;
    let bestScore = -Infinity;
    for (const cell of Game.legalMoves(b)) {
      b[cell] = me;
      const v = value(b, 1, other(me));
      b[cell] = null;
      // Strictly better only: equal scores keep the earlier cell, matching Alpha-Beta.
      if (v > bestScore) {
        bestScore = v;
        bestMove = cell;
      }
    }
    return { bestMove: bestMove, nodesVisited: nodes };
  }

  return { search: search };
})();
