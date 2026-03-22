import { Component, inject, computed, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeckStateService } from '../../services/state/deck-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { ActionPickerComponent } from './action-picker.component';
import { ColorPickerComponent } from '../ui/color-picker.component';
import type { ActionConfig } from '../../../../shared/types/action.types';
import type { IconStyle } from '../../../../shared/types/profile.types';

@Component({
  selector: 'app-key-config',
  standalone: true,
  imports: [FormsModule, ActionPickerComponent, ColorPickerComponent],
  template: `
    <div class="flex gap-5">
      <!-- Left: Image preview + upload (fixed width to prevent layout shift) -->
      <div class="flex w-20 shrink-0 flex-col items-center gap-2">
        <div
          class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/50"
        >
          @if (deckState.selectedKeyImage()) {
            <img
              [src]="'data:image/jpeg;base64,' + deckState.selectedKeyImage()"
              class="h-full w-full object-cover"
              alt="Key preview"
            />
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        </div>
        <button
          (click)="uploadImage()"
          class="w-full rounded-md bg-primary-600 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          [disabled]="deckState.loading()"
        >
          Upload
        </button>
      </div>

      <!-- Right: Config -->
      <div class="min-w-0 flex-1 space-y-3">
        <!-- Header + clear button -->
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            Key {{ selectedIndex() + 1 }}
          </h3>
          @if (hasAction() || deckState.selectedKeyImage()) {
            <button
              (click)="clearKey()"
              class="text-[10px] font-medium text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
            >
              Clear Key
            </button>
          }
        </div>

        <!-- Action -->
        <app-action-picker
          [action]="currentAction()"
          [excludeFolder]="isInsideFolder()"
          (actionChanged)="onActionChanged($event)"
        />

        <!-- Folder: enter button -->
        @if (currentAction()?.type === 'folder') {
          <button
            (click)="enterFolder()"
            class="w-full rounded-lg border-2 border-dashed border-primary-300 px-3 py-2 text-xs font-medium text-primary-600 transition-colors hover:border-primary-400 hover:bg-primary-50 dark:border-primary-700 dark:text-primary-400 dark:hover:border-primary-500 dark:hover:bg-primary-900/20"
          >
            Open Folder to Edit Contents
          </button>
        }

        <!-- Auto-icon options: title + colors in a compact row -->
        @if (hasAutoIcon()) {
          <div class="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3 dark:border-neutral-800">
            <div class="min-w-[120px] flex-1">
              <label class="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">Title</label>
              <input
                type="text"
                [ngModel]="keyTitle()"
                (ngModelChange)="onTitleChange($event)"
                placeholder="Optional..."
                maxlength="20"
                class="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
              />
            </div>
            <app-color-picker
              [value]="effectiveBgColor()"
              label="BG"
              (valueChange)="onBgColorChange($event)"
            />
            <app-color-picker
              [value]="effectiveAccentColor()"
              label="Accent"
              (valueChange)="onAccentColorChange($event)"
            />
            @if (hasKeyOverride()) {
              <button
                (click)="resetKeyStyle()"
                class="mb-0.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Reset
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class KeyConfigComponent {
  readonly deckState = inject(DeckStateService);
  private readonly profileState = inject(ProfileStateService);

  /** Emitted when the user wants to enter a folder for editing */
  readonly folderEntered = output<number>();

  private titleDebounce: ReturnType<typeof setTimeout> | null = null;

  selectedIndex(): number {
    return this.deckState.selectedElement()?.index ?? 0;
  }

  readonly isInsideFolder = computed(() => this.profileState.activeFolder() !== null);

  readonly currentAction = computed(() => {
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.action;
  });

  readonly hasAction = computed(() => {
    const a = this.currentAction();
    return !!a && a.type !== 'none';
  });

  readonly hasAutoIcon = computed(() => {
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.autoIcon === true;
  });

  readonly hasKeyOverride = computed(() => {
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.iconStyle !== undefined;
  });

  readonly keyTitle = computed(() => {
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.title ?? '';
  });

  readonly effectiveBgColor = computed(() => {
    const profile = this.profileState.activeProfile();
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.iconStyle?.bgColor
      ?? profile?.iconStyle?.bgColor
      ?? '#1a1625';
  });

  readonly effectiveAccentColor = computed(() => {
    const profile = this.profileState.activeProfile();
    const displayKeys = this.profileState.displayKeys();
    const idx = this.selectedIndex();
    return displayKeys[idx]?.iconStyle?.accentColor
      ?? profile?.iconStyle?.accentColor
      ?? '#a78bfa';
  });

  onActionChanged(action: ActionConfig): void {
    const idx = this.selectedIndex();

    // When setting a folder action, ensure the folder config exists
    if (action.type === 'folder') {
      this.profileState.setKeyAsFolder(idx, action.label || 'Folder');
    } else {
      this.profileState.setKeyAction(idx, action);
    }

    const displayKeys = this.profileState.displayKeys();
    const keyConfig = displayKeys[idx];
    if (action.type !== 'none' && (!keyConfig?.image || keyConfig?.autoIcon)) {
      if (action.type === 'open_url' && action.url) {
        this.deckState.fetchAndSetFavicon(idx, action.url, action);
      } else {
        this.deckState.generateAndSetKeyIcon(idx, action);
      }
    }

    if (action.type === 'none' && keyConfig?.autoIcon) {
      this.deckState.clearKeyImage(idx);
    }
  }

  onTitleChange(title: string): void {
    const idx = this.selectedIndex();
    this.profileState.setKeyTitle(idx, title || undefined);

    // Debounce icon regeneration
    if (this.titleDebounce) clearTimeout(this.titleDebounce);
    this.titleDebounce = setTimeout(() => {
      this.regenerateIcon();
    }, 500);
  }

  onBgColorChange(color: string): void {
    const idx = this.selectedIndex();
    const style: IconStyle = {
      bgColor: color,
      accentColor: this.effectiveAccentColor(),
    };
    this.profileState.setKeyIconStyle(idx, style);
    this.regenerateIcon();
  }

  onAccentColorChange(color: string): void {
    const idx = this.selectedIndex();
    const style: IconStyle = {
      bgColor: this.effectiveBgColor(),
      accentColor: color,
    };
    this.profileState.setKeyIconStyle(idx, style);
    this.regenerateIcon();
  }

  resetKeyStyle(): void {
    const idx = this.selectedIndex();
    this.profileState.setKeyIconStyle(idx, undefined);
    this.regenerateIcon();
  }

  private regenerateIcon(): void {
    const idx = this.selectedIndex();
    const action = this.currentAction();
    if (action && action.type !== 'none') {
      this.deckState.generateAndSetKeyIcon(idx, action);
    }
  }

  async uploadImage(): Promise<void> {
    const sel = this.deckState.selectedElement();
    if (sel?.type === 'key') {
      await this.deckState.browseAndSetKeyImage(sel.index);
    }
  }

  async clearImage(): Promise<void> {
    const sel = this.deckState.selectedElement();
    if (sel?.type === 'key') {
      await this.deckState.clearKeyImage(sel.index);
    }
  }

  /** Enter a folder to edit its contents */
  enterFolder(): void {
    const idx = this.selectedIndex();
    // Ensure this key has a folder config
    this.profileState.setKeyAsFolder(idx, 'Folder');
    this.folderEntered.emit(idx);
  }

  /** Clear both the action and image from this key */
  async clearKey(): Promise<void> {
    const idx = this.selectedIndex();
    this.profileState.setKeyAction(idx, { type: 'none' });
    this.profileState.setKeyTitle(idx, undefined);
    this.profileState.setKeyIconStyle(idx, undefined);
    await this.deckState.clearKeyImage(idx);
  }
}
