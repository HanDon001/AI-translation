import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(websocket);

// 演示翻译数据
const DEMO_TRANSLATIONS: Record<string, string> = {
  'hello': '你好',
  'good morning': '早上好',
  'thank you': '谢谢',
  'how are you': '你好吗',
  'goodbye': '再见',
};

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'gateway' }));

// WebSocket 处理
app.get('/ws', { websocket: true }, (socket) => {
  console.log('[Gateway] WebSocket connection established');
  let audioBuffer: string[] = [];

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[Gateway] Received:', msg.type);

      // 处理 API Key 设置
      if (msg.type === 'set_api_key') {
        console.log('[Gateway] API Key set');
        socket.send(JSON.stringify({ type: 'auth_success' }));
        return;
      }

      // 处理音频数据
      if (msg.type === 'audio_chunk') {
        audioBuffer.push(msg.payload?.pcm_data || '');

        // 模拟 ASR 处理
        if (audioBuffer.length % 10 === 0) {
          const text = 'Hello, this is a simulated translation.';
          socket.send(JSON.stringify({
            type: 'subtitle_patch',
            payload: {
              action: 'ADD_TEMP',
              new_text: text,
              target_range: [Date.now(), Date.now() + 1000],
              style: 'temp',
            },
          }));
        }

        // 模拟翻译完成
        if (audioBuffer.length % 20 === 0) {
          const translations = [
            '你好，这是一个模拟翻译。',
            '实时翻译正在工作。',
            '欢迎使用 LiveTranslate。',
          ];
          const text = translations[Math.floor(audioBuffer.length / 20) % translations.length];

          socket.send(JSON.stringify({
            type: 'subtitle_patch',
            payload: {
              action: 'MARK_FINAL',
              new_text: text,
              target_range: [Date.now(), Date.now() + 2000],
              style: 'final',
            },
          }));
        }
        return;
      }

      // 处理配置
      if (msg.type === 'config') {
        console.log('[Gateway] Config:', msg.payload);
        return;
      }

    } catch (err) {
      console.error('[Gateway] Error:', err);
    }
  });

  socket.on('close', () => {
    console.log('[Gateway] WebSocket closed');
  });
});

// REST API 翻译接口
app.post('/api/translate', async (request, reply) => {
  const { text, sourceLang, targetLang } = request.body as {
    text: string;
    sourceLang: string;
    targetLang: string;
  };

  // 使用 MyMemory API 翻译
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return { code: 0, data: data.responseData.translatedText, message: 'success' };
    }
    return { code: 30001, data: null, message: '翻译失败' };
  } catch (err) {
    return { code: 30001, data: null, message: '翻译服务不可用' };
  }
});

await app.listen({ port: 3000 });
console.log('[Gateway] Running on http://localhost:3000');
