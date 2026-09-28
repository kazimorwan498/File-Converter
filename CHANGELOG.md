# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

* Completed Phase 2 — File System:
  * Implemented `FileManager` in `src/core/file-manager.js` for multi-file ingestion, file validation, metadata extraction, duplicate prevention, and queue operations.
  * Added duplicate detection algorithm comparing file name, size, and lastModified timestamp.
  * Added validation rejecting 0-byte empty files and unsupported extensions with descriptive reasons.
  * Added queue item UI cards in `src/core/app.js` with category icons (image, document, audio, video), filename ellipsis, size, input format badges, format selector dropdowns, status pills, and remove buttons.
  * Added notification banner component for rejections and duplicate alerts with dismiss button and screen-reader announcements.
  * Added clear queue functionality restoring clean empty state.
  * Extended `src/utils/formatters.js` with format support dictionaries, category categorization, and default/available outputs.
  * Created unit test suite `tests/phase2-filesystem.test.js` validating all 48 Phase 2 assertions.
* Completed Phase 1 — Application Foundation:
  * Application shell with header, title, privacy badge, theme button, drop zone, and queue section.
  * Light, Dark, and System theme handling with OS color scheme reactivity in `src/core/state-manager.js`.
  * Accessible drag-and-drop dropzone with browse button, keyboard triggers, and visual dragover states.
  * Empty queue state displaying privacy benefits and feature callouts.
  * Responsive layout and CSS design system in `src/styles/main.css`.
  * Unit test suite `tests/phase1-foundation.test.js`.
* Initialized project structure matching `docs/File-Structure.md` including Vite build setup.

### Changed

* Updated `src/core/app.js` to coordinate between `FileManager` and DOM queue rendering.
* Updated `src/styles/main.css` with responsive queue item cards, category badges, format selectors, and warning banners.
* Updated `package.json` to execute both Phase 1 and Phase 2 test suites on `npm test`.
* Updated `PROJECT_STATE.md` and `TODO.md` to reflect Phase 2 completion.

### Fixed

* Handled nested drag events properly via drag counter to prevent dragover state flickering.
* Reset file input value after selection to allow re-selection of previously removed files.

### Tested

* Executed `npm test`: 77 assertions passed across Phase 1 and Phase 2 test suites with 0 failures.
* Executed `npm run build`: Production bundle transformed 8 modules in 208ms with 0 errors.
* Dev server HTTP check: `http://localhost:3000` is active and responsive.
