import { describe, it, expect } from 'vitest';
import { mockTranslate } from '../../src/mocks/translatorMock.js';

describe('translatorMock', () => {
  it('adds temp prefix for non-final text', () => {
    const result = mockTranslate('hello', false);
    expect(result).toContain('[临]');
    expect(result).toContain('hello');
  });

  it('adds final prefix for final text', () => {
    const result = mockTranslate('hello', true);
    expect(result).toContain('[终]');
  });
});
