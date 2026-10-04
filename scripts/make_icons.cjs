// Renders frontend/public/icon.svg into the PNG icons the install prompt and iOS home screen need.
// Usage: node scripts/make_icons.cjs   (needs Playwright with Chromium; see the README)
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', 'frontend', 'public');
const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
const targets = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const [file, size] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(pub, file), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log('wrote', file);
  }
  await browser.close();
})();
