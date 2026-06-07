# WebSocket 协议文档

## 1. 连接地址

```
ws://localhost:3000/ws        # 通过 Gateway 接入
```

客户端连接到 Gateway，Gateway 内部维护一条到 ASR Service 的共享 WebSocket（`ws://localhost:3001/ws/asr`），客户端无需感知。

## 2. 连接流程

```
客户端                        Gateway                    ASR Service
  │                             │                           │
  │──── WS 连接 ───────────────▶│                           │
  │                             │──── WS 连接 ────────────▶│
  │                             │                           │
  │──── set_api_key ───────────▶│─── set_api_key ──────────▶│
  │                             │                           │
  │──── config ────────────────▶│─── config ───────────────▶│
  │                             │                           │
  │──── set_glossary ──────────▶│─── set_glossary ─────────▶│
  │                             │                           │
  │                             │◀── auth_success ──────────│
  │◀── auth_success ────────────│                           │
  │                             │                           │
  │──── audio_chunk (循环) ─────▶│─── audio_chunk ──────────▶│
  │                             │                           │
  │                             │◀── subtitle_patch ────────│
  │◀── subtitle_patch ──────────│  (广播给所有客户端)        │
```

## 3. 消息格式

### 3.1 客户端 → 服务端

#### 设置 API Key

连接建立后必须首先发送，否则 ASR 服务无法连接 DashScope。

```json
{
  "type": "set_api_key",
  "payload": {
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

#### 配置语言参数

```json
{
  "type": "config",
  "payload": {
    "sourceLang": "en",
    "targetLang": "zh"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| sourceLang | string | 源语言代码，如 `en`、`zh`、`ja` |
| targetLang | string | 目标语言代码，如 `zh`、`en`、`ko` |

#### 设置术语表

可选，用于专业名称缩写转换。

```json
{
  "type": "set_glossary",
  "payload": {
    "glossary": {
      "Kubernetes": "k8s",
      "Artificial Intelligence": "AI"
    }
  }
}
```

#### 发送音频数据

```json
{
  "type": "audio_chunk",
  "payload": {
    "window_id": 0,
    "start_ms": 0,
    "duration": 400,
    "pcm_data": "base64编码的PCM16数据..."
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| window_id | number | 窗口序号，递增 |
| start_ms | number | 起始毫秒时间戳 |
| duration | number | 分片时长（ms），标准 400ms |
| pcm_data | string | Base64 编码的 16kHz 16bit 单声道 PCM 数据 |

### 3.2 服务端 → 客户端

#### 认证成功

```json
{
  "type": "auth_success"
}
```

#### 字幕补丁（核心消息）

部分翻译（增量，快速更新）：

```json
{
  "type": "subtitle_patch",
  "payload": {
    "action": "ADD_TEMP",
    "new_text": "我逐渐认识到的问题是",
    "source_text": "Problem I've come to recognize is",
    "target_range": [1700000000000, 1700000001000],
    "style": "temp"
  }
}
```

最终翻译（精确，LLM 纠错后）：

```json
{
  "type": "subtitle_patch",
  "payload": {
    "action": "MARK_FINAL",
    "new_text": "我逐渐认识到的问题是，人们总是被身边的人和体制打压，变得比原本可能的自己更渺小。",
    "source_text": "Problem I've come to recognize is that people are constantly made to feel smaller than they might otherwise become by the people and the systems around them.",
    "target_range": [1700000000000, 1700000002000],
    "style": "final"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| action | string | `ADD_TEMP` 增量翻译 / `MARK_FINAL` 最终翻译 |
| new_text | string | 翻译后文本（目标语言） |
| source_text | string | 识别原文（源语言） |
| target_range | [number, number] | 翻译对应的时间范围（ms 时间戳） |
| style | string | `temp` 临时样式 / `final` 最终样式 |

**客户端处理逻辑**：
- `ADD_TEMP`：显示在"实时预览"区域，会被后续结果覆盖
- `MARK_FINAL`：显示在"精确翻译"区域，表示 LLM 纠错后的最终译文

#### 错误

```json
{
  "type": "error",
  "payload": {
    "message": "ASR 连接失败: Connection refused"
  }
}
```

## 4. 桌面字幕 HTTP 控制接口

桌面字幕（`lyrics_win32.py`）在端口 8765 提供辅助 HTTP API：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/show` | 显示字幕窗口 |
| GET | `/hide` | 隐藏字幕窗口 |
| GET | `/toggle` | 切换显示/隐藏 |
| GET | `/status` | 返回 `{ visible: true/false }` |
| GET | `/text/<url-encoded>` | 设置显示文本 |
| GET | `/color/<0-5>` | 切换颜色主题（0=白 1=绿 2=青 3=紫 4=橙 5=黄） |

## 5. 翻译服务 REST API

### POST /translate

```json
// 请求
{
  "text": "Hello world",
  "sourceLang": "en",
  "targetLang": "zh",
  "context": [
    { "src": "Good morning", "tgt": "早上好" }
  ],
  "apiKey": "sk-xxx",
  "glossary": { "Kubernetes": "k8s" }
}

// 成功响应
{ "code": 0, "message": "success", "data": "你好世界" }

// 错误响应
{ "code": 30001, "message": "翻译服务不可用" }
```

| 字段 | 必填 | 说明 |
|------|------|------|
| text | ✅ | 待翻译文本 |
| sourceLang | ✅ | 源语言代码 |
| targetLang | ✅ | 目标语言代码 |
| context | ❌ | 上下文句子数组，最多 2 条 |
| apiKey | ❌ | DashScope API Key（不传则用环境变量） |
| glossary | ❌ | 术语映射表 {全称: 缩写} |
