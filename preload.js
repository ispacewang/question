/** @file preload.js — Electron preload 脚本，通过 contextBridge 暴露 electronAPI */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getHasSeenGuide: () => ipcRenderer.invoke('get-has-seen-guide'),
  setHasSeenGuide: () => ipcRenderer.send('set-has-seen-guide'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, isMaximized) => callback(isMaximized));
  },
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install-update'),
  onUpdateStateChanged: (callback) => {
    ipcRenderer.on('update-state-changed', (_event, state) => callback(state));
  },
});
