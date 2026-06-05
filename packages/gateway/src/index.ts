import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadEnv } from './config/env.js';
import { registerErrorHandler, registerRequestLogger } from './middleware/index.js';
import { registerHealthRoute, registerTtsRoute } from './routes/index.js';
import { registerWsHandler } from './handlers/index.js';

const env = loadEnv();

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL ?? 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

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
    app.log.info('─'.repeat(50));
    app.log.info(`🚀 Gateway running on ws://localhost:${env.PORT}/ws`);
    app.log.info(`📡 Health check: http://localhost:${env.PORT}/health`);
    app.log.info(`📁 Logs: ${process.cwd()}/logs/`);
    app.log.info('─'.repeat(50));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
