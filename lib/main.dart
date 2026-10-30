import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'models/outline_node.dart';
import 'models/doc_tab.dart';
import 'models/app_config.dart';
import 'parsers/boo_parser.dart';
import 'parsers/md_parser.dart';
import 'services/storage_service.dart';
import 'services/window_service.dart';
import 'utils/tree_ops.dart';
import 'utils/sample_docs.dart';
import 'widgets/node_item_widget.dart';
import 'widgets/branch_connector.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await WindowService.init();
  runApp(const BooguNoteNativeApp());
}

class BooguNoteNativeApp extends StatelessWidget {
  const BooguNoteNativeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BooguNote Native',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: Platform.isWindows ? 'Microsoft YaHei' : 'PingFang SC',
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const OutlinerMainScreen(),
    );
  }
}

class OutlinerMainScreen extends StatefulWidget {
  const OutlinerMainScreen({super.key});

  @override
  State<OutlinerMainScreen> createState() => _OutlinerMainScreenState();
}

class _OutlinerMainScreenState extends State<OutlinerMainScreen> {
  AppConfig _config = AppConfig();
  List<DocTab> _tabs = [];
  String _activeTabId = '';
  String? _saveToastMsg;

  @override
  void initState() {
    super.initState();
    _initApp();
  }

  Future<void> _initApp() async {
    final config = await StorageService.loadConfig();
    final tabs = await StorageService.loadTabs();
    final savedActiveId = await StorageService.loadActiveTabId();

    String activeId = tabs.isNotEmpty ? tabs.first.id : '';
    if (savedActiveId != null && tabs.any((t) => t.id == savedActiveId)) {
      activeId = savedActiveId;
    }

    // 如果是首次使用或空列表，自动提供快速指南文档
    if (tabs.isEmpty || (tabs.length == 1 && tabs.first.nodes.length == 1 && tabs.first.nodes.first.content.isEmpty)) {
      final guideNodes = MdParser.parse(SampleDocs.modernGuideMd);
      final initialTab = DocTab(
        id: 'tab_guide_${DateTime.now().microsecondsSinceEpoch}',
        title: '快速指南.md',
        nodes: guideNodes,
        focusedId: guideNodes.isNotEmpty ? guideNodes.first.id : null,
      );
      tabs.clear();
      tabs.add(initialTab);
      activeId = initialTab.id;
    }

    setState(() {
      _config = config;
      _tabs = tabs;
      _activeTabId = activeId;
    });

    _syncDiskFiles();
  }

  DocTab get _activeTab {
    return _tabs.firstWhere(
      (t) => t.id == _activeTabId,
      orElse: () => _tabs.first,
    );
  }

  void _showToast(String msg) {
    setState(() => _saveToastMsg = msg);
    Future.delayed(const Duration(milliseconds: 2500), () {
      if (mounted) setState(() => _saveToastMsg = null);
    });
  }

  Future<void> _syncDiskFiles() async {
    bool changed = false;
    for (final tab in _tabs) {
      if (tab.filePath != null && !tab.isDirty) {
        final file = File(tab.filePath!);
        if (await file.exists()) {
          try {
            final content = await file.readAsString();
            final isBoo = tab.filePath!.toLowerCase().endsWith('.boo');
            final parsed = isBoo ? BooParser.parse(content) : MdParser.parse(content);
            tab.nodes = parsed;
            changed = true;
          } catch (_) {}
        }
      }
    }
    if (changed && mounted) {
      setState(() {});
      await StorageService.saveTabs(_tabs);
    }
  }

  void _setActiveTab(String tabId) {
    setState(() => _activeTabId = tabId);
    StorageService.saveActiveTabId(tabId);
  }

  void _newTab() {
    final empty = TreeOps.createEmptyNode();
    final newTab = DocTab(
      id: 'tab_${DateTime.now().microsecondsSinceEpoch}',
      title: '未命名笔记_${_tabs.length + 1}.md',
      nodes: [empty],
      focusedId: empty.id,
    );
    setState(() {
      _tabs.add(newTab);
      _activeTabId = newTab.id;
    });
    StorageService.saveTabs(_tabs);
    StorageService.saveActiveTabId(newTab.id);
  }

  void _closeTab(String tabId) {
    if (_tabs.length <= 1) {
      final empty = TreeOps.createEmptyNode();
      final fresh = DocTab(
        id: 'tab_init_${DateTime.now().microsecondsSinceEpoch}',
        title: '未命名笔记.md',
        nodes: [empty],
        focusedId: empty.id,
      );
      setState(() {
        _tabs = [fresh];
        _activeTabId = fresh.id;
      });
      StorageService.saveTabs(_tabs);
      StorageService.saveActiveTabId(fresh.id);
      return;
    }

    setState(() {
      _tabs.removeWhere((t) => t.id == tabId);
      if (_activeTabId == tabId) {
        _activeTabId = _tabs.last.id;
      }
    });
    StorageService.saveTabs(_tabs);
    StorageService.saveActiveTabId(_activeTabId);
  }

  Future<void> _openFileNative() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['md', 'markdown', 'boo', 'txt'],
      allowMultiple: true,
    );

    if (result == null || result.files.isEmpty) return;

    for (final f in result.files) {
      if (f.path == null) continue;
      final file = File(f.path!);
      final content = await file.readAsString();
      final isBoo = f.path!.toLowerCase().endsWith('.boo');
      final parsed = isBoo ? BooParser.parse(content) : MdParser.parse(content);

      final tab = DocTab(
        id: 'tab_${DateTime.now().microsecondsSinceEpoch}_${f.name.hashCode.abs()}',
        title: f.name,
        filePath: f.path,
        nodes: parsed,
        focusedId: parsed.isNotEmpty ? parsed.first.id : null,
      );
      _tabs.add(tab);
      _activeTabId = tab.id;
    }

    setState(() {});
    await StorageService.saveTabs(_tabs);
    await StorageService.saveActiveTabId(_activeTabId);
  }

  Future<void> _saveCurrentDoc() async {
    final tab = _activeTab;
    if (tab.filePath == null) {
      await _saveAsCurrentDoc();
      return;
    }

    final isBoo = tab.filePath!.toLowerCase().endsWith('.boo');
    final content = isBoo ? BooParser.serialize(tab.nodes) : MdParser.serialize(tab.nodes);
    final file = File(tab.filePath!);
    await file.writeAsString(content);

    setState(() {
      tab.isDirty = false;
    });
    await StorageService.saveTabs(_tabs);
    _showToast('已保存: ${tab.title}');
  }

  Future<void> _saveAsCurrentDoc() async {
    final tab = _activeTab;
    final isBoo = tab.title.toLowerCase().endsWith('.boo');

    final path = await FilePicker.platform.saveFile(
      dialogTitle: '另存文档',
      fileName: tab.title,
      type: FileType.custom,
      allowedExtensions: isBoo ? ['boo'] : ['md'],
    );

    if (path == null) return;

    final targetIsBoo = path.toLowerCase().endsWith('.boo');
    final content = targetIsBoo ? BooParser.serialize(tab.nodes) : MdParser.serialize(tab.nodes);
    final file = File(path);
    await file.writeAsString(content);

    final fileName = path.split(Platform.isWindows ? r'\' : '/').last;
    setState(() {
      tab.title = fileName;
      tab.filePath = path;
      tab.isDirty = false;
    });
    await StorageService.saveTabs(_tabs);
    _showToast('已保存: $fileName');
  }

  // --- 历史撤销与重做管理 ---
  void _pushUndoSnapshot() {
    final tab = _activeTab;
    tab.undoStack.add(TreeOps.cloneTree(tab.nodes));
    if (tab.undoStack.length > 50) {
      tab.undoStack.removeAt(0);
    }
    tab.redoStack.clear();
  }

  void _undo() {
    final tab = _activeTab;
    if (tab.undoStack.isEmpty) return;

    tab.redoStack.add(TreeOps.cloneTree(tab.nodes));
    final prev = tab.undoStack.removeLast();
    setState(() {
      tab.nodes = prev;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
    _showToast('已撤销');
  }

  void _redo() {
    final tab = _activeTab;
    if (tab.redoStack.isEmpty) return;

    tab.undoStack.add(TreeOps.cloneTree(tab.nodes));
    final next = tab.redoStack.removeLast();
    setState(() {
      tab.nodes = next;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
    _showToast('已重做');
  }

  // --- 大纲树各种操作交互 ---
  void _handleInsertSiblingAfter(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    final res = TreeOps.insertSiblingAfter(tab.nodes, id);
    setState(() {
      tab.nodes = res['tree'] as List<OutlineNode>;
      tab.focusedId = res['newNodeId'] as String;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleInsertSiblingBefore(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    final res = TreeOps.insertSiblingBefore(tab.nodes, id);
    setState(() {
      tab.nodes = res['tree'] as List<OutlineNode>;
      tab.focusedId = res['newNodeId'] as String;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleInsertChild(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    final res = TreeOps.insertChild(tab.nodes, id);
    setState(() {
      tab.nodes = res['tree'] as List<OutlineNode>;
      tab.focusedId = res['newNodeId'] as String;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleSplitAtCursor(String id, int offset) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    final res = TreeOps.splitNodeAtCursor(tab.nodes, id, offset);
    setState(() {
      tab.nodes = res['tree'] as List<OutlineNode>;
      tab.focusedId = res['newNodeId'] as String;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleDeleteNode(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    final res = TreeOps.deleteNodes(tab.nodes, {id});
    setState(() {
      tab.nodes = res['tree'] as List<OutlineNode>;
      tab.focusedId = res['nextFocusId'] as String?;
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleMoveUp(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.moveNodeUp(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleMoveDown(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.moveNodeDown(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleIndent(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.indentNode(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleOutdent(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.outdentNode(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleCycleWidth(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.cycleBlockWidth(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleCycleIcon(String id, int dir) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.cycleNodeIcon(tab.nodes, id, dir);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleToggleBold(String id) {
    _pushUndoSnapshot();
    final tab = _activeTab;
    setState(() {
      tab.nodes = TreeOps.toggleBold(tab.nodes, id);
      tab.isDirty = true;
    });
    StorageService.saveTabs(_tabs);
  }

  void _handleToggleCollapse(String id) {
    final tab = _activeTab;
    final node = TreeOps.findNodeById(tab.nodes, id);
    if (node != null) {
      setState(() {
        node.collapsed = !node.collapsed;
        tab.isDirty = true;
      });
      StorageService.saveTabs(_tabs);
    }
  }

  void _handleNavigateVertical(String id, int dir) {
    final tab = _activeTab;
    final visible = TreeOps.flattenVisibleNodes(tab.nodes);
    final idx = visible.indexWhere((item) => item.node.id == id);
    if (idx != -1) {
      final targetIdx = (idx + dir).clamp(0, visible.length - 1);
      setState(() {
        tab.focusedId = visible[targetIdx].node.id;
      });
    }
  }

  // --- 打开示例内置教程 ---
  void _openGuideDoc() {
    final parsed = MdParser.parse(SampleDocs.modernGuideMd);
    final newTab = DocTab(
      id: 'tab_guide_${DateTime.now().microsecondsSinceEpoch}',
      title: '快速指南.md',
      nodes: parsed,
      focusedId: parsed.isNotEmpty ? parsed.first.id : null,
    );
    setState(() {
      _tabs.add(newTab);
      _activeTabId = newTab.id;
    });
    StorageService.saveTabs(_tabs);
    StorageService.saveActiveTabId(newTab.id);
  }

  void _openTutorialBooDoc() {
    final parsed = BooParser.parse(SampleDocs.legacyTutorialBooXml);
    final newTab = DocTab(
      id: 'tab_legacy_${DateTime.now().microsecondsSinceEpoch}',
      title: '原版教程.boo',
      nodes: parsed,
      focusedId: parsed.isNotEmpty ? parsed.first.id : null,
    );
    setState(() {
      _tabs.add(newTab);
      _activeTabId = newTab.id;
    });
    StorageService.saveTabs(_tabs);
    StorageService.saveActiveTabId(newTab.id);
  }

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.keyN, control: true): _newTab,
        const SingleActivator(LogicalKeyboardKey.keyO, control: true): _openFileNative,
        const SingleActivator(LogicalKeyboardKey.keyS, control: true): _saveCurrentDoc,
        const SingleActivator(LogicalKeyboardKey.keyS, control: true, shift: true): _saveAsCurrentDoc,
        const SingleActivator(LogicalKeyboardKey.keyW, control: true): () => _closeTab(_activeTab.id),
        const SingleActivator(LogicalKeyboardKey.keyZ, control: true): _undo,
        const SingleActivator(LogicalKeyboardKey.keyY, control: true): _redo,
      },
      child: Focus(
        autofocus: true,
        child: Scaffold(
          body: Column(
            children: [
              // 1. 顶部标签栏与主菜单
              _buildTopBar(),

              // 2. 可选顶部工具栏 (含新建同级、新建子块、升级、降级、移动等常用按钮)
              if (_config.showToolbar) _buildToolbar(),

              // 3. 核心大纲树内容区
              Expanded(
                child: _buildOutlineView(),
              ),

              // 4. 底部状态与提示
              if (_config.showStatusBar) _buildStatusBar(),
            ],
          ),
          floatingActionButton: _saveToastMsg != null
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check, size: 14, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        _saveToastMsg!,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ],
                  ),
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Container(
      height: 38,
      decoration: const BoxDecoration(
        color: Color(0xFFF1F5F9),
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          // Logo 标
          Container(
            width: 24,
            height: 24,
            margin: const EdgeInsets.only(left: 8, right: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(4),
            ),
            alignment: Alignment.center,
            child: const Text(
              'B',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),

          // 标签列表
          Expanded(
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _tabs.length,
              itemBuilder: (context, idx) {
                final tab = _tabs[idx];
                final isActive = tab.id == _activeTabId;
                return GestureDetector(
                  onTap: () => _setActiveTab(tab.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    margin: const EdgeInsets.only(top: 4, right: 2),
                    decoration: BoxDecoration(
                      color: isActive ? Colors.white : Colors.transparent,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                      border: isActive
                          ? const Border(
                              top: BorderSide(color: Color(0xFF2563EB), width: 2),
                              left: BorderSide(color: Color(0xFFCBD5E1)),
                              right: BorderSide(color: Color(0xFFCBD5E1)),
                            )
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${tab.title}${tab.isDirty ? ' *' : ''}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                            color: isActive ? const Color(0xFF1E293B) : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => _closeTab(tab.id),
                          child: const Icon(Icons.close, size: 12, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // 新建标签按键 (+)
          IconButton(
            icon: const Icon(Icons.add, size: 16),
            onPressed: _newTab,
            tooltip: '新建文档 (Ctrl+N)',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
          ),

          // 右上角主菜单下拉按钮
          PopupMenuButton<String>(
            icon: const Icon(Icons.keyboard_arrow_down, size: 18),
            tooltip: '主菜单',
            onSelected: (val) {
              switch (val) {
                case 'new':
                  _newTab();
                  break;
                case 'open':
                  _openFileNative();
                  break;
                case 'save':
                  _saveCurrentDoc();
                  break;
                case 'saveAs':
                  _saveAsCurrentDoc();
                  break;
                case 'guide':
                  _openGuideDoc();
                  break;
                case 'tutorial':
                  _openTutorialBooDoc();
                  break;
                case 'expandAll':
                  setState(() {
                    _activeTab.nodes = TreeOps.setAllCollapsed(_activeTab.nodes, false);
                  });
                  break;
                case 'collapseAll':
                  setState(() {
                    _activeTab.nodes = TreeOps.setAllCollapsed(_activeTab.nodes, true);
                  });
                  break;
                case 'dock':
                  WindowService.toggleDocked();
                  break;
                case 'top':
                  _config.alwaysOnTop = !_config.alwaysOnTop;
                  WindowService.setAlwaysOnTop(_config.alwaysOnTop);
                  setState(() {});
                  break;
                case 'toolbar':
                  setState(() => _config.showToolbar = !_config.showToolbar);
                  StorageService.saveConfig(_config);
                  break;
                case 'statusbar':
                  setState(() => _config.showStatusBar = !_config.showStatusBar);
                  StorageService.saveConfig(_config);
                  break;
                case 'quit':
                  exit(0);
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'new', child: Text('新建文档 (Ctrl+N)')),
              const PopupMenuItem(value: 'open', child: Text('打开文档 (Ctrl+O)')),
              const PopupMenuItem(value: 'save', child: Text('保存文档 (Ctrl+S)')),
              const PopupMenuItem(value: 'saveAs', child: Text('另存文档 (Ctrl+Shift+S)')),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'guide', child: Text('📖 打开 快速指南.md')),
              const PopupMenuItem(value: 'tutorial', child: Text('📖 打开 原版教程.boo')),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'expandAll', child: Text('展开所有分支')),
              const PopupMenuItem(value: 'collapseAll', child: Text('折叠所有分支')),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'dock', child: Text('靠边窗口 (Win+O)')),
              PopupMenuItem(
                value: 'top',
                child: Text('${_config.alwaysOnTop ? '✓ ' : ''}设置/取消 窗口置顶'),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'toolbar',
                child: Text('${_config.showToolbar ? '✓ ' : ''}显示常用工具栏'),
              ),
              PopupMenuItem(
                value: 'statusbar',
                child: Text('${_config.showStatusBar ? '✓ ' : ''}显示底部状态栏'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'quit', child: Text('退出')),
            ],
          ),
        ],
      ),
    );
  }

  // 顶部快捷工具栏
  Widget _buildToolbar() {
    final curId = _activeTab.focusedId ?? (_activeTab.nodes.isNotEmpty ? _activeTab.nodes.first.id : null);
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.undo, size: 15),
            tooltip: '撤销 (Ctrl+Z)',
            onPressed: _undo,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.redo, size: 15),
            tooltip: '重做 (Ctrl+Y)',
            onPressed: _redo,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          const VerticalDivider(width: 12, indent: 6, endIndent: 6),
          IconButton(
            icon: const Icon(Icons.add_box_outlined, size: 15),
            tooltip: '在下方新建同级文字块 (Ctrl+Enter)',
            onPressed: curId != null ? () => _handleInsertSiblingAfter(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.subdirectory_arrow_right, size: 15),
            tooltip: '新建子文字块 (Shift+Enter)',
            onPressed: curId != null ? () => _handleInsertChild(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          const VerticalDivider(width: 12, indent: 6, endIndent: 6),
          IconButton(
            icon: const Icon(Icons.arrow_back, size: 14),
            tooltip: '向左升级 (Shift+Tab)',
            onPressed: curId != null ? () => _handleOutdent(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.arrow_forward, size: 14),
            tooltip: '向右降级 (Tab)',
            onPressed: curId != null ? () => _handleIndent(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.arrow_upward, size: 14),
            tooltip: '向上移动 (Ctrl+Up)',
            onPressed: curId != null ? () => _handleMoveUp(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.arrow_downward, size: 14),
            tooltip: '向下移动 (Ctrl+Down)',
            onPressed: curId != null ? () => _handleMoveDown(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          const VerticalDivider(width: 12, indent: 6, endIndent: 6),
          IconButton(
            icon: const Icon(Icons.format_bold, size: 15),
            tooltip: '粗体 (Ctrl+B)',
            onPressed: curId != null ? () => _handleToggleBold(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.view_column_outlined, size: 15),
            tooltip: '切换文字块宽度 (Ctrl+U)',
            onPressed: curId != null ? () => _handleCycleWidth(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.flag_outlined, size: 15),
            tooltip: '切换图标 (Ctrl+=)',
            onPressed: curId != null ? () => _handleCycleIcon(curId, 1) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 15, color: Colors.redAccent),
            tooltip: '删除文字块 (Ctrl+Delete)',
            onPressed: curId != null ? () => _handleDeleteNode(curId) : null,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          ),
        ],
      ),
    );
  }

  Widget _buildOutlineView() {
    final tab = _activeTab;
    if (tab.nodes.isEmpty) {
      return Center(
        child: ElevatedButton.icon(
          onPressed: _newTab,
          icon: const Icon(Icons.add),
          label: const Text('新建文字块'),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      itemCount: tab.nodes.length,
      itemBuilder: (context, idx) {
        return _buildRecursiveNode(tab.nodes[idx], 0, isLastChild: idx == tab.nodes.length - 1);
      },
    );
  }

  /// 递归构建树节点及其子树折线连接器
  Widget _buildRecursiveNode(OutlineNode node, int depth, {required bool isLastChild}) {
    final isFocused = _activeTab.focusedId == node.id;
    final isSelected = _activeTab.selectedIds.contains(node.id);
    final hasChildren = node.children.isNotEmpty;
    final showBranch = hasChildren && !node.collapsed && (node.showBranch || _config.showAllBranches);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. 当前节点主体
        NodeItemWidget(
          node: node,
          isFocused: isFocused,
          isSelected: isSelected,
          config: _config,
          onContentChanged: (txt) {
            _pushUndoSnapshot();
            setState(() {
              node.content = txt;
              _activeTab.isDirty = true;
            });
          },
          onFocus: () {
            setState(() {
              _activeTab.focusedId = node.id;
              _activeTab.selectedIds.clear();
            });
          },
          onSelect: () {
            setState(() {
              _activeTab.focusedId = null;
              _activeTab.selectedIds = [node.id];
            });
          },
          onToggleCollapse: () => _handleToggleCollapse(node.id),
          onCycleWidth: () => _handleCycleWidth(node.id),
          onCycleIcon: (dir) => _handleCycleIcon(node.id, dir),
          onToggleBold: () => _handleToggleBold(node.id),
          onInsertSiblingAfter: () => _handleInsertSiblingAfter(node.id),
          onInsertSiblingBefore: () => _handleInsertSiblingBefore(node.id),
          onInsertChild: () => _handleInsertChild(node.id),
          onSplitAtCursor: (offset) => _handleSplitAtCursor(node.id, offset),
          onDelete: () => _handleDeleteNode(node.id),
          onMoveUp: () => _handleMoveUp(node.id),
          onMoveDown: () => _handleMoveDown(node.id),
          onIndent: () => _handleIndent(node.id),
          onOutdent: () => _handleOutdent(node.id),
          onNavigateVertical: (dir) => _handleNavigateVertical(node.id, dir),
        ),

        // 2. 带有正交直角折线的子节点列表
        if (hasChildren && !node.collapsed)
          Padding(
            padding: EdgeInsets.only(left: _config.indentSize),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: List.generate(node.children.length, (idx) {
                final child = node.children[idx];
                final isChildLast = idx == node.children.length - 1;

                if (showBranch) {
                  return IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 左侧树枝折线连接器
                        CustomPaint(
                          size: const Size(18, 0),
                          painter: BranchConnectorPainter(isLast: isChildLast),
                        ),
                        // 右侧子节点内容递归
                        Expanded(
                          child: _buildRecursiveNode(child, depth + 1, isLastChild: isChildLast),
                        ),
                      ],
                    ),
                  );
                } else {
                  return _buildRecursiveNode(child, depth + 1, isLastChild: isChildLast);
                }
              }),
            ),
          ),
      ],
    );
  }

  Widget _buildStatusBar() {
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      color: const Color(0xFFF1F5F9),
      child: Row(
        children: [
          Text(
            '文件: ${_activeTab.filePath ?? "未命名笔记"}',
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
          ),
          const Spacer(),
          Text(
            _activeTab.isDirty ? '已修改 (未保存)' : '已就绪',
            style: TextStyle(
              fontSize: 11,
              color: _activeTab.isDirty ? Colors.orange : Colors.green,
            ),
          ),
        ],
      ),
    );
  }
}
