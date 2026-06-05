import { describe, it, expect } from 'vitest';
import { getScriptResponse } from '../../src/mocks/asrMock.js';

describe('asrMock', () => {
  it('returns ASR chunk for valid window_id', () => {
    const result = getScriptResponse(1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('asr_chunk');
    expect(result!.payload.text).toBe('饿');
  });

  it('returns correct event for window_id 5', () => {
    const result = getScriptResponse(5);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('asr_correct');
    expect(result!.payload.text).toBe('我');
  });

  it('returns null for out-of-range window_id', () => {
    expect(getScriptResponse(100)).toBeNull();
    expect(getScriptResponse(0)).toBeNull();
  });
});
