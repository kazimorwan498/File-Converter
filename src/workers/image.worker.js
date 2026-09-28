/**
 * Image Conversion Web Worker
 * Performs CPU-intensive image decoding, scaling, canvas rendering,
 * and format encoding off the main browser UI thread using OffscreenCanvas.
 * 
 * Supports: PNG, JPG, JPEG, WebP with quality, resizing, and transparency handling.
 */

/**
 * Determine MIME type from format string
 * @param {string} format
 * @returns {string}
 */
function getMimeType(format) {
  const f = (format || '').toLowerCase();
  switch (f) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

/**
 * Check if target format supports alpha transparency
 * @param {string} format
 * @returns {boolean}
 */
function supportsAlpha(format) {
  const f = (format || '').toLowerCase();
  return f === 'png' || f === 'webp';
}

/**
 * Process image conversion inside worker
 * @param {string} id
 * @param {Object} payload
 */
async function processImageConversion(id, payload) {
  let bitmap = null;
  try {
    const {
      fileBuffer,
      fileName = 'image',
      fileType = 'image/png',
      outputFormat,
      quality = 0.92,
      width: reqWidth,
      height: reqHeight,
      maintainAspectRatio = true,
      backgroundColor = '#ffffff'
    } = payload;

    if (!outputFormat) {
      self.postMessage({
        id,
        type: 'ERROR',
        payload: {
          message: 'No output format specified for worker image conversion',
          code: 'UNSUPPORTED_FORMAT'
        }
      });
      return;
    }

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      self.postMessage({
        id,
        type: 'ERROR',
        payload: {
          message: 'Empty or invalid file buffer provided to image worker',
          code: 'INVALID_FILE'
        }
      });
      return;
    }

    // 1. Decode image bitmap
    self.postMessage({ id, type: 'PROGRESS', percent: 15, message: 'Worker: Decoding image bitmap' });

    const blob = new Blob([fileBuffer], { type: fileType });
    try {
      bitmap = await createImageBitmap(blob);
    } catch (decodeErr) {
      self.postMessage({
        id,
        type: 'ERROR',
        payload: {
          message: `Worker could not decode image "${fileName}" (file may be corrupted): ${decodeErr.message}`,
          code: 'CORRUPTED_FILE'
        }
      });
      return;
    }

    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    // 2. Calculate target dimensions
    self.postMessage({ id, type: 'PROGRESS', percent: 35, message: 'Worker: Calculating target dimensions' });

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (reqWidth && reqHeight) {
      if (maintainAspectRatio) {
        const ratio = Math.min(reqWidth / origWidth, reqHeight / origHeight);
        targetWidth = Math.round(origWidth * ratio);
        targetHeight = Math.round(origHeight * ratio);
      } else {
        targetWidth = Math.round(reqWidth);
        targetHeight = Math.round(reqHeight);
      }
    } else if (reqWidth) {
      targetWidth = Math.round(reqWidth);
      targetHeight = maintainAspectRatio ? Math.round(origHeight * (reqWidth / origWidth)) : origHeight;
    } else if (reqHeight) {
      targetHeight = Math.round(reqHeight);
      targetWidth = maintainAspectRatio ? Math.round(origWidth * (reqHeight / origHeight)) : origWidth;
    }

    targetWidth = Math.max(1, targetWidth);
    targetHeight = Math.max(1, targetHeight);

    // 3. Render on OffscreenCanvas
    self.postMessage({ id, type: 'PROGRESS', percent: 60, message: 'Worker: Rendering on OffscreenCanvas' });

    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas is not supported in this Web Worker environment');
    }

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    const normOutput = outputFormat.toLowerCase();
    const hasAlpha = supportsAlpha(normOutput);

    if (!hasAlpha) {
      ctx.fillStyle = backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    } else {
      ctx.clearRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // Release bitmap memory immediately
    if (typeof bitmap.close === 'function') {
      bitmap.close();
      bitmap = null;
    }

    // 4. Encode to target format
    self.postMessage({ id, type: 'PROGRESS', percent: 80, message: 'Worker: Encoding output format' });

    const mimeType = getMimeType(normOutput);
    const clampedQuality = Math.min(Math.max(quality, 0.01), 1.0);

    const resultBlob = await canvas.convertToBlob({
      type: mimeType,
      quality: clampedQuality
    });

    const outputBuffer = await resultBlob.arrayBuffer();

    // 5. Generate output filename
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'converted';
    const outputExt = normOutput === 'jpeg' ? 'jpg' : normOutput;
    const filename = `${baseName}.${outputExt}`;

    self.postMessage({ id, type: 'PROGRESS', percent: 100, message: 'Worker: Image conversion complete' });

    // Transfer output buffer back with zero-copy transfer
    self.postMessage(
      {
        id,
        type: 'SUCCESS',
        payload: {
          outputBuffer,
          mimeType,
          filename,
          width: targetWidth,
          height: targetHeight,
          originalWidth: origWidth,
          originalHeight: origHeight
        }
      },
      [outputBuffer]
    );
  } catch (err) {
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
    self.postMessage({
      id,
      type: 'ERROR',
      payload: {
        message: err.message || 'Worker image conversion failed',
        code: err.code || 'CONVERSION_FAILED'
      }
    });
  }
}

// Worker message listener
self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data || {};

  if (type === 'PING') {
    self.postMessage({ id, type: 'PONG' });
    return;
  }

  if (type === 'CONVERT') {
    await processImageConversion(id, payload);
    return;
  }

  if (type === 'CANCEL') {
    self.postMessage({
      id,
      type: 'CANCELLED',
      payload: { message: 'Conversion cancelled' }
    });
  }
});
