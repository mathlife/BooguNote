#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成零外部依赖的 Windows 原生单文件独立可执行程序 (BooguNote-Standalone.exe)
将 dist/ 下的所有前端资源内嵌进单个 .exe 中，双击即以独立桌面应用窗口启动，无需 Node 或任何外部服务。
"""

import base64
import glob
import os
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
        import re
        html = re.sub(
            r'<link[^>]+stylesheet[^>]+>',
            lambda _: f"<style>{css_text}</style>",
            html,
        )

    # 内联 JS
    for js_file in glob.glob(str(DIST / "assets" / "*.js")):
        js_text = Path(js_file).read_text(encoding="utf-8")
        import re
        html = re.sub(
            r'<script[^>]+src="[^"]+"[^>]*></script>',
            lambda _: f'<script type="module">{js_text}</script>',
            html,
        )

    return html.encode("utf-8")


CS_TEMPLATE = r"""
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace BooguNoteStandalone
{
    static class Program
    {
        private static readonly string EmbeddedHtmlBase64 = "__BASE64_PAYLOAD__";
        private static readonly string EmbeddedIconSvgBase64 = "__ICON_BASE64__";

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

            Thread serverThread = new Thread(() =>
            {
                while (listener.IsListening)
                {
                    try
                    {
                        var ctx = listener.GetContext();
                        string path = ctx.Request.Url.AbsolutePath;
                        if (path.EndsWith(".svg"))
                        {
                            ctx.Response.ContentType = "image/svg+xml";
                            ctx.Response.ContentLength64 = iconBytes.Length;
                            ctx.Response.OutputStream.Write(iconBytes, 0, iconBytes.Length);
                        }
                        else
                        {
                            ctx.Response.ContentType = "text/html; charset=utf-8";
                            ctx.Response.ContentLength64 = htmlBytes.Length;
                            ctx.Response.OutputStream.Write(htmlBytes, 0, htmlBytes.Length);
                        }
                        ctx.Response.OutputStream.Close();
                    }
                    catch
                    {
                        break;
                    }
                }
            });
            serverThread.IsBackground = true;
            serverThread.Start();

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
        "/r:System.dll,System.Net.dll,System.Windows.Forms.dll",
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
