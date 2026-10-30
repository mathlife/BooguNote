#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成零外部依赖的 Windows 原生单文件独立可执行程序 (BooguNote-Windows-Standalone.exe)
将 dist/ 下的所有前端资源内嵌进单个 .exe 中，并集成 Win32 user32.dll 原生窗口控制宿主：
1. 默认以经典窄边框窗口 (400x600) 启动
2. 拖拽窗口贴近屏幕任意边缘（上/左/右）自动触发靠边自动隐藏（自动拦截并还原 Windows Aero Snap 放大），拖离边缘自动恢复正常窗口
3. 自动隐藏收起时使用 ShowWindow(SW_HIDE) 完全隐藏主窗口（彻底消除 Windows 最小窗口宽度导致的 136px 蓝色大方框）
4. 鼠标移入屏幕边缘隐藏处自动下拉（顶部）或滑出（左/右侧）显示窗口主体
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
        private static extern bool IsZoomed(IntPtr hWnd);

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
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const int SW_HIDE = 0;
        private const int SW_SHOW = 5;
        private const int SW_RESTORE = 9;
        private const uint WM_CLOSE = 0x0010;
        private const int VK_LBUTTON = 0x01;

        private const int DEFAULT_NARROW_WIDTH = 400;
        private const int DEFAULT_NARROW_HEIGHT = 600;
        private const int SNAP_THRESHOLD = 28;

        // 窗口停靠与隐藏状态机
        private static IntPtr appWindowHandle = IntPtr.Zero;
        private static bool initialSized = false;
        private static bool isHiddenByCommand = false;
        private static string dockMode = "normal"; // "normal" | "docked" | "auto-hide"
        private static string dockEdge = "right";  // "right" | "top" | "left"
        private static bool alwaysOnTop = false;
        private static bool isCollapsed = false;
        private static Rectangle normalBounds = new Rectangle(240, 80, DEFAULT_NARROW_WIDTH, DEFAULT_NARROW_HEIGHT);
        private static Rectangle expandedBounds = new Rectangle(240, 80, DEFAULT_NARROW_WIDTH, DEFAULT_NARROW_HEIGHT);
        private static DateTime mouseLeaveTime = DateTime.MinValue;
        private static DateTime lastExpandOrSnapTime = DateTime.MinValue;
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

            // 查找本机 Edge 或 Chrome 以独立无地址栏经典窄框窗口 (400x600) 启动
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
            if (appWindowHandle != IntPtr.Zero && (isHiddenByCommand || isCollapsed || IsWindowVisible(appWindowHandle)))
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
                    int initH = Math.Min(DEFAULT_NARROW_HEIGHT, (int)(wa.Height * 0.78));
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
            int maxSafeW = (int)(workArea.Width * 0.44);
            int rawW = (currentRect.Width > 200 && currentRect.Width < maxSafeW)
                ? currentRect.Width
                : (normalBounds.Width > 200 ? normalBounds.Width : DEFAULT_NARROW_WIDTH);
            int w = Math.Min(Math.Max(280, rawW), workArea.Width);

            int maxSafeH = (int)(workArea.Height * 0.85);
            int rawH = (currentRect.Height > 220 && currentRect.Height < maxSafeH)
                ? currentRect.Height
                : Math.Min(normalBounds.Height > 220 ? normalBounds.Height : DEFAULT_NARROW_HEIGHT, (int)(workArea.Height * 0.78));
            int h = fullHeightSidebar
                ? workArea.Height
                : Math.Min(Math.Max(300, rawH), maxSafeH);

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
                    if (isHiddenByCommand || isCollapsed)
                    {
                        isHiddenByCommand = false;
                        isCollapsed = false;
                        ShowWindow(hWnd, SW_SHOW);
                    }
                    else
                    {
                        isHiddenByCommand = true;
                        ShowWindow(hWnd, SW_HIDE);
                    }
                    return;
                }

                if (IsZoomed(hWnd))
                {
                    ShowWindow(hWnd, SW_RESTORE);
                }

                RECT rawRect;
                GetWindowRect(hWnd, out rawRect);
                Rectangle curRect = isCollapsed
                    ? expandedBounds
                    : new Rectangle(rawRect.Left, rawRect.Top, rawRect.Right - rawRect.Left, rawRect.Bottom - rawRect.Top);
                Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                if (dockMode == "normal" && !string.IsNullOrEmpty(nextMode) && nextMode != "normal")
                {
                    if (curRect.Width < workArea.Width * 0.45)
                    {
                        normalBounds = curRect;
                    }
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

                isCollapsed = false;
                isHiddenByCommand = false;
                mouseLeaveTime = DateTime.MinValue;
                lastExpandOrSnapTime = DateTime.UtcNow;
                ShowWindow(hWnd, SW_SHOW);

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

                        Point cursor = Cursor.Position;
                        bool isMouseDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;

                        if (!isCollapsed)
                        {
                            RECT r;
                            if (!GetWindowRect(hWnd, out r)) continue;
                            Rectangle winRect = new Rectangle(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
                            Rectangle workArea = Screen.FromHandle(hWnd).WorkingArea;

                            // 检测用户拖拽窗口释放时的贴边自动隐藏（含拦截 Windows 顶边/侧边 Aero Snap 放大）
                            if (wasMouseDown && !isMouseDown)
                            {
                                bool wasMaximized = IsZoomed(hWnd);
                                if (wasMaximized && cursor.Y <= workArea.Top + 36)
                                {
                                    ShowWindow(hWnd, SW_RESTORE);
                                    int w = normalBounds.Width > 200 ? normalBounds.Width : DEFAULT_NARROW_WIDTH;
                                    int h = Math.Min(normalBounds.Height > 220 ? normalBounds.Height : DEFAULT_NARROW_HEIGHT, (int)(workArea.Height * 0.78));
                                    int x = Math.Max(workArea.Left, Math.Min(cursor.X - w / 2, workArea.Right - w));
                                    expandedBounds = new Rectangle(x, workArea.Top, w, h);
                                    dockEdge = "top";
                                    dockMode = "auto-hide";
                                    lastExpandOrSnapTime = DateTime.UtcNow;
                                    SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                                }
                                else
                                {
                                    bool nearLeft = winRect.Left <= workArea.Left + SNAP_THRESHOLD || cursor.X <= workArea.Left + 14;
                                    bool nearRight = winRect.Right >= workArea.Right - SNAP_THRESHOLD || cursor.X >= workArea.Right - 14;
                                    bool nearTop = winRect.Top <= workArea.Top + SNAP_THRESHOLD || cursor.Y <= workArea.Top + 14;

                                    string detectedEdge = null;
                                    if (nearTop && cursor.Y <= workArea.Top + 48 && cursor.X > workArea.Left + 80 && cursor.X < workArea.Right - 80)
                                    {
                                        detectedEdge = "top";
                                    }
                                    else if (nearLeft && (!nearTop || cursor.X <= workArea.Left + 160))
                                    {
                                        detectedEdge = "left";
                                    }
                                    else if (nearRight && (!nearTop || cursor.X >= workArea.Right - 160))
                                    {
                                        detectedEdge = "right";
                                    }
                                    else if (nearTop)
                                    {
                                        detectedEdge = "top";
                                    }

                                    if (detectedEdge != null)
                                    {
                                        if (wasMaximized) ShowWindow(hWnd, SW_RESTORE);
                                        Rectangle baseRect = winRect;
                                        if (detectedEdge == "top" && (winRect.Width >= workArea.Width * 0.45))
                                        {
                                            int w = normalBounds.Width > 200 ? normalBounds.Width : DEFAULT_NARROW_WIDTH;
                                            baseRect = new Rectangle(cursor.X - w / 2, workArea.Top, w, normalBounds.Height);
                                        }
                                        dockEdge = detectedEdge;
                                        dockMode = "auto-hide";
                                        expandedBounds = ComputeSnappedExpandedRect(detectedEdge, workArea, baseRect, false);
                                        lastExpandOrSnapTime = DateTime.UtcNow;
                                        SetWindowPos(hWnd, HWND_TOPMOST, expandedBounds.Left, expandedBounds.Top, expandedBounds.Width, expandedBounds.Height, SWP_SHOWWINDOW);
                                    }
                                    else if (dockMode != "normal")
                                    {
                                        dockMode = "normal";
                                        IntPtr z = alwaysOnTop ? HWND_TOPMOST : HWND_NOTOPMOST;
                                        SetWindowPos(hWnd, z, winRect.Left, winRect.Top, winRect.Width, winRect.Height, SWP_SHOWWINDOW);
                                        if (winRect.Width < workArea.Width * 0.45 && winRect.Height < workArea.Height * 0.9)
                                        {
                                            normalBounds = winRect;
                                        }
                                    }
                                    else
                                    {
                                        IntPtr z = alwaysOnTop ? HWND_TOPMOST : HWND_NOTOPMOST;
                                        SetWindowPos(hWnd, z, winRect.Left, winRect.Top, winRect.Width, winRect.Height, SWP_SHOWWINDOW);
                                        if (winRect.Width < workArea.Width * 0.45 && winRect.Height < workArea.Height * 0.9)
                                        {
                                            normalBounds = winRect;
                                        }
                                    }
                                }
                            }
                        }
                        wasMouseDown = isMouseDown;

                        // 仅在 auto-hide 且未按住鼠标拖拽时执行靠边隐藏/唤醒
                        if (dockMode != "auto-hide" || isMouseDown) continue;

                        Rectangle wa = Screen.FromPoint( new Point(expandedBounds.Left + 10, expandedBounds.Top + 10) ).WorkingArea;

                        if (isCollapsed)
                        {
                            // 当前处于边缘隐藏态（窗口已通过 SW_HIDE 完全隐藏，无任何蓝色方框）：检测鼠标是否触碰屏幕边缘唤醒区
                            bool hitEdge = false;
                            if (dockEdge == "top")
                            {
                                hitEdge = cursor.Y <= wa.Top + 8 &&
                                          cursor.X >= expandedBounds.Left - 30 &&
                                          cursor.X <= expandedBounds.Right + 30;
                            }
                            else if (dockEdge == "left")
                            {
                                hitEdge = cursor.X <= wa.Left + 8 &&
                                          cursor.Y >= expandedBounds.Top - 30 &&
                                          cursor.Y <= expandedBounds.Bottom + 30;
                            }
                            else
                            {
                                hitEdge = cursor.X >= wa.Right - 8 &&
                                          cursor.Y >= expandedBounds.Top - 30 &&
                                          cursor.Y <= expandedBounds.Bottom + 30;
                            }

                            if (hitEdge)
                            {
                                isCollapsed = false;
                                mouseLeaveTime = DateTime.MinValue;
                                lastExpandOrSnapTime = DateTime.UtcNow;
                                ShowWindow(hWnd, SW_SHOW);
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
                            if ((DateTime.UtcNow - lastExpandOrSnapTime).TotalMilliseconds < 500) continue;

                            RECT curR;
                            if (!GetWindowRect(hWnd, out curR)) continue;
                            Rectangle winRect = new Rectangle(curR.Left, curR.Top, curR.Right - curR.Left, curR.Bottom - curR.Top);

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
                                else if ((DateTime.UtcNow - mouseLeaveTime).TotalMilliseconds >= 350)
                                {
                                    isCollapsed = true;
                                    mouseLeaveTime = DateTime.MinValue;
                                    // 完全隐藏主窗口，彻底消除 Windows 136px 最小窗口宽度导致的残留方框
                                    ShowWindow(hWnd, SW_HIDE);
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
