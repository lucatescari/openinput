#!/usr/bin/env node
/**
 * Build and release a beta version locally.
 *
 * Bumps version → builds Angular + Electron + electron-builder →
 * commits + tags + pushes → creates GitHub prerelease with artifacts.
 *
 * Usage:
 *   bun run release:beta          # auto-increment: 0.2.0-beta.1 → 0.2.0-beta.2
 *   bun run release:beta 0.3.0    # start new series: → 0.3.0-beta.1
 *
 * Requires: gh CLI (brew install gh) authenticated with `gh auth login`.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const runQuiet = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim();
const tagExists = (t) => {
  try { runQuiet(`git rev-parse ${t}`); return true; } catch { return false; }
};

// ── Preflight ───────────────────────────────────────────────────────

try {
  execSync('gh auth status', { stdio: 'ignore' });
} catch {
  console.error('\n  ✗ gh CLI is not authenticated. Run `gh auth login` first.\n');
  process.exit(1);
}

// ── Resolve the next version ────────────────────────────────────────

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const current = pkg.version;
const targetBase = process.argv[2]; // optional: e.g. "0.3.0"

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

// Skip past any tags that already exist (from previous failed runs)
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

// ── Build ───────────────────────────────────────────────────────────

try {
  console.log('  Building Angular...');
  run('bun run build:prod');

  console.log('\n  Compiling Electron...');
  run('bun run electron:compile');

  console.log('\n  Packaging with electron-builder (mac + win)...');
  run('npx electron-builder --mac --win');
} catch {
  console.error('\n  ✗ Build failed — reverting version bump.');
  pkg.version = current;
  writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
  process.exit(1);
}

console.log('\n  ✓ Build complete\n');

// ── Commit, tag, push ───────────────────────────────────────────────

console.log('  Committing and pushing...');
run('git add -A');
// Commit only if there are staged changes (tree may already be clean)
try {
  run(`git commit -m "release: ${tag}"`);
} catch {
  console.log('  (nothing to commit — tree already clean)');
}

// Create annotated tag (safe — we already skipped existing tags above)
run(`git tag -a ${tag} -m "${tag}"`);

// Push — tolerate "already up to date"
try { run('git push'); } catch { console.log('  (push: already up to date)'); }
try { run('git push --tags'); } catch { console.log('  (push tags: already up to date)'); }
console.log('  ✓ Pushed\n');

// ── Create GitHub release ───────────────────────────────────────────

const releaseDir = './release';
const artifacts = readdirSync(releaseDir)
  .filter((f) => /\.(dmg|zip|exe|AppImage|deb|rpm|yml)$/i.test(f))
  .map((f) => join(releaseDir, f));

if (artifacts.length === 0) {
  console.error('  ⚠ No artifacts found in release/ — skipping GitHub release.');
  process.exit(0);
}

console.log(`  Uploading ${artifacts.length} artifact(s):`);
artifacts.forEach((a) => console.log(`    • ${a}`));

const assetArgs = artifacts.map((a) => `"${a}"`).join(' ');

// Delete any stale GitHub release for this tag (from a previous partial run)
try {
  runQuiet(`gh release view ${tag}`);
  console.log(`  ⚠ GitHub release ${tag} already exists — deleting it first`);
  run(`gh release delete ${tag} --yes`);
} catch { /* no existing release — fine */ }

run(
  `gh release create ${tag} --prerelease --title "OpenInput ${tag}" --generate-notes ${assetArgs}`,
);

console.log(`\n  ✓ Released ${tag}`);
console.log(
  `  → https://github.com/lucatescari/openinput/releases/tag/${tag}\n`,
);
