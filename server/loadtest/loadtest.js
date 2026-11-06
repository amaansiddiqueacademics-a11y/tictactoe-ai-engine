// Connection-capacity smoke test: N guests connect over WebSocket, the first 10 create AI rooms,
// and all hold their connections for a while. Run against a running server:
//   TARGET_URL=http://localhost:3001 CLIENTS=100 DURATION_SECONDS=30 npm run loadtest
import { io } from 'socket.io-client';

const target = process.env.TARGET_URL || 'http://localhost:3001';
const count = Math.max(1, Number(process.env.CLIENTS || 100));
const duration = Math.max(1, Number(process.env.DURATION_SECONDS || 30));

let connected = 0;
let failed = 0;
let roomAcks = 0;
const latencies = [];
const sockets = [];
const start = Date.now();

async function client(i) {
  try {
    const t = Date.now();
    const r = await fetch(`${target}/api/guest`, { method: 'POST' });
    if (!r.ok) throw new Error(`guest HTTP ${r.status}`);
    const guest = await r.json();
    const s = io(target, { auth: { token: guest.token }, transports: ['websocket'], reconnection: false, timeout: 10000 });
    sockets.push(s);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), 12000);
      s.once('connect', () => {
        clearTimeout(timer);
        connected++;
        latencies.push(Date.now() - t);
        if (i < Math.min(10, count)) s.emit('room:create', { mode: 'ai' }, (a) => { if (a?.ok) roomAcks++; });
        resolve();
      });
      s.once('connect_error', (e) => { clearTimeout(timer); reject(e); });
    });
  } catch (e) {
    failed++;
    console.error(`client ${i + 1}: ${e.message}`);
  }
}

console.log(`Connecting ${count} clients to ${target}`);
await Promise.all(Array.from({ length: count }, (_, i) => client(i)));

const sorted = [...latencies].sort((a, b) => a - b);
const pct = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null);
console.log(JSON.stringify({
  requested: count,
  connected,
  failed,
  setupMs: Date.now() - start,
  latencyMs: { min: sorted[0] ?? null, median: pct(50), p95: pct(95), p99: pct(99), max: sorted.at(-1) ?? null },
  aiRoomAcks: roomAcks,
  holdSeconds: duration
}, null, 2));
console.log('Holding connections; monitor server CPU/memory and logs.');
await new Promise((r) => setTimeout(r, duration * 1000));
for (const s of sockets) s.disconnect();
if (connected < count) process.exitCode = 1;
