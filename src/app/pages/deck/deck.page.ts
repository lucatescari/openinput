import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DeviceStateService } from '../../services/state/device-state.service';
import { DeckStateService } from '../../services/state/deck-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { DeckViewComponent } from '../../components/deck/deck-view.component';
import { KeyConfigComponent } from '../../components/config/key-config.component';
import { EncoderConfigComponent } from '../../components/config/encoder-config.component';
import { TouchConfigComponent } from '../../components/config/touch-config.component';
import { ActionPaletteComponent } from '../../components/palette/action-palette.component';

@Component({
  selector: 'app-deck-page',
  standalone: true,
  imports: [
    FormsModule,
    DeckViewComponent,
    KeyConfigComponent,
    EncoderConfigComponent,
    TouchConfigComponent,
    ActionPaletteComponent,
  ],
  template: `
    <div class="flex h-full animate-fade-in">
      <!-- Not connected: centered connection UI -->
      @if (!deviceState.isConnected()) {
        <div class="flex flex-1 flex-col items-center justify-center overflow-auto p-6" style="scrollbar-gutter: stable">
          <div class="max-w-md text-center">
            @if (deviceState.hasDevicePlugins() === false) {
              <!-- No device plugins installed — guide user to store -->
              <div
                class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                Welcome to OpenInput
              </h2>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                To get started, install a device driver for your hardware from the Plugin Store.
              </p>
              <button
                (click)="goToStore()"
                class="mt-6 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                Open Plugin Store
              </button>
              <p class="mt-4 text-xs text-gray-400 dark:text-gray-500">
                After installing a device driver, restart the app and plug in your device.
              </p>
            } @else {
              <!-- Has plugins but no device connected -->
              <div
                class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-neutral-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                No Device Connected
              </h2>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                @if (deviceState.status() === 'connecting') {
                  Connecting to device...
                } @else if (deviceState.error()) {
                  {{ deviceState.error() }}
                } @else {
                  Plug in a supported device or click scan to search.
                }
              </p>
              <button
                (click)="scanDevices()"
                class="mt-6 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                [disabled]="deviceState.status() === 'connecting'"
              >
                @if (deviceState.status() === 'connecting') {
                  Connecting...
                } @else {
                  Scan for Devices
                }
              </button>

              @if (deviceState.devices().length > 0) {
                <div class="mt-6 space-y-2 text-left">
                  @for (device of deviceState.devices(); track device.path) {
                    <button
                      (click)="connectDevice(device.path)"
                      class="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800/50"
                    >
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary-600 dark:text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ device.name }}</p>
                        <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ device.path }}</p>
                      </div>
                      <span class="text-xs font-medium text-primary-600 dark:text-primary-400">Connect</span>
                    </button>
                  }
                </div>
              } @else if (deviceState.status() !== 'connecting') {
                <div class="mt-4">
                  <button
                    (click)="goToStore()"
                    class="text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Need a different device? Browse the Plugin Store
                  </button>
                </div>
              }
            }
          </div>
        </div>
      }

      <!-- Connected: deck + config center | action palette right -->
      @if (deviceState.isConnected()) {
        <!-- Center: Deck view + config panel below -->
        <div class="flex flex-1 flex-col overflow-auto p-6" style="scrollbar-gutter: stable">

          <!-- Page tabs -->
          <div class="mb-3 flex items-center gap-1">
            <!-- Folder breadcrumb — shown when inside a folder -->
            @if (profileState.activeFolder() !== null) {
              <button
                (click)="exitFolder()"
                class="flex items-center gap-1 rounded-lg bg-primary-100 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to page
              </button>
              <span class="text-xs text-gray-400 dark:text-gray-500 px-2">
                Folder (Key {{ profileState.activeFolder()! + 1 }})
              </span>
            } @else {
              <!-- Page tabs (hidden when inside a folder) -->
              @for (page of profileState.pages(); track $index) {
                <button
                  (click)="switchPage($index)"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  [class]="$index === profileState.activePage()
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-neutral-800 dark:text-gray-400 dark:hover:bg-neutral-700'"
                >
                  @if (editingPageIndex() === $index) {
                    <input
                      type="text"
                      [ngModel]="editingPageName()"
                      (ngModelChange)="editingPageName.set($event)"
                      (blur)="finishPageRename()"
                      (keydown.enter)="finishPageRename()"
                      (keydown.escape)="cancelPageRename()"
                      (click)="$event.stopPropagation()"
                      class="w-20 bg-transparent text-center text-xs outline-none"
                      #pageNameInput
                    />
                  } @else {
                    <span (dblclick)="startPageRename($index, page.name, $event)">
                      {{ page.name }}
                    </span>
                  }
                </button>
              }

              <!-- Add page button -->
              <button
                (click)="addPage()"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-gray-300"
                title="Add page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <!-- Delete page button (only show if more than 1 page) -->
              @if (profileState.pages().length > 1) {
                <button
                  (click)="deletePage(profileState.activePage())"
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Delete current page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              }
            }
          </div>

          <!-- Deck view -->
          <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <div class="mx-auto max-w-lg">
              <app-deck-view />
            </div>
          </div>

          <!-- Config panel — appears below deck when an element is selected -->
          @if (deckState.selectedElement(); as sel) {
            <div class="mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 animate-fade-in">
              @switch (sel.type) {
                @case ('key') {
                  <app-key-config (folderEntered)="enterFolder($event)" />
                }
                @case ('encoder') {
                  <app-encoder-config />
                }
                @case ('touch') {
                  <app-touch-config />
                }
              }
            </div>
          } @else {
            <!-- Hint when nothing is selected -->
            <div class="mt-4 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-8 dark:border-neutral-800">
              <div class="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-8 w-8 text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p class="mt-2 text-sm text-gray-400 dark:text-gray-500">
                  Select an element or drag an action onto a key
                </p>
              </div>
            </div>
          }

          <!-- Event log — collapsible -->
          <div class="mt-4 rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <button
              (click)="eventLogOpen.set(!eventLogOpen())"
              class="flex w-full items-center justify-between px-4 py-3"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="h-3.5 w-3.5 text-gray-400 transition-transform"
                  [class.rotate-90]="eventLogOpen()"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
                <span class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Event Log
                </span>
                @if (deviceState.eventLog().length > 0) {
                  <span class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-neutral-800">
                    {{ deviceState.eventLog().length }}
                  </span>
                }
              </div>
              @if (eventLogOpen()) {
                <button
                  (click)="clearEventLog($event)"
                  class="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              }
            </button>

            @if (eventLogOpen()) {
              <div class="max-h-40 overflow-y-auto border-t border-gray-100 dark:border-neutral-800">
                @for (event of deviceState.eventLog(); track $index) {
                  <div class="flex items-center gap-3 border-b border-gray-50 px-4 py-1.5 last:border-b-0 dark:border-neutral-800/50">
                    <span class="w-16 font-mono text-[10px] text-gray-400">{{ formatTime(event.timestamp) }}</span>
                    <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ formatEventType(event.type) }}</span>
                    <span class="text-[10px] text-gray-400">#{{ event.index }}</span>
                  </div>
                } @empty {
                  <div class="px-4 py-3">
                    <span class="text-xs text-gray-400">Press a button on your device...</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Right: Action Palette (always visible) -->
        <div class="w-56 shrink-0 border-l border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <app-action-palette />
        </div>
      }
    </div>
  `,
})
export class DeckPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly deviceState = inject(DeviceStateService);
  readonly deckState = inject(DeckStateService);
  readonly profileState = inject(ProfileStateService);

  readonly eventLogOpen = signal(false);
  readonly editingPageIndex = signal<number | null>(null);
  readonly editingPageName = signal('');

  private unsubscribeNav: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.deviceState.scanDevices();
    this.deckState.loadFromProfile();

    // Listen for nav events from the device (physical page/folder changes)
    this.unsubscribeNav = this.deviceState.onDeviceNav((nav) => {
      // notifyDevice=false because this change came from the device
      this.profileState.setActivePage(nav.page, false);
      if (nav.folder !== null) {
        this.profileState.enterFolder(nav.folder, false);
      } else {
        this.profileState.exitFolder(false);
      }
      this.deckState.loadFromProfileAnimated();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeNav?.();
  }

  async scanDevices(): Promise<void> {
    await this.deviceState.scanDevices();
  }

  async connectDevice(path: string): Promise<void> {
    await this.deviceState.connect(path);
  }

  goToStore(): void {
    this.router.navigate(['/store'], { queryParams: { type: 'device' } });
  }

  // ──────────────── Page Management ────────────────

  switchPage(index: number): void {
    if (this.editingPageIndex() !== null) return;
    this.profileState.setActivePage(index);
    this.deckState.loadFromProfileAnimated();
    this.deckState.clearSelection();
  }

  addPage(): void {
    this.profileState.addPage();
    // Switch to the newly added page
    const pages = this.profileState.pages();
    this.profileState.setActivePage(pages.length - 1);
    this.deckState.loadFromProfileAnimated();
    this.deckState.clearSelection();
  }

  deletePage(index: number): void {
    this.profileState.deletePage(index);
    this.deckState.loadFromProfileAnimated();
    this.deckState.clearSelection();
  }

  startPageRename(index: number, currentName: string, event: Event): void {
    event.stopPropagation();
    this.editingPageIndex.set(index);
    this.editingPageName.set(currentName);
  }

  finishPageRename(): void {
    const index = this.editingPageIndex();
    if (index === null) return;
    const name = this.editingPageName().trim();
    if (name) {
      this.profileState.renamePage(index, name);
    }
    this.editingPageIndex.set(null);
    this.editingPageName.set('');
  }

  cancelPageRename(): void {
    this.editingPageIndex.set(null);
    this.editingPageName.set('');
  }

  // ──────────────── Folder Navigation ────────────────

  enterFolder(keyIndex: number): void {
    this.profileState.enterFolder(keyIndex);
    this.deckState.loadFromProfileAnimated();
    this.deckState.clearSelection();
  }

  exitFolder(): void {
    this.profileState.exitFolder();
    this.deckState.loadFromProfileAnimated();
    this.deckState.clearSelection();
  }

  // ──────────────── Event Log ────────────────

  clearEventLog(event: Event): void {
    event.stopPropagation();
    this.deviceState.clearEventLog();
  }

  formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatEventType(type: string): string {
    const map: Record<string, string> = {
      key_down: 'Key Down',
      key_up: 'Key Up',
      encoder_cw: 'Encoder CW',
      encoder_ccw: 'Encoder CCW',
      encoder_press: 'Encoder Press',
      touch_press: 'Touch Press',
      touch_release: 'Touch Release',
      swipe_left: 'Swipe Left',
      swipe_right: 'Swipe Right',
    };
    return map[type] ?? type;
  }
}
