/**
 * DashScope LLM 翻译器（带上下文纠错）
 *
 * 默认: DashScope Qwen 翻译+纠错一步到位
 * 备用: MyMemory 免费 API（仅在 LLM 失败时兜底）
 */

const LANG_NAMES: Record<string, string> = {
  en: 'English', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian',
};

interface DashScopeResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class MyMemoryTranslator {
  /**
   * 翻译+纠错一步到位（默认走 DashScope LLM，失败走 MyMemory 兜底）
   */
  async translate(text: string, sourceLang: string, targetLang: string, context?: Array<{ src: string; tgt: string }>, apiKey?: string): Promise<string> {
    const dashscopeKey = apiKey || process.env.DASHSCOPE_API_KEY || '';
    const srcName = LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = LANG_NAMES[targetLang] || targetLang;

    let contextHint = '';
    if (context && context.length > 0) {
      const lines = context.map((c, i) => `${i + 1}. ${c.src} → ${c.tgt}`).join('\n');
      contextHint = `\n\nContext (do NOT repeat these):\n${lines}`;
    }

    // 主路径：DashScope LLM 翻译+纠错
    try {
      const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dashscopeKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following ${srcName} text into ${tgtName}. Fix any errors, ensure natural phrasing, and use context to resolve ambiguities. Output ONLY the translation, no explanations.${contextHint}`,
            },
            { role: 'user', content: text },
          ],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      });

      const data = await resp.json() as DashScopeResponse;
      const result = data.choices?.[0]?.message?.content?.trim();
      if (result) return result;
    } catch (err) {
      console.warn(`[Translate] DashScope LLM failed: ${err instanceof Error ? err.message : err}`);
    }

    // 备用路径：MyMemory 免费 API
    console.warn('[Translate] Falling back to MyMemory');
    return this.translateViaMyMemory(text, sourceLang, targetLang);
  }

  /**
   * MyMemory 免费翻译（备用）
   */
  private async translateViaMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const resp = await fetch(url);
    const data = await resp.json() as Record<string, unknown>;

    if (data.responseStatus === 200 && (data.responseData as Record<string, unknown>)?.translatedText) {
      return (data.responseData as Record<string, string>).translatedText;
    }

    throw new Error((data.responseDetails as string) || 'MyMemory translation failed');
  }
}
