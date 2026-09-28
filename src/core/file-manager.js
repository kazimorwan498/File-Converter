/**
 * File Manager
 * Handles file ingestion, multi-file selection, drag & drop, file validation,
 * metadata extraction, duplicate prevention, and queue state.
 */
import {
  formatBytes,
  getFileExtension,
  getFileCategory,
  isFormatSupported,
  getAvailableOutputs,
  getDefaultOutput,
  SUPPORTED_FORMATS
} from '../utils/formatters.js';

export class FileManager {
  constructor() {
    /** @type {Map<string, Object>} */
    this.queueMap = new Map();
  }

  /**
   * Get all items currently in the queue
   * @returns {Object[]}
   */
  getQueue() {
    return Array.from(this.queueMap.values());
  }

  /**
   * Get count of items in the queue
   * @returns {number}
   */
  get count() {
    return this.queueMap.size;
  }

  /**
   * Get a specific queue item by id
   * @param {string} id
   * @returns {Object | undefined}
   */
  getItem(id) {
    return this.queueMap.get(id);
  }

  /**
   * Check if a file is already present in the queue (duplicate check)
   * Matches by name, size, and last modified timestamp
   * @param {File} file
   * @returns {boolean}
   */
  isDuplicate(file) {
    for (const item of this.queueMap.values()) {
      if (
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate a single file against size, format, and duplicate criteria
   * @param {File} file
   * @returns {{ valid: boolean, reason?: string }}
   */
  validateFile(file) {
    if (!file || !(file instanceof File)) {
      return { valid: false, reason: 'Invalid file object' };
    }

    if (file.size === 0) {
      return { valid: false, reason: `File "${file.name}" is empty (0 bytes).` };
    }

    const ext = getFileExtension(file.name);
    if (!ext) {
      return { valid: false, reason: `File "${file.name}" has no valid extension.` };
    }

    if (!isFormatSupported(ext)) {
      return { valid: false, reason: `Format ".${ext}" is currently unsupported.` };
    }

    if (this.isDuplicate(file)) {
      return { valid: false, reason: `"${file.name}" is already in the queue.` };
    }

    return { valid: true };
  }

  /**
   * Create a standardized queue item model
   * @param {File} file
   * @returns {Object}
   */
  createQueueItem(file) {
    const ext = getFileExtension(file.name);
    const mime = file.type || (SUPPORTED_FORMATS[ext] ? SUPPORTED_FORMATS[ext].mime : 'application/octet-stream');
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const outputs = getAvailableOutputs(ext);
    const defaultOutput = getDefaultOutput(ext);

    return {
      id,
      file,
      name: file.name,
      filename: file.name,
      size: file.size,
      formattedSize: formatBytes(file.size),
      type: mime,
      mimeType: mime,
      extension: ext,
      inputFormat: ext,
      category: getFileCategory(ext),
      status: 'queued',
      progress: 0,
      outputFormat: defaultOutput,
      availableOutputs: outputs,
      outputBlob: null,
      error: null,
      lastModified: file.lastModified
    };
  }

  /**
   * Ingest multiple files into the queue with validation
   * @param {FileList | File[]} files
   * @returns {{ added: Object[], rejected: { file: File, reason: string }[] }}
   */
  addFiles(files) {
    const fileArray = Array.from(files || []);
    const added = [];
    const rejected = [];

    for (const file of fileArray) {
      const validation = this.validateFile(file);
      if (validation.valid) {
        const item = this.createQueueItem(file);
        this.queueMap.set(item.id, item);
        added.push(item);
      } else {
        rejected.push({ file, reason: validation.reason });
      }
    }

    return { added, rejected };
  }

  /**
   * Remove a single item from the queue by ID
   * @param {string} id
   * @returns {Object | null}
   */
  removeFile(id) {
    const item = this.queueMap.get(id);
    if (item) {
      if (item.outputBlob && item.outputUrl) {
        try {
          URL.revokeObjectURL(item.outputUrl);
        } catch {
          // Ignore revocation errors
        }
      }
      this.queueMap.delete(id);
      return item;
    }
    return null;
  }

  /**
   * Update the target output format for a queue item
   * @param {string} id
   * @param {string} format
   * @returns {boolean}
   */
  setOutputFormat(id, format) {
    const item = this.queueMap.get(id);
    if (!item) return false;

    const lowerFormat = (format || '').toLowerCase();
    if (item.availableOutputs.includes(lowerFormat)) {
      item.outputFormat = lowerFormat;
      return true;
    }
    return false;
  }

  /**
   * Clear all items from the queue
   * @returns {number} number of cleared items
   */
  clearQueue() {
    const count = this.queueMap.size;
    for (const item of this.queueMap.values()) {
      if (item.outputUrl) {
        try {
          URL.revokeObjectURL(item.outputUrl);
        } catch {
          // Ignore
        }
      }
    }
    this.queueMap.clear();
    return count;
  }
}
