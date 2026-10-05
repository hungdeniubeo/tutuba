import { CombatModel, type AutomaticAction } from '../combat/CombatModel';
import { type Actor, type Cell, type CombatEvent, type CombatState, cellLabel, isInBounds, manhattan, sameCell } from '../combat/types';
import { ROSTER, type PlacedUnit, type Side } from './PreparationModel';
export interface AutoIntent { action: AutomaticAction | null; actorId: string | null; label: string }
export interface AutoBattleState { combat: CombatState; winner: Side | 'draw' | null; steps: number; next: AutoIntent }
export class AutoBattleModel {
  private readonly core: CombatModel;
  private readonly roles = new Map<string, PlacedUnit['role']>();
  private queue: string[] = [];
  private steps = 0;
  private winner: Side | 'draw' | null = null;
  constructor(units: PlacedUnit[], private firstSide: Side = 'south') {
    this.core = new CombatModel({ autoPlan: false, automatic: true, actors: units.map(unit => {
      const stats = ROSTER[unit.role]; this.roles.set(unit.id, unit.role);
      return { id: unit.id, name: stats.name, faction: unit.side === 'south' ? 'player' : 'enemy', kind: unit.role === 'archer' ? 'archer' : 'hero', cell: { ...unit.cell }, hp: stats.hp, maxHp: stats.hp, shield: 0, maxShield: 6, ap: 2, maxAp: 2, alive: true };
    }) });
    this.queueRound();
  }
  snapshot(): AutoBattleState { return { combat: this.core.getState(), winner: this.winner, steps: this.steps, next: this.preview() }; }
  drainEvents(): CombatEvent[] { return this.core.drainEvents(); }
  preview(): AutoIntent {
    if (this.winner) return { action: null, actorId: null, label: 'Trận đấu đã kết thúc.' };
    const s = this.core.getState();
    const id = this.queue.find(id => s.actors.some(a => a.id === id && a.alive && a.ap > 0));
    if (!id) return { action: null, actorId: null, label: `Kích hoạt Dư Ảnh → vòng ${s.round + 1}` };
    const actor = s.actors.find(a => a.id === id)!;
    const role = this.roles.get(id)!, stats = ROSTER[role];
    const enemies = s.actors.filter(a => a.alive && a.faction !== actor.faction).sort((a, b) => manhattan(actor.cell, a.cell) - manhattan(actor.cell, b.cell) || a.hp - b.hp || a.id.localeCompare(b.id));
    if (!enemies.length) return { action: null, actorId: id, label: 'Không còn mục tiêu.' };
    if (role === 'weaver' && !this.core.hasShifted(actor.faction)) {
      for (const echo of s.echoes) {
        const rating = (cells: Cell[]) => s.actors.filter(a => a.alive && cells.some(c => sameCell(c, a.cell))).reduce((sum, a) => sum + (a.faction === actor.faction ? -1 : 1) * echo.damage, 0);
        const base = rating(echo.cells);
        for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const cells = echo.cells.map(c => ({ x: c.x + d.x, y: c.y + d.y }));
          if (cells.every(isInBounds) && rating(cells) > base) return { actorId: id, action: { actorId: id, type: 'shift', cell: cells[0], echoId: echo.id }, label: `${stats.name} dời Dư Ảnh đến ${cellLabel(cells[0])}` };
        }
      }
    }
    const target = enemies[0];
    if (role === 'warden' && actor.hp <= actor.maxHp / 2 && actor.shield === 0 && actor.ap === 2) return { actorId: id, action: { actorId: id, type: 'guard', cell: actor.cell }, label: `${stats.name} tạo 4 khiên` };
    if (manhattan(actor.cell, target.cell) <= stats.range) return { actorId: id, action: { actorId: id, type: 'attack', cell: target.cell, range: stats.range, damage: stats.damage, push: role === 'warden' }, label: `${stats.name} đánh ${cellLabel(target.cell)} · ${stats.damage} sát thương${role === 'warden' ? ' + đẩy' : ''}` };
    const step = this.pathStep(actor, enemies, stats.range, s.actors);
    if (step) return { actorId: id, action: { actorId: id, type: 'move', cell: step }, label: `${stats.name} tiến đến ${cellLabel(step)}` };
    if (actor.shield < actor.maxShield) return { actorId: id, action: { actorId: id, type: 'guard', cell: actor.cell }, label: `${stats.name} bị chặn, tạo khiên` };
    return { actorId: id, action: null, label: `${stats.name} chờ đường trống` };
  }
  step(): void {
    if (this.winner) return;
    const intent = this.preview();
    if (intent.actorId) {
      const at = this.queue.indexOf(intent.actorId); this.queue.splice(0, at + 1);
      if (intent.action) {
        const result = this.core.automaticAction(intent.action);
        if (!result.ok) throw new Error(`Automatic plan rejected: ${result.message}`);
      }
    } else {
      this.core.endTurn(); this.queueRound();
    }
    this.steps++;
    const s = this.core.getState();
    const south = s.actors.some(a => a.alive && a.faction === 'player'), north = s.actors.some(a => a.alive && a.faction === 'enemy');
    if (!south || !north) this.winner = south ? 'south' : north ? 'north' : 'draw';
    else if (s.round > 40) this.winner = 'draw';
  }
  private queueRound(): void {
    const s = this.core.getState(), south = s.actors.filter(a => a.alive && a.faction === 'player').map(a => a.id), north = s.actors.filter(a => a.alive && a.faction === 'enemy').map(a => a.id);
    const leadSouth = (s.round % 2 === 1) === (this.firstSide === 'south');
    const a = leadSouth ? south : north, b = leadSouth ? north : south, order: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) order.push(a[i]); if (b[i]) order.push(b[i]); }
    this.queue = [...order, ...order];
  }
  private pathStep(actor: Actor, targets: Actor[], range: number, actors: Actor[]): Cell | null {
    const queue: { cell: Cell; first: Cell | null }[] = [{ cell: actor.cell, first: null }], visited = new Set([cellLabel(actor.cell)]);
    while (queue.length) {
      const node = queue.shift()!;
      if (node.first && targets.some(t => manhattan(node.cell, t.cell) <= range)) return node.first;
      for (const d of [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const c = { x: node.cell.x + d.x, y: node.cell.y + d.y }, key = cellLabel(c);
        if (!isInBounds(c) || visited.has(key) || actors.some(a => a.alive && sameCell(a.cell, c))) continue;
        visited.add(key); queue.push({ cell: c, first: node.first ?? c });
      }
    }
    return null;
  }
}
