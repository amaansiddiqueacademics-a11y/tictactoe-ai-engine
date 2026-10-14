// Controller: owns the settings and the AI turn, and builds the formatted view for ui.js.
// startGame() is the only way to start a Game; afterChange() is the only place an AI turn is scheduled.
const App = (function () {
  'use strict';

  const AI = 'O';
  const MODES = ['pvai', 'pvp'];
  const FIRSTS = ['human', 'ai'];
  const ALGOS = ['minimax', 'alphabeta'];

  const settings = { mode: 'pvai', first: 'human', algo: 'minimax' };
  let aiThinking = false;
  let comparing = false;
  let errorText = null;      // shown in place of the turn indicator until the next Game
  let rafId = null;
  let timerId = null;
  let fallbackId = null;
  let lastMove = null;       // { record, played } from the latest AI turn in this Game
  let compareResult = null;  // Measurement from the latest Compare, cleared by any Game change

  function firstMark() {
    return settings.mode === 'pvai' && settings.first === 'ai' ? AI : 'X';
  }

  function aiToMove(snap) {
    return settings.mode === 'pvai' && snap.status === 'playing' && snap.current === AI;
  }

  function cancelPending() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (timerId !== null) clearTimeout(timerId);
    if (fallbackId !== null) clearTimeout(fallbackId);
    rafId = null;
    timerId = null;
    fallbackId = null;
  }

  function startGame() {
    cancelPending();
    aiThinking = false;
    comparing = false;
    errorText = null;
    Game.newGame(firstMark());
    Metrics.reset();
    lastMove = null;
    compareResult = null;
    afterChange();
  }

  function afterChange() {
    if (!aiThinking && aiToMove(Game.snapshot())) {
      startAiTurn();
    } else {
      render();
    }
  }

  // Runs `fn` once the current state is on screen: the rAF callback runs before the next paint
  // and the setTimeout after it, so a synchronous search starts only once the frame is painted.
  // Frames are not guaranteed (background tab, headless browser), so a fallback timer makes
  // sure `fn` still runs; whichever fires first wins and cancels the other.
  function afterPaint(fn) {
    const go = function () {
      cancelPending();
      fn();
    };
    rafId = requestAnimationFrame(function () {
      rafId = null;
      timerId = setTimeout(go, 0);
    });
    fallbackId = setTimeout(go, 200);
  }

  function startAiTurn() {
    const generation = Game.snapshot().generation;
    // The algorithm is fixed when the turn starts; a change now applies to the next AI turn.
    const algo = settings.algo;
    aiThinking = true;
    render();
    afterPaint(function () { runAiTurn(generation, algo); });
  }

  function runAiTurn(generation, algo) {
    const snap = Game.snapshot();
    // A new Game started during the yield: drop this turn.
    if (snap.generation !== generation || !aiToMove(snap)) {
      aiThinking = false;
      render();
      return;
    }
    let result = null;
    try {
      result = Metrics.runAiTurn(snap.board, snap.current, algo);
    } catch (e) {
      result = null;
    }
    aiThinking = false;
    // Never retry: a failing search would otherwise loop and keep appending records.
    if (result === null || !Game.play(result.move)) {
      errorText = 'The AI could not move. Press New Game.';
      render();
      return;
    }
    lastMove = { record: result.record, played: algo };
    compareResult = null;
    afterChange();
  }

  // --- intents from ui.js ---

  function onCell(i) {
    if (aiThinking || comparing) return;
    const snap = Game.snapshot();
    if (settings.mode === 'pvai' && snap.current === AI) return;
    if (Game.play(i)) {
      compareResult = null;
      afterChange();
    }
  }

  // Both full searches can take a noticeable moment, so "Comparing…" is painted first.
  function onCompare() {
    if (aiThinking || comparing) return;
    if (Game.snapshot().status !== 'playing') return;
    comparing = true;
    render();
    afterPaint(function () {
      const snap = Game.snapshot();
      compareResult = Metrics.compare(snap.board, snap.current);
      comparing = false;
      render();
    });
  }

  function onMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    settings.mode = mode;
    startGame();
  }

  function onFirst(first) {
    if (FIRSTS.indexOf(first) === -1) return;
    settings.first = first;
    startGame();
  }

  // Takes effect on the next AI turn; the current Game and its records stay valid.
  function onAlgo(algo) {
    if (ALGOS.indexOf(algo) === -1) return;
    settings.algo = algo;
    render();
  }

  function onResetScores() {
    Game.resetScores();
    render();
  }

  // --- view ---

  function formatMeasurement(m) {
    const cell = function (c) { return c === null ? '—' : 'cell ' + c; };
    return {
      mmMove: cell(m.mmMove),
      mmNodes: Metrics.formatNodes(m.mmNodes),
      mmTime: Metrics.formatMs(m.mmMs),
      abMove: cell(m.abMove),
      abNodes: Metrics.formatNodes(m.abNodes),
      abTime: Metrics.formatMs(m.abMs),
      pctText: Metrics.formatPct(Metrics.pctPruned(m.mmNodes, m.abNodes)),
      same: m.mmMove === m.abMove
    };
  }

  function statusText(snap) {
    const pvai = settings.mode === 'pvai';
    if (errorText !== null) return errorText;
    if (aiThinking) return 'AI thinking…';
    if (comparing) return 'Comparing…';
    if (snap.status === 'won') {
      if (!pvai) return snap.winner + ' wins';
      return snap.winner === AI ? 'AI (O) wins' : 'You (X) win';
    }
    if (snap.status === 'draw') return 'Draw';
    if (!pvai) return snap.current + '’s turn';
    return snap.current === AI ? 'AI’s turn (O)' : 'Your turn (X)';
  }

  function buildView() {
    const snap = Game.snapshot();
    const playing = snap.status === 'playing';
    const busy = aiThinking || comparing;
    const summary = Metrics.summary();

    let lastView = null;
    if (lastMove !== null) {
      lastView = formatMeasurement(lastMove.record);
      lastView.played = lastMove.played;
    }

    return {
      board: snap.board,
      winLine: snap.winLine,
      statusText: statusText(snap),
      cellsEnabled: !busy && playing && !(settings.mode === 'pvai' && snap.current === AI),
      compareEnabled: !busy && playing && errorText === null,
      settings: { mode: settings.mode, first: settings.first, algo: settings.algo },
      scoreboard: snap.scoreboard,
      lastMove: lastView,
      summary: summary.aiTurns === 0 ? null : {
        mmTotal: Metrics.formatNodes(summary.mmTotal),
        abTotal: Metrics.formatNodes(summary.abTotal),
        pctText: Metrics.formatPct(summary.pctPruned),
        sameText: Metrics.formatSame(summary.sameCount, summary.aiTurns)
      },
      compare: compareResult === null ? null : formatMeasurement(compareResult)
    };
  }

  function render() {
    UI.render(buildView());
  }

  function start() {
    UI.bind({
      onCell: onCell,
      onReset: startGame,
      onCompare: onCompare,
      onMode: onMode,
      onFirst: onFirst,
      onAlgo: onAlgo,
      onResetScores: onResetScores
    });
    startGame();
  }

  return { start: start };
})();
