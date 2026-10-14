// View: draws one pre-formatted view object and reports user intents.
// It never calls Game, Metrics or the searches, and keeps nothing between renders but DOM references.
const UI = (function () {
  'use strict';

  let els = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function bind(handlers) {
    if (els !== null) return;
    const byId = function (id) {
      const node = document.getElementById(id);
      if (node === null) throw new Error('UI: missing element #' + id + ' in index.html');
      return node;
    };
    els = {
      status: byId('status'),
      board: byId('board'),
      cells: [],
      mode: byId('mode'),
      first: byId('first'),
      algo: byId('algo'),
      reset: byId('reset'),
      compare: byId('compare'),
      resetScores: byId('reset-scores'),
      labelX: byId('label-x'),
      labelO: byId('label-o'),
      scoreX: byId('score-x'),
      scoreO: byId('score-o'),
      scoreDraw: byId('score-draw'),
      lastMove: byId('last-move'),
      summary: byId('summary'),
      compareResult: byId('compare-result')
    };

    for (let i = 0; i < 9; i++) {
      const cell = el('button', 'cell');
      cell.type = 'button';
      cell.addEventListener('click', function () { handlers.onCell(i); });
      els.board.appendChild(cell);
      els.cells.push(cell);
    }

    els.reset.addEventListener('click', function () { handlers.onReset(); });
    els.compare.addEventListener('click', function () { handlers.onCompare(); });
    els.resetScores.addEventListener('click', function () { handlers.onResetScores(); });
    els.mode.addEventListener('change', function () { handlers.onMode(els.mode.value); });
    els.first.addEventListener('change', function () { handlers.onFirst(els.first.value); });
    els.algo.addEventListener('change', function () { handlers.onAlgo(els.algo.value); });
  }

  function renderBoard(view) {
    const winLine = view.winLine || [];
    els.board.classList.toggle('locked', !view.cellsEnabled);
    view.board.forEach(function (mark, i) {
      const cell = els.cells[i];
      const winning = winLine.indexOf(i) !== -1;
      cell.className = 'cell' + (mark ? ' ' + mark.toLowerCase() : '') + (winning ? ' win' : '');
      // The index stays visible so "cell 4" in the panels can be found on the Board.
      cell.replaceChildren(el('span', 'index', String(i)));
      if (mark) cell.appendChild(document.createTextNode(mark));
      cell.setAttribute('aria-label', 'Cell ' + i + ': ' + (mark || 'empty') + (winning ? ', winning line' : ''));
      cell.disabled = !view.cellsEnabled || mark !== null;
    });
  }

  // Minimax and Alpha-Beta side by side; `playedAlgo` marks the row whose move was played.
  function measurementTable(m, playedAlgo) {
    const table = el('table');
    const thead = el('thead');
    const head = el('tr');
    ['Algorithm', 'Move', 'Nodes', 'Time'].forEach(function (h) {
      const th = el('th', '', h);
      th.scope = 'col';
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);
    const tbody = el('tbody');
    table.appendChild(tbody);

    [['minimax', 'Minimax', m.mmMove, m.mmNodes, m.mmTime],
     ['alphabeta', 'Alpha-Beta', m.abMove, m.abNodes, m.abTime]].forEach(function (r) {
      const row = el('tr');
      const name = el('td', '', r[1]);
      if (r[0] === playedAlgo) name.appendChild(el('span', 'played', 'played'));
      row.appendChild(name);
      row.appendChild(el('td', '', r[2]));
      row.appendChild(el('td', '', r[3]));
      row.appendChild(el('td', '', r[4]));
      tbody.appendChild(row);
    });

    const facts = el('p', 'facts');
    const pruned = el('span', '', 'Pruned ');
    pruned.appendChild(el('strong', '', m.pctText));
    facts.appendChild(pruned);
    const verdict = el('strong', m.same ? 'same' : 'differs', m.same ? 'Same move ' : 'Different moves ');
    const symbol = el('span', '', m.same ? '✓' : '✗');
    symbol.setAttribute('aria-hidden', 'true');
    verdict.appendChild(symbol);
    facts.appendChild(verdict);

    return [table, facts];
  }

  function fill(container, nodes) {
    container.replaceChildren.apply(container, nodes);
  }

  function renderPanels(view) {
    fill(els.lastMove, view.lastMove
      ? measurementTable(view.lastMove, view.lastMove.played)
      : [el('p', 'empty', 'No AI move yet in this Game.')]);

    if (view.summary) {
      const facts = el('p', 'facts');
      [['Minimax Nodes ', view.summary.mmTotal],
       ['Alpha-Beta Nodes ', view.summary.abTotal],
       ['Pruned ', view.summary.pctText],
       ['Same move on ', view.summary.sameText]].forEach(function (f) {
        const item = el('span', '', f[0]);
        item.appendChild(el('strong', '', f[1]));
        facts.appendChild(item);
      });
      fill(els.summary, [facts]);
    } else {
      fill(els.summary, [el('p', 'empty', 'No AI turns yet in this Game.')]);
    }

    fill(els.compareResult, view.compare
      ? measurementTable(view.compare, null)
      : [el('p', 'empty', 'Press Compare to run both algorithms on the current Board.')]);
  }

  function render(view) {
    // Only touch the live region when the text changes, so screen readers do not repeat it.
    if (els.status.textContent !== view.statusText) els.status.textContent = view.statusText;
    renderBoard(view);

    els.mode.value = view.settings.mode;
    els.first.value = view.settings.first;
    els.algo.value = view.settings.algo;
    els.first.disabled = view.settings.mode === 'pvp';
    els.compare.disabled = !view.compareEnabled;

    const pvai = view.settings.mode === 'pvai';
    els.labelX.textContent = pvai ? 'You (X)' : 'X wins';
    els.labelO.textContent = pvai ? 'AI (O)' : 'O wins';
    els.scoreX.textContent = String(view.scoreboard.x);
    els.scoreO.textContent = String(view.scoreboard.o);
    els.scoreDraw.textContent = String(view.scoreboard.draw);

    renderPanels(view);
  }

  return { bind: bind, render: render };
})();
