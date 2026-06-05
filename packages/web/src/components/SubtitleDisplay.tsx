import { useRef, useImperativeHandle, forwardRef } from 'react';
import type { SubtitlePatchPayload } from '@realtime-interp/shared';
import { MAX_BUFFER_SIZE, PRUNE_COUNT } from '@realtime-interp/shared';

/**
 * 核心字幕渲染组件
 *
 * 红线规则：
 *  - 绝对禁止使用 useState 存储全量字幕文本
 *  - 绝对禁止通过修改 state 触发组件重新渲染
 *  - 必须且只能使用 useRef + 原生 DOM API 进行局部修改
 */
export const SubtitleDisplay = forwardRef(function SubtitleDisplay(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 时间轴映射：start_ms -> HTMLSpanElement
  const timeMapRef = useRef<Map<number, HTMLSpanElement>>(new Map());

  // 对外暴露 handlePatch 方法
  useImperativeHandle(ref, () => ({
    handlePatch(msg: unknown) {
      const { payload } = msg as { payload: SubtitlePatchPayload };
      const { action } = payload;

      switch (action) {
        case 'ADD_TEMP':
          handleAddTemp(payload);
          break;
        case 'MARK_FINAL':
          handleMarkFinal(payload);
          break;
        case 'INVALIDATE':
          handleInvalidate(payload);
          break;
      }
    },
  }));

  const handleAddTemp = (payload: SubtitlePatchPayload) => {
    const container = containerRef.current;
    if (!container || !payload.target_range) return;

    const span = document.createElement('span');
    span.dataset.startMs = String(payload.target_range[0]);
    span.className = 'subtitle-temp text-gray-400 italic transition-opacity duration-50';
    span.textContent = payload.new_text ?? '';
    container.appendChild(span);
    timeMapRef.current.set(payload.target_range[0], span);

    // 内存回收
    pruneOldNodes(container);
  };

  const handleMarkFinal = (payload: SubtitlePatchPayload) => {
    if (!payload.target_range) return;
    const span = timeMapRef.current.get(payload.target_range[0]);
    if (span) {
      span.className = 'subtitle-final text-white font-bold transition-colors duration-100';
      span.textContent = payload.new_text ?? span.textContent ?? '';
    }
  };

  const handleInvalidate = (payload: SubtitlePatchPayload) => {
    if (!payload.target_range) return;
    const spans = findSpansInRange(payload.target_range);
    if (spans.length === 0) return;

    // 只修改第一个受影响元素的文本
    spans[0].textContent = payload.new_text ?? '';

    // 如果新文本覆盖了后续元素的范围，隐藏之
    const newEndMs = payload.target_range[1];
    for (let i = 1; i < spans.length; i++) {
      const startMs = Number(spans[i].dataset.startMs);
      if (startMs < newEndMs) {
        spans[i].style.display = 'none';
      }
    }
  };

  const findSpansInRange = (range: [number, number]): HTMLSpanElement[] => {
    const result: HTMLSpanElement[] = [];
    for (const [startMs, span] of timeMapRef.current) {
      if (startMs >= range[0] && startMs <= range[1]) {
        result.push(span);
      }
    }
    return result;
  };

  const pruneOldNodes = (container: HTMLDivElement) => {
    if (container.children.length > MAX_BUFFER_SIZE) {
      for (let i = 0; i < PRUNE_COUNT && container.firstChild; i++) {
        const child = container.firstChild as HTMLSpanElement;
        const startMs = Number(child.dataset.startMs);
        timeMapRef.current.delete(startMs);
        container.removeChild(child);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="
        fixed bottom-8 left-1/2 -translate-x-1/2
        w-[80%] max-w-[1000px]
        min-h-[80px] max-h-[200px] overflow-y-auto
        px-6 py-4 rounded-2xl
        bg-black/60 backdrop-blur-md
        shadow-lg shadow-black/30
        text-2xl leading-relaxed
        font-subtitle flex flex-wrap items-end gap-x-2
      "
    />
  );
});
