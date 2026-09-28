# Offline File Converter — Product Requirements Document

use `File-Structure.md` for file structuring

## 1. Product Overview

Build a modern, privacy-focused, completely offline file conversion web application.

The application must process files locally inside the user's browser/device.

No user file may be uploaded to a server.

The application must continue functioning without an internet connection after all required local assets have been installed/cached.

---

## 2. Product Goals

### Primary Goals

- 100% local file processing
- No backend
- No cloud conversion
- No file uploads
- No advertisements
- No tracking
- No analytics
- Modern responsive UI
- Multiple file support
- Conversion queue
- Conversion progress
- Download converted files
- Offline/PWA support
- Modular converter architecture

### Secondary Goals

- Good performance
- Large-file handling where browser capabilities allow
- Web Worker support
- WASM support for CPU-intensive conversions
- Accessible UI
- Keyboard support
- Dark/light theme

---

# 3. Non-Goals

The application will NOT:

- upload files to a remote server
- use online conversion APIs
- depend on CDN resources at runtime
- use analytics
- track users
- include advertisements
- pretend unsupported conversions succeeded

---

# 4. Privacy Requirements

All file processing must happen locally.

The application must never send:

- file contents
- filenames
- metadata
- conversion data

to external servers.

No external API should be required for normal operation.

---

# 5. Offline Requirements

The application must work without internet access.

All runtime dependencies must be local.

Forbidden runtime dependencies:

- CDN JavaScript
- CDN CSS
- remote fonts
- remote APIs
- online conversion services
- external analytics

If a third-party library is required, it must be bundled locally.

---

# 6. Supported Conversion Architecture

The application must use a converter registry.

Example:

```js
{
  input: "image/png",
  outputs: ["image/jpeg", "image/webp"]
}
```

Each converter should expose a common interface.

Example:

```js
{
  (id,
    name,
    inputTypes,
    outputTypes,
    canConvert(),
    convert(),
    estimate(),
    cancel());
}
```

The converter manager must dynamically determine which converters are available for a selected file.

---

# 7. Initial Image Conversions

Implement:

- PNG → JPG
- PNG → WebP
- JPG → PNG
- JPG → WebP
- JPEG → PNG
- JPEG → WebP
- WebP → PNG
- WebP → JPG
- WebP → JPEG

Use browser-native APIs where possible.

Recommended APIs:

- File API
- Blob
- Canvas
- createImageBitmap
- OffscreenCanvas where supported

---

# 8. Image Conversion Settings

For formats supporting quality:

- Quality slider
- Default quality
- Output format
- Optional resize
- Width
- Height
- Maintain aspect ratio

For PNG:

- Preserve transparency when applicable

---

# 9. PDF / Document Architecture

Document conversion must use locally bundled browser-compatible libraries.

The system should support practical browser-compatible conversions.

Do not implement fake conversion.

If reliable browser-only conversion is not possible, mark the conversion as unsupported.

---

# 10. Audio / Video Architecture

Audio/video conversion may use a locally bundled WebAssembly FFmpeg implementation.

Requirements:

- No online FFmpeg API
- Local WASM assets
- Worker-based processing where possible
- Progress reporting
- Cancellation
- Error handling

Potential formats:

Audio:

- MP3
- WAV
- OGG
- AAC
- M4A

Video:

- MP4
- WebM
- MOV
- MKV

Only implement formats that can actually be supported by the selected local WASM build.

---

# 11. File Queue

The application must support multiple files.

Each queue item must contain:

```js
{
  (id,
    file,
    name,
    size,
    type,
    inputFormat,
    outputFormat,
    status,
    progress,
    outputBlob,
    error);
}
```

Possible statuses:

- queued
- preparing
- converting
- completed
- cancelled
- failed

---

# 12. User Interface

Main UI:

1. Header
2. Application name
3. Theme toggle
4. File drop zone
5. Browse button
6. File queue
7. Conversion settings
8. Progress indicator
9. Cancel button
10. Download button
11. Download All button
12. Clear button

---

# 13. Drag & Drop

Users can drag files into the application.

Requirements:

- Visual drag-over state
- Multiple files
- Unsupported-file handling
- Duplicate handling

---

# 14. Download System

Users must be able to:

- Download individual converted files
- Download all converted files
- Choose output filename where appropriate

Use:

```js
URL.createObjectURL();
```

and properly call:

```js
URL.revokeObjectURL();
```

when URLs are no longer required.

---

# 15. Performance

Heavy processing must not unnecessarily block the UI.

Use:

- Web Workers
- WASM
- OffscreenCanvas
- Lazy loading
- Efficient Blob handling

where appropriate.

---

# 16. Error Handling

Handle:

- Unsupported format
- Corrupted files
- Invalid files
- Memory limitations
- WASM loading errors
- Conversion errors
- Browser compatibility issues
- Cancellation
- Large files

Errors must be understandable to normal users.

---

# 17. PWA

Implement:

- manifest.json
- service-worker.js
- installable application
- offline cache

The service worker must cache all required application assets.

---

# 18. Accessibility

Support:

- Keyboard navigation
- Focus states
- Screen-reader-friendly labels
- Semantic HTML
- Appropriate ARIA attributes

---

# 19. Theme

Support:

- Light mode
- Dark mode
- System preference

Persist theme preference locally.

Use:

```js
localStorage;
```

for UI preferences only.

Do not store user files in localStorage.

---

# 20. Technology

Preferred stack:

- HTML
- CSS
- Vanilla JavaScript
- ES Modules
- Vite
- Web Workers
- WebAssembly where necessary

Avoid unnecessary frameworks.

---

# 21. Project State System

The AI development agent MUST maintain:

```text
PROJECT_STATE.md
CHANGELOG.md
TODO.md
```

After every completed development step:

1. Read current PROJECT_STATE.md
2. Perform the requested work
3. Test the implementation
4. Update PROJECT_STATE.md
5. Update CHANGELOG.md
6. Update TODO.md
7. Record unfinished work
8. Record known problems
9. Record the next recommended step

The state file is the source of truth for project progress.

---

# 22. PROJECT_STATE.md Requirements

It must contain:

```md
# Project State

## Current Phase

## Completed Phases

## Current Task

## Completed Tasks

## Files Created

## Files Modified

## Dependencies Added

## Converters Implemented

## Tests Passed

## Tests Failed

## Known Issues

## Pending Tasks

## Next Recommended Task

## Important Decisions

## Do Not Repeat

## Last Updated
```

---

# 23. AI Continuation Rules

Before executing ANY development command:

1. Read `PROJECT_STATE.md`
2. Read relevant sections of `docs/PRD.md`
3. Inspect the existing project files
4. Determine what has already been implemented
5. Never recreate existing functionality unnecessarily
6. Continue from the current state
7. Preserve working code
8. Make the smallest safe changes
9. Test the result
10. Update project state

Never assume that a previous task was completed just because the command says it was completed.

Verify the actual files.

---

# 24. Development Phases

## Phase 0 — Project Planning

Create:

- PRD
- project structure
- state management documents

## Phase 1 — Application Foundation

Implement:

- Vite
- HTML
- CSS
- JavaScript
- application shell
- theme
- basic UI

## Phase 2 — File System

Implement:

- file picker
- drag & drop
- file validation
- file queue
- file metadata

## Phase 3 — Converter Engine

Implement:

- converter registry
- converter manager
- conversion interface
- output handling

## Phase 4 — Image Conversion

Implement browser-native image conversions.

## Phase 5 — Conversion Queue

Implement:

- multiple files
- sequential conversion
- progress
- cancellation
- retry

## Phase 6 — PDF / Document

Implement supported document conversions.

## Phase 7 — Audio / Video

Integrate local WASM conversion engine.

## Phase 8 — Web Workers

Move heavy operations into workers.

## Phase 9 — PWA / Offline

Implement:

- service worker
- manifest
- offline caching
- install support

## Phase 10 — Testing

Test:

- supported formats
- unsupported formats
- corrupted files
- large files
- multiple files
- cancellation
- offline mode

## Phase 11 — Optimization

Optimize:

- memory
- performance
- bundle size
- loading
- UI responsiveness

## Phase 12 — Finalization

Complete:

- README
- documentation
- production build
- final testing
- known issues
- browser compatibility documentation

---

# 25. Definition of Done

The application is considered complete only when:

- Production build succeeds
- No runtime console errors exist
- Image conversion works
- Queue works
- Download works
- Offline mode works
- PWA works
- Unsupported conversions are correctly rejected
- No external runtime dependency exists
- No files are uploaded
- Project state is updated
- Documentation is complete
