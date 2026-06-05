import WebSocket from 'ws';

/**
 * 通义千问 TTS Realtime 语音合成服务
 * 流式接收音频块，转发给前端播放
 */

interface TTSOptions {
  text: string;
  apiKey: string;
  model?: string;
  voice?: string;
  onAudioChunk: (chunk: Buffer) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/**
 * 创建 TTS 流式合成会话
 * 音频块通过 onAudioChunk 实时回调
 */
export function createQwenTTSSession(options: TTSOptions): {
  close: () => void;
} {
  const {
    text,
    apiKey,
    model = 'qwen3-tts-flash-realtime',
    voice = 'Cherry',
    onAudioChunk,
    onDone,
    onError,
  } = options;

  const ws = new WebSocket(
    `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  let sessionReady = false;

  ws.on('open', () => {
    console.log('[TTS] WebSocket connected');
  });

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      // 二进制帧 = 音频数据，实时转发
      onAudioChunk(data);
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'session.created') {
        sessionReady = true;
        console.log('[TTS] Session created');

        // 配置会话
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice,
            response_format: 'pcm',
            sample_rate: 24000,
            mode: 'server_commit',
          },
        }));

        // 发送文本
        ws.send(JSON.stringify({
          type: 'input_text_buffer.append',
          text,
        }));

        // 提交合成
        ws.send(JSON.stringify({
          type: 'input_text_buffer.commit',
        }));
      }

      if (msg.type === 'response.audio.done') {
        console.log('[TTS] Audio done');
      }

      if (msg.type === 'session.finished') {
        console.log('[TTS] Session finished');
        ws.close();
        onDone();
      }
    } catch {
      // 忽略
    }
  });

  ws.on('error', (err) => {
    console.error('[TTS] WebSocket error:', err.message);
    onError(err);
  });

  ws.on('close', () => {
    if (!sessionReady) {
      onError(new Error('TTS WebSocket closed before session created'));
    }
  });

  // 超时保护
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      onError(new Error('TTS timeout'));
    }
  }, 30000);

  return {
    close: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    },
  };
}
