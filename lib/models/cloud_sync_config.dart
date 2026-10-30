/// 云同步服务配置
class CloudSyncConfig {
  String provider; // 'github-repo' | 'github-gist' | 'webdav'
  String githubToken;
  String githubRepo; // 'username/my-notes'
  String githubBranch; // 'main'
  String githubPath; // 'notes'
  String gistId;
  String webdavUrl;
  String webdavUser;
  String webdavPassword;

  CloudSyncConfig({
    this.provider = 'github-repo',
    this.githubToken = '',
    this.githubRepo = '',
    this.githubBranch = 'main',
    this.githubPath = 'notes',
    this.gistId = '',
    this.webdavUrl = '',
    this.webdavUser = '',
    this.webdavPassword = '',
  });

  Map<String, dynamic> toJson() {
    return {
      'provider': provider,
      'githubToken': githubToken,
      'githubRepo': githubRepo,
      'githubBranch': githubBranch,
      'githubPath': githubPath,
      'gistId': gistId,
      'webdavUrl': webdavUrl,
      'webdavUser': webdavUser,
      'webdavPassword': webdavPassword,
    };
  }

  factory CloudSyncConfig.fromJson(Map<String, dynamic> json) {
    return CloudSyncConfig(
      provider: json['provider'] as String? ?? 'github-repo',
      githubToken: json['githubToken'] as String? ?? '',
      githubRepo: json['githubRepo'] as String? ?? '',
      githubBranch: json['githubBranch'] as String? ?? 'main',
      githubPath: json['githubPath'] as String? ?? 'notes',
      gistId: json['gistId'] as String? ?? '',
      webdavUrl: json['webdavUrl'] as String? ?? '',
      webdavUser: json['webdavUser'] as String? ?? '',
      webdavPassword: json['webdavPassword'] as String? ?? '',
    );
  }
}
