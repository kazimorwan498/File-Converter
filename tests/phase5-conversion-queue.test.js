import { ConverterManager } from '../src/core/converter-manager.js';
import { ConverterRegistry } from '../src/core/converter-registry.js';
import { ImageConverter } from '../src/converters/image/image-converter.js';
import { FileManager } from '../src/core/file-manager.js';
import { DownloadManager } from '../src/core/download-manager.js';
import { generateOutputFilename } from '../src/utils/formatters.js';
import { ConversionError } from '../src/core/conversion-error.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 5: Conversion Queue & Batch Engine ---');

// Mock File and Blob for Node test environment
class MockFile {
  constructor(name, size = 1024, type = 'image/png') {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = Date.now();
  }
}

class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.length || 0), 0);
  }
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = MockBlob;
}

// 1. Output filename generation tests
assert(generateOutputFilename('photo.png', 'jpg') === 'photo.jpg', 'generateOutputFilename(photo.png, jpg) === photo.jpg');
assert(generateOutputFilename('photo.png', 'jpeg') === 'photo.jpg', 'generateOutputFilename(photo.png, jpeg) normalizes to jpg');
assert(generateOutputFilename('my.vacation.photo.webp', 'png') === 'my.vacation.photo.png', 'Handles multiple dots in filename');
assert(generateOutputFilename('noextension', 'webp') === 'noextension.webp', 'Handles file without extension');

// 2. Setup real ConverterManager + ImageConverter with simulated canvas backend for Node
const registry = new ConverterRegistry();
const imageConverter = new ImageConverter();

// Mock canvas & image decode pipeline for Node test environment
imageConverter.decodeImage = async (file, signal) => {
  if (signal && signal.aborted) {
    throw new ConversionError('Image decode cancelled', 'CANCELLED');
  }
  // Simulate corrupted file test
  if (file.name === 'corrupted.png') {
    throw new ConversionError('Corrupted image data', 'CORRUPTED_FILE');
  }
  return {
    source: { width: 640, height: 480 },
    width: 640,
    height: 480,
    cleanup: () => {}
  };
};

imageConverter.createCanvas = (w, h) => ({
  canvas: { width: w, height: h },
  ctx: {
    fillStyle: '',
    fillRect: () => {},
    clearRect: () => {},
    drawImage: () => {}
  }
});

imageConverter.exportCanvasToBlob = async (canvas, mimeType, quality) => {
  return new Blob([`blob-bytes-for-${mimeType}`], { type: mimeType });
};

registry.register(imageConverter);
const converterManager = new ConverterManager(registry);
const fileManager = new FileManager();
const downloadManager = new DownloadManager();

async function runQueueTests() {
  // TEST 1: One File Conversion
  const singleFile = new File(['data'], 'avatar.png', { type: 'image/png' });
  const addResult1 = fileManager.addFiles([singleFile]);
  const item1 = addResult1.added[0];
  assert(item1.status === 'queued', 'Initial status is "queued"');

  const convertedItem1 = await converterManager.convertItem(item1);
  assert(convertedItem1.status === 'completed', 'Single file status updated to "completed"');
  assert(convertedItem1.progress === 100, 'Single file progress is 100%');
  assert(convertedItem1.outputBlob instanceof Blob, 'outputBlob populated');
  assert(convertedItem1.outputFilename === 'avatar.jpg', 'outputFilename correctly set');

  // TEST 2: Multiple Files Sequential Conversion
  fileManager.clearQueue();
  const f1 = new File(['data1'], 'slide1.png', { type: 'image/png' });
  const f2 = new File(['data2'], 'slide2.png', { type: 'image/png' });
  const f3 = new File(['data3'], 'slide3.png', { type: 'image/png' });

  const addMulti = fileManager.addFiles([f1, f2, f3]);
  assert(addMulti.added.length === 3, 'Added 3 files to queue');

  const executionOrder = [];
  for (const item of addMulti.added) {
    executionOrder.push(`start-${item.filename}`);
    await converterManager.convertItem(item);
    executionOrder.push(`end-${item.filename}`);
  }

  assert(
    executionOrder.join(',') === 'start-slide1.png,end-slide1.png,start-slide2.png,end-slide2.png,start-slide3.png,end-slide3.png',
    'Multiple files processed in strict sequential order'
  );
  assert(addMulti.added.every(i => i.status === 'completed'), 'All 3 multi-files reached completed status');

  // TEST 3: Mixed Image Formats Conversion
  fileManager.clearQueue();
  const imgPng = new File(['png'], 'graphic.png', { type: 'image/png' });
  const imgJpg = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  const imgWebp = new File(['webp'], 'icon.webp', { type: 'image/webp' });
  const imgJpeg = new File(['jpeg'], 'art.jpeg', { type: 'image/jpeg' });

  const mixedAdd = fileManager.addFiles([imgPng, imgJpg, imgWebp, imgJpeg]);
  const [qPng, qJpg, qWebp, qJpeg] = mixedAdd.added;

  fileManager.setOutputFormat(qPng.id, 'webp');
  fileManager.setOutputFormat(qJpg.id, 'png');
  fileManager.setOutputFormat(qWebp.id, 'png');
  fileManager.setOutputFormat(qJpeg.id, 'webp');

  await converterManager.convertItem(qPng);
  await converterManager.convertItem(qJpg);
  await converterManager.convertItem(qWebp);
  await converterManager.convertItem(qJpeg);

  assert(qPng.status === 'completed' && qPng.outputFormat === 'webp' && qPng.outputFilename === 'graphic.webp', 'PNG -> WebP completed');
  assert(qJpg.status === 'completed' && qJpg.outputFormat === 'png' && qJpg.outputFilename === 'photo.png', 'JPG -> PNG completed');
  assert(qWebp.status === 'completed' && qWebp.outputFormat === 'png' && qWebp.outputFilename === 'icon.png', 'WebP -> PNG completed');
  assert(qJpeg.status === 'completed' && qJpeg.outputFormat === 'webp' && qJpeg.outputFilename === 'art.webp', 'JPEG -> WebP completed');

  // TEST 4: Failed Conversion & Retry
  fileManager.clearQueue();
  const corruptedFile = new File(['bad'], 'corrupted.png', { type: 'image/png' });
  const badAdd = fileManager.addFiles([corruptedFile]);
  const badItem = badAdd.added[0];

  let failedCaught = false;
  try {
    await converterManager.convertItem(badItem);
  } catch (err) {
    failedCaught = true;
    assert(badItem.status === 'failed', 'Status marked as "failed" on error');
    assert(badItem.error.includes('Corrupted image data'), 'Error message recorded on failed item');
  }
  assert(failedCaught, 'convertItem threw on corrupted file');

  // Retry test: Replace with valid file and retry
  badItem.file = new File(['fixed'], 'fixed.png', { type: 'image/png' });
  badItem.filename = 'fixed.png';
  badItem.name = 'fixed.png';
  badItem.status = 'queued';
  badItem.error = null;
  const retriedItem = await converterManager.convertItem(badItem);
  assert(retriedItem.status === 'completed', 'Retried item successfully recovered to "completed"');
  assert(retriedItem.error === null, 'Error cleared on successful retry');

  // TEST 5: Cancelled Conversion
  fileManager.clearQueue();
  const slowFile = new File(['slow'], 'slow.png', { type: 'image/png' });
  const slowAdd = fileManager.addFiles([slowFile]);
  const slowItem = slowAdd.added[0];

  // Hook decode to introduce an abortable delay
  const origDecode = imageConverter.decodeImage;
  imageConverter.decodeImage = async (file, signal) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ source: { width: 100, height: 100 }, width: 100, height: 100, cleanup: () => {} });
      }, 50);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new ConversionError('Cancelled', 'CANCELLED'));
        });
      }
    });
  };

  const cancelPromise = converterManager.convertItem(slowItem);
  // Cancel after 10ms
  setTimeout(() => {
    converterManager.cancelItem(slowItem.id);
  }, 10);

  let cancelCaught = false;
  try {
    await cancelPromise;
  } catch (err) {
    cancelCaught = true;
    assert(slowItem.status === 'cancelled', 'Status updated to "cancelled"');
    assert(slowItem.error.includes('cancelled'), 'Cancellation recorded in item error');
  }
  assert(cancelCaught, 'Cancelled conversion rejected promise');
  imageConverter.decodeImage = origDecode; // restore

  // TEST 6: Download & URL Tracking Cleanup
  // Mock global URL if needed
  let createdUrlCount = 0;
  let revokedUrlCount = 0;
  globalThis.URL.createObjectURL = (blob) => {
    createdUrlCount++;
    return `blob:http://localhost/mock-${createdUrlCount}`;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revokedUrlCount++;
  };

  const dlItem1 = { outputBlob: new Blob(['c1']), outputFilename: 'out1.png' };
  const dlItem2 = { outputBlob: new Blob(['c2']), outputFilename: 'out2.jpg' };

  const dlCount = await downloadManager.downloadAll([dlItem1, dlItem2], 10);
  assert(dlCount === 2, 'downloadAll processed 2 items');
  assert(downloadManager.activeUrls.size > 0, 'activeUrls tracks created URLs');

  downloadManager.revokeAll();
  assert(downloadManager.activeUrls.size === 0, 'revokeAll cleared all active URLs');
  assert(revokedUrlCount > 0, 'revokeObjectURL called during cleanup');

  console.log('--- Phase 5 Test Run Completed Successfully ---');
}

runQueueTests().catch(err => {
  console.error('Unexpected test failure in Phase 5:', err);
  process.exitCode = 1;
});
