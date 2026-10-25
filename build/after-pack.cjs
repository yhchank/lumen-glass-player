const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  const productName = context.packager.appInfo.productFilename || 'Lumen';
  const executablePath = path.join(appOutDir, `${productName}.exe`);
  const corePath = path.join(appOutDir, `${productName}Core.exe`);

  if (!fs.existsSync(executablePath)) {
    throw new Error(`[lumen] packaged executable not found: ${executablePath}`);
  }

  if (!fs.existsSync(corePath)) {
    fs.renameSync(executablePath, corePath);
  }

  const projectRoot = path.resolve(__dirname, '..');
  const sourcePath = path.join(projectRoot, 'build', 'launcher', 'Launcher.cs');
  const iconPath = path.join(projectRoot, 'build', 'icon.ico');
  const cscPath = path.join(
    process.env.WINDIR || 'C:\\Windows',
    'Microsoft.NET',
    'Framework64',
    'v4.0.30319',
    'csc.exe',
  );

  if (!fs.existsSync(cscPath)) {
    throw new Error(`[lumen] C# compiler not found: ${cscPath}`);
  }

  execFileSync(
    cscPath,
    [
      '/nologo',
      '/target:winexe',
      '/platform:x64',
      '/optimize+',
      `/win32icon:${iconPath}`,
      `/out:${executablePath}`,
      '/r:System.Windows.Forms.dll',
      sourcePath,
    ],
    { stdio: 'inherit' },
  );

  console.log(`[lumen] launcher written: ${executablePath}`);
};
