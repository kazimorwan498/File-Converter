/**
 * Browser-Native Document Converter
 * Handles client-side offline conversion of Text, Markdown, HTML, JSON,
 * and text extraction from PDF documents.
 * 100% offline, zero online APIs, zero CDN dependencies.
 */
import { BaseConverter } from '../../core/base-converter.js';
import { ConversionError } from '../../core/conversion-error.js';
import { generateOutputFilename } from '../../utils/formatters.js';
import { PdfDocument } from './pdf-generator.js';
import { MarkdownParser } from './markdown-parser.js';
import { PdfExtractor } from './pdf-extractor.js';
import { ScannedPdfDetector } from './scanned-pdf-detector.js';
import { PdfPageRenderer } from './pdf-page-renderer.js';
import { ocrManager } from '../../ocr/ocr-manager.js';

export const DOCUMENT_CONVERSION_LIMITATIONS = {
  'docx->pdf': {
    supported: false,
    reason: 'DOCX conversion requires desktop office engines (MS Word / LibreOffice). 100% offline client-side conversion is unsupported.'
  },
  'pdf->docx': {
    supported: false,
    reason: 'PDF to DOCX reflow requires desktop office layout engines. 100% offline client-side conversion is unsupported.'
  }
};

export class DocumentConverter extends BaseConverter {
  constructor() {
    super({
      id: 'native-document-converter',
      name: 'Browser-Native Document Converter',
      description: 'Converts Text, Markdown, HTML, JSON, and extracts PDF text layers completely offline.',
      inputFormats: ['txt', 'md', 'markdown', 'html', 'json', 'pdf'],
      outputFormats: ['pdf', 'txt', 'html', 'png', 'jpg', 'jpeg', 'webp'],
      inputMimeTypes: [
        'text/plain',
        'text/markdown',
        'text/html',
        'application/json',
        'application/pdf'
      ]
    });
  }

  /**
   * Check if a specific input -> output conversion pair is supported or has known limitations
   * @param {string} inputFormat
   * @param {string} outputFormat
   * @returns {{ isSupported: boolean, reason?: string }}
   */
  getConversionLimitation(inputFormat, outputFormat) {
    const inExt = this.normalizeFormat(inputFormat);
    const outExt = this.normalizeFormat(outputFormat);

    const key = `${inExt}->${outExt}`;
    if (DOCUMENT_CONVERSION_LIMITATIONS[key]) {
      return {
        isSupported: false,
        reason: DOCUMENT_CONVERSION_LIMITATIONS[key].reason
      };
    }

    if (this.canConvert(inExt, outExt)) {
      return { isSupported: true };
    }

    return {
      isSupported: false,
      reason: `Direct offline conversion from .${inExt.toUpperCase()} to .${outExt.toUpperCase()} is not supported without external desktop engines.`
    };
  }

  /**
   * Determine if this converter can convert the given file/format to outputFormat
   * @param {File | string} fileOrType
   * @param {string} [outputFormat]
   * @returns {boolean}
   */
  canConvert(fileOrType, outputFormat) {
    const inExt = this.normalizeFormat(fileOrType);
    if (!this.inputFormats.includes(inExt)) {
      return false;
    }

    if (!outputFormat) {
      return true;
    }

    const outExt = this.normalizeFormat(outputFormat);

    // Supported conversion matrix:
    switch (inExt) {
      case 'txt':
        return outExt === 'pdf' || outExt === 'html';
      case 'md':
      case 'markdown':
        return outExt === 'html' || outExt === 'pdf' || outExt === 'txt';
      case 'html':
        return outExt === 'txt';
      case 'json':
        return outExt === 'txt';
      case 'pdf':
        return ['txt', 'png', 'jpg', 'jpeg', 'webp'].includes(outExt);
      default:
        return false;
    }
  }

  /**
   * Get available output formats for an input file
   * @param {File | string} fileOrType
   * @returns {string[]}
   */
  getAvailableOutputs(fileOrType) {
    const inExt = this.normalizeFormat(fileOrType);
    switch (inExt) {
      case 'txt':
        return ['pdf', 'html'];
      case 'md':
      case 'markdown':
        return ['html', 'pdf', 'txt'];
      case 'html':
        return ['txt'];
      case 'json':
        return ['txt'];
      case 'pdf':
        return ['txt', 'png', 'jpg', 'webp'];
      default:
        return [];
    }
  }

  /**
   * Read file content as text
   * @param {File|Blob} file
   * @returns {Promise<string>}
   */
  async readFileAsText(file) {
    if (typeof file.text === 'function') {
      return await file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file as text'));
      reader.readAsText(file);
    });
  }

  /**
   * Convert plain text to HTML document
   * @param {string} text
   * @param {string} title
   * @returns {string}
   */
  textToHtml(text, title) {
    const escaped = MarkdownParser.escapeHtml(text);
    const paragraphs = escaped
      .split(/\r?\n\r?\n/)
      .map(p => `<p>${p.replace(/\r?\n/g, '<br />')}</p>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${MarkdownParser.escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2328;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    p { margin-bottom: 1rem; }
  </style>
</head>
<body>
${paragraphs}
</body>
</html>`;
  }

  /**
   * Convert HTML to plain text
   * @param {string} html
   * @returns {string}
   */
  htmlToText(html) {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    }
    // Fallback for Node environment
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Execute document conversion
   * @param {File} file
   * @param {Object} options
   * @param {string} options.outputFormat
   * @param {function(number, string=): void} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, durationMs: number }>}
   */
  async convert(file, options = {}) {
    const startTime = Date.now();
    const signal = options.signal;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    const inExt = this.normalizeFormat(file.name || file);
    const outExt = this.normalizeFormat(options.outputFormat);

    // Validate conversion feasibility
    const limitation = this.getConversionLimitation(inExt, outExt);
    if (!limitation.isSupported) {
      throw new ConversionError(
        `Conversion from "${inExt.toUpperCase()}" to "${outExt.toUpperCase()}" is unsupported offline. Reason: ${limitation.reason}`,
        'UNSUPPORTED_FORMAT'
      );
    }

    onProgress(10, 'Reading file');

    let outputBlob;
    let mimeType;
    const documentTitle = file.name ? file.name.replace(/\.[^.]+$/, '') : 'Document';

    // 1. TXT -> PDF
    if (inExt === 'txt' && outExt === 'pdf') {
      const text = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(35, 'Formatting PDF');

      const doc = new PdfDocument({ title: documentTitle });
      const paragraphs = text.split(/\r?\n\r?\n/);
      for (const p of paragraphs) {
        if (p.trim()) {
          doc.drawParagraph(p.trim());
        }
      }

      onProgress(75, 'Generating PDF document');
      const bytes = doc.build();
      outputBlob = new Blob([bytes], { type: 'application/pdf' });
      mimeType = 'application/pdf';
    }

    // 2. TXT -> HTML
    else if (inExt === 'txt' && outExt === 'html') {
      const text = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(50, 'Converting to HTML');

      const html = this.textToHtml(text, documentTitle);
      outputBlob = new Blob([html], { type: 'text/html' });
      mimeType = 'text/html';
    }

    // 3. MD -> HTML
    else if ((inExt === 'md' || inExt === 'markdown') && outExt === 'html') {
      const markdown = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(50, 'Parsing Markdown');

      const html = MarkdownParser.toHtml(markdown, { title: documentTitle });
      outputBlob = new Blob([html], { type: 'text/html' });
      mimeType = 'text/html';
    }

    // 4. MD -> PDF
    else if ((inExt === 'md' || inExt === 'markdown') && outExt === 'pdf') {
      const markdown = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(40, 'Parsing Markdown layout');

      const doc = MarkdownParser.toPdfDocument(markdown, { title: documentTitle });
      onProgress(75, 'Generating PDF layout');

      const bytes = doc.build();
      outputBlob = new Blob([bytes], { type: 'application/pdf' });
      mimeType = 'application/pdf';
    }

    // 5. MD -> TXT
    else if ((inExt === 'md' || inExt === 'markdown') && outExt === 'txt') {
      const markdown = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(50, 'Stripping Markdown syntax');

      const text = MarkdownParser.toText(markdown);
      outputBlob = new Blob([text], { type: 'text/plain' });
      mimeType = 'text/plain';
    }

    // 6. HTML -> TXT
    else if (inExt === 'html' && outExt === 'txt') {
      const html = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(50, 'Extracting text from HTML');

      const text = this.htmlToText(html);
      outputBlob = new Blob([text], { type: 'text/plain' });
      mimeType = 'text/plain';
    }

    // 7. JSON -> TXT
    else if (inExt === 'json' && outExt === 'txt') {
      const jsonStr = await this.readFileAsText(file);
      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');
      onProgress(50, 'Formatting JSON');

      try {
        const parsed = JSON.parse(jsonStr);
        const formatted = JSON.stringify(parsed, null, 2);
        outputBlob = new Blob([formatted], { type: 'text/plain' });
      } catch (err) {
        throw new ConversionError(`Invalid JSON syntax: ${err.message}`, 'CORRUPTED_FILE');
      }
      mimeType = 'text/plain';
    }

    // 8. PDF -> TXT
    else if (inExt === 'pdf' && outExt === 'txt') {
      onProgress(10, 'Detecting text layer');
      const detection = await ScannedPdfDetector.detect(file, { signal });

      let text;
      if (!detection.isScanned && detection.text) {
        onProgress(85, 'Assembling extracted text');
        text = detection.text;
      } else {
        // Scanned / Image-only PDF pipeline
        onProgress(15, 'Preparing scanned PDF');

        // Render PDF pages to images offline
        const pageImages = await PdfPageRenderer.renderPages(file, {
          scale: 2.0,
          signal,
          onProgress: (page, total, msg) => {
            const pct = 15 + Math.round((page / total) * 35);
            onProgress(pct, `Rendering page ${page} of ${total}`);
          }
        });

        if (!pageImages || pageImages.length === 0) {
          throw new ConversionError('Unable to extract text from this scanned PDF offline: No pages rendered.', 'OCR_FAILED');
        }

        // Run offline OCR Web Worker on rendered page images
        const ocrResult = await ocrManager.recognizePages(pageImages, {
          signal,
          onProgress: (pct, msg) => {
            onProgress(pct, msg);
          }
        });

        text = ocrResult.text;
      }

      if (!text || !text.trim()) {
        throw new ConversionError('Unable to extract text from this scanned PDF offline.', 'OCR_FAILED');
      }

      outputBlob = new Blob([text.trim()], { type: 'text/plain' });
      mimeType = 'text/plain';
    }

    // 9. PDF -> Image (PNG, JPG, WebP) — rasterize first page via pdfjs-dist
    else if (inExt === 'pdf' && ['png', 'jpg', 'jpeg', 'webp'].includes(outExt)) {
      onProgress(10, 'Loading PDF document');

      if (signal && signal.aborted) throw new ConversionError('Conversion cancelled', 'CANCELLED');

      const quality = options.quality !== undefined ? options.quality : 0.92;

      const renderedPages = await PdfPageRenderer.renderPages(file, {
        scale: 2.0,
        outputFormat: outExt,
        quality,
        signal,
        onProgress: (page, total, msg) => {
          const pct = 10 + Math.round((page / total) * 80);
          onProgress(pct, msg);
        }
      });

      if (!renderedPages || renderedPages.length === 0) {
        throw new ConversionError('Failed to render PDF pages to image.', 'CONVERSION_FAILED');
      }

      // For single-image output, use the first page
      outputBlob = renderedPages[0].blob;
      const imgConfig = PdfPageRenderer.getImageConfig(outExt);
      mimeType = imgConfig.mimeType;
    }

    else {
      throw new ConversionError(
        `Unsupported conversion: ${inExt.toUpperCase()} -> ${outExt.toUpperCase()}`,
        'UNSUPPORTED_FORMAT'
      );
    }

    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    onProgress(100, 'Completed');

    return {
      blob: outputBlob,
      mimeType,
      filename: generateOutputFilename(file.name, outExt),
      durationMs: Date.now() - startTime
    };
  }
}
