/**
 * Offline PDF Text Extractor
 * Extracts text streams from PDF documents without remote servers or external libraries.
 * Decompresses FlateDecode streams using native Web Streams API (DecompressionStream).
 */
import { ConversionError } from '../../core/conversion-error.js';

export class PdfExtractor {
  /**
   * Decode PDF string escape sequences (e.g. \(, \), \\, \ddd octal)
   * @param {string} str
   * @returns {string}
   */
  static decodePdfString(str) {
    if (!str) return '';

    return str
      // Octal character escapes: \123
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      // Common character escapes
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
    // 1. Try native Web Streams DecompressionStream (Standard in modern browsers and Node 17+)
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
        // If zlib header variant fails, try deflate-raw
        try {
          const dsRaw = new DecompressionStream('deflate-raw');
          const writer = dsRaw.writable.getWriter();
          // Skip 2 bytes zlib header if present
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

    // 2. Try Node.js zlib if available in test environment
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

    // Match text blocks between BT and ET
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

      // Scan commands within block
      // 1. Tj operator: (string) Tj
      // 2. TJ operator: [(string) -10 (string)] TJ
      // 3. ' operator: (string) '
      // 4. " operator: w c (string) "
      // 5. Line move operators: T*, Td, TD, Tm
      const tokenRegex = /(\((?:\\.|[^()])*\))\s*Tj|\[((?:[^[\]]|\((?:\\.|[^()])*\))*)\]\s*TJ|(\((?:\\.|[^()])*\))\s*'|(?:\S+\s+\S+\s+)?(\((?:\\.|[^()])*\))\s*"|(T\*|Td|TD|Tm)/g;
      let tokenMatch;

      while ((tokenMatch = tokenRegex.exec(block)) !== null) {
        // Line break operators
        if (tokenMatch[5]) {
          flushLine();
          continue;
        }

        // Tj or ' or "
        const singleStrMatch = tokenMatch[1] || tokenMatch[3] || tokenMatch[4];
        if (singleStrMatch) {
          // Strip enclosing parentheses
          const raw = singleStrMatch.slice(1, -1);
          currentLineTokens.push(PdfExtractor.decodePdfString(raw));
          if (tokenMatch[3] || tokenMatch[4]) {
            // ' and " also move to next line
            flushLine();
          }
          continue;
        }

        // TJ array
        const arrayContent = tokenMatch[2];
        if (arrayContent) {
          const itemRegex = /\((.*?)\)|(-?\d+(?:\.\d+)?)/g;
          let itemMatch;
          while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
            if (itemMatch[1] !== undefined) {
              currentLineTokens.push(PdfExtractor.decodePdfString(itemMatch[1]));
            } else if (itemMatch[2] !== undefined) {
              const spacing = parseFloat(itemMatch[2]);
              // Negative spacing in TJ often indicates space between words (typically < -100)
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

    // Validate PDF header
    if (!pdfText.startsWith('%PDF-')) {
      throw new ConversionError('File is not a valid PDF document (missing %PDF- header).', 'INVALID_PDF');
    }

    // Find all stream objects: e.g. << /Filter /FlateDecode ... >> stream ... endstream
    // Regex finds object headers and streams
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

      // Slice out stream bytes
      const rawStreamBytes = new Uint8Array(buffer.slice(streamStart, endStreamIndex));
      // Handle trailing newline before endstream if present
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
          const decompressed = await PdfExtractor.decompressFlate(streamBytes);
          streamString = latin1Decoder.decode(decompressed);
        } else {
          streamString = latin1Decoder.decode(streamBytes);
        }

        const lines = PdfExtractor.parseTextFromStream(streamString);
        if (lines.length > 0) {
          extractedBlocks.push(...lines);
        }
      } catch {
        // Skip un-decompressible streams (e.g. image streams, JPXDecode, CCITTFaxDecode)
      }
    }

    // Filter out page numbers and header repetitions if appropriate
    const cleanedLines = extractedBlocks
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (cleanedLines.length === 0) {
      throw new ConversionError(
        'Scanned PDF or image-only document: No extractable text stream found. Client-side OCR is not supported offline.',
        'NO_TEXT_IN_PDF'
      );
    }

    return cleanedLines.join('\n');
  }
}
