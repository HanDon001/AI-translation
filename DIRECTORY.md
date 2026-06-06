# 项目目录结构

```
同声传译助手/
│
├── package.json                                    # 根配置
├── pnpm-workspace.yaml                             # pnpm 工作区配置
├── pnpm-lock.yaml                                  # 依赖锁文件
├── tsconfig.base.json                              # TypeScript 基础配置
├── start.bat                                       # Windows 一键启动
├── start.sh                                        # Linux/Mac 一键启动
├── README.md                                       # 项目文档
├── DIRECTORY.md                                    # 本文档
│
├── common/                                         # 公共基础模块
│   ├── common-core/                                # 核心工具
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                            # 导出入口
│   │       ├── constants/
│   │       │   └── index.ts                        # 常量定义
│   │       ├── types/
│   │       │   └── index.ts                        # 类型定义
│   │       ├── guards/
│   │       │   └── index.ts                        # 类型守卫
│   │       └── exceptions/
│   │           └── index.ts                        # 异常类
│   │
│   ├── common-web/                                 # Web 通用
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── Result.ts                           # 统一响应体
│   │       └── middleware/
│   │           └── errorHandler.ts                 # 全局异常处理
│   │
│   ├── common-websocket/                           # WebSocket 通用
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── SessionManager.ts                   # 连接池管理
│   │
│   ├── common-redis/                               # Redis 通用
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── SessionCache.ts                     # 会话缓存
│   │
│   └── common-security/                            # 安全通用
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── ApiKeyGuard.ts                      # API Key 校验
│
├── services/                                       # 核心业务服务
│   ├── asr-service/                                # ASR 语音识别
│   │   ├── package.json
│   │   ├── asr-api/                                # API 模块
│   │   │   ├── package.json
│   │   │   ├── tsconfig.json
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── dto/
│   │   │       │   ├── AudioChunkDTO.ts            # 音频块 DTO
│   │   │       │   └── ASRResultDTO.ts             # ASR 结果 DTO
│   │   │       └── enums/
│   │   │           └── ASRModelEnum.ts             # 模型枚举
│   │   │
│   │   └── asr-server/                             # 服务实现
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── src/
│   │           ├── index.ts                        # 服务入口
│   │           ├── interfaces/
│   │           │   ├── controller/
│   │           │   └── websocket/
│   │           │       └── ASRWebSocketHandler.ts  # WebSocket 处理器
│   │           ├── application/
│   │           │   ├── service/
│   │           │   │   └── ASRApplicationService.ts # 应用服务
│   │           │   └── assembler/
│   │           ├── domain/
│   │           │   ├── model/
│   │           │   │   └── ASRSession.ts           # 会话模型
│   │           │   ├── repository/
│   │           │   └── service/
│   │           │       └── QwenASRDomainService.ts # 领域服务
│   │           └── infrastructure/
│   │               ├── external/
│   │               │   └── DashScopeWSClient.ts    # DashScope 客户端
│   │               └── repository/
│   │
│   └── translate-service/                          # 翻译服务
│       ├── package.json
│       ├── translate-api/                          # API 模块
│       │   ├── package.json
│       │   ├── tsconfig.json
│       │   └── src/
│       │       ├── index.ts
│       │       └── dto/
│       │           ├── TranslateRequestDTO.ts      # 翻译请求 DTO
│       │           └── SubtitlePatchDTO.ts         # 字幕补丁 DTO
│       │
│       └── translate-server/                       # 服务实现
│           ├── package.json
│           ├── tsconfig.json
│           └── src/
│               ├── index.ts                        # 服务入口
│               ├── domain/
│               │   └── service/
│               │       └── WaitKDomainService.ts   # Wait-K 调度
│               └── infrastructure/
│                   └── external/
│                       └── MyMemoryTranslator.ts   # MyMemory 翻译器
│
├── gateway/                                        # API 网关
│   ├── package.json
│   └── gateway-service/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts                            # 网关入口
│
├── auth/                                           # 认证中心
│   ├── package.json
│   └── auth-service/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts                            # 认证入口
│
├── components/                                     # 平台组件
│   ├── web-console/                                # Web 控制台
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── index.html                              # 控制台入口
│   │   ├── landing.html                            # SaaS 官网
│   │   ├── vite.config.ts                          # Vite 配置
│   │   ├── tailwind.config.ts                      # Tailwind 配置
│   │   ├── postcss.config.cjs                      # PostCSS 配置
│   │   └── src/
│   │       ├── main.tsx                            # React 入口
│   │       ├── App.tsx                             # 主组件
│   │       ├── components/
│   │       │   ├── Topbar.tsx                      # 顶栏
│   │       │   ├── ConfigPanel.tsx                 # 配置面板
│   │       │   ├── PipelineSteps.tsx               # 管道步骤
│   │       │   ├── ResultsPanel.tsx                # 结果面板
│   │       │   ├── Waveform.tsx                    # 波形组件
│   │       │   ├── LogPanel.tsx                    # 日志面板
│   │       │   ├── Toast.tsx                       # Toast 通知
│   │       │   ├── SubtitleDisplay.tsx             # 字幕显示
│   │       │   ├── AudioRecorder.tsx               # 音频录制
│   │       │   ├── TTSPlayer.tsx                   # TTS 播放
│   │       │   ├── HistoryPanel.tsx                # 历史面板
│   │       │   ├── DebugPanel.tsx                  # 调试面板
│   │       │   └── Settings.tsx                    # 设置面板
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts                 # WebSocket Hook
│   │       │   ├── useAudioWorklet.ts              # AudioWorklet Hook
│   │       │   ├── useSpeechRecognition.ts         # 语音识别 Hook
│   │       │   ├── usePipelineSteps.ts             # 管道步骤 Hook
│   │       │   ├── useConsoleLog.ts                # 日志 Hook
│   │       │   └── useSubtitlePatch.ts             # 字幕补丁 Hook
│   │       ├── styles/
│   │       │   ├── index.css                       # 全局样式
│   │       │   └── console.css                     # 控制台样式
│   │       ├── types/
│   │       │   ├── audio-worklet.d.ts              # AudioWorklet 类型
│   │       │   └── speech-recognition.d.ts         # 语音识别类型
│   │       ├── utils/
│   │       │   ├── domPatcher.ts                   # DOM 更新工具
│   │       │   └── timeMapper.ts                   # 时间映射工具
│   │       └── workers/
│   │           └── audio-processor.worklet.ts      # AudioWorklet 处理器
│   │
│   └── desktop-lyrics/                             # 桌面字幕
│       ├── package.json
│       ├── requirements.txt                        # Python 依赖
│       └── lyrics_win32.py                         # Win32 + GDI+ 实现
│
├── packages/                                       # 原有 Node.js 项目
│   ├── web/                                        # React 前端（原有）
│   ├── gateway/                                    # Node.js 网关（原有）
│   ├── shared/                                     # 共享类型（原有）
│   ├── asr-engine/                                 # ASR 引擎（原有）
│   ├── translator/                                 # 翻译器（原有）
│   └── desktop-lyrics/                             # 桌面字幕（原有）
│
├── config/                                         # 配置管理
│   ├── tsconfig/                                   # TypeScript 配置
│   │   ├── base.json
│   │   ├── node.json
│   │   └── react.json
│   └── nacos/                                      # Nacos 配置
│       ├── DEV/
│       │   ├── application-dev.yml
│       │   ├── asr-service-dev.yml
│       │   └── translate-service-dev.yml
│       └── PROD/
│           ├── application-prod.yml
│           └── asr-service-prod.yml
│
├── docs/                                           # 文档体系
│   ├── architecture.md                             # 架构设计
│   ├── api-design/
│   │   └── websocket-protocol.md                   # WebSocket 协议
│   ├── database/                                   # 数据库脚本
│   ├── diagrams/                                   # 架构图
│   └── decisions/
│       ├── ADR-001-use-nacos.md                    # 使用 Nacos
│       └── ADR-002-keep-python-lyrics.md           # 保留 Python
│
├── scripts/                                        # 自动化脚本
│   ├── ci/
│   │   └── Jenkinsfile                             # CI/CD 流水线
│   └── deploy/                                     # 部署脚本
│
├── docker/                                         # Docker 构建
│   ├── docker-compose.yml                          # Docker Compose
│   ├── Dockerfile                                  # Java 服务镜像
│   └── services/
│
└── k8s/                                            # Kubernetes
    ├── configmap/
    └── secrets/
```
