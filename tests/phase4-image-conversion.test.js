import { ImageConverter } from '../src/converters/image/image-converter.js';
import { ConversionError } from '../src/core/conversion-error.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 4: Browser-Native Image Conversion ---');

// Mock File and Blob for Node.js test environment
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

// 1. Instantiate ImageConverter
const converter = new ImageConverter();
assert(converter.id === 'native-image-converter', 'Converter has id "native-image-converter"');
assert(converter.name === 'Browser-Native Image Converter', 'Converter has human-readable name');

// 2. Verify all 8 required conversion pairs via canConvert()
const conversionsToTest = [
  { from: 'test.png', to: 'jpg', expected: true, label: 'PNG -> JPG' },
  { from: 'test.png', to: 'webp', expected: true, label: 'PNG -> WebP' },
  { from: 'test.jpg', to: 'png', expected: true, label: 'JPG -> PNG' },
  { from: 'test.jpg', to: 'webp', expected: true, label: 'JPG -> WebP' },
  { from: 'test.jpeg', to: 'png', expected: true, label: 'JPEG -> PNG' },
  { from: 'test.jpeg', to: 'webp', expected: true, label: 'JPEG -> WebP' },
  { from: 'test.webp', to: 'png', expected: true, label: 'WebP -> PNG' },
  { from: 'test.webp', to: 'jpg', expected: true, label: 'WebP -> JPG' },
  { from: 'test.webp', to: 'jpeg', expected: true, label: 'WebP -> JPEG' }
];

for (const { from, to, expected, label } of conversionsToTest) {
  const result = converter.canConvert(from, to);
  assert(result === expected, `canConvert supports ${label}`);
}

// Check unsupported target
assert(converter.canConvert('test.png', 'pdf') === false, 'canConvert rejects PNG -> PDF');
assert(converter.canConvert('test.png', 'mp3') === false, 'canConvert rejects PNG -> MP3');

// 3. Verify MIME type mappings
assert(converter.getMimeType('jpg') === 'image/jpeg', 'getMimeType("jpg") === "image/jpeg"');
assert(converter.getMimeType('jpeg') === 'image/jpeg', 'getMimeType("jpeg") === "image/jpeg"');
assert(converter.getMimeType('webp') === 'image/webp', 'getMimeType("webp") === "image/webp"');
assert(converter.getMimeType('png') === 'image/png', 'getMimeType("png") === "image/png"');

// 4. Verify alpha support detection
assert(converter.supportsAlpha('png') === true, 'PNG supports alpha transparency');
assert(converter.supportsAlpha('webp') === true, 'WebP supports alpha transparency');
assert(converter.supportsAlpha('jpg') === false, 'JPG does NOT support alpha transparency');
assert(converter.supportsAlpha('jpeg') === false, 'JPEG does NOT support alpha transparency');

// 5. Test real conversion execution with mocked Canvas / Image decoding pipeline in Node
async function runConversionExecutionTests() {
  let fillRectCalledWith = null;
  let clearRectCalledWith = null;
  let drawImageArgs = null;
  let exportedQuality = null;
  let exportedMime = null;

  // Mock decodeImage to return synthetic 800x600 image source
  converter.decodeImage = async (file, signal) => {
    if (signal && signal.aborted) {
      throw new ConversionError('Cancelled', 'CANCELLED');
    }
    return {
      source: { type: 'MockImageSource', width: 800, height: 600 },
      width: 800,
      height: 600,
      cleanup: () => {}
    };
  };

  // Mock createCanvas to simulate 2D context
  converter.createCanvas = (width, height) => {
    return {
      canvas: { width, height },
      ctx: {
        fillStyle: '',
        fillRect: (x, y, w, h) => {
          fillRectCalledWith = { x, y, w, h, fillStyle: converter.lastFillStyle };
        },
        clearRect: (x, y, w, h) => {
          clearRectCalledWith = { x, y, w, h };
        },
        drawImage: (source, x, y, w, h) => {
          drawImageArgs = { source, x, y, w, h };
        }
      }
    };
  };

  // Mock exportCanvasToBlob
  converter.exportCanvasToBlob = async (canvas, mimeType, quality) => {
    exportedMime = mimeType;
    exportedQuality = quality;
    return new Blob([`fake-image-bytes-for-${mimeType}`], { type: mimeType });
  };

  // TEST 1: PNG -> JPG (Lossy, white background for transparency, quality control)
  const pngFile = new File(['pngdata'], 'banner.png', { type: 'image/png' });
  const progressList = [];

  const resJpg = await converter.convert(pngFile, {
    outputFormat: 'jpg',
    quality: 0.85,
    backgroundColor: '#ffffff',
    onProgress: (p, stage) => progressList.push({ p, stage })
  });

  assert(resJpg.filename === 'banner.jpg', 'Output filename is banner.jpg');
  assert(resJpg.mimeType === 'image/jpeg', 'Output MIME is image/jpeg');
  assert(resJpg.width === 800 && resJpg.height === 600, 'Dimensions preserved at 800x600');
  assert(fillRectCalledWith !== null, 'White background filled for JPG transparency handling');
  assert(exportedQuality === 0.85, 'Quality 0.85 passed to export');
  assert(progressList.length > 0 && progressList[progressList.length - 1].p === 100, 'Progress reported up to 100%');

  // TEST 2: PNG -> WebP (Alpha preserved, quality control)
  clearRectCalledWith = null;
  fillRectCalledWith = null;

  const resWebp = await converter.convert(pngFile, {
    outputFormat: 'webp',
    quality: 0.75
  });

  assert(resWebp.filename === 'banner.webp', 'Output filename is banner.webp');
  assert(resWebp.mimeType === 'image/webp', 'Output MIME is image/webp');
  assert(clearRectCalledWith !== null, 'Canvas cleared transparently for WebP');
  assert(fillRectCalledWith === null, 'No solid background fill for alpha-supporting WebP');
  assert(exportedQuality === 0.75, 'Quality 0.75 passed to WebP export');

  // TEST 3: JPG -> PNG (Lossless, alpha preserved)
  const jpgFile = new File(['jpgdata'], 'scenery.jpg', { type: 'image/jpeg' });
  clearRectCalledWith = null;

  const resPng = await converter.convert(jpgFile, {
    outputFormat: 'png'
  });

  assert(resPng.filename === 'scenery.png', 'Output filename is scenery.png');
  assert(resPng.mimeType === 'image/png', 'Output MIME is image/png');
  assert(clearRectCalledWith !== null, 'Canvas cleared for PNG output');

  // TEST 4: Resizing with aspect ratio maintained (width: 400 from 800x600 -> height should be 300)
  const resResized = await converter.convert(jpgFile, {
    outputFormat: 'png',
    width: 400,
    maintainAspectRatio: true
  });

  assert(resResized.width === 400, 'Resized width is 400');
  assert(resResized.height === 300, 'Resized height automatically scaled to 300 (4:3 aspect ratio)');
  assert(resResized.originalWidth === 800, 'Original width recorded as 800');
  assert(resResized.originalHeight === 600, 'Original height recorded as 600');

  // TEST 5: Quality clamping (e.g. 1.5 clamped to 1.0, -0.2 clamped to 0.01)
  await converter.convert(pngFile, { outputFormat: 'jpg', quality: 1.5 });
  assert(exportedQuality === 1.0, 'Quality 1.5 clamped to 1.0');

  await converter.convert(pngFile, { outputFormat: 'jpg', quality: -0.5 });
  assert(exportedQuality === 0.01, 'Quality -0.5 clamped to minimum 0.01');

  // TEST 6: Cancellation via AbortSignal
  const controller = new AbortController();
  controller.abort();

  let cancelledCaught = false;
  try {
    await converter.convert(pngFile, { outputFormat: 'jpg', signal: controller.signal });
  } catch (err) {
    cancelledCaught = true;
    assert(err.code === 'CANCELLED', 'Cancellation throws CANCELLED error code');
  }
  assert(cancelledCaught, 'Cancelled conversion was aborted');

  // TEST 7: getImageDimensions helper
  const dims = await converter.getImageDimensions(pngFile);
  assert(dims.width === 800 && dims.height === 600, 'getImageDimensions returns width and height');

  console.log('--- Phase 4 Test Run Completed Successfully ---');
}

runConversionExecutionTests().catch(err => {
  console.error('Unexpected test failure in Phase 4:', err);
  process.exitCode = 1;
});
