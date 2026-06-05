import { useState } from 'react';

interface AudioRecorderProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function AudioRecorder({ isRecording, onStart, onStop }: AudioRecorderProps) {
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    if (isRecording) {
      onStop();
      return;
    }

    try {
      // 请求麦克风权限验证
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // 仅验证权限，实际流由 useAudioWorklet 管理
      onStart();
    } catch (err) {
      setError('麦克风授权失败，请允许浏览器访问麦克风');
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
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
        {/* 录音中红点呼吸动画 */}
        {isRecording && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-400 rounded-full animate-pulse-dot" />
        )}
        {isRecording ? '停止同传' : '开始同传'}
      </button>
      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 px-4 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
