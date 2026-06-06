/**
 * 音频块事件
 */
export interface AudioChunkEvent {
  type: 'audio_chunk';
  payload: {
    window_id: number;
    start_ms: number;
    duration: number;
    pcm_data: string;
  };
}

/**
 * 字幕补丁
 */
export interface SubtitlePatchPayload {
  action: 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';
  target_range: [number, number];
  new_text: string;
  style: 'temp' | 'final';
}
