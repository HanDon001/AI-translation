import Fastify from 'fastify';
import { validateApiKey } from '@livetranslate/common-security';

const app = Fastify({ logger: true });

app.post('/auth/validate', async (request, reply) => {
  const { apiKey } = request.body as { apiKey: string };

  try {
    validateApiKey(apiKey);
    return { code: 0, data: { valid: true }, message: 'success' };
  } catch (err) {
    return { code: 40001, data: { valid: false }, message: 'API Key 无效' };
  }
});

app.get('/health', async () => ({ status: 'ok', service: 'auth-service' }));

await app.listen({ port: 3003 });
console.log('[Auth Service] Running on http://localhost:3003');
