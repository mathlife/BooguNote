import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/outline_node.dart';

/// 纯原生 Markdown (.md) 大纲解析器与生成器
class MdParser {
  /// 将 Markdown 文本解析为树形大纲节点
  static List<OutlineNode> parse(String markdown) {
    if (markdown.trim().isEmpty) return [];

    final lines = markdown.split('\n');
    final rootNodes = <OutlineNode>[];
    final stack = <_StackItem>[];

    for (var line in lines) {
      if (line.trim().isEmpty) continue;

      // 提取缩进与内容
      final match = RegExp(r'^(\s*)[-*+]\s+(.*)$').firstMatch(line);
      if (match == null) {
        // 多行正文追加到当前末尾节点
        if (stack.isNotEmpty) {
          final lastNode = stack.last.node;
          lastNode.content += '\n${line.trim()}';
        }
        continue;
      }

      final indentStr = match.group(1) ?? '';
      var rawContent = match.group(2) ?? '';
      final indentLevel = (indentStr.length / 2).floor();

      // 提取 <!-- boo:{...} --> 属性注解
      Map<String, dynamic> meta = {};
      final metaMatch = RegExp(r'<!--\s*boo:(\{.*?\})\s*-->').firstMatch(rawContent);
      if (metaMatch != null) {
        try {
          meta = jsonDecode(metaMatch.group(1)!);
        } catch (_) {}
        rawContent = rawContent.replaceAll(metaMatch.group(0)!, '').trim();
      }

      NodeIconType icon = NodeIconType.none;
      if (meta.containsKey('icon')) {
        icon = NodeIconType.values.firstWhere(
          (e) => e.name == meta['icon'],
          orElse: () => NodeIconType.none,
        );
      }

      BlockWidthMode width = BlockWidthMode.narrow;
      if (meta.containsKey('width')) {
        width = BlockWidthMode.values.firstWhere(
          (e) => e.name == meta['width'],
          orElse: () => BlockWidthMode.narrow,
        );
      }

      Color? textColor;
      if (meta.containsKey('color') && meta['color'] is String) {
        textColor = _parseHexColor(meta['color'] as String);
      }

      Color? bgColor;
      if (meta.containsKey('bg') && meta['bg'] is String) {
        bgColor = _parseHexColor(meta['bg'] as String);
      }

      final newNode = OutlineNode(
        id: 'node_${DateTime.now().microsecondsSinceEpoch}_${rawContent.hashCode.abs()}',
        content: rawContent,
        icon: icon,
        collapsed: meta['collapsed'] == true,
        blockWidth: width,
        isBold: meta['bold'] == true,
        showBranch: meta['branch'] != false,
        textColor: textColor,
        bgColor: bgColor,
        modifyTime: meta['time'] as String?,
      );

      while (stack.isNotEmpty && stack.last.level >= indentLevel) {
        stack.removeLast();
      }

      if (stack.isEmpty) {
        rootNodes.add(newNode);
      } else {
        stack.last.node.children.add(newNode);
      }

      stack.add(_StackItem(indentLevel, newNode));
    }

    return rootNodes;
  }

  /// 将大纲节点列表序列化为包含元数据的标准 Markdown (.md)
  static String serialize(List<OutlineNode> nodes) {
    final sb = StringBuffer();
    for (final node in nodes) {
      _writeNode(sb, node, 0);
    }
    return sb.toString();
  }

  static void _writeNode(StringBuffer sb, OutlineNode node, int level) {
    final indent = '  ' * level;
    final meta = <String, dynamic>{};

    if (node.icon != NodeIconType.none) meta['icon'] = node.icon.name;
    if (node.blockWidth != BlockWidthMode.narrow) meta['width'] = node.blockWidth.name;
    if (node.isBold) meta['bold'] = true;
    if (!node.showBranch) meta['branch'] = false;
    if (node.collapsed) meta['collapsed'] = true;
    if (node.textColor != null) meta['color'] = _colorToHex(node.textColor!);
    if (node.bgColor != null) meta['bg'] = _colorToHex(node.bgColor!);
    if (node.modifyTime != null) meta['time'] = node.modifyTime;

    final metaStr = meta.isNotEmpty ? ' <!-- boo:${jsonEncode(meta)} -->' : '';

    final lines = node.content.split('\n');
    if (lines.isEmpty || (lines.length == 1 && lines[0].isEmpty)) {
      sb.writeln('$indent-$metaStr');
    } else {
      sb.writeln('$indent- ${lines[0]}$metaStr');
      for (var i = 1; i < lines.length; i++) {
        sb.writeln('$indent  ${lines[i]}');
      }
    }

    for (final child in node.children) {
      _writeNode(sb, child, level + 1);
    }
  }

  static Color? _parseHexColor(String hex) {
    try {
      var h = hex.replaceAll('#', '');
      if (h.length == 6) h = 'FF$h';
      if (h.length == 8) return Color(int.parse(h, radix: 16));
    } catch (_) {}
    return null;
  }

  static String _colorToHex(Color c) {
    return '#${c.value.toRadixString(16).padLeft(8, '0').substring(2)}';
  }
}

class _StackItem {
  final int level;
  final OutlineNode node;
  _StackItem(this.level, this.node);
}
