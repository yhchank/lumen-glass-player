import { createRequire } from 'node:module';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFile } from 'music-metadata';

const require = createRequire(import.meta.url);
const electronApi = require('electron');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  protocol,
  screen,
  shell,
} = electronApi;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const appDisplayName = 'Lumen';

const AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'm4b',
  'aac',
  'wav',
  'flac',
  'ogg',
  'oga',
  'opus',
];
const AUDIO_EXTENSION_SET = new Set(AUDIO_EXTENSIONS);
const MAX_SCAN_FILES = 6000;
const MAX_SCAN_DEPTH = 14;

const MIME_BY_EXTENSION = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

const COVER_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lumen-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow = null;
let powerBlockerId = null;
let isPlaying = false;
let pendingLaunchPaths = collectLaunchAudioPaths(process.argv);
let scanToken = 0;
let thumbarPlaying = false;

app.setName(appDisplayName);
app.setAppUserModelId('com.lumen.glassplayer');

// Pin Chromium's profile to a known-good directory before the browser process boots.
// Leaving it to the implicit default is not reliable on every Windows profile and can
// take the whole app down before `ready` on a damaged profile.
const commandLineUserData = process.argv
  .find((argument) => argument.startsWith('--user-data-dir='))
  ?.slice('--user-data-dir='.length);
const userDataDirectory =
  commandLineUserData ||
  process.env.LUMEN_USER_DATA_DIR ||
  path.join(app.getPath('appData'), appDisplayName);
app.setPath('userData', userDataDirectory);
app.commandLine.appendSwitch('user-data-dir', userDataDirectory);
try {
  fs.mkdirSync(userDataDirectory, { recursive: true });
} catch {
  // If this fails, Electron will surface a readable startup error of its own.
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function collectLaunchAudioPaths(argv) {
  return argv
    .filter((arg) => typeof arg === 'string' && !arg.startsWith('-'))
    .map((arg) => {
      try {
        return path.resolve(arg);
      } catch {
        return null;
      }
    })
    .filter((arg) => arg && AUDIO_EXTENSION_SET.has(path.extname(arg).slice(1).toLowerCase()));
}

function getCoversDirectory() {
  return path.join(app.getPath('userData'), 'covers');
}

function ensureCoversDirectory() {
  const directory = getCoversDirectory();
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function audioMime(filePath) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

function mediaUrlForPath(filePath) {
  const encoded = Buffer.from(filePath, 'utf8').toString('base64url');
  return `lumen-media://audio/${encoded}`;
}

function coverUrlForId(id) {
  return `lumen-media://cover/${id}`;
}

function isAudioFile(filePath) {
  return AUDIO_EXTENSION_SET.has(path.extname(filePath).slice(1).toLowerCase());
}

function formatIdFromPath(filePath) {
  return crypto.createHash('sha1').update(path.resolve(filePath).toLowerCase()).digest('hex').slice(0, 20);
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim();
}

function fallbackFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath)).replace(/^\d{1,3}[\s._-]+/, '').trim();
  const separators = [' - ', ' – ', ' — '];
  for (const separator of separators) {
    const index = base.indexOf(separator);
    if (index > 0 && index < base.length - separator.length) {
      return {
        artist: base.slice(0, index).trim(),
        title: base.slice(index + separator.length).trim(),
      };
    }
  }
  return { artist: '', title: base };
}

async function writeCoverArt(filePath, stat, picture) {
  if (!picture?.data || !picture.data.length) return null;
  const mime = cleanText(picture.format).toLowerCase().split(';')[0];
  const extension = COVER_EXTENSION_BY_MIME[mime];
  if (!extension) return null;

  const hash = crypto
    .createHash('sha1')
    .update(`${path.resolve(filePath).toLowerCase()}:${stat.size}:${stat.mtimeMs}:${picture.data.length}`)
    .digest('hex')
    .slice(0, 24);
  const id = `${hash}.${extension}`;
  const directory = ensureCoversDirectory();
  const target = path.join(directory, id);

  try {
    await fsp.access(target);
  } catch {
    await fsp.writeFile(target, picture.data);
  }

  return coverUrlForId(id);
}

function trackQuality(format) {
  if (!format) return '';
  if (format.lossless) {
    if (format.bitsPerSample) return `${format.bitsPerSample} bit`;
    return '无损';
  }
  if (format.bitrate) {
    return `${Math.round(format.bitrate / 1000)} kbps`;
  }
  return format.codec || '';
}

async function buildTrack(filePath, options = {}) {
  const resolved = path.resolve(filePath);
  const stat = await fsp.stat(resolved);
  const extension = path.extname(resolved).slice(1).toLowerCase();
  const id = formatIdFromPath(resolved);
  const fallback = fallbackFromFilename(resolved);

  let metadata = null;
  let coverUrl = null;
  let metadataError = null;

  try {
    metadata = await parseFile(resolved, { duration: true, skipCovers: false });
    const pictures = metadata.common.picture || [];
    const picture = pictures.find((entry) => entry.data?.length) || null;
    if (picture) {
      try {
        coverUrl = await writeCoverArt(resolved, stat, picture);
      } catch {
        coverUrl = null;
      }
    }
  } catch (error) {
    metadataError = error instanceof Error ? error.message : String(error);
  }

  const common = metadata?.common || {};
  const format = metadata?.format || {};
  const title = cleanText(common.title) || fallback.title || path.basename(resolved);
  const artist = cleanText(common.artist) || cleanText(common.albumartist) || fallback.artist || '未知艺术家';
  const album = cleanText(common.album) || '未知专辑';

  return {
    id,
    path: resolved,
    fileName: path.basename(resolved),
    title,
    artist,
    album,
    albumArtist: cleanText(common.albumartist) || artist,
    year: Number(common.year) || null,
    trackNumber: Number(common.track?.no) || null,
    discNumber: Number(common.disk?.no) || null,
    genre: Array.isArray(common.genre) ? common.genre.filter(Boolean).slice(0, 3) : [],
    duration: Number(format.duration) || 0,
    bitrate: Number(format.bitrate) || null,
    sampleRate: Number(format.sampleRate) || null,
    bitDepth: Number(format.bitsPerSample) || null,
    channels: Number(format.numberOfChannels) || null,
    codec: cleanText(format.codec) || extension.toUpperCase(),
    lossless: Boolean(format.lossless),
    container: cleanText(format.container) || extension.toUpperCase(),
    quality: trackQuality(format),
    extension,
    size: stat.size,
    modifiedAt: stat.mtimeMs,
    addedAt: options.addedAt || Date.now(),
    coverUrl,
    streamUrl: mediaUrlForPath(resolved),
    metadataError,
  };
}

async function collectAudioFiles(inputPaths) {
  const result = [];
  const seen = new Set();

  const addFile = async (candidate) => {
    if (result.length >= MAX_SCAN_FILES) return;
    const resolved = path.resolve(candidate);
    const key = resolved.toLowerCase();
    if (seen.has(key) || !isAudioFile(resolved)) return;
    try {
      const stat = await fsp.stat(resolved);
      if (!stat.isFile()) return;
      seen.add(key);
      result.push({ path: resolved, size: stat.size, modifiedAt: stat.mtimeMs });
    } catch {
      // A file can disappear between listing and stat. Skipping it is the right answer.
    }
  };

  const walk = async (candidate, depth) => {
    if (result.length >= MAX_SCAN_FILES || depth > MAX_SCAN_DEPTH) return;
    let stat;
    try {
      stat = await fsp.stat(candidate);
    } catch {
      return;
    }

    if (stat.isFile()) {
      await addFile(candidate);
      return;
    }
    if (!stat.isDirectory()) return;

    let entries;
    try {
      entries = await fsp.readdir(candidate, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    for (const entry of entries) {
      if (result.length >= MAX_SCAN_FILES) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const child = path.join(candidate, entry.name);
      if (entry.isDirectory()) {
        await walk(child, depth + 1);
      } else if (entry.isFile() && isAudioFile(child)) {
        await addFile(child);
      }
    }
  };

  for (const input of inputPaths) {
    await walk(input, 0);
  }

  return result;
}

function sendScanProgress(sender, payload) {
  if (!sender.isDestroyed()) {
    sender.send('library:scan-progress', payload);
  }
}

async function importPaths(inputPaths, sender) {
  const token = ++scanToken;
  const files = await collectAudioFiles(inputPaths);
  const tracks = [];
  let failed = 0;
  let index = 0;

  sendScanProgress(sender, {
    active: true,
    done: 0,
    total: files.length,
    current: files.length ? path.basename(files[0].path) : '',
  });

  const concurrency = 4;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, files.length)) }, async () => {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      if (token !== scanToken) return;
      try {
        const track = await buildTrack(file.path);
        tracks.push(track);
      } catch {
        failed += 1;
      }
      sendScanProgress(sender, {
        active: true,
        done: Math.min(index, files.length),
        total: files.length,
        current: path.basename(files[currentIndex].path),
      });
    }
  });

  await Promise.all(workers);

  if (token !== scanToken) {
    return { tracks: [], skipped: 0, failed: 0, cancelled: true };
  }

  tracks.sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-CN', { numeric: true }));
  sendScanProgress(sender, { active: false, done: files.length, total: files.length, current: '' });

  return {
    tracks,
    skipped: Math.max(0, inputPaths.length ? 0 : 0),
    failed,
    cancelled: false,
  };
}

async function readRange(filePath, rangeHeader, mime) {
  const stat = await fsp.stat(filePath);
  const size = stat.size;
  const headers = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };

  if (!rangeHeader) {
    headers['Content-Length'] = String(size);
    return new Response(Readable.toWeb(fs.createReadStream(filePath)), { status: 200, headers });
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return new Response('Invalid range', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;

  if (start === null && end === null) {
    return new Response('Invalid range', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  if (start === null) {
    const suffixLength = Math.min(end, size);
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1);
  }

  if (start >= size || start > end) {
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  headers['Content-Length'] = String(end - start + 1);
  headers['Content-Range'] = `bytes ${start}-${end}/${size}`;

  return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), {
    status: 206,
    headers,
  });
}

function registerMediaProtocol() {
  protocol.handle('lumen-media', async (request) => {
    try {
      const url = new URL(request.url);

      if (url.hostname === 'cover') {
        const id = decodeURIComponent(url.pathname.slice(1));
        if (!/^[a-f0-9]{20,40}\.(jpg|png|webp|gif|bmp)$/i.test(id)) {
          return new Response('Not found', { status: 404 });
        }
        const filePath = path.join(getCoversDirectory(), id);
        if (!fs.existsSync(filePath)) {
          return new Response('Not found', { status: 404 });
        }
        return readRange(filePath, null, MIME_BY_EXTENSION[path.extname(id).slice(1).toLowerCase()] || 'image/jpeg');
      }

      if (url.hostname === 'audio') {
        const encoded = decodeURIComponent(url.pathname.slice(1));
        const filePath = Buffer.from(encoded, 'base64url').toString('utf8');
        if (!filePath || !isAudioFile(filePath)) {
          return new Response('Forbidden', { status: 403 });
        }
        try {
          await fsp.access(filePath, fs.constants.R_OK);
        } catch {
          return new Response('Not found', { status: 404 });
        }
        return readRange(filePath, request.headers.get('range'), audioMime(filePath));
      }

      return new Response('Not found', { status: 404 });
    } catch {
      return new Response('Bad request', { status: 400 });
    }
  });
}

function windowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const value = JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
    if (!value || typeof value.width !== 'number' || typeof value.height !== 'number') return null;
    const display = screen.getDisplayMatching({
      x: value.x ?? 0,
      y: value.y ?? 0,
      width: value.width,
      height: value.height,
    });
    const area = display.workArea;
    const width = Math.min(Math.max(value.width, 1060), area.width);
    const height = Math.min(Math.max(value.height, 720), area.height);
    const x = Math.min(Math.max(value.x ?? area.x, area.x), area.x + area.width - width);
    const y = Math.min(Math.max(value.y ?? area.y, area.y), area.y + area.height - height);
    return { width, height, x, y, maximized: Boolean(value.maximized) };
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  try {
    fs.writeFileSync(
      windowStatePath(),
      JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }, null, 2),
    );
  } catch {
    // Window geometry is a convenience, never a reason to fail a quit.
  }
}

function thumbIcon(name) {
  const candidates = [
    path.join(process.resourcesPath, 'thumbar', `${name}.png`),
    path.join(__dirname, 'assets', 'thumbar', `${name}.png`),
    path.join(__dirname, '..', 'build', 'thumbar', `${name}.png`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
    }
  }
  return null;
}

function updateThumbar(playing) {
  if (!mainWindow || mainWindow.isDestroyed() || process.platform !== 'win32') return;
  if (thumbarPlaying === playing) return;
  thumbarPlaying = playing;
  const previous = thumbIcon('previous');
  const playPause = thumbIcon(playing ? 'pause' : 'play');
  const next = thumbIcon('next');
  if (!previous || !playPause || !next) return;
  mainWindow.setThumbarButtons([
    {
      tooltip: '上一首',
      icon: previous,
      click: () => mainWindow?.webContents.send('media:command', 'previous'),
    },
    {
      tooltip: playing ? '暂停' : '播放',
      icon: playPause,
      click: () => mainWindow?.webContents.send('media:command', 'toggle'),
    },
    {
      tooltip: '下一首',
      icon: next,
      click: () => mainWindow?.webContents.send('media:command', 'next'),
    },
  ]);
}

function createWindow() {
  const state = loadWindowState();
  const iconPath = isDev
    ? path.join(__dirname, '..', 'build', 'icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  mainWindow = new BrowserWindow({
    width: state?.width || 1320,
    height: state?.height || 860,
    x: state?.x,
    y: state?.y,
    minWidth: 1060,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0f1218',
    title: '流光 Lumen',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  if (state?.maximized) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  const emitMaximized = () => {
    mainWindow?.webContents.send('window:maximized', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', emitMaximized);
  mainWindow.on('unmaximize', emitMaximized);
  mainWindow.on('resize', emitMaximized);

  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith(pathToFileURL(path.join(__dirname, '..', 'dist')).toString());
    if (!allowed) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  updateThumbar(false);
}

function registerIpc() {
  ipcMain.handle('library:pick', async (event, kind) => {
    if (!mainWindow) return { tracks: [], failed: 0, cancelled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: kind === 'folder' ? '选择音乐文件夹' : '添加音乐',
      buttonLabel: kind === 'folder' ? '导入文件夹' : '添加到资料库',
      properties: kind === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'],
      filters:
        kind === 'folder'
          ? undefined
          : [
              { name: '音频文件', extensions: AUDIO_EXTENSIONS },
              { name: '所有文件', extensions: ['*'] },
            ],
    });
    if (result.canceled || !result.filePaths.length) {
      return { tracks: [], failed: 0, cancelled: true };
    }
    return importPaths(result.filePaths, event.sender);
  });

  ipcMain.handle('library:import-paths', async (event, paths) => {
    if (!Array.isArray(paths) || !paths.length) {
      return { tracks: [], failed: 0, cancelled: true };
    }
    const safePaths = paths.filter((entry) => typeof entry === 'string').slice(0, 200);
    return importPaths(safePaths, event.sender);
  });

  ipcMain.handle('library:consume-launch-paths', () => {
    const paths = pendingLaunchPaths;
    pendingLaunchPaths = [];
    return paths;
  });

  ipcMain.handle('library:verify', async (_event, paths) => {
    if (!Array.isArray(paths)) return {};
    const result = {};
    await Promise.all(
      paths.slice(0, MAX_SCAN_FILES).map(async (filePath) => {
        if (typeof filePath !== 'string') return;
        try {
          await fsp.access(filePath, fs.constants.R_OK);
          result[filePath] = true;
        } catch {
          result[filePath] = false;
        }
      }),
    );
    return result;
  });

  ipcMain.handle('shell:show-item', (_event, filePath) => {
    if (typeof filePath === 'string' && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('window:control', (_event, action) => {
    if (!mainWindow) return false;
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'maximize') {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
    if (action === 'close') mainWindow.close();
    return mainWindow.isMaximized();
  });

  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.on('playback:state', (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    isPlaying = Boolean(payload.playing);
    updateThumbar(isPlaying);

    if (isPlaying && powerBlockerId === null) {
      powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    } else if (!isPlaying && powerBlockerId !== null) {
      if (powerSaveBlocker.isStarted(powerBlockerId)) powerSaveBlocker.stop(powerBlockerId);
      powerBlockerId = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      const progress = Number(payload.progress);
      if (isPlaying && Number.isFinite(progress) && progress > 0) {
        mainWindow.setProgressBar(Math.min(1, Math.max(0, progress)), { mode: 'normal' });
      } else {
        mainWindow.setProgressBar(-1);
      }
    }
  });
}

app.on('second-instance', (_event, argv) => {
  const paths = collectLaunchAudioPaths(argv);
  if (paths.length && mainWindow) {
    mainWindow.webContents.send('app:open-files', paths);
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  app.setName('Lumen');
  registerMediaProtocol();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  saveWindowState();
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});
