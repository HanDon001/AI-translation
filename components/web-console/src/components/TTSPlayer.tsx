import { useRef, useEffect, useCallback } from 'react';

/**
 * TTS 音频播放器组件
 * 接收流式 PCM 音频块，排队播放
 * 核心约束：播放中的音频绝不中断，即使收到字幕修正
 */
export function TTSPlayer() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextTimeRef = useRef(0);

  // 初始化 AudioContext
  useEffect(() => {
    audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // 播放队列中的下一个音频块
  const playNext = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || queueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const pcmBuffer = queueRef.current.shift()!;

    // PCM Int16 → Float32 转换
    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextTimeRef.current);
    source.start(startTime);
    nextTimeRef.current = startTime + audioBuffer.duration;

    source.onended = () => {
      playNext();
    };
  }, []);

  // 监听 TTS 音频事件
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === 'tts_audio') {
        const { audio_chunk } = msg.payload;
        if (audio_chunk) {
          // base64 → ArrayBuffer
          const binary = atob(audio_chunk);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          queueRef.current.push(bytes.buffer);

          if (!isPlayingRef.current) {
            playNext();
          }
        }
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [playNext]);

  return null; // 纯逻辑组件，无 UI
}
