import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'facturapro_theme';
  theme = signal<AppTheme>((localStorage.getItem(this.THEME_KEY) as AppTheme) || 'light');
  isDark = signal(false);

  constructor() {
    effect(() => {
      const t = this.theme();
      localStorage.setItem(this.THEME_KEY, t);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = t === 'dark' || (t === 'system' && prefersDark);
      this.isDark.set(dark);
      document.documentElement.classList.toggle('dark', dark);
    });
  }

  setTheme(t: AppTheme) { this.theme.set(t); }
  toggle() { this.theme.set(this.theme() === 'dark' ? 'light' : 'dark'); }
}
