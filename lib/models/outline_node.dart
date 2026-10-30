import 'dart:convert';
import 'package:flutter/material.dart';

/// 节点图标类型（对应原版 BooguNote 的 7 种图标 + 无图标）
enum NodeIconType {
  none,
  flag,
  tick,
  cross,
  star,
  question,
  warning,
  idea,
}

/// 文字块的三种宽度状态：窄块、宽块、单行收缩
enum BlockWidthMode {
  narrow,
  wide,
  shrink,
}

/// 纯原生树形大纲节点实体
class OutlineNode {
  final String id;
  String content;
  NodeIconType icon;
  bool collapsed;
  BlockWidthMode blockWidth;
  bool isBold;
  bool showBranch;
  Color? textColor;
  Color? bgColor;
  String? modifyTime;
  List<OutlineNode> children;

  OutlineNode({
    required this.id,
    required this.content,
    this.icon = NodeIconType.none,
    this.collapsed = false,
    this.blockWidth = BlockWidthMode.narrow,
    this.isBold = false,
    this.showBranch = true,
    this.textColor,
    this.bgColor,
    this.modifyTime,
    List<OutlineNode>? children,
  }) : children = children ?? [];

  /// 深拷贝当前节点及其所有子节点
  OutlineNode clone() {
    return OutlineNode(
      id: id,
      content: content,
      icon: icon,
      collapsed: collapsed,
      blockWidth: blockWidth,
      isBold: isBold,
      showBranch: showBranch,
      textColor: textColor,
      bgColor: bgColor,
      modifyTime: modifyTime,
      children: children.map((c) => c.clone()).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'icon': icon.name,
      'collapsed': collapsed,
      'blockWidth': blockWidth.name,
      'isBold': isBold,
      'showBranch': showBranch,
      'textColor': textColor?.value,
      'bgColor': bgColor?.value,
      'modifyTime': modifyTime,
      'children': children.map((c) => c.toJson()).toList(),
    };
  }

  factory OutlineNode.fromJson(Map<String, dynamic> json) {
    return OutlineNode(
      id: json['id'] as String? ?? 'node_${DateTime.now().microsecondsSinceEpoch}',
      content: json['content'] as String? ?? '',
      icon: NodeIconType.values.firstWhere(
        (e) => e.name == json['icon'],
        orElse: () => NodeIconType.none,
      ),
      collapsed: json['collapsed'] as bool? ?? false,
      blockWidth: BlockWidthMode.values.firstWhere(
        (e) => e.name == json['blockWidth'],
        orElse: () => BlockWidthMode.narrow,
      ),
      isBold: json['isBold'] as bool? ?? false,
      showBranch: json['showBranch'] as bool? ?? true,
      textColor: json['textColor'] != null ? Color(json['textColor'] as int) : null,
      bgColor: json['bgColor'] != null ? Color(json['bgColor'] as int) : null,
      modifyTime: json['modifyTime'] as String?,
      children: (json['children'] as List<dynamic>?)
              ?.map((e) => OutlineNode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
