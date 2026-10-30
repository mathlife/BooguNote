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
  PanelRight,
  Keyboard,
  Sun,
  Moon,
  Sparkles,
  X,
  FileText,
  RotateCcw,
  Cloud,
  Square,
} from 'lucide-react';
import {
  OutlineNode,
  DocTab,
  AppConfig,
  NodeIconType,
  BlockWidthMode,
  CloudSyncConfig,
} from './types/outline';
import { parseBooXml, exportToBooXml, generateNodeId } from './utils/booParser';
import { parseMarkdownToNodes, exportToMarkdown } from './utils/mdParser';
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

const STORAGE_KEY_TABS = 'boogunote_next_tabs_v2';
const STORAGE_KEY_CONFIG = 'boogunote_next_config_v2';
const STORAGE_KEY_SYNC = 'boogunote_next_sync_v1';

// 构建默认初始标签页（现代指南.md + 原版教程.boo）
function createInitialTabs(): DocTab[] {
  const guideNodes = parseMarkdownToNodes(MODERN_GUIDE_MD);
  const legacyNodes = parseBooXml(LEGACY_TUTORIAL_BOO_XML);

  return [
    {
      id: 'tab_guide',
      title: '快速指南.md',
      nodes: guideNodes,
      focusedId: guideNodes[0]?.id ?? null,
      selectedIds: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    },
    {
      id: 'tab_legacy',
      title: '原版教程.boo',
      nodes: legacyNodes,
      focusedId: legacyNodes[0]?.id ?? null,
      selectedIds: [],
      isDirty: false,
      undoStack: [],
      redoStack: [],
    },
  ];
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'modern-light',
  showAllBranches: true,
  closedBlockCard: true,
  narrowWidth: 360,
  wideWidth: 720,
  indentSize: 28,
  fontSize: 14,
  dockMode: 'normal',
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
  // 加载应用配置
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      // 忽略读取异常
    }
    return DEFAULT_CONFIG;
  });

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
          return parsed;
        }
      }
    } catch {
      // 忽略读取异常
    }
    return createInitialTabs();
  });

  const [activeTabId, setActiveTabId] = useState<string>(
    () => tabs[0]?.id || 'tab_guide'
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: OutlineNode;
  } | null>(null);

  const lastClickedIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  // 全局键盘快捷键监听
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
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
        if (contextMenu) {
          setContextMenu(null);
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
    contextMenu,
    helpModalOpen,
    sourceModalOpen,
    syncModalOpen,
    searchOpen,
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

  // 新建空白 Markdown 文档标签页
  const handleNewTab = () => {
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
  };

  // 关闭标签页
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      const empty = createEmptyNode();
      setTabs([
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
      ]);
      return;
    }
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
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

      const newTab: DocTab = {
        id: 'tab_' + generateNodeId(),
        title: file.name,
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

  // 导出下载文件
  const handleDownloadFile = (format: 'md' | 'boo') => {
    const baseName = activeTab.title.replace(/\.(md|markdown|boo|txt)$/i, '');
    const content =
      format === 'md'
        ? exportToMarkdown(activeTab.nodes, true)
        : exportToBooXml(activeTab.nodes);
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

    updateActiveTab((tab) => ({ ...tab, isDirty: false }));
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
      className={`bn-app-shell theme-${config.theme} dock-${config.dockMode}`}
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

      {/* 顶部标题栏与文档多标签页 */}
      <header className="bn-header">
        <div className="bn-brand-bar">
          <div className="bn-logo-badge">
            <span className="bn-logo-square">B</span>
            <span className="bn-logo-text">BooguNote</span>
            <span className="bn-version-pill">All-in-One</span>
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
                  <FileText size={13} className="bn-tab-icon" />
                  <span className="bn-tab-title">
                    {tab.title}
                    {tab.isDirty ? ' *' : ''}
                  </span>
                  {isBooTab && <span className="bn-tab-format-tag">.boo</span>}
                  <button
                    type="button"
                    className="bn-tab-close"
                    title="关闭标签页"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              className="bn-tab-add-btn"
              title="新建 Markdown 大纲笔记"
              onClick={handleNewTab}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* 快捷操作工具栏 */}
        <div className="bn-toolbar">
          <div className="bn-toolbar-group">
            <button
              type="button"
              className="bn-toolbar-btn"
              title="导入 .md 或旧版 .boo 文件"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen size={14} />
              <span>打开</span>
            </button>

            <button
              type="button"
              className="bn-toolbar-btn primary"
              title="保存为标准 Markdown 文件 (.md)"
              onClick={() => handleDownloadFile('md')}
            >
              <Download size={14} />
              <span>保存 .md</span>
            </button>

            <button
              type="button"
              className="bn-toolbar-btn"
              title="导出为兼容原版 BooguNote 的 .boo 文件"
              onClick={() => handleDownloadFile('boo')}
            >
              <Download size={14} />
              <span>导出 .boo</span>
            </button>

            <button
              type="button"
              className="bn-toolbar-btn sync-highlight"
              title="绑定 GitHub 私人仓库或 Dropbox 网盘进行多端同步"
              onClick={() => setSyncModalOpen(true)}
            >
              <Cloud size={14} />
              <span>云同步 (GitHub / Dropbox)</span>
            </button>

            <button
              type="button"
              className="bn-toolbar-btn"
              title="实时查看/转换 Markdown 与 .boo XML 源码"
              onClick={() => setSourceModalOpen(true)}
            >
              <FileCode size={14} />
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
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="bn-toolbar-icon-btn"
              disabled={activeTab.redoStack.length === 0}
              title={`重做 (Ctrl+Y) - 可重做 ${activeTab.redoStack.length} 步`}
              onClick={handleRedo}
            >
              <Redo2 size={15} />
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
              <Square size={15} />
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
              <GitBranch size={15} />
            </button>

            <button
              type="button"
              className="bn-toolbar-icon-btn"
              title="切换当前文字块宽度：窄块 -> 宽块 -> 单行收缩 (Ctrl+U)"
              onClick={() => handleCycleBlockWidth()}
            >
              <Columns size={15} />
            </button>

            <button
              type="button"
              className="bn-toolbar-icon-btn"
              title="切换文字块粗体 (Ctrl+B)"
              onClick={() => handleToggleBold()}
            >
              <Bold size={15} />
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
              <ChevronsUpDown size={15} />
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
              <ChevronsDownUp size={15} />
            </button>
          </div>

          <div className="bn-toolbar-sep" />

          {/* 搜索、主题、靠边抽屉模式与快捷键设置 */}
          <div className="bn-toolbar-group">
            <button
              type="button"
              className={`bn-toolbar-icon-btn ${searchOpen ? 'active' : ''}`}
              title="在当前文档中查找 (Ctrl+F / F3)"
              onClick={() => {
                setSearchOpen((v) => !v);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
            >
              <Search size={15} />
            </button>

            <button
              type="button"
              className={`bn-toolbar-icon-btn ${
                config.dockMode === 'right-sidebar' ? 'active' : ''
              }`}
              title="切换【经典靠边窄窗停靠模式】与【标准宽屏模式】"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  dockMode:
                    prev.dockMode === 'normal' ? 'right-sidebar' : 'normal',
                }))
              }
            >
              <PanelRight size={15} />
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
                <Moon size={15} />
              ) : config.theme === 'modern-light' ? (
                <Sun size={15} />
              ) : (
                <Sparkles size={15} />
              )}
            </button>

            <button
              type="button"
              className="bn-toolbar-icon-btn"
              title="重置内置教程与演示文档"
              onClick={handleResetDemo}
            >
              <RotateCcw size={15} />
            </button>

            <button
              type="button"
              className="bn-toolbar-btn"
              title="查看快捷键指南与块宽度设置"
              onClick={() => setHelpModalOpen(true)}
            >
              <Keyboard size={14} />
              <span>设置</span>
            </button>
          </div>
        </div>

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
                找到 {searchMatchCount} 个匹配文字块
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

      {/* 移动端 (Android / iOS) 与触屏专属悬浮快捷操作坞 */}
      <MobileActionDock
        visible={hasActiveTarget}
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

      {/* 底部状态栏 */}
      <footer className="bn-statusbar">
        <div className="bn-status-left">
          <span>
            文字块：<strong>{allNodesFlat.length}</strong>
          </span>
          <span className="bn-status-sep">|</span>
          <span>
            {activeTab.focusedId
              ? '焦点编辑态 (高亮闭合框)'
              : activeTab.selectedIds.length > 0
              ? `已选 ${activeTab.selectedIds.length} 块 (虚线闭合框)`
              : '浏览态'}
          </span>
          {syncConfig.lastSyncTime && (
            <>
              <span className="bn-status-sep">|</span>
              <span>已同步：{syncConfig.lastSyncTime}</span>
            </>
          )}
        </div>
        <div className="bn-status-right">
          <span>支持 PC / Web / Android / iOS</span>
          <span>Ctrl+Enter 同级新建</span>
          <span>Shift+Enter 子级新建</span>
          <span>Ctrl+U 切换宽度</span>
        </div>
      </footer>

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

      {/* 快捷键说明与尺寸配置弹窗 */}
      {helpModalOpen && (
        <ShortcutHelpModal
          config={config}
          onUpdateConfig={(partial) =>
            setConfig((prev) => ({ ...prev, ...partial }))
          }
          onClose={() => setHelpModalOpen(false)}
        />
      )}

      {/* Markdown / .boo 源码实时双向转换弹窗 */}
      {sourceModalOpen && (
        <SourcePreviewModal
          nodes={activeTab.nodes}
          onApplyNodes={(newNodes) => {
            updateActiveTab(
              (tab) => ({
                ...tab,
                nodes: newNodes,
                focusedId: newNodes[0]?.id ?? null,
                selectedIds: [],
              }),
              true
            );
          }}
          onClose={() => setSourceModalOpen(false)}
        />
      )}

      {/* 多端云同步中心 (GitHub 私人仓库 / Dropbox 网盘 / Gist) */}
      {syncModalOpen && (
        <CloudSyncModal
          syncConfig={syncConfig}
          tabs={tabs}
          onUpdateSyncConfig={(partial) =>
            setSyncConfig((prev) => ({ ...prev, ...partial }))
          }
          onReplaceTabsFromCloud={(cloudTabs) => {
            setTabs(cloudTabs);
            if (cloudTabs[0]) {
              setActiveTabId(cloudTabs[0].id);
            }
          }}
          onClose={() => setSyncModalOpen(false)}
        />
      )}
    </div>
  );
};
