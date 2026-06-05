/**
 * 启动桌面歌词窗口
 * 运行: node start-lyrics.js
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let lyricsWindow = null;
let ws = null;

function createLyricsWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  lyricsWindow = new BrowserWindow({
    width: 900,
    height: 100,
    x: Math.round((screenWidth - 900) / 2),
    y: screenHeight - 130,
    frame: false,                    // 无边框
    transparent: true,               // 透明背景（逐像素透明）
    alwaysOnTop: true,               // 置顶
    skipTaskbar: true,               // 不显示在任务栏
    resizable: false,
    hasShadow: false,                // 无阴影
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 设置鼠标穿透（透明区域可穿透点击）
  lyricsWindow.setIgnoreMouseEvents(true, { forward: true });

  // 设置窗口层级为最高
  lyricsWindow.setAlwaysOnTop(true, 'screen-saver');

  lyricsWindow.loadFile(path.join(__dirname, 'lyrics.html'));

  console.log('[DesktopSubtitles] 窗口已创建');
}

function connectToGateway() {
  ws = new WebSocket('ws://localhost:3000/ws');

  ws.on('open', () => {
    console.log('[DesktopSubtitles] 已连接到网关');
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // 接收翻译结果
      if (msg.type === 'subtitle_patch') {
        const { action, new_text } = msg.payload || {};

        if (action === 'ADD_TEMP' || action === 'MARK_FINAL') {
          // 发送到歌词窗口
          if (lyricsWindow && !lyricsWindow.isDestroyed()) {
            lyricsWindow.webContents.send('update-lyrics', {
              tgt: new_text,
              isRunning: true,
            });
          }
        }
      }
    } catch (err) {
      // 忽略解析错误
    }
  });

  ws.on('close', () => {
    console.log('[DesktopSubtitles] 网关连接断开，5秒后重连...');
    setTimeout(connectToGateway, 5000);
  });

  ws.on('error', (err) => {
    console.error('[DesktopSubtitles] 网关连接错误:', err.message);
  });
}

app.whenReady().then(() => {
  createLyricsWindow();
  connectToGateway();
});

app.on('window-all-closed', () => {
  if (ws) ws.close();
  app.quit();
});
