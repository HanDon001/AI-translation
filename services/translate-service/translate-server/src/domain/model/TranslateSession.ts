/**
 * 翻译会话聚合根
 * 解决全局状态并发 Bug - 每个 WebSocket 连接独立维护状态
 */
export class TranslateSession {
  private sentenceIdx = 0;
  private chunkCount = 0;

  handleChunk(): { shouldTranslate: boolean; isFinal: boolean; index: number } {
    this.chunkCount++;

    const shouldTranslate = this.chunkCount % TEMP_SUBTITLE_TRIGGER_CHUNKS === 0;
    const isFinal = this.chunkCount % FINAL_SUBTITLE_TRIGGER_CHUNKS === 0;

    if (isFinal) {
      this.sentenceIdx++;
    }

    return {
      shouldTranslate,
      isFinal,
      index: this.sentenceIdx,
    };
  }

  getSentenceIdx(): number {
    return this.sentenceIdx;
  }

  getChunkCount(): number {
    return this.chunkCount;
  }
}

// 常量 - 从 common-core 提取
const TEMP_SUBTITLE_TRIGGER_CHUNKS = 3;
const FINAL_SUBTITLE_TRIGGER_CHUNKS = 12;
