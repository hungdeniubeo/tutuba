import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { openBrowser, inspect, action, restart, cellClick, baseUrl } from './browser-helpers.mjs';
const out = new URL('../docs/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const plans = JSON.parse(await readFile(new URL('victory-plans.json', out), 'utf8'));
const { browser, page, errors, consoleMessages } = await openBrowser();
const steps = []; const started = Date.now();
const snap = async name => page.screenshot({ path: new URL(`${name}.png`, out).pathname });
try {
  await snap('menu');
  await page.locator('#start').click();
  assert.equal((await inspect(page)).state.phase, 'player');
  await page.locator('#help').click(); assert.match(await page.locator('#dialog-title').textContent(), /hai lần/); await page.locator('#close-guide').click();
  const beforeCamera = await page.evaluate(() => window.__TUTUBA__.projectCell({ x: 1, y: 1 }));
  await page.locator('#rotate-left').click(); const afterCamera = await page.evaluate(() => window.__TUTUBA__.projectCell({ x: 1, y: 1 }));
  assert.notEqual(beforeCamera.x, afterCamera.x); await page.locator('#camera-reset').click();
  await action(page, { type: 'strike', cell: { x: 2, y: 3 } });
  let state = (await inspect(page)).state; assert.equal(state.echoes[0].damage, 3);
  await action(page, { type: 'shift', echoId: state.echoes[0].id, cell: { x: 3, y: 3 } });
  state = (await inspect(page)).state; assert.deepEqual(state.echoes[0].cells, [{ x: 3, y: 3 }]); assert.equal(state.echoes[0].dueRound, 2); assert.equal(state.actors.find(a => a.id === 'hero').ap, 0);
  await snap('shift-preview'); steps.push('Guide, camera rotation, canvas strike and occupied-cell Echo shift/deadline verified.');
  await restart(page); await action(page, { type: 'guard' }); await action(page, { type: 'guard' });
  assert.equal((await inspect(page)).state.actors.find(a => a.id === 'hero').shield, 6);
  await restart(page); await action(page, { type: 'end' });
  await action(page, { type: 'push', cell: { x: 2, y: 3 } });
  assert.deepEqual((await inspect(page)).state.actors.find(a => a.id === '01-bramble').cell, { x: 3, y: 3 });
  await action(page, { type: 'move', cell: { x: 2, y: 3 } });
  assert.match(await page.locator('#echoes').textContent(), /Nguy hiểm/); await snap('friendly-fire-preview');
  await action(page, { type: 'end' });
  assert.equal((await inspect(page)).state.actors.find(a => a.id === 'hero').hp, 21);
  assert.equal((await inspect(page)).state.echoes.length, 0); steps.push('Guard cap, shove, fixed Echo zone, friendly fire and single resolution verified through canvas clicks.');
  await restart(page);
  for (const [index, plan] of plans.entries()) {
    for (const a of plan) await action(page, a);
    const result = await inspect(page); assert.equal(result.state.phase, 'victory'); assert.equal(result.encounterIndex, index);
    await snap(`victory-${index + 1}`); steps.push(`Crossing ${index + 1}: victory after ${plan.length} UI actions, round ${result.state.round}.`);
    if (index < plans.length - 1) { await page.locator('#next-battle').click(); await snap(`combat-${index + 2}`); }
  }
  assert.match(await page.locator('#dialog-title').textContent(), /phá vỡ vòng lặp/);
  await page.locator('#restart').click(); assert.equal((await inspect(page)).encounterIndex, 0);
  for (let i = 0; i < 25 && (await inspect(page)).state.phase === 'player'; i++) await action(page, { type: 'end' });
  assert.equal((await inspect(page)).state.phase, 'defeat'); await snap('defeat'); steps.push('Defeat reached by normal End turn actions.');
  await page.locator('#restart').click(); state = (await inspect(page)).state;
  assert.equal(state.round, 1); assert.equal(state.phase, 'player'); assert.equal(state.echoes.length, 0);
  assert.equal(state.actors.find(a => a.id === 'hero').hp, 24); steps.push('Restart after defeat resets HP, AP, round and Echo queue.');
  await page.locator('#pause').click(); await page.locator('#return-menu').click(); assert.equal(await page.locator('#menu').isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#start').click(); await snap('mobile');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); steps.push('390px mobile layout has no horizontal overflow.');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${baseUrl}/?renderer=webgpu`); await page.locator('#start:not([disabled])').waitFor();
  const optionalRenderer = await page.locator('#renderer-label').textContent();
  await page.locator('#start').click(); await action(page, { type: 'move', cell: { x: 1, y: 2 } }); await snap('optional-renderer');
  steps.push(`Opt-in renderer opened and accepted movement: ${optionalRenderer}.`);
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), status: 'PASS', url: baseUrl, browser: browser.version(), viewport: '1920×1080, deviceScaleFactor 1', wallSeconds: (Date.now() - started) / 1000, steps, errors, consoleMessages, note: 'Automated mouse playthrough validates functionality, not first-time human pacing.' };
  await writeFile(new URL('browser-verification.json', out), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await snap('browser-failure'); await writeFile(new URL('browser-failure.json', out), JSON.stringify({ error: String(error), steps, errors, consoleMessages, state: await inspect(page) }, null, 2)); throw error;
} finally { await browser.close(); }
