// Server entry point: reads the environment, connects storage, and starts listening.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { createApp } from './app.js';
import { createHistory } from './history.js';
import { createMemoryStore, createRedisStore } from './store.js';

const DEFAULT_SECRET = 'local-development-secret-change-this';
const PORT = Number(process.env.PORT || 3001);
const SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const ORIGINS = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const GUEST_RATE_LIMIT = Number(process.env.GUEST_RATE_LIMIT ?? (process.env.NODE_ENV === 'production' ? 60 : 0));
const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = process.env.CLIENT_DIST || path.resolve(here, '../../client/dist');

if (process.env.NODE_ENV === 'production' && SECRET === DEFAULT_SECRET) {
  console.error('Refusing to start: set JWT_SECRET to a long random value in production.');
  process.exit(1);
}

async function start() {
  const redisClients = [];
  let store = createMemoryStore();
  let adapter = null;
  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const pub = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const sub = pub.duplicate();
    redisClients.push(redis, pub, sub);
    store = createRedisStore(redis);
    adapter = createAdapter(pub, sub);
  }
  const history = createHistory(process.env.DATABASE_URL);

  await store.ping();
  await history.ping();
  await history.migrate();

  const { server, io } = createApp({ store, history, secret: SECRET, origins: ORIGINS, adapter, clientDist: CLIENT_DIST, guestRateLimit: GUEST_RATE_LIMIT });
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tic-Tac-Toe API listening on ${PORT} (rooms: ${store.kind}, history: ${history.enabled ? 'postgres' : 'off'})`);
  });

  const shutdown = async () => {
    console.log('Shutting down…');
    io.close();
    await history.close().catch(() => {});
    for (const c of redisClients) c.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((e) => {
  console.error('Startup failed:', e.message);
  process.exit(1);
});
