import { Component, computed, inject, output } from '@angular/core';
import { DeckStateService } from '../../services/state/deck-state.service';
import { DeviceStateService } from '../../services/state/device-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { ToastStateService } from '../../services/state/toast-state.service';
import { LcdKeyComponent } from './lcd-key.component';
import { EncoderKnobComponent } from './encoder-knob.component';
import { TouchStripComponent } from './touch-strip.component';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-deck-view',
  standalone: true,
  imports: [LcdKeyComponent, EncoderKnobComponent, TouchStripComponent],
  template: `
    <div class="flex flex-col gap-5">
      <!-- LCD key grid: dynamic rows x cols -->
      @if (keyIndices().length > 0) {
        <div
          class="grid gap-2.5"
          [style.grid-template-columns]="'repeat(' + keyCols() + ', minmax(0, 1fr))'"
        >
          @for (i of keyIndices(); track i) {
            <app-lcd-key
              [index]="i"
              [image]="deckState.keyImages()[i] || null"
              [selected]="isKeySelected(i)"
              [pressed]="deckState.pressedKeys().has(i)"
              [hasAction]="hasKeyAction(i)"
              [reserved]="isKeyReserved(i)"
              [reservedLabel]="'Back button (auto)'"
              [transitioning]="deckState.keysTransitioning()"
              (clicked)="onKeyClick(i)"
              (imageDropped)="onKeyImageDrop(i, $event)"
              (actionDropped)="onKeyActionDrop(i, $event)"
            />
          }
        </div>
      }

      <!-- Encoders row -->
      @if (encoderIndices().length > 0) {
        <div class="flex justify-around px-4">
          @for (i of encoderIndices(); track i) {
            <app-encoder-knob
              [index]="i"
              [selected]="isEncoderSelected(i)"
              [hasAction]="hasEncoderAction(i)"
              [rotation]="deckState.activeEncoders()[i] ?? null"
              (clicked)="onEncoderClick(i)"
              (actionDropped)="onEncoderActionDrop(i, $event)"
            />
          }
        </div>
      }

      <!-- Touch strip -->
      @if (touchZoneIndices().length > 0) {
        <app-touch-strip
          [images]="deckState.touchImages()"
          [selectedZone]="selectedTouchZone()"
          [pressedZones]="deckState.pressedTouchZones()"
          [zones]="touchZoneIndices()"
          [aspectRatio]="touchAspectRatio()"
          (zoneClicked)="onTouchClick($event)"
          (actionDropped)="onTouchActionDrop($event)"
        />
      }
    </div>
  `,
})
export class DeckViewComponent {
  readonly deckState = inject(DeckStateService);
  private readonly deviceState = inject(DeviceStateService);
  private readonly profileState = inject(ProfileStateService);
  private readonly toast = inject(ToastStateService);

  readonly actionAssigned = output<{ type: 'key' | 'encoder' | 'touch'; index: number; action: ActionConfig }>();

  /** Dynamic layout-driven indices */
  readonly keyIndices = computed(() => {
    const layout = this.deviceState.layout();
    if (!layout?.keys) return [];
    return Array.from({ length: layout.keys.count }, (_, i) => i);
  });

  readonly keyCols = computed(() => {
    const layout = this.deviceState.layout();
    return layout?.keys?.cols ?? 5;
  });

  readonly encoderIndices = computed(() => {
    const layout = this.deviceState.layout();
    if (!layout?.encoders) return [];
    return Array.from({ length: layout.encoders.count }, (_, i) => i);
  });

  readonly touchZoneIndices = computed(() => {
    const layout = this.deviceState.layout();
    if (!layout?.touchZones) return [];
    return Array.from({ length: layout.touchZones.count }, (_, i) => i);
  });

  readonly touchAspectRatio = computed(() => {
    const layout = this.deviceState.layout();
    if (!layout?.touchZones) return '176/112';
    const spec = layout.touchZones.imageSpec;
    return `${spec.width}/${spec.height}`;
  });

  isKeySelected(index: number): boolean {
    const sel = this.deckState.selectedElement();
    return sel?.type === 'key' && sel.index === index;
  }

  isEncoderSelected(index: number): boolean {
    const sel = this.deckState.selectedElement();
    return sel?.type === 'encoder' && sel.index === index;
  }

  selectedTouchZone(): number | null {
    const sel = this.deckState.selectedElement();
    return sel?.type === 'touch' ? sel.index : null;
  }

  hasKeyAction(index: number): boolean {
    const displayKeys = this.profileState.displayKeys();
    const action = displayKeys[index]?.action;
    return !!action && action.type !== 'none';
  }

  /** Key 0 is reserved for the back button when inside a folder */
  isKeyReserved(index: number): boolean {
    return index === 0 && this.profileState.activeFolder() !== null;
  }

  hasEncoderAction(index: number): boolean {
    const profile = this.profileState.activeProfile();
    const enc = profile?.encoders[index];
    return !!(enc?.pressAction || enc?.rotateClockwise || enc?.rotateCounterClockwise);
  }

  onKeyClick(index: number): void {
    this.deckState.selectElement('key', index);
  }

  onEncoderClick(index: number): void {
    this.deckState.selectElement('encoder', index);
  }

  onTouchClick(index: number): void {
    this.deckState.selectElement('touch', index);
  }

  async onKeyImageDrop(keyIndex: number, base64: string): Promise<void> {
    try {
      await this.deckState.setKeyImage(keyIndex, base64);
      this.deckState.selectElement('key', keyIndex);
      this.toast.success(`Image set for key ${keyIndex + 1}`);
    } catch (err) {
      this.toast.error(`Failed to set image: ${(err as Error).message}`);
    }
  }

  onKeyActionDrop(keyIndex: number, action: ActionConfig): void {
    // Prevent folders inside folders
    if (action.type === 'folder' && this.profileState.activeFolder() !== null) {
      this.toast.error('Folders cannot be nested inside other folders');
      return;
    }

    this.deckState.forceSelectElement('key', keyIndex);
    if (action.type === 'folder') {
      this.profileState.setKeyAsFolder(keyIndex, action.label || 'Folder');
    } else {
      this.profileState.setKeyAction(keyIndex, action);
    }
    if (action.type !== 'none') {
      this.deckState.generateAndSetKeyIcon(keyIndex, action);
    }
    this.toast.success(`${action.label ?? action.type} assigned to key ${keyIndex + 1}`);
  }

  onEncoderActionDrop(encoderIndex: number, action: ActionConfig): void {
    this.deckState.forceSelectElement('encoder', encoderIndex);
    this.profileState.setEncoderAction(encoderIndex, 'pressAction', action);
    this.toast.success(`${action.label ?? action.type} assigned to encoder ${encoderIndex + 1} press`);
  }

  onTouchActionDrop(event: { zone: number; action: ActionConfig }): void {
    this.deckState.forceSelectElement('touch', event.zone);
    this.profileState.setTouchAction(event.zone, event.action);
    if (event.action.type !== 'none') {
      this.deckState.generateAndSetTouchIcon(event.zone, event.action);
    }
    this.toast.success(`${event.action.label ?? event.action.type} assigned to touch zone ${event.zone + 1}`);
  }
}
