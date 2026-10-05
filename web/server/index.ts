import { fileURLToPath } from 'node:url';
import { createRoomServer } from './RoomServer';
const app = createRoomServer({ staticDir: fileURLToPath(new URL('../dist/', import.meta.url)), stepMs: Number(process.env.TUTUBA_STEP_MS) || 900 });
const port = await app.listen(Number(process.env.PORT) || 8787, process.env.HOST ?? '0.0.0.0');
console.log(`TUTUBA room server: http://localhost:${port}`);
process.on('SIGINT', () => { void app.close().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void app.close().then(() => process.exit(0)); });
