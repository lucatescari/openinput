#!/usr/bin/env node
/**
 * Tag and push a stable release.
 * GitHub Actions handles the build and release.
 *
 * Reads the version from package.json (set it before running).
 *
 * Usage:
 *   # 1. Set version in package.json  (e.g. "1.3.1")
 *   # 2. Run:
 *   bun run release
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const runQuiet = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim();
const tagExists = (t) => {
  try { runQuiet(`git rev-parse ${t}`); return true; } catch { return false; }
};

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;
const tag = `v${version}`;

if (version.includes('-')) {
  console.error(`\n  ✗ Version "${version}" looks like a prerelease. Use release:beta instead.\n`);
  process.exit(1);
}

if (tagExists(tag)) {
  console.error(`\n  ✗ Tag ${tag} already exists.\n`);
  process.exit(1);
}

console.log(`\n  Releasing ${tag}\n`);

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
