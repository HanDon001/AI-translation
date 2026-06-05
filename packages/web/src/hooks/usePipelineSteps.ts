import { useState, useCallback } from 'react';

export type StepState = 'pending' | 'active' | 'done' | 'error';

export interface StepInfo {
  id: string;
  icon: string;
  name: string;
  detail: string;
  state: StepState;
  latency?: string;
}

const DEFAULT_STEPS: StepInfo[] = [
  { id: 'init', icon: 'fa-rocket', name: 'SDK 初始化', detail: '配置参数与鉴权', state: 'pending' },
  { id: 'ws', icon: 'fa-plug', name: 'WebSocket 连接', detail: '建立长连接通道', state: 'pending' },
  { id: 'auth', icon: 'fa-key', name: '鉴权校验', detail: 'API-Key 签名验证', state: 'pending' },
  { id: 'vad', icon: 'fa-wave-square', name: 'VAD 端点检测', detail: '语音活动检测', state: 'pending' },
  { id: 'asr', icon: 'fa-microphone-lines', name: 'ASR 语音识别', detail: '流式转录原文', state: 'pending' },
  { id: 'mt', icon: 'fa-language', name: 'MT 机器翻译', detail: 'Qwen 翻译模型', state: 'pending' },
  { id: 'post', icon: 'fa-wand-magic-sparkles', name: '后处理对齐', detail: '时间戳与断句', state: 'pending' },
];

export function usePipelineSteps() {
  const [steps, setSteps] = useState<StepInfo[]>(DEFAULT_STEPS);

  const setStepState = useCallback((id: string, state: StepState, detail?: string, latency?: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, state, ...(detail ? { detail } : {}), ...(latency ? { latency } : {}) } : s
      )
    );
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(DEFAULT_STEPS.map((s) => ({ ...s })));
  }, []);

  return { steps, setStepState, resetSteps };
}
