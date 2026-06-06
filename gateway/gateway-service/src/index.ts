import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const app = Fastify({ logger: false });

await app.register(cors);
await app.register(websocket);

// 演示翻译数据（模拟实时翻译流）
const DEMO_SENTENCES = [
  { src: "Good morning everyone", tgt: "大家早上好" },
  { src: "Thank you for joining today's session", tgt: "感谢参加今天的会议" },
  { src: "I'd like to share some insights", tgt: "我想分享一些见解" },
  { src: "about the future of AI", tgt: "关于人工智能的未来" },
  { src: "The rapid development of large language models", tgt: "大语言模型的快速发展" },
  { src: "has changed everything", tgt: "改变了一切" },
  { src: "We believe that real-time translation", tgt: "我们相信实时翻译" },
  { src: "will break down language barriers", tgt: "将打破语言障碍" },
];

let sentenceIdx = 0;
let chunkCount = 0;

// 健康检查
app.get('/health', async () => ({ status: 'ok', service: 'gateway' }));

// WebSocket 处理
app.get('/ws', { websocket: true }, (socket) => {
  console.log('[Gateway] WebSocket connected');
  sentenceIdx = 0;
  chunkCount = 0;

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // 处理 API Key 设置
      if (msg.type === 'set_api_key') {
        console.log('[Gateway] API Key received');
        socket.send(JSON.stringify({ type: 'auth_success' }));
        return;
      }

      // 处理音频数据 - 快速返回翻译
      if (msg.type === 'audio_chunk') {
        chunkCount++;

        // 每 3 个 chunk 返回一次流式翻译
        if (chunkCount % 3 === 0 && sentenceIdx < DEMO_SENTENCES.length) {
          const sent = DEMO_SENTENCES[sentenceIdx];
          const progress = (chunkCount % 12) / 12;

          // 流式返回部分翻译
          const partialText = sent.tgt.substring(0, Math.ceil(sent.tgt.length * progress));
          socket.send(JSON.stringify({
            type: 'subtitle_patch',
            payload: {
              action: 'ADD_TEMP',
              new_text: partialText,
              target_range: [Date.now(), Date.now() + 1000],
              style: 'temp',
            },
          }));
          console.log(`[Gateway] Translation temp: "${partialText}"`);
        }

        // 每 12 个 chunk 返回一次最终翻译
        if (chunkCount % 12 === 0 && sentenceIdx < DEMO_SENTENCES.length) {
          const sent = DEMO_SENTENCES[sentenceIdx];
          socket.send(JSON.stringify({
            type: 'subtitle_patch',
            payload: {
              action: 'MARK_FINAL',
              new_text: sent.tgt,
              target_range: [Date.now(), Date.now() + 2000],
              style: 'final',
            },
          }));
          console.log(`[Gateway] Translation final: "${sent.tgt}"`);
          sentenceIdx = (sentenceIdx + 1) % DEMO_SENTENCES.length;
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

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return { code: 0, data: data.responseData.translatedText, message: 'success' };
    }
    return { code: 30001, data: null, message: '翻译失败' };
  } catch {
    return { code: 30001, data: null, message: '翻译服务不可用' };
  }
});

await app.listen({ port: 3000 });
console.log('[Gateway] Running on http://localhost:3000');
console.log('[Gateway] WebSocket: ws://localhost:3000/ws');
