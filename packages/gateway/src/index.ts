import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadEnv } from './config/env.js';
import { registerErrorHandler, registerRequestLogger } from './middleware/index.js';
import { registerHealthRoute, registerTtsRoute } from './routes/index.js';
import { registerWsHandler } from './handlers/index.js';

const env = loadEnv();

async function bootstrap(): Promise<void> {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Register middleware
  registerRequestLogger(app);
  registerErrorHandler(app);

  // Register routes
  registerHealthRoute(app);
  registerTtsRoute(app);
  registerWsHandler(app);

  // Start
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Gateway running on ws://localhost:${env.PORT}/ws`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
