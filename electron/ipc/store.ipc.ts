import { ipcMain } from 'electron';
import { IPC_CHANNELS, type IpcResponse } from '../../shared/types/ipc.types';
import type {
  StoreRegistry,
  StorePlugin,
  InstalledPlugin,
} from '../../shared/types/store.types';
import { storeService } from '../services/store.service';
import {
  getAllCommunityPlugins,
  loadSinglePlugin,
  unloadPlugin,
} from '../plugins/plugin-loader';

/** Serialisable community action info for the renderer. */
interface CommunityActionInfo {
  pluginId: string;
  pluginName: string;
  pluginIcon: string;
  actions: {
    id: string;
    name: string;
    icon: string;
    description: string;
  }[];
}

/** Extended install result that tells the renderer what happened. */
interface InstallResult {
  installed: InstalledPlugin[];
  /** True if the plugin needs an app restart (device plugins only). */
  needsRestart: boolean;
  /** Number of profiles imported (profile plugins only). */
  profilesImported: number;
}

export function registerStoreIpc(): void {
  // Fetch the remote registry
  ipcMain.handle(
    IPC_CHANNELS.STORE_FETCH_REGISTRY,
    async (): Promise<IpcResponse<StoreRegistry>> => {
      try {
        const registry = await storeService.fetchRegistry();
        return { success: true, data: registry };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // Install a plugin
  ipcMain.handle(
    IPC_CHANNELS.STORE_INSTALL_PLUGIN,
    async (
      _event,
      plugin: StorePlugin,
    ): Promise<IpcResponse<InstallResult>> => {
      try {
        const installed = await storeService.installPlugin(plugin);

        let needsRestart = false;
        let profilesImported = 0;

        if (plugin.type === 'device') {
          // Device plugins need a restart to register with the plugin registry
          needsRestart = true;
        } else {
          // Action and profile plugins can be hot-loaded immediately
          try {
            profilesImported = await loadSinglePlugin(plugin.id);
          } catch (err) {
            console.error(`[store] Failed to hot-load plugin "${plugin.id}":`, err);
            // Plugin was saved to disk, so it'll load on next restart
            needsRestart = true;
          }
        }

        return {
          success: true,
          data: { installed, needsRestart, profilesImported },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // Uninstall a plugin
  ipcMain.handle(
    IPC_CHANNELS.STORE_UNINSTALL_PLUGIN,
    async (
      _event,
      pluginId: string,
    ): Promise<IpcResponse<InstalledPlugin[]>> => {
      try {
        // Unload from memory first (disposes action plugins, clears cache)
        unloadPlugin(pluginId);
        const installed = await storeService.uninstallPlugin(pluginId);
        return { success: true, data: installed };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // Get installed plugins
  ipcMain.handle(
    IPC_CHANNELS.STORE_GET_INSTALLED,
    async (): Promise<IpcResponse<InstalledPlugin[]>> => {
      try {
        const installed = await storeService.getInstalled();
        return { success: true, data: installed };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // Get loaded community actions (for the action palette)
  ipcMain.handle(
    IPC_CHANNELS.STORE_GET_COMMUNITY_ACTIONS,
    (): IpcResponse<CommunityActionInfo[]> => {
      try {
        const plugins = getAllCommunityPlugins();
        const result: CommunityActionInfo[] = plugins
          .filter((p) => p.actions && p.actions.length > 0)
          .map((p) => ({
            pluginId: p.id,
            pluginName: p.name,
            pluginIcon: 'puzzle',
            actions: p.actions!.map((a) => ({
              id: a.id,
              name: a.name,
              icon: a.icon,
              description: a.description,
            })),
          }));
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
