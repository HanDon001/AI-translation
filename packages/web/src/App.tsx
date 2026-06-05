import { useRef, useCallback, useEffect, useState } from 'react';
import { AudioRecorder } from './components/AudioRecorder.js';
import { SubtitleDisplay } from './components/SubtitleDisplay.js';
import { Settings } from './components/Settings.js';
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
  const [apiKey, setApiKey] = useState('');

  // API Key 变化时同步到后端
  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key);
    if (key) {
      send({ type: 'set_api_key', payload: { apiKey: key } });
    }
  }, [send]);

  // 调用 TTS 播放译文
  const playTTS = useCallback(async (text: string) => {
    if (!apiKey) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey }),
      });
      if (!res.ok) return;
      const { audio } = await res.json();
      if (audio) {
        const audioEl = new Audio(`data:audio/mp3;base64,${audio}`);
        audioEl.play().catch(() => {});
      }
    } catch (err) {
      console.error('[TTS] Failed:', err);
    }
  }, [apiKey]);

  // 监听 WS 消息，转发给字幕组件，最终态自动播放 TTS
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === 'subtitle_patch') {
        subtitleRef.current?.handlePatch(msg);
        if (msg.payload?.action === 'MARK_FINAL' && msg.payload?.new_text) {
          playTTS(msg.payload.new_text);
        }
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [playTTS]);

  const handleStart = useCallback(async (source: AudioSource) => {
    windowIdRef.current = 0;
    connect();

    if (source === 'mic') {
      startSpeech((text, isFinal) => {
        send({
          type: 'asr_text',
          payload: { text, is_final: isFinal },
        });
      }, 'en-US');
    } else {
      await startAudio((pcmData: Float32Array) => {
        const windowId = windowIdRef.current++;

        // Float32 → Int16 PCM 转换
        const int16 = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(int16.buffer);
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
      <Settings onApiKeyChange={handleApiKeyChange} />

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
