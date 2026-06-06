import type { WebSocket } from 'ws';

/**
 * 演示翻译数据
 */
const DEMO_SENTENCES = [
  { src: 'Good morning everyone', tgt: '大家早上好' },
  { src: "Thank you for joining today's session", tgt: '感谢参加今天的会议' },
  { src: "I'd like to share some insights", tgt: '我想分享一些见解' },
  { src: 'about the future of AI', tgt: '关于人工智能的未来' },
  { src: 'The rapid development of large language models', tgt: '大语言模型的快速发展' },
  { src: 'has changed everything', tgt: '改变了一切' },
  { src: 'We believe that real-time translation', tgt: '我们相信实时翻译' },
  { src: 'will break down language barriers', tgt: '将打破语言障碍' },
];

const TEMP_TRIGGER_CHUNKS = 3;
const FINAL_TRIGGER_CHUNKS = 12;

/**
 * ASR WebSocket 处理器
 * 每个连接维护独立状态（解决并发 Bug）
 */
export class ASRWebSocketHandler {
  handleConnection(ws: WebSocket): void {
    let sentenceIdx = 0;
    let chunkCount = 0;

    console.log('[ASR] Client connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(ws, msg, sentenceIdx, chunkCount);
        chunkCount++;
        if (chunkCount % FINAL_TRIGGER_CHUNKS === 0) {
          sentenceIdx++;
        }
      } catch (err) {
        console.error('[ASR] Error:', err);
      }
    });

    ws.on('close', () => {
      console.log('[ASR] Client disconnected');
    });
  }

  private handleMessage(ws: WebSocket, msg: { type: string; payload: unknown }, sentenceIdx: number, chunkCount: number): void {
    const { type } = msg;

    if (type === 'set_api_key') {
      console.log('[ASR] API Key received');
      ws.send(JSON.stringify({ type: 'auth_success' }));
      return;
    }

    if (type === 'audio_chunk') {
      // 流式翻译
      if (chunkCount % TEMP_TRIGGER_CHUNKS === 0 && sentenceIdx < DEMO_SENTENCES.length) {
        const sent = DEMO_SENTENCES[sentenceIdx % DEMO_SENTENCES.length];
        const progress = (chunkCount % FINAL_TRIGGER_CHUNKS) / FINAL_TRIGGER_CHUNKS;
        const partialText = sent.tgt.substring(0, Math.ceil(sent.tgt.length * progress));

        ws.send(JSON.stringify({
          type: 'subtitle_patch',
          payload: {
            action: 'ADD_TEMP',
            new_text: partialText,
            target_range: [Date.now(), Date.now() + 1000],
            style: 'temp',
          },
        }));
        console.log(`[ASR] Translation temp: "${partialText}"`);
      }

      // 最终翻译
      if (chunkCount % FINAL_TRIGGER_CHUNKS === 0 && sentenceIdx < DEMO_SENTENCES.length) {
        const sent = DEMO_SENTENCES[sentenceIdx % DEMO_SENTENCES.length];

        ws.send(JSON.stringify({
          type: 'subtitle_patch',
          payload: {
            action: 'MARK_FINAL',
            new_text: sent.tgt,
            target_range: [Date.now(), Date.now() + 2000],
            style: 'final',
          },
        }));
        console.log(`[ASR] Translation final: "${sent.tgt}"`);
      }
      return;
    }

    if (type === 'config') {
      console.log('[ASR] Config:', msg.payload);
      return;
    }
  }
}
