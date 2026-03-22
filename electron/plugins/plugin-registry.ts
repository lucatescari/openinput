import type { DevicePlugin } from '../../shared/types/device-plugin.types';

class PluginRegistry {
  private plugins = new Map<string, DevicePlugin>();

  /** Register a device plugin. */
  register(plugin: DevicePlugin): void {
    this.plugins.set(plugin.meta.id, plugin);
  }

  /** Get all registered plugins. */
  getAll(): DevicePlugin[] {
    return [...this.plugins.values()];
  }

  /** Find a plugin matching the given VID / PID / usagePage. */
  findMatch(vendorId: number, productId: number, usagePage?: number): DevicePlugin | null {
    for (const plugin of this.plugins.values()) {
      for (const m of plugin.meta.match) {
        if (
          m.vendorId === vendorId &&
          m.productIds.includes(productId) &&
          (m.usagePage === undefined || m.usagePage === usagePage)
        ) {
          return plugin;
        }
      }
    }
    return null;
  }

  /** Get a plugin by its ID. */
  getById(id: string): DevicePlugin | undefined {
    return this.plugins.get(id);
  }
}

export const pluginRegistry = new PluginRegistry();
