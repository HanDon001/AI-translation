import type { BufferNode, SubtitlePatchPayload } from '@realtime-interp/shared';
import { K } from '@realtime-interp/shared';
import { DiffEngine } from './DiffEngine.js';
import type { RingBuffer } from './RingBuffer.js';
import { translateText } from '../services/translatorService.js';

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
  private apiKey = '';

  constructor(private buffer: RingBuffer) {}

  /** 设置 API Key */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /** 处理新 ASR 碎片 */
  async handleASRChunk(node: BufferNode): Promise<SubtitlePatchPayload | null> {
    this.pendingQueue.push(node);

    if (this.pendingQueue.length < K) {
      return null;
    }

    const target = this.pendingQueue.shift()!;
    const context = [target, ...this.pendingQueue.slice(0, K - 1)];

    const translatedText = await this.translate(context);
    target.translated_text = translatedText;

    return {
      action: node.is_final ? 'MARK_FINAL' : 'ADD_TEMP',
      target_range: [target.start_ms, target.end_ms],
      new_text: translatedText,
      style: node.is_final ? 'final' : 'temp',
    };
  }

  /** 处理 ASR 修正 */
  async handleASRCorrect(windowId: number, newSourceText: string): Promise<SubtitlePatchPayload | null> {
    const node = this.buffer.getByWindowId(windowId);
    if (!node) return null;

    const oldTranslation = node.translated_text;
    node.source_text = newSourceText;

    const context = this.buffer.getContextRange(windowId, 1, 1);
    const newTranslation = await this.translate(context);
    node.translated_text = newTranslation;

    const diff = this.diffEngine.calculateDiff(oldTranslation, newTranslation);

    return {
      action: 'INVALIDATE',
      target_range: [diff.startOffset, diff.endOffset],
      new_text: diff.replacedText,
    };
  }

  private async translate(nodes: BufferNode[]): Promise<string> {
    const text = nodes.map((n) => n.source_text).join(' ');

    // 有 API Key 时调用真实翻译
    if (this.apiKey) {
      try {
        return await translateText({ text, apiKey: this.apiKey });
      } catch (err) {
        console.error('[Translator] API failed, using mock:', err);
      }
    }

    // 降级到 Mock
    const isFinal = nodes.some((n) => n.is_final);
    return isFinal ? `[终] ${text}` : `[临] ${text}`;
  }
}
