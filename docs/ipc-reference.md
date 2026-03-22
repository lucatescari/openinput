# IPC Channel Reference

All communication between the Angular renderer and the Electron main process goes through named IPC channels. Every channel follows the request/response pattern using `IpcResponse<T>`:

```typescript
interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Channels are defined in `shared/types/ipc.types.ts` and whitelisted in the preload script.

## Device Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:device:list` | invoke | -- | `DeviceInfo[]` | List connected HID devices matching registered plugins |
| `openinput:device:connect` | invoke | `path: string` | `DeviceInfo` | Connect to device by HID path |
| `openinput:device:disconnect` | invoke | -- | `void` | Disconnect current device |
| `openinput:device:status` | invoke | -- | `DeviceInfo \| null` | Get current connection status |
| `openinput:device:set-brightness` | invoke | `level: number` | `void` | Set LCD brightness (0-100) |
| `openinput:device:layout` | invoke | -- | `DeviceLayout` | Get the active plugin's layout spec |
| `openinput:device:event` | on | -- | `DeviceInputEvent` | Device input events (keys, encoders, touch, swipe) |
| `openinput:device:status` | on | -- | `{ connected: boolean }` | Connection status changes |

## Key Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:keys:set-image` | invoke | `{ keyIndex, imageBase64 }` | `void` | Send image to a key |
| `openinput:keys:clear-image` | invoke | `keyIndex: number` | `void` | Clear a key's image |
| `openinput:keys:set-action` | invoke | `{ keyIndex, action }` | `void` | Set action for a key |

## Encoder Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:encoders:set-action` | invoke | `{ encoderIndex, slot, action }` | `void` | Set action for encoder slot |

## Touch Strip Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:touch:set-image` | invoke | `{ zoneIndex, imageBase64 }` | `void` | Send image to touch zone |
| `openinput:touch:clear-image` | invoke | `zoneIndex: number` | `void` | Clear a touch zone image |
| `openinput:touch:set-action` | invoke | `{ zoneIndex, action }` | `void` | Set action for touch zone |

## Profile Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:profile:list` | invoke | -- | `ProfileSummary[]` | List all profiles |
| `openinput:profile:get` | invoke | `id: string` | `Profile \| null` | Get full profile by ID |
| `openinput:profile:save` | invoke | `profile: Profile` | `void` | Save/update a profile |
| `openinput:profile:delete` | invoke | `id: string` | `void` | Delete a profile |
| `openinput:profile:activate` | invoke | `id: string` | `Profile` | Activate a profile (push to device) |
| `openinput:profile:export` | invoke | `id: string` | `string \| null` | Export profile to file (returns path) |
| `openinput:profile:import` | invoke | -- | `Profile \| null` | Import profile from file dialog |

## Navigation Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:device:nav` | on | -- | `{ page, folder }` | Device-initiated navigation events |
| `openinput:nav:set-page` | invoke | `{ page, folder? }` | `void` | Set active page/folder from UI |

## Image Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:image:browse` | invoke | -- | `string \| null` | Open file dialog for image selection |
| `openinput:image:process` | invoke | `{ imagePath, width, height }` | `string` | Process image (resize/rotate/encode), returns base64 |

## Icon Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:icon:generate` | invoke | `{ action, style? }` | `string` | Auto-generate key icon for an action, returns base64 |
| `openinput:icon:generate-touch` | invoke | `{ action, style? }` | `string` | Auto-generate touch zone icon, returns base64 |
| `openinput:icon:favicon` | invoke | `url: string` | `string \| null` | Fetch favicon for a URL, returns base64 |

## Screensaver Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:screensaver:set` | invoke | `imageBase64: string` | `void` | Set screensaver image |
| `openinput:screensaver:clear` | invoke | -- | `void` | Clear screensaver |

## Action Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:action:execute` | invoke | `action: ActionConfig` | `void` | Execute an action (for testing) |

## Plugin Store Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:store:fetch-registry` | invoke | -- | `StoreRegistry` | Fetch the plugin registry from GitHub (5-min cache) |
| `openinput:store:install-plugin` | invoke | `StorePlugin` | `InstalledPlugin[]` | Download and install a plugin |
| `openinput:store:uninstall-plugin` | invoke | `pluginId: string` | `InstalledPlugin[]` | Uninstall a plugin |
| `openinput:store:get-installed` | invoke | -- | `InstalledPlugin[]` | Get list of installed plugins |
| `openinput:store:get-community-actions` | invoke | -- | `CommunityPluginExport[]` | Get loaded community action plugins |

## App Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:app:get-version` | invoke | -- | `string` | Get app version |
| `openinput:app:check-update` | invoke | -- | `UpdateInfo \| null` | Check for updates |
| `openinput:app:install-update` | invoke | -- | `void` | Download and install update |
| `openinput:app:update-status` | on | -- | `UpdateStatus` | Update download progress |
| `openinput:app:browse` | invoke | -- | `string \| null` | Open file dialog for app selection |

## File / Shell Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:file:browse` | invoke | -- | `string \| null` | Open file dialog for file selection |
| `openinput:shell:open-external` | invoke | `url: string` | `void` | Open URL in system browser |

## Notification Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `openinput:notify:toast` | on | -- | `{ message, type }` | Main → renderer toast notifications |

## Adding a New Channel

1. Add the channel name to `IPC_CHANNELS` in `shared/types/ipc.types.ts`
2. Add the channel to the whitelist in `electron/preload.ts`
3. Register the handler in the appropriate file under `electron/ipc/`
4. Create a method in the appropriate data service under `src/app/services/data/`
