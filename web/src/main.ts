import './style.css';
import { CombatModel } from './game/combat/CombatModel';
import { encounters } from './game/encounters';
import { type ActionResult, type Cell, type CombatEvent, cellLabel, manhattan, sameCell } from './game/combat/types';
import { ArenaScene } from './render/ArenaScene';

type Mode = 'move' | 'strike' | 'push' | 'shift';
let mode: Mode = 'move', encounterIndex = 0, selectedEcho = '', playing = false, busy = false;
let model = new CombatModel(encounters[0].config), startedAt = 0;
let soundOn = true, speed = 1, context: AudioContext | undefined;
try { soundOn = localStorage.getItem('tutuba-sound') !== 'off'; speed = localStorage.getItem('tutuba-speed') === '2' ? 2 : 1; } catch { /* Storage may be denied; play still works. */ }
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="game-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Menu TUTUBA"><span class="brand-mark">✧</span> TUTUBA <small>DƯ ÂM RỪNG CỔ</small></a>
      <div class="top-right"><span class="chapter-chip" id="chapter-chip">VƯỜN RÊU</span><button id="help" class="icon-button" title="Cách chơi (H)">? <span>Hướng dẫn</span></button><button id="pause" class="icon-button" title="Tạm dừng (Escape)">Ⅱ <span>Tạm dừng</span></button></div>
    </header>
    <section class="stage" aria-label="Đấu trường">
      <div id="arena"></div><div id="unit-labels" aria-hidden="true"></div>
      <div class="scene-heading"><p class="eyebrow" id="chapter">I · VƯỜN RÊU</p><h1 id="battle-title">Dư Ảnh đầu tiên</h1><p id="objective">Vượt qua khu vườn. Mỗi đòn đánh để lại một dư âm.</p></div>
      <div class="legend"><span><i class="swatch coral"></i>Ý định địch</span><span><i class="swatch violet"></i>Dư Ảnh · vòng sau</span><span><i class="swatch amber"></i>Địch di chuyển</span></div>
      <div class="camera-bar"><button id="rotate-left" title="Xoay góc nhìn sang trái">↶</button><button id="camera-reset">Đặt lại góc nhìn</button><button id="rotate-right" title="Xoay góc nhìn sang phải">↷</button><span>Kéo chuột phải để xoay · Cuộn để phóng to</span></div>
      <div id="tile-info" class="tile-info">Rê chuột lên ô để xem điều sẽ xảy ra.</div>
    </section>
    <aside class="sidebar">
      <div class="round-row"><span class="eyebrow">LƯỢT CỦA BẠN</span><b id="round">01</b></div>
      <section class="hero-card"><div class="portrait">✦</div><div><p class="eyebrow">NGƯỜI GIỮ DƯ ẢNH</p><h2>Aster <span id="hero-cell">B4</span></h2><p id="health-text">24 / 24 máu</p></div><div class="health-track"><i id="health-bar"></i></div><div class="resources"><span id="shield">◇ 0 KHIÊN</span><span id="ap">● ● <small>2 AP</small></span></div></section>
      <section class="lesson-card"><span class="eyebrow">GHI CHÉP HÀNH TRÌNH</span><p id="lesson"></p></section>
      <section><h3>Ý định địchions <span id="enemy-count"></span></h3><div id="intents"></div></section>
      <section class="echo-section"><h3>Dư Ảnh đang chờ <span id="echo-count">0</span></h3><div id="echoes"></div></section>
      <details class="combat-log"><summary>Nhật ký chiến đấu</summary><ol id="log"></ol></details>
      <details class="coordinate-controls"><summary>Bàn phím / lưới tọa độ</summary><p>Chọn hành động rồi chọn ô. Có thể dùng Tab + Enter.</p><div id="grid-controls"></div></details>
    </aside>
    <section class="action-dock" aria-label="Hành động">
      <div class="action-buttons">
        <button class="action active" data-mode="move" id="move"><kbd>1</kbd><span class="action-symbol">↟</span><b>Di chuyển</b><small>1 ô · 1 AP</small></button>
        <button class="action" data-mode="strike" id="strike"><kbd>2</kbd><span class="action-symbol">⚔</span><b>Đánh</b><small>6 sát thương · 1 AP</small></button>
        <button class="action" data-mode="push" id="push"><kbd>3</kbd><span class="action-symbol">⇥</span><b>Đẩy</b><small>6 + đẩy · 1 AP</small></button>
        <button class="action" id="guard"><kbd>4</kbd><span class="action-symbol">◇</span><b>Tạo khiên</b><small>+4 khiên · 1 AP</small></button>
        <button class="action" data-mode="shift" id="shift"><kbd>5</kbd><span class="action-symbol">⌘</span><b>Dời Dư Ảnh</b><small>1 / vòng · 1 AP</small></button>
      </div><div class="turn-controls"><span id="action-hint">Chọn một ô trống liền kề.</span><button id="end-turn" class="primary">Kết thúc lượt <span>↵</span></button></div>
    </section>
    <footer class="statusbar"><span id="status" role="status" aria-live="polite">Chào mừng đến với Rừng Cổ.</span><div><button id="sound">Bật âm thanh</button><button id="speed">Tốc độ 1×</button><span id="renderer-label">Đang tải…</span><span id="fps">— FPS</span></div></footer>
  </main>
  <div id="menu" class="modal-backdrop"><section class="menu-card"><p class="eyebrow">MỘT CHUYẾN ĐI CHIẾN THUẬT</p><div class="menu-emblem">✧</div><h1>TUTUBA</h1><p class="menu-subtitle">Dư âm Rừng Cổ</p><p class="menu-intro">Mỗi đòn đánh để lại một Dư Ảnh.<br>Hãy chọn nơi đứng khi nó trở lại.</p><div class="menu-facts"><span>4 trận đấu</span><span>1 người bảo hộ</span><span>2 AP mỗi vòng</span></div><button id="start" class="primary" disabled>Đang chuẩn bị khu vườn…</button><button id="menu-guide" class="text-button">Đọc hướng dẫn</button><p class="fine-print">Hành trình đầu dự kiến 10–15 phút.<br>Chuột + bàn phím · Không giới hạn thời gian</p></section></div>
  <div id="dialog" class="modal-backdrop" hidden><section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow" id="dialog-kicker"></p><h2 id="dialog-title"></h2><div id="dialog-body"></div><div id="dialog-actions"></div></section></div>
`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const scene = new ArenaScene($('#arena'), $('#unit-labels'));
const modes: Record<Mode, string> = { move: 'Chọn một ô trống liền kề.', strike: 'Đánh một ô liền kề. Ô trống cũng tạo được Dư Ảnh.', push: 'Đẩy địch liền kề sang ô trống hoặc vào Dư Ảnh.', shift: 'Chọn một Dư Ảnh rồi chọn ô đích liền kề.' };
let hover: Cell | null = null;

function tone(events: CombatEvent[]): void {
  if (!soundOn || !events.length) return;
  try {
    context ??= new AudioContext(); void context.resume();
    const o = context.createOscillator(), g = context.createGain();
    const echo = events.some(e => e.type === 'echo'), hit = events.some(e => e.type === 'hit');
    o.type = echo ? 'sine' : 'triangle'; o.frequency.setValueAtTime(echo ? 560 : hit ? 180 : 330, context.currentTime);
    o.frequency.exponentialRampToValueAtTime(echo ? 280 : 100, context.currentTime + 0.16);
    g.gain.setValueAtTime(0.045, context.currentTime); g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    o.connect(g).connect(context.destination); o.start(); o.stop(context.currentTime + 0.2);
  } catch { /* Audio is optional and cannot affect the rules. */ }
}
function setMode(next: Mode): void {
  mode = next; for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.classList.toggle('active', button.dataset.mode === mode); button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  $('#action-hint').textContent = modes[mode]; inspectTile(hover);
}
function inspectTile(cell: Cell | null): void {
  hover = cell;
  if (!cell) { $('#tile-info').textContent = modes[mode]; return; }
  const state = model.getState(), a = state.actors.find(a => a.alive && sameCell(a.cell, cell));
  const echoes = state.echoes.filter(e => e.cells.some(c => sameCell(c, cell)));
  const damage = echoes.reduce((sum, e) => sum + e.damage, 0);
  const intent = state.intents.filter(i => i.kind === 'attack' && i.cells.some(c => sameCell(c, cell))).reduce((sum, i) => sum + i.damage, 0);
  const hero = state.actors.find(a => a.id === 'hero')!;
  let info = `${cellLabel(cell)} · ${a ? `${a.name} · ${a.hp} máu${a.shield ? ` + ${a.shield} khiên` : ''}` : 'Ô trống'}`;
  if (intent) info += ` | Ý định địch: ${intent} sát thương trước vòng sau`;
  if (damage) info += ` | Dư Ảnh: ${damage} sát thương ở vòng ${state.round + 1}${a?.faction === 'player' ? ' · TRÚNG ĐỒNG MINH' : ''}`;
  if ((mode === 'strike' || mode === 'push') && manhattan(hero.cell, cell) <= 1) info += ` | Đánh 6 → Dư Ảnh 3${a?.faction === 'player' ? ' · TRÚNG ASTER' : ''}`;
  $('#tile-info').textContent = info;
}
function sync(): void {
  const s = model.getState(), hero = s.actors.find(a => a.id === 'hero')!, encounter = encounters[encounterIndex];
  const events = model.drainEvents(); scene.update(s, events); tone(events);
  $('#chapter').textContent = encounter.subtitle; $('#chapter-chip').textContent = `CHẶNG ${encounterIndex + 1} / ${encounters.length}`;
  $('#battle-title').textContent = encounter.title; $('#lesson').textContent = encounter.lesson;
  $('#round').textContent = String(s.round).padStart(2, '0'); $('#hero-cell').textContent = cellLabel(hero.cell);
  $('#health-text').textContent = `${hero.hp} / ${hero.maxHp} máu`; $('#health-bar').style.width = `${100 * hero.hp / hero.maxHp}%`;
  $('#shield').textContent = `◇ ${hero.shield} KHIÊN`;
  $('#ap').innerHTML = `${'● '.repeat(hero.ap)}${'○ '.repeat(2 - hero.ap)}<small>${hero.ap} AP</small>`;
  $('#enemy-count').textContent = String(s.actors.filter(a => a.faction === 'enemy' && a.alive).length);
  $('#intents').innerHTML = s.intents.map(i => {
    const a = s.actors.find(a => a.id === i.enemyId)!;
    return `<div class="intent-card ${i.kind}"><span class="intent-icon">${a.kind === 'bramble' ? '♜' : '◈'}</span><div><b>${a.name}</b><small>${a.hp}/${a.maxHp} máu · ${cellLabel(a.cell)}</small><p>${i.kind === 'attack' ? `${i.damage} sát thương tại <strong>${cellLabel(i.target)}</strong>${i.push ? ' + đẩy nếu còn liền kề' : ''}<em>Sau đó: Dư Ảnh ${Math.max(1, Math.floor(i.damage / 2))} ở vòng ${s.round + 1}</em>` : `Tiến đến → <strong>${cellLabel(i.target)}</strong>`}</p></div></div>`;
  }).join('') || '<p class="empty-note">Đã hạ hết địch.</p>';
  if (!s.echoes.some(e => e.id === selectedEcho)) selectedEcho = s.echoes[0]?.id ?? '';
  $('#echo-count').textContent = String(s.echoes.length);
  $('#echoes').innerHTML = s.echoes.map(e => {
    const owner = s.actors.find(a => a.id === e.ownerId)?.name ?? e.ownerId;
    const danger = s.actors.some(a => a.faction === 'player' && a.alive && e.cells.some(c => sameCell(c, a.cell)));
    return `<button class="echo-card ${selectedEcho === e.id ? 'selected' : ''}" data-echo="${e.id}" aria-pressed="${selectedEcho === e.id}"><span>⌘</span><div><b>${e.cells.map(cellLabel).join(', ')} · ${e.damage} sát thương</b><small>${owner} · vòng ${e.dueRound}</small>${danger ? '<em>Nguy hiểm: Aster đang trong vùng này</em>' : '<small>Trúng cả hai phe · vùng cố định</small>'}</div></button>`;
  }).join('') || '<p class="empty-note">Mỗi đòn đánh để lại một Dư Ảnh.<br>Nửa sát thương. Vòng sau. Trúng cả hai phe.</p>';
  $('#log').innerHTML = s.log.slice(-8).map(l => `<li>${l}</li>`).join('');
  $('#status').textContent = s.lastEvent;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.action, #end-turn')) b.disabled = !playing || busy || s.phase !== 'player' || (b.id !== 'end-turn' && hero.ap <= 0);
  $('#shift').toggleAttribute('disabled', !playing || busy || !hero.ap || s.phase !== 'player' || !s.echoes.length || s.echoShiftedThisRound);
  $('#guard').toggleAttribute('disabled', !playing || busy || !hero.ap || s.phase !== 'player' || hero.shield >= hero.maxShield);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-cell]')) {
    const [x, y] = button.dataset.cell!.split(',').map(Number), a = s.actors.find(a => a.alive && sameCell(a.cell, { x, y }));
    button.textContent = `${cellLabel({ x, y })}${a ? a.faction === 'player' ? ' ♙' : ' ♟' : ''}`;
    button.classList.toggle('occupied', !!a); button.title = a?.name ?? 'Ô trống';
  }
  inspectTile(hover);
}
function act(fn: () => ActionResult): void {
  if (!playing || busy || !$('#dialog').hidden) return;
  const result = fn(); sync(); $('#status').classList.toggle('error', !result.ok);
  if (model.getState().phase === 'victory' || model.getState().phase === 'defeat') finishBattle();
}
function useCell(c: Cell): void {
  if (mode === 'shift') {
    if (!selectedEcho) { $('#status').textContent = 'Hãy đánh để tạo Dư Ảnh trước.'; return; }
    act(() => model.shiftEcho('hero', selectedEcho, c));
  } else act(() => mode === 'move' ? model.move('hero', c) : mode === 'push' ? model.pushStrike('hero', c) : model.strike('hero', c));
}
function startBattle(index: number): void {
  encounterIndex = index; model = new CombatModel(encounters[index].config); selectedEcho = ''; busy = false; playing = true;
  scene.reset(); $('#menu').hidden = true; $('#dialog').hidden = true; scene.setActive(true); setMode('move'); sync();
}
function dialog(kicker: string, title: string, body: string, buttons: { label: string; id: string; action: () => void; primary?: boolean }[]): void {
  $('#dialog-kicker').textContent = kicker; $('#dialog-title').textContent = title; $('#dialog-body').innerHTML = body;
  $('#dialog-actions').replaceChildren();
  for (const item of buttons) { const b = document.createElement('button'); b.id = item.id; b.textContent = item.label; b.className = item.primary ? 'primary' : 'secondary'; b.onclick = item.action; $('#dialog-actions').append(b); }
  $('#dialog').hidden = false; scene.setActive(false); ($('#dialog-actions button') as HTMLButtonElement).focus();
}
function closeDialog(): void { $('#dialog').hidden = true; scene.setActive(playing); $('#end-turn').focus(); }
function finishBattle(): void {
  const victory = model.getState().phase === 'victory', final = victory && encounterIndex === encounters.length - 1;
  const minutes = ((performance.now() - startedAt) / 60000).toFixed(1);
  dialog(victory ? final ? 'HÀNH TRÌNH HOÀN TẤT' : 'ĐÃ VƯỢT QUA CHẶNG NÀY' : 'RỪNG CỔ VẪN NHỚ', victory ? final ? 'Bạn đã phá vỡ vòng lặp.' : 'Chiến thắng. Dư âm còn lại.' : 'Aster đã gục ngã.', `<p>${victory ? final ? `Cả bốn chặng đã yên bình. Bạn hoàn thành trong ${minutes} phút. Dư Ảnh đã giúp bạn tạo nên điều gì?` : 'Aster hồi đầy máu trước chặng kế tiếp. Trận sau sẽ cần bạn chọn vị trí cẩn thận hơn.' : 'Ý định địch luôn nhắm vào ô đã đánh dấu. Hãy né, tạo khiên hoặc đẩy địch để chuẩn bị Dư Ảnh tiếp theo.'}</p><p class="result-detail">Chặng ${encounterIndex + 1} / ${encounters.length} · Vòng ${model.getState().round}</p>`, [
    ...(victory && !final ? [{ label: 'Chặng tiếp theo →', id: 'next-battle', action: () => startBattle(encounterIndex + 1), primary: true }] : []),
    { label: final ? 'Chơi lại' : 'Chơi lại trận', id: 'restart', action: () => { if (final) startedAt = performance.now(); startBattle(final ? 0 : encounterIndex); }, primary: !victory || final },
    { label: 'Về menu', id: 'return-menu', action: showMenu },
  ]);
}
function showMenu(): void { playing = false; $('#dialog').hidden = true; $('#menu').hidden = false; scene.setActive(false); sync(); }
function guide(): void {
  dialog('HƯỚNG DẪN', 'Mỗi hành động, hai lần tác động.', `<div class="guide-grid"><p><b>01 · Quan sát</b>Ô đỏ cam là vùng địch sẽ đánh. Ô vàng là nơi địch định đi đến. Ý định được thực hiện sau khi kết thúc lượt.</p><p><b>02 · Hành động</b>Mỗi vòng có 2 điểm hành động (AP). Đi một ô theo hàng/cột; đánh hoặc đẩy gây 6 sát thương. Đánh ô trống để đặt bẫy Dư Ảnh.</p><p><b>03 · Ghi nhớ</b>Mỗi đòn đánh để lại Dư Ảnh. Đầu vòng sau, nó gây nửa sát thương gốc cho mọi người trong vùng cố định, làm tròn xuống và tối thiểu 1.</p><p><b>04 · Điều khiển</b>Chọn Dư Ảnh trong danh sách rồi dời một ô với 1 AP, tối đa một lần mỗi vòng. Đẩy địch vào vùng Dư Ảnh; đẩy bị chặn không gây thêm sát thương.</p><p><b>05 · Sinh tồn</b>Tạo khiên thêm 4 điểm, tối đa 6. Khiên hấp thụ mọi nguồn sát thương. Dư Ảnh trúng cả hai phe; không đẩy và không sinh Dư Ảnh mới.</p><p><b>06 · Điều khiển</b>Phím 1–5 chọn kỹ năng; 4 tạo khiên ngay. Enter kết thúc lượt. H mở hướng dẫn; Escape tạm dừng. Kéo chuột phải hoặc ↶/↷ để xoay; cuộn để phóng to.</p></div><p class="fine-print">Dư Ảnh đến hạn kích hoạt đồng thời. Cả hai phe cùng chết thì bạn thua. Hồi đầy máu giữa các chặng. Thiết lập được lưu trên máy; tiến độ trận không được lưu.</p>`, [{ label: 'Đã hiểu', id: 'close-guide', action: closeDialog, primary: true }]);
}
function pause(): void {
  if (!playing) return;
  if (!$('#dialog').hidden) { if (model.getState().phase === 'player') closeDialog(); return; }
  dialog('CỨ BÌNH TĨNH', 'Rừng Cổ có thể chờ.', `<p>Trận đấu đang tạm dừng. Combat không chạy theo thời gian.</p><label class="setting">Độ nét hình ảnh <select id="resolution"><option value="1">1× — nhẹ</option><option value="1.5">1.5× — nét</option></select></label><p class="fine-print">Mặc định dùng WebGL. <a href="?renderer=webgpu">Thử WebGPU</a> (thử nghiệm, bắt đầu lại hành trình).</p>`, [
    { label: 'Tiếp tục', id: 'resume', action: closeDialog, primary: true },
    { label: 'Chơi lại trận', id: 'restart', action: () => startBattle(encounterIndex) },
    { label: 'Về menu', id: 'return-menu', action: showMenu },
  ]);
  $('#resolution').addEventListener('change', e => scene.setResolutionScale(Number((e.target as HTMLSelectElement).value)));
}
for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
  const b = document.createElement('button'); b.dataset.cell = `${x},${y}`; b.onclick = () => useCell({ x, y }); b.onmouseenter = () => inspectTile({ x, y }); $('#grid-controls').append(b);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.onclick = () => setMode(button.dataset.mode as Mode);
$('#guard').onclick = () => act(() => model.guard('hero'));
$('#end-turn').onclick = () => act(() => model.endTurn());
$('#echoes').onclick = e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-echo]'); if (b) { selectedEcho = b.dataset.echo!; setMode('shift'); sync(); } };
$('#start').onclick = () => { startedAt = performance.now(); startBattle(0); };
$('#help').onclick = guide; $('#menu-guide').onclick = guide; $('#pause').onclick = pause;
$('.brand').onclick = e => { e.preventDefault(); if (playing) pause(); };
$('#rotate-left').onclick = () => scene.rotate(-1); $('#rotate-right').onclick = () => scene.rotate(1); $('#camera-reset').onclick = () => scene.resetCamera();
function updateSettings(): void { $('#sound').textContent = `${soundOn ? 'Bật' : 'Tắt'} âm thanh`; $('#speed').textContent = `Tốc độ ${speed}×`; scene.speed = speed; }
$('#sound').onclick = () => { soundOn = !soundOn; try { localStorage.setItem('tutuba-sound', soundOn ? 'on' : 'off'); } catch {} updateSettings(); };
$('#speed').onclick = () => { speed = speed === 1 ? 2 : 1; try { localStorage.setItem('tutuba-speed', String(speed)); } catch {} updateSettings(); };
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.repeat) return;
  if (e.key === 'Escape') { e.preventDefault(); pause(); return; }
  if (!$('#dialog').hidden || !playing) return;
  if (e.key.toLowerCase() === 'h') guide();
  const shortcuts: Record<string, string> = { '1': 'move', '2': 'strike', '3': 'push', '4': 'guard', '5': 'shift' };
  if (shortcuts[e.key]) { e.preventDefault(); $<HTMLButtonElement>(`#${shortcuts[e.key]}`).click(); }
  if (e.key === 'Enter' && e.target === document.body) { e.preventDefault(); $('#end-turn').click(); }
});
scene.onCell = useCell; scene.onHover = inspectTile; scene.onFps = fps => { $('#fps').textContent = `${fps} FPS`; };
updateSettings();
// Read-only diagnostics for repeatable browser verification. Gameplay remains UI-only.
Object.defineProperty(window, '__TUTUBA__', { value: Object.freeze({
  inspect: () => ({ state: model.getState(), encounterIndex, playing, mode }),
  projectCell: (cell: Cell) => scene.projectCell(cell),
  measure: (durationMs: number) => scene.measure(durationMs),
}), writable: false });
async function boot(): Promise<void> {
try {
  await scene.init(); sync(); scene.setActive(false); $('#renderer-label').textContent = scene.rendererName;
  $<HTMLButtonElement>('#start').disabled = false; $('#start').textContent = 'Bước vào Rừng Cổ →';
} catch (error) {
  $('#renderer-label').textContent = 'Không thể dựng hình';
  $('#start').textContent = 'Không khởi động được WebGL';
  $('.menu-intro').textContent = 'Hãy bật tăng tốc phần cứng trong trình duyệt và tải lại. TUTUBA cần WebGL 2.';
  console.error(error);
}
}
void boot();
