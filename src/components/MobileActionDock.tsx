import React from 'react';
import {
  Plus,
  CornerDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Columns,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface MobileActionDockProps {
  visible: boolean;
  onInsertSibling: () => void;
  onInsertChild: () => void;
  onOutdent: () => void;
  onIndent: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCycleWidth: () => void;
  onCycleIcon: () => void;
  onDelete: () => void;
}

// 移动端 (Android / iOS) 与触屏专属悬浮操作底座
export const MobileActionDock: React.FC<MobileActionDockProps> = ({
  visible,
  onInsertSibling,
  onInsertChild,
  onOutdent,
  onIndent,
  onMoveUp,
  onMoveDown,
  onCycleWidth,
  onCycleIcon,
  onDelete,
}) => {
  if (!visible) return null;

  return (
    <div
      className="bn-mobile-dock"
      onMouseDown={(e) => {
        // 阻止点击按钮时导致当前 textarea 失去焦点
        e.preventDefault();
      }}
    >
      <button type="button" onClick={onInsertSibling} title="新建同级块">
        <Plus size={15} />
        <span>同级</span>
      </button>
      <button type="button" onClick={onInsertChild} title="新建子块">
        <CornerDownRight size={15} />
        <span>子块</span>
      </button>
      <button type="button" onClick={onOutdent} title="升级 (向左)">
        <ArrowLeft size={15} />
        <span>升级</span>
      </button>
      <button type="button" onClick={onIndent} title="降级 (向右)">
        <ArrowRight size={15} />
        <span>降级</span>
      </button>
      <button type="button" onClick={onMoveUp} title="上移">
        <ArrowUp size={15} />
        <span>上移</span>
      </button>
      <button type="button" onClick={onMoveDown} title="下移">
        <ArrowDown size={15} />
        <span>下移</span>
      </button>
      <button type="button" onClick={onCycleWidth} title="切换块宽度">
        <Columns size={15} />
        <span>宽度</span>
      </button>
      <button type="button" onClick={onCycleIcon} title="切换图标">
        <Sparkles size={15} />
        <span>图标</span>
      </button>
      <button
        type="button"
        className="danger"
        onClick={onDelete}
        title="删除当前块"
      >
        <Trash2 size={15} />
        <span>删除</span>
      </button>
    </div>
  );
};

