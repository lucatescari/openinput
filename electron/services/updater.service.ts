import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

class UpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = { state: 'idle' };

  /** Initialise listeners. Call once after the main window is created. */
  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Don't auto-download — let the user decide
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Include prereleases (beta, alpha, rc)
    autoUpdater.allowPrerelease = true;

    autoUpdater.on('checking-for-update', () => {
      this.setStatus({ state: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.setStatus({
        state: 'available',
        version: info.version,
        releaseNotes:
          typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : undefined,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setStatus({ state: 'not-available', version: info.version });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setStatus({
        state: 'downloading',
        percent: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus({ state: 'downloaded', version: info.version });
    });

    autoUpdater.on('error', (err) => {
      this.setStatus({ state: 'error', message: err.message });
    });
  }

  /** Check for updates (non-blocking). Status is pushed via APP_UPDATE_STATUS. */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      this.setStatus({ state: 'checking' });
      await autoUpdater.checkForUpdates();
    } catch (err) {
      const message = (err as Error).message;
      this.setStatus({ state: 'error', message });
    }
    return this.status;
  }

  /** Download and install the available update. Quits and restarts the app. */
  async downloadAndInstall(): Promise<void> {
    if (this.status.state === 'available') {
      await autoUpdater.downloadUpdate();
      // 'update-downloaded' event will fire → then we can quit-and-install
    } else if (this.status.state === 'downloaded') {
      autoUpdater.quitAndInstall();
    }
  }

  /** Get current status (for initial renderer query). */
  getStatus(): UpdateStatus {
    return this.status;
  }

  // ── Internal ─────────────────────────────────────────────────────

  private setStatus(status: UpdateStatus): void {
    this.status = status;
    this.mainWindow?.webContents.send(IPC_CHANNELS.APP_UPDATE_STATUS, status);
  }
}

export const updaterService = new UpdaterService();
