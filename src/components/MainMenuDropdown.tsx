import React from 'react';
import { Check } from 'lucide-react';
import { AppConfig, WindowDockMode } from '../types/outline';

interface MainMenuDropdownProps {
  config: AppConfig;
  searchOpen: boolean;
  onClose: () => void;
  // 文档操作
  onNewDoc: () => void;
  onOpenDoc: () => void;
  onCloseDoc: () => void;
  onSaveDoc: () => void;
  onSaveAsDoc: () => void;
  onSaveAllDocs: () => void;
  onCloseAllDocs: () => void;
  onOpenDefaultDir: () => void;
  // 窗口与导航
  onOpenFileManager: () => void;
  onShowDocList: () => void;
  onPrevDoc: () => void;
  onNextDoc: () => void;
  onToggleSearch: () => void;
  // 窗口停靠、隐藏与置顶
  onSetDockMode: (mode: WindowDockMode) => void;
  onToggleHideWindow: () => void;
  onToggleAlwaysOnTop: () => void;
  // 视图栏位显示控制与选项
  onToggleToolbar: () => void;
  onToggleBottomBar: () => void;
  onToggleStatusBar: () => void;
  onOpenOptions: () => void;
  // 关于与退出
  onOpenAbout: () => void;
  onQuitApp: () => void;
}

export const MainMenuDropdown: React.FC<MainMenuDropdownProps> = ({
  config,
  searchOpen,
  onClose,
  onNewDoc,
  onOpenDoc,
  onCloseDoc,
  onSaveDoc,
  onSaveAsDoc,
  onSaveAllDocs,
  onCloseAllDocs,
  onOpenDefaultDir,
  onOpenFileManager,
  onShowDocList,
  onPrevDoc,
  onNextDoc,
  onToggleSearch,
  onSetDockMode,
  onToggleHideWindow,
  onToggleAlwaysOnTop,
  onToggleToolbar,
  onToggleBottomBar,
  onToggleStatusBar,
  onOpenOptions,
  onOpenAbout,
  onQuitApp,
}) => {
  const runAndClose = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <>
      <div className="bn-main-menu-backdrop" onClick={onClose} />
      <div
        className="bn-main-menu-dropdown"
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. 文档操作组 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onNewDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">新建文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + N</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onOpenDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">打开文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + O</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onCloseDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">关闭文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + W</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onSaveDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">保存文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + S</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onSaveAsDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">另存文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + Shift + S</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onSaveAllDocs)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">保存所有文档</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onCloseAllDocs)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">关闭所有文档</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onOpenDefaultDir)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">打开默认目录</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 2. 文件管理与云同步 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onOpenFileManager)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">文件管理窗口</span>
          <span className="bn-classic-menu-shortcut">F5</span>
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 3. 文档列表与标签切换 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onShowDocList)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">显示文档列表</span>
          <span className="bn-classic-menu-shortcut">F4</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onPrevDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">上个文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + Tab</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onNextDoc)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">下个文档</span>
          <span className="bn-classic-menu-shortcut">Ctrl + Shift + Tab</span>
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 4. 搜索 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleSearch)}
        >
          <span className="bn-classic-menu-check">
            {searchOpen ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">搜索</span>
          <span className="bn-classic-menu-shortcut">F3</span>
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 5. 窗口模式单选组（正常窗口 / 靠边窗口 / 自动隐藏窗口） */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(() => onSetDockMode('normal'))}
        >
          <span className="bn-classic-menu-check">
            {config.dockMode === 'normal' ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">正常窗口</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(() => onSetDockMode('docked'))}
        >
          <span className="bn-classic-menu-check">
            {config.dockMode === 'docked' ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">靠边窗口</span>
          <span className="bn-classic-menu-shortcut">Win + O</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(() => onSetDockMode('auto-hide'))}
        >
          <span className="bn-classic-menu-check">
            {config.dockMode === 'auto-hide' ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">自动隐藏窗口</span>
          <span className="bn-classic-menu-shortcut">Shift + Win + O</span>
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 6. 窗口隐藏与置顶 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleHideWindow)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">隐藏/显示 窗口</span>
          <span className="bn-classic-menu-shortcut">Win + H</span>
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleAlwaysOnTop)}
        >
          <span className="bn-classic-menu-check">
            {config.alwaysOnTop ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">设置/取消 窗口置顶</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 7. 菜单栏、底部功能按钮与状态栏显示控制 + 选项 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleToolbar)}
        >
          <span className="bn-classic-menu-check">
            {config.showToolbar ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">显示顶部工具栏</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleBottomBar)}
        >
          <span className="bn-classic-menu-check">
            {config.showBottomBar ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">显示底部功能按钮</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onToggleStatusBar)}
        >
          <span className="bn-classic-menu-check">
            {config.showStatusBar ? <Check size={13} /> : null}
          </span>
          <span className="bn-classic-menu-label">显示底部状态栏</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onOpenOptions)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">选项</span>
          <span className="bn-classic-menu-shortcut">Ctrl + Alt + P</span>
        </button>

        <div className="bn-classic-menu-sep" />

        {/* 8. 关于与退出 */}
        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onOpenAbout)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">关于BooguNote</span>
          <span className="bn-classic-menu-shortcut" />
        </button>

        <button
          type="button"
          className="bn-classic-menu-item"
          onClick={() => runAndClose(onQuitApp)}
        >
          <span className="bn-classic-menu-check" />
          <span className="bn-classic-menu-label">退出</span>
          <span className="bn-classic-menu-shortcut" />
        </button>
      </div>
    </>
  );
};
