import type { Profile } from './profile.types';

/**
 * Contract for community plugin bundles.
 *
 * A plugin's `index.js` must export a default object matching this interface.
 * The module is loaded via `require()` in the Electron main process, so it has
 * full Node.js access. All plugins go through a code review before being
 * published to the store.
 */
export interface CommunityPluginExport {
  /** Unique plugin identifier — must match the store registry entry. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description. */
  description: string;
  /** Semver version. */
  version: string;

  /**
   * Actions provided by this plugin.
   * Each one appears as a draggable card in the action palette.
   */
  actions?: CommunityActionDef[];

  /**
   * Profiles provided by this plugin (profile-type plugins).
   * Each one is imported into the user's profile list on install.
   */
  profiles?: Profile[];

  /** Called once after the plugin is loaded. */
  initialize?(): Promise<void>;

  /**
   * Called when the user presses a key/encoder assigned to one of this
   * plugin's actions.
   *
   * @param actionId  The `id` of the action (from the `actions` array)
   * @param config    The full serialised config stored in the profile
   */
  execute?(actionId: string, config: Record<string, unknown>): Promise<void>;

  /** Called when the plugin is unloaded (app quit or uninstall). */
  dispose?(): void;
}

/** A single action definition within a community plugin. */
export interface CommunityActionDef {
  /** Unique ID within this plugin (e.g. 'play', 'notify'). */
  id: string;
  /** Display name shown on the action card. */
  name: string;
  /** Lucide icon name for the card. */
  icon: string;
  /** Short tooltip description. */
  description: string;
}
