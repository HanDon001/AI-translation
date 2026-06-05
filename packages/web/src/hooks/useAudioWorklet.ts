import { useRef, useCallback } from 'react';
import { SAMPLE_RATE } from '@realtime-interp/shared';

/**
 * AudioWorklet 切片逻辑 Hook
 * 管理 AudioContext 生命周期和 WorkletNode 通信
 */
export function useAudioWorklet() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const start = useCallback(async (onChunk: (data: Float32Array) => void) => {
    try {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;

      // 加载 Worklet 模块
      await ctx.audioWorklet.addModule(
        new URL('../workers/audio-processor.worklet.ts', import.meta.url)
      );

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, 'audio-processor');
      workletNodeRef.current = workletNode;

      // 监听 Worklet 发出的切片数据
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio_chunk') {
          onChunk(event.data.data);
        }
      };

      source.connect(workletNode);
      // V1: 静音不播放，防止啸叫
      // workletNode.connect(ctx.destination);
    } catch (err) {
      console.error('[AudioWorklet] Failed to start:', err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    audioContextRef.current?.close();
    workletNodeRef.current = null;
    audioContextRef.current = null;
  }, []);

  return { start, stop };
}
