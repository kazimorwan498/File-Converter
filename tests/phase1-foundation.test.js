import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 1: Application Foundation ---');

// 1. Check index.html markup
const indexPath = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

assert(indexHtml.includes('id="app"'), 'Contains root #app container');
assert(indexHtml.includes('id="theme-toggle"'), 'Contains #theme-toggle button');
assert(indexHtml.includes('id="theme-label"'), 'Contains #theme-label');
assert(indexHtml.includes('id="drop-zone"'), 'Contains #drop-zone');
assert(indexHtml.includes('id="file-input"'), 'Contains #file-input');
assert(indexHtml.includes('id="browse-btn"'), 'Contains #browse-btn');
assert(indexHtml.includes('id="queue-section"'), 'Contains #queue-section');
assert(indexHtml.includes('id="queue-empty-state"'), 'Contains #queue-empty-state');
assert(indexHtml.includes('id="convert-all-btn"'), 'Contains #convert-all-btn');
assert(indexHtml.includes('id="download-all-btn"'), 'Contains #download-all-btn');
assert(indexHtml.includes('id="clear-all-btn"'), 'Contains #clear-all-btn');
assert(indexHtml.includes('id="a11y-announcer"'), 'Contains #a11y-announcer for accessibility');
assert(indexHtml.includes('100% Private'), 'Includes privacy messaging');

// 2. Check main.css tokens
const cssPath = path.join(rootDir, 'src', 'styles', 'main.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert(cssContent.includes(':root'), 'CSS includes :root design tokens');
assert(cssContent.includes('[data-theme="light"]'), 'CSS includes light theme overrides');
assert(cssContent.includes('[data-theme-setting="dark"]'), 'CSS includes dark theme setting icon rules');
assert(cssContent.includes('[data-theme-setting="system"]'), 'CSS includes system theme setting icon rules');
assert(cssContent.includes('.drop-zone.dragover'), 'CSS includes dragover visual styles');
assert(cssContent.includes('.queue-empty-state'), 'CSS includes empty queue state styles');
assert(cssContent.includes('@media (max-width: 640px)'), 'CSS includes responsive mobile media query');

// 3. Check StateManager and App imports
const stateManagerPath = path.join(rootDir, 'src', 'core', 'state-manager.js');
const stateManagerContent = fs.readFileSync(stateManagerPath, 'utf-8');
assert(stateManagerContent.includes('export class StateManager'), 'StateManager is exported');
assert(stateManagerContent.includes('getThemePreference'), 'StateManager includes getThemePreference');
assert(stateManagerContent.includes('resolveTheme'), 'StateManager includes resolveTheme');
assert(stateManagerContent.includes('onSystemThemeChange'), 'StateManager includes onSystemThemeChange');

const appPath = path.join(rootDir, 'src', 'core', 'app.js');
const appContent = fs.readFileSync(appPath, 'utf-8');
assert(appContent.includes('export class App'), 'App is exported');
assert(appContent.includes('initThemeSystem'), 'App initializes theme system');
assert(appContent.includes('bindDropZoneEvents'), 'App binds drop zone events');
assert(appContent.includes('bindQueueEvents'), 'App binds empty queue state');
assert(appContent.includes('cycleTheme'), 'App supports cycling theme');

console.log('--- Phase 1 Test Run Completed ---');
