import { BusinessException, ErrorCode } from '@livetranslate/common-core';

/**
 * API Key 校验
 */
export function validateApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    throw new BusinessException(ErrorCode.API_KEY_MISSING, '缺少 API Key');
  }
  if (!apiKey.startsWith('sk-') || apiKey.length < 10) {
    throw new BusinessException(ErrorCode.API_KEY_INVALID, 'API Key 无效');
  }
  return apiKey;
}
