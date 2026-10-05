import { describe, expect, it } from 'vitest';
import { CombatModel, type CombatModelConfig } from './CombatModel';
import { type Actor, type Cell } from './types';

const c = (x: number, y: number): Cell => ({ x, y });
function actor(id: string, faction: Actor['faction'], cell: Cell, hp = 20): Actor {
  return { id, faction, cell, name: id, kind: faction === 'player' ? 'hero' : 'bramble', hp, maxHp: hp, shield: 0, maxShield: 6, ap: 2, maxAp: 2, alive: true };
}
const p = (id = 'hero', cell = c(1, 1), hp = 20) => actor(id, 'player', cell, hp);
const e = (id = 'enemy', cell = c(4, 4), hp = 20) => actor(id, 'enemy', cell, hp);
const fresh = (actors = [p(), e()]) => new CombatModel({ actors, autoPlan: false } as CombatModelConfig);
const hit = (g: CombatModel, cell = c(2, 1), damage = 5, cells = [cell], range = 1, push = false) => g.attack('hero', cell, cells, range, damage, push);

// Equivalent to all 18 named cases in Tests/TutubaCombatCoreTests.cpp.
describe('C++ rule parity', () => {
  it('starts each actor with two AP', () => {
    const g = fresh(); expect(g.getActor('hero')?.ap).toBe(2); expect(g.getActor('enemy')?.ap).toBe(2);
  });
  it('movement rejects illegal cells without spending AP', () => {
    const g = fresh(); expect(g.move('hero', c(2, 1)).ok).toBe(true);
    expect(g.move('hero', c(3, 2)).ok).toBe(false); expect(g.move('hero', c(-1, 1)).ok).toBe(false);
    expect(g.getActor('hero')?.ap).toBe(1);
    const occupied = fresh([p(), e('enemy', c(2, 1))]);
    expect(occupied.move('hero', c(2, 1)).ok).toBe(false); expect(occupied.getActor('hero')?.ap).toBe(2);
  });
  it('resets AP without carry', () => {
    const g = fresh(); g.move('hero', c(2, 1)); g.move('hero', c(3, 1));
    expect(g.move('hero', c(3, 2)).ok).toBe(false); g.endTurn();
    expect(g.getState().round).toBe(2); expect(g.getActor('hero')?.ap).toBe(2);
    g.endTurn(); expect(g.getActor('hero')?.ap).toBe(2);
  });
  it('stores half damage and the following round', () => {
    const g = fresh(); expect(hit(g).ok).toBe(true);
    expect(g.getState().echoes[0]).toMatchObject({ damage: 2, dueRound: 2 });
    g.endTurn(); expect(g.getActor('enemy')?.hp).toBe(20); expect(g.getState().echoes).toEqual([]);
  });
  it('empty attack zone remains stationary and hits an enemy moving into it', () => {
    const g = fresh([p(), e('enemy', c(3, 1))]); hit(g, c(2, 1), 7);
    g.setEnemyIntent({ enemyId: 'enemy', kind: 'move', target: c(2, 1), cells: [], damage: 0, push: false, label: 'move' });
    g.endTurn(); expect(g.getActor('enemy')?.cell).toEqual(c(2, 1)); expect(g.getActor('enemy')?.hp).toBe(17);
  });
  it('direct attacks and Echoes can hit their own faction', () => {
    const g = fresh(); hit(g, c(1, 1), 3, [c(1, 1)], 0);
    expect(g.getActor('hero')?.hp).toBe(17); g.endTurn(); expect(g.getActor('hero')?.hp).toBe(16);
  });
  it('consumes each Echo once without creating more Echoes', () => {
    const g = fresh(); hit(g, c(1, 1), 4, [c(1, 1)], 0); g.drainEvents();
    g.endTurn(); expect(g.getActor('hero')?.hp).toBe(14);
    expect(g.drainEvents().filter(x => x.type === 'echo')).toHaveLength(1);
    expect(g.getState().echoes).toEqual([]); g.endTurn();
    expect(g.drainEvents().filter(x => x.type === 'echo')).toHaveLength(0);
    expect(g.getActor('hero')?.hp).toBe(14);
  });
  it('simultaneous death of both factions is defeat', () => {
    const g = fresh([p('hero', c(1, 1), 3), e('enemy', c(4, 4), 3)]);
    hit(g, c(1, 1), 2, [c(1, 1), c(4, 4)], 0); g.endTurn();
    expect(g.getState().phase).toBe('defeat'); expect(g.getState().actors.every(x => !x.alive)).toBe(true);
  });
  it('retains an Echo after its owner dies while the match continues', () => {
    const g = fresh([p('hero', c(1, 1), 2), p('ally', c(2, 2)), e()]);
    hit(g, c(4, 4), 4, [c(4, 4)], 6);
    g.setEnemyIntent({ enemyId: 'enemy', kind: 'attack', target: c(1, 1), cells: [c(1, 1)], damage: 2, push: false, label: 'attack' });
    g.endTurn(); expect(g.getActor('hero')?.alive).toBe(false);
    expect(g.getActor('enemy')?.hp).toBe(14); expect(g.getState().phase).toBe('player');
  });
  it('floors damage with a minimum of one', () => {
    const g = fresh([p(), e('enemy', c(2, 1))]); hit(g, c(2, 1), 1);
    expect(g.getState().echoes[0].damage).toBe(1); g.endTurn(); expect(g.getActor('enemy')?.hp).toBe(18);
  });
  it('empty attacks still consume AP and create an Echo', () => {
    const g = fresh(); hit(g); expect(g.getActor('hero')?.ap).toBe(1); expect(g.getState().echoes).toHaveLength(1);
  });
  it('shifts once per team and retains deadline, owner and damage', () => {
    const g = fresh([p(), p('ally', c(1, 2)), e()]); hit(g);
    const echo = g.getState().echoes[0];
    expect(g.shiftEcho('ally', echo.id, c(3, 1)).ok).toBe(true);
    expect(g.getActor('ally')?.ap).toBe(1);
    expect(g.getState().echoes[0]).toMatchObject({ cells: [c(3, 1)], damage: echo.damage, dueRound: echo.dueRound, ownerId: echo.ownerId });
    expect(g.shiftEcho('hero', echo.id, c(3, 2)).ok).toBe(false); expect(g.getActor('hero')?.ap).toBe(1);
  });
  it('invalid shift spends neither AP nor quota', () => {
    const g = fresh(); hit(g, c(0, 0), 5, [c(0, 0)], 2); const id = g.getState().echoes[0].id;
    expect(g.shiftEcho('hero', id, c(-1, 0)).ok).toBe(false); expect(g.getActor('hero')?.ap).toBe(1);
    expect(g.shiftEcho('hero', id, c(1, 0)).ok).toBe(true);
  });
  it('push moves an enemy while its Echo stays at the attack area', () => {
    const g = fresh([p(), e('enemy', c(2, 1))]); hit(g, c(2, 1), 1, [c(2, 1)], 1, true);
    expect(g.getActor('enemy')?.cell).toEqual(c(3, 1)); expect(g.getState().echoes[0].cells).toEqual([c(2, 1)]);
  });
  it('occupied destination blocks push without collision damage', () => {
    const g = fresh([p(), p('ally', c(3, 1)), e('enemy', c(2, 1))]); hit(g, c(2, 1), 1, [c(2, 1)], 1, true);
    expect(g.getActor('enemy')?.cell).toEqual(c(2, 1)); expect(g.getActor('ally')?.hp).toBe(20);
  });
  it('aggregates overlapping Echo damage before applying it', () => {
    const g = fresh(); hit(g, c(1, 1), 3, [c(4, 4)], 0); hit(g, c(1, 1), 3, [c(4, 4)], 0);
    g.drainEvents(); g.endTurn(); expect(g.getActor('enemy')?.hp).toBe(12);
    expect(g.drainEvents().filter(x => x.type === 'hit' && x.actorId === 'enemy')).toMatchObject([{ amount: 2 }]);
  });
  it('shield absorbs direct and combined Echo damage', () => {
    const target = e('enemy', c(4, 4), 10); target.shield = 6;
    const g = fresh([p(), target]); hit(g, c(1, 1), 4, [c(4, 4)], 0); g.endTurn();
    expect(g.getActor('enemy')?.hp).toBe(10); expect(g.getActor('enemy')?.shield).toBe(0);
  });
  it('killing last enemy locks victory and clears pending Echoes', () => {
    const g = fresh([p(), e('enemy', c(2, 1), 1)]); hit(g, c(2, 1), 1);
    expect(g.getState().phase).toBe('victory'); expect(g.getState().echoes).toEqual([]);
    expect(g.endTurn().ok).toBe(false); expect(g.guard('hero').ok).toBe(false);
  });
});

describe('web combat regressions', () => {
  it('allows a shifted Echo to cover occupied cells', () => {
    const g = fresh([p(), e('enemy', c(3, 1))]); hit(g);
    expect(g.shiftEcho('hero', g.getState().echoes[0].id, c(3, 1)).ok).toBe(true);
    g.endTurn(); expect(g.getActor('enemy')?.hp).toBe(18);
  });
  it('freezes enemy intent until execution even if the hero moves', () => {
    const g = new CombatModel({ heroCell: c(1, 1), enemies: [{ id: 'enemy', name: 'Archer', kind: 'archer', cell: c(3, 1) }] });
    const before = g.getState().intents; g.move('hero', c(1, 2));
    expect(g.getState().intents).toEqual(before); g.endTurn();
    expect(g.getActor('hero')?.hp).toBe(g.getActor('hero')?.maxHp);
  });
  it('does not push from an Echo, or beyond a board edge', () => {
    const g = fresh([p('hero', c(4, 1)), e('enemy', c(5, 1))]);
    hit(g, c(5, 1), 1, [c(5, 1)], 1, true); g.endTurn();
    expect(g.getActor('enemy')?.cell).toEqual(c(5, 1)); expect(g.getActor('enemy')?.hp).toBe(18);
  });
  it('deduplicates area cells and rejects fractional coordinates', () => {
    const g = fresh([p(), e('enemy', c(2, 1))]); hit(g, c(2, 1), 2, [c(2, 1), c(2, 1)]);
    expect(g.getActor('enemy')?.hp).toBe(18);
    expect(g.move('hero', c(1.5, 1.5)).ok).toBe(false);
  });
  it('snapshots cannot mutate the model; fresh battles reset all state', () => {
    const g = fresh(); const s = g.getState(); s.actors[0].hp = 0;
    expect(g.getActor('hero')?.hp).toBe(20); hit(g); g.endTurn();
    const restart = fresh().getState(); expect(restart.round).toBe(1); expect(restart.echoes).toEqual([]); expect(restart.echoShiftedThisRound).toBe(false);
  });
  it('rejects invalid initial positions and duplicated IDs', () => {
    expect(() => fresh([p(), e('hero')])).toThrow(); expect(() => fresh([p(), e('enemy', c(1, 1))])).toThrow();
  });
});
