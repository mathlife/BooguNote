<div align="center">

# BooguNote Next

**A Modern, All-Platform Tree Outliner & Block Note-Taking Application**  
*A complete modern rewrite of the classic [BooguNote](https://github.com/anonymous1999/BooguNote), built for Windows, macOS, Linux, Android, and iOS.*

[![Build Status](https://github.com/mathlife/BooguNote/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/mathlife/BooguNote/actions)
[![Latest Release](https://img.shields.io/github/v/release/mathlife/BooguNote?color=2563eb&label=Release)](https://github.com/mathlife/BooguNote/releases/latest)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-1e40af)](#downloads)
[![Format](https://img.shields.io/badge/Storage-Markdown%20%26%20.boo-16a34a)](#markdown-first--legacy-boo-compatibility)

**English** | [简体中文](./README.zh-CN.md)

</div>

---

## Overview

**[BooguNote](https://github.com/anonymous1999/BooguNote)** ([original upstream `boogunote/bn1`](https://github.com/boogunote/bn1)) was an iconic, lightweight tree-structured outliner for Windows known for its lightning-fast keyboard navigation, customizable block widths, visual branch connectors, and docked sidebar workflow.

**BooguNote Next** reimagines and completely rewrites [BooguNote](https://github.com/anonymous1999/BooguNote) from the ground up using a modern cross-platform architecture:
- **Closed Card Aesthetics & L-Shaped Branch Lines**: Crisp, closed rounded card blocks with zero-overhang orthogonal `└─` tree branch connectors.
- **Markdown-First Storage**: Uses standard nested Markdown lists (`.md`) as the primary open format while preserving 100% lossless import/export compatibility with legacy `.boo` (XML) files.
- **All-Platform Standalone Clients**: Runs natively on **Windows (`.exe`)**, **macOS (`.dmg`)**, **Linux (`.AppImage`)**, **Android (`.apk`)**, and **iOS (`.ipa`)**, complete with a dedicated mobile touch action dock.
- **Serverless Multi-Device Cloud Sync**: Directly bind your **GitHub Private Repository**, **Dropbox**, or **Private GitHub Gist** for seamless synchronization across desktop and mobile devices.

---

## Key Features

### 1. Classic BooguNote DNA, Modernized
- **Three Block Selection States**:
  - **Focused State**: Solid highlighted border with auto-expanding multi-line editing.
  - **Selected State**: Dashed border with tinted background supporting multi-block selection (`Ctrl+Click` toggle, `Shift+Click` range select, `Alt+Click` entire subtree select).
  - **Unselected State**: Clean closed-card frame (or toggleable borderless minimalist mode).
- **Three Block Width Modes (`Ctrl+U` or Right-Click Bullet)**:
  - `Narrow`: Compact card width (default `360px`) ideal for structured multi-level trees.
  - `Wide`: Expanded paragraph width (default `720px`) for long-form notes and code snippets.
  - `Shrink`: Single-line ellipsis mode (`...`) for high-density overview scanning.
- **Visual Branch Lines (`Alt+B`)**: Toggle orthogonal parent-to-child tree connectors per node or globally.
- **7 Classic Vector Icons (`Ctrl+=` / `Ctrl+-`)**: `flag`, `tick`, `cross`, `star`, `question`, `warning`, and `idea`, plus custom text and background color palettes.
- **Unlimited Undo / Redo (`Ctrl+Z` / `Ctrl+Y`)**: Full immutable tree history stack overcoming the original version's single-delete rollback limitation.
- **Right-Sidebar Dock Mode & 3 Themes**: Switch between full-workspace mode and classic docked narrow sidebar mode; includes **Classic Boogu**, **Modern Light**, and **Modern Dark** themes.

### 2. Markdown-First & Legacy `.boo` Compatibility
- **Standard Markdown (`.md`)**: Notes are saved as clean, human-readable Markdown bullet lists compatible with Obsidian, VS Code, Logseq, and GitHub.
- **Lossless Metadata Comments**: Extended node properties (icons, colors, block width, branch lines, collapse state) are stored in unobtrusive inline HTML comments `<!-- boo:{"icon":"star","width":"wide"} -->` and can also be exported as pure, comment-free Markdown.
- **Bidirectional `.boo` Converter**: Open and export legacy [BooguNote](https://github.com/anonymous1999/BooguNote) `.boo` (XML v6/v7) files directly in the app, or batch-convert existing `.boo` directories via the included Python CLI script.

### 3. Multi-Device Cloud Synchronization
Built-in zero-backend cloud sync supporting three providers:
- **GitHub Private Repository**: Commits and pulls each document tab as an individual `.md` file directly to/from your private Git repository via GitHub REST API v3.
- **Dropbox Cloud Storage**: Uploads and downloads `.md` / `.boo` files to a designated folder (e.g., `/BooguNote`) via Dropbox API v2.
- **GitHub Secret Gist**: Zero-setup multi-device sync using a single Personal Access Token.

---

## Downloads

Pre-built standalone installers and portable executables for all platforms are automatically compiled via GitHub Actions and published on the **[Releases Page](https://github.com/mathlife/BooguNote/releases/latest)**:

| Platform | Package / Artifact | Description |
| :--- | :--- | :--- |
| **Windows (Lightweight)** | `BooguNote-Windows-Standalone.exe` | ~886 KB zero-dependency single-file executable |
| **Windows (Portable)** | `BooguNote-Windows-Portable-x64.exe` | Standalone portable Electron executable (no installation required) |
| **Windows (Installer)** | `BooguNote-Windows-Setup-x64.exe` | Standard Windows desktop installer (NSIS) |
| **macOS** | `BooguNote-macOS-arm64.dmg` | Native macOS disk image installer |
| **Linux** | `BooguNote-Linux-x86_64.AppImage` | Standalone Linux AppImage executable |
| **Android** | `BooguNote-Android.apk` | Standalone Android package for phones & tablets |
| **iOS** | `BooguNote-iOS.ipa` | Unsigned iOS package (install via AltStore / Sideloadly / TrollStore) |

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` | Create a new **sibling** block below |
| `Alt + Enter` | Create a new **sibling** block above |
| `Shift + Enter` | Create a new **child** block |
| `Ctrl + \` | **Split** current block at the cursor position into two sibling blocks |
| `Ctrl + Delete` | Delete focused block or all selected blocks |
| `Ctrl + Up / Down` | Move block (and its subtree) up / down |
| `Ctrl + Left / Right` | Outdent (promote) / Indent (demote) block (`Shift+Tab` / `Tab` also supported) |
| `Ctrl + U` | Cycle block width mode (`Narrow` → `Wide` → `Shrink`) |
| `Ctrl + B` | Toggle bold text on block |
| `Ctrl + =` / `Ctrl + -` | Cycle through the 7 node icons |
| `Alt + B` / `Shift + Alt + B` | Show / Hide parent-to-child branch lines |
| `Ctrl + Z` / `Ctrl + Y` | Unlimited Undo / Redo |
| `Ctrl + F` / `F3` | Real-time in-document search & auto-expand matching branches |
| `Ctrl + Left Click` | Toggle selection of a single block |
| `Shift + Left Click` | Range-select contiguous visible blocks |
| `Alt + Left Click` | Select a block together with its entire subtree |
| `Esc` | Exit editing focus into block selection mode / Clear selection |

> **On Android & iOS**: When any block is focused or selected, a dedicated **Mobile Action Dock** appears at the bottom of the screen for one-tap sibling/child creation, indentation, movement, width/icon switching, and deletion.

---

## Development & CLI Utilities

### Local Development
```bash
# Install dependencies
npm install

# Start development server with HMR
npm run dev

# Build production bundle
npm run build
```

### Batch Convert Legacy `.boo` Files to Markdown
```bash
# Convert a single .boo file or an entire directory recursively to .md
python scripts/convert_boo_to_md.py path/to/notes.boo path/to/output.md
```

---

## Credits & Acknowledgments

- Original **[BooguNote](https://github.com/boogunote/bn1)** and **[anonymous1999/BooguNote](https://github.com/anonymous1999/BooguNote)** for the pioneering tree-block outliner design, interaction philosophy, and `.boo` format specification.

---

## License

Released under the **MIT License**.
