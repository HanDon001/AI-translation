import path from 'path';
import fs from 'fs';

/**
 * 日志管理器
 * 控制台输出 + 文件输出，按日期自动分割
 */

const LOG_DIR = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const now = new Date();
const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const logFile = path.join(LOG_DIR, `gateway_${dateStr}.log`);

/**
 * 获取日志文件路径
 */
export function getLogFilePath(): string {
  return logFile;
}

/**
 * 请求日志格式
 */
export function formatRequestLog(method: string, url: string, statusCode: number, responseTime: number): string {
  return `${method} ${url} ${statusCode} ${responseTime.toFixed(1)}ms`;
}

/**
 * 错误日志格式
 */
export function formatErrorLog(err: Error, context?: string): object {
  return {
    error: err.message,
    stack: err.stack,
    context,
  };
}
