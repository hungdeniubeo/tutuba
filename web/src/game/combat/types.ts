export const GRID_SIZE = 6;
export interface Cell { x: number; y: number }
export type Faction = 'player' | 'enemy';
export type ActorKind = 'hero' | 'bramble' | 'archer';
export type CombatPhase = 'player' | 'enemy' | 'victory' | 'defeat';
export interface Actor {
  id: string; name: string; faction: Faction; kind: ActorKind; cell: Cell;
  hp: number; maxHp: number; shield: number; maxShield: number; ap: number; maxAp: number; alive: boolean;
}
export interface Echo {
  id: string; ownerId: string; ownerFaction: Faction; cells: Cell[];
  damage: number; dueRound: number; createdRound: number; shifted: boolean;
}
export interface Intent {
  enemyId: string; kind: 'move' | 'attack'; target: Cell; cells: Cell[];
  damage: number; push: boolean; label: string;
}
export interface CombatEvent {
  type: 'move' | 'attack' | 'hit' | 'echo' | 'death' | 'guard' | 'shift';
  actorId: string; cells: Cell[]; amount: number;
}
export interface CombatState {
  round: number; phase: CombatPhase; playerId: string; actors: Actor[];
  echoes: Echo[]; intents: Intent[]; echoShiftedThisRound: boolean; log: string[]; lastEvent: string;
}
export interface ActionResult { ok: boolean; message: string }
export const cellKey = (c: Cell): string => `${c.x},${c.y}`;
export const cellLabel = (c: Cell): string => `${'ABCDEF'[c.x]}${c.y + 1}`;
export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;
export const manhattan = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isInBounds = (c: Cell): boolean => Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.x < GRID_SIZE && c.y >= 0 && c.y < GRID_SIZE;
export const cloneCell = (c: Cell): Cell => ({ x: c.x, y: c.y });
