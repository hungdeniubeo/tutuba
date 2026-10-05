import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CombatModel, type CombatModelConfig } from './combat/CombatModel';
import { encounters } from './encounters';
import { type Cell, isInBounds, manhattan, sameCell } from './combat/types';

type Action = { type: 'move' | 'strike' | 'push' | 'guard' | 'shift' | 'end'; cell?: Cell; echoId?: string };
function apply(g: CombatModel, a: Action): boolean {
  if (a.type === 'end') return g.endTurn().ok;
  if (a.type === 'guard') return g.guard('hero').ok;
  if (a.type === 'shift') return g.shiftEcho('hero', a.echoId!, a.cell!).ok;
  if (a.type === 'push') return g.pushStrike('hero', a.cell!).ok;
  return g[a.type]('hero', a.cell!).ok;
}
function replay(config: CombatModelConfig, history: Action[]): CombatModel {
  const g = new CombatModel(config);
  for (const a of history) if (!apply(g, a)) throw new Error(`Invalid planned action ${JSON.stringify(a)}`);
  return g;
}
function choices(g: CombatModel): Action[] {
  const s = g.getState(), hero = s.actors.find(a => a.id === 'hero')!;
  if (s.phase !== 'player' || !hero.ap) return [];
  const actions: Action[] = [];
  const adjacent = [{ x: hero.cell.x + 1, y: hero.cell.y }, { x: hero.cell.x - 1, y: hero.cell.y }, { x: hero.cell.x, y: hero.cell.y + 1 }, { x: hero.cell.x, y: hero.cell.y - 1 }].filter(isInBounds);
  for (const cell of adjacent) {
    const target = s.actors.find(a => a.alive && sameCell(a.cell, cell));
    if (!target) actions.push({ type: 'move', cell });
    if (target?.faction === 'enemy' || s.intents.some(i => i.kind === 'move' && sameCell(i.target, cell))) actions.push({ type: 'strike', cell });
    if (target?.faction === 'enemy') actions.push({ type: 'push', cell });
  }
  if (hero.shield < hero.maxShield) actions.push({ type: 'guard' });
  if (!s.echoShiftedThisRound) for (const e of s.echoes) for (const enemy of s.actors.filter(a => a.alive && a.faction === 'enemy')) {
    if (manhattan(e.cells[0], enemy.cell) === 1) actions.push({ type: 'shift', echoId: e.id, cell: enemy.cell });
  }
  return actions;
}
function score(g: CombatModel): number {
  const s = g.getState();
  if (s.phase === 'victory') return 10000;
  if (s.phase === 'defeat') return -10000;
  const hero = s.actors.find(a => a.id === 'hero')!, enemies = s.actors.filter(a => a.alive && a.faction === 'enemy');
  return hero.hp * 2.6 + hero.shield * 0.3 - enemies.reduce((sum, a) => sum + a.hp + 8, 0) - Math.min(...enemies.map(a => manhattan(a.cell, hero.cell))) * 1.4;
}
function plan(config: CombatModelConfig): Action[] {
  let history: Action[] = [];
  for (let round = 0; round < 65; round++) {
    const root = replay(config, history); if (root.getState().phase === 'victory') return history;
    let best: { score: number; actions: Action[] } = { score: -Infinity, actions: [] };
    function visit(prefix: Action[], depth: number): void {
      const g = replay(config, [...history, ...prefix]);
      if (g.getState().phase === 'defeat') return;
      const endActions: Action[] = g.getState().phase === 'victory' ? prefix : [...prefix, { type: 'end' }];
      if (g.getState().phase === 'player') g.endTurn();
      const rating = score(g) - prefix.length * 0.001;
      if (rating > best.score) best = { score: rating, actions: endActions };
      if (depth === 0) return;
      const beforeEnd = replay(config, [...history, ...prefix]);
      for (const a of choices(beforeEnd)) visit([...prefix, a], depth - 1);
    }
    visit([], 2); history = [...history, ...best.actions];
  }
  throw new Error(`No winning route after 65 rounds: ${JSON.stringify(replay(config, history).getState())}`);
}

describe('encounter solvability through ordinary actions', () => {
  const plans: Action[][] = [];
  for (const [index, encounter] of encounters.entries()) it(encounter.title, () => {
    const actions = plan(encounter.config); const result = replay(encounter.config, actions).getState();
    expect(result.phase).toBe('victory'); plans[index] = actions;
    if (process.env.TUTUBA_WRITE_PLANS === '1') {
      mkdirSync('docs/evidence', { recursive: true }); writeFileSync('docs/evidence/victory-plans.json', JSON.stringify(plans, null, 2));
    }
  });
  it('inaction can reach defeat and a fresh battle restarts cleanly', () => {
    const g = new CombatModel(encounters[0].config);
    for (let i = 0; i < 20 && g.getState().phase === 'player'; i++) g.endTurn();
    expect(g.getState().phase).toBe('defeat');
    expect(new CombatModel(encounters[0].config).getState()).toMatchObject({ phase: 'player', round: 1, echoes: [], echoShiftedThisRound: false });
  });
});
