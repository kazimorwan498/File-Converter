/**
 * Offline PDF Text Extractor
 * Extracts text streams from PDF documents without remote servers or external libraries.
 * Decompresses FlateDecode streams using native Web Streams API (DecompressionStream).
 */
import { ConversionError } from '../../core/conversion-error.js';

export class PdfTextExtractor {
  /**
   * Decode PDF string escape sequences (e.g. \(, \), \\, \ddd octal)
   * @param {string} str
   * @returns {string}
   */
  static decodePdfString(str) {
    if (!str) return '';

    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Decompress FlateDecode byte chunk using native DecompressionStream or zlib fallback
   * @param {Uint8Array} compressedBytes
   * @returns {Promise<Uint8Array>}
   */
  static async decompressFlate(compressedBytes) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(compressedBytes);
        writer.close();

        const chunks = [];
        const reader = ds.readable.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          result.set(chunk, pos);
          pos += chunk.length;
        }
        return result;
      } catch {
        try {
          const dsRaw = new DecompressionStream('deflate-raw');
          const writer = dsRaw.writable.getWriter();
          const rawBytes = compressedBytes.length > 2 ? compressedBytes.slice(2) : compressedBytes;
          writer.write(rawBytes);
          writer.close();

          const chunks = [];
          const reader = dsRaw.readable.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }

          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const result = new Uint8Array(totalLen);
          let pos = 0;
          for (const chunk of chunks) {
            result.set(chunk, pos);
            pos += chunk.length;
          }
          return result;
        } catch {
          // Continue to fallback
        }
      }
    }

    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        const zlibModule = 'node:zlib';
        const zlib = await import(/* @vite-ignore */ zlibModule);
        const buf = zlib.inflateSync(compressedBytes);
        return new Uint8Array(buf);
      } catch {
        // Ignore
      }
    }

    throw new Error('Decompression not supported or stream corrupted');
  }

  /**
   * Parse text tokens from uncompressed PDF content stream text
   * @param {string} content
   * @returns {string[]}
   */
  static parseTextFromStream(content) {
    if (!content) return [];

    const lines = [];
    let currentLineTokens = [];

    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch;

    const flushLine = () => {
      if (currentLineTokens.length > 0) {
        const line = currentLineTokens.join('').trim();
        if (line) {
          lines.push(line);
        }
        currentLineTokens = [];
      }
    };

    while ((btMatch = btRegex.exec(content)) !== null) {
      const block = btMatch[1];
      const tokenRegex = /(\((?:\\.|[^()])*\))\s*Tj|\[((?:[^[\]]|\((?:\\.|[^()])*\))*)\]\s*TJ|(\((?:\\.|[^()])*\))\s*'|(?:\S+\s+\S+\s+)?(\((?:\\.|[^()])*\))\s*"|(T\*|Td|TD|Tm)/g;
      let tokenMatch;

      while ((tokenMatch = tokenRegex.exec(block)) !== null) {
        if (tokenMatch[5]) {
          flushLine();
          continue;
        }

        const singleStrMatch = tokenMatch[1] || tokenMatch[3] || tokenMatch[4];
        if (singleStrMatch) {
          const raw = singleStrMatch.slice(1, -1);
          currentLineTokens.push(PdfTextExtractor.decodePdfString(raw));
          if (tokenMatch[3] || tokenMatch[4]) {
            flushLine();
          }
          continue;
        }

        const arrayContent = tokenMatch[2];
        if (arrayContent) {
          const itemRegex = /\((.*?)\)|(-?\d+(?:\.\d+)?)/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
            if (itemMatch[1] !== undefined) {
              currentLineTokens.push(PdfTextExtractor.decodePdfString(itemMatch[1]));
            } else if (itemMatch[2] !== undefined) {
              const spacing = parseFloat(itemMatch[2]);
              if (spacing < -120) {
                currentLineTokens.push(' ');
              }
            }
          }
        }
      }

      flushLine();
    }

    return lines;
  }

  /**
   * Extract text from PDF file or ArrayBuffer
   * @param {File|Blob|ArrayBuffer|Uint8Array} fileOrBuffer
   * @param {Object} [options]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<string>}
   */
  static async extractText(fileOrBuffer, options = {}) {
    const signal = options.signal;
    if (signal && signal.aborted) {
      throw new ConversionError('Extraction cancelled by user', 'CANCELLED');
    }

    let buffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      buffer = fileOrBuffer;
    } else if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
    } else if (typeof fileOrBuffer.arrayBuffer === 'function') {
      buffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new ConversionError('Invalid input: Expected File, Blob, or ArrayBuffer', 'INVALID_INPUT');
    }

    const latin1Decoder = new TextDecoder('latin1');
    const pdfText = latin1Decoder.decode(buffer);

    if (!pdfText.startsWith('%PDF-')) {
      throw new ConversionError('File is not a valid PDF document (missing %PDF- header).', 'INVALID_PDF');
    }

    const streamRegex = /<<([^>]*)>>\s*stream\r?\n/g;
    let match;
    const extractedBlocks = [];

    while ((match = streamRegex.exec(pdfText)) !== null) {
      if (signal && signal.aborted) {
        throw new ConversionError('Extraction cancelled by user', 'CANCELLED');
      }

      const dictContent = match[1];
      const streamStart = match.index + match[0].length;
      const endStreamIndex = pdfText.indexOf('endstream', streamStart);

      if (endStreamIndex === -1) {
        continue;
      }

      const rawStreamBytes = new Uint8Array(buffer.slice(streamStart, endStreamIndex));
      let streamBytes = rawStreamBytes;
      if (streamBytes.length > 0 && streamBytes[streamBytes.length - 1] === 10) {
        streamBytes = streamBytes.slice(0, streamBytes.length - 1);
        if (streamBytes.length > 0 && streamBytes[streamBytes.length - 1] === 13) {
          streamBytes = streamBytes.slice(0, streamBytes.length - 1);
        }
      }

      const isFlate = /\/Filter\s*\/FlateDecode/.test(dictContent);

      try {
        let streamString = '';
        if (isFlate) {
          const decompressed = await PdfTextExtractor.decompressFlate(streamBytes);
          streamString = latin1Decoder.decode(decompressed);
        } else {
          streamString = latin1Decoder.decode(streamBytes);
        }

        const lines = PdfTextExtractor.parseTextFromStream(streamString);
        if (lines.length > 0) {
          extractedBlocks.push(...lines);
        }
      } catch {
        // Skip un-decompressible streams
      }
    }

    const cleanedLines = extractedBlocks
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (cleanedLines.length === 0) {
      throw new ConversionError(
        'No extractable text stream found in this PDF. The document may be scanned or image-only and will be routed to the OCR pipeline.',
        'NO_TEXT_IN_PDF'
      );
    }

    return cleanedLines.join('\n');
  }
}

// For compatibility
export const PdfExtractor = PdfTextExtractor;
