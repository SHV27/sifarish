// Pre-commit gate (Claude Code PreToolUse hook): secret-guard + tsc + gates before any commit.
// Reads the hook JSON on stdin; acts only when the command is a git commit. Exit 2 blocks.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

let cmd = '';
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  cmd = String(input?.tool_input?.command ?? '');
} catch {
  process.exit(0); // no parseable hook payload → not our case
}
if (!/git\s+(commit|add)\b/.test(cmd)) process.exit(0);

// 1 · SECRET-GUARD (always, fast): staged additions must carry no known key shapes (D108 law).
const diff = spawnSync('git', ['diff', '--cached', '-U0'], { encoding: 'utf8' }).stdout || '';
const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
const KEY_SHAPES = [
  /gsk_[A-Za-z0-9]{20,}/,            // Groq
  /AIza[0-9A-Za-z_-]{30,}/,          // Google API
  /vcp_[A-Za-z0-9]{10,}/,            // Vercel token
  /ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{24,}/,             // OpenAI-style
  /vercel_blob_rw_[A-Za-z0-9_]{10,}/,
  /tvly-[A-Za-z0-9-]{10,}/,          // Tavily
  /\bak_[a-z0-9]{20,}\b/,            // OpenWeb Ninja
];
const hits = added.filter((l) => KEY_SHAPES.some((p) => p.test(l)));
if (hits.length) {
  console.error(
    `SECRET-GUARD: ${hits.length} staged line(s) match known key shapes. ` +
      'Secrets live in env only (CLAUDE.md Iron rules / D108). Unstage before committing.'
  );
  process.exit(2);
}

// Only full gates on the commit itself (adds stay cheap).
if (!/git\s+commit\b/.test(cmd)) process.exit(0);
if (process.env.SIFARISH_SKIP_GATE === '1') process.exit(0); // documented escape hatch

// 2 · Types
const tsc = spawnSync('npx', ['tsc', '-b'], { encoding: 'utf8', shell: true });
if (tsc.status !== 0) {
  console.error('GATE: tsc failed — fix types before committing.\n' + (tsc.stdout || '') + (tsc.stderr || ''));
  process.exit(2);
}
// 3 · Gate suite
const vt = spawnSync('npx', ['vitest', 'run', '--reporter=dot'], { encoding: 'utf8', shell: true });
if (vt.status !== 0) {
  console.error('GATE: vitest failed — a red suite never commits.\n' + (vt.stdout || '').slice(-4000));
  process.exit(2);
}
process.exit(0);
