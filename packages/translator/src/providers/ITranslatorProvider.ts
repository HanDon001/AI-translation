/**
 * 翻译引擎抽象接口
 * 任何翻译引擎必须实现此接口
 */
export interface ITranslatorProvider {
  /**
   * 翻译源文本
   * @param sourceText 待翻译的文本
   * @param context 上下文文本（可选）
   * @returns 流式翻译结果
   */
  translate(sourceText: string, context?: string): AsyncIterable<string>;
}
