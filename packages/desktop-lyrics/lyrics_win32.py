# -*- coding: utf-8 -*-
"""
桌面字幕 - Win32 + GDI+ 优化版
修复：GDI+ 渲染（正确 Alpha）+ 动态鼠标穿透 + 手动拖动 + 文字阴影
"""

import json
import time
import threading
import ctypes
import ctypes.wintypes as wintypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

try:
    import websocket
    HAS_WS = True
except ImportError:
    HAS_WS = False
    print("[WARN] websocket-client 未安装，WebSocket 功能不可用")

# ================================================================
#  Win32 常量
# ================================================================
WS_POPUP          = 0x80000000
WS_EX_LAYERED      = 0x00080000
WS_EX_TRANSPARENT  = 0x00000020
WS_EX_TOPMOST      = 0x00000008
WS_EX_TOOLWINDOW   = 0x00000080

WM_NCHITTEST      = 0x0084
WM_MOUSEHOVER     = 0x02A0
WM_MOUSELEAVE     = 0x02A1
WM_LBUTTONDOWN    = 0x0201
WM_LBUTTONUP      = 0x0202
WM_LBUTTONDBLCLK  = 0x0203
WM_MOUSEMOVE      = 0x0200

HTTRANSPARENT     = -1
TME_LEAVE         = 0x00000002

AC_SRC_OVER       = 0x00
AC_SRC_ALPHA       = 0x01

SW_SHOW           = 5
SW_HIDE           = 0

# ================================================================
#  Win32 API
# ================================================================
user32  = ctypes.windll.user32
gdi32  = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32
gdiplus = ctypes.windll.gdiplus

def GET_X_LPARAM(lp):
    return lp & 0xFFFF

def GET_Y_LPARAM(lp):
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
        ("A", ctypes.c_ubyte),
        ("R", ctypes.c_ubyte),
        ("G", ctypes.c_ubyte),
        ("B", ctypes.c_ubyte),
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
_gdiplus_funcs = {
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
    "GdipCreateStringFormat": [ctypes.c_int, ctypes.c_int, ctypes.POINTER(ctypes.c_void_p)],
    "GdipDeleteStringFormat": [ctypes.c_void_p],
    "GdipSetStringFormatAlign": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetStringFormatLineAlign": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetSmoothingMode": [ctypes.c_void_p, ctypes.c_int],
    "GdipSetTextRenderingHint": [ctypes.c_void_p, ctypes.c_int],
}

for fname, argtypes in _gdiplus_funcs.items():
    func = getattr(gdiplus, fname)
    func.argtypes = argtypes
    func.restype = ctypes.c_int  # GpStatus = int

# GDI+ 常量
UnitPixel = 2
StringAlignmentCenter = 0
StringLineAlignmentCenter = 1
SmoothingModeAntiAlias = 4
TextRenderingHintClearTypeGridFit = 3

# ================================================================
#  全局状态
# ================================================================
W, H = 900, 100

g_hwnd = None
g_hbitmap = None
g_bits_ptr = None
g_gdiplus_token = ctypes.c_ulonglong(0)

# 位置（UpdateLayeredWindow 的 pt_dst 决定窗口位置）
g_pos_x = 0
g_pos_y = 0

# 歌词
g_text_main = "桌面字幕已就绪"
g_text_sub = ""

# 交互状态
g_click_through = True   # 默认鼠标穿透
g_hovered = False        # 鼠标是否在窗口上
g_dragging = False       # 是否正在拖动
g_drag_start_x = 0
g_drag_start_y = 0
g_drag_win_x = 0
g_drag_win_y = 0
g_visible = False

# 颜色
COLORS = [
    (255, 255, 255),   # 白
    (0, 224, 158),     # 青
    (0, 194, 224),     # 蓝
    (167, 139, 250),   # 紫
    (255, 107, 74),    # 红
    (251, 191, 36),    # 黄
]
g_color_idx = 0

# 缓存的 GDI+ 对象（避免每次渲染都重新创建）
g_font_family = None
g_font_main = None
g_font_sub = None
g_str_format = None

# ================================================================
#  窗口过程
# ================================================================
WNDPROC = ctypes.WINFUNCTYPE(
    ctypes.c_long, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
)

def wnd_proc(hwnd, msg, wp, lp):
    global g_hovered, g_click_through, g_dragging
    global g_drag_start_x, g_drag_start_y, g_drag_win_x, g_drag_win_y
    global g_pos_x, g_pos_y, g_color_idx

    if msg == WM_NCHITTEST:
        return HTTRANSPARENT

    elif msg == WM_MOUSEHOVER:
        g_hovered = True
        set_click_through(False)
        render_lyrics()
        update_window()
        return 0

    elif msg == WM_MOUSELEAVE:
        if g_dragging:
            pass
        else:
            g_hovered = False
            set_click_through(True)
            render_lyrics()
            update_window()
        return 0

    elif msg == WM_LBUTTONDOWN:
        if not g_click_through:
            g_dragging = True
            g_drag_start_x = GET_X_LPARAM(lp)
            g_drag_start_y = GET_Y_LPARAM(lp)
            g_drag_win_x = g_pos_x
            g_drag_win_y = g_pos_y
            user32.SetCapture(hwnd)
        return 0

    elif msg == WM_MOUSEMOVE:
        if g_dragging:
            dx = GET_X_LPARAM(lp) - g_drag_start_x
            dy = GET_Y_LPARAM(lp) - g_drag_start_y
            g_pos_x = g_drag_win_x + dx
            g_pos_y = g_drag_win_y + dy
            update_window()
        return 0

    elif msg == WM_LBUTTONUP:
        if g_dragging:
            g_dragging = False
            user32.ReleaseCapture()
        return 0

    elif msg == WM_LBUTTONDBLCLK:
        if not g_click_through:
            g_color_idx = (g_color_idx + 1) % len(COLORS)
            render_lyrics()
            update_window()
        return 0

    return 0

_g_wndproc = WNDPROC(wnd_proc)

# ================================================================
#  鼠标穿透切换
# ================================================================
def set_click_through(enable):
    global g_click_through
    g_click_through = enable
    style = user32.GetWindowLongW(g_hwnd, -20)
    if enable:
        style |= WS_EX_TRANSPARENT
    else:
        style &= ~WS_EX_TRANSPARENT
    user32.SetWindowLongW(g_hwnd, -20, style)

def track_mouse():
    tme = TRACKMOUSEEVENT()
    tme.cbSize = ctypes.sizeof(TRACKMOUSEEVENT)
    tme.dwFlags = TME_LEAVE
    tme.hwndTrack = g_hwnd
    tme.dwHoverTime = 1
    user32.TrackMouseEvent(ctypes.byref(tme))

# ================================================================
#  GDI+ 初始化
# ================================================================
def init_gdiplus():
    si = GdiplusStartupInput()
    si.GdiplusVersion = 1
    gdiplus.GdiplusStartup(
        ctypes.byref(g_gdiplus_token),
        ctypes.byref(si),
        ctypes.sizeof(si),
        None,
    )
    print("[GDI+] 初始化完成")

def create_gdiplus_objects():
    global g_font_family, g_font_main, g_font_sub, g_str_format

    g_font_family = ctypes.c_void_p()
    gdiplus.GdipCreateFontFamilyFromName("Microsoft YaHei", None, ctypes.byref(g_font_family))

    g_font_main = ctypes.c_void_p()
    gdiplus.GdipCreateFont(g_font_family, 28.0, 1, UnitPixel, ctypes.byref(g_font_main))

    g_font_sub = ctypes.c_void_p()
    gdiplus.GdipCreateFont(g_font_family, 16.0, 0, UnitPixel, ctypes.byref(g_font_sub))

    g_str_format = ctypes.c_void_p()
    gdiplus.GdipCreateStringFormat(0, 0, ctypes.byref(g_str_format))
    gdiplus.GdipSetStringFormatAlign(g_str_format, StringAlignmentCenter)
    gdiplus.GdipSetStringFormatLineAlign(g_str_format, StringLineAlignmentCenter)

    print("[GDI+] 字体对象创建完成")

def cleanup_gdiplus_objects():
    global g_font_family, g_font_main, g_font_sub, g_str_format
    if g_font_main:
        gdiplus.GdipDeleteFont(g_font_main); g_font_main = None
    if g_font_sub:
        gdiplus.GdipDeleteFont(g_font_sub); g_font_sub = None
    if g_str_format:
        gdiplus.GdipDeleteStringFormat(g_str_format); g_str_format = None
    if g_font_family:
        gdiplus.GdipDeleteFontFamily(g_font_family); g_font_family = None

# ================================================================
#  窗口创建
# ================================================================
def create_window():
    global g_hwnd, g_hbitmap, g_bits_ptr, g_pos_x, g_pos_y

    init_gdiplus()

    hinstance = kernel32.GetModuleHandleW(None)

    wc = WNDCLASSEXW()
    wc.cbSize = ctypes.sizeof(WNDCLASSEXW)
    wc.lpfnWndProc = ctypes.cast(_g_wndproc, ctypes.c_void_p).value
    wc.hInstance = hinstance
    wc.lpszClassName = "DesktopLyrics"
    user32.RegisterClassExW(ctypes.byref(wc))

    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)
    g_pos_x = (screen_w - W) // 2
    g_pos_y = screen_h - H - 80

    g_hwnd = user32.CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
        "DesktopLyrics", "", WS_POPUP,
        g_pos_x, g_pos_y, W, H,
        0, 0, hinstance, None,
    )

    if not g_hwnd:
        print("[ERROR] CreateWindowExW 失败")
        return False

    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = W
    bmi.biHeight = -H
    bmi.biPlanes = 1
    bmi.biBitCount = 32

    hdc = user32.GetDC(0)
    g_bits_ptr = ctypes.c_void_p()
    g_hbitmap = gdi32.CreateDIBSection(
        hdc, ctypes.byref(bmi), 0, ctypes.byref(g_bits_ptr), None, 0,
    )
    user32.ReleaseDC(0, hdc)

    if not g_hbitmap:
        print("[ERROR] CreateDIBSection 失败")
        return False

    create_gdiplus_objects()
    render_lyrics()
    update_window()

    print(f"[OK] 窗口已创建 hwnd={g_hwnd}")
    return True

# ================================================================
#  渲染（GDI+）
# ================================================================
def render_lyrics():
    if not g_bits_ptr or not g_hbitmap or not g_font_main:
        return

    ctypes.memset(g_bits_ptr, 0, W * H * 4)

    bitmap = ctypes.c_void_p()
    status = gdiplus.GdipCreateBitmapFromHBITMAP(g_hbitmap, None, ctypes.byref(bitmap))
    if status != 0:
        return

    graphics = ctypes.c_void_p()
    gdiplus.GdipGetImageGraphicsContext(bitmap, ctypes.byref(graphics))
    gdiplus.GdipSetSmoothingMode(graphics, SmoothingModeAntiAlias)
    gdiplus.GdipSetTextRenderingHint(graphics, TextRenderingHintClearTypeGridFit)

    cr, cg, cb = COLORS[g_color_idx % len(COLORS)]

    # 文字阴影
    shadow_brush = ctypes.c_void_p()
    shadow_color = Color(0, 0, 0, 90)
    gdiplus.GdipCreateSolidFill(ctypes.byref(shadow_color), ctypes.byref(shadow_brush))

    rect_main = RectF(24, 8, float(W - 48), float(H * 0.55))
    rect_sub = RectF(24, float(H * 0.5), float(W - 48), float(H * 0.45))

    shadow_rect_main = RectF(rect_main.X + 2, rect_main.Y + 2, rect_main.Width, rect_main.Height)
    shadow_rect_sub = RectF(rect_sub.X + 1, rect_sub.Y + 1, rect_sub.Width, rect_sub.Height)

    main_text = g_text_main
    if main_text:
        gdiplus.GdipDrawString(graphics, main_text, -1, g_font_main,
                               ctypes.byref(shadow_rect_main), g_str_format, shadow_brush)

    if g_text_sub:
        gdiplus.GdipDrawString(graphics, g_text_sub, -1, g_font_sub,
                               ctypes.byref(shadow_rect_sub), g_str_format, shadow_brush)

    gdiplus.GdipDeleteBrush(shadow_brush)

    # 正式文字
    main_brush = ctypes.c_void_p()
    main_color = Color(255, cr, cg, cb)
    gdiplus.GdipCreateSolidFill(ctypes.byref(main_color), ctypes.byref(main_brush))

    if main_text:
        gdiplus.GdipDrawString(graphics, main_text, -1, g_font_main,
                               ctypes.byref(rect_main), g_str_format, main_brush)

    sub_brush = ctypes.c_void_p()
    sub_color = Color(160, 200, 200, 200)
    gdiplus.GdipCreateSolidFill(ctypes.byref(sub_color), ctypes.byref(sub_brush))

    if g_text_sub:
        gdiplus.GdipDrawString(graphics, g_text_sub, -1, g_font_sub,
                               ctypes.byref(rect_sub), g_str_format, sub_brush)

    gdiplus.GdipDeleteBrush(main_brush)
    gdiplus.GdipDeleteBrush(sub_brush)

    gdiplus.GdipDeleteGraphics(graphics)
    gdiplus.GdipDisposeImage(bitmap)

# ================================================================
#  更新窗口
# ================================================================
def update_window():
    if not g_hwnd or not g_hbitmap:
        return

    hdc = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc)
    old_bmp = gdi32.SelectObject(hdc_mem, g_hbitmap)

    blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)
    pt_src = wintypes.POINT(0, 0)
    pt_dst = wintypes.POINT(g_pos_x, g_pos_y)
    size = wintypes.SIZE(W, H)

    user32.UpdateLayeredWindow(
        g_hwnd, hdc,
        ctypes.byref(pt_dst), ctypes.byref(size),
        hdc_mem, ctypes.byref(pt_src),
        0, ctypes.byref(blend), 2,
    )

    gdi32.SelectObject(hdc_mem, old_bmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc)

# ================================================================
#  显示 / 隐藏
# ================================================================
def show_window():
    global g_visible
    if g_hwnd:
        user32.ShowWindow(g_hwnd, SW_SHOW)
        user32.SetWindowPos(g_hwnd, -1, 0, 0, 0, 0, 0x0002 | 0x0001)
        g_visible = True
        track_mouse()

def hide_window():
    global g_visible
    if g_hwnd:
        user32.ShowWindow(g_hwnd, SW_HIDE)
        g_visible = False

def toggle_window():
    if g_visible:
        hide_window()
    else:
        show_window()

# ================================================================
#  歌词更新
# ================================================================
def update_lyrics(main_text, sub_text):
    global g_text_main, g_text_sub
    if main_text:
        g_text_main = main_text
    if sub_text is not None:
        g_text_sub = sub_text
    render_lyrics()
    update_window()

# ================================================================
#  WebSocket
# ================================================================
def connect_ws():
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
                    update_lyrics(text, "")
        except Exception:
            pass

    def on_open(ws):
        print("[WS] 已连接到网关")

    def on_close(ws, code, msg):
        print(f"[WS] 断开，3秒后重连...")
        time.sleep(3)
        connect_ws()

    def run_ws():
        while True:
            try:
                ws = websocket.WebSocketApp(
                    "ws://localhost:3000/ws",
                    on_message=on_message,
                    on_open=on_open,
                    on_close=on_close,
                )
                ws.run_forever()
            except Exception:
                time.sleep(3)

    threading.Thread(target=run_ws, daemon=True).start()

# ================================================================
#  HTTP 控制接口
# ================================================================
def start_http_server():
    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            global g_visible
            if self.path == "/show":
                show_window()
                self._json({"visible": True})
            elif self.path == "/hide":
                hide_window()
                self._json({"visible": False})
            elif self.path == "/toggle":
                toggle_window()
                self._json({"visible": g_visible})
            elif self.path == "/status":
                self._json({"visible": g_visible})
            elif self.path.startswith("/text/"):
                text = self.path[6:]
                try:
                    text = urllib.parse.unquote(text)
                except Exception:
                    pass
                update_lyrics(text, "")
                self._json({"ok": True, "text": text})
            elif self.path.startswith("/color/"):
                try:
                    global g_color_idx
                    g_color_idx = int(self.path.split("/")[2]) % len(COLORS)
                    render_lyrics()
                    update_window()
                    self._json({"ok": True, "color_index": g_color_idx})
                except Exception:
                    self._json({"error": "bad index"})
            else:
                self.send_response(404)
                self.end_headers()

        def _json(self, data):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.end_headers()

        def log_message(self, *args):
            pass

    import urllib.parse
    server = HTTPServer(("127.0.0.1", 8765), Handler)
    print("[HTTP] 控制接口: http://127.0.0.1:8765")
    print("       /show  /hide  /toggle  /status")
    print("       /text/你好世界  /color/0~5")
    server.serve_forever()

# ================================================================
#  主函数
# ================================================================
def main():
    if not create_window():
        print("[ERROR] 初始化失败")
        return

    connect_ws()
    threading.Thread(target=start_http_server, daemon=True).start()

    print()
    print("=" * 50)
    print("  桌面字幕已就绪")
    print("  双击窗口切换颜色，拖动移动位置")
    print("  鼠标移开自动穿透，移上自动可交互")
    print("  测试: curl http://127.0.0.1:8765/show")
    print("=" * 50)

    # 消息循环
    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0):
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))

    # 清理
    cleanup_gdiplus_objects()
    gdiplus.GdiplusShutdown(g_gdiplus_token)
    if g_hbitmap:
        gdi32.DeleteObject(g_hbitmap)

if __name__ == "__main__":
    main()
