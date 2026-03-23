/** Plugin type available in the store. */
export type StorePluginType = 'device' | 'action' | 'profile';

/** Supported platforms. */
export type PluginPlatform = 'macos' | 'windows';

/**
 * Permissions a plugin may request.
 * Displayed to the user before installation.
 */
export type PluginPermission =
  | 'notifications'   // Show desktop notifications
  | 'shell'           // Execute shell commands
  | 'network'         // Make HTTP requests
  | 'filesystem'      // Read/write files outside the plugin directory
  | 'clipboard'       // Access the system clipboard
  | 'keyboard'        // Simulate keyboard input
  | 'system'          // Access system APIs (brightness, volume, etc.)
  ;

/** A single plugin entry in the store registry. */
export interface StorePlugin {
  /** Unique plugin identifier (e.g. "spotify", "obs-studio"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description (1-2 sentences). */
  description: string;
  /** Author's GitHub username. */
  author: string;
  /** Semver version string. */
  version: string;
  /** Plugin category. */
  type: StorePluginType;
  /** Icon URL (relative to registry base or absolute). */
  icon?: string;
  /** Searchable tags. */
  tags: string[];
  /** Relative path to the plugin bundle within the registry repo. */
  downloadUrl: string;
  /** Link to the plugin's homepage or repo. */
  homepage?: string;
  /** Minimum OpenInput version required. */
  minAppVersion?: string;
  /**
   * Platforms this plugin supports.
   * If omitted, the plugin is assumed to work on all platforms.
   */
  platforms?: PluginPlatform[];
  /**
   * Permissions this plugin requires.
   * Shown to the user in a confirmation dialog before installation.
   */
  permissions?: PluginPermission[];
}

/** The root registry manifest fetched from GitHub. */
export interface StoreRegistry {
  /** Schema version of this registry format. */
  version: number;
  /** All available plugins. */
  plugins: StorePlugin[];
}

/** Locally installed plugin metadata (stored on disk). */
export interface InstalledPlugin {
  id: string;
  version: string;
  type: StorePluginType;
  installedAt: string;
}
