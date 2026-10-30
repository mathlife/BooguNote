# BooguNote Next (现代跨平台重构版)

> 致敬经典轻量级树形大纲笔记软件 **BooguNote** —— 采用现代 Web 与跨平台桌面技术栈全新重写。

## 核心亮点

1. **原汁原味的 BooguNote 交互体验**：
   - **三种文字块状态**：焦点态（实线框编辑）、被选择（虚线框多选）、未选择（无框极简）。
   - **三种文字块宽度**：窄块 (`narrow`)、宽块 (`wide`)、单行收缩 (`shrink`)，支持 `Ctrl + U` 一键切换。
   - **经典树枝线 (`Branch Line`)**：支持单层或全局开启父子节点折线连接（`Alt + B`）。
   - **全键盘极速流**：`Ctrl+Enter` 同级新建、`Shift+Enter` 子级新建、`Ctrl+\` 光标处切割文字块、`Ctrl+方向键` 自由移动与升降级。
2. **以开放的 Markdown 为核心**：
   - 原生支持标准 Markdown 列表读写，可在 Obsidian、VS Code 等任意编辑器中直接查看。
   - 完整支持原版 `.boo` (XML) 文件的一键导入与导出转换。
3. **超越原版的现代化增强**：
   - **无限级 Undo / Redo**：彻底解决原版只能撤销一次删除的历史痛点。
   - **跨平台运行**：支持 Windows / macOS / Linux 桌面端（Electron / Tauri）及现代浏览器。
   - **多标签页管理 & 实时全文搜索**。
   - **经典主题与现代深色主题切换**。

## 快速开始

```bash
# 安装依赖
npm install

# 启动本地开发服务器 (Web 模式)
npm run dev

# 构建生产版本
npm run build
```

