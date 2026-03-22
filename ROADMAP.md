# OpenInput Roadmap

Feature ideas and implementation notes for future development. Inspired by Elgato Stream Deck but built for open-source and AJAZZ AKP05 hardware.

---

## Implemented

- [x] Hotkey actions (keyboard shortcut simulation)
- [x] Hotkey Switch (toggle between two hotkeys)
- [x] Launch Application
- [x] Close Application (graceful quit)
- [x] Open URL / Open File
- [x] Type Text (pre-defined text input)
- [x] Media controls (play/pause, next, prev, volume, mute)
- [x] System controls (brightness)
- [x] Multi-action with configurable delays
- [x] Custom image upload per key/touch zone
- [x] Auto-generated Lucide icons for actions
- [x] Configurable icon colors (global + per-key override)
- [x] Key title text overlay
- [x] Screensaver (idle timeout → custom image)
- [x] Profile export/import (.openinput files)
- [x] Profile management (create, rename, duplicate, delete)
- [x] Encoder support (rotation CW/CCW + press)
- [x] Touch strip with swipe actions
- [x] HSV color picker (canvas-based, viewport-aware)
- [x] Device auto-connect with retry logic
- [x] macOS app icon extraction for launch actions
- [x] Auto-push profile images on device connect

---

## Medium Complexity (3-5 days each)

### Pages (up to 10 per profile)
Dramatically increases usable key count from 10 to 100.

**Implementation:**
- Add `pages: PageConfig[]` to `Profile`, where each page has its own `keys: Record<number, KeyConfig>`
- Add `activePage: number` signal to `DeckStateService`
- Create page navigation actions: `next_page`, `prev_page`, `go_to_page`
- When switching pages, push the new page's images to device
- Add page indicator in the UI (dots or numbers below the deck view)
- Touch strip swipe could navigate pages by default

**Key files:** `profile.types.ts`, `deck-state.service.ts`, `deck-view.component.ts`, `hid.service.ts`

---

### Folders
Nested key groups with back navigation — natural complement to pages.

**Implementation:**
- Add `FolderConfig` type with `children: Record<number, KeyConfig | FolderConfig>`
- Navigation stack in `DeckStateService` (push folder, pop on back)
- Auto-generate back button in slot 0 when inside a folder
- Optional "Auto Exit" setting: return to parent after triggering action
- Drag-and-drop to move actions into folders (stretch goal)

**Key files:** `profile.types.ts`, `deck-state.service.ts`, `deck-view.component.ts`

---

### Smart Profiles
Auto-switch profile based on which application is in the foreground.

**Implementation:**
- Add `appBindings: Record<string, string>` to settings (app bundle ID → profile ID)
- macOS: Poll active app via `osascript -e 'tell application "System Events" to get bundle identifier of first process whose frontmost is true'` every 1-2 seconds
- Linux: `xdotool getactivewindow getwindowpid` + `/proc/PID/comm`
- Windows: `Get-Process` PowerShell or `user32.dll` `GetForegroundWindow` via ffi
- When foreground app matches a binding, auto-activate that profile
- UI: Settings page with app → profile mapping table

**Key files:** New `electron/services/smart-profile.service.ts`, `profile.types.ts`, `settings.page.ts`

---

### Pinned Actions
Keys that persist across all pages in a profile.

**Implementation:**
- Requires pages feature first
- Add `pinned: boolean` flag to `KeyConfig`
- When rendering a page, merge pinned keys from page 0 into current page
- Pinned keys always appear in their original position
- Visual indicator in UI (pin icon badge)

**Key files:** `profile.types.ts`, `deck-state.service.ts`

---

### Global Font Settings
Default font, size, color, alignment for key title overlays.

**Implementation:**
- Add `FontStyle` type: `{ fontFamily, fontSize, fontColor, alignment, position }`
- Add `fontStyle?: FontStyle` to `Profile` and `KeyConfig`
- Thread font settings through `generateActionIcon()` and `compositeTitle()`
- Settings UI with font picker, size slider, color picker, alignment buttons

**Key files:** `profile.types.ts`, `icon.service.ts`, `settings.page.ts`

---

### Action Wheel (Encoder)
Radial menu on encoder: rotate to browse options, press to select.

**Implementation:**
- New action type `action_wheel` with `items: ActionConfig[]`
- Track current selection index per encoder
- On rotate: cycle through items, update touch strip segment to show current selection
- On press: execute the selected action
- Visual feedback: show item name/icon on corresponding touch strip zone

**Key files:** `action.types.ts`, `action.service.ts`, `hid.service.ts`, `encoder-config.component.ts`

---

### Dial Stacks
Layer multiple actions on one encoder — push to cycle between layers.

**Implementation:**
- New action type `dial_stack` with `layers: { cw: ActionConfig, ccw: ActionConfig }[]`
- Track current layer index per encoder
- On press: advance to next layer (wrap around)
- On rotate: execute CW/CCW action from current layer
- Touch strip shows current layer indicator

**Key files:** `action.types.ts`, `action.service.ts`, `hid.service.ts`

---

### Apple Shortcuts Integration
Trigger macOS Shortcuts from a key press.

**Implementation:**
- New action type `apple_shortcut` with `shortcutName: string`
- Execute via `shortcuts run "Name"` CLI command
- UI: Browse available shortcuts via `shortcuts list` command
- Parse output into dropdown/searchable list

**Key files:** `action.types.ts`, `action.service.ts`, `action-picker.component.ts`

---

### Soundboard
Play audio files on key press with output device selection.

**Implementation:**
- New action type `soundboard` with `audioPath: string, outputDevice?: string, volume?: number`
- Use Electron's `<audio>` element or `node-speaker` for playback
- For output device selection: `navigator.mediaDevices.enumerateDevices()` in renderer
- Audio routing to virtual devices (VB-Cable, etc.) — platform-specific
- Stop-on-second-press toggle option

**Key files:** `action.types.ts`, `action.service.ts`, new `electron/services/audio.service.ts`

---

### Animated Icon Support
GIF/WEBP animation on keys.

**Implementation:**
- Extract frames from GIF/animated WEBP using `sharp` or `gif-frames`
- Create a render loop in `hid.service.ts` that pushes frames at the correct FPS
- Only animate the visible keys (not all at once — bandwidth limit)
- Store animation frames in memory, not in profile JSON (too large)
- Profile stores path reference, frames extracted on profile activation

**Caution:** The CRT protocol has limited bandwidth. Sending 30fps to all 10 keys simultaneously would overwhelm USB. Limit to 1-2 animated keys at 10-15fps.

**Key files:** `image.service.ts`, `hid.service.ts`, `profile.types.ts`

---

## High Complexity (1-2 weeks each)

### Plugin SDK
Allow third-party developers to create extensions.

**Architecture:**
- Plugin manifest: `plugin.json` with name, version, actions, property inspector
- Plugins run in sandboxed Node.js worker threads (or separate processes)
- IPC bridge: plugin ↔ main process via message passing
- Property Inspector: HTML/CSS/JS panel loaded in webview for per-action settings
- Plugin lifecycle: install, enable, disable, uninstall
- Event system: `keyDown`, `keyUp`, `dialRotate`, `dialPress`, `willAppear`, `willDisappear`
- Plugin store directory: `userData/plugins/`

**Inspiration:** Elgato Stream Deck SDK v6 uses Node.js 20+ with a WebSocket connection.

---

### Marketplace
Browse, install, and manage plugins/icons/profiles.

**Options:**
- **GitHub-based:** Curated JSON index file in a GitHub repo, plugins distributed as GitHub releases
- **npm-based:** Plugins published as npm packages with `openinput-plugin` keyword
- **Self-hosted:** Simple REST API with SQLite backend

**MVP approach:** GitHub-based index with `gh` CLI integration for downloading.

---

### OBS Studio Integration
Control OBS via obs-websocket protocol.

**Implementation:**
- Use `obs-websocket-js` npm package
- Actions: switch scene, toggle source visibility, start/stop streaming, start/stop recording, toggle studio mode
- Real-time state feedback: show recording/streaming status on key icon
- Auto-discovery via WebSocket on localhost:4455

**Effort:** ~1 week including UI

---

### Twitch/YouTube Integration
Live streaming platform control.

**Implementation:**
- OAuth2 authentication flow (opens browser, callback to localhost)
- Twitch: Chat, clips, stream info, ad control via Twitch API
- YouTube: Stream control via YouTube Data API v3
- Token storage in system keychain (via `keytar` or Electron `safeStorage`)

**Effort:** ~1-2 weeks per platform

---

### Virtual Stream Deck
Software-only on-screen deck.

**Implementation:**
- Separate Electron `BrowserWindow` with `alwaysOnTop`, transparent background
- Configurable grid size (up to 8x8)
- Global hotkey to show/hide
- Snap to screen edges
- Click handlers map to the same action dispatch as physical keys

**Effort:** ~1 week

---

### Key Creator / Icon Editor
In-app visual icon designer.

**Implementation:**
- Canvas-based editor with layers
- Text layer: font, size, color, position
- Shape layer: rectangle, circle, with fill/stroke
- Image layer: import and position
- Background: solid color or gradient
- Export to PNG for key upload
- Save as reusable template

**Effort:** ~2 weeks (significant frontend work)

---

### Mobile Companion App
Use phone/tablet as a remote deck.

**Architecture:**
- React Native or Flutter app
- WebSocket server in Electron main process
- mDNS/Bonjour for local network discovery
- Same profile data model, rendered as touch grid
- Real-time sync: action changes in desktop app reflected on mobile

**Effort:** Major standalone project (~1-2 months)

---

## Priority Order (Suggested)

1. **Pages** — 10x more keys, high impact
2. **Smart Profiles** — killer feature for power users
3. **Folders** — natural with pages
4. **Apple Shortcuts** — huge on macOS
5. **Soundboard** — fun and popular
6. **OBS Integration** — essential for streamers
7. **Plugin SDK** — platform play
8. **Everything else**
