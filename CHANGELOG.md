# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

* Completed Phase 4 — Image Conversion:
  * Implemented `ImageConverter` in `src/converters/image/image-converter.js` using browser-native Canvas, `OffscreenCanvas`, and `createImageBitmap`.
  * Implemented bidirectional conversions for all required image pairs: PNG &rarr; JPG, PNG &rarr; WebP, JPG &rarr; PNG, JPG &rarr; WebP, JPEG &rarr; PNG, JPEG &rarr; WebP, WebP &rarr; PNG, WebP &rarr; JPG.
  * Added quality control slider (0.01 - 1.0) with live percentage readout for lossy formats (JPG, WebP).
  * Added transparency background handling: automatically fills a clean white background when converting transparent images to JPG/JPEG, and preserves alpha channel for PNG/WebP.
  * Added image dimensions detection and aspect-ratio-locked resizing.
  * Added real-time image thumbnail previews (`img.item-thumbnail`) using local object URLs.
  * Added progress bar updates during conversion (decode &rarr; render &rarr; encode &rarr; complete).
  * Added individual "Convert" and "Download" buttons on queue item cards.
  * Added "Convert All" and "Download All" operations in queue header.
  * Created unit test suite `tests/phase4-image-conversion.test.js` validating all 37 image conversion assertions.
* Completed Phase 3 — Converter Engine Architecture:
  * Implemented `BaseConverter`, `ConverterRegistry`, `ConverterManager`, and `ConversionError`.
  * Created unit test suite `tests/phase3-converter-engine.test.js`.
* Completed Phase 2 — File System:
  * Implemented `FileManager` with multi-file ingestion, file validation, duplicate prevention, and queue operations.
  * Unit test suite `tests/phase2-filesystem.test.js`.
* Completed Phase 1 — Application Foundation:
  * Application shell with header, title, privacy badge, theme button, drop zone, and queue section.
  * Unit test suite `tests/phase1-foundation.test.js`.

### Changed

* Updated `src/core/app.js` to register `ImageConverter`, display thumbnails, show quality sliders, and execute conversions.
* Updated `src/styles/main.css` with thumbnail preview, dimensions badge, quality slider, and progress bar styles.
* Updated `package.json` to execute Phases 1 through 4 test suites on `npm test`.
* Updated `PROJECT_STATE.md` and `TODO.md` to reflect Phase 4 completion.

### Fixed

* Memory leak prevention: Image preview URLs are tracked and explicitly revoked upon removal or queue clearing.
* Prevented black background artifacts on transparent PNGs converted to JPG by drawing solid white background.

### Tested

* Executed `npm test`: 157 assertions passed across Phase 1, Phase 2, Phase 3, and Phase 4 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 14 modules in 404ms with 0 errors.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.
