import { inject, Injectable, signal, computed, OnDestroy } from '@angular/core';
import { KeysDataService } from '../data/keys-data.service';
import { DeviceStateService } from './device-state.service';
import { ProfileStateService } from './profile-state.service';
import type { DeviceInputEvent } from '../../../../shared/types/device.types';
import type { ActionConfig } from '../../../../shared/types/action.types';
import type { IconStyle } from '../../../../shared/types/profile.types';

export type SelectedElementType = 'key' | 'encoder' | 'touch' | null;

export interface SelectedElement {
  type: SelectedElementType;
  index: number;
}

@Injectable({ providedIn: 'root' })
export class DeckStateService implements OnDestroy {
  private readonly keysData = inject(KeysDataService);
  private readonly deviceState = inject(DeviceStateService);
  private readonly profileState = inject(ProfileStateService);

  /** Base64 JPEG images for each key (index 0-9) */
  private readonly _keyImages = signal<Record<number, string>>({});

  /** Base64 JPEG images for each touch zone (index 0-3) */
  private readonly _touchImages = signal<Record<number, string>>({});

  /** Currently selected element in the UI */
  private readonly _selectedElement = signal<SelectedElement | null>(null);

  /** Which keys are currently pressed (for visual feedback) */
  private readonly _pressedKeys = signal<Set<number>>(new Set());

  /** Which encoders were last rotated (for visual feedback) */
  private readonly _activeEncoders = signal<Record<number, 'cw' | 'ccw' | null>>({});

  /** Which touch zones are currently pressed */
  private readonly _pressedTouchZones = signal<Set<number>>(new Set());

  /** Loading state for image operations */
  private readonly _loading = signal(false);

  /** Whether keys are mid-transition (fade-out / fade-in) */
  private readonly _keysTransitioning = signal(false);

  readonly keyImages = this._keyImages.asReadonly();
  readonly touchImages = this._touchImages.asReadonly();
  readonly selectedElement = this._selectedElement.asReadonly();
  readonly pressedKeys = this._pressedKeys.asReadonly();
  readonly activeEncoders = this._activeEncoders.asReadonly();
  readonly pressedTouchZones = this._pressedTouchZones.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly keysTransitioning = this._keysTransitioning.asReadonly();

  readonly selectedKeyImage = computed(() => {
    const sel = this._selectedElement();
    if (sel?.type === 'key') {
      return this._keyImages()[sel.index] ?? null;
    }
    return null;
  });

  private unsubscribeEvent: (() => void) | null = null;
  private encoderTimeouts: Record<number, ReturnType<typeof setTimeout>> = {};
  private touchReleaseTimeouts: Record<number, ReturnType<typeof setTimeout>> = {};

  constructor() {
    this.init();
  }

  private init(): void {
    // Subscribe to device events for visual feedback
    this.unsubscribeEvent = this.deviceState.onDeviceEvent((event) => {
      this.handleDeviceEvent(event);
    });
  }

  /** Select a key, encoder, or touch zone in the UI (toggle on click) */
  selectElement(type: SelectedElementType, index: number): void {
    const current = this._selectedElement();
    if (current?.type === type && current?.index === index) {
      this._selectedElement.set(null); // Deselect
    } else {
      this._selectedElement.set({ type, index });
    }
  }

  /** Force-select an element (no toggle — used after drag-and-drop) */
  forceSelectElement(type: SelectedElementType, index: number): void {
    this._selectedElement.set({ type, index });
  }

  /** Clear selection */
  clearSelection(): void {
    this._selectedElement.set(null);
  }

  /** Upload an image to a key via file dialog */
  async browseAndSetKeyImage(keyIndex: number): Promise<void> {
    try {
      this._loading.set(true);
      const result = await this.keysData.browseImage();
      if (result) {
        const processed = await this.keysData.setKeyImage(
          keyIndex,
          result.base64,
        );
        this._keyImages.update((images) => ({
          ...images,
          [keyIndex]: processed,
        }));
        this.profileState.setKeyImage(keyIndex, processed);
      }
    } finally {
      this._loading.set(false);
    }
  }

  /** Set a key image from base64 data */
  async setKeyImage(keyIndex: number, imageBase64: string): Promise<void> {
    try {
      this._loading.set(true);
      const processed = await this.keysData.setKeyImage(keyIndex, imageBase64);
      this._keyImages.update((images) => ({
        ...images,
        [keyIndex]: processed,
      }));
      this.profileState.setKeyImage(keyIndex, processed);
    } finally {
      this._loading.set(false);
    }
  }

  /** Clear a key image */
  async clearKeyImage(keyIndex: number): Promise<void> {
    try {
      this._loading.set(true);
      await this.keysData.clearKeyImage(keyIndex);
      this._keyImages.update((images) => {
        const copy = { ...images };
        delete copy[keyIndex];
        return copy;
      });
      this.profileState.clearKeyImage(keyIndex);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Generate an action icon for a key and push it to the device.
   * Marks the image as auto-generated so it gets replaced when the action changes.
   * Uses per-key iconStyle if set, otherwise falls back to profile-level iconStyle.
   */
  async generateAndSetKeyIcon(keyIndex: number, action: ActionConfig): Promise<void> {
    if (action.type === 'none') return;
    try {
      this._loading.set(true);
      const profile = this.profileState.activeProfile();
      const displayKeys = this.profileState.displayKeys();
      const keyStyle = displayKeys[keyIndex]?.iconStyle;
      const profileStyle = profile?.iconStyle;
      const style: IconStyle | undefined = keyStyle ?? profileStyle;
      const title = displayKeys[keyIndex]?.title;
      const preview = await this.keysData.generateIcon(action, keyIndex, style, title);
      if (preview) {
        this._keyImages.update((images) => ({
          ...images,
          [keyIndex]: preview,
        }));
        this.profileState.setKeyImage(keyIndex, preview, true);
      }
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Generate an action icon for a touch zone and push it to the device.
   * Marks the image as auto-generated so it gets replaced when the action changes.
   */
  async generateAndSetTouchIcon(zoneIndex: number, action: ActionConfig): Promise<void> {
    if (action.type === 'none') return;
    try {
      this._loading.set(true);
      const preview = await this.keysData.generateTouchIcon(action, zoneIndex);
      if (preview) {
        this._touchImages.update((images) => ({
          ...images,
          [zoneIndex]: preview,
        }));
        this.profileState.setTouchImage(zoneIndex, preview, true);
      }
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Fetch a favicon for a URL and set it as the touch zone image.
   * Falls back to the normal generated icon on failure.
   */
  async fetchAndSetTouchFavicon(zoneIndex: number, url: string, action: ActionConfig): Promise<void> {
    try {
      this._loading.set(true);
      const faviconBase64 = await this.keysData.fetchFavicon(url);
      if (faviconBase64) {
        const processed = await this.keysData.setTouchImage(zoneIndex, faviconBase64);
        this._touchImages.update((images) => ({
          ...images,
          [zoneIndex]: processed,
        }));
        this.profileState.setTouchImage(zoneIndex, processed, true);
        return;
      }
    } catch {
      // Ignore — fall through to generate a normal icon
    } finally {
      this._loading.set(false);
    }

    // Fallback: generate the standard action icon
    await this.generateAndSetTouchIcon(zoneIndex, action);
  }

  /** Clear a touch zone image */
  async clearTouchImage(zoneIndex: number): Promise<void> {
    try {
      this._loading.set(true);
      await this.keysData.clearTouchImage(zoneIndex);
      this._touchImages.update((images) => {
        const copy = { ...images };
        delete copy[zoneIndex];
        return copy;
      });
      this.profileState.clearTouchImage(zoneIndex);
    } finally {
      this._loading.set(false);
    }
  }

  /** Set a touch zone image */
  async setTouchImage(zoneIndex: number, imageBase64: string): Promise<void> {
    try {
      this._loading.set(true);
      const processed = await this.keysData.setTouchImage(
        zoneIndex,
        imageBase64,
      );
      this._touchImages.update((images) => ({
        ...images,
        [zoneIndex]: processed,
      }));
      this.profileState.setTouchImage(zoneIndex, processed);
    } finally {
      this._loading.set(false);
    }
  }

  /** Browse and set a touch zone image */
  async browseAndSetTouchImage(zoneIndex: number): Promise<void> {
    try {
      this._loading.set(true);
      const result = await this.keysData.browseImage();
      if (result) {
        const processed = await this.keysData.setTouchImage(
          zoneIndex,
          result.base64,
        );
        this._touchImages.update((images) => ({
          ...images,
          [zoneIndex]: processed,
        }));
        this.profileState.setTouchImage(zoneIndex, processed);
      }
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Fetch a favicon for a URL and set it as the key image.
   * Falls back to the normal generated icon on failure.
   */
  async fetchAndSetFavicon(keyIndex: number, url: string, action: ActionConfig): Promise<void> {
    try {
      this._loading.set(true);
      const faviconBase64 = await this.keysData.fetchFavicon(url);
      if (faviconBase64) {
        const processed = await this.keysData.setKeyImage(keyIndex, faviconBase64);
        this._keyImages.update((images) => ({
          ...images,
          [keyIndex]: processed,
        }));
        this.profileState.setKeyImage(keyIndex, processed, true);
        return;
      }
    } catch {
      // Ignore — fall through to generate a normal icon
    } finally {
      this._loading.set(false);
    }

    // Fallback: generate the standard action icon
    await this.generateAndSetKeyIcon(keyIndex, action);
  }

  /** Load images from active profile into local state (respects active page + folder) */
  loadFromProfile(): void {
    const profile = this.profileState.activeProfile();
    if (!profile) return;

    // Load key images from the current display context (page or folder).
    // User-uploaded images are loaded directly from the profile.
    // Auto-generated icons (autoIcon: true) are always regenerated fresh
    // so that icon-generation improvements apply immediately.
    const displayKeys = this.profileState.displayKeys();
    const keyImages: Record<number, string> = {};
    for (const [key, config] of Object.entries(displayKeys)) {
      if (config.image && !config.autoIcon) {
        keyImages[parseInt(key, 10)] = config.image;
      }
    }
    this._keyImages.set(keyImages);

    // Touch images are shared across all pages
    const touchImages: Record<number, string> = {};
    for (const [zone, config] of Object.entries(profile.touchZones)) {
      if (config.image && !config.autoIcon) {
        touchImages[parseInt(zone, 10)] = config.image;
      }
    }
    this._touchImages.set(touchImages);

    // (Re)generate icons for keys that need them:
    // - keys with an action but no image (imported profiles, cleared icons)
    // - keys with autoIcon: true (always regenerate to pick up rendering fixes)
    for (const [key, config] of Object.entries(displayKeys)) {
      const idx = parseInt(key, 10);
      if (config.action && config.action.type !== 'none' && (!config.image || config.autoIcon)) {
        // URL actions use favicon fetch (falls back to default icon on failure)
        if (config.action.type === 'open_url' && config.action.url) {
          this.fetchAndSetFavicon(idx, config.action.url, config.action);
        } else {
          this.generateAndSetKeyIcon(idx, config.action);
        }
      }
    }

    // Same for touch zones
    for (const [zone, config] of Object.entries(profile.touchZones)) {
      const idx = parseInt(zone, 10);
      if (config.action && config.action.type !== 'none' && (!config.image || config.autoIcon)) {
        if (config.action.type === 'open_url' && config.action.url) {
          this.fetchAndSetTouchFavicon(idx, config.action.url, config.action);
        } else {
          this.generateAndSetTouchIcon(idx, config.action);
        }
      }
    }
  }

  /**
   * Animated version of loadFromProfile — fades keys out, swaps images, then fades back in.
   * Used for navigation transitions (page switch, folder enter/exit).
   */
  private _transitionTimer: ReturnType<typeof setTimeout> | null = null;

  loadFromProfileAnimated(): void {
    // Cancel any in-flight transition
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
    }

    // Phase 1: fade out (CSS transition handles the visual)
    this._keysTransitioning.set(true);

    // Phase 2: after fade-out completes (~150ms), swap images and fade back in
    this._transitionTimer = setTimeout(() => {
      this.loadFromProfile();

      // Let Angular pick up the new images for one frame, then remove the transitioning class
      requestAnimationFrame(() => {
        this._keysTransitioning.set(false);
        this._transitionTimer = null;
      });
    }, 150);
  }

  private handleDeviceEvent(event: DeviceInputEvent): void {
    switch (event.type) {
      case 'key_down':
        this._pressedKeys.update((set) => new Set([...set, event.index]));
        break;
      case 'key_up':
        this._pressedKeys.update((set) => {
          const copy = new Set(set);
          copy.delete(event.index);
          return copy;
        });
        break;
      case 'encoder_cw':
      case 'encoder_ccw':
        this._activeEncoders.update((map) => ({
          ...map,
          [event.index]: event.type === 'encoder_cw' ? 'cw' : 'ccw',
        }));
        // Clear after 300ms
        clearTimeout(this.encoderTimeouts[event.index]);
        this.encoderTimeouts[event.index] = setTimeout(() => {
          this._activeEncoders.update((map) => ({
            ...map,
            [event.index]: null,
          }));
        }, 300);
        break;
      case 'touch_press':
        this._pressedTouchZones.update(
          (set) => new Set([...set, event.index]),
        );
        break;
      case 'touch_release':
        // The AKP05 touch strip only sends release events for taps,
        // so show a brief visual flash on release.
        this._pressedTouchZones.update(
          (set) => new Set([...set, event.index]),
        );
        clearTimeout(this.touchReleaseTimeouts[event.index]);
        this.touchReleaseTimeouts[event.index] = setTimeout(() => {
          this._pressedTouchZones.update((set) => {
            const copy = new Set(set);
            copy.delete(event.index);
            return copy;
          });
        }, 150);
        break;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeEvent?.();
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
    }
    for (const timeout of Object.values(this.encoderTimeouts)) {
      clearTimeout(timeout);
    }
    for (const timeout of Object.values(this.touchReleaseTimeouts)) {
      clearTimeout(timeout);
    }
  }
}
