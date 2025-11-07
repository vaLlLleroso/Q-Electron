const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('backend', {
  api: 'http://127.0.0.1:5000'
});
