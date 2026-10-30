import 'outline_node.dart';

/// 单个文档标签页状态
class DocTab {
  final String id;
  String title;
  String? filePath;
  List<OutlineNode> nodes;
  String? focusedId;
  List<String> selectedIds;
  bool isDirty;
  List<List<OutlineNode>> undoStack;
  List<List<OutlineNode>> redoStack;

  DocTab({
    required this.id,
    required this.title,
    this.filePath,
    required this.nodes,
    this.focusedId,
    List<String>? selectedIds,
    this.isDirty = false,
    List<List<OutlineNode>>? undoStack,
    List<List<OutlineNode>>? redoStack,
  })  : selectedIds = selectedIds ?? [],
        undoStack = undoStack ?? [],
        redoStack = redoStack ?? [];

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'filePath': filePath,
      'nodes': nodes.map((n) => n.toJson()).toList(),
      'focusedId': focusedId,
      'selectedIds': selectedIds,
      'isDirty': isDirty,
    };
  }

  factory DocTab.fromJson(Map<String, dynamic> json) {
    return DocTab(
      id: json['id'] as String,
      title: json['title'] as String? ?? '未命名笔记.md',
      filePath: json['filePath'] as String?,
      nodes: (json['nodes'] as List<dynamic>?)
              ?.map((e) => OutlineNode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      focusedId: json['focusedId'] as String?,
      selectedIds: (json['selectedIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      isDirty: json['isDirty'] as bool? ?? false,
    );
  }
}
