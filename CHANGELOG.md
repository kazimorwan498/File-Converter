# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

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

* Updated `src/core/app.js` to register `AudioConverter` and `VideoConverter`, unify `getLimitation(inExt, outExt)` across document, audio, and video engines, and display real-time limitation callout banners.
* Updated `src/utils/formatters.js` with `flac` and `avi` definitions and expanded audio/video target matrices.
* Updated `vite.config.js` with `COOP: same-origin` and `COEP: credentialless` headers, and excluded `@ffmpeg/ffmpeg` / `@ffmpeg/util` from pre-bundling.
* Updated `package.json` to bump version to `0.7.0` and execute all Phase 1 through 7 test suites on `npm test`.
* Updated `PROJECT_STATE.md`, `TODO.md`, and `README.md` to reflect Phase 7 completion.

### Fixed

* Eliminated WASM heap bloat by explicitly unlinking virtual FS files (`ffmpeg.deleteFile`) immediately following output reads.
* Guaranteed instant cancellation responsiveness by terminating the FFmpeg worker thread immediately upon `AbortSignal` trigger.
* Guaranteed honest handling for proprietary or unsupported media formats (`wma`, `rmvb`, `wmv`, `m4p`), preventing fake outputs.

### Tested

* Executed `npm test`: 338 assertions passed across Phase 1 through 7 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 31 modules with 0 errors.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.

