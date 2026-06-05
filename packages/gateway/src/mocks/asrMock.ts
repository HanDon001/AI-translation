import type { ASRChunkEvent, ASRCorrectEvent } from '@realtime-interp/shared';

/**
 * ASR 引擎抽象接口
 */
export interface IAsrProvider {
  recognize(audioChunk: { window_id: number; data: Float32Array }): AsyncIterable<ASRChunkEvent | ASRCorrectEvent>;
}

/**
 * Mock ASR 剧本 — 模拟语音识别流式输出
 * 实际场景中替换为 Azure/Google/Whisper 等真实 ASR 服务
 */
const SCRIPT: Array<{ text: string; is_final?: boolean }> = [
  { text: 'Hello' },
  { text: 'everyone' },
  { text: 'welcome to' },
  { text: 'the meeting', is_final: true },
];

/**
 * Mock ASR 引擎实现
 * 根据 window_id 循环返回剧本内容
 */
export class MockAsrProvider implements IAsrProvider {
  async *recognize(audioChunk: { window_id: number; data: Float32Array }): AsyncIterable<ASRChunkEvent | ASRCorrectEvent> {
    const scriptIndex = audioChunk.window_id % SCRIPT.length;
    const entry = SCRIPT[scriptIndex];

    // 模拟处理延迟
    await new Promise((r) => setTimeout(r, 50));

    const startMs = audioChunk.window_id * 400;
    yield {
      type: 'asr_chunk',
      payload: {
        window_id: audioChunk.window_id,
        text: entry.text,
        start_ms: startMs,
        end_ms: startMs + 400,
        is_final: entry.is_final ?? false,
      },
    };
  }
}
