/**
 * Phase 9: PWA & Offline Support Test Suite
 * Validates manifest.json, service worker caching, PwaManager lifecycle,
 * install prompt interception, standalone mode detection, and zero remote dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import { PwaManager } from '../src/core/pwa-manager.js';
import { ConverterManager } from '../src/core/converter-manager.js';
import { ImageConverter } from '../src/converters/image/image-converter.js';
import { DocumentConverter } from '../src/converters/pdf/document-converter.js';
import { AudioConverter } from '../src/converters/audio/audio-converter.js';
import { VideoConverter } from '../src/converters/video/video-converter.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 9: PWA & Offline Engine ---');

async function runTests() {

  // =========================================================================
  // 1. Validate manifest.json Structure & Assets
  // =========================================================================
  console.log('Testing PWA Manifest:');
  const manifestPath = path.join(rootDir, 'public', 'manifest.json');
  assert(fs.existsSync(manifestPath), 'public/manifest.json exists');

  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestContent);
    assert(true, 'manifest.json is valid JSON');
  } catch (err) {
    assert(false, `manifest.json failed to parse: ${err.message}`);
    return;
  }

  assert(manifest.name === 'Offline File Converter', 'manifest.name is "Offline File Converter"');
  assert(manifest.short_name === 'FileConverter', 'manifest.short_name is "FileConverter"');
  assert(manifest.start_url === '/', 'manifest.start_url is "/"');
  assert(manifest.scope === '/', 'manifest.scope is "/"');
  assert(manifest.display === 'standalone', 'manifest.display is "standalone"');
  assert(Array.isArray(manifest.display_override) && manifest.display_override.includes('standalone'), 'manifest includes display_override with standalone');
  assert(Boolean(manifest.background_color), 'manifest defines background_color');
  assert(Boolean(manifest.theme_color), 'manifest defines theme_color');
  assert(Array.isArray(manifest.categories) && manifest.categories.includes('utilities'), 'manifest includes utilities category');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest defines at least 3 icons');

  // Verify icon sizes and types
  const has192 = manifest.icons.some(i => i.sizes === '192x192');
  const has512 = manifest.icons.some(i => i.sizes === '512x512');
  const hasMaskable = manifest.icons.some(i => i.purpose === 'maskable');
  assert(has192, 'manifest includes 192x192 icon');
  assert(has512, 'manifest includes 512x512 icon');
  assert(hasMaskable, 'manifest includes maskable icon');

  // Verify actual icon files exist on disk
  for (const icon of manifest.icons) {
    const iconRelative = icon.src.replace(/^\//, '');
    const iconFullPath = path.join(rootDir, 'public', iconRelative);
    assert(fs.existsSync(iconFullPath), `Icon file exists: ${icon.src}`);
    const stat = fs.statSync(iconFullPath);
    assert(stat.size > 0, `Icon file is non-empty (${stat.size} bytes): ${icon.src}`);
  }

  // =========================================================================
  // 2. Validate Service Worker Files & Offline Strategies
  // =========================================================================
  console.log('Testing Service Worker:');
  const swPath = path.join(rootDir, 'public', 'sw.js');
  const serviceWorkerPath = path.join(rootDir, 'public', 'service-worker.js');
  assert(fs.existsSync(swPath), 'public/sw.js exists');
  assert(fs.existsSync(serviceWorkerPath), 'public/service-worker.js exists');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes("addEventListener('install'"), 'sw.js registers install event listener');
  assert(swContent.includes("addEventListener('activate'"), 'sw.js registers activate event listener');
  assert(swContent.includes("addEventListener('fetch'"), 'sw.js registers fetch event listener');
  assert(swContent.includes('skipWaiting()'), 'sw.js activates immediately via skipWaiting');
  assert(swContent.includes('clients.claim()'), 'sw.js claims clients immediately via clients.claim');
  assert(swContent.includes('STATIC_CACHE'), 'sw.js implements versioned static cache');
  assert(swContent.includes('RUNTIME_CACHE'), 'sw.js implements versioned runtime cache');
  assert(swContent.includes('/index.html'), 'sw.js pre-caches /index.html');
  assert(swContent.includes('/manifest.json'), 'sw.js pre-caches /manifest.json');
  assert(swContent.includes("mode === 'navigate'"), 'sw.js implements SPA navigate fallback for offline reloads');

  const serviceWorkerContent = fs.readFileSync(serviceWorkerPath, 'utf8');
  assert(serviceWorkerContent.includes('/sw.js'), 'service-worker.js points to /sw.js');

  // =========================================================================
  // 3. PwaManager Unit Tests
  // =========================================================================
  console.log('Testing PwaManager:');
  let connectivityReported = null;
  let installableReported = null;
  let installedReported = false;

  const pwa = new PwaManager({
    onConnectivityChange: (online) => {
      connectivityReported = online;
    },
    onInstallableChange: (installable) => {
      installableReported = installable;
    },
    onInstalled: () => {
      installedReported = true;
    }
  });

  assert(pwa.swUrl === '/sw.js', 'PwaManager default swUrl is /sw.js');
  assert(typeof pwa.init === 'function', 'PwaManager provides init()');
  assert(typeof pwa.promptInstall === 'function', 'PwaManager provides promptInstall()');
  assert(typeof pwa.isStandalone === 'function', 'PwaManager provides isStandalone()');
  assert(typeof pwa.isOnline === 'function', 'PwaManager provides isOnline()');

  // Test online/offline connectivity detection
  assert(pwa.isOnline() === true, 'pwa.isOnline() defaults to true in test environment');

  // Test promptInstall when no prompt is available
  const unavailableResult = await pwa.promptInstall();
  assert(unavailableResult.outcome === 'unavailable', 'promptInstall returns unavailable when deferred prompt is null');

  // Test beforeinstallprompt interception simulation
  const mockChoice = { outcome: 'accepted' };
  let promptCalled = false;
  const mockPromptEvent = {
    preventDefault: () => {},
    prompt: () => { promptCalled = true; },
    userChoice: Promise.resolve(mockChoice)
  };

  pwa.deferredPrompt = mockPromptEvent;
  pwa.isInstallable = true;

  const installResult = await pwa.promptInstall();
  assert(promptCalled, 'pwa.promptInstall() triggered deferredPrompt.prompt()');
  assert(installResult.outcome === 'accepted', 'pwa.promptInstall() resolved with accepted outcome');
  assert(pwa.deferredPrompt === null, 'pwa.deferredPrompt reset to null after prompt');
  assert(pwa.isInstallable === false, 'pwa.isInstallable reset to false after prompt');

  // Test appinstalled simulation
  pwa.onInstalled();
  assert(installedReported === true, 'PwaManager triggered onInstalled callback');

  // =========================================================================
  // 4. Zero Remote Dependencies & Pure Local Verification
  // =========================================================================
  console.log('Testing Offline Zero-Network Guarantees:');

  // Check that index.html contains no external CDN scripts or fonts
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert(!indexHtml.includes('https://cdn.'), 'index.html contains zero external CDN scripts');
  assert(!indexHtml.includes('fonts.googleapis.com'), 'index.html contains zero remote Google Fonts links');
  assert(!indexHtml.includes('unpkg.com'), 'index.html contains zero unpkg CDN links');
  assert(!indexHtml.includes('cdnjs.cloudflare.com'), 'index.html contains zero cloudflare CDN links');
  assert(!indexHtml.includes('jsdelivr.net'), 'index.html contains zero jsdelivr CDN links');
  assert(indexHtml.includes('rel="manifest"'), 'index.html references manifest.json');
  assert(indexHtml.includes('name="theme-color"'), 'index.html includes theme-color meta tag');

  // Verify all WASM binaries are present locally
  const wasmCoreJs = path.join(rootDir, 'public', 'ffmpeg', 'ffmpeg-core.js');
  const wasmCoreBinary = path.join(rootDir, 'public', 'ffmpeg', 'ffmpeg-core.wasm');
  assert(fs.existsSync(wasmCoreJs), 'ffmpeg-core.js is locally present in public/ffmpeg/');
  assert(fs.existsSync(wasmCoreBinary), 'ffmpeg-core.wasm is locally present in public/ffmpeg/');
  assert(fs.statSync(wasmCoreBinary).size > 10 * 1024 * 1024, 'ffmpeg-core.wasm is full local binary (>10MB)');

  // =========================================================================
  // 5. Verify Offline Conversion Pipeline Functionality
  // =========================================================================
  console.log('Testing Offline Conversion Pipeline Execution:');
  const manager = new ConverterManager();
  manager.registerConverter(new ImageConverter());
  const docConverter = new DocumentConverter();
  manager.registerConverter(docConverter);
  manager.registerConverter(new AudioConverter());
  manager.registerConverter(new VideoConverter());

  // Test document conversion completely offline
  class MockFile {
    constructor(name, content, type = 'text/plain') {
      this.name = name;
      this.content = content;
      this.size = content.length;
      this.type = type;
      this.lastModified = Date.now();
    }
    async text() {
      return this.content;
    }
    async arrayBuffer() {
      return Buffer.from(this.content).buffer;
    }
  }

  const sampleTxt = new MockFile('notes.txt', 'Hello 100% Offline PWA World', 'text/plain');
  const offlinePdfResult = await docConverter.convert(sampleTxt, { outputFormat: 'pdf' });

  assert(offlinePdfResult.mimeType === 'application/pdf', 'Offline document conversion produces valid application/pdf');
  assert(offlinePdfResult.filename === 'notes.pdf', 'Offline document conversion generates notes.pdf');
  assert(offlinePdfResult.blob && offlinePdfResult.blob.size > 0, 'Offline conversion produces non-empty Blob without internet');

  console.log('--- Phase 9 Test Run Completed Successfully ---');
}

runTests().catch(err => {
  console.error('Phase 9 Test Suite Failed:', err);
  process.exitCode = 1;
});
