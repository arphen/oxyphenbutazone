// End-to-end check of the in-app QR scanner in real Chromium with a FAKE camera that plays a y4m video of a QR code.
// Run by `npm run e2e` (it needs the built site served; E2E_BASE points at it). Writes QR videos to a temp dir.
// Exits non-zero if any check fails. The fake camera supplies a clean, centred QR: real focus/glare is not covered.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { encodeSignal } from '../src/net/signal.js';
import { launch as launchChromium, BASE } from './lib.mjs';

const APP = BASE;
const dir = mkdtempSync(join(tmpdir(), 'qrcam-'));

// ---- QR -> y4m (I420, 640x480, 10 frames, black modules on white, centred)
function writeY4m(path, text) {
  const W = 640;
  const H = 480;
  const FRAMES = 10;
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const size = qr.modules.size;
  const margin = 4;
  const scale = Math.max(1, Math.floor(Math.min(W, H) / (size + margin * 2)));
  const offX = Math.floor((W - (size + margin * 2) * scale) / 2);
  const offY = Math.floor((H - (size + margin * 2) * scale) / 2);
  const Y = Buffer.alloc(W * H, 255);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!qr.modules.get(r, c)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) Y[(offY + (r + margin) * scale + dy) * W + offX + (c + margin) * scale + dx] = 0;
      }
    }
  }
  const chroma = Buffer.alloc((W * H) / 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Y, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(path, Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]));
  return { version: qr.version, scale };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
};

const launch = (video) =>
  launchChromium(['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${video}`]);

// Track every MediaStreamTrack the page obtains so we can see that they are stopped afterwards.
const trackSpy = () => {
  window.__tracks = [];
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__constraints = constraints;
    const stream = await original(constraints);
    window.__tracks.push(...stream.getTracks());
    return stream;
  };
};
const liveTracks = (page) => page.evaluate(() => window.__tracks.filter((t) => t.readyState === 'live').length);

const sdp = (role) =>
  ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:abcd', `a=setup:${role}`, 'a=mid:0', ''].join('\r\n');

// ================= 1. Join page: scan a (static) invite link -> invite box filled
{
  const token = await encodeSignal({ t: 'offer', sdp: sdp('actpass'), room: 'abc123xy', seat: 2 });
  const link = `${APP}/#/join?c=${token}`;
  const video = join(dir, 'invite.y4m');
  const info = writeY4m(video, link);
  const browser = await launch(video);
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(trackSpy);
  await page.goto(`${APP}/?mode=local#/join`);
  await page.getByRole('button', { name: /Scan the host's invite/ }).click();
  await page.waitForSelector('.scanner video');
  await page.waitForSelector('.scanner', { state: 'detached', timeout: 20000 }).catch(() => {});
  check('camera requested with facingMode environment', (await page.evaluate(() => window.__constraints?.video?.facingMode)) === 'environment');
  const value = await page.locator('textarea.paste').inputValue();
  check('Join: scanned invite link fills the invite box', value === link, `QR v${info.version}, ${link.length} chars`);
  check('Join: camera tracks stopped after scan', (await liveTracks(page)) === 0);
  await browser.close();
}

// ================= 2. non-game QR -> friendly notice, stays open; Cancel stops the camera
{
  const video = join(dir, 'junk.y4m');
  writeY4m(video, 'https://example.com/not-a-game');
  const browser = await launch(video);
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(trackSpy);
  await page.goto(`${APP}/?mode=local#/join`);
  await page.getByRole('button', { name: /Scan the host's invite/ }).click();
  await page.getByText('That QR is not a game code', { exact: false }).waitFor({ timeout: 20000 });
  check('junk QR shows "That QR is not a game code"', true);
  check('scanner still open after junk QR', await page.locator('.scanner').isVisible());
  check('camera live while scanning', (await liveTracks(page)) > 0);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForSelector('.scanner', { state: 'detached' });
  check('Cancel closes the modal and stops all tracks', (await liveTracks(page)) === 0);
  check('Cancel leaves the invite box empty', (await page.locator('textarea.paste').inputValue()) === '');
  await browser.close();
}

// ================= 3. camera denied -> message tells the user to paste
{
  const browser = await launchChromium();
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  });
  await page.goto(`${APP}/?mode=local#/join`);
  await page.getByRole('button', { name: /Scan the host's invite/ }).click();
  const text = await page.locator('.scanner-problem').innerText();
  check('denied camera shows a paste-instead message', /denied/i.test(text) && /paste/i.test(text), JSON.stringify(text));
  await page.getByRole('button', { name: 'Cancel' }).click();
  await browser.close();
}

// ================= 4. full pairing: host invite -> guest scans -> guest answer -> host scans -> auto-connect
{
  const hostVideo = join(dir, 'host-cam.y4m');
  const guestVideo = join(dir, 'guest-cam.y4m');
  writeY4m(hostVideo, 'placeholder');
  writeY4m(guestVideo, 'placeholder');
  const hostBrowser = await launch(hostVideo);
  const guestBrowser = await launch(guestVideo);
  const host = await (await hostBrowser.newContext()).newPage();
  const guest = await (await guestBrowser.newContext()).newPage();
  await host.addInitScript(trackSpy);
  await guest.addInitScript(trackSpy);

  await host.goto(`${APP}/?mode=local#/host`);
  await host.getByRole('button', { name: 'Start hosting' }).click();
  await host.getByRole('button', { name: /Invite player 2/ }).click();
  await host.waitForSelector('textarea.signal-text');
  const invite = await host.locator('textarea.signal-text').inputValue();
  const inviteLink = `${APP}/#/join?c=${invite}`;

  // the guest's camera shows the same QR the host displays (link form), rewritten before the scanner opens
  const hostQr = writeY4m(guestVideo, inviteLink);
  await guest.goto(`${APP}/?mode=local#/join`);
  await guest.getByRole('button', { name: /Scan the host's invite/ }).click();
  await guest.waitForSelector('.scanner', { state: 'detached', timeout: 20000 });
  const filled = await guest.locator('textarea.paste').inputValue();
  check('pairing: guest scan of the host QR fills the invite box', filled.includes(invite), `QR v${hostQr.version}`);
  await guest.getByRole('button', { name: 'Join' }).click();
  await guest.waitForSelector('textarea.signal-text', { timeout: 20000 });
  const answer = await guest.locator('textarea.signal-text').inputValue();
  check('pairing: guest produced an answer after tapping Join', /^OXY[12]\./.test(answer));

  const ansQr = writeY4m(hostVideo, answer);
  await host.getByRole('button', { name: /Scan their answer/ }).click();
  await host.waitForSelector('.scanner', { state: 'detached', timeout: 20000 });
  const pasted = await host.locator('textarea.paste').inputValue().catch(() => '');
  const connected = await host.getByText('Connected').first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  check('pairing: host scan of the answer QR fills the answer and connects automatically', connected, `QR v${ansQr.version}; answer box ${pasted === answer ? 'filled' : 'not filled'}; connected=${connected}`);
  check('pairing: host camera stopped', (await liveTracks(host)) === 0);
  await hostBrowser.close();
  await guestBrowser.close();
}

console.log(`${results.filter((r) => r.ok).length}/${results.length} checks passed`);
