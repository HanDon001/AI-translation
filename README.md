# LiveTranslate Platform

> 实时同声传译微服务平台 - Node.js DDD 架构

## 项目结构

```
同声传译助手/
├── pnpm-workspace.yaml              # pnpm 多层级工作区配置
├── package.json                     # 根配置
├── tsconfig.base.json               # TypeScript 基础配置
├── start.bat                        # Windows 一键启动
├── start.sh                         # Linux/Mac 一键启动
├── README.md                        # 本文档
│
├── common/                          # 公共基础模块
│   ├── common-core/                 # 核心工具：常量、类型、异常
│   ├── common-web/                  # Web 通用：统一响应体、异常处理
│   ├── common-websocket/            # WebSocket 通用：连接池管理
│   ├── common-redis/                # Redis 通用：会话缓存
│   └── common-security/             # 安全通用：API Key 校验
│
├── services/                        # 核心业务服务（DDD 分层）
│   ├── asr-service/
│   │   ├── asr-api/                 # 对外暴露：DTO、枚举
│   │   └── asr-server/              # 服务实现
│   │       └── src/
│   │           ├── interfaces/      # 接口适配层
│   │           ├── application/     # 应用服务层
│   │           ├── domain/          # 领域层
│   │           └── infrastructure/  # 基础设施层
│   └── translate-service/
│       ├── translate-api/
│       └── translate-server/
│
├── gateway/                         # API 网关服务
│   └── gateway-service/             # Fastify 路由转发
│
├── auth/                            # 认证授权中心
│   └── auth-service/                # API Key 校验
│
├── components/                      # 平台组件
│   ├── web-console/                 # React 前端控制台
│   └── desktop-lyrics/              # 桌面字幕服务
│
├── packages/                        # 原有 Node.js 项目
│   ├── web/                         # React 前端
│   ├── gateway/                     # Node.js 网关
│   ├── shared/                      # 共享类型
│   ├── asr-engine/                  # ASR 引擎
│   ├── translator/                  # 翻译器
│   └── desktop-lyrics/              # 桌面字幕
│
├── config/                          # 配置管理
│   ├── tsconfig/                    # TypeScript 配置
│   └── env/                         # 环境变量
│       ├── DEV/
│       ├── TEST/
│       └── PROD/
│
├── docs/                            # 文档体系
│   ├── architecture.md              # 架构设计
│   ├── api-design/                  # 接口文档
│   ├── database/                    # 数据库脚本
│   └── diagrams/                    # 架构图
│
├── scripts/                         # 自动化脚本
│   ├── ci/                          # CI/CD
│   └── deploy/                      # 部署脚本
│
├── docker/                          # Docker 构建
│   └── services/
│
└── k8s/                             # Kubernetes
    ├── configmap/
    └── secrets/
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行环境 |
| TypeScript | 5.3+ | 类型系统 |
| Fastify | 4.25 | Web 框架 |
| WebSocket | - | 实时通信 |
| React | 18.3 | 前端框架 |
| Vite | 5.4 | 构建工具 |
| Tailwind CSS | 3.4 | 样式框架 |
| Python | 3.10+ | 桌面字幕 |
| Win32 API | - | 原生窗口 |

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
[1/6] 安装依赖 (pnpm install)
[2/6] 启动网关 (port 3000)
[3/6] 启动 ASR 服务 (port 3001)
[4/6] 启动翻译服务 (port 3002)
[5/6] 启动认证服务 (port 3003)
[6/6] 启动前端 (port 5173)
```

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端控制台 | http://localhost:5173 | React 控制台 |
| SaaS 官网 | http://localhost:5173/landing.html | 落地页 |
| API 网关 | http://localhost:3000 | 统一入口 |
| ASR 服务 | ws://localhost:3001/ws/asr | 语音识别 |
| 翻译服务 | http://localhost:3002/translate | 文本翻译 |
| 认证服务 | http://localhost:3003/auth | API Key 校验 |

## API 接口

### WebSocket

```
ws://localhost:3000/ws/asr      # 语音识别
```

### REST API

```
POST /api/translate              # 翻译接口
GET  /api/auth/keys              # API Key 管理
```

## DDD 分层规范

在 `services/*/xxx-server/` 中，依赖方向必须单向向下：

```
interfaces → application → domain ← infrastructure
```

### 禁止操作

- domain 层禁止引入外部框架
- infrastructure 层禁止直接被 interfaces 层 import
- xxx-api 模块禁止依赖 xxx-server 代码

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

## GitHub

https://github.com/HanDon001/AI-translation
