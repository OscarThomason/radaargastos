import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'finanzas:theme';

  /** Señal reactiva que indica si el modo oscuro está activo */
  darkMode = signal<boolean>(false);

  constructor() {
    this.initTheme();

    // Sincronizar automáticamente clases del DOM cada vez que cambie darkMode
    effect(() => {
      const isDark = this.darkMode();
      this.applyThemeToDOM(isDark);
    });
  }

  private initTheme() {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem(this.THEME_KEY) as AppTheme | null;

    if (savedTheme === 'dark') {
      this.darkMode.set(true);
    } else if (savedTheme === 'light') {
      this.darkMode.set(false);
    } else {
      // Preferencia nativa del sistema operativo
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.darkMode.set(prefersDark);
    }
  }

  /** Alterna entre modo claro y oscuro */
  toggleTheme(): void {
    this.setTheme(this.darkMode() ? 'light' : 'dark');
  }

  /** Establece un tema específico y lo persiste en localStorage */
  setTheme(theme: AppTheme): void {
    const isDark = theme === 'dark';
    this.darkMode.set(isDark);
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (e) {
      console.warn('No se pudo guardar la preferencia de tema en localStorage', e);
    }
  }

  private applyThemeToDOM(isDark: boolean): void {
    if (typeof document === 'undefined') return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (isDark) {
      htmlEl.classList.add('dark');
      bodyEl.classList.add('dark');
      htmlEl.setAttribute('data-theme', 'dark');
    } else {
      htmlEl.classList.remove('dark');
      bodyEl.classList.remove('dark');
      htmlEl.setAttribute('data-theme', 'light');
    }

    // Actualizar meta theme-color para navegadores móviles
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0A0E17' : '#FFFFFF');
    }
  }
}
