import type { ASRChunkEvent, ASRCorrectEvent } from '@realtime-interp/shared';

/**
 * ASR Mock 剧本 — 模拟"我要去北京"被识别错再修正的过程
 *
 * 流程：
 *  window 1: "饿" → window 2: "要" → window 3: "去北" → window 4: "京" → correct: "饿"→"我"
 */
export const ASR_SCRIPT: Array<{ response: ASRChunkEvent | ASRCorrectEvent; delayMs: number }> = [
  {
    response: {
      type: 'asr_chunk',
      payload: { window_id: 1, text: '饿', start_ms: 0, end_ms: 400 },
    },
    delayMs: 100,
  },
  {
    response: {
      type: 'asr_chunk',
      payload: { window_id: 2, text: '要', start_ms: 400, end_ms: 800 },
    },
    delayMs: 100,
  },
  {
    response: {
      type: 'asr_chunk',
      payload: { window_id: 3, text: '去北', start_ms: 800, end_ms: 1200 },
    },
    delayMs: 100,
  },
  {
    response: {
      type: 'asr_chunk',
      payload: { window_id: 4, text: '京', start_ms: 1200, end_ms: 1600, is_final: true },
    },
    delayMs: 100,
  },
  {
    response: {
      type: 'asr_correct',
      payload: { window_id: 1, text: '我', start_ms: 0, end_ms: 400 },
    },
    delayMs: 300,
  },
];

/**
 * 根据 window_id 从剧本返回对应的 ASR 事件
 * 返回 null 表示剧本结束
 */
export function getScriptResponse(windowId: number): ASRChunkEvent | ASRCorrectEvent | null {
  if (windowId <= 0 || windowId > ASR_SCRIPT.length) return null;
  const entry = ASR_SCRIPT[windowId - 1];
  return entry ? entry.response : null;
}
