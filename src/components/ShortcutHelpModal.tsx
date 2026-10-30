import React from 'react';
import { X, Keyboard, Sliders } from 'lucide-react';
import { AppConfig } from '../types/outline';

interface ShortcutHelpModalProps {
  config: AppConfig;
  onUpdateConfig: (partial: Partial<AppConfig>) => void;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: '新建与切割文字块',
    items: [
      { keys: 'Ctrl + Enter', desc: '在下方新建【同级】下一个文字块' },
      { keys: 'Alt + Enter', desc: '在上方新建【同级】上一个文字块' },
      { keys: 'Shift + Enter', desc: '在当前块下新建【子级】文字块' },
      { keys: 'Ctrl + \\', desc: '从光标位置将当前文字块一分为二（切割文字块）' },
      { keys: 'Ctrl + Delete', desc: '删除当前焦点所在或所有被选择的文字块' },
    ],
  },
  {
    title: '移动、层级与多选',
    items: [
      { keys: 'Ctrl + Up / Down', desc: '上下移动文字块（包含其子树）' },
      { keys: 'Ctrl + Left / Right', desc: '向左升级 / 向右降级文字块' },
      { keys: 'Tab / Shift + Tab', desc: '快速降级 / 升级文字块' },
      { keys: 'Ctrl + 左键单击', desc: '加选/反选单个文字块（虚线框选择态）' },
      { keys: 'Shift + 左键单击', desc: '批量范围选择连续文字块' },
      { keys: 'Alt + 左键单击', desc: '一键选择该文字块及其所有子孙文字块' },
      { keys: 'Esc', desc: '退出编辑焦点态 / 清空多选状态' },
    ],
  },
  {
    title: '外观、宽度与文档操作',
    items: [
      { keys: 'Ctrl + U / 右键小方块', desc: '循环切换三种宽度：窄块 → 宽块 → 单行收缩' },
      { keys: 'Ctrl + B', desc: '切换文字块粗体' },
      { keys: 'Ctrl + = / Ctrl + -', desc: '循环切换 7 种节点图标' },
      { keys: 'Alt + B / Shift+Alt+B', desc: '开启 / 关闭当前节点的父子“树枝线”' },
      { keys: 'Ctrl + Z / Ctrl + Y', desc: '无限级撤销 (Undo) / 重做 (Redo)' },
      { keys: 'Ctrl + F / F3', desc: '打开文档内实时搜索与高亮定位栏' },
    ],
  },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({
  config,
  onUpdateConfig,
  onClose,
}) => {
  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div className="bn-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bn-modal-header">
          <div className="bn-modal-title">
            <Keyboard size={18} /> 选项与快捷键设置 (Ctrl + Alt + P)
          </div>
          <button type="button" className="bn-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="bn-modal-body">
          {/* 视图参数调节 */}
          <div className="bn-settings-panel">
            <div className="bn-settings-title">
              <Sliders size={15} /> 外观主题、界面栏位与文字块尺寸
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 12,
                fontSize: 12.5,
              }}
            >
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span>外观主题：</span>
                <select
                  value={config.theme}
                  onChange={(e) =>
                    onUpdateConfig({
                      theme: e.target.value as AppConfig['theme'],
                    })
                  }
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--bn-border-color)',
                    backgroundColor: 'var(--bn-card-bg)',
                    color: 'var(--bn-text-main)',
                  }}
                >
                  <option value="classic">经典复古 (Classic Boogu)</option>
                  <option value="modern-light">现代明亮 (Modern Light)</option>
                  <option value="modern-dark">极客深色 (Modern Dark)</option>
                </select>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.showToolbar}
                  onChange={(e) =>
                    onUpdateConfig({ showToolbar: e.target.checked })
                  }
                />
                <span>显示顶部工具栏</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.showBottomBar}
                  onChange={(e) =>
                    onUpdateConfig({ showBottomBar: e.target.checked })
                  }
                />
                <span>显示底部功能按钮</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.showStatusBar}
                  onChange={(e) =>
                    onUpdateConfig({ showStatusBar: e.target.checked })
                  }
                />
                <span>显示底部状态栏</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.closedBlockCard}
                  onChange={(e) =>
                    onUpdateConfig({ closedBlockCard: e.target.checked })
                  }
                />
                <span>闭合卡片边框</span>
              </label>
            </div>

            <div className="bn-settings-grid">
              <label className="bn-setting-field">
                <span>窄块宽度 ({config.narrowWidth}px)</span>
                <input
                  type="range"
                  min={200}
                  max={500}
                  step={10}
                  value={config.narrowWidth}
                  onChange={(e) =>
                    onUpdateConfig({ narrowWidth: Number(e.target.value) })
                  }
                />
              </label>
              <label className="bn-setting-field">
                <span>宽块宽度 ({config.wideWidth}px)</span>
                <input
                  type="range"
                  min={450}
                  max={1000}
                  step={20}
                  value={config.wideWidth}
                  onChange={(e) =>
                    onUpdateConfig({ wideWidth: Number(e.target.value) })
                  }
                />
              </label>
              <label className="bn-setting-field">
                <span>层级缩进 ({config.indentSize}px)</span>
                <input
                  type="range"
                  min={16}
                  max={48}
                  step={2}
                  value={config.indentSize}
                  onChange={(e) =>
                    onUpdateConfig({ indentSize: Number(e.target.value) })
                  }
                />
              </label>
              <label className="bn-setting-field">
                <span>字体大小 ({config.fontSize}px)</span>
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={0.5}
                  value={config.fontSize}
                  onChange={(e) =>
                    onUpdateConfig({ fontSize: Number(e.target.value) })
                  }
                />
              </label>
            </div>
          </div>

          {/* 快捷键列表 */}
          <div className="bn-shortcuts-columns">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} className="bn-shortcut-group">
                <h4>{group.title}</h4>
                <div className="bn-shortcut-list">
                  {group.items.map((item) => (
                    <div key={item.keys} className="bn-shortcut-row">
                      <kbd className="bn-kbd">{item.keys}</kbd>
                      <span className="bn-shortcut-desc">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
