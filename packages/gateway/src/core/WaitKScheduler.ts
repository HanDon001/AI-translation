import type { BufferNode, SubtitlePatchPayload } from '@realtime-interp/shared';
import { K } from '@realtime-interp/shared';
import { DiffEngine } from './DiffEngine.js';
import type { RingBuffer } from './RingBuffer.js';

/**
 * Wait-K 翻译调度器
 * 规则：
 *  - 缓冲区新增第 N 个窗口时，取 [N-K+1 .. N] 共 K 个窗口拼接翻译
 *  - K=3，句子开头 N<K 时不触发
 *  - 收到 asr_correct 时，重译修正点上下文并计算差异
 */
export class WaitKScheduler {
  private pendingQueue: BufferNode[] = [];
  private diffEngine = new DiffEngine();

  constructor(private buffer: RingBuffer) {}

  /** 处理新 ASR 碎片 */
  handleASRChunk(node: BufferNode): SubtitlePatchPayload | null {
    this.pendingQueue.push(node);

    if (this.pendingQueue.length < K) {
      return null; // 未达到 K 个窗口，等待
    }

    const target = this.pendingQueue.shift()!;
    const context = [target, ...this.pendingQueue.slice(0, K - 1)];

    const translatedText = this.translate(context);
    target.translated_text = translatedText;

    return {
      action: node.is_final ? 'MARK_FINAL' : 'ADD_TEMP',
      target_range: [target.start_ms, target.end_ms],
      new_text: translatedText,
      style: node.is_final ? 'final' : 'temp',
    };
  }

  /** 处理 ASR 修正 */
  handleASRCorrect(windowId: number, newSourceText: string): SubtitlePatchPayload | null {
    const node = this.buffer.getByWindowId(windowId);
    if (!node) return null;

    const oldTranslation = node.translated_text;
    node.source_text = newSourceText;

    // 提取上下文重译
    const context = this.buffer.getContextRange(windowId, 1, 1);
    const newTranslation = this.translate(context);
    node.translated_text = newTranslation;

    // 计算差异
    const diff = this.diffEngine.calculateDiff(oldTranslation, newTranslation);

    return {
      action: 'INVALIDATE',
      target_range: [diff.startOffset, diff.endOffset],
      new_text: diff.replacedText,
    };
  }

  private translate(nodes: BufferNode[]): string {
    const text = nodes.map((n) => n.source_text).join('');
    // V1 Mock: 临时加 TEMP: 前缀，最终态加 FINAL:
    const isFinal = nodes.some((n) => n.is_final);
    return isFinal ? `[终] ${text}` : `[临] ${text}`;
  }
}
