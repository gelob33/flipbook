#!/usr/bin/env node
// visual show me CLI — uses headless Chrome/Edge so checks run the real player, not a copy of it.
//
//   node tools/vsm.mjs check <spec> [--all]
//       Loads every scenario; fails with the player's error message if the spec is broken.
//       Screenshots the first and last step of each scenario (--all: every step).
//   node tools/vsm.mjs open <spec> [--scenario N] [--step N]
//       Opens the visualisation in Chrome/Edge.
//
// Set CHROME=/path/to/browser if it isn't found automatically.
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYER = pathToFileURL(join(ROOT, 'runtime', 'player.html')).href;
const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
function browser() {
  return BROWSERS.find((p) => existsSync(p)) || fail('No Chrome/Edge found. Set CHROME=/path/to/browser.');
}
const url = (spec, query = {}) => `${PLAYER}?${new URLSearchParams({ spec, ...query })}`;

// run one headless browser call with a throwaway profile (avoids profile-lock hangs)
function headless(args, target) {
  const profile = mkdtempSync(join(tmpdir(), 'vsm-chrome-'));
  try {
    const r = spawnSync(browser(), [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`,
      '--virtual-time-budget=6000', ...args, target,
    ], { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
    if (r.error) fail(`Browser failed: ${r.error.message}`);
    return r.stdout;
  } finally {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* temp dir, ignore */ }
  }
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// what the player rendered: its error, or the title / scenario count / step count
function inspect(spec, scenario) {
  const dom = headless(['--dump-dom'], url(spec, { scenario, step: 1 }));
  const error = dom.match(/class="panel sticker error">([^<]*)</);
  if (error) return { error: unescape(error[1]) };
  const steps = dom.match(/step \d+ \/ (\d+)/);
  if (!steps) return { error: 'Player did not render (no step counter found). Is the spec file valid JavaScript?' };
  return {
    title: unescape((dom.match(/<h1 id="title">([^<]*)</) || [])[1] || ''),
    scenarios: (dom.match(/class="btn small/g) || []).length || 1,
    steps: Number(steps[1]),
  };
}

function check(spec, all) {
  // links to lower levels (flow nodes' `opens`) must point at real specs
  const src = readFileSync(join(ROOT, 'specs', `${spec}.js`), 'utf8');
  for (const [, child] of src.matchAll(/\bopens:\s*["'`]([^"'`]+)["'`]/g)) {
    if (!/^[\w-]+$/.test(child) || !existsSync(join(ROOT, 'specs', `${child}.js`))) {
      fail(`✗ ${spec}: opens "${child}", but specs/${child}.js does not exist`);
    }
  }
  const first = inspect(spec, 1);
  if (first.error) fail(`✗ ${spec}: ${first.error}`);
  const out = join(tmpdir(), 'vsm-snaps', spec);
  mkdirSync(out, { recursive: true });
  const shots = [];
  const counts = [];
  for (let sc = 1; sc <= first.scenarios; sc++) {
    const info = sc === 1 ? first : inspect(spec, sc);
    if (info.error) fail(`✗ ${spec}, scenario ${sc}: ${info.error}`);
    counts.push(info.steps);
    const steps = all ? Array.from({ length: info.steps }, (_, i) => i + 1) : [...new Set([1, info.steps])];
    for (const step of steps) {
      const file = join(out, `s${sc}-step${String(step).padStart(2, '0')}.png`);
      headless(['--window-size=1500,1050', `--screenshot=${file}`], url(spec, { scenario: sc, step }));
      if (!existsSync(file)) fail(`✗ screenshot failed: ${file}`);
      shots.push(file);
    }
  }
  console.log(`✓ ${spec}: "${first.title}" — ${first.scenarios} scenario(s), steps: ${counts.join(', ')}`);
  console.log('Screenshots:');
  for (const s of shots) console.log(`  ${s}`);
}

function open(spec, query) {
  spawn(browser(), [url(spec, query)], { detached: true, stdio: 'ignore' }).unref();
  console.log(`Opened ${url(spec, query)}`);
}

// ---------- main ----------
const [cmd, spec, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i < 0 ? undefined : rest[i + 1];
};
if (!cmd || !spec || !['check', 'open'].includes(cmd)) {
  fail('usage: node tools/vsm.mjs check <spec> [--all]\n       node tools/vsm.mjs open <spec> [--scenario N] [--step N]');
}
if (!/^[\w-]+$/.test(spec)) fail(`Bad spec name "${spec}" (letters, digits, - and _ only).`);
if (!existsSync(join(ROOT, 'specs', `${spec}.js`))) fail(`No such spec: specs/${spec}.js`);

if (cmd === 'check') check(spec, rest.includes('--all'));
else {
  const query = {};
  if (flag('scenario')) query.scenario = flag('scenario');
  if (flag('step')) query.step = flag('step');
  open(spec, query);
}
