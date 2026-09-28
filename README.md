# Offline File Converter

A 100% offline, privacy-first file conversion web application built with vanilla web technologies, Vite, Web Workers, and WebAssembly.

## Key Principles

- **100% Client-Side Processing**: No files ever leave the user's browser.
- **Zero Remote Dependencies**: No CDNs, no remote fonts, no external APIs, no tracking.
- **True Offline Capability**: Fully functional without network connectivity once installed/loaded.
- **No Fake Conversions**: Transparent support matrices with honest error handling and UI limitation explanations.

## Architecture

- **UI & Layout**: Semantic HTML5 and Vanilla CSS design system with light/dark/system theme support.
- **Build System**: Vite with local ES Modules and local static assets.
- **Core Engine**: Converter Registry pattern with standard lifecycle interface (`canConvert`, `convert`, `cancel`, `getConversionLimitation`).
- **Conversion Pipelines**:
  - **Image Conversion**: Background Web Worker execution (`image.worker.js`) using `OffscreenCanvas` and `createImageBitmap` (PNG, JPG, JPEG, WebP) with zero-copy buffer transfer and transparent main-thread fallback.
  - **Document Conversion**: Pure JavaScript offline PDF 1.4 multi-page document generator (`PdfDocument`), Markdown compiler (`MarkdownParser`), and PDF text extractor (`PdfExtractor`).
  - **Audio & Video Conversion**: Locally bundled FFmpeg 0.12 WebAssembly engine (`ffmpeg-core.js` and `ffmpeg-core.wasm` in `public/ffmpeg/` and `libs/local/ffmpeg/`) running in a dedicated WASM worker.
- **Memory Hygiene**: Ephemeral memory management, zero-copy transferable `ArrayBuffer` pipelines, automatic unlinking of virtual filesystem files (`deleteFile`), idle worker termination, and explicit `URL.revokeObjectURL()` cleanup.
- **Concurrency & Responsiveness**: Heavy CPU workloads offloaded to dedicated Web Workers to maintain a 60fps responsive UI; instant cancellation with worker termination; non-blocking sequential queue execution.

## Supported Formats

| Category | Input Formats | Output Formats | Processing Engine |
| :--- | :--- | :--- | :--- |
| **Image** | PNG, JPG, JPEG, WebP | PNG, JPG, JPEG, WebP | Background Web Worker (`OffscreenCanvas`) / Canvas |
| **Document** | TXT, MD, Markdown, HTML, JSON, PDF | PDF, TXT, HTML | Native JS Generator / Parser / Extractor |
| **Audio** | MP3, WAV, OGG, AAC, M4A, FLAC | MP3, WAV, OGG, AAC, FLAC | Bundled FFmpeg WebAssembly |
| **Video** | MP4, WebM, MOV, MKV, AVI | MP4, WebM, MP3, WAV | Bundled FFmpeg WebAssembly |

*Note: Video-to-audio extraction (e.g. MP4 to MP3/WAV) is fully supported natively.*

## Project Documentation

- [docs/PRD.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/PRD.md): Product Requirements Document
- [docs/File-Structure.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/File-Structure.md): Target directory tree specification
- [PROJECT_STATE.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/PROJECT_STATE.md): Source of truth for project status
- [TODO.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/TODO.md): Task board and roadmap
- [CHANGELOG.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/CHANGELOG.md): Historical change records

