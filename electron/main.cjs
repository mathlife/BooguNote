// Electron 跨平台独立桌面应用主进程 (Windows / macOS / Linux)
// 1. 默认以经典窄边框模式 (400x680) 启动
// 2. 窗口拖拽至屏幕任意边缘 (上/左/右) 自动触发靠边自动隐藏，拖离边缘自动恢复正常窗口
// 3. 完整支持右上角主菜单的【正常窗口 / 靠边窗口 / 自动隐藏窗口 / 隐藏显示 / 置顶 / 打开默认目录 / 退出】
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
let isProgrammaticMove = false;

const DEFAULT_NARROW_WIDTH = 400;
const DEFAULT_NARROW_HEIGHT = 680;
const COLLAPSED_THICKNESS = 6; // 自动隐藏收起后保留在屏幕边缘的感应条厚度 (px)
const SNAP_THRESHOLD = 16;     // 拖拽窗口贴近屏幕边缘自动触发自动隐藏的阈值 (px)

// 记录正常窗口与展开态窗口的真实矩形（保留用户拖拽的位置与宽高）
let normalBounds = {
  width: DEFAULT_NARROW_WIDTH,
  height: DEFAULT_NARROW_HEIGHT,
  x: undefined,
  y: undefined,
};
let expandedBounds = {
  width: DEFAULT_NARROW_WIDTH,
  height: DEFAULT_NARROW_HEIGHT,
  x: 0,
  y: 0,
};

// 当前窗口停靠与隐藏状态
let dockState = {
  mode: 'normal',       // 'normal' (正常窗口) | 'docked' (靠边窗口) | 'auto-hide' (自动隐藏窗口)
  edge: 'right',        // 'right' | 'top' | 'left'
  alwaysOnTop: false,   // 是否置顶
  isCollapsed: false,   // 当前是否处于已缩回边缘隐藏状态
};

function getDisplayWorkArea() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().workArea;
  }
  const winBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(winBounds);
  return display.workArea;
}

function setWindowBoundsSafe(bounds, animate = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isProgrammaticMove = true;
  mainWindow.setBounds(bounds, animate);
  setTimeout(() => {
    isProgrammaticMove = false;
  }, 140);
}

// 根据当前窗口坐标判断距离屏幕哪一侧边缘最近 ('top' | 'left' | 'right')
function detectNearestEdge(bounds, workArea) {
  const distTop = Math.abs(bounds.y - workArea.y);
  const distLeft = Math.abs(bounds.x - workArea.x);
  const distRight = Math.abs(
    workArea.x + workArea.width - (bounds.x + bounds.width)
  );
  if (distTop <= distLeft && distTop <= distRight && distTop <= 80) {
    return 'top';
  }
  return distLeft < distRight ? 'left' : 'right';
}

// 计算贴边展开态的窗口矩形（保留窗口原有窄框尺寸与沿边缘方向的坐标）
function calcSnappedExpandedBounds(edge, currentBounds, workArea, fullHeightSidebar = false) {
  const w = Math.min(
    Math.max(280, currentBounds.width || DEFAULT_NARROW_WIDTH),
    workArea.width
  );
  const h = fullHeightSidebar
    ? workArea.height
    : Math.min(
        Math.max(300, currentBounds.height || DEFAULT_NARROW_HEIGHT),
        workArea.height
      );

  if (edge === 'top') {
    const clampedX = Math.max(
      workArea.x,
      Math.min(currentBounds.x, workArea.x + workArea.width - w)
    );
    return { x: clampedX, y: workArea.y, width: w, height: h };
  }

  const clampedY = fullHeightSidebar
    ? workArea.y
    : Math.max(
        workArea.y,
        Math.min(currentBounds.y, workArea.y + workArea.height - h)
      );

  if (edge === 'left') {
    return { x: workArea.x, y: clampedY, width: w, height: h };
  }

  return {
    x: workArea.x + workArea.width - w,
    y: clampedY,
    width: w,
    height: h,
  };
}

// 计算自动隐藏收起后的 6px 边缘感应条矩形
function calcCollapsedStripBounds(edge, expBounds, workArea) {
  if (edge === 'top') {
    return {
      x: expBounds.x,
      y: workArea.y,
      width: expBounds.width,
      height: COLLAPSED_THICKNESS,
    };
  }
  if (edge === 'left') {
    return {
      x: workArea.x,
      y: expBounds.y,
      width: COLLAPSED_THICKNESS,
      height: expBounds.height,
    };
  }
  return {
    x: workArea.x + workArea.width - COLLAPSED_THICKNESS,
    y: expBounds.y,
    width: COLLAPSED_THICKNESS,
    height: expBounds.height,
  };
}

function notifyRendererDockState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('boogu:dock-state-changed', { ...dockState });
  }
}

// 展开自动隐藏的窗口（鼠标移入屏幕边缘隐藏处时自动下拉/滑出显示窗口主体）
function expandAutoHideWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !dockState.isCollapsed) return;
  dockState.isCollapsed = false;
  const workArea = getDisplayWorkArea();
  expandedBounds = calcSnappedExpandedBounds(
    dockState.edge,
    expandedBounds,
    workArea,
    false
  );
  mainWindow.setMinimumSize(260, 280);
  mainWindow.setAlwaysOnTop(true, 'floating');
  setWindowBoundsSafe(expandedBounds, true);
  notifyRendererDockState();
}

// 收起窗口到屏幕边缘（鼠标移出窗口后自动隐藏为 6px 细条）
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
  const current = mainWindow.getBounds();
  expandedBounds = calcSnappedExpandedBounds(
    dockState.edge,
    current,
    workArea,
    false
  );
  const collapsed = calcCollapsedStripBounds(
    dockState.edge,
    expandedBounds,
    workArea
  );

  dockState.isCollapsed = true;
  mainWindow.setMinimumSize(4, 4);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  setWindowBoundsSafe(collapsed, true);
  notifyRendererDockState();
}

// 50ms 全局鼠标位置轮询：鼠标移到边缘隐藏处自动下拉/滑出，移出窗口自动收起
function startCursorMonitor() {
  if (hoverCheckTimer) clearInterval(hoverCheckTimer);

  hoverCheckTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
      return;
    }
    if (dockState.mode !== 'auto-hide') return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();

    if (dockState.isCollapsed) {
      const hitX =
        cursor.x >= bounds.x - 6 && cursor.x <= bounds.x + bounds.width + 6;
      const hitY =
        cursor.y >= bounds.y - 6 && cursor.y <= bounds.y + bounds.height + 6;

      if (hitX && hitY) {
        if (hideDelayTimer) {
          clearTimeout(hideDelayTimer);
          hideDelayTimer = null;
        }
        expandAutoHideWindow();
      }
    } else {
      const insideX =
        cursor.x >= bounds.x - 10 && cursor.x <= bounds.x + bounds.width + 10;
      const insideY =
        cursor.y >= bounds.y - 10 && cursor.y <= bounds.y + bounds.height + 10;

      if (!insideX || !insideY) {
        if (!hideDelayTimer) {
          hideDelayTimer = setTimeout(() => {
            hideDelayTimer = null;
            collapseAutoHideWindow();
          }, 360);
        }
      } else if (hideDelayTimer) {
        clearTimeout(hideDelayTimer);
        hideDelayTimer = null;
      }
    }
  }, 50);
}

// 处理来自菜单、快捷键或拖拽的窗口状态变更
function applyDockState(nextPartial) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // 处理特殊动作指令
  if (nextPartial.action === 'toggle-hide-window') {
    if (dockState.mode === 'auto-hide' && dockState.isCollapsed) {
      expandAutoHideWindow();
      mainWindow.show();
      mainWindow.focus();
    } else if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }

  if (nextPartial.action === 'open-default-dir') {
    shell.openPath(app.getPath('documents'));
    return;
  }

  if (nextPartial.action === 'quit-app') {
    app.quit();
    return;
  }

  const workArea = getDisplayWorkArea();
  const curBounds = dockState.isCollapsed ? expandedBounds : mainWindow.getBounds();

  if (dockState.mode === 'normal' && nextPartial.mode && nextPartial.mode !== 'normal') {
    normalBounds = { ...curBounds };
  }

  if (hideDelayTimer) {
    clearTimeout(hideDelayTimer);
    hideDelayTimer = null;
  }

  const targetMode = nextPartial.mode || dockState.mode;
  const targetEdge =
    nextPartial.edge ||
    (targetMode !== 'normal' && dockState.mode === 'normal'
      ? detectNearestEdge(curBounds, workArea)
      : dockState.edge || 'right');
  const targetAlwaysOnTop =
    nextPartial.alwaysOnTop !== undefined
      ? Boolean(nextPartial.alwaysOnTop)
      : targetMode !== 'normal'
      ? true
      : dockState.alwaysOnTop;

  dockState = {
    mode: targetMode,
    edge: targetEdge,
    alwaysOnTop: targetAlwaysOnTop,
    isCollapsed: false,
  };

  if (dockState.mode === 'normal') {
    mainWindow.setMinimumSize(260, 280);
    mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
    const restoreW = normalBounds.width || DEFAULT_NARROW_WIDTH;
    const restoreH = normalBounds.height || DEFAULT_NARROW_HEIGHT;
    const restoreX =
      normalBounds.x !== undefined
        ? Math.max(
            workArea.x + 20,
            Math.min(normalBounds.x, workArea.x + workArea.width - restoreW - 20)
          )
        : workArea.x + workArea.width - restoreW - 60;
    const restoreY =
      normalBounds.y !== undefined
        ? Math.max(
            workArea.y + 20,
            Math.min(normalBounds.y, workArea.y + workArea.height - restoreH - 20)
          )
        : workArea.y + Math.round((workArea.height - restoreH) / 2);

    setWindowBoundsSafe(
      { x: restoreX, y: restoreY, width: restoreW, height: restoreH },
      true
    );
  } else if (dockState.mode === 'docked') {
    // 靠边窗口模式 (Win+O)：贴合左/右边缘并占满工作区高度
    const sideEdge = dockState.edge === 'left' ? 'left' : 'right';
    dockState.edge = sideEdge;
    expandedBounds = calcSnappedExpandedBounds(sideEdge, curBounds, workArea, true);
    mainWindow.setMinimumSize(260, 280);
    mainWindow.setAlwaysOnTop(true, 'floating');
    setWindowBoundsSafe(expandedBounds, true);
  } else if (dockState.mode === 'auto-hide') {
    // 自动隐藏窗口模式：贴紧所在屏幕边缘并保留当前窄窗口尺寸与位置
    expandedBounds = calcSnappedExpandedBounds(
      dockState.edge,
      curBounds,
      workArea,
      false
    );
    mainWindow.setMinimumSize(260, 280);
    mainWindow.setAlwaysOnTop(true, 'floating');
    setWindowBoundsSafe(expandedBounds, true);
  }

  notifyRendererDockState();
}

function createMainWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const initW = DEFAULT_NARROW_WIDTH;
  const initH = Math.min(DEFAULT_NARROW_HEIGHT, workArea.height - 60);
  // 默认以经典窄窗口启动，置于屏幕偏右侧舒适位置
  normalBounds = {
    width: initW,
    height: initH,
    x: workArea.x + workArea.width - initW - 72,
    y: workArea.y + Math.round((workArea.height - initH) / 2),
  };
  expandedBounds = { ...normalBounds };

  mainWindow = new BrowserWindow({
    ...normalBounds,
    minWidth: 260,
    minHeight: 280,
    title: 'BooguNote',
    autoHideMenuBar: true,
    backgroundColor: '#f1f5f9',
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

  // 监听用户手动拖拽窗口：
  // 1. 拖到屏幕顶部/左侧/右侧边缘时自动触发【自动隐藏窗口】
  // 2. 从屏幕边缘拖回屏幕内部时自动恢复【正常窗口】
  let moveSnapDebounce = null;
  mainWindow.on('moved', () => {
    if (!mainWindow || dockState.isCollapsed || isProgrammaticMove) return;
    if (moveSnapDebounce) clearTimeout(moveSnapDebounce);

    moveSnapDebounce = setTimeout(() => {
      if (
        !mainWindow ||
        mainWindow.isDestroyed() ||
        dockState.isCollapsed ||
        isProgrammaticMove
      ) {
        return;
      }
      const b = mainWindow.getBounds();
      const wa = getDisplayWorkArea();

      const nearTop = b.y <= wa.y + SNAP_THRESHOLD;
      const nearLeft = b.x <= wa.x + SNAP_THRESHOLD;
      const nearRight = b.x + b.width >= wa.x + wa.width - SNAP_THRESHOLD;

      if (nearTop && Math.abs(b.height - wa.height) > 30) {
        if (dockState.mode === 'normal') {
          normalBounds = { ...b, y: wa.y + 36 };
        }
        expandedBounds = calcSnappedExpandedBounds('top', b, wa, false);
        dockState.mode = 'auto-hide';
        dockState.edge = 'top';
        dockState.alwaysOnTop = true;
        mainWindow.setAlwaysOnTop(true, 'floating');
        setWindowBoundsSafe(expandedBounds, true);
        notifyRendererDockState();
      } else if (nearLeft) {
        if (dockState.mode === 'normal') {
          normalBounds = { ...b, x: wa.x + 36 };
        }
        expandedBounds = calcSnappedExpandedBounds('left', b, wa, false);
        dockState.mode = 'auto-hide';
        dockState.edge = 'left';
        dockState.alwaysOnTop = true;
        mainWindow.setAlwaysOnTop(true, 'floating');
        setWindowBoundsSafe(expandedBounds, true);
        notifyRendererDockState();
      } else if (nearRight) {
        if (dockState.mode === 'normal') {
          normalBounds = { ...b, x: wa.x + wa.width - b.width - 36 };
        }
        expandedBounds = calcSnappedExpandedBounds('right', b, wa, false);
        dockState.mode = 'auto-hide';
        dockState.edge = 'right';
        dockState.alwaysOnTop = true;
        mainWindow.setAlwaysOnTop(true, 'floating');
        setWindowBoundsSafe(expandedBounds, true);
        notifyRendererDockState();
      } else if (dockState.mode !== 'normal') {
        // 用户将窗口从边缘拖回屏幕中央：自动解除自动隐藏，恢复为自由移动的正常窄窗口
        dockState.mode = 'normal';
        dockState.isCollapsed = false;
        normalBounds = { ...b };
        notifyRendererDockState();
      } else {
        normalBounds = { ...b };
      }
    }, 160);
  });

  mainWindow.on('resized', () => {
    if (!mainWindow || dockState.isCollapsed || isProgrammaticMove) return;
    const b = mainWindow.getBounds();
    if (dockState.mode === 'normal') {
      normalBounds = { ...b };
    } else {
      expandedBounds = { ...b };
    }
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

  // 注册全局快捷键（兼容原版 Win+O / Shift+Win+O / Win+H 及跨平台 Alt 组合键）
  const tryRegister = (accels, handler) => {
    for (const acc of accels) {
      try {
        if (globalShortcut.register(acc, handler)) break;
      } catch {
        // 某些系统保留键跳过并回退备用快捷键
      }
    }
  };

  // 1. 靠边窗口 (Win+O / Alt+O)
  tryRegister(['Super+O', 'Alt+O'], () => {
    if (!mainWindow) return;
    if (dockState.mode !== 'docked') {
      applyDockState({ mode: 'docked' });
    } else {
      applyDockState({ mode: 'normal', alwaysOnTop: false });
    }
  });

  // 2. 自动隐藏窗口 (Shift+Win+O / Shift+Alt+O)
  tryRegister(['Shift+Super+O', 'Alt+Shift+O'], () => {
    if (!mainWindow) return;
    if (dockState.mode !== 'auto-hide') {
      applyDockState({ mode: 'auto-hide' });
    } else {
      applyDockState({ mode: 'normal', alwaysOnTop: false });
    }
  });

  // 3. 隐藏/显示 窗口 (Win+H / Alt+H)
  tryRegister(['Super+H', 'Alt+H'], () => {
    if (!mainWindow) {
      createMainWindow();
      return;
    }
    applyDockState({ action: 'toggle-hide-window' });
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
