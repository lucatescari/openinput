import { Component, inject } from '@angular/core';
import { DeviceStateService } from '../../services/state/device-state.service';
import { ProfileStateService } from '../../services/state/profile-state.service';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  template: `
    <header
      class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-neutral-800 dark:bg-neutral-900"
      style="-webkit-app-region: drag"
    >
      <!-- Left: page context -->
      <div class="flex items-center gap-3" style="-webkit-app-region: no-drag">
        @if (deviceState.isConnected()) {
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ deviceState.activeDevice()?.name }}
          </span>
          <span class="text-gray-300 dark:text-neutral-600">|</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ profileState.activeProfileName() }}
          </span>
        } @else {
          <span class="text-sm text-gray-400">No device connected</span>
        }
      </div>

      <!-- Right: brightness control -->
      <div class="flex items-center gap-4" style="-webkit-app-region: no-drag">
        @if (deviceState.isConnected()) {
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              [value]="deviceState.brightness()"
              (input)="onBrightnessChange($event)"
              class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-500 dark:bg-neutral-700"
            />
            <span class="w-8 text-right text-xs text-gray-400">
              {{ deviceState.brightness() }}%
            </span>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopBarComponent {
  readonly deviceState = inject(DeviceStateService);
  readonly profileState = inject(ProfileStateService);

  onBrightnessChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.deviceState.setBrightness(value);
  }
}
