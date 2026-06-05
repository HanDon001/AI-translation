import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  }));
}
