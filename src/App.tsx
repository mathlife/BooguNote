import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  FolderOpen,
  Download,
  FileCode,
  Undo2,
  Redo2,
  Search,
  GitBranch,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns,
  Bold,
  Keyboard,
  Sun,
  Moon,
  Sparkles,
  X,
  FileText,
  RotateCcw,
  Cloud,
  Square,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  OutlineNode,
  DocTab,
  AppConfig,
  NodeIconType,
  BlockWidthMode,
  CloudSyncConfig,
  WindowDockMode,
  WindowDockEdge,
} from './types/outline';
import { parseBooXml, exportToBooXml, generateNodeId } from './utils/booParser';
import { parseMarkdownToNodes, exportToMarkdown } from './utils/mdParser';
import {
  setNativeWindowDock,
  subscribeNativeDockState,
} from './utils/desktopBridge';
import {
  cloneTree,
  createEmptyNode,
  flattenVisibleNodes,
  flattenAllNodes,
  collectSubtreeIds,
  findNodeById,
  updateNodesByIds,
  getNextBlockWidth,
  getNextNodeIcon,
  insertSiblingAfter,
  insertSiblingBefore,
  insertChildNode,
  splitNodeAtCursor,
  deleteNodesByIds,
  moveNodeUp,
  moveNodeDown,
  indentNode,
  outdentNode,
  setAllCollapsed,
  expandAncestorsOf,
} from './utils/treeOps';
import { MODERN_GUIDE_MD, LEGACY_TUTORIAL_BOO_XML } from './utils/sampleDoc';
import { NodeItem } from './components/NodeItem';
import { ContextMenu } from './components/ContextMenu';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { SourcePreviewModal } from './components/SourcePreviewModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { MobileActionDock } from './components/MobileActionDock';
import { MainMenuDropdown } from './components/MainMenuDropdown';

const STORAGE_KEY_TABS = 'boogunote_next_tabs_v2';
const STORAGE_KEY_CONFIG = 'boogunote_next_config_v5';
const STORAGE_KEY_SYNC = 'boogunote_next_sync_v1';

// 构建默认初始标签页（首次打开或清空时呈现干净的未命名空白笔记）
function createInitialTabs(): DocTab[] {
  const empty = createEmptyNode({ content: '' });
  return [
    {
      id: 'tab_' + generateNodeId(),
      title: '未命名笔记.md',
      nodes: [empty],
      focusedId: empty.id,
      selectedIds: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    },
  ];
}

// 默认采用经典窄边框外观，默认隐藏顶部菜单工具栏、底部功能按钮与状态栏
const DEFAULT_CONFIG: AppConfig = {
  theme: 'classic',
  showAllBranches: true,
  closedBlockCard: true,
  narrowWidth: 310,
  wideWidth: 620,
  indentSize: 24,
  fontSize: 13.5,
  dockMode: 'normal',
  dockEdge: 'right',
  alwaysOnTop: false,
  showToolbar: false,
  showBottomBar: false,
  showStatusBar: false,
};

const DEFAULT_SYNC_CONFIG: CloudSyncConfig = {
  provider: 'github-repo',
  autoSyncOnSave: false,
  githubToken: '',
  githubRepo: '',
  githubBranch: 'main',
  githubPath: 'notes',
  gistId: '',
  dropboxToken: '',
  dropboxPath: '/BooguNote',
};

export const App: React.FC = () => {
  // 加载应用配置（每次启动默认正常窗口且不强制置顶，避免遮挡其他程序）
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          dockMode: 'normal',
          alwaysOnTop: false,
        };
      }
    } catch {
      // 忽略读取异常
    }
    return DEFAULT_CONFIG;
  });

  // 右上角主菜单下拉状态与辅助弹窗状态
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [docListModalOpen, setDocListModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // 加载云同步配置
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SYNC);
      if (saved) return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(saved) };
    } catch {
      // 忽略读取异常
    }
    return DEFAULT_SYNC_CONFIG;
  });

  // 加载文档标签页列表
  const [tabs, setTabs] = useState<DocTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TABS);
      if (saved) {
        const parsed = JSON.parse(saved) as DocTab[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 若仅存有旧版本遗留的内置教程标签且未编辑过，自动迁移为干净的未命名空白笔记
          const isOnlyDefaultTutorials =
            parsed.length <= 2 &&
            parsed.every(
              (t) =>
                (t.id === 'tab_guide' || t.id === 'tab_legacy') && !t.isDirty
            );
          if (!isOnlyDefaultTutorials) {
            return parsed;
          }
        }
      }
    } catch {
      // 忽略读取异常
    }
    return createInitialTabs();
  });

  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id || 'tab_init'
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [saveToastMsg, setSaveToastMsg] = useState<string | null>(null);

  // 自动隐藏保存通知轻提示
  useEffect(() => {
    if (!saveToastMsg) return;
    const t = setTimeout(() => setSaveToastMsg(null), 2500);
    return () => clearTimeout(t);
  }, [saveToastMsg]);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: OutlineNode;
  } | null>(null);

  const lastClickedIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // 订阅原生桌面窗口因拖拽到屏幕边缘或快捷键引发的停靠与置顶状态变更
  useEffect(() => {
    const unsubscribe = subscribeNativeDockState((nativeState) => {
      setConfig((prev) => {
        const nextTop =
          nativeState.alwaysOnTop !== undefined
            ? nativeState.alwaysOnTop
            : prev.alwaysOnTop;
        if (
          prev.dockMode === nativeState.mode &&
          prev.dockEdge === nativeState.edge &&
          prev.alwaysOnTop === nextTop
        ) {
          return prev;
        }
        return {
          ...prev,
          dockMode: nativeState.mode,
          dockEdge: nativeState.edge,
          alwaysOnTop: nextTop,
        };
      });
    });
    return unsubscribe;
  }, []);

  // 切换窗口停靠模式（正常窗口 / 靠边窗口 / 自动隐藏窗口）
  // 非自动隐藏模式下默认不置顶，避免遮挡其他桌面程序
  const handleChangeDockState = useCallback(
    async (nextMode: WindowDockMode, nextEdge?: WindowDockEdge) => {
      const edge = nextEdge || config.dockEdge || 'right';
      const nextTop = nextMode === 'normal' ? false : config.alwaysOnTop;
      setConfig((prev) => ({
        ...prev,
        dockMode: nextMode,
        dockEdge: edge,
        alwaysOnTop: nextTop,
      }));
      await setNativeWindowDock({
        mode: nextMode,
        edge,
        alwaysOnTop: nextTop,
      });
    },
    [config.dockEdge, config.alwaysOnTop]
  );

  // 切换窗口置顶
  const handleToggleAlwaysOnTop = useCallback(async () => {
    const nextTop = !config.alwaysOnTop;
    setConfig((prev) => ({ ...prev, alwaysOnTop: nextTop }));
    await setNativeWindowDock({
      mode: config.dockMode,
      edge: config.dockEdge,
      alwaysOnTop: nextTop,
    });
  }, [config.alwaysOnTop, config.dockMode, config.dockEdge]);

  // 持久化配置、同步设置与标签页
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch {
      // 忽略存储配额错误
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SYNC, JSON.stringify(syncConfig));
    } catch {
      // 忽略存储配额错误
    }
  }, [syncConfig]);

  useEffect(() => {
    try {
      const compactTabs = tabs.map((t) => ({
        ...t,
        fileHandle: undefined,
        undoStack: t.undoStack.slice(-15),
        redoStack: [],
      }));
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(compactTabs));
    } catch {
      // 忽略存储配额错误
    }
  }, [tabs]);

  // 当前激活的文档标签页
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const selectedSet = useMemo(
    () => new Set(activeTab?.selectedIds || []),
    [activeTab?.selectedIds]
  );

  // 更新当前标签页状态的通用辅助函数
  const updateActiveTab = useCallback(
    (updater: (tab: DocTab) => DocTab, recordUndo: boolean = false) => {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id !== activeTab.id) return tab;
          const undoStack = recordUndo
            ? [...tab.undoStack.slice(-49), cloneTree(tab.nodes)]
            : tab.undoStack;
          const nextTab = updater({
            ...tab,
            undoStack,
            redoStack: recordUndo ? [] : tab.redoStack,
            isDirty: recordUndo ? true : tab.isDirty,
          });
          return nextTab;
        })
      );
    },
    [activeTab?.id]
  );

  // 撤销 (Undo)
  const handleUndo = useCallback(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id !== activeTab.id || tab.undoStack.length === 0) return tab;
        const previousTree = tab.undoStack[tab.undoStack.length - 1];
        const nextUndo = tab.undoStack.slice(0, -1);
        const nextRedo = [...tab.redoStack, cloneTree(tab.nodes)];
        return {
          ...tab,
          nodes: previousTree,
          undoStack: nextUndo,
          redoStack: nextRedo,
        };
      })
    );
  }, [activeTab?.id]);

  // 重做 (Redo)
  const handleRedo = useCallback(() => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id !== activeTab.id || tab.redoStack.length === 0) return tab;
        const nextTree = tab.redoStack[tab.redoStack.length - 1];
        const nextRedo = tab.redoStack.slice(0, -1);
        const nextUndo = [...tab.undoStack, cloneTree(tab.nodes)];
        return {
          ...tab,
          nodes: nextTree,
          undoStack: nextUndo,
          redoStack: nextRedo,
        };
      })
    );
  }, [activeTab?.id]);

  // 获取当前操作的目标节点 ID 集合
  const getTargetIds = useCallback(
    (explicitId?: string): Set<string> => {
      if (explicitId && selectedSet.has(explicitId)) {
        return new Set(selectedSet);
      }
      if (explicitId) {
        return new Set([explicitId]);
      }
      if (selectedSet.size > 0) {
        return new Set(selectedSet);
      }
      if (activeTab?.focusedId) {
        return new Set([activeTab.focusedId]);
      }
      return new Set();
    },
    [selectedSet, activeTab?.focusedId]
  );

  // 聚焦单个文字块
  const handleFocusNode = useCallback(
    (id: string) => {
      lastClickedIdRef.current = id;
      updateActiveTab((tab) => ({
        ...tab,
        focusedId: id,
        selectedIds: [],
      }));
    },
    [updateActiveTab]
  );

  // 处理 Ctrl+Click / Shift+Click / Alt+Click 多选逻辑
  const handleSelectClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      updateActiveTab((tab) => {
        const currentSelected = new Set(tab.selectedIds);
        const anchorId = lastClickedIdRef.current || tab.focusedId || id;

        if (e.altKey) {
          const targetNode = findNodeById(tab.nodes, id);
          if (targetNode) {
            const subIds = collectSubtreeIds(targetNode);
            subIds.forEach((sid) => currentSelected.add(sid));
          }
        } else if (e.shiftKey) {
          const visible = flattenVisibleNodes(tab.nodes);
          const idx1 = visible.findIndex((item) => item.node.id === anchorId);
          const idx2 = visible.findIndex((item) => item.node.id === id);
          if (idx1 !== -1 && idx2 !== -1) {
            const start = Math.min(idx1, idx2);
            const end = Math.max(idx1, idx2);
            for (let i = start; i <= end; i++) {
              currentSelected.add(visible[i].node.id);
            }
          } else {
            currentSelected.add(id);
          }
        } else if (e.ctrlKey || e.metaKey) {
          if (currentSelected.has(id)) {
            currentSelected.delete(id);
          } else {
            currentSelected.add(id);
          }
        }

        lastClickedIdRef.current = id;
        return {
          ...tab,
          focusedId: null,
          selectedIds: Array.from(currentSelected),
        };
      });
    },
    [updateActiveTab]
  );

  // 折叠/展开节点
  const handleToggleCollapse = useCallback(
    (id: string) => {
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: updateNodesByIds(tab.nodes, new Set([id]), (n) => ({
            ...n,
            collapsed: !n.collapsed,
          })),
        }),
        true
      );
    },
    [updateActiveTab]
  );

  // 切换文字块三种宽度 (narrow -> wide -> shrink)
  const handleCycleBlockWidth = useCallback(
    (id?: string) => {
      const targetIds = getTargetIds(id);
      if (targetIds.size === 0) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
            ...n,
            blockWidth: getNextBlockWidth(n.blockWidth),
          })),
        }),
        true
      );
    },
    [getTargetIds, updateActiveTab]
  );

  // 循环切换节点图标
  const handleCycleIcon = useCallback(
    (id: string | undefined, dir: 1 | -1) => {
      const targetIds = getTargetIds(id);
      if (targetIds.size === 0) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
            ...n,
            icon: getNextNodeIcon(n.icon, dir),
          })),
        }),
        true
      );
    },
    [getTargetIds, updateActiveTab]
  );

  // 修改节点文本内容
  const lastEditedIdRef = useRef<string | null>(null);
  const handleChangeContent = useCallback(
    (id: string, newContent: string) => {
      const shouldRecordUndo = lastEditedIdRef.current !== id;
      lastEditedIdRef.current = id;
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      updateActiveTab(
        (tab) => ({
          ...tab,
          isDirty: true,
          nodes: updateNodesByIds(tab.nodes, new Set([id]), (n) => ({
            ...n,
            content: newContent,
            modifyTime: nowStr,
          })),
        }),
        shouldRecordUndo
      );
    },
    [updateActiveTab]
  );

  // 新建同级下一个文字块 (Ctrl+Enter)
  const handleInsertSiblingAfter = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      lastEditedIdRef.current = null;
      updateActiveTab((tab) => {
        const { tree, newNodeId } = insertSiblingAfter(tab.nodes, targetId);
        return {
          ...tab,
          nodes: tree,
          focusedId: newNodeId,
          selectedIds: [],
        };
      }, true);
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  // 新建同级上一个文字块 (Alt+Enter)
  const handleInsertSiblingBefore = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      lastEditedIdRef.current = null;
      updateActiveTab((tab) => {
        const { tree, newNodeId } = insertSiblingBefore(tab.nodes, targetId);
        return {
          ...tab,
          nodes: tree,
          focusedId: newNodeId,
          selectedIds: [],
        };
      }, true);
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  // 新建子文字块 (Shift+Enter)
  const handleInsertChild = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      lastEditedIdRef.current = null;
      updateActiveTab((tab) => {
        const { tree, newNodeId } = insertChildNode(tab.nodes, targetId);
        return {
          ...tab,
          nodes: tree,
          focusedId: newNodeId,
          selectedIds: [],
        };
      }, true);
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  // 从光标处切割文字块 (Ctrl+\)
  const handleSplitAtCursor = useCallback(
    (id: string, cursorOffset: number) => {
      lastEditedIdRef.current = null;
      updateActiveTab((tab) => {
        const { tree, newNodeId } = splitNodeAtCursor(
          tab.nodes,
          id,
          cursorOffset
        );
        return {
          ...tab,
          nodes: tree,
          focusedId: newNodeId,
          selectedIds: [],
        };
      }, true);
    },
    [updateActiveTab]
  );

  // 删除文字块 (Ctrl+Delete)
  const handleDeleteNode = useCallback(
    (id?: string) => {
      const targetIds = getTargetIds(id);
      if (targetIds.size === 0) return;
      lastEditedIdRef.current = null;
      updateActiveTab((tab) => {
        const { tree, nextFocusId } = deleteNodesByIds(tab.nodes, targetIds);
        return {
          ...tab,
          nodes: tree,
          focusedId: nextFocusId,
          selectedIds: [],
        };
      }, true);
    },
    [getTargetIds, updateActiveTab]
  );

  // 移动与升降级
  const handleMoveUp = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: moveNodeUp(tab.nodes, targetId),
        }),
        true
      );
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  const handleMoveDown = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: moveNodeDown(tab.nodes, targetId),
        }),
        true
      );
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  const handleIndent = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: indentNode(tab.nodes, targetId),
        }),
        true
      );
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  const handleOutdent = useCallback(
    (id?: string) => {
      const targetId = id || activeTab.focusedId || activeTab.selectedIds[0];
      if (!targetId) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: outdentNode(tab.nodes, targetId),
        }),
        true
      );
    },
    [activeTab?.focusedId, activeTab?.selectedIds, updateActiveTab]
  );

  // 切换粗体 (Ctrl+B)
  const handleToggleBold = useCallback(
    (id?: string) => {
      const targetIds = getTargetIds(id);
      if (targetIds.size === 0) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
            ...n,
            isBold: !n.isBold,
          })),
        }),
        true
      );
    },
    [getTargetIds, updateActiveTab]
  );

  // 切换树枝连接线 (Alt+B / Shift+Alt+B)
  const handleToggleBranch = useCallback(
    (id?: string, forceValue?: boolean) => {
      const targetIds = getTargetIds(id);
      if (targetIds.size === 0) return;
      updateActiveTab(
        (tab) => ({
          ...tab,
          nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
            ...n,
            showBranch:
              forceValue !== undefined ? forceValue : !n.showBranch,
          })),
        }),
        true
      );
    },
    [getTargetIds, updateActiveTab]
  );

  // 在可见节点间上下切换焦点
  const handleNavigateVertical = useCallback(
    (currentId: string, direction: -1 | 1) => {
      const visible = flattenVisibleNodes(activeTab.nodes);
      const idx = visible.findIndex((item) => item.node.id === currentId);
      if (idx === -1) return;
      const nextIdx = idx + direction;
      if (nextIdx >= 0 && nextIdx < visible.length) {
        handleFocusNode(visible[nextIdx].node.id);
      }
    },
    [activeTab?.nodes, handleFocusNode]
  );

  // 新建空白 Markdown 文档标签页
  const handleNewTab = useCallback(() => {
    const firstNode = createEmptyNode({ content: '' });
    const newTab: DocTab = {
      id: 'tab_' + generateNodeId(),
      title: `未命名笔记_${tabs.length + 1}.md`,
      nodes: [firstNode],
      focusedId: firstNode.id,
      selectedIds: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  // 关闭指定或当前标签页
  const handleCloseTabById = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const tabToClose = tabs.find((t) => t.id === tabId);
      if (tabToClose?.isDirty) {
        const ok = window.confirm(
          `文档 "${tabToClose.title}" 存在未保存的修改，确定要关闭吗？\n点击【确定】放弃修改，点击【取消】返回继续编辑。`
        );
        if (!ok) return;
      }
      if (tabs.length <= 1) {
        const empty = createEmptyNode();
        const fallbackTab: DocTab = {
          id: 'tab_' + generateNodeId(),
          title: '未命名笔记.md',
          nodes: [empty],
          focusedId: empty.id,
          selectedIds: [],
          isDirty: false,
          undoStack: [],
          redoStack: [],
        };
        setTabs([fallbackTab]);
        setActiveTabId(fallbackTab.id);
        return;
      }
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(nextTabs);
      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[nextTabs.length - 1].id);
      }
    },
    [tabs, activeTabId]
  );

  // 关闭所有文档
  const handleCloseAllTabs = useCallback(() => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      const ok = window.confirm(
        `有 ${dirtyTabs.length} 个文档存在未保存的修改，确定要全部关闭吗？\n点击【确定】关闭所有文档，点击【取消】返回。`
      );
      if (!ok) return;
    }
    const empty = createEmptyNode();
    const freshTab: DocTab = {
      id: 'tab_' + generateNodeId(),
      title: '未命名笔记.md',
      nodes: [empty],
      focusedId: empty.id,
      selectedIds: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    };
    setTabs([freshTab]);
    setActiveTabId(freshTab.id);
  }, [tabs]);

  // 切换上个/下个文档标签页
  const handleCycleTab = useCallback(
    (dir: -1 | 1) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === activeTab.id);
      const nextIdx = (idx + dir + tabs.length) % tabs.length;
      setActiveTabId(tabs[nextIdx].id);
    },
    [tabs, activeTab?.id]
  );

  // 导出下载单个标签页文件（降级方案）
  const downloadTabAsFile = useCallback(
    (tab: DocTab, format: 'md' | 'boo', customBaseName?: string) => {
      const baseName =
        customBaseName || tab.title.replace(/\.(md|markdown|boo|txt)$/i, '');
      const content =
        format === 'md'
          ? exportToMarkdown(tab.nodes, true)
          : exportToBooXml(tab.nodes);
      const ext = format === 'md' ? '.md' : '.boo';
      const mime =
        format === 'md'
          ? 'text/markdown;charset=utf-8'
          : 'application/xml;charset=utf-8';

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  const handleDownloadFile = useCallback(
    (format: 'md' | 'boo') => {
      downloadTabAsFile(activeTab, format);
      updateActiveTab((tab) => ({ ...tab, isDirty: false }));
    },
    [activeTab, downloadTabAsFile, updateActiveTab]
  );

  // 打开本地文档（优先 Electron 桌面原生对话框，次选 Chromium File System Access API，降级 HTML File Input）
  const handleOpenDocNative = useCallback(async () => {
    // 1. Electron 原生文件选择对话框
    if (window.booguDesktop?.showOpenDialog && window.booguDesktop?.readFile) {
      try {
        const res = await window.booguDesktop.showOpenDialog({
          title: '打开 BooguNote 或 Markdown 笔记',
          filters: [
            {
              name: '所有支持格式 (*.md, *.boo, *.txt)',
              extensions: ['md', 'markdown', 'boo', 'txt'],
            },
            { name: 'Markdown 笔记 (*.md)', extensions: ['md', 'markdown'] },
            { name: 'BooguNote 经典大纲 (*.boo)', extensions: ['boo'] },
            { name: '所有文件 (*.*)', extensions: ['*'] },
          ],
          properties: ['openFile', 'multiSelections'],
        });

        if (res.canceled || !res.filePaths || res.filePaths.length === 0) return;

        const newTabs: DocTab[] = [];
        for (const filePath of res.filePaths) {
          const content = await window.booguDesktop.readFile(filePath);
          const isBoo =
            filePath.toLowerCase().endsWith('.boo') ||
            content.trimStart().startsWith('<?xml') ||
            content.trimStart().startsWith('<root');
          const parsed = isBoo
            ? parseBooXml(content)
            : parseMarkdownToNodes(content);
          const fileName = filePath.split(/[\\/]/).pop() || filePath;
          newTabs.push({
            id: 'tab_' + generateNodeId(),
            title: fileName,
            filePath,
            nodes: parsed,
            focusedId: parsed[0]?.id ?? null,
            selectedIds: [],
            isDirty: false,
            undoStack: [],
            redoStack: [],
          });
        }

        if (newTabs.length > 0) {
          setTabs((prev) => [...prev, ...newTabs]);
          setActiveTabId(newTabs[newTabs.length - 1].id);
        }
        return;
      } catch (err: any) {
        console.error('Electron showOpenDialog 失败:', err);
      }
    }

    // 2. 现代 Chromium / Edge 原生 File System Access API
    if (typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'BooguNote 与 Markdown 笔记',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'application/xml': ['.boo', '.xml'],
                'text/plain': ['.txt'],
              },
            },
          ],
        });

        const newTabs: DocTab[] = [];
        for (const handle of handles) {
          const file = await handle.getFile();
          const text = await file.text();
          const isBoo =
            file.name.toLowerCase().endsWith('.boo') ||
            text.trimStart().startsWith('<?xml') ||
            text.trimStart().startsWith('<root');
          const parsed = isBoo ? parseBooXml(text) : parseMarkdownToNodes(text);
          newTabs.push({
            id: 'tab_' + generateNodeId(),
            title: file.name,
            filePath: file.name,
            fileHandle: handle,
            nodes: parsed,
            focusedId: parsed[0]?.id ?? null,
            selectedIds: [],
            isDirty: false,
            undoStack: [],
            redoStack: [],
          });
        }

        if (newTabs.length > 0) {
          setTabs((prev) => [...prev, ...newTabs]);
          setActiveTabId(newTabs[newTabs.length - 1].id);
        }
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // 用户取消选择
        console.warn('showOpenFilePicker 回退:', err);
      }
    }

    // 3. 通用隐藏 file input 降级兜底
    fileInputRef.current?.click();
  }, []);

  // 另存文档 (Ctrl+Shift+S)
  const handleSaveAsCurrentDoc = useCallback(
    async (targetTab?: DocTab) => {
      const tabToSave = targetTab || activeTab;
      const isBoo = tabToSave.title.toLowerCase().endsWith('.boo');
      const content = isBoo
        ? exportToBooXml(tabToSave.nodes)
        : exportToMarkdown(tabToSave.nodes, true);

      // 1. Electron 桌面端原生 SaveDialog
      if (
        window.booguDesktop?.showSaveDialog &&
        window.booguDesktop?.writeFile
      ) {
        try {
          const defaultName = tabToSave.filePath || tabToSave.title;
          const res = await window.booguDesktop.showSaveDialog({
            title: '另存文档',
            defaultPath: defaultName,
            filters: isBoo
              ? [
                  { name: 'BooguNote 经典大纲 (*.boo)', extensions: ['boo'] },
                  { name: 'Markdown 笔记 (*.md)', extensions: ['md'] },
                ]
              : [
                  { name: 'Markdown 笔记 (*.md)', extensions: ['md'] },
                  { name: 'BooguNote 经典大纲 (*.boo)', extensions: ['boo'] },
                ],
          });

          if (res.canceled || !res.filePath) return false;

          const chosenPath = res.filePath;
          const targetIsBoo = chosenPath.toLowerCase().endsWith('.boo');
          const finalContent = targetIsBoo
            ? exportToBooXml(tabToSave.nodes)
            : exportToMarkdown(tabToSave.nodes, true);

          await window.booguDesktop.writeFile(chosenPath, finalContent);
          const fileName = chosenPath.split(/[\\/]/).pop() || chosenPath;

          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabToSave.id
                ? {
                    ...t,
                    title: fileName,
                    filePath: chosenPath,
                    isDirty: false,
                  }
                : t
            )
          );
          setSaveToastMsg(`已保存: ${fileName}`);
          return true;
        } catch (err: any) {
          console.error('Electron showSaveDialog 失败:', err);
        }
      }

      // 2. 现代 Chromium / Edge File System Access API
      if (typeof (window as any).showSaveFilePicker === 'function') {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: tabToSave.title,
            types: isBoo
              ? [
                  {
                    description: 'BooguNote 经典大纲 (*.boo)',
                    accept: { 'application/xml': ['.boo'] },
                  },
                  {
                    description: 'Markdown 笔记 (*.md)',
                    accept: { 'text/markdown': ['.md'] },
                  },
                ]
              : [
                  {
                    description: 'Markdown 笔记 (*.md)',
                    accept: { 'text/markdown': ['.md'] },
                  },
                  {
                    description: 'BooguNote 经典大纲 (*.boo)',
                    accept: { 'application/xml': ['.boo'] },
                  },
                ],
          });

          const file = await handle.getFile();
          const targetIsBoo = file.name.toLowerCase().endsWith('.boo');
          const finalContent = targetIsBoo
            ? exportToBooXml(tabToSave.nodes)
            : exportToMarkdown(tabToSave.nodes, true);

          const writable = await handle.createWritable();
          await writable.write(finalContent);
          await writable.close();

          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabToSave.id
                ? {
                    ...t,
                    title: file.name,
                    filePath: file.name,
                    fileHandle: handle,
                    isDirty: false,
                  }
                : t
            )
          );
          setSaveToastMsg(`已保存: ${file.name}`);
          return true;
        } catch (err: any) {
          if (err?.name === 'AbortError') return false; // 用户取消
          console.warn('showSaveFilePicker 回退:', err);
        }
      }

      // 3. 浏览器降级下载兜底
      const nextName = prompt(
        '另存文档文件名（以 .boo 结尾为原版 XML，否则保存为 .md）：',
        tabToSave.title
      );
      if (!nextName || !nextName.trim()) return false;
      const trimmed = nextName.trim();
      const targetIsBoo = trimmed.toLowerCase().endsWith('.boo');
      const base = trimmed.replace(/\.(md|markdown|boo|txt)$/i, '');
      const finalName = `${base}${targetIsBoo ? '.boo' : '.md'}`;
      downloadTabAsFile(tabToSave, targetIsBoo ? 'boo' : 'md', base);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabToSave.id
            ? {
                ...t,
                title: finalName,
                isDirty: false,
              }
            : t
        )
      );
      setSaveToastMsg(`已下载保存: ${finalName}`);
      return true;
    },
    [activeTab, downloadTabAsFile]
  );

  // 保存当前文档 (Ctrl+S)：优先直接无感写入磁盘或原文件句柄，若为新建文档则调起另存为
  const handleSaveCurrentDoc = useCallback(
    async (targetTab?: DocTab) => {
      const tabToSave = targetTab || activeTab;
      const isBoo = tabToSave.title.toLowerCase().endsWith('.boo');
      const content = isBoo
        ? exportToBooXml(tabToSave.nodes)
        : exportToMarkdown(tabToSave.nodes, true);

      // A. 若已有本地文件全路径且运行在 Electron 宿主，直接无感静默写入磁盘
      if (
        tabToSave.filePath &&
        window.booguDesktop?.writeFile &&
        (tabToSave.filePath.includes('/') || tabToSave.filePath.includes('\\'))
      ) {
        try {
          await window.booguDesktop.writeFile(tabToSave.filePath, content);
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabToSave.id ? { ...t, isDirty: false } : t
            )
          );
          setSaveToastMsg(`已保存: ${tabToSave.title}`);
          return true;
        } catch (err: any) {
          console.error('直接写入文件失败，尝试另存为:', err);
        }
      }

      // B. 若已有 Chromium File System FileHandle 授权，直接无感写回源文件
      if (
        tabToSave.fileHandle &&
        typeof tabToSave.fileHandle.createWritable === 'function'
      ) {
        try {
          const writable = await tabToSave.fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          setTabs((prev) =>
            prev.map((t) =>
              t.id === tabToSave.id ? { ...t, isDirty: false } : t
            )
          );
          setSaveToastMsg(`已保存: ${tabToSave.title}`);
          return true;
        } catch (err: any) {
          console.error('FileHandle 写回失败:', err);
        }
      }

      // C. 若尚未关联任何本地实体文件，则调起原生【另存为】对话框
      return await handleSaveAsCurrentDoc(tabToSave);
    },
    [activeTab, handleSaveAsCurrentDoc]
  );

  // 保存所有文档
  const handleSaveAllDocs = useCallback(async () => {
    let savedCount = 0;
    for (const t of tabs) {
      if (t.isDirty) {
        const ok = await handleSaveCurrentDoc(t);
        if (ok) savedCount++;
      }
    }
    setSaveToastMsg(`已保存 ${savedCount} 个已修改文档`);
  }, [tabs, handleSaveCurrentDoc]);

  // 全局键盘快捷键监听（含原版主菜单全部快捷键）
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N 新建文档
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewTab();
        return;
      }
      // Ctrl+O 打开文档
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenDocNative();
        return;
      }
      // Ctrl+W 关闭当前文档
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseTabById(activeTab.id);
        return;
      }
      // Ctrl+S 保存文档 / Ctrl+Shift+S 另存文档
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAsCurrentDoc();
        } else {
          handleSaveCurrentDoc();
        }
        return;
      }
      // F5 文件管理与云同步窗口
      if (e.key === 'F5') {
        e.preventDefault();
        setSyncModalOpen((v) => !v);
        return;
      }
      // F4 显示文档列表
      if (e.key === 'F4') {
        e.preventDefault();
        setDocListModalOpen((v) => !v);
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab 切换上个/下个文档
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        handleCycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      // Ctrl+Alt+P 打开选项设置
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setHelpModalOpen((v) => !v);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') || e.key === 'F3') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      if (e.key === 'Escape') {
        if (mainMenuOpen) {
          setMainMenuOpen(false);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (docListModalOpen) {
          setDocListModalOpen(false);
          return;
        }
        if (aboutModalOpen) {
          setAboutModalOpen(false);
          return;
        }
        if (helpModalOpen) {
          setHelpModalOpen(false);
          return;
        }
        if (sourceModalOpen) {
          setSourceModalOpen(false);
          return;
        }
        if (syncModalOpen) {
          setSyncModalOpen(false);
          return;
        }
        if (searchOpen) {
          setSearchOpen(false);
          setSearchQuery('');
          return;
        }
        if (activeTab.focusedId) {
          const prevFocus = activeTab.focusedId;
          updateActiveTab((tab) => ({
            ...tab,
            focusedId: null,
            selectedIds: [prevFocus],
          }));
          return;
        }
        if (activeTab.selectedIds.length > 0) {
          updateActiveTab((tab) => ({
            ...tab,
            selectedIds: [],
          }));
        }
      }

      if (!activeTab.focusedId && activeTab.selectedIds.length > 0) {
        if (e.key === 'Delete' || (e.ctrlKey && e.key === 'Delete')) {
          e.preventDefault();
          handleDeleteNode();
        } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          handleFocusNode(activeTab.selectedIds[0]);
        } else if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          handleInsertSiblingAfter(activeTab.selectedIds[0]);
        } else if (e.shiftKey && e.key === 'Enter') {
          e.preventDefault();
          handleInsertChild(activeTab.selectedIds[0]);
        } else if (e.ctrlKey && e.key.toLowerCase() === 'u') {
          e.preventDefault();
          handleCycleBlockWidth();
        } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          handleToggleBold();
        } else if (e.ctrlKey && e.key === 'ArrowUp') {
          e.preventDefault();
          handleMoveUp();
        } else if (e.ctrlKey && e.key === 'ArrowDown') {
          e.preventDefault();
          handleMoveDown();
        } else if (e.ctrlKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          handleOutdent();
        } else if (e.ctrlKey && e.key === 'ArrowRight') {
          e.preventDefault();
          handleIndent();
        }
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [
    activeTab,
    mainMenuOpen,
    contextMenu,
    docListModalOpen,
    aboutModalOpen,
    helpModalOpen,
    sourceModalOpen,
    syncModalOpen,
    searchOpen,
    handleNewTab,
    handleOpenDocNative,
    handleCloseTabById,
    handleSaveCurrentDoc,
    handleSaveAsCurrentDoc,
    handleCycleTab,
    handleUndo,
    handleRedo,
    handleDeleteNode,
    handleFocusNode,
    handleInsertSiblingAfter,
    handleInsertChild,
    handleCycleBlockWidth,
    handleToggleBold,
    handleMoveUp,
    handleMoveDown,
    handleOutdent,
    handleIndent,
    updateActiveTab,
  ]);

  // 搜索时自动展开包含匹配节点的父级分支
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) return;
    const lower = q.trim().toLowerCase();
    const all = flattenAllNodes(activeTab.nodes);
    const matchedIds = new Set(
      all
        .filter((item) => item.node.content.toLowerCase().includes(lower))
        .map((item) => item.node.id)
    );
    if (matchedIds.size > 0) {
      updateActiveTab((tab) => ({
        ...tab,
        nodes: expandAncestorsOf(tab.nodes, matchedIds).tree,
      }));
    }
  };

  // 导入本地文件（智能识别 .boo XML 或 .md Markdown）
  const importFileObject = async (file: File) => {
    const text = await file.text();
    const isBoo =
      file.name.toLowerCase().endsWith('.boo') ||
      text.trimStart().startsWith('<?xml') ||
      text.trimStart().startsWith('<root');

    try {
      const parsedNodes = isBoo
        ? parseBooXml(text)
        : parseMarkdownToNodes(text);

      const filePath = (file as any).path || file.name;
      const newTab: DocTab = {
        id: 'tab_' + generateNodeId(),
        title: file.name,
        filePath,
        nodes: parsedNodes,
        focusedId: parsedNodes[0]?.id ?? null,
        selectedIds: [],
        isDirty: false,
        undoStack: [],
        redoStack: [],
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    } catch (err: any) {
      alert(`导入文件 "${file.name}" 失败：${err?.message || '未知错误'}`);
    }
  };

  // 重置演示文档
  const handleResetDemo = () => {
    const initial = createInitialTabs();
    setTabs(initial);
    setActiveTabId(initial[0].id);
  };

  // 统计信息
  const allNodesFlat = useMemo(
    () => flattenAllNodes(activeTab.nodes),
    [activeTab.nodes]
  );
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const q = searchQuery.trim().toLowerCase();
    return allNodesFlat.filter((item) =>
      item.node.content.toLowerCase().includes(q)
    ).length;
  }, [allNodesFlat, searchQuery]);

  const hasActiveTarget = Boolean(
    activeTab.focusedId || activeTab.selectedIds.length > 0
  );

  return (
    <div
      className={`bn-app-shell theme-${config.theme} dock-mode-${config.dockMode}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const files = Array.from(e.dataTransfer.files);
        files.forEach((f) => importFileObject(f));
      }}
    >
      {/* 隐藏文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.boo,.txt,.xml"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          files.forEach((f) => importFileObject(f));
          e.target.value = '';
        }}
      />

      {/* 顶部紧凑标签栏与右上角经典下拉主菜单按钮 */}
      <header className="bn-header">
        <div className="bn-brand-bar">
          <div className="bn-logo-badge" title="BooguNote 树形大纲笔记">
            <span className="bn-logo-square">B</span>
          </div>

          {/* 文档标签栏 */}
          <div className="bn-tabs-strip">
            {tabs.map((tab) => {
              const isBooTab = tab.title.toLowerCase().endsWith('.boo');
              return (
                <div
                  key={tab.id}
                  className={`bn-tab-item ${
                    tab.id === activeTab.id ? 'active' : ''
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                  title={`${tab.title} (双击可重命名)`}
                  onDoubleClick={() => {
                    const nextTitle = prompt('重命名文档标签：', tab.title);
                    if (nextTitle && nextTitle.trim()) {
                      setTabs((prev) =>
                        prev.map((t) =>
                          t.id === tab.id ? { ...t, title: nextTitle.trim() } : t
                        )
                      );
                    }
                  }}
                >
                  <FileText size={12} className="bn-tab-icon" />
                  <span className="bn-tab-title">
                    {tab.title}
                    {tab.isDirty ? ' *' : ''}
                  </span>
                  {isBooTab && <span className="bn-tab-format-tag">.boo</span>}
                  <button
                    type="button"
                    className="bn-tab-close"
                    title="关闭文档 (Ctrl+W)"
                    onClick={(e) => handleCloseTabById(tab.id, e)}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              className="bn-tab-add-btn"
              title="新建文档 (Ctrl+N)"
              onClick={handleNewTab}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* 右上角经典下拉主菜单按钮 */}
          <div className="bn-top-right-menu-wrap">
            <button
              type="button"
              className={`bn-main-menu-trigger ${mainMenuOpen ? 'active' : ''}`}
              title="打开 BooguNote 主菜单（文档、窗口模式、显示/隐藏工具栏、选项）"
              onClick={() => setMainMenuOpen((v) => !v)}
            >
              <ChevronDown size={15} />
            </button>

            {mainMenuOpen && (
              <MainMenuDropdown
                config={config}
                searchOpen={searchOpen}
                onClose={() => setMainMenuOpen(false)}
                onNewDoc={handleNewTab}
                onOpenDoc={handleOpenDocNative}
                onCloseDoc={() => handleCloseTabById(activeTab.id)}
                onSaveDoc={handleSaveCurrentDoc}
                onSaveAsDoc={() => handleSaveAsCurrentDoc()}
                onSaveAllDocs={handleSaveAllDocs}
                onCloseAllDocs={handleCloseAllTabs}
                onOpenDefaultDir={() =>
                  setNativeWindowDock({ action: 'open-default-dir' })
                }
                onOpenFileManager={() => setSyncModalOpen(true)}
                onShowDocList={() => setDocListModalOpen(true)}
                onPrevDoc={() => handleCycleTab(-1)}
                onNextDoc={() => handleCycleTab(1)}
                onToggleSearch={() => {
                  setSearchOpen((v) => {
                    const next = !v;
                    if (next) {
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    } else {
                      setSearchQuery('');
                    }
                    return next;
                  });
                }}
                onSetDockMode={(mode) => handleChangeDockState(mode)}
                onToggleHideWindow={() =>
                  setNativeWindowDock({ action: 'toggle-hide-window' })
                }
                onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
                onToggleToolbar={() =>
                  setConfig((prev) => ({
                    ...prev,
                    showToolbar: !prev.showToolbar,
                  }))
                }
                onToggleBottomBar={() =>
                  setConfig((prev) => ({
                    ...prev,
                    showBottomBar: !prev.showBottomBar,
                  }))
                }
                onToggleStatusBar={() =>
                  setConfig((prev) => ({
                    ...prev,
                    showStatusBar: !prev.showStatusBar,
                  }))
                }
                onOpenOptions={() => setHelpModalOpen(true)}
                onOpenAbout={() => setAboutModalOpen(true)}
                onQuitApp={() => {
                  setNativeWindowDock({ action: 'quit-app' });
                  window.close();
                }}
              />
            )}
          </div>
        </div>

        {/* 快捷操作工具栏（默认隐藏，可通过右上角下拉菜单勾选【显示顶部工具栏】开启） */}
        {config.showToolbar && (
          <div className="bn-toolbar">
            <div className="bn-toolbar-group">
              <button
                type="button"
                className="bn-toolbar-btn"
                title="打开 .md 或原版 .boo 文件 (Ctrl+O)"
                onClick={handleOpenDocNative}
              >
                <FolderOpen size={13} />
                <span>打开</span>
              </button>

              <button
                type="button"
                className="bn-toolbar-btn primary"
                title="保存文档 (Ctrl+S)"
                onClick={() => handleSaveCurrentDoc()}
              >
                <Download size={13} />
                <span>保存</span>
              </button>

              <button
                type="button"
                className="bn-toolbar-btn"
                title="另存为 (Ctrl+Shift+S)"
                onClick={() => handleSaveAsCurrentDoc()}
              >
                <Download size={13} />
                <span>另存为</span>
              </button>

              <button
                type="button"
                className="bn-toolbar-btn sync-highlight"
                title="文件管理与多端云同步 (F5)"
                onClick={() => setSyncModalOpen(true)}
              >
                <Cloud size={13} />
                <span>云同步</span>
              </button>

              <button
                type="button"
                className="bn-toolbar-btn"
                title="实时查看/转换 Markdown 与 .boo XML 源码"
                onClick={() => setSourceModalOpen(true)}
              >
                <FileCode size={13} />
                <span>源码</span>
              </button>
            </div>

            <div className="bn-toolbar-sep" />

            {/* 撤销重做与节点视觉控制 */}
            <div className="bn-toolbar-group">
              <button
                type="button"
                className="bn-toolbar-icon-btn"
                disabled={activeTab.undoStack.length === 0}
                title={`撤销 (Ctrl+Z) - 可撤销 ${activeTab.undoStack.length} 步`}
                onClick={handleUndo}
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                className="bn-toolbar-icon-btn"
                disabled={activeTab.redoStack.length === 0}
                title={`重做 (Ctrl+Y) - 可重做 ${activeTab.redoStack.length} 步`}
                onClick={handleRedo}
              >
                <Redo2 size={14} />
              </button>

              <button
                type="button"
                className={`bn-toolbar-icon-btn ${
                  config.closedBlockCard ? 'active' : ''
                }`}
                title="切换【闭合卡片边框】与【无框极简模式】"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    closedBlockCard: !prev.closedBlockCard,
                  }))
                }
              >
                <Square size={14} />
              </button>

              <button
                type="button"
                className={`bn-toolbar-icon-btn ${
                  config.showAllBranches ? 'active' : ''
                }`}
                title="全局显示所有父子闭合树枝连接线"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    showAllBranches: !prev.showAllBranches,
                  }))
                }
              >
                <GitBranch size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title="切换当前文字块宽度：窄块 -> 宽块 -> 单行收缩 (Ctrl+U)"
                onClick={() => handleCycleBlockWidth()}
              >
                <Columns size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title="切换文字块粗体 (Ctrl+B)"
                onClick={() => handleToggleBold()}
              >
                <Bold size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title="展开全部节点"
                onClick={() =>
                  updateActiveTab(
                    (tab) => ({
                      ...tab,
                      nodes: setAllCollapsed(tab.nodes, false),
                    }),
                    true
                  )
                }
              >
                <ChevronsUpDown size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title="折叠全部父节点"
                onClick={() =>
                  updateActiveTab(
                    (tab) => ({
                      ...tab,
                      nodes: setAllCollapsed(tab.nodes, true),
                    }),
                    true
                  )
                }
              >
                <ChevronsDownUp size={14} />
              </button>

              <button
                type="button"
                className={`bn-toolbar-icon-btn ${searchOpen ? 'active' : ''}`}
                title="在当前文档中查找 (Ctrl+F / F3)"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              >
                <Search size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title={`切换主题 (当前: ${
                  config.theme === 'classic'
                    ? '经典复古蓝'
                    : config.theme === 'modern-light'
                    ? '现代明亮'
                    : '极客深色'
                })`}
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    theme:
                      prev.theme === 'classic'
                        ? 'modern-light'
                        : prev.theme === 'modern-light'
                        ? 'modern-dark'
                        : 'classic',
                  }))
                }
              >
                {config.theme === 'modern-dark' ? (
                  <Moon size={14} />
                ) : config.theme === 'modern-light' ? (
                  <Sun size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
              </button>

              <button
                type="button"
                className="bn-toolbar-icon-btn"
                title="清空并新建空白大纲笔记"
                onClick={handleResetDemo}
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                className="bn-toolbar-btn"
                title="打开选项与快捷键设置 (Ctrl+Alt+P)"
                onClick={() => setHelpModalOpen(true)}
              >
                <Keyboard size={13} />
                <span>选项</span>
              </button>
            </div>
          </div>
        )}

        {/* 实时搜索栏 (Ctrl+F / F3) */}
        {searchOpen && (
          <div className="bn-search-bar">
            <Search size={14} className="bn-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="bn-search-input"
              placeholder="输入关键字实时过滤并展开匹配文字块..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery.trim() && (
              <span className="bn-search-count">
                {searchMatchCount} 项
              </span>
            )}
            <button
              type="button"
              className="bn-icon-btn"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </header>

      {/* 大纲画布主视图区 */}
      <main
        className="bn-canvas-viewport"
        onClick={() => {
          if (activeTab.focusedId || activeTab.selectedIds.length > 0) {
            updateActiveTab((tab) => ({
              ...tab,
              focusedId: null,
              selectedIds: [],
            }));
          }
        }}
      >
        <div className="bn-outline-paper">
          {activeTab.nodes.map((rootNode) => (
            <NodeItem
              key={rootNode.id}
              node={rootNode}
              level={0}
              config={config}
              focusedId={activeTab.focusedId}
              selectedSet={selectedSet}
              searchQuery={searchQuery}
              onFocusNode={handleFocusNode}
              onSelectClick={handleSelectClick}
              onToggleCollapse={handleToggleCollapse}
              onCycleBlockWidth={handleCycleBlockWidth}
              onCycleIcon={handleCycleIcon}
              onChangeContent={handleChangeContent}
              onInsertSiblingAfter={handleInsertSiblingAfter}
              onInsertSiblingBefore={handleInsertSiblingBefore}
              onInsertChild={handleInsertChild}
              onSplitAtCursor={handleSplitAtCursor}
              onDeleteNode={handleDeleteNode}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
              onToggleBold={handleToggleBold}
              onToggleBranch={handleToggleBranch}
              onNavigateVertical={handleNavigateVertical}
              onOpenContextMenu={(e, node) => {
                if (!selectedSet.has(node.id) && activeTab.focusedId !== node.id) {
                  updateActiveTab((tab) => ({
                    ...tab,
                    focusedId: null,
                    selectedIds: [node.id],
                  }));
                }
                setContextMenu({ x: e.clientX, y: e.clientY, node });
              }}
            />
          ))}
        </div>
      </main>

      {/* 底部快捷功能按钮栏（默认隐藏，可通过右上角下拉菜单勾选【显示底部功能按钮】开启） */}
      {config.showBottomBar && (
        <MobileActionDock
          visible={hasActiveTarget || config.showBottomBar}
          onInsertSibling={() => handleInsertSiblingAfter()}
          onInsertChild={() => handleInsertChild()}
          onOutdent={() => handleOutdent()}
          onIndent={() => handleIndent()}
          onMoveUp={() => handleMoveUp()}
          onMoveDown={() => handleMoveDown()}
          onCycleWidth={() => handleCycleBlockWidth()}
          onCycleIcon={() => handleCycleIcon(undefined, 1)}
          onDelete={() => handleDeleteNode()}
        />
      )}

      {/* 底部状态栏（默认隐藏，可通过右上角下拉菜单勾选【显示底部状态栏】开启） */}
      {config.showStatusBar && (
        <footer className="bn-statusbar">
          <div className="bn-status-left">
            <span>
              文字块：<strong>{allNodesFlat.length}</strong>
            </span>
            <span className="bn-status-sep">|</span>
            <span>
              {config.dockMode === 'auto-hide'
                ? `自动隐藏窗口 (${
                    config.dockEdge === 'top'
                      ? '顶部'
                      : config.dockEdge === 'left'
                      ? '左侧'
                      : '右侧'
                  })`
                : config.dockMode === 'docked'
                ? '靠边窗口'
                : '正常窗口'}
            </span>
          </div>
          <div className="bn-status-right">
            <span>拖拽至屏幕边缘自动隐藏</span>
          </div>
        </footer>
      )}

      {/* 拖拽导入提示遮罩 */}
      {isDraggingFile && (
        <div className="bn-drop-overlay">
          <div className="bn-drop-box">
            <FolderOpen size={36} />
            <p>松开鼠标即可导入 .boo 或 .md 大纲文件</p>
          </div>
        </div>
      )}

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetNode={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onSetIcon={(ic: NodeIconType) => {
            const targetIds = getTargetIds(contextMenu.node.id);
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
                  ...n,
                  icon: ic,
                })),
              }),
              true
            );
          }}
          onSetBlockWidth={(w: BlockWidthMode) => {
            const targetIds = getTargetIds(contextMenu.node.id);
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
                  ...n,
                  blockWidth: w,
                })),
              }),
              true
            );
          }}
          onToggleBold={() => handleToggleBold(contextMenu.node.id)}
          onToggleBranch={() => handleToggleBranch(contextMenu.node.id)}
          onSetTextColor={(color) => {
            const targetIds = getTargetIds(contextMenu.node.id);
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
                  ...n,
                  textColor: color,
                })),
              }),
              true
            );
          }}
          onSetBgColor={(color) => {
            const targetIds = getTargetIds(contextMenu.node.id);
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: updateNodesByIds(tab.nodes, targetIds, (n) => ({
                  ...n,
                  bgColor: color,
                })),
              }),
              true
            );
          }}
          onInsertSiblingAfter={() =>
            handleInsertSiblingAfter(contextMenu.node.id)
          }
          onInsertChild={() => handleInsertChild(contextMenu.node.id)}
          onDelete={() => handleDeleteNode(contextMenu.node.id)}
          onMoveUp={() => handleMoveUp(contextMenu.node.id)}
          onMoveDown={() => handleMoveDown(contextMenu.node.id)}
          onIndent={() => handleIndent(contextMenu.node.id)}
          onOutdent={() => handleOutdent(contextMenu.node.id)}
        />
      )}

      {/* 选项与快捷键设置弹窗 (Ctrl+Alt+P) */}
      {helpModalOpen && (
        <ShortcutHelpModal
          config={config}
          onUpdateConfig={(partial) =>
            setConfig((prev) => ({ ...prev, ...partial }))
          }
          onClose={() => setHelpModalOpen(false)}
        />
      )}

      {/* 源码预览与双向转换弹窗 */}
      {sourceModalOpen && (
        <SourcePreviewModal
          nodes={activeTab.nodes}
          onApplyNodes={(nextNodes) => {
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: nextNodes,
                focusedId: nextNodes[0]?.id ?? null,
                selectedIds: [],
              }),
              true
            );
            setSourceModalOpen(false);
          }}
          onClose={() => setSourceModalOpen(false)}
        />
      )}

      {/* 文件管理与多端云同步弹窗 (F5) */}
      {syncModalOpen && (
        <CloudSyncModal
          syncConfig={syncConfig}
          tabs={tabs}
          onUpdateSyncConfig={(partial) =>
            setSyncConfig((prev) => ({ ...prev, ...partial }))
          }
          onReplaceTabsFromCloud={(newTabs) => {
            if (newTabs.length > 0) {
              setTabs(newTabs);
              setActiveTabId(newTabs[0].id);
            }
          }}
          onClose={() => setSyncModalOpen(false)}
        />
      )}

      {/* 文档列表弹窗 (F4) */}
      {docListModalOpen && (
        <div
          className="bn-modal-backdrop"
          onClick={() => setDocListModalOpen(false)}
        >
          <div
            className="bn-modal-card"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bn-modal-header">
              <h3>显示文档列表 (F4)</h3>
              <button
                type="button"
                className="bn-icon-btn"
                onClick={() => setDocListModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="bn-modal-body" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tabs.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setActiveTabId(t.id);
                      setDocListModalOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: '1px solid var(--bn-border-color)',
                      backgroundColor:
                        t.id === activeTab.id
                          ? 'var(--bn-select-bg)'
                          : 'var(--bn-card-bg)',
                      fontWeight: t.id === activeTab.id ? 600 : 400,
                    }}
                  >
                    <span>
                      {idx + 1}. {t.title}
                      {t.isDirty ? ' *' : ''}
                    </span>
                    <button
                      type="button"
                      className="bn-tab-close"
                      title="关闭此文档"
                      onClick={(e) => handleCloseTabById(t.id, e)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 关于 BooguNote 弹窗 */}
      {aboutModalOpen && (
        <div
          className="bn-modal-backdrop"
          onClick={() => setAboutModalOpen(false)}
        >
          <div
            className="bn-modal-card"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bn-modal-header">
              <h3>关于 BooguNote</h3>
              <button
                type="button"
                className="bn-icon-btn"
                onClick={() => setAboutModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="bn-modal-body"
              style={{ padding: '16px', lineHeight: 1.65, fontSize: 13 }}
            >
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                BooguNote Next v1.1.0 (跨平台开源重构版)
              </p>
              <p style={{ marginBottom: 8 }}>
                致敬经典 Windows 树形大纲笔记软件{' '}
                <a
                  href="https://github.com/anonymous1999/BooguNote"
                  target="_blank"
                  rel="noreferrer"
                  className="bn-inline-link"
                >
                  BooguNote
                </a>
                ，默认采用经典窄边框窗口与拖拽至屏幕边缘自动隐藏交互，原生支持标准{' '}
                <code>.md</code> 与旧版 <code>.boo</code> 双向无损读写。
              </p>
              <p style={{ color: 'var(--bn-text-muted)', fontSize: 12 }}>
                开源协议：MIT License · 支持平台：Windows / macOS / Linux /
                Android / iOS
              </p>

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--bn-border-color)',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--bn-text-muted)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  独立教程参考文档（可点击直接打开查阅）：
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="bn-btn secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      const parsed = parseMarkdownToNodes(MODERN_GUIDE_MD);
                      const newTab: DocTab = {
                        id: 'tab_' + generateNodeId(),
                        title: '快速指南.md',
                        filePath: '快速指南.md',
                        nodes: parsed,
                        focusedId: parsed[0]?.id ?? null,
                        selectedIds: [],
                        isDirty: false,
                        undoStack: [],
                        redoStack: [],
                      };
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      setAboutModalOpen(false);
                    }}
                  >
                    打开 快速指南.md
                  </button>
                  <button
                    type="button"
                    className="bn-btn secondary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      const parsed = parseBooXml(LEGACY_TUTORIAL_BOO_XML);
                      const newTab: DocTab = {
                        id: 'tab_' + generateNodeId(),
                        title: '原版教程.boo',
                        filePath: '原版教程.boo',
                        nodes: parsed,
                        focusedId: parsed[0]?.id ?? null,
                        selectedIds: [],
                        isDirty: false,
                        undoStack: [],
                        redoStack: [],
                      };
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      setAboutModalOpen(false);
                    }}
                  >
                    打开 原版教程.boo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快捷保存提示气泡 */}
      {saveToastMsg && (
        <div className="bn-save-toast">
          <Check size={14} />
          <span>{saveToastMsg}</span>
        </div>
      )}
    </div>
  );
};
