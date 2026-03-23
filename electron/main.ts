import { app, BrowserWindow, Menu, screen, protocol, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerAllIpcHandlers } from './ipc/index';
import { hidService } from './services/hid.service';
import { updaterService } from './services/updater.service';
import { loadInstalledPlugins, disposeAllPlugins } from './plugins/plugin-loader';

const isDev = !app.isPackaged;

app.setName('OpenInput');

if (process.platform === 'darwin') {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'OpenInput',
      submenu: [
        { role: 'about', label: 'About OpenInput' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide OpenInput' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit OpenInput' },
      ],
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
        { type: 'separator' },
        { role: 'front' },
        { role: 'close' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(1200, width),
    height: Math.min(800, height),
    minWidth: 900,
    minHeight: 600,
    title: 'OpenInput',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    // macOS: hidden titlebar with inset traffic lights
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 },
        }
      : {
          // Windows: use the default frame with auto-hide menu bar
          autoHideMenuBar: true,
        }),
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../../dist/openinput/browser/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
  // In production, intercept file:// requests so Angular routes
  // always fall back to index.html instead of returning a 404.
  if (!isDev) {
    protocol.interceptFileProtocol('file', (request, callback) => {
      let filePath = decodeURIComponent(new URL(request.url).pathname);

      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        callback({ path: filePath });
      } else {
        callback({
          path: path.join(__dirname, '../../dist/openinput/browser/index.html'),
        });
      }
    });
  }

  registerAllIpcHandlers();

  // Load community plugins from the store BEFORE auto-scan so device
  // drivers are registered before the first USB scan.
  try {
    await loadInstalledPlugins();
    console.log('[main] Community plugins loaded');
  } catch (err) {
    console.error('[main] Failed to load community plugins:', err);
  }

  mainWindow = createWindow();

  // Start device auto-scan
  hidService.startAutoScan(mainWindow);

  // Initialise the auto-updater (only in packaged builds)
  if (!isDev) {
    updaterService.init(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      hidService.startAutoScan(mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  hidService.stopAutoScan();
  hidService.disconnect();
  disposeAllPlugins();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});