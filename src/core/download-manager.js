/**
 * Download Manager
 * Handles local Blob URL generation, triggering browser downloads,
 * and revoking object URLs to prevent memory leaks.
 */
export class DownloadManager {
  constructor() {
    this.activeUrls = new Set();
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    this.activeUrls.add(url);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke after a short timeout to allow browser download to start
    setTimeout(() => {
      URL.revokeObjectURL(url);
      this.activeUrls.delete(url);
    }, 1000);
  }

  revokeAll() {
    for (const url of this.activeUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeUrls.clear();
  }
}
