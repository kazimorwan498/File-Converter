# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

* Completed Phase 3 — Converter Engine Architecture:
  * Implemented `BaseConverter` in `src/core/base-converter.js` establishing the standard converter contract (`canConvert(file, outputFormat)`, `convert(file, options)`, `getAvailableOutputs()`, `estimate()`, `cancel()`).
  * Implemented `ConverterRegistry` in `src/core/converter-registry.js` for modular converter registration, interface validation, format matching, and dynamic target format resolution.
  * Implemented `ConverterManager` in `src/core/converter-manager.js` orchestrating the conversion lifecycle (`queued` -> `preparing` -> `converting` -> `completed` / `cancelled` / `failed`), progress dispatching, per-item `AbortController` cancellation, `cancelAll()`, and active state queries.
  * Implemented `ConversionError` in `src/core/conversion-error.js` with structured error codes (`UNSUPPORTED_FORMAT`, `NO_CONVERTER`, `CANCELLED`, `CORRUPTED_FILE`, `CONVERSION_FAILED`).
  * Connected `ConverterManager` into `App` in `src/core/app.js`.
  * Created unit test suite `tests/phase3-converter-engine.test.js` validating all 43 converter engine assertions using a clearly identified test-only mock converter.
* Completed Phase 2 — File System:
  * Implemented `FileManager` in `src/core/file-manager.js` for multi-file ingestion, file validation, metadata extraction, duplicate prevention, and queue operations.
  * Added queue item UI cards, category icons, format selectors, and notification banners.
  * Unit test suite `tests/phase2-filesystem.test.js`.
* Completed Phase 1 — Application Foundation:
  * Application shell with header, title, privacy badge, theme button, drop zone, and queue section.
  * Light, Dark, and System theme handling with OS color scheme reactivity in `src/core/state-manager.js`.
  * Unit test suite `tests/phase1-foundation.test.js`.

### Changed

* Updated `src/core/app.js` to instantiate `ConverterManager`.
* Updated `package.json` to execute Phase 1, Phase 2, and Phase 3 test suites on `npm test`.
* Updated `PROJECT_STATE.md` and `TODO.md` to reflect Phase 3 completion.

### Fixed

* Standardized `File` constructor usage across test suites for compatibility with native Node.js and browser environments.

### Tested

* Executed `npm test`: 120 assertions passed across Phase 1, Phase 2, and Phase 3 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 12 modules in 331ms with 0 errors.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.
