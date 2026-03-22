/**
 * Overlay configuration for touch-zone visual feedback.
 *
 * When an action is executed, an optional overlay image is rendered across
 * the 4 touch zones on the physical device.  After `duration` ms the
 * original touch-zone images are restored.
 *
 * Built-in renderers: 'progress_bar', 'text'.
 * Plugins can register additional renderer types via the overlay registry.
 */

export type BuiltinOverlayType = 'progress_bar' | 'text';

export interface OverlayConfig {
  /** Renderer type — built-in or registered by a plugin */
  type: string;

  /** How long to show the overlay in ms. Default: 1500 */
  duration?: number;

  // ── progress_bar fields ──────────────────────────────────────────────

  /**
   * System value to read for the bar level.
   * 'volume'     → reads current system volume (0-100)
   * 'brightness' → reads current display brightness (0-100)
   * Omit and set `value` manually for custom sources.
   */
  valueSource?: 'volume' | 'brightness';

  /** Explicit value 0–100 (overrides valueSource if both are set). */
  value?: number;

  /** Label displayed next to the bar / in the overlay */
  label?: string;

  /** Lucide icon name rendered at the leading edge */
  icon?: string;

  /** Accent / bar fill colour.  Default: '#a78bfa' (primary-400) */
  color?: string;

  /** Background colour.  Default: '#1a1625' */
  bgColor?: string;

  // ── text fields ──────────────────────────────────────────────────────

  /** Large text to display (for type 'text'). */
  text?: string;

  /** Font size in px (relative to 112 px zone height). Default: auto */
  fontSize?: number;
}

/**
 * A plugin-provided overlay renderer (Electron main process only).
 *
 * Receives the resolved overlay config (with `value` already populated
 * from the system if `valueSource` was set) and returns a raw PNG/JPEG
 * buffer sized 704 × 112 that will be sliced into 4 touch-zone images.
 *
 * NOTE: This interface references Node Buffer and is only usable in the
 * Electron main process.  Angular code should only use OverlayConfig.
 */
export interface OverlayRenderer {
  /** Unique type key — matches OverlayConfig.type */
  type: string;
  /** Human-readable name for the settings UI */
  name: string;
  /** Render the full-width overlay strip (704 × 112 px). */
  render(config: OverlayConfig): Promise<Uint8Array>;
}
