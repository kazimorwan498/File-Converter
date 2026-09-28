/**
 * Core Application Controller
 * Handles application lifecycle, theme system, dropzone event wiring,
 * multi-file ingestion, sequential queue conversion, progress, cancellation, retry,
 * individual/batch downloads, and resource cleanup.
 */
import { StateManager } from './state-manager.js';
import { FileManager } from './file-manager.js';
import { ConverterManager } from './converter-manager.js';
import { DownloadManager } from './download-manager.js';
import { ImageConverter } from '../converters/image/image-converter.js';
import { DocumentConverter, DOCUMENT_CONVERSION_LIMITATIONS } from '../converters/pdf/document-converter.js';
import { AudioConverter } from '../converters/audio/audio-converter.js';
import { VideoConverter } from '../converters/video/video-converter.js';
import { generateOutputFilename } from '../utils/formatters.js';

export class App {
  constructor() {
    this.stateManager = new StateManager();
    this.fileManager = new FileManager();
    this.converterManager = new ConverterManager();
    this.downloadManager = new DownloadManager();

    // Register native ImageConverter
    this.imageConverter = new ImageConverter();
    this.converterManager.registerConverter(this.imageConverter);

    // Register native DocumentConverter
    this.documentConverter = new DocumentConverter();
    this.converterManager.registerConverter(this.documentConverter);

    // Register local WASM AudioConverter
    this.audioConverter = new AudioConverter();
    this.converterManager.registerConverter(this.audioConverter);

    // Register local WASM VideoConverter
    this.videoConverter = new VideoConverter();
    this.converterManager.registerConverter(this.videoConverter);

    // Track active object URLs for previews to prevent memory leaks
    this.previewUrls = new Map();

    // Batch queue state
    this.isBatchProcessing = false;
    this.isBatchCancelled = false;

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
    console.info('Offline File Converter — Phase 5 Conversion Queue ready.');
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

  applyTheme(preference) {
    const effective = this.stateManager.resolveTheme(preference);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-setting', preference);
    this.stateManager.setThemePreference(preference);
    this.updateThemeButtonUI(preference, effective);
  }

  cycleTheme() {
    const current = this.stateManager.getThemePreference();
    const cycle = { system: 'dark', dark: 'light', light: 'system' };
    const nextTheme = cycle[current] || 'dark';
    this.applyTheme(nextTheme);

    const effective = this.stateManager.resolveTheme(nextTheme);
    const label = nextTheme === 'system' ? `System (${effective})` : nextTheme;
    this.announce(`Theme changed to ${label}`);
  }

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

    if (this.browseBtn) {
      this.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.fileInput.click();
      });
    }

    this.dropZone.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    this.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        this.handleFilesSelected(files);
      }
      this.fileInput.value = '';
    });

    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

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

  handleFilesSelected(files) {
    const { added, rejected } = this.fileManager.addFiles(files);

    if (rejected.length > 0) {
      this.showRejectionsFeedback(rejected);
    } else {
      this.clearNotifications();
    }

    if (added.length > 0) {
      for (const item of added) {
        const element = this.createQueueItemElement(item);
        this.fileQueueList.appendChild(element);
        if (item.category === 'image') {
          this.loadDimensions(item);
        }
      }

      this.updateQueueView();
      const message = `Added ${added.length} file${added.length > 1 ? 's' : ''} to queue. Total: ${this.fileManager.count}.`;
      this.announce(message);
    }
  }

  async loadDimensions(item) {
    try {
      const { width, height } = await this.imageConverter.getImageDimensions(item.file);
      item.width = width;
      item.height = height;

      const dimEl = document.getElementById(`dimensions-${item.id}`);
      if (dimEl) {
        dimEl.textContent = `${width} × ${height}`;
        dimEl.classList.remove('hidden');
      }
    } catch {
      // Ignore
    }
  }

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

  clearNotifications() {
    if (this.notificationArea) {
      this.notificationArea.innerHTML = '';
    }
  }

  /* ==========================================================================
     Queue Item UI Rendering & Management
     ========================================================================== */

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
   * Resolve limitation details for any format pair across registered converters
   * @param {string} inExt
   * @param {string} outExt
   * @returns {{ isSupported: boolean, reason?: string }}
   */
  getLimitation(inExt, outExt) {
    if (this.documentConverter && (this.documentConverter.canConvert(inExt) || this.documentConverter.inputFormats.includes(inExt))) {
      return this.documentConverter.getConversionLimitation(inExt, outExt);
    }
    if (this.audioConverter && (this.audioConverter.canConvert(inExt) || this.audioConverter.inputFormats.includes(inExt))) {
      return this.audioConverter.getConversionLimitation(inExt, outExt);
    }
    if (this.videoConverter && (this.videoConverter.canConvert(inExt) || this.videoConverter.inputFormats.includes(inExt))) {
      return this.videoConverter.getConversionLimitation(inExt, outExt);
    }
    return {
      isSupported: false,
      reason: `Direct offline conversion from .${(inExt || '').toUpperCase()} to .${(outExt || '').toUpperCase()} is not supported.`
    };
  }

  createQueueItemElement(item) {
    const li = document.createElement('li');
    li.className = 'queue-item';
    li.id = `queue-item-${item.id}`;
    li.setAttribute('data-id', item.id);

    item.quality = 0.92;

    let previewMarkup = '';
    if (item.category === 'image') {
      try {
        const previewUrl = URL.createObjectURL(item.file);
        this.previewUrls.set(item.id, previewUrl);
        previewMarkup = `<img src="${previewUrl}" class="item-thumbnail" alt="${item.filename} thumbnail" />`;
      } catch {
        previewMarkup = this.getCategoryIconMarkup(item.category);
      }
    } else {
      previewMarkup = this.getCategoryIconMarkup(item.category);
    }

    const isSupported = this.converterManager.canConvert(item.extension, item.outputFormat);
    const limitation = !isSupported ? this.getLimitation(item.extension, item.outputFormat) : null;

    const optionsHtml = item.availableOutputs.map(out => {
      const selected = out === item.outputFormat ? 'selected' : '';
      const canDo = this.converterManager.canConvert(item.extension, out);
      const label = canDo ? out.toUpperCase() : `${out.toUpperCase()} (Unsupported)`;
      return `<option value="${out}" ${selected}>${label}</option>`;
    }).join('');

    const isLossyImage = ['jpg', 'jpeg', 'webp'].includes(item.outputFormat);
    const initialStatus = !isSupported ? 'unsupported' : item.status;
    item.status = initialStatus;

    li.innerHTML = `
      <div class="queue-item-main">
        <div class="item-preview-wrapper category-${item.category}">
          ${previewMarkup}
        </div>

        <div class="item-info">
          <div class="item-filename" title="${item.filename}">
            ${item.filename}
          </div>
          <div class="item-meta">
            <span class="item-size">${item.formattedSize}</span>
            <span id="dimensions-${item.id}" class="item-dimensions hidden"></span>
            <span class="item-format-tag" title="MIME: ${item.mimeType}">${item.extension.toUpperCase()}</span>
          </div>
        </div>

        <div class="item-controls">
          <div class="item-converter-control">
            <span class="target-arrow" aria-hidden="true">&rarr;</span>
            <label class="sr-only" for="format-select-${item.id}">Target format for ${item.filename}</label>
            <select id="format-select-${item.id}" class="format-select" aria-label="Convert ${item.filename} to">
              ${optionsHtml}
            </select>
          </div>

          <div id="quality-ctrl-${item.id}" class="quality-control ${isLossyImage ? '' : 'hidden'}">
            <label for="quality-range-${item.id}">Quality:</label>
            <input type="range" id="quality-range-${item.id}" class="quality-slider" min="10" max="100" value="92" step="1" />
            <span id="quality-val-${item.id}" class="quality-value">92%</span>
          </div>
        </div>

        <div class="item-status">
          <span id="status-${item.id}" class="status-badge status-${initialStatus}">
            ${initialStatus}
          </span>
        </div>

        <div class="item-actions">
          <button type="button" id="btn-convert-${item.id}" class="btn-convert-item" aria-label="Convert ${item.filename}" ${!isSupported ? 'disabled title="Conversion unsupported offline"' : ''}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Convert
          </button>
          <button type="button" id="btn-cancel-${item.id}" class="btn-cancel-item hidden" aria-label="Cancel conversion of ${item.filename}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            </svg>
            Cancel
          </button>
          <button type="button" id="btn-retry-${item.id}" class="btn-retry-item hidden" aria-label="Retry conversion of ${item.filename}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Retry
          </button>
          <button type="button" id="btn-download-${item.id}" class="btn-download-item hidden" aria-label="Download ${item.filename}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            Download
          </button>
          <button type="button" class="btn-remove-item" aria-label="Remove ${item.filename} from queue" title="Remove file">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div id="limitation-box-${item.id}" class="item-limitation-box ${isSupported ? 'hidden' : ''}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>
          <strong class="limitation-title">Offline Limitation:</strong>
          <span id="limitation-text-${item.id}">${limitation?.reason || 'This conversion is unsupported offline.'}</span>
        </span>
      </div>

      <div class="item-progress-container" aria-hidden="true">
        <div id="progress-${item.id}" class="item-progress-fill"></div>
      </div>
    `;

    const select = li.querySelector('.format-select');
    const qualityCtrl = li.querySelector(`#quality-ctrl-${item.id}`);
    if (select) {
      select.addEventListener('change', (e) => {
        const nextFormat = e.target.value.toLowerCase();
        this.fileManager.setOutputFormat(item.id, nextFormat);

        const canDo = this.converterManager.canConvert(item.extension, nextFormat);
        const limBox = li.querySelector(`#limitation-box-${item.id}`);
        const limText = li.querySelector(`#limitation-text-${item.id}`);
        const cBtn = li.querySelector(`#btn-convert-${item.id}`);
        const sBadge = li.querySelector(`#status-${item.id}`);

        if (canDo) {
          limBox?.classList.add('hidden');
          if (cBtn) {
            cBtn.disabled = false;
            cBtn.title = `Convert ${item.filename}`;
          }
          if (sBadge && (item.status === 'unsupported' || item.status === 'queued')) {
            item.status = 'queued';
            sBadge.className = 'status-badge status-queued';
            sBadge.textContent = 'Queued';
          }
        } else {
          const lim = this.getLimitation(item.extension, nextFormat);
          if (limText) limText.textContent = lim.reason || 'This conversion is unsupported offline.';
          limBox?.classList.remove('hidden');
          if (cBtn) {
            cBtn.disabled = true;
            cBtn.title = 'Conversion unsupported offline';
          }
          if (sBadge && item.status !== 'completed') {
            item.status = 'unsupported';
            sBadge.className = 'status-badge status-unsupported';
            sBadge.textContent = 'Unsupported';
          }
        }

        if (['jpg', 'jpeg', 'webp'].includes(nextFormat)) {
          qualityCtrl?.classList.remove('hidden');
        } else {
          qualityCtrl?.classList.add('hidden');
        }

        this.updateQueueView();
        this.announce(`Target format for ${item.filename} set to ${nextFormat.toUpperCase()}`);
      });
    }

    const qualityRange = li.querySelector(`#quality-range-${item.id}`);
    const qualityVal = li.querySelector(`#quality-val-${item.id}`);
    if (qualityRange && qualityVal) {
      qualityRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        item.quality = val / 100;
        qualityVal.textContent = `${val}%`;
      });
    }

    // Convert button
    const convertBtn = li.querySelector(`#btn-convert-${item.id}`);
    if (convertBtn) {
      convertBtn.addEventListener('click', () => {
        this.convertSingleItem(item);
      });
    }

    // Cancel button
    const cancelBtn = li.querySelector(`#btn-cancel-${item.id}`);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.converterManager.cancelItem(item.id);
      });
    }

    // Retry button
    const retryBtn = li.querySelector(`#btn-retry-${item.id}`);
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.convertSingleItem(item);
      });
    }

    // Download button
    const downloadBtn = li.querySelector(`#btn-download-${item.id}`);
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (item.outputBlob) {
          const downloadName = item.outputFilename || generateOutputFilename(item.filename, item.outputFormat);
          this.downloadManager.downloadBlob(item.outputBlob, downloadName);
        }
      });
    }

    // Remove button
    const removeBtn = li.querySelector('.btn-remove-item');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.removeQueueItem(item.id, item.filename);
      });
    }

    return li;
  }

  /**
   * Convert a single queue item with status and button synchronization
   * @param {Object} item
   */
  async convertSingleItem(item) {
    const statusBadge = document.getElementById(`status-${item.id}`);
    const progressFill = document.getElementById(`progress-${item.id}`);
    const convertBtn = document.getElementById(`btn-convert-${item.id}`);
    const cancelBtn = document.getElementById(`btn-cancel-${item.id}`);
    const retryBtn = document.getElementById(`btn-retry-${item.id}`);
    const downloadBtn = document.getElementById(`btn-download-${item.id}`);

    // Check for unsupported offline conversion
    if (!this.converterManager.canConvert(item.extension, item.outputFormat)) {
      const lim = this.getLimitation(item.extension, item.outputFormat);
      const err = new ConversionError(
        lim.reason || `Conversion from ${item.extension.toUpperCase()} to ${item.outputFormat.toUpperCase()} is unsupported offline.`,
        'UNSUPPORTED_FORMAT'
      );
      if (statusBadge) {
        statusBadge.className = 'status-badge status-unsupported';
        statusBadge.textContent = 'Unsupported';
      }
      convertBtn?.classList.remove('hidden');
      if (convertBtn) convertBtn.disabled = true;
      cancelBtn?.classList.add('hidden');
      this.announce(`Unsupported: ${err.message}`);
      this.updateQueueView();
      throw err;
    }

    // Update UI to converting state
    convertBtn?.classList.add('hidden');
    retryBtn?.classList.add('hidden');
    downloadBtn?.classList.add('hidden');
    cancelBtn?.classList.remove('hidden');

    if (statusBadge) {
      statusBadge.className = 'status-badge status-preparing';
      statusBadge.textContent = 'Preparing';
    }
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    try {
      await this.converterManager.convertItem(item, {
        quality: item.quality !== undefined ? item.quality : 0.92,
        onProgress: (pct, stage) => {
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (statusBadge) {
            statusBadge.className = 'status-badge status-converting';
            statusBadge.textContent = `${pct}%`;
          }
        }
      });

      // Output filename generation
      item.outputFilename = generateOutputFilename(item.filename, item.outputFormat);

      // Transition to completed
      if (statusBadge) {
        statusBadge.className = 'status-badge status-completed';
        statusBadge.textContent = 'Completed';
      }
      if (progressFill) {
        progressFill.style.width = '100%';
      }
      cancelBtn?.classList.add('hidden');
      downloadBtn?.classList.remove('hidden');

      this.updateQueueView();
      this.announce(`Successfully converted ${item.filename} to ${item.outputFormat.toUpperCase()}`);
      return item;
    } catch (err) {
      cancelBtn?.classList.add('hidden');
      retryBtn?.classList.remove('hidden');

      if (err.code === 'CANCELLED') {
        if (statusBadge) {
          statusBadge.className = 'status-badge status-cancelled';
          statusBadge.textContent = 'Cancelled';
        }
        this.announce(`Conversion of ${item.filename} was cancelled.`);
      } else {
        if (statusBadge) {
          statusBadge.className = 'status-badge status-failed';
          statusBadge.textContent = 'Failed';
        }
        this.announce(`Error converting ${item.filename}: ${err.message}`);
      }

      this.updateQueueView();
      throw err;
    }
  }

  /**
   * Remove an item from the queue, revoke object URLs, and cleanup DOM
   * @param {string} id
   * @param {string} filename
   */
  removeQueueItem(id, filename) {
    if (this.converterManager.isConverting(id)) {
      this.converterManager.cancelItem(id);
    }

    if (this.previewUrls.has(id)) {
      try {
        URL.revokeObjectURL(this.previewUrls.get(id));
      } catch {
        // Ignore
      }
      this.previewUrls.delete(id);
    }

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
    const queue = this.fileManager.getQueue();
    const count = queue.length;

    if (this.queueCountBadge) {
      this.queueCountBadge.textContent = count.toString();
      this.queueCountBadge.setAttribute('aria-label', `${count} item${count === 1 ? '' : 's'} in queue`);
    }

    const hasConvertible = queue.some(
      i => (i.status === 'queued' || i.status === 'failed' || i.status === 'cancelled') &&
           this.converterManager.canConvert(i.extension, i.outputFormat)
    );
    const hasCompleted = queue.some(i => i.status === 'completed' && i.outputBlob);

    if (this.convertAllBtn && !this.isBatchProcessing) {
      this.convertAllBtn.disabled = !hasConvertible;
      if (hasConvertible) this.convertAllBtn.removeAttribute('aria-disabled');
      else this.convertAllBtn.setAttribute('aria-disabled', 'true');
    }

    if (this.downloadAllBtn) {
      this.downloadAllBtn.disabled = !hasCompleted;
      if (hasCompleted) this.downloadAllBtn.removeAttribute('aria-disabled');
      else this.downloadAllBtn.setAttribute('aria-disabled', 'true');
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
        this.clearAllBtn.disabled = this.isBatchProcessing;
        if (this.isBatchProcessing) this.clearAllBtn.setAttribute('aria-disabled', 'true');
        else this.clearAllBtn.removeAttribute('aria-disabled');
      }
    }
  }

  /* ==========================================================================
     Queue Action Handlers (Convert All, Download All, Clear)
     ========================================================================== */

  bindQueueEvents() {
    this.updateQueueView();

    if (this.convertAllBtn) {
      this.convertAllBtn.addEventListener('click', () => {
        if (this.isBatchProcessing) {
          this.cancelBatchQueue();
        } else {
          this.convertAllQueue();
        }
      });
    }

    if (this.downloadAllBtn) {
      this.downloadAllBtn.addEventListener('click', () => {
        this.downloadAllCompleted();
      });
    }

    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => {
        this.clearAllQueue();
      });
    }
  }

  /**
   * Cancel ongoing batch queue conversion
   */
  cancelBatchQueue() {
    this.isBatchCancelled = true;
    this.converterManager.cancelAll();
    this.imageConverter.terminateWorker();
    this.announce('Cancelled batch conversion.');
  }

  /**
   * Convert all queued/failed/cancelled items sequentially
   */
  async convertAllQueue() {
    const queue = this.fileManager.getQueue().filter(
      i => (i.status === 'queued' || i.status === 'failed' || i.status === 'cancelled') &&
           this.converterManager.canConvert(i.extension, i.outputFormat)
    );
    if (queue.length === 0) return;

    this.isBatchProcessing = true;
    this.isBatchCancelled = false;

    // Transform button to Cancel Batch
    if (this.convertAllBtn) {
      this.convertAllBtn.className = 'btn btn-danger';
      this.convertAllBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        </svg>
        Cancel All
      `;
      this.convertAllBtn.disabled = false;
      this.convertAllBtn.removeAttribute('aria-disabled');
    }

    this.updateQueueView();

    let convertedCount = 0;
    for (const item of queue) {
      if (this.isBatchCancelled) {
        break;
      }
      try {
        await this.convertSingleItem(item);
        convertedCount++;
      } catch {
        // Continue sequential processing to next item unless user explicitly cancelled batch
        if (this.isBatchCancelled) break;
      }
    }

    this.isBatchProcessing = false;
    this.imageConverter.cleanupWorker();

    // Restore Convert All button
    if (this.convertAllBtn) {
      this.convertAllBtn.className = 'btn btn-primary';
      this.convertAllBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Convert All
      `;
    }

    this.updateQueueView();
    this.announce(`Finished batch processing. Converted ${convertedCount} file${convertedCount === 1 ? '' : 's'}.`);
  }

  /**
   * Download all completed items sequentially
   */
  async downloadAllCompleted() {
    const completed = this.fileManager.getQueue().filter(i => i.status === 'completed' && i.outputBlob);
    if (completed.length === 0) return;

    const count = await this.downloadManager.downloadAll(completed, 250);
    this.announce(`Triggered download for ${count} file${count > 1 ? 's' : ''}.`);
  }

  /**
   * Clear all items from queue and revoke all preview and output URLs
   */
  clearAllQueue() {
    if (this.isBatchProcessing) {
      this.cancelBatchQueue();
    }

    this.imageConverter.cleanupWorker();

    for (const url of this.previewUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    this.previewUrls.clear();

    this.downloadManager.revokeAll();

    const count = this.fileManager.clearQueue();
    if (this.fileQueueList) {
      this.fileQueueList.innerHTML = '';
    }
    this.clearNotifications();
    this.updateQueueView();
    this.announce(`Cleared all ${count} files from queue.`);
  }
}
