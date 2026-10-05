import { describe, expect, it } from 'vitest';
import { PreparationModel } from './PreparationModel';

// The same preparation model will be used by either agreed connection mode.
describe('two opposing teams prepare a deterministic battle', () => {
  it('restricts deployment to each side of the 6×6 board', () => {
    const p = new PreparationModel();
    expect(p.deploy('south', 'warden', { x: 2, y: 4 }).ok).toBe(true);
    expect(p.deploy('north', 'archer', { x: 2, y: 1 }).ok).toBe(true);
    expect(p.deploy('south', 'archer', { x: 3, y: 1 }).ok).toBe(false);
    expect(p.deploy('north', 'archer', { x: 3, y: 4 }).ok).toBe(false);
    expect(p.deploy('south', 'archer', { x: 0.5, y: 4 }).ok).toBe(false);
  });
  it('does not spend budget on invalid or occupied placements', () => {
    const p = new PreparationModel(); p.deploy('south', 'warden', { x: 2, y: 4 });
    const before = p.snapshot();
    expect(p.deploy('south', 'archer', { x: 2, y: 4 }).ok).toBe(false);
    expect(p.snapshot()).toEqual(before);
  });
  it('enforces three units and six deployment points per side', () => {
    const p = new PreparationModel();
    expect(p.deploy('south', 'weaver', { x: 0, y: 5 }).ok).toBe(true);
    expect(p.deploy('south', 'weaver', { x: 1, y: 5 }).ok).toBe(true);
    expect(p.deploy('south', 'archer', { x: 2, y: 5 }).ok).toBe(false);
    const q = new PreparationModel();
    for (let x = 0; x < 3; x++) expect(q.deploy('north', 'warden', { x, y: 0 }).ok).toBe(true);
    expect(q.deploy('north', 'warden', { x: 3, y: 0 }).ok).toBe(false);
  });
  it('allows moving/removing own units and refunds their cost', () => {
    const p = new PreparationModel(); p.deploy('south', 'weaver', { x: 0, y: 5 });
    const id = p.snapshot().units[0].id;
    expect(p.move('north', id, { x: 0, y: 0 }).ok).toBe(false);
    expect(p.move('south', id, { x: 4, y: 4 }).ok).toBe(true);
    expect(p.remove('north', id).ok).toBe(false);
    expect(p.remove('south', id).ok).toBe(true);
    expect(p.snapshot().remaining.south).toBe(6);
  });
  it('requires a nonempty team and both players ready before locking combat', () => {
    const p = new PreparationModel(); expect(p.setReady('south', true).ok).toBe(false);
    p.deploy('south', 'warden', { x: 2, y: 4 }); p.deploy('north', 'archer', { x: 2, y: 1 });
    expect(p.setReady('south', true).ok).toBe(true); expect(p.snapshot().locked).toBe(false);
    expect(p.deploy('south', 'warden', { x: 3, y: 5 }).ok).toBe(false);
    expect(p.setReady('south', false).ok).toBe(true);
    p.setReady('south', true); p.setReady('north', true);
    expect(p.snapshot().locked).toBe(true);
    expect(p.setReady('north', false).ok).toBe(false);
    expect(p.remove('south', p.snapshot().units[0].id).ok).toBe(false);
  });
  it('produces identical snapshots from the same commands and does not expose mutable state', () => {
    const p = new PreparationModel(), q = new PreparationModel();
    for (const game of [p, q]) { game.deploy('south', 'warden', { x: 1, y: 4 }); game.deploy('north', 'weaver', { x: 4, y: 1 }); game.setReady('north', true); }
    expect(p.snapshot()).toEqual(q.snapshot());
    const s = p.snapshot(); s.units[0].cell.x = 999;
    expect(p.snapshot()).toEqual(q.snapshot());
  });
});
