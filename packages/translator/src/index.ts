import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadEnv } from './config/env.js';
import { registerTranslatorWsHandler } from './handlers/index.js';

const env = loadEnv();

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  registerTranslatorWsHandler(app);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Translator running on ws://localhost:${env.PORT}/ws (mock: ${env.MOCK_MODE})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
