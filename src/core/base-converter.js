/**
 * Base Converter Interface
 * Standard contract that every offline converter plugin must implement.
 */
import { getFileExtension } from '../utils/formatters.js';

export class BaseConverter {
  /**
   * @param {Object} config
   * @param {string} config.id - Unique converter identifier
   * @param {string} config.name - Human-readable converter name
   * @param {string} [config.description] - Converter description
   * @param {string[]} config.inputFormats - Array of supported lowercase input extensions (e.g. ['png', 'jpg'])
   * @param {string[]} config.outputFormats - Array of supported lowercase output extensions (e.g. ['webp', 'png'])
   * @param {string[]} [config.inputMimeTypes] - Array of supported input MIME types
   */
  constructor({ id, name, description = '', inputFormats = [], outputFormats = [], inputMimeTypes = [] }) {
    if (!id || !name) {
      throw new Error('Converter must be instantiated with a valid id and name');
    }
    this.id = id;
    this.name = name;
    this.description = description;
    this.inputFormats = inputFormats.map(f => f.toLowerCase());
    this.outputFormats = outputFormats.map(f => f.toLowerCase());
    this.inputMimeTypes = inputMimeTypes.map(m => m.toLowerCase());
  }

  /**
   * Extract lowercase format extension from File, filename, or format string
   * @param {File | string} fileOrType
   * @returns {string}
   */
  normalizeFormat(fileOrType) {
    if (!fileOrType) return '';
    if (typeof fileOrType === 'string') {
      if (fileOrType.includes('/') || fileOrType.includes('.')) {
        return getFileExtension(fileOrType) || fileOrType.toLowerCase();
      }
      return fileOrType.toLowerCase();
    }
    if (fileOrType instanceof File || (typeof fileOrType === 'object' && fileOrType.name)) {
      return getFileExtension(fileOrType.name);
    }
    return '';
  }

  /**
   * Determine if this converter can transform the given input to outputFormat
   * @param {File | string} fileOrType - Input file, filename, or format string
   * @param {string} [outputFormat] - Optional targeted output format
   * @returns {boolean}
   */
  canConvert(fileOrType, outputFormat) {
    const inputExt = this.normalizeFormat(fileOrType);
    const supportsInput = this.inputFormats.includes(inputExt);

    if (!supportsInput) {
      // Check MIME type if file object provided
      if (fileOrType && typeof fileOrType === 'object' && fileOrType.type) {
        if (!this.inputMimeTypes.includes(fileOrType.type.toLowerCase())) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (!outputFormat) {
      return true;
    }

    const outputExt = this.normalizeFormat(outputFormat);
    return this.outputFormats.includes(outputExt);
  }

  /**
   * Get list of viable output formats for the provided input
   * @param {File | string} fileOrType
   * @returns {string[]}
   */
  getAvailableOutputs(fileOrType) {
    if (this.canConvert(fileOrType)) {
      return [...this.outputFormats];
    }
    return [];
  }

  /**
   * Estimate resource requirements or duration (optional)
   * @param {File} file
   * @param {Object} [options]
   * @returns {{ estimatedDurationMs?: number, complexity?: 'low' | 'medium' | 'high' }}
   */
  estimate(file, options = {}) {
    return {
      estimatedDurationMs: 500,
      complexity: 'low'
    };
  }

  /**
   * Execute conversion (must be implemented by subclasses)
   * @param {File} file - Native File to convert
   * @param {Object} options - Conversion options
   * @param {string} options.outputFormat - Target format extension
   * @param {function(number, string=): void} [options.onProgress] - Progress callback (0-100)
   * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, durationMs?: number }>}
   */
  async convert(file, options = {}) {
    throw new Error(`convert() method not implemented on ${this.constructor.name}`);
  }

  /**
   * Cancel an ongoing conversion (optional hook for subagents/workers)
   * @param {string} [conversionId]
   */
  cancel(conversionId) {
    // Subclasses can implement specific worker termination or cleanup here
  }
}
