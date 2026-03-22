import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastStateService {
  private nextId = 0;
  private readonly _toasts = signal<Toast[]>([]);

  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info', duration = 3000): void {
    const id = this.nextId++;
    this._toasts.update((t) => [...t, { id, message, type }]);

    setTimeout(() => {
      this._toasts.update((t) => t.filter((toast) => toast.id !== id));
    }, duration);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 5000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
