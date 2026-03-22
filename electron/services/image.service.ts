import sharp from 'sharp';
import type { ElementImageSpec } from '../../shared/types/device-plugin.types';

/**
 * Process an image according to a device's element spec.
 * Returns { device, preview } — device buffer is rotated/encoded for hardware,
 * preview is not rotated (for the UI).
 */
export async function processImage(
  input: Buffer | string,
  spec: ElementImageSpec,
  quality?: number,
): Promise<{ device: Buffer; preview: Buffer }> {
  const buf = typeof input === 'string' ? Buffer.from(input, 'base64') : input;
  const q = quality ?? spec.quality ?? 90;

  // Preview: no rotation — what the user sees in the UI
  const preview = await sharp(buf)
    .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: q })
    .toBuffer();

  // Device: with rotation + format for the hardware
  const buildDevicePipeline = () => {
    let p = sharp(buf).resize(spec.width, spec.height, { fit: 'cover', position: 'centre' });
    if (spec.rotation !== 0) p = p.rotate(spec.rotation);
    return p;
  };

  let deviceBuf: Buffer;
  if (spec.format === 'jpeg') {
    deviceBuf = await buildDevicePipeline().jpeg({ quality: q }).toBuffer();
    // Reduce quality if over max size
    let currentQ = q;
    const maxBytes = spec.maxBytes ?? Infinity;
    while (deviceBuf.length > maxBytes && currentQ > 30) {
      currentQ -= 10;
      deviceBuf = await buildDevicePipeline().jpeg({ quality: currentQ }).toBuffer();
    }
  } else if (spec.format === 'png') {
    deviceBuf = await buildDevicePipeline().png().toBuffer();
  } else {
    deviceBuf = await buildDevicePipeline().raw().toBuffer();
  }

  return { device: deviceBuf, preview };
}

/**
 * Create an image with text label.
 * Renders white text on a dark background, encoded for device.
 */
export async function createTextImage(
  text: string,
  spec: ElementImageSpec,
  bgColor = '#1a1a2e',
  textColor = '#ffffff',
): Promise<Buffer> {
  const { width, height } = spec;
  const fontSize = Math.min(width, height) * 0.25;
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}" />
      <text
        x="50%" y="50%"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="${textColor}"
        text-anchor="middle"
        dominant-baseline="central"
      >${escaped}</text>
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svg)).resize(width, height);
  if (spec.rotation !== 0) {
    pipeline = pipeline.rotate(spec.rotation);
  }

  return pipeline.jpeg({ quality: spec.quality ?? 90 }).toBuffer();
}

/**
 * Create a solid color image, encoded for device.
 */
export async function createColorImage(
  color: string,
  spec: ElementImageSpec,
): Promise<Buffer> {
  const { width, height } = spec;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}" />
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svg)).resize(width, height);
  if (spec.rotation !== 0) {
    pipeline = pipeline.rotate(spec.rotation);
  }

  return pipeline.jpeg({ quality: spec.quality ?? 90 }).toBuffer();
}
