/** @file main.js — Electron 主进程入口，创建 frameless Mica 窗口，启动 Express 后端（端口13002），IPC 窗口控制 */

const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const createServer = require('./backend/app.js');

const PORT = 13002;
let serverInstance = null;
let mainWindow = null;
let ipcRegistered = false;
let updateReady = false;
let updateInstalling = false;
let updateState = { status: 'idle' };
let resolvedUpdateFeedUrl = '';
let updateFeedResolvePromise = null;

const DEFAULT_GITEA_RELEASE_PAGE_URL = 'http://10.13.20.11:3000/ispacewang/question/releases/tag/v2.5.7';
const UPDATE_FEED_URL_OVERRIDE = process.env.QUESORA_UPDATE_URL || '';
const GITEA_RELEASE_PAGE_URL = process.env.QUESORA_RELEASE_PAGE_URL || DEFAULT_GITEA_RELEASE_PAGE_URL;

function sendUpdateState(state) {
  updateState = { ...updateState, ...state };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-state-changed', updateState);
  }
}

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function normalizeFeedUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function getGiteaReleaseConfig(releasePageUrl) {
  const url = new URL(releasePageUrl);
  const tagMarker = '/releases/tag/';
  const tagIndex = url.pathname.indexOf(tagMarker);
  if (tagIndex === -1) {
    throw new Error('Gitea Release 地址格式不正确');
  }

  const repoPath = url.pathname.slice(0, tagIndex).replace(/\/+$/, '');
  const repoParts = repoPath.split('/').filter(Boolean);
  if (repoParts.length < 2) {
    throw new Error('Gitea Release 地址缺少 owner/repo');
  }

  const owner = repoParts[repoParts.length - 2];
  const repo = repoParts[repoParts.length - 1];
  const basePath = repoParts.slice(0, -2).join('/');
  const basePrefix = basePath ? `/${basePath}` : '';
  const tag = decodeURIComponent(url.pathname.slice(tagIndex + tagMarker.length).split('/')[0]);

  return {
    origin: url.origin,
    basePrefix,
    owner,
    repo,
    tag,
  };
}

function buildGiteaApiUrl(config) {
  return `${config.origin}${config.basePrefix}/api/v1/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/latest`;
}

function buildGiteaDownloadUrl(config, tag) {
  return normalizeFeedUrl(`${config.origin}${config.basePrefix}/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/releases/download/${encodeURIComponent(tag)}`);
}

async function resolveUpdateFeedUrl() {
  if (UPDATE_FEED_URL_OVERRIDE) {
    resolvedUpdateFeedUrl = normalizeFeedUrl(UPDATE_FEED_URL_OVERRIDE);
    autoUpdater.setFeedURL({ provider: 'generic', url: resolvedUpdateFeedUrl });
    return resolvedUpdateFeedUrl;
  }

  if (resolvedUpdateFeedUrl) return resolvedUpdateFeedUrl;
  if (updateFeedResolvePromise) return updateFeedResolvePromise;

  updateFeedResolvePromise = (async () => {
    const config = getGiteaReleaseConfig(GITEA_RELEASE_PAGE_URL);
    let latestTag = config.tag;

    if (typeof fetch === 'function') {
      const response = await fetch(buildGiteaApiUrl(config), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Gitea 最新版本接口返回 ${response.status}`);
      }
      const latestRelease = await response.json();
      latestTag = latestRelease.tag_name || latestRelease.tag || latestTag;
    }

    resolvedUpdateFeedUrl = buildGiteaDownloadUrl(config, latestTag);
    autoUpdater.setFeedURL({ provider: 'generic', url: resolvedUpdateFeedUrl });
    return resolvedUpdateFeedUrl;
  })().finally(() => {
    updateFeedResolvePromise = null;
  });

  return updateFeedResolvePromise;
}

function closeBackendServer(done) {
  if (!serverInstance) {
    done();
    return;
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    serverInstance = null;
    done();
  };

  serverInstance.close(finish);
  serverInstance.closeAllConnections?.();

  const fallbackTimer = setTimeout(finish, 1500);
  fallbackTimer.unref?.();
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateState({ status: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    sendUpdateState({ status: 'downloading', version: info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateState({ status: 'not-available', version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateState({
      status: 'downloading',
      progress: Math.round(progress.percent || 0),
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    sendUpdateState({ status: 'downloaded', version: info.version, progress: 100 });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateState({ status: 'error', error: error?.message || '检查更新失败' });
  });
}

function checkForUpdates() {
  if (['checking', 'downloading', 'downloaded', 'installing'].includes(updateState.status)) {
    return;
  }
  if (!app.isPackaged) {
    sendUpdateState({ status: 'disabled', error: '开发模式不检查更新' });
    return;
  }

  sendUpdateState({ status: 'checking' });
  resolveUpdateFeedUrl().then(() => autoUpdater.checkForUpdates()).catch((error) => {
    sendUpdateState({ status: 'error', error: error?.message || '检查更新失败' });
  });
}

function registerIpcHandlers() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('window-minimize', () => getMainWindow()?.minimize());
  ipcMain.on('window-maximize', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => getMainWindow()?.close());
  ipcMain.handle('window-is-maximized', () => getMainWindow()?.isMaximized() || false);
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-update-state', () => updateState);
  ipcMain.handle('check-for-updates', () => {
    checkForUpdates();
    return updateState;
  });
  ipcMain.handle('restart-and-install-update', () => {
    if (!updateReady || updateInstalling) return false;
    updateInstalling = true;
    sendUpdateState({ status: 'installing' });
    closeBackendServer(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return true;
  });
}

/**
 * 创建主窗口：frameless Mica 窗口，设置 preload、窗口控制 IPC、最大化/还原事件
 */
function createWindow () {
  const win = new BrowserWindow({
    width: 1450,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    icon: path.join(__dirname, 'frontend/dist/favicon1.ico'),
    backgroundMaterial: 'mica',
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow = win;
  win.setMenu(null);

  const isDev = process.env.NODE_ENV === 'development' || process.argv.some(arg => arg.includes('--dev'));

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  // 窗口控制
  win.on('maximize', () => win.webContents.send('window-state-changed', true));
  win.on('unmaximize', () => win.webContents.send('window-state-changed', false));
  win.on('enter-full-screen', () => win.webContents.send('window-state-changed', 'fullscreen'));
  win.on('leave-full-screen', () => win.webContents.send('window-state-changed', false));
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('update-state-changed', updateState);
    checkForUpdates();
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  setupAutoUpdater();
  const expressApp = createServer(app.getPath('userData'));
  serverInstance = expressApp.listen(PORT, () => {
    console.log(`✅ Express server running on http://localhost:${PORT}`);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
