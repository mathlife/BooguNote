import React, { useState } from 'react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderGit2,
  HardDrive,
  FileLock2,
} from 'lucide-react';
import { CloudSyncConfig, DocTab, SyncProviderType } from '../types/outline';
import {
  pushWorkspaceToCloud,
  pullWorkspaceFromCloud,
} from '../utils/cloudSync';

interface CloudSyncModalProps {
  syncConfig: CloudSyncConfig;
  tabs: DocTab[];
  onUpdateSyncConfig: (partial: Partial<CloudSyncConfig>) => void;
  onReplaceTabsFromCloud: (newTabs: DocTab[]) => void;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  syncConfig,
  tabs,
  onUpdateSyncConfig,
  onReplaceTabsFromCloud,
  onClose,
}) => {
  const [loading, setLoading] = useState<'push' | 'pull' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handlePush = async () => {
    setLoading('push');
    setStatusMsg(null);
    try {
      const res = await pushWorkspaceToCloud(syncConfig, tabs);
      const nowStr = new Date().toLocaleString('zh-CN');
      onUpdateSyncConfig({
        lastSyncTime: nowStr,
        ...(res.newGistId ? { gistId: res.newGistId } : {}),
      });
      setStatusMsg({ type: 'success', text: res.message });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || '推送到云端失败，请检查网络与 Token 权限',
      });
    } finally {
      setLoading(null);
    }
  };

  const handlePull = async () => {
    setLoading('pull');
    setStatusMsg(null);
    try {
      const res = await pullWorkspaceFromCloud(syncConfig);
      const nowStr = new Date().toLocaleString('zh-CN');
      onReplaceTabsFromCloud(res.tabs);
      onUpdateSyncConfig({ lastSyncTime: nowStr });
      setStatusMsg({ type: 'success', text: res.message });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || '从云端拉取失败，请检查配置路径与 Token 权限',
      });
    } finally {
      setLoading(null);
    }
  };

  const setProvider = (provider: SyncProviderType) => {
    setStatusMsg(null);
    onUpdateSyncConfig({ provider });
  };

  return (
    <div className="bn-modal-backdrop" onClick={onClose}>
      <div
        className="bn-modal-card bn-sync-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bn-modal-header">
          <div className="bn-modal-title">
            <Cloud size={18} /> 多端云同步中心 (PC / Web / Android / iOS)
          </div>
          <button type="button" className="bn-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="bn-modal-body">
          {/* 同步引擎切换卡片 */}
          <div className="bn-sync-provider-tabs">
            <button
              type="button"
              className={`bn-provider-card ${
                syncConfig.provider === 'github-repo' ? 'active' : ''
              }`}
              onClick={() => setProvider('github-repo')}
            >
              <FolderGit2 size={18} />
              <div className="bn-provider-info">
                <strong>GitHub 私人仓库</strong>
                <span>将笔记作为 .md 直接同步至 Git 仓库</span>
              </div>
            </button>

            <button
              type="button"
              className={`bn-provider-card ${
                syncConfig.provider === 'dropbox' ? 'active' : ''
              }`}
              onClick={() => setProvider('dropbox')}
            >
              <HardDrive size={18} />
              <div className="bn-provider-info">
                <strong>Dropbox 网盘</strong>
                <span>接入 Dropbox API v2 同步文件夹</span>
              </div>
            </button>

            <button
              type="button"
              className={`bn-provider-card ${
                syncConfig.provider === 'github-gist' ? 'active' : ''
              }`}
              onClick={() => setProvider('github-gist')}
            >
              <FileLock2 size={18} />
              <div className="bn-provider-info">
                <strong>GitHub 私密 Gist</strong>
                <span>免建仓库，单个 Token 极速多端同步</span>
              </div>
            </button>
          </div>

          {/* 1. GitHub 私人仓库配置表单 */}
          {syncConfig.provider === 'github-repo' && (
            <div className="bn-sync-form">
              <div className="bn-form-row">
                <label>GitHub Personal Access Token (需勾选 repo 权限)</label>
                <input
                  type="password"
                  className="bn-form-input"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx 或 github_pat_xxxx"
                  value={syncConfig.githubToken}
                  onChange={(e) =>
                    onUpdateSyncConfig({ githubToken: e.target.value })
                  }
                />
              </div>

              <div className="bn-form-grid-3">
                <div className="bn-form-row">
                  <label>私人仓库名 (owner/repo)</label>
                  <input
                    type="text"
                    className="bn-form-input"
                    placeholder="例如: username/my-notes"
                    value={syncConfig.githubRepo}
                    onChange={(e) =>
                      onUpdateSyncConfig({ githubRepo: e.target.value })
                    }
                  />
                </div>

                <div className="bn-form-row">
                  <label>分支 (Branch)</label>
                  <input
                    type="text"
                    className="bn-form-input"
                    placeholder="main"
                    value={syncConfig.githubBranch}
                    onChange={(e) =>
                      onUpdateSyncConfig({ githubBranch: e.target.value })
                    }
                  />
                </div>

                <div className="bn-form-row">
                  <label>存放目录路径</label>
                  <input
                    type="text"
                    className="bn-form-input"
                    placeholder="notes"
                    value={syncConfig.githubPath}
                    onChange={(e) =>
                      onUpdateSyncConfig({ githubPath: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="bn-sync-hint">
                说明：推送时会将当前所有标签页作为独立的 <code>.md</code> 文件提交至您的私人仓库，在 GitHub 手机端或 Obsidian 中亦可直接阅读。
              </div>
            </div>
          )}

          {/* 2. Dropbox 网盘配置表单 */}
          {syncConfig.provider === 'dropbox' && (
            <div className="bn-sync-form">
              <div className="bn-form-row">
                <label>
                  Dropbox Access Token (在 Dropbox App Console 中生成，需 files.content.write 权限)
                </label>
                <input
                  type="password"
                  className="bn-form-input"
                  placeholder="sl.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={syncConfig.dropboxToken}
                  onChange={(e) =>
                    onUpdateSyncConfig({ dropboxToken: e.target.value })
                  }
                />
              </div>

              <div className="bn-form-row">
                <label>Dropbox 同步文件夹路径</label>
                <input
                  type="text"
                  className="bn-form-input"
                  placeholder="/BooguNote"
                  value={syncConfig.dropboxPath}
                  onChange={(e) =>
                    onUpdateSyncConfig({ dropboxPath: e.target.value })
                  }
                />
              </div>

              <div className="bn-sync-hint">
                说明：通过 Dropbox 官方 API v2 直接上传与拉取指定目录下的所有 <code>.md</code> 与 <code>.boo</code> 笔记文件，无任何第三方中转。
              </div>
            </div>
          )}

          {/* 3. GitHub Gist 配置表单 */}
          {syncConfig.provider === 'github-gist' && (
            <div className="bn-sync-form">
              <div className="bn-form-row">
                <label>GitHub Personal Access Token (需勾选 gist 权限)</label>
                <input
                  type="password"
                  className="bn-form-input"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={syncConfig.githubToken}
                  onChange={(e) =>
                    onUpdateSyncConfig({ githubToken: e.target.value })
                  }
                />
              </div>

              <div className="bn-form-row">
                <label>私密 Gist ID (首次推送可留空，系统将自动创建并回填)</label>
                <input
                  type="text"
                  className="bn-form-input"
                  placeholder="留空自动生成，或在另一台设备填入已有 Gist ID"
                  value={syncConfig.gistId}
                  onChange={(e) =>
                    onUpdateSyncConfig({ gistId: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* 状态反馈提示 */}
          {statusMsg && (
            <div className={`bn-sync-alert ${statusMsg.type}`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* 同步操作按钮栏 */}
          <div className="bn-sync-actions-bar">
            <div className="bn-sync-meta">
              {syncConfig.lastSyncTime
                ? `上次同步时间：${syncConfig.lastSyncTime}`
                : '尚未执行过云端同步'}
            </div>

            <div className="bn-sync-btns">
              <button
                type="button"
                className="bn-toolbar-btn"
                disabled={loading !== null}
                onClick={handlePull}
              >
                {loading === 'pull' ? (
                  <Loader2 size={15} className="bn-spin" />
                ) : (
                  <CloudDownload size={15} />
                )}
                <span>从云端拉取 (Pull)</span>
              </button>

              <button
                type="button"
                className="bn-toolbar-btn primary"
                disabled={loading !== null}
                onClick={handlePush}
              >
                {loading === 'push' ? (
                  <Loader2 size={15} className="bn-spin" />
                ) : (
                  <CloudUpload size={15} />
                )}
                <span>推送到云端 (Push)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

