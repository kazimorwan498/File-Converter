/**
 * State Manager
 * Handles UI preference persistence (e.g. theme) via localStorage
 * User files are strictly kept in ephemeral memory and never stored in localStorage.
 */
export class StateManager {
  constructor() {
    this.THEME_KEY = 'offline_converter_theme';
  }

  getTheme() {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved) return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {
      // Fallback for restricted storage environments
    }
    return 'dark';
  }

  setTheme(theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch {
      // Ignore if localStorage unavailable
    }
  }
}
