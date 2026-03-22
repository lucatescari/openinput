import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { DRAG_DATA_TYPE } from '../../plugins/plugin.types';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-encoder-knob',
  standalone: true,
  imports: [NgClass],
  template: `
    <button
      class="flex flex-col items-center gap-1.5"
      (click)="clicked.emit()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <!-- Knob visual -->
      <div
        class="relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-150"
        [ngClass]="{
          'border-primary-500 ring-2 ring-primary-500/30': selected(),
          'border-primary-400': rotation(),
          'border-primary-300 border-dashed bg-primary-50 dark:border-primary-600 dark:bg-primary-900/20': dragOver(),
          'border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600': !selected() && !rotation() && !dragOver()
        }"
      >
        <!-- Inner circle -->
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800"
          [ngClass]="{
            'bg-primary-50 dark:bg-primary-900/30': selected() || rotation()
          }"
        >
          @if (dragOver()) {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          } @else if (rotation() === 'ccw') {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-500 -rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clip-rule="evenodd" />
            </svg>
          } @else if (rotation() === 'cw') {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary-500 rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" />
            </svg>
          } @else {
            <span class="text-xs font-medium text-gray-400 dark:text-gray-500">
              E{{ index() + 1 }}
            </span>
          }
        </div>

        <!-- Tick mark -->
        <div class="absolute top-0.5 left-1/2 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-gray-400 dark:bg-gray-500"></div>

        <!-- Action indicator -->
        @if (hasAction() && !dragOver()) {
          <div class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary-500"></div>
        }
      </div>

      <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500">
        Encoder {{ index() + 1 }}
      </span>
    </button>
  `,
})
export class EncoderKnobComponent {
  readonly index = input.required<number>();
  readonly selected = input(false);
  readonly hasAction = input(false);
  readonly rotation = input<'cw' | 'ccw' | null>(null);
  readonly clicked = output<void>();
  readonly actionDropped = output<ActionConfig>();

  readonly dragOver = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      event.dataTransfer?.types.includes(DRAG_DATA_TYPE) ||
      event.dataTransfer?.types.includes('text/plain')
    ) {
      event.dataTransfer.dropEffect = 'copy';
      this.dragOver.set(true);
    }
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const actionData =
      event.dataTransfer?.getData(DRAG_DATA_TYPE) ||
      event.dataTransfer?.getData('text/plain');
    if (actionData) {
      try {
        const parsed = JSON.parse(actionData);
        if (parsed && typeof parsed.type === 'string') {
          this.actionDropped.emit(parsed as ActionConfig);
        }
      } catch { /* invalid JSON */ }
    }
  }
}
