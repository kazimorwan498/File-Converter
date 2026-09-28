/**
 * Core Application Controller
 */
import { StateManager } from './state-manager.js';

export class App {
  constructor() {
    this.stateManager = new StateManager();
    this.themeToggleBtn = null;
  }

  init() {
    this.setupTheme();
    this.bindEvents();
    console.info('Offline File Converter initialized successfully.');
  }

  setupTheme() {
    const savedTheme = this.stateManager.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  bindEvents() {
    this.themeToggleBtn = document.getElementById('theme-toggle');
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    this.stateManager.setTheme(nextTheme);
  }
}
