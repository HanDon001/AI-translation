/**
 * Translator 微服务客户端
 * 通过内部 WebSocket 连接到 translator，发送源文本，接收翻译结果
 *
 * V1 Mock 模式：不实际连接，由 WaitKScheduler 直接模拟翻译
 */
export class TranslatorClient {
  // TODO: V1.1 实现真实 WebSocket 连接
}
