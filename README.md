# LiveTranslate Platform

> 实时同声传译微服务平台 - Java Spring Cloud 架构

## 项目结构

```
livetranslate-platform/
├── pom.xml                          # 根 POM
├── .editorconfig                    # 编辑器配置
├── .gitignore                       # Git 忽略规则
│
├── common/                          # 公共基础模块
│   ├── common-core/                 # 异常、常量、工具类
│   ├── common-web/                  # 统一响应、全局异常处理
│   ├── common-redis/                # 会话缓存
│   ├── common-websocket/            # WebSocket 管理
│   └── common-security/             # API Key 认证
│
├── services/                        # 业务服务
│   ├── asr-service/                 # ASR 语音识别
│   │   ├── asr-api/                 # DTO、Feign、枚举
│   │   └── asr-server/              # DDD 四层架构
│   └── translate-service/           # 翻译服务
│       ├── translate-api/
│       └── translate-server/
│
├── gateway/                         # API 网关
│   └── gateway-service/             # Spring Cloud Gateway
│
├── auth/                            # 认证中心
│   └── auth-service/
│
├── components/                      # 平台组件
│   ├── desktop-lyrics/              # 桌面字幕（Python + Win32）
│   └── web-console/                 # Web 控制台
│
├── config/                          # Nacos 配置
│   └── nacos/DEV/PROD/
│
├── docker/                          # Docker 构建
│   ├── docker-compose.yml
│   └── Dockerfile
│
├── docs/                            # 文档
│   ├── architecture.md
│   ├── api-design/
│   └── decisions/
│
└── scripts/                         # CI/CD
    └── ci/Jenkinsfile
```

## 技术栈

- Java 17
- Spring Boot 3.2.0
- Spring Cloud 2023.0.0
- Spring Cloud Alibaba 2023.1.1.0
- MyBatis-Plus 3.5.5
- Nacos 配置中心
- Docker 部署

## 快速启动

### 1. 启动 Nacos

```bash
docker-compose up -d nacos
```

### 2. 构建项目

```bash
mvn clean package -DskipTests
```

### 3. 启动服务

```bash
# 启动网关
java -jar gateway/gateway-service/target/gateway-service.jar

# 启动 ASR 服务
java -jar services/asr-service/asr-server/target/asr-server.jar

# 启动翻译服务
java -jar services/translate-service/translate-server/target/translate-server.jar
```

### 4. 启动桌面字幕（可选）

```bash
cd components/desktop-lyrics
pip install -r requirements.txt
python lyrics_win32.py
```

## API 接口

### WebSocket

```
ws://localhost:3000/ws/asr
```

### REST API

```
POST /api/translate
GET  /api/auth/keys
```

## 文档

- [架构文档](docs/architecture.md)
- [WebSocket 协议](docs/api-design/websocket-protocol.md)
- [架构决策](docs/decisions/)
