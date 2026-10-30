#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 Windows 内置 .NET System.Drawing GDI+ 高质量抗锯齿引擎生成 BooguNote 全平台高清应用图标：
- public/icon.png (512x512 高清 PNG)
- public/icon.ico (包含 256/128/64/48/32/16 多尺寸高清 PNG 帧的标准 Windows ICO)
- build/icon.png & build/icon.ico (供 electron-builder 打包 NSIS / Portable / DMG / AppImage 使用)
"""

import shutil
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public"
BUILD_DIR = ROOT / "build"

CS_ICON_GEN = r"""
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

class IconGenerator
{
    static GraphicsPath RoundedRect(RectangleF bounds, float radius)
    {
        float d = radius * 2f;
        GraphicsPath path = new GraphicsPath();
        path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    static Bitmap RenderIcon(int size)
    {
        Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.Clear(Color.Transparent);

            float s = size / 512f;

            // 1. 外层现代圆角矩形底座 (macOS / Win11 风格渐变蓝)
            RectangleF bgRect = new RectangleF(24f * s, 24f * s, 464f * s, 464f * s);
            using (GraphicsPath bgPath = RoundedRect(bgRect, 108f * s))
            {
                using (LinearGradientBrush bgBrush = new LinearGradientBrush(
                    bgRect,
                    Color.FromArgb(255, 37, 99, 235),   // #2563eb
                    Color.FromArgb(255, 15, 23, 42),    // #0f172a
                    135f))
                {
                    ColorBlend cb = new ColorBlend(3);
                    cb.Colors = new Color[] {
                        Color.FromArgb(255, 59, 130, 246), // #3b82f6
                        Color.FromArgb(255, 37, 99, 235),  // #2563eb
                        Color.FromArgb(255, 30, 58, 138)   // #1e3a8a
                    };
                    cb.Positions = new float[] { 0f, 0.55f, 1f };
                    bgBrush.InterpolationColors = cb;
                    g.FillPath(bgBrush, bgPath);
                }

                // 顶部柔和光泽高光
                using (Pen borderPen = new Pen(Color.FromArgb(95, 255, 255, 255), Math.Max(1.5f, 6f * s)))
                {
                    g.DrawPath(borderPen, bgPath);
                }
            }

            // 2. 绘制树形大纲 L 型连接树枝线 (代表 BooguNote 经典的闭合树枝线)
            using (Pen branchPen = new Pen(Color.FromArgb(230, 147, 197, 253), Math.Max(2f, 18f * s)))
            {
                branchPen.StartCap = LineCap.Round;
                branchPen.EndCap = LineCap.Round;
                branchPen.LineJoin = LineJoin.Round;

                float trunkX = 136f * s;
                float startY = 158f * s;
                float midY = 266f * s;
                float botY = 368f * s;
                float childX = 200f * s;

                // 垂直主干 + 中间分支
                g.DrawLine(branchPen, trunkX, startY, trunkX, botY);
                g.DrawLine(branchPen, trunkX, midY, childX, midY);
                g.DrawLine(branchPen, trunkX, botY, childX, botY);
            }

            // 3. 根文字块卡片 (顶部主节点，带琥珀金星标点缀)
            RectangleF rootCard = new RectangleF(96f * s, 102f * s, 316f * s, 76f * s);
            using (GraphicsPath rootPath = RoundedRect(rootCard, 20f * s))
            using (SolidBrush whiteBrush = new SolidBrush(Color.FromArgb(252, 255, 255, 255)))
            {
                g.FillPath(whiteBrush, rootPath);
            }
            // 根节点前的琥珀金小方块标志
            RectangleF rootDot = new RectangleF(118f * s, 124f * s, 32f * s, 32f * s);
            using (GraphicsPath dotPath = RoundedRect(rootDot, 8f * s))
            using (SolidBrush goldBrush = new SolidBrush(Color.FromArgb(255, 245, 158, 11)))
            {
                g.FillPath(goldBrush, dotPath);
            }
            // 根节点内部标题横条
            RectangleF rootLine = new RectangleF(168f * s, 129f * s, 212f * s, 22f * s);
            using (GraphicsPath linePath = RoundedRect(rootLine, 11f * s))
            using (SolidBrush darkBlueBrush = new SolidBrush(Color.FromArgb(255, 30, 64, 175)))
            {
                g.FillPath(darkBlueBrush, linePath);
            }

            // 4. 子文字块卡片 1 (中层闭合卡片)
            RectangleF childCard1 = new RectangleF(186f * s, 228f * s, 232f * s, 72f * s);
            using (GraphicsPath c1Path = RoundedRect(childCard1, 18f * s))
            using (SolidBrush c1Brush = new SolidBrush(Color.FromArgb(245, 255, 255, 255)))
            {
                g.FillPath(c1Brush, c1Path);
            }
            RectangleF c1Dot = new RectangleF(208f * s, 250f * s, 26f * s, 26f * s);
            using (GraphicsPath c1DotPath = RoundedRect(c1Dot, 6f * s))
            using (SolidBrush accentBrush = new SolidBrush(Color.FromArgb(255, 37, 99, 235)))
            {
                g.FillPath(accentBrush, c1DotPath);
            }
            RectangleF c1Line = new RectangleF(250f * s, 253f * s, 142f * s, 20f * s);
            using (GraphicsPath c1LinePath = RoundedRect(c1Line, 10f * s))
            using (SolidBrush slateBrush = new SolidBrush(Color.FromArgb(255, 51, 65, 85)))
            {
                g.FillPath(slateBrush, c1LinePath);
            }

            // 5. 子文字块卡片 2 (底层闭合卡片)
            RectangleF childCard2 = new RectangleF(186f * s, 332f * s, 232f * s, 72f * s);
            using (GraphicsPath c2Path = RoundedRect(childCard2, 18f * s))
            using (SolidBrush c2Brush = new SolidBrush(Color.FromArgb(235, 248, 250, 252)))
            {
                g.FillPath(c2Brush, c2Path);
            }
            RectangleF c2Dot = new RectangleF(208f * s, 354f * s, 26f * s, 26f * s);
            using (GraphicsPath c2DotPath = RoundedRect(c2Dot, 6f * s))
            using (SolidBrush tealBrush = new SolidBrush(Color.FromArgb(255, 16, 185, 129)))
            {
                g.FillPath(tealBrush, c2DotPath);
            }
            RectangleF c2Line = new RectangleF(250f * s, 357f * s, 124f * s, 20f * s);
            using (GraphicsPath c2LinePath = RoundedRect(c2Line, 10f * s))
            using (SolidBrush slateBrush2 = new SolidBrush(Color.FromArgb(255, 71, 85, 105)))
            {
                g.FillPath(slateBrush2, c2LinePath);
            }
        }
        return bmp;
    }

    static void Main(string[] args)
    {
        string outDir = args[0];
        int[] sizes = new int[] { 512, 256, 128, 64, 48, 32, 16 };
        foreach (int sz in sizes)
        {
            using (Bitmap bmp = RenderIcon(sz))
            {
                bmp.Save(Path.Combine(outDir, "icon_" + sz + ".png"), ImageFormat.Png);
            }
        }
    }
}
"""


def build_multi_size_ico(png_paths: list[tuple[int, Path]], ico_path: Path):
    """将多张不同分辨率的 PNG 封装为标准 Windows 高清多分辨率 .ico 文件"""
    num_images = len(png_paths)
    header = struct.pack("<HHH", 0, 1, num_images)
    offset = 6 + num_images * 16
    dir_entries = []
    payloads = []

    for size, p in png_paths:
        data = p.read_bytes()
        w_byte = 0 if size >= 256 else size
        h_byte = 0 if size >= 256 else size
        entry = struct.pack(
            "<BBBBHHII",
            w_byte,
            h_byte,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        dir_entries.append(entry)
        payloads.append(data)
        offset += len(data)

    with open(ico_path, "wb") as f:
        f.write(header)
        for e in dir_entries:
            f.write(e)
        for p in payloads:
            f.write(p)


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    cs_file = BUILD_DIR / "IconGen.cs"
    exe_file = BUILD_DIR / "IconGen.exe"
    cs_file.write_text(CS_ICON_GEN, encoding="utf-8")

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    subprocess.run(
        [csc_path, "/optimize+", f"/out:{exe_file}", "/r:System.Drawing.dll", str(cs_file)],
        check=True,
    )
    subprocess.run([str(exe_file), str(BUILD_DIR)], check=True)

    cs_file.unlink(missing_ok=True)
    exe_file.unlink(missing_ok=True)

    # 拷贝 512x512 作为主 PNG 图标
    shutil.copyfile(BUILD_DIR / "icon_512.png", PUBLIC_DIR / "icon.png")
    shutil.copyfile(BUILD_DIR / "icon_512.png", BUILD_DIR / "icon.png")

    # 组装多尺寸高清 .ico (256, 128, 64, 48, 32, 16)
    ico_sizes = [256, 128, 64, 48, 32, 16]
    png_list = [(sz, BUILD_DIR / f"icon_{sz}.png") for sz in ico_sizes]
    build_multi_size_ico(png_list, PUBLIC_DIR / "icon.ico")
    shutil.copyfile(PUBLIC_DIR / "icon.ico", BUILD_DIR / "icon.ico")

    # 清理临时尺寸文件
    for sz in [512, 256, 128, 64, 48, 32, 16]:
        (BUILD_DIR / f"icon_{sz}.png").unlink(missing_ok=True)

    # 同步更新 public/icon.svg
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="55%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bg)"/>
  <path d="M136 158 V368 M136 266 H200 M136 368 H200" stroke="#93c5fd" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="96" y="102" width="316" height="76" rx="20" fill="#ffffff"/>
  <rect x="118" y="124" width="32" height="32" rx="8" fill="#f59e0b"/>
  <rect x="168" y="129" width="212" height="22" rx="11" fill="#1e40af"/>
  <rect x="186" y="228" width="232" height="72" rx="18" fill="#ffffff" fill-opacity="0.96"/>
  <rect x="208" y="250" width="26" height="26" rx="6" fill="#2563eb"/>
  <rect x="250" y="253" width="142" height="20" rx="10" fill="#334155"/>
  <rect x="186" y="332" width="232" height="72" rx="18" fill="#f8fafc" fill-opacity="0.92"/>
  <rect x="208" y="354" width="26" height="26" rx="6" fill="#10b981"/>
  <rect x="250" y="357" width="124" height="20" rx="10" fill="#475569"/>
</svg>"""
    (PUBLIC_DIR / "icon.svg").write_text(svg_content, encoding="utf-8")
    print("[成功生成高清多尺寸图标] public/icon.ico, public/icon.png, build/icon.ico, build/icon.png")


if __name__ == "__main__":
    main()
