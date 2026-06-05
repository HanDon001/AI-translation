import https from 'https';

/**
 * 阿里云 DashScope 千问翻译服务
 * 使用 qwen-turbo 模型进行实时翻译
 */

interface TranslateOptions {
  text: string;
  apiKey: string;
  sourceLang?: string;
  targetLang?: string;
}

/**
 * 调用千问大模型进行翻译
 */
export async function translateText(options: TranslateOptions): Promise<string> {
  const { text, apiKey, sourceLang = 'English', targetLang = 'Chinese' } = options;

  const body = JSON.stringify({
    model: 'qwen-turbo',
    input: {
      messages: [
        {
          role: 'system',
          content: `You are a real-time interpreter. Translate the following ${sourceLang} text to ${targetLang}. Only output the translation, nothing else. Keep it concise and natural.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    },
    parameters: {
      max_tokens: 200,
      temperature: 0.3,
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'dashscope.aliyuncs.com',
        path: '/api/v1/services/aigc/text-generation/generation',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(Buffer.concat(chunks).toString());
            if (res.statusCode === 200 && response.output?.text) {
              resolve(response.output.text.trim());
            } else {
              reject(new Error(`Translation API error: ${JSON.stringify(response)}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
