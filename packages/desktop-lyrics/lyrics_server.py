# -*- coding: utf-8 -*-
"""
桌面字幕服务 - PyQt5 实现
选中时显示透明方框，不选中则消失
"""

import json
import sys
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

from PyQt5.QtWidgets import QApplication, QWidget, QLabel, QVBoxLayout
from PyQt5.QtCore import Qt, QPoint, QTimer, QRect
from PyQt5.QtGui import QFont, QColor, QPainter, QPen, QBrush

try:
    import websocket
    HAS_WS = True
except ImportError:
    HAS_WS = False
    print("[WARN] websocket-client not installed")

# 全局变量
window = None
visible = False


class DesktopLyricsWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.drag_pos = None
        self.resize_edge = None
        self.RESIZE_BORDER = 10
        self.selected = False  # 是否选中
        self.init_ui()

    def init_ui(self):
        """初始化界面"""
        # 窗口属性
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_Hover, True)
        self.setMouseTracking(True)

        # 窗口大小和位置
        screen = QApplication.primaryScreen().geometry()
        w, h = 900, 120
        x = (screen.width() - w) // 2
        y = screen.height() - h - 80
        self.setGeometry(x, y, w, h)

        # 布局
        layout = QVBoxLayout()
        layout.setContentsMargins(25, 20, 25, 20)

        # 默认文字
        self.default_label = QLabel("桌面字幕已就绪")
        self.default_label.setAlignment(Qt.AlignCenter)
        self.default_label.setStyleSheet("""
            QLabel {
                color: rgba(255, 255, 255, 150);
                font-size: 18px;
                letter-spacing: 3px;
                background: transparent;
                padding: 10px;
            }
        """)
        self.default_label.setFont(QFont("Microsoft YaHei", 16))
        layout.addWidget(self.default_label)

        # 字幕容器
        self.lyrics_widget = QWidget()
        self.lyrics_widget.setStyleSheet("background: transparent;")
        lyrics_layout = QVBoxLayout()
        lyrics_layout.setContentsMargins(0, 0, 0, 0)

        # 原文
        self.src_label = QLabel("")
        self.src_label.setAlignment(Qt.AlignCenter)
        self.src_label.setStyleSheet("""
            QLabel {
                color: rgba(255, 255, 255, 150);
                font-size: 16px;
                background: transparent;
                padding: 5px;
            }
        """)
        self.src_label.setFont(QFont("Microsoft YaHei", 14))
        lyrics_layout.addWidget(self.src_label)

        # 翻译
        self.tgt_label = QLabel("")
        self.tgt_label.setAlignment(Qt.AlignCenter)
        self.tgt_label.setStyleSheet("""
            QLabel {
                color: white;
                font-size: 32px;
                font-weight: bold;
                background: transparent;
                padding: 5px;
            }
        """)
        self.tgt_label.setFont(QFont("Microsoft YaHei", 28, QFont.Bold))
        lyrics_layout.addWidget(self.tgt_label)

        self.lyrics_widget.setLayout(lyrics_layout)
        self.lyrics_widget.hide()
        layout.addWidget(self.lyrics_widget)

        self.setLayout(layout)

        # 颜色方案
        self.colors = [
            "white", "#0ea5e9", "#a855f7", "#f43f5e", "#10b981", "#f59e0b"
        ]
        self.color_index = 0

    def paintEvent(self, event):
        """绘制选中方框"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # 绘制背景（半透明黑色）
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(0, 0, 0, 100)))
        painter.drawRoundedRect(self.rect(), 10, 10)

        if self.selected:
            # 选中时绘制白色边框
            pen = QPen(QColor(255, 255, 255, 100), 2, Qt.SolidLine)
            painter.setPen(pen)
            painter.setBrush(Qt.NoBrush)
            rect = self.rect().adjusted(1, 1, -1, -1)
            painter.drawRoundedRect(rect, 10, 10)

    def enterEvent(self, event):
        """鼠标进入"""
        self.selected = True
        self.update()

    def leaveEvent(self, event):
        """鼠标离开"""
        self.selected = False
        self.update()

    def update_lyrics(self, src, tgt):
        """更新字幕"""
        if not tgt:
            return
        self.default_label.hide()
        self.lyrics_widget.show()
        if src:
            self.src_label.setText(src)
        self.tgt_label.setText(tgt)

    def toggle_color(self):
        """切换颜色"""
        self.color_index = (self.color_index + 1) % len(self.colors)
        color = self.colors[self.color_index]
        self.tgt_label.setStyleSheet(f"""
            QLabel {{
                color: {color};
                font-size: 32px;
                font-weight: bold;
                background: transparent;
            }}
        """)

    def get_edge(self, pos):
        """判断鼠标在哪个边缘"""
        rect = self.rect()
        x, y = pos.x(), pos.y()
        w, h = rect.width(), rect.height()
        b = self.RESIZE_BORDER

        left = x < b
        right = x > w - b
        top = y < b
        bottom = y > h - b

        if top and left: return "top_left"
        if top and right: return "top_right"
        if bottom and left: return "bottom_left"
        if bottom and right: return "bottom_right"
        if left: return "left"
        if right: return "right"
        if top: return "top"
        if bottom: return "bottom"
        return "move"

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_pos = event.globalPos()
            self.resize_edge = self.get_edge(event.pos())
            self.resize_rect = self.geometry()

    def mouseMoveEvent(self, event):
        if self.drag_pos is None:
            # 更新光标
            edge = self.get_edge(event.pos())
            cursor_map = {
                "top_left": Qt.SizeFDiagCursor,
                "top_right": Qt.SizeBDiagCursor,
                "bottom_left": Qt.SizeBDiagCursor,
                "bottom_right": Qt.SizeFDiagCursor,
                "left": Qt.SizeHorCursor,
                "right": Qt.SizeHorCursor,
                "top": Qt.SizeVerCursor,
                "bottom": Qt.SizeVerCursor,
                "move": Qt.ArrowCursor,
            }
            self.setCursor(cursor_map.get(edge, Qt.ArrowCursor))
            return

        if event.buttons() & Qt.LeftButton:
            delta = event.globalPos() - self.drag_pos

            if self.resize_edge == "move":
                self.move(self.pos() + delta)
                self.drag_pos = event.globalPos()
            else:
                # 缩放
                geo = self.resize_rect
                x, y, w, h = geo.x(), geo.y(), geo.width(), geo.height()

                if "right" in self.resize_edge:
                    w = max(300, w + delta.x())
                if "bottom" in self.resize_edge:
                    h = max(60, h + delta.y())
                if "left" in self.resize_edge:
                    new_w = max(300, w - delta.x())
                    x = x + (w - new_w)
                    w = new_w
                if "top" in self.resize_edge:
                    new_h = max(60, h - delta.y())
                    y = y + (h - new_h)
                    h = new_h

                self.setGeometry(x, y, w, h)

    def mouseReleaseEvent(self, event):
        self.drag_pos = None
        self.resize_edge = None

    def mouseDoubleClickEvent(self, event):
        self.toggle_color()


def update_lyrics_content(src, tgt):
    """更新字幕内容"""
    global window
    if window:
        QTimer.singleShot(0, lambda: window.update_lyrics(src, tgt))


def connect_ws():
    """连接 WebSocket 网关"""
    if not HAS_WS:
        return

    def on_message(ws, message):
        try:
            msg = json.loads(message)
            if msg.get("type") == "subtitle_patch":
                payload = msg.get("payload", {})
                action = payload.get("action")
                text = payload.get("new_text", "")
                if action in ("ADD_TEMP", "MARK_FINAL") and text:
                    update_lyrics_content("", text)
        except:
            pass

    def on_open(ws):
        print("[DesktopSubtitles] Connected to gateway")

    def on_close(ws, code, msg):
        time.sleep(3)
        connect_ws()

    def run_ws():
        try:
            ws = websocket.WebSocketApp(
                "ws://localhost:3000/ws",
                on_message=on_message,
                on_open=on_open,
                on_close=on_close,
            )
            ws.run_forever()
        except:
            time.sleep(3)
            connect_ws()

    threading.Thread(target=run_ws, daemon=True).start()


def start_http_server():
    """启动 HTTP 服务器"""
    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            global visible, window
            if self.path == "/show":
                if window:
                    QTimer.singleShot(0, window.show)
                    visible = True
                self.send_json({"visible": True})
            elif self.path == "/hide":
                if window:
                    QTimer.singleShot(0, window.hide)
                    visible = False
                self.send_json({"visible": False})
            elif self.path == "/toggle":
                if visible:
                    if window:
                        QTimer.singleShot(0, window.hide)
                    visible = False
                else:
                    if window:
                        QTimer.singleShot(0, window.show)
                    visible = True
                self.send_json({"visible": visible})
            elif self.path == "/status":
                self.send_json({"visible": visible})
            else:
                self.send_response(404)
                self.end_headers()

        def send_json(self, data):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.end_headers()

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("127.0.0.1", 8765), Handler)
    print("[DesktopSubtitles] HTTP server on http://127.0.0.1:8765")
    server.serve_forever()


def main():
    global window, visible

    # 创建应用
    qapp = QApplication(sys.argv)

    # 创建窗口
    window = DesktopLyricsWindow()

    # 连接 WebSocket
    connect_ws()

    # 启动 HTTP 服务器
    threading.Thread(target=start_http_server, daemon=True).start()

    # 初始隐藏
    visible = False
    print("[DesktopSubtitles] Ready! Click button in console to show.")

    # 运行
    sys.exit(qapp.exec_())


if __name__ == "__main__":
    main()
