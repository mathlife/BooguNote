#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成零外部依赖的 Windows 原生单文件独立可执行程序 (BooguNote-Windows-Standalone.exe)
将 dist/ 下的所有前端资源内嵌进单个 .exe 中，并集成 Win32 user32.dll 原生窗口控制宿主：
1. 默认以经典窄边框窗口 (400x680) 启动
2. 拖拽窗口贴近屏幕任意边缘（上/左/右）自动触发靠边自动隐藏，拖离边缘自动恢复正常窗口
3. 鼠标移出窗口自动收缩为 6px 顶层感应条，鼠标移入屏幕边缘自动下拉/滑出显示窗口主体
4. 完整支持右上角主菜单的【正常窗口 / 靠边窗口 / 自动隐藏窗口 / 隐藏显示 / 置顶 / 打开默认目录 / 退出】
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
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

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
        private const int SW_HIDE = 0;
        private const int SW_SHOW = 5;
        private const uint WM_CLOSE = 0x0010;
        private const int VK_LBUTTON = 0x01;

        private const int DEFAULT_NARROW_WIDTH = 400;
        private const int DEFAULT_NARROW_HEIGHT = 680;
        private const int PEEK_THICKNESS = 6;
        private const int SNAP_THRESHOLD = 16;

        // 窗口停靠与隐藏状态机
        private static IntPtr appWindowHandle = IntPtr.Zero;
        private static bool initialSized = false;
        private static bool isHiddenByCommand = false;
        private static string dockMode = "normal"; // "normal" | "docked" | "auto-hide"
        private static string dockEdge = "right";  // "right" | "top" | "left"
        private static bool alwaysOnTop = false;
        private static bool isCollapsed = false;
        private static Rectangle normalBounds = new Rectangle(240, 100, DEFAULT_NARROW_WIDTH, DEFAULT_NARROW_HEIGHT);
        private static Rectangle expandedBounds = new Rectangle(240, 100, DEFAULT_NARROW_WIDTH, DEFAULT_NARROW_HEIGHT);
        private static DateTime mouseLeaveTime = DateTime.MinValue;
        private static bool wasMouseDown = false;
        private static readonly object stateLock = new object();

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

            // 启动 HTTP 本地桥接服务（同时服务前端 UI 与原生窗口控制指令）
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
                            string topStr = ctx.Request.QueryString["alwaysOnTop"];
                            string action = ctx.Request.QueryString["action"];
                            ApplyDockCommand(mode, edge, topStr, action);
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

            // 查找本机 Edge 或 Chrome 以独立无地址栏经典窄框窗口 (400x680) 启动
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
                    Arguments = string.Format("--app=\"{0}\" --window-size={1},{2} --user-data-dir=\"{3}\"", url, DEFAULT_NARROW_WIDTH, DEFAULT_NARROW_HEIGHT, userDataDir),
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
                    "{{\"mode\":\"{0}\",\"edge\":\"{1}\",\"alwaysOnTop\":{2},\"isCollapsed\":{3}}}",
                    dockMode,
                    dockEdge,
                    alwaysOnTop ? "true" : "false",
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
            if (appWindowHandle != IntPtr.Zero && (isHiddenByCommand || IsWindowVisible(appWindowHandle)))
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
                if (!initialSized)
                {
                    initialSized = true;
                    Rectangle wa = Screen.FromHandle(found).WorkingArea;
                    int initW = DEFAULT_NARROW_WIDTH;
                    int initH = Math.Min(DEFAULT_NARROW_HEIGHT, wa.Height - 60);
                    int initX = wa.Right - initW - 72;
                    int initY = wa.Top + (wa.Height - initH) / 2;
                    normalBounds = new Rectangle(initX, initY, initW, initH);
                    expandedBounds = normalBounds;
                    SetWindowPos(found, HWND_NOTOPMOST, initX, initY, initW, initH, SWP_SHOWWINDOW);
                }
            }
            return appWindowHandle;
        }

        private static string DetectNearestEdge(Rectangle bounds, Rectangle workArea)
        {
            int distTop = Math.Abs(bounds.Top - workArea.Top);
            int distLeft = Math.Abs(bounds.Left - workArea.Left);
            int distRight = Math.Abs(workArea.Right - bounds.Right);
            if (distTop <= distLeft && distTop <= distRight && distTop <= 80)
            {
                return "top";
            }
            return distLeft < distRight ? "left" : "right";
        }

        private static Rectangle ComputeSnappedExpandedRect(string edge, Rectangle workArea, Rectangle currentRect, bool fullHeightSidebar)
        {
            int w = Math.Min(Math.Max(280, currentRect.Width > 50 ? currentRect.Width : DEFAULT_NARROW_WIDTH), workArea.Width);
            int h = fullHeightSidebar
                ? workArea.Height
                : Math.Min(Math.Max(300, currentRect.Height > 50 ? currentRect.Height : DEFAULT_NARROW_HEIGHT), workArea.Height);

            if (edge == "top")
            {
                int x = Math.Max(workArea.Left, Math.Min(currentRect.Left, workArea.Right - w));
                return new Rectangle(x, workArea.Top, w, h);
            }

            int y = fullHeightSidebar
                ? workArea.Top
                : Math.Max(workArea.Top, Math.Min(currentRect.Top, workArea.Bottom - h));

            if (edge == "left")
            {
                return new Rectangle(workArea.Left, y, w, h);
            }
            return new Rectangle(workArea.Right - w, y, w, h);
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

        private static void ApplyDockCommand(string nextMode, string nextEdge, string topStr, string action)
        {
            lock (stateLock)
            {
                IntPtr hWnd = EnsureAppWindowHandle();

                if (action == "open-default-dir")
                {
                    try { Process.Start(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments)); } catch { }
                    return;
                }

                if (action == "quit-app")
                {
                    if (hWnd != IntPtr.Zero)
                    {
                        SendMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    }
                    Environment.Exit(0);
                    return;
                }

                if (hWnd == IntPtr.Zero) return;

                if (action == "toggle-hide-window")
                {
                    if (isHiddenByCommand)
                    {
                        isHiddenByCommand = false;
                        ShowWindow(hWnd, SW_SHOW);
                    }
                    else
                    {
                        isHiddenByCommand = true;
                        ShowWindow(hWnd, SW_HIDE);
                    }
                    return;
                }

                RECT rawRect;
                GetWindowRect(hWnd, out rawRect);
                Rectangle curRect = isCollapsed
                    ? expandedBounds
                    : new Rectangle(rawRect.Left, rawRect.Top, rawRect.Right - rawRect.Left, rawRect.Bottom - rawRect.Top);
                Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                if (dockMode == "normal" && !string.IsNullOrEmpty(nextMode) && nextMode != "normal")
                {
                    normalBounds = curRect;
                }

                if (!string.IsNullOrEmpty(nextEdge))
                {
                    dockEdge = nextEdge;
                }
                else if (dockMode == "normal" && !string.IsNullOrEmpty(nextMode) && nextMode != "normal")
                {
                    dockEdge = DetectNearestEdge(curRect, workArea);
                }

                if (!string.IsNullOrEmpty(nextMode))
                {
                    dockMode = nextMode;
                }

                if (!string.IsNullOrEmpty(topStr))
                {
                    alwaysOnTop = (topStr == "1" || topStr == "true");
                }
                else if (dockMode != "normal")
                {
                    alwaysOnTop = true;
                }

                isCollapsed = false;
                mouseLeaveTime = DateTime.MinValue;

                if (dockMode == "normal")
                {
                    IntPtr z = alwaysOnTop ? HWND_TOPMOST : HWND_NOTOPMOST;
                    SetWindowPos(
                        hWnd,
                        z,
                        normalBounds.Left,
                        normalBounds.Top,
                        Math.Max(280, normalBounds.Width),
                        Math.Max(300, normalBounds.Height),
                        SWP_SHOWWINDOW
                    );
                    return;
                }

                bool fullSidebar = (dockMode == "docked");
                if (fullSidebar && dockEdge == "top") dockEdge = "right";

                expandedBounds = ComputeSnappedExpandedRect(dockEdge, workArea, curRect, fullSidebar);
                IntPtr zOrder = (dockMode == "auto-hide" || alwaysOnTop) ? HWND_TOPMOST : HWND_NOTOPMOST;
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
                        if (hWnd == IntPtr.Zero || isHiddenByCommand) continue;

                        RECT r;
                        if (!GetWindowRect(hWnd, out r)) continue;
                        Rectangle winRect = new Rectangle(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
                        Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                        bool isMouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;

                        // 检测用户拖拽窗口释放时的贴边自动隐藏 (Edge Snap) 与拖离边缘恢复
                        if (wasMouseDown && !isMouseDown && !isCollapsed)
                        {
                            bool nearTop = Math.Abs(winRect.Top - workArea.Top) <= SNAP_THRESHOLD && Math.Abs(winRect.Height - workArea.Height) > 30;
                            bool nearLeft = Math.Abs(winRect.Left - workArea.Left) <= SNAP_THRESHOLD;
                            bool nearRight = Math.Abs(winRect.Right - workArea.Right) <= SNAP_THRESHOLD;

                            if (nearTop)
                            {
                                if (dockMode == "normal") normalBounds = new Rectangle(winRect.Left, workArea.Top + 36, winRect.Width, winRect.Height);
                                dockEdge = "top";
                                dockMode = "auto-hide";
                                alwaysOnTop = true;
                                expandedBounds = ComputeSnappedExpandedRect("top", workArea, winRect, false);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                            else if (nearLeft)
                            {
                                if (dockMode == "normal") normalBounds = new Rectangle(workArea.Left + 36, winRect.Top, winRect.Width, winRect.Height);
                                dockEdge = "left";
                                dockMode = "auto-hide";
                                alwaysOnTop = true;
                                expandedBounds = ComputeSnappedExpandedRect("left", workArea, winRect, false);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                            else if (nearRight)
                            {
                                if (dockMode == "normal") normalBounds = new Rectangle(workArea.Right - winRect.Width - 36, winRect.Top, winRect.Width, winRect.Height);
                                dockEdge = "right";
                                dockMode = "auto-hide";
                                alwaysOnTop = true;
                                expandedBounds = ComputeSnappedExpandedRect("right", workArea, winRect, false);
                                SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                            }
                            else if (dockMode != "normal")
                            {
                                // 用户把窗口从屏幕边缘拖回屏幕中央：自动解除自动隐藏，恢复为正常窗口
                                dockMode = "normal";
                                normalBounds = winRect;
                            }
                            else
                            {
                                normalBounds = winRect;
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
                            // 当前处于展开态：同步用户可能微调过的窄框尺寸并检测鼠标是否离开窗口
                            expandedBounds = ComputeSnappedExpandedRect(dockEdge, workArea, winRect, false);
                            bool insideWindow =
                                cursor.X >= winRect.Left - 12 &&
                                cursor.X <= winRect.Right + 12 &&
                                cursor.Y >= winRect.Top - 12 &&
                                cursor.Y <= winRect.Bottom + 12;

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
                                else if ((DateTime.UtcNow - mouseLeaveTime).TotalMilliseconds >= 360)
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
