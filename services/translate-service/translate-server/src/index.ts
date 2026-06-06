import Fastify from 'fastify';
import { MyMemoryTranslator } from './infrastructure/external/MyMemoryTranslator.js';

const app = Fastify({ logger: true });
const translator = new MyMemoryTranslator();

app.post('/translate', async (request, reply) => {
  const { text, sourceLang, targetLang } = request.body as {
    text: string;
    sourceLang: string;
    targetLang: string;
  };

  try {
    const result = await translator.translate(text, sourceLang, targetLang);
    return { code: 0, data: result, message: 'success' };
  } catch (err) {
    return { code: 30001, data: null, message: '翻译失败' };
  }
});

app.get('/health', async () => ({ status: 'ok', service: 'translate-service' }));

await app.listen({ port: 3002 });
console.log('[Translate Service] Running on http://localhost:3002');
