#!/usr/bin/env node
/**
 * Generate all app icon variants for OpenInput.
 *
 * Design: 4 rounded squares in a 2×2 grid on a dark background.
 * The top-left square is "selected" (highlighted in brand purple).
 *
 * Outputs:
 *   build/icon.png      — 1024×1024 master (used by electron-builder)
 *   build/icon.icns      — macOS icon (generated via iconutil)
 *   build/icon.ico       — Windows icon (generated from sized PNGs)
 *   src/favicon.png      — 256×256 web favicon
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Brand colors
const BG = '#1a1625';
const SELECTED = '#8b5cf6';
const SELECTED_GLOW = '#a78bfa';
const MUTED = '#2a2438';
const MUTED_BORDER = '#362f4a';

function buildIconSvg(size) {
  const pad = Math.round(size * 0.14);
  const gap = Math.round(size * 0.06);
  const gridSize = size - pad * 2;
  const btnSize = Math.round((gridSize - gap) / 2);
  const r = Math.round(btnSize * 0.18); // button corner radius
  const outerR = Math.round(size * 0.22); // overall icon corner radius

  // Positions
  const x1 = pad;
  const y1 = pad;
  const x2 = pad + btnSize + gap;
  const y2 = pad + btnSize + gap;

  // Glow filter for selected button
  const glowR = Math.round(size * 0.03);

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${glowR}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <clipPath id="outer">
      <rect width="${size}" height="${size}" rx="${outerR}" ry="${outerR}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${outerR}" ry="${outerR}" fill="${BG}"/>

  <g clip-path="url(#outer)">
    <!-- Selected button (top-left) with glow -->
    <rect x="${x1}" y="${y1}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="${SELECTED}" opacity="0.15" filter="url(#glow)"/>
    <rect x="${x1}" y="${y1}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="${SELECTED}" opacity="0.9"/>
    <!-- Subtle inner highlight -->
    <rect x="${x1 + 3}" y="${y1 + 3}" width="${btnSize - 6}" height="${btnSize - 6}" rx="${r - 2}" ry="${r - 2}"
          fill="none" stroke="${SELECTED_GLOW}" stroke-width="2" opacity="0.5"/>

    <!-- Top-right button -->
    <rect x="${x2}" y="${y1}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="${MUTED}"/>
    <rect x="${x2}" y="${y1}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="none" stroke="${MUTED_BORDER}" stroke-width="1.5"/>

    <!-- Bottom-left button -->
    <rect x="${x1}" y="${y2}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="${MUTED}"/>
    <rect x="${x1}" y="${y2}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="none" stroke="${MUTED_BORDER}" stroke-width="1.5"/>

    <!-- Bottom-right button -->
    <rect x="${x2}" y="${y2}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="${MUTED}"/>
    <rect x="${x2}" y="${y2}" width="${btnSize}" height="${btnSize}" rx="${r}" ry="${r}"
          fill="none" stroke="${MUTED_BORDER}" stroke-width="1.5"/>
  </g>
</svg>`;
}

async function main() {
  console.log('Generating OpenInput app icons...\n');

  // Ensure directories
  mkdirSync(join(ROOT, 'build'), { recursive: true });
  mkdirSync(join(ROOT, 'build', 'icons'), { recursive: true });

  // 1. Master 1024×1024 PNG
  const svg1024 = buildIconSvg(1024);
  const masterPng = await sharp(Buffer.from(svg1024))
    .resize(1024, 1024)
    .png()
    .toBuffer();
  writeFileSync(join(ROOT, 'build', 'icon.png'), masterPng);
  console.log('  build/icon.png (1024×1024)');

  // 2. Sized PNGs (used for .ico generation)
  const sizes = [16, 32, 48, 64, 128, 256];
  for (const s of sizes) {
    const svg = buildIconSvg(s);
    const buf = await sharp(Buffer.from(svg)).resize(s, s).png().toBuffer();
    writeFileSync(join(ROOT, 'build', 'icons', `${s}x${s}.png`), buf);
    console.log(`  build/icons/${s}x${s}.png`);
  }

  // 3. Favicon (256×256)
  const svgFav = buildIconSvg(256);
  const faviconBuf = await sharp(Buffer.from(svgFav))
    .resize(256, 256)
    .png()
    .toBuffer();
  writeFileSync(join(ROOT, 'src', 'favicon.png'), faviconBuf);
  console.log('  src/favicon.png (256×256)');

  // 4. macOS .icns via sips + iconutil (macOS only)
  if (process.platform === 'darwin') {
    try {
      const iconsetDir = join(ROOT, 'build', 'icon.iconset');
      mkdirSync(iconsetDir, { recursive: true });

      const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
      for (const s of icnsSizes) {
        const svg = buildIconSvg(s);
        const buf = await sharp(Buffer.from(svg)).resize(s, s).png().toBuffer();
        // Standard name
        if (s <= 512) {
          writeFileSync(join(iconsetDir, `icon_${s}x${s}.png`), buf);
        }
        // @2x retina variant (half-size name)
        if (s >= 32) {
          const half = s / 2;
          writeFileSync(join(iconsetDir, `icon_${half}x${half}@2x.png`), buf);
        }
      }

      execSync(`iconutil -c icns "${iconsetDir}" -o "${join(ROOT, 'build', 'icon.icns')}"`);
      // Clean up iconset directory
      execSync(`rm -rf "${iconsetDir}"`);
      console.log('  build/icon.icns (macOS)');
    } catch (err) {
      console.warn('  [WARN] Could not generate .icns:', err.message);
      console.warn('         You can manually convert build/icon.png to .icns');
    }
  } else {
    console.log('  [SKIP] .icns generation (not macOS)');
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
