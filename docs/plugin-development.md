# Plugin Development Guide

This guide covers two types of plugin development:

1. **Built-in action plugins** — UI palette actions that ship with the app
2. **Community plugins** — Action, device, and profile plugins distributed through the Plugin Store

## Part 1: Built-in Action Plugins

Built-in plugins define the draggable actions in the sidebar palette. They're Angular-side only — no Node.js code.

### Concepts

- **Plugin** (`ActionPlugin`) -- A named group of related actions (e.g. "Media", "OBS Studio")
- **Action** (`ActionDefinition`) -- A single draggable action within a plugin (e.g. "Play/Pause", "Mute")
- **Action Config** (`ActionConfig`) -- The data stored in a profile when an action is assigned to an element

### Plugin Interface

```typescript
// src/app/plugins/plugin.types.ts

export interface ActionPlugin {
  /** Unique identifier, e.g. 'obs', 'spotify', 'custom' */
  id: string;
  /** Display name shown in the action palette header */
  name: string;
  /** Lucide icon name for the section header */
  icon: string;
  /** Short description */
  description: string;
  /** Actions provided by this plugin */
  actions: ActionDefinition[];
}
```

### Action Interface

```typescript
export interface ActionDefinition {
  /** Unique ID within the plugin, e.g. 'scene_switch' */
  id: string;
  /** Display name shown on the draggable action card */
  name: string;
  /** Lucide icon name for the card */
  icon: string;
  /** Tooltip description */
  description: string;
  /** Default ActionConfig assigned when this action is dropped onto an element */
  defaultConfig: ActionConfig;
  /**
   * Which targets this action can be dropped onto.
   * If not specified, the action can be dropped on any target.
   */
  targets?: DropTarget[];
}

export type DropTarget = 'key' | 'encoder_press' | 'encoder_cw' | 'encoder_ccw' | 'touch';
```

### Step-by-step: Create a Built-in Plugin

#### 1. Define your plugin

Create a new file in `src/app/plugins/`:

```typescript
// src/app/plugins/my-plugin.ts
import type { ActionPlugin } from './plugin.types';

export const MY_PLUGIN: ActionPlugin = {
  id: 'my_plugin',
  name: 'My Plugin',
  icon: 'star',           // Lucide icon name
  description: 'My custom actions',
  actions: [
    {
      id: 'do_something',
      name: 'Do Something',
      icon: 'zap',
      description: 'Performs a custom action',
      defaultConfig: {
        type: 'hotkey',    // Must be a valid ActionType
        hotkey: { modifiers: ['ctrl', 'shift'], key: 'F1' },
        label: 'My Action',
      },
    },
    {
      id: 'do_another_thing',
      name: 'Another Action',
      icon: 'sparkles',
      description: 'Another custom action',
      defaultConfig: {
        type: 'text',
        text: 'Hello from OpenInput!',
        label: 'Hello',
      },
      // Restrict to keys and touch zones only (not encoders)
      targets: ['key', 'touch'],
    },
  ],
};
```

#### 2. Register the plugin

Add your plugin to the built-in plugins array in `src/app/plugins/builtin-plugins.ts`:

```typescript
import { MY_PLUGIN } from './my-plugin';

export const BUILTIN_PLUGINS: ActionPlugin[] = [
  SYSTEM_PLUGIN,
  APPS_PLUGIN,
  MEDIA_PLUGIN,
  DISPLAY_PLUGIN,
  ADVANCED_PLUGIN,
  MY_PLUGIN,             // Add your plugin here
];
```

That's it. Your plugin will appear in the action palette sidebar, and its actions will be draggable onto the deck.

#### 3. (Optional) Add a new action type

If your plugin needs a new action type beyond what's already available, update both shared types and the main process executor:

**a. Add the type to `ActionType`:**

```typescript
// shared/types/action.types.ts
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
  | 'my_custom_type'    // Add your type
  | 'none';
```

**b. Add config fields to `ActionConfig`:**

```typescript
// shared/types/action.types.ts
export interface ActionConfig {
  type: ActionType;
  label?: string;
  // ... existing fields ...

  /** For type 'my_custom_type' */
  myCustomField?: string;
  myCustomOption?: boolean;
}
```

**c. Handle execution in the main process:**

```typescript
// electron/services/action.service.ts
case 'my_custom_type':
  await executeMyCustomAction(config);
  break;
```

### Available Action Types

| Type | Description | Key Config Fields |
|---|---|---|
| `hotkey` | Send a keyboard shortcut | `hotkey: { modifiers: string[], key: string }` |
| `hotkey_switch` | Toggle between two shortcuts | `hotkey` + `hotkey2` |
| `text` | Type out a text string | `text: string` |
| `launch_app` | Open an application | `appPath: string` |
| `close_app` | Quit an application | `appPath: string` |
| `open_url` | Open a URL in browser | `url: string` |
| `open_file` | Open a file | `filePath: string` |
| `media` | Media playback control | `mediaAction: 'play_pause' \| 'next_track' \| 'prev_track' \| 'volume_up' \| 'volume_down' \| 'mute'` |
| `system` | System controls | `systemAction: 'brightness_up' \| 'brightness_down'` |
| `multi_action` | Execute multiple actions in sequence | `actions: ActionConfig[], delayMs: number` |
| `folder` | Open a key folder | -- |
| `page_next` | Go to next page | -- |
| `page_previous` | Go to previous page | -- |
| `page_goto` | Jump to a specific page | `pageIndex: number` |
| `plugin` | Execute a community plugin action | `pluginId: string, pluginActionId: string` |
| `none` | No action (placeholder) | -- |

### Drop Targets

Actions can be restricted to specific element types using the `targets` array:

| Target | Description |
|---|---|
| `key` | LCD keys |
| `encoder_press` | Encoder button press |
| `encoder_cw` | Encoder clockwise rotation |
| `encoder_ccw` | Encoder counter-clockwise rotation |
| `touch` | Touch strip zones |

If `targets` is omitted, the action can be dropped on any element.

### How Drag-and-Drop Works

1. The action palette renders all registered plugins and their actions
2. Each action card has `draggable="true"` and sets drag data with MIME type `application/openinput-action`
3. The drag payload is a JSON string: `{ pluginId, actionId, config }`
4. Deck elements (keys, encoders, touch zones) listen for `dragover` and `drop` events
5. On drop, the `defaultConfig` from the action definition is applied to the profile

### Icons

Plugin and action icons use [Lucide](https://lucide.dev/icons/) icon names. The action palette maps these names to inline SVGs. Common icons:

- `keyboard`, `type`, `play`, `pause`, `skip-forward`, `skip-back`
- `volume-2`, `volume-1`, `volume-x`, `sun`, `sun-dim`
- `app-window`, `globe`, `file-text`, `layers`, `zap`
- `settings`, `star`, `sparkles`, `x-circle`, `toggle-left`

---

## Part 2: Community Plugins (Plugin Store)

Community plugins are JavaScript bundles distributed through the [Plugin Store](https://github.com/lucatescari/openinput-plugins). They run in the Electron main process with full Node.js access.

### Plugin Types

| Type | What it exports | Description |
|---|---|---|
| **Action** | `actions[]` + `execute()` | New action types (Spotify, OBS, etc.) |
| **Device** | `devicePlugin` property | Hardware driver for a new deck |
| **Profile** | `profiles[]` | Pre-made configurations to import |

### Action Plugins

```javascript
module.exports = {
  id: 'my-plugin',
  name: 'My Plugin',
  description: 'Custom actions.',
  version: '1.0.0',

  actions: [
    { id: 'do-thing', name: 'Do Thing', icon: 'zap', description: 'Does a thing' },
  ],

  async initialize() { /* setup */ },
  async execute(actionId, config) { /* handle action press */ },
  dispose() { /* cleanup */ },
};
```

### Device Plugins

```javascript
module.exports = {
  id: 'my-device',
  name: 'My Device',
  description: 'Driver for XYZ.',
  version: '1.0.0',

  devicePlugin: {
    meta: {
      id: 'my-device',
      name: 'XYZ Deck',
      layout: { keys: { rows: 2, cols: 3, count: 6, imageSpec: { ... } } },
      match: [{ vendorId: 0x1234, productIds: [0x5678] }],
    },
    createProtocol() { return new MyProtocol(); },
  },
};
```

### Profile Plugins

```javascript
module.exports = {
  id: 'my-profiles',
  name: 'Profile Pack',
  description: 'Curated layouts.',
  version: '1.0.0',

  profiles: [
    {
      id: 'layout-1',
      name: 'Streaming Starter',
      pages: [{ name: 'Main', keys: { 0: { action: { type: 'media', mediaAction: 'play_pause' } } } }],
      encoders: {},
      touchZones: {},
    },
  ],
};
```

### Publishing

See the [openinput-plugins repo](https://github.com/lucatescari/openinput-plugins) for full documentation on creating and submitting community plugins.

## Tips

- Keep `defaultConfig` minimal -- set only the `type` and type-specific defaults. Users configure details (e.g. which hotkey) after dropping.
- Use descriptive `description` strings -- they appear as tooltips on hover.
- Group related actions in a single plugin rather than creating many small plugins.
- Test your plugin by running `bun run dev` (browser mode) -- you don't need a physical device to verify the palette and drag-and-drop.
- Community plugins run in the main process -- test with `bun run electron:dev` for full functionality.
