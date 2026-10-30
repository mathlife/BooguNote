import 'dart:io';
import 'package:flutter/material.dart';
import '../models/cloud_sync_config.dart';
import '../models/doc_tab.dart';
import '../services/cloud_sync_service.dart';
import '../services/storage_service.dart';

/// 多端云同步设置对话框（手机/平板/桌面完美自适应）
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

  Widget _buildProviderSelector(bool isSmallScreen) {
    final providers = [
      {'id': 'github-repo', 'name': 'GitHub 仓库', 'icon': Icons.folder_shared_outlined},
      {'id': 'github-gist', 'name': 'GitHub Gist', 'icon': Icons.code_outlined},
      {'id': 'webdav', 'name': 'WebDAV (坚果云)', 'icon': Icons.cloud_outlined},
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: providers.map((p) {
        final isSelected = _config.provider == p['id'];
        return ChoiceChip(
          selected: isSelected,
          avatar: Icon(
            p['icon'] as IconData,
            size: 16,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
          label: Text(
            p['name'] as String,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              color: isSelected ? Colors.white : const Color(0xFF334155),
            ),
          ),
          selectedColor: const Color(0xFF2563EB),
          backgroundColor: const Color(0xFFF1F5F9),
          side: BorderSide(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
          ),
          onSelected: (_) {
            setState(() {
              _config.provider = p['id'] as String;
              _statusMessage = '';
            });
          },
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Dialog(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 12),
              Text('正在载入同步配置...'),
            ],
          ),
        ),
      );
    }

    final screenWidth = MediaQuery.of(context).size.width;
    final isSmallScreen = screenWidth < 500;
    final dialogWidth = isSmallScreen ? (screenWidth - 32) : 520.0;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: dialogWidth,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. 顶部标题栏
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.cloud_sync, color: Color(0xFF2563EB), size: 22),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    '多端云同步设置',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: Color(0xFF1E293B)),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: Color(0xFF64748B)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 2. 表单内容区（支持垂直滚动防溢出）
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '通过 GitHub 仓库、Gist 或 WebDAV 随时保持多端笔记同步，数据完全属于您自己。',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.3),
                    ),
                    const SizedBox(height: 14),

                    // 服务商单选
                    _buildProviderSelector(isSmallScreen),
                    const SizedBox(height: 14),

                    // 对应的表单输入项
                    if (_config.provider == 'github-repo') ...[
                      _buildTextField(
                        label: 'GitHub Personal Access Token (PAT)',
                        hint: 'ghp_xxx 或 github_pat_xxx (需 repo 权限)',
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
                      if (isSmallScreen) ...[
                        _buildTextField(
                          label: '分支名 (Branch)',
                          hint: 'main',
                          controller: _ghBranchCtrl,
                        ),
                        const SizedBox(height: 10),
                        _buildTextField(
                          label: '存放子目录 (Path)',
                          hint: 'notes',
                          controller: _ghPathCtrl,
                        ),
                      ] else ...[
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
                      ],
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
                        hint: '坚果云: https://dav.jianguoyun.com/dav/BooguNote/',
                        controller: _webdavUrlCtrl,
                      ),
                      const SizedBox(height: 10),
                      if (isSmallScreen) ...[
                        _buildTextField(
                          label: '账号 / 邮箱',
                          hint: 'your_email@example.com',
                          controller: _webdavUserCtrl,
                        ),
                        const SizedBox(height: 10),
                        _buildTextField(
                          label: '应用授权密码',
                          hint: '坚果云在账户信息->安全设置中生成',
                          controller: _webdavPassCtrl,
                          obscureText: true,
                        ),
                      ] else ...[
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
                    ],

                    const SizedBox(height: 14),

                    // 状态提示条
                    if (_statusMessage.isNotEmpty)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: _isSuccess ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: _isSuccess ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isSuccess ? Icons.check_circle : Icons.error,
                              size: 16,
                              color: _isSuccess ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _statusMessage,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: _isSuccess ? const Color(0xFF15803D) : const Color(0xFFB91C1C),
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

            const SizedBox(height: 14),

            // 3. 底部操作按钮栏（手机触屏大按钮排版）
            if (isSmallScreen) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isOperating ? null : _handlePull,
                      icon: _isOperating
                          ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.cloud_download_outlined, size: 16),
                      label: const Text('从云端拉取'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _isOperating ? null : _handlePush,
                      icon: _isOperating
                          ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.cloud_upload_outlined, size: 16),
                      label: const Text('推送到云端'),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        backgroundColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: _isOperating ? null : _handleSave,
                  icon: const Icon(Icons.save_outlined, size: 16),
                  label: const Text('仅保存配置'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ] else ...[
              Row(
                children: [
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
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
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
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          obscureText: obscureText,
          style: const TextStyle(fontSize: 13),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            isDense: true,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
