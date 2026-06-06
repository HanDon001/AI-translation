# LiveTranslate Platform

> 实时同声传译微服务平台 - 双架构（Java Spring Cloud + Node.js）

## 项目结构

```
同声传译助手/
├── pom.xml                          # Java 根 POM
├── package.json                     # Node.js 根 package.json
├── pnpm-workspace.yaml              # pnpm 工作区配置
├── tsconfig.base.json               # TypeScript 基础配置
├── start.bat                        # Windows 一键启动
├── start.sh                         # Linux/Mac 一键启动
├── README.md                        # 本文档
│
├── packages/                        # Node.js 项目
│   ├── web/                         # React 前端控制台
│   │   ├── src/
│   │   │   ├── App.tsx              # 主组件
│   │   │   ├── components/          # UI 组件
│   │   │   ├── hooks/               # 自定义 Hook
│   │   │   ├── styles/              # 样式文件
│   │   │   └── workers/             # AudioWorklet
│   │   ├── index.html               # 控制台入口
│   │   ├── landing.html             # SaaS 官网
│   │   ├── vite.config.ts           # Vite 配置
│   │   └── package.json
│   │
│   ├── gateway/                     # Node.js 网关
│   │   └── src/
│   │       ├── index.ts             # 服务入口
│   │       ├── handlers/            # WebSocket 处理
│   │       ├── services/            # 业务服务
│   │       └── core/                # 核心算法
│   │
│   ├── shared/                      # 共享类型和工具
│   │   └── src/
│   │       ├── types/               # TypeScript 类型
│   │       ├── guards/              # 类型守卫
│   │       └── constants/           # 常量定义
│   │
│   ├── asr-engine/                  # ASR 引擎
│   ├── translator/                  # 翻译器
│   └── desktop-lyrics/              # 桌面字幕（Python）
│       ├── lyrics_win32.py          # Win32 + GDI+ 实现
│       └── requirements.txt
│
├── common/                          # Java 公共模块
│   ├── common-core/                 # 异常、常量、工具
│   ├── common-web/                  # 统一响应、异常处理
│   ├── common-redis/                # 会话缓存
│   ├── common-websocket/            # WebSocket 管理
│   └── common-security/             # API Key 认证
│
├── services/                        # Java 业务服务
│   ├── asr-service/                 # ASR 语音识别
│   │   ├── asr-api/                 # DTO、Feign、枚举
│   │   └── asr-server/              # DDD 四层架构
│   └── translate-service/           # 翻译服务
│       ├── translate-api/
│       └── translate-server/
│
├── gateway/                         # Java API 网关
│   └── gateway-service/             # Spring Cloud Gateway
│
├── auth/                            # Java 认证中心
│   └── auth-service/
│
├── config/                          # 配置文件
│   ├── tsconfig/                    # TypeScript 配置
│   └── nacos/                       # Nacos 配置
│       ├── DEV/
│       └── PROD/
│
├── docker/                          # Docker 构建
│   ├── docker-compose.yml
│   └── Dockerfile
│
├── docs/                            # 文档
│   ├── architecture.md              # 架构文档
│   ├── api-design/                  # API 设计
│   └── decisions/                   # 架构决策
│
└── scripts/                         # CI/CD
    └── ci/Jenkinsfile
```

## 技术栈

### Node.js 项目
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.0 | 前端框架 |
| Vite | 5.4.21 | 构建工具 |
| TypeScript | 5.3.0 | 类型系统 |
| Tailwind CSS | 3.4.1 | 样式框架 |
| Fastify | - | Node.js 网关 |
| WebSocket | - | 实时通信 |

### Java 项目
| 技术 | 版本 | 用途 |
|------|------|------|
| Java | 17 | 运行环境 |
| Spring Boot | 3.2.0 | 应用框架 |
| Spring Cloud | 2023.0.0 | 微服务 |
| Spring Cloud Alibaba | 2023.0.1.0 | 阿里云集成 |
| MyBatis-Plus | 3.5.5 | ORM |
| Nacos | - | 配置中心 |

### 桌面字幕
| 技术 | 用途 |
|------|------|
| Python | 脚本语言 |
| Win32 API | 原生窗口 |
| GDI+ | 图形渲染 |

## 一键启动

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

### 启动流程

```
[1/6] 安装 Node.js 依赖 (pnpm install)
[2/6] 构建 Java 项目 (mvn package)
[3/6] 启动 Nacos 配置中心
[4/6] 启动 Java 网关 (port 3000)
[5/6] 启动 Node.js 网关 (port 3001)
[6/6] 启动前端 (port 5173)
```

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端控制台 | http://localhost:5173 | React 控制台 |
| SaaS 官网 | http://localhost:5173/landing.html | 落地页 |
| Java 网关 | http://localhost:3000 | Spring Cloud Gateway |
| Node.js 网关 | ws://localhost:3001/ws | WebSocket 服务 |
| Nacos | http://localhost:8848 | 配置中心 |

## API 接口

### WebSocket

```
ws://localhost:3000/ws/asr      # Java 网关
ws://localhost:3001/ws           # Node.js 网关
```

### REST API

```
POST /api/translate              # 翻译接口
GET  /api/auth/keys              # API Key 管理
```

## 功能特性

### 前端控制台
- 麦克风模式：Web Speech API 语音识别
- 标签页模式：捕获音频发送到网关
- 实时翻译：通过 API 翻译
- 波形可视化：Canvas 音频波形
- 管道可视化：7 步处理管道
- 实时日志：彩色日志面板

### 桌面字幕
- Win32 原生透明窗口
- GDI+ 逐像素渲染
- 鼠标穿透（点击穿过）
- 动态切换颜色
- WebSocket 实时更新

### 网关服务
- API 路由转发
- WebSocket 代理
- 请求日志
- 错误处理

## 配置说明

### 环境变量

```bash
# DashScope API Key
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 网关端口
PORT=3000

# 日志级别
LOG_LEVEL=info
```

### Nacos 配置

```yaml
# config/nacos/DEV/application-dev.yml
dashscope:
  api-key: sk-xxxxxxxxxxxxxxxxxxxxxxxx
  ws-url: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
  default-model: qwen3.5-livetranslate-flash-realtime
```

## 文档

- [架构文档](docs/architecture.md)
- [WebSocket 协议](docs/api-design/websocket-protocol.md)
- [架构决策](docs/decisions/)

## GitHub

https://github.com/HanDon001/AI-translation
