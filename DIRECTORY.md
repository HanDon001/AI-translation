# 项目目录结构

> 基于 TypeScript 的企业级实时同声传译微服务平台

```
同声传译助手/
│
├── package.json                                    # 根配置
├── pnpm-workspace.yaml                             # pnpm 多层级工作区配置
├── pnpm-lock.yaml                                  # 依赖锁文件
├── tsconfig.base.json                              # TypeScript 基础配置
├── start.bat                                       # Windows 一键启动
├── start.sh                                        # Linux/Mac 一键启动
├── README.md                                       # 项目说明文档
├── DIRECTORY.md                                    # 本文档
│
├── common/                                         # 公共基础模块
│   ├── common-core/                                # 核心工具：常量、类型、异常
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── constants/index.ts
│   │       ├── types/index.ts
│   │       ├── guards/index.ts
│   │       └── exceptions/index.ts
│   │
│   ├── common-web/                                 # Web 通用：响应体、异常处理
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── Result.ts
│   │       └── middleware/errorHandler.ts
│   │
│   ├── common-websocket/                           # WebSocket 通用：连接池
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── SessionManager.ts
│   │
│   ├── common-redis/                               # Redis 通用：会话缓存
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── SessionCache.ts
│   │
│   └── common-security/                            # 安全通用：API Key 校验
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── ApiKeyGuard.ts
│
├── services/                                       # 核心业务服务（DDD 分层）
│   ├── asr-service/                                # ASR 语音识别
│   │   ├── package.json
│   │   ├── asr-api/                                # API 模块（DTO、枚举）
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── dto/AudioChunkDTO.ts
│   │   │       ├── dto/ASRResultDTO.ts
│   │   │       └── enums/ASRModelEnum.ts
│   │   │
│   │   └── asr-server/                             # 服务实现
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── src/
│   │           ├── index.ts
│   │           ├── interfaces/websocket/ASRWebSocketHandler.ts
│   │           ├── application/service/ASRApplicationService.ts
│   │           ├── domain/model/ASRSession.ts
│   │           ├── domain/service/QwenASRDomainService.ts
│   │           └── infrastructure/external/DashScopeWSClient.ts
│   │
│   └── translate-service/                          # 翻译服务
│       ├── package.json
│       ├── translate-api/                          # API 模块
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   └── src/
│       │       ├── index.ts
│       │       ├── dto/TranslateRequestDTO.ts
│       │       └── dto/SubtitlePatchDTO.ts
│       │
│       └── translate-server/                       # 服务实现
│           ├── package.json
│           ├── tsconfig.json
│           └── src/
│               ├── index.ts
│               ├── domain/service/WaitKDomainService.ts
│               └── infrastructure/external/MyMemoryTranslator.ts
│
├── gateway/                                        # API 网关
│   ├── package.json
│   └── gateway-service/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
│
├── auth/                                           # 认证中心
│   ├── package.json
│   └── auth-service/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
│
├── components/                                     # 平台组件
│   ├── web-console/                                # React 前端控制台
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── landing.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.cjs
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       │   ├── Topbar.tsx
│   │       │   ├── ConfigPanel.tsx
│   │       │   ├── PipelineSteps.tsx
│   │       │   ├── ResultsPanel.tsx
│   │       │   ├── Waveform.tsx
│   │       │   ├── LogPanel.tsx
│   │       │   ├── Toast.tsx
│   │       │   ├── SubtitleDisplay.tsx
│   │       │   ├── AudioRecorder.tsx
│   │       │   ├── TTSPlayer.tsx
│   │       │   ├── HistoryPanel.tsx
│   │       │   ├── DebugPanel.tsx
│   │       │   └── Settings.tsx
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts
│   │       │   ├── useAudioWorklet.ts
│   │       │   ├── useSpeechRecognition.ts
│   │       │   ├── usePipelineSteps.ts
│   │       │   ├── useConsoleLog.ts
│   │       │   └── useSubtitlePatch.ts
│   │       ├── styles/
│   │       │   ├── index.css
│   │       │   └── console.css
│   │       ├── types/
│   │       │   ├── audio-worklet.d.ts
│   │       │   └── speech-recognition.d.ts
│   │       ├── utils/
│   │       │   ├── domPatcher.ts
│   │       │   └── timeMapper.ts
│   │       └── workers/
│   │           └── audio-processor.worklet.ts
│   │
│   └── desktop-lyrics/                             # 桌面悬浮字幕
│       ├── package.json
│       ├── requirements.txt
│       └── lyrics_win32.py
│
├── config/                                         # 配置管理
│   ├── tsconfig/                                   # TypeScript 配置
│   │   ├── base.json
│   │   ├── node.json
│   │   └── react.json
│   └── env/                                        # 环境变量
│       ├── DEV/
│       └── PROD/
│
├── docs/                                           # 文档体系
│   ├── architecture.md
│   ├── api-design/
│   │   └── websocket-protocol.md
│   ├── database/
│   ├── diagrams/
│   └── decisions/
│       ├── ADR-001-use-nacos.md
│       └── ADR-002-keep-python-lyrics.md
│
├── scripts/                                        # 自动化脚本
│   ├── ci/
│   │   └── Jenkinsfile
│   └── deploy/
│
├── docker/                                         # Docker 构建
│   ├── docker-compose.yml
│   ├── Dockerfile                                  # Node.js 服务基础镜像
│   └── services/
│
└── k8s/                                            # Kubernetes
    ├── configmap/
    └── secrets/
```

## 工程化约束规范

1. **依赖单向原则**：`interfaces` → `application` → `domain` ← `infrastructure`
2. **API 模块纯洁性**：`asr-api` 和 `translate-api` 只能包含 `dto`、`enums`、`types`
3. **公共模块按需引入**：各服务按需引入 `@livetranslate/common-*`
4. **网关职责隔离**：`gateway-service` 仅做路由转发，禁止编写业务逻辑
