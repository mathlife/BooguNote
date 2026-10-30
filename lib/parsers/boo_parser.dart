import 'package:flutter/material.dart';
import 'package:xml/xml.dart';
import '../models/outline_node.dart';

/// 纯原生 BooguNote .boo (XML) 编解码器
class BooParser {
  /// 将 .boo (XML) 文本解析为大纲节点列表
  static List<OutlineNode> parse(String xmlContent) {
    if (xmlContent.trim().isEmpty) return [];

    try {
      final document = XmlDocument.parse(xmlContent);
      final root = document.rootElement;
      final items = root.findElements('item');
      return items.map((item) => _parseItem(item)).toList();
    } catch (e) {
      debugPrint('解析 .boo XML 异常: $e');
      return [];
    }
  }

  static OutlineNode _parseItem(XmlElement item) {
    final content = item.getAttribute('content') ?? '';
    final iconStr = item.getAttribute('icon') ?? 'none';
    final branch = item.getAttribute('branch') ?? 'open';
    final block = item.getAttribute('block') ?? 'narrow';
    final isBoldStr = item.getAttribute('IsBold') ?? 'false';
    final showBranchStr = item.getAttribute('ShowBranch') ?? 'true';
    final textColorStr = item.getAttribute('TextColor');
    final bkgrdColorStr = item.getAttribute('BkgrdColor');
    final modifyTime = item.getAttribute('ModifyTime');

    NodeIconType icon = NodeIconType.none;
    switch (iconStr.toLowerCase()) {
      case 'flag':
        icon = NodeIconType.flag;
        break;
      case 'tick':
        icon = NodeIconType.tick;
        break;
      case 'cross':
        icon = NodeIconType.cross;
        break;
      case 'star':
        icon = NodeIconType.star;
        break;
      case 'question':
        icon = NodeIconType.question;
        break;
      case 'warning':
        icon = NodeIconType.warning;
        break;
      case 'idea':
        icon = NodeIconType.idea;
        break;
      default:
        icon = NodeIconType.none;
    }

    BlockWidthMode blockWidth = BlockWidthMode.narrow;
    switch (block.toLowerCase()) {
      case 'wide':
        blockWidth = BlockWidthMode.wide;
        break;
      case 'shrink':
        blockWidth = BlockWidthMode.shrink;
        break;
      default:
        blockWidth = BlockWidthMode.narrow;
    }

    final children = item.findElements('item').map((c) => _parseItem(c)).toList();

    return OutlineNode(
      id: 'node_${DateTime.now().microsecondsSinceEpoch}_${content.hashCode.abs()}',
      content: content,
      icon: icon,
      collapsed: branch == 'close',
      blockWidth: blockWidth,
      isBold: isBoldStr.toLowerCase() == 'true',
      showBranch: showBranchStr.toLowerCase() != 'false',
      textColor: _parseHexColor(textColorStr),
      bgColor: _parseHexColor(bkgrdColorStr),
      modifyTime: modifyTime,
      children: children,
    );
  }

  /// 将大纲节点列表序列化为原版兼容的 XML (.boo)
  static String serialize(List<OutlineNode> nodes) {
    final builder = XmlBuilder();
    builder.processing('xml', 'version="1.0" encoding="UTF-8" standalone="yes"');
    builder.element('root', attributes: {
      'version': '7',
      'DefaultSaveDir': '',
      'DefaultSaveExtension': 'png',
    }, nest: () {
      for (final node in nodes) {
        _buildItem(builder, node, 0);
      }
    });
    return builder.buildDocument().toXmlString(pretty: true, indent: '\t');
  }

  static void _buildItem(XmlBuilder builder, OutlineNode node, int level) {
    builder.element('item', attributes: {
      'content': node.content,
      'icon': node.icon == NodeIconType.none ? 'none' : node.icon.name,
      'branch': node.collapsed ? 'close' : (node.children.isEmpty ? 'none' : 'open'),
      'block': node.blockWidth.name,
      'level': level.toString(),
      'IsShown': 'true',
      'IsBold': node.isBold ? 'true' : 'false',
      'ShowBranch': node.showBranch ? 'true' : 'false',
      'TextColor': _colorToHex(node.textColor),
      'BkgrdColor': _colorToHex(node.bgColor),
      if (node.modifyTime != null) 'ModifyTime': node.modifyTime!,
      'IsFile': 'false',
    }, nest: () {
      for (final child in node.children) {
        _buildItem(builder, child, level + 1);
      }
    });
  }

  static Color? _parseHexColor(String? hex) {
    if (hex == null || hex.isEmpty || hex == '00000000') return null;
    try {
      if (hex.length == 8) {
        final r = int.parse(hex.substring(0, 2), radix: 16);
        final g = int.parse(hex.substring(2, 4), radix: 16);
        final b = int.parse(hex.substring(4, 6), radix: 16);
        return Color.fromARGB(255, r, g, b);
      }
    } catch (_) {}
    return null;
  }

  static String _colorToHex(Color? c) {
    if (c == null) return '00000000';
    final r = c.red.toRadixString(16).padLeft(2, '0');
    final g = c.green.toRadixString(16).padLeft(2, '0');
    final b = c.blue.toRadixString(16).padLeft(2, '0');
    return '$r$g${b}00';
  }
}
