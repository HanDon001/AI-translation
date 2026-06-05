/**
 * 翻译 Mock — 模拟流式翻译结果
 *
 * 规则：
 *  - isFinal=false → 返回 "[临] {sourceText}"
 *  - isFinal=true  → 返回 "[终] {sourceText}"
 */
export function mockTranslate(sourceText: string, isFinal: boolean): string {
  const prefix = isFinal ? '[终]' : '[临]';
  return `${prefix} ${sourceText}`;
}

/**
 * 异步流式 Mock（模拟网络延迟）
 */
export async function* mockTranslateStream(sourceText: string, isFinal: boolean): AsyncGenerator<string> {
  await new Promise((r) => setTimeout(r, 50));
  yield mockTranslate(sourceText, isFinal);
}
