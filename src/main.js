'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, ipcMain, shell, session, dialog } = require('electron');

const PROTOCOL = 'trustchat';
let mainWindow = null;
let currentSite = null;
let pendingProtocolUrl = null;

function getStorePath() {
  return path.join(app.getPath('userData'), 'trustchat-site.json');
}

function readStore() {
  try {
    const data = JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
    if (data && data.appUrl) return data;
  } catch (error) {}
  return null;
}

function writeStore(site) {
  try {
    fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
    fs.writeFileSync(getStorePath(), JSON.stringify(site || {}, null, 2));
  } catch (error) {}
}

function clearStore() {
  try {
    fs.unlinkSync(getStorePath());
  } catch (error) {}
  currentSite = null;
}

function normalizeSiteInput(input, siteName) {
  let raw = String(input || '').trim();
  if (!raw) return { error: 'Vui lòng nhập địa chỉ website.' };
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (error) {
    return { error: 'Địa chỉ website không hợp lệ.' };
  }
  if (!/^https?:$/.test(parsed.protocol)) return { error: 'Chỉ hỗ trợ website http/https.' };
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    return { error: 'Website thật nên dùng HTTPS để đăng nhập an toàn.' };
  }

  let pathname = parsed.pathname || '/';
  const marker = '/trustchat-app';
  const index = pathname.toLowerCase().indexOf(marker);
  if (index >= 0) {
    pathname = pathname.slice(0, index + marker.length) + '/';
  } else {
    pathname = pathname.replace(/\/+$/, '') + '/trustchat-app/';
  }
  parsed.pathname = pathname.replace(/\/+/g, '/');
  parsed.search = '';
  parsed.hash = '';

  return {
    appUrl: parsed.toString(),
    origin: parsed.origin,
    siteName: String(siteName || '').trim() || parsed.hostname,
    savedAt: new Date().toISOString()
  };
}

function getSetupUrl() {
  return 'file://' + path.join(__dirname, 'setup.html');
}

function getIconPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png')
  ];
  for (const filePath of candidates) {
    if (filePath && fs.existsSync(filePath)) return filePath;
  }
  return undefined;
}

function isSafeInternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') return true;
    if (!currentSite || !currentSite.origin) return false;
    if (!/^https?:$/.test(parsed.protocol)) return false;
    return parsed.origin === currentSite.origin;
  } catch (error) {
    return false;
  }
}

function setupPermissions() {
  const desktopSession = session.fromPartition('persist:trustchat-desktop');
  desktopSession.setPermissionRequestHandler(function (webContents, permission, callback) {
    const allowedPermissions = ['notifications', 'media', 'fullscreen', 'clipboard-read'];
    callback(isSafeInternalUrl(webContents.getURL()) && allowedPermissions.includes(permission));
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    title: 'TrustChat Desktop',
    icon: getIconPath(),
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#eef5ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: 'persist:trustchat-desktop'
    }
  });

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(function (details) {
    if (isSafeInternalUrl(details.url)) {
      mainWindow.loadURL(details.url);
    } else {
      shell.openExternal(details.url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (!isSafeInternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('did-fail-load', function (event, errorCode, errorDescription, validatedUrl) {
    if (validatedUrl && validatedUrl.startsWith('file://')) return;
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Không mở được TrustChat',
      message: 'Không thể tải trang TrustChat.',
      detail: errorDescription || 'Vui lòng kiểm tra mạng hoặc địa chỉ website.',
      buttons: ['Thử lại', 'Đổi website']
    }).then(function (result) {
      if (!mainWindow) return;
      if (result.response === 0 && currentSite && currentSite.appUrl) {
        mainWindow.loadURL(currentSite.appUrl);
      } else {
        mainWindow.loadURL(getSetupUrl());
      }
    });
  });

  return mainWindow;
}

function loadCurrentSite() {
  if (!mainWindow) return;
  currentSite = readStore();
  if (currentSite && currentSite.appUrl) {
    mainWindow.setTitle('TrustChat Desktop — ' + (currentSite.siteName || currentSite.origin));
    mainWindow.loadURL(currentSite.appUrl);
    return;
  }
  mainWindow.setTitle('TrustChat Desktop');
  mainWindow.loadURL(getSetupUrl());
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function setupProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch (error) {}
}

function findProtocolArg(argv) {
  const prefix = PROTOCOL + '://';
  return (argv || []).find(function (value) {
    return typeof value === 'string' && value.toLowerCase().startsWith(prefix);
  });
}

function handleProtocolUrl(rawUrl) {
  if (!rawUrl) return;
  if (!mainWindow) {
    pendingProtocolUrl = rawUrl;
    return;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol.replace(':', '') !== PROTOCOL) return;
    const target = parsed.searchParams.get('site') || parsed.searchParams.get('url') || parsed.searchParams.get('appUrl') || '';
    const name = parsed.searchParams.get('name') || '';
    const site = normalizeSiteInput(target, name);
    if (site.error) {
      mainWindow.loadURL(getSetupUrl());
      focusWindow();
      return;
    }
    currentSite = site;
    writeStore(site);
    mainWindow.setTitle('TrustChat Desktop — ' + site.siteName);
    mainWindow.loadURL(site.appUrl);
    focusWindow();
  } catch (error) {
    if (mainWindow) mainWindow.loadURL(getSetupUrl());
  }
}

function setupMenu() {
  const template = [
    {
      label: 'TrustChat',
      submenu: [
        { label: 'Mở TrustChat', click: function () { loadCurrentSite(); } },
        { label: 'Đổi website', click: function () { if (mainWindow) mainWindow.loadURL(getSetupUrl()); } },
        { label: 'Xoá website đã lưu', click: function () { clearStore(); if (mainWindow) mainWindow.loadURL(getSetupUrl()); } },
        { type: 'separator' },
        { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', click: function () { if (mainWindow) mainWindow.reload(); } },
        { type: 'separator' },
        { label: 'Thoát', role: 'quit' }
      ]
    },
    {
      label: 'Hiển thị',
      submenu: [
        { role: 'resetZoom', label: 'Cỡ chữ mặc định' },
        { role: 'zoomIn', label: 'Phóng to' },
        { role: 'zoomOut', label: 'Thu nhỏ' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toàn màn hình' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function (event, argv) {
    const protocolUrl = findProtocolArg(argv);
    if (protocolUrl) handleProtocolUrl(protocolUrl);
    focusWindow();
  });

  app.whenReady().then(function () {
    setupProtocol();
    setupPermissions();
    setupMenu();
    createMainWindow();
    const protocolUrl = findProtocolArg(process.argv);
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl);
    } else {
      loadCurrentSite();
    }
    if (pendingProtocolUrl) {
      handleProtocolUrl(pendingProtocolUrl);
      pendingProtocolUrl = null;
    }
  });
}

app.on('open-url', function (event, url) {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
    loadCurrentSite();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('trustchat:get-state', function () {
  return {
    version: app.getVersion(),
    platform: process.platform,
    site: currentSite || readStore()
  };
});

ipcMain.handle('trustchat:save-site', function (event, payload) {
  const site = normalizeSiteInput(payload && payload.url, payload && payload.name);
  if (site.error) return site;
  currentSite = site;
  writeStore(site);
  if (mainWindow) {
    mainWindow.setTitle('TrustChat Desktop — ' + site.siteName);
    mainWindow.loadURL(site.appUrl);
  }
  return { ok: true, site: site };
});

ipcMain.handle('trustchat:clear-site', function () {
  clearStore();
  if (mainWindow) mainWindow.loadURL(getSetupUrl());
  return { ok: true };
});
