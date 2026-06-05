/**
 * ASR Engine 微服务客户端
 * 通过内部 WebSocket 连接到 asr-engine，发送 PCM 数据，接收识别结果
 *
 * V1 Mock 模式：不实际连接，由 wsHandler 直接模拟返回
 */
export class AsrClient {
  // TODO: V1.1 实现真实 WebSocket 连接
}
