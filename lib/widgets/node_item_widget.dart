import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/outline_node.dart';
import '../models/app_config.dart';

/// 单个文字块自绘组件（全键盘交互、移动端触屏手势、长按抽屉、三态三宽模式与角标）
class NodeItemWidget extends StatefulWidget {
  final OutlineNode node;
  final bool isFocused;
  final bool isSelected;
  final AppConfig config;
  final ValueChanged<String> onContentChanged;
  final VoidCallback onFocus;
  final VoidCallback onSelect;
  final VoidCallback onToggleCollapse;
  final VoidCallback onCycleWidth;
  final ValueChanged<int> onCycleIcon;
  final VoidCallback onToggleBold;
  final VoidCallback onInsertSiblingAfter;
  final VoidCallback onInsertSiblingBefore;
  final VoidCallback onInsertChild;
  final ValueChanged<int> onSplitAtCursor;
  final VoidCallback onDelete;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final VoidCallback onIndent;
  final VoidCallback onOutdent;
  final ValueChanged<int> onNavigateVertical;

  const NodeItemWidget({
    super.key,
    required this.node,
    required this.isFocused,
    required this.isSelected,
    required this.config,
    required this.onContentChanged,
    required this.onFocus,
    required this.onSelect,
    required this.onToggleCollapse,
    required this.onCycleWidth,
    required this.onCycleIcon,
    required this.onToggleBold,
    required this.onInsertSiblingAfter,
    required this.onInsertSiblingBefore,
    required this.onInsertChild,
    required this.onSplitAtCursor,
    required this.onDelete,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onIndent,
    required this.onOutdent,
    required this.onNavigateVertical,
  });

  @override
  State<NodeItemWidget> createState() => _NodeItemWidgetState();
}

class _NodeItemWidgetState extends State<NodeItemWidget> {
  late TextEditingController _controller;
  late FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.node.content);
    _focusNode = FocusNode();
    if (widget.isFocused) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focusNode.requestFocus();
      });
    }
  }

  @override
  void didUpdateWidget(covariant NodeItemWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.node.content != widget.node.content &&
        _controller.text != widget.node.content) {
      _controller.text = widget.node.content;
    }
    if (widget.isFocused && !oldWidget.isFocused) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _focusNode.requestFocus();
          _controller.selection = TextSelection.fromPosition(
            TextPosition(offset: _controller.text.length),
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  double _getBlockWidth() {
    switch (widget.node.blockWidth) {
      case BlockWidthMode.wide:
        return widget.config.wideWidth;
      case BlockWidthMode.shrink:
        return 180.0;
      case BlockWidthMode.narrow:
      default:
        return widget.config.narrowWidth;
    }
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final isCtrl = HardwareKeyboard.instance.isControlPressed || HardwareKeyboard.instance.isMetaPressed;
    final isShift = HardwareKeyboard.instance.isShiftPressed;
    final isAlt = HardwareKeyboard.instance.isAltPressed;
    final key = event.logicalKey;

    // 1. Ctrl + Enter: 下方新建同级文字块
    if (isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.enter) {
      widget.onInsertSiblingAfter();
      return KeyEventResult.handled;
    }

    // 2. Alt + Enter: 上方新建同级文字块
    if (isAlt && !isCtrl && !isShift && key == LogicalKeyboardKey.enter) {
      widget.onInsertSiblingBefore();
      return KeyEventResult.handled;
    }

    // 3. Shift + Enter: 新建子文字块
    if (isShift && !isCtrl && !isAlt && key == LogicalKeyboardKey.enter) {
      widget.onInsertChild();
      return KeyEventResult.handled;
    }

    // 4. Tab (无 shift): 向右降级 (成为上一同级的子节点)
    if (!isShift && !isCtrl && !isAlt && key == LogicalKeyboardKey.tab) {
      widget.onIndent();
      return KeyEventResult.handled;
    }

    // 5. Shift + Tab: 向左升级
    if (isShift && !isCtrl && !isAlt && key == LogicalKeyboardKey.tab) {
      widget.onOutdent();
      return KeyEventResult.handled;
    }

    // 6. Ctrl + Up: 向上移动节点
    if (isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.arrowUp) {
      widget.onMoveUp();
      return KeyEventResult.handled;
    }

    // 7. Ctrl + Down: 向下移动节点
    if (isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.arrowDown) {
      widget.onMoveDown();
      return KeyEventResult.handled;
    }

    // 8. Ctrl + B: 切换粗体
    if (isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.keyB) {
      widget.onToggleBold();
      return KeyEventResult.handled;
    }

    // 9. Ctrl + U: 切换宽度
    if (isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.keyU) {
      widget.onCycleWidth();
      return KeyEventResult.handled;
    }

    // 10. Ctrl + = / Ctrl + -: 切换图标
    if (isCtrl && (key == LogicalKeyboardKey.equal || key == LogicalKeyboardKey.numpadAdd)) {
      widget.onCycleIcon(1);
      return KeyEventResult.handled;
    }
    if (isCtrl && (key == LogicalKeyboardKey.minus || key == LogicalKeyboardKey.numpadSubtract)) {
      widget.onCycleIcon(-1);
      return KeyEventResult.handled;
    }

    // 11. Ctrl + \ : 光标处切分
    if (isCtrl && (key == LogicalKeyboardKey.backslash)) {
      final offset = _controller.selection.baseOffset;
      widget.onSplitAtCursor(offset >= 0 ? offset : _controller.text.length);
      return KeyEventResult.handled;
    }

    // 12. Ctrl + Delete: 删除文字块
    if (isCtrl && key == LogicalKeyboardKey.delete) {
      widget.onDelete();
      return KeyEventResult.handled;
    }

    // 13. Backspace: 当内容为空时按退格直接删除
    if (key == LogicalKeyboardKey.backspace && _controller.text.isEmpty) {
      widget.onDelete();
      return KeyEventResult.handled;
    }

    // 14. 方向键上下导航
    if (!isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.arrowUp) {
      if (_controller.selection.baseOffset <= 0) {
        widget.onNavigateVertical(-1);
        return KeyEventResult.handled;
      }
    }
    if (!isCtrl && !isAlt && !isShift && key == LogicalKeyboardKey.arrowDown) {
      if (_controller.selection.baseOffset >= _controller.text.length) {
        widget.onNavigateVertical(1);
        return KeyEventResult.handled;
      }
    }

    return KeyEventResult.ignored;
  }

  /// 桌面端鼠标右键菜单
  void _showContextMenu(BuildContext context, Offset globalPos) {
    showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(globalPos.dx, globalPos.dy, globalPos.dx + 1, globalPos.dy + 1),
      items: [
        const PopupMenuItem(value: 'child', child: Text('新建子文字块 (Shift+Enter)')),
        const PopupMenuItem(value: 'sibling', child: Text('新建同级文字块 (Ctrl+Enter)')),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'width', child: Text('循环切换宽度 (Ctrl+U)')),
        PopupMenuItem(
          value: 'bold',
          child: Text('${widget.node.isBold ? '✓ ' : ''}粗体文字 (Ctrl+B)'),
        ),
        const PopupMenuItem(value: 'icon', child: Text('循环切换图标 (Ctrl+=)')),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'indent', child: Text('向右降级 (Tab)')),
        const PopupMenuItem(value: 'outdent', child: Text('向左升级 (Shift+Tab)')),
        const PopupMenuItem(value: 'moveUp', child: Text('向上移动 (Ctrl+Up)')),
        const PopupMenuItem(value: 'moveDown', child: Text('向下移动 (Ctrl+Down)')),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'delete',
          child: Text('删除文字块 (Ctrl+Delete)', style: TextStyle(color: Colors.red)),
        ),
      ],
    ).then((val) {
      if (val != null) _dispatchAction(val);
    });
  }

  /// 移动端专属触屏长按操作面板 (Bottom Sheet)
  void _showMobileActionSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    widget.onFocus();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final title = widget.node.content.trim().isEmpty
            ? '空白文字块'
            : (widget.node.content.length > 20
                ? '${widget.node.content.substring(0, 20)}...'
                : widget.node.content);

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 12,
                  runSpacing: 10,
                  children: [
                    _buildSheetBtn(
                      icon: Icons.add_circle_outline,
                      label: '新建同级',
                      color: const Color(0xFF2563EB),
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onInsertSiblingAfter();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.subdirectory_arrow_right,
                      label: '新建子级',
                      color: const Color(0xFF2563EB),
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onInsertChild();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.format_indent_increase,
                      label: '向右降级',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onIndent();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.format_indent_decrease,
                      label: '向左升级',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onOutdent();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.arrow_upward,
                      label: '向上移动',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onMoveUp();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.arrow_downward,
                      label: '向下移动',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onMoveDown();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.format_bold,
                      label: '粗体切换',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onToggleBold();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.view_column_outlined,
                      label: '宽度切换',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onCycleWidth();
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.flag_outlined,
                      label: '循环图标',
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onCycleIcon(1);
                      },
                    ),
                    _buildSheetBtn(
                      icon: Icons.delete_outline,
                      label: '删除文字块',
                      color: const Color(0xFFEF4444),
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.onDelete();
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSheetBtn({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) {
    return InkWell(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 76,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 22, color: color ?? const Color(0xFF334155)),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color ?? const Color(0xFF475569),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _dispatchAction(String val) {
    switch (val) {
      case 'child':
        widget.onInsertChild();
        break;
      case 'sibling':
        widget.onInsertSiblingAfter();
        break;
      case 'width':
        widget.onCycleWidth();
        break;
      case 'bold':
        widget.onToggleBold();
        break;
      case 'icon':
        widget.onCycleIcon(1);
        break;
      case 'indent':
        widget.onIndent();
        break;
      case 'outdent':
        widget.onOutdent();
        break;
      case 'moveUp':
        widget.onMoveUp();
        break;
      case 'moveDown':
        widget.onMoveDown();
        break;
      case 'delete':
        widget.onDelete();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final blockW = _getBlockWidth();
    final hasChildren = widget.node.children.isNotEmpty;

    // 边框和背景色
    Color borderColor;
    Color bgColor;
    double borderWidth = 1.0;

    if (widget.isFocused) {
      borderColor = const Color(0xFF2563EB); // 实线高亮蓝
      borderWidth = 1.8;
      bgColor = widget.node.bgColor ?? Colors.white;
    } else if (widget.isSelected) {
      borderColor = const Color(0xFF3B82F6);
      bgColor = widget.node.bgColor ?? const Color(0xFFEFF6FF);
    } else {
      borderColor = widget.config.closedBlockCard
          ? const Color(0xFFE2E8F0)
          : Colors.transparent;
      bgColor = widget.node.bgColor ?? Colors.white;
    }

    return GestureDetector(
      // 桌面端鼠标右键菜单
      onSecondaryTapDown: (details) => _showContextMenu(context, details.globalPosition),
      // 触屏移动端长按呼出大底栏抽屉
      onLongPress: () => _showMobileActionSheet(context),
      // 触屏轻扫手势：向右轻扫降级，向左轻扫升级
      onHorizontalDragEnd: !widget.isFocused
          ? (details) {
              final vx = details.primaryVelocity ?? 0;
              if (vx > 250) {
                // 向右滑 -> 降级
                HapticFeedback.lightImpact();
                widget.onIndent();
              } else if (vx < -250) {
                // 向左滑 -> 升级
                HapticFeedback.lightImpact();
                widget.onOutdent();
              }
            }
          : null,
      child: Container(
        width: blockW,
        margin: const EdgeInsets.symmetric(vertical: 4.0),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(6.0),
          border: Border.all(color: borderColor, width: borderWidth),
          boxShadow: widget.isFocused || widget.isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 5,
                    offset: const Offset(0, 1.5),
                  )
                ]
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. 折叠/展开小方块 [+] / [-]（拥有 32x32 大触控面积，防误触）
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                HapticFeedback.selectionClick();
                widget.onToggleCollapse();
              },
              child: Container(
                width: 30,
                height: 32,
                alignment: Alignment.center,
                child: hasChildren
                    ? Container(
                        width: 13,
                        height: 13,
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFF94A3B8), width: 1.2),
                          borderRadius: BorderRadius.circular(2.5),
                          color: Colors.white,
                        ),
                        child: Icon(
                          widget.node.collapsed ? Icons.add : Icons.remove,
                          size: 11,
                          color: const Color(0xFF334155),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),

            // 2. 7 种经典矢量图标指示器
            if (widget.node.icon != NodeIconType.none)
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  widget.onCycleIcon(1);
                },
                child: Container(
                  padding: const EdgeInsets.only(top: 8, right: 4),
                  child: _buildVectorIcon(widget.node.icon),
                ),
              ),

            // 3. 文本内容区（非编辑态时用自然折行的 Text，编辑态时用 TextField，绝无排版重叠）
            Expanded(
              child: !widget.isFocused
                  ? GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: widget.onFocus,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                        child: Text(
                          widget.node.blockWidth == BlockWidthMode.shrink
                              ? widget.node.content.replaceAll('\n', ' ')
                              : (widget.node.content.isEmpty ? ' ' : widget.node.content),
                          maxLines: widget.node.blockWidth == BlockWidthMode.shrink ? 1 : null,
                          overflow: widget.node.blockWidth == BlockWidthMode.shrink ? TextOverflow.ellipsis : null,
                          style: TextStyle(
                            fontSize: widget.config.fontSize,
                            fontWeight: widget.node.isBold ? FontWeight.bold : FontWeight.normal,
                            color: widget.node.textColor ?? const Color(0xFF1E293B),
                            height: 1.4,
                          ),
                        ),
                      ),
                    )
                  : Focus(
                      onKeyEvent: _handleKeyEvent,
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        maxLines: null,
                        style: TextStyle(
                          fontSize: widget.config.fontSize,
                          fontWeight: widget.node.isBold ? FontWeight.bold : FontWeight.normal,
                          color: widget.node.textColor ?? const Color(0xFF1E293B),
                          height: 1.4,
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                          border: InputBorder.none,
                          hintText: Platform.isAndroid || Platform.isIOS
                              ? '输入笔记内容... (下方工具条可快速组织)'
                              : '输入笔记内容... (Ctrl+Enter 同级, Shift+Enter 子级)',
                          hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                        ),
                        onChanged: widget.onContentChanged,
                        onTap: widget.onFocus,
                      ),
                    ),
            ),

            // 4. 折叠时显示的子节点数量小角标
            if (hasChildren && widget.node.collapsed)
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  widget.onToggleCollapse();
                },
                child: Container(
                  margin: const EdgeInsets.only(top: 6, right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${widget.node.children.length}',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF475569),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVectorIcon(NodeIconType icon) {
    switch (icon) {
      case NodeIconType.flag:
        return const Icon(Icons.flag, size: 14, color: Color(0xFFEF4444));
      case NodeIconType.tick:
        return const Icon(Icons.check_circle, size: 14, color: Color(0xFF10B981));
      case NodeIconType.cross:
        return const Icon(Icons.cancel, size: 14, color: Color(0xFFDC2626));
      case NodeIconType.star:
        return const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B));
      case NodeIconType.question:
        return const Icon(Icons.help, size: 14, color: Color(0xFF6366F1));
      case NodeIconType.warning:
        return const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFF97316));
      case NodeIconType.idea:
        return const Icon(Icons.lightbulb_outline, size: 14, color: Color(0xFFEAB308));
      case NodeIconType.none:
      default:
        return const SizedBox.shrink();
    }
  }
}
