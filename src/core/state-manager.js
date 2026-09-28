/**
 * State Manager
 * Handles UI preference persistence (Light / Dark / System themes) via localStorage.
 * User files are strictly kept in ephemeral memory and never stored in localStorage.
 */
export class StateManager {
  constructor() {
    this.THEME_KEY = 'offline_converter_theme_preference';
    this.VALID_THEMES = ['dark', 'light', 'system'];
    this.systemMediaMatcher = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  }

  /**
   * Get the saved theme preference ('dark' | 'light' | 'system')
   * Defaults to 'system'
   * @returns {'dark' | 'light' | 'system'}
   */
  getThemePreference() {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved && this.VALID_THEMES.includes(saved)) {
        return saved;
      }
    } catch {
      // In private browsing or restricted environments, fallback safely
    }
    return 'system';
  }

  /**
   * Save theme preference ('dark' | 'light' | 'system')
   * @param {'dark' | 'light' | 'system'} theme
   */
  setThemePreference(theme) {
    if (!this.VALID_THEMES.includes(theme)) return;
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch {
      // Ignore localStorage write errors
    }
  }

  /**
   * Resolve an effective theme ('dark' | 'light') from a given preference
   * @param {'dark' | 'light' | 'system'} [preference]
   * @returns {'dark' | 'light'}
   */
  resolveTheme(preference = this.getThemePreference()) {
    if (preference === 'light') return 'light';
    if (preference === 'dark') return 'dark';

    // System mode resolution
    if (this.systemMediaMatcher && this.systemMediaMatcher.matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Listen for operating system theme changes
   * @param {function} callback
   * @returns {function} unsubscribe function
   */
  onSystemThemeChange(callback) {
    if (!this.systemMediaMatcher) return () => {};

    const listener = (event) => {
      if (this.getThemePreference() === 'system') {
        const effectiveTheme = event.matches ? 'dark' : 'light';
        callback(effectiveTheme);
      }
    };

    if (this.systemMediaMatcher.addEventListener) {
      this.systemMediaMatcher.addEventListener('change', listener);
      return () => this.systemMediaMatcher.removeEventListener('change', listener);
    } else if (this.systemMediaMatcher.addListener) {
      this.systemMediaMatcher.addListener(listener);
      return () => this.systemMediaMatcher.removeListener(listener);
    }

    return () => {};
  }
}
