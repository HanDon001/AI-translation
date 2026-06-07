# LiveTranslate — 实时同声传译助手

基于阿里云 DashScope Qwen 大模型的实时语音识别与翻译平台。边说英文，边出中文翻译字幕，支持浏览器 Web 控制台和桌面悬浮字幕两种显示方式。

> 🎬 **项目演示视频**：[七牛云实训项目 — 同声传译助手 Demo](https://b23.tv/Q9luAi3)（Bilibili）

## 项目简介

LiveTranslate 是一个完整的实时同声传译解决方案，默认管线为 **英文语音 → 中文翻译**。核心能力由阿里云 DashScope 平台提供：

- **语音识别（ASR）**：Qwen ASR Flash Realtime，流式实时转写
- **机器翻译（MT）**：Qwen-Plus 大模型翻译，自带语法纠错和上下文消歧

### 核心设计

1. **共享 ASR 连接**：网关层维护一条到 ASR 服务的 WebSocket 长连接，所有客户端共用，字幕广播给全体
2. **上下文翻译**：记住前 2 句原文+译文，解决代词 "it"/"they" 等指代歧义
3. **分块策略**：遇标点即切（≥10 字）或满 20 词即切或 VAD 停顿即切，兼顾实时性和语义完整
4. **冷却期机制**：MARK_FINAL 后 800ms 冷却期 + 版本号校验，防止残留碎片污染新句
5. **LLM 翻译+纠错一步到位**：单次 API 调用完成翻译和语法纠错，延迟更低

### 适用场景

- 国际会议、线上讲座的同声传译
- 英文视频/播客的实时字幕
- 跨语言沟通的辅助工具
- 语言学习场景

## 功能特性

### 语音识别

- **双模式音频采集**：麦克风模式（翻译自己说的话）和标签页模式（翻译浏览器播放的英文视频/会议）
- 16kHz 单声道 PCM 编码，AudioWorklet 处理器采集，400ms 分片发送
- 实时流式 ASR，首包延迟 < 500ms

### 智能翻译

- **LLM 翻译+纠错**：DashScope Qwen-Plus 一步完成翻译和语法纠错
- **上下文感知**：最近 2 句原文+译文作为上下文，准确消解指代歧义
- **分块策略**：标点切分 / 20 词切分 / VAD 停顿切分，智能平衡延迟与完整度
- **备用翻译**：MyMemory 免费 API 兜底，LLM 故障时自动切换

### 双端显示

| 端 | 技术 | 说明 |
|---|------|------|
| **Web 控制台** | React + Vite | 浏览器内查看翻译结果、日志、波形、历史记录 |
| **桌面字幕** | Python PyQt5 | 悬浮置顶半透明窗口，任何软件上方可见 |

### 桌面字幕功能

- **悬浮置顶**：始终在最上层，无边框半透明设计
- **双层显示**：上方实时预览（快速更新），下方精确译文（LLM 纠错后）
- **自由拖动**：鼠标左键按住任意位置拖动
- **缩放调节**：右下角拖拽任意调整大小
- **颜色切换**：双击循环 6 种主题色（白/绿/青/紫/橙/黄）
- **暂停/恢复**：点击按钮暂停字幕更新（不影响后台翻译和音频）
- **自动换行**：文字过长自动换行，窗口高度自适应
- **HTTP 控制接口**：远程 show/hide/toggle/text/color

### 其他特性

- **API Key 统一管理**：前端输入框一次填写，所有服务共用
- **术语表管理**：专业名称自动缩写（如 Kubernetes → k8s），18 个 IT 预设，支持自定义添加
- **翻译日志导出**：支持导出完整翻译记录
- **Demo 模式**：无麦克风时自动切换到模拟演示
- **键盘快捷键**：空格键启停翻译

## 系统架构

```
┌──────────────────────────────────────────────────┐
│                    客户端层                        │
│  ┌──────────────┐  ┌─────────────────────────┐    │
│  │  Web 控制台   │  │  桌面字幕 (PyQt5)         │    │
│  │  React :5173  │  │  HTTP :8765 / WS 客户端   │    │
│  └──────┬───────┘  └───────────┬─────────────┘    │
│         │ WebSocket            │ WebSocket         │
└─────────┼──────────────────────┼───────────────────┘
          │                      │
          ▼                      ▼
┌──────────────────────────────────────────────────┐
│                 网关层 (:3000)                     │
│  ┌────────────────────────────────────────────┐  │
│  │  Gateway Service (Fastify)                  │  │
│  │  • 共享 ASR WebSocket 连接                   │  │
│  │  • subtitle_patch 广播给所有客户端             │  │
│  │  • POST /api/translate 代理转发              │  │
│  └──────────────────┬─────────────────────────┘  │
└─────────────────────┼────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐   ┌──────────────────────┐
│  ASR Service     │   │  Translate Service   │
│  (:3001)         │   │  (:3002)             │
│                  │   │                      │
│  • WebSocket     │   │  • POST /translate   │
│  • 流式语音识别   │──▶│  • Qwen-Plus LLM     │
│  • 分块+防抖     │   │  • MyMemory 备用     │
│  • 上下文维护     │   │                      │
└───────┬──────────┘   └──────────┬───────────┘
        │                         │
        │ WebSocket               │ HTTP POST
        ▼                         ▼
┌──────────────────────────────────────────────────┐
│                  外部 API 层                       │
│  ┌────────────────────┐  ┌────────────────────┐  │
│  │ DashScope ASR       │  │ DashScope LLM       │  │
│  │ Qwen ASR Flash      │  │ Qwen-Plus           │  │
│  │ Realtime API        │  │ Chat Completions    │  │
│  └────────────────────┘  └────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ MyMemory (免费翻译 API，备用)                │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 数据流

1. **音频采集**：浏览器捕获麦克风或标签页音频 → 16kHz PCM 编码 → base64
2. **音频传输**：400ms 分片 → WebSocket → Gateway → 共享 ASR 连接
3. **语音识别**：DashScope 实时 ASR 返回增量/最终文本
4. **翻译调度**：
   - 增量结果：2500ms 防抖 + 分块策略（标点/20词/VAD）
   - 最终结果：立即翻译 + 800ms 冷却期 + 版本号校验
5. **翻译执行**：ASR Service → HTTP → Translate Service → DashScope Qwen-Plus → 中文译文
6. **结果广播**：译文 → Gateway → WebSocket 广播 → 所有客户端同步显示

### 端口分配

| 端口 | 服务 | 技术栈 |
|------|------|--------|
| 3000 | Gateway（网关） | Fastify + TypeScript |
| 3001 | ASR Service（语音识别） | Fastify + TypeScript |
| 3002 | Translate Service（翻译） | Fastify + TypeScript |
| 3003 | Auth Service（认证） | Fastify + TypeScript |
| 5173 | Web Console（前端） | Vite + React + TypeScript |
| 8765 | Desktop Lyrics（桌面字幕） | Python + PyQt5 |
| 8848 | Nacos（配置中心） | Docker（可选） |

## 快速开始

### 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| **Node.js** | >= 20 | JavaScript 运行时 |
| **pnpm** | >= 9.0 | 包管理器（`npm install -g pnpm`） |
| **Python** | >= 3.10 | 桌面字幕所需 |
| **阿里云 DashScope API Key** | — | [申请地址](https://dashscope.console.aliyun.com/) |

### 一键启动（Windows）

```bash
# 1. 安装 pnpm（如果没有）
npm install -g pnpm

# 2. 克隆项目
git clone <repo-url>
cd 同声传译助手

# 3. 配置 API Key
# 启动后在 Web 控制台右上角设置中填入 DashScope API Key
# 或创建 .env 文件设置 DASHSCOPE_API_KEY

# 4. 一键启动
start.bat
```

`start.bat` 自动完成：
- 释放被占用的端口（3000/3001/3002/5173/8765）
- 安装所有依赖（`pnpm install`）
- 依次启动 5 个服务
- 静默启动桌面字幕（无控制台窗口）

### 手动启动

```bash
# 1. 安装依赖
pnpm install

# 2. 依次启动后端服务（5 个独立终端）
pnpm --filter @livetranslate/gateway-service dev       # 网关 → :3000
pnpm --filter @livetranslate/asr-server dev             # ASR → :3001
pnpm --filter @livetranslate/translate-server dev        # 翻译 → :3002

# 3. 启动前端
pnpm --filter livetranslate-web-console dev             # 控制台 → :5173

# 4. 启动桌面字幕（可选）
pip install PyQt5 websocket-client
python components/desktop-lyrics/lyrics_win32.py        # 桌面字幕 → :8765
```

### 停止服务

- **Windows**：在 `start.bat` 窗口按任意键，自动杀掉所有服务
- **手动**：关闭各终端窗口，或 `taskkill /F /PID <pid>`
- **桌面字幕**：点击右上角 ✕ 隐藏，或通过 `start.bat` 统一关闭

## 使用方法

### Web 控制台

1. 打开 http://localhost:5173
2. 点击右上角 ⚙ 设置，填入 DashScope API Key
3. 选择采集模式：
   - **麦克风模式**：翻译自己说的话
   - **标签页模式**：翻译浏览器播放的英文音视频
4. 点击「开始翻译」或按空格键
5. 实时查看英文识别 + 中文翻译 + 延迟统计

### 桌面字幕

桌面字幕启动后自动连接网关，翻译结果实时显示在悬浮窗口。

| 操作 | 方式 |
|------|------|
| **拖动位置** | 左键按住字幕任意位置拖动 |
| **调整大小** | 右下角拖拽缩放手柄 |
| **切换颜色** | 双击字幕区域，6 种颜色循环 |
| **暂停翻译** | 点击右上角「暂停」按钮 |
| **隐藏窗口** | 点击右上角 ✕ 按钮 |
| **恢复显示** | Web 控制台点击「桌面字幕」按钮 |

### 术语表

在 Web 控制台左侧面板点击「术语表」按钮，管理专业名称缩写映射：

1. **手动添加**：输入专业名称和对应缩写，点击添加
2. **一键预设**：18 个 IT 常用术语（k8s、i18n、AI、ML、API、DNS 等），点击即添加
3. **删除条目**：点击垃圾桶图标移除

翻译时 LLM 会自动将识别到的专业名称转换为缩写形态，例如 *Kubernetes* → *k8s*，*Artificial Intelligence* → *AI*。

### HTTP 控制接口（桌面字幕）

桌面字幕在端口 8765 提供 HTTP 控制接口：

```
GET /show          — 显示窗口
GET /hide          — 隐藏窗口
GET /toggle        — 切换显示/隐藏
GET /status        — 查询可见状态
GET /text/<text>   — 设置显示文本（URL 编码）
GET /color/<0-5>   — 切换颜色主题
```

## 技术栈

### 后端框架

| 库 | 版本 | 用途 |
|---|------|------|
| fastify | ^4.25 | Web 框架（Gateway、ASR、Translate、Auth） |
| @fastify/cors | ^8.5 | 跨域资源共享 |
| @fastify/websocket | ^8.3 | WebSocket 协议支持 |
| @fastify/http-proxy | ^9.4 | HTTP 代理转发 |
| ws | ^8.16 | Node.js WebSocket 客户端/服务端 |

### 前端

| 库 | 版本 | 用途 |
|---|------|------|
| react | ^18.3 | UI 框架 |
| react-dom | ^18.3 | React DOM 渲染 |
| vite | ^5.1 | 构建工具（开发服务器 + 打包） |
| @vitejs/plugin-react | ^4.2 | Vite React 插件（SWC 编译） |
| tailwindcss | ^3.4 | 原子化 CSS 样式框架 |
| postcss | ^8.4 | CSS 后处理 |
| autoprefixer | ^10.4 | CSS 浏览器兼容前缀 |

### 运行时 & 工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| TypeScript | ^5.3 | 静态类型检查 |
| tsx | ^4.7 | TypeScript 开发热重载 |
| ESLint | ^8.56 | 代码规范检查 |
| Prettier | ^3.2 | 代码格式化 |
| Turbo | ^1.12 | Monorepo 任务编排 |
| Vitest | ^1.2 | 单元测试框架 |
| ioredis | ^5.3 | Redis 客户端（会话缓存） |

### 外部 API

| 服务 | 接口 | 用途 |
|------|------|------|
| **DashScope ASR** | `wss://dashscope.aliyuncs.com/api-ws/v1/realtime` | 实时语音识别（Qwen ASR Flash） |
| **DashScope LLM** | `POST .../compatible-mode/v1/chat/completions` | 大模型翻译+纠错（Qwen-Plus） |
| **MyMemory** | `GET https://api.mymemory.translated.net/get` | 免费翻译 API（备用兜底） |

### Python（桌面字幕）

| 库 | 版本 | 用途 |
|---|------|------|
| PyQt5 | >= 5.15 | 桌面 GUI 框架（悬浮窗口） |
| websocket-client | >= 1.6 | WebSocket 客户端连接 |

### Java（辅助模块，可选）

| 技术 | 版本 | 用途 |
|------|------|------|
| Spring Boot | 3.2.0 | Java 微服务框架 |
| Spring Cloud | 2023.0.0 | 微服务治理 |
| Spring Cloud Alibaba | 2023.0.1.0 | Nacos 集成 |
| Maven | 3.x | Java 构建工具 |

### 包管理

| 工具 | 版本 | 说明 |
|------|------|------|
| **pnpm** | >= 9.0 | Monorepo 包管理（workspace 模式） |
| **Node.js** | >= 20 | JavaScript 运行时 |

## 项目结构

```
同声传译助手/
│
├── start.bat                          # Windows 一键启动脚本
├── start.sh                           # Linux/Mac 启动脚本
├── start-lyrics.vbs                   # 桌面字幕静默启动（无控制台）
├── package.json                       # pnpm workspace 根配置
├── pnpm-workspace.yaml                # workspace 包路径定义
├── pnpm-lock.yaml                     # 锁定文件
├── tsconfig.base.json                 # TypeScript 基础配置
├── pom.xml                            # Maven 父 POM（Java 模块）
├── .editorconfig                      # 编辑器统一配置
├── .env.example                       # 环境变量模板
├── .gitignore                         # Git 忽略规则
├── README.md                          # 项目说明（本文件）
├── DIRECTORY.md                       # 详细目录结构文档
│
├── gateway/                           # 🌐 API 网关层
│   └── gateway-service/               #    Fastify 网关服务
│       └── src/
│           └── index.ts               #    共享 ASR 连接 + 广播 + 代理
│
├── services/                          # 🔧 业务服务层
│   ├── asr-service/                   #    语音识别服务
│   │   ├── asr-api/                   #      ASR DTO 和枚举定义
│   │   └── asr-server/                #      ASR 服务端
│   │       └── src/
│   │           ├── index.ts           #        Fastify 入口
│   │           ├── interfaces/
│   │           │   └── websocket/
│   │           │       ├── ASRWebSocketHandler.ts  # 核心 ASR 处理逻辑
│   │           │       └── DashScopeWSClient.ts    # DashScope WS 客户端
│   │           └── infrastructure/
│   │               └── external/      #        外部 API 适配
│   │
│   └── translate-service/            #    翻译服务
│       ├── translate-api/             #      翻译 DTO 定义
│       └── translate-server/          #      翻译服务端
│           └── src/
│               ├── index.ts           #        Fastify 入口 (/translate)
│               └── infrastructure/
│                   └── external/
│                       └── MyMemoryTranslator.ts  # Qwen-Plus + MyMemory 兜底
│
├── components/                        # 🖥️ 用户界面层
│   ├── web-console/                   #    Web 控制台（React + Vite）
│   │   ├── src/
│   │   │   ├── main.tsx              #      入口
│   │   │   ├── App.tsx               #      主组件（529 行核心逻辑）
│   │   │   ├── components/           #      UI 组件（14 个）
│   │   │   │   ├── Topbar.tsx        #        顶栏（模式切换、语言选择）
│   │   │   │   ├── PipelineSteps.tsx #        7 步处理流程可视化
│   │   │   │   ├── ResultsPanel.tsx  #        实时翻译结果
│   │   │   │   ├── Waveform.tsx      #        音频波形可视化
│   │   │   │   ├── LogPanel.tsx      #        控制台日志面板
│   │   │   │   └── ...
│   │   │   ├── hooks/                #      React Hooks（13 个）
│   │   │   │   ├── useAudioWorklet.ts    #    AudioWorklet 音频采集
│   │   │   │   ├── useWebSocket.ts       #    WebSocket 连接管理
│   │   │   │   ├── usePipelineSteps.ts   #    流程状态机
│   │   │   │   ├── useTranslationResults.ts # 翻译结果管理
│   │   │   │   └── ...
│   │   │   ├── config/               #      前端配置
│   │   │   │   ├── api.ts            #        API 端点定义
│   │   │   │   └── constants.ts      #        语言映射、Demo 数据
│   │   │   └── workers/
│   │   │       └── audio-processor.worklet.ts  # AudioWorklet 处理器
│   │   ├── index.html               #      入口 HTML
│   │   ├── landing.html             #      产品 Landing Page
│   │   ├── vite.config.ts           #      Vite 配置
│   │   └── tailwind.config.js       #      Tailwind 配置
│   │
│   └── desktop-lyrics/               #    桌面字幕（Python + PyQt5）
│       └── lyrics_win32.py           #      完整桌面字幕应用（~370 行）
│                                       #      • 悬浮置顶窗口
│                                       #      • 双层字幕显示
│                                       #      • 拖动/缩放/换色
│                                       #      • WebSocket 实时更新
│                                       #      • HTTP 控制接口
│                                       #      • 暂停/恢复按钮
│
├── common/                            # 📦 公共模块
│   ├── common-core/                   #    核心类型、错误码、常量
│   ├── common-web/                    #    统一响应格式、全局错误处理
│   ├── common-websocket/              #    WebSocket 连接池（SessionManager）
│   ├── common-redis/                  #    Redis 会话缓存（SessionCache）
│   └── common-security/               #    API Key 校验
│
├── auth/                              # 🔑 认证服务
│   └── auth-service/                  #    API Key 验证
│
├── config/                            # ⚙️ 配置
│   ├── tsconfig/                      #    TypeScript 配置模板
│   └── nacos/                         #    Nacos 环境配置
│       ├── DEV/                       #      开发环境
│       └── PROD/                      #      生产环境
│
├── docker/                            # 🐳 Docker 部署
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── k8s/                               # ☸️ Kubernetes 配置
│
├── scripts/                           # 📜 CI/CD
│   └── ci/
│       └── Jenkinsfile
│
└── docs/                              # 📚 架构文档
```

## 常见问题

**Q: 翻译没有反应？**
A: 检查 DashScope API Key 是否填写正确（以 `sk-` 开头），确认 3000/3001/3002 端口服务都在运行。

**Q: 桌面字幕不显示？**
A: 确认已安装 Python 3.10+ 和 PyQt5（`pip install PyQt5 websocket-client`），Gateway（端口 3000）正在运行。查看控制台日志确认 WebSocket 连接状态。

**Q: 翻译延迟太高？**
A: 正常端到端延迟约 2-3 秒（ASR 识别 + LLM 翻译纠错）。如果超过 5 秒，检查阿里云 DashScope 服务状态和网络连接。

**Q: 翻译结果为什么是英文而不是中文？**
A: 确认翻译服务（端口 3002）正常运行，API Key 有效。如果翻译服务挂了，兜底逻辑会返回原文。

**Q: 支持哪些语言？**
A: 默认英文→中文。修改 ASR 服务的 `sourceLang`/`targetLang` 配置可切换至 50+ 语言对（DashScope 支持的语言均可）。

**Q: 如何彻底关闭桌面字幕？**
A: 在 `start.bat` 窗口按任意键统一关闭所有服务，或手动 `taskkill /F /PID <桌面字幕的PID>`。

**Q: 桌面字幕的「暂停」和「关闭」有什么区别？**
A: 暂停只停止字幕显示更新，后台翻译和音频采集继续；关闭（✕）隐藏窗口，可通过 Web 控制台的「桌面字幕」按钮重新显示。

## License

MIT
