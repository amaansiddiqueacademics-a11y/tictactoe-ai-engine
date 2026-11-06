// Tic-Tac-Toe engine shared by the server and the browser.
//
// A Board is an array of 9 cells: 'X', 'O' or '' (empty), indexed
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
//
// Both searches use the same rules, scoring, cell order and tie-break, so the only
// difference between them is the alpha-beta window. A Node is one entry into the search,
// counting the root and terminal positions. On the empty Board that gives:
//   Minimax    549,946 Nodes (the full game tree)
//   Alpha-Beta  20,866 Nodes (same move, about 96% fewer Nodes)

export const X = 'X';
export const O = 'O';
export const EMPTY = '';
export const ALGORITHMS = ['minimax', 'alphabeta'];

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

export function other(mark) {
  return mark === X ? O : X;
}

export function emptyBoard() {
  return Array(9).fill(EMPTY);
}

export function isMark(mark) {
  return mark === X || mark === O;
}

export function legalMoves(board) {
  const moves = [];
  for (let i = 0; i < 9; i++) if (board[i] === EMPTY) moves.push(i);
  return moves;
}

/** The winning mark and its line, or null. */
export function winner(board) {
  for (const line of LINES) {
    const mark = board[line[0]];
    if (mark !== EMPTY && mark === board[line[1]] && mark === board[line[2]]) {
      return { mark, line: line.slice() };
    }
  }
  return null;
}

export function getWinner(board) {
  const w = winner(board);
  return w ? w.mark : null;
}

export function isFull(board) {
  return !board.includes(EMPTY);
}

export function isTerminal(board) {
  return winner(board) !== null || isFull(board);
}

/**
 * Score from `me`'s point of view, or null while the game is still in progress.
 * Depth makes faster wins and slower losses preferred: win = 10 - depth, loss = depth - 10.
 */
export function score(board, me, depth) {
  const w = winner(board);
  if (w !== null) return w.mark === me ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;
  return null;
}

function validBoard(board) {
  return Array.isArray(board) && board.length === 9 && board.every((c) => c === EMPTY || isMark(c));
}

// Depth-first search over a private copy `b`, scored from `me`'s point of view.
// `prune` switches the alpha-beta window on; `counter.nodes` counts every position entered.
function makeValue(b, me, prune, counter) {
  return function value(depth, toMove, alpha, beta) {
    counter.nodes++;
    const s = score(b, me, depth);
    if (s !== null) return s;

    const maximizing = toMove === me;
    let best = maximizing ? -Infinity : Infinity;
    for (let cell = 0; cell < 9; cell++) {
      if (b[cell] !== EMPTY) continue;
      b[cell] = toMove;
      const v = value(depth + 1, other(toMove), alpha, beta);
      b[cell] = EMPTY;
      if (maximizing) {
        if (v > best) best = v;
        if (prune && best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (prune && best < beta) beta = best;
      }
      // The remaining moves here cannot change the decision above this node.
      if (prune && alpha >= beta) break;
    }
    return best;
  };
}

function run(board, me, prune) {
  if (!isMark(me) || !validBoard(board)) return null;
  const b = board.slice();
  const counter = { nodes: 1 };
  if (score(b, me, 0) !== null) return { bestMove: null, bestScore: null, nodesVisited: 1 };
  const value = makeValue(b, me, prune, counter);

  // Root: alpha is raised after each child so later children are pruned against the best so far.
  // A pruned child stops once its value is <= alpha (= bestScore), so it can never be strictly
  // better, and the strict `>` below picks the same cell as plain Minimax.
  let alpha = -Infinity;
  let bestMove = null;
  let bestScore = -Infinity;
  for (let cell = 0; cell < 9; cell++) {
    if (b[cell] !== EMPTY) continue;
    b[cell] = me;
    const v = value(1, other(me), alpha, Infinity);
    b[cell] = EMPTY;
    if (v > bestScore) {
      bestScore = v;
      bestMove = cell;
    }
    if (prune && bestScore > alpha) alpha = bestScore;
  }
  return { bestMove, bestScore, nodesVisited: counter.nodes };
}

/** Standard Minimax: full depth, no pruning. Returns null for an invalid board or side. */
export function minimax(board, me) {
  return run(board, me, false);
}

/** Minimax with Alpha-Beta pruning: same move as minimax(), fewer Nodes. */
export function alphaBeta(board, me) {
  return run(board, me, true);
}

export function search(board, me, algorithm) {
  if (algorithm === 'minimax') return minimax(board, me);
  if (algorithm === 'alphabeta') return alphaBeta(board, me);
  return null;
}

/** The best move for `me` using alpha-beta (the fast path), or null if the game is over. */
export function findBestMove(board, me = O) {
  const r = alphaBeta(board, me);
  return r ? r.bestMove : null;
}

export function pctPruned(mmNodes, abNodes) {
  if (!mmNodes) return null;
  return ((mmNodes - abNodes) / mmNodes) * 100;
}

/**
 * Run both searches on the same Board with the same clock.
 * Minimax runs first, so Alpha-Beta may gain slightly from a warmer JIT;
 * Node counts, not times, are the primary evidence.
 */
export function measure(board, me) {
  let t = now();
  const mm = minimax(board, me);
  const mmMs = now() - t;
  t = now();
  const ab = alphaBeta(board, me);
  const abMs = now() - t;
  if (mm === null || ab === null) return null;
  return {
    mmMove: mm.bestMove,
    mmNodes: mm.nodesVisited,
    mmMs,
    abMove: ab.bestMove,
    abNodes: ab.nodesVisited,
    abMs,
    same: mm.bestMove === ab.bestMove,
    pctPruned: pctPruned(mm.nodesVisited, ab.nodesVisited)
  };
}

/**
 * Exact minimax score of every empty cell for `me`. Each root move gets a full window, so
 * the scores are exact even with pruning on. `nodes` counts every position visited.
 */
export function evaluateMoves(board, me, prune) {
  const scores = Array(9).fill(null);
  if (!isMark(me) || !validBoard(board) || isTerminal(board)) return { scores, best: null, nodes: 0 };
  const b = board.slice();
  const counter = { nodes: 0 };
  const value = makeValue(b, me, prune, counter);
  let best = null;
  let bestScore = -Infinity;
  for (const cell of legalMoves(b)) {
    b[cell] = me;
    scores[cell] = value(1, other(me), -Infinity, Infinity);
    b[cell] = EMPTY;
    if (scores[cell] > bestScore) {
      bestScore = scores[cell];
      best = cell;
    }
  }
  return { scores, best, nodes: counter.nodes };
}
