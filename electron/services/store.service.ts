import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  StoreRegistry,
  StorePlugin,
  InstalledPlugin,
} from '../../shared/types/store.types';

// ── Configuration ───────────────────────────────────────────────────────
const REGISTRY_URL =
  'https://raw.githubusercontent.com/lucatescari/openinput-plugins/main/registry.json';
const REGISTRY_BASE =
  'https://raw.githubusercontent.com/lucatescari/openinput-plugins/main/';

/** How long before the cached registry is considered stale (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Paths ───────────────────────────────────────────────────────────────
function getStoreDir(): string {
  return path.join(app.getPath('userData'), 'store');
}
function getPluginsDir(): string {
  return path.join(getStoreDir(), 'plugins');
}
function getInstalledManifestPath(): string {
  return path.join(getStoreDir(), 'installed.json');
}

// ── Service ─────────────────────────────────────────────────────────────

class StoreService {
  private cachedRegistry: StoreRegistry | null = null;
  private cacheTimestamp = 0;

  /** Ensure storage directories exist. */
  private async ensureDirs(): Promise<void> {
    await fs.mkdir(getPluginsDir(), { recursive: true });
  }

  // ── Registry ────────────────────────────────────────────────────────

  /**
   * Fetch the plugin registry from GitHub.
   * Returns cached version if still fresh.
   */
  async fetchRegistry(): Promise<StoreRegistry> {
    // Return cache if fresh
    if (
      this.cachedRegistry &&
      Date.now() - this.cacheTimestamp < CACHE_TTL_MS
    ) {
      return this.cachedRegistry;
    }

    try {
      const res = await fetch(REGISTRY_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as StoreRegistry;
      this.cachedRegistry = data;
      this.cacheTimestamp = Date.now();
      return data;
    } catch (err) {
      // If we have a stale cache, return it rather than failing
      if (this.cachedRegistry) return this.cachedRegistry;
      // Return empty registry on first failure (repo may not exist yet)
      return { version: 1, plugins: [] };
    }
  }

  // ── Installed plugins ───────────────────────────────────────────────

  /** Read the local installed-plugins manifest. */
  async getInstalled(): Promise<InstalledPlugin[]> {
    try {
      const raw = await fs.readFile(getInstalledManifestPath(), 'utf-8');
      return JSON.parse(raw) as InstalledPlugin[];
    } catch {
      return [];
    }
  }

  /** Persist the installed-plugins manifest. */
  private async saveInstalled(list: InstalledPlugin[]): Promise<void> {
    await this.ensureDirs();
    await fs.writeFile(
      getInstalledManifestPath(),
      JSON.stringify(list, null, 2),
    );
  }

  // ── Install / Uninstall ─────────────────────────────────────────────

  /**
   * Download and install a plugin from the registry.
   * Returns the updated installed list.
   */
  async installPlugin(plugin: StorePlugin): Promise<InstalledPlugin[]> {
    await this.ensureDirs();

    const bundleUrl = plugin.downloadUrl.startsWith('http')
      ? plugin.downloadUrl
      : REGISTRY_BASE + plugin.downloadUrl;

    const res = await fetch(bundleUrl);
    if (!res.ok) {
      throw new Error(`Failed to download plugin: HTTP ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    // Write plugin bundle to local storage
    const pluginDir = path.join(getPluginsDir(), plugin.id);
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'index.js'), buffer);

    // Write plugin metadata alongside
    await fs.writeFile(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(plugin, null, 2),
    );

    // Update installed manifest
    const installed = await this.getInstalled();
    const existing = installed.findIndex((p) => p.id === plugin.id);
    const entry: InstalledPlugin = {
      id: plugin.id,
      version: plugin.version,
      type: plugin.type,
      installedAt: new Date().toISOString(),
    };

    if (existing >= 0) {
      installed[existing] = entry;
    } else {
      installed.push(entry);
    }

    await this.saveInstalled(installed);
    return installed;
  }

  /**
   * Uninstall a plugin by ID.
   * Returns the updated installed list.
   */
  async uninstallPlugin(pluginId: string): Promise<InstalledPlugin[]> {
    // Remove plugin files
    const pluginDir = path.join(getPluginsDir(), pluginId);
    try {
      await fs.rm(pluginDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }

    // Update installed manifest
    const installed = await this.getInstalled();
    const filtered = installed.filter((p) => p.id !== pluginId);
    await this.saveInstalled(filtered);
    return filtered;
  }
}

export const storeService = new StoreService();
