import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { BufferNode } from '@realtime-interp/shared';
import { WINDOW_MS, isAudioChunk } from '@realtime-interp/shared';
import { RingBuffer } from '../core/RingBuffer.js';
import { WaitKScheduler } from '../core/WaitKScheduler.js';

/**
 * WebSocket 消息路由处理
 * 接收前端语音识别文本，通过 Wait-K 调度翻译，广播字幕 Patch
 */
export function registerWsHandler(app: FastifyInstance): void {
  const buffer = new RingBuffer();
  const scheduler = new WaitKScheduler(buffer);
  const clients = new Set<WebSocket>();
  let windowId = 0;

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    app.log.info(`Client connected. Total: ${clients.size}`);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // 处理语音识别文本
        if (msg.type === 'asr_text') {
          const { text, is_final } = msg.payload;
          const id = windowId++;
          const startMs = id * WINDOW_MS;

          app.log.info({ window_id: id, text, is_final }, 'ASR text received');

          const asrNode: BufferNode = {
            window_id: id,
            source_text: text,
            translated_text: '',
            is_final: is_final ?? false,
            start_ms: startMs,
            end_ms: startMs + WINDOW_MS,
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

        // 处理音频切片（标签页模式，暂仅记录）
        if (isAudioChunk(msg)) {
          const { window_id, pcm_data } = msg.payload;
          const bytes = pcm_data ? Buffer.from(pcm_data, 'base64').length : 0;
          app.log.info({ window_id, pcm_bytes: bytes }, 'Audio chunk received (no ASR connected)');
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
