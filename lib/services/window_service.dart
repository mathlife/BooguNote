import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:window_manager/window_manager.dart';
import 'package:screen_retriever/screen_retriever.dart';
import 'package:hotkey_manager/hotkey_manager.dart';
import '../models/app_config.dart';

/// 桌面原生窗口管理服务（负责靠边贴边吸附、自动隐藏细条与全局快捷键）
class WindowService with WindowListener {
  static final WindowService instance = WindowService._();
  WindowService._();

  static const double defaultNarrowWidth = 380.0;
  static const double defaultNarrowHeight = 600.0;
  static const double peekWidth = 4.0; // 折叠时在屏幕边缘露出的感应细条宽度
  static const double snapThreshold = 30.0; // 拖动靠近边缘自动吸附的阈值 (px)

  static WindowDockMode dockMode = WindowDockMode.normal;
  static WindowDockEdge dockEdge = WindowDockEdge.right;
  static bool isCollapsed = false;
  static bool isAlwaysOnTop = false;

  static Rect normalBounds = const Rect.fromLTWH(100, 100, defaultNarrowWidth, defaultNarrowHeight);
  static Rect expandedBounds = const Rect.fromLTWH(100, 100, defaultNarrowWidth, defaultNarrowHeight);

  static Timer? _cursorMonitorTimer;
  static int _leaveWindowCounter = 0;
  static bool _isProgrammaticMove = false;

  static final ValueNotifier<WindowDockMode> dockModeNotifier = ValueNotifier(WindowDockMode.normal);
  static final ValueNotifier<bool> isCollapsedNotifier = ValueNotifier(false);
  static Function(String)? onToastCallback;

  static Future<void> init({Function(String)? onToast}) async {
    if (!Platform.isWindows && !Platform.isMacOS && !Platform.isLinux) return;

    onToastCallback = onToast;
    await windowManager.ensureInitialized();
    windowManager.addListener(instance);

    WindowOptions windowOptions = const WindowOptions(
      size: Size(defaultNarrowWidth, defaultNarrowHeight),
      minimumSize: Size(260, 320),
      center: true,
      backgroundColor: Colors.transparent,
      skipTaskbar: false,
      titleBarStyle: TitleBarStyle.normal,
      title: 'BooguNote Native',
    );

    await windowManager.waitUntilReadyToShow(windowOptions, () async {
      await windowManager.show();
      await windowManager.focus();
    });

    _registerGlobalHotkeys();
    _startCursorMonitor();
  }

  static void _registerGlobalHotkeys() {
    hotKeyManager.unregisterAll();

    // 1. 靠边停靠 (Win+O / Cmd+O)
    hotKeyManager.register(
      HotKey(
        key: PhysicalKeyboardKey.keyO,
        modifiers: [Platform.isMacOS ? HotKeyModifier.meta : HotKeyModifier.meta],
        scope: HotKeyScope.system,
      ),
      keyDownHandler: (hotKey) {
        toggleDocked();
      },
    );

    // 2. 靠边自动隐藏 (Shift+Win+O / Shift+Cmd+O)
    hotKeyManager.register(
      HotKey(
        key: PhysicalKeyboardKey.keyO,
        modifiers: [
          Platform.isMacOS ? HotKeyModifier.meta : HotKeyModifier.meta,
          HotKeyModifier.shift,
        ],
        scope: HotKeyScope.system,
      ),
      keyDownHandler: (hotKey) {
        toggleAutoHide();
      },
    );

    // 3. 老板键隐藏/呼出 (Win+H / Cmd+H)
    hotKeyManager.register(
      HotKey(
        key: PhysicalKeyboardKey.keyH,
        modifiers: [Platform.isMacOS ? HotKeyModifier.meta : HotKeyModifier.meta],
        scope: HotKeyScope.system,
      ),
      keyDownHandler: (hotKey) async {
        final isVisible = await windowManager.isVisible();
        if (isVisible) {
          await windowManager.hide();
        } else {
          await windowManager.show();
          await windowManager.focus();
        }
      },
    );
  }

  /// 获取当前显示器工作区 Rect (已扣除任务栏)
  static Future<Rect> getWorkArea([Rect? targetBounds]) async {
    try {
      final primary = await screenRetriever.getPrimaryDisplay();
      if (primary != null) {
        final pos = primary.visiblePosition ?? Offset.zero;
        final size = primary.visibleSize ?? primary.size;
        return Rect.fromLTWH(pos.dx, pos.dy, size.width, size.height);
      }
    } catch (_) {}
    return const Rect.fromLTWH(0, 0, 1920, 1080);
  }

  /// 切换靠边停靠模式 (Win+O)
  static Future<void> toggleDocked([WindowDockEdge? edge]) async {
    if (dockMode == WindowDockMode.docked) {
      await setNormalMode();
      onToastCallback?.call('已解除靠边停靠，恢复正常浮动窗口');
    } else {
      await setDockedMode(edge ?? dockEdge);
      onToastCallback?.call('已进入靠边停靠模式 (贴靠${_edgeName(dockEdge)})');
    }
  }

  /// 切换靠边自动隐藏模式 (Shift+Win+O)
  static Future<void> toggleAutoHide([WindowDockEdge? edge]) async {
    if (dockMode == WindowDockMode.autoHide) {
      await setNormalMode();
      onToastCallback?.call('已关闭自动隐藏，恢复正常浮动窗口');
    } else {
      await setAutoHideMode(edge ?? dockEdge);
      onToastCallback?.call('已开启靠边自动隐藏 (鼠标移出自动缩回${_edgeName(dockEdge)})');
    }
  }

  /// 进入靠边停靠模式 (Docked)
  static Future<void> setDockedMode(WindowDockEdge edge) async {
    dockMode = WindowDockMode.docked;
    dockEdge = edge;
    isCollapsed = false;
    dockModeNotifier.value = dockMode;
    isCollapsedNotifier.value = false;

    final wa = await getWorkArea();
    expandedBounds = _calcExpandedBounds(edge, wa);

    _isProgrammaticMove = true;
    await windowManager.setAlwaysOnTop(true);
    await windowManager.setBounds(expandedBounds);
    await windowManager.focus();
    Future.delayed(const Duration(milliseconds: 250), () => _isProgrammaticMove = false);
  }

  /// 进入靠边自动隐藏模式 (Auto-Hide)
  static Future<void> setAutoHideMode(WindowDockEdge edge) async {
    dockMode = WindowDockMode.autoHide;
    dockEdge = edge;
    isCollapsed = false;
    dockModeNotifier.value = dockMode;
    isCollapsedNotifier.value = false;

    final wa = await getWorkArea();
    expandedBounds = _calcExpandedBounds(edge, wa);

    _isProgrammaticMove = true;
    await windowManager.setAlwaysOnTop(true);
    await windowManager.setBounds(expandedBounds);
    await windowManager.focus();
    Future.delayed(const Duration(milliseconds: 250), () => _isProgrammaticMove = false);
  }

  /// 恢复正常自由浮动窗口模式 (Normal)
  static Future<void> setNormalMode() async {
    dockMode = WindowDockMode.normal;
    isCollapsed = false;
    dockModeNotifier.value = dockMode;
    isCollapsedNotifier.value = false;

    _isProgrammaticMove = true;
    await windowManager.setAlwaysOnTop(isAlwaysOnTop);
    await windowManager.setBounds(normalBounds);
    await windowManager.focus();
    Future.delayed(const Duration(milliseconds: 250), () => _isProgrammaticMove = false);
  }

  /// 展开已缩回边缘的窗口
  static Future<void> expandAutoHide() async {
    if (!isCollapsed) return;

    _isProgrammaticMove = true;
    await windowManager.setBounds(expandedBounds);
    await windowManager.focus();
    isCollapsed = false;
    isCollapsedNotifier.value = false;
    _leaveWindowCounter = 0;
    Future.delayed(const Duration(milliseconds: 250), () => _isProgrammaticMove = false);
  }

  /// 缩回边缘只露 4px 感应细条
  static Future<void> collapseAutoHide() async {
    if (isCollapsed || dockMode != WindowDockMode.autoHide) return;

    final wa = await getWorkArea();
    final collapsedBounds = _calcCollapsedBounds(dockEdge, expandedBounds, wa);

    _isProgrammaticMove = true;
    await windowManager.setBounds(collapsedBounds);
    isCollapsed = true;
    isCollapsedNotifier.value = true;
    Future.delayed(const Duration(milliseconds: 250), () => _isProgrammaticMove = false);
  }

  /// 计算靠边展开时的完整矩形
  static Rect _calcExpandedBounds(WindowDockEdge edge, Rect wa) {
    switch (edge) {
      case WindowDockEdge.right:
        return Rect.fromLTWH(
          wa.left + wa.width - defaultNarrowWidth,
          wa.top,
          defaultNarrowWidth,
          wa.height,
        );
      case WindowDockEdge.left:
        return Rect.fromLTWH(
          wa.left,
          wa.top,
          defaultNarrowWidth,
          wa.height,
        );
      case WindowDockEdge.top:
        return Rect.fromLTWH(
          wa.left + (wa.width - 600) / 2,
          wa.top,
          600,
          defaultNarrowHeight,
        );
    }
  }

  /// 计算缩回边缘时仅留 4px 的边界矩形
  static Rect _calcCollapsedBounds(WindowDockEdge edge, Rect exp, Rect wa) {
    switch (edge) {
      case WindowDockEdge.right:
        return Rect.fromLTWH(
          wa.left + wa.width - peekWidth,
          exp.top,
          exp.width,
          exp.height,
        );
      case WindowDockEdge.left:
        return Rect.fromLTWH(
          wa.left - exp.width + peekWidth,
          exp.top,
          exp.width,
          exp.height,
        );
      case WindowDockEdge.top:
        return Rect.fromLTWH(
          exp.left,
          wa.top - exp.height + peekWidth,
          exp.width,
          exp.height,
        );
    }
  }

  /// 启动高频鼠标位置监听器（用于边缘感应展开与移出自动折叠）
  static void _startCursorMonitor() {
    _cursorMonitorTimer?.cancel();
    _cursorMonitorTimer = Timer.periodic(const Duration(milliseconds: 160), (_) async {
      if (dockMode != WindowDockMode.autoHide || _isProgrammaticMove) return;

      try {
        final cursor = await screenRetriever.getCursorScreenPoint();
        final wa = await getWorkArea();

        if (isCollapsed) {
          // 检查鼠标是否划向隐藏边缘
          bool nearEdge = false;
          switch (dockEdge) {
            case WindowDockEdge.right:
              nearEdge = cursor.dx >= wa.right - 14 && cursor.dy >= wa.top && cursor.dy <= wa.bottom;
              break;
            case WindowDockEdge.left:
              nearEdge = cursor.dx <= wa.left + 14 && cursor.dy >= wa.top && cursor.dy <= wa.bottom;
              break;
            case WindowDockEdge.top:
              nearEdge = cursor.dy <= wa.top + 14 && cursor.dx >= wa.left && cursor.dx <= wa.right;
              break;
          }

          if (nearEdge) {
            await expandAutoHide();
          }
        } else {
          // 展开状态下：检查鼠标是否离开窗口范围
          final curBounds = await windowManager.getBounds();
          final hoverArea = curBounds.inflate(20);

          if (!hoverArea.contains(cursor)) {
            _leaveWindowCounter++;
            if (_leaveWindowCounter >= 3) {
              // 离开窗口超过 480ms，自动缩回边缘
              _leaveWindowCounter = 0;
              await collapseAutoHide();
            }
          } else {
            _leaveWindowCounter = 0;
          }
        }
      } catch (_) {}
    });
  }

  /// 窗口移动事件监听 (实现拖动贴靠边缘触发自动隐藏)
  @override
  void onWindowMove() async {
    if (_isProgrammaticMove || isCollapsed) return;

    final bounds = await windowManager.getBounds();
    final wa = await getWorkArea();

    // 1. 判断是否拖拽贴近屏幕边缘 (Snap 阈值)
    final nearRight = bounds.right >= wa.right - snapThreshold;
    final nearLeft = bounds.left <= wa.left + snapThreshold;
    final nearTop = bounds.top <= wa.top + snapThreshold;

    WindowDockEdge? detectedEdge;
    if (nearRight) {
      detectedEdge = WindowDockEdge.right;
    } else if (nearLeft) {
      detectedEdge = WindowDockEdge.left;
    } else if (nearTop) {
      detectedEdge = WindowDockEdge.top;
    }

    if (detectedEdge != null) {
      if (dockMode == WindowDockMode.normal) {
        // 自动贴边进入自动隐藏模式
        dockEdge = detectedEdge;
        await setAutoHideMode(detectedEdge);
        onToastCallback?.call('已靠边贴合，开启自动隐藏 (鼠标移出自动缩回)');
      }
    } else {
      // 拖回屏幕中央：如果原先是停靠/自动隐藏，解除停靠恢复正常窗口
      if (dockMode != WindowDockMode.normal) {
        dockMode = WindowDockMode.normal;
        dockModeNotifier.value = dockMode;
        await windowManager.setAlwaysOnTop(isAlwaysOnTop);
        onToastCallback?.call('已从边缘移出，恢复自由窗口');
      }
      normalBounds = bounds;
    }
  }

  static Future<void> setAlwaysOnTop(bool top) async {
    isAlwaysOnTop = top;
    if (!Platform.isWindows && !Platform.isMacOS && !Platform.isLinux) return;
    await windowManager.setAlwaysOnTop(top);
  }

  static String _edgeName(WindowDockEdge edge) {
    switch (edge) {
      case WindowDockEdge.right:
        return '屏幕右边缘';
      case WindowDockEdge.left:
        return '屏幕左边缘';
      case WindowDockEdge.top:
        return '屏幕顶部边缘';
    }
  }
}
