import { Component, output, signal, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-hotkey-recorder',
  standalone: true,
  template: `
    @if (recording()) {
      <div
        class="flex items-center gap-2 rounded-lg border-2 border-primary-500 bg-primary-50 px-3 py-2 dark:border-primary-400 dark:bg-primary-900/20"
      >
        <div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
        <span class="flex-1 text-xs text-gray-600 dark:text-gray-300">
          @if (currentModifiers().length || currentKey()) {
            {{ formatHotkey(currentModifiers(), currentKey()) }}
          } @else {
            Press a key combination...
          }
        </span>
        <button
          (click)="cancel()"
          class="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Cancel
        </button>
      </div>
    } @else {
      <button
        (click)="startRecording()"
        class="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
        </svg>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          Record Hotkey
        </span>
      </button>
    }
  `,
})
export class HotkeyRecorderComponent implements OnDestroy {
  readonly hotkeyRecorded = output<{ modifiers: string[]; key: string }>();

  readonly recording = signal(false);
  readonly currentModifiers = signal<string[]>([]);
  readonly currentKey = signal('');

  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  startRecording(): void {
    this.recording.set(true);
    this.currentModifiers.set([]);
    this.currentKey.set('');

    this.keydownHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers: string[] = [];
      if (e.metaKey) modifiers.push('command');
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');

      // Check if it's a modifier-only press
      const isModifier = ['Meta', 'Control', 'Alt', 'Shift'].includes(e.key);

      this.currentModifiers.set(modifiers);

      if (!isModifier) {
        const key = this.normalizeKey(e);
        this.currentKey.set(key);

        // Recording complete
        this.hotkeyRecorded.emit({ modifiers, key });
        this.stopRecording();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', this.keydownHandler, true);
    document.addEventListener('keyup', this.keyupHandler, true);
  }

  cancel(): void {
    this.stopRecording();
  }

  private stopRecording(): void {
    this.recording.set(false);
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      document.removeEventListener('keyup', this.keyupHandler, true);
      this.keyupHandler = null;
    }
  }

  private normalizeKey(e: KeyboardEvent): string {
    // Map special keys to readable names
    const specialKeys: Record<string, string> = {
      ' ': 'space',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      Enter: 'return',
      Backspace: 'backspace',
      Delete: 'delete',
      Escape: 'escape',
      Tab: 'tab',
    };

    if (e.key in specialKeys) return specialKeys[e.key];
    if (e.key.startsWith('F') && e.key.length <= 3) return e.key.toLowerCase();

    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  formatHotkey(modifiers: string[], key: string): string {
    const parts = [...modifiers.map((m) => this.formatModifier(m))];
    if (key) parts.push(this.formatKey(key));
    return parts.join(' + ');
  }

  private formatModifier(mod: string): string {
    const map: Record<string, string> = {
      command: '\u2318',
      ctrl: '\u2303',
      alt: '\u2325',
      shift: '\u21E7',
    };
    return map[mod] ?? mod;
  }

  private formatKey(key: string): string {
    const map: Record<string, string> = {
      space: 'Space',
      return: 'Return',
      backspace: '\u232B',
      delete: '\u2326',
      escape: 'Esc',
      tab: 'Tab',
      up: '\u2191',
      down: '\u2193',
      left: '\u2190',
      right: '\u2192',
    };
    return map[key] ?? key.toUpperCase();
  }

  ngOnDestroy(): void {
    this.stopRecording();
  }
}
