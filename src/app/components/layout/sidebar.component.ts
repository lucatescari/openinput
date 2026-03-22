import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DeviceStateService } from '../../services/state/device-state.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside
      class="flex h-full w-56 flex-col border-r border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      <!-- Drag region for macOS traffic lights -->
      <div class="h-10 shrink-0" style="-webkit-app-region: drag"></div>
      <!-- App title below traffic lights -->
      <div class="px-5 pb-3" style="-webkit-app-region: drag">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          OpenInput
        </h1>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 px-3 py-2">
        <a
          routerLink="/deck"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          [class]="isActive('/deck') ? 'bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
          Deck
        </a>

        <a
          routerLink="/profiles"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          [class]="isActive('/profiles') ? 'bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
            <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
            <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
          </svg>
          Profiles
        </a>

        <a
          routerLink="/store"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          [class]="isActive('/store') ? 'bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
            <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
            <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
          </svg>
          Store
        </a>

        <a
          routerLink="/settings"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          [class]="isActive('/settings') ? 'bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-800'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </a>
      </nav>

      <!-- Connection status at bottom -->
      <div class="border-t border-gray-200 px-4 py-3 dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <div
            class="h-2.5 w-2.5 rounded-full"
            [class]="deviceState.isConnected() ? 'bg-green-500 animate-pulse-glow' : 'bg-gray-500'"
          ></div>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            @if (deviceState.isConnected()) {
              {{ deviceState.activeDevice()?.name ?? 'Connected' }}
            } @else {
              No device
            }
          </span>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly deviceState = inject(DeviceStateService);
  private readonly router = inject(Router);

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }
}
