/**
 * Image Worker Client
 * Manages the lifecycle, message dispatching, progress tracking,
 * cancellation, error handling, and cleanup for the image conversion Web Worker.
 */
import { ConversionError } from '../core/conversion-error.js';

export class ImageWorkerClient {
  constructor() {
    this.worker = null;
    this.activeJobs = new Map();
    this.jobCounter = 0;
  }

  /**
   * Check if Web Workers and OffscreenCanvas are supported in current environment
   * @returns {boolean}
   */
  static isSupported() {
    return (
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined'
    );
  }

  /**
   * Lazily initialize or retrieve the Web Worker instance
   * @returns {Worker}
   */
  getWorker() {
    if (!this.worker) {
      try {
        // Instantiate module worker using standard Vite syntax
        const rawWorker = new Worker(
          new URL('./image.worker.js', import.meta.url),
          { type: 'module' }
        );
        this.setWorker(rawWorker);
      } catch (err) {
        this.worker = null;
        throw new ConversionError(
          `Failed to initialize Image Web Worker: ${err.message}`,
          'WORKER_INIT_FAILED'
        );
      }
    }
    return this.worker;
  }

  /**
   * Set worker instance and hook message/error listeners
   * @param {Worker} worker
   */
  setWorker(worker) {
    this.worker = worker;
    if (worker) {
      worker.onmessage = (event) => this.handleMessage(event);
      worker.onerror = (error) => this.handleWorkerError(error);
      worker.onmessageerror = (error) => this.handleMessageError(error);
    }
  }

  /**
   * Handle incoming messages from the worker
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    const { id, type, payload } = event.data || {};
    if (!id || !this.activeJobs.has(id)) {
      return;
    }

    const job = this.activeJobs.get(id);

    switch (type) {
      case 'PROGRESS': {
        if (typeof job.onProgress === 'function') {
          job.onProgress(payload?.percent ?? event.data.percent, payload?.message ?? event.data.message);
        }
        break;
      }

      case 'SUCCESS': {
        this.activeJobs.delete(id);
        const { outputBuffer, mimeType, filename, width, height, originalWidth, originalHeight } = payload;
        const blob = new Blob([outputBuffer], { type: mimeType });
        job.resolve({
          blob,
          mimeType,
          filename,
          width,
          height,
          originalWidth,
          originalHeight
        });
        break;
      }

      case 'ERROR': {
        this.activeJobs.delete(id);
        job.reject(new ConversionError(
          payload?.message || 'Worker image conversion failed',
          payload?.code || 'CONVERSION_FAILED'
        ));
        break;
      }

      case 'CANCELLED': {
        this.activeJobs.delete(id);
        job.reject(new ConversionError(
          payload?.message || 'Conversion cancelled',
          'CANCELLED'
        ));
        break;
      }

      default:
        break;
    }
  }

  /**
   * Handle catastrophic worker crash or unhandled error
   * @param {ErrorEvent} error
   */
  handleWorkerError(error) {
    const errorMsg = error?.message || 'Web Worker crashed during execution';
    const convError = new ConversionError(errorMsg, 'WORKER_CRASH');

    // Reject all active jobs
    for (const [id, job] of this.activeJobs.entries()) {
      job.reject(convError);
      this.activeJobs.delete(id);
    }

    // Terminate broken worker to release resources
    this.terminate();
  }

  /**
   * Handle message deserialization error
   * @param {MessageEvent} error
   */
  handleMessageError(error) {
    const convError = new ConversionError('Failed to deserialize worker message', 'WORKER_COMM_FAILED');
    for (const [id, job] of this.activeJobs.entries()) {
      job.reject(convError);
      this.activeJobs.delete(id);
    }
  }

  /**
   * Convert an image file inside the Web Worker
   * @param {File | Blob} file
   * @param {Object} options
   * @param {string} options.outputFormat - Target format ('png', 'jpg', 'jpeg', 'webp')
   * @param {number} [options.quality=0.92]
   * @param {number} [options.width]
   * @param {number} [options.height]
   * @param {boolean} [options.maintainAspectRatio=true]
   * @param {string} [options.backgroundColor='#ffffff']
   * @param {function(number, string=): void} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ blob: Blob, mimeType: string, filename: string, width: number, height: number }>}
   */
  async convert(file, options = {}) {
    const { signal, onProgress } = options;

    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    const worker = this.getWorker();
    const jobId = `job_${Date.now()}_${++this.jobCounter}`;

    onProgress?.(5, 'Preparing image buffer for worker...');

    // Read file bytes into ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    if (signal && signal.aborted) {
      throw new ConversionError('Conversion cancelled by user', 'CANCELLED');
    }

    return new Promise((resolve, reject) => {
      // Abort handling: immediately terminate worker and reject
      let abortHandler = null;
      if (signal) {
        abortHandler = () => {
          this.activeJobs.delete(jobId);
          // If this was the only active job, terminate worker to instantly stop CPU load
          if (this.activeJobs.size === 0) {
            this.terminate();
          } else {
            try {
              worker.postMessage({ id: jobId, type: 'CANCEL' });
            } catch {}
          }
          reject(new ConversionError('Conversion cancelled by user', 'CANCELLED'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      this.activeJobs.set(jobId, {
        resolve: (result) => {
          if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
          resolve(result);
        },
        reject: (err) => {
          if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
          reject(err);
        },
        onProgress
      });

      // Transfer fileBuffer to worker for zero-copy memory transfer
      try {
        worker.postMessage(
          {
            id: jobId,
            type: 'CONVERT',
            payload: {
              fileBuffer,
              fileName: file.name || 'image',
              fileType: file.type || 'image/png',
              outputFormat: options.outputFormat,
              quality: options.quality,
              width: options.width,
              height: options.height,
              maintainAspectRatio: options.maintainAspectRatio,
              backgroundColor: options.backgroundColor
            }
          },
          [fileBuffer] // Transferable!
        );
      } catch (postErr) {
        this.activeJobs.delete(jobId);
        if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
        reject(new ConversionError(
          `Failed to post message to image worker: ${postErr.message}`,
          'WORKER_COMM_FAILED'
        ));
      }
    });
  }

  /**
   * Terminate the active worker and reset state
   */
  terminate() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
    this.activeJobs.clear();
  }

  /**
   * Clean up resources when idle
   */
  cleanup() {
    if (this.activeJobs.size === 0) {
      this.terminate();
    }
  }
}
