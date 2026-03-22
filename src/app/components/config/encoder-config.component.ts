import { Component, inject, computed } from '@angular/core';
import { DeckStateService } from '../../services/state/deck-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { ActionPickerComponent } from './action-picker.component';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-encoder-config',
  standalone: true,
  imports: [ActionPickerComponent],
  template: `
    <div class="space-y-3">
      <!-- Header + clear button -->
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          Encoder {{ selectedIndex() + 1 }}
        </h3>
        @if (hasAnyAction()) {
          <button
            (click)="clearEncoder()"
            class="text-[10px] font-medium text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
          >
            Clear Encoder
          </button>
        }
      </div>

      <div class="grid grid-cols-3 gap-3">
        <!-- Rotate CW -->
        <div class="space-y-1.5 overflow-hidden">
          <h4 class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Rotate CW
          </h4>
          <app-action-picker
            [action]="cwAction()"
            (actionChanged)="onCwChanged($event)"
          />
        </div>

        <!-- Rotate CCW -->
        <div class="space-y-1.5 overflow-hidden">
          <h4 class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Rotate CCW
          </h4>
          <app-action-picker
            [action]="ccwAction()"
            (actionChanged)="onCcwChanged($event)"
          />
        </div>

        <!-- Press -->
        <div class="space-y-1.5 overflow-hidden">
          <h4 class="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Press
          </h4>
          <app-action-picker
            [action]="pressAction()"
            (actionChanged)="onPressChanged($event)"
          />
        </div>
      </div>
    </div>
  `,
})
export class EncoderConfigComponent {
  readonly deckState = inject(DeckStateService);
  private readonly profileState = inject(ProfileStateService);

  selectedIndex(): number {
    return this.deckState.selectedElement()?.index ?? 0;
  }

  readonly cwAction = computed(() => {
    const profile = this.profileState.activeProfile();
    const idx = this.selectedIndex();
    return profile?.encoders[idx]?.rotateClockwise;
  });

  readonly ccwAction = computed(() => {
    const profile = this.profileState.activeProfile();
    const idx = this.selectedIndex();
    return profile?.encoders[idx]?.rotateCounterClockwise;
  });

  readonly pressAction = computed(() => {
    const profile = this.profileState.activeProfile();
    const idx = this.selectedIndex();
    return profile?.encoders[idx]?.pressAction;
  });

  readonly hasAnyAction = computed(() => {
    const cw = this.cwAction();
    const ccw = this.ccwAction();
    const press = this.pressAction();
    return (!!cw && cw.type !== 'none') ||
      (!!ccw && ccw.type !== 'none') ||
      (!!press && press.type !== 'none');
  });

  onCwChanged(action: ActionConfig): void {
    this.profileState.setEncoderAction(this.selectedIndex(), 'rotateClockwise', action);
  }

  onCcwChanged(action: ActionConfig): void {
    this.profileState.setEncoderAction(this.selectedIndex(), 'rotateCounterClockwise', action);
  }

  onPressChanged(action: ActionConfig): void {
    this.profileState.setEncoderAction(this.selectedIndex(), 'pressAction', action);
  }

  /** Clear all three encoder action slots */
  clearEncoder(): void {
    const idx = this.selectedIndex();
    this.profileState.setEncoderAction(idx, 'rotateClockwise', { type: 'none' });
    this.profileState.setEncoderAction(idx, 'rotateCounterClockwise', { type: 'none' });
    this.profileState.setEncoderAction(idx, 'pressAction', { type: 'none' });
  }
}
