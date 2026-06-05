import https from 'https';

/**
 * 阿里云 DashScope 千问 TTS 语音合成服务
 * 使用 SAM-BERT 模型将文本转为语音
 */

interface TTSOptions {
  text: string;
  apiKey: string;
  model?: string;
  voice?: string;
}

/**
 * 调用 DashScope TTS API 合成语音
 * 返回 base64 编码的音频数据
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<string> {
  const { text, apiKey, model = 'sambert-zhichu-v1' } = options;

  const body = JSON.stringify({
    model,
    input: { text },
    parameters: {
      format: 'mp3',
      sample_rate: 16000,
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'dashscope.aliyuncs.com',
        path: '/api/v1/services/aigc/text2audio/generation',
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
          if (res.statusCode === 200) {
            const audioBase64 = Buffer.concat(chunks).toString('base64');
            resolve(audioBase64);
          } else {
            const errorBody = Buffer.concat(chunks).toString();
            reject(new Error(`TTS API error ${res.statusCode}: ${errorBody}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
