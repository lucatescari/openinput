import type { DeviceInputEvent } from '../../../shared/types/device.types';

// ── Input maps (device byte → app index) ────────────────────────────

/** Maps physical key input IDs (byte 9 values) to key indices 0-9 */
export const KEY_INPUT_MAP: Record<number, number> = {
  0x01: 0,
  0x02: 1,
  0x03: 2,
  0x04: 3,
  0x05: 4,
  0x06: 5,
  0x07: 6,
  0x08: 7,
  0x09: 8,
  0x0a: 9,
};

/** Maps touch strip zone input IDs to zone indices 0-3 */
export const TOUCH_INPUT_MAP: Record<number, number> = {
  0x40: 0,
  0x41: 1,
  0x42: 2,
  0x43: 3,
};

/** Encoder input byte mappings */
export const ENCODER_MAP = {
  // Encoder 0
  0xa0: { index: 0, direction: 'ccw' as const },
  0xa1: { index: 0, direction: 'cw' as const },
  0x37: { index: 0, direction: 'press' as const },
  // Encoder 1
  0x50: { index: 1, direction: 'ccw' as const },
  0x51: { index: 1, direction: 'cw' as const },
  0x35: { index: 1, direction: 'press' as const },
  // Encoder 2
  0x90: { index: 2, direction: 'ccw' as const },
  0x91: { index: 2, direction: 'cw' as const },
  0x33: { index: 2, direction: 'press' as const },
  // Encoder 3
  0x70: { index: 3, direction: 'ccw' as const },
  0x71: { index: 3, direction: 'cw' as const },
  0x36: { index: 3, direction: 'press' as const },
};

/** Swipe input byte mappings */
export const SWIPE_MAP: Record<number, 'left' | 'right'> = {
  0x38: 'left',
  0x39: 'right',
};

// ── Output maps (app index → device output ID) ─────────────────────

/** Maps key indices 0-9 to output IDs for image writes */
export const KEY_OUTPUT_MAP: Record<number, number> = {
  // Top row (keys 0-4) -> output IDs 0x0B-0x0F
  0: 0x0b,
  1: 0x0c,
  2: 0x0d,
  3: 0x0e,
  4: 0x0f,
  // Bottom row (keys 5-9) -> output IDs 0x06-0x0A
  5: 0x06,
  6: 0x07,
  7: 0x08,
  8: 0x09,
  9: 0x0a,
};

/** Touch strip output IDs for image writes */
export const TOUCH_OUTPUT_MAP: Record<number, number> = {
  0: 0x01,
  1: 0x02,
  2: 0x03,
  3: 0x04,
};
