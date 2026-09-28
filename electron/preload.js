const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script — runs in a privileged context before the renderer loads.
 * Exposes a typed, minimal surface to the renderer via contextBridge.
 * nodeIntegration is disabled; this is the only way renderer code can reach
 * the main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── App info ──────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  isElectron: true,

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // ── Printer IPC ───────────────────────────────────────────────────────────
  printerSendRawData: (base64Data, config) => ipcRenderer.invoke('printer-send-raw-data', base64Data, config),
  printerDiscover: () => ipcRenderer.invoke('printer-discover'),
  printerGetStatus: config => ipcRenderer.invoke('printer-get-status', config),

  // ── Cash drawer IPC ───────────────────────────────────────────────────────
  drawerOpen: (config, pin) => ipcRenderer.invoke('drawer-open', config, pin),
  drawerIsOpen: config => ipcRenderer.invoke('drawer-is-open', config),

  // ── Scanner IPC ───────────────────────────────────────────────────────────
  // HID barcode scanners are handled via DOM keydown events in the renderer
  // (ElectronScannerService). This callback is provided for future HID-level
  // integration from the main process if needed.
  onBarcodeScan: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('barcode-scan', listener);
    // Return a cleanup function the caller can invoke to unsubscribe
    return () => ipcRenderer.removeListener('barcode-scan', listener);
  },
  scannerDiscover: () => ipcRenderer.invoke('scanner-discover'),

  // ── Payment IPC ───────────────────────────────────────────────────────────
  paymentInit: config => ipcRenderer.invoke('payment-init', config),
  paymentDiscoverReaders: () => ipcRenderer.invoke('payment-discover-readers'),
  paymentConnectReader: readerId => ipcRenderer.invoke('payment-connect-reader', readerId),
  paymentCollect: request => ipcRenderer.invoke('payment-collect', request),
  paymentCancel: () => ipcRenderer.invoke('payment-cancel'),
  paymentDisconnect: () => ipcRenderer.invoke('payment-disconnect'),

  // ── OS-protected secret storage ───────────────────────────────────────────
  secureStorage: {
    isAvailable: () => ipcRenderer.invoke('secure-storage-available'),
    get: key => ipcRenderer.invoke('secure-storage-get', key),
    set: (key, value) => ipcRenderer.invoke('secure-storage-set', key, value),
    delete: key => ipcRenderer.invoke('secure-storage-delete', key),
  },
});

// Expose a top-level flag for the isElectron() utility in utils/electron.ts
contextBridge.exposeInMainWorld('isElectron', true);
