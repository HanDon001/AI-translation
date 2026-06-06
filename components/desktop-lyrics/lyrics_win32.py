# -*- coding: utf-8 -*-
"""桌面字幕 - PyQt5 版本（简单可靠）"""
import sys
import json
import time
import threading
import logging
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Optional

try:
    import websocket
    HAS_WS = True
except ImportError:
    HAS_WS = False

from PyQt5.QtWidgets import QApplication, QLabel, QWidget, QVBoxLayout, QSizeGrip
from PyQt5.QtCore import Qt, pyqtSignal, QObject
from PyQt5.QtGui import QFont, QPainter, QColor

logging.basicConfig(level=logging.INFO, format='[%(levelname)-5s] %(message)s')
log = logging.getLogger("LyricsQt")


class Config:
    WIDTH = 900
    HEIGHT = 100
    WS_URL = "ws://localhost:3000/ws"
    HTTP_PORT = 8765
    HTTP_HOST = "127.0.0.1"
    COLORS = ["#FFFFFF", "#00E09E", "#00C2E0", "#A78BFA", "#FF6B4A", "#FBBF24"]
    DEFAULT_TEXT = "桌面字幕已就绪"


class SignalBridge(QObject):
    """跨线程信号桥"""
    text_changed = pyqtSignal(str, bool)  # (text, is_final)
    color_changed = pyqtSignal(int)
    visibility_changed = pyqtSignal(bool)


class DesktopLyrics(QWidget):
    def __init__(self, signals: SignalBridge):
        super().__init__()
        self.signals = signals
        self.color_idx = 0

        # 窗口属性
        self.setWindowFlags(
            Qt.WindowStaysOnTopHint |     # 置顶
            Qt.FramelessWindowHint |      # 无边框
            Qt.Tool                       # 不在任务栏显示
        )
        self.setAttribute(Qt.WA_TranslucentBackground)  # 透明背景
        self.resize(Config.WIDTH, Config.HEIGHT)  # type: ignore[union-attr]
        self.setMinimumSize(300, 60)  # type: ignore[union-attr]

        # 居中底部
        geo = QApplication.primaryScreen().geometry()  # type: ignore[union-attr]
        self.move((geo.width() - Config.WIDTH) // 2, geo.height() - 180)

        # 布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 8, 24, 8)
        layout.setSpacing(2)

        # 上方：实时 partial 预览（快速更新）
        self.label_main = QLabel(Config.DEFAULT_TEXT)
        self.label_main.setFont(QFont("Microsoft YaHei", 22, QFont.Bold))
        self.label_main.setStyleSheet(f"color: {Config.COLORS[0]};")
        self.label_main.setAlignment(Qt.AlignCenter)
        self.label_main.setWordWrap(True)

        # 下方：精确 final 翻译（只在新 final 来时覆盖）
        self.label_sub = QLabel("")
        self.label_sub.setFont(QFont("Microsoft YaHei", 16))
        self.label_sub.setStyleSheet("color: rgba(200, 200, 200, 220);")
        self.label_sub.setAlignment(Qt.AlignCenter)
        self.label_sub.setWordWrap(True)

        layout.addWidget(self.label_main)
        layout.addWidget(self.label_sub)

        # 右下角拖拽缩放手柄（手动定位）
        self._grip = QSizeGrip(self)
        self._grip.setFixedSize(16, 16)

        # 标签设为透明，背景由 paintEvent 统一绘制
        self.label_main.setAttribute(Qt.WA_TranslucentBackground, False)
        self.label_main.setStyleSheet(f"background: transparent; color: {Config.COLORS[0]};")
        self.label_sub.setStyleSheet("background: transparent; color: rgba(200, 200, 200, 220);")

        # 连接信号
        self.signals.text_changed.connect(self._on_text_changed)  # type: ignore[arg-type]
        self.signals.color_changed.connect(self._on_color_changed)
        self.signals.visibility_changed.connect(self._on_visibility_changed)

        # 鼠标拖动
        self._drag_pos = None
        self.setMouseTracking(True)

    def _on_text_changed(self, text: str, is_final: bool = False):
        if is_final:
            # 最终精确翻译 → 下方覆盖显示，清空上方预览
            self.label_sub.setText(text)
            self.label_main.setText("")
        else:
            # 实时 partial → 上方累积预览（不超过20字）
            current = self.label_main.text()
            if current and len(current) < 20:
                self.label_main.setText(current + "，" + text)
            else:
                self.label_main.setText(text)
        self._adjust_height()

    def _adjust_height(self):
        """根据文字内容自动调整窗口高度（宽度保持不变）"""
        self.setMinimumHeight(0)
        hint = self.sizeHint()  # type: ignore[union-attr]
        new_h = max(Config.HEIGHT, hint.height())
        self.resize(self.width(), new_h)  # type: ignore[union-attr]  # noqa: E501

    def _on_color_changed(self, idx: int):
        self.color_idx = idx % len(Config.COLORS)
        self.label_main.setStyleSheet(f"color: {Config.COLORS[self.color_idx]};")

    def _on_visibility_changed(self, visible: bool):
        if visible:
            self.show()
        else:
            self.hide()

    # ---- 拖动：始终可拖，无需 click-through 切换 ----

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPos() - self.pos()

    def mouseMoveEvent(self, event):
        if self._drag_pos:
            self.move(event.globalPos() - self._drag_pos)

    def mouseReleaseEvent(self, event):
        self._drag_pos = None

    def mouseDoubleClickEvent(self, event):
        self.signals.color_changed.emit(self.color_idx + 1)

    def resizeEvent(self, _event):
        """窗口大小变化时，把手柄定位到右下角"""
        self._grip.move(self.width() - 16, self.height() - 16)  # type: ignore[union-attr]

    def paintEvent(self, _event):
        """绘制统一的半透明黑色圆角背景"""
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setBrush(QColor(0, 0, 0, 180))
        p.setPen(Qt.NoPen)
        p.drawRoundedRect(self.rect(), 8, 8)
        p.end()


class NetworkServices:
    def __init__(self, signals: SignalBridge, on_http: callable):
        self.signals = signals
        self._on_http = on_http
        self._visible = True

    def start(self):
        if HAS_WS:
            threading.Thread(target=self._run_ws, daemon=True).start()
        threading.Thread(target=self._run_http, daemon=True).start()
        log.info("HTTP → http://%s:%d", Config.HTTP_HOST, Config.HTTP_PORT)

    def _run_ws(self):
        while True:
            try:
                ws = websocket.WebSocketApp(
                    Config.WS_URL,
                    on_message=lambda ws, msg: self._handle_ws(msg),
                    on_open=lambda ws: log.info("[WS] 已连接"),
                    on_close=lambda ws, c, m: time.sleep(3),
                )
                ws.run_forever()
            except:
                time.sleep(3)

    def _handle_ws(self, msg: str):
        try:
            data = json.loads(msg)
            if data.get("type") == "subtitle_patch":
                payload = data.get("payload", {})
                text = payload.get("new_text", "")
                is_final = payload.get("action") == "MARK_FINAL"
                if text:
                    self.signals.text_changed.emit(text, is_final)
        except:
            pass

    def _run_http(self):
        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                result = self.server._handler(self.path)
                if result:
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    self.end_headers()
                    self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
                else:
                    self.send_response(404)
                    self.end_headers()
            def do_OPTIONS(self):
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
            def log_message(self, *a): pass

        server = HTTPServer((Config.HTTP_HOST, Config.HTTP_PORT), Handler)
        server._handler = self._handle_http
        server.serve_forever()

    def _handle_http(self, path: str) -> Optional[dict]:
        if path == "/show":
            self._visible = True
            self.signals.visibility_changed.emit(True)
            return {"visible": True}
        elif path == "/hide":
            self._visible = False
            self.signals.visibility_changed.emit(False)
            return {"visible": False}
        elif path == "/toggle":
            self._visible = not self._visible
            self.signals.visibility_changed.emit(self._visible)
            return {"visible": self._visible}
        elif path == "/status":
            return {"visible": self._visible}
        elif path.startswith("/text/"):
            text = urllib.parse.unquote(path[6:])
            self.signals.text_changed.emit(text)
            return {"ok": True, "text": text}
        elif path.startswith("/color/"):
            try:
                idx = int(path.split("/")[2])
                self.signals.color_changed.emit(idx)
                return {"ok": True}
            except:
                return {"error": "bad index"}
        return None


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出程序

    signals = SignalBridge()
    window = DesktopLyrics(signals)
    window.show()

    network = NetworkServices(signals, None)
    network.start()

    log.info("=" * 40)
    log.info("  桌面字幕已就绪")
    log.info("  拖动移动位置 | 双击切换颜色")
    log.info("=" * 40)

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
