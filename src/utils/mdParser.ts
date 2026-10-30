import { OutlineNode, NodeIconType, BlockWidthMode } from '../types/outline';
import { generateNodeId } from './booParser';

// 存储在 Markdown HTML 注释中的紧凑扩展元数据接口
interface BooCompactMeta {
  icon?: NodeIconType;
  collapsed?: boolean;
  width?: BlockWidthMode;
  bold?: boolean;
  branch?: boolean;
  color?: string;
  bg?: string;
  time?: string;
}

const META_REGEX = /\s*<!--\s*boo:(\{.*?\})\s*-->$/;

// 构造节点的扩展元数据注释（若全为默认值则返回空字符串，保持 Markdown 极度干净）
function buildMetaComment(node: OutlineNode): string {
  const meta: BooCompactMeta = {};
  if (node.icon !== 'none') meta.icon = node.icon;
  if (node.collapsed) meta.collapsed = true;
  if (node.blockWidth !== 'narrow') meta.width = node.blockWidth;
  if (node.isBold) meta.bold = true;
  if (node.showBranch) meta.branch = true;
  if (node.textColor) meta.color = node.textColor;
  if (node.bgColor) meta.bg = node.bgColor;
  if (node.modifyTime) meta.time = node.modifyTime;

  if (Object.keys(meta).length === 0) {
    return '';
  }
  return ` <!-- boo:${JSON.stringify(meta)} -->`;
}

// 递归将单个节点转换为 Markdown 列表文本
function serializeNodeToMd(
  node: OutlineNode,
  level: number,
  includeMeta: boolean
): string {
  const indent = '  '.repeat(level);
  const subIndent = '  '.repeat(level + 1);
  const rawLines = (node.content || '').split(/\r?\n/);
  const metaComment = includeMeta ? buildMetaComment(node) : '';

  const firstLine = `${indent}- ${rawLines[0] ?? ''}${
    rawLines.length === 1 ? metaComment : ''
  }`;

  const extraLines = rawLines.slice(1).map((line, idx) => {
    const isLast = idx === rawLines.length - 2;
    return `${subIndent}${line}${isLast ? metaComment : ''}`;
  });

  const selfText = [firstLine, ...extraLines].join('\n');

  if (node.children.length === 0) {
    return selfText;
  }

  const childrenText = node.children
    .map((child) => serializeNodeToMd(child, level + 1, includeMeta))
    .join('\n');

  return `${selfText}\n${childrenText}`;
}

/**
 * 将大纲节点树导出为 Markdown 文本
 * @param nodes 节点树
 * @param includeMeta 是否包含 <!-- boo:{...} --> 扩展属性注释（默认 true）
 */
export function exportToMarkdown(
  nodes: OutlineNode[],
  includeMeta: boolean = true
): string {
  return nodes.map((n) => serializeNodeToMd(n, 0, includeMeta)).join('\n') + '\n';
}

// 从文本末尾提取并剥离 <!-- boo:{...} --> 元数据
function extractMetaFromText(text: string): {
  cleanText: string;
  meta: BooCompactMeta;
} {
  const match = text.match(META_REGEX);
  if (!match) {
    return { cleanText: text, meta: {} };
  }
  try {
    const meta = JSON.parse(match[1]) as BooCompactMeta;
    const cleanText = text.slice(0, match.index).replace(/\s+$/, '');
    return { cleanText, meta };
  } catch {
    return { cleanText: text, meta: {} };
  }
}

/**
 * 将 Markdown 文本解析为大纲节点树 OutlineNode[]
 * 同时支持标准 Markdown 列表、多行列表项以及 <!-- boo:{...} --> 扩展元数据
 */
export function parseMarkdownToNodes(mdText: string): OutlineNode[] {
  const lines = mdText.replace(/\r\n/g, '\n').split('\n');

  interface RawItem {
    level: number;
    lines: string[];
  }

  const rawItems: RawItem[] = [];

  for (const line of lines) {
    // 跳过文件末尾多余空行（除非当前正在多行块中）
    if (line.trim() === '' && rawItems.length === 0) {
      continue;
    }

    // 匹配列表项：支持 "- xxx"、"* xxx"、"+ xxx"
    const listMatch = line.match(/^(\s*)([-*+])\s?(.*)$/);
    // 匹配 Markdown 标题：如 "# 标题" 也可转为顶层大纲节点
    const headingMatch = !listMatch ? line.match(/^(#{1,6})\s+(.*)$/) : null;

    if (listMatch) {
      const indentStr = listMatch[1].replace(/\t/g, '  ');
      const level = Math.floor(indentStr.length / 2);
      const contentLine = listMatch[3];
      rawItems.push({
        level,
        lines: [contentLine],
      });
    } else if (headingMatch) {
      const level = Math.max(0, headingMatch[1].length - 1);
      rawItems.push({
        level,
        lines: [headingMatch[2] + ' <!-- boo:{"bold":true} -->'],
      });
    } else if (rawItems.length > 0) {
      // 续行：属于上一个列表项的多行内容
      const prev = rawItems[rawItems.length - 1];
      const expectedSubIndent = '  '.repeat(prev.level + 1);
      const normalizedLine = line.replace(/\t/g, '  ');
      const strippedLine = normalizedLine.startsWith(expectedSubIndent)
        ? normalizedLine.slice(expectedSubIndent.length)
        : normalizedLine.trimStart();
      prev.lines.push(strippedLine);
    } else if (line.trim() !== '') {
      // 普通段落行作为一级节点
      rawItems.push({
        level: 0,
        lines: [line.trim()],
      });
    }
  }

  // 清除每个列表项末尾因文档结尾产生的空白行
  const rootNodes: OutlineNode[] = [];
  const stack: { level: number; node: OutlineNode }[] = [];

  for (const item of rawItems) {
    while (item.lines.length > 1 && item.lines[item.lines.length - 1].trim() === '') {
      item.lines.pop();
    }
    const joined = item.lines.join('\n');
    const { cleanText, meta } = extractMetaFromText(joined);

    const newNode: OutlineNode = {
      id: generateNodeId(),
      content: cleanText,
      icon: meta.icon ?? 'none',
      collapsed: meta.collapsed ?? false,
      blockWidth: meta.width ?? 'narrow',
      isBold: meta.bold ?? false,
      showBranch: meta.branch ?? false,
      textColor: meta.color,
      bgColor: meta.bg,
      modifyTime: meta.time,
      children: [],
    };

    // 根据缩进层级挂载到对应父节点下
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(newNode);
    } else {
      stack[stack.length - 1].node.children.push(newNode);
    }

    stack.push({ level: item.level, node: newNode });
  }

  if (rootNodes.length === 0) {
    return [
      {
        id: generateNodeId(),
        content: '',
        icon: 'none',
        collapsed: false,
        blockWidth: 'narrow',
        isBold: false,
        showBranch: false,
        children: [],
      },
    ];
  }

  return rootNodes;
}

