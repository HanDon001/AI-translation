# LiveTranslate - 实时同声传译系统

> 基于 Qwen-LiveTranslate 的实时语音翻译系统，支持麦克风/标签页音频捕获、实时翻译、桌面悬浮字幕

## 📁 项目目录结构

```
同声传译助手/
├── packages/                          # pnpm monorepo 工作区
│   ├── web/                          # 前端控制台（React + Vite）
│   ├── gateway/                      # 后端网关（Fastify + WebSocket）
│   ├── desktop-lyrics/               # 桌面字幕（Python + Win32 API）
│   ├── shared/                       # 共享类型和工具
│   ├── asr-engine/                   # ASR 引擎（预留）
│   └── translator/                   # 翻译器（预留）
├── start.bat                          # 一键启动脚本
├── pnpm-workspace.yaml               # pnpm 工作区配置
├── package.json                       # 根 package.json
└── README.md                          # 本文档
```

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  官网页面     │  │  控制台页面   │  │  桌面字幕按钮 │       │
│  │ landing.html │  │  index.html  │  │              │       │
│  └──────────────┘  └──────┬───────┘  └──────┬───────┘       │
│                           │ WebSocket        │ HTTP          │
└───────────────────────────┼──────────────────┼───────────────┘
                            │                  │
┌───────────────────────────┼──────────────────┼───────────────┐
│                      网关服务器               │               │
│  ┌────────────────────────▼──────────┐  ┌────▼────────────┐  │
│  │         wsHandler.ts              │  │ lyrics_win32.py │  │
│  │  - 接收音频数据                    │  │ - Win32 透明窗口│  │
│  │  - 调用 Qwen ASR                  │  │ - 鼠标穿透      │  │
│  │  - 返回翻译结果                    │  │ - HTTP API      │  │
│  └────────────────────────────────────┘  └─────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────┐                       │
│  │       QwenASRService.ts            │                       │
│  │  - 连接 DashScope WebSocket        │                       │
│  │  - 发送音频，接收翻译               │                       │
│  └────────────────────────────────────┘                       │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                    DashScope API                               │
│  wss://dashscope.aliyuncs.com/api-ws/v1/realtime              │
│  模型: qwen3.5-livetranslate-flash-realtime                    │
└───────────────────────────────────────────────────────────────┘
```

---

## 📦 模块详解

### 1. packages/web - 前端控制台

**技术栈**: React 18 + TypeScript + Vite + Tailwind CSS

**目录结构**:
```
packages/web/
├── index.html                 # 控制台入口
├── landing.html               # SaaS 官网页面
├── vite.config.ts             # Vite 配置（多页面）
├── package.json
├── tsconfig.json
├── src/
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 主组件（核心逻辑）
│   ├── components/
│   │   ├── Topbar.tsx         # 顶栏（模式切换、语言选择、状态）
│   │   ├── ConfigPanel.tsx    # 配置面板（API Key、语言）
│   │   ├── PipelineSteps.tsx  # 处理管道可视化
│   │   ├── ResultsPanel.tsx   # 翻译结果展示
│   │   ├── Waveform.tsx       # 波形可视化（Canvas）
│   │   ├── LogPanel.tsx       # 实时日志面板
│   │   ├── Toast.tsx          # Toast 通知
│   │   └── SubtitleDisplay.tsx # 字幕显示组件
│   ├── hooks/
│   │   ├── useWebSocket.ts    # WebSocket 连接 Hook
│   │   ├── useAudioWorklet.ts # 音频捕获 Hook（AudioWorklet）
│   │   ├── useSpeechRecognition.ts # Web Speech API Hook
│   │   ├── usePipelineSteps.ts # 管道状态 Hook
│   │   └── useConsoleLog.ts   # 日志系统 Hook
│   ├── workers/
│   │   └── audio-processor.worklet.ts # AudioWorklet 处理器
│   └── styles/
│       ├── index.css          # Tailwind 入口
│       └── console.css        # 控制台自定义样式
└── dist/                      # 构建输出
```

**核心功能**:
- 麦克风模式：使用 Web Speech API 进行语音识别
- 标签页模式：捕获标签页音频，发送到网关处理
- 实时翻译：通过 MyMemory API（麦克风）或网关（标签页）
- 桌面字幕：调用本地 Python 服务显示悬浮字幕

**关键代码 - App.tsx**:
```typescript
// 桌面字幕按钮点击事件
onClick={async () => {
  try {
    const resp = await fetch('http://127.0.0.1:8765/toggle');
    const data = await resp.json();
    showToast('ok', data.visible ? '桌面字幕已显示' : '桌面字幕已隐藏');
  } catch {
    showToast('err', '桌面字幕服务未启动，请先运行 start.bat');
  }
}}
```

---

### 2. packages/gateway - 后端网关

**技术栈**: Fastify + WebSocket + TypeScript

**目录结构**:
```
packages/gateway/
├── src/
│   ├── index.ts               # 服务入口
│   ├── handlers/
│   │   └── wsHandler.ts       # WebSocket 消息处理
│   ├── services/
│   │   ├── QwenASRService.ts  # Qwen 实时翻译服务
│   │   ├── asrService.ts      # ASR 服务（预留）
│   │   ├── translatorService.ts # 翻译服务
│   │   └── ttsService.ts      # TTS 服务
│   ├── core/
│   │   └── WaitKScheduler.ts  # Wait-K 调度器
│   ├── config/
│   │   └── env.ts             # 环境配置
│   ├── middleware/
│   │   ├── errorHandler.ts    # 错误处理
│   │   └── requestLogger.ts   # 请求日志
│   ├── routes/
│   │   ├── health.ts          # 健康检查
│   │   └── tts.ts             # TTS 路由
│   └── logger/
│       └── index.ts           # 日志配置
├── package.json
└── tsconfig.json
```

**核心功能**:
- WebSocket 服务：接收前端音频数据
- Qwen ASR 集成：调用 DashScope API 进行实时翻译
- Mock 模式：无 API Key 时使用模拟数据

**wsHandler.ts 核心逻辑**:
```typescript
// 接收音频块
if (isAudioChunk(msg)) {
  const { window_id, pcm_data } = msg.payload;
  
  // 无 API Key 时使用 Mock
  if (!connState.apiKey) {
    handleTranslateEvent({ type: 'FINAL', text: MOCK_SCRIPT[idx] });
    return;
  }
  
  // 有 API Key 时调用 Qwen ASR
  if (!connState.asrSession) {
    connState.asrSession = createQwenASRSession({
      apiKey: connState.apiKey,
      targetLang: 'zh',
      onEvent: handleTranslateEvent,
    });
  }
  connState.asrSession.sendAudio(pcm_data);
}
```

**QwenASRService.ts 核心逻辑**:
```typescript
// 连接 DashScope WebSocket
const ws = new WebSocket(
  `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

// 会话配置
ws.send(JSON.stringify({
  type: 'session.update',
  session: {
    modalities: ['text'],
    input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
    translation: { language: targetLang },
  },
}));

// 接收翻译结果
if (type === 'response.text.text') {
  onEvent({ type: 'CHUNK', text: msg.text + msg.stash });
}
```

---

### 3. packages/desktop-lyrics - 桌面字幕

**技术栈**: Python + Win32 API (ctypes)

**目录结构**:
```
packages/desktop-lyrics/
├── lyrics_win32.py            # 主实现（纯 ctypes Win32 API）
├── lyrics_server.py           # PyQt5 版本（备用）
├── lyrics.py                  # tkinter 版本（备用）
├── lyrics.html                # HTML 版本（浏览器弹窗）
├── main.js                    # Electron 版本（未成功）
├── requirements.txt           # Python 依赖
└── package.json               # Node.js 配置（Electron 用）
```

**Win32 API 实现原理**:
```
┌─────────────────────────────────────────────────────────┐
│  桌面歌词核心：四个 Win32 特性叠加                         │
├─────────────────────────────────────────────────────────┤
│  1. WS_POPUP           → 无边框窗口                      │
│  2. WS_EX_LAYERED      → 分层窗口（启用 Alpha 通道）       │
│  3. AC_SRC_ALPHA        → 逐像素透明（文字不透明背景透明）   │
│  4. WS_EX_TRANSPARENT   → 鼠标穿透（点击穿过到下层）        │
│  5. WS_EX_TOPMOST       → 窗口置顶                       │
└─────────────────────────────────────────────────────────┘
```

**lyrics_win32.py 核心代码**:
```python
# 创建窗口 - 关键样式
g_hwnd = user32.CreateWindowExW(
    WS_EX_LAYERED |        # 分层窗口（必须）
    WS_EX_TRANSPARENT |    # 鼠标穿透
    WS_EX_TOPMOST |        # 窗口置顶
    WS_EX_TOOLWINDOW,      # 不在任务栏显示
    "DesktopLyrics",
    "",
    WS_POPUP,              # 无边框
    x, y, W, H,
    0, 0, hinstance, None
)

# 创建 ARGB 位图
g_hbitmap = gdi32.CreateDIBSection(hdc, ctypes.byref(bmi), 0,
                                    ctypes.byref(g_bits_ptr), None, 0)

# 渲染文字到位图（只画文字，不画背景）
gdi32.SetBkMode(hdc_mem, 1)  # TRANSPARENT
user32.DrawTextW(hdc_mem, g_text_main, -1, ctypes.byref(rect), ...)

# 设置 Alpha 通道（GDI 不设置 Alpha，手动处理）
for i in range(W * H):
    if bits[i] != 0:
        bits[i] |= 0xFF000000  # Alpha=255

# 更新窗口（逐像素透明）
blend = BLENDFUNCTION(AC_SRC_OVER, 0, 255, AC_SRC_ALPHA)
user32.UpdateLayeredWindow(g_hwnd, hdc, ..., ctypes.byref(blend), 2)

# 窗口过程 - 鼠标穿透
def wnd_proc(hwnd, msg, wp, lp):
    if msg == WM_NCHITTEST:
        return HTTRANSPARENT  # 告诉系统：点到了"透明区域"
    return 0
```

**HTTP API**:
```
GET http://127.0.0.1:8765/toggle   → 切换显示/隐藏
GET http://127.0.0.1:8765/show     → 显示
GET http://127.0.0.1:8765/hide     → 隐藏
GET http://127.0.0.1:8765/status   → 查询状态
GET http://127.0.0.1:8765/color/0  → 切换颜色（0-5）
```

---

### 4. packages/shared - 共享模块

**目录结构**:
```
packages/shared/
├── src/
│   ├── index.ts               # 导出入口
│   ├── types/
│   │   ├── events.ts          # 事件类型定义
│   │   ├── subtitle.ts        # 字幕类型
│   │   └── transport.ts       # 传输协议
│   ├── guards/
│   │   └── eventGuards.ts     # 类型守卫
│   └── constants.ts           # 常量定义
├── __tests__/                 # 测试
└── package.json
```

**关键类型定义**:
```typescript
// 音频块事件
export interface AudioChunkEvent {
  type: 'audio_chunk';
  payload: {
    window_id: number;
    start_ms: number;
    duration: number;
    pcm_data: string;  // Float32Array Base64 编码
  };
}

// 字幕补丁
export interface SubtitlePatchPayload {
  action: 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';
  target_range: [number, number];
  new_text: string;
  style: 'temp' | 'final';
}
```

---

## ⚙️ 配置说明

### 环境变量

```bash
# DashScope API Key（可选，不填使用 Mock 模式）
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 网关端口
PORT=3000

# 日志级别
LOG_LEVEL=info
```

### Vite 配置 (packages/web/vite.config.ts)

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),      // 控制台
        landing: resolve(__dirname, 'landing.html'),  // 官网
      },
    },
  },
});
```

### 模型配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| model | qwen3.5-livetranslate-flash-realtime | Qwen 翻译模型 |
| targetLang | zh | 目标语言 |
| sampleRate | 16000 | 采样率 |
| voice | default | 音色（仅音频输出时） |

---

## 🚀 启动方式

### 一键启动

```bash
start.bat
```

会启动：
1. 网关服务 (ws://localhost:3000)
2. 前端控制台 (http://localhost:5173)
3. 桌面字幕服务 (http://127.0.0.1:8765)

### 手动启动

```bash
# 1. 启动网关
cd packages/gateway
pnpm dev

# 2. 启动前端
cd packages/web
pnpm dev

# 3. 启动桌面字幕（可选）
cd packages/desktop-lyrics
python lyrics_win32.py
```

---

## 📡 API 接口

### WebSocket 消息协议

**客户端 → 服务端**:
```json
{
  "type": "audio_chunk",
  "payload": {
    "window_id": 0,
    "start_ms": 0,
    "duration": 400,
    "pcm_data": "base64..."
  }
}
```

**服务端 → 客户端**:
```json
{
  "type": "subtitle_patch",
  "payload": {
    "action": "ADD_TEMP",
    "target_range": [0, 400],
    "new_text": "翻译结果",
    "style": "temp"
  }
}
```

### 桌面字幕 HTTP API

```
GET http://127.0.0.1:8765/toggle   → {"visible": true/false}
GET http://127.0.0.1:8765/show     → {"visible": true}
GET http://127.0.0.1:8765/hide     → {"visible": false}
GET http://127.0.0.1:8765/status   → {"visible": true/false}
GET http://127.0.0.1:8765/color/0  → {"ok": true}
```

---

## 🎯 功能特性

### 1. 麦克风模式
- 使用浏览器原生 Web Speech API
- 支持 8 种语言：英/中/日/韩/法/德/西/俄
- 通过 MyMemory API 翻译（免费）

### 2. 标签页模式
- 捕获标签页音频（getDisplayMedia）
- 发送到网关进行 ASR + 翻译
- 使用 Qwen LiveTranslate API

### 3. 桌面字幕
- Win32 原生透明窗口
- 鼠标穿透（点击穿过）
- 置顶显示
- 自动连接网关接收翻译
- 双击切换颜色（白/蓝/紫/红/绿/黄）

### 4. 处理管道可视化
- 7 步管道：init → ws → auth → vad → asr → mt → post
- 实时状态更新
- 延迟显示

### 5. 实时日志
- 彩色日志标签（INFO/OK/DATA/WARN/ERR）
- 自动滚动
- 支持清空

---

## 🔧 依赖安装

### Node.js 依赖

```bash
# 安装所有依赖
pnpm install

# 或单独安装
cd packages/web && pnpm install
cd packages/gateway && pnpm install
```

### Python 依赖（桌面字幕）

```bash
cd packages/desktop-lyrics
pip install websocket-client -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

## 🐛 常见问题

### 1. 桌面字幕服务未启动

**错误**: `桌面字幕服务未启动，请先运行 start.bat`

**解决**:
```bash
cd packages/desktop-lyrics
python lyrics_win32.py
```

### 2. 翻译无输出

**原因**: 未配置 API Key 或网关未启动

**解决**:
1. 确保网关已启动
2. 在控制台输入 DashScope API Key
3. 或使用 Mock 模式（不填 API Key）

### 3. Electron 启动失败

**原因**: Electron 安装问题

**解决**: 使用 Python 版本替代
```bash
cd packages/desktop-lyrics
python lyrics_win32.py
```

---

## 📝 开发说明

### 添加新语言

编辑 `packages/web/src/App.tsx`:
```typescript
const LANG_MAP: Record<string, string> = {
  'en-US': 'en',
  'zh-CN': 'zh',
  // 添加新语言...
};
```

### 修改翻译模型

编辑 `packages/gateway/src/services/QwenASRService.ts`:
```typescript
const model = 'qwen3.5-livetranslate-flash-realtime';
```

### 自定义桌面字幕样式

编辑 `packages/desktop-lyrics/lyrics_win32.py`:
```python
W, H = 900, 100  # 窗口尺寸
COLORS = [
    (255, 255, 255),  # 白色
    (0, 224, 158),    # 绿色
    # 添加更多颜色...
]
```

---

## 📄 许可证

MIT License
