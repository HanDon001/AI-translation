import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { BufferNode } from '@realtime-interp/shared';
import { WINDOW_MS, isAudioChunk } from '@realtime-interp/shared';
import { RingBuffer } from '../core/RingBuffer.js';
import { WaitKScheduler } from '../core/WaitKScheduler.js';
import { createASRSession } from '../services/asrService.js';

// Mock ASR 剧本（降级用）
const MOCK_SCRIPT = ['Hello', 'everyone', 'welcome to', 'the meeting'];

/**
 * WebSocket 消息路由处理
 * 接收前端音频切片或语音识别文本，通过 ASR + Wait-K 调度翻译，广播字幕 Patch
 */
export function registerWsHandler(app: FastifyInstance): void {
  const buffer = new RingBuffer();
  const scheduler = new WaitKScheduler(buffer);
  const clients = new Set<WebSocket>();
  let windowId = 0;
  let apiKey = '';
  let asrSession: ReturnType<typeof createASRSession> | null = null;

  /** 处理 ASR 识别结果 */
  async function handleASRText(text: string, isFinal: boolean): Promise<void> {
    const id = windowId++;
    const startMs = id * WINDOW_MS;

    app.log.info({ window_id: id, text, is_final: isFinal }, 'ASR text received');

    const asrNode: BufferNode = {
      window_id: id,
      source_text: text,
      translated_text: '',
      is_final: isFinal,
      start_ms: startMs,
      end_ms: startMs + WINDOW_MS,
    };

    buffer.push(asrNode);
    const patch = await scheduler.handleASRChunk(asrNode);

    if (patch) {
      broadcast(clients, {
        type: 'subtitle_patch',
        payload: patch,
        timestamp: Date.now(),
      });
    }
  }

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    app.log.info(`Client connected. Total: ${clients.size}`);

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // 处理 API Key 设置
        if (msg.type === 'set_api_key') {
          apiKey = msg.payload.apiKey;
          scheduler.setApiKey(apiKey);
          app.log.info('API Key updated');
          return;
        }

        // 处理语音识别文本（麦克风模式 - Web Speech API）
        if (msg.type === 'asr_text') {
          await handleASRText(msg.payload.text, msg.payload.is_final ?? false);
        }

        // 处理音频切片（标签页模式 - 送入 DashScope ASR）
        if (isAudioChunk(msg)) {
          const { window_id, pcm_data } = msg.payload;
          const bytes = pcm_data ? Buffer.from(pcm_data, 'base64').length : 0;
          app.log.info({ window_id, pcm_bytes: bytes }, 'Audio chunk received');

          // 无 API Key 时用 Mock ASR 降级
          if (!apiKey) {
            const mockText = MOCK_SCRIPT[window_id % MOCK_SCRIPT.length];
            await handleASRText(mockText, window_id % MOCK_SCRIPT.length === MOCK_SCRIPT.length - 1);
            return;
          }

          // 首次收到音频时创建 ASR 会话
          if (!asrSession) {
            try {
              asrSession = createASRSession({
                apiKey,
                onResult: (text, isFinal) => {
                  handleASRText(text, isFinal).catch((err) => {
                    app.log.error(err, 'Failed to handle ASR result');
                  });
                },
              });
              app.log.info('ASR session created');
            } catch (err) {
              app.log.error(err, 'Failed to create ASR session, using mock');
              const mockText = MOCK_SCRIPT[window_id % MOCK_SCRIPT.length];
              await handleASRText(mockText, window_id % MOCK_SCRIPT.length === MOCK_SCRIPT.length - 1);
              return;
            }
          }

          // 发送音频到 ASR
          if (pcm_data) {
            asrSession.sendAudio(pcm_data);
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to process WS message');
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      if (asrSession) {
        asrSession.close();
        asrSession = null;
      }
      app.log.info(`Client disconnected. Total: ${clients.size}`);
    });
  });
}

function broadcast(clients: Set<WebSocket>, message: unknown): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
