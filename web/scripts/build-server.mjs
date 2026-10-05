import { build } from 'esbuild';
await build({ entryPoints: ['server/index.ts'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: 'server-dist/index.mjs', target: 'node22' });
