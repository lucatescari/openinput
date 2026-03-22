import type { ActionPlugin } from './plugin.types';

export const SYSTEM_PLUGIN: ActionPlugin = {
  id: 'system',
  name: 'System',
  icon: 'settings',
  description: 'Keyboard shortcuts, text input, and system controls',
  actions: [
    {
      id: 'hotkey',
      name: 'Hotkey',
      icon: 'keyboard',
      description: 'Send a keyboard shortcut',
      defaultConfig: { type: 'hotkey' },
    },
    {
      id: 'hotkey_switch',
      name: 'Hotkey Switch',
      icon: 'toggle-left',
      description: 'Toggle between two keyboard shortcuts',
      defaultConfig: { type: 'hotkey_switch' },
    },
    {
      id: 'text',
      name: 'Type Text',
      icon: 'type',
      description: 'Type out a text string',
      defaultConfig: { type: 'text' },
    },
  ],
};

export const APPS_PLUGIN: ActionPlugin = {
  id: 'apps',
  name: 'Apps & Files',
  icon: 'app-window',
  description: 'Launch or close applications, open files and URLs',
  actions: [
    {
      id: 'launch_app',
      name: 'Launch App',
      icon: 'app-window',
      description: 'Open an application',
      defaultConfig: { type: 'launch_app' },
    },
    {
      id: 'close_app',
      name: 'Close App',
      icon: 'x-circle',
      description: 'Quit a running application',
      defaultConfig: { type: 'close_app' },
    },
    {
      id: 'open_file',
      name: 'Open File',
      icon: 'file-text',
      description: 'Open a file with its default application',
      defaultConfig: { type: 'open_file' },
    },
    {
      id: 'open_url',
      name: 'Open URL',
      icon: 'globe',
      description: 'Open a link in the default browser',
      defaultConfig: { type: 'open_url' },
    },
  ],
};

export const MEDIA_PLUGIN: ActionPlugin = {
  id: 'media',
  name: 'Media',
  icon: 'music',
  description: 'Playback and volume controls',
  actions: [
    {
      id: 'play_pause',
      name: 'Play / Pause',
      icon: 'play',
      description: 'Toggle media playback',
      defaultConfig: { type: 'media', mediaAction: 'play_pause', label: 'Play/Pause' },
    },
    {
      id: 'next_track',
      name: 'Next Track',
      icon: 'skip-forward',
      description: 'Skip to next track',
      defaultConfig: { type: 'media', mediaAction: 'next_track', label: 'Next' },
    },
    {
      id: 'prev_track',
      name: 'Previous Track',
      icon: 'skip-back',
      description: 'Go to previous track',
      defaultConfig: { type: 'media', mediaAction: 'prev_track', label: 'Previous' },
    },
    {
      id: 'volume_up',
      name: 'Volume Up',
      icon: 'volume-2',
      description: 'Increase system volume',
      defaultConfig: {
        type: 'media',
        mediaAction: 'volume_up',
        label: 'Vol Up',
        overlay: { type: 'progress_bar', valueSource: 'volume', label: 'Volume', icon: 'volume-2' },
      },
    },
    {
      id: 'volume_down',
      name: 'Volume Down',
      icon: 'volume-1',
      description: 'Decrease system volume',
      defaultConfig: {
        type: 'media',
        mediaAction: 'volume_down',
        label: 'Vol Down',
        overlay: { type: 'progress_bar', valueSource: 'volume', label: 'Volume', icon: 'volume-1' },
      },
    },
    {
      id: 'mute',
      name: 'Mute',
      icon: 'volume-x',
      description: 'Toggle mute',
      defaultConfig: {
        type: 'media',
        mediaAction: 'mute',
        label: 'Mute',
        overlay: { type: 'progress_bar', valueSource: 'volume', label: 'Volume', icon: 'volume-x' },
      },
    },
  ],
};

export const DISPLAY_PLUGIN: ActionPlugin = {
  id: 'display',
  name: 'Display',
  icon: 'sun',
  description: 'Screen brightness controls (macOS built-in display only)',
  actions: [
    {
      id: 'brightness_up',
      name: 'Brightness Up',
      icon: 'sun',
      description: 'Increase display brightness (macOS built-in display only)',
      defaultConfig: {
        type: 'system',
        systemAction: 'brightness_up',
        label: 'Bright +',
        overlay: { type: 'progress_bar', valueSource: 'brightness', label: 'Brightness', icon: 'sun' },
      },
    },
    {
      id: 'brightness_down',
      name: 'Brightness Down',
      icon: 'sun-dim',
      description: 'Decrease display brightness (macOS built-in display only)',
      defaultConfig: {
        type: 'system',
        systemAction: 'brightness_down',
        label: 'Bright \u2212',
        overlay: { type: 'progress_bar', valueSource: 'brightness', label: 'Brightness', icon: 'sun' },
      },
    },
  ],
};

export const NAVIGATION_PLUGIN: ActionPlugin = {
  id: 'navigation',
  name: 'Navigation',
  icon: 'arrow-right-left',
  description: 'Page switching and folders',
  actions: [
    {
      id: 'page_next',
      name: 'Next Page',
      icon: 'chevron-right',
      description: 'Switch to the next page',
      defaultConfig: { type: 'page_next', label: 'Next Page' },
      targets: ['key', 'encoder_press'],
    },
    {
      id: 'page_previous',
      name: 'Previous Page',
      icon: 'chevron-left',
      description: 'Switch to the previous page',
      defaultConfig: { type: 'page_previous', label: 'Prev Page' },
      targets: ['key', 'encoder_press'],
    },
    {
      id: 'page_goto',
      name: 'Go to Page',
      icon: 'hash',
      description: 'Jump to a specific page',
      defaultConfig: { type: 'page_goto', pageIndex: 0, label: 'Go to Page 1' },
      targets: ['key', 'encoder_press'],
    },
    {
      id: 'folder',
      name: 'Folder',
      icon: 'folder',
      description: 'Open a folder with sub-actions',
      defaultConfig: { type: 'folder', label: 'Folder' },
      targets: ['key'],
    },
  ],
};

export const ADVANCED_PLUGIN: ActionPlugin = {
  id: 'advanced',
  name: 'Advanced',
  icon: 'layers',
  description: 'Multi-action sequences and automation',
  actions: [
    {
      id: 'multi_action',
      name: 'Multi Action',
      icon: 'layers',
      description: 'Execute multiple actions in sequence',
      defaultConfig: { type: 'multi_action', actions: [], delayMs: 100, label: 'Multi' },
      targets: ['key', 'encoder_press', 'touch'],
    },
  ],
};

/** All built-in plugins in display order */
export const BUILTIN_PLUGINS: ActionPlugin[] = [
  SYSTEM_PLUGIN,
  APPS_PLUGIN,
  MEDIA_PLUGIN,
  DISPLAY_PLUGIN,
  NAVIGATION_PLUGIN,
  ADVANCED_PLUGIN,
];
