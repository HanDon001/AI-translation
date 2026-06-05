import WebSocket from 'ws';

/**
 * 通义千问 Qwen-LiveTranslate 实时翻译服务
 * 直接将音频翻译为目标语言，无需分 ASR + 翻译两步
 */

interface ASROptions {
  apiKey: string;
  model?: string;
  targetLang?: string;
  voice?: string;
  onEvent: (event: InternalASREvent) => void;
}

export interface InternalASREvent {
  type: 'CHUNK' | 'CORRECT' | 'FINAL';
  window_id: number;
  text: string;
  start_ms: number;
  end_ms: number;
}

export function createQwenASRSession(options: ASROptions): {
  sendAudio: (pcmBase64: string) => void;
  close: () => void;
} {
  const {
    apiKey,
    model = 'qwen3.5-livetranslate-flash-realtime',
    targetLang = 'zh',
    voice = 'Cherry',
    onEvent,
  } = options;

  const ws = new WebSocket(
    `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  let isReady = false;
  let windowId = 0;
  const pendingChunks: string[] = [];

  ws.on('open', () => {
    console.log('[LiveTranslate] WebSocket connected');
  });

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) {
      // 音频二进制帧（TTS 输出），暂不处理
      return;
    }

    try {
      const msg = JSON.parse(data.toString());
      const type = msg.type ?? 'unknown';

      if (type === 'session.created') {
        console.log('[LiveTranslate] Session created, configuring...');
        // 配置会话：输出文本 + 音频，目标语言中文
        ws.send(JSON.stringify({
          type: 'session.update',
          output_modalities: ['text', 'audio'],
          voice,
          input_audio_transcription_model: 'qwen3-asr-flash-realtime',
          translation_params: {
            language: targetLang,
          },
        }));
      }

      if (type === 'session.updated') {
        console.log('[LiveTranslate] Session configured, ready');
        isReady = true;
        // 发送缓存的音频
        for (const chunk of pendingChunks) {
          sendChunk(chunk);
        }
        pendingChunks.length = 0;
      }

      // 翻译文本输出
      if (type === 'response.text.delta') {
        const text = msg.delta ?? '';
        if (text) {
          onEvent({
            type: 'CHUNK',
            window_id: windowId++,
            text,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      if (type === 'response.text.done') {
        const text = msg.transcript ?? '';
        if (text) {
          onEvent({
            type: 'FINAL',
            window_id: windowId++,
            text,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      // 原文识别输出（如果启用了 input_audio_transcription_model）
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = msg.transcript ?? '';
        console.log('[LiveTranslate] ASR原文:', transcript);
      }

      if (type === 'session.finished') {
        console.log('[LiveTranslate] Session finished');
        onEvent({
          type: 'FINAL',
          window_id: windowId++,
          text: '',
          start_ms: windowId * 400,
          end_ms: (windowId + 1) * 400,
        });
      }

      // 错误处理
      if (type === 'error') {
        console.error('[LiveTranslate] Error:', JSON.stringify(msg));
      }
    } catch {
      // 忽略解析错误
    }
  });

  ws.on('error', (err) => {
    console.error('[LiveTranslate] WebSocket error:', err.message);
  });

  function sendChunk(base64: string) {
    if (!isReady) {
      pendingChunks.push(base64);
      return;
    }
    // 发送音频数据
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64,
    }));
  }

  function close() {
    if (ws.readyState === WebSocket.OPEN) {
      // 结束会话
      ws.send(JSON.stringify({
        type: 'session.finish',
      }));
      setTimeout(() => ws.close(), 2000);
    }
  }

  return { sendAudio: sendChunk, close };
}
