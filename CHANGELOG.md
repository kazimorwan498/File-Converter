# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-29

### Added

* Completed Phase 13 — Scanned PDF Offline OCR & Accessibility Hardening:
  * Implemented 100% offline client-side OCR for scanned and image-only PDFs with zero remote network requests or API dependencies.
  * Locally bundled Tesseract.js WebAssembly engine core (`tesseract-core-*.wasm`) and worker in `public/ocr/`.
  * Downloaded and bundled English language model (`public/ocr/languages/eng.traineddata.gz`, 10.92 MB).
  * Built `ScannedPdfDetector` (`src/converters/pdf/scanned-pdf-detector.js`) to accurately distinguish text-based PDFs from scanned/image-only PDFs.
  * Built `PdfPageRenderer` (`src/converters/pdf/pdf-page-renderer.js`) to render PDF pages to crisp 2x resolution images using locally bundled PDF.js worker (`public/pdfjs/pdf.worker.min.mjs`).
  * Built `OcrManager` (`src/ocr/ocr-manager.js`) and `OcrWorker` (`src/ocr/ocr-worker.js`) executing OCR in Web Workers with cancellation support via `AbortSignal`.
  * Implemented real-time granular progress reporting: "Preparing scanned PDF", "Rendering page X of N", "OCR page X of N", "Finalizing".
  * Integrated offline OCR into `DocumentConverter` (`src/converters/pdf/document-converter.js`) for `PDF -> TXT` conversion.
  * Implemented test suite `tests/phase13-scanned-pdf-ocr.test.js` validating all 21 assertions.

### Fixed

* Replaced deprecated `<meta name="apple-mobile-web-app-capable" content="yes">` with modern `<meta name="mobile-web-app-capable" content="yes">`, eliminating Chromium PWA deprecation warnings while retaining Apple metadata for iOS compatibility.
* Fixed accessibility focus conflict on file input: removed `aria-hidden="true"` and `tabindex="-1"`, added accessible `aria-label="Upload files for conversion"`, and styled using proper visually-hidden CSS (`.sr-only`).
* Restored sensible focus behavior: returning keyboard focus to the Browse Files button after file selection or dialog cancellation.
* Eliminated unhandled promise rejections by catching conversion promises in queue Convert and Retry button handlers and reflecting error details in the queue card UI.
* Hardened `PwaManager.promptInstall()` to always clear `deferredPrompt` in a `finally` block, preventing dangling or repeated prompts.

### Changed

* Updated `vite.config.js`: Added manual chunks for `vendor-ocr` and `vendor-pdfjs` to keep initial load lean (~82 kB index bundle).
* Updated `package.json`: Added `tesseract.js` (^7.0.0) and `pdfjs-dist` (^6.3.289) and updated `npm test` script.
* Updated `PROJECT_STATE.md`, `TODO.md`, and `README.md`.

* Completed Phase 12 — Finalization:
  * Verified 100% offline, zero-network architecture: Zero external CDN dependencies, zero external runtime APIs, zero server file uploads.
  * Verified production build: Built in 353ms with optimized chunks.
  * Configured production preview server with Cross-Origin-Opener-Policy (`same-origin`) and Cross-Origin-Embedder-Policy (`credentialless`) headers for seamless SharedArrayBuffer WebAssembly operation.
  * Documented Browser Compatibility Matrix in `README.md` covering Chrome/Chromium, Edge, Firefox, macOS Safari, and Mobile Browsers.
  * Documented Known Limitations transparently in `README.md` (complex Word layout engines, arbitrary vector PDF rasterization, scanned PDF OCR, proprietary codecs like WMA/RMVB, and 2GB WASM address limits).
  * Tagged and finalized version `1.0.0` release.
* Completed Phase 11 — Optimization:
  * Optimized memory footprint: Ephemeral in-memory file buffers, automatic unlinking of virtual filesystem assets (`deleteFile`), explicit tracking and revocation of Object URLs (`URL.revokeObjectURL`) on item removal and queue clearing.
  * Optimized bundle size & chunking: Configured Vite/Rollup `manualChunks` in `vite.config.js` to isolate `@ffmpeg` vendor chunks into `vendor-ffmpeg`, keeping initial bundle size minimal (~76 kB uncompressed, ~21 kB gzip).
  * Optimized converter lazy loading: Web Worker instances and WASM core binaries are loaded on-demand only when a corresponding conversion is started.
  * Optimized UI responsiveness: Offloaded CPU-heavy image canvas and media conversion to Web Workers, ensuring 60fps main UI thread performance and instant abort responsiveness.
  * Enhanced accessibility: Accessible announcements for screen readers via `#a11y-announcer`, keyboard navigation support on dropzone and queue items, full contrast support across dark and light themes.
* Completed Phase 10 — Testing & Edge Cases:
  * Implemented comprehensive test suite in `tests/phase10-comprehensive-testing.test.js` validating all 19 functional and non-functional requirements across 163 assertions.
  * Validated file picker extraction and input value resetting for consecutive identical file selections.
  * Validated drag & drop lifecycle (dragenter, nested counters, dragleave, drop dataTransfer extraction).
  * Validated multi-file ingestion across image, document, audio, video models.
  * Validated duplicate prevention (name, size, timestamp) and user notification banners.
  * Validated all 8 bidirectional image conversion pairs, quality sliders, transparency background fill, and aspect-ratio dimensions.
  * Validated document conversion engine (txt, md, html, json, pdf) and markdown compiler.
  * Validated audio & video conversion engine (mp3, wav, ogg, aac, flac, mp4, webm) and fast audio extraction (-vn).
  * Validated honest offline limitations for unsupported codecs and formats (docx, wma, rmvb, scanned PDFs).
  * Validated corrupted file handling: 0-byte files, corrupted image decoding, corrupted PDF stream recovery.
  * Validated item-level cancellation, in-flight conversion abortion, and batch cancellation.
  * Validated retry mechanism restoring item state from failed and cancelled statuses.
  * Validated single item download and batch download with interval throttling.
  * Validated dark/light/system theme cycling and localStorage persistence.
  * Validated mobile layout breakpoints and touch-friendly controls.
  * Validated Service Worker cache-first fetch strategy and offline SPA navigation fallback.
  * Validated PWA beforeinstallprompt interception, programmatic installation, and standalone mode.
  * Validated production build bundle integrity (HTML, CSS, JS chunks, manifest, icons, WASM binaries).

### Changed

* Updated `src/core/file-manager.js`: Enhanced `validateFile` to accept duck-typed File objects checking `{ name, size }` and clarified duplicate rejection message.
* Updated `src/core/download-manager.js`: Added dynamic fallback to `generateOutputFilename` in `downloadAll` when `item.outputFilename` is not pre-populated.
* Updated `src/core/state-manager.js`: Added dependency injection constructor options `{ storage, mediaMatcher }` and existence checks for `window` and `localStorage`.
* Updated `src/core/pwa-manager.js`: Exposed `handleBeforeInstallPrompt` and `handleAppInstalled` methods for direct programmatic and headless testing.
* Updated `package.json`: Bumped version to `0.10.0` and included Phase 10 test suite in `npm test`.
* Updated `PROJECT_STATE.md`, `TODO.md`, and `README.md` to reflect Phase 10 completion.

### Fixed

* Fixed cross-realm `File` rejection in `FileManager` where `instanceof File` failed for iframes, worker transfers, or mock environments.
* Fixed unshielded `cleanup()` calls in `ImageConverter.getImageDimensions` and `convertOnMainThread` by adding `typeof cleanup === 'function'` guards.
* Fixed `ReferenceError: window is not defined` in `StateManager` when instantiated in headless or Node.js test environments.
* Fixed output filename generation in batch download when `item.outputFilename` was not pre-populated.
* Clarified duplicate rejection notification message with "Duplicate file:" prefix.

### Tested

* Executed `npm test`: 590 assertions passed across Phase 1 through 10 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 33 modules in 346ms with 0 errors.

## 2026-09-28

### Added

* Completed Phase 9 — PWA & Offline Support:
  * Implemented Web App Manifest in `public/manifest.json`: Standard standalone display mode, orientation, background/theme colors, categories, and icon configurations.
  * Generated PWA icon suite in `public/icons/`: Multi-resolution icons (`icon-192.svg`, `icon-512.svg`, `icon-maskable.svg`, and binary `icon-192.png`, `icon-512.png`).
  * Implemented Cache-First Service Worker in `public/sw.js` and `public/service-worker.js`: Pre-caches core application shell (`/`, `/index.html`, `/manifest.json`, and all icon assets) into `file-converter-static-v1.0.0`; dynamically caches runtime assets into `file-converter-runtime-v1.0.0`; provides offline SPA navigation fallback to `/index.html`.
  * Implemented `PwaManager` in `src/core/pwa-manager.js`: Handles service worker registration, standalone mode detection (`display-mode: standalone`, `navigator.standalone`), online/offline network connectivity listeners with live UI synchronization, and `beforeinstallprompt` interception with custom in-app install trigger.
  * UI Integration: Added dynamic `#offline-indicator` badge and `#pwa-install-btn` into application header in `index.html`, `src/styles/main.css`, and `src/core/app.js`.
  * Created unit test suite `tests/phase9-pwa-offline.test.js` validating all 46 Phase 9 assertions.
* Completed Phase 8 — Web Workers & Background Offloading:
  * Implemented `ImageWorker` in `src/workers/image.worker.js`: Dedicated Web Worker offloading image decoding, dimension calculation, `OffscreenCanvas` rendering, transparency fill, and format encoding (PNG, JPG, WebP) from the main UI thread.
  * Implemented zero-copy memory transfer utilizing transferable `ArrayBuffer` instances between main thread and workers.
  * Implemented `ImageWorkerClient` in `src/workers/image-worker-client.js`: Manages worker lifecycle, job tracking, progress dispatching (15%, 60%, 80%, 100%), error boundaries (`WORKER_CRASH`), instant cancellation via worker termination, and idle resource cleanup.
  * Implemented `WorkerPool` in `src/workers/worker-pool.js`: General worker pool providing concurrency limiting, idle worker destruction timers, and cancellation isolation.
  * Created unit test suite `tests/phase8-web-workers.test.js` validating all 43 Phase 8 assertions.
* Completed Phase 7 — Audio / Video Conversion:
  * Bundled `@ffmpeg/core` 0.12.10 assets (`ffmpeg-core.js` and `ffmpeg-core.wasm`) in `public/ffmpeg/` and `libs/local/ffmpeg/` for 100% offline, zero-CDN local WebAssembly execution.
  * Implemented `MediaEngine` in `src/converters/audio/media-engine.js`: Lazy singleton WebAssembly loader, argument synthesis for `libmp3lame`, 16-bit PCM, `libvorbis`, `H.264`, and `VPX`, real-time progress parsing, memory hygiene via virtual FS unlinking (`deleteFile`), and immediate worker termination on `AbortSignal`.
  * Implemented `AudioConverter` in `src/converters/audio/audio-converter.js`: Extends `BaseConverter` (`id: 'native-audio-converter'`) supporting bidirectional conversions across `mp3`, `wav`, `ogg`, `aac`, `m4a`, and `flac`.
  * Implemented `VideoConverter` in `src/converters/video/video-converter.js`: Extends `BaseConverter` (`id: 'native-video-converter'`) supporting video transcode (`mp4 <-> webm`, `mov -> mp4/webm`) and video-to-audio extraction (`mp4/webm -> mp3/wav`).
  * Implemented honest limitation handling for media: Proprietary/unsupported formats (`wma`, `rmvb`, `wmv`, `m4p`) are never faked, clearly flagged in dropdowns, explained via UI limitation callouts, and rejected with `UNSUPPORTED_FORMAT`.
  * Created unit test suite `tests/phase7-audio-video.test.js` validating all 57 Phase 7 assertions.
* Completed Phase 6 — PDF / Document Conversion:
  * Implemented `PdfDocument` in `src/converters/pdf/pdf-generator.js`: 100% offline, zero-dependency PDF 1.4 multi-page document generator with word-wrapping, margins, typography, page numbers ("Page X of Y"), and Base-14 fonts.
  * Implemented `MarkdownParser` in `src/converters/pdf/markdown-parser.js`: Offline parser compiling Markdown to standalone styled HTML5 documents, styled multi-page PDFs, and clean plain text.
  * Implemented `PdfExtractor` in `src/converters/pdf/pdf-extractor.js`: Text layer extractor from PDF streams with `FlateDecode` decompression via native Web Streams API (`DecompressionStream`), with clear error detection on scanned/empty PDFs.
  * Implemented `DocumentConverter` in `src/converters/pdf/document-converter.js`: Extends `BaseConverter` supporting `txt` -> `pdf`/`html`, `md` -> `html`/`pdf`/`txt`, `html` -> `txt`, `json` -> `txt`, and `pdf` -> `txt`.
  * Implemented transparent limitation handling: Unsupported document conversions (`pdf -> png/jpg`, `docx -> pdf`) are never faked, clearly marked in the UI with technical explanation callouts, and rejected with `UNSUPPORTED_FORMAT`.
  * Registered `DocumentConverter` in `src/core/app.js` with dynamic limitation banners, disabled convert buttons for unsupported target pairs, and queue integration.
  * Created unit test suite `tests/phase6-document-conversion.test.js` validating all 98 Phase 6 assertions.
* Completed Phase 5 — Conversion Queue:
  * Connected `ConverterManager` and `ImageConverter` to interactive queue lifecycle in `src/core/app.js`.
  * Added sequential batch processing in `convertAllQueue` processing queued files one-by-one.
  * Added real-time status badge synchronization (`Queued`, `Preparing`, `X%`, `Completed`, `Cancelled`, `Failed`).
  * Added item-level cancellation (`btn-cancel-item`) and batch queue cancellation (`Cancel All` header button).
  * Added retry mechanism on failed and cancelled conversions with instant state recovery.
  * Added single-item download button on completed items and batch "Download All" with 250ms interval throttling in `DownloadManager`.
  * Implemented `generateOutputFilename(originalName, targetFormat)` in `src/utils/formatters.js` with clean extension normalization.
  * Implemented comprehensive object URL tracking and revocation in `DownloadManager` and `App` to eliminate memory leaks.
  * Created unit test suite `tests/phase5-conversion-queue.test.js` validating one file, multiple sequential files, mixed image formats, failed conversions, retry recovery, cancellation, and download tracking.
* Completed Phase 4 — Image Conversion:
  * Implemented `ImageConverter` with quality controls, transparency handling, and aspect-ratio resizing.
  * Unit test suite `tests/phase4-image-conversion.test.js`.
* Completed Phase 3 — Converter Engine Architecture:
  * Implemented `BaseConverter`, `ConverterRegistry`, `ConverterManager`, and `ConversionError`.
  * Unit test suite `tests/phase3-converter-engine.test.js`.
* Completed Phase 2 — File System:
  * Implemented `FileManager` with multi-file ingestion, file validation, duplicate prevention, and queue operations.
  * Unit test suite `tests/phase2-filesystem.test.js`.
* Completed Phase 1 — Application Foundation:
  * Application shell with header, title, privacy badge, theme button, drop zone, and queue section.
  * Unit test suite `tests/phase1-foundation.test.js`.

### Changed

* Updated `index.html`: Added `<link rel="manifest" href="/manifest.json">`, apple touch icon, and theme color tags; added `#offline-indicator` and `#pwa-install-btn` in header actions.
* Updated `src/styles/main.css`: Added styles for `#pwa-install-btn`, `#offline-indicator` pulsing badge, and `[data-standalone="true"]` presentation mode.
* Updated `src/core/app.js`: Integrated `PwaManager` lifecycle, dynamically binding live online/offline network changes and user install prompt clicks.
* Updated `src/converters/image/image-converter.js`: Integrated `ImageWorkerClient` to offload heavy operations to Web Workers while maintaining transparent fallback to `convertOnMainThread`.
* Updated `src/core/converter-manager.js`: Added `getConverter(input, output)` method delegating to registry.
* Updated `package.json`: Bumped version to `0.9.0` and included Phase 9 test suite in `npm test`.
* Updated `PROJECT_STATE.md`, `TODO.md`, and `README.md` to reflect Phase 9 completion.

### Fixed

* Guaranteed 100% offline reload resilience: Navigation requests fallback to pre-cached `/index.html` via Service Worker cache-first strategy.
* Eliminated main-thread UI freezing during CPU-intensive image resizing and canvas compression.
* Guaranteed clean worker termination on abort/cancel events, instantly releasing CPU and memory.
* Prevented memory leaks by transferring `ArrayBuffer` objects with zero-copy semantics and destroying idle workers.

### Tested

* Executed `npm test`: 427 assertions passed across Phase 1 through 9 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 33 modules in 372ms with 0 errors and copied manifest, service worker, icons, and WASM binaries to `dist/`.
* Preview server verification (`http://localhost:4173`): Verified HTTP 200 responses for `/`, `/manifest.json`, `/sw.js`, and `/icons/icon-192.png`.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.


