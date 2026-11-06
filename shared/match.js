// Match state on top of the engine. Used by the server for online rooms and by the browser for
// offline games, so both play and measure in exactly the same way. Pure: no I/O.
import { ALGORITHMS, EMPTY, O, X, emptyBoard, isFull, measure, winner } from './engine.js';

export { EMPTY, O, X };
export const HUMAN = X;
export const AI = O;
export const AI_PLAYER_ID = 'AI';

export function createInitialGame({ roomCode, mode, hostId, hostName, algo = 'alphabeta', aiFirst = false }) {
  const isAi = mode === 'ai';
  const now = new Date().toISOString();
  return {
    roomCode,
    mode: isAi ? 'ai' : 'pvp',
    algo: ALGORITHMS.includes(algo) ? algo : 'alphabeta',
    aiFirst: isAi && aiFirst === true,
    board: emptyBoard(),
    currentTurn: isAi && aiFirst === true ? AI : HUMAN,
    status: isAi ? 'playing' : 'waiting',
    winner: null,
    winLine: null,
    players: {
      X: { id: hostId, name: hostName || 'Player X', connected: true },
      O: isAi ? { id: AI_PLAYER_ID, name: 'Minimax AI', connected: true } : null
    },
    lastAi: null,
    aiStats: { turns: 0, mmTotal: 0, abTotal: 0, same: 0 },
    createdAt: now,
    updatedAt: now,
    persisted: false
  };
}

export function symbolOf(game, userId) {
  if (game.players.X?.id === userId) return X;
  if (game.players.O?.id === userId) return O;
  return null;
}

/** An error message, or null if `userId` may play `cell` now. */
export function validateMove(game, userId, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return 'Cell must be an integer from 0 to 8.';
  if (game.status !== 'playing') return 'This game is not currently accepting moves.';
  if (game.board[cell] !== EMPTY) return 'That cell is already occupied.';
  if (!game.players[game.currentTurn] || game.players[game.currentTurn].id !== userId) return 'It is not your turn.';
  return null;
}

export function applyMove(game, symbol, cell) {
  if (game.status !== 'playing' || game.currentTurn !== symbol || game.board[cell] !== EMPTY) {
    throw new Error('Cannot apply this move.');
  }
  game.board[cell] = symbol;
  const w = winner(game.board);
  if (w) {
    game.status = 'finished';
    game.winner = w.mark;
    game.winLine = w.line;
  } else if (isFull(game.board)) {
    game.status = 'finished';
    game.winner = 'draw';
  } else {
    game.currentTurn = symbol === X ? O : X;
  }
  game.updatedAt = new Date().toISOString();
  return game;
}

export function aiToMove(game) {
  return game.mode === 'ai' && game.status === 'playing' && game.currentTurn === AI;
}

/**
 * Run both searches on the current board (the "shadow run"), play the move of the room's
 * selected algorithm, and record the measurement. Returns the cell played, or null.
 */
export function playAiTurn(game) {
  if (!aiToMove(game)) return null;
  const m = measure(game.board, AI);
  if (!m || m.mmMove === null) return null;
  const cell = game.algo === 'minimax' ? m.mmMove : m.abMove;
  game.lastAi = { ...m, played: game.algo };
  game.aiStats.turns++;
  game.aiStats.mmTotal += m.mmNodes;
  game.aiStats.abTotal += m.abNodes;
  if (m.same) game.aiStats.same++;
  applyMove(game, AI, cell);
  return cell;
}

/** The game as sent to clients (internal bookkeeping stripped). */
export function publicGame(game) {
  const { persisted, ...safe } = game;
  return safe;
}
