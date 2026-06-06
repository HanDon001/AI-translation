第一步：拆分 common/ 公共基础模块
目标：将原 packages/shared/ 的“大杂烩”拆分为 5 个职责单一的包。

bash

# 1. 删除原来的 shared
rm -rf packages/shared

# 2. 创建细粒度 common 模块
mkdir -p common/common-core/src
mkdir -p common/common-web/src
mkdir -p common/common-websocket/src
mkdir -p common/common-redis/src
mkdir -p common/common-security/src
迁移映射关系：

原 packages/shared 内容
迁移到新模块
constants.ts	common/common-core/src/constants.ts
types/transport.ts, types/events.ts	common/common-core/src/types/
guards/eventGuards.ts	common/common-core/src/guards/
（新增）统一错误码、业务异常类	common/common-core/src/exceptions/
（新增）统一响应体封装 Result<T>	common/common-web/src/Result.ts
（新增）Fastify 全局错误处理、日志切面	common/common-web/src/middleware/
（新增）WebSocket 连接池管理	common/common-websocket/src/SessionManager.ts
（新增）API Key 校验逻辑	common/common-security/src/ApiKeyGuard.ts

每个 common-* 下必须有自己的 package.json 和 tsconfig.json：

json

// common/common-core/package.json
{
  "name": "@livetranslate/common-core",
  "main": "src/index.ts"
}
第二步：业务服务 DDD 四层拆分 (services/)
目标：将原 packages/gateway/src/services/ 里的混杂逻辑，拆成独立服务，每个服务内严格遵循 interfaces → application → domain → infrastructure。

bash

# 创建 ASR 服务（API 模块 + Server 模块分离）
mkdir -p services/asr-service/asr-api/src
mkdir -p services/asr-service/asr-server/src/interfaces/controller
mkdir -p services/asr-service/asr-server/src/interfaces/websocket
mkdir -p services/asr-service/asr-server/src/application/service
mkdir -p services/asr-service/asr-server/src/application/assembler
mkdir -p services/asr-service/asr-server/src/domain/model
mkdir -p services/asr-service/asr-server/src/domain/repository
mkdir -p services/asr-service/asr-server/src/domain/service
mkdir -p services/asr-service/asr-server/src/infrastructure/external
mkdir -p services/asr-service/asr-server/src/infrastructure/repository

# 创建翻译服务（同上结构）
mkdir -p services/translate-service/translate-api/src
mkdir -p services/translate-service/translate-server/src/interfaces/...
# ... 省略重复目录，结构同上
代码迁移映射（以 ASR 为例）：

原路径 (packages/gateway/)
新路径 (services/asr-service/)
DDD 层级
services/QwenASRService.ts	asr-server/src/infrastructure/external/DashScopeWSClient.ts	基础设施层
handlers/wsHandler.ts (音频接收部分)	asr-server/src/interfaces/websocket/ASRWebSocketHandler.ts	接口层
handlers/wsHandler.ts (状态管理)	asr-server/src/application/service/ASRApplicationService.ts	应用服务层
(新增) 连接状态对象 connState	asr-server/src/domain/model/ASRSession.ts	领域层
(新增) WaitKScheduler.ts	translate-server/src/domain/service/WaitKDomainService.ts	领域层

API 模块纯洁性约束（asr-api 里只能放这些）：

typescript

// services/asr-service/asr-api/src/dto/AudioChunkDTO.ts
// services/asr-service/asr-api/src/dto/ASRResultDTO.ts
// services/asr-service/asr-api/src/enums/ASRModelEnum.ts
// services/asr-service/asr-api/src/index.ts (统一导出)
禁止在 asr-api 中引入 fastify、ioredis 等框架依赖！

第三步：独立网关与认证中心 (gateway/ 和 auth/)
目标：原 packages/gateway/ 升级为纯路由网关，剥离业务逻辑和认证逻辑。

bash

# 1. 将原 gateway 移动并重命名
mv packages/gateway gateway/gateway-service

# 2. 剥离出来的认证逻辑放入 auth
mkdir -p auth/auth-service/src/interfaces/controller
mkdir -p auth/auth-service/src/application/service
mkdir -p auth/auth-service/src/domain/model
mkdir -p auth/auth-service/src/infrastructure/repository
职责重新界定：

gateway/gateway-service：只做路由转发（/ws/asr → asr-service）、跨域、请求日志。不写任何业务代码。
auth/auth-service：接管原 wsHandler.ts 里的 if (msg.type === 'auth') 逻辑，负责 API Key 校验和 Token 发放。
第四步：平台组件归拢 (components/)
目标：将非核心业务链路的辅助系统放入 components/。

bash

mkdir -p components/web-console
mkdir -p components/desktop-lyrics

# 移动前端
mv packages/web/* components/web-console/

# 移动桌面字幕
mv packages/desktop-lyrics/* components/desktop-lyrics/

# 删除空的 packages 目录及预留的空包
rm -rf packages/
第五步：补齐企业级基建目录
目标：补全架构规范中要求的配置、文档、脚本、容器化目录。

bash

# 1. 配置中心（替代原来的 .env 文件管理方式）
mkdir -p config/env/DEV
mkdir -p config/env/TEST
mkdir -p config/env/PROD

# 2. 文档体系
mkdir -p docs/api-design
mkdir -p docs/database     # 存放 SQL 迁移脚本
mkdir -p docs/diagrams     # 存放 drawio 架构图

# 3. 脚本与 CI/CD
mkdir -p scripts/ci
mkdir -p scripts/deploy

# 4. 容器化
mkdir -p docker/services
mkdir -p k8s/configmap
mkdir -p k8s/secrets
第六步：更新 pnpm-workspace.yaml
由于目录从扁平的 packages/* 变成了多层级，必须修改 pnpm 的工作区配置：

yaml

# pnpm-workspace.yaml
packages:
  - 'common/*'
  - 'services/*/asr-api'
  - 'services/*/asr-server'
  - 'services/*/translate-api'
  - 'services/*/translate-server'
  - 'gateway/*'
  - 'auth/*'
  - 'components/*'
第七步：重写 README.md 的目录树
将 README 的结构说明替换为完全对标 Java 架构的新树：

📁 项目目录结构
livetranslate-platform/├── pnpm-workspace.yaml # pnpm 多层级工作区配置├── package.json # 根配置├── tsconfig.base.json # TypeScript 基础配置├── .editorconfig # 编辑器代码风格统一├── .gitignore # Git 忽略规则├── README.md
│├── common/ # 公共基础模块（按需引入）│ ├── common-core/ # 核心工具：常量、类型定义、异常枚举│ ├── common-web/ # Web 通用：统一响应体 Result、全局异常处理│ ├── common-websocket/ # WebSocket 通用：连接池管理、消息编解码│ ├── common-redis/ # Redis 通用：会话状态缓存封装│ └── common-security/ # 安全通用：API Key 解析、鉴权守卫│├── components/ # 平台级组件与边缘服务│ ├── web-console/ # React 前端控制台 (Vite)│ └── desktop-lyrics/ # 桌面字幕侧车服务│├── gateway/ # API 网关服务（统一入口）│ └── gateway-service/ # Fastify 路由转发、WebSocket 代理、日志│├── auth/ # 认证授权中心│ └── auth-service/ # API Key 校验、令牌管理│├── services/ # 核心业务服务群（DDD 分层）│ ├── asr-service/
│ │ ├── asr-api/ # 对外暴露：DTO、枚举、类型契约│ │ └── asr-server/ # 服务实现│ │ └── src/│ │ ├── interfaces/ # 接口适配层│ │ ├── application/ # 应用服务层（用例编排）│ │ ├── domain/ # 领域层（核心逻辑，如 DashScope 状态机）│ │ └── infrastructure/ # 基础设施层（外部 API 调用）│ ││ └── translate-service/│ ├── translate-api/│ └── translate-server/│ └── src/│ ├── interfaces/│ ├── application/│ ├── domain/ # 包含 Wait-K 调度算法核心逻辑│ └── infrastructure/│├── config/ # 多环境配置管理│ └── env/│ ├── DEV/ # 开发环境变量│ ├── TEST/ # 测试环境变量│ └── PROD/ # 生产环境变量│├── docs/ # 项目文档体系│ ├── architecture.md # 架构设计说明│ ├── api-design/ # 接口协议文档│ ├── database/ # 数据库迭代脚本│ └── diagrams/ # 架构图源文件│├── scripts/ # 自动化脚本│ ├── ci/ # CI/CD 流水线配置│ └── deploy/ # 部署脚本│├── docker/ # Docker 镜像构建│ └── services/ # 各服务 Dockerfile│└── k8s/ # Kubernetes 编排清单 ├── configmap/ └── secrets/

附：DDD 层级代码规范（写入 README 的开发说明）
为了防止团队把 DDD 目录写回“大杂烩”，必须在 README 中补充严格的层级依赖规范：

🏢 DDD 分层依赖规范（强制）
在 services/*/xxx-server/ 中，严禁跨层调用，依赖方向必须单向向下：

✅ 允许的依赖方向：interfaces → application → domain ← infrastructure (实现 domain 的接口)

❌ 禁止的违规操作：

domain 层 禁止引入 fastify、ioredis、axios 等外部框架。
infrastructure 层 禁止直接被 interfaces 层 import（必须经过 application 层编排）。
xxx-api 模块 禁止依赖任何 xxx-server 的代码，只允许包含纯 TypeScript 类型和接口。