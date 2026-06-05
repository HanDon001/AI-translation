import type { SubtitleStyle } from '@realtime-interp/shared';

/**
 * DOM 局部更新工具
 *
 * 核心原则：
 *  - 全程不触发 React Virtual DOM Diff
 *  - 所有操作直接作用于真实 DOM 节点
 */

/**
 * 在容器末尾创建临时字幕 span
 */
export function addTempSegment(
  container: HTMLDivElement,
  text: string,
  startMs: number,
): HTMLSpanElement {
  const span = document.createElement('span');
  span.dataset.startMs = String(startMs);
  span.className = 'subtitle-temp text-gray-400 italic transition-opacity duration-50';
  span.textContent = text;
  container.appendChild(span);
  return span;
}

/**
 * 将临时字幕标记为最终态
 */
export function markFinal(span: HTMLSpanElement, text: string): void {
  span.className = 'subtitle-final text-white font-bold transition-colors duration-100';
  span.textContent = text;
}

/**
 * 原地替换指定 span 的文本
 */
export function replaceText(span: HTMLSpanElement, newText: string): void {
  span.textContent = newText;
}

/**
 * 隐藏指定 span
 */
export function hideSegment(span: HTMLSpanElement): void {
  span.style.display = 'none';
}

/**
 * 设置 span 样式
 */
export function setStyle(span: HTMLSpanElement, style: SubtitleStyle): void {
  if (style === 'final') {
    span.className = 'subtitle-final text-white font-bold transition-colors duration-100';
  } else {
    span.className = 'subtitle-temp text-gray-400 italic transition-opacity duration-50';
  }
}
