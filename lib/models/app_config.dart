/// 桌面原生窗口停靠模式与边缘方向
enum WindowDockMode {
  normal,
  docked,
  autoHide,
}

enum WindowDockEdge {
  right,
  top,
  left,
}

/// 全局视图与外观配置
class AppConfig {
  String theme; // 'classic' | 'modern-light' | 'modern-dark'
  bool showAllBranches;
  bool closedBlockCard;
  double narrowWidth;
  double wideWidth;
  double indentSize;
  double fontSize;
  WindowDockMode dockMode;
  WindowDockEdge dockEdge;
  bool alwaysOnTop;
  bool showToolbar;
  bool showBottomBar;
  bool showStatusBar;

  AppConfig({
    this.theme = 'classic',
    this.showAllBranches = true,
    this.closedBlockCard = true,
    this.narrowWidth = 320.0,
    this.wideWidth = 640.0,
    this.indentSize = 24.0,
    this.fontSize = 13.5,
    this.dockMode = WindowDockMode.normal,
    this.dockEdge = WindowDockEdge.right,
    this.alwaysOnTop = false,
    this.showToolbar = false,
    this.showBottomBar = false,
    this.showStatusBar = false,
  });

  Map<String, dynamic> toJson() {
    return {
      'theme': theme,
      'showAllBranches': showAllBranches,
      'closedBlockCard': closedBlockCard,
      'narrowWidth': narrowWidth,
      'wideWidth': wideWidth,
      'indentSize': indentSize,
      'fontSize': fontSize,
      'dockMode': dockMode.name,
      'dockEdge': dockEdge.name,
      'alwaysOnTop': alwaysOnTop,
      'showToolbar': showToolbar,
      'showBottomBar': showBottomBar,
      'showStatusBar': showStatusBar,
    };
  }

  factory AppConfig.fromJson(Map<String, dynamic> json) {
    return AppConfig(
      theme: json['theme'] as String? ?? 'classic',
      showAllBranches: json['showAllBranches'] as bool? ?? true,
      closedBlockCard: json['closedBlockCard'] as bool? ?? true,
      narrowWidth: (json['narrowWidth'] as num?)?.toDouble() ?? 320.0,
      wideWidth: (json['wideWidth'] as num?)?.toDouble() ?? 640.0,
      indentSize: (json['indentSize'] as num?)?.toDouble() ?? 24.0,
      fontSize: (json['fontSize'] as num?)?.toDouble() ?? 13.5,
      dockMode: WindowDockMode.values.firstWhere(
        (e) => e.name == json['dockMode'],
        orElse: () => WindowDockMode.normal,
      ),
      dockEdge: WindowDockEdge.values.firstWhere(
        (e) => e.name == json['dockEdge'],
        orElse: () => WindowDockEdge.right,
      ),
      alwaysOnTop: json['alwaysOnTop'] as bool? ?? false,
      showToolbar: json['showToolbar'] as bool? ?? false,
      showBottomBar: json['showBottomBar'] as bool? ?? false,
      showStatusBar: json['showStatusBar'] as bool? ?? false,
    );
  }
}
