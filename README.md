第一步：技术栈决策与依赖版本锁定
目标：建立根 pom.xml，锁定所有版本

xml

<!-- microservice-platform/pom.xml -->
<properties>
    <java.version>17</java.version>
    <spring-boot.version>3.2.0</spring-boot.version>
    <spring-cloud.version>2023.0.0</spring-cloud.version>
    <spring-cloud-alibaba.version>2023.0.1.0</spring-cloud-alibaba.version>
    <mybatis-plus.version>3.5.5</mybatis-plus.version>
    <hutool.version>5.8.25</hutool.version>
    <!-- 音频处理 -->
    <tarsosdsp.version>2.5</tarsosdsp.version>
    <!-- WebSocket 客户端（调 DashScope） -->
    <java-websocket.version>1.5.4</java-websocket.version>
</properties>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>${spring-boot.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <!-- ... Spring Cloud, Alibaba BOM ... -->
    </dependencies>
</dependencyManagement>

<modules>
    <module>common</module>
    <module>components</module>
    <module>gateway</module>
    <module>auth</module>
    <module>services</module>
    <module>config</module>
</modules>
从 README 中需要迁移的依赖映射：

原 Node.js 依赖
Java 替代方案
fastify + @fastify/websocket	Spring Cloud Gateway + WebSocket 支持
ws (DashScope 客户端)	Java-WebSocket 库
react + vite	保持不变（前端独立仓库或 components/ 下）
tailwindcss	保持不变
ctypes (Win32 API)	JNA / JNR 或保留 Python 作为 sidecar

第二步：重建顶层目录结构
目标：从 pnpm 扁平结构 → Maven 分层结构

text

# 之前
同声传译助手/
├── packages/
│   ├── web/
│   ├── gateway/
│   ├── desktop-lyrics/
│   ├── shared/
│   ├── asr-engine/
│   └── translator/
├── start.bat
└── pnpm-workspace.yaml

# 之后
livetranslate-platform/
├── pom.xml                          # 根 POM
├── .gitignore
├── .editorconfig
├── README.md
├── LICENSE
│
├── common/                          # 【新建】公共基础模块
├── components/                      # 【新建】平台组件
│   └── desktop-lyrics/              # Python 字幕服务迁入
├── gateway/                         # 【重构】API 网关
├── auth/                            # 【新建】认证中心
├── services/                        # 【新建】业务服务群
│   ├── asr-service/
│   └── translate-service/
├── config/                          # 【新建】Nacos 配置导出
├── docs/                            # 【新建】项目文档
├── scripts/                         # 【新建】CI/CD 脚本
├── docker/                          # 【新建】Docker 构建
└── k8s/                             # 【新建】K8s 部署清单
前端去哪了？ 两种策略：

策略 A：前端作为独立 Git 仓库，不纳入 Java monorepo
策略 B：放入 components/web-console/，用 frontend-maven-plugin 构建
第三步：拆分公共基础模块
目标：将 packages/shared/ 的单一模块拆为 7 个职责模块

text

# 之前：一个 shared 包全包
packages/shared/src/
├── types/events.ts      →  全部类型混在一起
├── types/subtitle.ts
├── types/transport.ts
├── guards/eventGuards.ts
└── constants.ts

# 之后：按职责拆分
common/
├── common-core/
│   └── src/main/java/com/livetranslate/common/core/
│       ├── exception/                    # 业务异常码枚举
│       │   └── ErrorCodeEnum.java        # 从 TS 类型守卫迁移
│       ├── constant/                     # 常量定义
│       │   └── AudioConstant.java        # 采样率、窗口大小等
│       └── util/
│           ├── AudioConvertUtil.java     # Float32/Base64 转换
│           └── Base64Util.java
│
├── common-web/
│   └── src/main/java/com/livetranslate/common/web/
│       ├── result/Result.java            # 统一响应体（替代直接返回 JSON）
│       ├── handler/GlobalExceptionHandler.java
│       └── config/WebMvcConfig.java
│
├── common-redis/
│   └── src/main/java/com/livetranslate/common/redis/
│       ├── config/RedisConfig.java       # 会话状态缓存
│       └── util/SessionCacheUtil.java    # window_id → 会话状态
│
├── common-mq/
│   └── src/main/java/com/livetranslate/common/mq/
│       ├── producer/TranslationEventPublisher.java  # 翻译结果发布
│       └── consumer/                      # 字幕推送消费
│
├── common-feign/
│   └── src/main/java/com/livetranslate/common/feign/
│       ├── interceptor/HeaderTransferInterceptor.java  # 透传 tenant/session
│       └── fallback/
│
├── common-websocket/                     # 【新增】WebSocket 通用
│   └── src/main/java/com/livetranslate/common/websocket/
│       ├── handler/AbstractWebSocketHandler.java
│       ├── session/SessionManager.java   # 替代原 connState 管理
│       └── message/MessageCodec.java     # 替代原 JSON.parse/stringify
│
└── common-security/
    └── src/main/java/com/livetranslate/common/security/
        ├── annotation/ApiKeyRequired.java  # 替代原 if(!connState.apiKey)
        └── filter/ApiKeyAuthFilter.java
关键迁移点：

typescript

// README 中的类型定义 → Java 枚举/类
// 之前
export interface SubtitlePatchPayload {
  action: 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';
  target_range: [number, number];
  new_text: string;
  style: 'temp' | 'final';
}

// 之后
public class SubtitlePatchPayload {
    private SubtitleAction action;    // 枚举：ADD_TEMP, MARK_FINAL, INVALIDATE
    private int[] targetRange;        // [startMs, endMs]
    private String newText;
    private SubtitleStyle style;      // 枚举：TEMP, FINAL
}
第四步：业务服务拆分 + DDD 分层落地
目标：将 packages/gateway/ 的混合逻辑拆为独立服务

4.1 ASR 服务
text

services/asr-service/
├── pom.xml                          # 聚合 POM
│
├── asr-api/                         # 对外暴露
│   └── src/main/java/com/livetranslate/asr/api/
│       ├── dto/
│       │   ├── AudioChunkDTO.java           # 对应原 AudioChunkEvent
│       │   ├── ASRResultDTO.java
│       │   └── ASRSessionConfigDTO.java
│       ├── feign/
│       │   └── AsrFeignClient.java          # 供 translate-service 调用
│       └── enums/
│           └── ASRModelEnum.java            # qwen3-asr-flash-realtime 等
│
└── asr-server/                      # 服务实现
    └── src/main/java/com/livetranslate/asr/
        ├── interfaces/
        │   ├── controller/
        │   │   └── ASRStreamController.java     # HTTP 流式接口
        │   └── websocket/
        │       └── ASRWebSocketHandler.java      # WebSocket 接口
        │
        ├── application/
        │   ├── service/
        │   │   └── ASRApplicationService.java    # 编排：接收音频 → 调引擎 → 发事件
        │   └── assembler/
        │       └── ASRResultAssembler.java       # 领域对象 → DTO
        │
        ├── domain/
        │   ├── model/
        │   │   ├── ASRSession.java               # 聚合根（对应原 connState）
        │   │   ├── AudioSegment.java             # 实体
        │   │   └── RecognitionResult.java        # 值对象
        │   ├── repository/
        │   │   └── ASRSessionRepository.java     # 仓储接口
        │   ├── service/
        │   │   └── QwenASRDomainService.java     # 对应原 QwenASRService.ts
        │   └── event/
        │       └── ASRCompletedEvent.java
        │
        ├── infrastructure/
        │   ├── repository/
        │   │   └── ASRSessionRepositoryImpl.java  # Redis 实现
        │   ├── external/
        │   │   └── DashScopeWSClient.java          # 对应原 WebSocket 连接逻辑
        │   ├── config/
        │   │   └── DashScopeConfig.java
        │   └── mq/
        │       └── ASRResultPublisher.java
        │
        └── ASRServiceApplication.java
核心逻辑迁移对照：

typescript

// ========== README 中的 QwenASRService.ts ==========
const ws = new WebSocket(
  `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);
ws.send(JSON.stringify({
  type: 'session.update',
  session: {
    modalities: ['text'],
    input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
    translation: { language: targetLang },
  },
}));

// ========== 迁移后：DashScopeWSClient.java ==========
@Component
public class DashScopeWSClient {

    public void connect(ASRSessionConfig config) {
        String url = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model="
                     + config.getModel();
        // 使用 Java-WebSocket 库
        WebSocketClient ws = new WebSocketClient(URI.create(url)) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                // 发送 session.update
                SessionUpdateRequest req = new SessionUpdateRequest();
                req.setModalities(List.of("text"));
                req.setInputAudioTranscription(
                    new TranscriptionConfig("qwen3-asr-flash-realtime"));
                req.setTranslation(new TranslationConfig(config.getTargetLang()));
                this.send(JSON.toJSONString(req));
            }
            @Override
            public void onMessage(String message) {
                // 解析并发布领域事件
                handleDashScopeMessage(message);
            }
        };
        ws.addHeader("Authorization", "Bearer " + config.getApiKey());
        ws.connect();
    }
}
4.2 翻译服务
text

services/translate-service/
├── translate-api/
│   └── src/.../api/
│       ├── dto/
│       │   ├── TranslateRequestDTO.java
│       │   └── SubtitlePatchDTO.java        # 对应原 SubtitlePatchPayload
│       └── feign/TranslateFeignClient.java
│
└── translate-server/
    └── src/.../translate/
        ├── interfaces/
        │   ├── controller/TranslateController.java
        │   └── mq/TranslateResultConsumer.java  # 监听 ASR 结果
        │
        ├── application/
        │   └── service/TranslateApplicationService.java
        │       # 对应原 WaitKScheduler.ts + 翻译编排逻辑
        │
        ├── domain/
        │   ├── model/
        │   │   ├── TranslateTask.java           # 聚合根
        │   │   ├── SubtitleLine.java            # 实体（对应字幕补丁）
        │   │   └── WaitKBuffer.java             # 值对象（对应 WaitK 调度）
        │   ├── service/
        │   │   └── WaitKDomainService.java      # 对应原 WaitKScheduler.ts
        │   └── repository/TranslateTaskRepository.java
        │
        ├── infrastructure/
        │   ├── external/
        │   │   ├── MyMemoryTranslator.java     # 对应原 MyMemory API 调用
        │   │   └── QwenTranslator.java          # 对应原 Qwen 翻译
        │   └── repository/TranslateTaskRepositoryImpl.java
        │
        └── TranslateServiceApplication.java
4.3 桌面字幕服务
text

# 保留 Python 实现，但纳入 components/ 管理
components/desktop-lyrics/
├── lyrics_win32.py                 # 核心实现（保持不变）
├── lyrics_server.py                # 备用
├── requirements.txt
├── Dockerfile                      # 【新增】Python 镜像构建
└── config/
    └── application.yml             # 【新增】端口、字体等配置外部化
第五步：网关重构
目标：从 Fastify WebSocket → Spring Cloud Gateway

text

gateway/
└── gateway-service/
    └── src/main/java/com/livetranslate/gateway/
        ├── config/
        │   ├── RouteConfig.java              # 路由规则
        │   │   # /api/asr/**  → asr-service
        │   │   # /api/translate/** → translate-service
        │   │   # /api/auth/** → auth-service
        │   └── CorsConfig.java
        │
        ├── filter/
        │   ├── ApiKeyAuthFilter.java         # 对应原 if(!connState.apiKey) 逻辑
        │   ├── RequestLogFilter.java         # 对应原 requestLogger.ts
        │   └── WebSocketUpgradeFilter.java   # 【关键】WebSocket 路由透传
        │
        ├── handler/
        │   └── GatewayExceptionHandler.java  # 对应原 errorHandler.ts
        │
        └── GatewayApplication.java
WebSocket 透传的关键改造：

java

// README 中：网关直接处理 WebSocket 消息
// wsHandler.ts 直接接收 audio_chunk，调用 QwenASRService

// 架构.md 中：网关只做路由，不处理业务
// WebSocketUpgradeFilter.java
@Component
public class WebSocketUpgradeFilter implements GlobalFilter {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        
        if (path.startsWith("/ws/asr")) {
            // 将 WebSocket 连接升级请求透传到 asr-service
            return chain.filter(exchange);
        }
        return chain.filter(exchange);
    }
}
第六步：认证中心新建
目标：将散落在各处的 API Key 校验集中管理

text

auth/
└── auth-service/
    └── src/main/java/com/livetranslate/auth/
        ├── controller/
        │   ├── AuthController.java           # API Key 验证、令牌发放
        │   └── ApiKeyController.java         # API Key CRUD
        │
        ├── service/
        │   └── ApiKeyAuthService.java        # 校验逻辑
        │
        ├── domain/
        │   └── model/ApiKey.java             # 聚合根
        │
        └── infrastructure/
            └── repository/ApiKeyMapper.java  # MyBatis-Plus
迁移对照：

typescript

// README 中：每个 WebSocket 连接各自校验
// wsHandler.ts: if (msg.type === 'auth') { connState.apiKey = msg.payload.api_key; }

// 架构.md 中：统一走认证中心
// 1. 前端先调 auth-service 获取 JWT
// 2. 后续请求携带 JWT，网关 filter 统一校验
// 3. 业务服务不再关心认证逻辑
第七步：配置中心集成
目标：从 .env 文件 → Nacos 多环境配置

text

config/
├── nacos/
│   ├── DEV/
│   │   ├── application-dev.yml              # 公共配置
│   │   │   # dashscope.api-key: sk-xxx
│   │   │   # mymemory.base-url: https://api.mymemory.translated.net
│   │   ├── asr-service-dev.yml              # ASR 专属
│   │   │   # asr.default-model: qwen3.5-livetranslate-flash-realtime
│   │   │   # asr.sample-rate: 16000
│   │   ├── translate-service-dev.yml
│   │   └── gateway-dev.yml
│   ├── TEST/
│   └── PROD/
│       └── gateway-prod.yml                 # 生产环境禁用 Mock
│
└── local/
    └── nacos-standalone.yaml                # 本地 Nacos 配置
迁移对照：

bash

# README 中的 .env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
LOG_LEVEL=info

# 架构.md 中的 Nacos 配置
# application-dev.yml
dashscope:
  api-key: sk-xxxxxxxxxxxxxxxxxxxxxxxx
  ws-url: wss://dashscope.aliyuncs.com/api-ws/v1/realtime
  default-model: qwen3.5-livetranslate-flash-realtime

server:
  port: 3000

logging:
  level:
    com.livetranslate: info
第八步：Mock 模式工程化
目标：从代码内 if (!apiKey) 判断 → 配置驱动 + 策略模式

java

// README 中的硬编码 Mock
// wsHandler.ts: if (!connState.apiKey) { handleTranslateEvent({ type: 'FINAL', text: MOCK_SCRIPT[idx] }); }

// 架构.md 中的策略模式
public interface ASREngine {
    void sendAudio(byte[] pcmData);
    void close();
}

@Service
@ConditionalOnProperty(name = "asr.engine", havingValue = "mock")
public class MockASREngine implements ASREngine {
    // Mock 实现
}

@Service
@ConditionalOnProperty(name = "asr.engine", havingValue = "qwen")
public class QwenASREngine implements ASREngine {
    // 真实实现
}

// Nacos 配置切换
# asr.engine: mock    # 开发环境
# asr.engine: qwen    # 生产环境
第九步：基础设施补齐
9.1 Docker
dockerfile

# docker/services/asr-server/Dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/asr-server.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
yaml

# docker/docker-compose.yml
version: '3.8'
services:
  nacos:
    image: nacos/nacos-server:v2.3.0
    ports: ["8848:8848"]
  
  gateway:
    build: ./gateway
    ports: ["3000:3000"]
    depends_on: [nacos]
  
  asr-service:
    build: ./services/asr-server
    depends_on: [nacos]
  
  translate-service:
    build: ./services/translate-server
    depends_on: [nacos, asr-service]
  
  desktop-lyrics:
    build: ./components/desktop-lyrics   # Python 镜像
    ports: ["8765:8765"]
9.2 K8s
yaml

# k8s/asr-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: asr-service
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: asr-service
          image: livetranslate/asr-server:latest
          ports: [{containerPort: 8080}]
          env:
            - name: NACOS_ADDR
              valueFrom:
                configMapKeyRef:
                  name: livetranslate-config
                  key: nacos.addr
9.3 CI/CD
groovy

// scripts/ci/Jenkinsfile
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'mvn clean package -DskipTests'
            }
        }
        stage('Test') {
            steps {
                sh 'mvn test'
            }
        }
        stage('SonarQube') {
            steps {
                sh 'mvn sonar:sonar'
            }
        }
        stage('Docker Build') {
            steps {
                sh 'docker build -t livetranslate/asr-server:$BUILD_TAG ./docker/services/asr-server'
            }
        }
        stage('Deploy to K8s') {
            steps {
                sh 'kubectl apply -f k8s/'
            }
        }
    }
}
第十步：文档体系重建
目标：从单个 README → 分层文档

text

docs/
├── architecture.md                  # 【改造后的主文档，对应架构.md 风格】
├── api-design/
│   ├── websocket-protocol.md        # 从 README「API 接口」章节迁移
│   ├── rest-api.md                  # 新增 REST 接口文档
│   └── subtitle-http-api.md         # 从 README「桌面字幕 HTTP API」迁移
├── database/
│   ├── V1.0__init_schema.sql        # 新增：API Key 表、用户表
│   └── V1.1__add_session_table.sql  # 新增：会话持久化
├── diagrams/
│   ├── overall-architecture.drawio  # 从 README「架构概览」ASCII 图迁移
│   ├── asr-flow-sequence.drawio     # 新增：ASR 处理时序图
│   └── waitk-algorithm.drawio       # 新增：Wait-K 算法流程图
├── migration/
│   └── node-to-java-migration.md    # 【本文档】迁移指南
└── decisions/
    ├── ADR-001-use-nacos.md         # 架构决策记录
    └── ADR-002-keep-python-lyrics.md # 为什么字幕服务保留 Python
第十一步：前端改造（如采用策略 B）
text

components/web-console/
├── package.json
├── vite.config.ts                   # 保持不变
├── src/                             # 保持原有 React 代码结构
│   ├── App.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts          # 修改：连接网关而非直连 gateway
│   │   └── ...
│   └── ...
└── Dockerfile                       # 【新增】Nginx 静态托管
前端改动点：

typescript

// README 中：直连后端
const ws = new WebSocket('ws://localhost:3000');

// 架构.md 中：通过网关
const ws = new WebSocket('ws://gateway:3000/ws/asr');
// 并在握手时携带 JWT
const ws = new WebSocket('ws://gateway:3000/ws/asr', [], {
  headers: { Authorization: `Bearer ${token}` }
});
第十二步：工程规范落地
目标：补充架构.md 中要求的工程化约定

xml

<!-- 根 pom.xml 中强制接入 -->
<plugins>
    <!-- Checkstyle -->
    <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-checkstyle-plugin</artifactId>
        <version>3.3.1</version>
        <executions>
            <execution>
                <goals><goal>check</goal></execution>
            </execution>
        </executions>
    </plugin>
    
    <!-- SpotBugs -->
    <plugin>
        <groupId>com.github.spotbugs</groupId>
        <artifactId>spotbugs-maven-plugin</artifactId>
        <version>4.8.3.0</version>
    </plugin>
</plugins>
新增 .editorconfig：

ini

root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true

[*.{ts,tsx,json,yml}]
indent_size = 2

[*.java]
indent_size = 4
改造优先级与工时估算
优先级
步骤
工时估算
前置依赖
P0	第二步：目录结构重建	0.5 天	无
P0	第三步：common 模块拆分	2 天	第二步
P0	第四步：ASR/翻译服务 DDD 拆分	5 天	第三步
P0	第五步：网关重构	2 天	第四步
P1	第六步：认证中心	2 天	第五步
P1	第七步：Nacos 配置集成	1 天	第四步
P1	第八步：Mock 模式工程化	1 天	第四步
P2	第九步：Docker/K8s/CI	2 天	第四步
P2	第十步：文档重建	1.5 天	全部
P2	第十一步：前端适配	1 天	第五步
P2	第十二步：工程规范	0.5 天	第二步
总计	~18.5 天	

不建议迁移的部分
以下内容在架构.md 中没有对应物，建议保持原样或降级处理：

Win32 桌面字幕：Java 没有对等的原生 Win32 透明窗口方案（JNA 可行但复杂度高），保留 Python sidecar 是合理决策
AudioWorklet 处理器：这是浏览器端技术，与后端架构无关，保持不变
Web Speech API Hook：纯前端能力，保持不变
start.bat：在 Docker Compose 就绪前，可保留作为本地快速启动方式
最终交付物清单
改造完成后，应产出：

 符合架构.md 目录骨架的 Maven 工程
 7 个 common-* 模块，每个可独立引入
 asr-service 和 translate-service 各含 api + server 双模块
 每个服务内部遵循 DDD 四层架构
 Spring Cloud Gateway 替代 Fastify
 Nacos 配置中心替代 .env
 config/nacos/ 下三套环境配置
 docker/docker-compose.yml 可一键拉起全栈
 k8s/ 下各服务 Deployment + Ingress
 docs/ 下完整文档体系
 根 pom.xml 统一管理所有版本
 Checkstyle + SonarQube 接入