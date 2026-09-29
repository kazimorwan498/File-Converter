import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScannedPdfDetector } from '../src/converters/pdf/scanned-pdf-detector.js';
import { PdfTextExtractor } from '../src/converters/pdf/pdf-text-extractor.js';
import { PdfDocument } from '../src/converters/pdf/pdf-generator.js';
import { DocumentConverter } from '../src/converters/pdf/document-converter.js';
import { OcrManager } from '../src/ocr/ocr-manager.js';
import { ConversionError } from '../src/core/conversion-error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 13: Scanned PDF & Offline OCR Architecture ---');

// Mock File and Blob for Node test environment
class MockFile {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.type = options.type || '';
    this.lastModified = Date.now();
    this.bits = bits;
    this.size = bits.reduce((acc, b) => acc + (b.length || (typeof b === 'string' ? b.length : 0)), 0);
  }
  async text() {
    return this.bits.map(b => (typeof b === 'string' ? b : new TextDecoder().decode(b))).join('');
  }
  async arrayBuffer() {
    const text = await this.text();
    return new TextEncoder().encode(text).buffer;
  }
}

class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.length || (typeof p === 'string' ? p.length : 0)), 0);
  }
  async text() {
    return this.parts.map(p => (typeof p === 'string' ? p : new TextDecoder().decode(p))).join('');
  }
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = MockBlob;
}

async function runTests() {
  // =========================================================================
  // 1. Verify Local Offline Assets Integrity
  // =========================================================================
  const ocrDir = path.join(rootDir, 'public', 'ocr');
  const langPath = path.join(ocrDir, 'languages', 'eng.traineddata.gz');
  const workerPath = path.join(ocrDir, 'worker.min.js');
  const pdfWorkerPath = path.join(rootDir, 'public', 'pdfjs', 'pdf.worker.min.mjs');

  assert(fs.existsSync(langPath), 'Local English language traineddata exists at public/ocr/languages/eng.traineddata.gz');
  const langStat = fs.statSync(langPath);
  assert(langStat.size > 1000000, `Local traineddata is complete (${(langStat.size / (1024 * 1024)).toFixed(2)} MB)`);

  assert(fs.existsSync(workerPath), 'Local Tesseract worker exists at public/ocr/worker.min.js');
  assert(fs.existsSync(path.join(ocrDir, 'tesseract-core-lstm.wasm')), 'Local tesseract-core-lstm.wasm exists');
  assert(fs.existsSync(path.join(ocrDir, 'tesseract-core-simd-lstm.wasm')), 'Local tesseract-core-simd-lstm.wasm exists');
  assert(fs.existsSync(pdfWorkerPath), 'Local PDF.js worker exists at public/pdfjs/pdf.worker.min.mjs');

  // =========================================================================
  // 2. ScannedPdfDetector Tests: Distinguish Text-based vs Scanned PDF
  // =========================================================================
  // Generate a valid text-based PDF
  const textPdf = new PdfDocument({ title: 'Text Layer PDF' });
  textPdf.drawHeading('Text Layer Document', 1);
  textPdf.drawParagraph('This is readable digital text inside the PDF content stream.');
  const textPdfBytes = textPdf.build();
  const textPdfFile = new MockFile([textPdfBytes], 'text-doc.pdf', { type: 'application/pdf' });

  const textDetection = await ScannedPdfDetector.detect(textPdfFile);
  assert(textDetection.isScanned === false, 'Text PDF detected as isScanned: false');
  assert(typeof textDetection.text === 'string' && textDetection.text.includes('Text Layer Document'), 'Text PDF extracts text directly');

  // Generate an image-only / scanned PDF (has PDF header but 0 text streams)
  const scannedPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 4 0 R >> >> >>
endobj
4 0 obj
<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /ColorSpace /DeviceRGB /BitsPerComponent 8 >>
stream
` + '\x00'.repeat(100) + `
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000236 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
360
%%EOF`;

  const scannedPdfBytes = new TextEncoder().encode(scannedPdfContent);
  const scannedPdfFile = new MockFile([scannedPdfBytes], 'scanned-scan.pdf', { type: 'application/pdf' });

  const scannedDetection = await ScannedPdfDetector.detect(scannedPdfFile);
  assert(scannedDetection.isScanned === true, 'Image-only PDF correctly detected as isScanned: true');
  assert(scannedDetection.text === undefined, 'Scanned PDF detection does not fake extracted text');

  // Test invalid PDF header rejection
  const invalidFile = new MockFile(['Not a pdf file content'], 'fake.pdf', { type: 'application/pdf' });
  let invalidCaught = false;
  try {
    await ScannedPdfDetector.detect(invalidFile);
  } catch (err) {
    invalidCaught = true;
    assert(err.code === 'INVALID_PDF', 'Invalid PDF throws INVALID_PDF code');
  }
  assert(invalidCaught, 'ScannedPdfDetector validates PDF header');

  // =========================================================================
  // 3. OcrManager Configuration & Error Handling
  // =========================================================================
  const ocrMgr = new OcrManager();
  assert(ocrMgr.workerPath === '/ocr/worker.min.js', 'OcrManager default workerPath is /ocr/worker.min.js');
  assert(ocrMgr.corePath === '/ocr', 'OcrManager default corePath is /ocr');
  assert(ocrMgr.langPath === '/ocr/languages', 'OcrManager default langPath is /ocr/languages');

  // Test empty pages handling
  let emptyPagesCaught = false;
  try {
    await ocrMgr.recognizePages([]);
  } catch (err) {
    emptyPagesCaught = true;
    assert(err.code === 'OCR_FAILED', 'Empty pages array throws OCR_FAILED');
    assert(err.message.includes('Unable to extract text from this scanned PDF offline'), 'Error message matches specification');
  }
  assert(emptyPagesCaught, 'OcrManager validates pages input');

  // Test cancellation handling
  const cancelController = new AbortController();
  cancelController.abort();
  let ocrCancelledCaught = false;
  try {
    await ocrMgr.recognizePages([{ pageNum: 1, blob: new MockBlob(['fake']) }], { signal: cancelController.signal });
  } catch (err) {
    ocrCancelledCaught = true;
    assert(err.code === 'CANCELLED', 'OcrManager abort throws CANCELLED code');
  }
  assert(ocrCancelledCaught, 'OcrManager respects AbortSignal');

  // =========================================================================
  // 4. DocumentConverter End-to-End PDF Flow
  // =========================================================================
  const docConverter = new DocumentConverter();

  // Test normal text PDF conversion still succeeds cleanly without OCR
  const progressCalls = [];
  const textResult = await docConverter.convert(textPdfFile, {
    outputFormat: 'txt',
    onProgress: (pct, msg) => {
      progressCalls.push({ pct, msg });
    }
  });

  assert(textResult.mimeType === 'text/plain', 'Text PDF converts to text/plain');
  const txtContent = await textResult.blob.text();
  assert(txtContent.includes('Text Layer Document'), 'Extracted text contains digital text layer');
  assert(progressCalls.some(p => p.msg === 'Detecting text layer'), 'Progress reports "Detecting text layer"');

  console.log('--- Phase 13 Test Run Completed Successfully ---');
}

runTests().catch(err => {
  console.error('Unexpected failure in Phase 13 tests:', err);
  process.exitCode = 1;
});
