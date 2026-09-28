# Changelog

All notable changes to the Offline File Converter project will be documented in this file.

## 2026-09-28

### Added

* Initialized project structure matching `docs/File-Structure.md` including `src/core/`, `src/converters/`, `src/workers/`, `src/utils/`, `libs/local/`, `tests/`, and `public/icons/`.
* Initialized Vite build configuration (`vite.config.js`) and `package.json` with dev scripts.
* Created `index.html` with accessible markup, theme toggle, drop zone, queue UI shell, and privacy badge.
* Created `src/styles/main.css` containing comprehensive design tokens, light/dark themes, glassmorphism, and responsive layout.
* Created modular scaffolding: `src/main.js`, `src/core/app.js`, `src/core/state-manager.js`, `src/core/converter-manager.js`, `src/core/file-manager.js`, `src/core/download-manager.js`, and `src/utils/formatters.js`.
* Created `public/manifest.json` for PWA capabilities.
* Created `.gitignore` to prevent tracking of build artifacts and dependencies.
* Initialized `PROJECT_STATE.md`, `TODO.md`, `CHANGELOG.md`, and `README.md`.

### Changed

* Formalized Phase 0 (Planning & Setup) deliverables and established project governance rules.

### Fixed

* Verified sandbox execution for Node.js toolchain and Vite bundler.

### Tested

* Executed `npm run build` with Vite 5: successfully bundled production assets in 203ms with 0 errors.
* Tested Vite development server startup: verified instant local startup (487ms).
* Verified filesystem structure against `docs/File-Structure.md`.
