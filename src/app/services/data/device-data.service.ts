import { inject, Injectable } from '@angular/core';
import { IpcService } from './ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import type { DeviceInfo, DeviceInputEvent } from '../../../../shared/types/device.types';
import type { DeviceLayout } from '../../../../shared/types/device-plugin.types';

@Injectable({ providedIn: 'root' })
export class DeviceDataService {
  private readonly ipc = inject(IpcService);

  async listDevices(): Promise<DeviceInfo[]> {
    return (await this.ipc.invoke<DeviceInfo[]>(IPC_CHANNELS.DEVICE_LIST)) ?? [];
  }

  async getRegisteredPlugins(): Promise<{ id: string; name: string }[]> {
    return (
      (await this.ipc.invoke<{ id: string; name: string }[]>(
        IPC_CHANNELS.DEVICE_GET_REGISTERED_PLUGINS,
      )) ?? []
    );
  }

  async connect(path: string): Promise<DeviceInfo> {
    return this.ipc.invoke<DeviceInfo>(IPC_CHANNELS.DEVICE_CONNECT, path);
  }

  async disconnect(): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.DEVICE_DISCONNECT);
  }

  async getStatus(): Promise<DeviceInfo | null> {
    return this.ipc.invoke<DeviceInfo | null>(IPC_CHANNELS.DEVICE_STATUS);
  }

  async getLayout(): Promise<DeviceLayout | null> {
    return this.ipc.invoke<DeviceLayout | null>(IPC_CHANNELS.DEVICE_LAYOUT);
  }

  async setBrightness(level: number): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.DEVICE_SET_BRIGHTNESS, level);
  }

  async setNav(pageIndex: number, folder: number | null = null): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.NAV_SET_PAGE, pageIndex, folder);
  }

  onDeviceEvent(callback: (event: DeviceInputEvent) => void): () => void {
    return this.ipc.on(IPC_CHANNELS.DEVICE_EVENT, (event: unknown) => {
      callback(event as DeviceInputEvent);
    });
  }

  onDeviceStatus(callback: (status: { connected: boolean }) => void): () => void {
    return this.ipc.on(IPC_CHANNELS.DEVICE_STATUS, (status: unknown) => {
      callback(status as { connected: boolean });
    });
  }

  onDeviceNav(callback: (nav: { page: number; folder: number | null }) => void): () => void {
    return this.ipc.on(IPC_CHANNELS.DEVICE_NAV, (nav: unknown) => {
      callback(nav as { page: number; folder: number | null });
    });
  }
}
