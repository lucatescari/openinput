# OpenInput Documentation

OpenInput is an open-source, plugin-based configuration tool for deck-style input devices — macro pads, stream decks, and similar hardware. Built with Angular 19 and Electron 35.

## Contents

| Document | Description |
|---|---|
| [Getting Started](./getting-started.md) | Set up the development environment and run the app |
| [Architecture](./architecture.md) | Project structure, state flow, plugin system, and key design decisions |
| [Writing Device Plugins](./plugins.md) | Add support for new hardware devices (built-in or community) |
| [Action Plugin Development](./plugin-development.md) | Create action plugins (built-in palette + community store) |
| [Device Protocol](./device-protocol.md) | USB HID protocol reference for the AJAZZ AKP05 |
| [IPC Reference](./ipc-reference.md) | All IPC channels between renderer and main process |

## Quick Links

- **Run in dev mode:** `bun run electron:dev`
- **Run UI only (no device):** `bun run dev` (starts Angular at `http://localhost:4200`)
- **Build for production:** `bun run electron:build`

## Plugin Architecture

OpenInput uses a plugin system for both hardware support and custom actions. Any deck-style device can be supported by writing a plugin — no changes to the core app are needed.

### Supported Devices (via Plugin Store)

| Model | Plugin | Status |
|---|---|---|
| AJAZZ AKP05 / AKP05E / AKP05E Pro | `ajazz-akp05` | Available in Store |

When you first launch OpenInput, no device drivers are installed. The app guides you to the Plugin Store where you can install support for your hardware.

### Plugin Store

Community plugins — device drivers, action packs, and shared profiles — can be installed directly from the in-app **Plugin Store**. The store is backed by the [openinput-plugins](https://github.com/lucatescari/openinput-plugins) GitHub repository.

| Plugin Type | What it does | Examples |
|---|---|---|
| **Device** | Adds hardware support for a new deck | Steam Deck, Loupedeck CT, Elgato Stream Deck |
| **Action** | Adds new key/encoder actions | Spotify control, OBS scene switching, Home Assistant |
| **Profile** | Shared pre-made configurations | Streaming starter pack, developer shortcuts |

See [Writing Device Plugins](./plugins.md#plugin-store) or the [openinput-plugins repo](https://github.com/lucatescari/openinput-plugins) for how to publish yours.

### Key Features

- **Multi-page profiles** — each profile can have multiple pages of key configurations
- **Key folders** — single-level folders with animated transitions
- **Animated transitions** — fade-in/out on page switch, folder enter/exit
- **Dynamic UI** — key grid, encoders, touch strip all adapt to the active device plugin's layout
- **Auto-discovery** — USB HID scan every 3 seconds, auto-connect on detection
- **Screensaver** — idle timeout with configurable images
- **Overlays** — volume/brightness bars on touch strip
- **Profile import/export** — share profiles as JSON files
- **Cross-platform** — macOS, Windows, Linux

## License

MIT + Commons Clause. Source is freely available for personal use, learning, and contributions. See [LICENSE](../LICENSE) for details.
