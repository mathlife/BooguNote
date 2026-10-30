import 'package:flutter/material.dart';
import '../models/outline_node.dart';
import '../models/app_config.dart';

/// 单个文字块自绘组件（支持三态与三宽模式）
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
  final VoidCallback onCycleIcon;
  final VoidCallback onInsertSibling;
  final VoidCallback onInsertChild;
  final VoidCallback onDelete;

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
    required this.onInsertSibling,
    required this.onInsertChild,
    required this.onDelete,
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
        _focusNode.requestFocus();
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
      _focusNode.requestFocus();
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

  @override
  Widget build(BuildContext context) {
    final blockW = _getBlockWidth();
    final hasChildren = widget.node.children.isNotEmpty;

    // 焦点态/选择态/未选择态边框与底色
    Color borderColor;
    Color bgColor;
    double borderWidth = 1.0;

    if (widget.isFocused) {
      borderColor = const Color(0xFF2563EB); // 实线高亮蓝
      borderWidth = 1.6;
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

    return Container(
      width: blockW,
      margin: const EdgeInsets.symmetric(vertical: 3.0),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(5.0),
        border: Border.all(color: borderColor, width: borderWidth),
        boxShadow: widget.isFocused || widget.isSelected
            ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                )
              ]
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. 折叠/展开小方块 [+] / [-]
          GestureDetector(
            onTap: widget.onToggleCollapse,
            child: Container(
              width: 18,
              height: 24,
              alignment: Alignment.center,
              child: hasChildren
                  ? Container(
                      width: 11,
                      height: 11,
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFF94A3B8)),
                        borderRadius: BorderRadius.circular(2),
                        color: Colors.white,
                      ),
                      child: Icon(
                        widget.node.collapsed ? Icons.add : Icons.remove,
                        size: 9,
                        color: const Color(0xFF475569),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),

          // 2. 经典 7 种矢量图标指示器
          if (widget.node.icon != NodeIconType.none)
            GestureDetector(
              onTap: widget.onCycleIcon,
              child: Container(
                padding: const EdgeInsets.only(top: 4, right: 4),
                child: _buildVectorIcon(widget.node.icon),
              ),
            ),

          // 3. 文本输入核心区
          Expanded(
            child: widget.node.blockWidth == BlockWidthMode.shrink
                ? GestureDetector(
                    onTap: widget.onFocus,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                      child: Text(
                        widget.node.content.replaceAll('\n', ' '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: widget.config.fontSize,
                          fontWeight: widget.node.isBold ? FontWeight.bold : FontWeight.normal,
                          color: widget.node.textColor ?? const Color(0xFF1E293B),
                        ),
                      ),
                    ),
                  )
                : TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    maxLines: null,
                    style: TextStyle(
                      fontSize: widget.config.fontSize,
                      fontWeight: widget.node.isBold ? FontWeight.bold : FontWeight.normal,
                      color: widget.node.textColor ?? const Color(0xFF1E293B),
                      height: 1.35,
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                      border: InputBorder.none,
                    ),
                    onChanged: widget.onContentChanged,
                    onTap: widget.onFocus,
                  ),
          ),
        ],
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
        return const Icon(Icons.warning, size: 14, color: Color(0xFFF97316));
      case NodeIconType.idea:
        return const Icon(Icons.lightbulb, size: 14, color: Color(0xFFEAB308));
      case NodeIconType.none:
      default:
        return const SizedBox.shrink();
    }
  }
}
