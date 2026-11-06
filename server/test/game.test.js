import test from 'node:test';
import assert from 'node:assert/strict';
import { AI, EMPTY, HUMAN, applyMove, createInitialGame, playAiTurn, publicGame, symbolOf, validateMove } from '../../shared/match.js';

const pvp = () => {
  const g = createInitialGame({ roomCode: 'ABC123', mode: 'pvp', hostId: 'u1', hostName: 'X' });
  g.status = 'playing';
  g.players.O = { id: 'u2', name: 'O', connected: true };
  return g;
};

test('rejects invalid, occupied, wrong-turn and finished moves', () => {
  const g = pvp();
  assert.match(validateMove(g, 'u1', 9), /integer/);
  assert.match(validateMove(g, 'u1', '1'), /integer/);
  assert.match(validateMove(g, 'u2', 1), /not your turn/);
  applyMove(g, HUMAN, 0);
  assert.match(validateMove(g, 'u2', 0), /occupied/);
  assert.equal(validateMove(g, 'u2', 1), null);
  assert.throws(() => applyMove(g, HUMAN, 1), /Cannot apply/);
});

test('win sets winner and line; draw is detected', () => {
  const g = pvp();
  for (const [s, c] of [[HUMAN, 0], [AI, 3], [HUMAN, 1], [AI, 4], [HUMAN, 2]]) applyMove(g, s, c);
  assert.equal(g.status, 'finished');
  assert.equal(g.winner, 'X');
  assert.deepEqual(g.winLine, [0, 1, 2]);
  assert.match(validateMove(g, 'u2', 5), /not currently accepting/);

  const d = pvp();
  for (const [i, c] of [0, 1, 2, 4, 3, 5, 7, 6, 8].entries()) applyMove(d, i % 2 ? AI : HUMAN, c);
  assert.equal(d.winner, 'draw');
  assert.equal(d.winLine, null);
});

test('AI room: AI-first, chosen algorithm, shadow-run metrics', () => {
  const g = createInitialGame({ roomCode: 'ABC123', mode: 'ai', hostId: 'u1', algo: 'minimax', aiFirst: true });
  assert.equal(g.currentTurn, AI);
  assert.equal(symbolOf(g, 'u1'), HUMAN);
  assert.equal(playAiTurn(g), 0);
  assert.equal(g.board[0], AI);
  assert.equal(g.currentTurn, HUMAN);
  assert.equal(g.lastAi.played, 'minimax');
  assert.equal(g.lastAi.mmNodes, 549946);
  assert.equal(g.lastAi.abNodes, 20866);
  assert.deepEqual({ ...g.aiStats }, { turns: 1, mmTotal: 549946, abTotal: 20866, same: 1 });
  assert.equal(playAiTurn(g), null, 'not the AI turn');
});

test('AI takes the win and blocks threats', () => {
  const g = createInitialGame({ roomCode: 'ABC123', mode: 'ai', hostId: 'u1' });
  g.board = [AI, AI, EMPTY, HUMAN, HUMAN, EMPTY, EMPTY, EMPTY, EMPTY];
  g.currentTurn = AI;
  assert.equal(playAiTurn(g), 2);
  assert.equal(g.winner, AI);

  const h = createInitialGame({ roomCode: 'ABC123', mode: 'ai', hostId: 'u1' });
  h.board = [HUMAN, HUMAN, EMPTY, AI, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
  h.currentTurn = AI;
  assert.equal(playAiTurn(h), 2);
});

test('defaults and sanitising', () => {
  const g = createInitialGame({ roomCode: 'ABC123', mode: 'weird', hostId: 'u1', algo: 'bogus', aiFirst: 'yes' });
  assert.equal(g.mode, 'pvp');
  assert.equal(g.algo, 'alphabeta');
  assert.equal(g.aiFirst, false);
  assert.equal(g.status, 'waiting');
  assert.ok(!('persisted' in publicGame(g)));
});
