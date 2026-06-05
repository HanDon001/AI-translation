import { useRef, useCallback } from 'react';
import { AudioRecorder } from './components/AudioRecorder.js';
import { SubtitleDisplay } from './components/SubtitleDisplay.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useAudioWorklet } from './hooks/useAudioWorklet.js';
import { WINDOW_MS } from '@realtime-interp/shared';

export default function App() {
  const { isConnected, connect, disconnect, send } = useWebSocket('ws://localhost:3000/ws');
  const subtitleRef = useRef<{ handlePatch: (msg: unknown) => void }>(null);
  const windowIdRef = useRef(0);
  const { start: startAudio, stop: stopAudio } = useAudioWorklet();

  const handleStart = useCallback(async () => {
    connect();
    // 启动音频采集，每 400ms 收到一个切片后发送给后端
    await startAudio((pcmData: Float32Array) => {
      const windowId = windowIdRef.current++;
      // 将 Float32Array 转为 Base64 编码传输
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
    });
  }, [connect, startAudio, send]);

  const handleStop = useCallback(() => {
    stopAudio();
    disconnect();
  }, [stopAudio, disconnect]);

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
