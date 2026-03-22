import { Injectable, inject } from '@angular/core';
import { IpcService } from './ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import type {
  StoreRegistry,
  StorePlugin,
  InstalledPlugin,
} from '../../../../shared/types/store.types';

/** Result returned from the install IPC handler. */
export interface InstallResult {
  installed: InstalledPlugin[];
  /** True if the plugin needs an app restart (device plugins only). */
  needsRestart: boolean;
  /** Number of profiles imported (profile plugins only). */
  profilesImported: number;
}

@Injectable({ providedIn: 'root' })
export class StoreDataService {
  private readonly ipc = inject(IpcService);

  /** Fetch the plugin registry from GitHub (via main process). */
  async fetchRegistry(): Promise<StoreRegistry> {
    return this.ipc.invoke<StoreRegistry>(
      IPC_CHANNELS.STORE_FETCH_REGISTRY,
    );
  }

  /** Install a plugin. Returns install result with hot-load info. */
  async installPlugin(plugin: StorePlugin): Promise<InstallResult> {
    return this.ipc.invoke<InstallResult>(
      IPC_CHANNELS.STORE_INSTALL_PLUGIN,
      plugin,
    );
  }

  /** Uninstall a plugin by ID. Returns updated installed list. */
  async uninstallPlugin(pluginId: string): Promise<InstalledPlugin[]> {
    return this.ipc.invoke<InstalledPlugin[]>(
      IPC_CHANNELS.STORE_UNINSTALL_PLUGIN,
      pluginId,
    );
  }

  /** Get all locally installed plugins. */
  async getInstalled(): Promise<InstalledPlugin[]> {
    return this.ipc.invoke<InstalledPlugin[]>(
      IPC_CHANNELS.STORE_GET_INSTALLED,
    );
  }
}
