import path from 'node:path';
import fs from 'node:fs';
import { _electron as electron } from 'playwright-core';

const root = path.resolve('.');
const releaseDir = path.join(root, 'release', 'win-unpacked');
const executablePath = path.join(releaseDir, 'LumenCore.exe');
const outDir = path.join(root, 'screenshots');
const docsDir = path.join(root, 'docs', 'screenshots');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const launchEnv = { ...process.env };
delete launchEnv.ELECTRON_RUN_AS_NODE;

async function launch(profileName, files = []) {
  const profileDir = path.join(root, profileName);
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  const app = await electron.launch({
    executablePath,
    args: ['--no-sandbox', `--user-data-dir=${profileDir}`, ...files],
    cwd: releaseDir,
    env: launchEnv,
    timeout: 60000,
  });
  const page = await app.firstWindow({ timeout: 60000 });
  await page.waitForTimeout(4000);
  return { app, page };
}

const empty = await launch('.empty-test-profile');
console.log('empty title:', await empty.page.title());
console.log('empty h1:', await empty.page.locator('.empty-copy h1').textContent().catch(() => null));
await empty.page.screenshot({ path: path.join(outDir, 'app-empty.png') });
await empty.page.screenshot({ path: path.join(docsDir, 'empty.png') });

await empty.app.evaluate(({ BrowserWindow }) => {
  const window = BrowserWindow.getAllWindows()[0];
  window.setSize(1060, 720);
  window.center();
});
await empty.page.waitForTimeout(900);
console.log('small empty viewport:', await empty.page.evaluate(() => ({ w: innerWidth, h: innerHeight })));
await empty.page.screenshot({ path: path.join(outDir, 'app-small-empty.png') });
await empty.app.close();

const files = [
  path.join(root, 'Say Dont Go.mp3'),
  path.join(root, '.test-audio', 'aurora-test.flac'),
  path.join(root, '.test-audio', 'glass-pulse.m4a'),
  path.join(root, '.test-audio', 'soft-current.wav'),
  path.join(root, '.test-audio', 'mint-echo.opus'),
  path.join(root, '.test-audio', 'violet-drift.ogg'),
];
const populated = await launch('.small-test-profile', files);
await populated.app.evaluate(({ BrowserWindow }) => {
  const window = BrowserWindow.getAllWindows()[0];
  window.setSize(1060, 720);
  window.center();
});
await populated.page.waitForTimeout(900);

await populated.page.click('.side-nav__item:nth-child(2)');
await populated.page.waitForTimeout(600);
const layout = await populated.page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  bodyScrollWidth: document.body.scrollWidth,
  dockWidth: document.querySelector('.dock-panel')?.getBoundingClientRect().width,
  sidebarHeight: document.querySelector('.sidebar-surface')?.getBoundingClientRect().height,
}));
console.log('small layout:', layout);
await populated.page.screenshot({ path: path.join(outDir, 'app-small-library.png') });

await populated.page.click('.side-nav__item:nth-child(1)');
await populated.page.waitForTimeout(500);
await populated.page.screenshot({ path: path.join(outDir, 'app-small-now.png') });

await populated.app.close();
console.log('capture-ui done');
