// Shared helpers for the browser end-to-end suites (see README.md in this folder).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

export { assert };

export const BASE = process.env.E2E_BASE || 'http://localhost:4173';
export const ok = (message) => console.log('  ✓', message);
export const heading = (message) => console.log(message);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CANDIDATES = [process.env.CHROMIUM, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];

export function launch(extraArgs = []) {
  const executablePath = CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!executablePath) throw new Error('No Chromium found. Set CHROMIUM=/path/to/chromium.');
  return chromium.launch({ executablePath, args: ['--no-sandbox', ...extraArgs] });
}

/** A page that records page errors and Content-Security-Policy violations in `page.errs`. */
export async function newPage(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) page.errs.push('CSP: ' + m.text().slice(0, 160));
  });
  return { context, page };
}

/** Call the app's own /api from inside the page (answered by the local engine or the laptop server). */
export const api = (page, path, body) =>
  page.evaluate(
    async ([path, body]) =>
      (await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json(),
    [path, body]
  );

export const noPageErrors = (pages, label = 'page') => {
  for (const page of [].concat(pages)) assert.equal(page.errs.length, 0, `${label} errors: ${page.errs.join(' | ')}`);
  ok('no page errors or CSP violations');
};

export async function run(main) {
  try {
    await main();
    console.log('\nPASSED');
  } catch (error) {
    console.error('\nFAILED:', String(error.message || error).split('\n').slice(0, 8).join('\n'));
    process.exit(1);
  }
}
