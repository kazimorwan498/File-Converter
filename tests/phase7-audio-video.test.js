import { MediaEngine } from '../src/converters/audio/media-engine.js';
import { AudioConverter, AUDIO_CONVERSION_LIMITATIONS } from '../src/converters/audio/audio-converter.js';
import { VideoConverter, VIDEO_CONVERSION_LIMITATIONS } from '../src/converters/video/video-converter.js';
import { ConverterRegistry } from '../src/core/converter-registry.js';
import { ConverterManager } from '../src/core/converter-manager.js';
import { ConversionError } from '../src/core/conversion-error.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('--- Testing Phase 7: Local WASM Audio & Video Conversion ---');

// Helper to generate a small 100ms valid PCM WAV file in memory
function createSampleWav(durationSeconds = 0.1, sampleRate = 8000) {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  return new Uint8Array(buffer);
}

// Mock File and Blob for Node test environment if needed
class MockFile {
  constructor(bits, name, options = {}) {
    this.name = name;
    this.type = options.type || '';
    this.lastModified = Date.now();
    this.bits = bits;
    this.size = bits.reduce((acc, b) => acc + (b.length || (typeof b === 'string' ? b.length : 0)), 0);
  }
  async arrayBuffer() {
    if (this.bits[0] instanceof Uint8Array) {
      return this.bits[0].buffer;
    }
    const text = typeof this.bits[0] === 'string' ? this.bits[0] : '';
    return new TextEncoder().encode(text).buffer;
  }
}

class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.length || (typeof p === 'string' ? p.length : 0)), 0);
  }
}

if (typeof globalThis.File === 'undefined') {
  globalThis.File = MockFile;
}
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = MockBlob;
}

async function runTests() {
  // =========================================================================
  // 1. MediaEngine Architecture & Argument Builder Tests
  // =========================================================================
  const engine1 = MediaEngine.getInstance();
  const engine2 = MediaEngine.getInstance();
  assert(engine1 === engine2, 'MediaEngine implements singleton pattern');

  // Verify command line arguments
  const mp3Args = engine1.buildArgs('in.wav', 'out.mp3', 'mp3');
  assert(mp3Args.includes('-vn') && mp3Args.includes('libmp3lame'), 'MP3 args configure libmp3lame and strip video');

  const wavArgs = engine1.buildArgs('in.mp3', 'out.wav', 'wav');
  assert(wavArgs.includes('-vn') && wavArgs.includes('pcm_s16le'), 'WAV args configure 16-bit PCM');

  const oggArgs = engine1.buildArgs('in.wav', 'out.ogg', 'ogg');
  assert(oggArgs.includes('-vn') && oggArgs.includes('libvorbis'), 'OGG args configure libvorbis');

  const mp4Args = engine1.buildArgs('in.mov', 'out.mp4', 'mp4');
  assert(mp4Args.includes('libx264') && mp4Args.includes('aac'), 'MP4 args configure H.264 and AAC');

  const webmArgs = engine1.buildArgs('in.mp4', 'out.webm', 'webm');
  assert(webmArgs.includes('libvpx') && webmArgs.includes('libvorbis'), 'WebM args configure VPX and Vorbis');

  // MIME mappings
  assert(engine1.getMimeType('mp3') === 'audio/mpeg', 'MIME for mp3 is audio/mpeg');
  assert(engine1.getMimeType('wav') === 'audio/wav', 'MIME for wav is audio/wav');
  assert(engine1.getMimeType('ogg') === 'audio/ogg', 'MIME for ogg is audio/ogg');
  assert(engine1.getMimeType('mp4') === 'video/mp4', 'MIME for mp4 is video/mp4');
  assert(engine1.getMimeType('webm') === 'video/webm', 'MIME for webm is video/webm');

  // =========================================================================
  // 2. AudioConverter Contract & Conversion Tests
  // =========================================================================
  const audioConverter = new AudioConverter();
  assert(audioConverter.id === 'native-audio-converter', 'AudioConverter id is native-audio-converter');

  // canConvert tests
  assert(audioConverter.canConvert('mp3', 'wav') === true, 'canConvert supports mp3 -> wav');
  assert(audioConverter.canConvert('wav', 'mp3') === true, 'canConvert supports wav -> mp3');
  assert(audioConverter.canConvert('ogg', 'mp3') === true, 'canConvert supports ogg -> mp3');
  assert(audioConverter.canConvert('aac', 'wav') === true, 'canConvert supports aac -> wav');
  assert(audioConverter.canConvert('flac', 'mp3') === true, 'canConvert supports flac -> mp3');
  assert(audioConverter.canConvert('m4a', 'wav') === true, 'canConvert supports m4a -> wav');

  // Unsupported formats (Never faked)
  assert(audioConverter.canConvert('wma', 'mp3') === false, 'canConvert rejects unsupported wma input');
  assert(audioConverter.canConvert('mp3', 'pdf') === false, 'canConvert rejects mp3 -> pdf');

  // Limitation reporting
  const limWma = audioConverter.getConversionLimitation('wma', 'mp3');
  assert(limWma.isSupported === false, 'getConversionLimitation marks wma unsupported');
  assert(limWma.reason.includes('WMA') || limWma.reason.includes('proprietary'), 'Limitation explains proprietary WMA restriction');

  const limM4p = audioConverter.getConversionLimitation('m4p', 'mp3');
  assert(limM4p.isSupported === false, 'getConversionLimitation marks m4p unsupported');
  assert(limM4p.reason.includes('DRM'), 'Limitation explains DRM protection');

  // Small sample file conversion test
  const smallWavBytes = createSampleWav(0.1, 8000);
  const sampleWavFile = new File([smallWavBytes], 'chirp.wav', { type: 'audio/wav' });

  // Test WAV -> MP3
  const wavToMp3Res = await audioConverter.convert(sampleWavFile, { outputFormat: 'mp3' });
  assert(wavToMp3Res.mimeType === 'audio/mpeg', 'WAV -> MP3 produces audio/mpeg');
  assert(wavToMp3Res.filename === 'chirp.mp3', 'WAV -> MP3 output filename is chirp.mp3');
  assert(wavToMp3Res.blob !== null, 'WAV -> MP3 produces output Blob');

  // Test WAV -> OGG
  const wavToOggRes = await audioConverter.convert(sampleWavFile, { outputFormat: 'ogg' });
  assert(wavToOggRes.mimeType === 'audio/ogg', 'WAV -> OGG produces audio/ogg');
  assert(wavToOggRes.filename === 'chirp.ogg', 'WAV -> OGG output filename is chirp.ogg');

  // Test WAV -> AAC
  const wavToAacRes = await audioConverter.convert(sampleWavFile, { outputFormat: 'aac' });
  assert(wavToAacRes.mimeType === 'audio/aac', 'WAV -> AAC produces audio/aac');
  assert(wavToAacRes.filename === 'chirp.aac', 'WAV -> AAC output filename is chirp.aac');

  // Test Attempting Unsupported Audio Conversion throws honestly
  let audioUnsupportedCaught = false;
  try {
    const dummyWma = new File(['dummy'], 'track.wma', { type: 'audio/x-ms-wma' });
    await audioConverter.convert(dummyWma, { outputFormat: 'mp3' });
  } catch (err) {
    audioUnsupportedCaught = true;
    assert(err.code === 'UNSUPPORTED_FORMAT', 'Unsupported audio throws UNSUPPORTED_FORMAT');
  }
  assert(audioUnsupportedCaught, 'Unsupported audio conversion threw honestly without faking');

  // =========================================================================
  // 3. VideoConverter Contract & Conversion Tests
  // =========================================================================
  const videoConverter = new VideoConverter();
  assert(videoConverter.id === 'native-video-converter', 'VideoConverter id is native-video-converter');

  // canConvert tests
  assert(videoConverter.canConvert('mp4', 'webm') === true, 'canConvert supports mp4 -> webm');
  assert(videoConverter.canConvert('webm', 'mp4') === true, 'canConvert supports webm -> mp4');
  assert(videoConverter.canConvert('mov', 'mp4') === true, 'canConvert supports mov -> mp4');
  assert(videoConverter.canConvert('mkv', 'webm') === true, 'canConvert supports mkv -> webm');

  // Video-to-Audio extraction tests
  assert(videoConverter.canConvert('mp4', 'mp3') === true, 'canConvert supports video-to-audio extraction mp4 -> mp3');
  assert(videoConverter.canConvert('mp4', 'wav') === true, 'canConvert supports video-to-audio extraction mp4 -> wav');
  assert(videoConverter.canConvert('webm', 'mp3') === true, 'canConvert supports webm -> mp3');

  // Unsupported video formats
  assert(videoConverter.canConvert('rmvb', 'mp4') === false, 'canConvert rejects proprietary rmvb');
  assert(videoConverter.canConvert('wmv', 'webm') === false, 'canConvert rejects proprietary wmv');

  const limRmvb = videoConverter.getConversionLimitation('rmvb', 'mp4');
  assert(limRmvb.isSupported === false, 'getConversionLimitation marks rmvb unsupported');
  assert(limRmvb.reason.includes('RMVB') || limRmvb.reason.includes('RealMedia'), 'Limitation explains RMVB codec limitation');

  // Small sample video test file
  const sampleVideoFile = new File(['fake-mp4-container-bytes'], 'clip.mp4', { type: 'video/mp4' });

  // Test MP4 -> WebM
  const mp4ToWebmRes = await videoConverter.convert(sampleVideoFile, { outputFormat: 'webm' });
  assert(mp4ToWebmRes.mimeType === 'video/webm', 'MP4 -> WebM produces video/webm');
  assert(mp4ToWebmRes.filename === 'clip.webm', 'MP4 -> WebM output filename is clip.webm');

  // Test MP4 -> MP3 (Audio Extraction)
  const mp4ToMp3Res = await videoConverter.convert(sampleVideoFile, { outputFormat: 'mp3' });
  assert(mp4ToMp3Res.mimeType === 'audio/mpeg', 'MP4 -> MP3 produces audio/mpeg');
  assert(mp4ToMp3Res.filename === 'clip.mp3', 'MP4 -> MP3 output filename is clip.mp3');

  // Test Cancellation
  const abortCtrl = new AbortController();
  abortCtrl.abort();
  let cancelCaught = false;
  try {
    await videoConverter.convert(sampleVideoFile, { outputFormat: 'webm', signal: abortCtrl.signal });
  } catch (err) {
    cancelCaught = true;
    assert(err.code === 'CANCELLED', 'Cancellation throws CANCELLED code');
  }
  assert(cancelCaught, 'Video conversion cancelled successfully');

  // Progress events
  const progressList = [];
  await videoConverter.convert(sampleVideoFile, {
    outputFormat: 'webm',
    onProgress: (pct, stage) => {
      progressList.push({ pct, stage });
    }
  });
  assert(progressList.length > 0, 'Progress callbacks received during media conversion');
  assert(progressList[progressList.length - 1].pct === 100, 'Final progress reaches 100%');

  // =========================================================================
  // 4. ConverterManager Integration
  // =========================================================================
  const registry = new ConverterRegistry();
  registry.register(audioConverter);
  registry.register(videoConverter);
  const manager = new ConverterManager(registry);

  assert(manager.canConvert('wav', 'mp3') === true, 'Manager resolves audio converter for wav -> mp3');
  assert(manager.canConvert('mp4', 'webm') === true, 'Manager resolves video converter for mp4 -> webm');
  assert(manager.canConvert('mp4', 'mp3') === true, 'Manager resolves video converter for mp4 -> mp3 extraction');
  assert(manager.canConvert('rmvb', 'mp4') === false, 'Manager rejects unsupported rmvb format');

  const managedItem = {
    id: 'test_audio_item_1',
    file: sampleWavFile,
    filename: 'chirp.wav',
    extension: 'wav',
    outputFormat: 'mp3',
    status: 'queued',
    progress: 0,
    outputBlob: null,
    outputFilename: null,
    error: null
  };

  const convertedItem = await manager.convertItem(managedItem);
  assert(convertedItem.status === 'completed', 'Managed item completed');
  assert(convertedItem.progress === 100, 'Managed item progress is 100');
  assert(convertedItem.outputFilename === 'chirp.mp3', 'Managed item outputFilename is chirp.mp3');
  assert(convertedItem.outputBlob !== null, 'Managed item outputBlob populated');

  console.log('--- Phase 7 Test Run Completed Successfully ---');
}

runTests().catch(err => {
  console.error('Unexpected failure in Phase 7 tests:', err);
  process.exitCode = 1;
});
