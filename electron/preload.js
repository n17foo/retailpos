const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Check if running in Electron
  isElectron: true,

  // File system operations (if needed)
  // openFile: () => ipcRenderer.invoke('dialog:openFile'),
  // saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),

  // Printer operations (if needed for desktop)
  // getPrinters: () => ipcRenderer.invoke('get-printers'),
  // print: (options) => ipcRenderer.invoke('print', options),
});

// Expose a flag to detect Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
