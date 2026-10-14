// Gate runner for the pure core. Run with `node checks.js`, or open checks.html
// and read the browser console. Never loaded by index.html.
(function () {
  'use strict';

  const CORE = ['game.js', 'minimax.js', 'alphabeta.js', 'metrics.js'];

  // In Node, load the same classic scripts the browser loads, in the same order.
  // Modules not built yet are skipped so each build step can run its own gate.
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const path = require('path');
    const vm = require('vm');
    for (const file of CORE) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        vm.runInThisContext(fs.readFileSync(filePath, 'utf8'), { filename: filePath });
      }
    }
  }

  // A green run must show what it did not test.
  const loaded = {
    'game.js': typeof Game !== 'undefined',
    'minimax.js': typeof Minimax !== 'undefined',
    'alphabeta.js': typeof AlphaBeta !== 'undefined',
    'metrics.js': typeof Metrics !== 'undefined'
  };
  const skipped = CORE.filter(function (f) { return !loaded[f]; });
  if (skipped.length > 0) {
    console.log('SKIPPED (not built yet): ' + skipped.join(', '));
  }

  let passed = 0;
  let failed = 0;

  function check(name, ok, detail) {
    if (ok) {
      passed++;
    } else {
      failed++;
      console.log('FAIL ' + name + (detail === undefined ? '' : ' -> ' + JSON.stringify(detail)));
    }
  }

  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function boardFrom(text) {
    return text.split('').map(function (c) { return c === '.' ? null : c; });
  }

  function gateGame() {
    const empty = Array(9).fill(null);
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    check('legal moves on empty Board are 0..8', same(Game.legalMoves(empty), [0, 1, 2, 3, 4, 5, 6, 7, 8]));
    check('legal moves skip occupied cells', same(Game.legalMoves(boardFrom('X...O...X')), [1, 2, 3, 5, 6, 7]));

    for (const mark of ['X', 'O']) {
      for (const line of lines) {
        const b = empty.slice();
        line.forEach(function (i) { b[i] = mark; });
        check('win ' + mark + ' ' + line, same(Game.winner(b), { mark: mark, line: line }), Game.winner(b));
      }
    }

    const draw = boardFrom('XOXXOOOXX');
    check('draw has no winner', Game.winner(draw) === null);
    check('draw Board is full', Game.isFull(draw));
    check('in-progress Board is not full', !Game.isFull(boardFrom('XO.......')));
    check('in-progress Board has no winner', Game.winner(boardFrom('XO.......')) === null);

    const xWins = boardFrom('XXXOO....');
    check('score: win for me = 10 - depth', Game.score(xWins, 'X', 3) === 7);
    check('score: loss for me = depth - 10', Game.score(xWins, 'O', 3) === -7);
    check('score: draw = 0', Game.score(draw, 'X', 9) === 0);
    check('score: not over = null', Game.score(boardFrom('XO.......'), 'X', 2) === null);
    check('rule functions do not mutate input', same(xWins, boardFrom('XXXOO....')));
    check('score: O win for O', Game.score(boardFrom('OOOXX.X..'), 'O', 5) === 5);
    check('score: depth-0 bounds are +10 / -10', Game.score(xWins, 'X', 0) === 10 && Game.score(xWins, 'O', 0) === -10);
    check('score: faster win scores higher', Game.score(xWins, 'X', 1) > Game.score(xWins, 'X', 5));
    const fullWin = boardFrom('XXXOOXOXO');
    check('score: full Board with a line is a win, not a draw', Game.score(fullWin, 'X', 9) === 1);

    const w = Game.winner(xWins);
    w.line[0] = 8;
    check('winner line is a copy', same(Game.winner(xWins).line, [0, 1, 2]));

    // State holder
    Game.resetScores();
    const g0 = Game.snapshot().generation;
    Game.newGame('X');
    let s = Game.snapshot();
    check('newGame: empty Board, X to move, playing', same(s.board, empty) && s.current === 'X' && s.status === 'playing' && s.winner === null && s.winLine === null, s);
    check('newGame increments generation', s.generation === g0 + 1);

    s.board[0] = 'O';
    check('snapshot is a copy', Game.snapshot().board[0] === null);

    for (const bad of ['x', 'o', undefined, 'O ', 1]) {
      check('newGame rejects ' + JSON.stringify(bad), Game.newGame(bad) === false && same(Game.snapshot(), Object.assign({}, s, { board: empty })));
    }

    check('play legal move returns true', Game.play(4) === true);
    s = Game.snapshot();
    check('play places mark and switches turn', s.board[4] === 'X' && s.current === 'O', s);
    Game.play(0);
    Game.play(8);
    check('turns alternate X, O, X', Game.snapshot().current === 'O' && Game.snapshot().board[0] === 'O' && Game.snapshot().board[8] === 'X');
    s = Game.snapshot();
    check('play on occupied cell is rejected', Game.play(4) === false && same(Game.snapshot(), s));
    for (const bad of [-1, 9, 1.5, '4', null, undefined]) {
      check('play rejects invalid cell ' + bad, Game.play(bad) === false && same(Game.snapshot(), s));
    }

    // X: 0,1,2 wins; O: 3,4
    Game.newGame('X');
    [0, 3, 1, 4, 2].forEach(function (c) { Game.play(c); });
    s = Game.snapshot();
    check('win sets status, winner and line', s.status === 'won' && s.winner === 'X' && same(s.winLine, [0, 1, 2]), s);
    check('win increments X score once', same(s.scoreboard, { x: 1, o: 0, draw: 0 }), s.scoreboard);
    check('play after Game over is rejected', Game.play(5) === false && same(Game.snapshot(), s));
    s.winLine[0] = 8;
    s.scoreboard.x = 99;
    check('snapshot winLine and scoreboard are copies', same(Game.snapshot().winLine, [0, 1, 2]) && Game.snapshot().scoreboard.x === 1);

    // Draw: X O X / X O O / O X X
    Game.newGame('X');
    [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(function (c) { Game.play(c); });
    s = Game.snapshot();
    check('draw sets status', s.status === 'draw' && s.winner === null && s.winLine === null, s);
    check('draw increments draw score', same(s.scoreboard, { x: 1, o: 0, draw: 1 }), s.scoreboard);

    // X wins with the 9th move (2-4-6 diagonal): X O X / O X X / X O O
    Game.newGame('X');
    [0, 1, 2, 3, 4, 8, 5, 7, 6].forEach(function (c) { Game.play(c); });
    s = Game.snapshot();
    check('win on the last cell is a win, not a draw', s.status === 'won' && s.winner === 'X' && same(s.scoreboard, { x: 2, o: 0, draw: 1 }), s);

    Game.newGame('O');
    s = Game.snapshot();
    check('newGame(O): O to move, Scoreboard kept', s.current === 'O' && same(s.scoreboard, { x: 2, o: 0, draw: 1 }), s);
    Game.play(0);
    check('newGame(O): X moves second', Game.snapshot().current === 'X');
    [3, 1, 4, 2].forEach(function (c) { Game.play(c); });
    check('O win increments O score', same(Game.snapshot().scoreboard, { x: 2, o: 1, draw: 1 }));

    const before = Game.snapshot();
    Game.resetScores();
    const after = Game.snapshot();
    check('resetScores zeroes Scoreboard only', same(after.scoreboard, { x: 0, o: 0, draw: 0 }) &&
      same(Object.assign({}, after, { scoreboard: null }), Object.assign({}, before, { scoreboard: null })));
  }

  // Shared by both search gates; `search` is Minimax.search or AlphaBeta.search.
  // `hints` maps a known-wrong empty-Board count to its usual cause.
  function gateSearch(name, search, emptyNodes, hints) {
    const empty = Array(9).fill(null);
    const r = search(empty, 'O');
    const hint = hints[r.nodesVisited] ? ' (' + hints[r.nodesVisited] + ')' : '';
    check(name + ': empty Board = ' + emptyNodes + ' Nodes, cell 0' + hint, r.nodesVisited === emptyNodes && r.bestMove === 0, r);
    check(name + ': same result when X is to move', same(search(empty, 'X'), r), search(empty, 'X'));
    check(name + ': rejects an invalid side to move', search(empty, 'x') === null && search(empty) === null);

    // [Board, side to move, expected cell]. Chosen so that the answer is not the lowest
    // empty cell, and so that ignoring depth, flipping perspective or hard-coding 'O' fails.
    const positions = [
      ['XOX.O.X..', 'O', 7, 'takes the immediate win over a slower one'],
      ['OXO.X.O..', 'X', 7, 'takes the immediate win over a slower one (X)'],
      ['XO.X.....', 'O', 6, 'blocks the threat'],
      ['OX.O.....', 'X', 6, 'blocks the threat (X)'],
      ['XOXO.X...', 'O', 8, 'finds the deeper best move'],
      ['XOXOO.X..', 'O', 5, 'equal wins keep the earlier cell'],
      ['XOXXOOOX.', 'X', 8, 'plays the last cell']
    ];
    for (const p of positions) {
      const b = boardFrom(p[0]);
      const res = search(b, p[1]);
      check(name + ': ' + p[3] + ' ' + p[0], res.bestMove === p[2], res);
      check(name + ': input Board not mutated ' + p[0], same(b, boardFrom(p[0])));
    }
    check(name + ': one empty cell = 2 Nodes', search(boardFrom('XOXXOOOX.'), 'X').nodesVisited === 2);
    check(name + ': won root returns null move, 1 Node', same(search(boardFrom('XXXOO....'), 'O'), { bestMove: null, nodesVisited: 1 }));
    check(name + ': drawn root returns null move, 1 Node', same(search(boardFrom('XOXXOOOXX'), 'O'), { bestMove: null, nodesVisited: 1 }));

    // FR-6: try every human reply against the AI, for both AI marks and both turn orders.
    for (const ai of ['O', 'X']) {
      for (const aiFirst of [false, true]) {
        let humanWins = 0;
        (function play(b, toMove) {
          const w = Game.winner(b);
          if (w !== null) { if (w.mark !== ai) humanWins++; return; }
          if (Game.isFull(b)) return;
          const next = toMove === 'X' ? 'O' : 'X';
          if (toMove === ai) {
            b[search(b, ai).bestMove] = ai;
            play(b, next);
          } else {
            for (const c of Game.legalMoves(b)) {
              const copy = b.slice();
              copy[c] = toMove;
              play(copy, next);
            }
          }
        })(Array(9).fill(null), aiFirst ? ai : (ai === 'X' ? 'O' : 'X'));
        check(name + ': AI ' + ai + (aiFirst ? ' moving first' : ' moving second') + ' never loses', humanWins === 0, humanWins);
      }
    }
  }

  // AI-turn set (spine AD-9): every distinct Board reachable by legal play where the Game
  // is not over and O is to move, built for X moving first and for O moving first.
  function aiTurnBoards(first) {
    const seen = new Set();
    const boards = [];
    (function walk(b, toMove) {
      if (Game.winner(b) !== null || Game.isFull(b)) return;
      if (toMove === 'O') {
        const key = b.map(function (c) { return c || '.'; }).join('');
        if (seen.has(key)) return;
        seen.add(key);
        boards.push(b.slice());
      }
      for (const c of Game.legalMoves(b)) {
        b[c] = toMove;
        walk(b, toMove === 'X' ? 'O' : 'X');
        b[c] = null;
      }
    })(Array(9).fill(null), first);
    return boards;
  }

  function gateSameMove() {
    const xFirst = aiTurnBoards('X');
    const oFirst = aiTurnBoards('O');
    const sizesOk = xFirst.length === 2097 && oFirst.length === 2423;
    check('AI-turn set = 2,097 (X first) + 2,423 (O first) = 4,520 Boards', sizesOk, [xFirst.length, oFirst.length]);
    // A wrong set would make the comparison below meaningless: fix the set, not the searches.
    if (!sizesOk) return;

    console.log('Running same-move gate over 4,520 Boards...');
    const boards = xFirst.concat(oFirst);
    let mismatches = 0;
    let moreNodes = 0;
    let mmTotal = 0;
    let abTotal = 0;
    for (const b of boards) {
      const mm = Minimax.search(b, 'O');
      const ab = AlphaBeta.search(b, 'O');
      if (mm.bestMove !== ab.bestMove) {
        if (mismatches < 5) {
          console.log('  mismatch ' + b.map(function (c) { return c || '.'; }).join('') + ' mm=' + mm.bestMove + ' ab=' + ab.bestMove);
        }
        mismatches++;
      }
      if (ab.nodesVisited > mm.nodesVisited) moreNodes++;
      mmTotal += mm.nodesVisited;
      abTotal += ab.nodesVisited;
    }
    if (mismatches > 5) console.log('  (' + (mismatches - 5) + ' more mismatches not shown)');
    check('same move on every AI-turn Board', mismatches === 0, mismatches);
    check('Alpha-Beta never visits more Nodes than Minimax', moreNodes === 0, moreNodes);
    check('Node totals over the set: Minimax 2,125,535, Alpha-Beta 309,653', mmTotal === 2125535 && abTotal === 309653, [mmTotal, abTotal]);
  }

  function gateMetrics() {
    const MEASUREMENT = ['mmMove', 'mmNodes', 'mmMs', 'abMove', 'abNodes', 'abMs'];
    const empty = Array(9).fill(null);
    Metrics.reset();

    const r1 = Metrics.runAiTurn(empty, 'O', 'alphabeta');
    check('runAiTurn returns {move, record}', r1 !== null && same(Object.keys(r1).sort(), ['move', 'record']), r1);
    const rec = r1.record;
    check('Move record has the PRD fields in order', same(Object.keys(rec), ['turn', 'board'].concat(MEASUREMENT)), Object.keys(rec));
    check('record: turn 1, Board copy, reference counts', rec.turn === 1 && same(rec.board, empty) &&
      rec.mmNodes === 549946 && rec.abNodes === 20866 && rec.mmMove === 0 && rec.abMove === 0, rec);
    // The empty-Board Minimax takes hundreds of ms, so this proves the timer wraps the search.
    check('record times wrap the searches', rec.mmMs > 1 && typeof rec.abMs === 'number' && rec.abMs >= 0, [rec.mmMs, rec.abMs]);
    check('alphabeta selected plays abMove', r1.move === rec.abMove);
    check('input Board not mutated', same(empty, Array(9).fill(null)));

    const b2 = boardFrom('XO.X.....');
    const r2 = Metrics.runAiTurn(b2, 'O', 'minimax');
    check('minimax selected plays mmMove (block at 6)', r2.move === r2.record.mmMove && r2.move === 6, r2);
    check('second AI turn is turn 2', r2.record.turn === 2);
    check('one Move record per AI turn', Metrics.history().length === 2);

    r2.record.board[0] = 'O';
    Metrics.history()[0].mmNodes = 1;
    b2[1] = 'X';
    check('history and records are copies', Metrics.history()[1].board[0] === 'X' && Metrics.history()[0].mmNodes === 549946 &&
      Metrics.history()[1].board[1] === 'O');

    const c = Metrics.compare(empty, 'X');
    check('compare returns a Measurement', same(Object.keys(c), MEASUREMENT) && c.mmNodes === 549946 && c.abNodes === 20866, c);
    check('compare does not append', Metrics.history().length === 2);

    const h = Metrics.history();
    const s = Metrics.summary();
    const mmSum = h[0].mmNodes + h[1].mmNodes;
    const abSum = h[0].abNodes + h[1].abNodes;
    check('summary totals equal the sums of the records', s.aiTurns === 2 && s.mmTotal === mmSum && s.abTotal === abSum, s);
    check('summary % pruned comes from the totals', s.pctPruned === (mmSum - abSum) / mmSum * 100, s);
    check('summary same-move count', s.sameCount === 2, s);
    check('summary has exactly the AD-6 fields', same(Object.keys(s), ['aiTurns', 'mmTotal', 'abTotal', 'pctPruned', 'sameCount']), Object.keys(s));

    const before = Metrics.history().length;
    check('invalid algorithm is rejected', Metrics.runAiTurn(empty, 'O', 'MiniMax') === null && Metrics.history().length === before);
    check('finished Board is rejected', Metrics.runAiTurn(boardFrom('XXXOO....'), 'O', 'minimax') === null && Metrics.history().length === before);
    check('invalid side is rejected', Metrics.compare(empty, 'x') === null &&
      Metrics.runAiTurn(empty, 'x', 'minimax') === null && Metrics.history().length === before);
    const done = Metrics.compare(boardFrom('XXXOO....'), 'O');
    check('compare on a finished Board: null moves, 1 Node each', done.mmMove === null && done.abMove === null &&
      done.mmNodes === 1 && done.abNodes === 1, done);

    Metrics.reset();
    check('reset clears history and summary', Metrics.history().length === 0 &&
      same(Metrics.summary(), { aiTurns: 0, mmTotal: 0, abTotal: 0, pctPruned: null, sameCount: 0 }), Metrics.summary());
    check('turn numbering restarts after reset', Metrics.runAiTurn(empty, 'O', 'minimax').record.turn === 1);
    Metrics.reset();

    check('pctPruned empty Board = 96.21', Metrics.formatPct(Metrics.pctPruned(549946, 20866)) === '96.21%');
    check('pctPruned can be 0.00%', Metrics.formatPct(Metrics.pctPruned(2, 2)) === '0.00%');
    check('pctPruned of nothing is null and shows a dash', Metrics.pctPruned(0, 0) === null && Metrics.formatPct(null) === '—');
    check('formatMs: 0 shows < 0.10 ms', Metrics.formatMs(0) === '< 0.10 ms');
    check('formatMs: a real sub-0.1 reading is shown', Metrics.formatMs(0.04) === '0.04 ms');
    check('formatMs: bad input shows a dash', Metrics.formatMs(NaN) === '—' && Metrics.formatMs(-1) === '—' && Metrics.formatMs(undefined) === '—');
    check('formatMs: 2 decimal places', Metrics.formatMs(1.234) === '1.23 ms' && Metrics.formatMs(0.1) === '0.10 ms', Metrics.formatMs(1.234));
    check('formatSame', Metrics.formatSame(3, 3) === '3 / 3 (100%)' && Metrics.formatSame(2, 3) === '2 / 3 (67%)' && Metrics.formatSame(0, 0) === '—');
    check('formatNodes adds thousands separators', Metrics.formatNodes(549946) === '549,946' && Metrics.formatNodes(2) === '2');
  }

  if (typeof Game === 'undefined') {
    check('game.js loaded', false);
  } else {
    gateGame();
    if (loaded['minimax.js']) {
      gateSearch('Minimax', Minimax.search, 549946, { 549945: 'root not counted', 549947: 'root counted twice' });
    }
    if (loaded['alphabeta.js']) {
      const failedBefore = failed;
      gateSearch('AlphaBeta', AlphaBeta.search, 20866, {
        125500: 'cutoff uses > instead of >=',
        34203: 'root alpha not raised after each child',
        20865: 'root not counted',
        20867: 'root counted twice'
      });
      // The same-move gate is the slow one; only run it on searches that passed their own gates.
      if (loaded['minimax.js'] && failed === failedBefore && failed === 0) gateSameMove();
    }
    if (loaded['metrics.js'] && loaded['minimax.js'] && loaded['alphabeta.js']) {
      try {
        gateMetrics();
      } catch (e) {
        check('Metrics gate ran to completion', false, String(e));
      }
    }
  }

  console.log((failed === 0 ? 'PASS' : 'FAIL') + ': ' + passed + ' passed, ' + failed + ' failed');
  if (typeof process !== 'undefined' && failed > 0) {
    process.exitCode = 1;
  }
})();
