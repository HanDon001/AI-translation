import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../../src/core/RingBuffer.js';
import type { BufferNode } from '@realtime-interp/shared';

function makeNode(windowId: number): BufferNode {
  return {
    window_id: windowId,
    source_text: `text-${windowId}`,
    translated_text: '',
    is_final: false,
    start_ms: windowId * 400,
    end_ms: (windowId + 1) * 400,
  };
}

describe('RingBuffer', () => {
  let buffer: RingBuffer;

  beforeEach(() => {
    buffer = new RingBuffer(5000); // 5s capacity ≈ 12 windows
  });

  it('stores nodes and allows retrieval by window_id', () => {
    buffer.push(makeNode(0));
    buffer.push(makeNode(1));
    expect(buffer.size).toBe(2);
    expect(buffer.getByWindowId(0)?.source_text).toBe('text-0');
  });

  it('returns undefined for missing window_id', () => {
    expect(buffer.getByWindowId(99)).toBeUndefined();
  });

  it('evicts oldest nodes when capacity exceeded', () => {
    // capacity ≈ 12, push 15
    for (let i = 0; i < 15; i++) {
      buffer.push(makeNode(i));
    }
    expect(buffer.size).toBeLessThanOrEqual(13);
    expect(buffer.getByWindowId(0)).toBeUndefined();
    expect(buffer.getByWindowId(14)).toBeDefined();
  });
});
