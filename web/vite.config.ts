import { defineConfig } from 'vitest/config';
export default defineConfig({
  build: { target: 'es2022', sourcemap: false },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true } } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
