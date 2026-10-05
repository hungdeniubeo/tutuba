import { type CombatModelConfig } from './combat/CombatModel';
export interface Encounter { title: string; subtitle: string; lesson: string; config: CombatModelConfig }
export const encounters: Encounter[] = [
  {
    title: 'Dư Ảnh đầu tiên', subtitle: 'I · Vườn rêu',
    lesson: 'Bạn có 2 AP. Chọn Di chuyển rồi chọn ô liền kề. Ô đỏ cam là nơi địch sẽ đánh. Đòn đánh để lại Dư Ảnh tím, gây nửa sát thương đầu vòng sau. Thử đánh rồi bước ra khỏi vùng nguy hiểm.',
    config: { heroCell: { x: 1, y: 3 }, heroHp: 24, enemies: [
      { id: '01-bramble', name: 'Gai Trinh Sát', kind: 'bramble', cell: { x: 3, y: 3 }, hp: 15 },
    ] },
  },
  {
    title: 'Sợi chỉ màu tím', subtitle: 'II · Cổng đổ',
    lesson: 'Xạ Thủ đánh dấu ô của bạn từ cách tối đa 5 bước. Mục tiêu cố định trong vòng: hãy đi ra để né. Chọn Dư Ảnh trong danh sách rồi chọn ô liền kề để dời. Có thể dời vào ô đang có nhân vật.',
    config: { heroCell: { x: 1, y: 4 }, heroHp: 24, enemies: [
      { id: '01-bramble', name: 'Vệ Binh Gai', kind: 'bramble', cell: { x: 3, y: 3 } },
      { id: '02-archer', name: 'Xạ Thủ Cổ Ngữ', kind: 'archer', cell: { x: 4, y: 1 } },
    ] },
  },
  {
    title: 'Mượn sức dư âm', subtitle: 'III · Sân đá chìm',
    lesson: 'Đẩy gây 6 sát thương và đẩy địch liền kề một ô nếu không bị chặn. Dư Ảnh ở lại vùng đánh. Đánh ô trống để đặt bẫy, rồi đẩy địch vào đó. Dư Ảnh cũng gây sát thương cho Aster.',
    config: { heroCell: { x: 1, y: 3 }, heroHp: 26, enemies: [
      { id: '01-bramble', name: 'Vệ Binh Gai', kind: 'bramble', cell: { x: 3, y: 3 }, hp: 21 },
      { id: '02-bramble', name: 'Hộ Vệ Rêu', kind: 'bramble', cell: { x: 4, y: 4 }, hp: 18 },
      { id: '03-archer', name: 'Xạ Thủ Cổ Ngữ', kind: 'archer', cell: { x: 4, y: 0 }, hp: 15 },
    ] },
  },
  {
    title: 'Rừng Cổ vẫn nhớ', subtitle: 'IV · Lối qua cuối cùng',
    lesson: 'Kết hợp mọi kỹ năng. Khiên hấp thụ sát thương từ cả hai phe, kể cả Dư Ảnh. Tạo khiên thêm 4 điểm, tối đa 6. Dư Ảnh đến hạn kích hoạt đồng thời. Hạ hết địch để kết thúc hành trình.',
    config: { heroCell: { x: 0, y: 3 }, heroHp: 28, enemies: [
      { id: '01-bramble', name: 'Lính Gác Gai', kind: 'bramble', cell: { x: 2, y: 3 }, hp: 24 },
      { id: '02-bramble', name: 'Lính Gác Rêu', kind: 'bramble', cell: { x: 3, y: 5 }, hp: 21 },
      { id: '03-archer', name: 'Xạ Thủ Hoàng Hôn', kind: 'archer', cell: { x: 5, y: 1 }, hp: 18 },
      { id: '04-archer', name: 'Xạ Thủ Bình Minh', kind: 'archer', cell: { x: 4, y: 4 }, hp: 18 },
    ] },
  },
];
