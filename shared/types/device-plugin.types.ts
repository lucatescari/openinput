import type { DeviceInputEvent } from './device.types';

// ── Image specification ─────────────────────────────────────────────

export interface ElementImageSpec {
  width: number;
  height: number;
  /** Rotation in degrees applied before sending to device (e.g. 180 for AKP05) */
  rotation: 0 | 90 | 180 | 270;
  /** Image format the device expects */
  format: 'jpeg' | 'png' | 'bmp';
  /** JPEG quality (only relevant when format is 'jpeg') */
  quality?: number;
  /** Maximum encoded image size in bytes before quality reduction */
  maxBytes?: number;
}

// ── Layout description ──────────────────────────────────────────────

export interface KeyLayoutSpec {
  rows: number;
  cols: number;
  count: number;
  imageSpec: ElementImageSpec;
}

export interface EncoderLayoutSpec {
  count: number;
  hasPress: boolean;
}

export interface TouchZoneLayoutSpec {
  count: number;
  imageSpec: ElementImageSpec;
}

export interface DeviceLayout {
  keys?: KeyLayoutSpec;
  encoders?: EncoderLayoutSpec;
  touchZones?: TouchZoneLayoutSpec;
  swipe?: boolean;
}

// ── Device discovery ────────────────────────────────────────────────

export interface DeviceMatchDescriptor {
  vendorId: number;
  productIds: number[];
  usagePage?: number;
}

// ── Plugin metadata (shared with renderer) ──────────────────────────

export interface DevicePluginMeta {
  /** Unique plugin ID, e.g. 'ajazz-akp05' */
  id: string;
  /** Human-readable name, e.g. 'AJAZZ AKP05' */
  name: string;
  /** Device layout specification */
  layout: DeviceLayout;
  /** USB match descriptors for auto-discovery */
  match: DeviceMatchDescriptor[];
}

// ── Plugin protocol (Electron main process only) ────────────────────

export interface DeviceProtocol {
  /** Initialize the device after HID open (wake, handshake, brightness). */
  initialize(device: any): Promise<void>;

  /** Send keep-alive heartbeat. */
  sendHeartbeat(device: any): Promise<void>;

  /** Set display brightness 0-100. */
  setBrightness(device: any, level: number): Promise<void>;

  /**
   * Send a pre-encoded image to the given output slot.
   * The image is already resized/rotated/encoded by the framework
   * using the plugin's imageSpec.
   */
  sendImage(device: any, outputId: number, imageData: any): Promise<void>;

  /** Clear a single slot, or all slots if outputId is 0xFF. */
  clearSlot(device: any, outputId: number): Promise<void>;

  /** Put the device to sleep / turn off display. */
  sleep(device: any): Promise<void>;

  /** Parse a raw HID input report into a DeviceInputEvent. */
  parseInputReport(data: any): DeviceInputEvent | null;

  /** Map a logical element to the physical output ID for sendImage. */
  getOutputId(elementType: 'key' | 'touchZone', index: number): number | undefined;

  /** Optional cleanup on disconnect. */
  dispose?(): void;
}

// ── Full plugin definition ──────────────────────────────────────────

export interface DevicePlugin {
  meta: DevicePluginMeta;
  createProtocol(): DeviceProtocol;
}
