import { Component, inject, signal, OnInit } from '@angular/core';
import type { ActionPlugin, ActionDefinition } from '../../plugins/plugin.types';
import { DRAG_DATA_TYPE } from '../../plugins/plugin.types';
import { BUILTIN_PLUGINS } from '../../plugins/builtin-plugins';
import { IpcService } from '../../services/data/ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';

@Component({
  selector: 'app-action-palette',
  standalone: true,
  template: `
    <div class="flex h-full flex-col">
      <!-- Header -->
      <div class="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-neutral-800">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Actions
        </h3>
        <p class="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
          Drag onto a key to assign
        </p>
      </div>

      <!-- Plugin sections -->
      <div class="flex-1 overflow-y-auto">
        @for (plugin of plugins(); track plugin.id) {
          <div class="border-b border-gray-100 dark:border-neutral-800/50">
            <!-- Section header -->
            <button
              (click)="toggle(plugin.id)"
              class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800/50"
            >
              <svg
                class="h-3 w-3 text-gray-400 transition-transform duration-200"
                [class.rotate-90]="isOpen(plugin.id)"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ plugin.name }}
              </span>
              <span class="ml-auto text-[10px] text-gray-300 dark:text-neutral-600">
                {{ plugin.actions.length }}
              </span>
            </button>

            <!-- Action cards grid -->
            @if (isOpen(plugin.id)) {
              <div class="grid grid-cols-2 gap-1.5 px-3 pb-3">
                @for (action of plugin.actions; track action.id) {
                  <div
                    draggable="true"
                    (dragstart)="onDragStart($event, action)"
                    (dragend)="onDragEnd()"
                    class="group flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-2.5 text-center transition-all duration-150 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-primary-600 dark:hover:bg-primary-900/20"
                    [title]="action.description"
                  >
                    <!-- Icon placeholder using simple shapes based on action icon name -->
                    <div class="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600 dark:bg-neutral-700 dark:text-gray-400 dark:group-hover:bg-primary-900/40 dark:group-hover:text-primary-400">
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        @switch (action.icon) {
                          @case ('keyboard') {
                            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"/>
                          }
                          @case ('toggle-left') {
                            <rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3"/>
                          }
                          @case ('type') {
                            <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
                          }
                          @case ('app-window') {
                            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/>
                          }
                          @case ('x-circle') {
                            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                          }
                          @case ('file-text') {
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                          }
                          @case ('globe') {
                            <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
                          }
                          @case ('play') {
                            <polygon points="6 3 20 12 6 21 6 3"/>
                          }
                          @case ('skip-forward') {
                            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
                          }
                          @case ('skip-back') {
                            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
                          }
                          @case ('volume-2') {
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                          }
                          @case ('volume-1') {
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                          }
                          @case ('volume-x') {
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>
                          }
                          @case ('sun') {
                            <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                          }
                          @case ('sun-dim') {
                            <circle cx="12" cy="12" r="4"/><path d="M12 4h.01"/><path d="M20 12h.01"/><path d="M12 20h.01"/><path d="M4 12h.01"/><path d="M17.66 6.34h.01"/><path d="M6.34 17.66h.01"/><path d="M17.66 17.66h.01"/><path d="M6.34 6.34h.01"/>
                          }
                          @case ('layers') {
                            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                          }
                          @case ('folder') {
                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                          }
                          @case ('chevron-right') {
                            <path d="m9 18 6-6-6-6"/>
                          }
                          @case ('chevron-left') {
                            <path d="m15 18-6-6 6-6"/>
                          }
                          @case ('hash') {
                            <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
                          }
                          @case ('arrow-right-left') {
                            <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
                          }
                          @case ('music') {
                            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                          }
                          @case ('settings') {
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
                          }
                          @case ('puzzle') {
                            <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877L2.97 12.14a2.41 2.41 0 0 1 0-3.408l1.61-1.61a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.708c.618 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
                          }
                          @default {
                            <circle cx="12" cy="12" r="10"/>
                          }
                        }
                      </svg>
                    </div>
                    <span class="text-[10px] font-medium leading-tight text-gray-600 dark:text-gray-400 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                      {{ action.name }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block h-full' },
})
export class ActionPaletteComponent implements OnInit {
  private readonly ipc = inject(IpcService);

  readonly plugins = signal<ActionPlugin[]>([...BUILTIN_PLUGINS]);
  private readonly openSections = signal<Set<string>>(
    new Set(BUILTIN_PLUGINS.map(p => p.id)),
  );

  async ngOnInit(): Promise<void> {
    if (!this.ipc.isElectron) return;
    try {
      const community = await this.ipc.invoke<CommunityActionInfo[]>(
        IPC_CHANNELS.STORE_GET_COMMUNITY_ACTIONS,
      );
      if (community && community.length > 0) {
        const communityPlugins: ActionPlugin[] = community.map((c) => ({
          id: `community:${c.pluginId}`,
          name: c.pluginName,
          icon: c.pluginIcon,
          description: `Community plugin: ${c.pluginName}`,
          actions: c.actions.map((a) => ({
            id: `${c.pluginId}:${a.id}`,
            name: a.name,
            icon: a.icon,
            description: a.description,
            defaultConfig: {
              type: 'plugin' as const,
              pluginId: c.pluginId,
              pluginActionId: a.id,
              label: a.name,
            },
          })),
        }));
        this.plugins.set([...BUILTIN_PLUGINS, ...communityPlugins]);
        this.openSections.update((s) => {
          const next = new Set(s);
          for (const p of communityPlugins) next.add(p.id);
          return next;
        });
      }
    } catch {
      // Community plugins not available — that's fine
    }
  }

  isOpen(pluginId: string): boolean {
    return this.openSections().has(pluginId);
  }

  toggle(pluginId: string): void {
    this.openSections.update(set => {
      const next = new Set(set);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }

  onDragStart(event: DragEvent, action: ActionDefinition): void {
    if (!event.dataTransfer) return;
    const payload = JSON.stringify(action.defaultConfig);
    event.dataTransfer.setData(DRAG_DATA_TYPE, payload);
    // Fallback: Electron sandbox may strip custom MIME types
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.effectAllowed = 'copy';
  }

  onDragEnd(): void {
    // Could add visual feedback cleanup here
  }
}

/** Shape of community action info returned from main process. */
interface CommunityActionInfo {
  pluginId: string;
  pluginName: string;
  pluginIcon: string;
  actions: {
    id: string;
    name: string;
    icon: string;
    description: string;
  }[];
}
