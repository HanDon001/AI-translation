import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(websocket);

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'gateway' }));

// WebSocket 代理到 ASR 服务
app.get('/ws/asr', { websocket: true }, (socket) => {
  console.log('[Gateway] WebSocket connection for ASR');
  // TODO: 代理到 asr-service
  socket.on('message', (data) => {
    console.log('[Gateway] Received:', data.toString());
  });
});

// REST API 代理到翻译服务
app.post('/api/translate', async (request, reply) => {
  // TODO: 代理到 translate-service
  return { code: 0, data: null, message: 'not implemented' };
});

await app.listen({ port: 3000 });
console.log('[Gateway] Running on http://localhost:3000');
