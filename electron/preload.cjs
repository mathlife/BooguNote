// Electron 预加载桥接脚本：向渲染进程暴露原生桌面窗口控制接口
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('booguDesktop', {
  isDesktopApp: true,
  // 设置窗口停靠模式: { mode: 'normal' | 'docked' | 'auto-hide', edge: 'right' | 'top' | 'left', alwaysOnTop?: boolean }
  setDockState: (state) => ipcRenderer.invoke('boogu:set-dock-state', state),
  // 获取当前窗口停靠状态
  getDockState: () => ipcRenderer.invoke('boogu:get-dock-state'),
  // 监听主进程因拖拽贴边或全局快捷键触发的状态变更
  onDockStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('boogu:dock-state-changed', handler);
    return () => ipcRenderer.removeListener('boogu:dock-state-changed', handler);
  },
});
