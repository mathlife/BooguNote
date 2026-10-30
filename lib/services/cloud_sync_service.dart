import 'dart:convert';
import 'dart:io';
import '../models/cloud_sync_config.dart';
import '../models/doc_tab.dart';
import '../parsers/md_parser.dart';
import '../parsers/boo_parser.dart';

/// 纯原生多端无服务端云同步服务（支持 GitHub 私人仓库、GitHub Gist 与 WebDAV）
class CloudSyncService {
  static final HttpClient _httpClient = HttpClient()
    ..connectionTimeout = const Duration(seconds: 15);

  /// 执行推送到云端
  static Future<String> pushToCloud(CloudSyncConfig config, List<DocTab> tabs) async {
    if (config.provider == 'github-gist') {
      return _pushToGitHubGist(config, tabs);
    } else if (config.provider == 'webdav') {
      return _pushToWebDAV(config, tabs);
    } else {
      return _pushToGitHubRepo(config, tabs);
    }
  }

  /// 执行从云端拉取恢复
  static Future<Map<String, dynamic>> pullFromCloud(CloudSyncConfig config) async {
    if (config.provider == 'github-gist') {
      return _pullFromGitHubGist(config);
    } else if (config.provider == 'webdav') {
      return _pullFromWebDAV(config);
    } else {
      return _pullFromGitHubRepo(config);
    }
  }

  // --- 1. GitHub 私人仓库同步 ---
  static Future<String> _pushToGitHubRepo(CloudSyncConfig config, List<DocTab> tabs) async {
    final token = config.githubToken.trim();
    final repo = config.githubRepo.trim();
    final branch = config.githubBranch.trim().isEmpty ? 'main' : config.githubBranch.trim();
    final basePath = config.githubPath.trim();

    if (token.isEmpty || !repo.contains('/')) {
      throw '请填写有效的 GitHub 访问令牌 (Token) 与仓库名称（如 username/my-notes）';
    }

    int successCount = 0;
    for (final tab in tabs) {
      final fileName = _normalizeFileName(tab.title);
      final fullPath = basePath.isNotEmpty ? '$basePath/$fileName' : fileName;
      final encodedPath = Uri.encodeFull(fullPath);
      final url = Uri.parse('https://api.github.com/repos/$repo/contents/$encodedPath');

      // 1. 获取现有文件的 sha（如果已存在）
      String? existingSha;
      try {
        final getReq = await _httpClient.getUrl(Uri.parse('$url?ref=$branch'));
        _setGitHubHeaders(getReq, token);
        final getResp = await getReq.close();
        if (getResp.statusCode == 200) {
          final body = await utf8.decodeStream(getResp);
          final json = jsonDecode(body) as Map<String, dynamic>;
          existingSha = json['sha'] as String?;
        }
      } catch (_) {}

      // 2. 序列化笔记内容并提交
      final isBoo = fileName.toLowerCase().endsWith('.boo');
      final contentStr = isBoo ? BooParser.serialize(tab.nodes) : MdParser.serialize(tab.nodes);
      final base64Content = base64Encode(utf8.encode(contentStr));

      final putReq = await _httpClient.putUrl(url);
      _setGitHubHeaders(putReq, token);
      putReq.headers.contentType = ContentType.json;

      final payload = {
        'message': 'sync: 更新笔记 $fileName (via BooguNote Native)',
        'content': base64Content,
        'branch': branch,
        if (existingSha != null) 'sha': existingSha,
      };

      putReq.write(jsonEncode(payload));
      final putResp = await putReq.close();
      if (putResp.statusCode >= 200 && putResp.statusCode < 300) {
        successCount++;
      } else {
        final errBody = await utf8.decodeStream(putResp);
        throw '上传文件 $fileName 失败 (${putResp.statusCode}): $errBody';
      }
    }

    return '已成功将 $successCount 份笔记推送到 GitHub 仓库 $repo ($branch)';
  }

  static Future<Map<String, dynamic>> _pullFromGitHubRepo(CloudSyncConfig config) async {
    final token = config.githubToken.trim();
    final repo = config.githubRepo.trim();
    final branch = config.githubBranch.trim().isEmpty ? 'main' : config.githubBranch.trim();
    final basePath = config.githubPath.trim();

    if (token.isEmpty || !repo.contains('/')) {
      throw '请填写有效的 GitHub 访问令牌 (Token) 与仓库名称（如 username/my-notes）';
    }

    final encodedPath = Uri.encodeFull(basePath);
    final url = Uri.parse('https://api.github.com/repos/$repo/contents/$encodedPath?ref=$branch');
    final req = await _httpClient.getUrl(url);
    _setGitHubHeaders(req, token);
    final resp = await req.close();

    if (resp.statusCode != 200) {
      final errBody = await utf8.decodeStream(resp);
      throw '访问 GitHub 仓库失败 (${resp.statusCode}): $errBody';
    }

    final body = await utf8.decodeStream(resp);
    final list = jsonDecode(body);
    if (list is! List) {
      throw '仓库路径中未找到文件列表';
    }

    final loadedTabs = <DocTab>[];
    for (final item in list) {
      final name = item['name'] as String? ?? '';
      if (!_isNoteFile(name)) continue;

      String fileContent = '';
      if (item['content'] != null) {
        final rawB64 = (item['content'] as String).replaceAll('\n', '').replaceAll('\r', '');
        fileContent = utf8.decode(base64Decode(rawB64));
      } else if (item['download_url'] != null) {
        final dlReq = await _httpClient.getUrl(Uri.parse(item['download_url'] as String));
        final dlResp = await dlReq.close();
        fileContent = await utf8.decodeStream(dlResp);
      }

      final isBoo = name.toLowerCase().endsWith('.boo');
      final parsedNodes = isBoo ? BooParser.parse(fileContent) : MdParser.parse(fileContent);

      loadedTabs.add(
        DocTab(
          id: 'tab_sync_${DateTime.now().microsecondsSinceEpoch}_${name.hashCode.abs()}',
          title: name,
          nodes: parsedNodes,
          focusedId: parsedNodes.isNotEmpty ? parsedNodes.first.id : null,
        ),
      );
    }

    if (loadedTabs.isEmpty) {
      throw '在 GitHub 路径中未找到 .md 或 .boo 格式的笔记文件';
    }

    return {
      'tabs': loadedTabs,
      'message': '已从 GitHub 仓库恢复 ${loadedTabs.length} 份笔记',
    };
  }

  // --- 2. GitHub Gist 私密同步 ---
  static Future<String> _pushToGitHubGist(CloudSyncConfig config, List<DocTab> tabs) async {
    final token = config.githubToken.trim();
    if (token.isEmpty) {
      throw '请提供有效的 GitHub Personal Access Token (需勾选 gist 权限)';
    }

    final filesObj = <String, dynamic>{};
    for (final tab in tabs) {
      final fileName = _normalizeFileName(tab.title);
      final isBoo = fileName.toLowerCase().endsWith('.boo');
      final contentStr = isBoo ? BooParser.serialize(tab.nodes) : MdParser.serialize(tab.nodes);
      filesObj[fileName] = {'content': contentStr};
    }

    final hasExistingGist = config.gistId.trim().isNotEmpty;
    final url = hasExistingGist
        ? Uri.parse('https://api.github.com/gists/${config.gistId.trim()}')
        : Uri.parse('https://api.github.com/gists');

    final req = hasExistingGist
        ? await _httpClient.patchUrl(url)
        : await _httpClient.postUrl(url);

    _setGitHubHeaders(req, token);
    req.headers.contentType = ContentType.json;

    final payload = {
      'description': 'BooguNote Native 笔记云同步备份',
      'public': false,
      'files': filesObj,
    };
    req.write(jsonEncode(payload));

    final resp = await req.close();
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      final body = await utf8.decodeStream(resp);
      final json = jsonDecode(body) as Map<String, dynamic>;
      final newGistId = json['id'] as String? ?? config.gistId;
      config.gistId = newGistId;
      return '已成功将 ${tabs.length} 份笔记同步至私密 Gist (ID: $newGistId)';
    } else {
      final errBody = await utf8.decodeStream(resp);
      throw '同步到 Gist 失败 (${resp.statusCode}): $errBody';
    }
  }

  static Future<Map<String, dynamic>> _pullFromGitHubGist(CloudSyncConfig config) async {
    final token = config.githubToken.trim();
    final gistId = config.gistId.trim();

    if (token.isEmpty || gistId.isEmpty) {
      throw '从 Gist 恢复笔记需要提供 Token 以及 Gist ID';
    }

    final url = Uri.parse('https://api.github.com/gists/$gistId');
    final req = await _httpClient.getUrl(url);
    _setGitHubHeaders(req, token);
    final resp = await req.close();

    if (resp.statusCode != 200) {
      final err = await utf8.decodeStream(resp);
      throw '获取 Gist 失败 (${resp.statusCode}): $err';
    }

    final body = await utf8.decodeStream(resp);
    final json = jsonDecode(body) as Map<String, dynamic>;
    final filesObj = json['files'] as Map<String, dynamic>? ?? {};

    final loadedTabs = <DocTab>[];
    for (final entry in filesObj.entries) {
      final name = entry.key;
      if (!_isNoteFile(name)) continue;
      final fileData = entry.value as Map<String, dynamic>;
      final content = fileData['content'] as String? ?? '';

      final isBoo = name.toLowerCase().endsWith('.boo');
      final parsedNodes = isBoo ? BooParser.parse(content) : MdParser.parse(content);

      loadedTabs.add(
        DocTab(
          id: 'tab_gist_${DateTime.now().microsecondsSinceEpoch}_${name.hashCode.abs()}',
          title: name,
          nodes: parsedNodes,
          focusedId: parsedNodes.isNotEmpty ? parsedNodes.first.id : null,
        ),
      );
    }

    if (loadedTabs.isEmpty) {
      throw '该 Gist 中没有找到 .md 或 .boo 格式笔记';
    }

    return {
      'tabs': loadedTabs,
      'message': '已从私密 Gist 恢复 ${loadedTabs.length} 份笔记',
    };
  }

  // --- 3. WebDAV 坚果云/Nextcloud 同步 ---
  static Future<String> _pushToWebDAV(CloudSyncConfig config, List<DocTab> tabs) async {
    final baseUrl = config.webdavUrl.trim();
    final user = config.webdavUser.trim();
    final pass = config.webdavPassword.trim();

    if (baseUrl.isEmpty) {
      throw '请填写有效的 WebDAV 服务器地址（如坚果云: https://dav.jianguoyun.com/dav/BooguNote/）';
    }

    final authHeader = 'Basic ${base64Encode(utf8.encode('$user:$pass'))}';
    int count = 0;

    for (final tab in tabs) {
      final fileName = _normalizeFileName(tab.title);
      final cleanBase = baseUrl.endsWith('/') ? baseUrl : '$baseUrl/';
      final fileUrl = Uri.parse('$cleanBase$fileName');

      final isBoo = fileName.toLowerCase().endsWith('.boo');
      final contentStr = isBoo ? BooParser.serialize(tab.nodes) : MdParser.serialize(tab.nodes);

      final req = await _httpClient.putUrl(fileUrl);
      req.headers.set('Authorization', authHeader);
      req.headers.contentType = ContentType.parse('text/plain; charset=utf-8');
      req.write(contentStr);

      final resp = await req.close();
      if (resp.statusCode >= 200 && resp.statusCode < 300) {
        count++;
      }
    }

    return '已通过 WebDAV 成功备份 $count 份笔记至云端';
  }

  static Future<Map<String, dynamic>> _pullFromWebDAV(CloudSyncConfig config) async {
    final baseUrl = config.webdavUrl.trim();
    final user = config.webdavUser.trim();
    final pass = config.webdavPassword.trim();

    if (baseUrl.isEmpty) {
      throw '请填写有效的 WebDAV 服务器地址';
    }

    // 简单尝试拉取主要默认文件
    final authHeader = 'Basic ${base64Encode(utf8.encode('$user:$pass'))}';
    final cleanBase = baseUrl.endsWith('/') ? baseUrl : '$baseUrl/';
    final fileUrl = Uri.parse('${cleanBase}BooguNote.md');

    final req = await _httpClient.getUrl(fileUrl);
    req.headers.set('Authorization', authHeader);
    final resp = await req.close();

    if (resp.statusCode != 200) {
      throw '从 WebDAV 获取文件失败 (${resp.statusCode})';
    }

    final content = await utf8.decodeStream(resp);
    final parsed = MdParser.parse(content);

    return {
      'tabs': [
        DocTab(
          id: 'tab_dav_${DateTime.now().microsecondsSinceEpoch}',
          title: 'BooguNote.md',
          nodes: parsed,
          focusedId: parsed.isNotEmpty ? parsed.first.id : null,
        )
      ],
      'message': '已从 WebDAV 成功恢复笔记',
    };
  }

  static void _setGitHubHeaders(HttpClientRequest req, String token) {
    req.headers.set('Authorization', 'Bearer $token');
    req.headers.set('User-Agent', 'BooguNote-Native-Outliner');
    req.headers.set('Accept', 'application/vnd.github+json');
  }

  static String _normalizeFileName(String title) {
    final safe = title.trim().replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    if (safe.endsWith('.md') || safe.endsWith('.boo')) {
      return safe;
    }
    return '$safe.md';
  }

  static bool _isNoteFile(String name) {
    final lower = name.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.boo');
  }
}

