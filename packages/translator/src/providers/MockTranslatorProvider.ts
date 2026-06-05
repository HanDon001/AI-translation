import type { ITranslatorProvider } from './ITranslatorProvider.js';
import { mockTranslateStream } from '../mocks/translatorMock.js';

/**
 * Mock 翻译引擎实现
 * 直接在源文本前添加标记，不调用任何外部 API
 */
export class MockTranslatorProvider implements ITranslatorProvider {
  async *translate(sourceText: string, _context?: string): AsyncIterable<string> {
    const isFinal = sourceText.includes('。') || sourceText.includes('！');
    yield* mockTranslateStream(sourceText, isFinal);
  }
}
