# Changelog

## 2.0.0 (2026-11-07)

Merged the original engine with the full-stack multiplayer version.

### Added
- Shared engine (`shared/engine.js`, `shared/match.js`) used by the server, offline play and the algorithm explorer.
- Shadow-run metrics on every AI turn: nodes, time, % pruned and same-move for Minimax and Alpha-Beta, plus game totals and an on-demand Compare.
- Choice of algorithm and who moves first, both offline and online.
- Offline play (vs AI and pass-and-play) with no server.
- Online rooms (React + Socket.IO): create, join, reconnect, leave, rematch, opponent-away indicator.
- Redis or in-memory room store; optional PostgreSQL match history with automatic schema upgrade.
- Interactive "How the AI works" tab: animated minimax tree and a live sandbox with a pruning toggle.
- Docker Compose setup with an nginx proxy, CI (tests, build, Docker images), Socket.IO end-to-end tests.

### Fixed
- Players were never marked disconnected (handled in `disconnecting` now).
- Leaving a board kept receiving that room's updates.
- Two guest identities created on first load in development.
- An AI turn lost during a server restart left the game stuck.
- CSS class clash that broke the "New match" button layout.
- Explorer text called 549,946 tree positions "move sequences".

## 1.0.0 (2026-10-15)

First version: dependency-free browser game comparing Standard Minimax and Alpha-Beta pruning, with per-move node counts and timings, a Compare button, and gate tests.
