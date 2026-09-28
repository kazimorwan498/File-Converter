/**
 * Phase 8: Web Workers Test Suite
 * Validates worker pool scheduling, image worker client message protocol,
 * progress reporting, cancellation, error handling, worker termination,
 * memory hygiene (no leaks), and ImageConverter worker integration.
 */
import { WorkerPool } from '../src/workers/worker-pool.js';
import { ImageWorkerClient } from '../src/workers/image-worker-client.js';
import { ImageConverter } from '../src/converters/image/image-converter.js';
import { ConverterManager } from '../src/core/converter-manager.js';
import { ConversionError } from '../src/core/conversion-error.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 8: Web Workers & Background Offloading ---');

// Mock File and Blob for Node.js environment
class MockFile {
  constructor(name, size = 1024, type = 'image/png') {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = Date.now();
  }
  async arrayBuffer() {
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]).buffer;
  }
}

class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.byteLength || p.length || 0), 0);
  }
  async arrayBuffer() {
    let totalLen = 0;
    for (const p of this.parts) totalLen += (p.byteLength || p.length || 0);
    const buf = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of this.parts) {
      if (p instanceof Uint8Array || p instanceof ArrayBuffer) {
        buf.set(new Uint8Array(p), offset);
        offset += p.byteLength;
      }
    }
    return buf.buffer;
  }
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = MockBlob;
}

/**
 * Mock Web Worker class to test worker protocols, cancellation, and error states
 */
class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
    this.terminated = false;
    this.postedMessages = [];
  }

  postMessage(message, transfer) {
    this.postedMessages.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  // Helper for tests to simulate worker responding
  simulateMessage(data) {
    if (this.onmessage && !this.terminated) {
      this.onmessage({ data });
    }
  }

  // Helper for tests to simulate worker crashing
  simulateError(error) {
    if (this.onerror && !this.terminated) {
      this.onerror(error);
    }
  }
}

async function runTests() {
  // =========================================================================
  // 1. WorkerPool Unit Tests
  // =========================================================================
  console.log('Testing WorkerPool:');
  const pool = new WorkerPool({
    maxWorkers: 2,
    idleTimeoutMs: 50
  });

  assert(typeof pool.acquireWorker === 'function', 'WorkerPool provides acquireWorker');
  assert(typeof pool.releaseWorker === 'function', 'WorkerPool provides releaseWorker');
  assert(typeof pool.execute === 'function', 'WorkerPool provides execute');
  assert(typeof pool.terminateAll === 'function', 'WorkerPool provides terminateAll');
  assert(pool.maxWorkers === 2, 'WorkerPool respects maxWorkers constraint');

  // Test WorkerPool task queueing and execution with simulated workers
  const mockW1 = { busy: false, worker: new MockWorker(), id: 'w1' };
  const mockW2 = { busy: false, worker: new MockWorker(), id: 'w2' };
  pool.workers.push(mockW1, mockW2);

  let task1Executed = false;
  let task2Executed = false;
  let task3Executed = false;

  const p1 = pool.execute(async (w) => {
    task1Executed = true;
    return 'task1_done';
  });

  const p2 = pool.execute(async (w) => {
    task2Executed = true;
    return 'task2_done';
  });

  // Task 3 will be queued because maxWorkers is 2
  const p3 = pool.execute(async (w) => {
    task3Executed = true;
    return 'task3_done';
  });

  assert(pool.taskQueue.length === 1, 'WorkerPool queues task 3 when pool is saturated');

  const [res1, res2] = await Promise.all([p1, p2]);
  assert(res1 === 'task1_done' && task1Executed, 'Task 1 completed via pool worker');
  assert(res2 === 'task2_done' && task2Executed, 'Task 2 completed via pool worker');

  const res3 = await p3;
  assert(res3 === 'task3_done' && task3Executed, 'Task 3 dequeued and completed once worker freed');

  // Test cancellation in WorkerPool
  const ac = new AbortController();
  const cancelPromise = pool.execute(async (w) => {
    await new Promise(r => setTimeout(r, 100));
  }, ac.signal);

  ac.abort();
  let caughtPoolCancel = false;
  try {
    await cancelPromise;
  } catch (err) {
    if (err.code === 'CANCELLED') caughtPoolCancel = true;
  }
  assert(caughtPoolCancel, 'WorkerPool execute rejects with CANCELLED on AbortSignal');

  pool.terminateAll();
  assert(pool.workers.length === 0, 'WorkerPool terminateAll clears all workers');
  assert(pool.taskQueue.length === 0, 'WorkerPool terminateAll clears task queue');

  // =========================================================================
  // 2. ImageWorkerClient Message Protocol & Lifecycle Tests
  // =========================================================================
  console.log('Testing ImageWorkerClient:');
  const client = new ImageWorkerClient();
  const mockWorker = new MockWorker();

  // Inject mock worker into client using setWorker so listeners are hooked
  client.setWorker(mockWorker);

  assert(typeof ImageWorkerClient.isSupported === 'function', 'ImageWorkerClient provides isSupported');

  // Test successful image conversion with progress messages
  const sampleFile = new MockFile('photo.png', 5000, 'image/png');
  const progressReports = [];

  const convertPromise = client.convert(sampleFile, {
    outputFormat: 'jpg',
    quality: 0.85,
    width: 640,
    height: 480,
    onProgress: (pct, msg) => {
      progressReports.push({ pct, msg });
    }
  });

  // Await arrayBuffer reading to complete
  await new Promise(r => setTimeout(r, 10));

  assert(mockWorker.postedMessages.length === 1, 'Client posted CONVERT message to worker');
  const postedData = mockWorker.postedMessages[0].message;
  assert(postedData.type === 'CONVERT', 'Message type is CONVERT');
  assert(postedData.payload.outputFormat === 'jpg', 'Payload contains target outputFormat');
  assert(postedData.payload.quality === 0.85, 'Payload contains requested quality');
  assert(postedData.payload.width === 640, 'Payload contains requested width');

  const jobId = postedData.id;
  assert(client.activeJobs.has(jobId), 'Client records active job in tracking map');

  // Simulate progress events from worker
  mockWorker.simulateMessage({
    id: jobId,
    type: 'PROGRESS',
    payload: { percent: 15, message: 'Worker: Decoding image bitmap' }
  });
  mockWorker.simulateMessage({
    id: jobId,
    type: 'PROGRESS',
    payload: { percent: 60, message: 'Worker: Rendering on OffscreenCanvas' }
  });

  assert(progressReports.length === 3, 'onProgress received buffer prep and worker progress events');
  assert(progressReports[1].pct === 15, 'Progress reported 15%');
  assert(progressReports[2].pct === 60, 'Progress reported 60%');

  // Simulate SUCCESS response from worker with transferred ArrayBuffer
  const fakeJpgBuffer = new Uint8Array([255, 216, 255, 224, 0, 16]).buffer;
  mockWorker.simulateMessage({
    id: jobId,
    type: 'SUCCESS',
    payload: {
      outputBuffer: fakeJpgBuffer,
      mimeType: 'image/jpeg',
      filename: 'photo.jpg',
      width: 640,
      height: 480,
      originalWidth: 1280,
      originalHeight: 960
    }
  });

  const conversionResult = await convertPromise;
  assert(conversionResult.mimeType === 'image/jpeg', 'Result contains image/jpeg MIME type');
  assert(conversionResult.filename === 'photo.jpg', 'Result contains generated photo.jpg filename');
  assert(conversionResult.width === 640, 'Result contains target width');
  assert(conversionResult.height === 480, 'Result contains target height');
  assert(conversionResult.blob && typeof conversionResult.blob.size === 'number' && conversionResult.blob.size > 0, 'Result blob reconstructed from transferred buffer');
  assert(client.activeJobs.size === 0, 'Active jobs cleaned up on completion (no memory leak)');

  // =========================================================================
  // 3. Worker Error Handling Tests
  // =========================================================================
  console.log('Testing Worker Error Handling:');
  const errorWorker = new MockWorker();
  client.setWorker(errorWorker);

  const failedPromise = client.convert(sampleFile, {
    outputFormat: 'webp'
  });

  await new Promise(r => setTimeout(r, 10));

  assert(errorWorker.postedMessages.length === 1, 'ErrorWorker received message');
  const errJobId = errorWorker.postedMessages[0].message.id;

  // Simulate worker returning conversion error
  errorWorker.simulateMessage({
    id: errJobId,
    type: 'ERROR',
    payload: {
      message: 'Worker could not decode image: Corrupted header',
      code: 'CORRUPTED_FILE'
    }
  });

  let caughtError = null;
  try {
    await failedPromise;
  } catch (err) {
    caughtError = err;
  }

  assert(caughtError !== null, 'Client rejected promise on worker error');
  assert(caughtError instanceof ConversionError, 'Rejected error is instance of ConversionError');
  assert(caughtError.code === 'CORRUPTED_FILE', 'Error code preserved as CORRUPTED_FILE');
  assert(client.activeJobs.size === 0, 'Active job cleaned up after error');

  // Test worker crash (onerror event)
  const crashWorker = new MockWorker();
  client.setWorker(crashWorker);

  const crashPromise = client.convert(sampleFile, { outputFormat: 'png' });
  await new Promise(r => setTimeout(r, 10));
  assert(client.activeJobs.size === 1, 'Job queued before crash');

  crashWorker.simulateError(new Error('Out of memory inside Web Worker'));

  let caughtCrash = null;
  try {
    await crashPromise;
  } catch (err) {
    caughtCrash = err;
  }

  assert(caughtCrash !== null, 'Client caught worker crash');
  assert(caughtCrash.code === 'WORKER_CRASH', 'Worker crash rejected with WORKER_CRASH code');
  assert(crashWorker.terminated === true, 'Crashed worker was immediately terminated');
  assert(client.worker === null, 'Client worker reference reset after crash');
  assert(client.activeJobs.size === 0, 'Active jobs cleaned up after crash');

  // =========================================================================
  // 4. Worker Cancellation & Resource Cleanup Tests
  // =========================================================================
  console.log('Testing Cancellation & Resource Cleanup:');
  const cancelWorker = new MockWorker();
  client.setWorker(cancelWorker);

  const cancelController = new AbortController();
  const cancellablePromise = client.convert(sampleFile, {
    outputFormat: 'png',
    signal: cancelController.signal
  });

  await new Promise(r => setTimeout(r, 10));
  assert(client.activeJobs.size === 1, 'Job active prior to cancellation');

  // Trigger abort
  cancelController.abort();

  let caughtWorkerCancel = false;
  try {
    await cancellablePromise;
  } catch (err) {
    if (err.code === 'CANCELLED') caughtWorkerCancel = true;
  }

  assert(caughtWorkerCancel, 'Client rejected conversion with CANCELLED code on abort');
  assert(cancelWorker.terminated === true, 'Busy worker immediately terminated on abort to free CPU/RAM');
  assert(client.activeJobs.size === 0, 'Active jobs cleaned up on cancellation');

  // Test manual terminate() and cleanup()
  const testWorker = new MockWorker();
  client.setWorker(testWorker);
  client.cleanup();
  assert(testWorker.terminated === true, 'client.cleanup() terminated idle worker');
  assert(client.worker === null, 'client.worker is null after cleanup');

  // =========================================================================
  // 5. ImageConverter Worker Integration Tests
  // =========================================================================
  console.log('Testing ImageConverter Integration with Workers:');
  const imageConverter = new ImageConverter();

  assert(imageConverter.workerClient instanceof ImageWorkerClient, 'ImageConverter initializes ImageWorkerClient');
  assert(typeof imageConverter.cleanupWorker === 'function', 'ImageConverter provides cleanupWorker');
  assert(typeof imageConverter.terminateWorker === 'function', 'ImageConverter provides terminateWorker');
  assert(typeof imageConverter.convertOnMainThread === 'function', 'ImageConverter provides convertOnMainThread fallback');

  // Mock worker client inside ImageConverter to verify worker delegation
  let workerConvertCalled = false;
  imageConverter.workerClient = {
    convert: async (file, options) => {
      workerConvertCalled = true;
      options.onProgress?.(50, 'Worker processing');
      return {
        blob: new MockBlob(['worker-result-bytes'], { type: 'image/webp' }),
        mimeType: 'image/webp',
        filename: 'test.webp',
        width: 800,
        height: 600,
        originalWidth: 800,
        originalHeight: 600
      };
    },
    cleanup: () => {},
    terminate: () => {}
  };

  // Mock ImageWorkerClient.isSupported to return true
  const originalIsSupported = ImageWorkerClient.isSupported;
  ImageWorkerClient.isSupported = () => true;

  const convResult = await imageConverter.convert(sampleFile, {
    outputFormat: 'webp',
    preferWorker: true
  });

  assert(workerConvertCalled, 'imageConverter.convert() delegated heavy conversion to worker');
  assert(convResult.filename === 'test.webp', 'Result filename matches worker output');
  assert(convResult.mimeType === 'image/webp', 'Result mimeType matches worker output');

  // Test preferWorker: false falls back to convertOnMainThread
  let mainThreadCalled = false;
  imageConverter.convertOnMainThread = async () => {
    mainThreadCalled = true;
    return {
      blob: new MockBlob(['main-thread-bytes'], { type: 'image/png' }),
      mimeType: 'image/png',
      filename: 'main.png',
      width: 100,
      height: 100
    };
  };

  const mainResult = await imageConverter.convert(sampleFile, {
    outputFormat: 'png',
    preferWorker: false
  });

  assert(mainThreadCalled, 'preferWorker: false routed directly to convertOnMainThread');
  assert(mainResult.filename === 'main.png', 'Main thread result returned');

  // Test fallback if worker throws unexpected non-cancel error
  workerConvertCalled = false;
  mainThreadCalled = false;
  imageConverter.workerClient.convert = async () => {
    workerConvertCalled = true;
    throw new Error('Worker execution failed unexpectedly');
  };

  const fallbackResult = await imageConverter.convert(sampleFile, {
    outputFormat: 'png',
    preferWorker: true
  });

  assert(workerConvertCalled, 'Worker attempted first');
  assert(mainThreadCalled, 'Gracefully fell back to convertOnMainThread when worker encountered issue');
  assert(fallbackResult.filename === 'main.png', 'Fallback result returned smoothly');

  // Test that cancellation from worker is NEVER fallen back to main thread
  workerConvertCalled = false;
  mainThreadCalled = false;
  imageConverter.workerClient.convert = async () => {
    workerConvertCalled = true;
    throw new ConversionError('User cancelled', 'CANCELLED');
  };

  let caughtCancelledInConverter = false;
  try {
    await imageConverter.convert(sampleFile, { outputFormat: 'png' });
  } catch (err) {
    if (err.code === 'CANCELLED') caughtCancelledInConverter = true;
  }

  assert(caughtCancelledInConverter, 'Cancellation from worker rethrown immediately');
  assert(mainThreadCalled === false, 'Main thread was NOT executed when worker cancelled');

  // Restore ImageWorkerClient.isSupported
  ImageWorkerClient.isSupported = originalIsSupported;

  // =========================================================================
  // 6. ConverterManager Integration with Worker-Backed Converter
  // =========================================================================
  console.log('Testing ConverterManager Integration:');
  const manager = new ConverterManager();
  manager.registerConverter(imageConverter);

  const resolved = manager.getConverter('png', 'webp');
  assert(resolved === imageConverter, 'Manager resolves worker-backed ImageConverter');

  // Clean terminate worker through manager / converter
  imageConverter.terminateWorker();
  imageConverter.cleanupWorker();
  assert(true, 'Worker cleanup and termination completed with zero errors');

  console.log('--- Phase 8 Test Run Completed Successfully ---');
}

runTests().catch(err => {
  console.error('Phase 8 Test Suite Failed:', err);
  process.exitCode = 1;
});
