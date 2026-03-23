import { app, dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import type { IpcResponse } from '../../shared/types/ipc.types';
import { registerDeviceIpcHandlers } from './device.ipc';
import { registerKeysIpcHandlers } from './keys.ipc';
import { registerProfileIpcHandlers } from './profile.ipc';
import { registerStoreIpc } from './store.ipc';
import { updaterService } from '../services/updater.service';
import type { UpdateStatus } from '../services/updater.service';

export function registerAllIpcHandlers(): void {
  registerAppHandlers();
  registerDeviceIpcHandlers();
  registerKeysIpcHandlers();
  registerProfileIpcHandlers();
  registerStoreIpc();
}

function registerAppHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.APP_GET_VERSION,
    (): IpcResponse<string> => {
      return { success: true, data: app.getVersion() };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_BROWSE,
    async (): Promise<IpcResponse<string | null>> => {
      try {
        const isMac = process.platform === 'darwin';
        const defaultPath = isMac ? '/Applications' : 'C:\\Program Files';
        const result = await dialog.showOpenDialog({
          title: 'Select Application',
          defaultPath,
          filters: isMac
            ? []
            : [{ name: 'Executables', extensions: ['exe', 'lnk'] }],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        return { success: true, data: result.filePaths[0] };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_BROWSE,
    async (): Promise<IpcResponse<string | null>> => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select File',
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        return { success: true, data: result.filePaths[0] };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
    async (_event, url: string): Promise<IpcResponse<void>> => {
      try {
        // Only allow http/https URLs
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { success: false, error: 'Only http/https URLs are allowed' };
        }
        await shell.openExternal(url);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // ── Updates ────────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.APP_CHECK_UPDATE,
    async (): Promise<IpcResponse<UpdateStatus>> => {
      try {
        const status = await updaterService.checkForUpdates();
        return { success: true, data: status };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_INSTALL_UPDATE,
    async (): Promise<IpcResponse<void>> => {
      try {
        await updaterService.downloadAndInstall();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.APP_UPDATE_STATUS,
    (): IpcResponse<UpdateStatus> => {
      return { success: true, data: updaterService.getStatus() };
    },
  );
}
