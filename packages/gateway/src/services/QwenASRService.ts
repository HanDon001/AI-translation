import WebSocket from 'ws';

/**
 * 通义千问 Qwen-LiveTranslate 实时翻译服务
 * 基于官方 DashScope API 文档实现
 * 模型: qwen3.5-livetranslate-flash-realtime
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
    onEvent,
  } = options;

  console.log('[LiveTranslate] Creating session with model:', model, 'target:', targetLang);

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
    console.log('[LiveTranslate] ✅ WebSocket connected to DashScope');
    console.log('[LiveTranslate] Model:', model, 'Target:', targetLang);
    console.log('[LiveTranslate] URL:', `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`);
    console.log('[LiveTranslate] Waiting for session.created event...');
  });

  ws.on('message', (data, isBinary) => {
    // 打印所有收到的消息
    if (isBinary) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      console.log('[LiveTranslate] Received binary frame, length:', buf.length);
      return;
    }

    try {
      const text = data.toString();
      console.log('[LiveTranslate] Received text:', text.substring(0, 500));
      const msg = JSON.parse(text);
      const type = msg.type ?? 'unknown';

      console.log('[LiveTranslate] Parsed event type:', type);

      // 会话创建成功
      if (type === 'session.created') {
        console.log('[LiveTranslate] Session created, configuring...');

        // 配置会话参数（根据官方文档）
        // 只输出文本时不需要 voice 参数
        const config = {
          type: 'session.update',
          session: {
            modalities: ['text'],  // 只输出文本
            input_audio_transcription: {
              model: 'qwen3-asr-flash-realtime',
            },
            translation: {
              language: targetLang,
            },
          },
        };
        console.log('[LiveTranslate] Sending config:', JSON.stringify(config));
        ws.send(JSON.stringify(config));
      }

      // 会话配置更新完成
      if (type === 'session.updated') {
        console.log('[LiveTranslate] Session configured, ready');
        isReady = true;
        // 发送缓存的音频
        for (const chunk of pendingChunks) {
          sendChunk(chunk);
        }
        pendingChunks.length = 0;
      }

      // 检测到语音输入开始
      if (type === 'input_audio_buffer.speech_started') {
        console.log('[LiveTranslate] Speech started');
      }

      // 语音输入结束
      if (type === 'input_audio_buffer.speech_stopped') {
        console.log('[LiveTranslate] Speech stopped');
      }

      // 原文识别结果（流式）
      if (type === 'conversation.item.input_audio_transcription.text') {
        const text = msg.text ?? '';
        if (text) {
          console.log('[LiveTranslate] ASR增量:', text);
        }
      }

      // 原文识别结果（完成）
      if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = msg.transcript ?? '';
        console.log('[LiveTranslate] ASR原文:', transcript);
        if (transcript) {
          onEvent({
            type: 'CHUNK',
            window_id: windowId++,
            text: transcript,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      // 翻译结果（流式文本）- 使用 response.text.text 事件
      if (type === 'response.text.text') {
        const text = msg.text ?? '';
        const stash = msg.stash ?? '';
        // text 是已确认的文本，stash 是正在处理的文本
        const displayText = text + stash;
        if (displayText) {
          console.log('[LiveTranslate] 翻译增量:', displayText);
          onEvent({
            type: 'CHUNK',
            window_id: windowId++,
            text: displayText,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      // 翻译结果（完成）- response.content_part.done 或 response.done
      if (type === 'response.content_part.done') {
        const text = msg.part?.text ?? '';
        console.log('[LiveTranslate] 翻译完成:', text);
        if (text) {
          onEvent({
            type: 'FINAL',
            window_id: windowId++,
            text: text,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      // 也处理 response.audio_transcript.text 和 response.audio_transcript.done（兼容）
      if (type === 'response.audio_transcript.text') {
        const text = msg.text ?? '';
        if (text) {
          console.log('[LiveTranslate] 翻译增量(audio):', text);
          onEvent({
            type: 'CHUNK',
            window_id: windowId++,
            text: text,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      if (type === 'response.audio_transcript.done') {
        const transcript = msg.transcript ?? '';
        console.log('[LiveTranslate] 翻译完成(audio):', transcript);
        if (transcript) {
          onEvent({
            type: 'FINAL',
            window_id: windowId++,
            text: transcript,
            start_ms: windowId * 400,
            end_ms: (windowId + 1) * 400,
          });
        }
      }

      // 响应完成
      if (type === 'response.done') {
        console.log('[LiveTranslate] Response done');
      }

      // 会话结束
      if (type === 'session.finished') {
        console.log('[LiveTranslate] Session finished');
      }

      // 错误处理
      if (type === 'error') {
        console.error('[LiveTranslate] Error:', JSON.stringify(msg));
        const errorMsg = msg.error?.message || '未知错误';
        onEvent({
          type: 'FINAL',
          window_id: windowId++,
          text: `[翻译错误: ${errorMsg}]`,
          start_ms: windowId * 400,
          end_ms: (windowId + 1) * 400,
        });
      }
    } catch (err) {
      console.error('[LiveTranslate] Parse error:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('[LiveTranslate] WebSocket error:', err.message);
    onEvent({
      type: 'FINAL',
      window_id: windowId++,
      text: `[连接错误: ${err.message}]`,
      start_ms: windowId * 400,
      end_ms: (windowId + 1) * 400,
    });
  });

  ws.on('upgrade', (response) => {
    console.log('[LiveTranslate] WebSocket upgrade response status:', response.statusCode);
  });

  ws.on('close', (code, reason) => {
    console.log('[LiveTranslate] WebSocket closed:', code, reason.toString());
  });

  function sendChunk(base64: string) {
    if (!isReady) {
      console.log('[LiveTranslate] Audio chunk queued (not ready yet), pending:', pendingChunks.length);
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
      // 发送 session.finish 通知服务端音频发送完毕
      console.log('[LiveTranslate] Sending session.finish');
      ws.send(JSON.stringify({
        type: 'session.finish',
      }));
      // 等待服务端返回 session.finished 后关闭连接
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 5000);
    }
  }

  return { sendAudio: sendChunk, close };
}
