export type ActionType =
  | 'hotkey'
  | 'hotkey_switch'
  | 'launch_app'
  | 'close_app'
  | 'media'
  | 'system'
  | 'open_url'
  | 'open_file'
  | 'text'
  | 'multi_action'
  | 'folder'
  | 'page_next'
  | 'page_previous'
  | 'page_goto'
  | 'plugin'
  | 'none';

export type MediaAction =
  | 'play_pause'
  | 'next_track'
  | 'prev_track'
  | 'volume_up'
  | 'volume_down'
  | 'mute';

export type SystemAction = 'brightness_up' | 'brightness_down';

import type { OverlayConfig } from './overlay.types';

export interface ActionConfig {
  type: ActionType;
  label?: string;

  /** For type 'hotkey' */
  hotkey?: { modifiers: string[]; key: string };

  /** For type 'hotkey_switch' — second hotkey to toggle between */
  hotkey2?: { modifiers: string[]; key: string };

  /** For type 'launch_app' or 'close_app' */
  appPath?: string;

  /** For type 'media' */
  mediaAction?: MediaAction;

  /** For type 'system' */
  systemAction?: SystemAction;

  /** For type 'open_url' */
  url?: string;

  /** For type 'open_file' */
  filePath?: string;

  /** For type 'text' — text to type out */
  text?: string;

  /** For type 'multi_action' */
  actions?: ActionConfig[];
  delayMs?: number;

  /** For type 'page_goto' — target page index (0-based) */
  pageIndex?: number;

  /** For type 'plugin' — community plugin identifier */
  pluginId?: string;
  /** For type 'plugin' — action ID within the plugin */
  pluginActionId?: string;

  /**
   * Optional overlay shown on the touch zones when this action executes.
   * Plugins provide a sensible default; users can override or remove it.
   */
  overlay?: OverlayConfig;
}
