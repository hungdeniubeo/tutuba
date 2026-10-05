import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
export const baseUrl = process.env.TUTUBA_URL ?? 'http://127.0.0.1:4173';
export function executable() {
  const candidates = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  const path = candidates.find(p => p && existsSync(p));
  if (!path) throw new Error('Chrome not found. Set CHROME_PATH to an installed Chrome executable.');
  return path;
}
export async function openBrowser({ headed = true } = {}) {
  const browser = await chromium.launch({ executablePath: executable(), headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [], consoleMessages = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`Request failed: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(baseUrl); await page.locator('#start:not([disabled])').waitFor();
  return { browser, context, page, errors, consoleMessages };
}
export const inspect = page => page.evaluate(() => window.__TUTUBA__.inspect());
export async function cellClick(page, cell) {
  const point = await page.evaluate(c => window.__TUTUBA__.projectCell(c), cell);
  await page.mouse.click(point.x, point.y);
}
export async function action(page, a) {
  if (a.type === 'end') await page.locator('#end-turn').click();
  else if (a.type === 'guard') await page.locator('#guard').click();
  else {
    if (a.type === 'shift') await page.locator(`[data-echo="${a.echoId}"]`).click();
    else await page.locator(`#${a.type}`).click();
    await cellClick(page, a.cell);
  }
  const error = await page.locator('#status.error').count();
  if (error) throw new Error(`Rejected browser action ${JSON.stringify(a)}: ${await page.locator('#status').textContent()}`);
}
export async function restart(page) { await page.locator('#pause').click(); await page.locator('#restart').click(); }
