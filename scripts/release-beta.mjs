#!/usr/bin/env node
/**
 * Bump version → commit → tag → push.
 * GitHub Actions handles the build and release.
 *
 * Usage:
 *   bun run release:beta          # auto-increment: 0.5.0-beta.1 → 0.5.0-beta.2
 *   bun run release:beta 0.6.0    # start new series: → 0.6.0-beta.1
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const runQuiet = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim();
const tagExists = (t) => {
  try { runQuiet(`git rev-parse ${t}`); return true; } catch { return false; }
};

// ── Resolve the next version ────────────────────────────────────────

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const current = pkg.version;
const targetBase = process.argv[2];

let base;
let betaNum;

if (targetBase) {
  if (targetBase.includes('-')) {
    console.error('  ✗ Pass a clean version like 0.3.0, not a prerelease.');
    process.exit(1);
  }
  base = targetBase;
  betaNum = 1;
} else if (current.includes('-beta.')) {
  const [b, bp] = current.split('-beta.');
  base = b;
  betaNum = parseInt(bp, 10) + 1;
} else {
  base = current;
  betaNum = 1;
}

// Skip past any tags that already exist
let next = `${base}-beta.${betaNum}`;
while (tagExists(`v${next}`)) {
  console.log(`  ⚠ Tag v${next} already exists — skipping`);
  betaNum++;
  next = `${base}-beta.${betaNum}`;
}

const tag = `v${next}`;
console.log(`\n  ${current}  →  ${next}\n`);

// ── Bump version ────────────────────────────────────────────────────

pkg.version = next;
writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ Version bumped\n');

// ── Commit, tag, push ───────────────────────────────────────────────

console.log('  Committing and pushing...');
run('git add -A');
try {
  run(`git commit -m "release: ${tag}"`);
} catch {
  console.log('  (nothing to commit — tree already clean)');
}

run(`git tag -a ${tag} -m "${tag}"`);

try { run('git push'); } catch { console.log('  (push: already up to date)'); }
try { run('git push --tags'); } catch { console.log('  (push tags: already up to date)'); }

console.log(`\n  ✓ Tagged ${tag} and pushed`);
console.log(`  → GitHub Actions will build and release automatically`);
console.log(`  → https://github.com/lucatescari/openinput/actions\n`);
