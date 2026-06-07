# LiveTranslate 架构文档

## 1. 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                        客户端层                               │
│                                                              │
│  ┌──────────────────┐          ┌──────────────────┐          │
│  │  Web 控制台       │          │  桌面字幕 (PyQt5) │          │
│  │  React + Vite     │          │  HTTP :8765      │          │
│  │  :5173            │          │  WS 客户端        │          │
│  └────────┬─────────┘          └────────┬─────────┘          │
│           │ WebSocket                   │ WebSocket          │
└───────────┼─────────────────────────────┼────────────────────┘
            │                             │
            ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│                        网关层 (:3000)                         │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Gateway Service (Fastify + TypeScript)               │   │
│  │                                                       │   │
│  │  核心职责:                                             │   │
│  │  • 维护共享 ASR WebSocket 连接（全局唯一）              │   │
│  │  • subtitle_patch 广播给所有已连接客户端                │   │
│  │  • POST /api/translate 代理转发到翻译服务              │   │
│  │  • 客户端音频数据透传到 ASR 服务                       │   │
│  └───────────────────┬───────────────────────────────────┘   │
└──────────────────────┼───────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
┌───────────────────┐    ┌───────────────────┐
│  ASR Service      │    │  Translate Service │
│  (:3001)          │    │  (:3002)           │
│  Fastify + WS     │    │  Fastify + REST    │
│                   │    │                    │
│  • WebSocket 接入  │───▶│  • POST /translate │
│  • DashScope 实时  │    │  • Qwen-Plus LLM  │
│    ASR 客户端      │    │  • MyMemory 兜底   │
│  • 分块调度+防抖   │    │  • 术语表注入      │
│  • 上下文管理      │    │                    │
│  • 冷却期控制      │    │                    │
└────────┬──────────┘    └────────┬──────────┘
         │                        │
         │ WebSocket              │ HTTP POST
         ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│                      外部 API 层                              │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ DashScope ASR         │  │ DashScope Qwen-Plus   │          │
│  │ wss://dashscope...    │  │ POST /compatible-mode │          │
│  │ /api-ws/v1/realtime   │  │ /v1/chat/completions  │          │
│  │ 模型: qwen3-asr-      │  │ 模型: qwen-plus       │          │
│  │ flash-realtime        │  │ 翻译+纠错一步到位      │          │
│  └──────────────────────┘  └──────────────────────┘          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ MyMemory (备用)                                       │    │
│  │ GET https://api.mymemory.translated.net/get           │    │
│  │ 仅 LLM 故障时兜底                                     │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## 2. 数据流详解

### 2.1 音频到翻译的完整链路

```
麦克风/标签页音频
  │
  │ 16kHz PCM, 400ms 分片, base64 编码
  ▼
audio_chunk → Gateway → 共享 ASR 连接
  │
  │ WebSocket
  ▼
DashScope ASR Realtime
  │
  │ 增量结果 (stash) / 最终结果 (transcript)
  ▼
ASRWebSocketHandler
  │
  ├─ 增量: 2500ms 防抖 → 分块策略判断 → translateText() → ADD_TEMP
  │        分块触发条件: 标点(≥10字) | 20词 | VAD停顿
  │
  └─ 最终: 立即 translateText() → MARK_FINAL → 800ms冷却期
            → 加入 contextHistory (最近2句)
  │
  ▼
POST /translate (:3002)
  │
  ▼
DashScope Qwen-Plus (temperature=0.1)
  │
  │ system prompt: 翻译指令 + 上下文(2句) + 术语表
  ▼
中文译文 → Gateway → broadcast → 所有客户端
```

### 2.2 冷却期机制

```
MARK_FINAL 发出
  │
  ├─ 800ms 冷却期开始
  │   └─ 此期间所有增量 ASR 结果被忽略
  │
  ├─ speech_started 信号可提前结束冷却期
  │
  └─ 800ms 超时自动恢复
      └─ 新 segment 的增量结果正常处理
```

**目的**: 防止上一句 FINAL 之后残留的音频碎片触发错误的增量翻译。

### 2.3 版本号校验

```
MARK_FINAL → translateVersion++

增量翻译请求发出时: 记录当前 version
增量翻译结果返回时: if (version !== translateVersion) discard
```

**目的**: 慢速增量翻译结果返回时，如果已有新的 FINAL 覆盖，旧结果自动丢弃。

## 3. 端口与职责

| 端口 | 服务 | 职责 |
|------|------|------|
| 3000 | Gateway | 共享 ASR 连接、广播字幕、路由代理 |
| 3001 | ASR Service | DashScope 实时 ASR 客户端、翻译调度、分块策略 |
| 3002 | Translate Service | LLM 翻译+纠错、MyMemory 兜底、术语表注入 |
| 3003 | Auth Service | API Key 校验 |
| 5173 | Web Console | Vite 开发服务器 + React 应用 |
| 8765 | Desktop Lyrics | Python HTTP 控制接口 |

## 4. 模块依赖

```
components/web-console        → gateway (WebSocket)
components/desktop-lyrics     → gateway (WebSocket)

gateway/gateway-service       → asr-server (WebSocket)
                              → translate-server (HTTP)

services/asr-service/asr-server  → translate-server (HTTP)
                                 → DashScope (WebSocket)

services/translate-service/translate-server → DashScope (HTTP)
                                            → MyMemory (HTTP)

common/
  ├── common-core          (类型、错误码、常量)
  ├── common-web           (统一响应、全局异常)
  ├── common-websocket     (会话管理)
  ├── common-redis         (会话缓存)
  └── common-security      (API Key 校验)
```

## 5. 关键设计决策

| 决策 | 说明 | 详见 |
|------|------|------|
| 共享 ASR 连接 | Gateway 只维护一条到 ASR 的 WebSocket，广播给所有客户端 | — |
| ASR Handler 内翻译调度 | 翻译触发逻辑在 ASR Handler 内完成，翻译服务为无状态 REST API | — |
| 冷却期 + 版本号 | 双重机制防止残留碎片污染新句 | — |
| PyQt5 桌面字幕 | Java/Node 无法原生透明置顶窗口 | ADR-002 |
| Nacos 配置中心 | 多环境配置管理（开发环境可选） | ADR-001 |
| pnpm monorepo | TypeScript 模块统一管理，Turbo 编排 | — |

## 6. 技术栈

| 层 | 核心技术 | 语言 |
|---|---------|------|
| 网关 | Fastify 4.x | TypeScript 5.x |
| ASR 服务 | Fastify + ws | TypeScript 5.x |
| 翻译服务 | Fastify | TypeScript 5.x |
| 前端 | React 18 + Vite 5 + Tailwind CSS 3 | TypeScript 5.x |
| 桌面字幕 | PyQt5 | Python 3.10+ |
| 构建工具 | pnpm + Turbo | — |
| 外部 API | DashScope ASR + Qwen-Plus + MyMemory | — |
