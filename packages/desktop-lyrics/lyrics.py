# -*- coding: utf-8 -*-
"""
桌面字幕 - 使用 Win32 API 实现真正的透明窗口
原理：无边框 + UpdateLayeredWindow 逐像素透明 + 鼠标穿透 + 置顶
"""

import json
import threading
import websocket
import ctypes
from ctypes import wintypes
import win32gui
import win32con
import win32api
import tkinter as tk
from tkinter import font as tkfont

# Win32 常量
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOPMOST = 0x00000008
WS_EX_TOOLWINDOW = 0x00000080
LWA_ALPHA = 0x00000002
LWA_COLORKEY = 0x00000001

# 颜色方案
COLORS = [
    {"name": "白色", "fg": "#ffffff", "shadow": "#000000"},
    {"name": "蓝色", "fg": "#0ea5e9", "shadow": "#000000"},
    {"name": "紫色", "fg": "#a855f7", "shadow": "#000000"},
    {"name": "红色", "fg": "#f43f5e", "shadow": "#000000"},
    {"name": "绿色", "fg": "#10b981", "shadow": "#000000"},
    {"name": "黄色", "fg": "#f59e0b", "shadow": "#000000"},
]


class DesktopLyrics:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("桌面字幕")

        # 窗口配置
        self.window_width = 900
        self.window_height = 100
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width - self.window_width) // 2
        y = screen_height - self.window_height - 80

        self.root.geometry(f"{self.window_width}x{self.window_height}+{x}+{y}")
        self.root.overrideredirect(True)  # 无边框
        self.root.attributes("-topmost", True)  # 置顶
        self.root.attributes("-transparentcolor", "#010101")  # 透明背景色
        self.root.configure(bg="#010101")  # 背景色（会被透明）

        # 当前颜色
        self.color_index = 0
        self.current_fg = COLORS[0]["fg"]
        self.current_shadow = COLORS[0]["shadow"]

        # 字体
        self.tgt_font = tkfont.Font(family="Microsoft YaHei", size=28, weight="bold")
        self.src_font = tkfont.Font(family="Microsoft YaHei", size=14)

        # UI 元素
        self.setup_ui()

        # Win32 设置
        self.root.update_idletasks()
        self.setup_win32()

        # 拖动
        self.drag_data = {"x": 0, "y": 0}
        self.root.bind("<Button-1>", self.start_drag)
        self.root.bind("<B1-Motion>", self.do_drag)
        self.root.bind("<Double-Button-1>", self.toggle_style)

        # WebSocket
        self.ws = None
        self.ws_thread = None
        self.connect_ws()

    def setup_ui(self):
        """设置 UI"""
        # 主容器
        self.container = tk.Frame(self.root, bg="#010101")
        self.container.pack(fill=tk.BOTH, expand=True)

        # 默认文字
        self.default_label = tk.Label(
            self.container,
            text="还未选择翻译页面",
            font=tkfont.Font(family="Microsoft YaHei", size=16),
            fg="#666666",
            bg="#010101",
        )
        self.default_label.pack(expand=True)

        # 字幕容器（初始隐藏）
        self.lyrics_frame = tk.Frame(self.container, bg="#010101")

        # 原文
        self.src_label = tk.Label(
            self.lyrics_frame,
            text="",
            font=self.src_font,
            fg="#888888",
            bg="#010101",
        )
        self.src_label.pack()

        # 翻译
        self.tgt_label = tk.Label(
            self.lyrics_frame,
            text="",
            font=self.tgt_font,
            fg=self.current_fg,
            bg="#010101",
        )
        self.tgt_label.pack()

    def setup_win32(self):
        """Win32 窗口设置"""
        hwnd = self.root.winfo_id()

        # 设置扩展样式：分层 + 鼠标穿透 + 工具窗口
        style = win32gui.GetWindowLong(hwnd, GWL_EXSTYLE)
        style = style | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW
        win32gui.SetWindowLong(hwnd, GWL_EXSTYLE, style)

        # 设置分层窗口属性（完全不透明）
        win32gui.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)

    def start_drag(self, event):
        """开始拖动"""
        self.drag_data["x"] = event.x
        self.drag_data["y"] = event.y

    def do_drag(self, event):
        """拖动窗口"""
        dx = event.x - self.drag_data["x"]
        dy = event.y - self.drag_data["y"]
        x = self.root.winfo_x() + dx
        y = self.root.winfo_y() + dy
        self.root.geometry(f"+{x}+{y}")

    def toggle_style(self, event):
        """切换颜色样式"""
        self.color_index = (self.color_index + 1) % len(COLORS)
        color = COLORS[self.color_index]
        self.current_fg = color["fg"]
        self.current_shadow = color["shadow"]
        self.tgt_label.configure(fg=self.current_fg)

    def update_lyrics(self, src, tgt):
        """更新字幕"""
        if not tgt:
            return

        # 隐藏默认文字，显示字幕
        self.default_label.pack_forget()
        self.lyrics_frame.pack(expand=True)

        if src:
            self.src_label.configure(text=src)
        self.tgt_label.configure(text=tgt)

    def connect_ws(self):
        """连接 WebSocket 网关"""
        def on_message(ws, message):
            try:
                msg = json.loads(message)
                if msg.get("type") == "subtitle_patch":
                    payload = msg.get("payload", {})
                    action = payload.get("action")
                    text = payload.get("new_text", "")
                    if action in ("ADD_TEMP", "MARK_FINAL") and text:
                        self.root.after(0, lambda: self.update_lyrics("", text))
            except:
                pass

        def on_open(ws):
            print("[DesktopSubtitles] Connected to gateway")

        def on_close(ws, close_status_code, close_msg):
            print("[DesktopSubtitles] Disconnected, reconnecting...")
            import time
            time.sleep(3)
            self.connect_ws()

        def run_ws():
            try:
                self.ws = websocket.WebSocketApp(
                    "ws://localhost:3000/ws",
                    on_message=on_message,
                    on_open=on_open,
                    on_close=on_close,
                )
                self.ws.run_forever()
            except:
                import time
                time.sleep(3)
                self.connect_ws()

        self.ws_thread = threading.Thread(target=run_ws, daemon=True)
        self.ws_thread.start()

    def run(self):
        """运行"""
        self.root.mainloop()


if __name__ == "__main__":
    app = DesktopLyrics()
    app.run()
