console.log('Starting debug...');
const electron = require('electron');
console.log('Type:', typeof electron);
console.log('Keys:', Object.keys(electron).slice(0, 10));
console.log('app:', electron.app);
console.log('BrowserWindow:', electron.BrowserWindow);
