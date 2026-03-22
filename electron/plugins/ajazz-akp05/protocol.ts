import type { HIDAsync } from 'node-hid';
import type { DeviceProtocol } from '../../../shared/types/device-plugin.types';
import type { DeviceInputEvent } from '../../../shared/types/device.types';
import {
  KEY_INPUT_MAP,
  KEY_OUTPUT_MAP,
  TOUCH_INPUT_MAP,
  TOUCH_OUTPUT_MAP,
  ENCODER_MAP,
  SWIPE_MAP,
} from './maps';

// ── Protocol constants ──────────────────────────────────────────────

const REPORT_SIZE = 1024;
const CRT_PREFIX = Buffer.from([0x43, 0x52, 0x54, 0x00, 0x00]);

// ── Low-level helpers ───────────────────────────────────────────────

function buildCommand(cmd: Buffer, args?: Buffer): Buffer {
  const data = Buffer.alloc(REPORT_SIZE, 0);
  CRT_PREFIX.copy(data, 0);
  cmd.copy(data, CRT_PREFIX.length);
  if (args) {
    args.copy(data, CRT_PREFIX.length + cmd.length);
  }
  return data;
}

function prependReportId(data: Buffer): Buffer {
  const report = Buffer.alloc(REPORT_SIZE + 1, 0);
  report[0] = 0x00;
  data.copy(report, 1);
  return report;
}

async function sendCommand(device: HIDAsync, cmd: Buffer, args?: Buffer): Promise<void> {
  const data = buildCommand(cmd, args);
  const report = prependReportId(data);
  await device.write([...report]);
}

// ── AKP05 Protocol ──────────────────────────────────────────────────

export class AKP05Protocol implements DeviceProtocol {
  async initialize(device: HIDAsync): Promise<void> {
    // DIS — wake/initialize display
    await sendCommand(device, Buffer.from([0x44, 0x49, 0x53]));
    // LIG — set default brightness to 80
    await sendCommand(
      device,
      Buffer.from([0x4c, 0x49, 0x47]),
      Buffer.from([0x00, 0x00, 80]),
    );
  }

  async sendHeartbeat(device: HIDAsync): Promise<void> {
    // CONNECT
    await sendCommand(
      device,
      Buffer.from([0x43, 0x4f, 0x4e, 0x4e, 0x45, 0x43, 0x54]),
    );
  }

  async setBrightness(device: HIDAsync, level: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    await sendCommand(
      device,
      Buffer.from([0x4c, 0x49, 0x47]),
      Buffer.from([0x00, 0x00, clamped]),
    );
  }

  async sendImage(device: HIDAsync, outputId: number, imageData: Buffer): Promise<void> {
    // BAT announce: size (4 bytes big-endian) + output ID
    const sizeBytes = Buffer.alloc(4);
    sizeBytes.writeUInt32BE(imageData.length, 0);

    await sendCommand(
      device,
      Buffer.from([0x42, 0x41, 0x54]),
      Buffer.from([sizeBytes[0], sizeBytes[1], sizeBytes[2], sizeBytes[3], outputId]),
    );

    // Stream JPEG data in chunks
    let offset = 0;
    while (offset < imageData.length) {
      const chunk = Buffer.alloc(REPORT_SIZE + 1, 0);
      chunk[0] = 0x00;
      const remaining = imageData.length - offset;
      const copyLen = Math.min(remaining, REPORT_SIZE);
      imageData.copy(chunk, 1, offset, offset + copyLen);
      await device.write([...chunk]);
      offset += copyLen;
    }

    // STP — flush to display
    await sendCommand(device, Buffer.from([0x53, 0x54, 0x50]));
  }

  async clearSlot(device: HIDAsync, outputId: number): Promise<void> {
    // CLE
    await sendCommand(
      device,
      Buffer.from([0x43, 0x4c, 0x45]),
      Buffer.from([0x00, 0x00, 0x00, outputId]),
    );
  }

  async sleep(device: HIDAsync): Promise<void> {
    // HAN
    await sendCommand(device, Buffer.from([0x48, 0x41, 0x4e]));
  }

  parseInputReport(data: Buffer): DeviceInputEvent | null {
    if (data.length < 11) return null;

    const controlId = data[9];
    const state = data[10]; // 0x01 = pressed, 0x00 = released
    const now = Date.now();

    // LCD key press/release
    if (controlId in KEY_INPUT_MAP) {
      return {
        type: state === 0x01 ? 'key_down' : 'key_up',
        index: KEY_INPUT_MAP[controlId],
        timestamp: now,
      };
    }

    // Touch zone press/release
    if (controlId in TOUCH_INPUT_MAP) {
      return {
        type: state === 0x01 ? 'touch_press' : 'touch_release',
        index: TOUCH_INPUT_MAP[controlId],
        timestamp: now,
      };
    }

    // Encoder rotation or press
    if (controlId in ENCODER_MAP) {
      const mapping = ENCODER_MAP[controlId as keyof typeof ENCODER_MAP];
      if (mapping.direction === 'cw') {
        return { type: 'encoder_cw', index: mapping.index, timestamp: now };
      } else if (mapping.direction === 'ccw') {
        return { type: 'encoder_ccw', index: mapping.index, timestamp: now };
      } else {
        return {
          type: state === 0x01 ? 'encoder_press' : 'encoder_release',
          index: mapping.index,
          timestamp: now,
        };
      }
    }

    // Swipe gestures
    if (controlId in SWIPE_MAP) {
      const direction = SWIPE_MAP[controlId];
      return {
        type: direction === 'left' ? 'swipe_left' : 'swipe_right',
        index: 0,
        timestamp: now,
      };
    }

    return null;
  }

  getOutputId(elementType: 'key' | 'touchZone', index: number): number | undefined {
    if (elementType === 'key') return KEY_OUTPUT_MAP[index];
    if (elementType === 'touchZone') return TOUCH_OUTPUT_MAP[index];
    return undefined;
  }
}
