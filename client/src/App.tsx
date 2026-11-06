import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl, socket } from './socket';
import Algorithm from './Algorithm';
import Metrics from './Metrics';
import { Confetti, Mark, afterPaint, sfx } from './ui';
import { measure } from '../../shared/engine.js';
import { aiToMove, applyMove, createInitialGame, playAiTurn, validateMove } from '../../shared/match.js';
import type { Ack, Algorithm as Algo, Game, Identity, Measurement, Mode, Where } from './types';

const ID_KEY = 'ttt-guest-identity';
const ROOM_KEY = 'ttt-last-room';
const SCORE_KEY = 'ttt-score';
const MUTE_KEY = 'ttt-muted';
const SETTINGS_KEY = 'ttt-settings';
const LOCAL_ROOM = 'LOCAL';

type Score = { w: number; l: number; d: number };
type Settings = { mode: Mode; where: Where; algo: Algo; aiFirst: boolean };
const ZERO: Score = { w: 0, l: 0, d: 0 };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): the game still works */
  }
}

// One guest identity per page load, even though React StrictMode runs effects twice in development.
let guestPromise: Promise<Identity> | null = null;
function getGuest(forceNew = false): Promise<Identity> {
  if (forceNew) {
    localStorage.removeItem(ID_KEY);
    guestPromise = null;
  }
  guestPromise ??= (async () => {
    const saved = load<Partial<Identity>>(ID_KEY, {});
    if (saved.token && saved.userId) return saved as Identity;
    const r = await fetch(`${apiUrl}/api/guest`, { method: 'POST' });
    if (!r.ok) throw new Error(`Game server unavailable (HTTP ${r.status}).`);
    const guest = (await r.json()) as Identity;
    save(ID_KEY, guest);
    return guest;
  })().catch((e) => {
    guestPromise = null;
    throw e;
  });
  return guestPromise;
}

const LOCAL_IDS = { X: 'local-X', O: 'local-O' };

function newLocalGame(s: Settings): Game {
  const g = createInitialGame({ roomCode: LOCAL_ROOM, mode: s.mode, algo: s.algo, aiFirst: s.aiFirst, hostId: LOCAL_IDS.X, hostName: s.mode === 'ai' ? 'You' : 'Player X' });
  if (s.mode === 'pvp') {
    g.players.O = { id: LOCAL_IDS.O, name: 'Player O', connected: true };
    g.status = 'playing';
  }
  return g;
}

export default function App() {
  const [tab, setTab] = useState<'play' | 'algo'>('play');
  const [settings, setSettings] = useState<Settings>(() => load(SETTINGS_KEY, { mode: 'ai', where: 'local', algo: 'alphabeta', aiFirst: false }));
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [serverUp, setServerUp] = useState<boolean | null>(null); // null = still checking
  const [connected, setConnected] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [where, setWhere] = useState<Where>('local'); // where the *current* game runs
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [notice, setNotice] = useState('Checking for the game server…');
  const [compare, setCompare] = useState<Measurement | null>(null);
  const [comparing, setComparing] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const [score, setScore] = useState<Score>(() => load(SCORE_KEY, ZERO));

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const prev = useRef<Game | null>(null);
  const activeRoom = useRef<string | null>(null); // online room this tab follows
  const localGen = useRef(0); // bumps on every new local game, so stale AI turns are dropped

  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const n = { ...s, ...patch };
      save(SETTINGS_KEY, n);
      return n;
    });

  const mySymbol = useMemo(() => {
    if (!game) return null;
    if (where === 'local') return game.mode === 'ai' ? 'X' : null; // pass-and-play: nobody is "me"
    if (!identity) return null;
    return game.players.X?.id === identity.userId ? 'X' : game.players.O?.id === identity.userId ? 'O' : null;
  }, [game, identity, where]);

  // ---------- reactions to state changes: sounds and the scoreboard ----------
  useEffect(() => {
    const p = prev.current;
    prev.current = game;
    setCompare(null);
    if (!game || !p || p.roomCode !== game.roomCode || p.createdAt !== game.createdAt) return;
    const filled = (g: Game) => g.board.filter(Boolean).length;
    if (filled(game) > filled(p) && !mutedRef.current) {
      const last = game.board.findIndex((v, i) => v && !p.board[i]);
      sfx.place(game.board[last] === 'X');
    }
    if (game.status === 'finished' && p.status !== 'finished') {
      if (mySymbol) {
        const r = game.winner === 'draw' ? 'd' : game.winner === mySymbol ? 'w' : 'l';
        setScore((s) => {
          const n = { ...s, [r]: s[r] + 1 };
          save(SCORE_KEY, n);
          return n;
        });
        if (!mutedRef.current) setTimeout(() => (r === 'w' ? sfx.win() : r === 'l' ? sfx.lose() : sfx.draw()), 250);
      } else if (!mutedRef.current) {
        setTimeout(() => (game.winner === 'draw' ? sfx.draw() : sfx.win()), 250);
      }
    }
  }, [game, mySymbol]);

  // ---------- online: guest identity + socket ----------
  const connect = useCallback(async (forceNew = false) => {
    try {
      const guest = await getGuest(forceNew);
      setIdentity(guest);
      setServerUp(true);
      socket.auth = { token: guest.token };
      if (!socket.connected) socket.connect();
    } catch {
      setServerUp(false);
      setSettings((s) => ({ ...s, where: 'local' }));
      setNotice('Game server not reachable. You can still play on this device; online rooms need the server.');
    }
  }, []);

  useEffect(() => {
    connect();
    const onConnect = () => {
      setConnected(true);
      setServerUp(true);
      setNotice((n) => (n.startsWith('Room') || n.startsWith('Joined') ? n : 'Connected. Create a room or play on this device.'));
      // Rejoin the room this tab is in (the connection dropped), or resume the last room
      // after a page reload, as long as the player has not started something else meanwhile.
      const code = activeRoom.current ?? (prev.current === null ? localStorage.getItem(ROOM_KEY) : null);
      if (!code) return;
      socket.emit('room:reconnect', { roomCode: code }, (a: Ack) => {
        if (!a.ok || !a.game) {
          if (activeRoom.current === code) activeRoom.current = null;
          localStorage.removeItem(ROOM_KEY);
          return;
        }
        if (activeRoom.current !== code && prev.current !== null) return;
        activeRoom.current = code;
        prev.current = a.game;
        setWhere('online');
        setGame(a.game);
      });
    };
    const onDisconnect = () => {
      setConnected(false);
      setNotice('Connection lost. Reconnecting…');
    };
    const onError = (e: Error) => {
      setConnected(false);
      if (/token/i.test(e.message)) {
        // The server's signing secret changed: get a fresh guest identity.
        socket.disconnect();
        connect(true);
      } else {
        setNotice(`Connection error: ${e.message}`);
      }
    };
    const onState = (g: Game) => {
      if (g.roomCode !== activeRoom.current) return; // a late update from a room we left
      setGame(g);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('game:state', onState);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('game:state', onState);
    };
  }, [connect]);

  const enterOnline = (g: Game) => {
    activeRoom.current = g.roomCode;
    prev.current = g;
    save(ROOM_KEY, g.roomCode);
    setWhere('online');
    setGame(g);
  };

  // ---------- local (in-browser) games ----------
  const runLocalAi = useCallback((g: Game) => {
    if (!aiToMove(g)) return;
    const gen = localGen.current;
    setAiThinking(true);
    // Wait for "AI is thinking…" to paint, then search (an empty-board Minimax takes ~50 ms).
    afterPaint(() => {
      setTimeout(() => {
        if (gen !== localGen.current) return;
        const next = structuredClone(g);
        playAiTurn(next);
        setAiThinking(false);
        setGame(next);
      }, 250);
    });
  }, []);

  const leaveOnline = () => {
    const code = activeRoom.current;
    activeRoom.current = null;
    localStorage.removeItem(ROOM_KEY);
    if (code && socket.connected) socket.emit('room:leave', { roomCode: code }, () => {});
  };

  const startLocal = () => {
    leaveOnline();
    localGen.current++;
    setAiThinking(false);
    const g = newLocalGame(settings);
    prev.current = g;
    setWhere('local');
    setGame(g);
    setNotice(settings.mode === 'ai' ? `Playing the AI on this device (${settings.algo === 'minimax' ? 'Minimax' : 'Alpha-Beta'}).` : 'Pass-and-play on this device. X starts.');
    runLocalAi(g);
  };

  // ---------- actions ----------
  const create = () => {
    if (settings.where === 'local') return startLocal();
    setBusy(true);
    localGen.current++;
    socket.emit('room:create', { mode: settings.mode, algo: settings.algo, aiFirst: settings.aiFirst }, (a: Ack) => {
      setBusy(false);
      if (!a.ok || !a.game) return setNotice(a.error || 'Could not create room');
      leaveOnline();
      enterOnline(a.game);
      setRoom(a.game.roomCode);
      setNotice(`Room ${a.game.roomCode} created. ${settings.mode === 'pvp' ? 'Share the code with a friend.' : 'The AI runs on the server.'}`);
    });
  };

  const join = () => {
    const c = room.trim().toUpperCase();
    if (!c) return setNotice('Enter a room code.');
    setBusy(true);
    socket.emit('room:join', { roomCode: c }, (a: Ack) => {
      setBusy(false);
      if (!a.ok || !a.game) return setNotice(a.error || 'Could not join room');
      localGen.current++;
      if (activeRoom.current !== c) leaveOnline();
      enterOnline(a.game);
      setNotice(`Joined room ${c}.`);
    });
  };

  const reconnect = () => {
    const c = room.trim().toUpperCase() || localStorage.getItem(ROOM_KEY);
    if (!c) return setNotice('No previous room found.');
    socket.emit('room:reconnect', { roomCode: c }, (a: Ack) => {
      if (!a.ok || !a.game) return setNotice(a.error || 'Could not reconnect');
      localGen.current++;
      enterOnline(a.game);
      setNotice(`Reconnected to ${c}.`);
    });
  };

  const move = (cell: number) => {
    if (!game) return;
    if (where === 'local') {
      const who = game.players[game.currentTurn]?.id ?? '';
      if (aiThinking || validateMove(game, who, cell)) return;
      const next = structuredClone(game);
      applyMove(next, next.currentTurn, cell);
      setGame(next);
      runLocalAi(next);
      return;
    }
    if (!mySymbol) return;
    socket.emit('game:move', { roomCode: game.roomCode, cell }, (a: Ack) => {
      if (!a.ok) setNotice(a.error || 'Move rejected');
      else if (a.game && a.game.roomCode === activeRoom.current) setGame(a.game);
    });
  };

  const rematch = () => {
    if (!game) return;
    if (where === 'local') {
      localGen.current++;
      const g = newLocalGame({ ...settings, mode: game.mode, algo: game.algo, aiFirst: game.aiFirst });
      prev.current = g;
      setGame(g);
      runLocalAi(g);
      return;
    }
    socket.emit('game:rematch', { roomCode: game.roomCode }, (a: Ack) => {
      if (!a.ok) setNotice(a.error || 'Could not restart');
      else if (a.game) {
        prev.current = a.game;
        setGame(a.game);
      }
    });
  };

  const leave = () => {
    if (where === 'online') leaveOnline();
    localGen.current++;
    setAiThinking(false);
    prev.current = null;
    setGame(null);
    setRoom('');
  };

  const runCompare = () => {
    if (!game || game.status !== 'playing') return;
    setComparing(true);
    const board = game.board.slice();
    const side = game.currentTurn;
    afterPaint(() => {
      setCompare(measure(board, side));
      setComparing(false);
    });
  };

  const toggleMute = () =>
    setMuted((m) => {
      save(MUTE_KEY, m ? '0' : '1');
      return !m;
    });
  const resetScore = () => {
    setScore(ZERO);
    save(SCORE_KEY, ZERO);
  };

  // ---------- view ----------
  const local = where === 'local';
  const isAiGame = game?.mode === 'ai';
  const myTurn = !!game && game.status === 'playing' && !aiThinking && (local ? !(isAiGame && game.currentTurn === 'O') : game.currentTurn === mySymbol);
  const result = game?.status === 'finished'
    ? game.winner === 'draw' ? 'draw' : mySymbol ? (game.winner === mySymbol ? 'win' : 'lose') : 'win'
    : null;
  const line = game?.winLine ?? null;
  const online = settings.where === 'online';
  const canOnline = serverUp === true && connected;

  const status = () => {
    if (!game) return 'Press start to enter the arena';
    if (game.status === 'waiting') return 'Waiting for a challenger…';
    if (game.status === 'finished') {
      if (game.winner === 'draw') return 'Stalemate!';
      if (!mySymbol) return `${game.winner} wins!`;
      return result === 'win' ? 'Victory' : 'Defeat';
    }
    if (aiThinking || (isAiGame && game.currentTurn === 'O')) return 'AI is thinking…';
    if (local && !isAiGame) return `${game.currentTurn} to move`;
    if (!mySymbol) return 'Spectating';
    return myTurn ? 'Your move' : 'Opponent’s move';
  };

  const opponentName = (side: 'X' | 'O') => {
    const p = game?.players[side];
    if (p) return p.name + (!local && p.id !== 'AI' && !p.connected ? ' (away)' : '');
    return side === 'O' && game?.mode !== 'ai' ? 'Waiting…' : side === 'O' ? 'Minimax AI' : 'Player X';
  };
  const roleLabel = (side: 'X' | 'O') => {
    if (mySymbol === side) return 'YOU';
    if (side === 'O' && (game?.mode ?? settings.mode) === 'ai') return 'AI OPPONENT';
    return side === 'X' ? 'PLAYER 1' : 'PLAYER 2';
  };

  const algoName = (a: Algo) => (a === 'minimax' ? 'Minimax' : 'Alpha-Beta');

  return (
    <main className="shell">
      <header className="top">
        <div className="logo">X<span>O</span></div>
        <div>
          <small className="eyebrow">AI ENGINE · REAL-TIME</small>
          <h1>Tic-Tac-Toe <em>AI Engine</em></h1>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'play'} className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>🎮 Play</button>
          <button role="tab" aria-selected={tab === 'algo'} className={tab === 'algo' ? 'on' : ''} onClick={() => setTab('algo')}>🧠 How the AI works</button>
        </nav>
        <button className="icon" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title="Sound">{muted ? '🔇' : '🔊'}</button>
        <span className={`pill ${connected ? 'on' : ''}`} title={connected ? 'Connected to the game server' : 'Offline: local play only'}>
          {connected ? '● Online' : serverUp === null ? '● Connecting' : '● Offline'}
        </span>
      </header>

      {tab === 'algo' ? (
        <Algorithm />
      ) : (
        <>
          <section className="layout">
            <aside className="panel lobby">
              <small className="eyebrow">LOBBY</small>
              <h2>Choose your battle</h2>
              <div className="modes">
                <button className={settings.mode === 'ai' ? 'on' : ''} onClick={() => updateSettings({ mode: 'ai' })}>
                  <span>🤖</span><b>vs AI</b><small>Unbeatable minimax</small>
                </button>
                <button className={settings.mode === 'pvp' ? 'on' : ''} onClick={() => updateSettings({ mode: 'pvp' })}>
                  <span>⚔️</span><b>vs Friend</b><small>{online ? 'Share a room code' : 'Same device'}</small>
                </button>
              </div>

              <div className="opts">
                <div className="opt">
                  <span>Play on</span>
                  <div className="seg" role="radiogroup" aria-label="Play on">
                    <button role="radio" aria-checked={!online} className={!online ? 'on' : ''} onClick={() => updateSettings({ where: 'local' })}>This device</button>
                    <button role="radio" aria-checked={online} className={online ? 'on' : ''} disabled={!canOnline} onClick={() => updateSettings({ where: 'online' })} title={canOnline ? '' : 'Game server not connected'}>Online</button>
                  </div>
                </div>
                {settings.mode === 'ai' && (
                  <>
                    <div className="opt">
                      <span>Moves first</span>
                      <div className="seg" role="radiogroup" aria-label="Moves first">
                        <button role="radio" aria-checked={!settings.aiFirst} className={!settings.aiFirst ? 'on' : ''} onClick={() => updateSettings({ aiFirst: false })}>You (X)</button>
                        <button role="radio" aria-checked={settings.aiFirst} className={settings.aiFirst ? 'on' : ''} onClick={() => updateSettings({ aiFirst: true })}>AI (O)</button>
                      </div>
                    </div>
                    <div className="opt">
                      <span>AI algorithm</span>
                      <div className="seg" role="radiogroup" aria-label="AI algorithm">
                        {(['alphabeta', 'minimax'] as Algo[]).map((a) => (
                          <button key={a} role="radio" aria-checked={settings.algo === a} className={settings.algo === a ? 'on' : ''} onClick={() => updateSettings({ algo: a })}>{algoName(a)}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button className="primary" disabled={busy || (online && !canOnline)} onClick={create}>
                {busy ? 'Please wait…' : '▶ START MATCH'}
              </button>

              {online && (
                <>
                  <div className="or">OR JOIN A FRIEND</div>
                  <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ROOM CODE" aria-label="Room code" maxLength={6} />
                  <button className="secondary" disabled={!canOnline || busy} onClick={join}>Join room <span>→</span></button>
                  <button className="link" disabled={!canOnline} onClick={reconnect}>↻ Reconnect to last room</button>
                </>
              )}
              {serverUp === false && <button className="link" onClick={() => connect()}>↻ Try the game server again</button>}
              <div className="notice" role="status">● {notice}</div>

              <div className="scoreboard">
                <small className="eyebrow">YOUR RECORD <button className="link inline" onClick={resetScore}>reset</button></small>
                <div>
                  <span className="w"><b>{score.w}</b>Wins</span>
                  <span className="d"><b>{score.d}</b>Draws</span>
                  <span className="l"><b>{score.l}</b>Losses</span>
                </div>
              </div>
            </aside>

            <section className={`panel game ${result || ''}`}>
              <div className="gamehead">
                <div>
                  <small className="eyebrow">
                    {game ? `${isAiGame ? `VS ${algoName(game.algo).toUpperCase()} AI` : 'FRIEND MATCH'} · ${local ? 'THIS DEVICE' : 'ONLINE'}` : 'READY PLAYER ONE'}
                  </small>
                  <h2>{game ? (local ? 'Local match' : `Room ${game.roomCode}`) : 'Arena'}</h2>
                </div>
                {game && !local && (
                  <button className="copy" onClick={() => { navigator.clipboard?.writeText(game.roomCode); setNotice('Room code copied.'); }}>▣ Copy code</button>
                )}
              </div>
              <div className="players">
                {(['X', 'O'] as const).map((side, i) => (
                  <div key={side} style={{ display: 'contents' }}>
                    {i === 1 && <i>VS</i>}
                    <div className={`player ${game?.status === 'playing' && game.currentTurn === side ? 'turn' : ''}`}>
                      <b className={side.toLowerCase()}>{side}</b>
                      <span><strong>{opponentName(side)}</strong><small>{roleLabel(side)}</small></span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`status ${result || ''} ${myTurn && mySymbol ? 'mine' : ''}`} aria-live="polite"><strong>{status()}</strong></div>
              <div className="boardwrap">
                {result === 'win' && <Confetti />}
                <div className="board">
                  {(game?.board || Array(9).fill('')).map((v, i) => (
                    <button
                      key={i}
                      aria-label={`Cell ${i + 1}${v ? `, ${v}` : ', empty'}${line?.includes(i) ? ', winning line' : ''}`}
                      className={`cell ${v ? 'filled' : ''} ${line?.includes(i) ? 'winning' : ''} ${myTurn && !v ? 'hot' : ''}`}
                      disabled={!myTurn || Boolean(v)}
                      onClick={() => move(i)}
                    >
                      {v ? <Mark v={v} /> : <small>{i + 1}</small>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="gamefoot">
                <span>
                  {game?.status === 'finished'
                    ? 'Match over.'
                    : local ? 'Running entirely in your browser.' : 'Moves are validated by the server.'}
                </span>
                {game && (
                  <span className="actions">
                    {game.status === 'finished' && <button className="primary mini" onClick={rematch}>Play again</button>}
                    <button className="link" onClick={leave}>{game.status === 'finished' ? 'Back to lobby' : 'Leave board'}</button>
                  </span>
                )}
              </div>
            </section>
          </section>

          <Metrics game={game} compare={compare} comparing={comparing} canCompare={game?.status === 'playing' && !aiThinking} onCompare={runCompare} />
        </>
      )}
      <footer>
        Built with React, Socket.IO & Minimax <span>Minimax vs Alpha-Beta: same move, less search.</span>
      </footer>
    </main>
  );
}
