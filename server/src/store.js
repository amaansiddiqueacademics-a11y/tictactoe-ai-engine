// Room storage. Redis when REDIS_URL is set (shared across server replicas, survives restarts),
// otherwise an in-process Map so the server runs with zero infrastructure for local play and demos.
import crypto from 'node:crypto';

const ROOM_TTL_SECONDS = 12 * 60 * 60;
const LOCK_TTL_MS = 5000;
const LOCK_ATTEMPTS = 80;
const LOCK_RETRY_MS = 25;
const RESERVED = '__creating__';
const ROOM_CODE = /^[A-Z0-9]{6}$/;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const roomKey = (code) => `ttt:room:${code}`;
const lockKey = (code) => `ttt:lock:${code}`;

export function assertRoomCode(code) {
  if (!ROOM_CODE.test(code)) throw new Error('Invalid room code.');
}

export function createRedisStore(redis) {
  return {
    kind: 'redis',
    async ping() { await redis.ping(); },
    async get(code) {
      const v = await redis.get(roomKey(code));
      return v && v !== RESERVED ? JSON.parse(v) : null;
    },
    async save(game) {
      await redis.set(roomKey(game.roomCode), JSON.stringify(game), 'EX', ROOM_TTL_SECONDS);
    },
    /** Claim a room code; false if it is taken. The claim expires unless save() follows. */
    async reserve(code) {
      return (await redis.set(roomKey(code), RESERVED, 'EX', 5, 'NX')) === 'OK';
    },
    /** Run fn while holding a per-room lock, so moves in one room never interleave. */
    async withLock(code, fn) {
      assertRoomCode(code);
      const key = lockKey(code);
      const id = crypto.randomUUID();
      let ok = false;
      for (let i = 0; i < LOCK_ATTEMPTS; i++) {
        if ((await redis.set(key, id, 'PX', LOCK_TTL_MS, 'NX')) === 'OK') { ok = true; break; }
        await delay(LOCK_RETRY_MS);
      }
      if (!ok) throw new Error('Room is busy. Please retry.');
      try {
        return await fn();
      } finally {
        // Release only our own lock (it may have expired and been taken by someone else).
        await redis.eval(
          "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
          1, key, id
        );
      }
    }
  };
}

export function createMemoryStore() {
  const rooms = new Map(); // code -> { value, expires }
  const locks = new Map(); // code -> tail of the promise chain

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of rooms) if (entry.expires <= now) rooms.delete(code);
  }, 60_000);
  sweep.unref();

  return {
    kind: 'memory',
    async ping() {},
    async get(code) {
      const entry = rooms.get(code);
      if (!entry || entry.expires <= Date.now() || entry.value === RESERVED) return null;
      return structuredClone(entry.value);
    },
    async save(game) {
      rooms.set(game.roomCode, { value: structuredClone(game), expires: Date.now() + ROOM_TTL_SECONDS * 1000 });
    },
    async reserve(code) {
      const entry = rooms.get(code);
      if (entry && entry.expires > Date.now()) return false;
      rooms.set(code, { value: RESERVED, expires: Date.now() + 5000 });
      return true;
    },
    async withLock(code, fn) {
      assertRoomCode(code);
      const prev = locks.get(code) || Promise.resolve();
      const run = prev.then(() => fn());
      const tail = run.catch(() => {});
      locks.set(code, tail);
      tail.then(() => { if (locks.get(code) === tail) locks.delete(code); });
      return run;
    }
  };
}
