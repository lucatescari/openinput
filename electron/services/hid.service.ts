import * as HID from 'node-hid';
import type { HIDAsync } from 'node-hid';
import { BrowserWindow } from 'electron';
import type { DeviceInfo } from '../../shared/types/device.types';
import type { DeviceInputEvent } from '../../shared/types/device.types';
import type { DevicePlugin, DeviceProtocol, DeviceLayout } from '../../shared/types/device-plugin.types';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import { pluginRegistry } from '../plugins/plugin-registry';
import { processImage } from './image.service';
import { generateBackButtonIcon } from './icon.service';
import { profileService } from './profile.service';
import { executeAction } from './action.service';
import { overlayService } from './overlay.service';
import type { ActionConfig } from '../../shared/types/action.types';
import type { OverlayConfig } from '../../shared/types/overlay.types';

class HidService {
  private device: HIDAsync | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private activePlugin: DevicePlugin | null = null;
  private activeProtocol: DeviceProtocol | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private mainWindow: BrowserWindow | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private isScreensaverActive = false;
  private pushingImages = false;

  /** List all devices matched by any registered plugin. */
  listDevices(): DeviceInfo[] {
    const allDevices = HID.devices();
    const matched: DeviceInfo[] = [];
    const seen = new Set<string>();

    for (const d of allDevices) {
      if (!d.path) continue;

      const plugin = pluginRegistry.findMatch(
        d.vendorId,
        d.productId,
        d.usagePage,
      );
      if (!plugin) continue;

      const dedupeKey = `${d.productId}:${d.serialNumber ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      matched.push({
        path: d.path,
        pluginId: plugin.meta.id,
        name: plugin.meta.name,
        serialNumber: d.serialNumber || undefined,
        connected: false,
      });
    }

    return matched;
  }

  /** Connect to a device by HID path (retries up to 3 times). */
  async connect(devicePath: string): Promise<DeviceInfo> {
    if (this.device) {
      await this.disconnect();
    }

    const devices = this.listDevices();
    const info = devices.find((d) => d.path === devicePath);
    if (!info) {
      throw new Error('Device not found at the specified path');
    }

    const plugin = pluginRegistry.getById(info.pluginId);
    if (!plugin) {
      throw new Error(`No plugin found for id: ${info.pluginId}`);
    }

    let device: HIDAsync | null = null;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        device = await HID.HIDAsync.open(devicePath);
        break;
      } catch (err) {
        lastError = err as Error;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
    if (!device) {
      throw lastError ?? new Error('Failed to open device');
    }

    this.device = device;
    this.activePlugin = plugin;
    this.activeProtocol = plugin.createProtocol();
    this.deviceInfo = { ...info, connected: true };

    // Initialize device via plugin protocol
    await this.activeProtocol.initialize(device);

    // Listen for input events
    device.on('data', (data: Buffer) => {
      if (!this.activeProtocol) return;
      const event = this.activeProtocol.parseInputReport(data);
      if (event) {
        this.resetIdleTimer();

        if (this.isScreensaverActive) {
          this.wakeFromScreensaver();
          return;
        }

        if (this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.DEVICE_EVENT, event);
        }
        this.dispatchAction(event);
      }
    });

    device.on('error', () => {
      this.handleDisconnect();
    });

    this.startHeartbeat();
    this.resetIdleTimer();

    // Notify plugins of connect
    try {
      const { dispatchPluginDeviceChange } = require('../plugins/plugin-loader');
      dispatchPluginDeviceChange(true);
    } catch { /* plugin-loader not ready — ignore */ }

    return this.deviceInfo;
  }

  /** Disconnect from the current device. */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.isScreensaverActive = false;
    this.activeProtocol?.dispose?.();
    if (this.device) {
      try {
        this.device.close();
      } catch { /* already disconnected */ }
      this.device = null;
    }
    this.activePlugin = null;
    this.activeProtocol = null;
    if (this.deviceInfo) {
      this.deviceInfo = { ...this.deviceInfo, connected: false };
    }
  }

  getStatus(): DeviceInfo | null {
    return this.deviceInfo;
  }

  isConnected(): boolean {
    return this.device !== null && this.deviceInfo?.connected === true;
  }

  /** Get the active plugin (if any). */
  getActivePlugin(): DevicePlugin | null {
    return this.activePlugin;
  }

  /** Get the active protocol (if any). */
  getActiveProtocol(): DeviceProtocol | null {
    return this.activeProtocol;
  }

  /** Get the active device layout. */
  getActiveLayout(): DeviceLayout | null {
    return this.activePlugin?.meta.layout ?? null;
  }

  async setBrightness(level: number): Promise<void> {
    if (!this.device || !this.activeProtocol) throw new Error('No device connected');
    await this.activeProtocol.setBrightness(this.device, level);
  }

  /** Send a pre-encoded image to a device output slot. */
  async sendImage(outputId: number, imageData: Buffer): Promise<void> {
    if (!this.device || !this.activeProtocol) throw new Error('No device connected');
    await this.activeProtocol.sendImage(this.device, outputId, imageData);
  }

  async clearAll(): Promise<void> {
    if (!this.device || !this.activeProtocol) throw new Error('No device connected');
    await this.activeProtocol.clearSlot(this.device, 0xff);
  }

  /** Start auto-scanning for devices. */
  startAutoScan(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.tryScanAndConnect();
    this.scanInterval = setInterval(() => {
      this.tryScanAndConnect();
    }, 3000);
  }

  private async tryScanAndConnect(): Promise<void> {
    if (this.isConnected()) return;
    const devices = this.listDevices();
    if (devices.length === 0) return;

    try {
      const info = await this.connect(devices[0].path);

      if (this.mainWindow) {
        this.mainWindow.webContents.send(
          IPC_CHANNELS.DEVICE_STATUS,
          { connected: true, device: info },
        );
      }

      await this.pushActiveProfileImages();
    } catch {
      // Will retry on next scan interval
    }
  }

  /** Push all images from the active profile to the device. */
  async pushActiveProfileImages(): Promise<void> {
    if (this.pushingImages) return;
    this.pushingImages = true;

    try {
      let profile = profileService.getActiveProfile();

      if (!profile) {
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          profile = profileService.getActiveProfile();
          if (profile) break;
        }
      }

      if (!profile || !this.isConnected()) return;
      const layout = this.getActiveLayout();
      const protocol = this.activeProtocol;
      if (!layout || !protocol) return;

      // Push key images from the active page (respects folder state)
      if (layout.keys) {
        await this.pushDisplayKeys();
      }

      // Push touch zone images (shared across all pages)
      if (layout.touchZones) {
        for (const [zoneStr, config] of Object.entries(profile.touchZones)) {
          const zoneIndex = parseInt(zoneStr, 10);
          const outputId = protocol.getOutputId('touchZone', zoneIndex);
          if (config.image && outputId !== undefined) {
            try {
              const { device } = await processImage(config.image, layout.touchZones.imageSpec);
              await this.sendImage(outputId, device);
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      this.pushingImages = false;
    }
  }

  stopAutoScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (this.device && this.activeProtocol) {
        try {
          await this.activeProtocol.sendHeartbeat(this.device);
        } catch {
          this.handleDisconnect();
        }
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const profile = profileService.getActiveProfile();
    const timeout = profile?.screensaverTimeout ?? 300;
    if (timeout <= 0 || !profile?.screensaver) return;

    this.idleTimer = setTimeout(() => {
      this.activateScreensaver();
    }, timeout * 1000);
  }

  private async activateScreensaver(): Promise<void> {
    const profile = profileService.getActiveProfile();
    if (!profile?.screensaver || !this.isConnected()) return;

    this.isScreensaverActive = true;
    const layout = this.getActiveLayout();
    const protocol = this.activeProtocol;
    if (!layout || !protocol) return;

    try {
      // Push screensaver to all keys
      if (layout.keys) {
        const { device: keyImg } = await processImage(profile.screensaver, layout.keys.imageSpec);
        for (let i = 0; i < layout.keys.count; i++) {
          const outputId = protocol.getOutputId('key', i);
          if (outputId !== undefined) {
            try { await this.sendImage(outputId, keyImg); } catch { /* skip */ }
          }
        }
      }

      // Push screensaver to all touch zones
      if (layout.touchZones) {
        const { device: touchImg } = await processImage(profile.screensaver, layout.touchZones.imageSpec);
        for (let i = 0; i < layout.touchZones.count; i++) {
          const outputId = protocol.getOutputId('touchZone', i);
          if (outputId !== undefined) {
            try { await this.sendImage(outputId, touchImg); } catch { /* skip */ }
          }
        }
      }
    } catch { /* skip */ }
  }

  private async wakeFromScreensaver(): Promise<void> {
    this.isScreensaverActive = false;
    await this.pushActiveProfileImages();
  }

  /** Push the currently active page/folder key images to the device. */
  async pushDisplayKeys(): Promise<void> {
    const layout = this.getActiveLayout();
    const protocol = this.activeProtocol;
    if (!layout?.keys || !protocol || !this.isConnected()) return;

    const displayKeys = profileService.getDisplayKeys();

    // If inside a folder, push a styled back button icon to key 0
    if (profileService.activeFolder !== null) {
      const backOutputId = protocol.getOutputId('key', 0);
      if (backOutputId !== undefined) {
        try {
          const spec = layout.keys.imageSpec;
          const iconBuf = await generateBackButtonIcon(spec.width, spec.height);
          const { device } = await processImage(iconBuf, spec);
          await this.sendImage(backOutputId, device);
        } catch { /* skip */ }
      }
    }

    for (let i = 0; i < layout.keys.count; i++) {
      // Skip key 0 if inside folder (already has back button)
      if (profileService.activeFolder !== null && i === 0) continue;

      const outputId = protocol.getOutputId('key', i);
      if (outputId === undefined) continue;

      const config = displayKeys[i];
      if (config?.image) {
        try {
          const { device } = await processImage(config.image, layout.keys.imageSpec);
          await this.sendImage(outputId, device);
        } catch { /* skip */ }
      } else {
        // Clear keys that have no image
        try {
          const { createTextImage } = await import('./image.service');
          const blank = await createTextImage(' ', layout.keys.imageSpec, '#000000', '#000000');
          await this.sendImage(outputId, blank);
        } catch { /* skip */ }
      }
    }
  }

  /**
   * Animated version of pushDisplayKeys — fades LCD key images in from black
   * using progressive opacity frames (same technique as the overlay service).
   * Only affects keys; touch zones are untouched.
   */
  private static readonly KEY_FADE_STEPS = [0.15, 0.4, 0.7];
  private static readonly KEY_FADE_FRAME_MS = 30;

  async pushDisplayKeysAnimated(): Promise<void> {
    const layout = this.getActiveLayout();
    const protocol = this.activeProtocol;
    if (!layout?.keys || !protocol || !this.device || !this.isConnected()) {
      return this.pushDisplayKeys();
    }

    try {
      const sharp = (await import('sharp')).default;
      const spec = layout.keys.imageSpec;
      const displayKeys = profileService.getDisplayKeys();
      const keyCount = layout.keys.count;
      const inFolder = profileService.activeFolder !== null;

      // ── 1. Build full-opacity device buffers for each key (parallel) ──
      const { createColorImage } = await import('./image.service');
      const blackFrame = await createColorImage('#000000', spec);
      const fullBuffers: Buffer[] = new Array(keyCount).fill(blackFrame);
      const processJobs: Promise<void>[] = [];

      if (inFolder) {
        processJobs.push(
          (async () => {
            const iconBuf = await generateBackButtonIcon(spec.width, spec.height);
            const { device } = await processImage(iconBuf, spec);
            fullBuffers[0] = device;
          })(),
        );
      }

      for (let i = 0; i < keyCount; i++) {
        if (inFolder && i === 0) continue;
        const config = displayKeys[i];
        if (config?.image) {
          const idx = i;
          processJobs.push(
            (async () => {
              const { device } = await processImage(config.image!, spec);
              fullBuffers[idx] = device;
            })(),
          );
        }
      }

      await Promise.all(processJobs);

      // ── 2. Device-side dimensions (after rotation) for overlay SVGs ──
      const rotW = (spec.rotation === 90 || spec.rotation === 270) ? spec.height : spec.width;
      const rotH = (spec.rotation === 90 || spec.rotation === 270) ? spec.width : spec.height;
      const quality = spec.quality ?? 90;

      // ── 3. Stream fade-in frames ──
      for (const opacity of HidService.KEY_FADE_STEPS) {
        const darken = (1 - opacity).toFixed(2);
        const overlaySvg = Buffer.from(
          `<svg width="${rotW}" height="${rotH}" xmlns="http://www.w3.org/2000/svg">` +
          `<rect width="100%" height="100%" fill="black" opacity="${darken}"/>` +
          `</svg>`,
        );

        // Composite opacity overlay onto each key image (parallel)
        const fadedBuffers = await Promise.all(
          fullBuffers.map(async (buf) => {
            if (buf === blackFrame) return blackFrame;
            return sharp(buf)
              .composite([{ input: overlaySvg, blend: 'over' }])
              .jpeg({ quality })
              .toBuffer();
          }),
        );

        // Send faded frame to device
        for (let i = 0; i < keyCount; i++) {
          const outputId = protocol.getOutputId('key', i);
          if (outputId !== undefined) {
            await this.sendImage(outputId, fadedBuffers[i]);
          }
        }

        await new Promise((r) => setTimeout(r, HidService.KEY_FADE_FRAME_MS));
      }

      // ── 4. Final full-opacity frame ──
      for (let i = 0; i < keyCount; i++) {
        const outputId = protocol.getOutputId('key', i);
        if (outputId !== undefined) {
          await this.sendImage(outputId, fullBuffers[i]);
        }
      }
    } catch {
      // Fallback: just push without animation
      await this.pushDisplayKeys();
    }
  }

  private dispatchAction(event: DeviceInputEvent): void {
    // Forward all events to community plugin listeners
    try {
      const { dispatchPluginKeyEvent } = require('../plugins/plugin-loader');
      dispatchPluginKeyEvent(event);
    } catch { /* plugin-loader not ready yet — ignore */ }

    const profile = profileService.getActiveProfile();
    if (!profile) return;

    let action: ActionConfig | null = null;

    switch (event.type) {
      case 'key_down': {
        // If inside a folder and key 0 pressed, exit folder
        if (profileService.activeFolder !== null && event.index === 0) {
          profileService.exitFolder();
          this.pushDisplayKeysAnimated().catch(() => {});
          if (this.mainWindow) {
            this.mainWindow.webContents.send(IPC_CHANNELS.DEVICE_NAV, {
              page: profileService.activePage,
              folder: null,
            });
          }
          return;
        }

        // Look up key from the current display context (page or folder)
        const displayKeys = profileService.getDisplayKeys();
        const keyConfig = displayKeys[event.index];
        if (keyConfig?.action) action = keyConfig.action;
        break;
      }
      case 'encoder_cw': {
        const encConfig = profile.encoders[event.index];
        if (encConfig?.rotateClockwise) action = encConfig.rotateClockwise;
        break;
      }
      case 'encoder_ccw': {
        const encConfig = profile.encoders[event.index];
        if (encConfig?.rotateCounterClockwise) action = encConfig.rotateCounterClockwise;
        break;
      }
      case 'encoder_press': {
        const encConfig = profile.encoders[event.index];
        if (encConfig?.pressAction) action = encConfig.pressAction;
        break;
      }
      case 'touch_press':
      case 'touch_release': {
        const touchConfig = profile.touchZones[event.index];
        if (touchConfig?.action) action = touchConfig.action;
        break;
      }
      case 'swipe_left':
        if (profile.swipeLeft) action = profile.swipeLeft;
        break;
      case 'swipe_right':
        if (profile.swipeRight) action = profile.swipeRight;
        break;
    }

    if (action && action.type !== 'none') {
      // Handle navigation actions locally (no OS-level execution needed)
      if (action.type === 'folder') {
        // No nested folders — ignore if already inside one
        if (profileService.activeFolder !== null) return;
        // Enter folder — the key index is the one that was pressed
        profileService.enterFolder(event.index);
        this.pushDisplayKeysAnimated().catch(() => {});
        if (this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.DEVICE_NAV, {
            page: profileService.activePage,
            folder: event.index,
          });
        }
        return;
      }
      if (action.type === 'page_next' || action.type === 'page_previous' || action.type === 'page_goto') {
        if (action.type === 'page_next') profileService.nextPage();
        else if (action.type === 'page_previous') profileService.previousPage();
        else if (action.type === 'page_goto' && action.pageIndex !== undefined) {
          profileService.setActivePage(action.pageIndex);
        }
        this.pushDisplayKeysAnimated().catch(() => {});
        if (this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.DEVICE_NAV, {
            page: profileService.activePage,
            folder: null,
          });
        }
        return;
      }

      executeAction(action)
        .then(() => {
          const overlay = action!.overlay ?? getDefaultOverlay(action!);
          if (overlay) {
            overlayService.show(overlay).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }

  private handleDisconnect(): void {
    this.disconnect();
    if (this.mainWindow) {
      this.mainWindow.webContents.send(IPC_CHANNELS.DEVICE_STATUS, {
        connected: false,
      });
    }
    // Notify plugins of disconnect
    try {
      const { dispatchPluginDeviceChange } = require('../plugins/plugin-loader');
      dispatchPluginDeviceChange(false);
    } catch { /* plugin-loader not ready — ignore */ }
  }
}

function getDefaultOverlay(action: ActionConfig): OverlayConfig | null {
  if (action.type === 'media' && action.mediaAction) {
    const volumeActions = ['volume_up', 'volume_down', 'mute'];
    if (volumeActions.includes(action.mediaAction)) {
      const iconMap: Record<string, string> = {
        volume_up: 'volume-2',
        volume_down: 'volume-1',
        mute: 'volume-x',
      };
      return {
        type: 'progress_bar',
        valueSource: 'volume',
        label: 'Volume',
        icon: iconMap[action.mediaAction] ?? 'volume-2',
      };
    }
  }

  if (action.type === 'system' && action.systemAction) {
    if (action.systemAction === 'brightness_up' || action.systemAction === 'brightness_down') {
      return {
        type: 'progress_bar',
        valueSource: 'brightness',
        label: 'Brightness',
        icon: 'sun',
      };
    }
  }

  return null;
}

export const hidService = new HidService();
