import type { AudioChunkEvent } from '../types/index.js';

/**
 * 类型守卫：判断是否为音频块事件
 */
export function isAudioChunk(msg: unknown): msg is AudioChunkEvent {
  return typeof msg === 'object' && msg !== null && (msg as AudioChunkEvent).type === 'audio_chunk';
}
