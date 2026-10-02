import { DocumentConverter, DOCUMENT_CONVERSION_LIMITATIONS } from '../src/converters/pdf/document-converter.js';
import { PdfDocument } from '../src/converters/pdf/pdf-generator.js';
import { MarkdownParser } from '../src/converters/pdf/markdown-parser.js';
import { PdfExtractor } from '../src/converters/pdf/pdf-extractor.js';
import { ConversionError } from '../src/core/conversion-error.js';
import { ConverterRegistry } from '../src/core/converter-registry.js';
import { ConverterManager } from '../src/core/converter-manager.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 6: PDF & Document Offline Conversion ---');

// Mock File and Blob for Node test environment if not globally present
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
  // 1. PdfDocument Generator Tests
  // =========================================================================
  const pdfDoc = new PdfDocument({ title: 'Quarterly Report' });
  assert(pdfDoc.title === 'Quarterly Report', 'PdfDocument sets title');
  assert(pdfDoc.pages.length === 1, 'PdfDocument initializes with 1 page');

  pdfDoc.drawHeading('Executive Summary', 1);
  pdfDoc.drawParagraph('This is the first paragraph with standard typography and line wrapping.');
  pdfDoc.drawHeading('Key Findings', 2);
  pdfDoc.drawBulletItem('100% offline conversion with zero remote dependencies');
  pdfDoc.drawBulletItem('Strict memory management and resource disposal');
  pdfDoc.drawCodeBlock('function test() {\n  return "offline";\n}');
  pdfDoc.drawHorizontalRule();
  pdfDoc.drawParagraph('Final closing paragraph.');

  const pdfBytes = pdfDoc.build();
  assert(pdfBytes instanceof Uint8Array, 'pdfDoc.build() returns Uint8Array');
  assert(pdfBytes.length > 500, 'PDF bytes generated are substantial');

  const pdfStr = new TextDecoder('latin1').decode(pdfBytes);
  assert(pdfStr.startsWith('%PDF-1.4'), 'PDF header complies with %PDF-1.4');
  assert(pdfStr.includes('/Type /Catalog'), 'PDF contains /Catalog indirect object');
  assert(pdfStr.includes('/Type /Pages'), 'PDF contains /Pages indirect object');
  assert(pdfStr.includes('xref'), 'PDF contains cross-reference table (xref)');
  assert(pdfStr.includes('startxref'), 'PDF contains startxref pointer');
  assert(pdfStr.includes('%%EOF'), 'PDF ends with standard %%EOF token');

  // Test multi-page pagination
  const multiPageDoc = new PdfDocument({ title: 'Long Document' });
  for (let i = 0; i < 40; i++) {
    multiPageDoc.drawParagraph(`Paragraph ${i + 1}: Continuous text stream to force multi-page allocation and verify headers/footers.`);
  }
  const multiBytes = multiPageDoc.build();
  assert(multiPageDoc.pages.length >= 2, 'Automatic pagination triggers multi-page layout when exceeding height');
  const multiStr = new TextDecoder('latin1').decode(multiBytes);
  assert(multiStr.includes('Page 1 of') && multiStr.includes('Page 2 of'), 'Multi-page PDF contains dynamic Page X of Y footers');

  // =========================================================================
  // 2. MarkdownParser Tests
  // =========================================================================
  const mdInput = `# Main Heading
## Sub Heading
This is **bold** text and *italic* text with \`inline code\`.

> An important quotation from offline docs.

- Bullet item one
- Bullet item two

\`\`\`javascript
const answer = 42;
\`\`\`

1. Ordered item one
2. Ordered item two

---
[Visit Offline](https://localhost)
`;

  // HTML conversion
  const htmlDoc = MarkdownParser.toHtml(mdInput, { title: 'Markdown Doc' });
  assert(htmlDoc.includes('<!DOCTYPE html>'), 'MarkdownParser.toHtml wraps in <!DOCTYPE html>');
  assert(htmlDoc.includes('<h1>Main Heading</h1>'), 'Parses H1 heading');
  assert(htmlDoc.includes('<h2>Sub Heading</h2>'), 'Parses H2 heading');
  assert(htmlDoc.includes('<strong>bold</strong>'), 'Parses bold markdown');
  assert(htmlDoc.includes('<em>italic</em>'), 'Parses italic markdown');
  assert(htmlDoc.includes('<code>inline code</code>'), 'Parses inline code');
  assert(htmlDoc.includes('<blockquote>'), 'Parses blockquote');
  assert(htmlDoc.includes('<ul>'), 'Parses unordered list');
  assert(htmlDoc.includes('<li>Bullet item one</li>'), 'Parses list items');
  assert(htmlDoc.includes('<ol>'), 'Parses ordered list');
  assert(htmlDoc.includes('<pre><code class="language-javascript">'), 'Parses code block with language');
  assert(htmlDoc.includes('<hr />'), 'Parses horizontal rule');
  assert(htmlDoc.includes('<a href="https://localhost"'), 'Parses links');

  // Plain Text stripping
  const plainText = MarkdownParser.toText(mdInput);
  assert(!plainText.includes('#'), 'MarkdownParser.toText removes heading # tags');
  assert(!plainText.includes('**'), 'Removes ** bold markers');
  assert(!plainText.includes('`'), 'Removes code backtick markers');
  assert(plainText.includes('Main Heading'), 'Preserves heading text');
  assert(plainText.includes('Bullet item one'), 'Preserves bullet list text');
  assert(plainText.includes('Visit Offline (https://localhost)'), 'Formats links as title (url)');

  // Markdown to PDF
  const mdPdfDoc = MarkdownParser.toPdfDocument(mdInput, { title: 'MD to PDF' });
  const mdPdfBytes = mdPdfDoc.build();
  assert(mdPdfBytes.length > 500, 'MarkdownParser.toPdfDocument compiles to valid PDF');

  // =========================================================================
  // 3. PdfExtractor Tests
  // =========================================================================
  // Generate a test PDF with known text content
  const extractTestDoc = new PdfDocument({ title: 'Extraction Source' });
  extractTestDoc.drawHeading('Extracted Chapter', 1);
  extractTestDoc.drawParagraph('This line was successfully extracted from PDF stream content.');
  const testPdfBytes = extractTestDoc.build();

  const extracted = await PdfExtractor.extractText(testPdfBytes);
  assert(extracted.includes('Extracted Chapter'), 'PdfExtractor extracts heading from PDF');
  assert(extracted.includes('This line was successfully extracted'), 'PdfExtractor extracts paragraph text');

  // Test error handling: Non-PDF input
  let nonPdfErrorCaught = false;
  try {
    await PdfExtractor.extractText(new TextEncoder().encode('THIS IS NOT A VALID PDF FILE'));
  } catch (err) {
    nonPdfErrorCaught = true;
    assert(err.code === 'INVALID_PDF', 'PdfExtractor rejects non-PDF with INVALID_PDF code');
  }
  assert(nonPdfErrorCaught, 'PdfExtractor threw on invalid PDF input');

  // Test error handling: Scanned/image-only PDF with no text stream
  const emptyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000009 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF\n';
  let scannedErrorCaught = false;
  try {
    await PdfExtractor.extractText(new TextEncoder().encode(emptyPdf));
  } catch (err) {
    scannedErrorCaught = true;
    assert(err.code === 'NO_TEXT_IN_PDF', 'PdfExtractor identifies empty/scanned PDF with NO_TEXT_IN_PDF code');
    assert(err.message.includes('Scanned PDF') || err.message.includes('No extractable text'), 'Error message clearly explains OCR limitation');
  }
  assert(scannedErrorCaught, 'PdfExtractor threw on image-only/scanned PDF');

  // =========================================================================
  // 4. DocumentConverter Contract & Matrix Tests
  // =========================================================================
  const docConverter = new DocumentConverter();
  assert(docConverter.id === 'native-document-converter', 'DocumentConverter id is native-document-converter');

  // Supported format combinations
  assert(docConverter.canConvert('txt', 'pdf') === true, 'canConvert supports txt -> pdf');
  assert(docConverter.canConvert('txt', 'html') === true, 'canConvert supports txt -> html');
  assert(docConverter.canConvert('md', 'html') === true, 'canConvert supports md -> html');
  assert(docConverter.canConvert('md', 'pdf') === true, 'canConvert supports md -> pdf');
  assert(docConverter.canConvert('md', 'txt') === true, 'canConvert supports md -> txt');
  assert(docConverter.canConvert('markdown', 'html') === true, 'canConvert supports markdown -> html');
  assert(docConverter.canConvert('html', 'txt') === true, 'canConvert supports html -> txt');
  assert(docConverter.canConvert('json', 'txt') === true, 'canConvert supports json -> txt');
  assert(docConverter.canConvert('pdf', 'txt') === true, 'canConvert supports pdf -> txt');

  // Unsupported formats (Never faked, clearly rejected)
  assert(docConverter.canConvert('pdf', 'png') === true, 'canConvert supports pdf -> png');
  assert(docConverter.canConvert('pdf', 'jpg') === true, 'canConvert supports pdf -> jpg');
  assert(docConverter.canConvert('pdf', 'webp') === true, 'canConvert supports pdf -> webp');
  assert(docConverter.canConvert('docx', 'pdf') === false, 'canConvert rejects docx -> pdf');
  assert(docConverter.canConvert('txt', 'mp3') === false, 'canConvert rejects txt -> mp3');

  // Limitation reporting
  const limPdfPng = docConverter.getConversionLimitation('pdf', 'png');
  assert(limPdfPng.isSupported === true, 'getConversionLimitation marks pdf -> png supported');

  const limDocx = docConverter.getConversionLimitation('docx', 'pdf');
  assert(limDocx.isSupported === false, 'getConversionLimitation marks docx -> pdf unsupported');
  assert(limDocx.reason.includes('Word') || limDocx.reason.includes('office'), 'Limitation reason explains office engine requirement');

  const limTxtPdf = docConverter.getConversionLimitation('txt', 'pdf');
  assert(limTxtPdf.isSupported === true, 'getConversionLimitation marks txt -> pdf supported');

  // Available outputs per format
  assert(docConverter.getAvailableOutputs('txt').includes('pdf'), 'txt outputs include pdf');
  assert(docConverter.getAvailableOutputs('txt').includes('html'), 'txt outputs include html');
  assert(docConverter.getAvailableOutputs('md').includes('pdf'), 'md outputs include pdf');
  assert(docConverter.getAvailableOutputs('md').includes('html'), 'md outputs include html');
  assert(docConverter.getAvailableOutputs('md').includes('txt'), 'md outputs include txt');
  assert(docConverter.getAvailableOutputs('pdf').includes('txt'), 'pdf outputs include txt');
  assert(docConverter.getAvailableOutputs('pdf').includes('png'), 'pdf outputs include png');
  assert(docConverter.getAvailableOutputs('pdf').includes('jpg'), 'pdf outputs include jpg');
  assert(docConverter.getAvailableOutputs('pdf').includes('webp'), 'pdf outputs include webp');

  // =========================================================================
  // 5. Document Conversions Execution
  // =========================================================================
  // Test TXT -> PDF
  const sampleTxtFile = new File(['Welcome to offline file converter!\n\nThis is paragraph two.'], 'notes.txt', { type: 'text/plain' });
  const txtToPdfRes = await docConverter.convert(sampleTxtFile, { outputFormat: 'pdf' });
  assert(txtToPdfRes.mimeType === 'application/pdf', 'TXT -> PDF produces application/pdf');
  assert(txtToPdfRes.filename === 'notes.pdf', 'TXT -> PDF generates notes.pdf filename');
  assert(txtToPdfRes.blob.size > 200, 'TXT -> PDF blob has valid size');

  // Test TXT -> HTML
  const txtToHtmlRes = await docConverter.convert(sampleTxtFile, { outputFormat: 'html' });
  assert(txtToHtmlRes.mimeType === 'text/html', 'TXT -> HTML produces text/html');
  assert(txtToHtmlRes.filename === 'notes.html', 'TXT -> HTML generates notes.html filename');
  const txtHtmlContent = await txtToHtmlRes.blob.text();
  assert(txtHtmlContent.includes('<p>Welcome to offline file converter!</p>'), 'TXT -> HTML wraps paragraphs');

  // Test MD -> HTML
  const sampleMdFile = new File(['# Documentation\n\n- Feature A\n- Feature B'], 'guide.md', { type: 'text/markdown' });
  const mdToHtmlRes = await docConverter.convert(sampleMdFile, { outputFormat: 'html' });
  assert(mdToHtmlRes.mimeType === 'text/html', 'MD -> HTML produces text/html');
  assert(mdToHtmlRes.filename === 'guide.html', 'MD -> HTML generates guide.html');

  // Test MD -> PDF
  const mdToPdfRes = await docConverter.convert(sampleMdFile, { outputFormat: 'pdf' });
  assert(mdToPdfRes.mimeType === 'application/pdf', 'MD -> PDF produces application/pdf');
  assert(mdToPdfRes.filename === 'guide.pdf', 'MD -> PDF generates guide.pdf');

  // Test MD -> TXT
  const mdToTxtRes = await docConverter.convert(sampleMdFile, { outputFormat: 'txt' });
  assert(mdToTxtRes.mimeType === 'text/plain', 'MD -> TXT produces text/plain');
  assert(mdToTxtRes.filename === 'guide.txt', 'MD -> TXT generates guide.txt');

  // Test HTML -> TXT
  const sampleHtmlFile = new File(['<h1>Title</h1><p>Clean text inside HTML.</p>'], 'page.html', { type: 'text/html' });
  const htmlToTxtRes = await docConverter.convert(sampleHtmlFile, { outputFormat: 'txt' });
  assert(htmlToTxtRes.mimeType === 'text/plain', 'HTML -> TXT produces text/plain');
  assert(htmlToTxtRes.filename === 'page.txt', 'HTML -> TXT generates page.txt');
  const extractedHtmlText = await htmlToTxtRes.blob.text();
  assert(extractedHtmlText.includes('Title') && extractedHtmlText.includes('Clean text inside HTML'), 'HTML -> TXT extracts clean text');

  // Test JSON -> TXT (Formatting)
  const sampleJsonFile = new File([JSON.stringify({ project: 'OfflineConverter', status: 'Phase6' })], 'data.json', { type: 'application/json' });
  const jsonToTxtRes = await docConverter.convert(sampleJsonFile, { outputFormat: 'txt' });
  assert(jsonToTxtRes.mimeType === 'text/plain', 'JSON -> TXT produces text/plain');
  assert(jsonToTxtRes.filename === 'data.txt', 'JSON -> TXT generates data.txt');
  const jsonFormatted = await jsonToTxtRes.blob.text();
  assert(jsonFormatted.includes('"project": "OfflineConverter"'), 'JSON formatted with indentation');

  // Test Corrupted JSON
  const badJsonFile = new File(['{ invalid json content }'], 'broken.json', { type: 'application/json' });
  let jsonErrorCaught = false;
  try {
    await docConverter.convert(badJsonFile, { outputFormat: 'txt' });
  } catch (err) {
    jsonErrorCaught = true;
    assert(err.code === 'CORRUPTED_FILE', 'Corrupted JSON triggers CORRUPTED_FILE code');
  }
  assert(jsonErrorCaught, 'DocumentConverter rejected corrupted JSON');

  // Test PDF -> TXT
  const validPdfFile = new File([testPdfBytes], 'report.pdf', { type: 'application/pdf' });
  const pdfToTxtRes = await docConverter.convert(validPdfFile, { outputFormat: 'txt' });
  assert(pdfToTxtRes.mimeType === 'text/plain', 'PDF -> TXT produces text/plain');
  assert(pdfToTxtRes.filename === 'report.txt', 'PDF -> TXT generates report.txt');
  const pdfExtractedText = await pdfToTxtRes.blob.text();
  assert(pdfExtractedText.includes('Extracted Chapter'), 'PDF -> TXT extracts text successfully');

  // Test Attempting Unsupported Conversion: Must fail honestly
  let unsupportedCaught = false;
  try {
    const docxFile = new File(['fake docx'], 'report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await docConverter.convert(docxFile, { outputFormat: 'pdf' });
  } catch (err) {
    unsupportedCaught = true;
    assert(err.code === 'UNSUPPORTED_FORMAT', 'Unsupported conversion throws UNSUPPORTED_FORMAT');
    assert(err.message.includes('office') || err.message.includes('unsupported offline') || err.message.includes('No converter registered'), 'Error message explains why conversion is unsupported');
  }
  assert(unsupportedCaught, 'Unsupported conversion was not faked and threw transparent error');

  // Test Cancellation
  const abortController = new AbortController();
  abortController.abort();
  let cancelCaught = false;
  try {
    await docConverter.convert(sampleTxtFile, { outputFormat: 'pdf', signal: abortController.signal });
  } catch (err) {
    cancelCaught = true;
    assert(err.code === 'CANCELLED', 'Cancellation throws CANCELLED error');
  }
  assert(cancelCaught, 'Document conversion aborted successfully when cancelled');

  // Test Progress reporting
  const progressReports = [];
  await docConverter.convert(sampleTxtFile, {
    outputFormat: 'pdf',
    onProgress: (pct, stage) => {
      progressReports.push({ pct, stage });
    }
  });
  assert(progressReports.length > 0, 'Progress events dispatched during conversion');
  assert(progressReports[progressReports.length - 1].pct === 100, 'Final progress reaches 100%');

  // =========================================================================
  // 6. Integration with ConverterManager & ConverterRegistry
  // =========================================================================
  const registry = new ConverterRegistry();
  registry.register(docConverter);
  const manager = new ConverterManager(registry);

  assert(manager.canConvert('txt', 'pdf') === true, 'Manager canConvert txt -> pdf');
  assert(manager.canConvert('md', 'html') === true, 'Manager canConvert md -> html');
  assert(manager.canConvert('pdf', 'txt') === true, 'Manager canConvert pdf -> txt');
  assert(manager.canConvert('pdf', 'png') === true, 'Manager canConvert pdf -> png');

  const managedItem = {
    id: 'test_doc_1',
    file: sampleTxtFile,
    filename: 'notes.txt',
    extension: 'txt',
    outputFormat: 'pdf',
    status: 'queued',
    progress: 0,
    outputBlob: null,
    outputFilename: null,
    error: null
  };

  const convertedManaged = await manager.convertItem(managedItem);
  assert(convertedManaged.status === 'completed', 'Managed item completed');
  assert(convertedManaged.progress === 100, 'Managed item progress reached 100');
  assert(convertedManaged.outputBlob !== null, 'Managed item outputBlob populated');
  assert(convertedManaged.outputFilename === 'notes.pdf', 'Managed item outputFilename set to notes.pdf');

  console.log('--- Phase 6 Test Run Completed Successfully ---');
}

runTests().catch(err => {
  console.error('Unexpected failure in Phase 6 tests:', err);
  process.exitCode = 1;
});
