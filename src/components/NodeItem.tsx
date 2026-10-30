import React, { useRef, useEffect, useLayoutEffect } from 'react';
import {
  OutlineNode,
  AppConfig,
  BLOCK_WIDTH_LABELS,
} from '../types/outline';
import { NodeIconView } from './NodeIconView';

interface NodeItemProps {
  node: OutlineNode;
  level: number;
  config: AppConfig;
  focusedId: string | null;
  selectedSet: Set<string>;
  searchQuery: string;
  onFocusNode: (id: string) => void;
  onSelectClick: (id: string, e: React.MouseEvent) => void;
  onToggleCollapse: (id: string) => void;
  onCycleBlockWidth: (id: string) => void;
  onCycleIcon: (id: string, dir: 1 | -1) => void;
  onChangeContent: (id: string, newContent: string) => void;
  onInsertSiblingAfter: (id: string) => void;
  onInsertSiblingBefore: (id: string) => void;
  onInsertChild: (id: string) => void;
  onSplitAtCursor: (id: string, cursorOffset: number) => void;
  onDeleteNode: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onToggleBold: (id: string) => void;
  onToggleBranch: (id: string, forceValue?: boolean) => void;
  onNavigateVertical: (id: string, direction: -1 | 1) => void;
  onOpenContextMenu: (e: React.MouseEvent, node: OutlineNode) => void;
}

export const NodeItem: React.FC<NodeItemProps> = ({
  node,
  level,
  config,
  focusedId,
  selectedSet,
  searchQuery,
  onFocusNode,
  onSelectClick,
  onToggleCollapse,
  onCycleBlockWidth,
  onCycleIcon,
  onChangeContent,
  onInsertSiblingAfter,
  onInsertSiblingBefore,
  onInsertChild,
  onSplitAtCursor,
  onDeleteNode,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onToggleBold,
  onToggleBranch,
  onNavigateVertical,
  onOpenContextMenu,
}) => {
  const isFocused = focusedId === node.id;
  const isSelected = selectedSet.has(node.id);
  const hasChildren = node.children.length > 0;
  const showBranchLines =
    hasChildren && !node.collapsed && (node.showBranch || config.showAllBranches);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 自动调整 textarea 高度以贴合多行文字
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(22, el.scrollHeight)}px`;
  };

  useLayoutEffect(() => {
    if (isFocused) {
      adjustTextareaHeight();
    }
  }, [isFocused, node.content, node.blockWidth, config.narrowWidth, config.wideWidth]);

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      const el = textareaRef.current;
      if (document.activeElement !== el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, [isFocused]);

  // 计算文字块宽度样式（兼容 PC 与移动端自适应宽度）
  const getBlockWidthStyle = (): React.CSSProperties => {
    if (node.blockWidth === 'wide') {
      return { width: `${config.wideWidth}px`, maxWidth: 'calc(100vw - 68px)' };
    }
    if (node.blockWidth === 'shrink' && !isFocused) {
      return { width: `${config.narrowWidth}px`, maxWidth: 'calc(100vw - 68px)' };
    }
    return { width: `${config.narrowWidth}px`, maxWidth: 'calc(100vw - 68px)' };
  };

  // 处理文本块内的全键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      onInsertSiblingAfter(node.id);
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      onInsertSiblingBefore(node.id);
      return;
    }

    if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'Enter') {
      e.preventDefault();
      onInsertChild(node.id);
      return;
    }

    if (e.ctrlKey && (e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      onSplitAtCursor(node.id, el.selectionStart ?? node.content.length);
      return;
    }

    if (e.ctrlKey && e.key === 'Delete') {
      e.preventDefault();
      onDeleteNode(node.id);
      return;
    }

    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      onCycleBlockWidth(node.id);
      return;
    }

    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      onToggleBold(node.id);
      return;
    }

    if (e.altKey && !e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      if (e.shiftKey) {
        onToggleBranch(node.id, false);
      } else {
        onToggleBranch(node.id, true);
      }
      return;
    }

    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      onCycleIcon(node.id, 1);
      return;
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      onCycleIcon(node.id, -1);
      return;
    }

    if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveUp(node.id);
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveDown(node.id);
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      onOutdent(node.id);
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault();
      onIndent(node.id);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent(node.id);
      } else {
        onIndent(node.id);
      }
      return;
    }

    if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.key === 'ArrowUp') {
      const textBeforeCursor = el.value.slice(0, el.selectionStart);
      if (!textBeforeCursor.includes('\n')) {
        e.preventDefault();
        onNavigateVertical(node.id, -1);
      }
      return;
    }
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.key === 'ArrowDown') {
      const textAfterCursor = el.value.slice(el.selectionEnd);
      if (!textAfterCursor.includes('\n')) {
        e.preventDefault();
        onNavigateVertical(node.id, 1);
      }
      return;
    }
  };

  // 将非焦点态的文本渲染为支持 URL 超链接点击与搜索词高亮的内容
  const renderFormattedContent = (text: string) => {
    if (!text) {
      return <span className="bn-empty-placeholder">点击输入内容...</span>;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, idx) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="bn-inline-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const subParts = part.split(new RegExp(`(${escaped})`, 'gi'));
        return (
          <React.Fragment key={idx}>
            {subParts.map((sp, sIdx) =>
              sp.toLowerCase() === q.toLowerCase() ? (
                <mark key={sIdx} className="bn-search-highlight">
                  {sp}
                </mark>
              ) : (
                sp
              )
            )}
          </React.Fragment>
        );
      }

      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const isMatchedBySearch =
    searchQuery.trim().length > 0 &&
    node.content.toLowerCase().includes(searchQuery.trim().toLowerCase());

  return (
    <div className="bn-node-tree-group" data-node-id={node.id}>
      <div className="bn-node-row">
        {/* 节点前控制小方块：左键折叠/展开，右键切换文字块三种宽度 */}
        <button
          type="button"
          className={`bn-bullet-handle ${
            hasChildren
              ? node.collapsed
                ? 'is-collapsed'
                : 'is-expanded'
              : 'is-leaf'
          } width-${node.blockWidth}`}
          title={
            hasChildren
              ? `${node.collapsed ? '点击展开分支' : '点击折叠分支'} | 右键切换宽度 (当前: ${
                  BLOCK_WIDTH_LABELS[node.blockWidth]
                })`
              : `右键切换宽度 (当前: ${BLOCK_WIDTH_LABELS[node.blockWidth]}) | Alt+点击选择子树`
          }
          onClick={(e) => {
            e.stopPropagation();
            if (e.altKey || e.ctrlKey || e.shiftKey) {
              onSelectClick(node.id, e);
              return;
            }
            if (hasChildren) {
              onToggleCollapse(node.id);
            } else {
              onFocusNode(node.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCycleBlockWidth(node.id);
          }}
        >
          {hasChildren ? (node.collapsed ? '+' : '−') : ''}
        </button>

        {/* 文字块主体：支持闭合卡片框、焦点实线框、选中虚线框 */}
        <div
          className={[
            'bn-text-block',
            config.closedBlockCard ? 'bn-card-closed' : '',
            isFocused
              ? 'bn-block-focused'
              : isSelected
              ? 'bn-block-selected'
              : 'bn-block-unselected',
            `bn-width-${node.blockWidth}`,
            node.isBold ? 'bn-text-bold' : '',
            level === 0 ? 'bn-level-root' : '',
            isMatchedBySearch ? 'bn-search-matched-block' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            ...getBlockWidthStyle(),
            color: node.textColor || undefined,
            backgroundColor: node.bgColor || undefined,
            fontSize: `${config.fontSize}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.shiftKey || e.altKey) {
              onSelectClick(node.id, e);
            } else {
              onFocusNode(node.id);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.ctrlKey) {
              onCycleBlockWidth(node.id);
            } else {
              onOpenContextMenu(e, node);
            }
          }}
        >
          {/* 节点图标 */}
          <NodeIconView
            icon={node.icon}
            size={config.fontSize + 1}
            onClick={(e) => {
              e.stopPropagation();
              onCycleIcon(node.id, 1);
            }}
          />

          {/* 文本内容区 */}
          <div className="bn-block-content-wrap">
            {isFocused ? (
              <textarea
                ref={textareaRef}
                className="bn-block-textarea"
                value={node.content}
                placeholder="输入笔记内容... (Ctrl+Enter 同级新建, Shift+Enter 子块)"
                rows={1}
                style={{
                  fontWeight: node.isBold ? 700 : 400,
                  color: node.textColor || 'inherit',
                  fontSize: `${config.fontSize}px`,
                }}
                onChange={(e) => {
                  onChangeContent(node.id, e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
              />
            ) : (
              <div
                className={`bn-block-static-text ${
                  node.blockWidth === 'shrink' ? 'is-shrunk' : ''
                }`}
              >
                {renderFormattedContent(node.content)}
              </div>
            )}
          </div>

          {/* 折叠数量角标提示 */}
          {hasChildren && node.collapsed && (
            <span
              className="bn-collapsed-badge"
              title="点击展开隐藏的子文字块"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(node.id);
              }}
            >
              {node.children.length}
            </span>
          )}
        </div>
      </div>

      {/* 子节点递归列表与精确 L 型闭合树枝线 */}
      {hasChildren && !node.collapsed && (
        <div
          className={`bn-children-container ${
            showBranchLines ? 'with-branch-lines' : ''
          }`}
          style={{ paddingLeft: `${config.indentSize}px` }}
        >
          {node.children.map((child, idx) => {
            const isLastChild = idx === node.children.length - 1;
            return (
              <div
                key={child.id}
                className={[
                  'bn-child-branch-item',
                  showBranchLines ? 'has-branch-elbow' : '',
                  isLastChild ? 'is-last-child' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <NodeItem
                  node={child}
                  level={level + 1}
                  config={config}
                  focusedId={focusedId}
                  selectedSet={selectedSet}
                  searchQuery={searchQuery}
                  onFocusNode={onFocusNode}
                  onSelectClick={onSelectClick}
                  onToggleCollapse={onToggleCollapse}
                  onCycleBlockWidth={onCycleBlockWidth}
                  onCycleIcon={onCycleIcon}
                  onChangeContent={onChangeContent}
                  onInsertSiblingAfter={onInsertSiblingAfter}
                  onInsertSiblingBefore={onInsertSiblingBefore}
                  onInsertChild={onInsertChild}
                  onSplitAtCursor={onSplitAtCursor}
                  onDeleteNode={onDeleteNode}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onIndent={onIndent}
                  onOutdent={onOutdent}
                  onToggleBold={onToggleBold}
                  onToggleBranch={onToggleBranch}
                  onNavigateVertical={onNavigateVertical}
                  onOpenContextMenu={onOpenContextMenu}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
