import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/doc_tab.dart';
import '../models/app_config.dart';
import '../models/outline_node.dart';

/// 本地会话与配置持久化服务（保证随时关闭随时接着写，启动记忆上次活动文档）
class StorageService {
  static const _keyTabs = 'boogunote_native_tabs_v1';
  static const _keyActiveTab = 'boogunote_native_active_tab_v1';
  static const _keyConfig = 'boogunote_native_config_v1';

  static Future<AppConfig> loadConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_keyConfig);
      if (str != null) {
        return AppConfig.fromJson(jsonDecode(str));
      }
    } catch (_) {}
    return AppConfig();
  }

  static Future<void> saveConfig(AppConfig config) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyConfig, jsonEncode(config.toJson()));
    } catch (_) {}
  }

  static Future<List<DocTab>> loadTabs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_keyTabs);
      if (str != null) {
        final list = jsonDecode(str) as List<dynamic>;
        if (list.isNotEmpty) {
          return list.map((e) => DocTab.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    // 默认提供干净的未命名空白笔记
    final empty = OutlineNode(
      id: 'node_${DateTime.now().microsecondsSinceEpoch}',
      content: '',
    );
    return [
      DocTab(
        id: 'tab_init_${DateTime.now().microsecondsSinceEpoch}',
        title: '未命名笔记.md',
        nodes: [empty],
        focusedId: empty.id,
      ),
    ];
  }

  static Future<void> saveTabs(List<DocTab> tabs) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = tabs.map((t) => t.toJson()).toList();
      await prefs.setString(_keyTabs, jsonEncode(list));
    } catch (_) {}
  }

  static Future<String?> loadActiveTabId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_keyActiveTab);
    } catch (_) {}
    return null;
  }

  static Future<void> saveActiveTabId(String tabId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyActiveTab, tabId);
    } catch (_) {}
  }
}
