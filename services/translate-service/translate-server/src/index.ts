import Fastify from 'fastify';
import { success, error } from '@livetranslate/common-web';
import { MyMemoryTranslator } from './infrastructure/external/MyMemoryTranslator.js';

const app = Fastify({ logger: true });
const translator = new MyMemoryTranslator();

// 翻译接口 - 使用统一响应体
app.post('/translate', async (request, reply) => {
  const { text, sourceLang, targetLang } = request.body as {
    text: string;
    sourceLang: string;
    targetLang: string;
  };

  // 参数校验
  if (!text || !sourceLang || !targetLang) {
    return error(10001, '缺少必要参数');
  }

  try {
    const result = await translator.translate(text, sourceLang, targetLang);
    return success(result);
  } catch (err) {
    request.log.error(err, '翻译失败');
    return error(30001, '翻译服务不可用');
  }
});

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'translate-service' }));

await app.listen({ port: 3002 });
console.log('[Translate Service] Running on http://localhost:3002');
