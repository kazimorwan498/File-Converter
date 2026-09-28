/**
 * Core Application Controller
 * Handles application lifecycle, theme system, dropzone event wiring, and empty queue state.
 */
import { StateManager } from './state-manager.js';

export class App {
  constructor() {
    this.stateManager = new StateManager();

    // DOM references
    this.themeToggleBtn = null;
    this.themeLabel = null;
    this.dropZone = null;
    this.fileInput = null;
    this.browseBtn = null;
    this.queueEmptyState = null;
    this.fileQueueList = null;
    this.queueCountBadge = null;
    this.a11yAnnouncer = null;

    // Drag counter for nested drag events
    this.dragCounter = 0;
  }

  /**
   * Initialize Application Foundation
   */
  init() {
    this.cacheDOMElements();
    this.initThemeSystem();
    this.bindDropZoneEvents();
    this.bindQueueEvents();
    console.info('Offline File Converter — Phase 1 Application Foundation ready.');
  }

  /**
   * Cache DOM elements
   */
  cacheDOMElements() {
    this.themeToggleBtn = document.getElementById('theme-toggle');
    this.themeLabel = document.getElementById('theme-label');
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.browseBtn = document.getElementById('browse-btn');
    this.queueEmptyState = document.getElementById('queue-empty-state');
    this.fileQueueList = document.getElementById('file-queue-list');
    this.queueCountBadge = document.getElementById('queue-count-badge');
    this.a11yAnnouncer = document.getElementById('a11y-announcer');
  }

  /**
   * Announce message to assistive technology
   * @param {string} message
   */
  announce(message) {
    if (this.a11yAnnouncer) {
      this.a11yAnnouncer.textContent = message;
    }
  }

  /* ==========================================================================
     Theme Management (Dark / Light / System)
     ========================================================================== */

  initThemeSystem() {
    const preference = this.stateManager.getThemePreference();
    this.applyTheme(preference);

    // React to OS changes when theme is set to 'system'
    this.stateManager.onSystemThemeChange((effectiveTheme) => {
      if (this.stateManager.getThemePreference() === 'system') {
        document.documentElement.setAttribute('data-theme', effectiveTheme);
        this.updateThemeButtonUI('system', effectiveTheme);
      }
    });

    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.cycleTheme());
    }
  }

  /**
   * Apply theme preference and update document attributes and button UI
   * @param {'dark' | 'light' | 'system'} preference
   */
  applyTheme(preference) {
    const effective = this.stateManager.resolveTheme(preference);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-setting', preference);
    this.stateManager.setThemePreference(preference);
    this.updateThemeButtonUI(preference, effective);
  }

  /**
   * Cycle theme in sequence: system -> dark -> light -> system
   */
  cycleTheme() {
    const current = this.stateManager.getThemePreference();
    const cycle = {
      system: 'dark',
      dark: 'light',
      light: 'system'
    };
    const nextTheme = cycle[current] || 'dark';
    this.applyTheme(nextTheme);

    const effective = this.stateManager.resolveTheme(nextTheme);
    const label = nextTheme === 'system' ? `System (${effective})` : nextTheme;
    this.announce(`Theme changed to ${label}`);
  }

  /**
   * Update theme toggle button UI labels and accessible descriptions
   * @param {'dark' | 'light' | 'system'} preference
   * @param {'dark' | 'light'} effective
   */
  updateThemeButtonUI(preference, effective) {
    if (this.themeLabel) {
      this.themeLabel.textContent = preference;
    }

    if (this.themeToggleBtn) {
      const modeDescription = preference === 'system' ? `System mode (${effective})` : `${preference} mode`;
      this.themeToggleBtn.setAttribute('aria-label', `Theme: ${modeDescription}. Click to switch theme`);
      this.themeToggleBtn.setAttribute('title', `Theme: ${modeDescription} (Click to switch)`);
    }
  }

  /* ==========================================================================
     Drop Zone & File Selection
     ========================================================================== */

  bindDropZoneEvents() {
    if (!this.dropZone || !this.fileInput) return;

    // Browse button triggers file input
    if (this.browseBtn) {
      this.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.fileInput.click();
      });
    }

    // Dropzone click triggers file input
    this.dropZone.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Keyboard accessibility for dropzone
    this.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        this.handleFilesSelected(files);
      }
    });

    // Prevent default window drag and drop navigation
    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    // Drop zone drag events
    this.dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter++;
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter--;
      if (this.dragCounter <= 0) {
        this.dragCounter = 0;
        this.dropZone.classList.remove('dragover');
      }
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragCounter = 0;
      this.dropZone.classList.remove('dragover');

      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        const files = Array.from(dt.files);
        this.handleFilesSelected(files);
      }
    });
  }

  /**
   * Stub file selection handler for Phase 1
   * Full validation and queue management will be wired in Phase 2
   * @param {File[]} files
   */
  handleFilesSelected(files) {
    const fileCount = files.length;
    const msg = `Selected ${fileCount} file${fileCount > 1 ? 's' : ''}. Queue management will be connected in Phase 2.`;
    console.info(msg, files.map(f => f.name));
    this.announce(msg);
  }

  /* ==========================================================================
     Queue Section & Actions
     ========================================================================== */

  bindQueueEvents() {
    // Phase 1: Ensure queue starts in clean empty state
    if (this.queueEmptyState) {
      this.queueEmptyState.classList.remove('hidden');
    }
    if (this.fileQueueList) {
      this.fileQueueList.classList.add('hidden');
    }
    if (this.queueCountBadge) {
      this.queueCountBadge.textContent = '0';
    }
  }
}
