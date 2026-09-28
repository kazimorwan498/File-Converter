# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

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

* Updated `src/core/app.js` with batch queue execution, item cancellation, retry handling, and download management.
* Updated `src/core/download-manager.js` with `downloadAll` and URL tracking.
* Updated `src/styles/main.css` with `.btn-cancel-item`, `.btn-retry-item`, and `.btn-danger` styles.
* Updated `package.json` to execute Phases 1 through 5 test suites on `npm test`.
* Updated `PROJECT_STATE.md` and `TODO.md` to reflect Phase 5 completion.

### Fixed

* Guaranteed sequential execution order during multi-file conversion to maintain 60fps UI responsiveness.
* Staggered batch download triggers to prevent browser popup blockers from dropping files.

### Tested

* Executed `npm test`: 183 assertions passed across Phase 1 through 5 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 14 modules in 256ms with 0 errors.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.
