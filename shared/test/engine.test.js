// Engine gate tests (ported from the original checks.js): rules, scoring, both searches,
// and the same-move gate over every AI-turn Board.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine.js';

const B = (text) => text.split('').map((c) => (c === '.' ? '' : c));

test('legal moves', () => {
  assert.deepEqual(E.legalMoves(E.emptyBoard()), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(E.legalMoves(B('X...O...X')), [1, 2, 3, 5, 6, 7]);
});

test('every line wins for both marks', () => {
  for (const mark of ['X', 'O']) {
    for (const line of E.LINES) {
      const b = E.emptyBoard();
      line.forEach((i) => { b[i] = mark; });
      assert.deepEqual(E.winner(b), { mark, line });
    }
  }
});

test('draw, in-progress and win-on-last-cell', () => {
  const draw = B('XOXXOOOXX');
  assert.equal(E.winner(draw), null);
  assert.ok(E.isFull(draw) && E.isTerminal(draw));
  assert.ok(!E.isFull(B('XO.......')) && !E.isTerminal(B('XO.......')));
  assert.equal(E.score(B('XOXOXOOXX'), 'X', 9), 1, 'full board with a line is a win, not a draw');
});

test('scoring', () => {
  const xWins = B('XXXOO....');
  assert.equal(E.score(xWins, 'X', 3), 7);
  assert.equal(E.score(xWins, 'O', 3), -7);
  assert.equal(E.score(B('XOXXOOOXX'), 'X', 9), 0);
  assert.equal(E.score(B('XO.......'), 'X', 2), null);
  assert.ok(E.score(xWins, 'X', 1) > E.score(xWins, 'X', 5), 'faster win scores higher');
  assert.deepEqual(xWins, B('XXXOO....'), 'rule functions do not mutate input');
});

for (const [name, fn, emptyNodes] of [['Minimax', E.minimax, 549946], ['Alpha-Beta', E.alphaBeta, 20866]]) {
  test(`${name}: empty Board = ${emptyNodes} Nodes, plays cell 0`, () => {
    const r = fn(E.emptyBoard(), 'O');
    assert.equal(r.nodesVisited, emptyNodes);
    assert.equal(r.bestMove, 0);
    assert.deepEqual(fn(E.emptyBoard(), 'X'), r);
    assert.equal(fn(E.emptyBoard(), 'x'), null);
    assert.equal(fn(E.emptyBoard()), null);
    assert.equal(fn(['?', '', '', '', '', '', '', '', ''], 'O'), null);
  });

  test(`${name}: tactical positions`, () => {
    const positions = [
      ['XOX.O.X..', 'O', 7, 'takes the immediate win over a slower one'],
      ['OXO.X.O..', 'X', 7, 'takes the immediate win (X)'],
      ['XO.X.....', 'O', 6, 'blocks the threat'],
      ['OX.O.....', 'X', 6, 'blocks the threat (X)'],
      ['XOXO.X...', 'O', 8, 'finds the deeper best move'],
      ['XOXOO.X..', 'O', 5, 'equal wins keep the earlier cell'],
      ['XOXXOOOX.', 'X', 8, 'plays the last cell'],
      ['OO.XX....', 'O', 2, 'AI takes immediate win'],
      ['XX.O...O.', 'O', 2, 'AI blocks immediate loss']
    ];
    for (const [text, me, cell, why] of positions) {
      const b = B(text);
      assert.equal(fn(b, me).bestMove, cell, `${why}: ${text}`);
      assert.deepEqual(b, B(text), 'input Board not mutated');
    }
    assert.equal(fn(B('XOXXOOOX.'), 'X').nodesVisited, 2);
    assert.deepEqual(fn(B('XXXOO....'), 'O'), { bestMove: null, bestScore: null, nodesVisited: 1 });
    assert.deepEqual(fn(B('XOXXOOOXX'), 'O'), { bestMove: null, bestScore: null, nodesVisited: 1 });
  });

  test(`${name}: never loses against every possible human line`, () => {
    for (const ai of ['O', 'X']) {
      for (const aiFirst of [false, true]) {
        let humanWins = 0;
        (function play(b, toMove) {
          const w = E.winner(b);
          if (w) { if (w.mark !== ai) humanWins++; return; }
          if (E.isFull(b)) return;
          if (toMove === ai) {
            b[fn(b, ai).bestMove] = ai;
            play(b, E.other(toMove));
          } else {
            for (const c of E.legalMoves(b)) {
              const copy = b.slice();
              copy[c] = toMove;
              play(copy, E.other(toMove));
            }
          }
        })(E.emptyBoard(), aiFirst ? ai : E.other(ai));
        assert.equal(humanWins, 0, `AI ${ai} ${aiFirst ? 'first' : 'second'}`);
      }
    }
  });
}

// Every distinct reachable Board where the game is not over and O is to move.
function aiTurnBoards(first) {
  const seen = new Set();
  const boards = [];
  (function walk(b, toMove) {
    if (E.isTerminal(b)) return;
    if (toMove === 'O') {
      const key = b.map((c) => c || '.').join('');
      if (seen.has(key)) return;
      seen.add(key);
      boards.push(b.slice());
    }
    for (const c of E.legalMoves(b)) {
      b[c] = toMove;
      walk(b, E.other(toMove));
      b[c] = '';
    }
  })(E.emptyBoard(), first);
  return boards;
}

test('same-move gate: Minimax and Alpha-Beta agree on all 4,520 AI-turn Boards', () => {
  const xFirst = aiTurnBoards('X');
  const oFirst = aiTurnBoards('O');
  assert.deepEqual([xFirst.length, oFirst.length], [2097, 2423]);
  let mismatches = 0;
  let moreNodes = 0;
  let mmTotal = 0;
  let abTotal = 0;
  for (const b of xFirst.concat(oFirst)) {
    const mm = E.minimax(b, 'O');
    const ab = E.alphaBeta(b, 'O');
    if (mm.bestMove !== ab.bestMove || mm.bestScore !== ab.bestScore) mismatches++;
    if (ab.nodesVisited > mm.nodesVisited) moreNodes++;
    mmTotal += mm.nodesVisited;
    abTotal += ab.nodesVisited;
  }
  assert.equal(mismatches, 0);
  assert.equal(moreNodes, 0, 'Alpha-Beta never visits more Nodes');
  assert.deepEqual([mmTotal, abTotal], [2125535, 309653]);
});

test('measure() runs both searches and reports savings', () => {
  const m = E.measure(E.emptyBoard(), 'O');
  assert.equal(m.mmNodes, 549946);
  assert.equal(m.abNodes, 20866);
  assert.equal(m.same, true);
  assert.ok(Math.abs(m.pctPruned - 96.2058) < 0.001);
  assert.ok(m.mmMs >= 0 && m.abMs >= 0);
  assert.equal(E.measure(E.emptyBoard(), 'Q'), null);
  assert.equal(E.pctPruned(0, 0), null);
});

test('evaluateMoves: exact per-cell scores, pruning only changes the Node count', () => {
  const b = B('X...O...X');
  const on = E.evaluateMoves(b, 'O', true);
  const off = E.evaluateMoves(b, 'O', false);
  assert.deepEqual(on.scores, off.scores);
  assert.deepEqual(on.scores, [null, 0, -6, 0, null, 0, -6, 0, null], 'corner trap: O must take an edge');
  assert.equal(on.best, 1);
  assert.ok(on.nodes < off.nodes);
  for (const cell of E.legalMoves(b)) {
    const child = b.slice();
    child[cell] = 'O';
    // The cell's score must agree with a fresh search of the child from the opponent's side.
    const reply = E.minimax(child, 'X');
    if (reply.bestScore !== null) assert.equal(Math.sign(on.scores[cell]), -Math.sign(reply.bestScore) || 0);
  }
  assert.deepEqual(E.evaluateMoves(B('XXXOO....'), 'O', true).best, null);
});

test('findBestMove defaults to O and returns null on a finished board', () => {
  assert.equal(E.findBestMove(B('OO.XX....')), 2);
  assert.equal(E.findBestMove(B('XXXOO....')), null);
});
