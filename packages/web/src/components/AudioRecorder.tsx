import { useState } from 'react';
import type { AudioSource } from '../hooks/useAudioWorklet.js';

interface AudioRecorderProps {
  isRecording: boolean;
  onStart: (source: AudioSource) => void;
  onStop: () => void;
}

export function AudioRecorder({ isRecording, onStart, onStop }: AudioRecorderProps) {
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<AudioSource>('tab');

  const handleClick = async () => {
    setError(null);
    if (isRecording) {
      onStop();
      return;
    }

    try {
      if (source === 'mic') {
        // 麦克风模式：验证权限
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      // 标签页模式：getDisplayMedia 在 useAudioWorklet 中调用
      onStart(source);
    } catch (err) {
      setError(source === 'mic' ? '麦克风授权失败' : '标签页采集授权失败');
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 音频源切换 */}
      <div className="flex gap-2 bg-gray-800 rounded-full p-1">
        <button
          onClick={() => setSource('tab')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            source === 'tab'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          标签页音频
        </button>
        <button
          onClick={() => setSource('mic')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            source === 'mic'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          麦克风
        </button>
      </div>

      {/* 开始/停止按钮 */}
      <button
        onClick={handleClick}
        className={`
          relative px-8 py-4 rounded-full text-xl font-bold transition-all duration-300
          ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
          }
        `}
      >
        {isRecording && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-400 rounded-full animate-pulse-dot" />
        )}
        {isRecording ? '停止同传' : '开始同传'}
      </button>

      {source === 'tab' && !isRecording && (
        <p className="text-gray-500 text-xs">点击后选择要采集音频的标签页</p>
      )}
      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 px-4 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
