import WebSocket from 'ws';

/**
 * 阿里云 Qwen-TTS Realtime API 语音合成服务
 * 通过 WebSocket 流式合成语音
 */

interface TTSOptions {
  text: string;
  apiKey: string;
  model?: string;
  voice?: string;
}

/**
 * 通过 Qwen-TTS Realtime API 合成语音
 * 返回 base64 编码的 PCM 音频数据
 */
export function synthesizeSpeech(options: TTSOptions): Promise<string> {
  const { text, apiKey, model = 'qwen3-tts-flash-realtime', voice = 'Cherry' } = options;

  return new Promise((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let sessionId = '';

    const ws = new WebSocket(
      `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    ws.on('open', () => {
      console.log('[TTS] WebSocket connected');
    });

    ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        // 二进制帧 = 音频数据
        audioChunks.push(data);
        return;
      }

      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'session.created') {
          sessionId = msg.session?.id ?? '';
          console.log('[TTS] Session created:', sessionId);

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
          console.log('[TTS] Audio done, chunks:', audioChunks.length);
        }

        if (msg.type === 'session.finished') {
          const audioBase64 = Buffer.concat(audioChunks).toString('base64');
          ws.close();
          resolve(audioBase64);
        }
      } catch {
        // 忽略解析错误
      }
    });

    ws.on('error', (err) => {
      console.error('[TTS] WebSocket error:', err.message);
      reject(err);
    });

    ws.on('close', () => {
      if (audioChunks.length === 0) {
        reject(new Error('TTS WebSocket closed without audio'));
      }
    });

    // 超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error('TTS timeout'));
      }
    }, 15000);
  });
}
