import type { ActionConfig } from './action.types';

export interface IconStyle {
  bgColor: string;
  accentColor: string;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Pages of key configurations (each page has its own keys) */
  pages: PageConfig[];
  encoders: Record<number, EncoderConfig>;
  touchZones: Record<number, TouchZoneConfig>;
  swipeLeft?: ActionConfig;
  swipeRight?: ActionConfig;
  /** Default icon style for all keys in this profile */
  iconStyle?: IconStyle;
  /** Screensaver: base64 JPEG to show when device goes idle */
  screensaver?: string;
  /** Screensaver timeout in seconds (0 = disabled, default 300 = 5 min) */
  screensaverTimeout?: number;
}

export interface PageConfig {
  name: string;
  keys: Record<number, KeyConfig>;
}

export interface KeyConfig {
  /** base64-encoded JPEG image data */
  image?: string;
  imageLabel?: string;
  /** true if image was auto-generated from the action (not user-uploaded) */
  autoIcon?: boolean;
  action?: ActionConfig;
  /** Per-key icon style override (falls back to profile.iconStyle) */
  iconStyle?: IconStyle;
  /** Optional text overlay on the key icon */
  title?: string;
  /** Folder contents — only set when action.type === 'folder' */
  folder?: FolderConfig;
}

export interface FolderConfig {
  name: string;
  /** Keys inside the folder. Key 0 is auto-reserved for the back button. */
  keys: Record<number, KeyConfig>;
}

export interface EncoderConfig {
  pressAction?: ActionConfig;
  rotateClockwise?: ActionConfig;
  rotateCounterClockwise?: ActionConfig;
}

export interface TouchZoneConfig {
  image?: string;
  /** true if image was auto-generated from the action (not user-uploaded) */
  autoIcon?: boolean;
  action?: ActionConfig;
}

export interface ProfileSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
