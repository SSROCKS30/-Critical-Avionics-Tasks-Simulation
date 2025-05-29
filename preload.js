const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readProcFile: () => ipcRenderer.invoke('read-proc-file'),
  writeSysParam: (path, value, paramName) => ipcRenderer.invoke('write-sys-param', { path, value, paramName }),
  getParamPaths: () => ipcRenderer.invoke('get-param-paths')
}); 