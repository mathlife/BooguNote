// 节点图标类型（对应原版 BooguNote 的 7 种图标 + 无图标）
export type NodeIconType =
  | 'none'
  | 'flag'
  | 'tick'
  | 'cross'
  | 'star'
  | 'question'
  | 'warning'
  | 'idea';

// 图标顺序列表，用于快捷键 Ctrl+= / Ctrl+- 循环切换
export const NODE_ICON_CYCLE: NodeIconType[] = [
  'none',
  'flag',
  'tick',
  'cross',
  'star',
  'question',
  'warning',
  'idea',
];

// 图标中文名称映射
export const NODE_ICON_LABELS: Record<NodeIconType, string> = {
  none: '无图标',
  flag: '旗帜 (Flag)',
  tick: '完成 (Tick)',
  cross: '错误 (Cross)',
  star: '星标 (Star)',
  question: '疑问 (Question)',
  warning: '警告 (Warning)',
  idea: '灵感 (Idea)',
};

// 文字块的三种宽度状态：窄块、宽块、单行收缩
export type BlockWidthMode = 'narrow' | 'wide' | 'shrink';

export const BLOCK_WIDTH_LABELS: Record<BlockWidthMode, string> = {
  narrow: '窄块 (Narrow)',
  wide: '宽块 (Wide)',
  shrink: '单行收缩 (Shrink)',
};

// 树形大纲节点数据结构
export interface OutlineNode {
  id: string;
  content: string;          // 文本内容（支持多行 \n）
  icon: NodeIconType;       // 节点图标
  collapsed: boolean;       // 子分支是否折叠（原版 branch="close"）
  blockWidth: BlockWidthMode; // 宽度模式（narrow | wide | shrink）
  isBold: boolean;          // 是否粗体
  showBranch: boolean;      // 是否显示父到子的树枝连接线
  textColor?: string;       // 文字颜色（HEX，如 #008000，默认跟随主题）
  bgColor?: string;         // 背景颜色（HEX，如 #0000ff，默认透明/跟随主题）
  modifyTime?: string;      // 修改时间
  isFile?: boolean;         // 是否为文件快捷方式或附件链接
  children: OutlineNode[];  // 子节点列表
}

// 单个文档标签页状态
export interface DocTab {
  id: string;
  title: string;            // 文件名或标题
  filePath?: string;        // 关联文件路径
  nodes: OutlineNode[];     // 当前节点树
  focusedId: string | null; // 当前处于编辑焦点态的节点 ID
  selectedIds: string[];    // 当前处于被选择态（虚线框）的节点 ID 集合
  isDirty: boolean;         // 是否有未保存修改
  undoStack: OutlineNode[][]; // 撤销栈
  redoStack: OutlineNode[][]; // 重做栈
}

// 桌面原生窗口停靠模式与边缘方向
export type WindowDockMode = 'normal' | 'docked' | 'auto-hide';
export type WindowDockEdge = 'right' | 'top' | 'left';

export interface WindowDockState {
  mode: WindowDockMode;
  edge: WindowDockEdge;
  alwaysOnTop: boolean;
  isCollapsed?: boolean;
}

// 全局视图与外观配置
export interface AppConfig {
  theme: 'classic' | 'modern-light' | 'modern-dark';
  showAllBranches: boolean; // 全局显示所有树枝连接线（默认开启以保证树结构视觉闭合）
  closedBlockCard: boolean; // 节点块是否显示闭合卡片边框（默认 true，视觉更美观规整）
  narrowWidth: number;      // 窄块像素宽度（默认 360px）
  wideWidth: number;        // 宽块像素宽度（默认 720px）
  indentSize: number;       // 每层缩进像素宽度（默认 28px）
  fontSize: number;         // 字体大小（默认 14px）
  dockMode: WindowDockMode; // 窗口停靠模式：标准 | 靠边固定窄框 | 靠边自动吸附隐藏
  dockEdge: WindowDockEdge; // 停靠边缘方向：右侧 | 顶部下拉 | 左侧
}

// 云同步提供商类型
export type SyncProviderType = 'github-repo' | 'github-gist' | 'dropbox';

// 云同步配置数据结构
export interface CloudSyncConfig {
  provider: SyncProviderType;
  autoSyncOnSave: boolean;
  lastSyncTime?: string;
  // GitHub 私人仓库配置
  githubToken: string;
  githubRepo: string;       // 格式: owner/repo
  githubBranch: string;     // 默认: main
  githubPath: string;       // 默认: notes
  // GitHub Gist 配置
  gistId: string;           // 留空可在首次推送时自动创建私密 Gist
  // Dropbox 网盘配置
  dropboxToken: string;
  dropboxPath: string;      // 默认: /BooguNote
}
