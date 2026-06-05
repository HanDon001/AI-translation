import WebSocket from 'ws';

/**
 * 通义千问 Paraformer 实时 ASR 服务
 * 维护 WS 长连接，解析 Sentence 事件，检测回溯修正
 */

interface ASROptions {
  apiKey: string;
  model?: string;
  sampleRate?: number;
  onEvent: (event: InternalASREvent) => void;
}

export interface InternalASREvent {
  type: 'CHUNK' | 'CORRECT' | 'FINAL';
  window_id: number;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface QwenASRSentence {
  begin_time: number;
  end_time: number;
  text: string;
}

export function createQwenASRSession(options: ASROptions): {
  sendAudio: (pcmBase64: string) => void;
  close: () => void;
} {
  const { apiKey, model = 'paraformer-realtime-v2', sampleRate = 16000, onEvent } = options;

  const ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let taskId = '';
  let isReady = false;
  let windowId = 0;
  let lastSentenceEndTime = 0;
  const pendingChunks: string[] = [];

  ws.on('open', () => {
    console.log('[ASR] WebSocket connected to DashScope');
    taskId = `asr-${Date.now()}`;
    ws.send(JSON.stringify({
      header: {
        action: 'run-task',
        task_id: taskId,
        streaming: 'duplex',
      },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model,
        parameters: {
          sample_rate: sampleRate,
          format: 'pcm',
        },
      },
    }));
  });

  ws.on('message', (data) => {
    if (Buffer.isBuffer(data)) return;

    try {
      const msg = JSON.parse(data.toString());

      if (msg.header?.event === 'task-started') {
        console.log('[ASR] Task started');
        isReady = true;
        for (const chunk of pendingChunks) {
          sendChunk(chunk);
        }
        pendingChunks.length = 0;
      }

      if (msg.header?.event === 'result-generated') {
        const sentences: QwenASRSentence[] = msg.payload?.result?.sentences ?? [];
        for (const sentence of sentences) {
          const { begin_time, end_time, text } = sentence;
          if (!text) continue;

          // 修正检测：begin_time < lastSentenceEndTime 说明发生了回溯修正
          if (begin_time < lastSentenceEndTime) {
            console.log(`[ASR] Correction detected: "${text}" (${begin_time}ms < ${lastSentenceEndTime}ms)`);
            onEvent({
              type: 'CORRECT',
              window_id: windowId++,
              text,
              start_ms: begin_time,
              end_ms: end_time,
            });
          } else {
            // 正常顺延
            const isFinal = end_time > lastSentenceEndTime && msg.header?.event === 'task-finished';
            onEvent({
              type: isFinal ? 'FINAL' : 'CHUNK',
              window_id: windowId++,
              text,
              start_ms: begin_time,
              end_ms: end_time,
            });
          }

          lastSentenceEndTime = Math.max(lastSentenceEndTime, end_time);
        }
      }

      if (msg.header?.event === 'task-finished') {
        console.log('[ASR] Task finished');
        onEvent({
          type: 'FINAL',
          window_id: windowId++,
          text: '',
          start_ms: lastSentenceEndTime,
          end_ms: lastSentenceEndTime,
        });
      }
    } catch {
      // 忽略
    }
  });

  ws.on('error', (err) => {
    console.error('[ASR] WebSocket error:', err.message);
  });

  function sendChunk(base64: string) {
    if (!isReady) {
      pendingChunks.push(base64);
      return;
    }
    const buffer = Buffer.from(base64, 'base64');
    ws.send(buffer);
  }

  function close() {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        header: {
          action: 'stop-task',
          task_id: taskId,
        },
      }));
      ws.close();
    }
  }

  return { sendAudio: sendChunk, close };
}
