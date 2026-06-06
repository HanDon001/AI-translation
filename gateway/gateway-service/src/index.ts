import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import WebSocket from 'ws';
import type { Duplex } from 'stream';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(websocket);

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'gateway' }));

// 全局客户端注册表
const allClients = new Set<WebSocket>();

// 共享 ASR 连接（所有客户端共用一个）
let sharedAsrWs: WebSocket | null = null;
let asrReady = false;

function ensureAsrConnection(): WebSocket {
  if (sharedAsrWs && sharedAsrWs.readyState === WebSocket.OPEN) {
    return sharedAsrWs;
  }

  const asrWs = new WebSocket('ws://localhost:3001/ws/asr');

  asrWs.on('open', () => {
    asrReady = true;
    console.log('[Gateway] Shared ASR connection established');
  });

  asrWs.on('message', (data: WebSocket.Data) => {
    const raw = data.toString();
    // 广播给所有客户端
    for (const ws of allClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  });

  asrWs.on('close', () => {
    asrReady = false;
    sharedAsrWs = null;
    console.log('[Gateway] Shared ASR connection closed');
  });

  asrWs.on('error', (err: Error) => {
    asrReady = false;
    console.error('[Gateway] Shared ASR error:', err.message);
  });

  sharedAsrWs = asrWs;
  return asrWs;
}

// WebSocket 路由
// @fastify/websocket v8: 接收客户端消息用 socket.on('data'), 发送用 clientWs.send()
app.get('/ws', { websocket: true }, (socket: Duplex) => {
  const clientId = crypto.randomUUID();
  const clientWs = (socket as unknown as { socket: WebSocket }).socket;
  console.log(`[Gateway] Client connected: ${clientId}`);

  allClients.add(clientWs);

  // 确保共享 ASR 连接存在
  const asrWs = ensureAsrConnection();

  // 客户端消息 → 转发到 ASR
  socket.on('data', (data: Buffer) => {
    if (asrWs.readyState === WebSocket.OPEN) {
      asrWs.send(data.toString());
    }
  });

  clientWs.on('close', () => {
    console.log(`[Gateway] Client disconnected: ${clientId}`);
    allClients.delete(clientWs);
  });
});

// REST API 翻译接口 - 转发到翻译服务
app.post('/api/translate', async (request) => {
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
