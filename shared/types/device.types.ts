export interface DeviceInfo {
  path: string;
  /** ID of the plugin that matched this device */
  pluginId: string;
  /** Human-readable device name (from plugin) */
  name: string;
  serialNumber?: string;
  connected: boolean;
}

export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type InputEventType =
  | 'key_down'
  | 'key_up'
  | 'encoder_cw'
  | 'encoder_ccw'
  | 'encoder_press'
  | 'encoder_release'
  | 'touch_press'
  | 'touch_release'
  | 'swipe_left'
  | 'swipe_right';

export interface DeviceInputEvent {
  type: InputEventType;
  /** key index, encoder index, or touch zone index */
  index: number;
  timestamp: number;
}
