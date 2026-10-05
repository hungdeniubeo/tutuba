import { type ActionResult, type Actor, type ActorKind, type Cell, type CombatEvent, type CombatState, type Echo, type Intent, cellKey, cellLabel, cloneCell, isInBounds, manhattan, sameCell } from './types';

export interface EnemySpawn { id: string; name: string; kind: Exclude<ActorKind, 'hero'>; cell: Cell; hp?: number }
export interface CombatModelConfig {
  heroCell?: Cell; heroHp?: number; enemies?: EnemySpawn[]; actors?: Actor[]; autoPlan?: boolean; automatic?: boolean;
}
export interface AutomaticAction {
  actorId: string; type: 'move' | 'attack' | 'guard' | 'shift'; cell: Cell;
  damage?: number; range?: number; push?: boolean; echoId?: string;
}
export const ENEMY_STATS = {
  bramble: { hp: 15, damage: 4, range: 1, push: true },
  archer: { hp: 12, damage: 3, range: 5, push: false },
} as const;
const unique = (cells: Cell[]): Cell[] => [...new Map(cells.map(c => [cellKey(c), cloneCell(c)])).values()];
const copy = <T>(value: T): T => structuredClone(value);

/** Pure deterministic rules. No renderer, clocks, random values or browser APIs. */
export class CombatModel {
  private actors: Actor[];
  private echoes: Echo[] = [];
  private intents: Intent[] = [];
  private events: CombatEvent[] = [];
  private round = 1;
  private phase: CombatState['phase'] = 'player';
  private echoSequence = 0;
  private shiftedFactions = new Set<Actor['faction']>();
  private log: string[] = [];
  private lastEvent = 'Đọc ý định đã đánh dấu. Mỗi hành động tốn 1 AP.';
  private readonly autoPlan: boolean;
  private readonly automatic: boolean;
  private automaticActorId?: string;

  constructor(config: CombatModelConfig) {
    this.autoPlan = config.autoPlan ?? true;
    this.automatic = config.automatic ?? false;
    const maxHp = config.heroHp ?? 24;
    this.actors = copy<Actor[]>(config.actors ?? [
      { id: 'hero', name: 'Aster', faction: 'player', kind: 'hero', cell: config.heroCell ?? { x: 1, y: 3 }, hp: maxHp, maxHp, shield: 0, maxShield: 6, ap: 2, maxAp: 2, alive: true },
      ...(config.enemies ?? []).map(e => ({ ...e, faction: 'enemy' as const, hp: e.hp ?? ENEMY_STATS[e.kind].hp, maxHp: e.hp ?? ENEMY_STATS[e.kind].hp, shield: 0, maxShield: 0, ap: 2, maxAp: 2, alive: true })),
    ]).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const ids = new Set<string>(), cells = new Set<string>();
    for (const a of this.actors) {
      if (!a.id || ids.has(a.id) || cells.has(cellKey(a.cell)) || !isInBounds(a.cell) || !Number.isInteger(a.hp) || a.hp <= 0 || a.hp > a.maxHp || a.ap < 0 || a.ap > a.maxAp || a.maxAp > 2 || a.shield < 0) throw new Error('Invalid initial combatants');
      ids.add(a.id); cells.add(cellKey(a.cell));
    }
    if (!this.actors.some(a => a.faction === 'player') || !this.actors.some(a => a.faction === 'enemy')) throw new Error('A battle requires both factions');
    if (this.autoPlan) this.planIntents();
  }

  getState(): CombatState {
    return copy({ round: this.round, phase: this.phase, playerId: 'hero', actors: this.actors, echoes: this.echoes, intents: this.intents, echoShiftedThisRound: this.shiftedFactions.has('player'), log: this.log, lastEvent: this.lastEvent });
  }
  getActor(id: string): Actor | undefined { const a = this.find(id); return a ? copy(a) : undefined; }
  drainEvents(): CombatEvent[] { const result = this.events; this.events = []; return result; }
  hasShifted(faction: Actor['faction']): boolean { return this.shiftedFactions.has(faction); }
  automaticAction(action: AutomaticAction): ActionResult {
    if (!this.automatic) return this.fail('Chế độ tự chiến đấu chưa được bật.');
    this.automaticActorId = action.actorId;
    try {
      if (action.type === 'move') return this.move(action.actorId, action.cell);
      if (action.type === 'guard') return this.guard(action.actorId);
      if (action.type === 'shift') return this.shiftEcho(action.actorId, action.echoId ?? '', action.cell);
      return this.attack(action.actorId, action.cell, [action.cell], action.range ?? 1, action.damage ?? 1, action.push ?? false);
    } finally { this.automaticActorId = undefined; }
  }

  move(id: string, destination: Cell): ActionResult {
    const a = this.player(id); if (!a) return this.fail('Nhân vật này không thể hành động.');
    if (!isInBounds(destination) || manhattan(a.cell, destination) !== 1) return this.fail('Di chuyển sang ô liền kề theo hàng hoặc cột.');
    if (this.at(destination)) return this.fail('Ô này đang có nhân vật.');
    a.ap--; a.cell = cloneCell(destination); this.event('move', a, [destination]);
    return this.ok(`${a.name} di chuyển đến ${cellLabel(destination)}.`);
  }
  strike(id: string, target: Cell): ActionResult { return this.attack(id, target, [target], 1, 6, false); }
  pushStrike(id: string, target: Cell): ActionResult { return this.attack(id, target, [target], 1, 6, true); }
  attack(id: string, anchor: Cell, cells: Cell[], range: number, damage: number, push = false): ActionResult {
    const a = this.player(id); if (!a) return this.fail('Đã hết AP hoặc trận đấu đã kết thúc.');
    if (!isInBounds(anchor) || !cells.length || cells.some(c => !isInBounds(c)) || !Number.isSafeInteger(damage) || damage <= 0 || !Number.isInteger(range) || range < 0) return this.fail('Vùng đánh không hợp lệ.');
    if (manhattan(a.cell, anchor) > range || (push && manhattan(a.cell, anchor) !== 1)) return this.fail('Chọn một ô liền kề để đánh.');
    a.ap--; this.resolveAttack(a, anchor, unique(cells), damage, push);
    return this.ok(this.terminal() ? this.lastEvent : `${a.name} ${push ? 'đẩy' : 'đánh'} ${cellLabel(anchor)}. Dư Ảnh: ${Math.max(1, Math.floor(damage / 2))} sát thương ở vòng sau.`);
  }
  guard(id: string): ActionResult {
    const a = this.player(id); if (!a) return this.fail('Đã hết AP hoặc trận đấu đã kết thúc.');
    if (a.shield >= a.maxShield) return this.fail('Khiên đã đầy.');
    a.ap--; a.shield = Math.min(a.maxShield, a.shield + 4); this.event('guard', a, [a.cell], 4);
    return this.ok(`${a.name} tạo khiên. Khiên ${a.shield}/${a.maxShield}.`);
  }
  /** Destination is the new first cell; the entire zone translates by the same offset. */
  shiftEcho(id: string, echoId: string, destination: Cell): ActionResult {
    const a = this.player(id); if (!a) return this.fail('Đã hết AP hoặc trận đấu đã kết thúc.');
    if (this.shiftedFactions.has(a.faction)) return this.fail('Cả đội chỉ được dời một Dư Ảnh mỗi vòng.');
    const echo = this.echoes.find(e => e.id === echoId); if (!echo) return this.fail('Chọn một Dư Ảnh đang chờ.');
    const first = echo.cells[0];
    if (!isInBounds(destination) || manhattan(first, destination) !== 1) return this.fail('Dời một ô theo hàng hoặc cột.');
    const cells = echo.cells.map(c => ({ x: c.x + destination.x - first.x, y: c.y + destination.y - first.y }));
    if (cells.some(c => !isInBounds(c))) return this.fail('Toàn bộ Dư Ảnh phải nằm trong đấu trường.');
    a.ap--; echo.cells = cells; echo.shifted = true; this.shiftedFactions.add(a.faction); this.event('shift', a, cells);
    return this.ok(`Đã dời Dư Ảnh đến ${cellLabel(destination)}. Vẫn kích hoạt ở vòng ${echo.dueRound}.`);
  }
  setEnemyIntent(intent: Intent): ActionResult {
    const a = this.find(intent.enemyId);
    if (this.terminal() || !a?.alive || a.faction !== 'enemy' || this.intents.some(i => i.enemyId === a.id)) return this.fail('Ý định địch không hợp lệ hoặc bị trùng.');
    if (!isInBounds(intent.target)) return this.fail('Mục tiêu ý định không hợp lệ.');
    if (intent.kind === 'attack' && (!Number.isSafeInteger(intent.damage) || intent.damage < 1 || !intent.cells.length || intent.cells.some(c => !isInBounds(c)) || (intent.push && manhattan(a.cell, intent.target) !== 1))) return this.fail('Ý định đánh không hợp lệ.');
    if (intent.kind === 'move' && (intent.damage !== 0 || intent.push || intent.cells.length)) return this.fail('Ý định di chuyển không hợp lệ.');
    this.intents.push(copy({ ...intent, cells: unique(intent.cells) }));
    this.intents.sort((a, b) => a.enemyId < b.enemyId ? -1 : 1);
    return { ok: true, message: 'Đã chuẩn bị ý định.' };
  }
  endTurn(): ActionResult {
    if (this.phase !== 'player') return this.fail('Trận đấu đã kết thúc.');
    this.phase = 'enemy';
    const intents = this.intents; this.intents = [];
    for (const i of intents) {
      if (this.terminal()) break;
      const a = this.find(i.enemyId); if (!a?.alive) continue;
      if (i.kind === 'attack') { a.ap--; this.resolveAttack(a, i.target, i.cells, i.damage, i.push); }
      else if (isInBounds(i.target) && !this.at(i.target) && manhattan(a.cell, i.target) === 1) {
        a.ap--; a.cell = cloneCell(i.target); this.event('move', a, [a.cell]);
      }
    }
    if (this.terminal()) return { ok: true, message: this.lastEvent };
    this.round++;
    const due = this.echoes.filter(e => e.dueRound <= this.round);
    this.echoes = this.echoes.filter(e => e.dueRound > this.round); // Consume before applying damage.
    const sums = new Map<string, number>();
    for (const echo of due) {
      this.events.push({ type: 'echo', actorId: echo.ownerId, cells: copy(echo.cells), amount: echo.damage });
      this.record(`Dư Ảnh tại ${echo.cells.map(cellLabel).join(', ')} kích hoạt: ${echo.damage} sát thương.`);
      for (const a of this.actors.filter(a => a.alive)) {
        if (echo.cells.some(c => sameCell(c, a.cell))) sums.set(a.id, (sums.get(a.id) ?? 0) + echo.damage);
      }
    }
    for (const [id, damage] of sums) this.damage(this.find(id)!, damage);
    this.evaluateResult();
    if (this.terminal()) return { ok: true, message: this.lastEvent };
    this.shiftedFactions.clear();
    for (const a of this.actors.filter(a => a.alive)) a.ap = a.maxAp;
    this.phase = 'player'; if (this.autoPlan) this.planIntents();
    return this.ok(`Vòng ${this.round}. Đã kích hoạt Dư Ảnh. Có 2 AP mới.`);
  }

  private resolveAttack(a: Actor, anchor: Cell, cells: Cell[], damage: number, push: boolean): void {
    this.event('attack', a, cells, damage);
    // Snapshot all victims before resolving deaths, mirroring C++ area attacks.
    const victims = this.actors.filter(t => t.alive && cells.some(c => sameCell(c, t.cell)));
    for (const target of victims) this.damage(target, damage);
    this.echoes.push({ id: `echo-${++this.echoSequence}`, ownerId: a.id, ownerFaction: a.faction, cells: copy(cells), damage: Math.max(1, Math.floor(damage / 2)), dueRound: this.round + 1, createdRound: this.round, shifted: false });
    const victim = this.at(anchor);
    if (push && a.alive && victim && victim.faction !== a.faction && manhattan(a.cell, victim.cell) === 1) {
      const destination = { x: 2 * victim.cell.x - a.cell.x, y: 2 * victim.cell.y - a.cell.y };
      if (isInBounds(destination) && !this.at(destination)) {
        victim.cell = destination; this.event('move', victim, [destination]); this.record(`${victim.name} bị đẩy đến ${cellLabel(destination)}.`);
      } else this.record(`${victim.name}: đẩy bị chặn; không có sát thương va chạm.`);
    }
    this.evaluateResult();
  }
  private damage(a: Actor, damage: number): void {
    const blocked = Math.min(a.shield, damage); a.shield -= blocked; a.hp = Math.max(0, a.hp - damage + blocked);
    this.event('hit', a, [a.cell], damage); this.record(`${a.name}: ${damage} sát thương${blocked ? `, khiên hấp thụ ${blocked}` : ''}.`);
    if (a.hp === 0) { a.alive = false; a.ap = 0; this.event('death', a, [a.cell]); this.record(`${a.name} bị hạ.`); }
  }
  private planIntents(): void {
    const hero = this.actors.find(a => a.faction === 'player' && a.alive); if (!hero) return;
    for (const a of this.actors.filter(a => a.faction === 'enemy' && a.alive)) {
      const stats = ENEMY_STATS[a.kind as 'bramble' | 'archer'];
      if (manhattan(a.cell, hero.cell) <= stats.range) {
        this.setEnemyIntent({ enemyId: a.id, kind: 'attack', target: copy(hero.cell), cells: [copy(hero.cell)], damage: stats.damage, push: stats.push, label: `${a.name}: ${stats.damage} sát thương${stats.push ? ' + đẩy' : ''} tại ${cellLabel(hero.cell)}` });
      } else {
        const adjacent = [{ x: a.cell.x - 1, y: a.cell.y }, { x: a.cell.x + 1, y: a.cell.y }, { x: a.cell.x, y: a.cell.y - 1 }, { x: a.cell.x, y: a.cell.y + 1 }];
        const next = adjacent.filter(c => isInBounds(c) && !this.at(c)).sort((l, r) => manhattan(l, hero.cell) - manhattan(r, hero.cell) || l.x - r.x || l.y - r.y)[0] ?? a.cell;
        this.setEnemyIntent({ enemyId: a.id, kind: 'move', target: copy(next), cells: [], damage: 0, push: false, label: `${a.name}: tiến đến ${cellLabel(next)}` });
      }
    }
  }
  private evaluateResult(): void {
    if (this.terminal()) return;
    if (!this.actors.some(a => a.faction === 'player' && a.alive)) this.phase = 'defeat';
    else if (!this.actors.some(a => a.faction === 'enemy' && a.alive)) this.phase = 'victory';
    if (this.terminal()) {
      this.echoes = []; this.intents = [];
      this.lastEvent = this.phase === 'victory' ? 'Chiến thắng — Rừng Cổ đã yên bình.' : 'Thất bại — Aster gục ngã. Hãy thử một hướng đi khác.';
      this.record(this.lastEvent);
    }
  }
  private terminal(): boolean { return this.phase === 'victory' || this.phase === 'defeat'; }
  private find(id: string): Actor | undefined { return this.actors.find(a => a.id === id); }
  private at(c: Cell): Actor | undefined { return this.actors.find(a => a.alive && sameCell(c, a.cell)); }
  private player(id: string): Actor | undefined { const a = this.find(id); return this.phase === 'player' && a?.alive && (a.faction === 'player' || this.automaticActorId === id) && a.ap > 0 ? a : undefined; }
  private event(type: CombatEvent['type'], a: Actor, cells: Cell[], amount = 0): void { this.events.push({ type, actorId: a.id, cells: copy(cells), amount }); }
  private record(message: string): void { this.log.push(message); if (this.log.length > 20) this.log.shift(); }
  private ok(message: string): ActionResult { this.lastEvent = message; this.record(message); return { ok: true, message }; }
  private fail(message: string): ActionResult { this.lastEvent = message; return { ok: false, message }; }
}
