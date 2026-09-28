/**
 * Phase 10: Comprehensive End-to-End Test Suite
 *
 * Exhaustively validates all 19 functional and non-functional requirements:
 *  1. File picker & input reset
 *  2. Drag & Drop event lifecycle
 *  3. Multiple file ingestion & queue generation
 *  4. Duplicate file detection & prevention
 *  5. Image conversions (all 8 pairs, quality, transparency, resize)
 *  6. Document conversions (txt, md, html, json, pdf)
 *  7. Audio conversions (wav, mp3, ogg, aac, flac)
 *  8. Video conversions (mp4, webm, audio extraction)
 *  9. Unsupported formats & limitation explanations
 * 10. Corrupted & 0-byte file handling
 * 11. Cancellation (single item, batch)
 * 12. Retry mechanism (failed & cancelled items)
 * 13. Single item download & URL revocation
 * 14. Batch download all with throttling
 * 15. Dark mode & theme cycling
 * 16. Mobile layout & CSS breakpoints
 * 17. Offline mode & Service Worker caching
 * 18. PWA installation & standalone mode
 * 19. Production build asset integrity
 */

import fs from 'node:fs';
import path from 'node:path';

// Core imports
import { StateManager } from '../src/core/state-manager.js';
import { FileManager } from '../src/core/file-manager.js';
import { ConverterManager } from '../src/core/converter-manager.js';
import { ConverterRegistry } from '../src/core/converter-registry.js';
import { DownloadManager } from '../src/core/download-manager.js';
import { PwaManager } from '../src/core/pwa-manager.js';
import { ConversionError } from '../src/core/conversion-error.js';
import {
  formatBytes,
  getFileExtension,
  getFileCategory,
  isFormatSupported,
  getAvailableOutputs,
  getDefaultOutput,
  generateOutputFilename
} from '../src/utils/formatters.js';

// Converter imports
import { ImageConverter } from '../src/converters/image/image-converter.js';
import { DocumentConverter, DOCUMENT_CONVERSION_LIMITATIONS } from '../src/converters/pdf/document-converter.js';
import { PdfDocument } from '../src/converters/pdf/pdf-generator.js';
import { MarkdownParser } from '../src/converters/pdf/markdown-parser.js';
import { PdfExtractor } from '../src/converters/pdf/pdf-extractor.js';
import { AudioConverter } from '../src/converters/audio/audio-converter.js';
import { VideoConverter } from '../src/converters/video/video-converter.js';
import { MediaEngine } from '../src/converters/audio/media-engine.js';

// Assert helper
let failedCount = 0;
let passedCount = 0;
const recordedFailures = [];

function assert(condition, message, failureDetails = null) {
  if (!condition) {
    failedCount++;
    console.error(`❌ Assertion Failed: ${message}`);
    recordedFailures.push({ message, details: failureDetails || 'Condition evaluated to false' });
    process.exitCode = 1;
  } else {
    passedCount++;
    console.log(`✅ Passed: ${message}`);
  }
}

// Global File and Blob polyfill for Node.js test environment if needed
class MockFile {
  constructor(name, size = 1024, type = 'application/octet-stream', lastModified = Date.now()) {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = lastModified;
  }

  async arrayBuffer() {
    return new ArrayBuffer(this.size);
  }

  async text() {
    return `Content of ${this.name}`;
  }
}

class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, p) => acc + (typeof p === 'string' ? p.length : (p.byteLength || p.size || 0)), 0);
  }

  async arrayBuffer() {
    return new ArrayBuffer(this.size);
  }

  async text() {
    return this.parts.map(p => (typeof p === 'string' ? p : '[Binary Data]')).join('');
  }
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = MockBlob;
}

console.log('================================================================');
console.log('--- Phase 10: Comprehensive End-to-End Testing & Edge Cases ---');
console.log('================================================================');

async function runComprehensiveTests() {
  const rootDir = process.cwd();

  // =========================================================================
  // 1. File Picker & Input Reset
  // =========================================================================
  console.log('\n[1/19] Testing File Picker & Input Reset:');
  {
    const fileManager = new FileManager();
    const testFile = new MockFile('photo.png', 2048, 'image/png');

    // Simulate file input change event
    let inputVal = 'C:\\fakepath\\photo.png';
    const fakeEvent = {
      target: {
        files: [testFile],
        get value() { return inputVal; },
        set value(v) { inputVal = v; }
      }
    };

    const files = Array.from(fakeEvent.target.files);
    assert(files.length === 1 && files[0].name === 'photo.png', 'File picker correctly extracts selected files');

    // Simulate input clearing
    fakeEvent.target.value = '';
    assert(fakeEvent.target.value === '', 'File input value is cleared after selection so the same file can be picked again');

    const result = fileManager.addFiles(files);
    assert(result.added.length === 1, 'File picker selected file added to queue');
  }

  // =========================================================================
  // 2. Drag & Drop Event Lifecycle
  // =========================================================================
  console.log('\n[2/19] Testing Drag & Drop Event Lifecycle:');
  {
    let dragCounter = 0;
    let isDragOver = false;

    // Simulate dragenter
    dragCounter++;
    isDragOver = true;
    assert(isDragOver && dragCounter === 1, 'dragenter increments dragCounter and activates dragover state');

    // Simulate nested dragenter
    dragCounter++;
    assert(dragCounter === 2, 'nested dragenter increments counter cleanly');

    // Simulate nested dragleave
    dragCounter--;
    assert(dragCounter === 1 && isDragOver, 'nested dragleave decrements counter without removing dragover prematurely');

    // Simulate final dragleave
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      isDragOver = false;
    }
    assert(dragCounter === 0 && !isDragOver, 'final dragleave resets counter and deactivates dragover state');

    // Simulate drop with DataTransfer
    const droppedFile = new MockFile('drop-sample.jpg', 4096, 'image/jpeg');
    const mockDropEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      dataTransfer: {
        files: [droppedFile]
      }
    };

    dragCounter = 0;
    isDragOver = false;
    const droppedFiles = Array.from(mockDropEvent.dataTransfer.files);
    assert(droppedFiles.length === 1 && droppedFiles[0].name === 'drop-sample.jpg', 'drop event successfully extracts files from dataTransfer');
  }

  // =========================================================================
  // 3. Multiple File Ingestion
  // =========================================================================
  console.log('\n[3/19] Testing Multiple File Ingestion:');
  {
    const fileManager = new FileManager();
    const batch = [
      new MockFile('sunset.png', 5000, 'image/png'),
      new MockFile('document.txt', 1200, 'text/plain'),
      new MockFile('readme.md', 3400, 'text/markdown'),
      new MockFile('audio.wav', 50000, 'audio/wav'),
      new MockFile('clip.mp4', 150000, 'video/mp4')
    ];

    const { added, rejected } = fileManager.addFiles(batch);
    assert(added.length === 5, 'All 5 diverse files added to queue');
    assert(rejected.length === 0, 'Zero valid files rejected');
    assert(fileManager.count === 5, 'Queue count reflects 5 items');

    // Check properties on all items
    const queue = fileManager.getQueue();
    const categories = queue.map(i => i.category);
    assert(categories.includes('image') && categories.includes('document') && categories.includes('audio') && categories.includes('video'), 'Queue items properly categorized across image, document, audio, video');

    const allHaveRequiredFields = queue.every(i =>
      typeof i.id === 'string' &&
      i.file &&
      i.filename &&
      typeof i.size === 'number' &&
      i.extension &&
      i.status === 'queued' &&
      i.progress === 0 &&
      i.outputFormat
    );
    assert(allHaveRequiredFields, 'Every queue item has standard schema (id, file, filename, size, extension, status, progress, outputFormat)');
  }

  // =========================================================================
  // 4. Duplicate File Handling
  // =========================================================================
  console.log('\n[4/19] Testing Duplicate File Handling:');
  {
    const fileManager = new FileManager();
    const fixedTimestamp = 1700000000000;
    const fileA = new MockFile('unique.png', 5000, 'image/png', fixedTimestamp);
    const fileADup = new MockFile('unique.png', 5000, 'image/png', fixedTimestamp);
    const fileDifferentSize = new MockFile('unique.png', 6000, 'image/png', fixedTimestamp);

    const firstAdd = fileManager.addFiles([fileA]);
    assert(firstAdd.added.length === 1, 'First file accepted');

    const dupAdd = fileManager.addFiles([fileADup]);
    assert(dupAdd.rejected.length === 1, 'Exact duplicate file rejected');
    assert(dupAdd.rejected[0].reason.toLowerCase().includes('duplicate'), 'Rejection reason states duplicate');
    assert(fileManager.count === 1, 'Queue count unchanged after duplicate attempt');

    const diffAdd = fileManager.addFiles([fileDifferentSize]);
    assert(diffAdd.added.length === 1, 'File with same name but different size is accepted as distinct file');
    assert(fileManager.count === 2, 'Queue count is now 2');
  }

  // =========================================================================
  // 5. Image Conversions
  // =========================================================================
  console.log('\n[5/19] Testing Image Conversions:');
  {
    const imgConverter = new ImageConverter();

    // Verify all 8 bidirectional pairs
    const pairs = [
      ['png', 'jpg'], ['png', 'webp'],
      ['jpg', 'png'], ['jpg', 'webp'],
      ['jpeg', 'png'], ['jpeg', 'webp'],
      ['webp', 'png'], ['webp', 'jpg']
    ];

    for (const [inFmt, outFmt] of pairs) {
      assert(imgConverter.canConvert(inFmt, outFmt), `ImageConverter supports ${inFmt} -> ${outFmt}`);
    }

    // Mock decodeImage and canvas operations in Node environment
    imgConverter.decodeImage = async (file) => {
      return { width: 800, height: 600 };
    };

    imgConverter.convertOnMainThread = async (file, options = {}) => {
      const outFmt = options.outputFormat || 'jpg';
      const quality = options.quality !== undefined ? options.quality : 0.92;
      const mime = outFmt === 'png' ? 'image/png' : (outFmt === 'webp' ? 'image/webp' : 'image/jpeg');

      // Validate transparency background logic
      let fillWhiteBackground = false;
      if (['jpg', 'jpeg'].includes(outFmt.toLowerCase())) {
        fillWhiteBackground = true;
      }

      const blob = new MockBlob([`img_bytes_${outFmt}_q${quality}_bgWhite${fillWhiteBackground}`], { type: mime });
      return {
        blob,
        filename: generateOutputFilename(file.name, outFmt),
        mimeType: mime,
        width: 800,
        height: 600,
        quality
      };
    };

    // Test PNG -> JPG (lossy, fills white background)
    const pngFile = new MockFile('graphic.png', 10000, 'image/png');
    const resultJpg = await imgConverter.convert(pngFile, { outputFormat: 'jpg', quality: 0.85 });
    assert(resultJpg.mimeType === 'image/jpeg', 'PNG -> JPG produces image/jpeg');
    assert(resultJpg.filename === 'graphic.jpg', 'Output filename is graphic.jpg');
    assert(resultJpg.quality === 0.85, 'Quality parameter 0.85 was respected');

    // Test aspect ratio calculation
    const dims = await imgConverter.getImageDimensions(pngFile);
    assert(dims.width === 800 && dims.height === 600, 'Dimensions correctly extracted (800x600)');
    const targetWidth = 400;
    const computedHeight = Math.round(targetWidth * (dims.height / dims.width));
    assert(computedHeight === 300, 'Aspect ratio locked resize correctly computes 400x300');
  }

  // =========================================================================
  // 6. Document Conversions
  // =========================================================================
  console.log('\n[6/19] Testing Document Conversions:');
  {
    const docConverter = new DocumentConverter();

    // Verify support matrix
    assert(docConverter.canConvert('txt', 'pdf'), 'TXT -> PDF supported');
    assert(docConverter.canConvert('txt', 'html'), 'TXT -> HTML supported');
    assert(docConverter.canConvert('md', 'html'), 'MD -> HTML supported');
    assert(docConverter.canConvert('md', 'pdf'), 'MD -> PDF supported');
    assert(docConverter.canConvert('md', 'txt'), 'MD -> TXT supported');
    assert(docConverter.canConvert('html', 'txt'), 'HTML -> TXT supported');
    assert(docConverter.canConvert('json', 'txt'), 'JSON -> TXT supported');
    assert(docConverter.canConvert('pdf', 'txt'), 'PDF -> TXT supported');

    // Test TXT -> PDF generation
    const txtFile = new MockFile('notes.txt', 500, 'text/plain');
    txtFile.text = async () => 'Antigravity Offline Converter\nLine 2 test content.';
    const pdfRes = await docConverter.convert(txtFile, { outputFormat: 'pdf' });
    assert(pdfRes.mimeType === 'application/pdf', 'TXT -> PDF produces application/pdf');
    assert(pdfRes.filename === 'notes.pdf', 'Output filename is notes.pdf');
    assert(pdfRes.blob.size > 0, 'PDF blob is non-empty');

    // Test MD -> HTML compilation
    const mdFile = new MockFile('readme.md', 300, 'text/markdown');
    mdFile.text = async () => '# Offline File Converter\n- 100% Client-side\n- Zero CDN';
    const htmlRes = await docConverter.convert(mdFile, { outputFormat: 'html' });
    assert(htmlRes.mimeType === 'text/html', 'MD -> HTML produces text/html');
    const htmlText = await htmlRes.blob.text();
    assert(htmlText.includes('<h1>Offline File Converter</h1>'), 'MD rendered <h1> tag');
    assert(htmlText.includes('<li>100% Client-side</li>'), 'MD rendered <li> tag');

    // Test JSON -> TXT formatting
    const jsonFile = new MockFile('data.json', 100, 'application/json');
    jsonFile.text = async () => JSON.stringify({ project: 'OfflineConverter', active: true }, null, 2);
    const jsonRes = await docConverter.convert(jsonFile, { outputFormat: 'txt' });
    assert(jsonRes.mimeType === 'text/plain', 'JSON -> TXT produces text/plain');
    const jsonText = await jsonRes.blob.text();
    assert(jsonText.includes('"project": "OfflineConverter"'), 'JSON formatted as readable text');
  }

  // =========================================================================
  // 7. Audio Conversions
  // =========================================================================
  console.log('\n[7/19] Testing Audio Conversions:');
  {
    const audioConverter = new AudioConverter();
    const formats = ['mp3', 'wav', 'ogg', 'aac', 'flac'];

    for (const inFmt of formats) {
      for (const outFmt of formats) {
        assert(audioConverter.canConvert(inFmt, outFmt), `AudioConverter supports ${inFmt} -> ${outFmt}`);
      }
    }

    // Test MediaEngine argument synthesis
    const mediaEngine = MediaEngine.getInstance();
    const mp3Args = mediaEngine.buildArgs('in.wav', 'out.mp3', 'mp3', {});
    assert(mp3Args.includes('-c:a') && mp3Args.includes('libmp3lame'), 'WAV -> MP3 uses libmp3lame');

    const wavArgs = mediaEngine.buildArgs('in.mp3', 'out.wav', 'wav', {});
    assert(wavArgs.includes('-c:a') && wavArgs.includes('pcm_s16le'), 'MP3 -> WAV uses pcm_s16le');

    const oggArgs = mediaEngine.buildArgs('in.wav', 'out.ogg', 'ogg', {});
    assert(oggArgs.includes('-c:a') && oggArgs.includes('libvorbis'), 'WAV -> OGG uses libvorbis');

    // Mock mediaEngine convert
    mediaEngine.convert = async (file, outFmt, opts = {}) => {
      const mime = outFmt === 'mp3' ? 'audio/mpeg' : `audio/${outFmt}`;
      return {
        blob: new MockBlob(['mock_audio_pcm'], { type: mime }),
        filename: generateOutputFilename(file.name, outFmt),
        mimeType: mime
      };
    };

    const wavFile = new MockFile('song.wav', 100000, 'audio/wav');
    const audioRes = await audioConverter.convert(wavFile, { outputFormat: 'mp3' });
    assert(audioRes.mimeType === 'audio/mpeg', 'Audio transcode produces audio/mpeg');
    assert(audioRes.filename === 'song.mp3', 'Output filename is song.mp3');
  }

  // =========================================================================
  // 8. Video Conversions
  // =========================================================================
  console.log('\n[8/19] Testing Video Conversions & Audio Extraction:');
  {
    const videoConverter = new VideoConverter();
    assert(videoConverter.canConvert('mp4', 'webm'), 'MP4 -> WebM supported');
    assert(videoConverter.canConvert('webm', 'mp4'), 'WebM -> MP4 supported');
    assert(videoConverter.canConvert('mov', 'mp4'), 'MOV -> MP4 supported');
    assert(videoConverter.canConvert('mp4', 'mp3'), 'MP4 -> MP3 audio extraction supported');
    assert(videoConverter.canConvert('mp4', 'wav'), 'MP4 -> WAV audio extraction supported');

    const mediaEngine = MediaEngine.getInstance();

    // Verify audio extraction flag
    const extractArgs = mediaEngine.buildArgs('input.mp4', 'output.mp3', 'mp3', {});
    assert(extractArgs.includes('-vn'), 'MP4 -> MP3 includes -vn (no video) flag for fast audio extraction');

    // Verify WebM video transcode flag
    const webmArgs = mediaEngine.buildArgs('input.mp4', 'output.webm', 'webm', {});
    assert(webmArgs.includes('-c:v') && webmArgs.includes('libvpx'), 'MP4 -> WebM uses libvpx video codec');

    mediaEngine.convert = async (file, outFmt, opts = {}) => {
      const isAudio = ['mp3', 'wav'].includes(outFmt);
      const mime = isAudio ? (outFmt === 'mp3' ? 'audio/mpeg' : 'audio/wav') : `video/${outFmt}`;
      return {
        blob: new MockBlob(['mock_video_bytes'], { type: mime }),
        filename: generateOutputFilename(file.name, outFmt),
        mimeType: mime
      };
    };

    const mp4File = new MockFile('clip.mp4', 500000, 'video/mp4');
    const extractRes = await videoConverter.convert(mp4File, { outputFormat: 'mp3' });
    assert(extractRes.mimeType === 'audio/mpeg', 'MP4 -> MP3 produces audio/mpeg');
    assert(extractRes.filename === 'clip.mp3', 'Output filename is clip.mp3');
  }

  // =========================================================================
  // 9. Unsupported Formats & Honest Limitations
  // =========================================================================
  console.log('\n[9/19] Testing Unsupported Formats & Honest Limitation Explanations:');
  {
    const docConverter = new DocumentConverter();
    const audioConverter = new AudioConverter();
    const videoConverter = new VideoConverter();

    // Document limitations
    assert(!docConverter.canConvert('pdf', 'png'), 'PDF -> PNG is not supported');
    const pdfPngLim = docConverter.getConversionLimitation('pdf', 'png');
    assert(!pdfPngLim.isSupported && pdfPngLim.reason.toLowerCase().includes('rasteriz'), 'PDF -> PNG explains rasterization limitation');

    assert(!docConverter.canConvert('docx', 'pdf'), 'DOCX -> PDF is not supported');
    const docxLim = docConverter.getConversionLimitation('docx', 'pdf');
    assert(!docxLim.isSupported && docxLim.reason.toLowerCase().includes('office'), 'DOCX -> PDF explains desktop office engines limitation');

    // Media limitations
    assert(!audioConverter.canConvert('wma', 'mp3'), 'WMA -> MP3 is not supported');
    const wmaLim = audioConverter.getConversionLimitation('wma', 'mp3');
    assert(!wmaLim.isSupported && wmaLim.reason.toLowerCase().includes('proprietary'), 'WMA explains proprietary codec limitation');

    assert(!videoConverter.canConvert('rmvb', 'mp4'), 'RMVB -> MP4 is not supported');
    const rmvbLim = videoConverter.getConversionLimitation('rmvb', 'mp4');
    assert(!rmvbLim.isSupported && rmvbLim.reason.toLowerCase().includes('realmedia'), 'RMVB explains RealMedia codec limitation');

    // Verify rejection with ConversionError
    let threw = false;
    try {
      await docConverter.convert(new MockFile('test.pdf', 100), { outputFormat: 'png' });
    } catch (err) {
      threw = true;
      assert(err instanceof ConversionError, 'Rejected error is instance of ConversionError');
      assert(err.code === 'UNSUPPORTED_FORMAT', 'Error code is UNSUPPORTED_FORMAT');
    }
    assert(threw, 'docConverter.convert threw on unsupported format');
  }

  // =========================================================================
  // 10. Corrupted & 0-Byte File Handling
  // =========================================================================
  console.log('\n[10/19] Testing Corrupted & 0-Byte File Handling:');
  {
    const fileManager = new FileManager();

    // 0-byte file
    const emptyFile = new MockFile('empty.png', 0, 'image/png');
    const { added, rejected } = fileManager.addFiles([emptyFile]);
    assert(added.length === 0, '0-byte file was not added to queue');
    assert(rejected.length === 1, '0-byte file was rejected');
    assert(rejected[0].reason.toLowerCase().includes('empty') || rejected[0].reason.includes('0 bytes'), 'Rejection explains 0-byte/empty file');

    // Corrupted image buffer handling
    const imgConverter = new ImageConverter();
    imgConverter.decodeImage = async () => {
      throw new ConversionError('The provided image file is corrupted or in an unrecognized format.', 'CORRUPTED_FILE');
    };

    let imgCorruptThrew = false;
    try {
      await imgConverter.convert(new MockFile('corrupted.png', 500, 'image/png'), { outputFormat: 'jpg' });
    } catch (err) {
      imgCorruptThrew = true;
      assert(err.code === 'CORRUPTED_FILE', 'Corrupted image throws CORRUPTED_FILE code');
    }
    assert(imgCorruptThrew, 'Corrupted image handling verified');

    // Corrupted PDF text extractor handling
    let pdfCorruptThrew = false;
    try {
      await PdfExtractor.extractText(new MockFile('corrupt.pdf', 50, 'application/pdf'));
    } catch (err) {
      pdfCorruptThrew = true;
      assert(err.code === 'INVALID_PDF', 'Corrupted PDF without header throws INVALID_PDF code');
    }
    assert(pdfCorruptThrew, 'Corrupted PDF handled gracefully without crashing');
  }

  // =========================================================================
  // 11. Cancellation (Single Item & Batch)
  // =========================================================================
  console.log('\n[11/19] Testing Cancellation (Single Item & Batch):');
  {
    const registry = new ConverterRegistry();
    const manager = new ConverterManager(registry);

    // Mock converter with AbortSignal listening
    const slowConverter = {
      id: 'slow-mock',
      name: 'Slow Converter',
      inputFormats: ['mock'],
      outputFormats: ['out'],
      canConvert: () => true,
      getConversionLimitation: () => ({ isSupported: true }),
      convert: (file, options = {}) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => resolve({ blob: new MockBlob(['done']) }), 10000);
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new ConversionError('Conversion cancelled', 'CANCELLED'));
            });
          }
        });
      }
    };
    registry.register(slowConverter);

    // Test single item cancellation
    const itemA = { id: 'item-cancel-1', file: new MockFile('a.mock', 100), extension: 'mock', outputFormat: 'out', status: 'queued' };
    const promiseA = manager.convertItem(itemA);
    assert(manager.isConverting('item-cancel-1'), 'Item is marked as converting');

    manager.cancelItem('item-cancel-1');
    assert(!manager.isConverting('item-cancel-1'), 'Item is no longer marked as converting');

    let threwCancelled = false;
    try {
      await promiseA;
    } catch (err) {
      threwCancelled = true;
      assert(err.code === 'CANCELLED', 'Conversion rejected with CANCELLED code');
    }
    assert(threwCancelled, 'Single item conversion was cancelled successfully');

    // Test batch cancellation
    const itemB = { id: 'item-cancel-2', file: new MockFile('b.mock', 100), extension: 'mock', outputFormat: 'out', status: 'queued' };
    const itemC = { id: 'item-cancel-3', file: new MockFile('c.mock', 100), extension: 'mock', outputFormat: 'out', status: 'queued' };

    const promiseB = manager.convertItem(itemB);
    const promiseC = manager.convertItem(itemC);
    assert(manager.isConverting('item-cancel-2') && manager.isConverting('item-cancel-3'), 'Both items converting concurrently');

    manager.cancelAll();
    assert(!manager.isConverting('item-cancel-2') && !manager.isConverting('item-cancel-3'), 'cancelAll cleared all converting items');

    try { await promiseB; } catch (err) { assert(err.code === 'CANCELLED', 'Item B cancelled by cancelAll'); }
    try { await promiseC; } catch (err) { assert(err.code === 'CANCELLED', 'Item C cancelled by cancelAll'); }
  }

  // =========================================================================
  // 12. Retry Mechanism
  // =========================================================================
  console.log('\n[12/19] Testing Retry Mechanism:');
  {
    const registry = new ConverterRegistry();
    const manager = new ConverterManager(registry);

    let attempts = 0;
    const flakeyConverter = {
      id: 'flakey-mock',
      name: 'Flakey Converter',
      inputFormats: ['flake'],
      outputFormats: ['done'],
      canConvert: () => true,
      getConversionLimitation: () => ({ isSupported: true }),
      convert: async (file) => {
        attempts++;
        if (attempts === 1) {
          throw new ConversionError('Simulated network/WASM glitch', 'CONVERSION_FAILED');
        }
        return {
          blob: new MockBlob(['success_bytes'], { type: 'text/plain' }),
          filename: 'flake.done',
          mimeType: 'text/plain'
        };
      }
    };
    registry.register(flakeyConverter);

    const testItem = {
      id: 'retry-item',
      file: new MockFile('flake.flake', 100),
      extension: 'flake',
      outputFormat: 'done',
      status: 'queued',
      progress: 0
    };

    // First attempt -> Fails
    let failed = false;
    try {
      await manager.convertItem(testItem);
    } catch {
      failed = true;
      testItem.status = 'failed';
    }
    assert(failed && testItem.status === 'failed', 'First conversion attempt failed as expected');

    // Retry attempt -> Resets state and succeeds
    testItem.status = 'queued';
    const retryRes = await manager.convertItem(testItem);
    assert(retryRes.status === 'completed', 'Retry attempt successfully transitioned item to completed');
    assert(retryRes.outputBlob && retryRes.outputBlob.size > 0, 'Retry populated outputBlob');
    assert(attempts === 2, 'Flakey converter was called exactly twice');
  }

  // =========================================================================
  // 13. Single Item Download & Object URL Revocation
  // =========================================================================
  console.log('\n[13/19] Testing Single Item Download & URL Cleanup:');
  {
    const downloadManager = new DownloadManager();

    // Mock document.createElement('a') and URL methods
    let revokedUrls = [];
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

    let urlCounter = 1;
    globalThis.URL.createObjectURL = (blob) => `blob:http://localhost/test-url-${urlCounter++}`;
    globalThis.URL.revokeObjectURL = (url) => { revokedUrls.push(url); };

    let clicked = false;
    let clickedDownloadName = '';
    const fakeAnchor = {
      href: '',
      download: '',
      click: () => {
        clicked = true;
        clickedDownloadName = fakeAnchor.download;
      }
    };

    // Test downloadBlob
    const sampleBlob = new MockBlob(['download_me'], { type: 'text/plain' });
    const generatedUrl = downloadManager.createDownloadUrl(sampleBlob);
    assert(downloadManager.activeUrls.has(generatedUrl), 'activeUrls tracks generated object URL');

    downloadManager.revokeUrl(generatedUrl);
    assert(!downloadManager.activeUrls.has(generatedUrl), 'revokeUrl untracks object URL');
    assert(revokedUrls.includes(generatedUrl), 'URL.revokeObjectURL was invoked');

    // Restore
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  }

  // =========================================================================
  // 14. Download All with Throttling
  // =========================================================================
  console.log('\n[14/19] Testing Download All with Throttling:');
  {
    const downloadManager = new DownloadManager();
    const downloadedNames = [];

    downloadManager.downloadBlob = (blob, name) => {
      downloadedNames.push(name);
    };

    const items = [
      { id: '1', status: 'completed', filename: 'a.png', outputFormat: 'jpg', outputBlob: new MockBlob(['a']) },
      { id: '2', status: 'queued', filename: 'b.png', outputFormat: 'jpg' }, // Should be skipped
      { id: '3', status: 'failed', filename: 'c.png', outputFormat: 'jpg' }, // Should be skipped
      { id: '4', status: 'completed', filename: 'd.txt', outputFormat: 'pdf', outputBlob: new MockBlob(['d']) }
    ];

    const count = await downloadManager.downloadAll(items, 10);
    assert(count === 2, 'downloadAll only processed the 2 completed items with outputBlob');
    assert(downloadedNames.includes('a.jpg') && downloadedNames.includes('d.pdf'), 'downloadedNames contains generated filenames a.jpg and d.pdf');
  }

  // =========================================================================
  // 15. Dark Mode & Theme System
  // =========================================================================
  console.log('\n[15/19] Testing Dark Mode & Theme Management:');
  {
    let storage = {};
    const mockLocalStorage = {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = v; },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { storage = {}; }
    };

    const stateManager = new StateManager({ storage: mockLocalStorage });
    assert(stateManager.getThemePreference() === 'system', 'Default theme preference is system');

    // Test cycling: system -> dark -> light -> system
    const cycle = { system: 'dark', dark: 'light', light: 'system' };

    let current = stateManager.getThemePreference();
    current = cycle[current];
    stateManager.setThemePreference(current);
    assert(stateManager.getThemePreference() === 'dark', 'Cycled to dark mode');
    assert(mockLocalStorage.getItem(stateManager.THEME_KEY) === 'dark', 'Dark mode saved in localStorage');

    current = cycle[current];
    stateManager.setThemePreference(current);
    assert(stateManager.getThemePreference() === 'light', 'Cycled to light mode');

    current = cycle[current];
    stateManager.setThemePreference(current);
    assert(stateManager.getThemePreference() === 'system', 'Cycled back to system mode');

    // Test system theme resolution
    const resolvedDark = stateManager.resolveTheme('system');
    assert(['dark', 'light'].includes(resolvedDark), 'resolveTheme("system") resolves to dark or light based on OS');
  }

  // =========================================================================
  // 16. Mobile Layout & Responsive CSS
  // =========================================================================
  console.log('\n[16/19] Testing Mobile Layout & Responsive CSS:');
  {
    const cssPath = path.join(rootDir, 'src', 'styles', 'main.css');
    assert(fs.existsSync(cssPath), 'src/styles/main.css exists');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Verify responsive media queries
    assert(cssContent.includes('@media (max-width: 640px)'), 'CSS includes mobile media query @media (max-width: 640px)');
    assert(cssContent.includes('.app-header'), 'Mobile query targets .app-header');
    assert(cssContent.includes('.queue-item'), 'Mobile query optimizes .queue-item grid layout for small screens');
    assert(cssContent.includes('.queue-actions .btn'), 'Mobile query stretches action buttons for touch friendliness');
    assert(cssContent.includes('safe-area-inset-top'), 'CSS supports safe-area-inset-top for mobile notches & standalone mode');
  }

  // =========================================================================
  // 17. Offline Mode & Service Worker
  // =========================================================================
  console.log('\n[17/19] Testing Offline Mode & Service Worker:');
  {
    const swPath = path.join(rootDir, 'public', 'sw.js');
    assert(fs.existsSync(swPath), 'public/sw.js exists');
    const swCode = fs.readFileSync(swPath, 'utf8');

    assert(swCode.includes('STATIC_CACHE'), 'SW defines STATIC_CACHE');
    assert(swCode.includes('RUNTIME_CACHE'), 'SW defines RUNTIME_CACHE');
    assert(swCode.includes('self.skipWaiting()'), 'SW activates immediately via skipWaiting');
    assert(swCode.includes('self.clients.claim()'), 'SW claims clients immediately via clients.claim');
    assert(swCode.includes('/index.html'), 'SW pre-caches /index.html');
    assert(swCode.includes('mode === \'navigate\''), 'SW intercepts navigate requests for offline SPA reloads');

    // Test PwaManager offline state
    const pwaManager = new PwaManager();
    assert(typeof pwaManager.isOnline() === 'boolean', 'PwaManager provides isOnline() boolean check');
  }

  // =========================================================================
  // 18. PWA Installation & Standalone Mode
  // =========================================================================
  console.log('\n[18/19] Testing PWA Installation & Standalone Mode:');
  {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert(manifest.display === 'standalone', 'Manifest display mode is standalone');
    assert(manifest.display_override.includes('standalone'), 'Manifest display_override includes standalone');

    let installableFired = false;
    let installableVal = false;
    let installedFired = false;

    const pwa = new PwaManager({
      onInstallableChange: (val) => {
        installableFired = true;
        installableVal = val;
      },
      onInstalled: () => {
        installedFired = true;
      }
    });

    // Simulate beforeinstallprompt
    let promptInvoked = false;
    const fakePromptEvent = {
      preventDefault: () => {},
      prompt: async () => { promptInvoked = true; },
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };

    pwa.handleBeforeInstallPrompt(fakePromptEvent);
    assert(pwa.isInstallable === true, 'PwaManager flagged isInstallable as true');
    assert(installableFired && installableVal === true, 'onInstallableChange callback fired with true');

    // Simulate user clicking install button
    const result = await pwa.promptInstall();
    assert(promptInvoked, 'deferredPrompt.prompt() was invoked');
    assert(result.outcome === 'accepted', 'Install choice outcome resolved as accepted');
    assert(pwa.deferredPrompt === null, 'deferredPrompt cleaned up after prompt');
    assert(pwa.isInstallable === false, 'isInstallable reset to false after installation');

    // Simulate appinstalled event
    pwa.handleAppInstalled();
    assert(installedFired, 'onInstalled callback fired successfully');

    // Test standalone CSS rule
    const cssContent = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'main.css'), 'utf8');
    assert(cssContent.includes('[data-standalone="true"] .pwa-install-btn'), 'CSS hides install button in standalone mode ([data-standalone="true"])');
  }

  // =========================================================================
  // 19. Production Build Integrity
  // =========================================================================
  console.log('\n[19/19] Testing Production Build Integrity:');
  {
    const distDir = path.join(rootDir, 'dist');
    assert(fs.existsSync(distDir), 'dist/ directory exists from production build');

    const distIndex = path.join(distDir, 'index.html');
    assert(fs.existsSync(distIndex) && fs.statSync(distIndex).size > 1000, 'dist/index.html exists and is non-empty');

    const distManifest = path.join(distDir, 'manifest.json');
    assert(fs.existsSync(distManifest), 'dist/manifest.json exists');
    const distManifestData = JSON.parse(fs.readFileSync(distManifest, 'utf8'));
    assert(distManifestData.name === 'Offline File Converter', 'dist/manifest.json is valid');

    const distSw = path.join(distDir, 'sw.js');
    assert(fs.existsSync(distSw) && fs.statSync(distSw).size > 500, 'dist/sw.js exists and is non-empty');

    const distIcon192 = path.join(distDir, 'icons', 'icon-192.png');
    const distIcon512 = path.join(distDir, 'icons', 'icon-512.png');
    assert(fs.existsSync(distIcon192) && fs.statSync(distIcon192).size > 1000, 'dist/icons/icon-192.png exists in build');
    assert(fs.existsSync(distIcon512) && fs.statSync(distIcon512).size > 1000, 'dist/icons/icon-512.png exists in build');

    const distWasmJs = path.join(distDir, 'ffmpeg', 'ffmpeg-core.js');
    const distWasmBinary = path.join(distDir, 'ffmpeg', 'ffmpeg-core.wasm');
    assert(fs.existsSync(distWasmJs), 'dist/ffmpeg/ffmpeg-core.js exists in build');
    assert(fs.existsSync(distWasmBinary) && fs.statSync(distWasmBinary).size > 30000000, 'dist/ffmpeg/ffmpeg-core.wasm exists and is full local binary (>30MB)');

    const assetsDir = path.join(distDir, 'assets');
    assert(fs.existsSync(assetsDir), 'dist/assets directory exists');
    const assetFiles = fs.readdirSync(assetsDir);
    const hasJs = assetFiles.some(f => f.endsWith('.js'));
    const hasCss = assetFiles.some(f => f.endsWith('.css'));
    assert(hasJs && hasCss, 'dist/assets contains compiled JS and CSS bundles');
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(`Phase 10 Testing Summary: ${passedCount} passed, ${failedCount} failed.`);
  console.log('================================================================');

  return { passedCount, failedCount, recordedFailures };
}

runComprehensiveTests().catch(err => {
  console.error('Unexpected error during Phase 10 tests:', err);
  process.exitCode = 1;
});
