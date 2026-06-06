/**
 * Wait-K 调度算法领域服务
 */
export class WaitKDomainService {
  private k = 3; // 等待 k 个词后再翻译

  processChunk(text: string, windowId: number): { shouldTranslate: boolean; text: string } {
    return {
      shouldTranslate: windowId % this.k === 0,
      text,
    };
  }
}
