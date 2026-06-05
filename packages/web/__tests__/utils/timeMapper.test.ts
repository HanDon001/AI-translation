import { describe, it, expect, beforeEach } from 'vitest';
import { TimeMapper } from '../../src/utils/timeMapper.js';

describe('TimeMapper', () => {
  let mapper: TimeMapper;

  beforeEach(() => {
    mapper = new TimeMapper();
  });

  it('stores and retrieves spans by start_ms', () => {
    const span = document.createElement('span');
    span.dataset.startMs = '0';
    mapper.set(0, span);
    expect(mapper.get(0)).toBe(span);
    expect(mapper.size).toBe(1);
  });

  it('returns undefined for missing key', () => {
    expect(mapper.get(99)).toBeUndefined();
  });

  it('getRange returns spans sorted within time range', () => {
    const s0 = document.createElement('span'); s0.dataset.startMs = '0';
    const s4 = document.createElement('span'); s4.dataset.startMs = '400';
    const s8 = document.createElement('span'); s8.dataset.startMs = '800';
    mapper.set(0, s0);
    mapper.set(400, s4);
    mapper.set(800, s8);

    const range = mapper.getRange(0, 500);
    expect(range).toHaveLength(2);
  });

  it('deletes entries', () => {
    const span = document.createElement('span');
    mapper.set(0, span);
    expect(mapper.delete(0)).toBe(true);
    expect(mapper.delete(0)).toBe(false);
  });
});
