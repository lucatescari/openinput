import sharp from 'sharp';
import { exec } from 'child_process';
import type { OverlayConfig, OverlayRenderer } from '../../shared/types/overlay.types';
import { hidService } from './hid.service';
import { profileService } from './profile.service';
import { processImage } from './image.service';
const DEFAULT_DURATION = 1500;
const DEFAULT_COLOR = '#a78bfa';
const DEFAULT_BG = '#000000';

const FADE_IN_STEPS  = [0.25, 0.55, 0.85];   // opacity ramp-up
const FADE_OUT_STEPS = [0.6, 0.3, 0.08];      // opacity ramp-down
const FADE_FRAME_MS  = 30;                     // delay between animation frames
const VALUE_FRAME_MS = 20;                     // delay between bar-fill interpolation frames

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Ease-out cubic: fast start, gentle deceleration. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Overlay service ────────────────────────────────────────────────────

class OverlayService {
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private isShowing = false;
  private isFading = false;
  private lastConfig: OverlayConfig | null = null;
  private lastValue: number | null = null;
  private animationId = 0;

  /** Plugin-registered renderers keyed by type */
  private renderers = new Map<string, OverlayRenderer>();

  // ── public API ─────────────────────────────────────────────────────

  /**
   * Register a custom overlay renderer (for third-party plugins).
   */
  registerRenderer(renderer: OverlayRenderer): void {
    this.renderers.set(renderer.type, renderer);
  }

  /**
   * Show an overlay on the device touch zones.
   *
   * If an overlay is already showing, the previous one is cancelled
   * (debounce: fast encoder turns just update the bar).
   * First appearance fades in; subsequent updates push instantly.
   */
  async show(config: OverlayConfig): Promise<void> {
    try {
      // Cancel any pending dismiss
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
      }

      // Cancel any in-progress fade-out so we don't restore mid-show
      this.isFading = false;

      // Unique ID for this call — stale animations check against it
      const animId = ++this.animationId;

      // Resolve dynamic value from system
      const resolved = await this.resolveValue(config);
      this.lastConfig = resolved;

      // Capture the previous value before updating
      const previousValue = this.lastValue;
      this.lastValue = resolved.value ?? null;

      const shouldFadeIn = !this.isShowing;
      this.isShowing = true;

      if (shouldFadeIn) {
        // Fade in with bar filling from 0 → target
        await this.fadeIn(resolved, animId);
      } else if (
        resolved.value !== undefined &&
        previousValue !== null &&
        Math.abs(resolved.value - previousValue) > 2
      ) {
        // Interpolate bar from previous → new value
        await this.animateToValue(resolved, previousValue, animId);
      } else {
        // Small or no-value change — push single frame
        const strip = await this.renderStrip(resolved);
        if (strip && this.animationId === animId) {
          await this.pushToDevice(strip);
        }
      }

      // Schedule auto-dismiss
      const duration = config.duration ?? DEFAULT_DURATION;
      this.dismissTimer = setTimeout(() => {
        this.restore().catch(() => {});
      }, duration);
    } catch (err) {
      console.error('[overlay] Failed to show overlay:', err);
    }
  }

  /**
   * Restore the original touch zone images from the active profile.
   * Fades out the overlay before restoring.
   */
  async restore(): Promise<void> {
    if (!this.isShowing) return;

    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    // Fade out the overlay before restoring profile images
    this.isFading = true;
    await this.fadeOut();

    // If a new show() was called during the fade-out, abort the restore
    if (!this.isFading) return;
    this.isFading = false;
    this.isShowing = false;

    const profile = profileService.getActiveProfile();
    if (!profile) return;

    const layout = hidService.getActiveLayout();
    const protocol = hidService.getActiveProtocol();
    if (!layout?.touchZones || !protocol) return;

    const spec = layout.touchZones.imageSpec;

    for (let i = 0; i < layout.touchZones.count; i++) {
      const outputId = protocol.getOutputId('touchZone', i);
      if (outputId === undefined) continue;

      const zoneConfig = profile.touchZones[i];
      if (zoneConfig?.image) {
        try {
          const { device } = await processImage(zoneConfig.image, spec);
          await hidService.sendImage(outputId, device);
        } catch { /* skip */ }
      } else {
        try {
          const blank = await renderBlankZone(DEFAULT_BG, spec);
          await hidService.sendImage(outputId, blank);
        } catch { /* skip */ }
      }
    }
  }

  // ── Animation ──────────────────────────────────────────────────────

  /**
   * Fade in with bar-fill animation.
   * Opacity ramps up while the progress bar value eases from 0 → target.
   */
  private async fadeIn(config: OverlayConfig, animId: number): Promise<void> {
    const targetValue = config.value;

    for (let i = 0; i < FADE_IN_STEPS.length; i++) {
      if (this.animationId !== animId) return;

      const opacity = FADE_IN_STEPS[i];
      // Ease bar value from 0 → target alongside the opacity ramp
      const t = (i + 1) / (FADE_IN_STEPS.length + 1);
      const frameConfig =
        targetValue !== undefined
          ? { ...config, value: Math.round(targetValue * easeOutCubic(t)) }
          : config;

      const strip = await this.renderStrip(frameConfig);
      if (!strip || this.animationId !== animId) return;

      const faded = await this.applyOpacity(strip, opacity);
      await this.pushToDevice(faded);
      await delay(FADE_FRAME_MS);
    }

    // Final full-opacity, full-value frame
    if (this.animationId !== animId) return;
    const finalStrip = await this.renderStrip(config);
    if (finalStrip) await this.pushToDevice(finalStrip);
  }

  /**
   * Animate the bar fill from previousValue → newValue.
   * Renders 1–2 intermediate frames then the final value.
   * Automatically cancelled if a new show() call arrives.
   */
  private async animateToValue(
    config: OverlayConfig,
    previousValue: number,
    animId: number,
  ): Promise<void> {
    const newValue = config.value!;
    const diff = Math.abs(newValue - previousValue);

    // Pick 1 or 2 intermediate frames depending on how big the jump is
    const steps = diff > 10 ? 2 : 1;

    for (let i = 1; i <= steps; i++) {
      if (this.animationId !== animId) return;
      const t = i / (steps + 1);
      const midValue = Math.round(previousValue + (newValue - previousValue) * t);
      const midConfig = { ...config, value: midValue };
      const strip = await this.renderStrip(midConfig);
      if (strip && this.animationId === animId) {
        await this.pushToDevice(strip);
        await delay(VALUE_FRAME_MS);
      }
    }

    // Final frame at exact target value
    if (this.animationId !== animId) return;
    const finalStrip = await this.renderStrip(config);
    if (finalStrip) await this.pushToDevice(finalStrip);
  }

  /** Fade out: re-render the last overlay at decreasing opacity. */
  private async fadeOut(): Promise<void> {
    if (!this.lastConfig) return;
    const strip = await this.renderStrip(this.lastConfig);
    if (!strip) return;

    for (const opacity of FADE_OUT_STEPS) {
      // A new show() call sets isFading=false to cancel us
      if (!this.isFading) return;
      const faded = await this.applyOpacity(strip, opacity);
      await this.pushToDevice(faded);
      await delay(FADE_FRAME_MS);
    }
  }

  /**
   * Darken a rendered strip to simulate opacity.
   * Composites a semi-transparent black rectangle on top of the image.
   */
  private async applyOpacity(strip: Buffer, opacity: number): Promise<Buffer> {
    if (opacity >= 1) return strip;

    const layout = hidService.getActiveLayout();
    if (!layout?.touchZones) return strip;

    const spec = layout.touchZones.imageSpec;
    const stripW = spec.width * layout.touchZones.count;
    const stripH = spec.height;

    const darken = (1 - opacity).toFixed(2);
    const svg = `<svg width="${stripW}" height="${stripH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black" opacity="${darken}" />
    </svg>`;
    return sharp(strip)
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .png()
      .toBuffer();
  }

  // ── Internals ──────────────────────────────────────────────────────

  /** Resolve `valueSource` to a concrete 0–100 value. */
  private async resolveValue(config: OverlayConfig): Promise<OverlayConfig> {
    if (config.value !== undefined) return config;
    if (!config.valueSource) return config;

    let value = 50; // fallback

    try {
      switch (config.valueSource) {
        case 'volume':
          value = await getSystemVolume();
          break;
        case 'brightness':
          value = await getSystemBrightness();
          break;
      }
    } catch {
      // Use fallback
    }

    return { ...config, value: Math.max(0, Math.min(100, value)) };
  }

  /** Render the full strip image. */
  private async renderStrip(config: OverlayConfig): Promise<Buffer | null> {
    const layout = hidService.getActiveLayout();
    if (!layout?.touchZones) return null;

    const spec = layout.touchZones.imageSpec;
    const stripW = spec.width * layout.touchZones.count;
    const stripH = spec.height;

    // Check for plugin-registered renderer
    const custom = this.renderers.get(config.type);
    if (custom) {
      const result = await custom.render(config);
      return Buffer.from(result);
    }

    // Built-in renderers
    switch (config.type) {
      case 'progress_bar':
        return renderProgressBar(config, stripW, stripH);
      case 'text':
        return renderTextOverlay(config, stripW, stripH);
      default:
        console.warn(`[overlay] Unknown overlay type: ${config.type}`);
        return null;
    }
  }

  /** Split a rendered strip into zones and push each to the device. */
  private async pushToDevice(strip: Buffer): Promise<void> {
    const layout = hidService.getActiveLayout();
    const protocol = hidService.getActiveProtocol();
    if (!layout?.touchZones || !protocol) return;

    const spec = layout.touchZones.imageSpec;
    const zoneW = spec.width;
    const zoneH = spec.height;

    for (let i = 0; i < layout.touchZones.count; i++) {
      const outputId = protocol.getOutputId('touchZone', i);
      if (outputId === undefined) continue;

      let pipeline = sharp(strip)
        .extract({ left: i * zoneW, top: 0, width: zoneW, height: zoneH });

      if (spec.rotation !== 0) {
        pipeline = pipeline.rotate(spec.rotation);
      }

      const zoneBuffer = await pipeline
        .jpeg({ quality: spec.quality ?? 90 })
        .toBuffer();

      await hidService.sendImage(outputId, zoneBuffer);
    }
  }
}

// ── Built-in renderers ────────────────────────────────────────────────

/** Render a progress bar spanning the full touch strip. */
async function renderProgressBar(config: OverlayConfig, stripW: number, stripH: number): Promise<Buffer> {
  const value = config.value ?? 50;
  const color = config.color ?? DEFAULT_COLOR;
  const bg = config.bgColor ?? DEFAULT_BG;
  const label = config.label ?? '';
  const icon = config.icon ?? '';

  const barLeft = 80;
  const barRight = stripW - 60;
  const barW = barRight - barLeft;
  const barH = 20;
  const barY = (stripH - barH) / 2 + 8;
  const fillW = Math.round((value / 100) * barW);
  const barRadius = barH / 2;

  const iconSvg = buildIconSvg(icon || guessIcon(config), 30, color);
  const pctText = `${Math.round(value)}%`;
  const labelEsc = escXml(label);

  const svg = `
    <svg width="${stripW}" height="${stripH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}" />

      <!-- Icon on the left -->
      <g transform="translate(25, ${(stripH - 30) / 2})">
        ${iconSvg}
      </g>

      <!-- Label above bar -->
      ${label ? `
        <text x="${barLeft}" y="${barY - 14}"
              font-family="Arial,sans-serif" font-size="14" font-weight="600"
              fill="${color}" opacity="0.8">${labelEsc}</text>
      ` : ''}

      <!-- Bar track -->
      <rect x="${barLeft}" y="${barY}" width="${barW}" height="${barH}"
            rx="${barRadius}" ry="${barRadius}" fill="white" opacity="0.1" />

      <!-- Bar fill -->
      <rect x="${barLeft}" y="${barY}" width="${Math.max(fillW, barH)}" height="${barH}"
            rx="${barRadius}" ry="${barRadius}" fill="${color}" opacity="0.9" />

      <!-- Percentage -->
      <text x="${barRight + 12}" y="${barY + barH / 2 + 1}"
            font-family="Arial,sans-serif" font-size="16" font-weight="700"
            fill="white" dominant-baseline="central">${pctText}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .resize(stripW, stripH)
    .png()
    .toBuffer();
}

/** Render a full-width text overlay. */
async function renderTextOverlay(config: OverlayConfig, stripW: number, stripH: number): Promise<Buffer> {
  const text = config.text ?? '';
  const color = config.color ?? '#ffffff';
  const bg = config.bgColor ?? DEFAULT_BG;
  const fontSize = config.fontSize ?? 36;

  const escaped = escXml(text);

  const svg = `
    <svg width="${stripW}" height="${stripH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}" />
      <text x="50%" y="50%"
            font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700"
            fill="${color}" text-anchor="middle" dominant-baseline="central">
        ${escaped}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .resize(stripW, stripH)
    .png()
    .toBuffer();
}

/** Render a blank zone image for clearing. */
async function renderBlankZone(bgColor: string, spec: import('../../shared/types/device-plugin.types').ElementImageSpec): Promise<Buffer> {
  const svg = `
    <svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}" />
    </svg>
  `;
  let pipeline = sharp(Buffer.from(svg));
  if (spec.rotation !== 0) {
    pipeline = pipeline.rotate(spec.rotation);
  }
  return pipeline.jpeg({ quality: 80 }).toBuffer();
}

// ── SVG icon helpers ──────────────────────────────────────────────────

function buildIconSvg(iconName: string, size: number, color: string): string {
  const icons: Record<string, string> = {
    'volume-2': `
      <polygon points="${s(11, size)} ${s(5, size)} ${s(6, size)} ${s(9, size)} ${s(2, size)} ${s(9, size)} ${s(2, size)} ${s(15, size)} ${s(6, size)} ${s(15, size)} ${s(11, size)} ${s(19, size)}" fill="${color}" opacity="0.9"/>
      <path d="M${s(15.54, size)} ${s(8.46, size)} a${s(5, size)} ${s(5, size)} 0 0 1 0 ${s(7.07, size)}" fill="none" stroke="${color}" stroke-width="1.5"/>
      <path d="M${s(19.07, size)} ${s(4.93, size)} a${s(10, size)} ${s(10, size)} 0 0 1 0 ${s(14.14, size)}" fill="none" stroke="${color}" stroke-width="1.5"/>
    `,
    'volume-1': `
      <polygon points="${s(11, size)} ${s(5, size)} ${s(6, size)} ${s(9, size)} ${s(2, size)} ${s(9, size)} ${s(2, size)} ${s(15, size)} ${s(6, size)} ${s(15, size)} ${s(11, size)} ${s(19, size)}" fill="${color}" opacity="0.9"/>
      <path d="M${s(15.54, size)} ${s(8.46, size)} a${s(5, size)} ${s(5, size)} 0 0 1 0 ${s(7.07, size)}" fill="none" stroke="${color}" stroke-width="1.5"/>
    `,
    'volume-x': `
      <polygon points="${s(11, size)} ${s(5, size)} ${s(6, size)} ${s(9, size)} ${s(2, size)} ${s(9, size)} ${s(2, size)} ${s(15, size)} ${s(6, size)} ${s(15, size)} ${s(11, size)} ${s(19, size)}" fill="${color}" opacity="0.9"/>
      <line x1="${s(22, size)}" y1="${s(9, size)}" x2="${s(16, size)}" y2="${s(15, size)}" stroke="${color}" stroke-width="1.5"/>
      <line x1="${s(16, size)}" y1="${s(9, size)}" x2="${s(22, size)}" y2="${s(15, size)}" stroke="${color}" stroke-width="1.5"/>
    `,
    'sun': `
      <circle cx="${s(12, size)}" cy="${s(12, size)}" r="${s(4, size)}" fill="none" stroke="${color}" stroke-width="1.5"/>
      <line x1="${s(12, size)}" y1="${s(2, size)}" x2="${s(12, size)}" y2="${s(5, size)}" stroke="${color}" stroke-width="1.5"/>
      <line x1="${s(12, size)}" y1="${s(19, size)}" x2="${s(12, size)}" y2="${s(22, size)}" stroke="${color}" stroke-width="1.5"/>
      <line x1="${s(2, size)}" y1="${s(12, size)}" x2="${s(5, size)}" y2="${s(12, size)}" stroke="${color}" stroke-width="1.5"/>
      <line x1="${s(19, size)}" y1="${s(12, size)}" x2="${s(22, size)}" y2="${s(12, size)}" stroke="${color}" stroke-width="1.5"/>
    `,
  };

  return icons[iconName] ?? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.35}" fill="${color}" opacity="0.5"/>`;
}

/** Scale a 24-based coordinate to a target icon size. */
function s(v: number, size: number): string {
  return ((v / 24) * size).toFixed(1);
}

/** Guess a good icon from the overlay config. */
function guessIcon(config: OverlayConfig): string {
  if (config.valueSource === 'volume') return 'volume-2';
  if (config.valueSource === 'brightness') return 'sun';
  return '';
}

function escXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── System value readers ──────────────────────────────────────────────

function getSystemVolume(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      exec(
        `osascript -e 'output volume of (get volume settings)'`,
        { timeout: 2000 },
        (err, stdout) => {
          if (err) return reject(err);
          const v = parseInt(stdout.trim(), 10);
          resolve(isNaN(v) ? 50 : v);
        },
      );
    } else if (process.platform === 'linux') {
      exec(
        `amixer get Master 2>/dev/null | grep -oP '\\d+%' | head -1`,
        { timeout: 2000 },
        (err, stdout) => {
          if (err) return reject(err);
          const v = parseInt(stdout.trim(), 10);
          resolve(isNaN(v) ? 50 : v);
        },
      );
    } else if (process.platform === 'win32') {
      // PowerShell: read master volume via Audio endpoint
      // Uses the built-in Windows.Media.Audio namespace on Win10+
      exec(
        `powershell -NoProfile -Command "try { Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop; $vol = [Audio.Volume]::GetMasterVolume(); [Math]::Round($vol * 100) } catch { 50 }"`,
        { timeout: 3000 },
        (err, stdout) => {
          // Gracefully fall back to 50 if anything fails
          if (err) return resolve(50);
          const v = parseFloat(stdout.trim());
          resolve(isNaN(v) ? 50 : Math.round(v));
        },
      );
    } else {
      resolve(50);
    }
  });
}

function getSystemBrightness(): Promise<number> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      // Uses the built-in `brightness` value from IOKit
      exec(
        `osascript -l JavaScript -e 'ObjC.import("IOKit");' -e 'var v=$.IODisplayGetFloatParameter($.CGDisplayGetDisplaysWithOpenGLDisplayMasks,0,$.kIODisplayBrightnessKey,null); v*100'`,
        { timeout: 2000 },
        (err, stdout) => {
          // Fallback — the IOKit JXA approach can fail; just return 50
          if (err) return resolve(50);
          const v = parseFloat(stdout.trim());
          resolve(isNaN(v) ? 50 : Math.round(v));
        },
      );
    } else if (process.platform === 'win32') {
      // Windows: read brightness via WMI (works on laptops/tablets)
      exec(
        `powershell -NoProfile -Command "try { (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness } catch { 50 }"`,
        { timeout: 2000 },
        (err, stdout) => {
          if (err) return resolve(50);
          const v = parseInt(stdout.trim(), 10);
          resolve(isNaN(v) ? 50 : v);
        },
      );
    } else {
      resolve(50);
    }
  });
}

// ── Singleton export ──────────────────────────────────────────────────

export const overlayService = new OverlayService();
