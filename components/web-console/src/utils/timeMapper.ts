/**
 * 时间轴映射 — 双向 Map<start_ms, HTMLSpanElement>
 *
 * 这是增量更新的唯一锚点
 */
export class TimeMapper {
  private map = new Map<number, HTMLSpanElement>();

  set(startMs: number, span: HTMLSpanElement): void {
    this.map.set(startMs, span);
  }

  get(startMs: number): HTMLSpanElement | undefined {
    return this.map.get(startMs);
  }

  /** 查询时间范围内的所有 span */
  getRange(startMs: number, endMs: number): HTMLSpanElement[] {
    const result: HTMLSpanElement[] = [];
    for (const [ms, span] of this.map) {
      if (ms >= startMs && ms <= endMs) {
        result.push(span);
      }
    }
    return result.sort((a, b) => Number(a.dataset.startMs) - Number(b.dataset.startMs));
  }

  delete(startMs: number): boolean {
    return this.map.delete(startMs);
  }

  /** 删除最早 N 个节点 */
  pruneOldest(count: number): void {
    const sorted = [...this.map.entries()].sort(([a], [b]) => a - b);
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      this.map.delete(sorted[i][0]);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
