import WebSocket from 'ws';

/**
 * 阿里云 DashScope Paraformer 实时 ASR 服务
 * 通过 WebSocket 流式发送音频，接收识别结果
 */

interface ASROptions {
  apiKey: string;
  model?: string;
  sampleRate?: number;
  onResult: (text: string, isFinal: boolean) => void;
}

/**
 * 创建一个实时 ASR 会话
 * 返回 sendAudio 和 close 方法
 */
export function createASRSession(options: ASROptions): {
  sendAudio: (pcmBase64: string) => void;
  close: () => void;
} {
  const { apiKey, model = 'paraformer-realtime-v2', sampleRate = 16000, onResult } = options;

  const ws = new WebSocket('wss://dashscope.aliyuncs.com/api-ws/v1/inference', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-DashScope-DataInspection': 'enable',
    },
  });

  let taskId = '';
  let isReady = false;
  const pendingChunks: string[] = [];

  ws.on('open', () => {
    taskId = `task-${Date.now()}`;
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
    try {
      const msg = JSON.parse(data.toString());

      if (msg.header?.event === 'task-started') {
        isReady = true;
        for (const chunk of pendingChunks) {
          sendChunk(chunk);
        }
        pendingChunks.length = 0;
      }

      if (msg.header?.event === 'result-generated') {
        const text = msg.payload?.output?.text ?? '';
        if (text) {
          onResult(text, false);
        }
      }

      if (msg.header?.event === 'task-finished') {
        onResult('', true);
      }
    } catch {
      // 二进制帧忽略
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
