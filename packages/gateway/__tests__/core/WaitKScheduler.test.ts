import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../../src/core/RingBuffer.js';
import { WaitKScheduler } from '../../src/core/WaitKScheduler.js';
import type { BufferNode } from '@realtime-interp/shared';

function makeNode(windowId: number, text: string): BufferNode {
  return {
    window_id: windowId,
    source_text: text,
    translated_text: '',
    is_final: false,
    start_ms: windowId * 400,
    end_ms: (windowId + 1) * 400,
  };
}

describe('WaitKScheduler', () => {
  let buffer: RingBuffer;
  let scheduler: WaitKScheduler;

  beforeEach(() => {
    buffer = new RingBuffer();
    scheduler = new WaitKScheduler(buffer);
  });

  it('returns null when fewer than K windows', () => {
    const result = scheduler.handleASRChunk(makeNode(0, 'a'));
    expect(result).toBeNull();
  });

  it('emits ADD_TEMP when K windows accumulated', () => {
    scheduler.handleASRChunk(makeNode(0, 'a'));
    scheduler.handleASRChunk(makeNode(1, 'b'));
    const result = scheduler.handleASRChunk(makeNode(2, 'c'));
    expect(result).not.toBeNull();
    expect(result!.action).toBe('ADD_TEMP');
    expect(result!.style).toBe('temp');
  });

  it('emits MARK_FINAL for is_final node', () => {
    scheduler.handleASRChunk(makeNode(0, 'a'));
    scheduler.handleASRChunk(makeNode(1, 'b'));
    const finalNode = makeNode(2, 'c');
    finalNode.is_final = true;
    const result = scheduler.handleASRChunk(finalNode);
    expect(result!.action).toBe('MARK_FINAL');
    expect(result!.style).toBe('final');
  });
});
