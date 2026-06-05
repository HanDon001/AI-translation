import type { FastifyInstance } from 'fastify';
import { MockTranslatorProvider } from '../providers/MockTranslatorProvider.js';

/**
 * Translator Engine WebSocket 服务端
 * 接收 gateway 发来的源文本，返回翻译结果
 */
export function registerTranslatorWsHandler(app: FastifyInstance): void {
  const provider = new MockTranslatorProvider();

  app.get('/ws', { websocket: true }, (socket) => {
    app.log.info('Gateway connected to Translator');

    socket.on('message', async (raw) => {
      try {
        const { source_text: sourceText, context } = JSON.parse(raw.toString());

        for await (const result of provider.translate(sourceText, context)) {
          socket.send(JSON.stringify({ translation: result }));
        }
      } catch (err) {
        app.log.error(err, 'Translation processing error');
      }
    });
  });
}
