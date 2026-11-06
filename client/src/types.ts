export type { Algorithm, Board, Cell, Mark, Measurement } from '../../shared/engine';
export type { AiMove, AiStats, Game, Mode, Player } from '../../shared/match';
import type { Game } from '../../shared/match';

export interface Ack { ok: boolean; error?: string; roomCode?: string; game?: Game }
export interface Identity { userId: string; token: string; displayName: string }
/** Where the current match runs: on the game server, or entirely in this browser. */
export type Where = 'online' | 'local';
