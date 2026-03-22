# Getting Started

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Node.js](https://nodejs.org/) 20+ (for Electron)
- macOS, Windows, or Linux

## Installation

```bash
git clone https://github.com/lucatescari/OpenInput.git
cd OpenInput
bun install
```

## Development

### Full Electron mode (with device access)

```bash
bun run electron:dev
```

This starts the Angular dev server on port 4200, waits for it to be ready, compiles the Electron TypeScript, and launches Electron pointing at the dev server.

### Browser-only mode (UI development)

```bash
bun run dev
```

Starts the Angular dev server at `http://localhost:4200`. The app runs without Electron — the IPC bridge is stubbed out and a mock device is simulated so you can work on the UI without a physical device connected.

This is the fastest way to iterate on components, styling, and layout.

### Scripts reference

| Script | Description |
|---|---|
| `bun run dev` | Angular dev server only (`ng serve`) |
| `bun run electron:dev` | Angular + Electron concurrently |
| `bun run electron:start` | Compile and launch Electron (expects Angular already built) |
| `bun run build:prod` | Production Angular build |
| `bun run electron:build` | Full production build + electron-builder |
| `bun run format` | Format all files with Prettier |

## Project Layout

```
OpenInput/
├── electron/               # Electron main process
│   ├── main.ts             # Window creation, IPC registration, plugin init
│   ├── preload.ts          # Secure IPC bridge (contextBridge)
│   ├── services/           # HID, image, profile, action, store, overlay services
│   ├── ipc/                # IPC handler registrations
│   └── plugins/            # Device plugin system
│       ├── plugin-registry.ts   # Plugin discovery registry
│       ├── plugin-loader.ts     # Community plugin loader
│       └── ajazz-akp05/        # Built-in AKP05 device plugin
├── src/                    # Angular renderer (the UI)
│   └── app/
│       ├── components/     # Reusable UI components (deck view, config, layout, ui)
│       ├── pages/          # Routed page components (deck, profiles, store, settings)
│       ├── plugins/        # Action plugin system (action palette definitions)
│       └── services/       # Data services (IPC) + state services (signals)
├── shared/                 # Types shared between main and renderer
│   └── types/              # IPC, device, device-plugin, profile, action, store, community-plugin, overlay types
└── docs/                   # This documentation
```

## Tech Stack

- **Frontend:** Angular 19.2 (standalone components, signals, zoneless change detection)
- **Desktop:** Electron 35
- **Styling:** Tailwind CSS v4
- **USB:** node-hid v3 (async API)
- **Image processing:** sharp (resize, rotate, JPEG encode, compositing)
- **Action execution:** @nut-tree/nut-js (keyboard/mouse simulation)
- **Package manager:** Bun

## Connecting a Device

1. Plug in your deck-style input device via USB
2. Launch the app (`bun run electron:dev`)
3. Click **Scan for Devices** on the deck page
4. Click **Connect** on the discovered device
5. The device's LCD keys should now respond to configuration changes

### Supported Devices

OpenInput uses a plugin system for hardware support — no device drivers are built in. On first launch, the app guides you to the **Plugin Store** to install a driver for your device.

Currently available:

| Model | Plugin ID | Install from |
|---|---|---|
| AJAZZ AKP05 / AKP05E / AKP05E Pro | `ajazz-akp05` | Plugin Store |

Anyone can create device plugins for new hardware. See [Writing Device Plugins](./plugins.md).

## Adding Device Support

To add support for a new device, write a device plugin. See [Writing Device Plugins](./plugins.md) for the full guide.
