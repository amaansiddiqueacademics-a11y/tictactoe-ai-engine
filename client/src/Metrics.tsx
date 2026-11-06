// The engine panels: what the last AI move cost each algorithm, totals for this game,
// and an on-demand comparison of both searches on the current board.
import type { Algorithm, Game, Measurement } from './types';
import { formatCell, formatMs, formatNodes, formatPct } from './ui';
import { pctPruned } from '../../shared/engine.js';

function MeasureTable({ m, played }: { m: Measurement; played: Algorithm | null }) {
  const rows: [Algorithm, string, number | null, number, number][] = [
    ['minimax', 'Minimax', m.mmMove, m.mmNodes, m.mmMs],
    ['alphabeta', 'Alpha-Beta', m.abMove, m.abNodes, m.abMs]
  ];
  return (
    <>
      <table className="mtable">
        <thead>
          <tr>
            <th scope="col">Algorithm</th>
            <th scope="col">Move</th>
            <th scope="col">Nodes</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, name, move, nodes, ms]) => (
            <tr key={key} className={played === key ? 'played' : ''}>
              <td>
                {name}
                {played === key && <span className="tag">played</span>}
              </td>
              <td>{formatCell(move)}</td>
              <td>{formatNodes(nodes)}</td>
              <td>{formatMs(ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mfacts">
        <span>
          Pruned <b className="good">{formatPct(m.pctPruned)}</b>
        </span>
        <span className={m.same ? 'good' : 'bad'}>{m.same ? '✓ Same move' : '✗ Different moves'}</span>
      </div>
    </>
  );
}

interface Props {
  game: Game | null;
  compare: Measurement | null;
  comparing: boolean;
  canCompare: boolean;
  onCompare: () => void;
}

export default function Metrics({ game, compare, comparing, canCompare, onCompare }: Props) {
  const stats = game?.aiStats;
  const hasAi = game?.mode === 'ai';
  return (
    <section className="metrics" aria-label="Search metrics">
      <article className="panel mpanel">
        <small className="eyebrow">LAST AI MOVE</small>
        <h3>Minimax vs Alpha-Beta</h3>
        {game?.lastAi ? (
          <MeasureTable m={game.lastAi} played={game.lastAi.played} />
        ) : (
          <p className="muted">
            {hasAi
              ? 'No AI move yet. Every AI turn runs both searches: the selected one plays, the other is a shadow run for comparison.'
              : 'Start a match against the AI to see what each search costs per move.'}
          </p>
        )}
      </article>

      <article className="panel mpanel">
        <small className="eyebrow">THIS GAME</small>
        <h3>Search totals</h3>
        {stats && stats.turns > 0 ? (
          <div className="mgrid">
            <div className="stat"><small>Minimax nodes</small><strong>{formatNodes(stats.mmTotal)}</strong></div>
            <div className="stat"><small>Alpha-Beta nodes</small><strong>{formatNodes(stats.abTotal)}</strong></div>
            <div className="stat hi"><small>Pruned</small><strong>{formatPct(pctPruned(stats.mmTotal, stats.abTotal))}</strong></div>
            <div className="stat">
              <small>Same move on</small>
              <strong>{stats.same} / {stats.turns}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">No AI turns yet in this game.</p>
        )}
      </article>

      <article className="panel mpanel">
        <small className="eyebrow">COMPARE</small>
        <h3>Both searches, this board</h3>
        {compare ? (
          <MeasureTable m={compare} played={null} />
        ) : (
          <p className="muted">
            Runs Minimax and Alpha-Beta in your browser for the player to move and shows the work each one does.
            Analysis only: it never plays a move.
          </p>
        )}
        <button className="secondary compact" disabled={!canCompare || comparing} onClick={onCompare}>
          {comparing ? 'Comparing…' : 'Compare on this board'} <span>⇄</span>
        </button>
      </article>
    </section>
  );
}
