import {
  Component,
  input,
  output,
  signal,
  computed,
  ElementRef,
  ViewChild,
  inject,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DOCUMENT } from '@angular/common';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div (keydown)="onKeydown($event)">
      <button
        #trigger
        type="button"
        (click)="toggle()"
        class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors
          border-gray-300 bg-white text-gray-700
          dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300
          hover:border-gray-400 dark:hover:border-neutral-600
          focus:outline-none focus:ring-2 focus:ring-primary-500/40"
      >
        <span [class]="selectedLabel() ? '' : 'text-gray-400 dark:text-gray-500'">
          {{ selectedLabel() || placeholder() }}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 text-gray-400 transition-transform"
          [class.rotate-180]="open()"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      @if (open()) {
        <div
          class="fixed z-50 overflow-hidden rounded-lg border shadow-lg
            border-gray-200 bg-white
            dark:border-neutral-700 dark:bg-neutral-800"
          [style.left.px]="dropLeft()"
          [style.top.px]="dropTop()"
          [style.width.px]="dropWidth()"
        >
          <!-- Search input -->
          @if (options().length > 5) {
            <div class="border-b border-gray-100 px-2 py-1.5 dark:border-neutral-700">
              <input
                #searchInput
                type="text"
                [ngModel]="filter()"
                (ngModelChange)="filter.set($event)"
                placeholder="Search..."
                class="w-full border-0 bg-transparent px-1 py-0.5 text-xs text-gray-700 placeholder-gray-400 outline-none ring-0 shadow-none dark:text-gray-300 dark:placeholder-gray-500 focus:ring-0 focus:shadow-none focus:border-0"
              />
            </div>
          }
          <div class="overflow-y-auto py-1" [style.max-height.px]="dropMaxH()">
            @for (opt of filteredOptions(); track opt.value) {
              <button
                type="button"
                (click)="select(opt.value)"
                class="flex w-full items-center px-3 py-2 text-left text-xs transition-colors"
                [class]="opt.value === value()
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-neutral-700'"
              >
                {{ opt.label }}
              </button>
            } @empty {
              <div class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                No matches
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  host: {
    class: 'block',
  },
})
export class CustomSelectComponent implements OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly elRef = inject(ElementRef);

  @ViewChild('trigger') triggerEl?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly options = input<SelectOption[]>([]);
  readonly value = input<string>('');
  readonly placeholder = input<string>('Select...');
  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly filter = signal('');

  // Fixed-position dropdown placement
  readonly dropLeft = signal(0);
  readonly dropTop = signal(0);
  readonly dropWidth = signal(200);
  readonly dropMaxH = signal(192);

  readonly filteredOptions = computed(() => {
    const q = this.filter().toLowerCase().trim();
    if (!q) return this.options();
    return this.options().filter(o => o.label.toLowerCase().includes(q));
  });

  private clickOutsideHandler = (e: Event) => {
    if (!this.elRef.nativeElement.contains(e.target)) {
      this.close();
    }
  };

  selectedLabel(): string {
    const v = this.value();
    return this.options().find((o) => o.value === v)?.label ?? '';
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.filter.set('');
      this.positionDropdown();
      this.open.set(true);
      this.doc.addEventListener('click', this.clickOutsideHandler, true);
      // Focus the search input after Angular renders it (preventScroll avoids page jump)
      setTimeout(() => this.searchInput?.nativeElement.focus({ preventScroll: true }));
    }
  }

  select(value: string): void {
    this.valueChange.emit(value);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  private positionDropdown(): void {
    const trigger = this.triggerEl?.nativeElement;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewH = window.innerHeight;
    const margin = 8; // viewport edge margin

    // Match trigger width
    this.dropWidth.set(rect.width);
    this.dropLeft.set(rect.left);

    // Calculate available space below and above
    const spaceBelow = viewH - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;

    // Allow for search bar height (~36px) + padding
    const searchBarH = this.options().length > 5 ? 36 : 0;
    const minUsable = 80; // minimum usable dropdown height

    if (spaceBelow >= minUsable) {
      // Open below
      this.dropTop.set(rect.bottom + gap);
      this.dropMaxH.set(Math.min(spaceBelow - searchBarH, 240));
    } else if (spaceAbove >= minUsable) {
      // Open above — estimate total dropdown height
      const itemCount = Math.min(this.options().length, 8);
      const contentH = Math.min(itemCount * 32 + searchBarH + 8, spaceAbove);
      this.dropTop.set(rect.top - gap - contentH);
      this.dropMaxH.set(Math.min(spaceAbove - searchBarH, 240));
    } else {
      // Not much room either way — use the bigger one
      if (spaceBelow >= spaceAbove) {
        this.dropTop.set(rect.bottom + gap);
        this.dropMaxH.set(Math.max(spaceBelow - searchBarH, minUsable));
      } else {
        const contentH = Math.min(spaceAbove, 240);
        this.dropTop.set(rect.top - gap - contentH);
        this.dropMaxH.set(Math.max(spaceAbove - searchBarH, minUsable));
      }
    }
  }

  private close(): void {
    this.open.set(false);
    this.filter.set('');
    this.doc.removeEventListener('click', this.clickOutsideHandler, true);
  }

  ngOnDestroy(): void {
    this.doc.removeEventListener('click', this.clickOutsideHandler, true);
  }
}
