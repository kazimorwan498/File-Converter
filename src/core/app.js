/**
 * Core Application Controller
 * Handles application lifecycle, theme system, dropzone event wiring,
 * multi-file ingestion, validation, duplicate notifications, and queue item management.
 */
import { StateManager } from './state-manager.js';
import { FileManager } from './file-manager.js';

export class App {
  constructor() {
    this.stateManager = new StateManager();
    this.fileManager = new FileManager();

    // DOM references
    this.themeToggleBtn = null;
    this.themeLabel = null;
    this.dropZone = null;
    this.fileInput = null;
    this.browseBtn = null;
    this.queueSection = null;
    this.queueEmptyState = null;
    this.fileQueueList = null;
    this.queueCountBadge = null;
    this.clearAllBtn = null;
    this.convertAllBtn = null;
    this.downloadAllBtn = null;
    this.notificationArea = null;
    this.a11yAnnouncer = null;

    // Drag counter for nested drag events
    this.dragCounter = 0;
  }

  /**
   * Initialize Application
   */
  init() {
    this.cacheDOMElements();
    this.initThemeSystem();
    this.bindDropZoneEvents();
    this.bindQueueEvents();
    console.info('Offline File Converter — Phase 2 File System & Queue ready.');
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
    this.queueSection = document.getElementById('queue-section');
    this.queueEmptyState = document.getElementById('queue-empty-state');
    this.fileQueueList = document.getElementById('file-queue-list');
    this.queueCountBadge = document.getElementById('queue-count-badge');
    this.clearAllBtn = document.getElementById('clear-all-btn');
    this.convertAllBtn = document.getElementById('convert-all-btn');
    this.downloadAllBtn = document.getElementById('download-all-btn');
    this.notificationArea = document.getElementById('notification-area');
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
     Drop Zone & Multi-File Selection
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

    // File input change event
    this.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        this.handleFilesSelected(files);
      }
      // Reset input value so identical filename re-additions can fire change
      this.fileInput.value = '';
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
   * Process multiple files selected via file input or drop zone
   * @param {File[]} files
   */
  handleFilesSelected(files) {
    const { added, rejected } = this.fileManager.addFiles(files);

    // Show warnings/errors for rejected files (duplicates, empty, unsupported)
    if (rejected.length > 0) {
      this.showRejectionsFeedback(rejected);
    } else {
      this.clearNotifications();
    }

    // Render added files
    if (added.length > 0) {
      for (const item of added) {
        const element = this.createQueueItemElement(item);
        this.fileQueueList.appendChild(element);
      }

      this.updateQueueView();
      const message = `Added ${added.length} file${added.length > 1 ? 's' : ''} to queue. Total: ${this.fileManager.count}.`;
      this.announce(message);
    }
  }

  /**
   * Display notification banner for rejected files
   * @param {{ file: File, reason: string }[]} rejected
   */
  showRejectionsFeedback(rejected) {
    if (!this.notificationArea) return;

    this.clearNotifications();

    const banner = document.createElement('div');
    banner.className = 'notification-banner warning';
    banner.setAttribute('role', 'alert');

    const reasons = rejected.map(r => r.reason).join(' | ');
    banner.innerHTML = `
      <span>${reasons}</span>
      <button type="button" class="notification-close" aria-label="Dismiss message">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    banner.querySelector('.notification-close').addEventListener('click', () => {
      banner.remove();
    });

    this.notificationArea.appendChild(banner);
    this.announce(`Notice: ${reasons}`);
  }

  /**
   * Clear notifications
   */
  clearNotifications() {
    if (this.notificationArea) {
      this.notificationArea.innerHTML = '';
    }
  }

  /* ==========================================================================
     Queue Item UI Rendering & Management
     ========================================================================== */

  /**
   * Generate category SVG icon
   * @param {'image' | 'document' | 'audio' | 'video' | 'generic'} category
   * @returns {string} SVG markup
   */
  getCategoryIconMarkup(category) {
    switch (category) {
      case 'image':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>`;
      case 'document':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" x2="8" y1="13" y2="13"/>
            <line x1="16" x2="8" y1="17" y2="17"/>
            <line x1="10" x2="8" y1="9" y2="9"/>
          </svg>`;
      case 'audio':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>`;
      case 'video':
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect width="14" height="14" x="1" y="5" rx="2" ry="2"/>
          </svg>`;
      default:
        return `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>`;
    }
  }

  /**
   * Create DOM element for a queue item card
   * @param {Object} item
   * @returns {HTMLLIElement}
   */
  createQueueItemElement(item) {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.id = `queue-item-${item.id}`;
    li.setAttribute('data-id', item.id);

    // Build format options
    const optionsHtml = item.availableOutputs.map(out => {
      const selected = out === item.outputFormat ? 'selected' : '';
      return `<option value="${out}" ${selected}>${out.toUpperCase()}</option>`;
    }).join('');

    li.innerHTML = `
      <div class="item-category-icon category-${item.category}" aria-hidden="true">
        ${this.getCategoryIconMarkup(item.category)}
      </div>

      <div class="item-info">
        <div class="item-filename" title="${item.filename}">
          ${item.filename}
        </div>
        <div class="item-meta">
          <span class="item-size">${item.formattedSize}</span>
          <span class="item-format-tag" title="MIME: ${item.mimeType}">${item.extension.toUpperCase()}</span>
        </div>
      </div>

      <div class="item-converter-control">
        <span class="target-arrow" aria-hidden="true">&rarr;</span>
        <label class="sr-only" for="format-select-${item.id}">Target format for ${item.filename}</label>
        <select id="format-select-${item.id}" class="format-select" aria-label="Convert ${item.filename} to">
          ${optionsHtml}
        </select>
      </div>

      <div class="item-status">
        <span id="status-${item.id}" class="status-badge status-${item.status}">${item.status}</span>
      </div>

      <button type="button" class="btn-remove-item" aria-label="Remove ${item.filename} from queue" title="Remove file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Bind format selection change
    const select = li.querySelector('.format-select');
    if (select) {
      select.addEventListener('change', (e) => {
        this.fileManager.setOutputFormat(item.id, e.target.value);
        this.announce(`Target format for ${item.filename} set to ${e.target.value.toUpperCase()}`);
      });
    }

    // Bind remove button
    const removeBtn = li.querySelector('.btn-remove-item');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.removeQueueItem(item.id, item.filename);
      });
    }

    return li;
  }

  /**
   * Remove an item from the queue and DOM
   * @param {string} id
   * @param {string} filename
   */
  removeQueueItem(id, filename) {
    this.fileManager.removeFile(id);
    const element = document.getElementById(`queue-item-${id}`);
    if (element) {
      element.remove();
    }

    this.updateQueueView();
    this.announce(`Removed ${filename} from queue.`);
  }

  /**
   * Update queue header counters, empty state visibility, and action button states
   */
  updateQueueView() {
    const count = this.fileManager.count;

    if (this.queueCountBadge) {
      this.queueCountBadge.textContent = count.toString();
      this.queueCountBadge.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'} in queue`);
    }

    if (count === 0) {
      if (this.queueEmptyState) this.queueEmptyState.classList.remove('hidden');
      if (this.fileQueueList) this.fileQueueList.classList.add('hidden');
      if (this.clearAllBtn) {
        this.clearAllBtn.disabled = true;
        this.clearAllBtn.setAttribute('aria-disabled', 'true');
      }
    } else {
      if (this.queueEmptyState) this.queueEmptyState.classList.add('hidden');
      if (this.fileQueueList) this.fileQueueList.classList.remove('hidden');
      if (this.clearAllBtn) {
        this.clearAllBtn.disabled = false;
        this.clearAllBtn.removeAttribute('aria-disabled');
      }
    }
  }

  /* ==========================================================================
     Queue Action Handlers
     ========================================================================== */

  bindQueueEvents() {
    this.updateQueueView();

    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => {
        this.clearAllQueue();
      });
    }
  }

  /**
   * Clear all items from queue
   */
  clearAllQueue() {
    const count = this.fileManager.clearQueue();
    if (this.fileQueueList) {
      this.fileQueueList.innerHTML = '';
    }
    this.clearNotifications();
    this.updateQueueView();
    this.announce(`Cleared all ${count} files from queue.`);
  }
}
