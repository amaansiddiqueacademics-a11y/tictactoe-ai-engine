-- Completed matches. Applied automatically by Docker Compose and by the server on startup.
CREATE TABLE IF NOT EXISTS matches (
  id          BIGSERIAL PRIMARY KEY,
  room_code   VARCHAR(12)  NOT NULL,
  mode        VARCHAR(8)   NOT NULL CHECK (mode IN ('pvp', 'ai')),
  algo        VARCHAR(12)  CHECK (algo IN ('minimax', 'alphabeta')),
  player_x    VARCHAR(80)  NOT NULL,
  player_o    VARCHAR(80)  NOT NULL,
  winner      VARCHAR(8)   CHECK (winner IN ('X', 'O', 'draw')),
  final_board JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Upgrade databases created by the first version of the project.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS algo VARCHAR(12);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- One row per game: a retried insert after a crash or reconnect is ignored.
CREATE UNIQUE INDEX IF NOT EXISTS matches_room_game_idx ON matches (room_code, created_at);
CREATE INDEX IF NOT EXISTS matches_finished_at_idx ON matches (finished_at DESC);
