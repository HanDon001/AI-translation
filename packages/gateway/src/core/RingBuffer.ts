import type { BufferNode } from '@realtime-interp/shared';
import { RING_CAPACITY_MS } from '@realtime-interp/shared';

/**
 * 环形缓冲区 — 存储最近的 ASR 识别节点
 * 容量固定 (约 10 秒)，超出自动覆盖最旧数据
 */
export class RingBuffer {
  private nodes: BufferNode[] = [];
  private readonly capacity: number;

  constructor(capacityMs: number = RING_CAPACITY_MS) {
    this.capacity = Math.ceil(capacityMs / 400); // 每窗400ms
  }

  push(node: BufferNode): void {
    if (this.nodes.length >= this.capacity) {
      this.nodes.shift();
    }
    this.nodes.push(node);
  }

  getByWindowId(windowId: number): BufferNode | undefined {
    return this.nodes.find((n) => n.window_id === windowId);
  }

  /** 获取修正点前后各 N 个窗口的上下文 */
  getContextRange(windowId: number, before: number, after: number): BufferNode[] {
    const idx = this.nodes.findIndex((n) => n.window_id === windowId);
    if (idx === -1) return [];
    const start = Math.max(0, idx - before);
    const end = Math.min(this.nodes.length, idx + after + 1);
    return this.nodes.slice(start, end);
  }

  get size(): number {
    return this.nodes.length;
  }

  get last(): BufferNode | undefined {
    return this.nodes[this.nodes.length - 1];
  }

  getAll(): ReadonlyArray<BufferNode> {
    return this.nodes;
  }
}
