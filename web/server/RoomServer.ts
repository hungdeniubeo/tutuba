import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { PreparationModel, ROSTER, type Side, type UnitRole } from '../src/game/autobattle/PreparationModel';
import { AutoBattleModel } from '../src/game/autobattle/AutoBattleModel';
import { type RoomSnapshot, type ServerMessage } from '../src/game/autobattle/protocol';
import { type Cell, type CombatEvent, isInBounds } from '../src/game/combat/types';
interface Seat { name: string; token: string; socket: WebSocket | null }
interface Room {
  code: string; seats: Partial<Record<Side, Seat>>; prep: PreparationModel; battle: AutoBattleModel | null;
  phase: RoomSnapshot['phase']; version: number; score: Record<Side, number>; round: number;
  nextVotes: Record<Side, boolean>; timer: ReturnType<typeof setInterval> | null; touched: number;
}
interface Peer { room?: Room; side?: Side; rateStart: number; messages: number; alive: boolean }
export function createRoomServer(options: { stepMs?: number; staticDir?: string; roomTtlMs?: number } = {}) {
  const rooms = new Map<string, Room>(), peers = new Map<WebSocket, Peer>();
  const root = resolve(options.staticDir ?? 'dist'), stepMs = options.stepMs ?? 900;
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true })); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404).end('Not found'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    let validOrigin = !origin;
    try { validOrigin = !origin || new URL(origin).host === req.headers.host; } catch { validOrigin = false; }
    if (req.url !== '/ws' || !validOrigin || wss.clients.size >= 200) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  function send(ws: WebSocket | null | undefined, message: ServerMessage): void { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }
  function error(ws: WebSocket, message: string): void { send(ws, { type: 'error', message }); }
  function connected(room: Room, side: Side): boolean { return room.seats[side]?.socket?.readyState === WebSocket.OPEN; }
  function broadcast(room: Room, events: CombatEvent[] = []): void {
    room.version++; room.touched = Date.now();
    for (const side of ['south', 'north'] as const) {
      const state: RoomSnapshot = {
        code: room.code, version: room.version, you: side, phase: room.phase,
        names: { south: room.seats.south?.name ?? 'Người chơi 1', north: room.seats.north?.name ?? 'Đang chờ bạn…' },
        connected: { south: connected(room, 'south'), north: connected(room, 'north') },
        prep: room.prep.snapshot(), battle: room.battle?.snapshot() ?? null, events,
        score: { ...room.score }, round: room.round, nextVotes: { ...room.nextVotes },
        paused: room.phase === 'combat' && (!connected(room, 'south') || !connected(room, 'north')),
      };
      send(room.seats[side]?.socket, { type: 'state', state });
    }
  }
  function begin(room: Room): void {
    if (!connected(room, 'south') || !connected(room, 'north') || !room.prep.snapshot().locked) return;
    room.phase = 'combat'; room.battle = new AutoBattleModel(room.prep.snapshot().units, room.round % 2 ? 'south' : 'north');
    room.timer = setInterval(() => {
      if (!connected(room, 'south') || !connected(room, 'north')) return;
      room.battle!.step(); const state = room.battle!.snapshot();
      if (state.winner) {
        if (state.winner !== 'draw') room.score[state.winner]++;
        room.phase = 'result'; if (room.timer) clearInterval(room.timer); room.timer = null;
      }
      broadcast(room, room.battle!.drainEvents());
    }, stepMs);
    room.timer.unref();
  }
  function attach(ws: WebSocket, room: Room, side: Side, name: string, token?: string): void {
    const peer = peers.get(ws)!; peer.room = room; peer.side = side;
    const seat = room.seats[side] ?? { name, token: randomBytes(24).toString('hex'), socket: null };
    if (seat.socket && seat.socket !== ws) seat.socket.close(4001, 'Phiên kết nối mới');
    seat.socket = ws; room.seats[side] = seat;
    send(ws, { type: 'joined', code: room.code, side, token: token ?? seat.token });
    if (room.prep.snapshot().locked && room.phase === 'preparation') begin(room);
    broadcast(room);
  }
  function handle(ws: WebSocket, input: unknown): void {
    if (!input || typeof input !== 'object') return error(ws, 'Lệnh không hợp lệ.');
    const m = input as Record<string, unknown>, peer = peers.get(ws)!;
    const name = typeof m.name === 'string' ? m.name.trim().slice(0, 24).replace(/[<>\x00-\x1f]/g, '') || 'Người chơi' : 'Người chơi';
    if (m.type === 'create' || m.type === 'join' || m.type === 'resume') {
      if (peer.room) return error(ws, 'Bạn đã ở trong một phòng.');
      if (m.type === 'create') {
        if (rooms.size >= 100) return error(ws, 'Máy chủ đang đầy. Hãy thử lại sau.');
        let code: string;
        do { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code = [...randomBytes(6)].map(n => alphabet[n % alphabet.length]).join(''); } while (rooms.has(code));
        const room: Room = { code, seats: {}, prep: new PreparationModel(), battle: null, phase: 'preparation', version: 0, score: { south: 0, north: 0 }, round: 1, nextVotes: { south: false, north: false }, timer: null, touched: Date.now() };
        rooms.set(code, room); attach(ws, room, 'south', name); return;
      }
      const code = typeof m.code === 'string' ? m.code.trim().toUpperCase() : '';
      const room = rooms.get(code); if (!room) return error(ws, 'Không tìm thấy phòng. Kiểm tra mã hoặc tạo phòng mới.');
      if (m.type === 'resume') {
        const token = typeof m.token === 'string' ? m.token : '';
        const side = (['south', 'north'] as const).find(side => { const expected = room.seats[side]?.token; return expected && token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected)); });
        if (!side) return error(ws, 'Không thể khôi phục chỗ chơi này.');
        attach(ws, room, side, room.seats[side]!.name); return;
      }
      if (room.seats.north) return error(ws, 'Phòng đã đủ hai người.');
      attach(ws, room, 'north', name); return;
    }
    const room = peer.room, side = peer.side;
    if (!room || !side || room.seats[side]?.socket !== ws) return error(ws, 'Hãy tạo hoặc vào phòng trước.');
    if (m.type === 'next') {
      if (room.phase !== 'result') return error(ws, 'Trận chưa kết thúc.');
      room.nextVotes[side] = true;
      if (room.nextVotes.south && room.nextVotes.north) {
        const units = room.prep.snapshot().units; room.prep = new PreparationModel();
        for (const u of units) room.prep.deploy(u.side, u.role, u.cell);
        if (Math.max(room.score.south, room.score.north) >= 2) { room.score = { south: 0, north: 0 }; room.round = 1; } else room.round++;
        room.battle = null; room.phase = 'preparation'; room.nextVotes = { south: false, north: false };
      }
      broadcast(room); return;
    }
    if (room.phase !== 'preparation') return error(ws, 'Combat đang tự chạy. Chỉ sửa đội hình giữa các trận.');
    let result;
    const cell = m.cell as Cell | undefined;
    if (m.type === 'deploy') {
      if (typeof m.role !== 'string' || !Object.hasOwn(ROSTER, m.role) || !cell || !isInBounds(cell)) return error(ws, 'Quân hoặc vị trí không hợp lệ.');
      result = room.prep.deploy(side, m.role as UnitRole, cell);
    } else if (m.type === 'move') {
      if (typeof m.id !== 'string' || !cell || !isInBounds(cell)) return error(ws, 'Vị trí không hợp lệ.');
      result = room.prep.move(side, m.id, cell);
    } else if (m.type === 'remove') {
      result = room.prep.remove(side, typeof m.id === 'string' ? m.id : '');
    } else if (m.type === 'ready' && typeof m.ready === 'boolean') {
      result = room.prep.setReady(side, m.ready);
    } else return error(ws, 'Lệnh không được hỗ trợ.');
    if (!result.ok) return error(ws, result.message);
    if (room.prep.snapshot().locked) begin(room);
    broadcast(room);
  }
  wss.on('connection', ws => {
    peers.set(ws, { rateStart: Date.now(), messages: 0, alive: true });
    ws.on('pong', () => { const p = peers.get(ws); if (p) p.alive = true; });
    ws.on('message', raw => {
      const peer = peers.get(ws)!;
      if (Date.now() - peer.rateStart > 1000) { peer.rateStart = Date.now(); peer.messages = 0; }
      if (++peer.messages > 30) return error(ws, 'Thao tác quá nhanh. Chờ một giây rồi thử lại.');
      try { handle(ws, JSON.parse(raw.toString())); } catch { error(ws, 'Lệnh không hợp lệ.'); }
    });
    ws.on('error', () => {});
    ws.on('close', () => {
      const peer = peers.get(ws); peers.delete(ws);
      if (peer?.room && peer.side && peer.room.seats[peer.side]?.socket === ws) { peer.room.seats[peer.side]!.socket = null; broadcast(peer.room); }
    });
  });
  const heartbeat = setInterval(() => {
    for (const [ws, peer] of peers) { if (!peer.alive) ws.terminate(); else { peer.alive = false; ws.ping(); } }
    for (const [code, room] of rooms) if (!connected(room, 'south') && !connected(room, 'north') && Date.now() - room.touched > (options.roomTtlMs ?? 300000)) {
      if (room.timer) clearInterval(room.timer); rooms.delete(code);
    }
  }, 10000); heartbeat.unref();
  return {
    listen: (port = 8787, host = '0.0.0.0'): Promise<number> => new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(port, host, () => { const address = server.address(); resolve(typeof address === 'object' && address ? address.port : port); });
    }),
    close: async (): Promise<void> => {
      clearInterval(heartbeat); for (const room of rooms.values()) if (room.timer) clearInterval(room.timer);
      for (const ws of wss.clients) ws.terminate(); wss.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
