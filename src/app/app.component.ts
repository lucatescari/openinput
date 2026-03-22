import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/layout/sidebar.component';
import { TopBarComponent } from './components/layout/top-bar.component';
import { ToastContainerComponent } from './components/ui/toast.component';
import { ThemeStateService } from './services/state/theme-state.service';
import { ProfileStateService } from './services/state/profile-state.service';
import { IpcService } from './services/data/ipc.service';
import { ToastStateService } from './services/state/toast-state.service';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopBarComponent, ToastContainerComponent],
  template: `
    <div class="flex h-screen bg-gray-50 dark:bg-neutral-950">
      <!-- Sidebar -->
      <app-sidebar />

      <!-- Main area -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Top bar -->
        <app-top-bar />

        <!-- Content -->
        <main class="flex-1 overflow-hidden">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>

    <!-- Toast notifications -->
    <app-toast-container />
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly themeState = inject(ThemeStateService);
  private readonly profileState = inject(ProfileStateService);
  private readonly ipc = inject(IpcService);
  private readonly toastState = inject(ToastStateService);

  /**
   * Electron intercepts drag-over/drop at the webContents level and navigates
   * to the dropped content. These document-level handlers prevent that default
   * behaviour so HTML5 drag-and-drop works inside the Angular app.
   */
  private preventDragDefault = (e: Event): void => e.preventDefault();

  /** Unsubscribe function for the NOTIFY_TOAST IPC listener. */
  private unsubToast: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    document.addEventListener('dragover', this.preventDragDefault, false);
    document.addEventListener('drop', this.preventDragDefault, false);

    // Listen for toast notifications from the main process
    this.unsubToast = this.ipc.on(
      IPC_CHANNELS.NOTIFY_TOAST,
      (...args: unknown[]) => {
        const payload = args[0] as { message: string; type?: 'success' | 'error' | 'info' };
        if (payload?.message) {
          this.toastState.show(payload.message, payload.type ?? 'info');
        }
      },
    );

    await this.profileState.init();
  }

  ngOnDestroy(): void {
    document.removeEventListener('dragover', this.preventDragDefault, false);
    document.removeEventListener('drop', this.preventDragDefault, false);
    this.unsubToast?.();
  }
}
