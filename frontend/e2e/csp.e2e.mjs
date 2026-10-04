import { launch, newPage, ok, assert, run, BASE } from './lib.mjs';

// The production build's Content-Security-Policy really refuses injected scripts and foreign requests.
run(async () => {
  const browser = await launch();
  const { page } = await newPage(browser);
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto(BASE + '/#/');
  await page.waitForTimeout(1000);

  // what a successful injection would try: an inline script that sets a flag, an inline handler, a foreign request
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = 1';
    document.head.appendChild(s);
  });
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<img src=x onerror="window.__pwned2=1">'));
  const cross = await page.evaluate(async () => {
    try {
      await fetch('https://example.org/');
      return 'allowed';
    } catch {
      return 'blocked';
    }
  });
  await page.waitForTimeout(500);
  const flags = await page.evaluate(() => [window.__pwned, window.__pwned2]);

  assert.notEqual(flags[0], 1); ok('injected inline <script> did not run');
  assert.notEqual(flags[1], 1); ok('injected onerror handler did not run');
  assert.equal(cross, 'blocked'); ok('fetch to another origin is blocked');
  assert.ok(logs.some((l) => /Content Security Policy|Refused/i.test(l))); ok('the browser reported the violations');
  await browser.close();
});
