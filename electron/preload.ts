import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_CHANNELS = new Set([
  // Device
  'openinput:device:list',
  'openinput:device:connect',
  'openinput:device:disconnect',
  'openinput:device:status',
  'openinput:device:event',
  'openinput:device:set-brightness',
  'openinput:device:layout',
  'openinput:device:get-registered-plugins',

  // Keys
  'openinput:keys:set-image',
  'openinput:keys:clear-image',
  'openinput:keys:set-action',

  // Encoders
  'openinput:encoders:set-action',

  // Touch strip
  'openinput:touch:set-image',
  'openinput:touch:clear-image',
  'openinput:touch:set-action',

  // Profiles
  'openinput:profile:list',
  'openinput:profile:get',
  'openinput:profile:save',
  'openinput:profile:delete',
  'openinput:profile:activate',

  // Actions
  'openinput:action:execute',

  // Images
  'openinput:image:browse',
  'openinput:image:process',

  // Icons
  'openinput:icon:generate',
  'openinput:icon:generate-touch',
  'openinput:icon:favicon',

  // Profile import/export
  'openinput:profile:export',
  'openinput:profile:import',

  // Screensaver
  'openinput:screensaver:set',
  'openinput:screensaver:clear',

  // App
  'openinput:app:get-version',
  'openinput:app:check-update',
  'openinput:app:install-update',
  'openinput:app:update-status',

  // App browse
  'openinput:app:browse',

  // File browse
  'openinput:file:browse',

  // Shell
  'openinput:shell:open-external',

  // Navigation
  'openinput:device:nav',
  'openinput:nav:set-page',

  // Plugin Store
  'openinput:store:fetch-registry',
  'openinput:store:install-plugin',
  'openinput:store:uninstall-plugin',
  'openinput:store:get-installed',
  'openinput:store:get-community-actions',

  // Main → Renderer notifications
  'openinput:notify:toast',
]);

const openinputApi = {
  invoke: <T>(channel: string, ...args: unknown[]): Promise<T> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (
    channel: string,
    callback: (...args: unknown[]) => void,
  ): (() => void) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`IPC channel not allowed for listener: ${channel}`);
      return () => {};
    }
    const listener = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ): void => {
      callback(...args);
    };
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld('openinput', openinputApi);

export type OpenInputApi = typeof openinputApi;
