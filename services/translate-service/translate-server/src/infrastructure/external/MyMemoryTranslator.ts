/**
 * MyMemory 翻译器
 */
export class MyMemoryTranslator {
  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }

    throw new Error(data.responseDetails || '翻译失败');
  }
}
