import {useMemo,useState} from 'react';
import AlgoAnimation from './AlgoAnimation';
import {evaluateMoves,isTerminal} from '../../shared/engine.js';
import {Mark} from './ui';
type Cell='X'|'O'|'';

export default function Algorithm(){
 const [board,setBoard]=useState<Cell[]>(['X','','','','O','','','','X']);
 const [turn,setTurn]=useState<'X'|'O'>('O');
 const [prune,setPrune]=useState(true);
 // The sandbox runs the exact engine the game uses (shared/engine.js), for whoever is to move.
 const on=useMemo(()=>evaluateMoves(board,turn,true),[board,turn]),off=useMemo(()=>evaluateMoves(board,turn,false),[board,turn]);
 const cur=prune?on:off, over=isTerminal(board);
 const click=(i:number)=>{if(board[i]||over)return;const n=[...board];n[i]=turn;setBoard(n);setTurn(turn==='X'?'O':'X')};
 const reset=(b:Cell[],t:'X'|'O')=>{setBoard(b);setTurn(t)};
 const saved=off.nodes?Math.round((1-on.nodes/off.nodes)*100):0;
 return <div className="algo">
  <section className="panel intro"><small className="eyebrow">BEHIND THE SCREEN</small><h2>How the Minimax AI thinks</h2>
   <p className="muted">Tic-tac-toe is a <b>solved game</b>: the full game tree has only 549,946 positions (255,168 complete games). Our AI searches it, assumes you will play your best, and picks the move with the best guaranteed outcome. That is why it can be drawn but never beaten.</p>
   <div className="steps">
    <article><b>01</b><h3>Imagine every future</h3><p>From the current board, try each empty cell, then each reply, and so on until someone wins or the board fills. This tree of "what ifs" is the search.</p></article>
    <article><b>02</b><h3>Score the endings</h3><p>An AI win is <code>10 − depth</code>, a loss is <code>depth − 10</code>, a draw is <code>0</code>. Subtracting depth makes the AI prefer quick wins and slow losses.</p></article>
    <article><b>03</b><h3>Assume the best opponent</h3><p>On the AI's turn it picks the <em>highest</em> score (max). On your turn it assumes you pick the <em>lowest</em> (min). Scores bubble up the tree to the root.</p></article>
    <article><b>04</b><h3>Prune what can't matter</h3><p>Alpha-beta tracks the best score each side is already guaranteed. If a branch can't beat that, it is skipped (<code>alpha ≥ beta</code>). Same answer, far less work.</p></article>
   </div></section>
  <AlgoAnimation/>
  <section className="panel lab"><div className="labhead"><div><small className="eyebrow">LIVE SANDBOX</small><h2>Watch it evaluate every move</h2></div>
    <label className="switch"><input type="checkbox" checked={prune} onChange={e=>setPrune(e.target.checked)}/><span/>Alpha-beta pruning</label></div>
   <p className="muted">Click cells to place pieces (it alternates X and O). Each empty cell shows the exact minimax score if the player to move (<b>{turn}</b>) plays there, from that player's point of view. The green cell is the best choice. Toggle pruning to see how much less work alpha-beta does for the same scores. This is the same engine the server runs.</p>
   <div className="labgrid"><div className="board small">{board.map((v,i)=>{const s=cur.scores[i];return <button key={i} className={`cell ${v?'filled':''} ${cur.best===i?'best':''}`} onClick={()=>click(i)} aria-label={`Cell ${i+1} ${v||'empty'}${s!==null?`, score ${s}`:''}`}>{v?<Mark v={v}/>:s!==null&&<span className={`score ${s>0?'pos':s<0?'neg':''}`}>{s>0?'+':''}{s}</span>}</button>})}</div>
    <div className="stats">
     <div className="stat"><small>To move</small><strong>{over?'Game over':turn}</strong></div>
     <div className="stat"><small>Nodes searched</small><strong>{cur.nodes.toLocaleString()}</strong></div>
     <div className="stat"><small>Without pruning</small><strong>{off.nodes.toLocaleString()}</strong></div>
     <div className="stat hi"><small>Work saved by pruning</small><strong>{saved}%</strong></div>
     <div className="presets"><button onClick={()=>reset(Array(9).fill(''),'O')}>Empty board</button><button onClick={()=>reset(['X','','','','O','','','','X'],'O')}>Corner trap</button><button onClick={()=>reset(['X','X','','','O','','','',''],'O')}>Must block</button><button onClick={()=>reset(['O','O','','X','X','','','',''],'O')}>Win in one</button></div>
    </div></div>
   <div className="legend"><span className="pos">+ {turn} wins</span><span>0 draw</span><span className="neg">− {turn} loses</span></div></section>
  <section className="panel code"><small className="eyebrow">THE CODE</small><h2>The core loop (simplified from shared/engine.js)</h2>
<pre>{`function minimax(board, maximizing, alpha, beta, depth) {
  const w = getWinner(board);
  if (w === AI)    return 10 - depth;   // faster win = better
  if (w === HUMAN) return depth - 10;   // slower loss = better
  if (isFull(board)) return 0;          // draw

  let best = maximizing ? -Infinity : Infinity;
  for (const cell of emptyCells(board)) {
    board[cell] = maximizing ? AI : HUMAN;
    const score = minimax(board, !maximizing, alpha, beta, depth + 1);
    board[cell] = EMPTY;                // undo
    if (maximizing) { best = Math.max(best, score); alpha = Math.max(alpha, best); }
    else            { best = Math.min(best, score); beta  = Math.min(beta,  best); }
    if (alpha >= beta) break;           // prune
  }
  return best;
}`}</pre>
   <div className="facts cards"><div><b>O(b<sup>d</sup>)</b><span>worst-case time without pruning</span></div><div><b>~O(b<sup>d/2</sup>)</b><span>with ideal move ordering</span></div><div><b>One engine</b><span>the server, offline mode and this page all run shared/engine.js</span></div></div></section>
 </div>;
}
