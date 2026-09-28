/**
 * Browser-Native Image Converter
 * Converts PNG, JPG, JPEG, and WebP using Canvas API, OffscreenCanvas, and createImageBitmap.
 * 100% offline, client-side, zero external dependencies.
 */
import { BaseConverter } from '../../core/base-converter.js';
import { ConversionError } from '../../core/conversion-error.js';
import { ImageWorkerClient } from '../../workers/image-worker-client.js';

export class ImageConverter extends BaseConverter {
  constructor() {
    super({
      id: 'native-image-converter',
      name: 'Browser-Native Image Converter',
      description: 'High-speed offline image conversion with quality & transparency controls',
      inputFormats: ['png', 'jpg', 'jpeg', 'webp'],
      outputFormats: ['png', 'jpg', 'jpeg', 'webp'],
      inputMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    });
    this.workerClient = new ImageWorkerClient();
  }

  /**
   * MIME type mapping for output format
   * @param {string} format
   * @returns {string}
   */
  getMimeType(format) {
    const f = (format || '').toLowerCase();
    switch (f) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'webp':
        return 'image/webp';
      case 'png':
      default:
        return 'image/png';
    }
  }

  /**
   * Determine if the target format supports alpha transparency
   * @param {string} format
   * @returns {boolean}
   */
  supportsAlpha(format) {
    const f = (format || '').toLowerCase();
    return f === 'png' || f === 'webp';
  }

  /**
   * Read image dimensions and decode source into ImageBitmap or HTMLImageElement
   * @param {File | Blob} file
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ source: any, width: number, height: number, cleanup: function }>}
   */
  async decodeImage(file, signal) {
    if (signal && signal.aborted) {
      throw new ConversionError('Conversion was cancelled before image decode', 'CANCELLED');
    }

    // 1. Try createImageBitmap if available in environment
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            if (typeof bitmap.close === 'function') {
              bitmap.close();
            }
          }
        };
      } catch (err) {
        if (signal && signal.aborted) {
          throw new ConversionError('Image decode was cancelled', 'CANCELLED');
        }
        // Fallback to HTMLImageElement if createImageBitmap fails
      }
    }

    // 2. Fallback to Image element + URL.createObjectURL (browser window scope)
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        const onAbort = () => {
          URL.revokeObjectURL(url);
          img.src = '';
          reject(new ConversionError('Image loading was cancelled', 'CANCELLED'));
        };

        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }

        img.onload = () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve({
            source: img,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            cleanup: () => {
              URL.revokeObjectURL(url);
            }
          });
        };

        img.onerror = () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          URL.revokeObjectURL(url);
          reject(new ConversionError(`Could not decode image "${file.name || 'file'}" (file may be corrupted)`, 'CORRUPTED_FILE'));
        };

        img.src = url;
      });
    }

    throw new ConversionError('No compatible image decoding API available in this environment', 'CONVERSION_FAILED');
  }

  /**
   * Create a canvas element or OffscreenCanvas
   * @param {number} width
   * @param {number} height
   * @returns {{ canvas: any, ctx: any }}
   */
  createCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      return { canvas, ctx };
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      return { canvas, ctx };
    }

    throw new ConversionError('Canvas API is not available in this environment', 'CONVERSION_FAILED');
  }

  /**
   * Export canvas to Blob
   * @param {any} canvas
   * @param {string} mimeType
   * @param {number} quality
   * @returns {Promise<Blob>}
   */
  async exportCanvasToBlob(canvas, mimeType, quality) {
    // 1. OffscreenCanvas convertToBlob
    if (typeof canvas.convertToBlob === 'function') {
      return canvas.convertToBlob({ type: mimeType, quality });
    }

    // 2. HTMLCanvasElement toBlob
    if (typeof canvas.toBlob === 'function') {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new ConversionError('Failed to encode canvas to image Blob', 'CONVERSION_FAILED'));
            }
          },
          mimeType,
          quality
        );
      });
    }

    throw new ConversionError('Canvas toBlob method not supported', 'CONVERSION_FAILED');
  }

  /**
   * Execute image conversion, offloading CPU-heavy rendering to Web Worker when available
   *
   * @param {File} file
   * @param {Object} options
   * @param {string} options.outputFormat - 'png' | 'jpg' | 'jpeg' | 'webp'
   * @param {number} [options.quality=0.92] - Quality value between 0.01 and 1.0 (for jpg/webp)
   * @param {number} [options.width] - Optional target width
   * @param {number} [options.height] - Optional target height
   * @param {boolean} [options.maintainAspectRatio=true] - Preserve aspect ratio when resizing
   * @param {string} [options.backgroundColor='#ffffff'] - Solid background for formats without alpha
   * @param {boolean} [options.preferWorker=true] - Prefer background Web Worker execution
   * @param {function(number, string=): void} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, width: number, height: number }>}
   */
  async convert(file, options = {}) {
    const preferWorker = options.preferWorker !== false;

    // 1. Offload to Web Worker if supported to keep main UI thread 100% responsive
    if (preferWorker && ImageWorkerClient.isSupported()) {
      try {
        return await this.workerClient.convert(file, options);
      } catch (workerErr) {
        // If cancelled, re-throw cancellation immediately without falling back
        if (workerErr.code === 'CANCELLED') {
          throw workerErr;
        }
        // If worker fails due to worker environment issue, fall back to main thread
        console.warn('Image worker conversion encountered an issue, falling back to main-thread canvas:', workerErr.message);
      }
    }

    // 2. Direct Canvas conversion (main-thread or fallback)
    return this.convertOnMainThread(file, options);
  }

  /**
   * Direct Canvas conversion on main thread (used as worker fallback or in environments without Workers)
   * @param {File} file
   * @param {Object} options
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, width: number, height: number }>}
   */
  async convertOnMainThread(file, options = {}) {
    const {
      outputFormat,
      quality = 0.92,
      width: reqWidth,
      height: reqHeight,
      maintainAspectRatio = true,
      backgroundColor = '#ffffff',
      onProgress,
      signal
    } = options;

    if (!outputFormat) {
      throw new ConversionError('No output format specified for image conversion', 'UNSUPPORTED_FORMAT');
    }

    const normOutput = outputFormat.toLowerCase();
    const mimeType = this.getMimeType(normOutput);

    onProgress?.(10, 'Decoding image source...');

    // Decode image and get natural dimensions
    const { source, width: origWidth, height: origHeight, cleanup } = await this.decodeImage(file, signal);

    try {
      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled', 'CANCELLED');
      }

      onProgress?.(35, 'Calculating dimensions...');

      // Calculate target dimensions
      let targetWidth = origWidth;
      let targetHeight = origHeight;

      if (reqWidth && reqHeight) {
        if (maintainAspectRatio) {
          const ratio = Math.min(reqWidth / origWidth, reqHeight / origHeight);
          targetWidth = Math.round(origWidth * ratio);
          targetHeight = Math.round(origHeight * ratio);
        } else {
          targetWidth = Math.round(reqWidth);
          targetHeight = Math.round(reqHeight);
        }
      } else if (reqWidth) {
        targetWidth = Math.round(reqWidth);
        targetHeight = maintainAspectRatio ? Math.round(origHeight * (reqWidth / origWidth)) : origHeight;
      } else if (reqHeight) {
        targetHeight = Math.round(reqHeight);
        targetWidth = maintainAspectRatio ? Math.round(origWidth * (reqHeight / origHeight)) : origWidth;
      }

      // Ensure minimum 1x1 dimensions
      targetWidth = Math.max(1, targetWidth);
      targetHeight = Math.max(1, targetHeight);

      onProgress?.(55, 'Rendering on canvas...');

      // Create canvas with calculated target dimensions
      const { canvas, ctx } = this.createCanvas(targetWidth, targetHeight);

      // Handle transparency: if target format does not support alpha (e.g. JPG), fill background
      if (!this.supportsAlpha(normOutput)) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      } else {
        // Clear transparent canvas for PNG / WebP
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      }

      // Draw image
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled', 'CANCELLED');
      }

      onProgress?.(75, 'Encoding output format...');

      // Clamp quality to 0.01 - 1.0
      const clampedQuality = Math.min(Math.max(quality, 0.01), 1.0);

      // Export canvas to target Blob format
      const blob = await this.exportCanvasToBlob(canvas, mimeType, clampedQuality);

      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled', 'CANCELLED');
      }

      onProgress?.(100, 'Image conversion complete');

      // Generate output filename
      const baseName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'converted';
      const outputExt = normOutput === 'jpeg' ? 'jpg' : normOutput;
      const filename = `${baseName}.${outputExt}`;

      return {
        blob,
        mimeType,
        filename,
        width: targetWidth,
        height: targetHeight,
        originalWidth: origWidth,
        originalHeight: origHeight
      };
    } finally {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    }
  }

  /**
   * Helper to quickly get image dimensions from a File/Blob without full conversion
   * @param {File | Blob} file
   * @returns {Promise<{ width: number, height: number }>}
   */
  async getImageDimensions(file) {
    const { width, height, cleanup } = await this.decodeImage(file);
    if (typeof cleanup === 'function') {
      cleanup();
    }
    return { width, height };
  }

  /**
   * Terminate active worker to immediately free memory
   */
  terminateWorker() {
    if (this.workerClient) {
      this.workerClient.terminate();
    }
  }

  /**
   * Clean up worker if idle
   */
  cleanupWorker() {
    if (this.workerClient) {
      this.workerClient.cleanup();
    }
  }
}

