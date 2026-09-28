/**
 * Converter Manager
 * Orchestrates offline converters, lifecycle states, progress dispatching,
 * cancellation controllers, format detection, and error handling.
 */
import { ConverterRegistry } from './converter-registry.js';
import { ConversionError } from './conversion-error.js';
import { getFileExtension } from '../utils/formatters.js';

export class ConverterManager {
  /**
   * @param {ConverterRegistry} [registry]
   */
  constructor(registry = new ConverterRegistry()) {
    this.registry = registry;

    /**
     * Map of active conversion AbortControllers keyed by conversionId / queueItemId
     * @type {Map<string, AbortController>}
     */
    this.activeControllers = new Map();
  }

  /**
   * Register a converter into the registry
   * @param {import('./base-converter.js').BaseConverter} converter
   */
  registerConverter(converter) {
    this.registry.register(converter);
  }

  /**
   * Get underlying registry
   * @returns {ConverterRegistry}
   */
  getRegistry() {
    return this.registry;
  }

  /**
   * Detect input format extension from File or filename
   * @param {File | string} fileOrName
   * @returns {string} Lowercase format extension
   */
  detectInputFormat(fileOrName) {
    if (!fileOrName) return '';
    if (typeof fileOrName === 'string') {
      return getFileExtension(fileOrName) || fileOrName.toLowerCase();
    }
    if (fileOrName instanceof File || (typeof fileOrName === 'object' && fileOrName.name)) {
      return getFileExtension(fileOrName.name);
    }
    return '';
  }

  /**
   * Query available output formats for a given file or format
   * @param {File | string} fileOrType
   * @returns {string[]}
   */
  getAvailableOutputs(fileOrType) {
    return this.registry.getAvailableOutputs(fileOrType);
  }

  /**
   * Check if conversion from file to outputFormat is supported
   * @param {File | string} fileOrType
   * @param {string} [outputFormat]
   * @returns {boolean}
   */
  canConvert(fileOrType, outputFormat) {
    if (!outputFormat) {
      return this.registry.findConvertersForInput(fileOrType).length > 0;
    }
    return this.registry.hasConverterFor(fileOrType, outputFormat);
  }

  /**
   * Execute conversion on a single File object
   * Clean API: converterManager.convert(file, options)
   *
   * @param {File} file
   * @param {Object} options
   * @param {string} options.outputFormat - Desired output extension (e.g. 'png', 'jpg')
   * @param {string} [options.id] - Optional identifier for cancellation tracking
   * @param {function(number, string=): void} [options.onProgress] - Progress callback (0-100)
   * @param {AbortSignal} [options.signal] - Optional external AbortSignal
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, durationMs: number }>}
   */
  async convert(file, options = {}) {
    const { outputFormat, id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, onProgress } = options;

    if (!file) {
      throw new ConversionError('No file provided for conversion', 'CORRUPTED_FILE');
    }

    if (!outputFormat) {
      throw new ConversionError('No output format specified for conversion', 'UNSUPPORTED_FORMAT');
    }

    const converter = this.registry.findConverter(file, outputFormat);
    if (!converter) {
      const ext = this.detectInputFormat(file);
      throw new ConversionError(
        `No offline converter available for "${ext || 'unknown'}" to "${outputFormat.toLowerCase()}"`,
        'NO_CONVERTER'
      );
    }

    // Set up AbortController for cancellation
    const controller = new AbortController();
    this.activeControllers.set(id, controller);

    // Merge external signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        controller.abort(options.signal.reason);
      }, { once: true });
    }

    const startTime = performance.now();

    try {
      if (controller.signal.aborted) {
        throw new ConversionError('Conversion was cancelled before starting', 'CANCELLED');
      }

      onProgress?.(0, 'Preparing conversion...');

      const result = await converter.convert(file, {
        ...options,
        signal: controller.signal,
        onProgress: (pct, stage) => {
          if (!controller.signal.aborted) {
            onProgress?.(pct, stage);
          }
        }
      });

      if (controller.signal.aborted) {
        throw new ConversionError('Conversion was cancelled', 'CANCELLED');
      }

      const durationMs = Math.round(performance.now() - startTime);
      onProgress?.(100, 'Conversion completed');

      return {
        ...result,
        durationMs
      };
    } catch (err) {
      if (controller.signal.aborted || err.name === 'AbortError' || err.code === 'CANCELLED') {
        throw new ConversionError('Conversion was cancelled by user', 'CANCELLED', err);
      }
      if (err instanceof ConversionError) {
        throw err;
      }
      throw new ConversionError(err.message || 'Conversion execution failed', 'CONVERSION_FAILED', err);
    } finally {
      this.activeControllers.delete(id);
    }
  }

  /**
   * Convert a standardized queue item through its full lifecycle
   * Lifecycle: queued -> preparing -> converting -> completed | failed | cancelled
   *
   * @param {Object} queueItem
   * @param {Object} [options]
   * @param {function(number, string=): void} [options.onProgress]
   * @returns {Promise<Object>} Updated queue item
   */
  async convertItem(queueItem, options = {}) {
    if (!queueItem || !queueItem.file) {
      throw new ConversionError('Invalid queue item provided for conversion', 'CORRUPTED_FILE');
    }

    const conversionId = queueItem.id;
    queueItem.status = 'preparing';
    queueItem.progress = 0;
    queueItem.error = null;

    try {
      queueItem.status = 'converting';

      const result = await this.convert(queueItem.file, {
        ...options,
        id: conversionId,
        outputFormat: queueItem.outputFormat,
        onProgress: (pct, stage) => {
          queueItem.progress = pct;
          options.onProgress?.(pct, stage);
        }
      });

      queueItem.status = 'completed';
      queueItem.progress = 100;
      queueItem.outputBlob = result.blob;
      queueItem.outputMimeType = result.mimeType;
      queueItem.outputFilename = result.filename;
      queueItem.durationMs = result.durationMs;

      return queueItem;
    } catch (err) {
      if (err.code === 'CANCELLED') {
        queueItem.status = 'cancelled';
        queueItem.error = 'Conversion was cancelled';
      } else {
        queueItem.status = 'failed';
        queueItem.error = err.message || 'Conversion failed';
      }
      throw err;
    }
  }

  /**
   * Cancel an ongoing conversion by ID
   * @param {string} id - Conversion ID or Queue Item ID
   * @returns {boolean} True if a controller was found and cancelled
   */
  cancel(id) {
    const controller = this.activeControllers.get(id);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Cancel a queue item's ongoing conversion
   * @param {string} queueItemId
   * @returns {boolean}
   */
  cancelItem(queueItemId) {
    return this.cancel(queueItemId);
  }

  /**
   * Cancel all active conversions
   * @returns {number} Count of cancelled conversions
   */
  cancelAll() {
    const count = this.activeControllers.size;
    for (const [id, controller] of this.activeControllers.entries()) {
      controller.abort();
    }
    this.activeControllers.clear();
    return count;
  }

  /**
   * Check if a specific conversion or queue item is currently running
   * @param {string} id
   * @returns {boolean}
   */
  isConverting(id) {
    return this.activeControllers.has(id);
  }
}
