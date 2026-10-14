// Minimax with Alpha-Beta Pruning. Same Node rule (every entry, including the root and
// terminal states), scoring, Cell order and tie-break as minimax.js, so the only difference
// between the two is the pruning window. The empty Board reports 20,866 Nodes.
// Two details fix that count: the cutoff is `alpha >= beta` (with `>` it is 125,500), and
// root alpha is raised after each child (without that it is 34,203).
const AlphaBeta = (function () {
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

    function value(b, depth, toMove, alpha, beta) {
      nodes++;
      const s = Game.score(b, me, depth);
      if (s !== null) return s;

      const maximizing = toMove === me;
      let best = maximizing ? -Infinity : Infinity;
      for (const cell of Game.legalMoves(b)) {
        b[cell] = toMove;
        const v = value(b, depth + 1, other(toMove), alpha, beta);
        b[cell] = null;
        if (maximizing) {
          if (v > best) best = v;
          if (best > alpha) alpha = best;
        } else {
          if (v < best) best = v;
          if (best < beta) beta = best;
        }
        // The rest of this node's moves cannot change the decision above it.
        if (alpha >= beta) break;
      }
      return best;
    }

    // Full window at the root; alpha is raised after each child so later children are pruned
    // against the best found so far. A child that gets pruned stops once its value is <= alpha,
    // and alpha is exactly bestScore, so it can never be strictly better than the best: the
    // strict `>` then picks the same cell as Minimax. Raising alpha past bestScore would break this.
    let alpha = -Infinity;
    const beta = Infinity;
    let bestMove = null;
    let bestScore = -Infinity;
    for (const cell of Game.legalMoves(b)) {
      b[cell] = me;
      const v = value(b, 1, other(me), alpha, beta);
      b[cell] = null;
      if (v > bestScore) {
        bestScore = v;
        bestMove = cell;
      }
      if (bestScore > alpha) alpha = bestScore;
    }
    return { bestMove: bestMove, nodesVisited: nodes };
  }

  return { search: search };
})();
