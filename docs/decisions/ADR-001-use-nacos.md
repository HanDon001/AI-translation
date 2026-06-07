# ADR-001: 使用 Nacos 作为配置中心

## 状态

已采纳（当前开发环境为可选组件）

## 背景

项目需要统一的配置管理方案来支持多环境（开发、测试、生产）的差异化配置，包括 DashScope 模型参数、服务地址、引擎模式等。

## 决策

使用 Alibaba Nacos 作为配置中心和服务发现组件。

## 原因

1. 与 Spring Cloud Alibaba 深度集成（Java 模块侧）
2. 支持多环境配置管理（`DEV/`、`PROD/` 目录结构）
3. 支持服务发现和健康检查
4. 社区活跃，阿里云原生支持
5. 配置热更新，无需重启服务

## 当前状态

- Nacos 配置已编写（`config/nacos/DEV/` 和 `config/nacos/PROD/`）
- TypeScript 服务使用硬编码默认值 + 前端动态配置（API Key、语言等通过 WebSocket 消息传递）
- `start.bat` 一键启动不依赖 Nacos，降低本地开发门槛
- Nacos 在 Docker Compose 部署和 Java 模块中使用

## 后果

- **正面**：生产环境配置与代码分离，变更无需重新构建
- **正面**：Java Spring Boot 模块可直接使用 Nacos 的服务发现和配置注入
- **负面**：本地开发需要额外部署 Nacos（Docker），增加了环境复杂度
- **缓解**：`start.bat` 走纯 TypeScript 路径，不依赖 Nacos，保证开发体验
