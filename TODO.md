# Project TODO

## Completed Tasks

* [x] **Phase 0 — Planning & Project Setup**
  * [x] Review requirements in [PRD.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/PRD.md)
  * [x] Review folder structure in [File-Structure.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/docs/File-Structure.md)
  * [x] Initialize [PROJECT_STATE.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/PROJECT_STATE.md)
  * [x] Initialize [CHANGELOG.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/CHANGELOG.md)
  * [x] Initialize [TODO.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/TODO.md)
  * [x] Initialize [README.md](file:///d:/Frontend/All_Projects/Apps/File-Converter/README.md)
  * [x] Create project structure matching `docs/File-Structure.md`
  * [x] Initialize Vite project configuration ([vite.config.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/vite.config.js))
  * [x] Configure [package.json](file:///d:/Frontend/All_Projects/Apps/File-Converter/package.json)
  * [x] Create initial scaffolding in `src/`
* [x] **Phase 1 — Application Foundation**
  * [x] Create accessible application shell in [index.html](file:///d:/Frontend/All_Projects/Apps/File-Converter/index.html)
  * [x] Implement Light / Dark / System theme management and OS listener in [src/core/state-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/state-manager.js)
  * [x] Build modern, responsive CSS design system in [src/styles/main.css](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/styles/main.css)
  * [x] Implement application lifecycle, theme toggle button cycling, and dragover visual feedback in [src/core/app.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/app.js)
  * [x] Connect browse button and keyboard shortcuts (Enter/Space) to file picker
  * [x] Create empty queue state with feature highlights
  * [x] Create test suite [tests/phase1-foundation.test.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/tests/phase1-foundation.test.js) and configure `npm test`
  * [x] Verify production build and local server functionality

---

## Current Tasks

* [ ] Ready to start **Phase 2 — File System**
  * [ ] Implement file picker ingestion and drag & drop ingestion in [src/core/file-manager.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/core/file-manager.js)
  * [ ] Implement file validation (MIME types, size limits, duplicate detection)
  * [ ] Build queue item data structures and render queue item list in UI
  * [ ] Implement file item removal and clear queue actions

---

## Pending Tasks

### Phase 3 — Converter Engine
* [ ] Build converter registry and lifecycle manager (`src/core/converter-manager.js`)
* [ ] Define standard converter interface (`id`, `name`, `inputTypes`, `outputTypes`, `canConvert`, `convert`, `estimate`, `cancel`)
* [ ] Implement output blob and download management (`src/core/download-manager.js`)

### Phase 4 — Image Conversion
* [ ] Implement native Canvas/OffscreenCanvas image conversions (`src/converters/image/`)
* [ ] Support PNG <-> JPG/JPEG <-> WebP bidirectional conversions
* [ ] Support quality settings, resize controls, and aspect ratio locking
* [ ] Preserve PNG alpha transparency

### Phase 5 — Conversion Queue
* [ ] Implement sequential batch queue processing
* [ ] Add progress indicators, item-level cancellation, and clear queue actions
* [ ] Implement single-file and batch zip download capabilities

### Phase 6 — PDF / Document
* [ ] Evaluate and bundle local browser-compatible document libraries
* [ ] Support realistic document conversions without remote APIs or fake outputs

### Phase 7 — Audio / Video
* [ ] Integrate local WebAssembly engine (local FFmpeg WASM build)
* [ ] Support core audio and video transcode profiles locally
* [ ] Implement worker-based progress and cancellation

### Phase 8 — Web Workers
* [ ] Offload intensive conversion workflows to dedicated Web Workers (`src/workers/`)
* [ ] Maintain responsive 60fps UI during heavy file transformations

### Phase 9 — PWA / Offline
* [ ] Implement Web App Manifest (`public/manifest.json`)
* [ ] Implement Service Worker (`sw.js`) with complete cache-first offline strategy
* [ ] Provide PWA installation prompt and offline readiness indicators

### Phase 10 — Testing
* [ ] Unit test format validation and converter interfaces
* [ ] Integration test file queue, cancellation, and download lifecycle
* [ ] Verify edge cases: corrupted files, oversized files, unsupported types

### Phase 11 — Optimization
* [ ] Optimize memory footprint: explicit `URL.revokeObjectURL()`, Canvas buffer cleanup
* [ ] Audit bundle size and lazy-load converter modules

### Phase 12 — Finalization
* [ ] Production build verification
* [ ] Final browser compatibility matrix and user documentation

---

## Blocked Tasks

* None
