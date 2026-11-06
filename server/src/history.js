// Completed-match history in PostgreSQL. Optional: without DATABASE_URL the game still works
// and /api/matches returns 503, so local play needs no database.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

export function createHistory(databaseUrl) {
  if (!databaseUrl) {
    return {
      enabled: false,
      async ping() {},
      async migrate() {},
      async record() {},
      async recent() { throw new Error('Match history is disabled (no DATABASE_URL).'); },
      async close() {}
    };
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  pool.on('error', (e) => console.error('PostgreSQL pool error:', e.message));
  return {
    enabled: true,
    async ping() { await pool.query('SELECT 1'); },
    async migrate() { await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8')); },
    async record(game) {
      await pool.query(
        `INSERT INTO matches (room_code, mode, algo, player_x, player_o, winner, final_board, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         ON CONFLICT (room_code, created_at) DO NOTHING`,
        [game.roomCode, game.mode, game.mode === 'ai' ? game.algo : null, game.players.X?.id || 'unknown',
          game.players.O?.id || 'unknown', game.winner, JSON.stringify(game.board), game.createdAt]
      );
    },
    async recent(limit) {
      const q = await pool.query(
        `SELECT id, room_code AS "roomCode", mode, algo, winner, final_board AS board, finished_at AS "finishedAt"
         FROM matches ORDER BY finished_at DESC LIMIT $1`,
        [limit]
      );
      return q.rows;
    },
    async close() { await pool.end(); }
  };
}
