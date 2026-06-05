import type { AudioChunkEvent, ASRChunkEvent, ASRCorrectEvent, VADSilenceEvent } from '../types/events.js';

export function isAudioChunk(msg: unknown): msg is AudioChunkEvent {
  return typeof msg === 'object' && msg !== null && (msg as AudioChunkEvent).type === 'audio_chunk';
}

export function isASRChunk(msg: unknown): msg is ASRChunkEvent {
  return typeof msg === 'object' && msg !== null && (msg as ASRChunkEvent).type === 'asr_chunk';
}

export function isASRCorrect(msg: unknown): msg is ASRCorrectEvent {
  return typeof msg === 'object' && msg !== null && (msg as ASRCorrectEvent).type === 'asr_correct';
}

export function isVADSilence(msg: unknown): msg is VADSilenceEvent {
  return typeof msg === 'object' && msg !== null && (msg as VADSilenceEvent).type === 'vad_silence';
}
