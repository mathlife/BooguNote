import 'package:flutter/material.dart';

/// 纯原生正交树枝折线连接器组件 (├─ 与 └─)
class BranchConnectorPainter extends CustomPainter {
  final bool isLast;
  final Color branchColor;
  final double strokeWidth;

  BranchConnectorPainter({
    required this.isLast,
    this.branchColor = const Color(0xFF94A3B8),
    this.strokeWidth = 1.25,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = branchColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.square;

    const double trunkX = 8.0;
    const double branchY = 18.0;

    // 1. 垂直主干线（末尾子节点只垂直画到折角 y=18，非末尾子节点则贯穿到底部与下一子节点相连）
    final double trunkBottom = isLast ? branchY : size.height;
    canvas.drawLine(
      const Offset(trunkX, 0),
      Offset(trunkX, trunkBottom),
      paint,
    );

    // 2. 水平正交引出折线 (├─ 或 └─) 直达子节点卡片
    canvas.drawLine(
      const Offset(trunkX, branchY),
      Offset(size.width, branchY),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant BranchConnectorPainter oldDelegate) {
    return oldDelegate.isLast != isLast ||
        oldDelegate.branchColor != branchColor ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
