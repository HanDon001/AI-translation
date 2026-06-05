import type { ASRChunkEvent, ASRCorrectEvent } from '@realtime-interp/shared';
import type { IAsrProvider } from './IAsrProvider.js';
import { getScriptResponse } from '../mocks/asrMock.js';

/**
 * Mock ASR 引擎实现
 * 根据预定义剧本返回识别结果，不调用任何外部 API
 */
export class MockAsrProvider implements IAsrProvider {
  private windowCounter = 0;

  async *recognize(_audioChunk: { window_id: number; data: Float32Array }): AsyncIterable<ASRChunkEvent | ASRCorrectEvent> {
    this.windowCounter++;
    const response = getScriptResponse(this.windowCounter);

    if (response) {
      // 模拟延迟
      await new Promise((r) => setTimeout(r, 100));
      yield response;
    }
  }
}
