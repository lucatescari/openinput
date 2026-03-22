import { app } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { pluginRegistry } from './plugin-registry';
import { profileService } from '../services/profile.service';
import type { CommunityPluginExport } from '../../shared/types/community-plugin.types';

/** All loaded community plugins, keyed by ID. */
const loadedPlugins = new Map<string, CommunityPluginExport>();

/** Plugins directory path. */
function getPluginsDir(): string {
  return path.join(app.getPath('userData'), 'store', 'plugins');
}

/**
 * Scan the installed plugins directory and load any community plugins.
 * - Device plugins are registered with the device `pluginRegistry`
 * - Action plugins are stored for later use by the action executor
 * - Profile plugins are loaded but profiles are NOT re-imported (import is one-time at install)
 *
 * Called once at app startup (before device scanning begins).
 */
export async function loadInstalledPlugins(): Promise<void> {
  const pluginsDir = getPluginsDir();

  let entries: string[];
  try {
    entries = await fs.readdir(pluginsDir);
  } catch {
    // No plugins directory — nothing to load
    return;
  }

  for (const entry of entries) {
    const pluginDir = path.join(pluginsDir, entry);
    const indexPath = path.join(pluginDir, 'index.js');

    try {
      // Check the bundle exists
      await fs.access(indexPath);

      // Load the module — plugins are CommonJS bundles
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(indexPath);
      const plugin: CommunityPluginExport = mod.default ?? mod;

      if (!plugin.id || !plugin.name) {
        console.warn(`[plugin-loader] Skipping ${entry}: missing id or name`);
        continue;
      }

      // Initialize if the plugin has a startup hook
      if (plugin.initialize) {
        await plugin.initialize();
      }

      // If the plugin provides a device driver, register it
      if ((plugin as any).devicePlugin) {
        pluginRegistry.register((plugin as any).devicePlugin);
        console.log(`[plugin-loader] Registered device plugin: ${plugin.name}`);
      }

      // Store for action execution
      loadedPlugins.set(plugin.id, plugin);
      console.log(`[plugin-loader] Loaded community plugin: ${plugin.name} v${plugin.version}`);
    } catch (err) {
      console.error(`[plugin-loader] Failed to load plugin "${entry}":`, err);
    }
  }
}

/**
 * Load a single plugin by ID (hot-load after install).
 * Used for action and profile plugins so the user doesn't need to restart.
 *
 * For profile plugins, this also imports the profiles into the user's library.
 *
 * @returns Number of profiles imported (0 for non-profile plugins)
 */
export async function loadSinglePlugin(pluginId: string): Promise<number> {
  const pluginsDir = getPluginsDir();
  const indexPath = path.join(pluginsDir, pluginId, 'index.js');

  // Clear Node.js require cache to ensure fresh load
  // (handles reinstall / upgrade scenarios)
  try {
    delete require.cache[require.resolve(indexPath)];
  } catch {
    // resolve may fail if never loaded — that's fine
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(indexPath);
  const plugin: CommunityPluginExport = mod.default ?? mod;

  if (!plugin.id || !plugin.name) {
    throw new Error(`Plugin "${pluginId}" is missing id or name`);
  }

  // Initialize
  if (plugin.initialize) {
    await plugin.initialize();
  }

  // Device plugins cannot be hot-loaded — they need app restart
  if ((plugin as any).devicePlugin) {
    console.log(`[plugin-loader] Device plugin "${plugin.name}" will be active after restart`);
    return 0;
  }

  // Store for action execution
  loadedPlugins.set(plugin.id, plugin);
  console.log(`[plugin-loader] Hot-loaded plugin: ${plugin.name} v${plugin.version}`);

  // Import profiles if the plugin provides them
  let importedCount = 0;
  if (plugin.profiles && plugin.profiles.length > 0) {
    for (const profile of plugin.profiles) {
      try {
        // Create a fresh copy with a new unique ID so there are no collisions
        const imported = profileService.createProfile(profile.name);
        // Copy the profile data over
        imported.pages = profile.pages ?? [{ name: 'Page 1', keys: {} }];
        imported.encoders = profile.encoders ?? {};
        imported.touchZones = profile.touchZones ?? {};
        if (profile.swipeLeft) imported.swipeLeft = profile.swipeLeft;
        if (profile.swipeRight) imported.swipeRight = profile.swipeRight;
        if (profile.iconStyle) imported.iconStyle = profile.iconStyle;
        if (profile.screensaverTimeout !== undefined) imported.screensaverTimeout = profile.screensaverTimeout;
        profileService.saveProfile(imported);
        importedCount++;
        console.log(`[plugin-loader] Imported profile: ${profile.name}`);
      } catch (err) {
        console.error(`[plugin-loader] Failed to import profile "${profile.name}":`, err);
      }
    }
    console.log(`[plugin-loader] Imported ${importedCount} profile(s) from "${plugin.name}"`);
  }

  return importedCount;
}

/**
 * Unload a plugin from memory (on uninstall).
 * Calls dispose() if the plugin has it, then removes from the loaded map.
 * Does NOT remove profiles that were imported (those are user data now).
 */
export function unloadPlugin(pluginId: string): void {
  const plugin = loadedPlugins.get(pluginId);
  if (plugin) {
    try {
      plugin.dispose?.();
    } catch (err) {
      console.error(`[plugin-loader] Error disposing plugin "${pluginId}":`, err);
    }
    loadedPlugins.delete(pluginId);
    console.log(`[plugin-loader] Unloaded plugin: ${pluginId}`);
  }

  // Clear require cache so a reinstall gets fresh code
  try {
    const indexPath = path.join(getPluginsDir(), pluginId, 'index.js');
    delete require.cache[require.resolve(indexPath)];
  } catch {
    // Ignore — may not be in cache
  }
}

/**
 * Get a loaded community plugin by ID.
 * Used by the action executor to dispatch plugin actions.
 */
export function getCommunityPlugin(id: string): CommunityPluginExport | undefined {
  return loadedPlugins.get(id);
}

/**
 * Get all loaded community plugins.
 * Used by the IPC layer to send action metadata to the renderer.
 */
export function getAllCommunityPlugins(): CommunityPluginExport[] {
  return [...loadedPlugins.values()];
}

/**
 * Dispose all loaded plugins (call on app quit).
 */
export function disposeAllPlugins(): void {
  for (const plugin of loadedPlugins.values()) {
    try {
      plugin.dispose?.();
    } catch (err) {
      console.error(`[plugin-loader] Error disposing plugin "${plugin.id}":`, err);
    }
  }
  loadedPlugins.clear();
}
