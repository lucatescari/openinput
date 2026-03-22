import { Injectable } from '@angular/core';
import type { IpcResponse } from '../../../../shared/types/ipc.types';

/** True when running inside Electron (preload exposes window.openinput). */
const hasElectron = typeof window !== 'undefined' && !!window.openinput;

@Injectable({ providedIn: 'root' })
export class IpcService {
  /** Whether the Electron IPC bridge is available. */
  readonly isElectron = hasElectron;

  async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!hasElectron) {
      console.warn(`[IPC stub] invoke "${channel}" — not in Electron`);
      return undefined as T;
    }
    const response = await window.openinput.invoke<IpcResponse<T>>(
      channel,
      ...args,
    );
    if (!response.success) {
      throw new Error(response.error ?? 'Unknown IPC error');
    }
    return response.data as T;
  }

  on(channel: string, callback: (...args: unknown[]) => void): () => void {
    if (!hasElectron) {
      console.warn(`[IPC stub] on "${channel}" — not in Electron`);
      return () => {}; // no-op unsubscribe
    }
    return window.openinput.on(channel, callback);
  }
}
