import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeStateService {
  private readonly STORAGE_KEY = 'openinput-theme';
  private readonly _theme = signal<Theme>(this.loadTheme());

  readonly theme = this._theme.asReadonly();

  constructor() {
    this.applyTheme(this._theme());
    this.watchSystemTheme();
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  private loadTheme(): Theme {
    const saved = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    return saved ?? 'dark';
  }

  private applyTheme(theme: Theme): void {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', isDark);
  }

  private watchSystemTheme(): void {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (this._theme() === 'system') {
          this.applyTheme('system');
        }
      });
  }
}
