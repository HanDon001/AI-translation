/**
 * 环形缓冲区节点
 * 存储每个窗口的源文、译文和状态
 */
export interface BufferNode {
  window_id: number;
  source_text: string;
  translated_text: string;
  is_final: boolean;
  start_ms: number;
  end_ms: number;
}

/**
 * 待翻译队列条目
 */
export interface PendingQueueItem {
  window_ids: number[];
  source_texts: string[];
  start_ms: number;
  end_ms: number;
}

/**
 * 环形缓冲区状态快照（调试用）
 */
export interface RingBufferState {
  capacity: number;
  size: number;
  nodes: BufferNode[];
  head: number;
  tail: number;
}
