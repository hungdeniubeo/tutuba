import { describe, expect, it } from 'vitest';
import { AutoBattleModel } from './AutoBattleModel';
import { type PlacedUnit } from './PreparationModel';
const units: PlacedUnit[] = [
  { id: 'south-1', side: 'south', role: 'warden', cell: { x: 2, y: 4 } },
  { id: 'south-2', side: 'south', role: 'archer', cell: { x: 3, y: 5 } },
  { id: 'north-3', side: 'north', role: 'weaver', cell: { x: 2, y: 1 } },
  { id: 'north-4', side: 'north', role: 'warden', cell: { x: 3, y: 0 } },
];
describe('automatic battle uses verified rules for both sides', () => {
  it('is identical on two replicas and ends without a frame-time input', () => {
    const a = new AutoBattleModel(units), b = new AutoBattleModel(units);
    for (let i = 0; i < 600 && !a.snapshot().winner; i++) {
      expect(a.preview()).toEqual(b.preview()); a.step(); b.step(); expect(a.snapshot()).toEqual(b.snapshot());
    }
    expect(a.snapshot().winner).not.toBe(null); expect(a.snapshot().steps).toBeLessThan(600);
  });
  it('automatically moves, attacks and resolves Echoes with at most two AP per unit', () => {
    const g = new AutoBattleModel(units); const kinds = new Set<string>();
    for (let i = 0; i < 500 && !g.snapshot().winner; i++) {
      g.step(); for (const e of g.drainEvents()) kinds.add(e.type);
      expect(g.snapshot().combat.actors.every(a => a.ap >= 0 && a.ap <= 2)).toBe(true);
    }
    expect(kinds.has('move')).toBe(true); expect(kinds.has('attack')).toBe(true); expect(kinds.has('echo')).toBe(true);
  });
  it('locks a result and can be restarted from the same lineup', () => {
    const g = new AutoBattleModel(units); for (let i = 0; i < 600 && !g.snapshot().winner; i++) g.step();
    const result = g.snapshot(); g.step(); expect(g.snapshot()).toEqual(result);
    expect(new AutoBattleModel(units).snapshot()).toMatchObject({ winner: null, steps: 0, combat: { round: 1 } });
  });
});
