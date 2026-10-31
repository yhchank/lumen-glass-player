const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('lumen', {
  platform: process.platform,
  pickFiles: () => ipcRenderer.invoke('library:pick', 'files'),
  pickFolder: () => ipcRenderer.invoke('library:pick', 'folder'),
  importPaths: (paths) => ipcRenderer.invoke('library:import-paths', paths),
  consumeLaunchPaths: () => ipcRenderer.invoke('library:consume-launch-paths'),
  verifyPaths: (paths) => ipcRenderer.invoke('library:verify', paths),
  readFolder: (filePath) => ipcRenderer.invoke('library:folder-info', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),
  windowControl: (action) => ipcRenderer.invoke('window:control', action),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  setPlaybackState: (state) => ipcRenderer.send('playback:state', state),
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  onScanProgress: (callback) => subscribe('library:scan-progress', callback),
  onOpenFiles: (callback) => subscribe('app:open-files', callback),
  onWindowMaximized: (callback) => subscribe('window:maximized', callback),
  onMediaCommand: (callback) => subscribe('media:command', callback),
});
