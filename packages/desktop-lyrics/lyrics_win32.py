# -*- coding: utf-8 -*-
"""
桌面字幕 - 纯 ctypes Win32 API 实现
原理：UpdateLayeredWindow + AC_SRC_ALPHA + WS_EX_TRANSPARENT
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

# ===== 常量 =====
WS_POPUP = 0x80000000
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOPMOST = 0x00000008
WS_EX_TOOLWINDOW = 0x00000080
WM_NCHITTEST = 0x0084
HTTRANSPARENT = -1
AC_SRC_OVER = 0x00
AC_SRC_ALPHA = 0x01
SW_SHOW = 5
SW_HIDE = 0

# ===== API =====
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# ===== 结构体 =====
class WNDCLASSEX(ctypes.Structure):
    _fields_ = [
        ('cbSize', ctypes.c_uint),
        ('style', ctypes.c_uint),
        ('lpfnWndProc', ctypes.c_void_p),
        ('cbClsExtra', ctypes.c_int),
        ('cbWndExtra', ctypes.c_int),
        ('hInstance', wintypes.HINSTANCE),
        ('hIcon', wintypes.HANDLE),
        ('hCursor', wintypes.HANDLE),
        ('hbrBackground', wintypes.HANDLE),
        ('lpszMenuName', wintypes.LPCWSTR),
        ('lpszClassName', wintypes.LPCWSTR),
        ('hIconSm', wintypes.HANDLE),
    ]

class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', ctypes.c_uint),
        ('biWidth', ctypes.c_int),
        ('biHeight', ctypes.c_int),
        ('biPlanes', ctypes.c_ushort),
        ('biBitCount', ctypes.c_ushort),
        ('biCompression', ctypes.c_uint),
        ('biSizeImage', ctypes.c_uint),
        ('biXPelsPerMeter', ctypes.c_int),
        ('biYPelsPerMeter', ctypes.c_int),
        ('biClrUsed', ctypes.c_uint),
        ('biClrImportant', ctypes.c_uint),
    ]

class BLENDFUNCTION(ctypes.Structure):
    _fields_ = [
        ('BlendOp', ctypes.c_byte),
        ('BlendFlags', ctypes.c_byte),
        ('SourceConstantAlpha', ctypes.c_byte),
        ('AlphaFormat', ctypes.c_byte),
    ]

# ===== 全局变量 =====
g_hwnd = None
g_hbitmap = None
g_bits_ptr = None
g_text_main = "桌面字幕已就绪"
g_text_sub = ""
g_visible = False

COLORS = [
    (255, 255, 255),
    (0, 224, 158),
    (0, 194, 224),
    (167, 139, 250),
    (255, 107, 74),
    (251, 191, 36),
]
g_color_idx = 0

W, H = 900, 100

# 窗口过程回调类型（64 位兼容）
WNDPROC = ctypes.WINFUNCTYPE(
    ctypes.c_longlong,  # LRESULT
    wintypes.HWND,      # hwnd
    wintypes.UINT,      # msg
    wintypes.WPARAM,    # wparam
    wintypes.LPARAM,    # lparam
)


def wnd_proc(hwnd, msg, wp, lp):
    if msg == WM_NCHITTEST:
        return HTTRANSPARENT
    return 0

# 保持回调引用，防止被垃圾回收
_g_wndproc = WNDPROC(wnd_proc)


def create_window():
    global g_hwnd, g_hbitmap, g_bits_ptr

    hinstance = kernel32.GetModuleHandleW(None)

    # 注册窗口类
    wc = WNDCLASSEX()
    wc.cbSize = ctypes.sizeof(WNDCLASSEX)
    wc.lpfnWndProc = ctypes.cast(_g_wndproc, ctypes.c_void_p).value
    wc.hInstance = hinstance
    wc.lpszClassName = "DesktopLyrics"
    user32.RegisterClassExW(ctypes.byref(wc))

    # 创建窗口
    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)
    x = (screen_w - W) // 2
    y = screen_h - H - 80

    g_hwnd = user32.CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
        "DesktopLyrics", "",
        WS_POPUP,
        x, y, W, H,
        0, 0, hinstance, None
    )

    # 创建 ARGB 位图
    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = W
    bmi.biHeight = -H
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    bmi.biSizeImage = W * H * 4

    hdc = user32.GetDC(0)
    g_bits_ptr = ctypes.c_void_p()
    g_hbitmap = gdi32.CreateDIBSection(
        hdc, ctypes.byref(bmi), 0,
        ctypes.byref(g_bits_ptr), None, 0
    )
    user32.ReleaseDC(0, hdc)

    if not g_hbitmap:
        print("[ERROR] CreateDIBSection failed")
        return False

    # 渲染并更新
    render_lyrics()
    update_window()

    print(f"[DesktopSubtitles] Window created: {g_hwnd}")
    return True


def render_lyrics():
    global g_text_main, g_text_sub, g_color_idx, g_bits_ptr, g_hbitmap

    if not g_bits_ptr or not g_hbitmap:
        return

    # 清空位图（Alpha=0）
    ctypes.memset(g_bits_ptr, 0, W * H * 4)

    # 创建内存 DC 并选择位图
    hdc = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc)
    old_bmp = gdi32.SelectObject(hdc_mem, g_hbitmap)

    # 设置背景透明
    gdi32.SetBkMode(hdc_mem, 1)

    # 设置文字颜色
    cr, cg, cb = COLORS[g_color_idx % len(COLORS)]
    gdi32.SetTextColor(hdc_mem, (cb << 16) | (cg << 8) | cr)

    # 创建字体并绘制主文字
    font = gdi32.CreateFontW(36, 0, 0, 0, 700, 0, 0, 0, 0, 0, 0, 0, 0, "Microsoft YaHei")
    old_font = gdi32.SelectObject(hdc_mem, font)
    rect = wintypes.RECT(10, 5, W - 10, H // 2 + 5)
    user32.DrawTextW(hdc_mem, g_text_main, -1, ctypes.byref(rect), 0x01 | 0x04 | 0x20)

    # 绘制副文字
    font_sub = gdi32.CreateFontW(22, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, "Microsoft YaHei")
    gdi32.SelectObject(hdc_mem, font_sub)
    gdi32.SetTextColor(hdc_mem, (128 << 16) | (128 << 8) | 128)
    if g_text_sub:
        rect2 = wintypes.RECT(10, H // 2, W - 10, H - 5)
        user32.DrawTextW(hdc_mem, g_text_sub, -1, ctypes.byref(rect2), 0x01 | 0x04 | 0x20)

    # 设置 Alpha 通道（GDI 不设置 Alpha，手动处理）
    ArrayType = ctypes.c_uint * (W * H)
    bits = ArrayType.from_address(g_bits_ptr.value)
    for i in range(W * H):
        if bits[i] != 0:
            bits[i] |= 0xFF000000

    # 清理
    gdi32.SelectObject(hdc_mem, old_font)
    gdi32.SelectObject(hdc_mem, old_bmp)
    gdi32.DeleteObject(font)
    gdi32.DeleteObject(font_sub)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc)


def update_window():
    global g_hwnd, g_hbitmap

    if not g_hwnd or not g_hbitmap:
        return

    hdc = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc)
    old_bmp = gdi32.SelectObject(hdc_mem, g_hbitmap)

    rect = wintypes.RECT()
    user32.GetWindowRect(g_hwnd, ctypes.byref(rect))

    blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)
    pt_src = wintypes.POINT(0, 0)
    pt_dst = wintypes.POINT(rect.left, rect.top)
    size = wintypes.SIZE(W, H)

    user32.UpdateLayeredWindow(
        g_hwnd, hdc,
        ctypes.byref(pt_dst), ctypes.byref(size),
        hdc_mem, ctypes.byref(pt_src),
        0, ctypes.byref(blend), 2
    )

    gdi32.SelectObject(hdc_mem, old_bmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc)


def show_window():
    global g_visible
    if g_hwnd:
        user32.ShowWindow(g_hwnd, SW_SHOW)
        user32.SetWindowPos(g_hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002)
        g_visible = True


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


def update_lyrics(main_text, sub_text):
    global g_text_main, g_text_sub
    g_text_main = main_text or g_text_main
    g_text_sub = sub_text or ""
    render_lyrics()
    update_window()


def set_color(idx):
    global g_color_idx
    g_color_idx = idx % len(COLORS)
    render_lyrics()
    update_window()


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
                    update_lyrics("", text)
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
    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            global g_visible
            if self.path == "/show":
                show_window()
                self.send_json({"visible": True})
            elif self.path == "/hide":
                hide_window()
                self.send_json({"visible": False})
            elif self.path == "/toggle":
                toggle_window()
                self.send_json({"visible": g_visible})
            elif self.path == "/status":
                self.send_json({"visible": g_visible})
            elif self.path.startswith("/color/"):
                try:
                    set_color(int(self.path.split("/")[2]))
                    self.send_json({"ok": True})
                except:
                    self.send_json({"error": "bad index"})
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
            self.end_headers()

        def log_message(self, *a):
            pass

    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()


def main():
    if not create_window():
        return

    connect_ws()
    threading.Thread(target=start_http_server, daemon=True).start()
    print("[DesktopSubtitles] Ready! Click button in console to show.")

    # 消息循环
    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), 0, 0, 0):
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))


if __name__ == "__main__":
    main()
