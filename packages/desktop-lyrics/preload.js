const { ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
window.electronAPI = {
  // 更新歌词
  onUpdateLyrics: (callback) => {
    ipcRenderer.on('update-lyrics', (event, data) => callback(data));
  },

  // 设置鼠标穿透
  setIgnoreMouse: (ignore) => {
    ipcRenderer.send('set-ignore-mouse', ignore);
  },

  // 移动窗口
  moveWindow: (x, y) => {
    ipcRenderer.send('move-window', { x, y });
  },
};
