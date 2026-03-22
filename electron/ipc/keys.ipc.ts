import { dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import type { IpcResponse } from '../../shared/types/ipc.types';
import type { ActionConfig } from '../../shared/types/action.types';
import type { IconStyle } from '../../shared/types/profile.types';
import { hidService } from '../services/hid.service';
import {
  processImage,
  createTextImage,
} from '../services/image.service';
import { generateActionIcon } from '../services/icon.service';

export function registerKeysIpcHandlers(): void {
  /** Set a key image from base64 data */
  ipcMain.handle(
    IPC_CHANNELS.KEYS_SET_IMAGE,
    async (
      _event,
      keyIndex: number,
      imageBase64: string,
    ): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        if (!layout?.keys || !protocol) {
          return { success: false, error: 'No device connected or device has no keys' };
        }

        const outputId = protocol.getOutputId('key', keyIndex);
        if (outputId === undefined) {
          return { success: false, error: `Invalid key index: ${keyIndex}` };
        }

        const { device, preview } = await processImage(imageBase64, layout.keys.imageSpec);
        await hidService.sendImage(outputId, device);

        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Clear a key image (send black) */
  ipcMain.handle(
    IPC_CHANNELS.KEYS_CLEAR_IMAGE,
    async (_event, keyIndex: number): Promise<IpcResponse<void>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        if (!layout?.keys || !protocol) {
          return { success: false, error: 'No device connected' };
        }

        const outputId = protocol.getOutputId('key', keyIndex);
        if (outputId === undefined) {
          return { success: false, error: `Invalid key index: ${keyIndex}` };
        }

        const black = await createTextImage(' ', layout.keys.imageSpec, '#000000', '#000000');
        await hidService.sendImage(outputId, black);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Clear a touch strip zone image (send black) */
  ipcMain.handle(
    IPC_CHANNELS.TOUCH_CLEAR_IMAGE,
    async (_event, zoneIndex: number): Promise<IpcResponse<void>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        if (!layout?.touchZones || !protocol) {
          return { success: false, error: 'No device connected or no touch zones' };
        }

        const outputId = protocol.getOutputId('touchZone', zoneIndex);
        if (outputId === undefined) {
          return { success: false, error: `Invalid touch zone: ${zoneIndex}` };
        }

        const black = await createTextImage(' ', layout.touchZones.imageSpec, '#000000', '#000000');
        await hidService.sendImage(outputId, black);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Set a touch strip zone image from base64 */
  ipcMain.handle(
    IPC_CHANNELS.TOUCH_SET_IMAGE,
    async (
      _event,
      zoneIndex: number,
      imageBase64: string,
    ): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        if (!layout?.touchZones || !protocol) {
          return { success: false, error: 'No device connected or no touch zones' };
        }

        const outputId = protocol.getOutputId('touchZone', zoneIndex);
        if (outputId === undefined) {
          return { success: false, error: `Invalid touch zone: ${zoneIndex}` };
        }

        const { device, preview } = await processImage(imageBase64, layout.touchZones.imageSpec);
        await hidService.sendImage(outputId, device);

        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Browse for an image file, return base64 content */
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_BROWSE,
    async (): Promise<IpcResponse<{ base64: string; name: string } | null>> => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Image',
          filters: [
            {
              name: 'Images',
              extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
            },
          ],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        const filePath = result.filePaths[0];
        const buffer = fs.readFileSync(filePath);
        const name = path.basename(filePath) || 'image';

        return {
          success: true,
          data: { base64: buffer.toString('base64'), name },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Process a raw image into device-ready format, return base64 preview */
  ipcMain.handle(
    IPC_CHANNELS.IMAGE_PROCESS,
    async (_event, imageBase64: string): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const spec = layout?.keys?.imageSpec ?? { width: 112, height: 112, rotation: 0 as const, format: 'jpeg' as const };
        const { preview } = await processImage(imageBase64, spec);
        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Generate an action icon and optionally push it to a key. */
  ipcMain.handle(
    IPC_CHANNELS.ICON_GENERATE,
    async (
      _event,
      action: ActionConfig,
      keyIndex?: number,
      style?: IconStyle,
      title?: string,
    ): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        const keySpec = layout?.keys?.imageSpec;
        const w = keySpec?.width ?? 112;
        const h = keySpec?.height ?? 112;

        const iconBuffer = await generateActionIcon(action, w, h, style, title);
        const spec = keySpec ?? { width: w, height: h, rotation: 0 as const, format: 'jpeg' as const };
        const { device, preview } = await processImage(iconBuffer, spec);

        if (keyIndex !== undefined && protocol && hidService.isConnected()) {
          const outputId = protocol.getOutputId('key', keyIndex);
          if (outputId !== undefined) {
            await hidService.sendImage(outputId, device);
          }
        }

        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Generate an action icon for a touch zone and optionally push it. */
  ipcMain.handle(
    IPC_CHANNELS.ICON_GENERATE_TOUCH,
    async (
      _event,
      action: ActionConfig,
      zoneIndex?: number,
      style?: IconStyle,
      title?: string,
    ): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const protocol = hidService.getActiveProtocol();
        const touchSpec = layout?.touchZones?.imageSpec;
        const w = touchSpec?.width ?? 176;
        const h = touchSpec?.height ?? 112;

        const iconBuffer = await generateActionIcon(action, w, h, style, title);
        const spec = touchSpec ?? { width: w, height: h, rotation: 0 as const, format: 'jpeg' as const };
        const { device, preview } = await processImage(iconBuffer, spec);

        if (zoneIndex !== undefined && protocol && hidService.isConnected()) {
          const outputId = protocol.getOutputId('touchZone', zoneIndex);
          if (outputId !== undefined) {
            await hidService.sendImage(outputId, device);
          }
        }

        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Set screensaver image */
  ipcMain.handle(
    IPC_CHANNELS.SCREENSAVER_SET,
    async (_event, imageBase64: string): Promise<IpcResponse<string>> => {
      try {
        const layout = hidService.getActiveLayout();
        const spec = layout?.keys?.imageSpec ?? { width: 112, height: 112, rotation: 0 as const, format: 'jpeg' as const };
        const { preview } = await processImage(imageBase64, spec);
        return { success: true, data: preview.toString('base64') };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Clear screensaver image */
  ipcMain.handle(
    IPC_CHANNELS.SCREENSAVER_CLEAR,
    async (): Promise<IpcResponse<void>> => {
      return { success: true };
    },
  );

  /** Fetch a favicon for a URL via Google's favicon service. */
  ipcMain.handle(
    IPC_CHANNELS.FAVICON_FETCH,
    async (_event, url: string): Promise<IpcResponse<string | null>> => {
      try {
        const hostname = new URL(url).hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
        const response = await fetch(faviconUrl);
        if (!response.ok) {
          return { success: true, data: null };
        }
        const rawBuffer = Buffer.from(await response.arrayBuffer());

        const size = 256;
        const iconSize = Math.round(size * 0.55);
        const offset = Math.round((size - iconSize) / 2);

        const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1a1625" rx="8"/>
        </svg>`;
        const bg = await sharp(Buffer.from(bgSvg)).resize(size, size).png().toBuffer();

        const resizedIcon = await sharp(rawBuffer)
          .resize(iconSize, iconSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();

        const composited = await sharp(bg)
          .composite([{ input: resizedIcon, left: offset, top: offset }])
          .png()
          .toBuffer();

        return { success: true, data: composited.toString('base64') };
      } catch {
        return { success: true, data: null };
      }
    },
  );
}
