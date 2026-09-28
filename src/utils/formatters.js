/**
 * Utility functions for formatting and file calculations
 */

/**
 * Format byte count into human-readable string (e.g. 1.2 MB)
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Extract clean lowercase extension from filename
 * @param {string} filename
 * @returns {string}
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Supported formats dictionary mapping extension to its category and viable outputs
 */
export const SUPPORTED_FORMATS = {
  // Images
  png: { category: 'image', mime: 'image/png', outputs: ['jpg', 'webp'] },
  jpg: { category: 'image', mime: 'image/jpeg', outputs: ['png', 'webp'] },
  jpeg: { category: 'image', mime: 'image/jpeg', outputs: ['png', 'webp'] },
  webp: { category: 'image', mime: 'image/webp', outputs: ['png', 'jpg'] },

  // Documents
  pdf: { category: 'document', mime: 'application/pdf', outputs: ['txt', 'png'] },
  txt: { category: 'document', mime: 'text/plain', outputs: ['pdf'] },
  md: { category: 'document', mime: 'text/markdown', outputs: ['pdf', 'txt', 'html'] },
  json: { category: 'document', mime: 'application/json', outputs: ['txt'] },

  // Audio
  mp3: { category: 'audio', mime: 'audio/mpeg', outputs: ['wav', 'ogg'] },
  wav: { category: 'audio', mime: 'audio/wav', outputs: ['mp3', 'ogg'] },
  ogg: { category: 'audio', mime: 'audio/ogg', outputs: ['mp3', 'wav'] },
  aac: { category: 'audio', mime: 'audio/aac', outputs: ['mp3', 'wav'] },
  m4a: { category: 'audio', mime: 'audio/mp4', outputs: ['mp3', 'wav'] },

  // Video
  mp4: { category: 'video', mime: 'video/mp4', outputs: ['webm', 'mp3'] },
  webm: { category: 'video', mime: 'video/webm', outputs: ['mp4', 'mp3'] },
  mov: { category: 'video', mime: 'video/quicktime', outputs: ['mp4', 'webm'] },
  mkv: { category: 'video', mime: 'video/x-matroska', outputs: ['mp4', 'webm'] }
};

/**
 * Get category for an extension
 * @param {string} ext
 * @returns {'image' | 'document' | 'audio' | 'video' | 'generic'}
 */
export function getFileCategory(ext) {
  const norm = (ext || '').toLowerCase();
  if (SUPPORTED_FORMATS[norm]) {
    return SUPPORTED_FORMATS[norm].category;
  }
  return 'generic';
}

/**
 * Check if a file extension is supported
 * @param {string} ext
 * @returns {boolean}
 */
export function isFormatSupported(ext) {
  const norm = (ext || '').toLowerCase();
  return Boolean(SUPPORTED_FORMATS[norm]);
}

/**
 * Get available output formats for an extension
 * @param {string} ext
 * @returns {string[]}
 */
export function getAvailableOutputs(ext) {
  const norm = (ext || '').toLowerCase();
  return SUPPORTED_FORMATS[norm] ? SUPPORTED_FORMATS[norm].outputs : [];
}

/**
 * Get default output format for an extension
 * @param {string} ext
 * @returns {string}
 */
export function getDefaultOutput(ext) {
  const outputs = getAvailableOutputs(ext);
  return outputs.length > 0 ? outputs[0] : '';
}

/**
 * Generate output filename by replacing extension with target format
 * @param {string} originalName
 * @param {string} targetFormat
 * @returns {string}
 */
export function generateOutputFilename(originalName, targetFormat) {
  if (!originalName) return `converted.${targetFormat || 'bin'}`;
  const normExt = (targetFormat || '').toLowerCase() === 'jpeg' ? 'jpg' : (targetFormat || '').toLowerCase();
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot > 0) {
    const base = originalName.slice(0, lastDot);
    return `${base}.${normExt}`;
  }
  return `${originalName}.${normExt}`;
}
