/**
 * PWA & Offline Lifecycle Manager
 * Handles Service Worker registration, install prompt interception,
 * standalone display mode detection, and online/offline status monitoring.
 */

export class PwaManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.swUrl='/sw.js'] - Service Worker script URL
   * @param {function(boolean): void} [options.onConnectivityChange]
   * @param {function(boolean): void} [options.onInstallableChange]
   * @param {function(): void} [options.onInstalled]
   */
  constructor(options = {}) {
    this.swUrl = options.swUrl || '/sw.js';
    this.deferredPrompt = null;
    this.swRegistration = null;
    this.isInstallable = false;

    this.onConnectivityChange = options.onConnectivityChange || (() => {});
    this.onInstallableChange = options.onInstallableChange || (() => {});
    this.onInstalled = options.onInstalled || (() => {});
  }

  /**
   * Initialize PWA subsystem: register SW and hook events
   */
  async init() {
    if (typeof window === 'undefined') {
      return;
    }

    this.setupConnectivityListeners();
    this.setupInstallPromptListeners();
    await this.registerServiceWorker();
  }

  /**
   * Register the application Service Worker
   * @returns {Promise<ServiceWorkerRegistration | null>}
   */
  async registerServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const reg = await navigator.serviceWorker.register(this.swUrl, { scope: '/' });
      this.swRegistration = reg;

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('PWA: New version available and cached.');
            }
          });
        }
      });

      return reg;
    } catch (err) {
      console.warn('PWA: Service Worker registration failed:', err.message);
      return null;
    }
  }

  /**
   * Listen for window online and offline events
   */
  setupConnectivityListeners() {
    window.addEventListener('online', () => {
      this.onConnectivityChange(true);
    });

    window.addEventListener('offline', () => {
      this.onConnectivityChange(false);
    });
  }

  /**
   * Intercept browser's beforeinstallprompt to provide custom in-app install action
   */
  setupInstallPromptListeners() {
    // If already in standalone mode, no installation needed
    if (this.isStandalone()) {
      this.isInstallable = false;
      this.onInstallableChange(false);
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      this.handleBeforeInstallPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      this.handleAppInstalled();
    });
  }

  /**
   * Handle beforeinstallprompt event
   * @param {Event} e
   */
  handleBeforeInstallPrompt(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    this.deferredPrompt = e;
    this.isInstallable = true;
    this.onInstallableChange(true);
  }

  /**
   * Handle appinstalled event
   */
  handleAppInstalled() {
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.onInstallableChange(false);
    this.onInstalled();
    console.info('PWA: Application was installed successfully.');
  }

  /**
   * Prompt user to install the PWA
   * @returns {Promise<{ outcome: 'accepted' | 'dismissed' | 'unavailable' }>}
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      return { outcome: 'unavailable' };
    }

    try {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.isInstallable = false;
      this.onInstallableChange(false);
      return { outcome: choiceResult.outcome };
    } catch (err) {
      console.warn('PWA: Prompt error:', err.message);
      return { outcome: 'dismissed' };
    }
  }

  /**
   * Check if app is running as an installed standalone PWA
   * @returns {boolean}
   */
  isStandalone() {
    if (typeof window === 'undefined') return false;

    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  /**
   * Check if network is currently connected
   * @returns {boolean}
   */
  isOnline() {
    if (typeof navigator === 'undefined' || typeof navigator.onLine === 'undefined') {
      return true;
    }
    return navigator.onLine;
  }
}
