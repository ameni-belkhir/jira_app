import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** État réactif du mode sombre (Signal Angular). */
  isDarkMode = signal<boolean>(false);

  private themeSubject = new BehaviorSubject<Theme>('light');
  theme$ = this.themeSubject.asObservable();

  constructor() {
    this.initTheme();
  }

  /**
   * Détecte le thème au démarrage :
   * 1. choix explicitement sauvegardé dans localStorage ('theme'),
   * 2. sinon préférence système (prefers-color-scheme: dark),
   * 3. sinon mode clair par défaut.
   */
  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    this.setDarkMode(isDark);
  }

  toggleTheme(): void {
    this.setDarkMode(!this.isDarkMode());
  }

  setDarkMode(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    const theme: Theme = isDark ? 'dark' : 'light';
    this.themeSubject.next(theme);
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark:bg-gray-900', isDark);
  }

  setTheme(theme: Theme): void {
    this.setDarkMode(theme === 'dark');
  }
}
