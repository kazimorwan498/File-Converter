/**
 * Offline OCR Manager
 * Coordinates client-side OCR extraction on rendered scanned PDF page images.
 * 100% offline, zero network requests, loads language data locally.
 */
import { ConversionError } from '../core/conversion-error.js';

export class OcrManager {
  constructor(options = {}) {
    this.workerPath = options.workerPath || '/ocr/worker.min.js';
    this.corePath = options.corePath || '/ocr';
    this.langPath = options.langPath || '/ocr/languages';
    this.currentWorker = null;
    this.isProcessing = false;
  }

  /**
   * Lazily create and initialize a Tesseract worker configured for 100% local operation
   * @param {Object} [options]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<any>}
   */
  async getWorker(options = {}) {
    if (this.currentWorker) {
      return this.currentWorker;
    }

    const { signal } = options;
    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    try {
      const { createWorker } = await import('tesseract.js');

      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
      }

      const worker = await createWorker('eng', 1, {
        workerPath: this.workerPath,
        corePath: this.corePath,
        langPath: this.langPath,
        gzip: true,
        logger: (m) => {
          // Worker log callback
        },
        errorHandler: (err) => {
          console.warn('OCR Worker warning/error:', err);
        }
      });

      this.currentWorker = worker;
      return worker;
    } catch (err) {
      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
      }
      throw new ConversionError(
        'Unable to extract text from this scanned PDF offline: Failed to initialize offline OCR engine.',
        'OCR_FAILED',
        err
      );
    }
  }

  /**
   * Recognize text across an array of rendered PDF page images
   * @param {Array<{ pageNum: number, blob: Blob }>} pages
   * @param {Object} [options]
   * @param {function(number, string=): void} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ text: string, pageCount: number }>}
   */
  async recognizePages(pages, options = {}) {
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    if (!pages || pages.length === 0) {
      throw new ConversionError('Unable to extract text from this scanned PDF offline: No pages to process.', 'OCR_FAILED');
    }

    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    this.isProcessing = true;
    let worker = null;

    try {
      worker = await this.getWorker({ signal });

      if (signal && signal.aborted) {
        throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
      }

      const totalPages = pages.length;
      const pageTexts = [];

      for (let i = 0; i < totalPages; i++) {
        if (signal && signal.aborted) {
          throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
        }

        const page = pages[i];
        const pageNum = page.pageNum || (i + 1);

        // Progress calculation: 50% to 95%
        const pageProgress = 50 + Math.round(((i) / totalPages) * 45);
        onProgress(pageProgress, `OCR page ${pageNum} of ${totalPages}`);

        const ret = await worker.recognize(page.blob);

        if (signal && signal.aborted) {
          throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
        }

        const text = (ret && ret.data && ret.data.text) ? ret.data.text.trim() : '';
        if (text) {
          pageTexts.push(text);
        }
      }

      onProgress(98, 'Finalizing');

      const fullText = pageTexts.join('\n\n').trim();

      if (!fullText) {
        throw new ConversionError(
          'Unable to extract text from this scanned PDF offline: No recognizable text found.',
          'OCR_FAILED'
        );
      }

      return {
        text: fullText,
        pageCount: totalPages
      };
    } catch (err) {
      if (err.code === 'CANCELLED') {
        this.terminate();
        throw err;
      }
      if (err instanceof ConversionError) {
        throw err;
      }
      throw new ConversionError(
        `Unable to extract text from this scanned PDF offline: ${err.message || 'Recognition failed.'}`,
        'OCR_FAILED',
        err
      );
    } finally {
      this.isProcessing = false;
      this.terminate();
    }
  }

  /**
   * Terminate active OCR worker and release resources
   */
  async terminate() {
    if (this.currentWorker) {
      try {
        await this.currentWorker.terminate();
      } catch {
        // Ignore
      }
      this.currentWorker = null;
    }
  }
}

// Export singleton instance for app-wide reuse
export const ocrManager = new OcrManager();
