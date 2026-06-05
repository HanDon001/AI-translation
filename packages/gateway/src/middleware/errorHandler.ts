import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误，返回统一格式响应
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode ?? 500;

    // 记录错误详情
    request.log.error(
      {
        err: error,
        statusCode,
        method: request.method,
        url: request.url,
      },
      `✗ ${statusCode} ${error.message}`
    );

    // 返回统一错误格式
    reply.status(statusCode).send({
      success: false,
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR',
        message: statusCode >= 500 ? '服务器内部错误' : error.message,
      },
    });
  });

  // 404 处理
  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ method: request.method, url: request.url }, '→ 404 Not Found');
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `接口不存在: ${request.method} ${request.url}`,
      },
    });
  });
}
