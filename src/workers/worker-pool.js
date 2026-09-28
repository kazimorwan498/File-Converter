/**
 * Generic Web Worker Pool Manager
 * Provides concurrency control, task scheduling, health checks,
 * cancellation, and cleanup for CPU-heavy background tasks.
 */
import { ConversionError } from '../core/conversion-error.js';

export class WorkerPool {
  /**
   * @param {Object} options
   * @param {string | URL} options.workerScript - URL or path to worker script
   * @param {number} [options.maxWorkers=2] - Maximum concurrent workers in pool
   * @param {number} [options.idleTimeoutMs=30000] - Terminate idle workers after timeout
   */
  constructor(options = {}) {
    this.workerScript = options.workerScript;
    this.maxWorkers = options.maxWorkers || Math.min(navigator?.hardwareConcurrency || 2, 4);
    this.idleTimeoutMs = options.idleTimeoutMs || 30000;
    this.workers = [];
    this.taskQueue = [];
    this.activeTaskCount = 0;
  }

  /**
   * Check if Workers are supported
   * @returns {boolean}
   */
  static isSupported() {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  /**
   * Acquire an available worker or spawn a new one if below maxWorkers
   * @returns {Object} { worker, id }
   */
  acquireWorker() {
    // Find an idle worker
    const idleWorker = this.workers.find(w => !w.busy);
    if (idleWorker) {
      if (idleWorker.idleTimer) {
        clearTimeout(idleWorker.idleTimer);
        idleWorker.idleTimer = null;
      }
      idleWorker.busy = true;
      return idleWorker;
    }

    // Spawn new worker if under limit
    if (this.workers.length < this.maxWorkers) {
      const rawWorker = new Worker(this.workerScript, { type: 'module' });
      const workerEntry = {
        id: `pool_worker_${Date.now()}_${this.workers.length}`,
        worker: rawWorker,
        busy: true,
        idleTimer: null
      };

      rawWorker.onerror = (err) => {
        console.error(`WorkerPool worker ${workerEntry.id} error:`, err);
        this.destroyWorker(workerEntry);
      };

      this.workers.push(workerEntry);
      return workerEntry;
    }

    return null;
  }

  /**
   * Release a worker back to idle pool
   * @param {Object} workerEntry
   */
  releaseWorker(workerEntry) {
    workerEntry.busy = false;

    // Check if there are queued tasks
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      workerEntry.busy = true;
      nextTask(workerEntry);
      return;
    }

    // Schedule idle cleanup
    if (this.idleTimeoutMs > 0) {
      workerEntry.idleTimer = setTimeout(() => {
        this.destroyWorker(workerEntry);
      }, this.idleTimeoutMs);
    }
  }

  /**
   * Terminate and remove a worker from pool
   * @param {Object} workerEntry
   */
  destroyWorker(workerEntry) {
    if (workerEntry.idleTimer) {
      clearTimeout(workerEntry.idleTimer);
      workerEntry.idleTimer = null;
    }
    try {
      workerEntry.worker.terminate();
    } catch {}
    this.workers = this.workers.filter(w => w !== workerEntry);
  }

  /**
   * Execute task using a worker from the pool
   * @param {function(Worker): Promise<any>} taskFn
   * @param {AbortSignal} [signal]
   * @returns {Promise<any>}
   */
  async execute(taskFn, signal) {
    if (signal && signal.aborted) {
      throw new ConversionError('Task cancelled before worker allocation', 'CANCELLED');
    }

    return new Promise((resolve, reject) => {
      let abortHandler = null;

      const runWithWorker = async (workerEntry) => {
        if (signal && signal.aborted) {
          this.releaseWorker(workerEntry);
          reject(new ConversionError('Task cancelled', 'CANCELLED'));
          return;
        }

        if (signal) {
          abortHandler = () => {
            // Terminate busy worker immediately on cancellation to release resources
            this.destroyWorker(workerEntry);
            reject(new ConversionError('Task cancelled by user', 'CANCELLED'));
          };
          signal.addEventListener('abort', abortHandler, { once: true });
        }

        try {
          const result = await taskFn(workerEntry.worker);
          if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
          this.releaseWorker(workerEntry);
          resolve(result);
        } catch (err) {
          if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
          this.releaseWorker(workerEntry);
          reject(err);
        }
      };

      const workerEntry = this.acquireWorker();
      if (workerEntry) {
        runWithWorker(workerEntry);
      } else {
        // Queue task until a worker becomes free
        this.taskQueue.push(runWithWorker);
      }
    });
  }

  /**
   * Terminate all workers in pool and clear queue
   */
  terminateAll() {
    this.taskQueue.length = 0;
    for (const workerEntry of [...this.workers]) {
      this.destroyWorker(workerEntry);
    }
    this.workers.length = 0;
  }
}
