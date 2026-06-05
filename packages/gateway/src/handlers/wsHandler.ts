import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { BufferNode } from '@realtime-interp/shared';
import { WINDOW_MS, isAudioChunk } from '@realtime-interp/shared';
import { RingBuffer } from '../core/RingBuffer.js';
import { WaitKScheduler } from '../core/WaitKScheduler.js';

/**
 * Mock ASR 剧本 — "我要去北京"（先识别错再修正）
 */
const ASR_SCRIPT: Record<number, { text: string; is_final?: boolean }> = {
  0: { text: '饿' },
  1: { text: '要' },
  2: { text: '去北' },
  3: { text: '京', is_final: true },
};

/**
 * WebSocket 消息路由处理
 * 职责：接收 Browser 音频切片和 ASR 事件，协调调度器，广播字幕 Patch
 */
export function registerWsHandler(app: FastifyInstance): void {
  const buffer = new RingBuffer();
  const scheduler = new WaitKScheduler(buffer);
  const clients = new Set<WebSocket>();

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    app.log.info(`Client connected. Total: ${clients.size}`);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (isAudioChunk(msg)) {
          const { window_id, start_ms, pcm_data } = msg.payload;
          const pcmBytes = pcm_data ? Buffer.from(pcm_data, 'base64').length : 0;
          app.log.info({ window_id, pcm_bytes: pcmBytes, start_ms }, `Audio chunk received`);

          // Mock ASR: 按剧本返回识别结果
          const script = ASR_SCRIPT[window_id] ?? { text: `[ASR:${window_id}]` };
          const asrNode: BufferNode = {
            window_id,
            source_text: script.text,
            translated_text: '',
            is_final: script.is_final ?? false,
            start_ms,
            end_ms: start_ms + WINDOW_MS,
          };

          buffer.push(asrNode);
          const patch = scheduler.handleASRChunk(asrNode);

          if (patch) {
            broadcast(clients, {
              type: 'subtitle_patch',
              payload: patch,
              timestamp: Date.now(),
            });
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to process WS message');
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
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
