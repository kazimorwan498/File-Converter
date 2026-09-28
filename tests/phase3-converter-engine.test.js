import { BaseConverter } from '../src/core/base-converter.js';
import { ConverterRegistry } from '../src/core/converter-registry.js';
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

console.log('--- Testing Phase 3: Converter Architecture & Engine ---');

// Mock File and Blob for Node.js environment
class MockFile {
  constructor(name, size = 1024, type = 'text/plain') {
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

/**
 * ARCHITECTURE TEST IMPLEMENTATION ONLY — NOT A REAL CONVERTER
 * Used exclusively to verify registry, manager, progress, and cancellation contracts.
 */
class ArchitectureTestMockConverter extends BaseConverter {
  constructor() {
    super({
      id: 'mock-test-text-converter',
      name: 'Architecture Test Mock Converter (TEST ONLY)',
      description: 'Test implementation to validate lifecycle, progress, and abort signals',
      inputFormats: ['txt', 'md'],
      outputFormats: ['html', 'txt'],
      inputMimeTypes: ['text/plain', 'text/markdown']
    });
    this.wasCancelled = false;
  }

  async convert(file, options = {}) {
    const { outputFormat, signal, onProgress } = options;

    if (signal && signal.aborted) {
      throw new Error('Aborted before start');
    }

    onProgress?.(10, 'Reading mock source');

    // Simulate async phase 1
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 30);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          this.wasCancelled = true;
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });

    onProgress?.(50, 'Transforming mock content');

    // Simulate async phase 2
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 30);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          this.wasCancelled = true;
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });

    onProgress?.(90, 'Packaging mock output');

    return {
      blob: new Blob(['<h1>Mock Converted Output</h1>'], { type: 'text/html' }),
      mimeType: 'text/html',
      filename: `${file.name.replace(/\.[^/.]+$/, '')}.${outputFormat}`
    };
  }

  cancel() {
    this.wasCancelled = true;
  }
}

// 1. BaseConverter interface tests
try {
  new BaseConverter({});
  assert(false, 'BaseConverter throws when id/name are missing');
} catch (e) {
  assert(true, 'BaseConverter enforces id and name presence');
}

const mockConverter = new ArchitectureTestMockConverter();
assert(mockConverter.id === 'mock-test-text-converter', 'Converter has valid ID');
assert(mockConverter.inputFormats.includes('txt') && mockConverter.inputFormats.includes('md'), 'Input formats stored');
assert(mockConverter.outputFormats.includes('html') && mockConverter.outputFormats.includes('txt'), 'Output formats stored');

const testTxtFile = new File(['mock notes content'], 'notes.txt', { type: 'text/plain' });
assert(mockConverter.canConvert(testTxtFile, 'html') === true, 'canConvert returns true for txt -> html');
assert(mockConverter.canConvert(testTxtFile, 'txt') === true, 'canConvert returns true for txt -> txt');
assert(mockConverter.canConvert(testTxtFile, 'png') === false, 'canConvert returns false for txt -> png');
assert(mockConverter.canConvert('image.png', 'jpg') === false, 'canConvert returns false for unsupported input');

const outputs = mockConverter.getAvailableOutputs(testTxtFile);
assert(outputs.includes('html') && outputs.includes('txt'), 'getAvailableOutputs returns correct targets');

// 2. ConverterRegistry tests
const registry = new ConverterRegistry();
assert(registry.getAll().length === 0, 'Registry initializes empty');

try {
  registry.register({});
  assert(false, 'Registry rejects invalid converter object');
} catch (e) {
  assert(true, 'Registry validates converter interface before registering');
}

registry.register(mockConverter);
assert(registry.getAll().length === 1, 'Converter successfully registered');
assert(registry.get('mock-test-text-converter') === mockConverter, 'get() retrieves converter by ID');
assert(registry.hasConverterFor('doc.md', 'html') === true, 'hasConverterFor returns true for registered pair');
assert(registry.hasConverterFor('doc.md', 'mp3') === false, 'hasConverterFor returns false for missing pair');

const foundConverter = registry.findConverter(testTxtFile, 'html');
assert(foundConverter === mockConverter, 'findConverter returns matching converter instance');

const aggOutputs = registry.getAvailableOutputs('readme.md');
assert(aggOutputs.includes('html') && aggOutputs.includes('txt'), 'getAvailableOutputs aggregates from registry');

// 3. ConverterManager tests
const manager = new ConverterManager(registry);

assert(manager.detectInputFormat('archive.tar.gz') === 'gz', 'detectInputFormat handles multi-dot filename');
assert(manager.detectInputFormat(testTxtFile) === 'txt', 'detectInputFormat handles File object');
assert(manager.canConvert(testTxtFile, 'html') === true, 'manager.canConvert returns true for supported pair');
assert(manager.canConvert(testTxtFile, 'webp') === false, 'manager.canConvert returns false for unsupported pair');

// 4. Test error handling when no converter is found
async function runAsyncTests() {
  let noConverterCaught = false;
  try {
    await manager.convert(testTxtFile, { outputFormat: 'mp4' });
  } catch (err) {
    noConverterCaught = true;
    assert(err instanceof ConversionError, 'Thrown error is ConversionError');
    assert(err.code === 'NO_CONVERTER', 'Error code is NO_CONVERTER');
  }
  assert(noConverterCaught, 'convert() threw for unregistered conversion pair');

  // 5. Test successful conversion with progress callback
  const progressReports = [];
  const result = await manager.convert(testTxtFile, {
    outputFormat: 'html',
    onProgress: (pct, stage) => {
      progressReports.push({ pct, stage });
    }
  });

  assert(result && result.blob instanceof Blob, 'Conversion returned valid Blob');
  assert(result.mimeType === 'text/html', 'Result mimeType is correct');
  assert(result.filename === 'notes.html', 'Result filename extension correctly updated');
  assert(typeof result.durationMs === 'number', 'Result duration recorded');
  assert(progressReports.length > 0, 'Progress events fired');
  assert(progressReports[0].pct === 0, 'Progress started at 0%');
  assert(progressReports[progressReports.length - 1].pct === 100, 'Progress finished at 100%');

  // 6. Test convertItem queue item lifecycle (queued -> preparing -> converting -> completed)
  const queueItem = {
    id: 'item_test_1',
    file: testTxtFile,
    name: 'notes.txt',
    filename: 'notes.txt',
    outputFormat: 'html',
    status: 'queued',
    progress: 0,
    outputBlob: null,
    error: null
  };

  const updatedItem = await manager.convertItem(queueItem);
  assert(updatedItem.status === 'completed', 'Queue item status updated to "completed"');
  assert(updatedItem.progress === 100, 'Queue item progress updated to 100');
  assert(updatedItem.outputBlob instanceof Blob, 'Queue item outputBlob populated');
  assert(updatedItem.outputFilename === 'notes.html', 'Queue item outputFilename populated');
  assert(updatedItem.error === null, 'Queue item error remains null on success');

  // 7. Test cancellation interface
  const cancellableItem = {
    id: 'item_cancel_test',
    file: testTxtFile,
    name: 'notes.txt',
    filename: 'notes.txt',
    outputFormat: 'html',
    status: 'queued',
    progress: 0,
    outputBlob: null,
    error: null
  };

  // Launch conversion and immediately trigger cancellation
  const conversionPromise = manager.convertItem(cancellableItem);
  assert(manager.isConverting('item_cancel_test') === true, 'isConverting is true while running');

  // Cancel conversion after 15ms (in between the mock async steps)
  setTimeout(() => {
    const cancelled = manager.cancelItem('item_cancel_test');
    assert(cancelled === true, 'cancelItem returned true');
  }, 15);

  let cancellationCaught = false;
  try {
    await conversionPromise;
  } catch (err) {
    cancellationCaught = true;
    assert(err.code === 'CANCELLED', 'Caught error code is CANCELLED');
    assert(cancellableItem.status === 'cancelled', 'Queue item status set to "cancelled"');
    assert(cancellableItem.error.includes('cancelled'), 'Queue item error indicates cancellation');
  }
  assert(cancellationCaught, 'Cancelled conversion threw CANCELLED error');
  assert(manager.isConverting('item_cancel_test') === false, 'isConverting is false after cancellation');

  // 8. Test cancelAll()
  const c1 = { id: 'item_c1', file: testTxtFile, outputFormat: 'html', status: 'queued', progress: 0 };
  const c2 = { id: 'item_c2', file: testTxtFile, outputFormat: 'html', status: 'queued', progress: 0 };
  const p1 = manager.convertItem(c1).catch(e => e);
  const p2 = manager.convertItem(c2).catch(e => e);

  const countCancelled = manager.cancelAll();
  assert(countCancelled === 2, 'cancelAll cancelled both running conversions');
  await Promise.all([p1, p2]);
  assert(c1.status === 'cancelled' && c2.status === 'cancelled', 'Both items transitioned to "cancelled"');

  console.log('--- Phase 3 Test Run Completed Successfully ---');
}

runAsyncTests().catch(err => {
  console.error('Unexpected test failure:', err);
  process.exitCode = 1;
});
