import type { ASRChunkEvent, ASRCorrectEvent } from '@realtime-interp/shared';

/**
 * ASR 引擎抽象接口
 * 任何语音识别引擎必须实现此接口
 */
export interface IAsrProvider {
  /**
   * 处理音频块，返回流式的识别结果
   */
  recognize(audioChunk: { window_id: number; data: Float32Array }): AsyncIterable<ASRChunkEvent | ASRCorrectEvent>;
}
