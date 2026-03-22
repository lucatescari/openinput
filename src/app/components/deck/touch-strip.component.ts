import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { DRAG_DATA_TYPE } from '../../plugins/plugin.types';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-touch-strip',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex gap-2">
      @for (i of zones(); track i) {
        <button
          class="flex flex-1 items-center justify-center overflow-hidden rounded-lg border-2 transition-all duration-150"
          [style.aspect-ratio]="aspectRatio()"
          [ngClass]="{
            'border-primary-500 ring-2 ring-primary-500/30': selectedZone() === i,
            'border-primary-400 scale-[0.97]': pressedZones().has(i),
            'border-primary-300 border-dashed bg-primary-50 dark:border-primary-600 dark:bg-primary-900/20': dragOverZone() === i,
            'border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600': selectedZone() !== i && !pressedZones().has(i) && dragOverZone() !== i
          }"
          (click)="zoneClicked.emit(i)"
          (dragover)="onDragOver($event, i)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event, i)"
        >
          @if (dragOverZone() === i) {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          } @else if (images()[i]) {
            <img
              [src]="'data:image/jpeg;base64,' + images()[i]"
              class="h-full w-full object-cover"
              alt="Touch {{ i + 1 }}"
            />
          } @else {
            <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500">
              Touch {{ i + 1 }}
            </span>
          }
        </button>
      }
    </div>
  `,
})
export class TouchStripComponent {
  readonly images = input<Record<number, string>>({});
  readonly selectedZone = input<number | null>(null);
  readonly pressedZones = input<Set<number>>(new Set());
  readonly zones = input<number[]>([0, 1, 2, 3]);
  readonly aspectRatio = input<string>('176/112');
  readonly zoneClicked = output<number>();
  readonly actionDropped = output<{ zone: number; action: ActionConfig }>();

  readonly dragOverZone = signal<number | null>(null);

  onDragOver(event: DragEvent, zone: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      event.dataTransfer?.types.includes(DRAG_DATA_TYPE) ||
      event.dataTransfer?.types.includes('text/plain') ||
      event.dataTransfer?.types.includes('Files')
    ) {
      event.dataTransfer.dropEffect = 'copy';
      this.dragOverZone.set(zone);
    }
  }

  onDragLeave(): void {
    this.dragOverZone.set(null);
  }

  onDrop(event: DragEvent, zone: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverZone.set(null);

    const actionData =
      event.dataTransfer?.getData(DRAG_DATA_TYPE) ||
      event.dataTransfer?.getData('text/plain');
    if (actionData) {
      try {
        const parsed = JSON.parse(actionData);
        if (parsed && typeof parsed.type === 'string') {
          this.actionDropped.emit({ zone, action: parsed as ActionConfig });
        }
      } catch { /* invalid JSON */ }
    }
  }
}
