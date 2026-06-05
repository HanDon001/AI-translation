import { useRef, useCallback } from 'react';
import { AudioRecorder } from './components/AudioRecorder.js';
import { SubtitleDisplay } from './components/SubtitleDisplay.js';
import { useWebSocket } from './hooks/useWebSocket.js';

export default function App() {
  const { isConnected, connect, disconnect } = useWebSocket('ws://localhost:3000/ws');
  const subtitleRef = useRef<{ handlePatch: (msg: unknown) => void }>(null);

  const handleStart = useCallback(() => {
    connect();
  }, [connect]);

  const handleStop = useCallback(() => {
    disconnect();
  }, [disconnect]);

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
