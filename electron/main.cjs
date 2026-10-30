// Electron 跨平台独立桌面应用主进程
// 支持：1. 物理窗口尺寸自适应切换  2. 拖拽贴边自动吸附 (顶/右/左)  3. 靠边自动隐藏与鼠标移入自动下拉/滑出
const {
  app,
  BrowserWindow,
  screen,
  globalShortcut,
  Menu,
  shell,
  ipcMain,
} = require('electron');
const path = require('path');

let mainWindow = null;
let hoverCheckTimer = null;
let hideDelayTimer = null;

// 记录标准模式下的窗口位置与尺寸，以便从靠边模式切回标准模式时精准恢复
let normalBounds = { width: 1020, height: 740, x: undefined, y: undefined };

// 当前窗口停靠与隐藏状态
let dockState = {
  mode: 'normal',       // 'normal' (标准窗口) | 'docked' (靠边固定窄框) | 'auto-hide' (靠边自动吸附隐藏)
  edge: 'right',        // 'right' (右侧滑出) | 'top' (顶部下拉) | 'left' (左侧滑出)
  alwaysOnTop: false,   // 是否置顶
  isCollapsed: false,   // 当前是否处于已缩回边缘隐藏状态
};

const DOCK_WIDTH_SIDE = 430;      // 左右停靠时的窄框物理宽度
const DOCK_WIDTH_TOP = 500;       // 顶部下拉停靠时的物理宽度
const DOCK_HEIGHT_TOP = 640;      // 顶部下拉停靠时的物理高度
const COLLAPSED_THICKNESS = 6;    // 自动隐藏收起后保留在屏幕边缘的感应条厚度 (px)
const SNAP_THRESHOLD = 14;        // 拖拽窗口贴近屏幕边缘自动触发吸附的阈值 (px)

function getDisplayWorkArea() {
  if (!mainWindow) {
    return screen.getPrimaryDisplay().workArea;
  }
  const winBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(winBounds);
  return display.workArea;
}

// 计算展开状态下的停靠物理窗口矩形
function calcExpandedDockBounds(edge, workArea) {
  if (edge === 'top') {
    const winBounds = mainWindow ? mainWindow.getBounds() : normalBounds;
    // 保持当前水平 X 坐标（限制在屏幕内），Y 贴紧屏幕顶部
    const w = DOCK_WIDTH_TOP;
    const h = Math.min(DOCK_HEIGHT_TOP, workArea.height - 40);
    const defaultX = workArea.x + Math.round((workArea.width - w) / 2);
    const rawX = winBounds.x !== undefined ? winBounds.x : defaultX;
    const clampedX = Math.max(
      workArea.x,
      Math.min(rawX, workArea.x + workArea.width - w)
    );
    return { x: clampedX, y: workArea.y, width: w, height: h };
  }

  if (edge === 'left') {
    return {
      x: workArea.x,
      y: workArea.y,
      width: DOCK_WIDTH_SIDE,
      height: workArea.height,
    };
  }

  // 默认右侧停靠 ('right')
  return {
    x: workArea.x + workArea.width - DOCK_WIDTH_SIDE,
    y: workArea.y,
    width: DOCK_WIDTH_SIDE,
    height: workArea.height,
  };
}

// 计算自动隐藏收起后的边缘感应条物理窗口矩形
function calcCollapsedDockBounds(edge, expandedBounds, workArea) {
  if (edge === 'top') {
    return {
      x: expandedBounds.x,
      y: workArea.y,
      width: expandedBounds.width,
      height: COLLAPSED_THICKNESS,
    };
  }
  if (edge === 'left') {
    return {
      x: workArea.x,
      y: expandedBounds.y,
      width: COLLAPSED_THICKNESS,
      height: expandedBounds.height,
    };
  }
  // 右侧边缘收起
  return {
    x: workArea.x + workArea.width - COLLAPSED_THICKNESS,
    y: expandedBounds.y,
    width: COLLAPSED_THICKNESS,
    height: expandedBounds.height,
  };
}

// 向前端渲染进程同步最新停靠状态
function notifyRendererDockState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('boogu:dock-state-changed', { ...dockState });
  }
}

// 展开自动隐藏的窗口（鼠标移入边缘时自动下拉/滑出）
function expandAutoHideWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !dockState.isCollapsed) return;
  dockState.isCollapsed = false;
  const workArea = getDisplayWorkArea();
  const target = calcExpandedDockBounds(dockState.edge, workArea);
  mainWindow.setMinimumSize(320, 300);
  mainWindow.setBounds(target, true);
  mainWindow.setAlwaysOnTop(true, 'floating');
  notifyRendererDockState();
}

// 收起窗口到屏幕边缘（鼠标移出窗口后自动隐藏）
function collapseAutoHideWindow() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    dockState.mode !== 'auto-hide' ||
    dockState.isCollapsed
  ) {
    return;
  }
  const workArea = getDisplayWorkArea();
  const expanded = calcExpandedDockBounds(dockState.edge, workArea);
  const collapsed = calcCollapsedDockBounds(dockState.edge, expanded, workArea);

  dockState.isCollapsed = true;
  // 允许窗口缩窄/缩矮到 6px 感应条尺寸
  mainWindow.setMinimumSize(4, 4);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setBounds(collapsed, true);
  notifyRendererDockState();
}

// 启动全局鼠标坐标轮询：实现丝滑的“移入边缘自动下拉/滑出，移出窗口自动收起隐藏”
function startCursorMonitor() {
  if (hoverCheckTimer) clearInterval(hoverCheckTimer);

  hoverCheckTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (dockState.mode !== 'auto-hide') return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();

    if (dockState.isCollapsed) {
      // 当处于边缘收起状态时，检测鼠标是否触碰到边缘感应区（放宽 4px 感应裕度）
      const hitX =
        cursor.x >= bounds.x - 4 && cursor.x <= bounds.x + bounds.width + 4;
      const hitY =
        cursor.y >= bounds.y - 4 && cursor.y <= bounds.y + bounds.height + 4;

      if (hitX && hitY) {
        if (hideDelayTimer) {
          clearTimeout(hideDelayTimer);
          hideDelayTimer = null;
        }
        expandAutoHideWindow();
      }
    } else {
      // 当处于展开状态时，检测鼠标是否已经离开窗口范围
      const insideX =
        cursor.x >= bounds.x - 8 && cursor.x <= bounds.x + bounds.width + 8;
      const insideY =
        cursor.y >= bounds.y - 8 && cursor.y <= bounds.y + bounds.height + 8;

      if (!insideX || !insideY) {
        if (!hideDelayTimer) {
          hideDelayTimer = setTimeout(() => {
            hideDelayTimer = null;
            collapseAutoHideWindow();
          }, 380);
        }
      } else if (hideDelayTimer) {
        clearTimeout(hideDelayTimer);
        hideDelayTimer = null;
      }
    }
  }, 50);
}

// 应用新的窗口停靠模式与物理尺寸
function applyDockState(nextPartial) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const prevMode = dockState.mode;
  if (prevMode === 'normal' && nextPartial.mode && nextPartial.mode !== 'normal') {
    // 从标准窗口切入靠边模式前，先保存标准窗口的真实尺寸与坐标
    normalBounds = mainWindow.getBounds();
  }

  if (hideDelayTimer) {
    clearTimeout(hideDelayTimer);
    hideDelayTimer = null;
  }

  dockState = {
    ...dockState,
    ...nextPartial,
    isCollapsed: false,
  };

  const workArea = getDisplayWorkArea();

  if (dockState.mode === 'normal') {
    mainWindow.setMinimumSize(360, 420);
    mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
    const restoreW = Math.max(780, normalBounds.width || 1020);
    const restoreH = Math.max(540, normalBounds.height || 740);
    const restoreX =
      normalBounds.x !== undefined
        ? normalBounds.x
        : workArea.x + Math.round((workArea.width - restoreW) / 2);
    const restoreY =
      normalBounds.y !== undefined
        ? normalBounds.y
        : workArea.y + Math.round((workArea.height - restoreH) / 2);
    mainWindow.setBounds(
      { x: restoreX, y: restoreY, width: restoreW, height: restoreH },
      true
    );
  } else if (dockState.mode === 'docked') {
    mainWindow.setMinimumSize(320, 360);
    mainWindow.setAlwaysOnTop(true, 'floating');
    const target = calcExpandedDockBounds(dockState.edge, workArea);
    mainWindow.setBounds(target, true);
  } else if (dockState.mode === 'auto-hide') {
    mainWindow.setMinimumSize(320, 360);
    mainWindow.setAlwaysOnTop(true, 'floating');
    const target = calcExpandedDockBounds(dockState.edge, workArea);
    mainWindow.setBounds(target, true);
  }

  notifyRendererDockState();
}

function createMainWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const initW = 1020;
  const initH = Math.min(760, workArea.height - 60);
  normalBounds = {
    width: initW,
    height: initH,
    x: workArea.x + Math.round((workArea.width - initW) / 2),
    y: workArea.y + Math.round((workArea.height - initH) / 2),
  };

  mainWindow = new BrowserWindow({
    ...normalBounds,
    minWidth: 360,
    minHeight: 400,
    title: 'BooguNote',
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 监听用户手动拖拽窗口：如果拖到屏幕顶部/右侧/左侧边缘，自动触发靠边自动隐藏吸附！
  let moveSnapDebounce = null;
  mainWindow.on('moved', () => {
    if (!mainWindow || dockState.isCollapsed) return;
    if (moveSnapDebounce) clearTimeout(moveSnapDebounce);

    moveSnapDebounce = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || dockState.isCollapsed) return;
      const b = mainWindow.getBounds();
      const wa = getDisplayWorkArea();

      // 判断是否贴近屏幕顶部、右侧或左侧边缘
      if (b.y <= wa.y + SNAP_THRESHOLD && Math.abs(b.height - wa.height) > 40) {
        if (dockState.mode === 'normal') normalBounds = { ...b, y: wa.y + 40 };
        applyDockState({ mode: 'auto-hide', edge: 'top', alwaysOnTop: true });
      } else if (b.x + b.width >= wa.x + wa.width - SNAP_THRESHOLD) {
        if (dockState.mode === 'normal') normalBounds = { ...b, x: wa.x + wa.width - b.width - 40 };
        applyDockState({ mode: 'auto-hide', edge: 'right', alwaysOnTop: true });
      } else if (b.x <= wa.x + SNAP_THRESHOLD) {
        if (dockState.mode === 'normal') normalBounds = { ...b, x: wa.x + 40 };
        applyDockState({ mode: 'auto-hide', edge: 'left', alwaysOnTop: true });
      } else if (dockState.mode !== 'normal') {
        // 如果用户把已停靠的窗口从屏幕边缘往中间拖离，则自动解除靠边停靠，但保持窄框或恢复自由移动
        dockState.mode = 'normal';
        notifyRendererDockState();
      }
    }, 180);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  startCursorMonitor();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 通道注册
ipcMain.handle('boogu:set-dock-state', (_event, nextPartial) => {
  applyDockState(nextPartial || {});
  return { ...dockState };
});

ipcMain.handle('boogu:get-dock-state', () => {
  return { ...dockState };
});

app.whenReady().then(() => {
  createMainWindow();

  // 注册全局快捷键：
  // 1. Alt+Shift+O：切换靠边窄框停靠模式 (致敬原版 Win+O)
  globalShortcut.register('Alt+Shift+O', () => {
    if (!mainWindow) return;
    if (dockState.mode === 'normal') {
      applyDockState({ mode: 'docked', edge: 'right', alwaysOnTop: true });
    } else {
      applyDockState({ mode: 'normal', alwaysOnTop: false });
    }
  });

  // 2. Alt+Shift+H：切换靠边自动吸附隐藏模式 (致敬原版 Win+Shift+O)
  globalShortcut.register('Alt+Shift+H', () => {
    if (!mainWindow) return;
    if (dockState.mode !== 'auto-hide') {
      applyDockState({ mode: 'auto-hide', edge: dockState.edge || 'right', alwaysOnTop: true });
    } else {
      applyDockState({ mode: 'normal', alwaysOnTop: false });
    }
  });

  // 3. Alt+Shift+B：全局呼出/隐藏主窗口
  globalShortcut.register('Alt+Shift+B', () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }
    if (dockState.mode === 'auto-hide' && dockState.isCollapsed) {
      expandAutoHideWindow();
      mainWindow.focus();
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
  if (hoverCheckTimer) clearInterval(hoverCheckTimer);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
