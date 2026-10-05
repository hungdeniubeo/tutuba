import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createRoomServer } from './RoomServer';
const servers: ReturnType<typeof createRoomServer>[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => { for (const s of sockets.splice(0)) s.terminate(); for (const s of servers.splice(0)) await s.close(); });
async function setup() {
  const server = createRoomServer({ stepMs: 2 }); servers.push(server);
  const port = await server.listen(0, '127.0.0.1');
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); sockets.push(ws);
    const messages: any[] = []; ws.on('message', data => messages.push(JSON.parse(data.toString())));
    await new Promise<void>(resolve => ws.once('open', resolve));
    const wait = async (test: (m: any) => boolean) => {
      const start = Date.now();
      while (Date.now() - start < 5000) { const at = messages.findIndex(test); if (at >= 0) return messages.splice(at, 1)[0]; await new Promise(r => setTimeout(r, 5)); }
      throw new Error('Expected server message not received');
    };
    return { ws, messages, send: (m: unknown) => ws.send(JSON.stringify(m)), wait };
  };
  return { connect };
}
describe('private two-player rooms over real WebSocket connections', () => {
  it('joins exactly two seats, rejects a third and enforces territory ownership', async () => {
    const { connect } = await setup(), a = await connect(), b = await connect(), c = await connect();
    a.send({ type: 'create', name: 'An' }); const joined = await a.wait(m => m.type === 'joined');
    b.send({ type: 'join', code: joined.code, name: 'Bình' }); expect((await b.wait(m => m.type === 'joined')).side).toBe('north');
    c.send({ type: 'join', code: joined.code }); expect((await c.wait(m => m.type === 'error')).message).toMatch(/đủ/);
    b.send({ type: 'deploy', role: 'warden', cell: { x: 2, y: 4 }, side: 'south' });
    expect((await b.wait(m => m.type === 'error')).message).toMatch(/phía/);
    a.send({ type: 'deploy', role: 'warden', cell: { x: 2, y: 4 } });
    const first = await a.wait(m => m.type === 'state' && m.state.prep.units.length === 1);
    const second = await b.wait(m => m.type === 'state' && m.state.version === first.state.version);
    expect(first.state.prep).toEqual(second.state.prep);
  });
  it('runs the same automatic battle to a result for both clients and restarts by mutual vote', async () => {
    const { connect } = await setup(), a = await connect(), b = await connect();
    a.send({ type: 'create' }); const room = await a.wait(m => m.type === 'joined');
    b.send({ type: 'join', code: room.code }); await b.wait(m => m.type === 'joined');
    a.send({ type: 'deploy', role: 'warden', cell: { x: 2, y: 4 } });
    b.send({ type: 'deploy', role: 'archer', cell: { x: 2, y: 1 } });
    a.send({ type: 'ready', ready: true }); b.send({ type: 'ready', ready: true });
    const ar = await a.wait(m => m.type === 'state' && m.state.phase === 'result');
    const br = await b.wait(m => m.type === 'state' && m.state.phase === 'result');
    expect(ar.state.battle).toEqual(br.state.battle); expect(ar.state.score).toEqual(br.state.score);
    expect(ar.state.battle.winner).not.toBe(null);
    a.send({ type: 'next' }); b.send({ type: 'next' });
    const next = await a.wait(m => m.type === 'state' && m.state.phase === 'preparation' && m.state.round === 2);
    expect(next.state.prep.locked).toBe(false); expect(next.state.prep.units).toHaveLength(2);
  });
  it('reserves a disconnected seat, rejects wrong token, and resumes with the correct token', async () => {
    const { connect } = await setup(), a = await connect(), b = await connect();
    a.send({ type: 'create' }); const room = await a.wait(m => m.type === 'joined');
    b.send({ type: 'join', code: room.code }); const guest = await b.wait(m => m.type === 'joined');
    b.ws.close(); await a.wait(m => m.type === 'state' && !m.state.connected.north);
    const other = await connect(); other.send({ type: 'resume', code: room.code, token: 'invalid' });
    expect((await other.wait(m => m.type === 'error')).message).toMatch(/khôi phục/);
    other.send({ type: 'resume', code: room.code, token: guest.token });
    expect((await other.wait(m => m.type === 'joined')).side).toBe('north');
    expect((await a.wait(m => m.type === 'state' && m.state.connected.north)).state.connected.north).toBe(true);
  });
});
