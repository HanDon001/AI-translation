/**
 * 统一响应体
 */
export interface Result<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

export function success<T>(data: T): Result<T> {
  return { code: 0, message: 'success', data };
}

export function error(code: number, message: string): Result {
  return { code, message, data: null };
}
