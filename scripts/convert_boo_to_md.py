#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BooguNote 批量转换脚本：将旧版 .boo (XML) 文件或目录无损转换为标准 Markdown (.md) 大纲文件
用法：
  python scripts/convert_boo_to_md.py <输入文件或目录> [输出文件或目录]
"""

import os
import sys
import json
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_boo_color(raw_color: str, default_raw: str):
    if not raw_color:
        return None
    cleaned = raw_color.strip().lower()
    if cleaned == default_raw or len(cleaned) < 6:
        return None
    return "#" + cleaned[:6]


def build_meta_comment(el: ET.Element) -> str:
    meta = {}
    icon = el.attrib.get("icon", "none")
    if icon and icon != "none":
        meta["icon"] = icon

    branch = el.attrib.get("branch", "none")
    if branch == "close":
        meta["collapsed"] = True

    block = el.attrib.get("block", "narrow")
    if block and block != "narrow":
        meta["width"] = block

    if el.attrib.get("IsBold") == "true":
        meta["bold"] = True

    if el.attrib.get("ShowBranch") == "true":
        meta["branch"] = True

    raw_bg = el.attrib.get("BkgrdColor", "ffffff00")
    raw_text = el.attrib.get("TextColor", "00000000")
    has_custom_bg = raw_bg.lower() != "ffffff00"
    text_color = (
        "#" + raw_text[:6]
        if has_custom_bg
        else parse_boo_color(raw_text, "00000000")
    )
    bg_color = parse_boo_color(raw_bg, "ffffff00")

    if text_color:
        meta["color"] = text_color
    if bg_color:
        meta["bg"] = bg_color

    modify_time = el.attrib.get("ModifyTime")
    if modify_time:
        meta["time"] = modify_time

    if not meta:
        return ""
    return f" <!-- boo:{json.dumps(meta, ensure_ascii=False, separators=(',', ':'))} -->"


def item_to_markdown(el: ET.Element, level: int = 0) -> str:
    indent = "  " * level
    sub_indent = "  " * (level + 1)
    content = el.attrib.get("content", "")
    lines = content.splitlines() or [""]
    meta_comment = build_meta_comment(el)

    first_line = f"{indent}- {lines[0]}{meta_comment if len(lines) == 1 else ''}"
    extra_lines = []
    for idx, line in enumerate(lines[1:]):
        is_last = idx == len(lines) - 2
        extra_lines.append(f"{sub_indent}{line}{meta_comment if is_last else ''}")

    self_md = "\n".join([first_line] + extra_lines)

    child_items = [c for c in el if c.tag.lower() == "item"]
    if not child_items:
        return self_md

    children_md = "\n".join(item_to_markdown(c, level + 1) for c in child_items)
    return f"{self_md}\n{children_md}"


def convert_boo_file(boo_path: Path, md_path: Path):
    tree = ET.parse(boo_path)
    root = tree.getroot()
    items = [c for c in root if c.tag.lower() == "item"]
    md_content = "\n".join(item_to_markdown(item, 0) for item in items) + "\n"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(md_content, encoding="utf-8")
    print(f"[转换成功] {boo_path} -> {md_path}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) >= 3 else None

    if src.is_file():
        out_file = dst if dst else src.with_suffix(".md")
        convert_boo_file(src, out_file)
    elif src.is_dir():
        out_dir = dst if dst else src
        for boo_file in src.rglob("*.boo"):
            rel = boo_file.relative_to(src)
            target_md = (out_dir / rel).with_suffix(".md")
            convert_boo_file(boo_file, target_md)
    else:
        print(f"未找到路径: {src}")
        sys.exit(1)


if __name__ == "__main__":
    main()

