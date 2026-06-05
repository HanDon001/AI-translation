import type { FastifyInstance } from 'fastify';

/**
 * 请求日志中间件
 * 记录每个请求的方法、URL、状态码和响应时间
 */
export function registerRequestLogger(app: FastifyInstance): void {
  // 请求开始时记录
  app.addHook('onRequest', async (request) => {
    request.log.info(
      { method: request.method, url: request.url, ip: request.ip },
      '→ request'
    );
  });

  // 请求完成时记录
  app.addHook('onResponse', async (request, reply) => {
    const statusCode = reply.statusCode;
    const responseTime = reply.elapsedTime;

    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode,
        responseTime: `${responseTime.toFixed(1)}ms`,
      },
      `← response ${statusCode}`
    );
  });
}
