/**
 * Dedicated OCR Web Worker
 * Executes Tesseract OCR processing off the main UI thread.
 * 100% offline, zero network requests, loads all assets from local origin.
 */

let tesseractWorker = null;

async function getWorker(options = {}) {
  if (!tesseractWorker) {
    const { createWorker } = await import('tesseract.js');
    tesseractWorker = await createWorker('eng', 1, {
      workerPath: options.workerPath || '/ocr/worker.min.js',
      corePath: options.corePath || '/ocr',
      langPath: options.langPath || '/ocr/languages',
      gzip: true,
      logger: (m) => {
        if (m && m.status === 'recognizing text') {
          self.postMessage({
            type: 'sub_progress',
            status: m.status,
            progress: m.progress
          });
        }
      }
    });
  }
  return tesseractWorker;
}

self.onmessage = async (e) => {
  const { id, type, pages, options = {} } = e.data || {};

  if (type === 'terminate') {
    if (tesseractWorker) {
      try {
        await tesseractWorker.terminate();
      } catch {
        // Ignore
      }
      tesseractWorker = null;
    }
    self.postMessage({ id, type: 'terminated' });
    return;
  }

  if (type === 'recognize') {
    try {
      const worker = await getWorker(options);
      const results = [];
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const pageNum = page.pageNum || (i + 1);

        self.postMessage({
          id,
          type: 'progress',
          pageIndex: i,
          pageNum,
          totalPages,
          statusMessage: `OCR page ${pageNum} of ${totalPages}`
        });

        // Reconstruct Blob from ArrayBuffer if transferred
        const blob = page.blob || new Blob([page.buffer], { type: page.mimeType || 'image/png' });
        const ret = await worker.recognize(blob);
        const pageText = (ret && ret.data && ret.data.text) ? ret.data.text.trim() : '';

        results.push(pageText);
      }

      const fullText = results.join('\n\n').trim();

      self.postMessage({
        id,
        type: 'complete',
        text: fullText
      });
    } catch (err) {
      self.postMessage({
        id,
        type: 'error',
        error: err.message || 'Unable to extract text from this scanned PDF offline.'
      });
    }
  }
};
