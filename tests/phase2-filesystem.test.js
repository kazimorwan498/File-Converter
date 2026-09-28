import { FileManager } from '../src/core/file-manager.js';
import {
  formatBytes,
  getFileExtension,
  getFileCategory,
  isFormatSupported,
  getAvailableOutputs,
  getDefaultOutput
} from '../src/utils/formatters.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 2: File System & Queue Engine ---');

// Mock File implementation for Node.js environment
class MockFile {
  constructor(name, size, type = 'application/octet-stream', lastModified = Date.now()) {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = lastModified;
  }
}
// Polyfill global File if not present
if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}

// 1. Formatters and Metadata extraction
assert(formatBytes(0) === '0 B', 'formatBytes(0) returns "0 B"');
assert(formatBytes(1024) === '1 KB', 'formatBytes(1024) returns "1 KB"');
assert(formatBytes(1048576) === '1 MB', 'formatBytes(1048576) returns "1 MB"');
assert(formatBytes(2500000, 2) === '2.38 MB', 'formatBytes with custom decimals');

assert(getFileExtension('photo.png') === 'png', 'getFileExtension("photo.png") === "png"');
assert(getFileExtension('my.archive.backup.tar.gz') === 'gz', 'getFileExtension multiple dots');
assert(getFileExtension('IMAGE.JPEG') === 'jpeg', 'getFileExtension lowercase normalization');
assert(getFileExtension('noextension') === '', 'getFileExtension without extension returns empty string');

assert(isFormatSupported('png') === true, 'png format is supported');
assert(isFormatSupported('jpg') === true, 'jpg format is supported');
assert(isFormatSupported('pdf') === true, 'pdf format is supported');
assert(isFormatSupported('mp3') === true, 'mp3 format is supported');
assert(isFormatSupported('mp4') === true, 'mp4 format is supported');
assert(isFormatSupported('xyz123') === false, 'xyz123 format is rejected');

assert(getFileCategory('png') === 'image', 'png category is image');
assert(getFileCategory('pdf') === 'document', 'pdf category is document');
assert(getFileCategory('mp3') === 'audio', 'mp3 category is audio');
assert(getFileCategory('mp4') === 'video', 'mp4 category is video');

const pngOutputs = getAvailableOutputs('png');
assert(pngOutputs.includes('jpg') && pngOutputs.includes('webp'), 'png outputs include jpg and webp');
assert(getDefaultOutput('png') === 'jpg', 'default output for png is jpg');

// 2. FileManager instance & Ingestion
const fileManager = new FileManager();
assert(fileManager.count === 0, 'Initial file manager queue is empty');

const testPng = new File(['dummycontent'], 'sample.png', { type: 'image/png' });
Object.defineProperty(testPng, 'size', { value: 2048 });
Object.defineProperty(testPng, 'lastModified', { value: 1700000000000 });

const result1 = fileManager.addFiles([testPng]);
assert(result1.added.length === 1, 'sample.png successfully added');
assert(result1.rejected.length === 0, 'No files rejected in valid single add');
assert(fileManager.count === 1, 'Queue count is 1');

// 3. Verify Queue Item properties
const item = result1.added[0];
assert(typeof item.id === 'string' && item.id.startsWith('item_'), 'Queue item has unique string id');
assert(item.file === testPng, 'Queue item holds file reference');
assert(item.filename === 'sample.png', 'Queue item has filename');
assert(item.name === 'sample.png', 'Queue item has name (PRD section 11 compatibility)');
assert(item.size === 2048, 'Queue item has size');
assert(item.formattedSize === '2 KB', 'Queue item has formattedSize');
assert(item.mimeType === 'image/png' && item.type === 'image/png', 'Queue item has MIME type');
assert(item.extension === 'png' && item.inputFormat === 'png', 'Queue item has extension');
assert(item.status === 'queued', 'Queue item status defaults to "queued"');
assert(item.progress === 0, 'Queue item progress defaults to 0');
assert(item.outputFormat === 'jpg', 'Queue item default output format is "jpg"');
assert(item.outputBlob === null, 'Queue item outputBlob is null');
assert(item.error === null, 'Queue item error is null');

// 4. Duplicate handling
const duplicatePng = new File(['dummycontent'], 'sample.png', { type: 'image/png' });
Object.defineProperty(duplicatePng, 'size', { value: 2048 });
Object.defineProperty(duplicatePng, 'lastModified', { value: 1700000000000 });

const dupResult = fileManager.addFiles([duplicatePng]);
assert(dupResult.added.length === 0, 'Duplicate file was not added');
assert(dupResult.rejected.length === 1, 'Duplicate file was rejected');
assert(dupResult.rejected[0].reason.includes('already in the queue'), 'Duplicate rejection message is informative');
assert(fileManager.count === 1, 'Queue count remained 1 after duplicate attempt');

// 5. Empty file validation (0 bytes)
const emptyFile = new File([], 'empty.png', { type: 'image/png' });
Object.defineProperty(emptyFile, 'size', { value: 0 });
Object.defineProperty(emptyFile, 'lastModified', { value: 1700000000001 });

const emptyResult = fileManager.addFiles([emptyFile]);
assert(emptyResult.added.length === 0, 'Empty file was not added');
assert(emptyResult.rejected.length === 1, 'Empty file was rejected');
assert(emptyResult.rejected[0].reason.includes('empty (0 bytes)'), 'Empty file rejection message mentions 0 bytes');

// 6. Unsupported format validation
const unsupportedFile = new File(['data'], 'document.unsupportedformat', { type: 'application/unknown' });
Object.defineProperty(unsupportedFile, 'size', { value: 500 });
Object.defineProperty(unsupportedFile, 'lastModified', { value: 1700000000002 });

const unsuppResult = fileManager.addFiles([unsupportedFile]);
assert(unsuppResult.added.length === 0, 'Unsupported file was not added');
assert(unsuppResult.rejected.length === 1, 'Unsupported file was rejected');
assert(unsuppResult.rejected[0].reason.includes('unsupported'), 'Unsupported format rejection message mentions unsupported');

// 7. Multiple file selection & ingestion
const file2 = new File(['mp3data'], 'song.mp3', { type: 'audio/mpeg' });
Object.defineProperty(file2, 'size', { value: 4096000 });
Object.defineProperty(file2, 'lastModified', { value: 1700000000003 });

const file3 = new File(['pdfdata'], 'manual.pdf', { type: 'application/pdf' });
Object.defineProperty(file3, 'size', { value: 1048576 });
Object.defineProperty(file3, 'lastModified', { value: 1700000000004 });

const multiResult = fileManager.addFiles([file2, file3]);
assert(multiResult.added.length === 2, 'Multiple files added simultaneously');
assert(fileManager.count === 3, 'Queue count is now 3');

// 8. Output format change
const songItem = fileManager.getItem(multiResult.added[0].id);
assert(songItem.outputFormat === 'wav', 'Default output for mp3 is wav');
const formatChangeSuccess = fileManager.setOutputFormat(songItem.id, 'ogg');
assert(formatChangeSuccess === true, 'Successfully changed mp3 output format to ogg');
assert(songItem.outputFormat === 'ogg', 'Item output format updated to ogg');

const invalidFormatChange = fileManager.setOutputFormat(songItem.id, 'pdf');
assert(invalidFormatChange === false, 'Invalid target format correctly rejected');
assert(songItem.outputFormat === 'ogg', 'Output format unchanged after invalid request');

// 9. Remove single file
const removed = fileManager.removeFile(item.id);
assert(removed !== null && removed.id === item.id, 'File successfully removed by ID');
assert(fileManager.count === 2, 'Queue count decremented to 2');
assert(fileManager.getItem(item.id) === undefined, 'Removed item is no longer in queue');

// 10. Clear entire queue
const clearedCount = fileManager.clearQueue();
assert(clearedCount === 2, 'Clear queue reported 2 items removed');
assert(fileManager.count === 0, 'Queue count is 0 after clearQueue');
assert(fileManager.getQueue().length === 0, 'getQueue() returns empty array');

console.log('--- Phase 2 Test Run Completed Successfully ---');
