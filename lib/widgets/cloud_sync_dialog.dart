import 'package:flutter/material.dart';
import '../models/cloud_sync_config.dart';
import '../models/doc_tab.dart';
import '../services/cloud_sync_service.dart';
import '../services/storage_service.dart';

/// 多端云同步设置对话框
class CloudSyncDialog extends StatefulWidget {
  final List<DocTab> currentTabs;
  final ValueChanged<List<DocTab>> onTabsPulled;

  const CloudSyncDialog({
    super.key,
    required this.currentTabs,
    required this.onTabsPulled,
  });

  @override
  State<CloudSyncDialog> createState() => _CloudSyncDialogState();
}

class _CloudSyncDialogState extends State<CloudSyncDialog> {
  late CloudSyncConfig _config;
  bool _isLoading = true;
  bool _isOperating = false;
  String _statusMessage = '';
  bool _isSuccess = true;

  late TextEditingController _ghTokenCtrl;
  late TextEditingController _ghRepoCtrl;
  late TextEditingController _ghBranchCtrl;
  late TextEditingController _ghPathCtrl;
  late TextEditingController _gistIdCtrl;
  late TextEditingController _webdavUrlCtrl;
  late TextEditingController _webdavUserCtrl;
  late TextEditingController _webdavPassCtrl;

  @override
  void initState() {
    super.initState();
    _ghTokenCtrl = TextEditingController();
    _ghRepoCtrl = TextEditingController();
    _ghBranchCtrl = TextEditingController();
    _ghPathCtrl = TextEditingController();
    _gistIdCtrl = TextEditingController();
    _webdavUrlCtrl = TextEditingController();
    _webdavUserCtrl = TextEditingController();
    _webdavPassCtrl = TextEditingController();

    _loadConfig();
  }

  @override
  void dispose() {
    _ghTokenCtrl.dispose();
    _ghRepoCtrl.dispose();
    _ghBranchCtrl.dispose();
    _ghPathCtrl.dispose();
    _gistIdCtrl.dispose();
    _webdavUrlCtrl.dispose();
    _webdavUserCtrl.dispose();
    _webdavPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    final cfg = await StorageService.loadSyncConfig();
    if (!mounted) return;
    setState(() {
      _config = cfg;
      _ghTokenCtrl.text = cfg.githubToken;
      _ghRepoCtrl.text = cfg.githubRepo;
      _ghBranchCtrl.text = cfg.githubBranch;
      _ghPathCtrl.text = cfg.githubPath;
      _gistIdCtrl.text = cfg.gistId;
      _webdavUrlCtrl.text = cfg.webdavUrl;
      _webdavUserCtrl.text = cfg.webdavUser;
      _webdavPassCtrl.text = cfg.webdavPassword;
      _isLoading = false;
    });
  }

  void _saveCurrentFieldsToConfig() {
    _config.githubToken = _ghTokenCtrl.text.trim();
    _config.githubRepo = _ghRepoCtrl.text.trim();
    _config.githubBranch = _ghBranchCtrl.text.trim().isEmpty ? 'main' : _ghBranchCtrl.text.trim();
    _config.githubPath = _ghPathCtrl.text.trim().isEmpty ? 'notes' : _ghPathCtrl.text.trim();
    _config.gistId = _gistIdCtrl.text.trim();
    _config.webdavUrl = _webdavUrlCtrl.text.trim();
    _config.webdavUser = _webdavUserCtrl.text.trim();
    _config.webdavPassword = _webdavPassCtrl.text.trim();
  }

  Future<void> _handleSave() async {
    _saveCurrentFieldsToConfig();
    await StorageService.saveSyncConfig(_config);
    if (!mounted) return;
    setState(() {
      _statusMessage = '✅ 云同步配置已保存';
      _isSuccess = true;
    });
  }

  Future<void> _handlePush() async {
    _saveCurrentFieldsToConfig();
    await StorageService.saveSyncConfig(_config);

    setState(() {
      _isOperating = true;
      _statusMessage = '正在上传本地笔记到云端...';
      _isSuccess = true;
    });

    try {
      final res = await CloudSyncService.pushNotes(_config, widget.currentTabs);
      if (!mounted) return;
      setState(() {
        _isOperating = false;
        _isSuccess = res.success;
        _statusMessage = res.message;
        if (res.newGistId != null) {
          _gistIdCtrl.text = res.newGistId!;
          _config.gistId = res.newGistId!;
          StorageService.saveSyncConfig(_config);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isOperating = false;
        _isSuccess = false;
        _statusMessage = '推送异常: $e';
      });
    }
  }

  Future<void> _handlePull() async {
    _saveCurrentFieldsToConfig();
    await StorageService.saveSyncConfig(_config);

    setState(() {
      _isOperating = true;
      _statusMessage = '正在从云端拉取笔记...';
      _isSuccess = true;
    });

    try {
      final res = await CloudSyncService.pullNotes(_config);
      if (!mounted) return;
      setState(() {
        _isOperating = false;
        _isSuccess = res.success;
        _statusMessage = res.message;
      });

      if (res.success && res.tabs != null && res.tabs!.isNotEmpty) {
        widget.onTabsPulled(res.tabs!);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isOperating = false;
        _isSuccess = false;
        _statusMessage = '拉取异常: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const AlertDialog(
        content: SizedBox(
          height: 100,
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.cloud_sync, color: Color(0xFF1976D2), size: 26),
          const SizedBox(width: 10),
          const Text('多端云同步设置', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
      content: SizedBox(
        width: 540,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                '通过 Git 仓库、Gist 或 WebDAV 随时保持多端笔记同步，数据完全属于您自己。',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              // 同步服务商选择
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(
                    value: 'github-repo',
                    label: Text('GitHub 仓库'),
                    icon: Icon(Icons.folder_shared_outlined, size: 16),
                  ),
                  ButtonSegment(
                    value: 'github-gist',
                    label: Text('GitHub Gist'),
                    icon: Icon(Icons.code_outlined, size: 16),
                  ),
                  ButtonSegment(
                    value: 'webdav',
                    label: Text('WebDAV (坚果云)'),
                    icon: Icon(Icons.cloud_outlined, size: 16),
                  ),
                ],
                selected: {_config.provider},
                onSelectionChanged: (newVal) {
                  setState(() {
                    _config.provider = newVal.first;
                    _statusMessage = '';
                  });
                },
              ),
              const SizedBox(height: 16),

              // 根据 provider 显示对应的字段
              if (_config.provider == 'github-repo') ...[
                _buildTextField(
                  label: 'GitHub Personal Access Token (PAT)',
                  hint: 'ghp_xxx 或 github_pat_xxx (需勾选 repo 权限)',
                  controller: _ghTokenCtrl,
                  obscureText: true,
                ),
                const SizedBox(height: 10),
                _buildTextField(
                  label: '仓库路径 (Repository)',
                  hint: '例如: yourname/my-notes',
                  controller: _ghRepoCtrl,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildTextField(
                        label: '分支名 (Branch)',
                        hint: 'main',
                        controller: _ghBranchCtrl,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildTextField(
                        label: '存放子目录 (Path)',
                        hint: 'notes',
                        controller: _ghPathCtrl,
                      ),
                    ),
                  ],
                ),
              ] else if (_config.provider == 'github-gist') ...[
                _buildTextField(
                  label: 'GitHub Personal Access Token (PAT)',
                  hint: '需勾选 gist 权限',
                  controller: _ghTokenCtrl,
                  obscureText: true,
                ),
                const SizedBox(height: 10),
                _buildTextField(
                  label: 'Gist ID (留空将在初次推送时自动新建)',
                  hint: '例如: 8a7c2b5e...',
                  controller: _gistIdCtrl,
                ),
              ] else if (_config.provider == 'webdav') ...[
                _buildTextField(
                  label: 'WebDAV 服务器地址',
                  hint: '坚果云示例: https://dav.jianguoyun.com/dav/BooguNote/',
                  controller: _webdavUrlCtrl,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildTextField(
                        label: '账号 / 邮箱',
                        hint: 'your_email@example.com',
                        controller: _webdavUserCtrl,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildTextField(
                        label: '应用授权密码',
                        hint: '坚果云在账户信息->安全设置中生成',
                        controller: _webdavPassCtrl,
                        obscureText: true,
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 16),

              // 状态显示
              if (_statusMessage.isNotEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _isSuccess ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _isSuccess ? const Color(0xFFA5D6A7) : const Color(0xFFFFCDD2),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isSuccess ? Icons.check_circle : Icons.error,
                        size: 16,
                        color: _isSuccess ? Colors.green[700] : Colors.red[700],
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _statusMessage,
                          style: TextStyle(
                            fontSize: 12,
                            color: _isSuccess ? Colors.green[800] : Colors.red[800],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
      actionsPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      actions: [
        TextButton.icon(
          onPressed: _isOperating ? null : _handleSave,
          icon: const Icon(Icons.save_outlined, size: 16),
          label: const Text('保存配置'),
        ),
        const Spacer(),
        OutlinedButton.icon(
          onPressed: _isOperating ? null : _handlePull,
          icon: _isOperating
              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.cloud_download_outlined, size: 16),
          label: const Text('从云端拉取'),
        ),
        const SizedBox(width: 8),
        FilledButton.icon(
          onPressed: _isOperating ? null : _handlePush,
          icon: _isOperating
              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.cloud_upload_outlined, size: 16),
          label: const Text('推送到云端'),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required String hint,
    required TextEditingController controller,
    bool obscureText = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          obscureText: obscureText,
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12, color: Colors.black26),
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
          ),
        ),
      ],
    );
  }
}
