import { type ActionResult, type Cell, cloneCell, isInBounds, sameCell } from '../combat/types';
export type Side = 'south' | 'north';
export type UnitRole = 'warden' | 'archer' | 'weaver';
export const ROSTER: Record<UnitRole, { name: string; cost: number; hp: number; damage: number; range: number; description: string }> = {
  warden: { name: 'Vệ Binh', cost: 1, hp: 24, damage: 4, range: 1, description: 'Cận chiến. Đẩy địch một ô nếu không bị chặn.' },
  archer: { name: 'Xạ Thủ', cost: 2, hp: 16, damage: 5, range: 3, description: 'Tấn công từ xa, tạo Dư Ảnh ở vùng địch đứng.' },
  weaver: { name: 'Dệt Ảnh', cost: 3, hp: 20, damage: 3, range: 2, description: 'Dời một Dư Ảnh mỗi vòng về phía địch, rồi tấn công.' },
};
export interface PlacedUnit { id: string; side: Side; role: UnitRole; cell: Cell }
export interface PreparationState { units: PlacedUnit[]; ready: Record<Side, boolean>; remaining: Record<Side, number>; locked: boolean }
export const homeCell = (side: Side, cell: Cell): boolean => isInBounds(cell) && (side === 'south' ? cell.y >= 4 : cell.y <= 1);
export class PreparationModel {
  private units: PlacedUnit[] = [];
  private ready: Record<Side, boolean> = { south: false, north: false };
  private sequence = 0;
  private locked = false;
  snapshot(): PreparationState {
    return structuredClone({ units: this.units, ready: this.ready, remaining: { south: this.remaining('south'), north: this.remaining('north') }, locked: this.locked });
  }
  deploy(side: Side, role: UnitRole, cell: Cell): ActionResult {
    if (!this.editable(side)) return this.fail('Đội đã sẵn sàng. Hủy sẵn sàng để sửa đội hình.');
    if (!(role in ROSTER) || !homeCell(side, cell)) return this.fail('Đặt quân trong hai hàng thuộc phía của bạn.');
    if (this.units.some(u => sameCell(u.cell, cell))) return this.fail('Ô này đã có quân.');
    if (this.units.filter(u => u.side === side).length >= 3) return this.fail('Mỗi đội tối đa 3 quân.');
    if (this.remaining(side) < ROSTER[role].cost) return this.fail('Không đủ điểm bố trí.');
    this.units.push({ id: `${side}-${++this.sequence}`, side, role, cell: cloneCell(cell) });
    return { ok: true, message: `Đã bố trí ${ROSTER[role].name}.` };
  }
  move(side: Side, id: string, cell: Cell): ActionResult {
    const u = this.units.find(u => u.id === id && u.side === side);
    if (!this.editable(side) || !u) return this.fail('Không thể điều khiển quân này.');
    if (!homeCell(side, cell) || this.units.some(other => other.id !== id && sameCell(other.cell, cell))) return this.fail('Chọn ô trống trong vùng của bạn.');
    u.cell = cloneCell(cell); return { ok: true, message: 'Đã đổi vị trí.' };
  }
  remove(side: Side, id: string): ActionResult {
    const u = this.units.find(u => u.id === id && u.side === side);
    if (!this.editable(side) || !u) return this.fail('Không thể thu hồi quân này.');
    this.units = this.units.filter(u => u.id !== id); return { ok: true, message: 'Đã thu hồi quân và hoàn điểm bố trí.' };
  }
  setReady(side: Side, ready: boolean): ActionResult {
    if (this.locked) return this.fail('Trận đấu đã bắt đầu.');
    if (ready && !this.units.some(u => u.side === side)) return this.fail('Bố trí ít nhất một quân trước khi sẵn sàng.');
    this.ready[side] = ready; this.locked = this.ready.south && this.ready.north;
    return { ok: true, message: ready ? 'Đã sẵn sàng.' : 'Có thể sửa đội hình.' };
  }
  private editable(side: Side): boolean { return !this.locked && !this.ready[side]; }
  private remaining(side: Side): number { return 6 - this.units.filter(u => u.side === side).reduce((n, u) => n + ROSTER[u.role].cost, 0); }
  private fail(message: string): ActionResult { return { ok: false, message }; }
}
