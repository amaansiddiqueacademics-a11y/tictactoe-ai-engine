# Contributing

Thanks for helping improve the Tic-Tac-Toe AI Engine.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173 (server on :3001, in-memory rooms)
```

## Before opening a pull request

```bash
npm test         # engine + server tests
npm run build    # client type-check and production build
```

## Where things live

- **Game rules and both searches** → `shared/engine.js`. The server and the browser import this file, so a change here affects every mode. Keep it pure (no I/O) and keep the node-count tests in `shared/test/engine.test.js` passing: Minimax and Alpha-Beta must pick the same move on all 4,520 AI-turn boards.
- **Match state (moves, turns, AI turn + metrics)** → `shared/match.js`.
- **Online rooms and events** → `server/src/app.js`; add a case to `server/test/socket.test.js` for new events.
- **UI** → `client/src/`.

## Style

Two-space indentation, single quotes, ES modules. Small, focused commits with a clear message.
