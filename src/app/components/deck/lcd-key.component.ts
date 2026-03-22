import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { DRAG_DATA_TYPE } from '../../plugins/plugin.types';
import type { ActionConfig } from '../../../../shared/types/action.types';

@Component({
  selector: 'app-lcd-key',
  standalone: true,
  imports: [NgClass],
  styles: `
    .key-content {
      transition: opacity 150ms ease-in-out;
    }
    .key-content--hidden {
      opacity: 0;
    }
  `,
  template: `
    <!-- Reserved key (e.g. back button in folder) -->
    @if (reserved()) {
      <div
        class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800/60"
        [title]="reservedLabel()"
      >
        <div class="key-content flex flex-col items-center gap-1" [class.key-content--hidden]="transitioning()">
          <svg class="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
          <span class="text-[9px] font-medium text-gray-400 dark:text-gray-500">Back</span>
        </div>
        <!-- Lock badge -->
        <div class="absolute top-1 right-1">
          <svg class="h-3 w-3 text-gray-300 dark:text-neutral-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C9.24 2 7 4.24 7 7v3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V7c0-2.76-2.24-5-5-5zm-3 5c0-1.65 1.35-3 3-3s3 1.35 3 3v3H9V7z"/>
          </svg>
        </div>
      </div>
    } @else {
      <button
        class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 transition-all duration-150"
        [ngClass]="{
          'border-primary-500 ring-2 ring-primary-500/30': selected(),
          'border-primary-400 scale-95': pressed(),
          'border-primary-300 border-dashed bg-primary-50 dark:border-primary-600 dark:bg-primary-900/20': dragOver(),
          'border-gray-300 dark:border-neutral-700 hover:border-gray-400 dark:hover:border-neutral-600': !selected() && !pressed() && !dragOver()
        }"
        (click)="clicked.emit()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
      >
        <div class="key-content h-full w-full" [class.key-content--hidden]="transitioning()">
          @if (dragOver()) {
            <div class="flex h-full w-full items-center justify-center bg-primary-50 dark:bg-primary-900/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          } @else if (image()) {
            <img
              [src]="'data:image/jpeg;base64,' + image()"
              class="h-full w-full object-cover"
              alt="Key {{ index() + 1 }}"
            />
          } @else {
            <div
              class="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-neutral-800"
            >
              <span class="text-xs font-medium text-gray-400 dark:text-gray-500">
                {{ index() + 1 }}
              </span>
            </div>
          }
        </div>

        <!-- Press overlay -->
        @if (pressed()) {
          <div class="absolute inset-0 rounded-xl bg-primary-500/20"></div>
        }

        <!-- Action indicator dot -->
        @if (hasAction() && !pressed() && !dragOver()) {
          <div class="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary-500"></div>
        }
      </button>
    }
  `,
})
export class LcdKeyComponent {
  readonly index = input.required<number>();
  readonly image = input<string | null>(null);
  readonly selected = input(false);
  readonly pressed = input(false);
  readonly hasAction = input(false);
  /** When true, key is non-interactive and shows a reserved indicator (e.g. back button in folder) */
  readonly reserved = input(false);
  readonly reservedLabel = input('Reserved');
  /** When true, key content fades out; when false, fades back in */
  readonly transitioning = input(false);
  readonly clicked = output<void>();
  readonly imageDropped = output<string>();
  readonly actionDropped = output<ActionConfig>();

  readonly dragOver = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer) return;

    // Accept action drops from palette or image file drops
    // Also accept text/plain as Electron sandbox fallback for custom MIME types
    if (
      event.dataTransfer.types.includes(DRAG_DATA_TYPE) ||
      event.dataTransfer.types.includes('text/plain') ||
      event.dataTransfer.types.includes('Files')
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

    if (!event.dataTransfer) return;

    // Check for action drop from palette first
    // Try custom MIME type, fall back to text/plain (Electron sandbox workaround)
    const actionData =
      event.dataTransfer.getData(DRAG_DATA_TYPE) ||
      event.dataTransfer.getData('text/plain');
    if (actionData) {
      try {
        const parsed = JSON.parse(actionData);
        // Validate it looks like an action (has a type field) before emitting
        if (parsed && typeof parsed.type === 'string') {
          this.actionDropped.emit(parsed as ActionConfig);
          return;
        }
      } catch {
        // Not valid JSON — fall through to file drop
      }
    }

    // Fall back to image file drop
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (base64) {
          this.imageDropped.emit(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  }
}
