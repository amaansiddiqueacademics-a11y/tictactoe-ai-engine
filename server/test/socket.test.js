// End-to-end over real HTTP + Socket.IO with the in-memory store (no Redis/PostgreSQL needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createHistory } from '../src/history.js';
import { createMemoryStore } from '../src/store.js';

const silent = { error() {}, log() {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const { server, io } = createApp({
    store: createMemoryStore(), history: createHistory(null), secret: 'test-secret', origins: [], logger: silent
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((r) => { io.close(); server.close(r); }) };
}

async function client(url) {
  const guest = await (await fetch(`${url}/api/guest`, { method: 'POST' })).json();
  const socket = connect(url, { auth: { token: guest.token }, transports: ['websocket'], reconnection: false });
  await new Promise((res, rej) => { socket.once('connect', res); socket.once('connect_error', rej); });
  const states = [];
  socket.on('game:state', (g) => states.push(g));
  const emit = (event, payload) => new Promise((r) => socket.emit(event, payload, r));
  const until = async (pred, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = [...states].reverse().find(pred);
      if (hit) return hit;
      await wait(20);
    }
    throw new Error('timed out waiting for state');
  };
  return { guest, socket, states, emit, until };
}

test('health, guest tokens and auth', async () => {
  const srv = await startServer();
  try {
    const health = await (await fetch(`${srv.url}/health`)).json();
    assert.deepEqual(health, { ok: true, store: 'memory', history: 'disabled' });
    assert.equal((await fetch(`${srv.url}/api/matches`)).status, 503);
    const bad = connect(srv.url, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false });
    const err = await new Promise((r) => bad.once('connect_error', r));
    assert.match(err.message, /guest token/);
    bad.close();
  } finally {
    await srv.close();
  }
});

test('AI room: AI moves first with the chosen algorithm and reports metrics', async () => {
  const srv = await startServer();
  const a = await client(srv.url);
  try {
    const r = await a.emit('room:create', { mode: 'ai', algo: 'minimax', aiFirst: true });
    assert.ok(r.ok);
    assert.match(r.roomCode, /^[A-Z2-9]{6}$/);
    const afterAi = await a.until((g) => g.board.filter(Boolean).length === 1);
    assert.equal(afterAi.board[0], 'O');
    assert.equal(afterAi.lastAi.played, 'minimax');
    assert.equal(afterAi.lastAi.mmNodes, 549946);

    // Play the first free cell until the game ends; the AI must never lose.
    let game = afterAi;
    while (game.status === 'playing') {
      const cell = game.board.indexOf('');
      const moved = await a.emit('game:move', { roomCode: r.roomCode, cell });
      assert.ok(moved.ok, moved.error);
      const filled = moved.game.board.filter(Boolean).length;
      game = moved.game.status === 'finished' ? moved.game : await a.until((g) => g.board.filter(Boolean).length > filled || g.status === 'finished');
    }
    assert.notEqual(game.winner, 'X');
    assert.ok(game.aiStats.turns >= 3);
    assert.equal(game.aiStats.same, game.aiStats.turns);

    const re = await a.emit('game:rematch', { roomCode: r.roomCode });
    assert.ok(re.ok);
    assert.equal(re.game.status, 'playing');
    assert.equal(re.game.algo, 'minimax');
  } finally {
    a.socket.close();
    await srv.close();
  }
});

test('PvP room: join, turn order, leave, disconnect tracking, rematch', async () => {
  const srv = await startServer();
  const a = await client(srv.url);
  const b = await client(srv.url);
  const c = await client(srv.url);
  try {
    const { roomCode } = await a.emit('room:create', { mode: 'pvp' });
    assert.equal((await b.emit('room:join', { roomCode: roomCode.toLowerCase() })).game.status, 'playing');
    assert.match((await c.emit('room:join', { roomCode })).error, /full/);
    assert.match((await b.emit('game:move', { roomCode, cell: 0 })).error, /not your turn/);
    assert.ok((await a.emit('game:move', { roomCode, cell: 0 })).ok);
    assert.match((await b.emit('game:move', { roomCode, cell: 0 })).error, /occupied/);
    assert.match((await c.emit('game:move', { roomCode, cell: 5 })).error, /not a player/);
    assert.match((await a.emit('game:move', { roomCode, cell: 'x' })).error, /integer/);
    assert.match((await a.emit('game:rematch', { roomCode })).error, /not finished/);

    // A stops receiving this room's updates after leaving another one it created.
    const { roomCode: other } = await a.emit('room:create', { mode: 'ai' });
    const before = a.states.length;
    assert.ok((await b.emit('game:move', { roomCode, cell: 4 })).ok);
    await wait(200);
    assert.ok(a.states.slice(before).every((g) => g.roomCode === other), 'socket only follows its current room');
    assert.ok((await a.emit('room:reconnect', { roomCode })).ok);

    // B drops: A sees O marked disconnected (this was broken with the `disconnect` event).
    b.socket.close();
    const seen = await a.until((g) => g.roomCode === roomCode && g.players.O && g.players.O.connected === false);
    assert.equal(seen.players.O.connected, false);

    // B comes back with the same identity.
    const b2sock = connect(srv.url, { auth: { token: b.guest.token }, transports: ['websocket'], reconnection: false });
    await new Promise((r) => b2sock.once('connect', r));
    const back = await new Promise((r) => b2sock.emit('room:reconnect', { roomCode }, r));
    assert.ok(back.ok);
    assert.equal(back.game.players.O.connected, true);
    b2sock.close();
  } finally {
    a.socket.close();
    c.socket.close();
    await srv.close();
  }
});

test('room codes are validated and unknown rooms rejected', async () => {
  const srv = await startServer();
  const a = await client(srv.url);
  try {
    assert.match((await a.emit('room:join', { roomCode: 'bad!' })).error, /Invalid room code/);
    assert.match((await a.emit('room:join', { roomCode: 'ZZZZZZ' })).error, /not found/);
    assert.match((await a.emit('game:move', {})).error, /Invalid room code/);
  } finally {
    a.socket.close();
    await srv.close();
  }
});
