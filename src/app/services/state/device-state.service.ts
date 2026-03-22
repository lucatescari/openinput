import { inject, Injectable, signal, computed, OnDestroy } from '@angular/core';
import { DeviceDataService } from '../data/device-data.service';
import { IpcService } from '../data/ipc.service';
import type {
  DeviceInfo,
  DeviceStatus,
  DeviceInputEvent,
} from '../../../../shared/types/device.types';
import type { DeviceLayout } from '../../../../shared/types/device-plugin.types';

@Injectable({ providedIn: 'root' })
export class DeviceStateService implements OnDestroy {
  private readonly deviceData = inject(DeviceDataService);
  private readonly ipc = inject(IpcService);

  private readonly _devices = signal<DeviceInfo[]>([]);
  private readonly _activeDevice = signal<DeviceInfo | null>(null);
  private readonly _status = signal<DeviceStatus>('disconnected');
  private readonly _layout = signal<DeviceLayout | null>(null);
  private readonly _brightness = signal(80);
  private readonly _lastEvent = signal<DeviceInputEvent | null>(null);
  private readonly _eventLog = signal<DeviceInputEvent[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _hasDevicePlugins = signal<boolean | null>(null);

  readonly devices = this._devices.asReadonly();
  readonly activeDevice = this._activeDevice.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isConnected = computed(() => this._status() === 'connected');
  readonly layout = this._layout.asReadonly();
  readonly brightness = this._brightness.asReadonly();
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly eventLog = this._eventLog.asReadonly();
  readonly error = this._error.asReadonly();
  /** Whether any device plugins (drivers) are registered. null = not yet checked. */
  readonly hasDevicePlugins = this._hasDevicePlugins.asReadonly();

  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeNav: (() => void) | null = null;
  private eventCallbacks: Array<(event: DeviceInputEvent) => void> = [];
  private navCallbacks: Array<(nav: { page: number; folder: number | null }) => void> = [];

  constructor() {
    this.init();
  }

  private init(): void {
    if (!this.ipc.isElectron) {
      // Browser-only dev mode — mock a connected device with AKP05-like layout
      // (In Electron mode, the user installs device plugins from the store)
      this._status.set('connected');
      this._hasDevicePlugins.set(true);
      this._activeDevice.set({
        path: '/dev/mock',
        pluginId: 'ajazz-akp05',
        name: 'AJAZZ AKP05 (Mock)',
        serialNumber: 'DEV-001',
        connected: true,
      });
      this._layout.set({
        keys: { rows: 2, cols: 5, count: 10, imageSpec: { width: 112, height: 112, rotation: 180, format: 'jpeg' } },
        encoders: { count: 4, hasPress: true },
        touchZones: { count: 4, imageSpec: { width: 176, height: 112, rotation: 180, format: 'jpeg' } },
        swipe: true,
      });
      return;
    }

    this.unsubscribeEvent = this.deviceData.onDeviceEvent((event) => {
      this._lastEvent.set(event);
      this._eventLog.update((log) => [event, ...log].slice(0, 50));
      for (const cb of this.eventCallbacks) {
        cb(event);
      }
    });

    this.unsubscribeNav = this.deviceData.onDeviceNav((nav) => {
      for (const cb of this.navCallbacks) {
        cb(nav);
      }
    });

    this.unsubscribeStatus = this.deviceData.onDeviceStatus((status) => {
      if (!status.connected) {
        this._status.set('disconnected');
        this._activeDevice.set(null);
        this._layout.set(null);
      } else {
        this._status.set('connected');
        this.checkStatus();
        this.fetchLayout();
      }
    });

    this.checkStatus();
  }

  async scanDevices(): Promise<void> {
    try {
      const [devices, plugins] = await Promise.all([
        this.deviceData.listDevices(),
        this.deviceData.getRegisteredPlugins(),
      ]);
      this._devices.set(devices ?? []);
      this._hasDevicePlugins.set((plugins ?? []).length > 0);
      this._error.set(null);
    } catch (err) {
      this._error.set((err as Error).message);
    }
  }

  async connect(devicePath: string): Promise<void> {
    try {
      this._status.set('connecting');
      this._error.set(null);
      const info = await this.deviceData.connect(devicePath);
      this._activeDevice.set(info);
      this._status.set('connected');
      await this.fetchLayout();
    } catch (err) {
      this._status.set('error');
      this._error.set((err as Error).message);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.deviceData.disconnect();
      this._status.set('disconnected');
      this._activeDevice.set(null);
      this._layout.set(null);
    } catch (err) {
      this._error.set((err as Error).message);
    }
  }

  async setBrightness(level: number): Promise<void> {
    try {
      await this.deviceData.setBrightness(level);
      this._brightness.set(level);
    } catch (err) {
      this._error.set((err as Error).message);
    }
  }

  onDeviceEvent(callback: (event: DeviceInputEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  clearEventLog(): void {
    this._eventLog.set([]);
  }

  /** Subscribe to device navigation events (page/folder changes triggered on the device) */
  onDeviceNav(callback: (nav: { page: number; folder: number | null }) => void): () => void {
    this.navCallbacks.push(callback);
    return () => {
      this.navCallbacks = this.navCallbacks.filter((cb) => cb !== callback);
    };
  }

  private async checkStatus(): Promise<void> {
    try {
      const info = await this.deviceData.getStatus();
      if (info?.connected) {
        this._activeDevice.set(info);
        this._status.set('connected');
        await this.fetchLayout();
      }
    } catch {
      // Not connected yet
    }
  }

  private async fetchLayout(): Promise<void> {
    try {
      const layout = await this.deviceData.getLayout();
      this._layout.set(layout);
    } catch {
      // Layout not available
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeEvent?.();
    this.unsubscribeStatus?.();
    this.unsubscribeNav?.();
  }
}
