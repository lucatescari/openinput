import {
  Component,
  input,
  output,
  signal,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DOCUMENT } from '@angular/common';

// ---------------------------------------------------------------------------
// HSV ↔ RGB ↔ Hex helpers
// ---------------------------------------------------------------------------

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === r)      h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else                h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SV_SIZE = 180;
const HUE_HEIGHT = 14;

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="relative inline-block" (keydown)="onKeydown($event)">
      <!-- Swatch trigger -->
      <button
        type="button"
        (click)="toggle($event)"
        class="flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors
          border-gray-300 bg-white hover:border-gray-400
          dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600
          focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      >
        <span
          class="block h-5 w-5 rounded border border-gray-300 dark:border-neutral-600"
          [style.background-color]="displayColor()"
        ></span>
        <span class="text-xs text-gray-600 dark:text-gray-400">{{ label() }}</span>
      </button>

      <!-- Popover -->
      @if (open()) {
        <div
          #popover
          class="fixed z-50 rounded-xl border shadow-xl
            border-gray-200 bg-white p-3
            dark:border-neutral-700 dark:bg-neutral-800"
          [style.left.px]="popLeft()"
          [style.top.px]="popTop()"
          [style.width.px]="SV_SIZE + 24"
        >
          <!-- SV gradient canvas -->
          <div class="relative mb-2 cursor-crosshair overflow-hidden rounded-lg"
            [style.width.px]="SV_SIZE" [style.height.px]="SV_SIZE"
            (pointerdown)="onSvDown($event)"
          >
            <canvas #svCanvas [width]="SV_SIZE" [height]="SV_SIZE"
              class="block" [style.width.px]="SV_SIZE" [style.height.px]="SV_SIZE"
            ></canvas>
            <!-- Picker circle -->
            <div
              class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              [style.left.px]="svX()"
              [style.top.px]="svY()"
            >
              <div class="h-full w-full rounded-full border border-black/20"></div>
            </div>
          </div>

          <!-- Hue slider -->
          <div
            class="relative mb-3 cursor-pointer overflow-hidden rounded-full"
            [style.width.px]="SV_SIZE" [style.height.px]="HUE_HEIGHT"
            style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
            (pointerdown)="onHueDown($event)"
          >
            <!-- Hue thumb -->
            <div
              class="pointer-events-none absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full border border-white shadow"
              [style.left.px]="hueX()"
              [style.background-color]="hueThumbColor()"
            ></div>
          </div>

          <!-- Hex input + preview -->
          <div class="flex items-center gap-2 overflow-hidden" [style.max-width.px]="SV_SIZE">
            <span
              class="block h-7 w-7 shrink-0 rounded border border-gray-300 dark:border-neutral-600"
              [style.background-color]="displayColor()"
            ></span>
            <input
              type="text"
              [ngModel]="hexInput()"
              (ngModelChange)="onHexInput($event)"
              (blur)="commitHex()"
              (keydown.enter)="commitHex()"
              maxlength="7"
              placeholder="#000000"
              class="min-w-0 flex-1 rounded-lg border px-2 py-1 font-mono text-xs
                border-gray-300 bg-white text-gray-700
                dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300
                focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>
      }
    </div>
  `,
  host: { class: 'inline-block' },
})
export class ColorPickerComponent implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly elRef = inject(ElementRef);

  readonly svCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('svCanvas');
  readonly popoverRef = viewChild<ElementRef<HTMLElement>>('popover');

  readonly value = input<string>('#000000');
  readonly label = input<string>('Color');
  readonly valueChange = output<string>();

  // Expose for template
  readonly SV_SIZE = SV_SIZE;
  readonly HUE_HEIGHT = HUE_HEIGHT;

  readonly open = signal(false);
  readonly displayColor = signal('#000000');
  readonly hexInput = signal('#000000');

  // HSV state
  readonly hue = signal(0);
  readonly sat = signal(0);
  readonly val = signal(0);

  // Derived positions
  readonly svX = signal(0);
  readonly svY = signal(0);
  readonly hueX = signal(0);

  // Popover position
  readonly popLeft = signal(0);
  readonly popTop = signal(0);

  readonly hueThumbColor = signal('#ff0000');

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private dragging: 'sv' | 'hue' | null = null;
  private boundPointerMove = this.onPointerMove.bind(this);
  private boundPointerUp = this.onPointerUp.bind(this);

  constructor() {
    // Sync external value → internal state when popover is closed
    effect(() => {
      const v = this.value();
      if (!this.open()) {
        this.setFromHex(v);
      }
    });

    // Redraw SV canvas when hue changes (or when canvas becomes available)
    afterNextRender(() => {
      // Initial draw handled by open toggle
    });
  }

  private clickOutsideHandler = (e: Event) => {
    const popover = this.popoverRef()?.nativeElement;
    const trigger = this.elRef.nativeElement;
    if (
      popover && !popover.contains(e.target as Node) &&
      !trigger.contains(e.target as Node)
    ) {
      this.close();
    }
  };

  toggle(e: Event): void {
    e.stopPropagation();
    if (this.open()) {
      this.close();
    } else {
      this.setFromHex(this.value());
      this.open.set(true);
      // Position and draw after DOM renders
      requestAnimationFrame(() => {
        this.positionPopover();
        this.drawSvCanvas();
        this.doc.addEventListener('click', this.clickOutsideHandler, true);
      });
    }
  }

  close(): void {
    this.open.set(false);
    this.doc.removeEventListener('click', this.clickOutsideHandler, true);
    this.flushDebounce();
  }

  // --- SV canvas interaction ---

  onSvDown(e: PointerEvent): void {
    e.preventDefault();
    this.dragging = 'sv';
    this.doc.addEventListener('pointermove', this.boundPointerMove);
    this.doc.addEventListener('pointerup', this.boundPointerUp);
    this.updateSvFromEvent(e);
  }

  // --- Hue slider interaction ---

  onHueDown(e: PointerEvent): void {
    e.preventDefault();
    this.dragging = 'hue';
    this.doc.addEventListener('pointermove', this.boundPointerMove);
    this.doc.addEventListener('pointerup', this.boundPointerUp);
    this.updateHueFromEvent(e);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.dragging === 'sv') this.updateSvFromEvent(e);
    else if (this.dragging === 'hue') this.updateHueFromEvent(e);
  }

  private onPointerUp(): void {
    this.dragging = null;
    this.doc.removeEventListener('pointermove', this.boundPointerMove);
    this.doc.removeEventListener('pointerup', this.boundPointerUp);
    // Emit final value
    this.emitDebounced(this.displayColor());
  }

  private updateSvFromEvent(e: PointerEvent): void {
    const canvas = this.svCanvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(SV_SIZE, e.clientX - rect.left));
    const y = Math.max(0, Math.min(SV_SIZE, e.clientY - rect.top));

    const s = x / SV_SIZE;
    const v = 1 - y / SV_SIZE;

    this.sat.set(s);
    this.val.set(v);
    this.svX.set(x);
    this.svY.set(y);
    this.updateColorFromHsv();
  }

  private updateHueFromEvent(e: PointerEvent): void {
    const target = (e.currentTarget ?? e.target) as HTMLElement;
    // Use the hue bar element; find it relative to popover
    const popover = this.popoverRef()?.nativeElement;
    if (!popover) return;
    const hueBar = popover.querySelector('[style*="linear-gradient"]') as HTMLElement;
    if (!hueBar) return;
    const rect = hueBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(SV_SIZE, e.clientX - rect.left));

    const h = (x / SV_SIZE) * 360;
    this.hue.set(h);
    this.hueX.set(x);
    this.hueThumbColor.set(hsvToHex(h, 1, 1));
    this.drawSvCanvas();
    this.updateColorFromHsv();
  }

  // --- Hex input ---

  onHexInput(value: string): void {
    this.hexInput.set(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      this.setFromHex(value, false);
      this.emitDebounced(value);
    }
  }

  commitHex(): void {
    const hex = this.hexInput();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      this.setFromHex(hex, false);
      this.emitDebounced(hex);
    } else {
      this.hexInput.set(this.displayColor());
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  // --- HSV ↔ display sync ---

  private setFromHex(hex: string, redraw = true): void {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const [r, g, b] = hexToRgb(hex);
    const [h, s, v] = rgbToHsv(r, g, b);

    this.hue.set(h);
    this.sat.set(s);
    this.val.set(v);

    this.svX.set(s * SV_SIZE);
    this.svY.set((1 - v) * SV_SIZE);
    this.hueX.set((h / 360) * SV_SIZE);
    this.hueThumbColor.set(hsvToHex(h, 1, 1));

    this.displayColor.set(hex.toLowerCase());
    this.hexInput.set(hex.toLowerCase());

    if (redraw) {
      requestAnimationFrame(() => this.drawSvCanvas());
    }
  }

  private updateColorFromHsv(): void {
    const hex = hsvToHex(this.hue(), this.sat(), this.val());
    this.displayColor.set(hex);
    this.hexInput.set(hex);
  }

  // --- Canvas drawing ---

  private drawSvCanvas(): void {
    const canvas = this.svCanvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = SV_SIZE;
    const h = SV_SIZE;

    // Base hue color
    const [hr, hg, hb] = hsvToRgb(this.hue(), 1, 1);

    // Draw saturation gradient (white → hue)
    const satGrad = ctx.createLinearGradient(0, 0, w, 0);
    satGrad.addColorStop(0, '#ffffff');
    satGrad.addColorStop(1, `rgb(${hr},${hg},${hb})`);
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, w, h);

    // Overlay value gradient (transparent → black)
    const valGrad = ctx.createLinearGradient(0, 0, 0, h);
    valGrad.addColorStop(0, 'rgba(0,0,0,0)');
    valGrad.addColorStop(1, '#000000');
    ctx.fillStyle = valGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // --- Popover positioning ---

  private positionPopover(): void {
    const trigger = this.elRef.nativeElement.querySelector('button');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popW = SV_SIZE + 24;
    const popH = SV_SIZE + HUE_HEIGHT + 80; // approx

    let left = rect.left;
    let top = rect.bottom + 6;

    // Keep within viewport
    if (left + popW > window.innerWidth - 8) {
      left = window.innerWidth - popW - 8;
    }
    if (left < 8) left = 8;

    if (top + popH > window.innerHeight - 8) {
      top = rect.top - popH - 6;
    }
    if (top < 8) top = 8;

    this.popLeft.set(left);
    this.popTop.set(top);
  }

  // --- Debounce ---

  private emitDebounced(color: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.valueChange.emit(color);
      this.debounceTimer = null;
    }, 300);
  }

  private flushDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.valueChange.emit(this.displayColor());
      this.debounceTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('click', this.clickOutsideHandler, true);
    this.doc.removeEventListener('pointermove', this.boundPointerMove);
    this.doc.removeEventListener('pointerup', this.boundPointerUp);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
