const { app, BrowserWindow, ipcMain, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference to prevent garbage collection
let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development';

// Simple window state persistence (no external dependencies)
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load window state:', err);
  }
  return { width: 1280, height: 800 };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(stateFilePath, JSON.stringify(bounds));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

// Enable V8 optimizations for better performance
app.commandLine.appendSwitch('enable-v8-code-cache');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    title: 'RetailPOS',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false is required so the preload script can use require('electron')
      // to access contextBridge and ipcRenderer. Security is maintained by
      // contextIsolation: true (renderer cannot access Node APIs) and
      // nodeIntegration: false (renderer has no require at all).
      sandbox: false,
      backgroundThrottling: true, // Throttle when window is hidden
    },
    show: false,
    backgroundColor: '#F5F5F5',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Graceful show once content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:19006');
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Save window state on close
  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Reduce resource usage when minimized
  mainWindow.on('minimize', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.setBackgroundThrottling(true);
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.setBackgroundThrottling(false);
    }
  });
}

// Build the application menu
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
function registerIpcHandlers() {
  // ── App / window ──────────────────────────────────────────────────────────
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-platform', () => process.platform);

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  // ── Printer IPC ───────────────────────────────────────────────────────────
  // Delegates to the Node.js printer bridge (net / usb / serialport).
  // Returns false / empty array on any error so the renderer can degrade
  // gracefully without throwing.

  ipcMain.handle('printer-send-raw-data', async (_event, base64Data, config) => {
    try {
      const { sendRawData } = require('./ipc/printerBridge');
      return await sendRawData(base64Data, config);
    } catch (err) {
      console.error('[IPC] printer-send-raw-data failed:', err);
      return false;
    }
  });

  ipcMain.handle('printer-discover', async () => {
    try {
      const { discoverPrinters } = require('./ipc/printerBridge');
      return await discoverPrinters();
    } catch (err) {
      console.error('[IPC] printer-discover failed:', err);
      return [];
    }
  });

  ipcMain.handle('printer-get-status', async (_event, config) => {
    try {
      const { getPrinterStatus } = require('./ipc/printerBridge');
      return await getPrinterStatus(config);
    } catch (err) {
      console.error('[IPC] printer-get-status failed:', err);
      return { isOnline: false, hasPaper: false };
    }
  });

  // ── Cash drawer IPC ───────────────────────────────────────────────────────

  ipcMain.handle('drawer-open', async (_event, config, pin) => {
    try {
      const { openDrawer } = require('./ipc/printerBridge');
      return await openDrawer(config, pin ?? 2);
    } catch (err) {
      console.error('[IPC] drawer-open failed:', err);
      return false;
    }
  });

  ipcMain.handle('drawer-is-open', async (_event, config) => {
    try {
      const { isDrawerOpen } = require('./ipc/printerBridge');
      return await isDrawerOpen(config);
    } catch (err) {
      console.error('[IPC] drawer-is-open failed:', err);
      return undefined;
    }
  });

  // ── Scanner IPC ───────────────────────────────────────────────────────────
  // HID barcode scanners appear as keyboard devices. We listen for rapid
  // keystroke sequences (< 100 ms between chars) and emit them as scan events.

  ipcMain.handle('scanner-start-listening', _event => {
    // The renderer-side ElectronScannerService handles DOM keydown events
    // directly. This handler is a no-op stub kept for future HID-level
    // integration via node-hid if DOM-level scanning proves insufficient.
    return true;
  });

  ipcMain.handle('scanner-discover', async () => {
    // Discover connected HID scanner devices
    // In a full implementation, this would use node-hid to enumerate USB devices
    // and filter by known QR scanner vendor IDs (Zebra, Honeywell, Datalogic, etc.)
    //
    // For now, we return a logical HID device since most USB QR scanners
    // act as keyboards and don't require explicit enumeration
    try {
      // Future: Use node-hid to enumerate actual devices
      // const HID = require('node-hid');
      // const devices = HID.devices();
      // const scanners = devices.filter(d => KNOWN_SCANNER_VENDOR_IDS.includes(d.vendorId));
      // return scanners.map(d => ({
      //   id: `${d.vendorId}-${d.productId}`,
      //   name: d.product || `QR Scanner (${d.vendorId}:${d.productId})`
      // }));

      return [
        {
          id: 'qr-hid-default',
          name: 'USB/Bluetooth HID QR Scanner',
        },
      ];
    } catch (err) {
      console.error('[IPC] scanner-discover failed:', err);
      return [];
    }
  });

  // ── Payment IPC ───────────────────────────────────────────────────────────
  // Stripe Terminal JS SDK runs in the renderer process (it is a browser SDK).
  // These handlers are stubs — the renderer calls the SDK directly and only
  // uses IPC for operations that require Node.js (e.g. fetching connection
  // tokens from a backend without exposing the secret key to the renderer).

  ipcMain.handle('payment-init', async (_event, config) => {
    try {
      const { initPayment } = require('./ipc/paymentBridge');
      return await initPayment(config);
    } catch (err) {
      console.error('[IPC] payment-init failed:', err);
      return false;
    }
  });

  ipcMain.handle('payment-discover-readers', async () => {
    try {
      const { discoverReaders } = require('./ipc/paymentBridge');
      return await discoverReaders();
    } catch (err) {
      console.error('[IPC] payment-discover-readers failed:', err);
      return [];
    }
  });

  ipcMain.handle('payment-connect-reader', async (_event, readerId) => {
    try {
      const { connectReader } = require('./ipc/paymentBridge');
      return await connectReader(readerId);
    } catch (err) {
      console.error('[IPC] payment-connect-reader failed:', err);
      return false;
    }
  });

  ipcMain.handle('payment-collect', async (_event, request) => {
    try {
      const { collectPayment } = require('./ipc/paymentBridge');
      return await collectPayment(request);
    } catch (err) {
      console.error('[IPC] payment-collect failed:', err);
      return { success: false, errorMessage: String(err) };
    }
  });

  ipcMain.handle('payment-cancel', async () => {
    try {
      const { cancelPayment } = require('./ipc/paymentBridge');
      return await cancelPayment();
    } catch (err) {
      console.error('[IPC] payment-cancel failed:', err);
    }
  });

  ipcMain.handle('payment-disconnect', async () => {
    try {
      const { disconnectReader } = require('./ipc/paymentBridge');
      return await disconnectReader();
    } catch (err) {
      console.error('[IPC] payment-disconnect failed:', err);
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Enable Cross-Origin Isolation headers globally for SharedArrayBuffer (required by expo-sqlite on web)
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    console.log('[Main Process] Intercepting headers for:', details.url);
    const responseHeaders = {
      ...details.responseHeaders,
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp'],
    };
    callback({ responseHeaders });
  });

  registerIpcHandlers();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS apps stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, _navigationUrl) => {
    // Prevent navigation away from the app in production
    if (!isDev) {
      event.preventDefault();
    }
  });
});
