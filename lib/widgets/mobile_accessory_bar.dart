import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// 移动端/触屏专属键盘辅助操作栏
/// 紧贴在软键盘上方或屏幕底部，大拇指单手触控操作大纲树
class MobileAccessoryBar extends StatelessWidget {
  final bool hasActiveNode;
  final VoidCallback onInsertSiblingAfter;
  final VoidCallback onInsertChild;
  final VoidCallback onIndent;
  final VoidCallback onOutdent;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final VoidCallback onToggleBold;
  final VoidCallback onCycleWidth;
  final VoidCallback onCycleIcon;
  final VoidCallback onDelete;
  final VoidCallback onDismissKeyboard;

  const MobileAccessoryBar({
    super.key,
    required this.hasActiveNode,
    required this.onInsertSiblingAfter,
    required this.onInsertChild,
    required this.onIndent,
    required this.onOutdent,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onToggleBold,
    required this.onCycleWidth,
    required this.onCycleIcon,
    required this.onDelete,
    required this.onDismissKeyboard,
  });

  Widget _buildItem({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    Color? color,
  }) {
    final isEnabled = hasActiveNode && onTap != null;
    return InkWell(
      onTap: isEnabled
          ? () {
              HapticFeedback.lightImpact();
              onTap();
            }
          : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 19,
              color: isEnabled ? (color ?? const Color(0xFF1E293B)) : const Color(0xFFCBD5E1),
            ),
            const SizedBox(height: 1),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: isEnabled ? (color ?? const Color(0xFF475569)) : const Color(0xFFCBD5E1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              children: [
                _buildItem(
                  icon: Icons.add_circle_outline,
                  label: '同级',
                  color: const Color(0xFF2563EB),
                  onTap: onInsertSiblingAfter,
                ),
                _buildItem(
                  icon: Icons.subdirectory_arrow_right,
                  label: '子级',
                  color: const Color(0xFF2563EB),
                  onTap: onInsertChild,
                ),
                const VerticalDivider(width: 12, indent: 10, endIndent: 10, color: Color(0xFFE2E8F0)),
                _buildItem(
                  icon: Icons.format_indent_increase,
                  label: '降级',
                  onTap: onIndent,
                ),
                _buildItem(
                  icon: Icons.format_indent_decrease,
                  label: '升级',
                  onTap: onOutdent,
                ),
                const VerticalDivider(width: 12, indent: 10, endIndent: 10, color: Color(0xFFE2E8F0)),
                _buildItem(
                  icon: Icons.arrow_upward,
                  label: '上移',
                  onTap: onMoveUp,
                ),
                _buildItem(
                  icon: Icons.arrow_downward,
                  label: '下移',
                  onTap: onMoveDown,
                ),
                const VerticalDivider(width: 12, indent: 10, endIndent: 10, color: Color(0xFFE2E8F0)),
                _buildItem(
                  icon: Icons.format_bold,
                  label: '粗体',
                  onTap: onToggleBold,
                ),
                _buildItem(
                  icon: Icons.view_column_outlined,
                  label: '宽度',
                  onTap: onCycleWidth,
                ),
                _buildItem(
                  icon: Icons.flag_outlined,
                  label: '图标',
                  onTap: onCycleIcon,
                ),
                _buildItem(
                  icon: Icons.delete_outline,
                  label: '删除',
                  color: const Color(0xFFEF4444),
                  onTap: onDelete,
                ),
              ],
            ),
          ),
          // 收起软键盘快捷键
          Container(
            decoration: const BoxDecoration(
              border: Border(left: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: IconButton(
              icon: const Icon(Icons.keyboard_hide_outlined, size: 20, color: Color(0xFF64748B)),
              tooltip: '收起键盘',
              onPressed: () {
                HapticFeedback.lightImpact();
                onDismissKeyboard();
              },
            ),
          ),
        ],
      ),
    );
  }
}
