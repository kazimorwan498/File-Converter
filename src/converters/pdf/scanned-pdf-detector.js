/**
 * Scanned PDF Detector
 * Distinguishes between text-based PDFs (with extractable text layer)
 * and scanned/image-only PDFs requiring OCR.
 * 100% offline, zero network requests.
 */
import { ConversionError } from '../../core/conversion-error.js';
import { PdfExtractor } from './pdf-extractor.js';

export class ScannedPdfDetector {
  /**
   * Detect whether a PDF document contains a usable text layer or is scanned/image-only.
   * @param {File|Blob|ArrayBuffer|Uint8Array} fileOrBuffer
   * @param {Object} [options]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ isScanned: boolean, text?: string }>}
   */
  static async detect(fileOrBuffer, options = {}) {
    const signal = options.signal;
    if (signal && signal.aborted) {
      throw new ConversionError('Detection cancelled by user', 'CANCELLED');
    }

    try {
      const text = await PdfExtractor.extractText(fileOrBuffer, { signal });
      if (text && text.trim().length > 0) {
        return {
          isScanned: false,
          text: text.trim()
        };
      }
    } catch (err) {
      if (err.code === 'CANCELLED') {
        throw err;
      }
      if (err.code === 'INVALID_PDF' || err.code === 'INVALID_INPUT') {
        throw err;
      }
      // If NO_TEXT_IN_PDF was thrown, it confirms this document lacks an extractable text stream
      if (err.code === 'NO_TEXT_IN_PDF') {
        return {
          isScanned: true
        };
      }
      // For any other stream decompression or parsing issue on an otherwise valid PDF, treat as scanned
      return {
        isScanned: true
      };
    }

    return {
      isScanned: true
    };
  }
}
