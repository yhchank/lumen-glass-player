import { _electron as electron } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve('.');
const screenshotDir = path.join(root, 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const executablePath = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const userDataDir = path.join(root, '.screenshot-userdata');
fs.rmSync(userDataDir, { recursive: true, force: true });
fs.mkdirSync(userDataDir, { recursive: true });
const args = [
  '--no-sandbox',
  `--user-data-dir=${userDataDir}`,
  '.',
  path.join(root, 'Say Dont Go.mp3'),
];

const launchEnv = {
  ...process.env,
  ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
  LUMEN_USER_DATA_DIR: userDataDir,
};
delete launchEnv.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  executablePath,
  args,
  cwd: root,
  env: launchEnv,
  timeout: 60000,
});

const page = await app.firstWindow({ timeout: 60000 });
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    console.log(`[console:${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

await page.waitForTimeout(6500);
console.log('title:', await page.title());
console.log('url:', page.url());
console.log('viewport:', await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })));
console.log(
  'state:',
  await page.evaluate(() => ({
    storage: localStorage.getItem('lumen.library.v1')?.slice(0, 260),
    trackRows: document.querySelectorAll('.queue-row').length,
    heroTitle: document.querySelector('.track-heading h1')?.textContent,
    glassSurfaces: document.querySelectorAll('.lg-surface').length,
    bodyBg: getComputedStyle(document.querySelector('.app')).backgroundColor,
    audioSrc: document.querySelector('audio')?.getAttribute('src'),
  })),
);

await page.screenshot({ path: path.join(screenshotDir, 'app-now.png') });
await page.click('.view-head__actions .lg-button, .side-nav__item:nth-child(2)').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(screenshotDir, 'app-library.png') });

await app.close();
console.log('done');
