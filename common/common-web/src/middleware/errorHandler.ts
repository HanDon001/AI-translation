import type { FastifyInstance } from 'fastify';
import { BusinessException } from '@livetranslate/common-core';

/**
 * 全局异常处理
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BusinessException) {
      reply.status(400).send({
        code: error.code,
        message: error.message,
        data: null,
      });
      return;
    }

    request.log.error(error);
    reply.status(500).send({
      code: 10000,
      message: '系统错误',
      data: null,
    });
  });
}
