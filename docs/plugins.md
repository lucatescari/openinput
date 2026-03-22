# Writing Device Plugins for OpenInput

OpenInput uses a plugin architecture so anyone can add support for new hardware. A device plugin is a self-contained module that tells the app how to discover, connect to, and communicate with a specific deck-style input device.

There are two ways to create a device plugin:

1. **Built-in** — TypeScript module in `electron/plugins/`, compiled with the app
2. **Community** — JavaScript bundle submitted to the [Plugin Store](https://github.com/lucatescari/openinput-plugins), installed by users

Both use the exact same `DevicePlugin` + `DeviceProtocol` interfaces. The only difference is packaging and distribution.

## Quick Start (Built-in)

Create a directory under `electron/plugins/` for your device:

```
electron/plugins/my-device/
  index.ts      <- plugin entry point
  protocol.ts   <- HID protocol implementation
  maps.ts       <- input/output byte maps (optional)
```

Register it in `electron/main.ts`:

```typescript
import { myDevicePlugin } from './plugins/my-device/index';

pluginRegistry.register(myDevicePlugin);
```

## Quick Start (Community / Store)

Create a JavaScript bundle that exports a `devicePlugin` property:

```javascript
// plugins/my-device/dist/index.js
module.exports = {
  id: 'my-device',
  name: 'My Device Driver',
  description: 'Adds support for the XYZ macro pad.',
  version: '1.0.0',

  devicePlugin: {
    meta: { /* layout + match */ },
    createProtocol() { return new MyProtocol(); },
  },
};
```

Submit a PR to the [openinput-plugins](https://github.com/lucatescari/openinput-plugins) repo. When users install it from the store, the plugin-loader automatically registers the device driver.

## Plugin Structure

A plugin exports a `DevicePlugin` object with two parts:

1. **`meta`** — static metadata describing the device (layout, USB identifiers, name)
2. **`createProtocol()`** — factory that returns a `DeviceProtocol` instance for each connection

```typescript
import type { DevicePlugin } from '../../../shared/types/device-plugin.types';
import { MyProtocol } from './protocol';

export const myDevicePlugin: DevicePlugin = {
  meta: {
    id: 'my-device-id',           // unique plugin identifier
    name: 'My Device Pro',         // shown in the UI
    layout: { /* ... */ },         // see Layout Spec below
    match: [                       // USB discovery
      {
        vendorId: 0x1234,
        productIds: [0x5678, 0x5679],
        usagePage: 0xff00,         // optional HID usage page filter
      },
    ],
  },
  createProtocol() {
    return new MyProtocol();
  },
};
```

## Layout Spec

The layout tells the app what your device looks like. Every field is optional — only declare what your device has.

```typescript
layout: {
  // LCD keys in a grid
  keys: {
    rows: 2,
    cols: 5,
    count: 10,             // rows * cols
    imageSpec: {
      width: 112,          // pixels
      height: 112,
      rotation: 180,       // 0 | 90 | 180 | 270 — applied before sending to device
      format: 'jpeg',      // 'jpeg' | 'png' | 'bmp'
      quality: 90,         // JPEG quality (optional, default 90)
      maxBytes: 20480,     // max encoded size — quality is reduced if exceeded (optional)
    },
  },

  // Rotary encoders
  encoders: {
    count: 4,
    hasPress: true,        // whether encoders support press actions
  },

  // Touch strip zones (each zone gets its own image)
  touchZones: {
    count: 4,
    imageSpec: {
      width: 176,
      height: 112,
      rotation: 180,
      format: 'jpeg',
      quality: 90,
      maxBytes: 20480,
    },
  },

  // Swipe gesture support on the touch strip
  swipe: true,
}
```

The app uses this to:
- Render the correct grid layout in the UI (dynamic rows/cols)
- Resize and encode images at the right dimensions
- Apply the correct rotation before sending to hardware
- Show/hide encoder, touch strip, and swipe sections
- Set the correct aspect ratio on image previews

## DeviceProtocol Interface

This is where you implement the actual hardware communication. Each method receives the raw `HIDAsync` device handle from `node-hid`.

```typescript
import type { HIDAsync } from 'node-hid';
import type { DeviceProtocol } from '../../../shared/types/device-plugin.types';
import type { DeviceInputEvent } from '../../../shared/types/device.types';

export class MyProtocol implements DeviceProtocol {
  /**
   * Called once after the HID device is opened.
   * Send wake/handshake commands, set initial brightness, etc.
   */
  async initialize(device: HIDAsync): Promise<void> {
    // Send your device's wake-up command
  }

  /**
   * Called every 10 seconds to keep the connection alive.
   * Send a heartbeat/keep-alive packet.
   */
  async sendHeartbeat(device: HIDAsync): Promise<void> {
    // Send keep-alive
  }

  /**
   * Set display brightness (0-100).
   */
  async setBrightness(device: HIDAsync, level: number): Promise<void> {
    // Send brightness command
  }

  /**
   * Send a pre-encoded image to a display slot.
   *
   * The image buffer is already resized, rotated, and encoded by the
   * framework using your imageSpec — you just handle the wire protocol
   * (chunked transfer, headers, flush commands, etc.).
   *
   * @param outputId  The physical output slot ID (from getOutputId)
   * @param imageData The encoded image buffer ready for the device
   */
  async sendImage(device: HIDAsync, outputId: number, imageData: Buffer): Promise<void> {
    // Announce image, stream chunks, flush
  }

  /**
   * Clear a single display slot, or all slots if outputId is 0xFF.
   */
  async clearSlot(device: HIDAsync, outputId: number): Promise<void> {
    // Send clear command
  }

  /**
   * Put the device to sleep / turn off the display.
   */
  async sleep(device: HIDAsync): Promise<void> {
    // Send sleep command
  }

  /**
   * Parse a raw HID input report into an app event.
   * Return null if the report is not a recognized input.
   *
   * The app uses these event types:
   *   key_down, key_up           — LCD key press/release
   *   encoder_cw, encoder_ccw    — encoder rotation
   *   encoder_press, encoder_release
   *   touch_press, touch_release — touch zone tap
   *   swipe_left, swipe_right    — swipe gestures
   */
  parseInputReport(data: Buffer): DeviceInputEvent | null {
    // Read your device's report format and map to DeviceInputEvent
    return null;
  }

  /**
   * Map a logical UI element to the physical output ID your device uses.
   *
   * @param elementType  'key' or 'touchZone'
   * @param index        0-based index of the element
   * @returns            The output ID to pass to sendImage, or undefined if invalid
   */
  getOutputId(elementType: 'key' | 'touchZone', index: number): number | undefined {
    // Return the output slot ID for the given element
    return undefined;
  }

  /**
   * Optional cleanup when the device disconnects.
   */
  dispose(): void {
    // Clean up any timers, state, etc.
  }
}
```

## Image Processing

You do **not** need to handle image resizing, rotation, or encoding. The framework does all of that based on your `imageSpec`:

1. User assigns an image (drag-drop, browse, auto-generated icon)
2. Framework resizes to `imageSpec.width` x `imageSpec.height`
3. Framework rotates by `imageSpec.rotation` degrees
4. Framework encodes to `imageSpec.format` at `imageSpec.quality`
5. If the encoded size exceeds `imageSpec.maxBytes`, quality is reduced automatically
6. Your `sendImage()` receives the final buffer — just send it over the wire

## Input/Output Maps

Most devices need mappings between physical byte values and logical indices. Keep these in a separate file for clarity:

```typescript
// electron/plugins/my-device/maps.ts

/** Maps input report byte values to key indices */
export const KEY_INPUT_MAP: Record<number, number> = {
  0x01: 0,
  0x02: 1,
  // ...
};

/** Maps key indices to output slot IDs for image writes */
export const KEY_OUTPUT_MAP: Record<number, number> = {
  0: 0x10,
  1: 0x11,
  // ...
};
```

Use these in your `parseInputReport()` and `getOutputId()` implementations.

## Pages and Folders

The framework supports multi-page profiles and key folders — your plugin doesn't need to do anything special, it all works automatically.

### Pages

Each profile can have multiple **pages** of key configurations. Only the LCD keys change between pages; encoders, touch zones, and swipe actions stay the same across all pages.

```
Profile
├── pages[0]  ← "Main"
│   └── keys: { 0: KeyConfig, 1: KeyConfig, ... }
├── pages[1]  ← "Media"
│   └── keys: { 0: KeyConfig, 1: KeyConfig, ... }
├── encoders: { ... }       ← shared across pages
└── touchZones: { ... }     ← shared across pages
```

Users switch pages via navigation actions assigned to keys:
- `page_next` — advance to the next page (wraps around)
- `page_previous` — go back to the previous page (wraps around)
- `page_goto` — jump to a specific page by index

The framework handles page switching on both the device and the UI, with animated fade transitions on the LCD keys.

### Folders

A key can be a **folder** — pressing it replaces all LCD keys with the folder's contents. Key 0 (top-left) is automatically reserved as a back button to exit the folder.

```
KeyConfig
├── action: { type: 'folder' }
└── folder:
    ├── name: "My Folder"
    └── keys: { 1: KeyConfig, 2: KeyConfig, ... }  ← key 0 reserved for back
```

Folders are single-level (no nesting) and single-page. Entering/exiting a folder triggers an animated fade transition on the device keys.

### Navigation sync

When the user navigates pages or folders in the UI, the device updates to match — and vice versa. The framework keeps both in sync automatically. Your plugin just sends/receives images through the normal `sendImage()` path; navigation state is handled entirely by the framework.

## What The App Handles For You

Once your plugin is registered, all of these work automatically:

- **Device discovery** — the app scans USB HID devices every 3 seconds and matches against your `meta.match` descriptors
- **Auto-connect** — first matched device is connected on startup
- **Image processing** — resize, rotate, encode, quality reduction
- **Profile management** — save/load/switch profiles with pages, keys, encoder, and touch configs
- **Pages & folders** — multi-page key layouts and single-level key folders with animated transitions
- **Action system** — hotkeys, app launch, media controls, URLs, multi-actions, page/folder navigation, community plugin actions
- **UI rendering** — key grid, encoder row, touch strip all adapt to your layout
- **Screensaver** — idle timeout pushes screensaver images to all slots
- **Overlays** — volume/brightness bars render on the touch strip (if your device has one)
- **Heartbeat** — 10-second keep-alive loop using your `sendHeartbeat()`
- **Reconnection** — auto-scan reconnects if the device is unplugged and replugged

## Example: AJAZZ AKP05 Plugin

The AJAZZ AKP05 driver is a production-quality reference implementation available in two forms:

**TypeScript source** (in this repo, for reference):
```
electron/plugins/ajazz-akp05/
  index.ts      — plugin definition with full layout spec
  protocol.ts   — CRT-prefix protocol, BAT/STP image transfer, input parsing
  maps.ts       — key/encoder/touch/swipe byte maps
```

**Bundled JS** (in the [Plugin Store](https://github.com/lucatescari/openinput-plugins), installed by users):
```
openinput-plugins/plugins/ajazz-akp05/
  dist/index.js — self-contained device driver bundle
  README.md     — hardware specs, protocol reference, installation guide
```

The AJAZZ plugin is distributed through the Plugin Store — users install it from the Store page when setting up OpenInput for the first time.

## Plugin Store

OpenInput has a built-in **Plugin Store** where users can discover and install community plugins directly from the app. The store is powered by a GitHub repository that acts as the plugin registry.

### How it works

1. The registry repo ([openinput-plugins](https://github.com/lucatescari/openinput-plugins)) contains a `registry.json` manifest listing all available plugins
2. The app fetches this manifest and displays plugins in the Store page
3. Users click **Install** to download a plugin to their local machine
4. Installed plugins are loaded on the next app restart
5. Users can uninstall plugins from the **Installed** tab in the Store

### Plugin types in the store

| Type | Description | Example |
|------|-------------|---------|
| `device` | Hardware driver for a new deck | Steam Deck, Loupedeck CT |
| `action` | New action types for keys/encoders | Spotify control, OBS scenes |
| `profile` | Pre-made profiles to import | Streaming starter pack |

### Publishing your plugin

1. Fork the [openinput-plugins](https://github.com/lucatescari/openinput-plugins) repository
2. Add your plugin under `plugins/<your-plugin-id>/`:
   ```
   plugins/my-plugin/
     dist/index.js    ← compiled plugin bundle
     README.md        ← documentation
   ```
3. Add an entry to `registry.json`:
   ```json
   {
     "id": "my-plugin",
     "name": "My Plugin",
     "description": "What it does in 1-2 sentences",
     "author": "your-github-username",
     "version": "1.0.0",
     "type": "device",
     "tags": ["hardware", "driver"],
     "downloadUrl": "plugins/my-plugin/dist/index.js",
     "platforms": ["macos", "windows", "linux"],
     "permissions": []
   }
   ```
4. Open a Pull Request — all plugins are reviewed before being listed in the store

### Review process

Every plugin PR is reviewed to ensure:
- No malicious or obfuscated code
- Permissions in `registry.json` match actual usage
- Platforms list is accurate
- Plugin loads without errors
- Actions/drivers work as described
- Clean, readable code

## Tips

- **Test without hardware**: The app simulates a connected device in browser dev mode (`ng serve`). Your plugin won't load there, but the UI will render with mock data.
- **Multiple product IDs**: If your device family has variants, list all PIDs in `match[0].productIds`. They'll share the same protocol.
- **Multiple match rules**: If your plugin supports completely different VID/PID combos (e.g. different firmware versions), add multiple entries to the `match` array.
- **No touch zones?** Omit `touchZones` from layout. The touch strip UI section won't render.
- **No encoders?** Omit `encoders`. The encoder row won't render.
- **Square keys vs landscape?** Set `imageSpec.width` and `imageSpec.height` to whatever your device uses. The UI aspect ratio adapts automatically.
- **No rotation needed?** Set `rotation: 0`. The framework skips the rotation step.
- **Pages are automatic** — you don't need to implement anything for pages/folders. The framework handles navigation, image pushing, and animated transitions entirely through your existing `sendImage()` method.
- **Finding your device's VID/PID**: On macOS, use "System Information > USB". On Linux, use `lsusb`. On Windows, use Device Manager.
- **HID report format**: Use a tool like [Wireshark](https://www.wireshark.org/) or [hidapi](https://github.com/libusb/hidapi) to capture and analyze your device's USB HID traffic.
