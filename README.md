# Offline File Converter

A 100% offline, privacy-first file conversion web application built with vanilla web technologies, Vite, Web Workers, and WebAssembly.

## Key Principles

- **100% Client-Side Processing**: No files ever leave the user's browser.
- **Zero Remote Dependencies**: No CDNs, no remote fonts, no external APIs, no tracking.
- **True Offline Capability**: Fully functional without network connectivity once installed/loaded.
- **No Fake Conversions**: Transparent support matrices with honest error handling.

## Architecture

- **UI & Layout**: Semantic HTML5 and Vanilla CSS design system with light/dark theme support.
- **Build System**: Vite with local ES Modules.
- **Core Engine**: Converter Registry pattern with standard lifecycle interface (`canConvert`, `convert`, `cancel`, `estimate`).
- **Conversion Pipelines**:
  - Image: Native Canvas / `createImageBitmap` / `OffscreenCanvas`.
  - Document / PDF: Local browser-compatible libraries.
  - Audio / Video: Locally bundled WebAssembly engine.
- **Concurrency**: Offloaded to Web Workers to ensure seamless UI responsiveness.
- **Storage & State**: `localStorage` used solely for UI preferences (theme); files and blobs managed in ephemeral memory with strict resource cleanup (`URL.revokeObjectURL`).

## Project Documentation

- [docs/PRD.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/PRD.md): Product Requirements Document
- [docs/File-Structure.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/File-Structure.md): Target directory tree specification
- [PROJECT_STATE.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/PROJECT_STATE.md): Source of truth for project status
- [TODO.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/TODO.md): Task board and roadmap
- [CHANGELOG.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/CHANGELOG.md): Historical change records
