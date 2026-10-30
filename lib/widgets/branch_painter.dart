import 'package:flutter/material.dart';

/// 纯原生 GPU Canvas 自绘树枝折线连接器
/// 绘制经典的无多余悬垂 └─ 直角正交连接线
class BranchPainter extends CustomPainter {
  final Offset parentAnchor;
  final List<Offset> childrenAnchors;
  final Color branchColor;
  final double strokeWidth;

  BranchPainter({
    required this.parentAnchor,
    required this.childrenAnchors,
    this.branchColor = const Color(0xFFB0B9C6),
    this.strokeWidth = 1.25,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (childrenAnchors.isEmpty) return;

    final paint = Paint()
      ..color = branchColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    final double startX = parentAnchor.dx;
    final double startY = parentAnchor.dy;
    final double branchTrunkX = startX + 12.0;

    // 1. 父节点向右引出短横线到主干
    canvas.drawLine(
      Offset(startX, startY),
      Offset(branchTrunkX, startY),
      paint,
    );

    final double lastChildY = childrenAnchors.last.dy;

    // 2. 主干垂直向下贯穿所有子节点
    canvas.drawLine(
      Offset(branchTrunkX, startY),
      Offset(branchTrunkX, lastChildY),
      paint,
    );

    // 3. 从垂直主干向每个子节点水平横向引出折线 (└─)
    for (final childPos in childrenAnchors) {
      canvas.drawLine(
        Offset(branchTrunkX, childPos.dy),
        Offset(childPos.dx, childPos.dy),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant BranchPainter oldDelegate) {
    return oldDelegate.parentAnchor != parentAnchor ||
        oldDelegate.childrenAnchors != childrenAnchors ||
        oldDelegate.branchColor != branchColor ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
