/**
 * Offline Markdown Parser & Converter
 * Converts Markdown to clean HTML5 documents, styled PDFs, and stripped Plain Text.
 * 100% offline, zero runtime dependencies.
 */
import { PdfDocument } from './pdf-generator.js';

export class MarkdownParser {
  /**
   * Escape HTML entities
   * @param {string} str
   * @returns {string}
   */
  static escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Parse inline markdown formatting (bold, italic, code, links, images)
   * @param {string} text
   * @returns {string} HTML snippet
   */
  static parseInline(text) {
    if (!text) return '';
    let html = MarkdownParser.escapeHtml(text);

    // Images: ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;" />');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    return html;
  }

  /**
   * Convert Markdown string to HTML
   * @param {string} markdown
   * @param {Object} [options]
   * @param {boolean} [options.fullDocument=true] - Wrap in complete HTML document with styles
   * @param {string} [options.title='Converted Document']
   * @returns {string} HTML string
   */
  static toHtml(markdown, options = {}) {
    const fullDocument = options.fullDocument !== false;
    const title = options.title || 'Converted Document';

    const lines = (markdown || '').split(/\r?\n/);
    const htmlBlocks = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent = [];

    let inList = false;
    let listType = 'ul';

    let inBlockquote = false;
    let blockquoteContent = [];

    const closeList = () => {
      if (inList) {
        htmlBlocks.push(`</${listType}>`);
        inList = false;
      }
    };

    const closeBlockquote = () => {
      if (inBlockquote) {
        htmlBlocks.push(`<blockquote><p>${blockquoteContent.map(l => MarkdownParser.parseInline(l)).join('<br />')}</p></blockquote>`);
        inBlockquote = false;
        blockquoteContent = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code Block start/end
      if (trimmed.startsWith('```')) {
        closeList();
        closeBlockquote();
        if (inCodeBlock) {
          // End code block
          const codeText = MarkdownParser.escapeHtml(codeContent.join('\n'));
          const langClass = codeLanguage ? ` class="language-${MarkdownParser.escapeHtml(codeLanguage)}"` : '';
          htmlBlocks.push(`<pre><code${langClass}>${codeText}</code></pre>`);
          inCodeBlock = false;
          codeContent = [];
          codeLanguage = '';
        } else {
          // Start code block
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim();
          codeContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Empty line closes lists and blockquotes
      if (!trimmed) {
        closeList();
        closeBlockquote();
        continue;
      }

      // Horizontal Rule
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        closeList();
        closeBlockquote();
        htmlBlocks.push('<hr />');
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        closeBlockquote();
        const level = headingMatch[1].length;
        const text = MarkdownParser.parseInline(headingMatch[2].trim());
        htmlBlocks.push(`<h${level}>${text}</h${level}>`);
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('>')) {
        closeList();
        inBlockquote = true;
        blockquoteContent.push(trimmed.slice(1).trim());
        continue;
      } else {
        closeBlockquote();
      }

      // Unordered List (- or *)
      const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          closeList();
          inList = true;
          listType = 'ul';
          htmlBlocks.push('<ul>');
        }
        htmlBlocks.push(`<li>${MarkdownParser.parseInline(ulMatch[1].trim())}</li>`);
        continue;
      }

      // Ordered List (1. 2. etc)
      const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (!inList || listType !== 'ol') {
          closeList();
          inList = true;
          listType = 'ol';
          htmlBlocks.push('<ol>');
        }
        htmlBlocks.push(`<li>${MarkdownParser.parseInline(olMatch[1].trim())}</li>`);
        continue;
      }

      // Regular Paragraph
      closeList();
      htmlBlocks.push(`<p>${MarkdownParser.parseInline(trimmed)}</p>`);
    }

    closeList();
    closeBlockquote();
    if (inCodeBlock) {
      const codeText = MarkdownParser.escapeHtml(codeContent.join('\n'));
      htmlBlocks.push(`<pre><code>${codeText}</code></pre>`);
    }

    const bodyContent = htmlBlocks.join('\n');

    if (!fullDocument) {
      return bodyContent;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${MarkdownParser.escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #1f2328;
      --border: #d0d7de;
      --code-bg: #f6f8fa;
      --link: #0969da;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --fg: #e6edf3;
        --border: #30363d;
        --code-bg: #161b22;
        --link: #2f81f7;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--fg);
      background-color: var(--bg);
      max-width: 860px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    p, ul, ol, blockquote, pre { margin-bottom: 1rem; }
    ul, ol { padding-left: 2rem; }
    li + li { margin-top: 0.25rem; }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 85%;
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }
    pre {
      background-color: var(--code-bg);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid var(--border);
    }
    pre code { background: none; padding: 0; font-size: 0.9rem; }
    blockquote {
      border-left: 4px solid var(--border);
      padding-left: 1rem;
      margin-left: 0;
      color: #656d76;
    }
    hr {
      height: 2px;
      background-color: var(--border);
      border: none;
      margin: 2rem 0;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
  }

  /**
   * Strip markdown syntax to clean plain text
   * @param {string} markdown
   * @returns {string} Plain text
   */
  static toText(markdown) {
    if (!markdown) return '';
    let text = markdown;

    // Remove images: ![alt](url) -> alt
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

    // Remove links: [text](url) -> text (url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

    // Headings: ### Title -> TITLE
    text = text.replace(/^#{1,6}\s+(.+)$/gm, (_, title) => `${title.trim()}`);

    // Remove bold and italics
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');

    // Code blocks: ```lang ... ``` -> ...
    text = text.replace(/```[^\n]*\r?\n([\s\S]*?)```/g, '$1');

    // Inline code: `code` -> code
    text = text.replace(/`([^`]+)`/g, '$1');

    // Any remaining stray backticks
    text = text.replace(/`/g, '');

    // Blockquotes: > quote -> quote
    text = text.replace(/^>\s+(.+)$/gm, '$1');

    // Horizontal rules
    text = text.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '----------------------------------------');

    return text.trim();
  }

  /**
   * Convert markdown to a styled multi-page PDF document
   * @param {string} markdown
   * @param {Object} [options]
   * @returns {PdfDocument}
   */
  static toPdfDocument(markdown, options = {}) {
    const title = options.title || 'Document';
    const doc = new PdfDocument({ title });

    const lines = (markdown || '').split(/\r?\n/);
    let inCode = false;
    let codeBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (inCode) {
          doc.drawCodeBlock(codeBuffer.join('\n'));
          inCode = false;
          codeBuffer = [];
        } else {
          inCode = true;
          codeBuffer = [];
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      if (!trimmed) {
        continue;
      }

      // Horizontal Rule
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        doc.drawHorizontalRule();
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        doc.drawHeading(headingMatch[2].trim(), level);
        continue;
      }

      // Bullet item
      const bulletMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
      if (bulletMatch) {
        doc.drawBulletItem(bulletMatch[1].trim());
        continue;
      }

      // Numbered list
      const numMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      if (numMatch) {
        doc.drawBulletItem(numMatch[1].trim());
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        doc.drawParagraph(`"${trimmed.slice(1).trim()}"`, { font: 'F4' }); // Oblique italic
        continue;
      }

      // Regular paragraph
      // Strip basic inline markdown for PDF draw
      const cleanPara = trimmed
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      doc.drawParagraph(cleanPara);
    }

    if (inCode && codeBuffer.length > 0) {
      doc.drawCodeBlock(codeBuffer.join('\n'));
    }

    return doc;
  }
}
