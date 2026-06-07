# ADR-002: 保留 Python 实现桌面字幕

## 状态

已采纳（已从 Win32 API 迁移至 PyQt5）

## 背景

桌面字幕需要在 Windows 上实现悬浮置顶、半透明无边框窗口，要求：
- 始终在所有窗口最上层（包括全屏应用）
- 背景半透明，文字清晰可见
- 支持拖动、缩放、颜色切换
- 不依赖 Electron 等重型框架

## 决策

保留 Python 实现，使用 **PyQt5** 作为 GUI 框架（最初使用 Win32 API + ctypes，后迁移至 PyQt5）。

## 演变历程

| 阶段 | 方案 | 问题 |
|------|------|------|
| V1 | Python ctypes + Win32 API | 渲染不稳定，文字闪烁，难以维护 |
| V2 | Python + PyQt5 | 稳定可靠，代码量减半，功能更丰富 |

## 为什么不用其他方案

| 方案 | 问题 |
|------|------|
| Java (Swing/JavaFX) | 无法实现真正的透明置顶窗口，JNA 调用 Win32 API 复杂度高 |
| Electron | 包体积 200MB+，内存占用高，过度设计 |
| C# WPF | 需要 .NET 运行时，与项目其他技术栈不一致 |
| 纯 Web (Browser Popup) | 无法始终置顶于全屏应用上方 |

## PyQt5 方案优势

1. **原生窗口能力**：`Qt.WindowStaysOnTopHint` + `Qt.FramelessWindowHint` + `Qt.WA_TranslucentBackground` 原生支持
2. **跨平台**：PyQt5 同样支持 macOS/Linux，未来可扩展
3. **代码简洁**：~370 行 Python 完成完整桌面字幕功能
4. **独立 sidecar**：通过 WebSocket 接收翻译，HTTP API 接受控制指令，与主系统松耦合
5. **QPainter 渲染**：自绘圆角背景，比 CSS 样式更可靠

## 架构

```
Gateway (Node.js) ──WebSocket──→ lyrics_win32.py (Python)
                                 │
                                 ├── Qt GUI 线程 (PyQt5)
                                 │   ├── DesktopLyrics (QWidget)
                                 │   ├── SignalBridge (跨线程信号)
                                 │   ├── StopButton (暂停/恢复)
                                 │   └── CloseButton (隐藏窗口)
                                 │
                                 ├── WebSocket 线程 (websocket-client)
                                 │   └── 接收 subtitle_patch → emit 信号
                                 │
                                 └── HTTP 线程 (http.server)
                                     └── /show /hide /toggle /text/ /color/
```

## 后果

- **正面**：桌面字幕功能稳定可靠，代码可维护，体验优于 Win32 API 版本
- **正面**：通过 HTTP API 与主系统通信，不改动主架构
- **负面**：需要 Python 3.10+ 和 PyQt5 依赖（`pip install PyQt5 websocket-client`）
- **缓解**：`start.bat` 自动安装依赖，`start-lyrics.vbs` 静默启动无控制台窗口
