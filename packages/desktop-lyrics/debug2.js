console.log('Starting debug2...');
console.log('process.versions:', process.versions);
console.log('process.type:', process.type);
console.log('global.electron:', typeof global.electron);

// 尝试不同的导入方式
try {
  const e1 = require('electron');
  console.log('require electron:', typeof e1, typeof e1 === 'string' ? e1.substring(0, 50) : 'not string');
} catch (e) {
  console.log('require electron failed:', e.message);
}

// 检查是否在 Electron 渲染进程
console.log('process.pid:', process.pid);
console.log('process.platform:', process.platform);
