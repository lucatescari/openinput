import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StoreDataService } from '../../services/data/store-data.service';
import { IpcService } from '../../services/data/ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import type {
  StorePlugin,
  StorePluginType,
  InstalledPlugin,
  PluginPermission,
} from '../../../../shared/types/store.types';

type FilterTab = 'all' | 'installed' | StorePluginType;

interface InstallFeedback {
  message: string;
  type: 'success' | 'info';
}

@Component({
  selector: 'app-store-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex h-full flex-col overflow-auto p-6 animate-fade-in" style="scrollbar-gutter: stable">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Plugin Store
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Discover and install community plugins — device drivers, actions, and shared profiles.
        </p>
      </div>

      <!-- Search + Filters -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <!-- Search -->
        <div class="relative max-w-xs flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search plugins..."
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm
              text-gray-700 placeholder-gray-400 transition-colors
              focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40
              dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 dark:placeholder-gray-500
              dark:focus:border-neutral-600"
          />
        </div>

        <!-- Filter tabs -->
        <div class="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-neutral-700 dark:bg-neutral-800/50">
          @for (tab of tabs; track tab.value) {
            <button
              (click)="activeTab.set(tab.value)"
              class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              [class]="activeTab() === tab.value
                ? 'bg-white text-gray-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            >
              {{ tab.label }}
              @if (tab.value === 'installed' && installedCount() > 0) {
                <span class="flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-200 px-1 text-[10px] font-semibold dark:bg-neutral-600">
                  {{ installedCount() }}
                </span>
              }
            </button>
          }
        </div>
      </div>

      <!-- Install feedback banner -->
      @if (installFeedback()) {
        <div class="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 animate-fade-in"
          [class]="installFeedback()!.type === 'success'
            ? 'bg-green-50 border border-green-200 dark:bg-green-900/10 dark:border-green-800'
            : 'bg-blue-50 border border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'"
        >
          @if (installFeedback()!.type === 'success') {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          }
          <span class="text-xs font-medium"
            [class]="installFeedback()!.type === 'success'
              ? 'text-green-800 dark:text-green-300'
              : 'text-blue-800 dark:text-blue-300'"
          >
            {{ installFeedback()!.message }}
          </span>
          <button
            (click)="installFeedback.set(null)"
            class="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }

      <!-- Content -->
      @if (loading()) {
        <div class="flex flex-1 items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <svg class="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span class="text-sm text-gray-500 dark:text-gray-400">Loading plugins...</span>
          </div>
        </div>
      } @else if (filteredPlugins().length === 0) {
        <!-- Empty state -->
        <div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-neutral-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          @if (search()) {
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No matching plugins</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Try a different search term or filter.</p>
            </div>
          } @else if (activeTab() === 'installed') {
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No plugins installed</p>
              <p class="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                Browse the store to discover and install community plugins for devices, actions, and profiles.
              </p>
              <button
                (click)="activeTab.set('all')"
                class="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Browse all plugins
              </button>
            </div>
          } @else if (error()) {
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Could not load plugins</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ error() }}</p>
              <button
                (click)="loadRegistry()"
                class="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Retry
              </button>
            </div>
          } @else {
            <div>
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No plugins available yet</p>
              <p class="mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                The plugin store is brand new. Community-created plugins for devices,
                actions, and profiles will appear here.
              </p>
              <button
                (click)="openContribGuide()"
                class="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Learn how to create a plugin
              </button>
            </div>
          }
        </div>
      } @else {
        <!-- Plugin grid -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          @for (plugin of filteredPlugins(); track plugin.id) {
            <div
              class="group relative flex gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              <!-- Icon -->
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-neutral-800">
                @if (plugin.icon) {
                  <img [src]="plugin.icon" class="h-7 w-7 rounded" alt="" />
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    @switch (plugin.type) {
                      @case ('device') {
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                      }
                      @case ('action') {
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                      }
                      @case ('profile') {
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      }
                    }
                  </svg>
                }
              </div>

              <!-- Info -->
              <div class="flex min-w-0 flex-1 flex-col">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ plugin.name }}
                  </h3>
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                    [class]="typeTagClass(plugin.type)"
                  >
                    {{ plugin.type }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {{ plugin.description }}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>by {{ plugin.author }}</span>
                  <span>v{{ plugin.version }}</span>
                  @if (plugin.platforms && plugin.platforms.length > 0) {
                    <span class="flex items-center gap-1">
                      @for (p of plugin.platforms; track p) {
                        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-neutral-800">{{ platformLabel(p) }}</span>
                      }
                    </span>
                  }
                  @if (plugin.permissions && plugin.permissions.length > 0) {
                    <span class="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      {{ plugin.permissions.length }} permission{{ plugin.permissions.length > 1 ? 's' : '' }}
                    </span>
                  }
                </div>
              </div>

              <!-- Install / Installed badge -->
              <div class="flex shrink-0 items-start pt-0.5">
                @if (isInstalled(plugin.id)) {
                  @if (installing() === plugin.id) {
                    <svg class="h-4 w-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  } @else {
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium text-green-600 dark:text-green-400">Installed</span>
                      <button
                        (click)="uninstall(plugin.id)"
                        class="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-neutral-700 dark:text-gray-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Uninstall"
                      >
                        Uninstall
                      </button>
                    </div>
                  }
                } @else if (!isPlatformSupported(plugin)) {
                  <span class="text-[11px] text-gray-400 dark:text-gray-500">Not available on {{ currentPlatformLabel }}</span>
                } @else {
                  <button
                    (click)="confirmInstall(plugin)"
                    [disabled]="installing() !== null"
                    class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                  >
                    @if (installing() === plugin.id) {
                      <svg class="inline h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    } @else {
                      Install
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <!-- Community CTA at bottom -->
        <div class="mt-8 flex items-center justify-center gap-2 pb-4">
          <span class="text-xs text-gray-400 dark:text-gray-500">Want to create a plugin?</span>
          <button
            (click)="openContribGuide()"
            class="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Read the docs
          </button>
        </div>
      }

      <!-- Install confirmation dialog -->
      @if (confirmPlugin()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" (click)="cancelInstall()">
          <div
            class="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
            (click)="$event.stopPropagation()"
          >
            <!-- Header -->
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  Install {{ confirmPlugin()!.name }}?
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  by {{ confirmPlugin()!.author }}
                </p>
              </div>
            </div>

            <!-- Warning -->
            <div class="mt-4 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/10">
              <p class="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                Community plugins run code on your machine. All plugins in this store
                have been reviewed, but you install them at your own risk. Only install plugins you trust.
              </p>
            </div>

            <!-- Permissions -->
            @if (confirmPlugin()!.permissions && confirmPlugin()!.permissions!.length > 0) {
              <div class="mt-4">
                <p class="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  This plugin requests:
                </p>
                <div class="space-y-1.5">
                  @for (perm of confirmPlugin()!.permissions!; track perm) {
                    <div class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      <div>
                        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ permissionLabel(perm) }}</span>
                        <span class="ml-1 text-[11px] text-gray-400 dark:text-gray-500">{{ permissionDetail(perm) }}</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Platforms -->
            @if (confirmPlugin()!.platforms && confirmPlugin()!.platforms!.length > 0) {
              <div class="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Supported on:</span>
                @for (p of confirmPlugin()!.platforms!; track p) {
                  <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-neutral-800">{{ platformLabel(p) }}</span>
                }
              </div>
            }

            <!-- Actions -->
            <div class="mt-5 flex justify-end gap-3">
              <button
                (click)="cancelInstall()"
                class="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                (click)="proceedInstall()"
                class="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Install Plugin
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class StorePage implements OnInit {
  private readonly storeData = inject(StoreDataService);
  private readonly ipc = inject(IpcService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly activeTab = signal<FilterTab>('all');
  readonly installing = signal<string | null>(null);
  readonly confirmPlugin = signal<StorePlugin | null>(null);
  readonly installFeedback = signal<InstallFeedback | null>(null);

  private readonly plugins = signal<StorePlugin[]>([]);
  private readonly installed = signal<InstalledPlugin[]>([]);

  readonly currentPlatformLabel =
    navigator.platform.startsWith('Mac') ? 'macOS' : 'Windows';

  private readonly currentPlatform: string =
    navigator.platform.startsWith('Mac') ? 'macos' : 'windows';

  readonly tabs: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'installed', label: 'Installed' },
    { value: 'device', label: 'Devices' },
    { value: 'action', label: 'Actions' },
    { value: 'profile', label: 'Profiles' },
  ];

  readonly installedCount = computed(() => {
    const installedIds = new Set(this.installed().map((i) => i.id));
    return this.plugins().filter((p) => installedIds.has(p.id)).length;
  });

  readonly filteredPlugins = computed(() => {
    let list = this.plugins();
    const tab = this.activeTab();
    const query = this.search().toLowerCase().trim();

    if (tab === 'installed') {
      const installedIds = new Set(this.installed().map((i) => i.id));
      list = list.filter((p) => installedIds.has(p.id));
    } else if (tab !== 'all') {
      list = list.filter((p) => p.type === tab);
    }

    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.author.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    // Check for query param to auto-select a tab (e.g. ?type=device from deck page)
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam && ['device', 'action', 'profile', 'installed'].includes(typeParam)) {
      this.activeTab.set(typeParam as FilterTab);
    }
    await this.loadRegistry();
  }

  async loadRegistry(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [registry, installedList] = await Promise.all([
        this.storeData.fetchRegistry(),
        this.storeData.getInstalled(),
      ]);
      this.plugins.set(registry.plugins);
      this.installed.set(installedList);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  isInstalled(pluginId: string): boolean {
    return this.installed().some((p) => p.id === pluginId);
  }

  /** Show the confirmation dialog before installing. */
  confirmInstall(plugin: StorePlugin): void {
    this.confirmPlugin.set(plugin);
  }

  cancelInstall(): void {
    this.confirmPlugin.set(null);
  }

  async proceedInstall(): Promise<void> {
    const plugin = this.confirmPlugin();
    if (!plugin) return;
    this.confirmPlugin.set(null);
    await this.install(plugin);
  }

  async install(plugin: StorePlugin): Promise<void> {
    this.installing.set(plugin.id);
    this.installFeedback.set(null);
    try {
      const result = await this.storeData.installPlugin(plugin);
      this.installed.set(result.installed);

      // Show appropriate feedback based on plugin type
      if (result.needsRestart) {
        this.installFeedback.set({
          message: `${plugin.name} installed. Restart OpenInput to activate the device driver.`,
          type: 'info',
        });
      } else if (result.profilesImported > 0) {
        const s = result.profilesImported === 1 ? '' : 's';
        this.installFeedback.set({
          message: `${plugin.name} installed — ${result.profilesImported} profile${s} added to your library.`,
          type: 'success',
        });
      } else {
        this.installFeedback.set({
          message: `${plugin.name} installed and ready to use.`,
          type: 'success',
        });
      }

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        if (this.installFeedback()?.message.startsWith(plugin.name)) {
          this.installFeedback.set(null);
        }
      }, 8000);
    } catch {
      this.installFeedback.set({
        message: `Failed to install ${plugin.name}. Please try again.`,
        type: 'info',
      });
    } finally {
      this.installing.set(null);
    }
  }

  isPlatformSupported(plugin: StorePlugin): boolean {
    if (!plugin.platforms || plugin.platforms.length === 0) return true;
    return plugin.platforms.includes(this.currentPlatform as any);
  }

  platformLabel(platform: string): string {
    switch (platform) {
      case 'macos': return 'macOS';
      case 'windows': return 'Windows';
      default: return platform;
    }
  }

  permissionLabel(perm: PluginPermission): string {
    const labels: Record<PluginPermission, string> = {
      notifications: 'Notifications',
      shell: 'Shell Commands',
      network: 'Network Access',
      filesystem: 'File System',
      clipboard: 'Clipboard',
      keyboard: 'Keyboard Input',
      system: 'System APIs',
    };
    return labels[perm] ?? perm;
  }

  permissionDetail(perm: PluginPermission): string {
    const details: Record<PluginPermission, string> = {
      notifications: 'Can show desktop notifications',
      shell: 'Can execute system commands',
      network: 'Can make HTTP requests',
      filesystem: 'Can read and write files',
      clipboard: 'Can read and write the clipboard',
      keyboard: 'Can simulate keyboard shortcuts',
      system: 'Can control brightness, volume, etc.',
    };
    return details[perm] ?? '';
  }

  async uninstall(pluginId: string): Promise<void> {
    this.installing.set(pluginId);
    try {
      const updated = await this.storeData.uninstallPlugin(pluginId);
      this.installed.set(updated);
    } catch {
      // Toast would go here
    } finally {
      this.installing.set(null);
    }
  }

  typeTagClass(type: StorePluginType): string {
    switch (type) {
      case 'device':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'action':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'profile':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    }
  }

  async openContribGuide(): Promise<void> {
    try {
      await this.ipc.invoke(
        IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
        'https://github.com/lucatescari/OpenInput/blob/main/docs/plugins.md',
      );
    } catch {
      // Ignore
    }
  }
}
