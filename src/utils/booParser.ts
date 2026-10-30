import { OutlineNode, NodeIconType, BlockWidthMode } from '../types/outline';

// 生成唯一节点 ID
export function generateNodeId(): string {
  return 'bn_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
}

// 将原版 BooguNote 的 8 位十六进制颜色（RRGGBB00）转换为标准 CSS #RRGGBB
function parseBooColor(rawColor: string | null, defaultRaw: string): string | undefined {
  if (!rawColor) return undefined;
  const cleaned = rawColor.trim().toLowerCase();
  if (cleaned === defaultRaw || cleaned.length < 6) {
    return undefined;
  }
  const hex6 = '#' + cleaned.substring(0, 6);
  return hex6;
}

// 将标准 CSS #RRGGBB 转换为原版 BooguNote 8 位颜色字符串（RRGGBB00）
function formatBooColor(hexColor: string | undefined, defaultRaw: string): string {
  if (!hexColor) return defaultRaw;
  const cleaned = hexColor.replace('#', '').trim().toLowerCase();
  if (cleaned.length === 6) {
    return cleaned + '00';
  }
  if (cleaned.length === 3) {
    const r = cleaned[0] + cleaned[0];
    const g = cleaned[1] + cleaned[1];
    const b = cleaned[2] + cleaned[2];
    return `${r}${g}${b}00`;
  }
  return defaultRaw;
}

// 校验并规范化图标类型
function normalizeIcon(iconStr: string | null): NodeIconType {
  const validIcons: NodeIconType[] = [
    'none',
    'flag',
    'tick',
    'cross',
    'star',
    'question',
    'warning',
    'idea',
  ];
  if (iconStr && validIcons.includes(iconStr as NodeIconType)) {
    return iconStr as NodeIconType;
  }
  return 'none';
}

// 校验并规范化宽度模式
function normalizeBlockWidth(blockStr: string | null): BlockWidthMode {
  if (blockStr === 'wide' || blockStr === 'shrink' || blockStr === 'narrow') {
    return blockStr;
  }
  return 'narrow';
}

// 递归解析 XML <item> 元素
function parseXmlItem(el: Element): OutlineNode {
  const content = el.getAttribute('content') ?? '';
  const icon = normalizeIcon(el.getAttribute('icon'));
  const branchAttr = el.getAttribute('branch');
  const blockWidth = normalizeBlockWidth(el.getAttribute('block'));
  const isBold = el.getAttribute('IsBold') === 'true';
  const showBranch = el.getAttribute('ShowBranch') === 'true';
  const rawTextColor = el.getAttribute('TextColor');
  const rawBgColor = el.getAttribute('BkgrdColor');
  const modifyTime = el.getAttribute('ModifyTime') || undefined;
  const isFile = el.getAttribute('IsFile') === 'true';

  // 如果背景色不是默认纯白 ffffff00，则同时保留文字色与背景色，确保蓝底白字等组合对比度正常
  const hasCustomBg = rawBgColor && rawBgColor.toLowerCase() !== 'ffffff00';
  const textColor = hasCustomBg
    ? '#' + (rawTextColor || '00000000').substring(0, 6)
    : parseBooColor(rawTextColor, '00000000');
  const bgColor = parseBooColor(rawBgColor, 'ffffff00');

  // 解析子级 <item> 节点
  const children: OutlineNode[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const childEl = el.children[i];
    if (childEl.tagName.toLowerCase() === 'item') {
      children.push(parseXmlItem(childEl));
    }
  }

  return {
    id: generateNodeId(),
    content,
    icon,
    collapsed: branchAttr === 'close',
    blockWidth,
    isBold,
    showBranch,
    textColor,
    bgColor,
    modifyTime,
    isFile,
    children,
  };
}

/**
 * 解析旧版 BooguNote .boo (XML) 内容并转换为 OutlineNode 树
 */
export function parseBooXml(xmlText: string): OutlineNode[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('无效的 .boo XML 文件格式：' + parserError.textContent);
  }

  const root = xmlDoc.querySelector('root');
  if (!root) {
    throw new Error('未找到 .boo 文件根节点 <root>');
  }

  const nodes: OutlineNode[] = [];
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    if (el.tagName.toLowerCase() === 'item') {
      nodes.push(parseXmlItem(el));
    }
  }

  return nodes.length > 0
    ? nodes
    : [
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

// 转义 XML 属性值中的特殊字符及换行符
function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '&#xA;');
}

// 递归将节点序列化为 .boo XML <item>
function serializeNodeToBooXml(node: OutlineNode, level: number): string {
  const indent = '\t'.repeat(level + 1);
  const branch =
    node.children.length === 0 ? 'none' : node.collapsed ? 'close' : 'open';
  const textColor = formatBooColor(node.textColor, '00000000');
  const bgColor = formatBooColor(node.bgColor, 'ffffff00');
  const modifyAttr = node.modifyTime ? ` ModifyTime="${escapeXmlAttr(node.modifyTime)}"` : '';

  const attrs = [
    `content="${escapeXmlAttr(node.content)}"`,
    `icon="${node.icon}"`,
    `branch="${branch}"`,
    `block="${node.blockWidth}"`,
    `level="${level}"`,
    `IsShown="true"`,
    `IsBold="${node.isBold ? 'true' : 'false'}"`,
    `ShowBranch="${node.showBranch ? 'true' : 'false'}"`,
    `TextColor="${textColor}"`,
    `BkgrdColor="${bgColor}"`,
  ].join(' ');

  if (node.children.length === 0) {
    return `${indent}<item ${attrs}${modifyAttr} IsFile="${node.isFile ? 'true' : 'false'}"/>`;
  }

  const childrenXml = node.children
    .map((child) => serializeNodeToBooXml(child, level + 1))
    .join('\n');

  return `${indent}<item ${attrs}${modifyAttr} IsFile="${node.isFile ? 'true' : 'false'}">\n${childrenXml}\n${indent}</item>`;
}

/**
 * 将大纲节点树导出为兼容原版 BooguNote 的 .boo XML 格式
 */
export function exportToBooXml(nodes: OutlineNode[]): string {
  const body = nodes.map((n) => serializeNodeToBooXml(n, 0)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<root version="7" DefaultSaveDir="" DefaultSaveExtension="png">\n${body}\n</root>\n`;
}

