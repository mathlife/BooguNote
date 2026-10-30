<div align="center">

# BooguNote Next (现代全平台重构版)

**轻量、极速、全平台支持的树形大纲与块状思维笔记软件**  
*致敬经典 [BooguNote](https://github.com/anonymous1999/BooguNote) —— 采用现代跨平台技术栈全新重写，全面支持 Windows、macOS、Linux、Android 与 iOS。*

[![Build Status](https://github.com/mathlife/BooguNote/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/mathlife/BooguNote/actions)
[![Latest Release](https://img.shields.io/github/v/release/mathlife/BooguNote?color=2563eb&label=Release)](https://github.com/mathlife/BooguNote/releases/latest)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-1e40af)](#全平台独立安装包下载)
[![Format](https://img.shields.io/badge/Storage-Markdown%20%26%20.boo-16a34a)](#开放的-markdown-格式与-boo-无损兼容)
[![License: MIT](https://img.shields.io/badge/License-MIT-eab308.svg)](./LICENSE)

[English](./README.md) | **简体中文**

</div>

---

## 项目简介

**[BooguNote](https://github.com/anonymous1999/BooguNote)**（及上游原版仓库 [`boogunote/bn1`](https://github.com/boogunote/bn1)）是一款备受推崇的 Windows 轻量级树形大纲笔记软件，以**全键盘极速操作**、**文字块三种宽度自由切换**、**树枝线可视化连接**以及**屏幕右侧停靠窄窗**体验而闻名。

**BooguNote Next** 使用现代跨平台技术栈对 [BooguNote](https://github.com/anonymous1999/BooguNote) 进行了彻底重构与体验升级：
- **闭合卡片节点与精准 L 型闭合树枝线**：每个文字块默认采用四周闭合的圆角卡片设计，父子连接线采用严丝合缝的 `└─` 圆角闭合拐角，消除悬空尾线。
- **以开放的 Markdown 为核心**：默认使用标准多级无序列表 Markdown (`.md`) 存储，可在 Obsidian、VS Code、Typora 等任意编辑器中直接阅读；同时 **100% 兼容旧版 `.boo` (XML) 文件的导入与导出**。
- **全平台独立可运行客户端**：通过 GitHub Actions 云端自动构建 **Windows (`.exe`)**、**macOS (`.dmg`)**、**Linux (`.AppImage`)**、**Android (`.apk`)** 与 **iOS (`.ipa`)** 独立安装包，并针对手机/平板设计了专属的**底部触控快捷操作坞**。
- **无服务端多端云同步**：支持直接绑定 **GitHub 私人仓库**、**Dropbox 网盘** 或 **GitHub 私密 Gist**，无需第三方中转服务器即可在电脑与手机间安全同步所有笔记。

---

## 🌿 架构与分支说明 (Branch Architecture)

本项目同时维护两种不同技术路线的实现分支，您可以根据使用场景自由选择：

| 分支名 | 技术架构 | 核心定位与优势 | 产物大小 | 适用平台 |
| :--- | :--- | :--- | :---: | :--- |
| **`main`**<br>*(推荐默认)* | **纯原生独立架构**<br>(Flutter / Skia GPU + C++ / Win32) | **零 Chrome / 零 Web 引擎**<br>• 直接编译为机器码，无 Chromium / Node 庞大内核<br>• 内存占用极低（~30MB），毫秒级极速冷启动<br>• 100% 还原 BooguNote 原版正交树枝折线与全键盘操作流<br>• 具备拖拽贴边吸附与移出自动隐藏为 4px 感应细条交互 | **~10.8 MB**<br>(绿色解压即用) | Windows x64<br>macOS (Apple Silicon / Intel) |
| **`web`** | **现代 Web / Electron 架构**<br>(React + TypeScript + Vite + Electron + Capacitor) | **多端与云同步全生态覆盖**<br>• 支持浏览器在线运行与 PWA<br>• 支持打包为 Android APK 与 iOS IPA 移动端应用<br>• 内置多端无服务端云同步（GitHub 仓库 / Dropbox / Gist）<br>• 配备移动端触控操作坞与深浅色主题切换 | ~66 MB ~ 88 MB | Windows<br>macOS / Linux<br>Android / iOS<br>Web 浏览器 |

---

## 核心特性

### 1. 原汁原味的 BooguNote 交互 + 现代化增强
- **文字块三种选择状态**：
  - **焦点编辑态 (`Focused`)**：实线高亮闭合框，支持自适应多行输入与 URL 链接识别。
  - **被选择态 (`Selected`)**：虚线高亮闭合框，支持 `Ctrl+单击` 单选、`Shift+单击` 范围多选、`Alt+单击` 整棵子树一键全选。
  - **未选择态 (`Unselected`)**：精致闭合圆角卡片框（亦可在顶部工具栏一键切换为传统无框极简模式）。
- **文字块三种宽度模式 (`Ctrl+U` 或右键点击块前小方块)**：
  - `窄块 (Narrow)`：默认紧凑宽度（`360px`），适合多层级树状并排阅读。
  - `宽块 (Wide)`：宽幅段落模式（`720px`），适合长段落笔记与代码记录。
  - `单行收缩 (Shrink)`：超长文字自动浓缩为单行省略号显示（`...`），聚焦编辑时自动展开，适合快速浏览大纲全局。
- **父子闭合树枝连接线 (`Alt+B`)**：支持按节点单层开关或全局一键开启父子正交树枝线。
- **7 种经典矢量图标 (`Ctrl+=` / `Ctrl+-`)**：完整还原旗帜 (`flag`)、完成 (`tick`)、错误 (`cross`)、星标 (`star`)、疑问 (`question`)、警告 (`warning`)、灵感 (`idea`) 图标及自定义文字色/背景色。
- **无限层级撤销与重做 (`Ctrl+Z` / `Ctrl+Y`)**：彻底解决原版只能回滚一次删除操作的历史限制。
- **右侧停靠窄窗模式 & 三套主题**：支持一键切换“经典右侧停靠抽屉模式”与“标准宽屏模式”，内置 **经典复古蓝**、**现代明亮**、**极客深色** 三套主题。

### 2. 开放的 Markdown 格式与 `.boo` 无损兼容
- **标准 Markdown (`.md`)**：笔记保存为标准的多级无序列表语法，直接兼容所有主流 Markdown 工具。
- **无损扩展属性注释**：节点的图标、颜色、宽度模式、树枝线、折叠状态保存在行尾注释 `<!-- boo:{"icon":"star","width":"wide"} -->` 中；同时支持在源码转换器中一键复制/导出不含注释的“纯净 Markdown”。
- **`.boo` 双向转换器**：支持直接拖拽或打开原版 [BooguNote](https://github.com/anonymous1999/BooguNote) `.boo` 文件并另存为 `.md`，项目亦附带 Python 批量转换脚本。

### 3. 多端云同步中心 (PC / Android / iOS)
点击顶部工具栏 **「云同步 (GitHub / Dropbox)」** 即可配置：
- **GitHub 私人仓库同步**：填写 GitHub PAT Token 与仓库名（如 `username/my-notes`），一键将所有标签页作为独立的 `.md` 文件直接提交或拉取自私人仓库。
- **Dropbox 网盘同步**：接入 Dropbox API v2，直接与网盘指定目录（如 `/BooguNote`）同步所有 `.md` 与 `.boo` 笔记。
- **GitHub 私密 Gist 同步**：无需手动建仓，单个 Token 即可自动创建私密 Gist 实现跨设备极速同步。

---

## 全平台独立安装包下载

所有平台的独立可运行程序均由 GitHub Actions 云端自动编译打包，可直接前往 **[GitHub Releases 页面](https://github.com/mathlife/BooguNote/releases/latest)** 下载：

### 🚀 纯原生独立版 (`main` 分支构建 - 零 Chrome / 极致轻量秒开)
| 运行平台 | 安装包 / 文件名 | 大小 | 说明 |
| :--- | :--- | :---: | :--- |
| **Windows x64** | `BooguNote-Native-Windows-x64.zip` | **~10.8 MB** | 绿色免安装，解压双击即用，纯原生机器码渲染，支持贴边自动隐藏 |
| **macOS (Apple / Intel)** | `BooguNote-Native-macOS.zip` | **~49 MB** | 原生 macOS 独立应用，无任何浏览器引擎包装 |

### 🌐 现代 Web & 移动全平台版 (`web` 分支构建 - 支持移动端与云同步)
| 运行平台 | 安装包 / 文件名 | 大小 | 说明 |
| :--- | :--- | :---: | :--- |
| **Windows 便携版** | `BooguNote-Windows-Portable-x64.exe` | 66.4 MB | 内置 Electron 独立运行环境，免安装双击即用 |
| **Windows 安装版** | `BooguNote-Windows-Setup-x64.exe` | 66.7 MB | 标准 Windows 安装包（可设置开始菜单与开机自启） |
| **macOS 镜像** | `BooguNote-macOS-arm64.dmg` | 88.3 MB | macOS 苹果桌面安装镜像 |
| **Linux 桌面端** | `BooguNote-Linux-x86_64.AppImage` | 75.2 MB | Linux 免安装单文件独立可执行程序 |
| **Android 移动端** | `BooguNote-Android.apk` | 4.0 MB | 安卓手机/平板原生安装包，内置触控操作坞与云同步 |
| **iOS (iPhone/iPad)** | `BooguNote-iOS.ipa` | 860 KB | iOS 独立包（支持 AltStore / Sideloadly / TrollStore 签名安装） |

---

## 经典快捷键一览

| 快捷键 | 功能说明 |
| :--- | :--- |
| `Ctrl + Enter` | 在下方新建**同级**下一个文字块 |
| `Alt + Enter` | 在上方新建**同级**上一个文字块 |
| `Shift + Enter` | 在当前块下新建**子级**文字块 |
| `Ctrl + \` | **从光标处切割文字块**（光标后文字拆分为同级下一块） |
| `Ctrl + Delete` | 删除当前焦点文字块或所有被选择的文字块 |
| `Ctrl + Up / Down` | 向上 / 向下移动当前文字块（含子树） |
| `Ctrl + Left / Right` | 向左升级 / 向右降级文字块（同样支持 `Shift+Tab` / `Tab`） |
| `Ctrl + U` | 循环切换文字块三种宽度（`窄块` → `宽块` → `单行收缩`） |
| `Ctrl + B` | 切换文字块粗体状态 |
| `Ctrl + =` / `Ctrl + -` | 循环切换 7 种经典节点图标 |
| `Alt + B` / `Shift + Alt + B` | 开启 / 关闭当前节点的父子“树枝连接线” |
| `Ctrl + Z` / `Ctrl + Y` | 无限层级撤销 (Undo) / 重做 (Redo) |
| `Ctrl + F` / `F3` | 文档内实时搜索并自动展开匹配分支 |
| `Ctrl + 左键单击` | 加选 / 反选单个文字块 |
| `Shift + 左键单击` | 批量范围选择连续文字块 |
| `Alt + 左键单击` | 一键选择该文字块及其所有子孙文字块 |
| `Esc` | 退出编辑焦点态进入块选择态 / 清空选择 |

> **Android 与 iOS 触屏操作**：在手机或平板上选中或聚焦任意文字块时，屏幕底部会自动浮现**移动端专属触控操作坞**，单手即可一键完成新建同级、新建子块、升降级、上下移动、切宽度、切图标与删除。

---

## 开发与批量转换工具

### 本地开发调试
```bash
# 安装依赖
npm install

# 启动本地热更新开发服务
npm run dev

# 编译生产包
npm run build
```

### 批量将历史 `.boo` 文件转换为 Markdown
```bash
# 支持将单个 .boo 文件或整个文件夹递归无损转换为 .md
python scripts/convert_boo_to_md.py <输入.boo文件或目录> [输出.md文件或目录]
```

---

## 致谢与原始项目

- 致敬原始项目 **[anonymous1999/BooguNote](https://github.com/anonymous1999/BooguNote)** 与上游仓库 **[boogunote/bn1](https://github.com/boogunote/bn1)** 极具前瞻性的树状文字块交互设计与 `.boo` 数据规范。

---

## 开源协议

本项目基于 **[MIT License](./LICENSE)** 开源。

