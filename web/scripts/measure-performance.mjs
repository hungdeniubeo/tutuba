import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { openBrowser, inspect, action, baseUrl } from './browser-helpers.mjs';
const out = new URL('../docs/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const plans = JSON.parse(await readFile(new URL('victory-plans.json', out), 'utf8'));
const { browser, page, errors, consoleMessages } = await openBrowser();
let index = 0, step = 0, actionCount = 0;
const started = Date.now();
async function nextAction() {
  const state = await inspect(page);
  if (state.state.phase === 'victory') {
    if (index < plans.length - 1) { await page.locator('#next-battle').click(); index++; }
    else { await page.locator('#restart').click(); index = 0; }
    step = 0;
  } else {
    assert.notEqual(state.state.phase, 'defeat');
    const planned = plans[index][step++];
    if (!planned) throw new Error('Plan ended before victory');
    await action(page, planned); actionCount++;
  }
}
try {
  await page.bringToFront();
  await page.locator('#start').click();
  // Warm the production renderer and shader paths with actual combat, not an idle menu.
  const warmupMs = 30000;
  while (Date.now() - started < warmupMs) { await nextAction(); await page.waitForTimeout(450); }
  console.log('Warm-up complete. Measuring 180 seconds of foreground combat at 1920×1080.');
  const measurement = page.evaluate(() => window.__TUTUBA__.measure(180000));
  const measureStart = Date.now(), countAtStart = actionCount;
  while (Date.now() - measureStart < 180000) { await nextAction(); await page.waitForTimeout(800); }
  const result = await measurement;
  await page.screenshot({ path: new URL('performance-combat.png', out).pathname });
  const cdp = await browser.newBrowserCDPSession();
  const hardware = await cdp.send('SystemInfo.getInfo');
  const memory = await page.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null);
  const sizes = [];
  async function walk(url) { for (const item of await readdir(url, { withFileTypes: true })) { const child = new URL(item.name + (item.isDirectory() ? '/' : ''), url); if (item.isDirectory()) await walk(child); else sizes.push({ file: child.pathname.split('/dist/')[1], bytes: (await stat(child)).size }); } }
  await walk(new URL('../dist/', import.meta.url));
  const report = { date: new Date().toISOString(), source: baseUrl, build: 'Vite production preview', browser: browser.version(), machine: { os: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0].model, memoryBytes: os.totalmem(), macOS: process.platform === 'darwin' ? execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim() : null }, gpu: hardware.gpu, warmupMs, combatActions: actionCount - countAtStart, methodology: 'requestAnimationFrame intervals around actual Three.js renders during UI combat/restarts. Mean FPS = frames / sum(dt); 1% low = 1000 / mean(slowest ceil(1% frames) dt). Entire 1920×1080 browser viewport, DPR=1; canvas dimensions recorded separately. Foreground tab required. No extrapolation to other devices.', ...result, memory, bundle: { totalBytes: sizes.reduce((n, f) => n + f.bytes, 0), files: sizes }, errors, consoleMessages };
  report.passed = report.averageFps >= 60 && !report.invalidHiddenTab && report.bundle.totalBytes < 30000000 && errors.length === 0;
  await writeFile(new URL('performance.json', out), JSON.stringify(report, null, 2));
  const { frameTimesMs, gpu, ...summary } = report;
  await writeFile(new URL('performance-summary.json', out), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  assert.equal(report.passed, true, 'Performance target not met; inspect performance.json');
} finally { await browser.close(); }
