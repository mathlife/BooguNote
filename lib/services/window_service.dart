import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:window_manager/window_manager.dart';
import 'package:hotkey_manager/hotkey_manager.dart';
import '../models/app_config.dart';

/// 桌面原生窗口管理服务（负责靠边停靠、自动隐藏细条与全局快捷键）
class WindowService {
  static const double defaultNarrowWidth = 400.0;
  static const double defaultNarrowHeight = 600.0;

  static Future<void> init() async {
    if (!Platform.isWindows && !Platform.isMacOS && !Platform.isLinux) return;

    await windowManager.ensureInitialized();
    await hotKeyManager.unregisterAll();

    WindowOptions windowOptions = const WindowOptions(
      size: Size(defaultNarrowWidth, defaultNarrowHeight),
      minimumSize: Size(280, 360),
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
  }

  static void _registerGlobalHotkeys() {
    // 1. Win+O / Cmd+O: 靠边窗口
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

    // 2. Win+H / Cmd+H: 隐藏/显示窗口
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

  static Future<void> toggleDocked() async {
    final bounds = await windowManager.getBounds();
    // 贴合屏幕右边缘并调整为窄框
    await windowManager.setBounds(Rect.fromLTWH(
      bounds.left,
      bounds.top,
      defaultNarrowWidth,
      bounds.height,
    ));
  }

  static Future<void> setAlwaysOnTop(bool top) async {
    if (!Platform.isWindows && !Platform.isMacOS && !Platform.isLinux) return;
    await windowManager.setAlwaysOnTop(top);
  }
}
