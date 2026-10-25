import path from 'node:path';
import fs from 'node:fs';
import { _electron as electron } from 'playwright-core';

const root = path.resolve('.');
const releaseDir = path.join(root, 'release', 'win-unpacked');
const executablePath = path.join(releaseDir, 'LumenCore.exe');
const profileDir = path.join(root, '.packaged-test-profile');
const screenshotPrefix = 'packaged';
const sample = path.join(root, 'Say Dont Go.mp3');
const testDir = path.join(root, '.test-audio');
const testFiles = [
  path.join(testDir, 'aurora-test.flac'),
  path.join(testDir, 'glass-pulse.m4a'),
  path.join(testDir, 'soft-current.wav'),
  path.join(testDir, 'mint-echo.opus'),
  path.join(testDir, 'violet-drift.ogg'),
];

fs.rmSync(profileDir, { recursive: true, force: true });
fs.mkdirSync(profileDir, { recursive: true });
fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });

if (!fs.existsSync(executablePath)) {
  throw new Error(`Packaged core not found: ${executablePath}`);
}

const launchEnv = { ...process.env };
delete launchEnv.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  executablePath,
  args: [
    '--no-sandbox',
    `--user-data-dir=${profileDir}`,
    sample,
    ...testFiles,
  ],
  cwd: releaseDir,
  env: launchEnv,
  timeout: 60000,
});

const page = await app.firstWindow({ timeout: 60000 });
const issues = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    issues.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => issues.push(`[pageerror] ${error.message}`));

await page.waitForTimeout(4500);

const results = {};

results.title = await page.title();
results.hero = await page.locator('.track-heading h1').textContent();
results.audioProtocol = await page.evaluate(() => {
  const audio = document.querySelector('audio');
  return {
    src: audio?.getAttribute('src') || null,
    duration: audio?.duration || 0,
    canPlay: {
      mp3: document.createElement('audio').canPlayType('audio/mpeg'),
      m4a: document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"'),
      aac: document.createElement('audio').canPlayType('audio/aac'),
      wav: document.createElement('audio').canPlayType('audio/wav'),
      flac: document.createElement('audio').canPlayType('audio/flac'),
      ogg: document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'),
      opus: document.createElement('audio').canPlayType('audio/ogg; codecs="opus"'),
    },
  };
});

// Custom protocol should support byte ranges so the player can seek.
results.range = await page.evaluate(async () => {
  const src = document.querySelector('audio')?.getAttribute('src');
  if (!src) return null;
  const response = await fetch(src, { headers: { Range: 'bytes=0-1023' } });
  const buffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentRange: response.headers.get('content-range'),
    bytes: buffer.byteLength,
  };
});

results.cover = await page.evaluate(async () => {
  const image = document.querySelector('.cover-art--hero img');
  if (!image) return null;
  const response = await fetch(image.src);
  return { status: response.status, type: response.headers.get('content-type') };
});

// Exercise the real import IPC with every format. This verifies parsing and metadata
// extraction without injecting anything into the UI state.
results.importIpc = await page.evaluate(async (files) => {
  const result = await window.lumen.importPaths(files);
  return {
    count: result.tracks.length,
    failed: result.failed,
    formats: result.tracks.map((track) => track.extension),
    titles: result.tracks.map((track) => track.title),
  };
}, testFiles);

results.folderImport = await page.evaluate(async (directory) => {
  const result = await window.lumen.importPaths([directory]);
  return {
    count: result.tracks.length,
    failed: result.failed,
    formats: result.tracks.map((track) => track.extension).sort(),
  };
}, testDir);

await page.waitForTimeout(1200);
results.import = await page.evaluate(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('lumen.library.v1') || '{}');
    return {
      count: Array.isArray(stored.library) ? stored.library.length : 0,
      formats: Array.isArray(stored.library)
        ? stored.library.map((track) => track.extension)
        : [],
    };
  } catch {
    return { count: 0, formats: [] };
  }
});

console.log('launch import:', JSON.stringify(results.import));
await page.screenshot({ path: path.join(root, 'screenshots', `${screenshotPrefix}-now.png`) });

await page.click('.side-nav__item:nth-child(2)');
await page.waitForTimeout(700);
results.libraryRows = await page.locator('.track-row').count();
console.log('library rows:', results.libraryRows);
await page.screenshot({ path: path.join(root, 'screenshots', `${screenshotPrefix}-library.png`) });

if (!results.import.count) {
  console.error('No tracks were imported; aborting playback test.');
  console.error('issues:', results.issues);
  await app.close();
  process.exit(1);
}

// Play each format and verify that the media element advances.
results.playback = [];
for (const title of ['Aurora Test', 'Glass Pulse', 'Soft Current', 'Mint Echo', 'Violet Drift']) {
  const row = page.locator('.track-row', { hasText: title }).first();
  await row.click();
  await page.waitForTimeout(1100);
  const state = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    return {
      title: document.querySelector('.dock-track__copy strong')?.textContent,
      paused: audio?.paused,
      time: audio?.currentTime,
      duration: audio?.duration,
      error: audio?.error ? audio.error.code : null,
    };
  });
  results.playback.push(state);
  await page.evaluate(() => document.querySelector('audio')?.pause());
}

// Seek and favorite behaviour.
const beforeSeek = await page.evaluate(() => document.querySelector('audio')?.currentTime || 0);
await page.evaluate(() => {
  const audio = document.querySelector('audio');
  if (audio) {
    audio.currentTime = 3;
    audio.play();
  }
});
await page.waitForTimeout(500);
results.seek = await page.evaluate(() => document.querySelector('audio')?.currentTime || 0);
results.seekAdvanced = results.seek > beforeSeek;

await page.locator('.track-row', { hasText: 'Aurora Test' }).first().locator('.row-action').first().click();
await page.click('.side-nav__item:nth-child(3)');
await page.waitForTimeout(500);
results.favoriteRows = await page.locator('.track-row').count();
await page.screenshot({ path: path.join(root, 'screenshots', `${screenshotPrefix}-favorites.png`) });

// Search and return to now playing.
await page.click('.side-nav__item:nth-child(2)');
await page.fill('.sidebar-search input', 'Lumen');
await page.waitForTimeout(500);
results.searchRows = await page.locator('.track-row').count();
await page.screenshot({ path: path.join(root, 'screenshots', `${screenshotPrefix}-search.png`) });

// Return to the sample track, verify its embedded cover, and capture the finished
// now-playing surface.
await page.fill('.sidebar-search input', '');
await page.waitForTimeout(350);
await page.locator('.track-row', { hasText: 'Say Don' }).first().click();
await page.waitForTimeout(900);
results.cover = await page.evaluate(async () => {
  const image = document.querySelector('.track-row img') || document.querySelector('.cover-art img');
  if (!image) return null;
  const response = await fetch(image.src);
  return {
    srcScheme: image.src.split(':')[0],
    status: response.status,
    type: response.headers.get('content-type'),
  };
});
await page.click('.side-nav__item:nth-child(1)');
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(root, 'screenshots', `${screenshotPrefix}-now-final.png`) });

results.issues = issues.slice(0, 20);
console.log(JSON.stringify(results, null, 2));

const failedPlayback = results.playback.filter((entry) => entry.error || !entry.duration || entry.paused);
const failed =
  results.importIpc.failed > 0 ||
  results.importIpc.count !== testFiles.length ||
  results.folderImport.count !== testFiles.length ||
  results.folderImport.failed > 0 ||
  results.libraryRows !== 6 ||
  failedPlayback.length > 0 ||
  !results.seekAdvanced ||
  !results.cover ||
  results.cover.status !== 200;

await app.close();

if (failed) {
  console.error('PACKAGED TEST FAILED', {
    failedPlayback,
    ipc: results.importIpc,
    libraryRows: results.libraryRows,
    seek: results.seek,
    cover: results.cover,
  });
  process.exit(1);
}

// Relaunch on the same profile and verify the library was persisted.
const relaunch = await electron.launch({
  executablePath,
  args: ['--no-sandbox', `--user-data-dir=${profileDir}`],
  cwd: releaseDir,
  env: launchEnv,
  timeout: 60000,
});
const page2 = await relaunch.firstWindow({ timeout: 60000 });
await page2.waitForTimeout(2600);
const persisted = await page2.evaluate(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('lumen.library.v1') || '{}');
    return {
      count: Array.isArray(stored.library) ? stored.library.length : 0,
      currentId: stored.currentId,
      favorite: Array.isArray(stored.favorites) ? stored.favorites.length : 0,
    };
  } catch {
    return null;
  }
});
await relaunch.close();
console.log('persisted:', JSON.stringify(persisted));

if (!persisted || persisted.count !== 6 || persisted.favorite < 1) {
  console.error('PERSISTENCE TEST FAILED', persisted);
  process.exit(1);
}
console.log('PACKAGED TEST PASSED');
