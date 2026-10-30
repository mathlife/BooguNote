import React from 'react';
import {
  NodeIconType,
  NODE_ICON_CYCLE,
  NODE_ICON_LABELS,
  BlockWidthMode,
  BLOCK_WIDTH_LABELS,
  OutlineNode,
} from '../types/outline';
import { NodeIconView } from './NodeIconView';
import {
  Plus,
  CornerDownRight,
  Trash2,
  Bold,
  GitBranch,
  Columns,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  targetNode: OutlineNode;
  onClose: () => void;
  onSetIcon: (icon: NodeIconType) => void;
  onSetBlockWidth: (width: BlockWidthMode) => void;
  onToggleBold: () => void;
  onToggleBranch: () => void;
  onSetTextColor: (color: string | undefined) => void;
  onSetBgColor: (color: string | undefined) => void;
  onInsertSiblingAfter: () => void;
  onInsertChild: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onIndent: () => void;
  onOutdent: () => void;
}

// 经典常用文字色预设
const TEXT_COLOR_PRESETS = [
  { label: '默认', value: undefined, preview: '#1e293b' },
  { label: '深绿', value: '#008000', preview: '#008000' },
  { label: '深蓝', value: '#1d4ed8', preview: '#1d4ed8' },
  { label: '绯红', value: '#dc2626', preview: '#dc2626' },
  { label: '暗橙', value: '#d97706', preview: '#d97706' },
  { label: '紫罗兰', value: '#7c3aed', preview: '#7c3aed' },
  { label: '纯白', value: '#ffffff', preview: '#ffffff' },
];

// 经典常用背景色预设（含 BooguNote 经典的深蓝标题底色）
const BG_COLOR_PRESETS = [
  { label: '默认透明', value: undefined, preview: 'transparent' },
  { label: '经典蓝底', value: '#0000ff', preview: '#0000ff' },
  { label: '柔和浅蓝', value: '#dbeafe', preview: '#dbeafe' },
  { label: '柔和浅绿', value: '#dcfce7', preview: '#dcfce7' },
  { label: '柔和暖黄', value: '#fef9c3', preview: '#fef9c3' },
  { label: '柔和浅红', value: '#fee2e2', preview: '#fee2e2' },
  { label: '柔和浅紫', value: '#f3e8ff', preview: '#f3e8ff' },
];

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  targetNode,
  onClose,
  onSetIcon,
  onSetBlockWidth,
  onToggleBold,
  onToggleBranch,
  onSetTextColor,
  onSetBgColor,
  onInsertSiblingAfter,
  onInsertChild,
  onDelete,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
}) => {
  // 防止菜单超出屏幕视口边界
  const menuLeft = Math.min(x, window.innerWidth - 270);
  const menuTop = Math.min(y, window.innerHeight - 460);

  return (
    <div
      className="bn-context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="bn-context-menu"
        style={{ left: Math.max(8, menuLeft), top: Math.max(8, menuTop) }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 图标快捷栏 */}
        <div className="bn-menu-section-title">设置图标 (Ctrl + = / -)</div>
        <div className="bn-menu-icon-grid">
          {NODE_ICON_CYCLE.map((ic) => (
            <button
              key={ic}
              type="button"
              className={`bn-menu-icon-btn ${
                targetNode.icon === ic ? 'active' : ''
              }`}
              title={NODE_ICON_LABELS[ic]}
              onClick={() => {
                onSetIcon(ic);
                onClose();
              }}
            >
              {ic === 'none' ? (
                <span className="bn-icon-none-dot">∅</span>
              ) : (
                <NodeIconView icon={ic} size={15} />
              )}
            </button>
          ))}
        </div>

        <div className="bn-menu-divider" />

        {/* 宽度模式切换 */}
        <div className="bn-menu-section-title">
          <Columns size={12} /> 文字块宽度 (Ctrl + U)
        </div>
        <div className="bn-menu-width-group">
          {(['narrow', 'wide', 'shrink'] as BlockWidthMode[]).map((w) => (
            <button
              key={w}
              type="button"
              className={`bn-menu-width-btn ${
                targetNode.blockWidth === w ? 'active' : ''
              }`}
              onClick={() => {
                onSetBlockWidth(w);
                onClose();
              }}
            >
              {w === 'narrow' ? '窄块' : w === 'wide' ? '宽块' : '单行收缩'}
            </button>
          ))}
        </div>

        <div className="bn-menu-divider" />

        {/* 粗体与树枝线开关 */}
        <button
          type="button"
          className="bn-menu-item"
          onClick={() => {
            onToggleBold();
            onClose();
          }}
        >
          <span className="bn-menu-item-left">
            <Bold size={14} /> 粗体文字
          </span>
          <span className="bn-menu-shortcut">
            {targetNode.isBold ? '✓ ' : ''}Ctrl+B
          </span>
        </button>

        <button
          type="button"
          className="bn-menu-item"
          onClick={() => {
            onToggleBranch();
            onClose();
          }}
        >
          <span className="bn-menu-item-left">
            <GitBranch size={14} /> 显示子树枝连线
          </span>
          <span className="bn-menu-shortcut">
            {targetNode.showBranch ? '✓ ' : ''}Alt+B
          </span>
        </button>

        <div className="bn-menu-divider" />

        {/* 文字色与背景色 */}
        <div className="bn-menu-section-title">文字颜色 (Alt+T) 与背景色 (Alt+G)</div>
        <div className="bn-color-row">
          <span className="bn-color-label">文字</span>
          <div className="bn-color-swatches">
            {TEXT_COLOR_PRESETS.map((c, idx) => (
              <button
                key={idx}
                type="button"
                className={`bn-color-swatch ${
                  targetNode.textColor === c.value ? 'active' : ''
                }`}
                style={{ backgroundColor: c.preview }}
                title={`文字色：${c.label}`}
                onClick={() => {
                  onSetTextColor(c.value);
                  onClose();
                }}
              />
            ))}
          </div>
        </div>
        <div className="bn-color-row">
          <span className="bn-color-label">背景</span>
          <div className="bn-color-swatches">
            {BG_COLOR_PRESETS.map((c, idx) => (
              <button
                key={idx}
                type="button"
                className={`bn-color-swatch ${
                  targetNode.bgColor === c.value ? 'active' : ''
                }`}
                style={{
                  backgroundColor: c.preview,
                  border:
                    c.preview === 'transparent'
                      ? '1px dashed #94a3b8'
                      : undefined,
                }}
                title={`背景色：${c.label}`}
                onClick={() => {
                  onSetBgColor(c.value);
                  // 如果选了经典深蓝底色且未设文字色，贴心自动设为白字
                  if (c.value === '#0000ff' && !targetNode.textColor) {
                    onSetTextColor('#ffffff');
                  }
                  onClose();
                }}
              />
            ))}
          </div>
        </div>

        {(targetNode.textColor || targetNode.bgColor) && (
          <button
            type="button"
            className="bn-menu-item"
            onClick={() => {
              onSetTextColor(undefined);
              onSetBgColor(undefined);
              onClose();
            }}
          >
            <span className="bn-menu-item-left">
              <RotateCcw size={13} /> 恢复默认配色
            </span>
          </button>
        )}

        <div className="bn-menu-divider" />

        {/* 节点操作 */}
        <button
          type="button"
          className="bn-menu-item"
          onClick={() => {
            onInsertSiblingAfter();
            onClose();
          }}
        >
          <span className="bn-menu-item-left">
            <Plus size={14} /> 新建同级文字块
          </span>
          <span className="bn-menu-shortcut">Ctrl+Enter</span>
        </button>

        <button
          type="button"
          className="bn-menu-item"
          onClick={() => {
            onInsertChild();
            onClose();
          }}
        >
          <span className="bn-menu-item-left">
            <CornerDownRight size={14} /> 新建子文字块
          </span>
          <span className="bn-menu-shortcut">Shift+Enter</span>
        </button>

        {/* 快速移动操作栏 */}
        <div className="bn-menu-move-bar">
          <button
            type="button"
            title="上移 (Ctrl+Up)"
            onClick={() => {
              onMoveUp();
              onClose();
            }}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            title="下移 (Ctrl+Down)"
            onClick={() => {
              onMoveDown();
              onClose();
            }}
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            title="升级 (Ctrl+Left)"
            onClick={() => {
              onOutdent();
              onClose();
            }}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            title="降级 (Ctrl+Right)"
            onClick={() => {
              onIndent();
              onClose();
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="bn-menu-divider" />

        <button
          type="button"
          className="bn-menu-item danger"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <span className="bn-menu-item-left">
            <Trash2 size={14} /> 删除文字块
          </span>
          <span className="bn-menu-shortcut">Ctrl+Del</span>
        </button>
      </div>
    </div>
  );
};

