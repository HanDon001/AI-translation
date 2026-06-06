# 项目目录结构

> LiveTranslate Platform — 实时同声传译微服务平台

## 顶层文件

| 文件 | 说明 |
|------|------|
| `package.json` | pnpm 工作区根配置，Node >= 20 |
| `pnpm-workspace.yaml` | 工作区包定义 |
| `pnpm-lock.yaml` | 依赖锁文件 |
| `tsconfig.base.json` | TypeScript 基础配置（ES2022, strict） |
| `start.bat` | **Windows 一键启动**（杀端口 → 装依赖 → 启 6 个服务） |
| `start-lyrics.vbs` | VBScript 隐藏启动桌面字幕（无控制台窗口） |
| `start.sh` | Linux/Mac 启动脚本 |
| `.editorconfig` | 编辑器代码风格（2空格TS/4空格Java） |
| `.gitignore` | Git 忽略规则 |
| `README.md` | 项目说明 |
| `DIRECTORY.md` | 本文档 |

## 架构概览

```
┌─────────────┐    WebSocket     ┌──────────┐    WebSocket     ┌──────────────┐
│  Web Console │ ───────────────→ │  Gateway  │ ───────────────→ │  ASR Service │
│  (port 5173) │ ←─────────────── │ (port 3000│ ←─────────────── │  (port 3001) │
└─────────────┘   subtitle_patch  └──────────┘   subtitle_patch  └──────┬───────┘
       │                                   │                            │
       │                                   │         HTTP POST          │
       │                                   │    ┌───────────────────┐   │
       │                                   │    │ Translate Service │←──┘
       │                                   │    │   (port 3002)     │
       │                                   │    └───────────────────┘
       │                                   │
       │         WebSocket (共享连接)        │
┌─────────────┐                            │
│ Desktop     │ ───────────────────────────→┘
│ Lyrics      │   subtitle_patch 广播
│ (port 8765) │
└─────────────┘
```

**数据流：**
1. 前端采集音频 → WebSocket → Gateway
2. Gateway 转发音频 → ASR Service（DashScope 实时语音识别）
3. ASR 识别结果 → 调用翻译服务（DashScope LLM 翻译+纠错一步到位）
4. `subtitle_patch` 消息回传 Gateway → **广播给所有客户端**
5. Web Console 和 Desktop Lyrics 同时显示字幕

---

## `services/` — 核心业务服务

### `services/asr-service/` — ASR 语音识别服务（端口 3001）

```
asr-service/
├── asr-api/                           # API 契约层（DTO、枚举）
│   └── src/
│       ├── dto/AudioChunkDTO.ts       # 音频块 DTO
│       ├── dto/ASRResultDTO.ts        # 识别结果 DTO
│       └── enums/ASRModelEnum.ts      # 模型枚举
│
└── asr-server/                        # 服务实现（Fastify + DDD）
    └── src/
        ├── index.ts                   # 入口：Fastify 服务，暴露 /ws/asr
        ├── interfaces/websocket/
        │   └── ASRWebSocketHandler.ts # 核心处理器
        ├── infrastructure/external/
        │   └── DashScopeWSClient.ts   # DashScope WebSocket 客户端
        ├── application/service/
        │   └── ASRApplicationService.ts
        ├── domain/model/
        │   └── ASRSession.ts
        └── domain/service/
            └── QwenASRDomainService.ts
```

**ASRWebSocketHandler.ts 核心逻辑：**
- 接收 `set_api_key` → 连接 DashScope 实时 ASR
- 接收 `audio_chunk` → 转发音频到 DashScope
- DashScope 返回增量/最终识别结果
- 增量结果：防抖 2500ms 后翻译（带前 2 句上下文）
- 最终结果：立即翻译+LLM 纠错（带上下文），800ms 冷却期
- 分块策略：遇标点（≥10字）即切 或 满 20 字即切
- 发送 `subtitle_patch`（ADD_TEMP / MARK_FINAL）回客户端

### `services/translate-service/` — 翻译服务（端口 3002）

```
translate-service/
├── translate-api/                     # API 契约层
│   └── src/
│       ├── dto/TranslateRequestDTO.ts # 翻译请求 DTO
│       └── dto/SubtitlePatchDTO.ts    # 字幕补丁 DTO
│
└── translate-server/                  # 服务实现
    └── src/
        ├── index.ts                   # 入口：POST /translate
        └── infrastructure/external/
            └── MyMemoryTranslator.ts  # DashScope LLM 翻译+纠错（MyMemory 备用）
```

**翻译流程：**
- 默认：DashScope Qwen LLM 翻译+纠错一步到位（单次调用）
- 备用：MyMemory 免费 API（仅在 LLM 失败时兜底）
- 支持上下文：传入前 2 句原文+译文，保证指代准确

---

## `gateway/` — API 网关（端口 3000）

```
gateway/
└── gateway-service/
    └── src/
        └── index.ts                   # Fastify 网关
```

**核心机制：**
- `/ws` WebSocket：**单一共享 ASR 连接**，所有客户端共用
- 客户端消息 → 转发到 ASR Service
- ASR 返回的 `subtitle_patch` → **广播给所有已连接客户端**
- `POST /api/translate` → 代理转发到翻译服务
- `/health` 健康检查

---

## `auth/` — 认证服务（端口 3003，未启动）

```
auth/
└── auth-service/
    └── src/
        └── index.ts                   # POST /auth/validate 校验 API Key
```

---

## `components/` — 前端组件

### `components/web-console/` — Web 控制台（端口 5173）

```
web-console/
├── index.html                         # 主页面入口
├── landing.html                       # 落地页
├── vite.config.ts                     # Vite 配置（代理 /ws → Gateway）
├── tailwind.config.ts                 # Tailwind CSS
└── src/
    ├── main.tsx                       # React 入口
    ├── App.tsx                        # 主组件（音频采集、WS 通信、字幕处理）
    ├── components/
    │   ├── Topbar.tsx                 # 顶部导航栏
    │   ├── PipelineSteps.tsx          # 流水线状态可视化
    │   ├── ResultsPanel.tsx           # 翻译结果展示
    │   ├── Waveform.tsx               # 音频波形
    │   ├── LogPanel.tsx               # 控制台日志
    │   ├── SubtitleDisplay.tsx        # 字幕覆盖层
    │   └── Toast.tsx                  # 通知提示
    ├── hooks/
    │   ├── useAudioWorklet.ts         # AudioWorklet 音频采集（16kHz, 400ms 分块）
    │   ├── useWebSocket.ts            # WebSocket 连接管理
    │   ├── usePipelineSteps.ts        # 流水线步骤状态
    │   ├── useConsoleLog.ts           # 日志聚合
    │   ├── useTranslationResults.ts   # 翻译结果与延迟统计
    │   ├── useFloatWindow.ts          # 桌面字幕窗口控制
    │   ├── useDemoMode.ts             # 演示模式
    │   └── useToast.ts                # 通知状态
    ├── config/
    │   ├── api.ts                     # API 端点常量
    │   └── constants.ts               # 语言映射等常量
    ├── utils/
    │   ├── domPatcher.ts              # DOM 补丁
    │   └── timeMapper.ts              # 时间映射
    └── workers/
        └── audio-processor.worklet.ts # AudioWorklet 处理器
```

### `components/desktop-lyrics/` — 桌面悬浮字幕（端口 8765）

```
desktop-lyrics/
├── lyrics_win32.py                    # PyQt5 桌面字幕（主程序）
├── requirements.txt                   # Python 依赖（PyQt5, websocket-client）
└── Dockerfile
```

**功能特性：**
- 连接 Gateway WebSocket 接收 `subtitle_patch`
- 上方：实时 partial 累积预览（快速更新）
- 下方：final 精确翻译（LLM 纠错后，覆盖式更新）
- 半透明黑色圆角背景，始终置顶，无边框
- 左键拖动移动，右下角拖拽缩放
- 双击切换 6 种颜色主题
- HTTP 控制接口：`/show` `/hide` `/toggle` `/status` `/text/<text>` `/color/<idx>`
- WebSocket 断开自动重连

---

## `common/` — 公共基础模块

```
common/
├── common-core/                       # 核心工具：常量、类型、异常
├── common-web/                        # Web 通用：统一响应体 Result.ts, 错误处理
├── common-websocket/                  # WebSocket：SessionManager 连接池
├── common-redis/                      # Redis：会话缓存
└── common-security/                   # 安全：ApiKeyGuard API Key 校验
```

---

## `config/` — 配置管理

```
config/
├── tsconfig/                          # TypeScript 配置
│   ├── base.json
│   ├── node.json
│   └── react.json
└── nacos/                             # Nacos 配置中心
    ├── DEV/                           # 开发环境
    └── PROD/                          # 生产环境
```

---

## `docs/` — 文档

```
docs/
├── architecture.md                    # 系统架构
├── api-design/
│   └── websocket-protocol.md          # WebSocket 协议规范
└── decisions/
    ├── ADR-001-use-nacos.md           # 使用 Nacos 配置中心
    └── ADR-002-keep-python-lyrics.md  # 保留 Python 桌面字幕
```

---

## `docker/` — Docker 构建

```
docker/
├── docker-compose.yml                 # 5 个服务编排
└── Dockerfile                         # 基础镜像
```

---

## 端口分配

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Gateway | API 网关 + WebSocket 代理 |
| 3001 | ASR Service | 语音识别服务 |
| 3002 | Translate Service | 翻译服务 |
| 3003 | Auth Service | 认证服务（未启动） |
| 5173 | Frontend | Web 控制台 |
| 8765 | Desktop Lyrics | 桌面字幕 HTTP 控制 |

## 工程化约束

1. **依赖单向**：`interfaces` → `application` → `domain` ← `infrastructure`
2. **API 模块纯洁性**：`asr-api` / `translate-api` 只含 DTO、枚举、类型
3. **网关职责隔离**：`gateway-service` 仅做路由转发，不写业务逻辑
4. **公共模块按需引入**：各服务按需引入 `@livetranslate/common-*`
