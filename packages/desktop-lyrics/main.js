// 桌面字幕 - Electron 主进程
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

// 禁用硬件加速
app.disableHardwareAcceleration();

let win = null;

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 800,
    height: 120,
    x: Math.round((width - 800) / 2),
    y: height - 140,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('lyrics.html');

  console.log('[DesktopSubtitles] Window created');
});

app.on('window-all-closed', () => {
  app.quit();
});
