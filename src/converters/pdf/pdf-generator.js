/**
 * Browser-Native Standard PDF Generator
 * Complies with PDF 1.4 specification without external libraries or CDN dependencies.
 * Produces valid, multi-page PDFs with text wrapping, fonts, pagination, and structural layouts.
 */

// Standard A4 dimensions in PDF points (72 points per inch)
const PAGE_A4 = { width: 595.28, height: 841.89 };

export class PdfDocument {
  /**
   * @param {Object} [options]
   * @param {string} [options.title='Document']
   * @param {string} [options.author='Offline File Converter']
   * @param {{ width: number, height: number }} [options.pageSize=PAGE_A4]
   * @param {{ top: number, bottom: number, left: number, right: number }} [options.margins]
   */
  constructor(options = {}) {
    this.title = options.title || 'Document';
    this.author = options.author || 'Offline File Converter';
    this.pageSize = options.pageSize || PAGE_A4;
    this.margins = options.margins || { top: 54, bottom: 54, left: 45, right: 45 };

    this.pages = [];
    this.currentPageIndex = -1;
    this.currentY = 0;

    // Start with first page
    this.addPage();
  }

  get printableWidth() {
    return this.pageSize.width - this.margins.left - this.margins.right;
  }

  get printableHeight() {
    return this.pageSize.height - this.margins.top - this.margins.bottom;
  }

  /**
   * Add a new page to the document
   */
  addPage() {
    const page = {
      stream: []
    };
    this.pages.push(page);
    this.currentPageIndex = this.pages.length - 1;
    this.currentY = this.pageSize.height - this.margins.top;
    return page;
  }

  get currentPage() {
    if (this.currentPageIndex < 0) {
      this.addPage();
    }
    return this.pages[this.currentPageIndex];
  }

  /**
   * Escape text for PDF literal string syntax
   * @param {string} str
   * @returns {string}
   */
  static escapeText(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\r\n\t]/g, ' ');
  }

  /**
   * Approximate text width calculation for standard Helvetica font
   * @param {string} text
   * @param {number} fontSize
   * @param {'F1'|'F2'|'F3'|'F4'} [font='F1']
   * @returns {number}
   */
  static measureTextWidth(text, fontSize, font = 'F1') {
    if (!text) return 0;
    // Courier (F3) is strictly monospaced (0.6 * fontSize per char)
    if (font === 'F3') {
      return text.length * fontSize * 0.6;
    }
    // Helvetica bold (F2) is slightly wider
    const avgCharWidth = font === 'F2' ? 0.56 : 0.52;
    return text.length * fontSize * avgCharWidth;
  }

  /**
   * Split text into words and wrap to fit within maxWidth
   * @param {string} text
   * @param {number} maxWidth
   * @param {number} fontSize
   * @param {'F1'|'F2'|'F3'|'F4'} [font='F1']
   * @returns {string[]}
   */
  wrapText(text, maxWidth, fontSize, font = 'F1') {
    if (!text) return [''];
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = PdfDocument.measureTextWidth(testLine, fontSize, font);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Single word exceeds width: hard break it
          lines.push(word);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Ensure there is enough vertical space on the current page; otherwise start a new page
   * @param {number} requiredSpace
   */
  ensureSpace(requiredSpace) {
    if (this.currentY - requiredSpace < this.margins.bottom) {
      this.addPage();
    }
  }

  /**
   * Draw document header and footer across all pages
   */
  renderHeadersAndFooters() {
    const totalPages = this.pages.length;
    const headerY = this.pageSize.height - (this.margins.top / 2);
    const footerY = this.margins.bottom / 2;

    for (let i = 0; i < totalPages; i++) {
      const page = this.pages[i];
      const pageNumStr = `Page ${i + 1} of ${totalPages}`;

      const streamCommands = [
        'q',
        '0.5 0.5 0.5 rg', // Gray text
        'BT',
        '/F1 8 Tf',
        `${this.margins.left} ${headerY} Td`,
        `(${PdfDocument.escapeText(this.title)}) Tj`,
        'ET',
        'BT',
        '/F1 8 Tf',
        `${this.pageSize.width - this.margins.right - 60} ${footerY} Td`,
        `(${PdfDocument.escapeText(pageNumStr)}) Tj`,
        'ET',
        // Thin dividing line under header
        '0.85 0.85 0.85 RG',
        '0.5 w',
        `${this.margins.left} ${headerY - 4} m ${this.pageSize.width - this.margins.right} ${headerY - 4} l S`,
        'Q'
      ];

      // Prepend header/footer commands
      page.stream.unshift(...streamCommands);
    }
  }

  /**
   * Draw heading (H1, H2, H3)
   * @param {string} text
   * @param {number} [level=1]
   */
  drawHeading(text, level = 1) {
    const fontSize = level === 1 ? 18 : level === 2 ? 14 : 12;
    const lineHeight = fontSize * 1.35;
    const spacingBefore = level === 1 ? 18 : 12;
    const spacingAfter = 6;

    this.ensureSpace(spacingBefore + lineHeight + spacingAfter);
    this.currentY -= spacingBefore;

    const wrapped = this.wrapText(text, this.printableWidth, fontSize, 'F2');
    for (const line of wrapped) {
      this.ensureSpace(lineHeight);
      this.currentPage.stream.push(
        'BT',
        `/F2 ${fontSize} Tf`,
        `${this.margins.left} ${this.currentY - fontSize} Td`,
        `(${PdfDocument.escapeText(line)}) Tj`,
        'ET'
      );
      this.currentY -= lineHeight;
    }

    this.currentY -= spacingAfter;
  }

  /**
   * Draw body paragraph with word wrapping
   * @param {string} text
   * @param {Object} [options]
   * @param {number} [options.fontSize=10]
   * @param {number} [options.lineHeight=14]
   * @param {'F1'|'F2'|'F3'|'F4'} [options.font='F1']
   */
  drawParagraph(text, options = {}) {
    const fontSize = options.fontSize || 10;
    const lineHeight = options.lineHeight || 14;
    const font = options.font || 'F1';

    const lines = this.wrapText(text, this.printableWidth, fontSize, font);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.currentPage.stream.push(
        'BT',
        `/${font} ${fontSize} Tf`,
        `${this.margins.left} ${this.currentY - fontSize} Td`,
        `(${PdfDocument.escapeText(line)}) Tj`,
        'ET'
      );
      this.currentY -= lineHeight;
    }

    this.currentY -= 6; // paragraph spacing
  }

  /**
   * Draw bullet item with indentation
   * @param {string} text
   * @param {Object} [options]
   */
  drawBulletItem(text, options = {}) {
    const fontSize = options.fontSize || 10;
    const lineHeight = options.lineHeight || 14;
    const indent = 15;
    const availableWidth = this.printableWidth - indent;

    const lines = this.wrapText(text, availableWidth, fontSize, 'F1');
    this.ensureSpace(lineHeight);

    // Draw bullet symbol
    this.currentPage.stream.push(
      'BT',
      `/F2 ${fontSize} Tf`,
      `${this.margins.left + 2} ${this.currentY - fontSize} Td`,
      '(-) Tj',
      'ET'
    );

    // Draw first line
    if (lines.length > 0) {
      this.currentPage.stream.push(
        'BT',
        `/F1 ${fontSize} Tf`,
        `${this.margins.left + indent} ${this.currentY - fontSize} Td`,
        `(${PdfDocument.escapeText(lines[0])}) Tj`,
        'ET'
      );
      this.currentY -= lineHeight;
    }

    // Remaining lines
    for (let i = 1; i < lines.length; i++) {
      this.ensureSpace(lineHeight);
      this.currentPage.stream.push(
        'BT',
        `/F1 ${fontSize} Tf`,
        `${this.margins.left + indent} ${this.currentY - fontSize} Td`,
        `(${PdfDocument.escapeText(lines[i])}) Tj`,
        'ET'
      );
      this.currentY -= lineHeight;
    }

    this.currentY -= 3;
  }

  /**
   * Draw code block with shaded background box and monospace font
   * @param {string} code
   */
  drawCodeBlock(code) {
    const fontSize = 9;
    const lineHeight = 12;
    const padding = 8;
    const rawLines = (code || '').split(/\r?\n/);

    const blockHeight = (rawLines.length * lineHeight) + (padding * 2);
    this.ensureSpace(Math.min(blockHeight, 200));

    this.currentY -= 4;

    // Background rect
    const boxY = this.currentY - blockHeight;
    this.currentPage.stream.push(
      'q',
      '0.95 0.96 0.98 rg', // Light subtle gray fill
      '0.85 0.88 0.92 RG', // Border stroke
      '0.5 w',
      `${this.margins.left} ${boxY} ${this.printableWidth} ${blockHeight} re`,
      'B', // Fill and stroke
      'Q'
    );

    this.currentY -= padding;

    for (const rawLine of rawLines) {
      this.ensureSpace(lineHeight);
      this.currentPage.stream.push(
        'BT',
        `/F3 ${fontSize} Tf`,
        `${this.margins.left + padding} ${this.currentY - fontSize} Td`,
        `(${PdfDocument.escapeText(rawLine)}) Tj`,
        'ET'
      );
      this.currentY -= lineHeight;
    }

    this.currentY -= (padding + 6);
  }

  /**
   * Draw horizontal divider line
   */
  drawHorizontalRule() {
    this.ensureSpace(14);
    this.currentY -= 6;
    this.currentPage.stream.push(
      'q',
      '0.8 0.8 0.8 RG',
      '0.75 w',
      `${this.margins.left} ${this.currentY} m ${this.pageSize.width - this.margins.right} ${this.currentY} l S`,
      'Q'
    );
    this.currentY -= 8;
  }

  /**
   * Build complete PDF binary Uint8Array
   * @returns {Uint8Array}
   */
  build() {
    this.renderHeadersAndFooters();

    const textEncoder = new TextEncoder();
    const chunks = [];
    let currentByteOffset = 0;

    function append(str) {
      const bytes = textEncoder.encode(str);
      chunks.push(bytes);
      const offset = currentByteOffset;
      currentByteOffset += bytes.length;
      return offset;
    }

    function appendBytes(bytes) {
      chunks.push(bytes);
      const offset = currentByteOffset;
      currentByteOffset += bytes.length;
      return offset;
    }

    // PDF Header with binary comment
    append('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    const totalPages = this.pages.length;
    const objectOffsets = [];

    // Object numbering plan:
    // 1: Catalog
    // 2: Pages
    // For page i (0 to totalPages - 1):
    //   pageObjId = 3 + (i * 2)
    //   contentObjId = 4 + (i * 2)
    // After pages: 4 standard Base-14 Font objects
    const fontHelveticaId = 3 + (totalPages * 2);
    const fontHelveticaBoldId = fontHelveticaId + 1;
    const fontCourierId = fontHelveticaId + 2;
    const fontHelveticaObliqueId = fontHelveticaId + 3;
    const totalObjects = fontHelveticaObliqueId;

    // 1. Catalog Object
    objectOffsets[1] = currentByteOffset;
    append('1 0 obj\n<<\n  /Type /Catalog\n  /Pages 2 0 R\n>>\nendobj\n');

    // 2. Pages Object
    const kidsStr = this.pages.map((_, i) => `${3 + (i * 2)} 0 R`).join(' ');
    objectOffsets[2] = currentByteOffset;
    append(`2 0 obj\n<<\n  /Type /Pages\n  /Kids [${kidsStr}]\n  /Count ${totalPages}\n>>\nendobj\n`);

    // Page objects & Content stream objects
    for (let i = 0; i < totalPages; i++) {
      const page = this.pages[i];
      const pageObjId = 3 + (i * 2);
      const contentObjId = 4 + (i * 2);

      // Page Object
      objectOffsets[pageObjId] = currentByteOffset;
      append(
        `${pageObjId} 0 obj\n` +
        `<<\n` +
        `  /Type /Page\n` +
        `  /Parent 2 0 R\n` +
        `  /MediaBox [0 0 ${this.pageSize.width.toFixed(2)} ${this.pageSize.height.toFixed(2)}]\n` +
        `  /Contents ${contentObjId} 0 R\n` +
        `  /Resources <<\n` +
        `    /Font <<\n` +
        `      /F1 ${fontHelveticaId} 0 R\n` +
        `      /F2 ${fontHelveticaBoldId} 0 R\n` +
        `      /F3 ${fontCourierId} 0 R\n` +
        `      /F4 ${fontHelveticaObliqueId} 0 R\n` +
        `    >>\n` +
        `  >>\n` +
        `>>\n` +
        `endobj\n`
      );

      // Page Content Stream
      const streamText = page.stream.join('\n') + '\n';
      const streamBytes = textEncoder.encode(streamText);
      objectOffsets[contentObjId] = currentByteOffset;
      append(`${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
      appendBytes(streamBytes);
      append('\nendstream\nendobj\n');
    }

    // Font Objects (Base-14 Standard Type1 Fonts supported in every PDF viewer)
    // F1: Helvetica
    objectOffsets[fontHelveticaId] = currentByteOffset;
    append(
      `${fontHelveticaId} 0 obj\n` +
      `<<\n` +
      `  /Type /Font\n` +
      `  /Subtype /Type1\n` +
      `  /BaseFont /Helvetica\n` +
      `  /Encoding /WinAnsiEncoding\n` +
      `>>\nendobj\n`
    );

    // F2: Helvetica-Bold
    objectOffsets[fontHelveticaBoldId] = currentByteOffset;
    append(
      `${fontHelveticaBoldId} 0 obj\n` +
      `<<\n` +
      `  /Type /Font\n` +
      `  /Subtype /Type1\n` +
      `  /BaseFont /Helvetica-Bold\n` +
      `  /Encoding /WinAnsiEncoding\n` +
      `>>\nendobj\n`
    );

    // F3: Courier (Monospace for code)
    objectOffsets[fontCourierId] = currentByteOffset;
    append(
      `${fontCourierId} 0 obj\n` +
      `<<\n` +
      `  /Type /Font\n` +
      `  /Subtype /Type1\n` +
      `  /BaseFont /Courier\n` +
      `  /Encoding /WinAnsiEncoding\n` +
      `>>\nendobj\n`
    );

    // F4: Helvetica-Oblique (Italic)
    objectOffsets[fontHelveticaObliqueId] = currentByteOffset;
    append(
      `${fontHelveticaObliqueId} 0 obj\n` +
      `<<\n` +
      `  /Type /Font\n` +
      `  /Subtype /Type1\n` +
      `  /BaseFont /Helvetica-Oblique\n` +
      `  /Encoding /WinAnsiEncoding\n` +
      `>>\nendobj\n`
    );

    // Cross-Reference Table (xref)
    const xrefOffset = currentByteOffset;
    append(`xref\n0 ${totalObjects + 1}\n`);
    append('0000000000 65535 f \r\n');

    for (let id = 1; id <= totalObjects; id++) {
      const offset = objectOffsets[id] || 0;
      const offsetPadded = offset.toString().padStart(10, '0');
      append(`${offsetPadded} 00000 n \r\n`);
    }

    // Trailer
    append(
      `trailer\n` +
      `<<\n` +
      `  /Size ${totalObjects + 1}\n` +
      `  /Root 1 0 R\n` +
      `  /Info <<\n` +
      `    /Title (${PdfDocument.escapeText(this.title)})\n` +
      `    /Producer (${PdfDocument.escapeText(this.author)})\n` +
      `    /CreationDate (D:${new Date().toISOString().replace(/[-:TZ]/g, '').slice(0, 14)})\n` +
      `  >>\n` +
      `>>\n` +
      `startxref\n` +
      `${xrefOffset}\n` +
      `%%EOF\n`
    );

    // Concatenate all chunks into final Uint8Array
    const finalBuffer = new Uint8Array(currentByteOffset);
    let writePos = 0;
    for (const chunk of chunks) {
      finalBuffer.set(chunk, writePos);
      writePos += chunk.length;
    }

    return finalBuffer;
  }

  /**
   * Return as downloadable Blob
   * @returns {Blob}
   */
  toBlob() {
    const bytes = this.build();
    return new Blob([bytes], { type: 'application/pdf' });
  }
}
