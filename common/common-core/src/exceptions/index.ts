/**
 * 统一错误码
 */
export enum ErrorCode {
  SYSTEM_ERROR = 10000,
  PARAM_ERROR = 10001,
  UNAUTHORIZED = 10002,
  FORBIDDEN = 10003,
  ASR_ERROR = 20001,
  TRANSLATE_ERROR = 30001,
  API_KEY_MISSING = 40001,
  API_KEY_INVALID = 40002,
  WS_ERROR = 50001,
}

/**
 * 业务异常
 */
export class BusinessException extends Error {
  constructor(
    public code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}
