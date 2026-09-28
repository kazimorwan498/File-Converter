# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

* Completed Phase 1 — Application Foundation:
  * Application shell with header, title, privacy badge, theme button, drop zone, and queue section.
  * Light, Dark, and System theme handling with OS color scheme reactivity in `src/core/state-manager.js`.
  * Accessible drag-and-drop dropzone with browse button, keyboard triggers (Enter / Space), and visual dragover states.
  * Empty queue state displaying privacy benefits and feature callouts.
  * Responsive layout and CSS design system in `src/styles/main.css`.
  * Unit test suite `tests/phase1-foundation.test.js` validating all Phase 1 structural and behavioral requirements.
* Initialized project structure matching `docs/File-Structure.md` including `src/core/`, `src/converters/`, `src/workers/`, `src/utils/`, `libs/local/`, `tests/`, and `public/icons/`.
* Initialized Vite build configuration (`vite.config.js`) and `package.json` with dev scripts.

### Changed

* Updated `src/core/app.js` to manage theme cycling, drag-and-drop event wiring, and empty queue state.
* Updated `package.json` to include `npm test` script.
* Updated `PROJECT_STATE.md` and `TODO.md` to reflect Phase 1 completion.

### Fixed

* Verified standard sandbox isolation and verified production build bundling without external runtime dependencies.

### Tested

* Executed `npm test` (`tests/phase1-foundation.test.js`): All 29 assertions passed.
* Executed `npm run build`: Vite build completed in 206ms with 0 errors.
* Verified local HTTP server response on `http://localhost:3000` (HTTP 200 OK).
