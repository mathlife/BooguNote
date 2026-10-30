import { CloudSyncConfig, DocTab } from '../types/outline';
import { exportToMarkdown, parseMarkdownToNodes } from './mdParser';
import { exportToBooXml, parseBooXml, generateNodeId } from './booParser';

// UTF-8 字符串转 Base64（用于 GitHub Contents API）
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 转 UTF-8 字符串
function base64ToUtf8(b64: string): string {
  const cleaned = b64.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// 将 Dropbox HTTP Header 中的非 ASCII 字符转义为 \uXXXX
function escapeDropboxHeaderJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// 规范化文件名，确保具有 .md 或 .boo 后缀
function normalizeTabFileName(title: string): string {
  const safe = title.trim().replace(/[\\/:*?"<>|]/g, '_') || '未命名笔记.md';
  if (/\.(md|markdown|boo)$/i.test(safe)) {
    return safe;
  }
  return `${safe}.md`;
}

// 根据文件名与内容将文本解析回 DocTab
function createTabFromFile(fileName: string, content: string): DocTab {
  const isBoo =
    fileName.toLowerCase().endsWith('.boo') ||
    content.trimStart().startsWith('<?xml') ||
    content.trimStart().startsWith('<root');
  const nodes = isBoo ? parseBooXml(content) : parseMarkdownToNodes(content);
  return {
    id: 'tab_' + generateNodeId(),
    title: fileName,
    nodes,
    focusedId: nodes[0]?.id ?? null,
    selectedIds: [],
    isDirty: false,
    undoStack: [],
    redoStack: [],
  };
}

// ============================================================================
// 1. GitHub 私人仓库同步 (GitHub Repository Contents API)
// ============================================================================

async function pushToGitHubRepo(
  config: CloudSyncConfig,
  tabs: DocTab[]
): Promise<{ message: string }> {
  const token = config.githubToken.trim();
  const repo = config.githubRepo.trim().replace(/^\/+|\/+$/g, '');
  const branch = config.githubBranch.trim() || 'main';
  const basePath = config.githubPath.trim().replace(/^\/+|\/+$/g, '');

  if (!token || !repo.includes('/')) {
    throw new Error('请填写有效的 GitHub Token 以及仓库名（格式：用户名/仓库名）');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const fileNames: string[] = [];

  for (const tab of tabs) {
    const fileName = normalizeTabFileName(tab.title);
    fileNames.push(fileName);
    const fullPath = basePath ? `${basePath}/${fileName}` : fileName;
    const encodedPath = fullPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

    // 先查询文件是否已存在以获取其 sha
    let existingSha: string | undefined;
    const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers,
    });
    if (getRes.ok) {
      const existingData = await getRes.json();
      existingSha = existingData.sha;
    }

    const contentStr = fileName.toLowerCase().endsWith('.boo')
      ? exportToBooXml(tab.nodes)
      : exportToMarkdown(tab.nodes, true);

    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `sync: 更新笔记 ${fileName} (via BooguNote Next)`,
        content: utf8ToBase64(contentStr),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`推送文件 ${fileName} 到 GitHub 失败 (${putRes.status}): ${errText}`);
    }
  }

  return {
    message: `已成功将 ${fileNames.length} 份笔记推送到 GitHub 仓库 ${repo} (${branch})`,
  };
}

async function pullFromGitHubRepo(
  config: CloudSyncConfig
): Promise<{ tabs: DocTab[]; message: string }> {
  const token = config.githubToken.trim();
  const repo = config.githubRepo.trim().replace(/^\/+|\/+$/g, '');
  const branch = config.githubBranch.trim() || 'main';
  const basePath = config.githubPath.trim().replace(/^\/+|\/+$/g, '');

  if (!token || !repo.includes('/')) {
    throw new Error('请填写有效的 GitHub Token 以及仓库名（格式：用户名/仓库名）');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  const encodedPath = basePath
    ? basePath
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/')
    : '';
  const listUrl = `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
    branch
  )}`;

  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`读取 GitHub 仓库目录失败 (${listRes.status}): ${errText}`);
  }

  const items = await listRes.json();
  if (!Array.isArray(items)) {
    throw new Error('指定的路径不是一个目录');
  }

  const noteFiles = items.filter(
    (item: any) =>
      item.type === 'file' && /\.(md|markdown|boo)$/i.test(item.name)
  );

  if (noteFiles.length === 0) {
    throw new Error(`在仓库目录 "${basePath || '/'}" 下未找到任何 .md 或 .boo 笔记文件`);
  }

  const loadedTabs: DocTab[] = [];
  for (const fileItem of noteFiles) {
    const fileRes = await fetch(fileItem.url, { headers });
    if (!fileRes.ok) continue;
    const fileData = await fileRes.json();
    if (fileData.content) {
      const text = base64ToUtf8(fileData.content);
      loadedTabs.push(createTabFromFile(fileItem.name, text));
    }
  }

  return {
    tabs: loadedTabs,
    message: `已从 GitHub 仓库 ${repo} 拉取恢复 ${loadedTabs.length} 份笔记`,
  };
}

// ============================================================================
// 2. GitHub 私密 Gist 同步 (零配置建仓，一键多端同步)
// ============================================================================

async function pushToGitHubGist(
  config: CloudSyncConfig,
  tabs: DocTab[]
): Promise<{ message: string; newGistId?: string }> {
  const token = config.githubToken.trim();
  if (!token) {
    throw new Error('请填写有效的 GitHub Personal Access Token');
  }

  const filesPayload: Record<string, { content: string }> = {};
  for (const tab of tabs) {
    const fileName = normalizeTabFileName(tab.title);
    const contentStr = fileName.toLowerCase().endsWith('.boo')
      ? exportToBooXml(tab.nodes)
      : exportToMarkdown(tab.nodes, true);
    filesPayload[fileName] = { content: contentStr };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const gistId = config.gistId.trim();
  const url = gistId
    ? `https://api.github.com/gists/${gistId}`
    : `https://api.github.com/gists`;
  const method = gistId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({
      description: 'BooguNote Next 多端云同步笔记库',
      public: false,
      files: filesPayload,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`同步到 GitHub Gist 失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    message: `已成功同步 ${tabs.length} 份笔记到私密 Gist (ID: ${data.id})`,
    newGistId: data.id,
  };
}

async function pullFromGitHubGist(
  config: CloudSyncConfig
): Promise<{ tabs: DocTab[]; message: string }> {
  const token = config.githubToken.trim();
  const gistId = config.gistId.trim();
  if (!token || !gistId) {
    throw new Error('拉取 Gist 需要填写 GitHub Token 与 Gist ID');
  }

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`读取 GitHub Gist 失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const filesObj = data.files || {};
  const loadedTabs: DocTab[] = [];

  for (const fileName of Object.keys(filesObj)) {
    if (!/\.(md|markdown|boo)$/i.test(fileName)) continue;
    const fileItem = filesObj[fileName];
    if (fileItem && typeof fileItem.content === 'string') {
      loadedTabs.push(createTabFromFile(fileName, fileItem.content));
    }
  }

  if (loadedTabs.length === 0) {
    throw new Error('该 Gist 中没有找到 .md 或 .boo 笔记文件');
  }

  return {
    tabs: loadedTabs,
    message: `已从私密 Gist 拉取恢复 ${loadedTabs.length} 份笔记`,
  };
}

// ============================================================================
// 3. Dropbox 网盘同步 (Dropbox API v2)
// ============================================================================

async function pushToDropbox(
  config: CloudSyncConfig,
  tabs: DocTab[]
): Promise<{ message: string }> {
  const token = config.dropboxToken.trim();
  if (!token) {
    throw new Error('请填写有效的 Dropbox Access Token');
  }

  let baseFolder = config.dropboxPath.trim() || '/BooguNote';
  if (!baseFolder.startsWith('/')) baseFolder = '/' + baseFolder;
  baseFolder = baseFolder.replace(/\/+$/, '');

  for (const tab of tabs) {
    const fileName = normalizeTabFileName(tab.title);
    const fullPath = `${baseFolder}/${fileName}`;
    const contentStr = fileName.toLowerCase().endsWith('.boo')
      ? exportToBooXml(tab.nodes)
      : exportToMarkdown(tab.nodes, true);

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': escapeDropboxHeaderJson({
          path: fullPath,
          mode: 'overwrite',
          autorename: false,
          mute: true,
        }),
      },
      body: new TextEncoder().encode(contentStr),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`上传 ${fileName} 到 Dropbox 失败 (${res.status}): ${errText}`);
    }
  }

  return {
    message: `已成功将 ${tabs.length} 份笔记上传至 Dropbox 目录 ${baseFolder}`,
  };
}

async function pullFromDropbox(
  config: CloudSyncConfig
): Promise<{ tabs: DocTab[]; message: string }> {
  const token = config.dropboxToken.trim();
  if (!token) {
    throw new Error('请填写有效的 Dropbox Access Token');
  }

  let baseFolder = config.dropboxPath.trim() || '/BooguNote';
  if (!baseFolder.startsWith('/')) baseFolder = '/' + baseFolder;
  baseFolder = baseFolder.replace(/\/+$/, '');

  const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: baseFolder,
      recursive: false,
    }),
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`读取 Dropbox 目录 ${baseFolder} 失败 (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json();
  const entries = (listData.entries || []).filter(
    (e: any) => e['.tag'] === 'file' && /\.(md|markdown|boo)$/i.test(e.name)
  );

  if (entries.length === 0) {
    throw new Error(`Dropbox 目录 ${baseFolder} 下没有找到 .md 或 .boo 文件`);
  }

  const loadedTabs: DocTab[] = [];
  for (const entry of entries) {
    const dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': escapeDropboxHeaderJson({
          path: entry.path_lower || `${baseFolder}/${entry.name}`,
        }),
      },
    });
    if (!dlRes.ok) continue;
    const text = await dlRes.text();
    loadedTabs.push(createTabFromFile(entry.name, text));
  }

  return {
    tabs: loadedTabs,
    message: `已从 Dropbox 目录 ${baseFolder} 拉取恢复 ${loadedTabs.length} 份笔记`,
  };
}

// ============================================================================
// 统一多端同步调度入口
// ============================================================================

export async function pushWorkspaceToCloud(
  config: CloudSyncConfig,
  tabs: DocTab[]
): Promise<{ message: string; newGistId?: string }> {
  if (config.provider === 'github-repo') {
    return pushToGitHubRepo(config, tabs);
  }
  if (config.provider === 'github-gist') {
    return pushToGitHubGist(config, tabs);
  }
  return pushToDropbox(config, tabs);
}

export async function pullWorkspaceFromCloud(
  config: CloudSyncConfig
): Promise<{ tabs: DocTab[]; message: string }> {
  if (config.provider === 'github-repo') {
    return pullFromGitHubRepo(config);
  }
  if (config.provider === 'github-gist') {
    return pullFromGitHubGist(config);
  }
  return pullFromDropbox(config);
}

