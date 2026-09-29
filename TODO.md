# Project TODO

## Completed Tasks

* [x] **Phase 0 — Planning & Project Setup**
  * [x] Review requirements in [PRD.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/PRD.md)
  * [x] Review folder structure in [File-Structure.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/File-Structure.md)
  * [x] Initialize [PROJECT_STATE.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/PROJECT_STATE.md)
  * [x] Initialize [CHANGELOG.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/CHANGELOG.md)
  * [x] Initialize [TODO.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/TODO.md)
  * [x] Initialize [README.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/README.md)
  * [x] Create project structure matching `docs/File-Structure.md`
  * [x] Initialize Vite project configuration ([vite.config.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/vite.config.js))
  * [x] Configure [package.json](file:///d:/Frontend/All_Projects/Apps/File-Converter/package.json)
  * [x] Create initial scaffolding in `src/`
* [x] **Phase 1 — Application Foundation**
  * [x] Create accessible application shell in [index.html](file:///d:/Frontend/All_Projects/Apps/File-Converter/index.html)
  * [x] Implement Light / Dark / System theme management and OS listener in [src/core/state-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/state-manager.js)
  * [x] Build modern, responsive CSS design system in [src/styles/main.css](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/styles/main.css)
  * [x] Implement application lifecycle, theme toggle button cycling, and dragover visual feedback in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Connect browse button and keyboard shortcuts (Enter/Space) to file picker
  * [x] Create empty queue state with feature highlights
  * [x] Create test suite [tests/phase1-foundation.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase1-foundation.test.js) and configure `npm test`
  * [x] Verify production build and local server functionality
* [x] **Phase 2 — File System**
  * [x] Implement file picker and drag & drop multi-file ingestion in [src/core/file-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/file-manager.js)
  * [x] Implement file validation (reject 0-byte empty files, reject unsupported formats)
  * [x] Implement duplicate detection (compare filename, size, and lastModified)
  * [x] Standardize queue item model containing `id`, `file`, `name`, `filename`, `size`, `type`, `extension`, `status`, `progress`, `outputFormat`, and metadata
  * [x] Build dynamic queue item UI cards with category SVGs, formatted sizes, format dropdowns, status pills, and remove buttons
  * [x] Implement single file removal and full queue clearing
  * [x] Add notification alert banner for rejected/duplicate files with dismiss action
  * [x] Create unit test suite [tests/phase2-filesystem.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase2-filesystem.test.js) (48 assertions passed)
* [x] **Phase 3 — Converter Engine**
  * [x] Create standard `BaseConverter` interface in [src/core/base-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/base-converter.js)
  * [x] Implement `ConverterRegistry` in [src/core/converter-registry.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/converter-registry.js)
  * [x] Implement `ConverterManager` in [src/core/converter-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/converter-manager.js)
  * [x] Implement input format detection and available output format detection
  * [x] Implement conversion lifecycle (`queued` -> `preparing` -> `converting` -> `completed` / `cancelled` / `failed`)
  * [x] Implement progress reporting callback interface (`0%` to `100%`)
  * [x] Implement `AbortController`-based cancellation (`cancel(id)`, `cancelItem(id)`, `cancelAll()`)
  * [x] Implement standardized `ConversionError` in [src/core/conversion-error.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/conversion-error.js)
  * [x] Create architecture test suite in [tests/phase3-converter-engine.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase3-converter-engine.test.js) (43 assertions passed)
* [x] **Phase 4 — Image Conversion**
  * [x] Implement browser-native `ImageConverter` in [src/converters/image/image-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/image/image-converter.js)
  * [x] Support PNG <-> JPG/JPEG <-> WebP bidirectional conversions
  * [x] Support quality slider controls for lossy formats (JPG, WebP)
  * [x] Handle transparency with white background fill for JPG/JPEG and preserve alpha for PNG/WebP
  * [x] Extract image dimensions and support aspect-ratio-locked resizing
  * [x] Provide thumbnail previews with local object URLs
  * [x] Add progress bars and per-item/batch conversion execution
  * [x] Register `ImageConverter` with `ConverterManager` in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Create test suite [tests/phase4-image-conversion.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase4-image-conversion.test.js) (37 assertions passed)
* [x] **Phase 5 — Conversion Queue**
  * [x] Connect real converter engine to file queue in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Support multiple-file sequential conversion execution with progress tracking
  * [x] Implement status synchronization (`queued`, `preparing`, `converting`, `completed`, `cancelled`, `failed`)
  * [x] Implement item cancellation and batch cancellation
  * [x] Implement retry mechanism for failed and cancelled conversions
  * [x] Implement single-file download and batch "Download All" with interval throttling in [src/core/download-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/download-manager.js)
  * [x] Implement output filename generator in [src/utils/formatters.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/utils/formatters.js)
  * [x] Implement object URL tracking and revocation
  * [x] Create test suite [tests/phase5-conversion-queue.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase5-conversion-queue.test.js) (26 assertions passed)

* [x] **Phase 6 — PDF / Document**
  * [x] Determine browser-native document transformation boundaries
  * [x] Implement standard PDF 1.4 generator in [src/converters/pdf/pdf-generator.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/pdf/pdf-generator.js) with word-wrapping, margins, typography, page numbers, and Base-14 fonts
  * [x] Implement Markdown parser in [src/converters/pdf/markdown-parser.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/pdf/markdown-parser.js) supporting HTML5 document output, styled multi-page PDF generation, and plain text stripping
  * [x] Implement PDF text extractor in [src/converters/pdf/pdf-extractor.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/pdf/pdf-extractor.js) with native `DecompressionStream('deflate')` decompression and scanned document limitation detection
  * [x] Implement `DocumentConverter` in [src/converters/pdf/document-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/pdf/document-converter.js) for `txt` -> `pdf`/`html`, `md` -> `html`/`pdf`/`txt`, `html` -> `txt`, `json` -> `txt`, and `pdf` -> `txt`
  * [x] Implement transparent limitation handling for unsupported document pairs (`pdf -> png/jpg`, `docx -> pdf`) with UI callouts and `UNSUPPORTED_FORMAT` errors
  * [x] Register `DocumentConverter` with `ConverterManager` in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Create comprehensive test suite [tests/phase6-document-conversion.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase6-document-conversion.test.js) (98 assertions passed)

* [x] **Phase 7 — Audio / Video**
  * [x] Locally bundle browser-compatible FFmpeg WebAssembly build (`ffmpeg-core.js` and `ffmpeg-core.wasm` in `public/ffmpeg/` and `libs/local/ffmpeg/`) with 0 remote dependencies
  * [x] Build singleton `MediaEngine` in [src/converters/audio/media-engine.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/audio/media-engine.js) with lazy WASM loading and argument synthesis
  * [x] Support core audio formats: `mp3`, `wav`, `ogg`, `aac`, `m4a`, `flac` in [src/converters/audio/audio-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/audio/audio-converter.js)
  * [x] Support core video formats: `mp4`, `webm`, `mov`, `mkv`, `avi` and video-to-audio extraction (`mp4/webm -> mp3/wav`) in [src/converters/video/video-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/video/video-converter.js)
  * [x] Implement memory hygiene via virtual FS unlinking (`deleteFile`) after every conversion
  * [x] Implement cancellation with immediate worker termination via `ffmpeg.terminate()`
  * [x] Implement real-time progress parsing and callbacks (0% to 100%)
  * [x] Implement honest limitation handling for unsupported formats (`wma`, `rmvb`, `wmv`, `m4p`) with UI callouts
  * [x] Register both converters with `ConverterManager` and wire into queue lifecycle in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Create unit test suite [tests/phase7-audio-video.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase7-audio-video.test.js) (57 assertions passed)

* [x] **Phase 8 — Web Workers**
  * [x] Implement dedicated `ImageWorker` in [src/workers/image.worker.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/workers/image.worker.js) for `OffscreenCanvas` rendering and encoding
  * [x] Implement zero-copy buffer transfer with transferable `ArrayBuffer` instances
  * [x] Implement `ImageWorkerClient` in [src/workers/image-worker-client.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/workers/image-worker-client.js) with progress dispatching, cancellation, and error handling
  * [x] Implement `WorkerPool` in [src/workers/worker-pool.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/workers/worker-pool.js) with concurrency limiting and idle cleanup
  * [x] Upgrade `ImageConverter` in [src/converters/image/image-converter.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/converters/image/image-converter.js) to offload to worker with main-thread canvas fallback
  * [x] Hook worker termination and idle cleanup into queue lifecycle actions in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Create comprehensive unit test suite [tests/phase8-web-workers.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase8-web-workers.test.js) (43 assertions passed)

* [x] **Phase 9 — PWA / Offline**
  * [x] Implement Web App Manifest in [public/manifest.json](file:///d:/Frontend/All_Projects/Apps/File-Converter/public/manifest.json) with standalone display mode, orientation, background/theme colors, and categories
  * [x] Generate responsive multi-resolution PWA icons in `public/icons/` (192x192, 512x512, SVG, PNG, and maskable)
  * [x] Implement Cache-First Service Worker in [public/sw.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/public/sw.js) and [public/service-worker.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/public/service-worker.js) with shell pre-caching, dynamic runtime caching, and SPA navigate fallback
  * [x] Implement `PwaManager` in [src/core/pwa-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/pwa-manager.js) with SW registration, standalone mode detection, online/offline monitoring, and `beforeinstallprompt` handling
  * [x] Integrate install button and live offline indicator badge into [index.html](file:///d:/Frontend/All_Projects/Apps/File-Converter/index.html), [src/styles/main.css](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/styles/main.css), and [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Create comprehensive unit test suite [tests/phase9-pwa-offline.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase9-pwa-offline.test.js) (46 assertions passed)

* [x] **Phase 10 — Testing & Edge Cases**
  * [x] Validate file picker extraction and consecutive file selection clearing
  * [x] Validate drag & drop lifecycle (dragenter, nested counters, dragleave, drop dataTransfer extraction)
  * [x] Validate multi-file queue models and categories (image, document, audio, video)
  * [x] Validate duplicate prevention (name, size, timestamp) and notification banners
  * [x] Validate all 8 bidirectional image conversion pairs, quality sliders, transparency fill, and aspect-ratio dimensions
  * [x] Validate document conversions (txt, md, html, json, pdf) and markdown compiler
  * [x] Validate audio and video transcode (mp3, wav, ogg, aac, flac, mp4, webm) and fast audio extraction
  * [x] Validate honest offline limitations for unsupported codecs and formats (docx, wma, rmvb, scanned PDFs)
  * [x] Validate corrupted & 0-byte file handling (0-byte rejection, corrupted images, invalid PDF streams)
  * [x] Validate cancellation (single item, batch) and worker aborts
  * [x] Validate retry mechanism for failed and cancelled queue items
  * [x] Validate single item download and batch download with interval throttling
  * [x] Validate dark/light/system theme cycling and localStorage persistence
  * [x] Validate mobile responsive CSS breakpoints and touch-friendly layouts
  * [x] Validate offline mode & Service Worker cache-first fetch strategy
  * [x] Validate PWA installation prompt interception, promptInstall, and standalone mode
  * [x] Validate production build bundle integrity (HTML, CSS, JS chunks, manifest, icons, WASM binaries)
  * [x] Create comprehensive test suite [tests/phase10-comprehensive-testing.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase10-comprehensive-testing.test.js) (163 assertions passed, 590 total passing across all phases)

* [x] **Phase 11 — Optimization**
  * [x] Audit ephemeral memory management: explicit `URL.revokeObjectURL()` lifecycle across preview and download actions
  * [x] Canvas buffer cleanup and offscreen context destruction with zero-copy transferable `ArrayBuffer` transfer
  * [x] Lazy loading of heavy converter dependencies (dynamic imports of `@ffmpeg/ffmpeg` and `@ffmpeg/util` only upon conversion start)
  * [x] Rollup manual chunks splitting `vendor-ffmpeg` into separate asynchronous chunk
  * [x] UI responsiveness: 60fps non-blocking execution via Web Workers with main-thread canvas fallback
  * [x] Comprehensive accessibility audit: ARIA announcements, keyboard focus navigation, high contrast support

* [x] **Phase 12 — Finalization**
  * [x] Complete production build verification with zero warnings
  * [x] Verify zero CDN dependencies and zero external runtime requests across all modules
  * [x] Verify zero server file uploads
  * [x] Production preview server verified with COOP/COEP headers on `http://localhost:4173/`
  * [x] Browser compatibility matrix documented for Chrome, Edge, Firefox, Safari, and Mobile browsers
  * [x] Transparent documentation of known limitations in README.md
  * [x] Finalize project tracking documentation (PROJECT_STATE.md, CHANGELOG.md, TODO.md, README.md)

* [x] **Phase 13 — Scanned PDF Offline OCR & Accessibility Hardening**
  * [x] Fix deprecated PWA meta warning by replacing `apple-mobile-web-app-capable` with `mobile-web-app-capable`
  * [x] Verify `beforeinstallprompt` interception, deferral, and userChoice resolution
  * [x] Fix file input accessibility: remove `aria-hidden="true"` and `tabindex="-1"`, add accessible label, apply visually-hidden CSS
  * [x] Restore sensible focus behavior to Browse button upon file selection and dialog cancellation
  * [x] Implement `ScannedPdfDetector` in `src/converters/pdf/scanned-pdf-detector.js`
  * [x] Implement `PdfPageRenderer` in `src/converters/pdf/pdf-page-renderer.js` using local PDF.js worker
  * [x] Implement `OcrManager` in `src/ocr/ocr-manager.js` and `OcrWorker` in `src/ocr/ocr-worker.js`
  * [x] Locally bundle Tesseract WebAssembly engine and English traineddata (`eng.traineddata.gz`, 10.92 MB)
  * [x] Implement granular progress reporting ("Preparing scanned PDF", "Rendering page X of N", "OCR page X of N", "Finalizing")
  * [x] Implement clear error handling for OCR failures and eliminate unhandled promise rejections
  * [x] Create comprehensive test suite in `tests/phase13-scanned-pdf-ocr.test.js` (21 assertions passed, 611 total)

---

## Current Tasks

* [x] **All Phases Complete & Verified (Phases 0 through 13)**
  * [x] Project is ready for production deployment, offline OCR, and standalone PWA use

---

## Pending Tasks

* None (Project Complete)

---

## Blocked Tasks

* None


