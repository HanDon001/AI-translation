import type { FastifyInstance } from 'fastify';
import { synthesizeSpeech } from '../services/ttsService.js';

/**
 * TTS 语音合成路由
 * POST /api/tts { text, apiKey }
 * 返回 base64 编码的音频数据
 */
export function registerTtsRoute(app: FastifyInstance): void {
  app.post('/api/tts', async (request, reply) => {
    const { text, apiKey } = request.body as { text?: string; apiKey?: string };

    if (!text || !apiKey) {
      return reply.status(400).send({ error: 'Missing text or apiKey' });
    }

    try {
      const audioBase64 = await synthesizeSpeech({ text, apiKey });
      return reply.send({ audio: audioBase64 });
    } catch (err) {
      app.log.error(err, 'TTS synthesis failed');
      return reply.status(500).send({ error: 'TTS synthesis failed' });
    }
  });
}
