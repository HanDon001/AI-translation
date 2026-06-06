import { useRef, useCallback } from 'react';

const SAMPLE_RATE = 16000;

export type AudioSource = 'mic' | 'tab';

/**
 * AudioWorklet 切片逻辑 Hook
 * 支持麦克风和标签页两种音频源
 */
export function useAudioWorklet() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (
    onChunk: (data: Float32Array) => void,
    source: AudioSource = 'mic',
    existingStream?: MediaStream
  ) => {
    try {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;

      // 加载 Worklet 模块
      await ctx.audioWorklet.addModule(
        new URL('../workers/audio-processor.worklet.ts', import.meta.url)
      );

      // 使用外部传入的流，或者自己获取
      let stream: MediaStream;
      if (existingStream) {
        stream = existingStream;
      } else if (source === 'tab') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: true,
        });
        // 丢弃视频轨道，只保留音频
        stream.getVideoTracks().forEach((track) => track.stop());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;

      const mediaSource = ctx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(ctx, 'audio-processor');
      workletNodeRef.current = workletNode;

      // 监听 Worklet 发出的切片数据
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio_chunk') {
          onChunk(event.data.data);
        }
      };

      mediaSource.connect(workletNode);
    } catch (err) {
      console.error('[AudioWorklet] Failed to start:', err);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    workletNodeRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  return { start, stop };
}
