import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileStateService } from '../../services/state/profile-state.service';
import { DeckStateService } from '../../services/state/deck-state.service';

@Component({
  selector: 'app-profiles-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex h-full flex-col overflow-auto p-6 animate-fade-in" style="scrollbar-gutter: stable">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Profiles
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create and manage device profiles.
          </p>
        </div>
        <button
          (click)="showCreateDialog()"
          class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          New Profile
        </button>
      </div>

      <!-- Create dialog -->
      @if (creating()) {
        <div class="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <h3 class="mb-3 text-sm font-medium text-gray-900 dark:text-white">
            Create New Profile
          </h3>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="newProfileName"
              placeholder="Profile name"
              (keydown.enter)="createProfile()"
              class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400"
              autofocus
            />
            <button
              (click)="createProfile()"
              [disabled]="!newProfileName.trim() || profileState.loading()"
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Create
            </button>
            <button
              (click)="creating.set(false)"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Rename dialog -->
      @if (renamingId()) {
        <div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h3 class="mb-3 text-sm font-medium text-gray-900 dark:text-white">
            Rename Profile
          </h3>
          <div class="flex gap-3">
            <input
              type="text"
              [(ngModel)]="renameValue"
              placeholder="New name"
              (keydown.enter)="confirmRename()"
              class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400"
              autofocus
            />
            <button
              (click)="confirmRename()"
              [disabled]="!renameValue.trim()"
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Rename
            </button>
            <button
              (click)="renamingId.set(null)"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Profile list -->
      @if (profileState.profiles().length === 0 && !profileState.loading()) {
        <div
          class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-neutral-700"
        >
          <div class="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p class="mt-3 text-sm text-gray-400 dark:text-gray-500">
              No profiles yet. Create one to get started.
            </p>
          </div>
        </div>
      } @else {
        <div class="space-y-3">
          @for (profile of profileState.profiles(); track profile.id) {
            <div
              class="group flex items-center gap-4 rounded-xl border p-4 transition-colors"
              [class]="profile.id === profileState.activeProfile()?.id
                ? 'border-gray-300 bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800/50'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700'"
            >
              <!-- Profile icon -->
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                [class]="profile.id === profileState.activeProfile()?.id
                  ? 'bg-gray-200 dark:bg-neutral-700'
                  : 'bg-gray-100 dark:bg-neutral-800'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"
                  [class]="profile.id === profileState.activeProfile()?.id
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500'"
                >
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
              </div>

              <!-- Profile info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ profile.name }}
                  </h3>
                  @if (profile.id === profileState.activeProfile()?.id) {
                    <span
                      class="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-neutral-700 dark:text-gray-300"
                    >
                      Active
                    </span>
                  }
                </div>
                <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  Updated {{ formatDate(profile.updatedAt) }}
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                @if (profile.id !== profileState.activeProfile()?.id) {
                  <button
                    (click)="activate(profile.id)"
                    class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                    title="Activate"
                  >
                    Activate
                  </button>
                }
                <button
                  (click)="startRename(profile.id, profile.name)"
                  class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-gray-300"
                  title="Rename"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  (click)="duplicate(profile.id)"
                  class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-gray-300"
                  title="Duplicate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                    <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                  </svg>
                </button>
                @if (profileState.profiles().length > 1) {
                  <button
                    (click)="confirmDelete(profile.id, profile.name)"
                    class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Delete confirmation -->
      @if (deletingId()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
              Delete Profile
            </h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{{ deletingName() }}"? This action cannot be undone.
            </p>
            <div class="mt-4 flex justify-end gap-3">
              <button
                (click)="deletingId.set(null)"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-400 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                (click)="deleteProfile()"
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfilesPage {
  readonly profileState = inject(ProfileStateService);
  private readonly deckState = inject(DeckStateService);

  readonly creating = signal(false);
  readonly renamingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deletingName = signal('');

  newProfileName = '';
  renameValue = '';

  showCreateDialog(): void {
    this.newProfileName = '';
    this.creating.set(true);
  }

  async createProfile(): Promise<void> {
    const name = this.newProfileName.trim();
    if (!name) return;

    await this.profileState.createProfile(name);
    this.creating.set(false);
    this.deckState.loadFromProfile();
  }

  async activate(id: string): Promise<void> {
    await this.profileState.activateProfile(id);
    this.deckState.loadFromProfile();
  }

  startRename(id: string, currentName: string): void {
    this.renamingId.set(id);
    this.renameValue = currentName;
  }

  async confirmRename(): Promise<void> {
    const id = this.renamingId();
    const name = this.renameValue.trim();
    if (!id || !name) return;

    await this.profileState.renameProfile(id, name);
    this.renamingId.set(null);
  }

  async duplicate(id: string): Promise<void> {
    await this.profileState.duplicateProfile(id);
  }

  confirmDelete(id: string, name: string): void {
    this.deletingId.set(id);
    this.deletingName.set(name);
  }

  async deleteProfile(): Promise<void> {
    const id = this.deletingId();
    if (!id) return;

    await this.profileState.deleteProfile(id);
    this.deletingId.set(null);
    this.deckState.loadFromProfile();
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

    return date.toLocaleDateString();
  }
}
