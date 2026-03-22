import sharp from 'sharp';
import { app } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import type { ActionConfig } from '../../shared/types/action.types';
import type { IconStyle } from '../../shared/types/profile.types';

const execFileAsync = promisify(execFile);

const KEY_WIDTH = 112;
const KEY_HEIGHT = 112;

const DEFAULT_BG = '#1a1625';
const DEFAULT_ACCENT = '#a78bfa';

// ---------------------------------------------------------------------------
// Lucide icon loader
// ---------------------------------------------------------------------------

// Resolve lucide-static icons dir relative to the package location
const LUCIDE_DIR = path.join(
  path.dirname(require.resolve('lucide-static/package.json')),
  'icons',
);

/** Cache loaded SVG inner content so we only read once per icon */
const svgCache = new Map<string, string>();

/**
 * Read a Lucide icon SVG and return the inner elements (paths, circles, etc.)
 * with stroke/fill attributes stripped so we can re-color them.
 */
function loadLucideIcon(name: string): string {
  const cached = svgCache.get(name);
  if (cached) return cached;

  const filePath = path.join(LUCIDE_DIR, `${name}.svg`);
  if (!fs.existsSync(filePath)) return '';

  const raw = fs.readFileSync(filePath, 'utf-8');
  // Extract everything between <svg ...> and </svg>
  const inner = raw
    .replace(/<!--[\s\S]*?-->/g, '') // strip comments
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .trim();

  svgCache.set(name, inner);
  return inner;
}

// ---------------------------------------------------------------------------
// Action type → Lucide icon name mapping
// ---------------------------------------------------------------------------

const ACTION_ICON_MAP: Record<string, string> = {
  hotkey: 'keyboard',
  hotkey_switch: 'toggle-left',
  open_url: 'globe',
  launch_app: 'app-window',
  close_app: 'x-circle',
  open_file: 'file-text',
  text: 'type',
  multi_action: 'layers',
  system: 'sun',
  folder: 'folder',
  page_next: 'chevron-right',
  page_previous: 'chevron-left',
  page_goto: 'hash',
};

const MEDIA_ICON_MAP: Record<string, string> = {
  play_pause: 'play',
  next_track: 'skip-forward',
  prev_track: 'skip-back',
  volume_up: 'volume-2',
  volume_down: 'volume-1',
  mute: 'volume-x',
};

const SYSTEM_ICON_MAP: Record<string, string> = {
  brightness_up: 'sun',
  brightness_down: 'sun-dim',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a styled back-button icon for folder navigation.
 * Uses the `arrow-left` Lucide icon with a label. Returns a raw PNG buffer.
 */
export async function generateBackButtonIcon(
  width = KEY_WIDTH,
  height = KEY_HEIGHT,
): Promise<Buffer> {
  const bg = '#1e1e2e';
  const accent = '#94a3b8'; // slate-400 — subtle but visible

  const inner = loadLucideIcon('arrow-left');

  const refSize = Math.min(width, height);
  const iconSize = Math.round(refSize * 0.40);
  const iconX = Math.round((width - iconSize) / 2);
  const iconY = Math.round(height * 0.12);
  const textY = Math.round(height * 0.88);
  const fontSize = Math.round(refSize * 0.12);
  const cx = width / 2;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bg}" rx="8"/>
  <g transform="translate(${iconX}, ${iconY}) scale(${(iconSize / 24).toFixed(4)})"
     stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${inner}
  </g>
  <text x="${cx}" y="${textY}" font-family="Arial,sans-serif" font-size="${fontSize}"
    fill="${accent}" text-anchor="middle" font-weight="600">Back</text>
</svg>`;

  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

/**
 * Generate an icon image for an action.
 * Returns a raw PNG buffer (unrotated) that can be fed into processKeyImage.
 * Optionally composites a title text overlay on the icon.
 */
export async function generateActionIcon(
  action: ActionConfig,
  width = KEY_WIDTH,
  height = KEY_HEIGHT,
  style?: IconStyle,
  title?: string,
): Promise<Buffer> {
  const bg = style?.bgColor ?? DEFAULT_BG;
  const accent = style?.accentColor ?? DEFAULT_ACCENT;

  // For launch_app or close_app, try to extract the actual app icon first
  if ((action.type === 'launch_app' || action.type === 'close_app') && action.appPath) {
    const appIcon = await extractAppIcon(action.appPath, width, height, bg);
    if (appIcon) {
      if (title) {
        return compositeTitle(appIcon, width, height, title, accent);
      }
      return appIcon;
    }
  }

  // When a title is provided, use it as the label in the SVG directly
  // instead of compositing a second text overlay on top.
  const svg = buildActionSvg(action, width, height, bg, accent, title);
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

/**
 * Composite a title text overlay at the bottom of an icon image.
 */
async function compositeTitle(
  baseImage: Buffer,
  width: number,
  height: number,
  title: string,
  color: string,
): Promise<Buffer> {
  const fontSize = Math.round(width * 0.11);
  const padding = Math.round(width * 0.05);
  const textY = height - padding;
  const escaped = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const truncated = escaped.length > 14 ? escaped.slice(0, 13) + '\u2026' : escaped;

  const overlaySvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${textY - fontSize - 2}" width="${width}" height="${fontSize + padding + 4}" fill="rgba(0,0,0,0.6)" />
    <text x="${width / 2}" y="${textY}" font-family="Arial,sans-serif" font-size="${fontSize}"
      fill="${color}" text-anchor="middle" font-weight="600">${truncated}</text>
  </svg>`;

  return sharp(baseImage)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// App icon extraction (unchanged)
// ---------------------------------------------------------------------------

async function extractAppIcon(
  appPath: string,
  width: number,
  height: number,
  bgColor: string,
): Promise<Buffer | null> {
  // Guard: skip native icon extraction for invalid or non-existent paths
  if (!appPath || !fs.existsSync(appPath)) {
    return null;
  }

  if (process.platform !== 'darwin' || !appPath.endsWith('.app')) {
    return extractFileIcon(appPath, width, height, bgColor);
  }

  try {
    const plistPath = path.join(appPath, 'Contents', 'Info.plist');
    if (!fs.existsSync(plistPath)) return extractFileIcon(appPath, width, height, bgColor);

    const { stdout: plistJson } = await execFileAsync('/usr/bin/plutil', [
      '-convert', 'json', '-o', '-', plistPath,
    ]);
    const plist = JSON.parse(plistJson);
    let iconName: string | undefined =
      plist.CFBundleIconFile || plist.CFBundleIconName;

    if (!iconName) return extractFileIcon(appPath, width, height, bgColor);
    if (!iconName.endsWith('.icns')) iconName += '.icns';

    const icnsPath = path.join(appPath, 'Contents', 'Resources', iconName);
    if (!fs.existsSync(icnsPath)) return extractFileIcon(appPath, width, height, bgColor);

    const tmpPng = path.join(
      app.getPath('temp'),
      `openinput_icon_${Date.now()}.png`,
    );
    await execFileAsync('/usr/bin/sips', [
      '-s', 'format', 'png',
      icnsPath,
      '--out', tmpPng,
      '--resampleWidth', '256',
    ]);

    const pngBuffer = fs.readFileSync(tmpPng);
    fs.unlinkSync(tmpPng);

    return compositeIconOnBackground(pngBuffer, width, height, bgColor);
  } catch {
    return extractFileIcon(appPath, width, height, bgColor);
  }
}

async function extractFileIcon(
  filePath: string,
  width: number,
  height: number,
  bgColor: string,
): Promise<Buffer | null> {
  // Guard: skip for invalid or non-existent paths
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    const pngBuffer = icon.toPNG();
    if (pngBuffer.length === 0) return null;
    return compositeIconOnBackground(pngBuffer, width, height, bgColor);
  } catch {
    return null;
  }
}

async function compositeIconOnBackground(
  iconPng: Buffer,
  width: number,
  height: number,
  bgColor: string,
): Promise<Buffer> {
  const iconSize = Math.round(Math.min(width, height) * 0.65);
  // Center independently on each axis so landscape canvases look correct
  const leftOffset = Math.round((width - iconSize) / 2);
  const topOffset = Math.round((height - iconSize) / 2) - 2;

  const bgSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bgColor}" rx="8"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg)).resize(width, height).png().toBuffer();

  const resizedIcon = await sharp(iconPng)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(bg)
    .composite([{ input: resizedIcon, left: leftOffset, top: topOffset }])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// SVG builder using Lucide icons
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text: string, max = 12): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '\u2026';
}

function getLabel(action: ActionConfig): string {
  if (action.label) return action.label;
  switch (action.type) {
    case 'hotkey':
      return '';
    case 'hotkey_switch':
      return 'Toggle';
    case 'open_url':
      return (action.url ?? 'URL').replace(/^https?:\/\//, '').replace(/\/$/, '');
    case 'launch_app':
      return path.basename(action.appPath ?? 'App').replace(/\.(app|exe)$/i, '') || 'App';
    case 'close_app':
      return 'Close ' + (path.basename(action.appPath ?? 'App').replace(/\.(app|exe)$/i, '') || 'App');
    case 'open_file':
      return action.filePath ? path.basename(action.filePath) : 'File';
    case 'text':
      return action.text ? (action.text.length > 10 ? action.text.slice(0, 9) + '\u2026' : action.text) : 'Text';
    case 'media':
      return mediaLabel(action.mediaAction ?? 'play_pause');
    case 'system':
      return action.systemAction === 'brightness_up' ? 'Bright +' : 'Bright \u2212';
    case 'multi_action':
      return 'Multi';
    case 'folder':
      return 'Folder';
    case 'page_next':
      return 'Next Page';
    case 'page_previous':
      return 'Prev Page';
    case 'page_goto':
      return action.pageIndex !== undefined ? `Page ${action.pageIndex + 1}` : 'Go to Page';
    default:
      return '';
  }
}

function mediaLabel(mediaAction: string): string {
  switch (mediaAction) {
    case 'play_pause': return 'Play/Pause';
    case 'next_track': return 'Next';
    case 'prev_track': return 'Previous';
    case 'volume_up': return 'Vol Up';
    case 'volume_down': return 'Vol Down';
    case 'mute': return 'Mute';
    default: return mediaAction;
  }
}

function getIconName(action: ActionConfig): string {
  if (action.type === 'media') {
    return MEDIA_ICON_MAP[action.mediaAction ?? 'play_pause'] ?? 'play';
  }
  if (action.type === 'system') {
    return SYSTEM_ICON_MAP[action.systemAction ?? 'brightness_up'] ?? 'sun';
  }
  return ACTION_ICON_MAP[action.type] ?? 'circle';
}

function buildActionSvg(
  action: ActionConfig,
  w: number,
  h: number,
  bg: string,
  accent: string,
  labelOverride?: string,
): string {
  const iconName = getIconName(action);
  const inner = loadLucideIcon(iconName);
  const label = esc(truncate(labelOverride ?? getLabel(action)));
  const cx = w / 2;

  // Use the smaller dimension as the reference so icons look proportional
  // on both square (112×112) and landscape (176×112) canvases.
  const refSize = Math.min(w, h);

  // Icon sizing — the Lucide icon viewBox is 0 0 24 24
  const iconSize = Math.round(refSize * 0.45);
  const iconX = Math.round((w - iconSize) / 2);  // center horizontally
  const iconY = label
    ? Math.round(h * 0.10)                        // leave room for label
    : Math.round((h - iconSize) / 2);             // vertically center if no label

  // Text position — ensure it doesn't overlap the icon
  const textY = Math.round(h * 0.88);
  const fontSize = Math.round(refSize * 0.11);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${bg}" rx="8"/>
  <g transform="translate(${iconX}, ${iconY}) scale(${(iconSize / 24).toFixed(4)})"
     stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${inner}
  </g>
  ${label ? `<text x="${cx}" y="${textY}" font-family="Arial,sans-serif" font-size="${fontSize}" fill="${accent}" text-anchor="middle" font-weight="600">${label}</text>` : ''}
</svg>`;
}
