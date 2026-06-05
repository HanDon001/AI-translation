import { useRef, useCallback, useEffect } from 'react';
import { AudioRecorder } from './components/AudioRecorder.js';
import { SubtitleDisplay } from './components/SubtitleDisplay.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useAudioWorklet } from './hooks/useAudioWorklet.js';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js';
import type { AudioSource } from './hooks/useAudioWorklet.js';
import { WINDOW_MS } from '@realtime-interp/shared';

export default function App() {
  const { isConnected, connect, disconnect, send } = useWebSocket('ws://localhost:3000/ws');
  const subtitleRef = useRef<{ handlePatch: (msg: unknown) => void }>(null);
  const windowIdRef = useRef(0);
  const { start: startAudio, stop: stopAudio } = useAudioWorklet();
  const { start: startSpeech, stop: stopSpeech } = useSpeechRecognition();

  // 监听 WS 消息，转发给字幕组件
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === 'subtitle_patch') {
        subtitleRef.current?.handlePatch(msg);
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, []);

  const handleStart = useCallback(async (source: AudioSource) => {
    windowIdRef.current = 0;
    connect();

    if (source === 'mic') {
      // 麦克风模式：用 Web Speech API 做实时语音识别
      startSpeech((text, isFinal) => {
        send({
          type: 'asr_text',
          payload: { text, is_final: isFinal },
        });
      }, 'en-US'); // 识别英语，可改为 'zh-CN' 等
    } else {
      // 标签页模式：发送音频切片到后端
      await startAudio((pcmData: Float32Array) => {
        const windowId = windowIdRef.current++;
        const buffer = pcmData.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        send({
          type: 'audio_chunk',
          payload: {
            window_id: windowId,
            start_ms: windowId * WINDOW_MS,
            duration: WINDOW_MS,
            pcm_data: base64,
          },
        });
      }, 'tab');
    }
  }, [connect, startAudio, startSpeech, send]);

  const handleStop = useCallback(() => {
    stopSpeech();
    stopAudio();
    disconnect();
  }, [stopSpeech, stopAudio, disconnect]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gray-950">
      {/* 控制栏 */}
      <div className="flex-1 flex items-center justify-center">
        <AudioRecorder
          isRecording={isConnected}
          onStart={handleStart}
          onStop={handleStop}
        />
      </div>

      {/* 字幕显示区 */}
      <SubtitleDisplay ref={subtitleRef} />
    </div>
  );
}
