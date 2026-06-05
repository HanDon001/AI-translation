# ADR-002: 保留 Python 桌面字幕服务

## 状态

已采纳

## 背景

桌面字幕功能需要调用 Win32 API 实现透明窗口、鼠标穿透等原生功能。

## 决策

保留 Python 实现的桌面字幕服务，不迁移到 Java。

## 原因

1. Java 没有对等的原生 Win32 透明窗口方案
2. JNA 可行但复杂度高
3. Python ctypes 调用 Win32 API 更简洁
4. 桌面字幕是独立的 sidecar 服务，不影响主架构

## 后果

- 桌面字幕服务保持 Python 实现
- 通过 HTTP API 与主系统通信
- Docker 部署使用 Python 镜像
