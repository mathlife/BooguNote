#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成零外部依赖的 Windows 原生单文件独立可执行程序 (BooguNote-Windows-Standalone.exe)
将 dist/ 下的所有前端资源内嵌进单个 .exe 中，并集成 Win32 user32.dll 原生窗口控制宿主：
1. 支持物理窗口尺寸自适应停靠（彻底消除内部蓝色留白底布）
2. 支持拖拽窗口贴近屏幕左/右/上边缘自动吸附
3. 支持靠边自动隐藏（收缩为 6px 顶层感应条，鼠标移入边缘自动下拉/滑出显示窗口主体）
"""

import base64
import glob
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
RELEASE = ROOT / "release"


def build_single_html() -> bytes:
    html = (DIST / "index.html").read_text(encoding="utf-8")

    # 内联 CSS
    for css_file in glob.glob(str(DIST / "assets" / "*.css")):
        css_text = Path(css_file).read_text(encoding="utf-8")
        html = re.sub(
            r'<link[^>]+stylesheet[^>]+>',
            lambda _: f"<style>{css_text}</style>",
            html,
        )

    # 内联 JS
    for js_file in glob.glob(str(DIST / "assets" / "*.js")):
        js_text = Path(js_file).read_text(encoding="utf-8")
        html = re.sub(
            r'<script[^>]+src="[^"]+"[^>]*></script>',
            lambda _: f'<script type="module">{js_text}</script>',
            html,
        )

    return html.encode("utf-8")


CS_TEMPLATE = r"""
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace BooguNoteStandalone
{
    static class Program
    {
        private static readonly string EmbeddedHtmlBase64 = "__BASE64_PAYLOAD__";
        private static readonly string EmbeddedIconSvgBase64 = "__ICON_BASE64__";

        // Win32 API 导入：控制独立桌面窗口尺寸、置顶与靠边自动隐藏
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const int VK_LBUTTON = 0x01;

        // 窗口停靠状态机
        private static IntPtr appWindowHandle = IntPtr.Zero;
        private static string dockMode = "normal"; // "normal" | "docked" | "auto-hide"
        private static string dockEdge = "right";  // "right" | "top" | "left"
        private static bool isCollapsed = false;
        private static Rectangle normalBounds = new Rectangle(180, 90, 1020, 780);
        private static Rectangle expandedBounds = new Rectangle(0, 0, 430, 800);
        private static DateTime mouseLeaveTime = DateTime.MinValue;
        private static bool wasMouseDown = false;
        private static readonly object stateLock = new object();

        private const int DOCK_SIDE_WIDTH = 430;
        private const int DOCK_TOP_WIDTH = 520;
        private const int DOCK_TOP_HEIGHT = 650;
        private const int PEEK_THICKNESS = 6;
        private const int SNAP_THRESHOLD = 14;

        [STAThread]
        static void Main()
        {
            byte[] htmlBytes = Convert.FromBase64String(EmbeddedHtmlBase64);
            byte[] iconBytes = Convert.FromBase64String(EmbeddedIconSvgBase64);

            // 分配空闲本地回环端口
            TcpListener portFinder = new TcpListener(IPAddress.Loopback, 0);
            portFinder.Start();
            int port = ((IPEndPoint)portFinder.LocalEndpoint).Port;
            portFinder.Stop();

            string url = "http://127.0.0.1:" + port + "/";

            HttpListener listener = new HttpListener();
            listener.Prefixes.Add(url);
            listener.Start();

            // 启动 HTTP 本地桥接服务（同时服务前端 UI 与原生窗口停靠指令）
            Thread serverThread = new Thread(() =>
            {
                while (listener.IsListening)
                {
                    try
                    {
                        var ctx = listener.GetContext();
                        string path = ctx.Request.Url.AbsolutePath;

                        if (path == "/__boogu_win_cmd")
                        {
                            string mode = ctx.Request.QueryString["mode"];
                            string edge = ctx.Request.QueryString["edge"];
                            string forceExpand = ctx.Request.QueryString["forceExpand"];
                            ApplyDockCommand(mode, edge, forceExpand == "1");
                            WriteJsonState(ctx.Response);
                        }
                        else if (path == "/__boogu_win_state")
                        {
                            WriteJsonState(ctx.Response);
                        }
                        else if (path.EndsWith(".svg"))
                        {
                            ctx.Response.ContentType = "image/svg+xml";
                            ctx.Response.ContentLength64 = iconBytes.Length;
                            ctx.Response.OutputStream.Write(iconBytes, 0, iconBytes.Length);
                            ctx.Response.OutputStream.Close();
                        }
                        else
                        {
                            ctx.Response.ContentType = "text/html; charset=utf-8";
                            ctx.Response.ContentLength64 = htmlBytes.Length;
                            ctx.Response.OutputStream.Write(htmlBytes, 0, htmlBytes.Length);
                            ctx.Response.OutputStream.Close();
                        }
                    }
                    catch
                    {
                        break;
                    }
                }
            });
            serverThread.IsBackground = true;
            serverThread.Start();

            // 启动 50ms 边缘吸附与鼠标悬停自动下拉/滑出监控线程
            Thread monitorThread = new Thread(WindowEdgeMonitorLoop);
            monitorThread.IsBackground = true;
            monitorThread.Start();

            // 查找本机 Edge 或 Chrome 以独立无地址栏 App 桌面窗口启动
            string browserExe = FindAppHostBrowser();
            if (!string.IsNullOrEmpty(browserExe))
            {
                string userDataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "BooguNoteNext_Profile"
                );
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = browserExe,
                    Arguments = string.Format("--app=\"{0}\" --window-size=1020,780 --user-data-dir=\"{1}\"", url, userDataDir),
                    UseShellExecute = false
                };
                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit();
                }
            }
            else
            {
                Process.Start(url);
                Thread.Sleep(60000);
            }

            try { listener.Stop(); } catch { }
        }

        private static void WriteJsonState(HttpListenerResponse resp)
        {
            string json;
            lock (stateLock)
            {
                json = string.Format(
                    "{{\"mode\":\"{0}\",\"edge\":\"{1}\",\"isCollapsed\":{2}}}",
                    dockMode,
                    dockEdge,
                    isCollapsed ? "true" : "false"
                );
            }
            byte[] buf = Encoding.UTF8.GetBytes(json);
            resp.ContentType = "application/json; charset=utf-8";
            resp.Headers["Cache-Control"] = "no-store";
            resp.ContentLength64 = buf.Length;
            resp.OutputStream.Write(buf, 0, buf.Length);
            resp.OutputStream.Close();
        }

        private static IntPtr EnsureAppWindowHandle()
        {
            if (appWindowHandle != IntPtr.Zero && IsWindowVisible(appWindowHandle))
            {
                return appWindowHandle;
            }
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("BooguNote"))
                {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            if (found != IntPtr.Zero)
            {
                appWindowHandle = found;
            }
            return appWindowHandle;
        }

        private static Rectangle ComputeDockedExpandedRect(string edge, Rectangle workArea, Rectangle currentRect)
        {
            if (edge == "top")
            {
                int w = Math.Min(DOCK_TOP_WIDTH, workArea.Width);
                int h = Math.Min(DOCK_TOP_HEIGHT, workArea.Height);
                int x = Math.Max(workArea.Left, Math.Min(currentRect.Left, workArea.Right - w));
                return new Rectangle(x, workArea.Top, w, h);
            }
            if (edge == "left")
            {
                int w = Math.Min(DOCK_SIDE_WIDTH, workArea.Width);
                return new Rectangle(workArea.Left, workArea.Top, w, workArea.Height);
            }
            int rw = Math.Min(DOCK_SIDE_WIDTH, workArea.Width);
            return new Rectangle(workArea.Right - rw, workArea.Top, rw, workArea.Height);
        }

        private static Rectangle ComputeCollapsedStripRect(string edge, Rectangle workArea, Rectangle expRect)
        {
            if (edge == "top")
            {
                return new Rectangle(expRect.Left, workArea.Top, expRect.Width, PEEK_THICKNESS);
            }
            if (edge == "left")
            {
                return new Rectangle(workArea.Left, expRect.Top, PEEK_THICKNESS, expRect.Height);
            }
            return new Rectangle(workArea.Right - PEEK_THICKNESS, expRect.Top, PEEK_THICKNESS, expRect.Height);
        }

        private static void ApplyDockCommand(string nextMode, string nextEdge, bool forceExpand)
        {
            lock (stateLock)
            {
                IntPtr hWnd = EnsureAppWindowHandle();
                if (hWnd == IntPtr.Zero) return;

                RECT rawRect;
                GetWindowRect(hWnd, out rawRect);
                Rectangle curRect = new Rectangle(rawRect.Left, rawRect.Top, rawRect.Right - rawRect.Left, rawRect.Bottom - rawRect.Top);
                Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                if (dockMode == "normal" && nextMode != "normal" && !string.IsNullOrEmpty(nextMode))
                {
                    normalBounds = curRect;
                }

                if (!string.IsNullOrEmpty(nextMode)) dockMode = nextMode;
                if (!string.IsNullOrEmpty(nextEdge)) dockEdge = nextEdge;

                if (dockMode == "normal")
                {
                    isCollapsed = false;
                    mouseLeaveTime = DateTime.MinValue;
                    SetWindowPos(
                        hWnd,
                        HWND_NOTOPMOST,
                        normalBounds.Left,
                        normalBounds.Top,
                        Math.Max(780, normalBounds.Width),
                        Math.Max(560, normalBounds.Height),
                        SWP_SHOWWINDOW
                    );
                    return;
                }

                // docked 或 auto-hide 模式：调整物理窗口为窄栏尺寸并贴边
                expandedBounds = ComputeDockedExpandedRect(dockEdge, workArea, curRect);
                isCollapsed = false;
                mouseLeaveTime = DateTime.MinValue;

                IntPtr zOrder = (dockMode == "auto-hide" || forceExpand) ? HWND_TOPMOST : HWND_NOTOPMOST;
                SetWindowPos(
                    hWnd,
                    zOrder,
                    expandedBounds.Left,
                    expandedBounds.Top,
                    expandedBounds.Width,
                    expandedBounds.Height,
                    SWP_SHOWWINDOW
                );
            }
        }

        private static void WindowEdgeMonitorLoop()
        {
            while (true)
            {
                Thread.Sleep(50);
                try
                {
                    lock (stateLock)
                    {
                        IntPtr hWnd = EnsureAppWindowHandle();
                        if (hWnd == IntPtr.Zero) continue;

                        RECT r;
                        if (!GetWindowRect(hWnd, out r)) continue;
                        Rectangle winRect = new Rectangle(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
                        Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                        bool isMouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;

                        // 检测用户拖拽窗口释放时的贴边自动吸附 (Edge Snap)
                        if (wasMouseDown && !isMouseDown && !isCollapsed)
                        {
                            if (Math.Abs(winRect.Top - workArea.Top) <= SNAP_THRESHOLD && winRect.Width < workArea.Width - 60)
                            {
                                if (dockMode == "normal") normalBounds = winRect;
                                dockEdge = "top";
                                dockMode = "auto-hide";
                                expandedBounds = ComputeDockedExpandedRect("top", workArea, winRect);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                            else if (Math.Abs(winRect.Right - workArea.Right) <= SNAP_THRESHOLD)
                            {
                                if (dockMode == "normal") normalBounds = winRect;
                                dockEdge = "right";
                                dockMode = "auto-hide";
                                expandedBounds = ComputeDockedExpandedRect("right", workArea, winRect);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                            else if (Math.Abs(winRect.Left - workArea.Left) <= SNAP_THRESHOLD)
                            {
                                if (dockMode == "normal") normalBounds = winRect;
                                dockEdge = "left";
                                dockMode = "auto-hide";
                                expandedBounds = ComputeDockedExpandedRect("left", workArea, winRect);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                        }
                        wasMouseDown = isMouseDown;

                        // 仅在 auto-hide 且未按住鼠标拖拽时执行靠边隐藏/唤醒
                        if (dockMode != "auto-hide" || isMouseDown) continue;

                        Point cursor = Cursor.Position;

                        if (isCollapsed)
                        {
                            // 当前处于边缘隐藏态：检测鼠标是否触碰屏幕边缘唤醒区
                            Rectangle strip = ComputeCollapsedStripRect(dockEdge, workArea, expandedBounds);
                            bool hitEdge =
                                cursor.X >= strip.Left - 8 &&
                                cursor.X <= strip.Right + 8 &&
                                cursor.Y >= strip.Top - 8 &&
                                cursor.Y <= strip.Bottom + 8;

                            if (hitEdge)
                            {
                                isCollapsed = false;
                                mouseLeaveTime = DateTime.MinValue;
                                SetWindowPos(
                                    hWnd,
                                    HWND_TOPMOST,
                                    expandedBounds.Left,
                                    expandedBounds.Top,
                                    expandedBounds.Width,
                                    expandedBounds.Height,
                                    SWP_SHOWWINDOW
                                );
                            }
                        }
                        else
                        {
                            // 当前处于展开态：同步用户可能微调过的位置并检测鼠标是否离开窗口
                            expandedBounds = ComputeDockedExpandedRect(dockEdge, workArea, winRect);
                            bool insideWindow =
                                cursor.X >= winRect.Left - 14 &&
                                cursor.X <= winRect.Right + 14 &&
                                cursor.Y >= winRect.Top - 14 &&
                                cursor.Y <= winRect.Bottom + 14;

                            if (insideWindow)
                            {
                                mouseLeaveTime = DateTime.MinValue;
                            }
                            else
                            {
                                if (mouseLeaveTime == DateTime.MinValue)
                                {
                                    mouseLeaveTime = DateTime.UtcNow;
                                }
                                else if ((DateTime.UtcNow - mouseLeaveTime).TotalMilliseconds >= 380)
                                {
                                    isCollapsed = true;
                                    mouseLeaveTime = DateTime.MinValue;
                                    Rectangle strip = ComputeCollapsedStripRect(dockEdge, workArea, expandedBounds);
                                    SetWindowPos(
                                        hWnd,
                                        HWND_TOPMOST,
                                        strip.Left,
                                        strip.Top,
                                        strip.Width,
                                        strip.Height,
                                        SWP_NOACTIVATE | SWP_SHOWWINDOW
                                    );
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // 忽略单帧 Win32 异常
                }
            }
        }

        private static string FindAppHostBrowser()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };
            foreach (string p in candidates)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }
    }
}
"""


def main():
    RELEASE.mkdir(parents=True, exist_ok=True)
    html_bytes = build_single_html()
    b64_html = base64.b64encode(html_bytes).decode("ascii")

    icon_path = ROOT / "public" / "icon.svg"
    icon_bytes = icon_path.read_bytes() if icon_path.exists() else b"<svg></svg>"
    b64_icon = base64.b64encode(icon_bytes).decode("ascii")

    cs_code = CS_TEMPLATE.replace("__BASE64_PAYLOAD__", b64_html).replace(
        "__ICON_BASE64__", b64_icon
    )

    cs_file = RELEASE / "BooguNoteHost.cs"
    exe_file = RELEASE / "BooguNote-Windows-Standalone.exe"
    cs_file.write_text(cs_code, encoding="utf-8")

    csc_path = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    cmd = [
        csc_path,
        "/target:winexe",
        "/optimize+",
        f"/out:{exe_file}",
        "/r:System.dll,System.Drawing.dll,System.Net.dll,System.Windows.Forms.dll",
        str(cs_file),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("编译失败:", res.stdout, res.stderr)
        raise SystemExit(1)

    cs_file.unlink(missing_ok=True)
    size_kb = exe_file.stat().st_size / 1024
    print(f"[成功生成独立单文件可执行程序] {exe_file} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
