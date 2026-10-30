// Electron 跨平台独立桌面应用主进程 (Windows / macOS / Linux)
// 1. 默认以经典窄边框模式启动
// 2. 拖拽窗口至屏幕上/左/右边缘自动触发靠边自动隐藏（拦截 Windows Aero Snap 避免被系统强行放大）
// 3. 隐藏时完全收起主窗口并仅在屏幕边缘显示 3px 无边框透明感应细线（彻底消除 136px 蓝色大方框）
// 4. 鼠标移至屏幕边缘隐藏处立即自动下拉（顶部）或滑出（左/右侧）显示窗口主体
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
let edgeBarWindow = null;
let hoverCheckTimer = null;
let hideDelayTimer = null;
let isProgrammaticMove = false;
let lastExpandOrMoveTime = 0;

const DEFAULT_NARROW_WIDTH = 400;
const DEFAULT_NARROW_HEIGHT = 600;
const SNAP_THRESHOLD = 28; // 拖拽窗口贴近屏幕边缘自动触发自动隐藏的阈值 (px)

// 记录正常窗口与展开态窗口的真实矩形
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

function getDisplayWorkArea(targetBounds) {
  if (targetBounds && targetBounds.x !== undefined) {
    return screen.getDisplayMatching(targetBounds).workArea;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().workArea;
  }
  const winBounds = mainWindow.getBounds();
  return screen.getDisplayMatching(winBounds).workArea;
}

function setWindowBoundsSafe(bounds, animate = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isProgrammaticMove = true;
  lastExpandOrMoveTime = Date.now();
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  mainWindow.setBounds(bounds, animate);
  setTimeout(() => {
    isProgrammaticMove = false;
  }, 220);
}

// 创建或更新贴在屏幕边缘的 4px 无边框透明指示线窗口
// 关键：即便操作系统强制最小窗口宽度 (136px)，左侧隐藏时也将多余宽度移出屏幕左边界外 (x = workArea.x + 4 - actual.width)，
// 确保屏幕内永远只露出 4px 边缘细条，与右侧隐藏和上方隐藏完全一致！
function showEdgeIndicatorStrip(edge, expBounds, workArea) {
  if (!edgeBarWindow || edgeBarWindow.isDestroyed()) {
    edgeBarWindow = new BrowserWindow({
      width: 6,
      height: 6,
      minWidth: 1,
      minHeight: 1,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    edgeBarWindow.setIgnoreMouseEvents(true);
    const indicatorHtml = `data:text/html;charset=utf-8,${encodeURIComponent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;width:100%;height:100%;background:#2563eb;overflow:hidden;}
      </style></head><body></body></html>`
    )}`;
    edgeBarWindow.loadURL(indicatorHtml);
  }

  const PEEK = 4;
  if (edge === 'top') {
    edgeBarWindow.setBounds(
      { x: expBounds.x, y: workArea.y, width: expBounds.width, height: PEEK },
      false
    );
    const actual = edgeBarWindow.getBounds();
    if (actual.height > PEEK) {
      edgeBarWindow.setPosition(expBounds.x, workArea.y + PEEK - actual.height, false);
    }
  } else if (edge === 'left') {
    edgeBarWindow.setBounds(
      { x: workArea.x, y: expBounds.y, width: PEEK, height: expBounds.height },
      false
    );
    const actual = edgeBarWindow.getBounds();
    if (actual.width > PEEK) {
      edgeBarWindow.setPosition(workArea.x + PEEK - actual.width, expBounds.y, false);
    }
  } else {
    edgeBarWindow.setBounds(
      {
        x: workArea.x + workArea.width - PEEK,
        y: expBounds.y,
        width: PEEK,
        height: expBounds.height,
      },
      false
    );
  }

  edgeBarWindow.setAlwaysOnTop(true, 'screen-saver');
  edgeBarWindow.showInactive();
}

function hideEdgeIndicatorStrip() {
  if (edgeBarWindow && !edgeBarWindow.isDestroyed() && edgeBarWindow.isVisible()) {
    edgeBarWindow.hide();
  }
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

// 计算贴边展开态的窗口矩形（防止被系统 Aero Snap 放大，保留经典窄框尺寸与边缘对应位置）
function calcSnappedExpandedBounds(
  edge,
  currentBounds,
  workArea,
  fullHeightSidebar = false
) {
  const maxSafeWidth = Math.round(workArea.width * 0.44);
  const rawW =
    currentBounds.width && currentBounds.width < maxSafeWidth
      ? currentBounds.width
      : normalBounds.width || DEFAULT_NARROW_WIDTH;
  const w = Math.min(Math.max(280, rawW), workArea.width);

  const maxSafeHeight = Math.round(workArea.height * 0.85);
  const rawH =
    currentBounds.height && currentBounds.height < maxSafeHeight
      ? currentBounds.height
      : normalBounds.height ||
        Math.min(DEFAULT_NARROW_HEIGHT, Math.round(workArea.height * 0.78));
  const h = fullHeightSidebar
    ? workArea.height
    : Math.min(Math.max(300, rawH), Math.round(workArea.height * 0.85));

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

function notifyRendererDockState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('boogu:dock-state-changed', { ...dockState });
  }
}

// 展开自动隐藏的窗口（鼠标移入屏幕边缘隐藏处时自动下拉/滑出显示窗口主体）
function expandAutoHideWindow() {
  if (!mainWindow || mainWindow.isDestroyed() || !dockState.isCollapsed) return;
  dockState.isCollapsed = false;
  hideEdgeIndicatorStrip();

  const workArea = getDisplayWorkArea(expandedBounds);
  expandedBounds = calcSnappedExpandedBounds(
    dockState.edge,
    expandedBounds,
    workArea,
    false
  );
  setWindowBoundsSafe(expandedBounds, false);
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.show();
  notifyRendererDockState();
}

// 收起窗口到屏幕边缘：完全隐藏主窗口（杜绝 136px 蓝色大方框），仅在边缘留 3px 透明指示线
function collapseAutoHideWindow() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    dockState.mode !== 'auto-hide' ||
    dockState.isCollapsed
  ) {
    return;
  }
  const current = mainWindow.getBounds();
  const workArea = getDisplayWorkArea(current);
  expandedBounds = calcSnappedExpandedBounds(
    dockState.edge,
    current,
    workArea,
    false
  );

  dockState.isCollapsed = true;
  showEdgeIndicatorStrip(dockState.edge, expandedBounds, workArea);
  mainWindow.hide();
  notifyRendererDockState();
}

// 50ms 全局鼠标位置轮询：鼠标移到屏幕边缘隐藏处自动下拉/滑出，移出窗口自动收起隐藏
function startCursorMonitor() {
  if (hoverCheckTimer) clearInterval(hoverCheckTimer);

  hoverCheckTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (dockState.mode !== 'auto-hide') return;

    const cursor = screen.getCursorScreenPoint();
    const workArea = getDisplayWorkArea(expandedBounds);

    if (dockState.isCollapsed) {
      // 检测鼠标是否移入对应屏幕边缘的唤醒区域（上下/左右放宽 30px 范围，边缘厚度 8px）
      let hitEdge = false;
      if (dockState.edge === 'top') {
        hitEdge =
          cursor.y <= workArea.y + 8 &&
          cursor.x >= expandedBounds.x - 30 &&
          cursor.x <= expandedBounds.x + expandedBounds.width + 30;
      } else if (dockState.edge === 'left') {
        hitEdge =
          cursor.x <= workArea.x + 8 &&
          cursor.y >= expandedBounds.y - 30 &&
          cursor.y <= expandedBounds.y + expandedBounds.height + 30;
      } else {
        hitEdge =
          cursor.x >= workArea.x + workArea.width - 8 &&
          cursor.y >= expandedBounds.y - 30 &&
          cursor.y <= expandedBounds.y + expandedBounds.height + 30;
      }

      if (hitEdge) {
        if (hideDelayTimer) {
          clearTimeout(hideDelayTimer);
          hideDelayTimer = null;
        }
        expandAutoHideWindow();
      }
    } else {
      if (!mainWindow.isVisible()) return;
      // 刚展开或刚完成拖拽后的 500ms 保护期内不立即收起
      if (Date.now() - lastExpandOrMoveTime < 500) return;

      const bounds = mainWindow.getBounds();
      const insideX =
        cursor.x >= bounds.x - 12 && cursor.x <= bounds.x + bounds.width + 12;
      const insideY =
        cursor.y >= bounds.y - 12 && cursor.y <= bounds.y + bounds.height + 12;

      if (!insideX || !insideY) {
        if (!hideDelayTimer) {
          hideDelayTimer = setTimeout(() => {
            hideDelayTimer = null;
            collapseAutoHideWindow();
          }, 350);
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

  if (nextPartial.action === 'toggle-hide-window') {
    if (dockState.mode === 'auto-hide' && dockState.isCollapsed) {
      expandAutoHideWindow();
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

  const curBounds = dockState.isCollapsed
    ? expandedBounds
    : mainWindow.getBounds();
  const workArea = getDisplayWorkArea(curBounds);

  if (
    dockState.mode === 'normal' &&
    nextPartial.mode &&
    nextPartial.mode !== 'normal'
  ) {
    if (curBounds.width < workArea.width * 0.45) {
      normalBounds = { ...curBounds };
    }
  }

  if (hideDelayTimer) {
    clearTimeout(hideDelayTimer);
    hideDelayTimer = null;
  }
  hideEdgeIndicatorStrip();

  const targetMode = nextPartial.mode || dockState.mode;
  const targetEdge =
    nextPartial.edge ||
    (targetMode !== 'normal' && dockState.mode === 'normal'
      ? detectNearestEdge(curBounds, workArea)
      : dockState.edge || 'right');
  const targetAlwaysOnTop =
    nextPartial.alwaysOnTop !== undefined
      ? Boolean(nextPartial.alwaysOnTop)
      : dockState.alwaysOnTop;

  dockState = {
    mode: targetMode,
    edge: targetEdge,
    alwaysOnTop: targetAlwaysOnTop,
    isCollapsed: false,
  };

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  if (dockState.mode === 'normal') {
    mainWindow.setMinimumSize(260, 280);
    mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
    const restoreW = normalBounds.width || DEFAULT_NARROW_WIDTH;
    const restoreH =
      normalBounds.height ||
      Math.min(DEFAULT_NARROW_HEIGHT, Math.round(workArea.height * 0.78));
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
            Math.min(
              normalBounds.y,
              workArea.y + workArea.height - restoreH - 20
            )
          )
        : workArea.y + Math.round((workArea.height - restoreH) / 2);

    setWindowBoundsSafe(
      { x: restoreX, y: restoreY, width: restoreW, height: restoreH },
      true
    );
  } else if (dockState.mode === 'docked') {
    const sideEdge = dockState.edge === 'left' ? 'left' : 'right';
    dockState.edge = sideEdge;
    expandedBounds = calcSnappedExpandedBounds(
      sideEdge,
      curBounds,
      workArea,
      true
    );
    mainWindow.setMinimumSize(260, 280);
    mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
    setWindowBoundsSafe(expandedBounds, true);
  } else if (dockState.mode === 'auto-hide') {
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
  const initH = Math.min(
    DEFAULT_NARROW_HEIGHT,
    Math.round(workArea.height * 0.78)
  );
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
    icon: path.join(__dirname, '../dist/icon.png'),
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

  // 关键修复：在 Windows 10/11 下，用户把窗口拖到屏幕最顶端松手时，系统 Aero Snap 会触发 maximize。
  // 这里直接拦截顶边拖拽引发的 maximize，自动转为【顶部边缘自动隐藏】！
  mainWindow.on('maximize', () => {
    if (!mainWindow || isProgrammaticMove) return;
    const cursor = screen.getCursorScreenPoint();
    const wa = getDisplayWorkArea();
    if (cursor.y <= wa.y + 36) {
      isProgrammaticMove = true;
      mainWindow.unmaximize();
      const w = normalBounds.width || DEFAULT_NARROW_WIDTH;
      const h = Math.min(
        normalBounds.height || DEFAULT_NARROW_HEIGHT,
        Math.round(wa.height * 0.78)
      );
      const x = Math.max(
        wa.x,
        Math.min(cursor.x - Math.round(w / 2), wa.x + wa.width - w)
      );
      expandedBounds = { x, y: wa.y, width: w, height: h };
      dockState.mode = 'auto-hide';
      dockState.edge = 'top';
      dockState.isCollapsed = false;
      hideEdgeIndicatorStrip();
      mainWindow.setAlwaysOnTop(true, 'floating');
      mainWindow.setBounds(expandedBounds, false);
      lastExpandOrMoveTime = Date.now();
      setTimeout(() => {
        isProgrammaticMove = false;
      }, 220);
      notifyRendererDockState();
    }
  });

  // 监听用户手动拖拽窗口：
  // 1. 拖到屏幕顶部/左侧/右侧边缘时自动触发对应边缘的【自动隐藏窗口】
  // 2. 从屏幕边缘拖回屏幕中央时自动恢复【正常窗口】，并立即取消窗口置顶，避免遮挡其他程序
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
      const wa = getDisplayWorkArea(b);
      const cursor = screen.getCursorScreenPoint();

      const nearLeft =
        b.x <= wa.x + SNAP_THRESHOLD || cursor.x <= wa.x + 14;
      const nearRight =
        b.x + b.width >= wa.x + wa.width - SNAP_THRESHOLD ||
        cursor.x >= wa.x + wa.width - 14;
      const nearTop =
        b.y <= wa.y + SNAP_THRESHOLD || cursor.y <= wa.y + 14;

      // 根据窗口与鼠标位置精准判定目标边缘（上 / 左 / 右）
      let detectedEdge = null;
      if (
        nearTop &&
        cursor.y <= wa.y + 48 &&
        cursor.x > wa.x + 80 &&
        cursor.x < wa.x + wa.width - 80
      ) {
        detectedEdge = 'top';
      } else if (nearLeft && (!nearTop || cursor.x <= wa.x + 160)) {
        detectedEdge = 'left';
      } else if (
        nearRight &&
        (!nearTop || cursor.x >= wa.x + wa.width - 160)
      ) {
        detectedEdge = 'right';
      } else if (nearTop) {
        detectedEdge = 'top';
      }

      if (detectedEdge) {
        expandedBounds = calcSnappedExpandedBounds(detectedEdge, b, wa, false);
        dockState.mode = 'auto-hide';
        dockState.edge = detectedEdge;
        dockState.isCollapsed = false;
        hideEdgeIndicatorStrip();
        mainWindow.setAlwaysOnTop(true, 'floating');
        setWindowBoundsSafe(expandedBounds, true);
        notifyRendererDockState();
      } else if (dockState.mode !== 'normal') {
        // 用户将窗口从边缘拖回屏幕中央：自动解除自动隐藏，恢复为自由移动的正常窄窗口，并取消置顶
        dockState.mode = 'normal';
        dockState.isCollapsed = false;
        hideEdgeIndicatorStrip();
        mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
        if (b.width < wa.width * 0.45 && b.height < wa.height * 0.9) {
          normalBounds = { ...b };
        }
        notifyRendererDockState();
      } else {
        mainWindow.setAlwaysOnTop(Boolean(dockState.alwaysOnTop));
        if (b.width < wa.width * 0.45 && b.height < wa.height * 0.9) {
          normalBounds = { ...b };
        }
      }
    }, 200);
  });

  mainWindow.on('resized', () => {
    if (!mainWindow || dockState.isCollapsed || isProgrammaticMove) return;
    if (mainWindow.isMaximized()) return;
    const b = mainWindow.getBounds();
    const wa = getDisplayWorkArea(b);
    if (b.width < wa.width * 0.45 && b.height < wa.height * 0.9) {
      if (dockState.mode === 'normal') {
        normalBounds = { ...b };
      } else {
        expandedBounds = { ...b };
      }
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
    hideEdgeIndicatorStrip();
    if (edgeBarWindow && !edgeBarWindow.isDestroyed()) {
      edgeBarWindow.close();
    }
    edgeBarWindow = null;
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

  const tryRegister = (accels, handler) => {
    for (const acc of accels) {
      try {
        if (globalShortcut.register(acc, handler)) break;
      } catch {
        // 忽略系统保留键冲突
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
  hideEdgeIndicatorStrip();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
