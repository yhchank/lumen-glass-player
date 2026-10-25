import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { parseFile } from 'music-metadata';
import { Buffer } from 'node:buffer';

const root = path.resolve('.');
const screenshotDir = path.join(root, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const metadata = await parseFile(path.join(root, 'Say Dont Go.mp3'), { duration: true });
const picture = metadata.common.picture?.[0];
const coverDataUrl = picture
  ? `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`
  : null;

function silentWav(seconds = 12, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const data = Buffer.alloc(samples);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return `data:audio/wav;base64,${Buffer.concat([header, data]).toString('base64')}`;
}

const demo = {
  id: 'demo-track-01',
  path: path.join(root, 'Say Dont Go.mp3'),
  fileName: 'Say Dont Go.mp3',
  title: metadata.common.title || 'Say Don’t Go',
  artist: metadata.common.artist || 'Taylor Swift',
  album: metadata.common.album || '1989 (Taylor’s Version)',
  albumArtist: metadata.common.albumartist || metadata.common.artist || 'Taylor Swift',
  year: metadata.common.year || 2023,
  trackNumber: 20,
  discNumber: 1,
  genre: metadata.common.genre || ['Pop'],
  duration: metadata.format.duration || 279.864,
  bitrate: metadata.format.bitrate || 320000,
  sampleRate: metadata.format.sampleRate || 48000,
  bitDepth: null,
  channels: 2,
  codec: metadata.format.codec || 'MPEG 1 Layer 3',
  lossless: false,
  container: 'MPEG',
  quality: '320 kbps',
  extension: 'mp3',
  size: 12003468,
  modifiedAt: Date.now(),
  addedAt: Date.now(),
  coverUrl: coverDataUrl,
  streamUrl: silentWav(),
  metadataError: null,
};

const second = {
  ...demo,
  id: 'demo-track-02',
  path: path.join(root, 'demo-two.flac'),
  fileName: '02 - Afterglow.flac',
  title: 'Afterglow',
  artist: 'Lumen Ensemble',
  album: 'Glass Hours',
  albumArtist: 'Lumen Ensemble',
  year: 2025,
  duration: 246.5,
  bitrate: 1411200,
  sampleRate: 44100,
  bitDepth: 24,
  codec: 'FLAC',
  lossless: true,
  container: 'FLAC',
  quality: '24 bit · 44.1 kHz',
  extension: 'flac',
  size: 41603334,
  coverUrl: null,
  streamUrl: silentWav(),
};

const server = await createServer({
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-first-run', '--disable-features=msEdgeSidebarV2'],
});

const context = await browser.newContext({
  viewport: { width: 1320, height: 860 },
  deviceScaleFactor: 1,
});

await context.addInitScript(
  ({ track, secondTrack }) => {
    const tracks = [track, secondTrack];
    const ok = () => ({ tracks, failed: 0, cancelled: false });
    window.lumen = {
      platform: 'win32',
      pickFiles: async () => ok(),
      pickFolder: async () => ok(),
      importPaths: async () => ok(),
      consumeLaunchPaths: async () => ['demo'],
      verifyPaths: async (paths) => Object.fromEntries(paths.map((p) => [p, true])),
      showItemInFolder: async () => {},
      windowControl: async () => false,
      isMaximized: async () => false,
      setPlaybackState: () => {},
      getPathForFile: () => '',
      onScanProgress: () => () => {},
      onOpenFiles: () => () => {},
      onWindowMaximized: () => () => {},
      onMediaCommand: () => () => {},
    };
  },
  { track: demo, secondTrack: second },
);

const page = await context.newPage();
const issues = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    issues.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => issues.push(`[pageerror] ${error.message}`));

await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);

console.log(
  'state:',
  await page.evaluate(() => ({
    title: document.title,
    heroTitle: document.querySelector('.track-heading h1')?.textContent,
    glass: document.querySelectorAll('.lg-surface').length,
    queueRows: document.querySelectorAll('.queue-row').length,
    svgFilters: document.querySelectorAll('svg filter').length,
    audioSrc: document.querySelector('audio')?.getAttribute('src')?.slice(0, 30),
    bodySize: [innerWidth, innerHeight],
  })),
);

await page.screenshot({ path: path.join(screenshotDir, 'app-now.png') });

// Play for a moment to see the animated state and active controls.
await page.click('.play-button');
await page.waitForTimeout(1600);
console.log('playing aria:', await page.getAttribute('.play-button', 'aria-label'));
await page.screenshot({ path: path.join(screenshotDir, 'app-playing.png') });

// Library view.
await page.click('.side-nav__item:nth-child(2)');
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(screenshotDir, 'app-library.png') });

// Favorites.
await page.click('.side-nav__item:nth-child(3)');
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(screenshotDir, 'app-favorites.png') });

// Search state.
await page.click('.side-nav__item:nth-child(2)');
await page.fill('.sidebar-search input', 'lumen');
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(screenshotDir, 'app-search.png') });

if (issues.length) {
  console.log('--- renderer issues ---');
  console.log(issues.slice(0, 30).join('\n'));
} else {
  console.log('renderer issues: none');
}

await browser.close();
await server.close();
console.log('done');
