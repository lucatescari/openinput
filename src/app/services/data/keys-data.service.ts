import { inject, Injectable } from '@angular/core';
import { IpcService } from './ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import type { ActionConfig } from '../../../../shared/types/action.types';
import type { IconStyle } from '../../../../shared/types/profile.types';

@Injectable({ providedIn: 'root' })
export class KeysDataService {
  private readonly ipc = inject(IpcService);

  /** Send an image to a key. Returns processed base64 JPEG. */
  async setKeyImage(keyIndex: number, imageBase64: string): Promise<string> {
    return this.ipc.invoke<string>(
      IPC_CHANNELS.KEYS_SET_IMAGE,
      keyIndex,
      imageBase64,
    );
  }

  /** Clear a key image (send black). */
  async clearKeyImage(keyIndex: number): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.KEYS_CLEAR_IMAGE, keyIndex);
  }

  /** Send an image to a touch strip zone. Returns processed base64 JPEG. */
  async setTouchImage(zoneIndex: number, imageBase64: string): Promise<string> {
    return this.ipc.invoke<string>(
      IPC_CHANNELS.TOUCH_SET_IMAGE,
      zoneIndex,
      imageBase64,
    );
  }

  /** Open file dialog to browse for an image. */
  async browseImage(): Promise<{ base64: string; name: string } | null> {
    return this.ipc.invoke<{ base64: string; name: string } | null>(
      IPC_CHANNELS.IMAGE_BROWSE,
    );
  }

  /** Process a raw image into 112x112 JPEG. Returns base64. */
  async processImage(imageBase64: string): Promise<string> {
    return this.ipc.invoke<string>(IPC_CHANNELS.IMAGE_PROCESS, imageBase64);
  }

  /** Generate an action icon. Optionally pushes to device if keyIndex given. Returns preview base64. */
  async generateIcon(action: ActionConfig, keyIndex?: number, style?: IconStyle, title?: string): Promise<string> {
    return this.ipc.invoke<string>(
      IPC_CHANNELS.ICON_GENERATE,
      action,
      keyIndex,
      style,
      title,
    );
  }

  /** Clear a touch strip zone image (send black). */
  async clearTouchImage(zoneIndex: number): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.TOUCH_CLEAR_IMAGE, zoneIndex);
  }

  /** Generate a touch zone action icon. Optionally pushes to device if zoneIndex given. Returns preview base64. */
  async generateTouchIcon(action: ActionConfig, zoneIndex?: number, style?: IconStyle, title?: string): Promise<string> {
    return this.ipc.invoke<string>(
      IPC_CHANNELS.ICON_GENERATE_TOUCH,
      action,
      zoneIndex,
      style,
      title,
    );
  }

  /** Fetch a favicon for a URL. Returns base64 PNG or null. */
  async fetchFavicon(url: string): Promise<string | null> {
    return this.ipc.invoke<string | null>(IPC_CHANNELS.FAVICON_FETCH, url);
  }
}
