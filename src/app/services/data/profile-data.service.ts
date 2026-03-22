import { inject, Injectable } from '@angular/core';
import { IpcService } from './ipc.service';
import { IPC_CHANNELS } from '../../../../shared/types/ipc.types';
import type { Profile, ProfileSummary } from '../../../../shared/types/profile.types';

@Injectable({ providedIn: 'root' })
export class ProfileDataService {
  private readonly ipc = inject(IpcService);

  async listProfiles(): Promise<ProfileSummary[]> {
    return (await this.ipc.invoke<ProfileSummary[]>(IPC_CHANNELS.PROFILE_LIST)) ?? [];
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.ipc.invoke<Profile | null>(IPC_CHANNELS.PROFILE_GET, id);
  }

  async saveProfile(profile: Profile): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.PROFILE_SAVE, profile);
  }

  async deleteProfile(id: string): Promise<void> {
    return this.ipc.invoke<void>(IPC_CHANNELS.PROFILE_DELETE, id);
  }

  async activateProfile(id: string): Promise<Profile> {
    return this.ipc.invoke<Profile>(IPC_CHANNELS.PROFILE_ACTIVATE, id);
  }

  async exportProfile(id: string): Promise<string | null> {
    return this.ipc.invoke<string | null>(IPC_CHANNELS.PROFILE_EXPORT, id);
  }

  async importProfile(): Promise<Profile | null> {
    return this.ipc.invoke<Profile | null>(IPC_CHANNELS.PROFILE_IMPORT);
  }
}
