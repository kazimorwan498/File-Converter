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
  * [x] Create accessible application shell in [index.html](file:///d:/Frontend/All_Projects/Apps/File-Converter/index.html)
  * [x] Create CSS design tokens and theme system in [src/styles/main.css](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/styles/main.css)
  * [x] Create core scaffolding in `src/` ([main.js](file:///d:/Frontend/All_Projects/Apps/File-Converter/src/main.js), `src/core/`, `src/utils/`)
  * [x] Create directory placeholders for converters, workers, libs, and tests (without implementing converters)
  * [x] Run development and build checks (`npm run build` and Vite dev server test)

---

## Current Tasks

* [ ] Ready to start **Phase 1 — Application Foundation**
  * [ ] Connect theme switcher toggle and test dark/light transitions
  * [ ] Bind basic drop zone events and visual hover states
  * [ ] Build application shell interaction and status feedback

---

## Pending Tasks

### Phase 2 — File System
* [ ] Implement file picker and drag-and-drop zone (`src/core/file-manager.js`)
* [ ] Implement file validation (MIME type inspection, size checking, duplicate detection)
* [ ] Implement queue data structures and status management

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
