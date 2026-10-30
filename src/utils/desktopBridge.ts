import { WindowDockState } from '../types/outline';

declare global {
  interface Window {
    booguDesktop?: {
      isDesktopApp: boolean;
      setDockState: (
        state: Partial<WindowDockState>
      ) => Promise<WindowDockState>;
      getDockState: () => Promise<WindowDockState>;
      onDockStateChanged: (
        callback: (state: WindowDockState) => void
      ) => () => void;
    };
  }
}

// 统一调用桌面端（Electron 或 Windows Standalone 原生宿主）改变物理窗口尺寸与靠边自动隐藏状态
export async function setNativeWindowDock(
  state: Partial<WindowDockState>
): Promise<WindowDockState | null> {
  // 1. 优先使用 Electron Preload IPC 桥
  if (window.booguDesktop?.setDockState) {
    try {
      return await window.booguDesktop.setDockState(state);
    } catch {
      // 忽略异常
    }
  }

  // 2. 兼容 Windows Standalone 单文件原生宿主 HTTP 控制桥
  try {
    const res = await fetch('/__boogu_win_cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (res.ok) {
      return (await res.json()) as WindowDockState;
    }
  } catch {
    // 非 Standalone 环境时静默忽略
  }

  return null;
}

// 订阅原生窗口因用户拖拽贴边或全局快捷键引发的状态变化
export function subscribeNativeDockState(
  onChanged: (state: WindowDockState) => void
): () => void {
  if (window.booguDesktop?.onDockStateChanged) {
    return window.booguDesktop.onDockStateChanged(onChanged);
  }

  // Standalone 宿主轮询同步状态
  let active = true;
  const timer = setInterval(async () => {
    if (!active) return;
    try {
      const res = await fetch('/__boogu_win_state');
      if (res.ok) {
        const data = (await res.json()) as WindowDockState;
        if (data && data.mode) {
          onChanged(data);
        }
      }
    } catch {
      // 非 Standalone 宿主忽略
    }
  }, 400);

  return () => {
    active = false;
    clearInterval(timer);
  };
}
