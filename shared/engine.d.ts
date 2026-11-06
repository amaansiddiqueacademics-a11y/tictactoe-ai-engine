// Types for engine.js (shared by the server and the React client).
export type Mark = 'X' | 'O';
export type Cell = Mark | '';
export type Board = Cell[];
export type Algorithm = 'minimax' | 'alphabeta';

export interface SearchResult {
  bestMove: number | null;
  bestScore: number | null;
  nodesVisited: number;
}

export interface Measurement {
  mmMove: number | null;
  mmNodes: number;
  mmMs: number;
  abMove: number | null;
  abNodes: number;
  abMs: number;
  same: boolean;
  pctPruned: number | null;
}

export interface MoveEvaluation {
  scores: (number | null)[];
  best: number | null;
  nodes: number;
}

export const X: 'X';
export const O: 'O';
export const EMPTY: '';
export const ALGORITHMS: Algorithm[];
export const LINES: number[][];

export function other(mark: Mark): Mark;
export function emptyBoard(): Board;
export function isMark(mark: unknown): mark is Mark;
export function legalMoves(board: Board): number[];
export function winner(board: Board): { mark: Mark; line: number[] } | null;
export function getWinner(board: Board): Mark | null;
export function isFull(board: Board): boolean;
export function isTerminal(board: Board): boolean;
export function score(board: Board, me: Mark, depth: number): number | null;
export function minimax(board: Board, me: Mark): SearchResult | null;
export function alphaBeta(board: Board, me: Mark): SearchResult | null;
export function search(board: Board, me: Mark, algorithm: Algorithm): SearchResult | null;
export function findBestMove(board: Board, me?: Mark): number | null;
export function pctPruned(mmNodes: number, abNodes: number): number | null;
export function measure(board: Board, me: Mark): Measurement | null;
export function evaluateMoves(board: Board, me: Mark, prune: boolean): MoveEvaluation;
