import { describe, it, expect } from 'vitest';
import { isAudioChunk, isASRChunk, isASRCorrect, isVADSilence } from '../../src/guards/eventGuards.js';

describe('eventGuards', () => {
  it('isAudioChunk detects audio_chunk events', () => {
    expect(isAudioChunk({ type: 'audio_chunk', payload: {} })).toBe(true);
    expect(isAudioChunk({ type: 'asr_chunk' })).toBe(false);
    expect(isAudioChunk(null)).toBe(false);
    expect(isAudioChunk('string')).toBe(false);
  });

  it('isASRChunk detects asr_chunk events', () => {
    expect(isASRChunk({ type: 'asr_chunk', payload: {} })).toBe(true);
    expect(isASRChunk({ type: 'audio_chunk' })).toBe(false);
  });

  it('isASRCorrect detects asr_correct events', () => {
    expect(isASRCorrect({ type: 'asr_correct', payload: {} })).toBe(true);
    expect(isASRCorrect({ type: 'asr_chunk' })).toBe(false);
  });

  it('isVADSilence detects vad_silence events', () => {
    expect(isVADSilence({ type: 'vad_silence', payload: {} })).toBe(true);
    expect(isVADSilence({ type: 'audio_chunk' })).toBe(false);
  });
});
