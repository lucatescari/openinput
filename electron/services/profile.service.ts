import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { Profile, ProfileSummary } from '../../shared/types/profile.types';

const PROFILES_DIR = path.join(app.getPath('userData'), 'profiles');

function ensureDir(): void {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

function profilePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(PROFILES_DIR, `${safe}.json`);
}

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Migrate old profiles that used top-level `keys` to the new `pages` array.
 * Also ensures `pages` always has at least one entry.
 */
function migrateProfile(raw: any): Profile {
  const profile = raw as Profile;

  // Old format: profile.keys at top level, no pages array
  if (!profile.pages) {
    const legacyKeys = (raw as any).keys ?? {};
    profile.pages = [{ name: 'Page 1', keys: legacyKeys }];
    delete (profile as any).keys;
  }

  // Safety: ensure at least one page
  if (profile.pages.length === 0) {
    profile.pages = [{ name: 'Page 1', keys: {} }];
  }

  // Ensure other fields exist
  if (!profile.encoders) profile.encoders = {};
  if (!profile.touchZones) profile.touchZones = {};

  return profile;
}

class ProfileService {
  private activeProfileId: string | null = null;
  private activeProfileCache: Profile | null = null;

  /** Runtime navigation state — which page is displayed on the device */
  private _activePage = 0;
  /** Runtime folder state — which key's folder is open (null = not in folder) */
  private _activeFolder: number | null = null;

  get activePage(): number { return this._activePage; }
  get activeFolder(): number | null { return this._activeFolder; }

  setActivePage(index: number): void {
    const profile = this.getActiveProfile();
    if (!profile) return;
    this._activePage = Math.max(0, Math.min(index, profile.pages.length - 1));
    // Exit any open folder when switching pages
    this._activeFolder = null;
  }

  /** Navigate to next page (wraps around) */
  nextPage(): number {
    const profile = this.getActiveProfile();
    if (!profile || profile.pages.length <= 1) return this._activePage;
    this._activePage = (this._activePage + 1) % profile.pages.length;
    this._activeFolder = null;
    return this._activePage;
  }

  /** Navigate to previous page (wraps around) */
  previousPage(): number {
    const profile = this.getActiveProfile();
    if (!profile || profile.pages.length <= 1) return this._activePage;
    this._activePage = (this._activePage - 1 + profile.pages.length) % profile.pages.length;
    this._activeFolder = null;
    return this._activePage;
  }

  /** Enter a folder on the current page */
  enterFolder(keyIndex: number): void {
    this._activeFolder = keyIndex;
  }

  /** Exit the current folder */
  exitFolder(): void {
    this._activeFolder = null;
  }

  /** Get the keys that should currently be displayed (respects page + folder state) */
  getDisplayKeys(): Record<number, import('../../shared/types/profile.types').KeyConfig> {
    const profile = this.getActiveProfile();
    if (!profile) return {};

    const page = profile.pages[this._activePage];
    if (!page) return {};

    // If inside a folder, return the folder's keys
    if (this._activeFolder !== null) {
      const folderKey = page.keys[this._activeFolder];
      return folderKey?.folder?.keys ?? {};
    }

    return page.keys;
  }

  listProfiles(): ProfileSummary[] {
    ensureDir();
    const files = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.json'));
    const summaries: ProfileSummary[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(PROFILES_DIR, file), 'utf-8');
        const profile: Profile = JSON.parse(content);
        summaries.push({
          id: profile.id,
          name: profile.name,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        });
      } catch {
        // Skip corrupt files
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  getProfile(id: string): Profile | null {
    const filePath = profilePath(id);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const raw = JSON.parse(content);
      return migrateProfile(raw);
    } catch {
      return null;
    }
  }

  saveProfile(profile: Profile): void {
    ensureDir();
    profile.updatedAt = new Date().toISOString();
    const filePath = profilePath(profile.id);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    if (this.activeProfileId === profile.id) {
      this.activeProfileCache = profile;
    }
  }

  deleteProfile(id: string): void {
    const filePath = profilePath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (this.activeProfileId === id) {
      this.activeProfileId = null;
      this.activeProfileCache = null;
    }
  }

  createProfile(name: string): Profile {
    const now = new Date().toISOString();
    const profile: Profile = {
      id: generateId(),
      name,
      createdAt: now,
      updatedAt: now,
      pages: [{ name: 'Page 1', keys: {} }],
      encoders: {},
      touchZones: {},
    };
    this.saveProfile(profile);
    return profile;
  }

  getOrCreateDefault(): Profile {
    const profiles = this.listProfiles();
    if (profiles.length > 0) {
      const first = this.getProfile(profiles[0].id);
      if (first) return first;
    }

    return this.createProfile('Default');
  }

  setActiveProfileId(id: string): void {
    this.activeProfileId = id;
    this.activeProfileCache = this.getProfile(id);
    // Reset navigation state
    this._activePage = 0;
    this._activeFolder = null;
  }

  getActiveProfileId(): string | null {
    return this.activeProfileId;
  }

  getActiveProfile(): Profile | null {
    if (!this.activeProfileId) return null;
    if (this.activeProfileCache?.id === this.activeProfileId) {
      return this.activeProfileCache;
    }
    this.activeProfileCache = this.getProfile(this.activeProfileId);
    return this.activeProfileCache;
  }
}

export const profileService = new ProfileService();
