import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../../src/core/DiffEngine.js';

describe('DiffEngine', () => {
  const engine = new DiffEngine();

  it('detects single character replacement at the start', () => {
    const result = engine.calculateDiff('饿要去北', '我要去北');
    expect(result.startOffset).toBe(0);
    expect(result.endOffset).toBe(1);
    expect(result.replacedText).toBe('我');
  });

  it('returns empty diff when texts are identical', () => {
    const result = engine.calculateDiff('我要去北京', '我要去北京');
    expect(result.replacedText).toBe('');
  });

  it('detects insertion mid-string', () => {
    const result = engine.calculateDiff('我去北京', '我要去北京');
    expect(result.replacedText).toBe('要');
  });
});
