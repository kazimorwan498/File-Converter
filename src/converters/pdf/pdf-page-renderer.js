/**
 * Offline PDF Page Renderer
 * Renders PDF document pages into high-resolution images for OCR processing.
 * 100% offline, zero network requests, uses locally bundled PDF.js worker.
 */
import { ConversionError } from '../../core/conversion-error.js';

let pdfjsLibPromise = null;

async function getPdfJsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      // Dynamic import to lazy-load PDF.js only when rendering is needed
      const pdfjs = await import('pdfjs-dist/build/pdf.min.mjs');
      if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      }
      return pdfjs;
    })();
  }
  return pdfjsLibPromise;
}

export class PdfPageRenderer {
  /**
   * Map output format extension to MIME type
   * @param {string} [format='png']
   * @returns {{ mimeType: string, quality: number | undefined }}
   */
  static getImageConfig(format = 'png', quality) {
    const fmt = (format || 'png').toLowerCase();
    switch (fmt) {
      case 'jpg':
      case 'jpeg':
        return { mimeType: 'image/jpeg', quality: quality !== undefined ? quality : 0.92 };
      case 'webp':
        return { mimeType: 'image/webp', quality: quality !== undefined ? quality : 0.92 };
      case 'png':
      default:
        return { mimeType: 'image/png', quality: undefined };
    }
  }

  /**
   * Render all pages of a PDF to image Blobs
   * @param {File|Blob|ArrayBuffer|Uint8Array} fileOrBuffer
   * @param {Object} [options]
   * @param {number} [options.scale=2.0] - Render scale factor (2.0 = 144 DPI for clean OCR)
   * @param {string} [options.outputFormat='png'] - Output image format (png, jpg, webp)
   * @param {number} [options.quality] - Image quality for lossy formats (0-1)
   * @param {function(number, number, string): void} [options.onProgress] - (page, total, message)
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Array<{ pageNum: number, blob: Blob }>>}
   */
  static async renderPages(fileOrBuffer, options = {}) {
    const signal = options.signal;
    if (signal && signal.aborted) {
      throw new ConversionError('Rendering cancelled by user', 'CANCELLED');
    }

    let buffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      buffer = fileOrBuffer;
    } else if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
    } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
      buffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new ConversionError('Invalid PDF input for rendering', 'INVALID_INPUT');
    }

    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    const scale = options.scale || 2.0;
    const imgConfig = PdfPageRenderer.getImageConfig(options.outputFormat, options.quality);

    const pdfjs = await getPdfJsLib();

    let loadingTask;
    try {
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: true
      });
    } catch (err) {
      throw new ConversionError(`Failed to load PDF document: ${err.message}`, 'INVALID_PDF', err);
    }

    if (signal) {
      signal.addEventListener('abort', () => {
        try {
          loadingTask.destroy();
        } catch {
          // Ignore
        }
      });
    }

    let pdfDoc;
    try {
      pdfDoc = await loadingTask.promise;
    } catch (err) {
      if (signal && signal.aborted) {
        throw new ConversionError('Rendering cancelled by user', 'CANCELLED');
      }
      throw new ConversionError(`Failed to parse PDF document for rendering: ${err.message}`, 'INVALID_PDF', err);
    }

    const numPages = pdfDoc.numPages || 1;
    const renderedPages = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (signal && signal.aborted) {
        throw new ConversionError('Rendering cancelled by user', 'CANCELLED');
      }

      onProgress(pageNum, numPages, `Rendering page ${pageNum} of ${numPages}`);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const width = Math.max(1, Math.floor(viewport.width));
      const height = Math.max(1, Math.floor(viewport.height));

      let canvas;
      let ctx;

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext('2d');
      } else if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');
      } else {
        throw new ConversionError('Canvas rendering is not supported in this runtime environment.', 'UNSUPPORTED_ENVIRONMENT');
      }

      // Fill white background before rendering
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const renderContext = {
        canvasContext: ctx,
        viewport
      };

      await page.render(renderContext).promise;

      let blob;
      if (canvas.convertToBlob) {
        blob = await canvas.convertToBlob({
          type: imgConfig.mimeType,
          quality: imgConfig.quality
        });
      } else if (canvas.toBlob) {
        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, imgConfig.mimeType, imgConfig.quality)
        );
      }

      if (!blob) {
        throw new ConversionError(`Failed to encode rendered PDF page ${pageNum} to image.`, 'CONVERSION_FAILED');
      }

      renderedPages.push({
        pageNum,
        blob
      });
    }

    return renderedPages;
  }
}
