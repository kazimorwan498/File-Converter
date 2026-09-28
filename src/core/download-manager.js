/**
 * Download Manager
 * Handles local Blob URL generation, triggering browser downloads (single & batch),
 * and revoking object URLs to prevent memory leaks.
 */
export class DownloadManager {
  constructor() {
    this.activeUrls = new Set();
  }

  /**
   * Create and track an Object URL for a Blob
   * @param {Blob} blob
   * @returns {string} URL string
   */
  createDownloadUrl(blob) {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return '';
    }
    const url = URL.createObjectURL(blob);
    this.activeUrls.add(url);
    return url;
  }

  /**
   * Download a single Blob file
   * @param {Blob} blob
   * @param {string} filename
   */
  downloadBlob(blob, filename) {
    if (!blob) return;

    const url = this.createDownloadUrl(blob);

    if (typeof document !== 'undefined' && document.body) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoke after delay to allow browser download to start
      setTimeout(() => {
        this.revokeUrl(url);
      }, 1500);
    }
  }

  /**
   * Download multiple files sequentially with slight delay to prevent browser download throttling
   * @param {{ blob?: Blob, outputBlob?: Blob, filename?: string, outputFilename?: string }[]} items
   * @param {number} [delayMs=250]
   * @returns {Promise<number>} Number of downloaded files
   */
  async downloadAll(items, delayMs = 250) {
    let count = 0;
    for (const item of items) {
      const blob = item.outputBlob || item.blob;
      const name = item.outputFilename || item.filename || 'converted';
      if (blob) {
        this.downloadBlob(blob, name);
        count++;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    return count;
  }

  /**
   * Explicitly revoke a specific URL
   * @param {string} url
   */
  revokeUrl(url) {
    if (!url || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
    this.activeUrls.delete(url);
  }

  /**
   * Revoke all currently active tracked Object URLs
   */
  revokeAll() {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    for (const url of Array.from(this.activeUrls)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    this.activeUrls.clear();
  }
}
