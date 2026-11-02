# Multiplayer Tic-Tac-Toe AI

A full-stack, real-time Tic-Tac-Toe game built with **React + TypeScript**, **Node.js + Socket.IO**, and a server-side **Minimax + Alpha-Beta Pruning** AI. Features Redis-backed shared room state, PostgreSQL match history, Docker Compose deployment, and an interactive in-browser algorithm explorer.

---

## Features

| Category | Details |
|---|---|
| **Auth** | Server-issued signed guest JWTs (30-day), stored in `localStorage` |
| **Game Modes** | Player vs Player (PvP) and Player vs Minimax AI |
| **Rooms** | Create a room, join with a 6-character code, reconnect to last room |
| **Server Authority** | All moves validated server-side: player identity, turn, cell range, occupancy, game status |
| **AI** | Unbeatable Minimax with Alpha-Beta Pruning, runs on the server — clients cannot fake AI moves |
| **State** | Redis as shared room store with a 12-hour TTL; per-room distributed locks prevent race conditions |
| **Scaling** | Socket.IO Redis adapter broadcasts room events across multiple server instances |
| **History** | PostgreSQL stores completed match records (room code, mode, players, winner, final board) |
| **UI Extras** | Web Audio synth sound effects, confetti on win, session scoreboard, mute toggle, copy-room-code button |
| **Algorithm Explorer** | Interactive in-browser tab: animated minimax walkthrough, live sandbox with pruning toggle showing nodes saved |
| **Tests** | Node.js built-in test runner; covers win detection, draw, AI decisions, and move validation |
| **Load Test** | 100-client connection smoke test with JWT auth and latency percentiles |
| **Deployment** | Docker Compose with health checks; Nginx-served frontend; environment-variable driven config |

---

## Project Structure

```
multiplayer-tic-tac-toe/
├── client/                   # React + TypeScript frontend (Vite)
│   ├── src/
│   │   ├── App.tsx           # Main game UI, lobby, scoreboard, sound effects
│   │   ├── Algorithm.tsx     # "How the AI works" tab — live minimax sandbox
│   │   ├── AlgoAnimation.tsx # Step-by-step animated minimax tree walkthrough
│   │   ├── socket.ts         # Socket.IO client singleton + API URL config
│   │   ├── types.ts          # Shared TypeScript types (Game, Player, Ack, Identity)
│   │   └── styles.css        # All UI styles
│   ├── index.html
│   ├── nginx.conf            # Nginx config for Docker image
│   ├── vite.config.ts
│   └── Dockerfile
├── server/                   # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── index.js          # Server entry: REST endpoints, Socket.IO handlers, Redis/PG wiring
│   │   ├── game.js           # Pure game logic: minimax, move validation, state helpers
│   │   └── schema.sql        # PostgreSQL schema (matches table + index)
│   ├── loadtest/
│   │   └── loadtest.js       # 100-client connection smoke test
│   ├── test/
│   │   └── game.test.js      # Unit tests (node:test)
│   └── Dockerfile
├── docker-compose.yml        # postgres + redis + server + client
├── .env.example              # Environment variable template
└── package.json              # Root workspace (npm workspaces)
```

---

## Architecture

```
Browser (React + TypeScript)
  │  POST /api/guest      → guest JWT
  │  Socket.IO (WS)       → room events, game state
  ▼
Node.js + Express + Socket.IO
  ├── Redis ──────────────── active room state (JSON, 12h TTL)
  │                          per-room distributed lock (5s, Lua eval)
  ├── Socket.IO Redis Adapter  room events across server replicas
  └── PostgreSQL ─────────── completed match history
```

**Data flow for a move:**
1. Client emits `game:move` with `{ roomCode, cell }`.
2. Server acquires the per-room Redis lock (spin-waits up to 80 × 25 ms).
3. Validates identity, turn, cell, and game status.
4. Applies the move; checks win/draw.
5. Saves updated state to Redis; broadcasts `game:state` to the room.
6. On finish, inserts a row into PostgreSQL (`matches` table).
7. In AI mode, schedules an AI move 100 ms later via the same lock path.

---

## Socket.IO Events

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `room:create` | `{ mode: 'pvp' \| 'ai' }` |
| Client → Server | `room:join` | `{ roomCode: string }` |
| Client → Server | `room:reconnect` | `{ roomCode: string }` |
| Client → Server | `game:move` | `{ roomCode: string, cell: number (0–8) }` |
| Server → Client | `game:state` | Full `Game` object (board, players, status, winner, …) |

All client-to-server events use Socket.IO acknowledgement callbacks returning `{ ok, game?, error? }`.

---

## REST Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/guest` | Issues a signed guest JWT + UUID identity |
| `GET` | `/api/matches?limit=N` | Returns last N completed matches (max 100) |
| `GET` | `/health` | Checks Redis and PostgreSQL connectivity |

---

## Database Schema

```sql
CREATE TABLE matches (
  id          BIGSERIAL PRIMARY KEY,
  room_code   VARCHAR(12)  NOT NULL,
  mode        VARCHAR(8)   NOT NULL CHECK (mode IN ('pvp','ai')),
  player_x    VARCHAR(80)  NOT NULL,
  player_o    VARCHAR(80)  NOT NULL,
  winner      VARCHAR(8)   CHECK (winner IN ('X','O','draw')),
  final_board JSONB        NOT NULL,
  finished_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX matches_finished_at_idx ON matches(finished_at DESC);
```

---

## Environment Variables

Copy `.env.example` to `.env` and adjust before deploying.

| Variable | Default (Docker) | Description |
|---|---|---|
| `JWT_SECRET` | `local-development-secret-change-this` | HS256 signing secret — **change before any public deploy** |
| `CLIENT_ORIGIN` | `http://localhost:8080` | Allowed CORS origin |
| `DATABASE_URL` | `postgres://game:change-me@postgres:5432/tictactoe` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `PORT` | `3001` | Server listen port |
| `POSTGRES_DB` | `tictactoe` | Postgres database name (Docker only) |
| `POSTGRES_USER` | `game` | Postgres user (Docker only) |
| `POSTGRES_PASSWORD` | `change-me` | Postgres password — **change before any public deploy** |
| `VITE_API_URL` | `http://localhost:3001` | API base URL baked into the frontend at build time |

---

## Run with Docker (Recommended)

**Prerequisites:** Docker Desktop or Docker Engine with Compose.

```bash
# 1. Configure
cp .env.example .env
# Edit .env: set JWT_SECRET and POSTGRES_PASSWORD

# 2. Build and start all services
docker compose up --build
```

- **Frontend:** http://localhost:8080
- **API:** http://localhost:3001
- **Health check:** http://localhost:3001/health

Redis and PostgreSQL are internal services not exposed to the host.

For PvP, open two browser tabs/devices, create a PvP room in one, and paste the 6-character code into the other.

---

## Run Locally Without Docker

**Prerequisites:** Node.js 20+, PostgreSQL 14+, Redis 7+.

```bash
# 1. Create the database and apply the schema
psql -U postgres -c "CREATE DATABASE tictactoe;"
psql -U postgres -d tictactoe -f server/src/schema.sql

# 2. Configure environment
cp .env.example .env
# Set for local use:
#   DATABASE_URL=postgres://game:password@localhost:5432/tictactoe
#   REDIS_URL=redis://localhost:6379
#   CLIENT_ORIGIN=http://localhost:5173

# 3. Install dependencies (from repo root)
npm install

# 4. Start both server and client concurrently
npm run dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start server (node --watch) + client (Vite) concurrently |
| `npm run build` | Type-check client, build Vite bundle, syntax-check server |
| `npm test` | Run server unit tests (node:test) |
| `npm run loadtest` | Run the 100-client smoke test against the running API |

---

## Tests

```bash
npm test
```

Uses Node.js built-in `node:test`. Covers:

- Row and diagonal win detection
- Full-board draw recognition
- AI takes an immediate winning move
- AI blocks an immediate human win
- Move rejection: out-of-range cell, occupied cell, wrong-turn player

---

## Load Test

Run with the API server already running:

```bash
npm run loadtest
# or with custom options:
TARGET_URL=http://localhost:3001 CLIENTS=100 DURATION_SECONDS=30 npm run loadtest -w server
```

Each client:
1. Obtains a guest JWT via `POST /api/guest`.
2. Opens a WebSocket-only Socket.IO connection.
3. Creates an AI room (up to 10 rooms shared across clients).
4. Holds the connection for the configured duration.

Reports connection latency percentiles (p50, p95, p99) and error counts. This is a **connection-capacity smoke test**, not a full match-workload benchmark.

**Suggested progression:** 25 clients × 2 min → 50 × 5 min → 100 × 10–15 min. Monitor CPU, memory, event-loop delay, Redis latency, PostgreSQL connections, and error rate.

---

## Algorithm Explorer

The **"🧠 How the AI works"** tab in the UI provides three panels:

1. **Explainer** — four-step prose walkthrough (tree search → scoring → min/max → pruning).
2. **Animated Trace** — a step-by-step replay of the minimax decision tree for preset board positions (play/pause/step controls, plain-English narration per node).
3. **Live Sandbox** — an interactive board where you place pieces; each empty cell shows its minimax score in real time. Toggle Alpha-Beta Pruning on/off to see the node-count reduction live (typically 40–80% fewer nodes).

The sandbox runs the same algorithm as the server, compiled to TypeScript in the browser.

---

## Production Checklist

- [ ] Use HTTPS/WSS; set a valid public `VITE_API_URL` at frontend build time.
- [ ] Set strong, unique `JWT_SECRET` and `POSTGRES_PASSWORD`.
- [ ] Restrict `CLIENT_ORIGIN` (CORS) to the actual frontend domain.
- [ ] Add rate limiting on guest issuance and room creation.
- [ ] Configure Redis persistence (`appendonly yes` is already set in Docker Compose) and backups.
- [ ] Configure PostgreSQL backups, network isolation, and connection pool limits.
- [ ] Add health checks and structured logging to your orchestrator/load balancer.
- [ ] For multiple backend replicas: share the same Redis instance and JWT secret; use a WebSocket-compatible load balancer. Prefer WebSocket transport (already configured) to avoid sticky-session requirements.
- [ ] Add room expiry/cleanup policies and idempotent match-history inserts before public launch.
- [ ] Consider rate limiting on `game:move` events and room operations at the Socket.IO middleware layer.

---

## Known Limitations

- No registered accounts, ranked play, or matchmaking — guest identity only.
- No spectator support; non-player sockets that join a room receive `game:state` but cannot move.
- PvP rooms preserve player slots on disconnect but have no automatic cleanup; rooms expire after 12 hours via Redis TTL.
- No room-expiry webhook; finished or abandoned rooms persist in Redis until TTL.
- Match history insert is not retry-safe under all failure modes (the `persisted` flag guards against double-writes within a session but not across crashes).
