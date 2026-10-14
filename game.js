// Rules engine and the single owner of game state.
// Pure rule functions take a Board (array of 9: 'X' | 'O' | null) and never read the live state,
// so both searches can share them on their private copies.
const Game = (function () {
  'use strict';

  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function legalMoves(board) {
    const moves = [];
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) moves.push(i);
    }
    return moves;
  }

  function winner(board) {
    for (const line of LINES) {
      const mark = board[line[0]];
      if (mark !== null && mark === board[line[1]] && mark === board[line[2]]) {
        return { mark: mark, line: line.slice() };
      }
    }
    return null;
  }

  function isFull(board) {
    return board.indexOf(null) === -1;
  }

  // Scored from `me`'s point of view; depth makes faster wins and slower losses preferred.
  // Returns null while the Game is still in progress.
  function score(board, me, depth) {
    const w = winner(board);
    if (w !== null) return w.mark === me ? 10 - depth : depth - 10;
    if (isFull(board)) return 0;
    return null;
  }

  let state = {
    board: Array(9).fill(null),
    current: 'X',
    status: 'playing',
    winner: null,
    winLine: null,
    generation: 0
  };
  let scoreboard = { x: 0, o: 0, draw: 0 };

  function newGame(firstMark) {
    if (firstMark !== 'X' && firstMark !== 'O') return false;
    state = {
      board: Array(9).fill(null),
      current: firstMark,
      status: 'playing',
      winner: null,
      winLine: null,
      generation: state.generation + 1
    };
    return true;
  }

  function play(cell) {
    if (state.status !== 'playing') return false;
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return false;
    if (state.board[cell] !== null) return false;

    state.board[cell] = state.current;
    const w = winner(state.board);
    if (w !== null) {
      state.status = 'won';
      state.winner = w.mark;
      state.winLine = w.line;
      if (w.mark === 'X') scoreboard.x++;
      else scoreboard.o++;
    } else if (isFull(state.board)) {
      state.status = 'draw';
      scoreboard.draw++;
    } else {
      state.current = state.current === 'X' ? 'O' : 'X';
    }
    return true;
  }

  function resetScores() {
    scoreboard = { x: 0, o: 0, draw: 0 };
  }

  function snapshot() {
    return {
      board: state.board.slice(),
      current: state.current,
      status: state.status,
      winner: state.winner,
      winLine: state.winLine === null ? null : state.winLine.slice(),
      generation: state.generation,
      scoreboard: { x: scoreboard.x, o: scoreboard.o, draw: scoreboard.draw }
    };
  }

  return {
    legalMoves: legalMoves,
    winner: winner,
    isFull: isFull,
    score: score,
    newGame: newGame,
    play: play,
    resetScores: resetScores,
    snapshot: snapshot
  };
})();
