import { type CombatEvent } from '../combat/types';
import { type AutoBattleState } from './AutoBattleModel';
import { type PreparationState, type Side } from './PreparationModel';
export interface RoomSnapshot {
  code: string; version: number; you: Side; phase: 'preparation' | 'combat' | 'result';
  names: Record<Side, string>; connected: Record<Side, boolean>; prep: PreparationState;
  battle: AutoBattleState | null; events: CombatEvent[]; score: Record<Side, number>;
  round: number; nextVotes: Record<Side, boolean>; paused: boolean;
}
export type ServerMessage = { type: 'joined'; code: string; side: Side; token: string } | { type: 'state'; state: RoomSnapshot } | { type: 'error'; message: string };
