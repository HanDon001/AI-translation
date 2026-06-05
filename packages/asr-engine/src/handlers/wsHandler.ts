import type { FastifyInstance } from 'fastify';
import { MockAsrProvider } from '../providers/MockAsrProvider.js';

/**
 * ASR Engine WebSocket 服务端
 * 接收 gateway 发来的 PCM 数据，返回 ASR 识别结果
 */
export function registerAsrWsHandler(app: FastifyInstance): void {
  const provider = new MockAsrProvider();

  app.get('/ws', { websocket: true }, (socket) => {
    app.log.info('Gateway connected to ASR Engine');

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const audioChunk = { window_id: msg.window_id, data: new Float32Array() };

        for await (const result of provider.recognize(audioChunk)) {
          socket.send(JSON.stringify(result));
        }
      } catch (err) {
        app.log.error(err, 'ASR processing error');
      }
    });
  });
}
