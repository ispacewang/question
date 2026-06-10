/** @file main.js — Electron 主进程入口，创建 frameless Mica 窗口，启动 Express 后端（端口13002），IPC 窗口控制 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const createServer = require('./backend/app.js');

const PORT = 13002;

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
    show: false,
    icon: path.join(__dirname, 'frontend/public/favicon1.ico'),
    backgroundMaterial: 'mica',
    backgroundColor: '#1c1c1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setMenu(null);

  const isDev = process.env.NODE_ENV === 'development' || process.argv.some(arg => arg.includes('--dev'));

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // 窗口控制
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());
  ipcMain.handle('window-is-maximized', () => win.isMaximized());

  win.on('maximize', () => win.webContents.send('window-state-changed', true));
  win.on('unmaximize', () => win.webContents.send('window-state-changed', false));
  win.on('enter-full-screen', () => win.webContents.send('window-state-changed', 'fullscreen'));
  win.on('leave-full-screen', () => win.webContents.send('window-state-changed', false));
}

app.whenReady().then(() => {
  const expressApp = createServer();
  expressApp.listen(PORT, () => {
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
