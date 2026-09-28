/**
 * Local WebAssembly Video Converter
 * Handles client-side offline conversion of MP4, WebM, MOV, MKV, and AVI,
 * as well as audio extraction (MP4/WebM -> MP3/WAV) using local WebAssembly FFmpeg.
 * Zero online APIs, zero remote CDNs.
 */
import { BaseConverter } from '../../core/base-converter.js';
import { ConversionError } from '../../core/conversion-error.js';
import { generateOutputFilename, getFileExtension } from '../../utils/formatters.js';
import { MediaEngine } from '../audio/media-engine.js';

export const VIDEO_CONVERSION_LIMITATIONS = {
  'rmvb->mp4': {
    supported: false,
    reason: 'RealMedia Variable Bitrate (RMVB) uses proprietary RealNetworks codecs not supported by the offline WebAssembly build.'
  },
  'wmv->webm': {
    supported: false,
    reason: 'Windows Media Video 9 (WMV3) requires proprietary Microsoft decoders not supported offline.'
  }
};

export class VideoConverter extends BaseConverter {
  constructor() {
    super({
      id: 'native-video-converter',
      name: 'Local WASM Video Converter',
      description: 'Converts video files (MP4, WebM, MOV, MKV) and extracts audio (MP3, WAV) using local WebAssembly.',
      inputFormats: ['mp4', 'webm', 'mov', 'mkv', 'avi'],
      outputFormats: ['mp4', 'webm', 'mp3', 'wav'],
      inputMimeTypes: [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-matroska',
        'video/x-msvideo'
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
    if (VIDEO_CONVERSION_LIMITATIONS[key]) {
      return {
        isSupported: false,
        reason: VIDEO_CONVERSION_LIMITATIONS[key].reason
      };
    }

    if (this.canConvert(inExt, outExt)) {
      return { isSupported: true };
    }

    return {
      isSupported: false,
      reason: `Direct offline video conversion from .${inExt.toUpperCase()} to .${outExt.toUpperCase()} is not supported by the local WebAssembly build.`
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
   * Execute video conversion or audio extraction
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
        limitation.reason || `Video conversion from ${inExt.toUpperCase()} to ${outExt.toUpperCase()} is unsupported offline.`,
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
   * Cancel ongoing video conversion
   */
  cancel() {
    this.mediaEngine.terminate();
  }
}
