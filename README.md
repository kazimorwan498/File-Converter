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
- **Progressive Web App (PWA) & Offline**:
  - **Manifest & Standalone Mode**: Configured `manifest.json` enabling standalone windowed installation, native window controls, and crisp multi-resolution icons.
  - **Cache-First Service Worker**: `sw.js` pre-caches the complete application shell (`index.html`, icons, manifest) and dynamically caches runtime assets, enabling 100% offline launches and page refreshes.
  - **In-App Install Prompt**: Intercepts `beforeinstallprompt` to present a customized in-app install button that gracefully hides in standalone mode.
  - **Zero Network Dependency**: Zero external requests; operates fully disconnected after initial download.

## Supported Formats

| Category | Input Formats | Output Formats | Processing Engine |
| :--- | :--- | :--- | :--- |
| **Image** | PNG, JPG, JPEG, WebP | PNG, JPG, JPEG, WebP | Background Web Worker (`OffscreenCanvas`) / Canvas |
| **Document** | TXT, MD, Markdown, HTML, JSON, PDF | PDF, TXT, HTML | Native JS Generator / Parser / Extractor |
| **Audio** | MP3, WAV, OGG, AAC, M4A, FLAC | MP3, WAV, OGG, AAC, FLAC | Bundled FFmpeg WebAssembly |
| **Video** | MP4, WebM, MOV, MKV, AVI | MP4, WebM, MP3, WAV | Bundled FFmpeg WebAssembly |

*Note: Video-to-audio extraction (e.g. MP4 to MP3/WAV) is fully supported natively.*

## Browser Compatibility

| Browser | Minimum Version | Offline / PWA | Web Workers & OffscreenCanvas | FFmpeg WebAssembly |
| :--- | :--- | :--- | :--- | :--- |
| **Google Chrome / Chromium** | 92+ | Full Support | Full Support | Full Support (`SharedArrayBuffer` via COOP/COEP) |
| **Microsoft Edge** | 92+ | Full Support | Full Support | Full Support (`SharedArrayBuffer` via COOP/COEP) |
| **Mozilla Firefox** | 90+ | Full Support | Full Support | Full Support (`SharedArrayBuffer` via COOP/COEP) |
| **Apple Safari (macOS)** | 16.4+ | Full Support | Full Support | Supported (Safari 16.4+ with COOP/COEP) |
| **Mobile Browsers (Android/iOS)** | Android Chrome 92+ / iOS Safari 16.4+ | Full Support (Add to Home Screen) | Full Support | Supported on modern hardware |

## Known Limitations

In strict adherence to the **No Fake Conversions** core principle, unsupported conversions fail transparently with clear human-readable explanations:

1. **Complex Document Layouts (`DOCX -> PDF`, `PDF -> DOCX`)**:
   - Compiling Microsoft Word XML or reflowing complex PDF multi-column geometries requires heavy desktop office suites (e.g. MS Office, LibreOffice). These are rejected with `UNSUPPORTED_FORMAT` to protect document fidelity.
2. **Arbitrary PDF Rasterization (`PDF -> PNG/JPG`)**:
   - Rasterizing multi-page vector PDFs to bitmap images offline requires desktop Cairo or Poppler rendering runtimes.
3. **Scanned PDF OCR**:
   - The offline PDF extractor parses embedded text layers and FlateDecode streams. Image-only scanned PDFs without embedded text layers require OCR engines and will report that no text layer is present.
4. **Proprietary & DRM-Encumbered Media Codecs (`WMA`, `WMV`, `RMVB`, `M4P`)**:
   - Legacy RealMedia and proprietary Windows Media codecs are unsupported by browser-compatible WebAssembly builds and are rejected transparently.
5. **Memory Limits for Giant Video Files**:
   - 32-bit WebAssembly processes operate with a 2GB address space. Videos over 1GB should be converted on desktop software to prevent browser tab memory exhaustion.

## Development & Verification

```bash
# Run complete test suite across Phases 1 through 10 (590 passing assertions)
npm test

# Build production bundle with PWA assets and manual chunk splitting
npm run build

# Preview production build locally with COOP/COEP headers
npm run preview
```

## Project Documentation

- [docs/PRD.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/PRD.md): Product Requirements Document
- [docs/File-Structure.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/File-Structure.md): Target directory tree specification
- [PROJECT_STATE.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/PROJECT_STATE.md): Source of truth for project status
- [TODO.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/TODO.md): Task board and roadmap
- [CHANGELOG.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/CHANGELOG.md): Historical change records



