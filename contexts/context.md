# BooguNote 现代重构版 - 项目核心上下文 (Context)

## 一、项目定位与背景
**BooguNote** 原版是一款经典的轻量级树形大纲笔记软件。
本项目使用**现代全平台技术栈**对其进行彻底重写，在完整保留原版“纯键盘极速交互”、“三种文字块宽度”、“树枝线可视化”、“节点图标与配色”等核心体验的基础上，全面升级了：
1. **节点闭合卡片与 L 型闭合树枝线视觉**：
   - 每个文字块默认呈现为具备完整四周圆角边框与微阴影的**闭合卡片 (`closedBlockCard`)**，焦点态为高亮实线闭合框，选中态为高亮虚线闭合框。
   - 父子节点的树枝连接线采用精确的 **L 型圆角闭合拐角**，末尾子节点绝无多余悬空线。
2. **全平台覆盖 (PC + Web + Android + iOS)**：
   - **PC 端**：支持 Windows / macOS / Linux（Electron / Tauri）。
   - **Web 端**：支持 PWA 独立窗口安装。
   - **Android & iOS 移动端**：内置 Capacitor 跨平台配置 (`capacitor.config.json`) 与**移动端专属底部触控操作坞 (`MobileActionDock`)**，无需物理键盘即可一键完成同级新建、子块新建、升降级、上下移动、宽度与图标切换。
3. **多端云同步中心 (`CloudSync`)**：
   - **GitHub 私人仓库同步**：通过 GitHub Contents API 将每个标签页作为独立的 `.md` 文件直接推送/拉取至用户私人 Git 仓库。
   - **Dropbox 网盘同步**：通过 Dropbox API v2 直接上传与拉取指定目录（如 `/BooguNote`）下的所有 `.md` 与 `.boo` 笔记。
   - **GitHub 私密 Gist 同步**：免建仓库，单个 Token 即可跨设备极速同步。

---

## 二、目录结构规范
- `contexts/context.md`：项目核心上下文
- `capacitor.config.json`：Android / iOS 原生移动端打包配置
- `electron/main.mjs`：Windows / macOS / Linux 桌面端外壳入口
- `public/manifest.json`：Web / iOS / Android PWA 清单配置
- `src/types/outline.ts`：核心树节点、文档与云同步配置类型定义
- `src/utils/booParser.ts`：旧版 `.boo` XML 格式解析与导出器
- `src/utils/mdParser.ts`：Markdown 格式双向解析与序列化器
- `src/utils/cloudSync.ts`：GitHub 私人仓库 / Dropbox 网盘 / Gist 多端云同步引擎
- `src/utils/treeOps.ts`：不可变（Immutable）树节点操作纯函数库
- `src/components/`：
  - `NodeItem.tsx`：闭合卡片文字块与精准 L 型闭合树枝连线组件
  - `CloudSyncModal.tsx`：多端云同步配置与推拉操作中心
  - `MobileActionDock.tsx`：Android / iOS 触屏专属底部悬浮操作坞
  - `ContextMenu.tsx`：右键上下文菜单
  - `SourcePreviewModal.tsx`：Markdown / `.boo` 源码实时双向转换器
  - `ShortcutHelpModal.tsx`：快捷键指南与块尺寸自定义面板
