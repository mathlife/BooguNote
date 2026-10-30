import {
  OutlineNode,
  BlockWidthMode,
  NODE_ICON_CYCLE,
  NodeIconType,
} from '../types/outline';
import { generateNodeId } from './booParser';

// 深拷贝节点树（用于 Undo/Redo 历史快照与复制粘贴）
export function cloneTree(nodes: OutlineNode[]): OutlineNode[] {
  return nodes.map((n) => ({
    ...n,
    children: cloneTree(n.children),
  }));
}

// 深拷贝并重新生成所有节点 ID（用于粘贴子树）
export function cloneTreeWithNewIds(nodes: OutlineNode[]): OutlineNode[] {
  return nodes.map((n) => ({
    ...n,
    id: generateNodeId(),
    children: cloneTreeWithNewIds(n.children),
  }));
}

// 创建一个默认空白节点
export function createEmptyNode(
  partial?: Partial<OutlineNode>
): OutlineNode {
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  return {
    id: generateNodeId(),
    content: '',
    icon: 'none',
    collapsed: false,
    blockWidth: 'narrow',
    isBold: false,
    showBranch: false,
    modifyTime: nowStr,
    children: [],
    ...partial,
  };
}

// 扁平化所有可见节点（用于上下导航与 Shift+Click 范围多选）
export interface FlatNodeItem {
  node: OutlineNode;
  level: number;
  parentId: string | null;
}

export function flattenVisibleNodes(
  nodes: OutlineNode[],
  level = 0,
  parentId: string | null = null
): FlatNodeItem[] {
  const result: FlatNodeItem[] = [];
  for (const node of nodes) {
    result.push({ node, level, parentId });
    if (!node.collapsed && node.children.length > 0) {
      result.push(...flattenVisibleNodes(node.children, level + 1, node.id));
    }
  }
  return result;
}

// 扁平化全部节点（包含已折叠隐藏的子节点，用于全文搜索与统计）
export function flattenAllNodes(
  nodes: OutlineNode[],
  level = 0,
  parentId: string | null = null
): FlatNodeItem[] {
  const result: FlatNodeItem[] = [];
  for (const node of nodes) {
    result.push({ node, level, parentId });
    if (node.children.length > 0) {
      result.push(...flattenAllNodes(node.children, level + 1, node.id));
    }
  }
  return result;
}

// 收集某节点及其所有子孙节点的 ID（用于 Alt+Click 选择整棵子树）
export function collectSubtreeIds(node: OutlineNode): string[] {
  const ids = [node.id];
  for (const child of node.children) {
    ids.push(...collectSubtreeIds(child));
  }
  return ids;
}

// 根据 ID 查找节点
export function findNodeById(
  nodes: OutlineNode[],
  id: string
): OutlineNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

// 更新单个或多个节点的属性
export function updateNodesByIds(
  nodes: OutlineNode[],
  targetIds: Set<string>,
  updater: (node: OutlineNode) => OutlineNode
): OutlineNode[] {
  return nodes.map((node) => {
    const updatedChildren =
      node.children.length > 0
        ? updateNodesByIds(node.children, targetIds, updater)
        : node.children;
    const nextNode = { ...node, children: updatedChildren };
    return targetIds.has(node.id) ? updater(nextNode) : nextNode;
  });
}

// 循环切换宽度模式：narrow -> wide -> shrink -> narrow
export function getNextBlockWidth(current: BlockWidthMode): BlockWidthMode {
  if (current === 'narrow') return 'wide';
  if (current === 'wide') return 'shrink';
  return 'narrow';
}

// 循环切换节点图标（direction: 1 下一个, -1 上一个）
export function getNextNodeIcon(
  current: NodeIconType,
  direction: 1 | -1 = 1
): NodeIconType {
  const idx = NODE_ICON_CYCLE.indexOf(current);
  const nextIdx =
    (idx + direction + NODE_ICON_CYCLE.length) % NODE_ICON_CYCLE.length;
  return NODE_ICON_CYCLE[nextIdx];
}

// 在目标节点下方新建同级文字块 (Ctrl+Enter)
export function insertSiblingAfter(
  nodes: OutlineNode[],
  targetId: string,
  newNodeOverride?: Partial<OutlineNode>
): { tree: OutlineNode[]; newNodeId: string } {
  const newNode = createEmptyNode(newNodeOverride);
  let inserted = false;

  function helper(list: OutlineNode[]): OutlineNode[] {
    const res: OutlineNode[] = [];
    for (const item of list) {
      if (item.id === targetId) {
        // 继承目标节点的块宽度模式
        newNode.blockWidth = newNodeOverride?.blockWidth ?? item.blockWidth;
        res.push(item);
        res.push(newNode);
        inserted = true;
      } else {
        res.push({
          ...item,
          children: item.children.length > 0 ? helper(item.children) : [],
        });
      }
    }
    return res;
  }

  const nextTree = helper(nodes);
  if (!inserted) {
    nextTree.push(newNode);
  }
  return { tree: nextTree, newNodeId: newNode.id };
}

// 在目标节点上方新建同级文字块 (Alt+Enter)
export function insertSiblingBefore(
  nodes: OutlineNode[],
  targetId: string
): { tree: OutlineNode[]; newNodeId: string } {
  const newNode = createEmptyNode();
  let inserted = false;

  function helper(list: OutlineNode[]): OutlineNode[] {
    const res: OutlineNode[] = [];
    for (const item of list) {
      if (item.id === targetId) {
        newNode.blockWidth = item.blockWidth;
        res.push(newNode);
        res.push(item);
        inserted = true;
      } else {
        res.push({
          ...item,
          children: item.children.length > 0 ? helper(item.children) : [],
        });
      }
    }
    return res;
  }

  const nextTree = helper(nodes);
  if (!inserted) {
    nextTree.unshift(newNode);
  }
  return { tree: nextTree, newNodeId: newNode.id };
}

// 在目标节点下新建子文字块 (Shift+Enter)
export function insertChildNode(
  nodes: OutlineNode[],
  targetId: string
): { tree: OutlineNode[]; newNodeId: string } {
  const newNode = createEmptyNode();

  function helper(list: OutlineNode[]): OutlineNode[] {
    return list.map((item) => {
      if (item.id === targetId) {
        newNode.blockWidth = item.blockWidth;
        return {
          ...item,
          collapsed: false, // 自动展开父节点
          children: [...item.children, newNode],
        };
      }
      return {
        ...item,
        children: item.children.length > 0 ? helper(item.children) : [],
      };
    });
  }

  return { tree: helper(nodes), newNodeId: newNode.id };
}

// 从光标处切割文字块 (Ctrl+\)：将光标后的文本拆分为同级下一个文字块
export function splitNodeAtCursor(
  nodes: OutlineNode[],
  targetId: string,
  cursorOffset: number
): { tree: OutlineNode[]; newNodeId: string } {
  const target = findNodeById(nodes, targetId);
  if (!target) {
    return insertSiblingAfter(nodes, targetId);
  }

  const beforeText = target.content.slice(0, cursorOffset);
  const afterText = target.content.slice(cursorOffset);

  const updatedTree = updateNodesByIds(
    nodes,
    new Set([targetId]),
    (n) => ({
      ...n,
      content: beforeText,
    })
  );

  return insertSiblingAfter(updatedTree, targetId, {
    content: afterText,
    blockWidth: target.blockWidth,
    isBold: target.isBold,
    textColor: target.textColor,
    bgColor: target.bgColor,
  });
}

// 删除指定节点集合 (Ctrl+Delete)，并返回删除后推荐聚焦的节点 ID
export function deleteNodesByIds(
  nodes: OutlineNode[],
  idsToDelete: Set<string>
): { tree: OutlineNode[]; nextFocusId: string | null } {
  const visibleBefore = flattenVisibleNodes(nodes);
  let fallbackFocusId: string | null = null;

  for (let i = 0; i < visibleBefore.length; i++) {
    if (idsToDelete.has(visibleBefore[i].node.id)) {
      // 优先找后面的非删除可见节点，否则找前面的非删除可见节点
      for (let j = i + 1; j < visibleBefore.length; j++) {
        if (!idsToDelete.has(visibleBefore[j].node.id)) {
          fallbackFocusId = visibleBefore[j].node.id;
          break;
        }
      }
      if (!fallbackFocusId) {
        for (let j = i - 1; j >= 0; j--) {
          if (!idsToDelete.has(visibleBefore[j].node.id)) {
            fallbackFocusId = visibleBefore[j].node.id;
            break;
          }
        }
      }
      break;
    }
  }

  function filterTree(list: OutlineNode[]): OutlineNode[] {
    return list
      .filter((item) => !idsToDelete.has(item.id))
      .map((item) => ({
        ...item,
        children: filterTree(item.children),
      }));
  }

  let nextTree = filterTree(nodes);
  if (nextTree.length === 0) {
    const empty = createEmptyNode();
    nextTree = [empty];
    fallbackFocusId = empty.id;
  }

  return { tree: nextTree, nextFocusId: fallbackFocusId };
}

// 向上移动节点 (Ctrl+Up)
export function moveNodeUp(
  nodes: OutlineNode[],
  targetId: string
): OutlineNode[] {
  function helper(list: OutlineNode[]): OutlineNode[] {
    const idx = list.findIndex((item) => item.id === targetId);
    if (idx > 0) {
      const next = [...list];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    }
    return list.map((item) => ({
      ...item,
      children: item.children.length > 0 ? helper(item.children) : [],
    }));
  }
  return helper(nodes);
}

// 向下移动节点 (Ctrl+Down)
export function moveNodeDown(
  nodes: OutlineNode[],
  targetId: string
): OutlineNode[] {
  function helper(list: OutlineNode[]): OutlineNode[] {
    const idx = list.findIndex((item) => item.id === targetId);
    if (idx !== -1 && idx < list.length - 1) {
      const next = [...list];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    }
    return list.map((item) => ({
      ...item,
      children: item.children.length > 0 ? helper(item.children) : [],
    }));
  }
  return helper(nodes);
}

// 向右降级节点：成为上一个同级节点的子节点 (Ctrl+Right / Tab)
export function indentNode(
  nodes: OutlineNode[],
  targetId: string
): OutlineNode[] {
  function helper(list: OutlineNode[]): OutlineNode[] {
    const idx = list.findIndex((item) => item.id === targetId);
    if (idx > 0) {
      const target = list[idx];
      const prevSibling = list[idx - 1];
      const updatedPrev: OutlineNode = {
        ...prevSibling,
        collapsed: false,
        children: [...prevSibling.children, target],
      };
      const next = [...list];
      next.splice(idx - 1, 2, updatedPrev);
      return next;
    }
    return list.map((item) => ({
      ...item,
      children: item.children.length > 0 ? helper(item.children) : [],
    }));
  }
  return helper(nodes);
}

// 向左升级节点：提升为父节点的下一个同级节点 (Ctrl+Left / Shift+Tab)
export function outdentNode(
  nodes: OutlineNode[],
  targetId: string
): OutlineNode[] {
  function helper(list: OutlineNode[]): OutlineNode[] {
    const res: OutlineNode[] = [];
    for (const item of list) {
      const childIdx = item.children.findIndex((c) => c.id === targetId);
      if (childIdx !== -1) {
        const target = item.children[childIdx];
        const remainingChildren = item.children.filter((_, i) => i !== childIdx);
        res.push({
          ...item,
          children: remainingChildren,
        });
        res.push(target);
      } else {
        res.push({
          ...item,
          children: item.children.length > 0 ? helper(item.children) : [],
        });
      }
    }
    return res;
  }
  return helper(nodes);
}

// 全局展开或折叠所有带子节点的分支
export function setAllCollapsed(
  nodes: OutlineNode[],
  collapsed: boolean
): OutlineNode[] {
  return nodes.map((n) => ({
    ...n,
    collapsed: n.children.length > 0 ? collapsed : false,
    children: setAllCollapsed(n.children, collapsed),
  }));
}

// 展开通往指定节点集合的所有祖先路径（用于搜索结果定位）
export function expandAncestorsOf(
  nodes: OutlineNode[],
  targetIds: Set<string>
): { tree: OutlineNode[]; hasTargetInSubtree: boolean } {
  let anyFound = false;
  const nextTree = nodes.map((node) => {
    const selfMatch = targetIds.has(node.id);
    const childRes = expandAncestorsOf(node.children, targetIds);
    if (selfMatch || childRes.hasTargetInSubtree) {
      anyFound = true;
    }
    return {
      ...node,
      collapsed: childRes.hasTargetInSubtree ? false : node.collapsed,
      children: childRes.tree,
    };
  });
  return { tree: nextTree, hasTargetInSubtree: anyFound };
}

