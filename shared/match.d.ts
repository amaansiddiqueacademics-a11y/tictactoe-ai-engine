import type { Algorithm, Board, Mark, Measurement } from './engine';

export interface Player { id: string; name: string; connected: boolean }
export type Mode = 'pvp' | 'ai';
export type Status = 'waiting' | 'playing' | 'finished';

export interface AiMove extends Measurement { played: Algorithm }
export interface AiStats { turns: number; mmTotal: number; abTotal: number; same: number }

export interface Game {
  roomCode: string;
  mode: Mode;
  algo: Algorithm;
  aiFirst: boolean;
  board: Board;
  currentTurn: Mark;
  status: Status;
  winner: Mark | 'draw' | null;
  winLine: number[] | null;
  players: { X: Player | null; O: Player | null };
  lastAi: AiMove | null;
  aiStats: AiStats;
  createdAt: string;
  updatedAt: string;
  persisted?: boolean;
}

export const X: 'X';
export const O: 'O';
export const EMPTY: '';
export const HUMAN: 'X';
export const AI: 'O';
export const AI_PLAYER_ID: 'AI';

export function createInitialGame(opts: {
  roomCode: string; mode: Mode; hostId: string; hostName?: string; algo?: Algorithm; aiFirst?: boolean;
}): Game;
export function symbolOf(game: Game, userId: string): Mark | null;
export function validateMove(game: Game, userId: string, cell: unknown): string | null;
export function applyMove(game: Game, symbol: Mark, cell: number): Game;
export function aiToMove(game: Game): boolean;
export function playAiTurn(game: Game): number | null;
export function publicGame(game: Game): Omit<Game, 'persisted'>;
