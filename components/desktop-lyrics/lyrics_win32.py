# -*- coding: utf-8 -*-
"""
桌面字幕 - 企业级重构版 (OOP + 线程安全 + GDI 池化)
架构: components/desktop-lyrics/

核心改进:
  1. 全局状态封装进 DesktopLyrics 类
  2. GDI+ Brush 对象池化，避免句柄泄漏
  3. WM_UPDATE_TEXT 自定义消息，子线程不直接调 GDI
  4. Config 集中管理，便于后续接入环境变量
  5. NetworkServices 单一职责，分离网络与 UI
  6. logging 替代 print，可观测性
  7. try/except KeyboardInterrupt + finally 干净退出
"""

import json
import time
import threading
import ctypes
import ctypes.wintypes as wintypes
import logging
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Optional, Tuple, List

try:
    import websocket
    HAS_WS = True
except ImportError:
    HAS_WS = False

# ================================================================
#  日志配置
# ================================================================
logging.basicConfig(level=logging.INFO, format='[%(levelname)-5s] %(message)s')
log = logging.getLogger("LyricsWin32")

# ================================================================
#  配置管理
# ================================================================
class Config:
    WIDTH: int = 900
    HEIGHT: int = 100
    FONT_MAIN_SIZE: float = 28.0
    FONT_SUB_SIZE: float = 16.0
    FONT_FAMILY: str = "Microsoft YaHei"

    WS_URL: str = "ws://localhost:3000/ws"
    HTTP_PORT: int = 8765
    HTTP_HOST: str = "127.0.0.1"

    COLORS: List[Tuple[int, int, int]] = [
        (255, 255, 255),
        (0, 224, 158),
        (0, 194, 224),
        (167, 139, 250),
        (255, 107, 74),
        (251, 191, 36),
    ]

    DEFAULT_MAIN_TEXT: str = "桌面字幕已就绪"
    DEFAULT_SUB_TEXT: str = ""

# ================================================================
#  Win32 常量
# ================================================================
WS_POPUP           = 0x80000000
WS_EX_LAYERED      = 0x00080000
WS_EX_TRANSPARENT  = 0x00000020
WS_EX_TOPMOST      = 0x00000008
WS_EX_TOOLWINDOW   = 0x00000080

WM_NCHITTEST       = 0x0084
WM_MOUSEHOVER      = 0x02A0
WM_MOUSELEAVE      = 0x02A1
WM_LBUTTONDOWN     = 0x0201
WM_LBUTTONUP       = 0x0202
WM_LBUTTONDBLCLK   = 0x0203
WM_MOUSEMOVE       = 0x0200
WM_DESTROY         = 0x0002
WM_USER            = 0x0400
WM_UPDATE_TEXT     = WM_USER + 1   # 自定义消息: 跨线程通知渲染

HTTRANSPARENT      = -1
TME_LEAVE          = 0x00000002
AC_SRC_OVER        = 0x00
AC_SRC_ALPHA       = 0x01
SW_SHOW            = 5
SW_HIDE            = 0

# GDI+ 常量
UnitPixel = 2
StringAlignmentCenter = 0
StringLineAlignmentCenter = 1
SmoothingModeAntiAlias = 4
TextRenderingHintClearTypeGridFit = 3

# ================================================================
#  Win32 API
# ================================================================
user32  = ctypes.windll.user32
gdi32   = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# GetLastError 函数签名
kernel32.GetLastError.argtypes = []
kernel32.GetLastError.restype = wintypes.DWORD

# DefWindowProcW 函数签名
user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.DefWindowProcW.restype = ctypes.c_long
gdiplus = ctypes.windll.gdiplus


def GET_X_LPARAM(lp: int) -> int:
    return lp & 0xFFFF


def GET_Y_LPARAM(lp: int) -> int:
    return (lp >> 16) & 0xFFFF


# ================================================================
#  GDI+ 结构体
# ================================================================
class GdiplusStartupInput(ctypes.Structure):
    _fields_ = [
        ("GdiplusVersion", ctypes.c_uint),
        ("DebugEventCallback", ctypes.c_void_p),
        ("SuppressBackgroundThread", ctypes.c_bool),
        ("SuppressExternalCodecs", ctypes.c_bool),
    ]


class PointF(ctypes.Structure):
    _fields_ = [("X", ctypes.c_float), ("Y", ctypes.c_float)]


class RectF(ctypes.Structure):
    _fields_ = [
        ("X", ctypes.c_float), ("Y", ctypes.c_float),
        ("Width", ctypes.c_float), ("Height", ctypes.c_float),
    ]


class Color(ctypes.Structure):
    _fields_ = [
        ("A", ctypes.c_ubyte), ("R", ctypes.c_ubyte),
        ("G", ctypes.c_ubyte), ("B", ctypes.c_ubyte),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", ctypes.c_uint), ("biWidth", ctypes.c_int),
        ("biHeight", ctypes.c_int), ("biPlanes", ctypes.c_ushort),
        ("biBitCount", ctypes.c_ushort), ("biCompression", ctypes.c_uint),
        ("biSizeImage", ctypes.c_uint), ("biXPelsPerMeter", ctypes.c_int),
        ("biYPelsPerMeter", ctypes.c_int), ("biClrUsed", ctypes.c_uint),
        ("biClrImportant", ctypes.c_uint),
    ]


class BLENDFUNCTION(ctypes.Structure):
    _fields_ = [
        ("BlendOp", ctypes.c_byte), ("BlendFlags", ctypes.c_byte),
        ("SourceConstantAlpha", ctypes.c_byte), ("AlphaFormat", ctypes.c_byte),
    ]


class TRACKMOUSEEVENT(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint), ("dwFlags", ctypes.c_uint),
        ("hwndTrack", wintypes.HWND), ("dwHoverTime", ctypes.c_uint),
    ]


class WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.c_uint), ("style", ctypes.c_uint),
        ("lpfnWndProc", ctypes.c_void_p), ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int), ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HANDLE), ("hCursor", wintypes.HANDLE),
        ("hbrBackground", wintypes.HANDLE), ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR), ("hIconSm", wintypes.HANDLE),
    ]


# ================================================================
#  GDI+ 函数绑定
# ================================================================
_GDIPLUS_FUNCS = {
    "GdiplusStartup": [
        ctypes.POINTER(ctypes.c_ulonglong),
        ctypes.POINTER(GdiplusStartupInput),
        ctypes.c_uint, ctypes.c_void_p,
    ],
    "GdiplusShutdown": [ctypes.c_ulonglong],
    "GdipCreateBitmapFromHBITMAP": [wintypes.HBITMAP, wintypes.HANDLE, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDisposeImage": [ctypes.c_void_p],
    "GdipGetImageGraphicsContext": [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteGraphics": [ctypes.c_void_p],
    "GdipCreateSolidFill": [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteBrush": [ctypes.c_void_p],
    "GdipCreateFontFamilyFromName": [ctypes.c_wchar_p, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteFontFamily": [ctypes.c_void_p],
    "GdipCreateFont": [ctypes.c_void_p, ctypes.c_float, ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteFont": [ctypes.c_void_p],
    "GdipDrawString": [ctypes.c_void_p, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(RectF), ctypes.c_void_p, ctypes.c_void_p],
    "GdipFillRectangle": [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_float, ctypes.c_float, ctypes.c_float, ctypes.c_float],
    "GdipCreateStringFormat": [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteStringFormat": [ctypes.c_void_p],
    "GdipSetStringFormatAlign": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetStringFormatLineAlign": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetSmoothingMode": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetTextRenderingHint": [ctypes.c_void_p, ctypes.c_int],
}

for _fname, _argtypes in _GDIPLUS_FUNCS.items():
    _func = getattr(gdiplus, _fname)
    _func.argtypes = _argtypes
    _func.restype = ctypes.c_int


# ================================================================
#  GDI+ Brush 对象池
# ================================================================
class BrushPool:
    """GDI+ Brush 对象池，避免每次渲染都创建/销毁"""

    def __init__(self):
        self._brushes: dict[Tuple[int, int, int, int], ctypes.c_void_p] = {}

    def get(self, a: int, r: int, g: int, b: int) -> ctypes.c_void_p:
        key = (a, r, g, b)
        if key not in self._brushes:
            brush = ctypes.c_void_p()
            color = Color(a, r, g, b)
            gdiplus.GdipCreateSolidFill(ctypes.byref(color), ctypes.byref(brush))
            self._brushes[key] = brush
        return self._brushes[key]

    def clear(self):
        for brush in self._brushes.values():
            if brush:
                gdiplus.GdipDeleteBrush(brush)
        self._brushes.clear()


# ================================================================
#  网络服务 (单一职责)
# ================================================================
class NetworkServices:
    """WebSocket 连接 + HTTP 控制接口，与 UI 完全解耦"""

    def __init__(self, on_subtitle: callable, on_http_command: callable):
        self._on_subtitle = on_subtitle
        self._on_http_command = on_http_command
        self._ws_thread: Optional[threading.Thread] = None
        self._http_thread: Optional[threading.Thread] = None

    def start(self):
        if HAS_WS:
            self._ws_thread = threading.Thread(target=self._run_ws, daemon=True)
            self._ws_thread.start()
            log.info("WebSocket 客户端已启动 → %s", Config.WS_URL)
        else:
            log.warning("websocket-client 未安装，WebSocket 功能不可用")

        self._http_thread = threading.Thread(target=self._run_http, daemon=True)
        self._http_thread.start()
        log.info("HTTP 控制接口已启动 → http://%s:%d", Config.HTTP_HOST, Config.HTTP_PORT)

    def _run_ws(self):
        while True:
            try:
                ws = websocket.WebSocketApp(
                    Config.WS_URL,
                    on_message=self._ws_on_message,
                    on_open=lambda ws: log.info("[WS] 已连接到网关"),
                    on_close=lambda ws, code, msg: log.warning("[WS] 断开 (code=%s), 3秒后重连...", code),
                )
                ws.run_forever()
            except Exception as e:
                log.error("[WS] 连接异常: %s", e)
            time.sleep(3)

    def _ws_on_message(self, ws, message: str):
        try:
            msg = json.loads(message)
            if msg.get("type") == "subtitle_patch":
                payload = msg.get("payload", {})
                action = payload.get("action")
                text = payload.get("new_text", "")
                if action in ("ADD_TEMP", "MARK_FINAL") and text:
                    self._on_subtitle(text, action)
        except json.JSONDecodeError:
            log.debug("[WS] 非 JSON 消息: %s", message[:80])
        except Exception as e:
            log.error("[WS] 消息处理异常: %s", e)

    def _run_http(self):
        handler_cls = self._make_http_handler()
        server = HTTPServer((Config.HTTP_HOST, Config.HTTP_PORT), handler_cls)
        log.info("[HTTP] 控制接口就绪: /show /hide /toggle /status /text/xxx /color/N")
        server.serve_forever()

    def _make_http_handler(self):
        on_command = self._on_http_command

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                result = on_command(self.path)
                if result is not None:
                    self._json(result)
                else:
                    self.send_response(404)
                    self.end_headers()

            def do_OPTIONS(self):
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.end_headers()

            def _json(self, data: dict):
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

            def log_message(self, *args):
                pass  # 静默 HTTP 日志

        return Handler


# ================================================================
#  DesktopLyrics 主类
# ================================================================
class DesktopLyrics:
    """桌面字幕窗口，所有状态封装在实例内部"""

    # 类级 WNDPROC 类型（WINFUNCTYPE 是工厂，不会被 GC）
    _WNDPROC_TYPE = ctypes.WINFUNCTYPE(
        ctypes.c_long, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
    )

    def __init__(self):
        # 窗口句柄
        self._hwnd: Optional[wintypes.HWND] = None
        self._hbitmap: Optional[wintypes.HBITMAP] = None
        self._bits_ptr: Optional[ctypes.c_void_p] = None
        self._gdiplus_token = ctypes.c_ulonglong(0)

        # 位置
        self._pos_x: int = 0
        self._pos_y: int = 0

        # 文本
        self._text_main: str = Config.DEFAULT_MAIN_TEXT
        self._text_sub: str = Config.DEFAULT_SUB_TEXT

        # 交互状态
        self._click_through: bool = True
        self._hovered: bool = False
        self._dragging: bool = False
        self._drag_start_x: int = 0
        self._drag_start_y: int = 0
        self._drag_win_x: int = 0
        self._drag_win_y: int = 0
        self._visible: bool = False

        # 颜色
        self._color_idx: int = 0

        # GDI+ 对象
        self._font_family: Optional[ctypes.c_void_p] = None
        self._font_main: Optional[ctypes.c_void_p] = None
        self._font_sub: Optional[ctypes.c_void_p] = None
        self._str_format: Optional[ctypes.c_void_p] = None
        self._brush_pool = BrushPool()

        # WNDPROC 回调引用（必须在实例生命周期内保持存活）
        self._wndproc_cb: Optional[DesktopLyrics._WNDPROC_TYPE] = None

        # 渲染锁（确保渲染在主线程执行）
        self._render_lock = threading.Lock()

        # 网络服务
        self._network = NetworkServices(
            on_subtitle=self._on_subtitle,
            on_http_command=self._on_http_command,
        )

    # ---- 生命周期 ----

    def run(self):
        """主入口，阻塞在消息循环"""
        try:
            if not self._create_window():
                log.error("窗口创建失败")
                return

            self._network.start()
            log.info("首次渲染...")
            self._render_and_update()  # 先渲染内容
            log.info("显示窗口...")
            self._show()  # 再显示窗口
            self._print_ready()

            # 消息循环（主线程）
            msg = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0):
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))

        except KeyboardInterrupt:
            log.info("收到 Ctrl+C，正在退出...")
        finally:
            self._cleanup()

    def _print_ready(self):
        log.info("=" * 50)
        log.info("  桌面字幕已就绪")
        log.info("  双击窗口切换颜色，拖动移动位置")
        log.info("  鼠标移开自动穿透，移上自动可交互")
        log.info("  测试: curl http://%s:%d/show", Config.HTTP_HOST, Config.HTTP_PORT)
        log.info("=" * 50)

    def _cleanup(self):
        log.info("正在清理资源...")
        self._brush_pool.clear()
        self._cleanup_gdiplus_objects()

        if self._hbitmap:
            gdi32.DeleteObject(self._hbitmap)
            self._hbitmap = None

        gdiplus.GdiplusShutdown(self._gdiplus_token)

        if self._hwnd:
            user32.DestroyWindow(self._hwnd)
            user32.UnregisterClassW("DesktopLyrics", kernel32.GetModuleHandleW(None))
            self._hwnd = None

        log.info("清理完成")

    # ---- GDI+ 初始化 ----

    def _init_gdiplus(self):
        si = GdiplusStartupInput()
        si.GdiplusVersion = 1
        gdiplus.GdiplusStartup(
            ctypes.byref(self._gdiplus_token),
            ctypes.byref(si),
            ctypes.sizeof(si),
            None,
        )
        log.info("[GDI+] 初始化完成")

    def _create_gdiplus_objects(self):
        self._font_family = ctypes.c_void_p()
        gdiplus.GdipCreateFontFamilyFromName(Config.FONT_FAMILY, None, ctypes.byref(self._font_family))

        self._font_main = ctypes.c_void_p()
        gdiplus.GdipCreateFont(self._font_family, Config.FONT_MAIN_SIZE, 1, UnitPixel, ctypes.byref(self._font_main))

        self._font_sub = ctypes.c_void_p()
        gdiplus.GdipCreateFont(self._font_family, Config.FONT_SUB_SIZE, 0, UnitPixel, ctypes.byref(self._font_sub))

        self._str_format = ctypes.c_void_p()
        gdiplus.GdipCreateStringFormat(0, 0, ctypes.byref(self._str_format))
        gdiplus.GdipSetStringFormatAlign(self._str_format, StringAlignmentCenter)
        gdiplus.GdipSetStringFormatLineAlign(self._str_format, StringLineAlignmentCenter)

        log.info("[GDI+] 字体对象创建完成")

    def _cleanup_gdiplus_objects(self):
        for obj_ref, delete_fn, name in [
            (self._font_main, gdiplus.GdipDeleteFont, "FontMain"),
            (self._font_sub, gdiplus.GdipDeleteFont, "FontSub"),
            (self._str_format, gdiplus.GdipDeleteStringFormat, "StringFormat"),
            (self._font_family, gdiplus.GdipDeleteFontFamily, "FontFamily"),
        ]:
            if obj_ref:
                try:
                    delete_fn(obj_ref)
                except Exception:
                    log.warning("[GDI+] 释放 %s 失败", name)
        self._font_main = self._font_sub = self._str_format = self._font_family = None

    # ---- 窗口创建 ----

    def _create_window(self) -> bool:
        self._init_gdiplus()

        hinstance = kernel32.GetModuleHandleW(None)
        if not hinstance:
            log.error("GetModuleHandleW 失败, error=%d", kernel32.GetLastError())
            return False

        # WNDPROC 包装（存储为实例变量防止 GC 回收）
        self._wndproc_cb = DesktopLyrics._WNDPROC_TYPE(self._wnd_proc)

        wc = WNDCLASSEXW()
        wc.cbSize = ctypes.sizeof(WNDCLASSEXW)
        wc.lpfnWndProc = ctypes.cast(self._wndproc_cb, ctypes.c_void_p).value
        wc.hInstance = hinstance
        wc.lpszClassName = "DesktopLyrics"

        # 先尝试注销旧类（忽略错误）
        user32.UnregisterClassW("DesktopLyrics", hinstance)

        atom = user32.RegisterClassExW(ctypes.byref(wc))
        if not atom:
            err = kernel32.GetLastError()
            log.error("RegisterClassExW 失败, error=%d (1410=类已存在)", err)
            return False

        log.info("窗口类注册成功, atom=%d", atom)

        screen_w = user32.GetSystemMetrics(0)
        screen_h = user32.GetSystemMetrics(1)
        log.info("屏幕尺寸: %dx%d", screen_w, screen_h)
        self._pos_x = (screen_w - Config.WIDTH) // 2
        self._pos_y = screen_h - Config.HEIGHT - 80

        self._hwnd = user32.CreateWindowExW(
            WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
            "DesktopLyrics", "", WS_POPUP,
            self._pos_x, self._pos_y, Config.WIDTH, Config.HEIGHT,
            0, 0, hinstance, None,
        )

        if not self._hwnd:
            err = kernel32.GetLastError()
            log.error("CreateWindowExW 失败, error=%d", err)
            return False

        log.info("窗口创建成功, hwnd=%d", self._hwnd)

        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biWidth = Config.WIDTH
        bmi.biHeight = -Config.HEIGHT
        bmi.biPlanes = 1
        bmi.biBitCount = 32

        hdc = user32.GetDC(0)
        self._bits_ptr = ctypes.c_void_p()
        self._hbitmap = gdi32.CreateDIBSection(
            hdc, ctypes.byref(bmi), 0, ctypes.byref(self._bits_ptr), None, 0,
        )
        user32.ReleaseDC(0, hdc)

        if not self._hbitmap:
            log.error("CreateDIBSection 失败")
            return False

        self._create_gdiplus_objects()
        self._render_and_update()

        log.info("[OK] 窗口已创建 hwnd=%s", self._hwnd)
        return True

    # ---- 窗口过程 ----

    def _wnd_proc(self, hwnd: int, msg: int, wp: int, lp: int) -> int:
        if msg == WM_NCHITTEST:
            return HTTRANSPARENT

        elif msg == WM_MOUSEHOVER:
            self._hovered = True
            self._set_click_through(False)
            self._render_and_update()
            return 0

        elif msg == WM_MOUSELEAVE:
            if not self._dragging:
                self._hovered = False
                self._set_click_through(True)
                self._render_and_update()
            return 0

        elif msg == WM_LBUTTONDOWN:
            if not self._click_through:
                self._dragging = True
                self._drag_start_x = GET_X_LPARAM(lp)
                self._drag_start_y = GET_Y_LPARAM(lp)
                self._drag_win_x = self._pos_x
                self._drag_win_y = self._pos_y
                user32.SetCapture(hwnd)
            return 0

        elif msg == WM_MOUSEMOVE:
            if self._dragging:
                dx = GET_X_LPARAM(lp) - self._drag_start_x
                dy = GET_Y_LPARAM(lp) - self._drag_start_y
                self._pos_x = self._drag_win_x + dx
                self._pos_y = self._drag_win_y + dy
                self._update_window()
            return 0

        elif msg == WM_LBUTTONUP:
            if self._dragging:
                self._dragging = False
                user32.ReleaseCapture()
            return 0

        elif msg == WM_LBUTTONDBLCLK:
            if not self._click_through:
                self._color_idx = (self._color_idx + 1) % len(Config.COLORS)
                self._brush_pool.clear()  # 切换颜色时清空 Brush 池
                self._render_and_update()
            return 0

        elif msg == WM_UPDATE_TEXT:
            # 子线程通过 PostMessage 发来的渲染请求，主线程执行
            self._render_and_update()
            return 0

        elif msg == WM_DESTROY:
            user32.PostQuitMessage(0)
            return 0

        return user32.DefWindowProcW(
            wintypes.HWND(hwnd), wintypes.UINT(msg),
            wintypes.WPARAM(wp), wintypes.LPARAM(lp)
        )

    # ---- 鼠标穿透 ----

    def _set_click_through(self, enable: bool):
        self._click_through = enable
        style = user32.GetWindowLongW(self._hwnd, -20)
        if enable:
            style |= WS_EX_TRANSPARENT
        else:
            style &= ~WS_EX_TRANSPARENT
        user32.SetWindowLongW(self._hwnd, -20, style)

    def _track_mouse(self):
        tme = TRACKMOUSEEVENT()
        tme.cbSize = ctypes.sizeof(TRACKMOUSEEVENT)
        tme.dwFlags = TME_LEAVE
        tme.hwndTrack = self._hwnd
        tme.dwHoverTime = 1
        user32.TrackMouseEvent(ctypes.byref(tme))

    # ---- 渲染 (GDI+，仅主线程调用) ----

    def _render_lyrics(self):
        if not self._bits_ptr or not self._hbitmap or not self._font_main:
            return

        with self._render_lock:
            ctypes.memset(self._bits_ptr, 0, Config.WIDTH * Config.HEIGHT * 4)

            bitmap = ctypes.c_void_p()
            status = gdiplus.GdipCreateBitmapFromHBITMAP(self._hbitmap, None, ctypes.byref(bitmap))
            if status != 0:
                return

            graphics = ctypes.c_void_p()
            gdiplus.GdipGetImageGraphicsContext(bitmap, ctypes.byref(graphics))
            gdiplus.GdipSetSmoothingMode(graphics, SmoothingModeAntiAlias)
            gdiplus.GdipSetTextRenderingHint(graphics, TextRenderingHintClearTypeGridFit)

            # 半透明背景（让字幕更醒目）
            bg_brush = self._brush_pool.get(180, 0, 0, 0)
            gdiplus.GdipFillRectangle(graphics, bg_brush, 0.0, 0.0, float(Config.WIDTH), float(Config.HEIGHT))

            cr, cg, cb = Config.COLORS[self._color_idx % len(Config.COLORS)]

            # 文字阴影（从池获取）
            shadow_brush = self._brush_pool.get(255, 0, 0, 90)
            rect_main = RectF(24, 8, float(Config.WIDTH - 48), float(Config.HEIGHT * 0.55))
            rect_sub = RectF(24, float(Config.HEIGHT * 0.5), float(Config.WIDTH - 48), float(Config.HEIGHT * 0.45))
            shadow_main = RectF(rect_main.X + 2, rect_main.Y + 2, rect_main.Width, rect_main.Height)
            shadow_sub = RectF(rect_sub.X + 1, rect_sub.Y + 1, rect_sub.Width, rect_sub.Height)

            if self._text_main:
                gdiplus.GdipDrawString(graphics, self._text_main, -1, self._font_main,
                                       ctypes.byref(shadow_main), self._str_format, shadow_brush)
            if self._text_sub:
                gdiplus.GdipDrawString(graphics, self._text_sub, -1, self._font_sub,
                                       ctypes.byref(shadow_sub), self._str_format, shadow_brush)

            # 正式文字（从池获取）
            main_brush = self._brush_pool.get(255, cr, cg, cb)
            if self._text_main:
                gdiplus.GdipDrawString(graphics, self._text_main, -1, self._font_main,
                                       ctypes.byref(rect_main), self._str_format, main_brush)

            sub_brush = self._brush_pool.get(160, 200, 200, 200)
            if self._text_sub:
                gdiplus.GdipDrawString(graphics, self._text_sub, -1, self._font_sub,
                                       ctypes.byref(rect_sub), self._str_format, sub_brush)

            gdiplus.GdipDeleteGraphics(graphics)
            gdiplus.GdipDisposeImage(bitmap)

    def _update_window(self):
        if not self._hwnd or not self._hbitmap:
            return

        hdc = user32.GetDC(0)
        hdc_mem = gdi32.CreateCompatibleDC(hdc)
        old_bmp = gdi32.SelectObject(hdc_mem, self._hbitmap)

        blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)
        pt_src = wintypes.POINT(0, 0)
        pt_dst = wintypes.POINT(self._pos_x, self._pos_y)
        size = wintypes.SIZE(Config.WIDTH, Config.HEIGHT)

        result = user32.UpdateLayeredWindow(
            self._hwnd, hdc,
            ctypes.byref(pt_dst), ctypes.byref(size),
            hdc_mem, ctypes.byref(pt_src),
            0, ctypes.byref(blend), 2,
        )
        if not result:
            log.error("UpdateLayeredWindow 失败, error=%d", kernel32.GetLastError())

        gdi32.SelectObject(hdc_mem, old_bmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc)

    def _render_and_update(self):
        self._render_lyrics()
        self._update_window()

    # ---- 显示 / 隐藏 ----

    def _show(self):
        if self._hwnd:
            user32.ShowWindow(self._hwnd, SW_SHOW)
            user32.SetWindowPos(self._hwnd, -1, 0, 0, 0, 0, 0x0002 | 0x0001)
            self._visible = True
            self._track_mouse()

    def _hide(self):
        if self._hwnd:
            user32.ShowWindow(self._hwnd, SW_HIDE)
            self._visible = False

    def _toggle(self):
        if self._visible:
            self._hide()
        else:
            self._show()

    # ---- 文本更新（线程安全）----

    def _request_update(self):
        """子线程调用：通过 PostMessage 通知主线程渲染"""
        if self._hwnd:
            user32.PostMessageW(self._hwnd, WM_UPDATE_TEXT, 0, 0)

    def _on_subtitle(self, text: str, action: str):
        """WebSocket 字幕回调（在子线程中执行）"""
        self._text_main = text
        self._request_update()  # 不直接渲染，发消息给主线程

    # ---- HTTP 命令处理 ----

    def _on_http_command(self, path: str) -> Optional[dict]:
        if path == "/show":
            self._show()
            return {"visible": True}
        elif path == "/hide":
            self._hide()
            return {"visible": False}
        elif path == "/toggle":
            self._toggle()
            return {"visible": self._visible}
        elif path == "/status":
            return {"visible": self._visible}
        elif path.startswith("/text/"):
            text = urllib.parse.unquote(path[6:])
            self._text_main = text
            self._request_update()
            return {"ok": True, "text": text}
        elif path.startswith("/color/"):
            try:
                idx = int(path.split("/")[2]) % len(Config.COLORS)
                self._color_idx = idx
                self._brush_pool.clear()
                self._request_update()
                return {"ok": True, "color_index": idx}
            except (ValueError, IndexError):
                return {"error": "bad index"}
        return None


# ================================================================
#  入口
# ================================================================
def main():
    app = DesktopLyrics()
    app.run()


if __name__ == "__main__":
    main()
