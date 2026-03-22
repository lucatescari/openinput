import type { ActionConfig } from '../../../shared/types/action.types';

/**
 * An action plugin groups related actions together.
 * This is the standard structure that third-party plugins must follow.
 */
export interface ActionPlugin {
  /** Unique identifier, e.g. 'system', 'media', 'obs' */
  id: string;
  /** Display name shown in the palette header */
  name: string;
  /** Lucide icon name for the plugin section header */
  icon: string;
  /** Short description */
  description: string;
  /** Actions provided by this plugin */
  actions: ActionDefinition[];
}

/**
 * A single action that can be dragged onto a key/encoder/touch zone.
 */
export interface ActionDefinition {
  /** Unique ID within the plugin, e.g. 'hotkey', 'play_pause' */
  id: string;
  /** Display name shown on the action card */
  name: string;
  /** Lucide icon name for the card */
  icon: string;
  /** Short tooltip description */
  description: string;
  /**
   * The default ActionConfig assigned when this action is dropped.
   * Users configure specifics (e.g. which hotkey) after dropping.
   */
  defaultConfig: ActionConfig;
  /**
   * Which targets this action can be dropped onto.
   * 'key' | 'encoder_press' | 'encoder_cw' | 'encoder_ccw' | 'touch'
   * Defaults to all if not specified.
   */
  targets?: DropTarget[];
}

export type DropTarget = 'key' | 'encoder_press' | 'encoder_cw' | 'encoder_ccw' | 'touch';

/** Serialized payload carried during drag-and-drop */
export const DRAG_DATA_TYPE = 'application/openinput-action';
