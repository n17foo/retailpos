const { app, BrowserWindow, ipcMain, Menu, safeStorage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

// Keep a global reference to prevent garbage collection
let mainWindow = null;

// Dev mode requires BOTH an unpackaged app and NODE_ENV=development — a
// packaged build must never trust the dev-server origin even if the variable
// leaks into the environment.
const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
const DEV_ORIGIN = 'http://localhost:19006';
const PRODUCTION_INDEX_PATH = path.resolve(__dirname, '..', 'dist', 'index.html');
const SECRET_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/;
const MAX_SECRET_LENGTH = 1024 * 1024;
const MAX_PRINTER_PAYLOAD_LENGTH = 1024 * 1024;

// Simple window state persistence (no external dependencies)
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');
const secretsFilePath = path.join(app.getPath('userData'), 'secrets-store.json');

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
      // Sandboxed preloads retain access to Electron's restricted
      // contextBridge/ipcRenderer preload API but not arbitrary Node modules.
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
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

  // Open external links in the default browser. Production is HTTPS-only so a
  // compromised renderer cannot hand a plaintext, file://, or custom-scheme URL
  // to the OS shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || (isDev && parsed.origin === DEV_ORIGIN)) {
        shell.openExternal(url);
      }
    } catch {
      // Malformed URL — deny silently
    }
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
        ...(isDev ? [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }] : []),
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

function isTrustedIpcSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.sender.isDestroyed()) {
    return false;
  }

  try {
    const frameUrl = event.senderFrame?.url || event.sender.getURL();
    const parsed = new URL(frameUrl);
    if (isDev) {
      return parsed.origin === DEV_ORIGIN;
    }
    return parsed.protocol === 'file:' && path.resolve(fileURLToPath(parsed)) === PRODUCTION_INDEX_PATH;
  } catch {
    return false;
  }
}

function secureIpcHandle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedIpcSender(event)) {
      throw new Error('Forbidden IPC sender');
    }
    return handler(event, ...args);
  });
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

function assertString(value, name, maxLength = 256) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || /[\0-\x1f\x7f]/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

function validatePrinterConfig(config) {
  assertObject(config, 'printer config');
  if (!['network', 'usb', 'bluetooth'].includes(config.connectionType)) {
    throw new Error('Invalid printer connection type');
  }

  if (config.connectionType === 'network') {
    assertString(config.host, 'printer host', 253);
    const validHost = config.host.split('.').every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
    if (!validHost) throw new Error('Invalid printer host');
    // Raw-print ports only — otherwise a compromised renderer could drive the
    // main process as a raw TCP client against arbitrary internal services.
    if (config.port !== undefined && (!Number.isInteger(config.port) || config.port < 9100 || config.port > 9109)) {
      throw new Error('Invalid printer port');
    }
  }

  if (config.connectionType === 'usb') {
    assertString(config.vendorId, 'printer vendor ID', 16);
    assertString(config.productId, 'printer product ID', 16);
    if (!/^[0-9a-f]{1,4}$/i.test(config.vendorId) || !/^[0-9a-f]{1,4}$/i.test(config.productId)) {
      throw new Error('Invalid printer USB identifiers');
    }
  }

  if (config.connectionType === 'bluetooth') {
    assertString(config.macAddress, 'printer MAC address', 17);
    if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(config.macAddress)) {
      throw new Error('Invalid printer MAC address');
    }
  }
}

function validateBase64Payload(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PRINTER_PAYLOAD_LENGTH ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error('Invalid printer payload');
  }
}

function validateSecretKey(key) {
  if (typeof key !== 'string' || !SECRET_KEY_PATTERN.test(key)) {
    throw new Error('Invalid secret key');
  }
}

function validateSecretValue(value) {
  if (typeof value !== 'string' || value.length > MAX_SECRET_LENGTH) {
    throw new Error('Invalid secret value');
  }
}

function validatePaymentConfig(config) {
  assertObject(config, 'payment config');
  assertString(config.publishableKey, 'publishable key');
  assertString(config.locationId, 'location ID');
  if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(config.publishableKey) || !/^[A-Za-z0-9_-]+$/.test(config.locationId)) {
    throw new Error('Invalid payment config');
  }
}

function validateReaderId(readerId) {
  assertString(readerId, 'reader ID', 128);
  if (!/^[A-Za-z0-9_-]+$/.test(readerId)) throw new Error('Invalid reader ID');
}

function validatePaymentRequest(request) {
  assertObject(request, 'payment request');
  if (!Number.isFinite(request.amount) || request.amount <= 0 || request.amount > 100_000_000) {
    throw new Error('Invalid payment amount');
  }
  assertString(request.currency, 'currency', 3);
  assertString(request.reference, 'payment reference', 128);
  if (!/^[A-Z]{3}$/.test(request.currency)) throw new Error('Invalid payment currency');
}

function readSecretStore() {
  try {
    if (!fs.existsSync(secretsFilePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(secretsFilePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeSecretStore(values) {
  const temporaryPath = `${secretsFilePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(values), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, secretsFilePath);
}

// IPC Handlers
function registerIpcHandlers() {
  // ── App / window ──────────────────────────────────────────────────────────
  secureIpcHandle('get-app-version', () => app.getVersion());
  secureIpcHandle('get-platform', () => process.platform);

  secureIpcHandle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  secureIpcHandle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  secureIpcHandle('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  // ── Printer IPC ───────────────────────────────────────────────────────────
  // Delegates to the Node.js printer bridge (net / usb / serialport).
  // Returns false / empty array on any error so the renderer can degrade
  // gracefully without throwing.

  secureIpcHandle('printer-send-raw-data', async (_event, base64Data, config) => {
    try {
      validateBase64Payload(base64Data);
      validatePrinterConfig(config);
      const { sendRawData } = require('./ipc/printerBridge');
      return await sendRawData(base64Data, config);
    } catch (err) {
      console.error('[IPC] printer-send-raw-data failed:', err);
      return false;
    }
  });

  secureIpcHandle('printer-discover', async () => {
    try {
      const { discoverPrinters } = require('./ipc/printerBridge');
      return await discoverPrinters();
    } catch (err) {
      console.error('[IPC] printer-discover failed:', err);
      return [];
    }
  });

  secureIpcHandle('printer-get-status', async (_event, config) => {
    try {
      validatePrinterConfig(config);
      const { getPrinterStatus } = require('./ipc/printerBridge');
      return await getPrinterStatus(config);
    } catch (err) {
      console.error('[IPC] printer-get-status failed:', err);
      return { isOnline: false, hasPaper: false };
    }
  });

  // ── Cash drawer IPC ───────────────────────────────────────────────────────

  secureIpcHandle('drawer-open', async (_event, config, pin) => {
    try {
      validatePrinterConfig(config);
      if (pin !== undefined && pin !== 2 && pin !== 5) throw new Error('Invalid drawer pin');
      const { openDrawer } = require('./ipc/printerBridge');
      return await openDrawer(config, pin ?? 2);
    } catch (err) {
      console.error('[IPC] drawer-open failed:', err);
      return false;
    }
  });

  secureIpcHandle('drawer-is-open', async (_event, config) => {
    try {
      validatePrinterConfig(config);
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

  secureIpcHandle('scanner-start-listening', _event => {
    // The renderer-side ElectronScannerService handles DOM keydown events
    // directly. This handler is a no-op stub kept for future HID-level
    // integration via node-hid if DOM-level scanning proves insufficient.
    return true;
  });

  secureIpcHandle('scanner-discover', async () => {
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

  secureIpcHandle('payment-init', async (_event, config) => {
    try {
      validatePaymentConfig(config);
      const { initPayment } = require('./ipc/paymentBridge');
      return await initPayment(config);
    } catch (err) {
      console.error('[IPC] payment-init failed:', err);
      return false;
    }
  });

  secureIpcHandle('payment-discover-readers', async () => {
    try {
      const { discoverReaders } = require('./ipc/paymentBridge');
      return await discoverReaders();
    } catch (err) {
      console.error('[IPC] payment-discover-readers failed:', err);
      return [];
    }
  });

  secureIpcHandle('payment-connect-reader', async (_event, readerId) => {
    try {
      validateReaderId(readerId);
      const { connectReader } = require('./ipc/paymentBridge');
      return await connectReader(readerId);
    } catch (err) {
      console.error('[IPC] payment-connect-reader failed:', err);
      return false;
    }
  });

  secureIpcHandle('payment-collect', async (_event, request) => {
    try {
      validatePaymentRequest(request);
      const { collectPayment } = require('./ipc/paymentBridge');
      return await collectPayment(request);
    } catch (err) {
      console.error('[IPC] payment-collect failed:', err);
      return { success: false, errorMessage: String(err) };
    }
  });

  secureIpcHandle('payment-cancel', async () => {
    try {
      const { cancelPayment } = require('./ipc/paymentBridge');
      return await cancelPayment();
    } catch (err) {
      console.error('[IPC] payment-cancel failed:', err);
    }
  });

  secureIpcHandle('payment-disconnect', async () => {
    try {
      const { disconnectReader } = require('./ipc/paymentBridge');
      return await disconnectReader();
    } catch (err) {
      console.error('[IPC] payment-disconnect failed:', err);
    }
  });

  // ── OS-protected secret storage ───────────────────────────────────────────
  // safeStorage encrypts values with the OS credential store; only ciphertext
  // is persisted in userData. Key/value bounds keep this narrow API from being
  // used as a general-purpose file writer.

  secureIpcHandle('secure-storage-available', async () => safeStorage.isEncryptionAvailable());

  secureIpcHandle('secure-storage-get', async (_event, key) => {
    validateSecretKey(key);
    const encrypted = readSecretStore()[key];
    if (typeof encrypted !== 'string' || !safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  });

  secureIpcHandle('secure-storage-set', async (_event, key, value) => {
    validateSecretKey(key);
    validateSecretValue(value);
    if (!safeStorage.isEncryptionAvailable()) return false;
    const values = readSecretStore();
    values[key] = safeStorage.encryptString(value).toString('base64');
    writeSecretStore(values);
    return true;
  });

  secureIpcHandle('secure-storage-delete', async (_event, key) => {
    validateSecretKey(key);
    const values = readSecretStore();
    if (!(key in values)) return true;
    delete values[key];
    writeSecretStore(values);
    return true;
  });
}

// App lifecycle
app.whenReady().then(() => {
  const defaultSession = session.defaultSession;

  // Deny every platform permission request by default. The POS renderer should
  // not gain camera/microphone/geolocation/clipboard/etc. access through Electron.
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);

  // Enable Cross-Origin Isolation headers globally for SharedArrayBuffer (required
  // by expo-sqlite on web), and add a response CSP for HTTP(S) responses.
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    `connect-src 'self' http: https: ws:${isDev ? ' http://localhost:19006 ws://localhost:19006' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [contentSecurityPolicy],
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp'],
      'X-Content-Type-Options': ['nosniff'],
      'Referrer-Policy': ['no-referrer'],
      'Permissions-Policy': ['camera=(), microphone=(), geolocation=(), payment=()'],
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

// Security: prevent embedded webviews, production navigation, and production
// DevTools shortcuts. The window-open handler on mainWindow separately limits
// external links to HTTPS.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', event => {
    event.preventDefault();
  });

  contents.on('will-navigate', (event, _navigationUrl) => {
    // Prevent navigation away from the app in production
    if (!isDev) {
      event.preventDefault();
    }
  });

  contents.on('before-input-event', (event, input) => {
    if (isDev) return;
    const devToolsShortcut =
      input.key === 'F12' || ((input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase()));
    const reloadShortcut = input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r');
    if (devToolsShortcut || reloadShortcut) event.preventDefault();
  });
});
