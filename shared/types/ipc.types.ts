export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const IPC_CHANNELS = {
  // Device
  DEVICE_LIST: 'openinput:device:list',
  DEVICE_CONNECT: 'openinput:device:connect',
  DEVICE_DISCONNECT: 'openinput:device:disconnect',
  DEVICE_STATUS: 'openinput:device:status',
  DEVICE_EVENT: 'openinput:device:event',
  DEVICE_SET_BRIGHTNESS: 'openinput:device:set-brightness',
  DEVICE_LAYOUT: 'openinput:device:layout',
  DEVICE_GET_REGISTERED_PLUGINS: 'openinput:device:get-registered-plugins',

  // Keys
  KEYS_SET_IMAGE: 'openinput:keys:set-image',
  KEYS_CLEAR_IMAGE: 'openinput:keys:clear-image',
  KEYS_SET_ACTION: 'openinput:keys:set-action',

  // Encoders
  ENCODERS_SET_ACTION: 'openinput:encoders:set-action',

  // Touch strip
  TOUCH_SET_IMAGE: 'openinput:touch:set-image',
  TOUCH_CLEAR_IMAGE: 'openinput:touch:clear-image',
  TOUCH_SET_ACTION: 'openinput:touch:set-action',

  // Profiles
  PROFILE_LIST: 'openinput:profile:list',
  PROFILE_GET: 'openinput:profile:get',
  PROFILE_SAVE: 'openinput:profile:save',
  PROFILE_DELETE: 'openinput:profile:delete',
  PROFILE_ACTIVATE: 'openinput:profile:activate',

  // Actions
  ACTION_EXECUTE: 'openinput:action:execute',

  // Images
  IMAGE_BROWSE: 'openinput:image:browse',
  IMAGE_PROCESS: 'openinput:image:process',

  // Icons
  ICON_GENERATE: 'openinput:icon:generate',
  ICON_GENERATE_TOUCH: 'openinput:icon:generate-touch',
  FAVICON_FETCH: 'openinput:icon:favicon',

  // Profile import/export
  PROFILE_EXPORT: 'openinput:profile:export',
  PROFILE_IMPORT: 'openinput:profile:import',
  PROFILE_COPY_ALL: 'openinput:profile:copy-all',

  // Screensaver
  SCREENSAVER_SET: 'openinput:screensaver:set',
  SCREENSAVER_CLEAR: 'openinput:screensaver:clear',

  // App
  APP_GET_VERSION: 'openinput:app:get-version',
  APP_CHECK_UPDATE: 'openinput:app:check-update',
  APP_INSTALL_UPDATE: 'openinput:app:install-update',
  APP_UPDATE_STATUS: 'openinput:app:update-status',

  // App browse
  APP_BROWSE: 'openinput:app:browse',

  // File browse
  FILE_BROWSE: 'openinput:file:browse',

  // Shell
  SHELL_OPEN_EXTERNAL: 'openinput:shell:open-external',

  // Navigation (page/folder state)
  DEVICE_NAV: 'openinput:device:nav',
  NAV_SET_PAGE: 'openinput:nav:set-page',

  // Plugin Store
  STORE_FETCH_REGISTRY: 'openinput:store:fetch-registry',
  STORE_INSTALL_PLUGIN: 'openinput:store:install-plugin',
  STORE_UNINSTALL_PLUGIN: 'openinput:store:uninstall-plugin',
  STORE_GET_INSTALLED: 'openinput:store:get-installed',
  STORE_GET_COMMUNITY_ACTIONS: 'openinput:store:get-community-actions',

  // Main → Renderer notifications
  NOTIFY_TOAST: 'openinput:notify:toast',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
