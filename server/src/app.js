// HTTP + Socket.IO server. Build it with createApp(config); index.js wires real Redis/PostgreSQL.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import {
  aiToMove, applyMove, createInitialGame, playAiTurn, publicGame, symbolOf, validateMove
} from '../../shared/match.js';

const AI_DELAY_MS = 150;

function guestName(userId) {
  return `Guest-${String(userId).slice(0, 5)}`;
}

function roomCode() {
  // 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

function cleanCode(payload) {
  return String(payload?.roomCode ?? '').trim().toUpperCase();
}

// Fixed-window counter per key; returns false once `limit` is exceeded in the window.
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => hits.clear(), windowMs);
  timer.unref();
  return (key) => {
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    return n <= limit;
  };
}

export function createApp({ store, history, secret, origins, adapter, clientDist, guestRateLimit = 0, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const corsOrigin = origins.length ? origins : true;
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '10kb' }));

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 10_000
  });
  if (adapter) io.adapter(adapter);

  const emitGame = (game) => io.to(game.roomCode).emit('game:state', publicGame(game));

  // Record a finished game once. A failed insert is retried on the next state change.
  async function persist(game) {
    if (game.status !== 'finished' || game.persisted || !history.enabled) return;
    try {
      await history.record(game);
      game.persisted = true;
      await store.save(game);
    } catch (e) {
      logger.error('Match history insert failed:', e.message);
    }
  }

  async function doAiMove(code) {
    await store.withLock(code, async () => {
      const game = await store.get(code);
      if (!game || playAiTurn(game) === null) return;
      await store.save(game);
      emitGame(game);
      await persist(game);
    });
  }

  function scheduleAi(game) {
    if (!aiToMove(game)) return;
    setTimeout(() => doAiMove(game.roomCode).catch((e) => logger.error('AI move failed:', e.message)), AI_DELAY_MS);
  }

  // ---------- REST ----------
  // Guest tokens per IP per minute (0 = unlimited, e.g. for load tests from one machine).
  const guestLimit = guestRateLimit > 0 ? rateLimiter(guestRateLimit, 60_000) : () => true;

  app.get('/health', async (_req, res) => {
    try {
      await store.ping();
      await history.ping();
      res.json({ ok: true, store: store.kind, history: history.enabled ? 'postgres' : 'disabled' });
    } catch (e) {
      res.status(503).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/guest', (req, res) => {
    if (!guestLimit(req.ip)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    const userId = crypto.randomUUID();
    res.json({ userId, token: jwt.sign({ sub: userId }, secret, { expiresIn: '30d' }), displayName: guestName(userId) });
  });

  app.get('/api/matches', async (req, res) => {
    if (!history.enabled) return res.status(503).json({ error: 'Match history is disabled on this server.' });
    try {
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
      res.json(await history.recent(limit));
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: 'Could not load match history.' });
    }
  });

  // Serve the built React app from the same origin when it exists (single-process deploy).
  if (clientDist && fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|socket\.io\/|health$).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // ---------- Socket.IO ----------
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token || '', secret);
      socket.data.userId = payload.sub;
      socket.data.displayName = guestName(payload.sub);
      next();
    } catch {
      next(new Error('Invalid or missing guest token. Refresh the page.'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, displayName } = socket.data;
    const eventLimit = rateLimiter(20, 1000);

    // Wrap a handler: rate limit, always ack exactly once, never throw into Socket.IO.
    const on = (event, handler) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        if (!eventLimit(userId)) return reply({ ok: false, error: 'Slow down a little.' });
        try {
          reply({ ok: true, ...(await handler(payload && typeof payload === 'object' ? payload : {})) });
        } catch (e) {
          reply({ ok: false, error: e.message || 'Request failed.' });
        }
      });
    };

    // Leave every other room, so one socket only ever receives one room's state.
    const enterRoom = async (code) => {
      for (const r of socket.rooms) if (r !== socket.id && r !== code) await socket.leave(r);
      await socket.join(code);
    };

    on('room:create', async ({ mode, algo, aiFirst }) => {
      let code = null;
      for (let i = 0; i < 8 && !code; i++) {
        const c = roomCode();
        if (await store.reserve(c)) code = c;
      }
      if (!code) throw new Error('Could not allocate a room. Try again.');
      const game = createInitialGame({ roomCode: code, mode, algo, aiFirst, hostId: userId, hostName: displayName });
      await store.save(game);
      await enterRoom(code);
      emitGame(game);
      scheduleAi(game);
      return { roomCode: code, game: publicGame(game) };
    });

    on('room:join', async (payload) => {
      const code = cleanCode(payload);
      const game = await store.withLock(code, async () => {
        const g = await store.get(code);
        if (!g) throw new Error('Room not found or expired.');
        const mine = symbolOf(g, userId);
        if (mine) {
          g.players[mine].connected = true;
        } else {
          if (g.mode !== 'pvp') throw new Error('That room is a game against the AI.');
          if (g.players.O) throw new Error('Room is full.');
          if (g.status === 'finished') throw new Error('This game has finished.');
          g.players.O = { id: userId, name: displayName, connected: true };
          g.status = 'playing';
        }
        await store.save(g);
        return g;
      });
      await enterRoom(code);
      emitGame(game);
      return { game: publicGame(game) };
    });

    on('room:reconnect', async (payload) => {
      const code = cleanCode(payload);
      const game = await store.withLock(code, async () => {
        const g = await store.get(code);
        if (!g) throw new Error('Room not found or expired.');
        const mine = symbolOf(g, userId);
        if (!mine) throw new Error('This guest identity does not belong to this room.');
        g.players[mine].connected = true;
        await store.save(g);
        return g;
      });
      await enterRoom(code);
      emitGame(game);
      // Resume an AI turn that was lost (for example, the server restarted mid-turn).
      scheduleAi(game);
      return { game: publicGame(game) };
    });

    on('room:leave', async (payload) => {
      const code = cleanCode(payload);
      await socket.leave(code);
      await markDisconnected(code);
      return {};
    });

    on('game:move', async (payload) => {
      const code = cleanCode(payload);
      const game = await store.withLock(code, async () => {
        const g = await store.get(code);
        if (!g) throw new Error('Room not found or expired.');
        const mine = symbolOf(g, userId);
        if (!mine) throw new Error('You are not a player in this room.');
        const err = validateMove(g, userId, payload.cell);
        if (err) throw new Error(err);
        applyMove(g, mine, payload.cell);
        await store.save(g);
        emitGame(g);
        await persist(g);
        return g;
      });
      scheduleAi(game);
      return { game: publicGame(game) };
    });

    // Start the same room again with the same players and settings.
    on('game:rematch', async (payload) => {
      const code = cleanCode(payload);
      const game = await store.withLock(code, async () => {
        const g = await store.get(code);
        if (!g) throw new Error('Room not found or expired.');
        if (!symbolOf(g, userId)) throw new Error('You are not a player in this room.');
        if (g.status !== 'finished') throw new Error('The current game is not finished yet.');
        const fresh = createInitialGame({
          roomCode: code, mode: g.mode, algo: g.algo, aiFirst: g.aiFirst,
          hostId: g.players.X.id, hostName: g.players.X.name
        });
        if (g.mode === 'pvp') {
          fresh.players.O = g.players.O;
          fresh.status = 'playing';
        }
        fresh.players.X.connected = g.players.X.connected;
        await store.save(fresh);
        return fresh;
      });
      emitGame(game);
      scheduleAi(game);
      return { game: publicGame(game) };
    });

    async function markDisconnected(code) {
      await store.withLock(code, async () => {
        const g = await store.get(code);
        if (!g) return;
        const mine = symbolOf(g, userId);
        if (!mine) return;
        // The same guest may still be in the room from another tab.
        const sockets = await io.in(code).fetchSockets();
        if (sockets.some((s) => s.id !== socket.id && s.data.userId === userId)) return;
        g.players[mine].connected = false;
        await store.save(g);
        emitGame(g);
      });
    }

    // `disconnecting` (not `disconnect`): socket.rooms is already empty by the time `disconnect` fires.
    socket.on('disconnecting', () => {
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);
      for (const code of rooms) {
        markDisconnected(code).catch((e) => logger.error('Disconnect handling failed:', e.message));
      }
    });
  });

  return { app, server, io };
}

