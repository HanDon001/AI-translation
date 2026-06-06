import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(websocket);

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'gateway' }));

// WebSocket 路由转发 - 只做协议转换和连接管理
app.get('/ws', { websocket: true }, (socket) => {
  const clientId = crypto.randomUUID();
  console.log(`[Gateway] Client connected: ${clientId}`);

  // 转发到 ASR 服务
  const asrWs = new WebSocket('ws://localhost:3001/ws/asr');

  asrWs.onopen = () => {
    console.log(`[Gateway] Connected to ASR service for client: ${clientId}`);
  };

  asrWs.onmessage = (event) => {
    // 将 ASR 服务的响应转发给客户端
    if (socket.readyState === 1) {
      socket.send(event.data);
    }
  };

  asrWs.onclose = () => {
    console.log(`[Gateway] ASR service disconnected for client: ${clientId}`);
    if (socket.readyState === 1) {
      socket.close();
    }
  };

  // 将客户端消息转发到 ASR 服务
  socket.on('message', (data) => {
    if (asrWs.readyState === WebSocket.OPEN) {
      asrWs.send(data.toString());
    }
  });

  socket.on('close', () => {
    console.log(`[Gateway] Client disconnected: ${clientId}`);
    asrWs.close();
  });
});

// REST API 翻译接口 - 转发到翻译服务
app.post('/api/translate', async (request, reply) => {
  try {
    const resp = await fetch('http://localhost:3002/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    return await resp.json();
  } catch (err) {
    request.log.error(err);
    return { code: 50001, data: null, message: '网关转发失败' };
  }
});

await app.listen({ port: 3000 });
console.log('[Gateway] Running on http://localhost:3000');
