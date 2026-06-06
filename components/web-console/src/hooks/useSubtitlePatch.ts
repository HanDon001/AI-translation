import { useRef, useCallback, useEffect } from 'react';

/**
 * 字幕补丁类型
 */
interface SubtitlePatchPayload {
  action: 'ADD_TEMP' | 'MARK_FINAL' | 'INVALIDATE';
  target_range: [number, number];
  new_text: string;
  style: 'temp' | 'final';
}

const DEBOUNCE_MS = 50;

/**
 * 字幕 Patch 防抖合并 Hook
 * 50ms 内多次修正合并为一次 DOM 操作
 */
export function useSubtitlePatch(onApply: (patches: SubtitlePatchPayload[]) => void) {
  const queueRef = useRef<SubtitlePatchPayload[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueue = useCallback((patch: SubtitlePatchPayload) => {
    queueRef.current.push(patch);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const all = queueRef.current.splice(0);
      onApply(all);
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, [onApply]);

  // 监听 WS 消息并分发
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, payload } = (e as CustomEvent).detail;
      if (type === 'subtitle_patch') {
        enqueue(payload as SubtitlePatchPayload);
      }
    };
    window.addEventListener('ws:message', handler);
    return () => window.removeEventListener('ws:message', handler);
  }, [enqueue]);

  return { enqueue };
}
