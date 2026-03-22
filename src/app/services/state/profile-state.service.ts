import { inject, Injectable, signal, computed } from '@angular/core';
import { ProfileDataService } from '../data/profile-data.service';
import { DeviceDataService } from '../data/device-data.service';
import { IpcService } from '../data/ipc.service';
import type {
  Profile,
  ProfileSummary,
  KeyConfig,
  PageConfig,
  FolderConfig,
  IconStyle,
} from '../../../../shared/types/profile.types';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Injectable({ providedIn: 'root' })
export class ProfileStateService {
  private readonly profileData = inject(ProfileDataService);
  private readonly deviceData = inject(DeviceDataService);
  private readonly ipc = inject(IpcService);

  private readonly _profiles = signal<ProfileSummary[]>([]);
  private readonly _activeProfile = signal<Profile | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Current page index (0-based) */
  private readonly _activePage = signal(0);
  /** Current folder key index (null = not in a folder) */
  private readonly _activeFolder = signal<number | null>(null);

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly profiles = this._profiles.asReadonly();
  readonly activeProfile = this._activeProfile.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly activePage = this._activePage.asReadonly();
  readonly activeFolder = this._activeFolder.asReadonly();

  readonly activeProfileName = computed(() => this._activeProfile()?.name ?? 'Default');

  /** All pages in the active profile */
  readonly pages = computed(() => this._activeProfile()?.pages ?? []);

  /** Keys that should be displayed right now (respects page + folder state) */
  readonly displayKeys = computed((): Record<number, KeyConfig> => {
    const profile = this._activeProfile();
    if (!profile) return {};
    const page = profile.pages[this._activePage()];
    if (!page) return {};
    if (this._activeFolder() !== null) {
      const folderKey = page.keys[this._activeFolder()!];
      return folderKey?.folder?.keys ?? {};
    }
    return page.keys;
  });

  // ──────────────── Initialization ────────────────

  /** Load profile list and activate default on startup */
  async init(): Promise<void> {
    try {
      this._loading.set(true);

      // In browser-only dev mode, create a mock profile for UI testing
      if (!this.ipc.isElectron) {
        const now = new Date().toISOString();
        const mock: Profile = {
          id: 'mock_default',
          name: 'Default',
          createdAt: now,
          updatedAt: now,
          pages: [{ name: 'Page 1', keys: {} }],
          encoders: {},
          touchZones: {},
        };
        this._profiles.set([{ id: mock.id, name: mock.name, createdAt: now, updatedAt: now }]);
        this._activeProfile.set(mock);
        return;
      }

      const profiles = await this.profileData.listProfiles();
      this._profiles.set(profiles ?? []);

      if (profiles?.length > 0) {
        await this.activateProfile(profiles[0].id);
      } else {
        // No profiles on disk yet — create a default one
        await this.createProfile('Default');
      }
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Refresh the profile list */
  async refreshProfiles(): Promise<void> {
    try {
      const profiles = await this.profileData.listProfiles();
      this._profiles.set(profiles ?? []);
    } catch (err) {
      this._error.set((err as Error).message);
    }
  }

  /** Activate a profile by ID */
  async activateProfile(id: string): Promise<void> {
    try {
      this._loading.set(true);
      const profile = await this.profileData.activateProfile(id);
      this._activeProfile.set(profile);
      this._activePage.set(0);
      this._activeFolder.set(null);
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  // ──────────────── Page / Folder Navigation ────────────────

  /**
   * Set the active page.
   * @param notifyDevice If true (default), tells the main process so the device updates.
   *   Set to false when the change originated from the device itself.
   */
  setActivePage(index: number, notifyDevice = true): void {
    const profile = this._activeProfile();
    if (!profile) return;
    const clamped = Math.max(0, Math.min(index, profile.pages.length - 1));
    this._activePage.set(clamped);
    this._activeFolder.set(null);

    if (notifyDevice) {
      this.syncNavToDevice();
    }
  }

  /**
   * Enter a folder on the current page.
   * @param notifyDevice If true (default), tells the main process so the device updates.
   */
  enterFolder(keyIndex: number, notifyDevice = true): void {
    this._activeFolder.set(keyIndex);

    if (notifyDevice) {
      this.syncNavToDevice();
    }
  }

  /**
   * Exit the current folder.
   * @param notifyDevice If true (default), tells the main process so the device updates.
   */
  exitFolder(notifyDevice = true): void {
    this._activeFolder.set(null);

    if (notifyDevice) {
      this.syncNavToDevice();
    }
  }

  /** Push the current page + folder state to the main process so the device stays in sync. */
  private syncNavToDevice(): void {
    if (!this.ipc.isElectron) return;
    this.deviceData
      .setNav(this._activePage(), this._activeFolder())
      .catch(() => {});
  }

  // ──────────────── Page Management ────────────────

  addPage(name?: string): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const pageName = name || `Page ${profile.pages.length + 1}`;
    const updated: Profile = {
      ...profile,
      pages: [...profile.pages, { name: pageName, keys: {} }],
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  deletePage(index: number): void {
    const profile = this._activeProfile();
    if (!profile || profile.pages.length <= 1) return; // Always keep at least one page

    const pages = profile.pages.filter((_, i) => i !== index);
    const updated: Profile = { ...profile, pages };
    this._activeProfile.set(updated);

    // Adjust active page if needed
    if (this._activePage() >= pages.length) {
      this._activePage.set(pages.length - 1);
    } else if (this._activePage() === index) {
      this._activePage.set(Math.max(0, index - 1));
    }
    this._activeFolder.set(null);

    this.debouncedSave(updated);
  }

  renamePage(index: number, name: string): void {
    const profile = this._activeProfile();
    if (!profile || !profile.pages[index]) return;

    const pages = [...profile.pages];
    pages[index] = { ...pages[index], name };
    const updated: Profile = { ...profile, pages };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  // ──────────────── Key Config (page + folder aware) ────────────────

  /** Get keys for the current write context (page or folder) */
  private getCurrentKeys(profile: Profile): Record<number, KeyConfig> {
    const page = profile.pages[this._activePage()];
    if (!page) return {};
    if (this._activeFolder() !== null) {
      const folderKey = page.keys[this._activeFolder()!];
      return folderKey?.folder?.keys ?? {};
    }
    return page.keys;
  }

  /** Update a key in the current context (page or folder) and return the new profile */
  private updateKeyInContext(
    profile: Profile,
    keyIndex: number,
    updater: (existing: KeyConfig) => KeyConfig,
  ): Profile {
    const pageIdx = this._activePage();
    const pages = [...profile.pages];
    const page = pages[pageIdx];
    if (!page) return profile;

    const folderIdx = this._activeFolder();
    if (folderIdx !== null) {
      // Writing inside a folder
      const folderKey = page.keys[folderIdx];
      const folder = folderKey?.folder ?? { name: 'Folder', keys: {} };
      const existing = folder.keys[keyIndex] ?? {};
      const updatedFolderKeys = { ...folder.keys, [keyIndex]: updater(existing) };
      pages[pageIdx] = {
        ...page,
        keys: {
          ...page.keys,
          [folderIdx]: {
            ...folderKey,
            folder: { ...folder, keys: updatedFolderKeys },
          },
        },
      };
    } else {
      // Writing at page level
      const existing = page.keys[keyIndex] ?? {};
      pages[pageIdx] = {
        ...page,
        keys: { ...page.keys, [keyIndex]: updater(existing) },
      };
    }

    return { ...profile, pages };
  }

  /** Set action for a key and auto-save */
  setKeyAction(keyIndex: number, action: ActionConfig): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => ({
      ...existing,
      action,
    }));
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Update key image in profile and auto-save */
  setKeyImage(keyIndex: number, imageBase64: string, autoIcon = false): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => ({
      ...existing,
      image: imageBase64,
      autoIcon,
    }));
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Clear key image in profile and auto-save */
  clearKeyImage(keyIndex: number): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => {
      const copy = { ...existing };
      delete copy.image;
      return copy;
    });
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set per-key title overlay */
  setKeyTitle(keyIndex: number, title: string | undefined): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => ({
      ...existing,
      title,
    }));
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set per-key icon style override */
  setKeyIconStyle(keyIndex: number, style: IconStyle | undefined): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => ({
      ...existing,
      iconStyle: style,
    }));
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Configure a key as a folder (not allowed inside a folder — no nesting) */
  setKeyAsFolder(keyIndex: number, folderName: string): void {
    if (this._activeFolder() !== null) return; // prevent nested folders
    const profile = this._activeProfile();
    if (!profile) return;

    const updated = this.updateKeyInContext(profile, keyIndex, (existing) => ({
      ...existing,
      action: { type: 'folder' as const, label: folderName },
      folder: existing.folder ?? { name: folderName, keys: {} },
    }));
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  // ──────────────── Encoder / Touch / Swipe (unchanged, page-independent) ────────────────

  /** Set action for an encoder slot and auto-save */
  setEncoderAction(
    encoderIndex: number,
    slot: 'rotateClockwise' | 'rotateCounterClockwise' | 'pressAction',
    action: ActionConfig,
  ): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      encoders: {
        ...profile.encoders,
        [encoderIndex]: {
          ...profile.encoders[encoderIndex],
          [slot]: action,
        },
      },
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set action for a touch zone and auto-save */
  setTouchAction(zoneIndex: number, action: ActionConfig): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      touchZones: {
        ...profile.touchZones,
        [zoneIndex]: {
          ...profile.touchZones[zoneIndex],
          action,
        },
      },
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set swipe action and auto-save */
  setSwipeAction(direction: 'swipeLeft' | 'swipeRight', action: ActionConfig): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      [direction]: action,
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Clear touch zone image in profile and auto-save */
  clearTouchImage(zoneIndex: number): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const zoneConfig = { ...profile.touchZones[zoneIndex] };
    delete zoneConfig.image;

    const updated: Profile = {
      ...profile,
      touchZones: {
        ...profile.touchZones,
        [zoneIndex]: zoneConfig,
      },
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Update touch zone image in profile and auto-save */
  setTouchImage(zoneIndex: number, imageBase64: string, autoIcon = false): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = {
      ...profile,
      touchZones: {
        ...profile.touchZones,
        [zoneIndex]: {
          ...profile.touchZones[zoneIndex],
          image: imageBase64,
          autoIcon,
        },
      },
    };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  // ──────────────── Profile-level settings ────────────────

  /** Set the profile-level default icon style */
  setProfileIconStyle(style: IconStyle): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = { ...profile, iconStyle: style };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set screensaver image */
  setScreensaver(imageBase64: string | undefined): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = { ...profile, screensaver: imageBase64 };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  /** Set screensaver timeout (in seconds) */
  setScreensaverTimeout(seconds: number): void {
    const profile = this._activeProfile();
    if (!profile) return;

    const updated: Profile = { ...profile, screensaverTimeout: seconds };
    this._activeProfile.set(updated);
    this.debouncedSave(updated);
  }

  // ──────────────── Profile CRUD ────────────────

  /** Create a new profile and activate it */
  async createProfile(name: string): Promise<void> {
    try {
      this._loading.set(true);
      const now = new Date().toISOString();
      const profile: Profile = {
        id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        createdAt: now,
        updatedAt: now,
        pages: [{ name: 'Page 1', keys: {} }],
        encoders: {},
        touchZones: {},
      };
      await this.profileData.saveProfile(profile);
      await this.refreshProfiles();
      await this.activateProfile(profile.id);
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Delete a profile */
  async deleteProfile(id: string): Promise<void> {
    try {
      this._loading.set(true);
      await this.profileData.deleteProfile(id);
      await this.refreshProfiles();

      // If we deleted the active profile, activate the first remaining one
      const active = this._activeProfile();
      if (active?.id === id) {
        const remaining = this._profiles();
        if (remaining.length > 0) {
          await this.activateProfile(remaining[0].id);
        } else {
          this._activeProfile.set(null);
        }
      }
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Rename the active profile */
  async renameProfile(id: string, newName: string): Promise<void> {
    try {
      const profile = await this.profileData.getProfile(id);
      if (!profile) return;

      profile.name = newName;
      profile.updatedAt = new Date().toISOString();
      await this.profileData.saveProfile(profile);
      await this.refreshProfiles();

      // Update active profile if it's the one we renamed
      if (this._activeProfile()?.id === id) {
        this._activeProfile.set(profile);
      }
    } catch (err) {
      this._error.set((err as Error).message);
    }
  }

  /** Duplicate an existing profile */
  async duplicateProfile(id: string): Promise<void> {
    try {
      this._loading.set(true);
      const source = await this.profileData.getProfile(id);
      if (!source) return;

      const now = new Date().toISOString();
      const copy: Profile = {
        ...source,
        id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${source.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      };
      await this.profileData.saveProfile(copy);
      await this.refreshProfiles();
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Export a profile to file */
  async exportProfile(id: string): Promise<string | null> {
    try {
      return await this.profileData.exportProfile(id);
    } catch (err) {
      this._error.set((err as Error).message);
      return null;
    }
  }

  /** Import a profile from file */
  async importProfile(): Promise<void> {
    try {
      this._loading.set(true);
      const imported = await this.profileData.importProfile();
      if (imported) {
        await this.refreshProfiles();
        await this.activateProfile(imported.id);
      }
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Debounced save — waits 500ms after last change before persisting */
  private debouncedSave(profile: Profile): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      const updated = { ...profile, updatedAt: new Date().toISOString() };
      this._activeProfile.set(updated);
      this.profileData.saveProfile(updated).catch((err) => {
        console.error('Failed to save profile:', err);
        this._error.set((err as Error).message);
      });
    }, 500);
  }
}
