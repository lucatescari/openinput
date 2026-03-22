import { Component, inject, input, output, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ActionConfig, ActionType, MediaAction, SystemAction } from '../../../../shared/types/action.types';
import { HotkeyRecorderComponent } from './hotkey-recorder.component';
import { CustomSelectComponent, type SelectOption } from '../ui/custom-select.component';
import { IpcService } from '../../services/data/ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import { BUILTIN_PLUGINS } from '../../plugins/builtin-plugins';

@Component({
  selector: 'app-action-picker',
  standalone: true,
  imports: [FormsModule, HotkeyRecorderComponent, CustomSelectComponent],
  template: `
    <div class="space-y-3">
      <!-- Action type selector -->
      <app-select
        [options]="visibleOptions()"
        [value]="actionType()"
        placeholder="Select action..."
        (valueChange)="onTypeChange($event)"
      />

      <!-- Type-specific config -->
      @switch (actionType()) {
        @case ('hotkey') {
          <div class="space-y-2">
            @if (hotkeyDisplay()) {
              <div class="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-neutral-800">
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {{ hotkeyDisplay() }}
                </span>
                <button
                  (click)="clearHotkey()"
                  class="text-[10px] text-gray-400 hover:text-red-500"
                >
                  Clear
                </button>
              </div>
            }
            <app-hotkey-recorder (hotkeyRecorded)="onHotkeyRecorded($event)" />
          </div>
        }

        @case ('hotkey_switch') {
          <div class="space-y-3">
            <div class="space-y-2">
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400">Hotkey A</label>
              @if (hotkeyDisplay()) {
                <div class="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-neutral-800">
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ hotkeyDisplay() }}</span>
                  <button (click)="clearHotkey()" class="text-[10px] text-gray-400 hover:text-red-500">Clear</button>
                </div>
              }
              <app-hotkey-recorder (hotkeyRecorded)="onSwitchHotkey1($event)" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400">Hotkey B</label>
              @if (hotkey2Display()) {
                <div class="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-neutral-800">
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ hotkey2Display() }}</span>
                  <button (click)="clearHotkey2()" class="text-[10px] text-gray-400 hover:text-red-500">Clear</button>
                </div>
              }
              <app-hotkey-recorder (hotkeyRecorded)="onSwitchHotkey2($event)" />
            </div>
          </div>
        }

        @case ('launch_app') {
          <div class="space-y-2">
            <div class="flex gap-2">
              <input
                type="text"
                [ngModel]="appPath()"
                (ngModelChange)="onAppPathChange($event)"
                placeholder="Select an application..."
                class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
              <button
                (click)="browseApp()"
                class="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Browse
              </button>
            </div>
            @if (appPath()) {
              <p class="text-[10px] text-gray-400">
                {{ extractFileName(appPath()) }}
              </p>
            }
          </div>
        }

        @case ('close_app') {
          <div class="space-y-2">
            <div class="flex gap-2">
              <input
                type="text"
                [ngModel]="appPath()"
                (ngModelChange)="onCloseAppPathChange($event)"
                placeholder="Select an application..."
                class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
              <button
                (click)="browseCloseApp()"
                class="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Browse
              </button>
            </div>
            @if (appPath()) {
              <p class="text-[10px] text-gray-400">
                Will quit: {{ extractAppName(appPath()) }}
              </p>
            }
          </div>
        }

        @case ('media') {
          <app-select
            [options]="mediaOptions"
            [value]="mediaAction()"
            placeholder="Select action..."
            (valueChange)="onMediaChange($event)"
          />
        }

        @case ('system') {
          <app-select
            [options]="systemOptions"
            [value]="systemAction()"
            placeholder="Select action..."
            (valueChange)="onSystemChange($event)"
          />
        }

        @case ('open_url') {
          <input
            type="url"
            [ngModel]="url()"
            (ngModelChange)="onUrlChange($event)"
            placeholder="https://example.com"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
          />
        }

        @case ('open_file') {
          <div class="space-y-2">
            <div class="flex gap-2">
              <input
                type="text"
                [ngModel]="filePath()"
                (ngModelChange)="onFilePathChange($event)"
                placeholder="/path/to/file"
                class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
              <button
                (click)="browseFile()"
                class="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Browse
              </button>
            </div>
            @if (filePath()) {
              <p class="text-[10px] text-gray-400">
                {{ extractFileName(filePath()) }}
              </p>
            }
          </div>
        }

        @case ('text') {
          <div class="space-y-2">
            <textarea
              [ngModel]="text()"
              (ngModelChange)="onTextChange($event)"
              placeholder="Text to type..."
              rows="3"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
            ></textarea>
            <p class="text-[10px] text-gray-400">
              Types this text when the key is pressed.
            </p>
          </div>
        }

        @case ('page_goto') {
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Page number</label>
              <input
                type="number"
                min="1"
                [ngModel]="pageNumber()"
                (ngModelChange)="onPageNumberChange($event)"
                class="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
            </div>
            <p class="text-[10px] text-gray-400">
              Jump to page {{ pageNumber() }} when pressed.
            </p>
          </div>
        }

        @case ('folder') {
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Press this key to open a folder. Configure the folder contents by clicking the key and entering the folder.
          </p>
        }

        @case ('page_next') {
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Switches to the next page. Wraps around to page 1 after the last page.
          </p>
        }

        @case ('page_previous') {
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Switches to the previous page. Wraps around to the last page from page 1.
          </p>
        }

        @case ('multi_action') {
          <div class="space-y-3">
            <!-- Delay between actions -->
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Delay between</label>
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                [ngModel]="delayMs()"
                (ngModelChange)="onDelayChange($event)"
                class="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
              <span class="text-xs text-gray-400">ms</span>
            </div>

            <!-- Sub-actions -->
            @for (sub of subActions(); track $index) {
              <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
                <div class="mb-2 flex items-center justify-between">
                  <span class="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Step {{ $index + 1 }}
                  </span>
                  <button
                    (click)="removeSubAction($index)"
                    class="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <app-action-picker
                  [action]="sub"
                  [excludeMultiAction]="true"
                  (actionChanged)="onSubActionChanged($index, $event)"
                />
              </div>
            }

            <!-- Add step button -->
            <button
              (click)="addSubAction()"
              class="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-neutral-700 dark:text-gray-400 dark:hover:border-primary-500 dark:hover:text-primary-400"
            >
              + Add Step
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class ActionPickerComponent {
  private readonly ipc = inject(IpcService);

  readonly action = input<ActionConfig | undefined>(undefined);
  readonly excludeMultiAction = input(false);
  readonly excludeFolder = input(false);
  readonly actionChanged = output<ActionConfig>();

  readonly actionType = signal<ActionType>('none');
  readonly hotkeyDisplay = signal('');
  readonly hotkey2Display = signal('');
  readonly appPath = signal('');
  readonly mediaAction = signal('');
  readonly systemAction = signal('');
  readonly url = signal('');
  readonly filePath = signal('');
  readonly text = signal('');
  readonly delayMs = signal(100);
  readonly subActions = signal<ActionConfig[]>([]);
  readonly pageNumber = signal(1);

  private currentHotkey: { modifiers: string[]; key: string } | undefined;
  private currentHotkey2: { modifiers: string[]; key: string } | undefined;

  /** Debounce timers for text inputs that trigger icon generation */
  private appPathTimer: ReturnType<typeof setTimeout> | null = null;
  private closeAppPathTimer: ReturnType<typeof setTimeout> | null = null;
  private urlTimer: ReturnType<typeof setTimeout> | null = null;
  private filePathTimer: ReturnType<typeof setTimeout> | null = null;

  readonly allActionTypeOptions: SelectOption[] = [
    { value: 'none', label: 'No Action' },
    { value: 'hotkey', label: 'Keyboard Shortcut' },
    { value: 'hotkey_switch', label: 'Hotkey Switch (Toggle)' },
    { value: 'launch_app', label: 'Launch Application' },
    { value: 'close_app', label: 'Close Application' },
    { value: 'media', label: 'Media Control' },
    { value: 'system', label: 'System Control' },
    { value: 'open_url', label: 'Open URL' },
    { value: 'open_file', label: 'Open File' },
    { value: 'text', label: 'Type Text' },
    { value: 'page_next', label: 'Next Page' },
    { value: 'page_previous', label: 'Previous Page' },
    { value: 'page_goto', label: 'Go to Page' },
    { value: 'folder', label: 'Folder' },
    { value: 'multi_action', label: 'Multi Action' },
  ];

  readonly mediaOptions: SelectOption[] = [
    { value: 'play_pause', label: 'Play / Pause' },
    { value: 'next_track', label: 'Next Track' },
    { value: 'prev_track', label: 'Previous Track' },
    { value: 'volume_up', label: 'Volume Up' },
    { value: 'volume_down', label: 'Volume Down' },
    { value: 'mute', label: 'Mute / Unmute' },
  ];

  readonly systemOptions: SelectOption[] = [
    { value: 'brightness_up', label: 'Brightness Up' },
    { value: 'brightness_down', label: 'Brightness Down' },
  ];

  /**
   * Dropdown options scoped to the current action's plugin.
   * When an action is set (e.g. from drag-and-drop), only show
   * the action types from the same plugin category.
   * When no action is set, show the full list.
   */
  readonly visibleOptions = computed(() => {
    const a = this.action();
    let options: SelectOption[];

    if (a && a.type !== 'none') {
      // Find which plugin owns this action type
      const plugin = BUILTIN_PLUGINS.find(p =>
        p.actions.some(ad => ad.defaultConfig.type === a.type),
      );

      if (plugin) {
        // Collect unique action types from this plugin
        const types = new Set(plugin.actions.map(ad => ad.defaultConfig.type));
        options = this.allActionTypeOptions.filter(
          o => o.value === 'none' || types.has(o.value as ActionType),
        );
      } else {
        options = [...this.allActionTypeOptions];
      }
    } else {
      options = [...this.allActionTypeOptions];
    }

    if (this.excludeMultiAction()) {
      options = options.filter(o => o.value !== 'multi_action');
    }
    if (this.excludeFolder()) {
      options = options.filter(o => o.value !== 'folder');
    }
    return options;
  });

  constructor() {
    // Sync local signals from the action input whenever it changes
    effect(() => {
      const a = this.action();

      if (a && a.type !== 'none') {
        this.actionType.set(a.type);
        this.hotkeyDisplay.set(
          a.hotkey ? this.formatHotkey(a.hotkey.modifiers, a.hotkey.key) : '',
        );
        this.currentHotkey = a.hotkey;
        this.hotkey2Display.set(
          a.hotkey2 ? this.formatHotkey(a.hotkey2.modifiers, a.hotkey2.key) : '',
        );
        this.currentHotkey2 = a.hotkey2;
        this.appPath.set(a.appPath ?? '');
        this.mediaAction.set(a.mediaAction ?? '');
        this.systemAction.set(a.systemAction ?? '');
        this.url.set(a.url ?? '');
        this.filePath.set(a.filePath ?? '');
        this.text.set(a.text ?? '');
        this.delayMs.set(a.delayMs ?? 100);
        this.subActions.set(a.actions ? [...a.actions] : []);
        this.pageNumber.set((a.pageIndex ?? 0) + 1);
      } else {
        this.actionType.set('none');
        this.hotkeyDisplay.set('');
        this.hotkey2Display.set('');
        this.currentHotkey = undefined;
        this.currentHotkey2 = undefined;
        this.appPath.set('');
        this.mediaAction.set('');
        this.systemAction.set('');
        this.url.set('');
        this.filePath.set('');
        this.text.set('');
        this.delayMs.set(100);
        this.subActions.set([]);
        this.pageNumber.set(1);
      }
    });
  }

  onTypeChange(type: string): void {
    this.actionType.set(type as ActionType);
    if (type === 'multi_action') {
      this.subActions.set([]);
      this.delayMs.set(100);
      this.emitMultiAction();
    } else if (type === 'page_goto') {
      this.pageNumber.set(1);
      this.actionChanged.emit({ type: 'page_goto', pageIndex: 0, label: 'Go to Page 1' });
    } else if (type === 'page_next') {
      this.actionChanged.emit({ type: 'page_next', label: 'Next Page' });
    } else if (type === 'page_previous') {
      this.actionChanged.emit({ type: 'page_previous', label: 'Prev Page' });
    } else if (type === 'folder') {
      this.actionChanged.emit({ type: 'folder', label: 'Folder' });
    } else {
      // Always emit immediately so the action is saved to the profile.
      // This ensures switching keys properly resets the picker.
      this.actionChanged.emit({ type: type as ActionType });
    }
  }

  onHotkeyRecorded(hotkey: { modifiers: string[]; key: string }): void {
    this.hotkeyDisplay.set(this.formatHotkey(hotkey.modifiers, hotkey.key));
    this.currentHotkey = hotkey;
    this.actionChanged.emit({
      type: 'hotkey',
      label: this.formatHotkey(hotkey.modifiers, hotkey.key),
      hotkey,
    });
  }

  clearHotkey(): void {
    this.hotkeyDisplay.set('');
    this.currentHotkey = undefined;
    if (this.actionType() === 'hotkey') {
      this.actionChanged.emit({ type: 'none' });
      this.actionType.set('none');
    } else if (this.actionType() === 'hotkey_switch') {
      this.emitHotkeySwitch();
    }
  }

  clearHotkey2(): void {
    this.hotkey2Display.set('');
    this.currentHotkey2 = undefined;
    this.emitHotkeySwitch();
  }

  onSwitchHotkey1(hotkey: { modifiers: string[]; key: string }): void {
    this.hotkeyDisplay.set(this.formatHotkey(hotkey.modifiers, hotkey.key));
    this.currentHotkey = hotkey;
    this.emitHotkeySwitch();
  }

  onSwitchHotkey2(hotkey: { modifiers: string[]; key: string }): void {
    this.hotkey2Display.set(this.formatHotkey(hotkey.modifiers, hotkey.key));
    this.currentHotkey2 = hotkey;
    this.emitHotkeySwitch();
  }

  private emitHotkeySwitch(): void {
    if (this.currentHotkey && this.currentHotkey2) {
      this.actionChanged.emit({
        type: 'hotkey_switch',
        label: `${this.formatHotkey(this.currentHotkey.modifiers, this.currentHotkey.key)} \u21C4 ${this.formatHotkey(this.currentHotkey2.modifiers, this.currentHotkey2.key)}`,
        hotkey: this.currentHotkey,
        hotkey2: this.currentHotkey2,
      });
    }
  }

  async browseApp(): Promise<void> {
    try {
      const path = await this.ipc.invoke<string | null>(IPC_CHANNELS.APP_BROWSE);
      if (path) {
        // Emit immediately — dialog-selected paths are valid
        this.appPath.set(path);
        if (this.appPathTimer) clearTimeout(this.appPathTimer);
        this.actionChanged.emit({
          type: 'launch_app',
          label: this.extractAppName(path),
          appPath: path,
        });
      }
    } catch {
      // User cancelled or error
    }
  }

  async browseCloseApp(): Promise<void> {
    try {
      const path = await this.ipc.invoke<string | null>(IPC_CHANNELS.APP_BROWSE);
      if (path) {
        this.appPath.set(path);
        if (this.closeAppPathTimer) clearTimeout(this.closeAppPathTimer);
        this.actionChanged.emit({
          type: 'close_app',
          label: 'Close ' + (this.extractAppName(path)),
          appPath: path,
        });
      }
    } catch {
      // User cancelled or error
    }
  }

  async browseFile(): Promise<void> {
    try {
      const path = await this.ipc.invoke<string | null>(IPC_CHANNELS.FILE_BROWSE);
      if (path) {
        this.filePath.set(path);
        if (this.filePathTimer) clearTimeout(this.filePathTimer);
        this.actionChanged.emit({
          type: 'open_file',
          label: this.extractFileName(path),
          filePath: path,
        });
      }
    } catch {
      // User cancelled or error
    }
  }

  onAppPathChange(path: string): void {
    this.appPath.set(path);
    if (this.appPathTimer) clearTimeout(this.appPathTimer);
    if (path) {
      this.appPathTimer = setTimeout(() => {
        this.actionChanged.emit({
          type: 'launch_app',
          label: this.extractAppName(path),
          appPath: path,
        });
      }, 600);
    }
  }

  onCloseAppPathChange(path: string): void {
    this.appPath.set(path);
    if (this.closeAppPathTimer) clearTimeout(this.closeAppPathTimer);
    if (path) {
      this.closeAppPathTimer = setTimeout(() => {
        this.actionChanged.emit({
          type: 'close_app',
          label: 'Close ' + (this.extractAppName(path)),
          appPath: path,
        });
      }, 600);
    }
  }

  onMediaChange(action: string): void {
    this.mediaAction.set(action);
    if (action) {
      const labels: Record<string, string> = {
        play_pause: 'Play/Pause',
        next_track: 'Next Track',
        prev_track: 'Prev Track',
        volume_up: 'Vol Up',
        volume_down: 'Vol Down',
        mute: 'Mute',
      };
      this.actionChanged.emit({
        type: 'media',
        label: labels[action] ?? action,
        mediaAction: action as MediaAction,
      });
    }
  }

  onSystemChange(action: string): void {
    this.systemAction.set(action);
    if (action) {
      const labels: Record<string, string> = {
        brightness_up: 'Brightness Up',
        brightness_down: 'Brightness Down',
      };
      this.actionChanged.emit({
        type: 'system',
        label: labels[action] ?? action,
        systemAction: action as SystemAction,
      });
    }
  }

  onUrlChange(url: string): void {
    this.url.set(url);
    if (this.urlTimer) clearTimeout(this.urlTimer);
    if (url) {
      this.urlTimer = setTimeout(() => {
        this.actionChanged.emit({
          type: 'open_url',
          label: url,
          url,
        });
      }, 600);
    }
  }

  onFilePathChange(path: string): void {
    this.filePath.set(path);
    if (this.filePathTimer) clearTimeout(this.filePathTimer);
    if (path) {
      this.filePathTimer = setTimeout(() => {
        this.actionChanged.emit({
          type: 'open_file',
          label: this.extractFileName(path),
          filePath: path,
        });
      }, 600);
    }
  }

  onPageNumberChange(num: number): void {
    const pageNum = Math.max(1, num || 1);
    this.pageNumber.set(pageNum);
    this.actionChanged.emit({
      type: 'page_goto',
      label: `Go to Page ${pageNum}`,
      pageIndex: pageNum - 1,
    });
  }

  onTextChange(text: string): void {
    this.text.set(text);
    this.actionChanged.emit({
      type: 'text',
      label: text.length > 15 ? text.slice(0, 14) + '\u2026' : text || 'Text',
      text,
    });
  }

  onDelayChange(delay: number): void {
    this.delayMs.set(delay);
    this.emitMultiAction();
  }

  addSubAction(): void {
    this.subActions.update(list => [...list, { type: 'none' }]);
  }

  removeSubAction(index: number): void {
    this.subActions.update(list => list.filter((_, i) => i !== index));
    this.emitMultiAction();
  }

  onSubActionChanged(index: number, action: ActionConfig): void {
    this.subActions.update(list => {
      const copy = [...list];
      copy[index] = action;
      return copy;
    });
    this.emitMultiAction();
  }

  private emitMultiAction(): void {
    const actions = this.subActions().filter(a => a.type !== 'none');
    this.actionChanged.emit({
      type: 'multi_action',
      label: `Multi (${actions.length})`,
      actions,
      delayMs: this.delayMs(),
    });
  }

  private formatHotkey(modifiers: string[], key: string): string {
    const modMap: Record<string, string> = {
      command: '\u2318',
      ctrl: '\u2303',
      alt: '\u2325',
      shift: '\u21E7',
    };
    const keyMap: Record<string, string> = {
      space: 'Space',
      return: '\u23CE',
      backspace: '\u232B',
      delete: '\u2326',
      escape: 'Esc',
      tab: '\u21E5',
      up: '\u2191',
      down: '\u2193',
      left: '\u2190',
      right: '\u2192',
    };

    const parts = modifiers.map((m) => modMap[m] ?? m);
    parts.push(keyMap[key] ?? key.toUpperCase());
    return parts.join('');
  }

  /** Extract filename from a path (handles both / and \ separators) */
  extractFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() ?? filePath;
  }

  /** Extract app name from a path (strips .app and .exe extensions) */
  extractAppName(filePath: string): string {
    return (filePath.split(/[\\/]/).pop() ?? filePath)
      .replace(/\.(app|exe)$/i, '');
  }
}
