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
import 'widgets/branch_painter.dart';
import 'widgets/node_item_widget.dart';

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

    String activeId = tabs.first.id;
    if (savedActiveId != null && tabs.any((t) => t.id == savedActiveId)) {
      activeId = savedActiveId;
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
    final empty = OutlineNode(
      id: 'node_${DateTime.now().microsecondsSinceEpoch}',
      content: '',
    );
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
    final tab = _tabs.firstWhere((t) => t.id == tabId);
    if (_tabs.length <= 1) {
      final empty = OutlineNode(
        id: 'node_${DateTime.now().microsecondsSinceEpoch}',
        content: '',
      );
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

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.keyN, control: true): _newTab,
        const SingleActivator(LogicalKeyboardKey.keyO, control: true): _openFileNative,
        const SingleActivator(LogicalKeyboardKey.keyS, control: true): _saveCurrentDoc,
        const SingleActivator(LogicalKeyboardKey.keyS, control: true, shift: true): _saveAsCurrentDoc,
        const SingleActivator(LogicalKeyboardKey.keyW, control: true): () => _closeTab(_activeTab.id),
      },
      child: Focus(
        autofocus: true,
        child: Scaffold(
          body: Column(
            children: [
              // 1. 顶部标签页与主菜单栏
              _buildTopBar(),

              // 2. 核心大纲树内容区
              Expanded(
                child: _buildOutlineView(),
              ),

              // 3. 底部状态与提示
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
              const PopupMenuItem(value: 'dock', child: Text('靠边窗口 (Win+O)')),
              PopupMenuItem(
                value: 'top',
                child: Text('${_config.alwaysOnTop ? '✓ ' : ''}设置/取消 窗口置顶'),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'toolbar',
                child: Text('${_config.showToolbar ? '✓ ' : ''}显示顶部工具栏'),
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

    return ListView(
      padding: const EdgeInsets.all(12),
      children: tab.nodes.map((node) => _buildTreeNode(node, 0)).toList(),
    );
  }

  Widget _buildTreeNode(OutlineNode node, int depth) {
    final isFocused = _activeTab.focusedId == node.id;
    final isSelected = _activeTab.selectedIds.contains(node.id);

    return Padding(
      padding: EdgeInsets.only(left: depth * _config.indentSize),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NodeItemWidget(
            node: node,
            isFocused: isFocused,
            isSelected: isSelected,
            config: _config,
            onContentChanged: (txt) {
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
            onToggleCollapse: () {
              setState(() {
                node.collapsed = !node.collapsed;
                _activeTab.isDirty = true;
              });
            },
            onCycleWidth: () {
              setState(() {
                if (node.blockWidth == BlockWidthMode.narrow) {
                  node.blockWidth = BlockWidthMode.wide;
                } else if (node.blockWidth == BlockWidthMode.wide) {
                  node.blockWidth = BlockWidthMode.shrink;
                } else {
                  node.blockWidth = BlockWidthMode.narrow;
                }
                _activeTab.isDirty = true;
              });
            },
            onCycleIcon: () {
              setState(() {
                final nextIdx = (node.icon.index + 1) % NodeIconType.values.length;
                node.icon = NodeIconType.values[nextIdx];
                _activeTab.isDirty = true;
              });
            },
            onInsertSibling: () {},
            onInsertChild: () {},
            onDelete: () {},
          ),
          if (!node.collapsed && node.children.isNotEmpty)
            ...node.children.map((child) => _buildTreeNode(child, depth + 1)),
        ],
      ),
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
            '文件: ${_activeTab.filePath ?? "未保存到磁盘"}',
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
