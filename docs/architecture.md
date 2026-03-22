# Architecture

## Overview

OpenInput follows a strict Electron architecture with process isolation:

```
┌─────────────────────────────────────────────────────────┐
│  Renderer Process (Angular)                             │
│                                                         │
│  Pages ──> State Services ──> Data Services ──> IPC     │
│              (signals)         (invoke/on)     Bridge   │
└──────────────────────────┬──────────────────────────────┘
                           │ contextBridge (channel whitelist)
┌──────────────────────────┴──────────────────────────────┐
│  Main Process (Electron/Node)                           │
│                                                         │
│  IPC Handlers ──> Services ──> node-hid / sharp / OS    │
│                                                         │
│  Plugin Registry ──> Device Plugins (built-in + store)  │
│  Plugin Loader   ──> Community Plugins (actions/device)  │
└─────────────────────────────────────────────────────────┘
```

## State Flow

The renderer uses a three-layer pattern:

1. **Pages / Components** -- Angular standalone components with inline templates
2. **State Services** -- Hold application state in Angular signals (`signal()`, `computed()`)
3. **Data Services** -- Thin wrappers around IPC calls, no state

```
Component  →  profileState.setKeyAction(0, config)
                    ↓
State Service  →  updates signal, calls debouncedSave()
                    ↓
Data Service   →  ipc.invoke('openinput:profile:save', profile)
                    ↓
IPC Bridge     →  window.openinput.invoke(channel, args)
                    ↓
Main Process   →  profileService.saveProfile(profile)  // writes JSON to disk
```

## Key Services

### Renderer (Angular)

| Service | Responsibility |
|---|---|
| `IpcService` | Generic `invoke()` / `on()` wrapper around `window.openinput`. Stubs out in browser-only mode. |
| `DeviceStateService` | Connection status, device list, event log, brightness. Mocks a device when not in Electron. |
| `ProfileStateService` | Active profile, profile list, CRUD operations. Debounced auto-save (500ms). |
| `DeckStateService` | Selected element tracking, key press states, image rendering pipeline. |
| `ThemeStateService` | Dark/light/system theme preference. |
| `StoreDataService` | Plugin store: fetch registry, install, uninstall, get installed plugins. |

### Main Process (Electron)

| Service | Responsibility |
|---|---|
| `HidService` | Device discovery via `node-hid`, connect/disconnect, heartbeat (10s), input event parsing, animated key transitions. |
| `ImageService` | `sharp` pipeline: resize, rotate, encode images per the active plugin's `imageSpec`. |
| `ProfileService` | JSON file CRUD in `userData/profiles/`. Page/folder navigation state. Profile migration (old format → pages). |
| `ActionService` | Executes actions: hotkeys, app launch, media keys, multi-action sequences, community plugin dispatch. Cross-platform (macOS/Linux/Windows). |
| `StoreService` | Plugin store backend: fetch registry from GitHub, install/uninstall plugin bundles, manage `installed.json`. |
| `OverlayService` | Volume/brightness bar overlays on touch strip zones using sharp compositing. |

## Plugin System

OpenInput has two plugin systems:

### 1. Device Plugins (hardware drivers)

Device plugins tell the app how to discover and communicate with hardware. They're registered in the **Plugin Registry**.

```
electron/plugins/
├── plugin-registry.ts        ← Map<id, DevicePlugin>, findMatch(vid, pid)
├── plugin-loader.ts          ← Loads community plugins from userData/store/plugins/
├── ajazz-akp05/              ← Built-in device plugin
│   ├── index.ts              ← DevicePlugin definition (meta + createProtocol)
│   ├── protocol.ts           ← DeviceProtocol implementation (HID commands)
│   └── maps.ts               ← Input/output byte maps
```

- **Built-in plugins** are registered in `electron/main.ts` at startup
- **Community plugins** are loaded from `userData/store/plugins/` by the plugin-loader
- The app matches devices to plugins using USB VID/PID from `meta.match`

### 2. Action Plugins (UI palette)

Action plugins define draggable actions in the UI sidebar. They're separate from device plugins.

```
src/app/plugins/
├── plugin.types.ts           ← ActionPlugin, ActionDefinition interfaces
├── builtin-plugins.ts        ← BUILTIN_PLUGINS array (System, Media, Apps, etc.)
├── system-plugin.ts          ← Hotkeys, text, launch app, etc.
├── media-plugin.ts           ← Play/pause, volume, mute, etc.
└── ...
```

Community action plugins (from the store) also appear in the palette alongside built-in ones.

## IPC Security

The preload script (`electron/preload.ts`) uses `contextBridge.exposeInMainWorld` to expose a limited `window.openinput` API. Only whitelisted channels (prefixed with `openinput:`) are allowed. The renderer never has direct access to Node.js APIs.

```typescript
// preload.ts (simplified)
contextBridge.exposeInMainWorld('openinput', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => { /* filtered listener */ },
});
```

All IPC responses follow the `IpcResponse<T>` envelope:

```typescript
interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Routing

Four lazy-loaded pages:

| Route | Page | Description |
|---|---|---|
| `/deck` | `DeckPage` | Main view -- device visual, config panel, action palette, event log |
| `/profiles` | `ProfilesPage` | Profile CRUD -- create, rename, duplicate, delete, activate, import/export |
| `/store` | `StorePage` | Plugin store -- browse, search, install, uninstall community plugins |
| `/settings` | `SettingsPage` | Theme, brightness, updates, about |

## Profile Storage

Profiles are JSON files stored in `{userData}/profiles/`:

```json
{
  "id": "profile_1234_abc",
  "name": "My Profile",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "pages": [
    {
      "name": "Main",
      "keys": {
        "0": {
          "action": { "type": "hotkey", "hotkey": { "modifiers": ["ctrl"], "key": "c" } },
          "image": "...",
          "title": "Copy"
        },
        "3": { "action": { "type": "media", "mediaAction": "play_pause" }, "title": "Play" }
      }
    }
  ],
  "encoders": {
    "0": { "rotateClockwise": { "type": "media", "mediaAction": "volume_up" } }
  },
  "touchZones": {},
  "iconStyle": { "bgColor": "#1e1e2e", "accentColor": "#cba6f7" }
}
```

Pages, keys, encoders, and touch zones use sparse objects — only configured slots are stored.

### Pages & Folders

- **Pages**: Each profile can have multiple pages of key configurations. Encoders, touch zones, and swipe actions are shared across pages.
- **Folders**: A key can be a folder — pressing it replaces all LCD keys with the folder's contents. Key 0 is reserved as a back button. Folders are single-level (no nesting).
- **Navigation**: `page_next`, `page_previous`, `page_goto` action types switch pages. Entering/exiting folders and switching pages trigger animated fade transitions on the hardware.

## Plugin Store

The in-app Plugin Store is backed by a GitHub repository ([openinput-plugins](https://github.com/lucatescari/openinput-plugins)):

1. The repo contains a `registry.json` manifest listing all available plugins
2. The app fetches this manifest (cached for 5 minutes)
3. Users browse, search, and filter plugins by type (device/action/profile)
4. Install downloads the JS bundle to `userData/store/plugins/<id>/`
5. Uninstall removes the directory and updates `installed.json`
6. Community plugins are loaded on app restart by the plugin-loader
