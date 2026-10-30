// Electron 跨平台独立桌面应用主进程 (支持 Windows .exe / macOS .dmg / Linux .AppImage)
const { app, BrowserWindow, screen, globalShortcut, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 1020,
    height: Math.min(820, height - 40),
    minWidth: 360,
    minHeight: 420,
    title: 'BooguNote',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 移除默认顶部菜单栏，保持原版 BooguNote 极简窗口体验
  Menu.setApplicationMenu(null);

  // 外部链接使用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  // 注册全局呼出/隐藏快捷键 Alt+Shift+B (致敬原版全局呼出窗口)
  globalShortcut.register('Alt+Shift+B', () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
