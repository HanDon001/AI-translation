import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { ASRWebSocketHandler } from './interfaces/websocket/ASRWebSocketHandler.js';

const app = Fastify({ logger: true });
const handler = new ASRWebSocketHandler();

await app.register(websocket);

// WebSocket 处理
app.get('/ws/asr', { websocket: true }, (socket) => {
  handler.handleConnection(socket);
});

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'asr-service' }));

await app.listen({ port: 3001 });
console.log('[ASR Service] Running on ws://localhost:3001/ws/asr');
