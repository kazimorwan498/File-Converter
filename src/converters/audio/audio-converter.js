/**
 * Local WebAssembly Audio Converter
 * Handles client-side offline conversion of MP3, WAV, OGG, AAC, M4A, and FLAC
 * using local WebAssembly FFmpeg. Zero online APIs, zero remote CDNs.
 */
import { BaseConverter } from '../../core/base-converter.js';
import { ConversionError } from '../../core/conversion-error.js';
import { generateOutputFilename, getFileExtension } from '../../utils/formatters.js';
import { MediaEngine } from './media-engine.js';

export const AUDIO_CONVERSION_LIMITATIONS = {
  'wma->mp3': {
    supported: false,
    reason: 'Proprietary Windows Media Audio (WMA) codecs require proprietary decoders not included in the standard offline WASM build.'
  },
  'm4p->mp3': {
    supported: false,
    reason: 'DRM-protected audio (M4P) cannot be converted due to encryption restrictions.'
  }
};

export class AudioConverter extends BaseConverter {
  constructor() {
    super({
      id: 'native-audio-converter',
      name: 'Local WASM Audio Converter',
      description: 'Converts audio files (MP3, WAV, OGG, AAC, M4A, FLAC) using local WebAssembly.',
      inputFormats: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'],
      outputFormats: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'],
      inputMimeTypes: [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/aac',
        'audio/mp4',
        'audio/x-m4a',
        'audio/flac'
      ]
    });
    this.mediaEngine = MediaEngine.getInstance();
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
    if (AUDIO_CONVERSION_LIMITATIONS[key]) {
      return {
        isSupported: false,
        reason: AUDIO_CONVERSION_LIMITATIONS[key].reason
      };
    }

    if (this.canConvert(inExt, outExt)) {
      return { isSupported: true };
    }

    return {
      isSupported: false,
      reason: `Direct offline audio conversion from .${inExt.toUpperCase()} to .${outExt.toUpperCase()} is not supported by the local WebAssembly build.`
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
    return this.outputFormats.includes(outExt);
  }

  /**
   * Get available output formats for an input file
   * @param {File | string} fileOrType
   * @returns {string[]}
   */
  getAvailableOutputs(fileOrType) {
    const inExt = this.normalizeFormat(fileOrType);
    if (!this.canConvert(inExt)) return [];
    // Return all output formats except the same input extension
    return this.outputFormats.filter(fmt => fmt !== inExt);
  }

  /**
   * Execute audio conversion
   * @param {File} file
   * @param {Object} options
   * @param {string} options.outputFormat
   * @param {function(number, string=): void} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, durationMs: number }>}
   */
  async convert(file, options = {}) {
    const inExt = this.normalizeFormat(file.name || file);
    const outExt = this.normalizeFormat(options.outputFormat);

    if (!this.canConvert(inExt, outExt)) {
      const limitation = this.getConversionLimitation(inExt, outExt);
      throw new ConversionError(
        limitation.reason || `Audio conversion from ${inExt.toUpperCase()} to ${outExt.toUpperCase()} is unsupported offline.`,
        'UNSUPPORTED_FORMAT'
      );
    }

    const { blob, mimeType, durationMs } = await this.mediaEngine.transcode(file, options);

    return {
      blob,
      mimeType,
      filename: generateOutputFilename(file.name, outExt),
      durationMs
    };
  }

  /**
   * Cancel ongoing audio conversion
   */
  cancel() {
    this.mediaEngine.terminate();
  }
}
