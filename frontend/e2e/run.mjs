// Builds the site the way the public deployment does, serves it, runs the browser suites, then runs the
// laptop-host suite against the dev server. Always stops the servers it started.
//   npm run e2e              all suites
//   npm run e2e -- p2p csp   only the named suites
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_TIMEOUT_MS = 4 * 60 * 1000; // a stuck suite fails instead of hanging the whole run
const STATIC_SUITES = ['static', 'ui', 'p2p', 'words', 'scan', 'offline', 'csp', 'oddoneout', 'practice'];
const wanted = process.argv.slice(2);
const want = (name) => wanted.length === 0 || wanted.includes(name);

const servers = [];
const stopAll = () => servers.splice(0).forEach((child) => { try { process.kill(-child.pid); } catch { /* already gone */ } });
process.on('exit', stopAll);
process.on('SIGINT', () => { stopAll(); process.exit(130); });

async function serve(args, env, port) {
  const child = spawn('npx', ['vite', ...args, '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: 'ignore' });
  servers.push(child);
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return `http://localhost:${port}`;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server on ${port} did not start`);
}

function suite(name, base) {
  console.log(`\n━━━ ${name} ━━━`);
  const result = spawnSync('node', [path.join('e2e', `${name}.e2e.mjs`)], { cwd: root, env: { ...process.env, E2E_BASE: base }, stdio: 'inherit', timeout: SUITE_TIMEOUT_MS, killSignal: 'SIGKILL' });
  if (result.error?.code === 'ETIMEDOUT') console.error(`${name}: timed out after ${SUITE_TIMEOUT_MS / 1000}s`);
  return result.status === 0;
}

const results = {};
if (STATIC_SUITES.some(want)) {
  console.log('Building the public-style site (without CSW21/NWL2023)…');
  const build = spawnSync('npx', ['vite', 'build'], { cwd: root, env: { ...process.env, OXY_EXCLUDE_LISTS: 'csw21,nwl2023' }, stdio: 'ignore' });
  if (build.status !== 0) { console.error('Build failed'); process.exit(1); }
  const base = await serve(['preview'], {}, 4173);
  for (const name of STATIC_SUITES.filter(want)) results[name] = suite(name, base);
  stopAll();
}
if (want('laptop')) {
  const base = await serve([], { OXY_TEST: '1' }, 4174);
  results.laptop = suite('laptop', base);
  stopAll();
}

console.log('\n━━━ summary ━━━');
for (const [name, passed] of Object.entries(results)) console.log(`${passed ? '✓' : '✗'} ${name}`);
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
