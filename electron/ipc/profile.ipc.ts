import { dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import type { IpcResponse } from '../../shared/types/ipc.types';
import type { Profile, ProfileSummary } from '../../shared/types/profile.types';
import { profileService } from '../services/profile.service';
import { hidService } from '../services/hid.service';

export function registerProfileIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_LIST,
    (): IpcResponse<ProfileSummary[]> => {
      try {
        return { success: true, data: profileService.listProfiles() };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROFILE_GET,
    (_event, id: string): IpcResponse<Profile | null> => {
      try {
        return { success: true, data: profileService.getProfile(id) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROFILE_SAVE,
    (_event, profile: Profile): IpcResponse<void> => {
      try {
        profileService.saveProfile(profile);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROFILE_DELETE,
    (_event, id: string): IpcResponse<void> => {
      try {
        profileService.deleteProfile(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Activate a profile: set as active and push all images to device */
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_ACTIVATE,
    async (_event, id: string): Promise<IpcResponse<Profile>> => {
      try {
        const profile = profileService.getProfile(id);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        profileService.setActiveProfileId(id);

        // Push all images to device (lock prevents concurrent HID writes)
        if (hidService.isConnected()) {
          await hidService.pushActiveProfileImages();
        }

        return { success: true, data: profile };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Export a profile to a .json file via Save dialog */
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_EXPORT,
    async (_event, id: string): Promise<IpcResponse<string | null>> => {
      try {
        const profile = profileService.getProfile(id);
        if (!profile) {
          return { success: false, error: 'Profile not found' };
        }

        const safeName = profile.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const result = await dialog.showSaveDialog({
          title: 'Export Profile',
          defaultPath: `${safeName}.openinput`,
          filters: [
            { name: 'OpenInput Profile', extensions: ['openinput'] },
            { name: 'JSON', extensions: ['json'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return { success: true, data: null };
        }

        fs.writeFileSync(result.filePath, JSON.stringify(profile, null, 2), 'utf-8');
        return { success: true, data: result.filePath };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Copy all profiles as JSON to clipboard */
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_COPY_ALL,
    (): IpcResponse<string> => {
      try {
        const summaries = profileService.listProfiles();
        const allProfiles = summaries
          .map((s) => profileService.getProfile(s.id))
          .filter(Boolean);
        return { success: true, data: JSON.stringify(allProfiles, null, 2) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  /** Import a profile from a .json / .openinput file via Open dialog */
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_IMPORT,
    async (): Promise<IpcResponse<Profile | null>> => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Import Profile',
          filters: [
            { name: 'OpenInput Profile', extensions: ['openinput', 'json'] },
          ],
          properties: ['openFile'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        const content = fs.readFileSync(result.filePaths[0], 'utf-8');
        const imported = JSON.parse(content) as Profile;

        // Validate basic structure (accept old `keys` or new `pages` format)
        if (!imported.name || (!imported.pages && !(imported as any).keys)) {
          return { success: false, error: 'Invalid profile file' };
        }

        // Generate new ID to avoid overwriting existing profiles
        const now = new Date().toISOString();
        imported.id = `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        imported.name = `${imported.name} (Imported)`;
        imported.createdAt = now;
        imported.updatedAt = now;

        profileService.saveProfile(imported);
        return { success: true, data: imported };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
