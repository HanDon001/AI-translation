import { useCallback } from 'react';
import { addConsoleLog } from './useConsoleLog';
import type { ToastType } from '../components/Toast';
import type { StepState } from './usePipelineSteps';

/** 从未知错误中提取消息 */
function extractMessage(e: unknown, fallback = '未知错误'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return fallback;
}

/** 判断是否为用户主动取消 */
function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

interface ErrorHandlerOptions {
  showToast: (type: ToastType, msg: string) => void;
  setStepState?: (id: string, state: StepState, detail?: string) => void;
}

export function useErrorHandler({ showToast, setStepState }: ErrorHandlerOptions) {

  /** 处理翻译错误 */
  const handleTranslationError = useCallback((e: unknown, _sourceText?: string) => {
    if (isAbortError(e)) return false; // 用户取消，静默

    const msg = extractMessage(e, '翻译失败');
    addConsoleLog('err', `翻译失败: ${msg}`);
    showToast('err', `翻译失败: ${msg}`);
    setStepState?.('mt', 'error', msg);
    return true; // 已处理
  }, [showToast, setStepState]);

  /** 处理启动/连接错误 */
  const handleStartupError = useCallback((e: unknown) => {
    const msg = extractMessage(e, '启动失败');
    addConsoleLog('err', `启动失败: ${msg}`);
    showToast('err', `启动失败: ${msg}`);
    return msg;
  }, [showToast]);

  /** 处理网关错误 */
  const handleGatewayError = useCallback((payload: { message?: string } | undefined) => {
    const msg = payload?.message || '未知网关错误';
    addConsoleLog('err', `网关错误: ${msg}`);
    showToast('err', msg);
  }, [showToast]);

  /** 处理非关键警告（不阻断流程） */
  const handleWarning = useCallback((context: string, e?: unknown) => {
    const msg = e ? extractMessage(e, context) : context;
    addConsoleLog('warn', msg);
  }, []);

  /** 通用 try-catch 包装 */
  const tryCatch = useCallback(async <T>(
    fn: () => Promise<T>,
    options: { fallback?: T; onError?: (e: unknown) => void; context?: string } = {}
  ): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e: unknown) {
      if (isAbortError(e)) return options.fallback;
      const context = options.context || '操作失败';
      addConsoleLog('err', `${context}: ${extractMessage(e)}`);
      options.onError?.(e);
      return options.fallback;
    }
  }, []);

  return {
    extractMessage,
    isAbortError,
    handleTranslationError,
    handleStartupError,
    handleGatewayError,
    handleWarning,
    tryCatch,
  };
}
