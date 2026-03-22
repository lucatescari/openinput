import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import type { IpcResponse } from '../../shared/types/ipc.types';
import type { DeviceInfo } from '../../shared/types/device.types';
import type { DeviceLayout } from '../../shared/types/device-plugin.types';
import { hidService } from '../services/hid.service';
import { profileService } from '../services/profile.service';
import { pluginRegistry } from '../plugins/plugin-registry';

export function registerDeviceIpcHandlers(): void {
  /** Get the active device layout (from plugin) */
  ipcMain.handle(
    IPC_CHANNELS.DEVICE_LAYOUT,
    (): IpcResponse<DeviceLayout | null> => {
      return { success: true, data: hidService.getActiveLayout() };
    },
  );
  /** Get names of all registered device plugins (built-in + community). */
  ipcMain.handle(
    IPC_CHANNELS.DEVICE_GET_REGISTERED_PLUGINS,
    (): IpcResponse<{ id: string; name: string }[]> => {
      const plugins = pluginRegistry.getAll().map((p) => ({
        id: p.meta.id,
        name: p.meta.name,
      }));
      return { success: true, data: plugins };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_LIST,
    (): IpcResponse<DeviceInfo[]> => {
      try {
        const devices = hidService.listDevices();
        return { success: true, data: devices };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_CONNECT,
    async (_event, devicePath: string): Promise<IpcResponse<DeviceInfo>> => {
      try {
        const info = await hidService.connect(devicePath);
        return { success: true, data: info };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_DISCONNECT,
    (): IpcResponse<void> => {
      try {
        hidService.disconnect();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_STATUS,
    (): IpcResponse<DeviceInfo | null> => {
      try {
        const status = hidService.getStatus();
        return { success: true, data: status };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_SET_BRIGHTNESS,
    async (_event, level: number): Promise<IpcResponse<void>> => {
      try {
        await hidService.setBrightness(level);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /**
   * Set the active page and optional folder on the device (renderer → main).
   * Called whenever the UI navigates to a different page, enters a folder,
   * or exits a folder.
   */
  ipcMain.handle(
    IPC_CHANNELS.NAV_SET_PAGE,
    async (
      _event,
      pageIndex: number,
      folder: number | null = null,
    ): Promise<IpcResponse<{ page: number; folder: number | null }>> => {
      try {
        profileService.setActivePage(pageIndex);
        if (folder !== null) {
          profileService.enterFolder(folder);
        } else {
          profileService.exitFolder();
        }
        await hidService.pushDisplayKeysAnimated();
        return {
          success: true,
          data: {
            page: profileService.activePage,
            folder: profileService.activeFolder,
          },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
