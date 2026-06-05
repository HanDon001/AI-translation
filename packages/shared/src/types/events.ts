// ─── WebSocket 通信事件协议 ───

/**
 * 音频切片事件（Browser -> Gateway）
 * 每 400ms 由 AudioWorklet 产生一块 PCM 数据
 */
export interface AudioChunkEvent {
  type: 'audio_chunk';
  payload: {
    window_id: number;
    start_ms: number;
    duration: number;
    /** Float32Array, Base64 编码传输 */
    pcm_data: string;
  };
}

/**
 * ASR 识别结果事件（ASR Engine -> Gateway）
 * 流式推送语音识别碎片
 */
export interface ASRChunkEvent {
  type: 'asr_chunk';
  payload: {
    window_id: number;
    text: string;
    start_ms: number;
    end_ms: number;
    is_final?: boolean;
  };
}

/**
 * ASR 修正事件（ASR Engine -> Gateway）
 * 修正之前某个窗口的识别文本
 */
export interface ASRCorrectEvent {
  type: 'asr_correct';
  payload: {
    window_id: number;
    text: string;
    start_ms: number;
    end_ms: number;
  };
}

/**
 * VAD 静音检测事件（ASR Engine -> Gateway）
 * 检测到静音超过阈值，触发断句
 */
export interface VADSilenceEvent {
  type: 'vad_silence';
  payload: {
    start_ms: number;
    duration_ms: number;
  };
}

/** 前端 -> 后端 所有可能的事件 */
export type ClientEvent = AudioChunkEvent;

/** ASR Engine -> Gateway 所有可能的事件 */
export type ASREvent = ASRChunkEvent | ASRCorrectEvent | VADSilenceEvent;
