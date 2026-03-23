import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ThemeStateService,
  type Theme,
} from '../../services/state/theme-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { DeckStateService } from '../../services/state/deck-state.service';
import { KeysDataService } from '../../services/data/keys-data.service';
import { IpcService } from '../../services/data/ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import { ColorPickerComponent } from '../../components/ui/color-picker.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, ColorPickerComponent],
  template: `
    <div class="flex h-full flex-col overflow-auto p-6 animate-fade-in" style="scrollbar-gutter: stable">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Settings
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure application preferences.
        </p>
      </div>

      <div class="space-y-4">
        <!-- Theme -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Appearance
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Choose your preferred color scheme.
          </p>
          <div class="flex gap-3">
            @for (option of themeOptions; track option.value) {
              <button
                (click)="setTheme(option.value)"
                class="flex flex-1 max-w-32 flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 transition-colors"
                [class]="
                  themeState.theme() === option.value
                    ? 'border-gray-400 bg-gray-100 text-gray-900 dark:border-gray-500 dark:bg-neutral-800 dark:text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-neutral-700 dark:text-gray-400 dark:hover:border-neutral-600'
                "
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  @switch (option.value) {
                    @case ('light') {
                      <circle cx="12" cy="12" r="4" />
                      <path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                    }
                    @case ('dark') {
                      <path d="M21.752 15.002A9.718 9.718 0 0118 15.75 9.75 9.75 0 018.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 12a9.75 9.75 0 009.75 9.75 9.753 9.753 0 008.002-4.748z" />
                    }
                    @case ('system') {
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                    }
                  }
                </svg>
                <span class="text-xs font-medium">{{ option.label }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Default Icon Style -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Default Icon Style
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Default colors for auto-generated key icons. Can be overridden per key.
          </p>
          <div class="flex items-center gap-4">
            <app-color-picker
              [value]="defaultBgColor()"
              label="Background"
              (valueChange)="onDefaultBgChange($event)"
            />
            <app-color-picker
              [value]="defaultAccentColor()"
              label="Accent"
              (valueChange)="onDefaultAccentChange($event)"
            />
          </div>
          <div
            class="mt-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg"
            [style.background-color]="defaultBgColor()"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" [style.color]="defaultAccentColor()"/>
              <ellipse cx="12" cy="12" rx="3.5" ry="8" stroke="currentColor" stroke-width="1" [style.color]="defaultAccentColor()"/>
              <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1" [style.color]="defaultAccentColor()"/>
            </svg>
          </div>
        </div>

        <!-- Screensaver -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Screensaver
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Display a custom image on the device when idle. The image replaces all keys and touch zones.
          </p>
          <div class="space-y-4">
            <!-- Timeout -->
            <div class="flex items-center gap-3">
              <label class="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Timeout</label>
              <select
                [ngModel]="screensaverTimeout()"
                (ngModelChange)="onTimeoutChange($event)"
                class="rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400"
              >
                <option [ngValue]="0">Disabled</option>
                <option [ngValue]="60">1 minute</option>
                <option [ngValue]="180">3 minutes</option>
                <option [ngValue]="300">5 minutes</option>
                <option [ngValue]="600">10 minutes</option>
                <option [ngValue]="1800">30 minutes</option>
              </select>
            </div>

            <!-- Image preview + upload -->
            @if (screensaverTimeout() > 0) {
              <div class="flex items-center gap-4">
                <div
                  class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                >
                  @if (screensaverImage()) {
                    <img
                      [src]="'data:image/jpeg;base64,' + screensaverImage()"
                      class="h-full w-full object-cover"
                      alt="Screensaver preview"
                    />
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  }
                </div>
                <div class="flex gap-2">
                  <button
                    (click)="browseScreensaver()"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                  >
                    {{ screensaverImage() ? 'Change Image' : 'Set Image' }}
                  </button>
                  @if (screensaverImage()) {
                    <button
                      (click)="clearScreensaver()"
                      class="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                    >
                      Clear
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Profile Management -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Profiles
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Export and import profiles to share or back up your configuration.
          </p>
          <div class="flex gap-3">
            <button
              (click)="exportProfile()"
              class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              [disabled]="!profileState.activeProfile()"
            >
              Export Current Profile
            </button>
            <button
              (click)="importProfile()"
              class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
            >
              Import Profile
            </button>
            <button
              (click)="copyAllData()"
              class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
            >
              Copy All Data
            </button>
          </div>
          @if (exportStatus()) {
            <p class="mt-2 text-xs text-green-600 dark:text-green-400">{{ exportStatus() }}</p>
          }
        </div>

        <!-- Device -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Device
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Device connection settings.
          </p>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">Auto-connect</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  Automatically connect when a device is detected
                </p>
              </div>
              <div
                class="flex h-6 w-10 items-center rounded-full bg-gray-500 px-0.5 cursor-default"
                title="Always enabled"
              >
                <div class="h-5 w-5 translate-x-4 rounded-full bg-white shadow-sm transition-transform"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Updates -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-1 text-sm font-medium text-gray-900 dark:text-white">
            Updates
          </h3>
          <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Check for new versions including beta prereleases.
          </p>

          <div class="flex items-center gap-3">
            @switch (updateState()) {
              @case ('idle') {
                <button
                  (click)="checkForUpdates()"
                  class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                >
                  Check for Updates
                </button>
              }
              @case ('checking') {
                <div class="flex items-center gap-2">
                  <svg class="h-4 w-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span class="text-xs text-gray-500 dark:text-gray-400">Checking...</span>
                </div>
              }
              @case ('available') {
                <div class="flex flex-col gap-2">
                  <p class="text-xs text-gray-700 dark:text-gray-300">
                    <span class="font-semibold text-white">{{ updateVersion() }}</span> is available
                  </p>
                  <button
                    (click)="downloadAndInstall()"
                    class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                  >
                    Download &amp; Install
                  </button>
                </div>
              }
              @case ('downloading') {
                <div class="flex flex-1 flex-col gap-1.5">
                  <span class="text-xs text-gray-500 dark:text-gray-400">Downloading... {{ updatePercent() }}%</span>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
                    <div
                      class="h-full rounded-full bg-gray-400 transition-all duration-300"
                      [style.width.%]="updatePercent()"
                    ></div>
                  </div>
                </div>
              }
              @case ('downloaded') {
                <div class="flex flex-col gap-2">
                  <p class="text-xs text-gray-700 dark:text-gray-300">
                    <span class="font-semibold text-white">{{ updateVersion() }}</span> is ready to install
                  </p>
                  <button
                    (click)="downloadAndInstall()"
                    class="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                  >
                    Restart &amp; Update
                  </button>
                </div>
              }
              @case ('not-available') {
                <div class="flex items-center gap-3">
                  <span class="text-xs text-gray-500 dark:text-gray-400">You're on the latest version</span>
                  <button
                    (click)="checkForUpdates()"
                    class="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Check again
                  </button>
                </div>
              }
              @case ('error') {
                <div class="flex items-center gap-3">
                  <span class="text-xs text-red-500 dark:text-red-400">{{ updateError() }}</span>
                  <button
                    (click)="checkForUpdates()"
                    class="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Retry
                  </button>
                </div>
              }
            }
          </div>
        </div>

        <!-- About -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <h3 class="mb-4 text-sm font-medium text-gray-900 dark:text-white">
            About
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Version</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ version() }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Device Support</span>
              <span class="text-sm text-gray-700 dark:text-gray-300">Plugin-based (extensible)</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">License</span>
              <span class="text-sm text-gray-700 dark:text-gray-300">MIT + Commons Clause</span>
            </div>
            <hr class="border-gray-200 dark:border-neutral-800" />
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Source Code</span>
              <button
                (click)="openGitHub()"
                class="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage implements OnInit, OnDestroy {
  readonly themeState = inject(ThemeStateService);
  readonly profileState = inject(ProfileStateService);
  private readonly deckState = inject(DeckStateService);
  private readonly keysData = inject(KeysDataService);
  private readonly ipc = inject(IpcService);

  readonly version = signal('0.1.0');
  readonly exportStatus = signal('');

  // ── Update state ──────────────────────────────────────────────
  readonly updateState = signal<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle');
  readonly updateVersion = signal('');
  readonly updatePercent = signal(0);
  readonly updateError = signal('');
  private unsubscribeUpdate: (() => void) | null = null;

  readonly themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  readonly defaultBgColor = computed(
    () => this.profileState.activeProfile()?.iconStyle?.bgColor ?? '#1a1625',
  );

  readonly defaultAccentColor = computed(
    () => this.profileState.activeProfile()?.iconStyle?.accentColor ?? '#a78bfa',
  );

  readonly screensaverTimeout = computed(
    () => this.profileState.activeProfile()?.screensaverTimeout ?? 300,
  );

  readonly screensaverImage = computed(
    () => this.profileState.activeProfile()?.screensaver ?? null,
  );

  async ngOnInit(): Promise<void> {
    try {
      const v = await this.ipc.invoke<string>(IPC_CHANNELS.APP_GET_VERSION);
      this.version.set(v);
    } catch {
      // Keep default
    }

    // Listen for update status pushed from the main process
    this.unsubscribeUpdate = this.ipc.on(
      IPC_CHANNELS.APP_UPDATE_STATUS,
      (status: unknown) => {
        this.handleUpdateStatus(status as UpdateStatusPayload);
      },
    );
  }

  ngOnDestroy(): void {
    this.unsubscribeUpdate?.();
  }

  setTheme(theme: Theme): void {
    this.themeState.setTheme(theme);
  }

  onDefaultBgChange(color: string): void {
    this.profileState.setProfileIconStyle({
      bgColor: color,
      accentColor: this.defaultAccentColor(),
    });
  }

  onDefaultAccentChange(color: string): void {
    this.profileState.setProfileIconStyle({
      bgColor: this.defaultBgColor(),
      accentColor: color,
    });
  }

  onTimeoutChange(seconds: number | string): void {
    const val = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    this.profileState.setScreensaverTimeout(val);
  }

  async browseScreensaver(): Promise<void> {
    try {
      const result = await this.keysData.browseImage();
      if (result) {
        // Process image through the screensaver handler
        const preview = await this.ipc.invoke<string>(
          IPC_CHANNELS.SCREENSAVER_SET,
          result.base64,
        );
        this.profileState.setScreensaver(preview);
      }
    } catch {
      // User cancelled
    }
  }

  clearScreensaver(): void {
    this.profileState.setScreensaver(undefined);
  }

  async exportProfile(): Promise<void> {
    const profile = this.profileState.activeProfile();
    if (!profile) return;

    const path = await this.profileState.exportProfile(profile.id);
    if (path) {
      this.exportStatus.set(`Exported to ${path}`);
      setTimeout(() => this.exportStatus.set(''), 3000);
    }
  }

  async importProfile(): Promise<void> {
    await this.profileState.importProfile();
    this.deckState.loadFromProfile();
  }

  async copyAllData(): Promise<void> {
    try {
      const json = await this.ipc.invoke<string>(IPC_CHANNELS.PROFILE_COPY_ALL);
      await navigator.clipboard.writeText(json);
      this.exportStatus.set('All data copied to clipboard');
      setTimeout(() => this.exportStatus.set(''), 3000);
    } catch {
      this.exportStatus.set('Failed to copy data');
      setTimeout(() => this.exportStatus.set(''), 3000);
    }
  }

  async openGitHub(): Promise<void> {
    try {
      await this.ipc.invoke(
        IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
        'https://github.com/lucatescari/OpenInput',
      );
    } catch {
      // Ignore
    }
  }

  // ── Updates ────────────────────────────────────────────────────

  async checkForUpdates(): Promise<void> {
    this.updateState.set('checking');
    try {
      await this.ipc.invoke(IPC_CHANNELS.APP_CHECK_UPDATE);
      // Status will be pushed via APP_UPDATE_STATUS listener
    } catch (err) {
      this.updateState.set('error');
      this.updateError.set((err as Error).message);
    }
  }

  async downloadAndInstall(): Promise<void> {
    try {
      await this.ipc.invoke(IPC_CHANNELS.APP_INSTALL_UPDATE);
    } catch (err) {
      this.updateState.set('error');
      this.updateError.set((err as Error).message);
    }
  }

  private handleUpdateStatus(status: UpdateStatusPayload): void {
    this.updateState.set(status.state);
    if ('version' in status && status.version) {
      this.updateVersion.set(status.version);
    }
    if (status.state === 'downloading' && 'percent' in status) {
      this.updatePercent.set(status.percent ?? 0);
    }
    if (status.state === 'error' && 'message' in status) {
      this.updateError.set(status.message ?? 'Unknown error');
    }
  }
}

interface UpdateStatusPayload {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}
