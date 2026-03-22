import { Component, inject, computed } from '@angular/core';
import { DeckStateService } from '../../services/state/deck-state.service';
import { DeviceStateService } from '../../services/state/device-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { ActionPickerComponent } from './action-picker.component';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-touch-config',
  standalone: true,
  imports: [ActionPickerComponent],
  template: `
    <div class="space-y-4">
      <!-- Zone-specific config: image + tap action -->
      <div class="flex gap-5">
        <!-- Left: Image preview + upload -->
        <div class="flex shrink-0 flex-col items-center gap-2">
          <div
            class="flex w-28 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/50"
            [style.aspect-ratio]="touchAspectRatio()"
          >
            @if (touchImage()) {
              <img
                [src]="'data:image/jpeg;base64,' + touchImage()"
                class="h-full w-full object-cover"
                alt="Touch zone preview"
              />
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          </div>
          <div class="flex gap-1.5">
            <button
              (click)="uploadImage()"
              class="rounded-md bg-primary-600 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              [disabled]="deckState.loading()"
            >
              {{ deckState.loading() ? '...' : 'Upload' }}
            </button>
            @if (touchImage()) {
              <button
                (click)="clearImage()"
                class="rounded-md border border-gray-300 px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
                [disabled]="deckState.loading()"
              >
                Clear
              </button>
            }
          </div>
        </div>

        <!-- Right: Tap action -->
        <div class="min-w-0 flex-1 space-y-3">
          <!-- Header + clear button -->
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              Touch Zone {{ selectedIndex() + 1 }}
            </h3>
            @if (hasZoneAction()) {
              <button
                (click)="clearZone()"
                class="text-[10px] font-medium text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              >
                Clear Zone
              </button>
            }
          </div>

          <div class="space-y-1.5">
            <h4 class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tap Action
            </h4>
            <app-action-picker
              [action]="currentAction()"
              (actionChanged)="onActionChanged($event)"
            />
          </div>
        </div>
      </div>

      <!-- Global swipe actions (shared across all zones) -->
      <div class="border-t border-gray-200 pt-3 dark:border-neutral-700/50">
        <div class="flex items-center justify-between gap-3 mb-2">
          <h4 class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Touch Strip Swipe Actions
          </h4>
          @if (hasSwipeAction()) {
            <button
              (click)="clearSwipes()"
              class="text-[10px] font-medium text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
            >
              Clear Swipes
            </button>
          }
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5 overflow-hidden">
            <h4 class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
              Swipe Left
            </h4>
            <app-action-picker
              [action]="swipeLeftAction()"
              (actionChanged)="onSwipeLeftChanged($event)"
            />
          </div>

          <div class="space-y-1.5 overflow-hidden">
            <h4 class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
              Swipe Right
            </h4>
            <app-action-picker
              [action]="swipeRightAction()"
              (actionChanged)="onSwipeRightChanged($event)"
            />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class TouchConfigComponent {
  readonly deckState = inject(DeckStateService);
  private readonly deviceState = inject(DeviceStateService);
  private readonly profileState = inject(ProfileStateService);

  readonly touchAspectRatio = computed(() => {
    const layout = this.deviceState.layout();
    if (!layout?.touchZones) return '176/112';
    const spec = layout.touchZones.imageSpec;
    return `${spec.width}/${spec.height}`;
  });

  selectedIndex(): number {
    return this.deckState.selectedElement()?.index ?? 0;
  }

  touchImage(): string | null {
    const idx = this.selectedIndex();
    return this.deckState.touchImages()[idx] ?? null;
  }

  readonly currentAction = computed(() => {
    const profile = this.profileState.activeProfile();
    const idx = this.selectedIndex();
    return profile?.touchZones[idx]?.action;
  });

  readonly swipeLeftAction = computed(() => {
    return this.profileState.activeProfile()?.swipeLeft;
  });

  readonly swipeRightAction = computed(() => {
    return this.profileState.activeProfile()?.swipeRight;
  });

  /** Only checks the per-zone tap action + image */
  readonly hasZoneAction = computed(() => {
    const tap = this.currentAction();
    return (!!tap && tap.type !== 'none') || !!this.touchImage();
  });

  /** Checks global swipe actions */
  readonly hasSwipeAction = computed(() => {
    const swL = this.swipeLeftAction();
    const swR = this.swipeRightAction();
    return (!!swL && swL.type !== 'none') || (!!swR && swR.type !== 'none');
  });

  onActionChanged(action: ActionConfig): void {
    const idx = this.selectedIndex();
    this.profileState.setTouchAction(idx, action);

    // Auto-generate icon for the touch zone (same logic as key-config)
    const profile = this.profileState.activeProfile();
    const zoneConfig = profile?.touchZones[idx];
    if (action.type !== 'none' && (!zoneConfig?.image || zoneConfig?.autoIcon)) {
      if (action.type === 'open_url' && action.url) {
        this.deckState.fetchAndSetTouchFavicon(idx, action.url, action);
      } else {
        this.deckState.generateAndSetTouchIcon(idx, action);
      }
    }

    if (action.type === 'none' && zoneConfig?.autoIcon) {
      this.deckState.clearTouchImage(idx);
    }
  }

  onSwipeLeftChanged(action: ActionConfig): void {
    this.profileState.setSwipeAction('swipeLeft', action);
  }

  onSwipeRightChanged(action: ActionConfig): void {
    this.profileState.setSwipeAction('swipeRight', action);
  }

  /** Clear only the per-zone tap action and image */
  async clearZone(): Promise<void> {
    const idx = this.selectedIndex();
    this.profileState.setTouchAction(idx, { type: 'none' });
    await this.deckState.clearTouchImage(idx);
  }

  /** Clear the global swipe actions */
  clearSwipes(): void {
    this.profileState.setSwipeAction('swipeLeft', { type: 'none' });
    this.profileState.setSwipeAction('swipeRight', { type: 'none' });
  }

  async uploadImage(): Promise<void> {
    const sel = this.deckState.selectedElement();
    if (sel?.type === 'touch') {
      await this.deckState.browseAndSetTouchImage(sel.index);
    }
  }

  async clearImage(): Promise<void> {
    const sel = this.deckState.selectedElement();
    if (sel?.type === 'touch') {
      await this.deckState.clearTouchImage(sel.index);
    }
  }
}
