import 'package:flutter/material.dart';
import '../models/outline_node.dart';

/// 扁平化节点项，用于上下键盘光标导航
class FlatNodeItem {
  final OutlineNode node;
  final int level;
  final String? parentId;

  FlatNodeItem({
    required this.node,
    required this.level,
    this.parentId,
  });
}

/// 纯原生树形大纲核心操作工具库
class TreeOps {
  /// 生成唯一节点 ID
  static String generateId() {
    return 'node_${DateTime.now().microsecondsSinceEpoch}_${(DateTime.now().millisecondsSinceEpoch % 10000)}';
  }

  /// 创建空白节点
  static OutlineNode createEmptyNode({
    String content = '',
    BlockWidthMode blockWidth = BlockWidthMode.narrow,
    bool isBold = false,
    bool showBranch = true,
    NodeIconType icon = NodeIconType.none,
  }) {
    final nowStr = DateTime.now().toIso8601String().replaceFirst('T', ' ').substring(0, 19);
    return OutlineNode(
      id: generateId(),
      content: content,
      blockWidth: blockWidth,
      isBold: isBold,
      showBranch: showBranch,
      icon: icon,
      modifyTime: nowStr,
    );
  }

  /// 深拷贝整棵树（用于 Undo/Redo 历史快照）
  static List<OutlineNode> cloneTree(List<OutlineNode> nodes) {
    return nodes.map((n) => n.clone()).toList();
  }

  /// 扁平化所有可见节点（用于上下键盘导航）
  static List<FlatNodeItem> flattenVisibleNodes(
    List<OutlineNode> nodes, [
    int level = 0,
    String? parentId,
  ]) {
    final result = <FlatNodeItem>[];
    for (final node in nodes) {
      result.add(FlatNodeItem(node: node, level: level, parentId: parentId));
      if (!node.collapsed && node.children.isNotEmpty) {
        result.addAll(flattenVisibleNodes(node.children, level + 1, node.id));
      }
    }
    return result;
  }

  /// 根据 ID 查找节点
  static OutlineNode? findNodeById(List<OutlineNode> nodes, String id) {
    for (final node in nodes) {
      if (node.id == id) return node;
      final found = findNodeById(node.children, id);
      if (found != null) return found;
    }
    return null;
  }

  /// 在目标节点下方新建同级文字块 (Ctrl+Enter)
  static Map<String, dynamic> insertSiblingAfter(
    List<OutlineNode> nodes,
    String targetId, {
    String content = '',
  }) {
    final newNode = createEmptyNode(content: content);
    bool inserted = false;

    List<OutlineNode> helper(List<OutlineNode> list) {
      final res = <OutlineNode>[];
      for (final item in list) {
        if (item.id == targetId) {
          newNode.blockWidth = item.blockWidth;
          newNode.showBranch = item.showBranch;
          res.add(item);
          res.add(newNode);
          inserted = true;
        } else {
          final updatedItem = item.clone();
          if (item.children.isNotEmpty) {
            updatedItem.children = helper(item.children);
          }
          res.add(updatedItem);
        }
      }
      return res;
    }

    var nextTree = helper(nodes);
    if (!inserted) {
      nextTree.add(newNode);
    }
    return {'tree': nextTree, 'newNodeId': newNode.id};
  }

  /// 在目标节点上方新建同级文字块 (Alt+Enter)
  static Map<String, dynamic> insertSiblingBefore(
    List<OutlineNode> nodes,
    String targetId, {
    String content = '',
  }) {
    final newNode = createEmptyNode(content: content);
    bool inserted = false;

    List<OutlineNode> helper(List<OutlineNode> list) {
      final res = <OutlineNode>[];
      for (final item in list) {
        if (item.id == targetId) {
          newNode.blockWidth = item.blockWidth;
          res.add(newNode);
          res.add(item);
          inserted = true;
        } else {
          final updatedItem = item.clone();
          if (item.children.isNotEmpty) {
            updatedItem.children = helper(item.children);
          }
          res.add(updatedItem);
        }
      }
      return res;
    }

    var nextTree = helper(nodes);
    if (!inserted) {
      nextTree.insert(0, newNode);
    }
    return {'tree': nextTree, 'newNodeId': newNode.id};
  }

  /// 在目标节点内部新建子文字块 (Shift+Enter / Insert)
  static Map<String, dynamic> insertChild(
    List<OutlineNode> nodes,
    String targetId, {
    String content = '',
  }) {
    final newNode = createEmptyNode(content: content);
    bool inserted = false;

    List<OutlineNode> helper(List<OutlineNode> list) {
      return list.map((item) {
        final updated = item.clone();
        if (item.id == targetId) {
          updated.collapsed = false;
          updated.children.insert(0, newNode);
          inserted = true;
        } else if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    var nextTree = helper(nodes);
    if (!inserted) {
      nextTree.add(newNode);
    }
    return {'tree': nextTree, 'newNodeId': newNode.id};
  }

  /// 从光标处将文字块切分为两个 (Ctrl+\)
  static Map<String, dynamic> splitNodeAtCursor(
    List<OutlineNode> nodes,
    String targetId,
    int cursorOffset,
  ) {
    final target = findNodeById(nodes, targetId);
    if (target == null) return {'tree': nodes, 'newNodeId': targetId};

    final fullText = target.content;
    final firstPart = cursorOffset <= fullText.length ? fullText.substring(0, cursorOffset) : fullText;
    final secondPart = cursorOffset < fullText.length ? fullText.substring(cursorOffset) : '';

    final newNode = createEmptyNode(
      content: secondPart,
      blockWidth: target.blockWidth,
      isBold: target.isBold,
      icon: target.icon,
    );

    List<OutlineNode> helper(List<OutlineNode> list) {
      final res = <OutlineNode>[];
      for (final item in list) {
        if (item.id == targetId) {
          final updatedTarget = item.clone();
          updatedTarget.content = firstPart;
          res.add(updatedTarget);
          res.add(newNode);
        } else {
          final updated = item.clone();
          if (item.children.isNotEmpty) {
            updated.children = helper(item.children);
          }
          res.add(updated);
        }
      }
      return res;
    }

    return {'tree': helper(nodes), 'newNodeId': newNode.id};
  }

  /// 删除指定节点集合 (Ctrl+Delete / Backspace 空节点)
  static Map<String, dynamic> deleteNodes(
    List<OutlineNode> nodes,
    Set<String> idsToDelete,
  ) {
    final visibleBefore = flattenVisibleNodes(nodes);
    String? fallbackFocusId;

    for (int i = 0; i < visibleBefore.length; i++) {
      if (idsToDelete.contains(visibleBefore[i].node.id)) {
        // 优先定位后一个可见节点，否则定位前一个
        for (int j = i + 1; j < visibleBefore.length; j++) {
          if (!idsToDelete.contains(visibleBefore[j].node.id)) {
            fallbackFocusId = visibleBefore[j].node.id;
            break;
          }
        }
        if (fallbackFocusId == null) {
          for (int j = i - 1; j >= 0; j--) {
            if (!idsToDelete.contains(visibleBefore[j].node.id)) {
              fallbackFocusId = visibleBefore[j].node.id;
              break;
            }
          }
        }
        break;
      }
    }

    List<OutlineNode> filterTree(List<OutlineNode> list) {
      return list
          .where((item) => !idsToDelete.contains(item.id))
          .map((item) {
            final updated = item.clone();
            updated.children = filterTree(item.children);
            return updated;
          })
          .toList();
    }

    var nextTree = filterTree(nodes);
    if (nextTree.isEmpty) {
      final empty = createEmptyNode();
      nextTree = [empty];
      fallbackFocusId = empty.id;
    }

    return {'tree': nextTree, 'nextFocusId': fallbackFocusId};
  }

  /// 向上移动节点 (Ctrl+Up)
  static List<OutlineNode> moveNodeUp(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      final idx = list.indexWhere((item) => item.id == targetId);
      if (idx > 0) {
        final next = list.map((e) => e.clone()).toList();
        final temp = next[idx - 1];
        next[idx - 1] = next[idx];
        next[idx] = temp;
        return next;
      }
      return list.map((item) {
        final updated = item.clone();
        if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 向下移动节点 (Ctrl+Down)
  static List<OutlineNode> moveNodeDown(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      final idx = list.indexWhere((item) => item.id == targetId);
      if (idx != -1 && idx < list.length - 1) {
        final next = list.map((e) => e.clone()).toList();
        final temp = next[idx + 1];
        next[idx + 1] = next[idx];
        next[idx] = temp;
        return next;
      }
      return list.map((item) {
        final updated = item.clone();
        if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 向右降级节点：成为上一个同级节点的最后一个子节点 (Tab / Ctrl+Right)
  static List<OutlineNode> indentNode(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      final idx = list.indexWhere((item) => item.id == targetId);
      if (idx > 0) {
        final target = list[idx].clone();
        final prev = list[idx - 1].clone();
        prev.collapsed = false;
        prev.children.add(target);

        final next = list.map((e) => e.clone()).toList();
        next.removeAt(idx);
        next[idx - 1] = prev;
        return next;
      }
      return list.map((item) {
        final updated = item.clone();
        if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 向左升级节点：提升为父节点的下一个同级节点 (Shift+Tab / Ctrl+Left)
  static List<OutlineNode> outdentNode(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      final res = <OutlineNode>[];
      for (final item in list) {
        final childIdx = item.children.indexWhere((c) => c.id == targetId);
        if (childIdx != -1) {
          final target = item.children[childIdx].clone();
          final updatedParent = item.clone();
          updatedParent.children = item.children
              .where((c) => c.id != targetId)
              .map((c) => c.clone())
              .toList();

          res.add(updatedParent);
          res.add(target);
        } else {
          final updated = item.clone();
          if (item.children.isNotEmpty) {
            updated.children = helper(item.children);
          }
          res.add(updated);
        }
      }
      return res;
    }

    return helper(nodes);
  }

  /// 循环切换块宽模式：narrow -> wide -> shrink -> narrow (Ctrl+U)
  static List<OutlineNode> cycleBlockWidth(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      return list.map((item) {
        final updated = item.clone();
        if (item.id == targetId) {
          switch (item.blockWidth) {
            case BlockWidthMode.narrow:
              updated.blockWidth = BlockWidthMode.wide;
              break;
            case BlockWidthMode.wide:
              updated.blockWidth = BlockWidthMode.shrink;
              break;
            case BlockWidthMode.shrink:
              updated.blockWidth = BlockWidthMode.narrow;
              break;
          }
        } else if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 循环切换 7 种图标 (Ctrl+= / Ctrl+-)
  static List<OutlineNode> cycleNodeIcon(List<OutlineNode> nodes, String targetId, [int dir = 1]) {
    final icons = NodeIconType.values;

    List<OutlineNode> helper(List<OutlineNode> list) {
      return list.map((item) {
        final updated = item.clone();
        if (item.id == targetId) {
          final curIdx = icons.indexOf(item.icon);
          final nextIdx = (curIdx + dir + icons.length) % icons.length;
          updated.icon = icons[nextIdx];
        } else if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 切换粗体状态 (Ctrl+B)
  static List<OutlineNode> toggleBold(List<OutlineNode> nodes, String targetId) {
    List<OutlineNode> helper(List<OutlineNode> list) {
      return list.map((item) {
        final updated = item.clone();
        if (item.id == targetId) {
          updated.isBold = !item.isBold;
        } else if (item.children.isNotEmpty) {
          updated.children = helper(item.children);
        }
        return updated;
      }).toList();
    }

    return helper(nodes);
  }

  /// 全局展开或折叠所有分支
  static List<OutlineNode> setAllCollapsed(List<OutlineNode> nodes, bool collapsed) {
    return nodes.map((n) {
      final updated = n.clone();
      if (n.children.isNotEmpty) {
        updated.collapsed = collapsed;
        updated.children = setAllCollapsed(n.children, collapsed);
      }
      return updated;
    }).toList();
  }
}
