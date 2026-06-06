import type { WebSocket } from 'ws';
import { TranslateSession } from '../../../translate-service/translate-server/src/domain/model/TranslateSession.js';
import { MockTranslator } from '../../../translate-service/translate-server/src/infrastructure/external/MockTranslator.js';

/**
 * ASR WebSocket 处理器
 * 每个连接维护独立的 TranslateSession（解决并发 Bug）
 */
export class ASRWebSocketHandler {
  private mockTranslator = new MockTranslator();

  handleConnection(ws: WebSocket): void {
    const session = new TranslateSession();
    console.log('[ASR] Client connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(ws, session, msg);
      } catch (err) {
        console.error('[ASR] Error:', err);
      }
    });

    ws.on('close', () => {
      console.log('[ASR] Client disconnected');
    });
  }

  private handleMessage(ws: WebSocket, session: TranslateSession, msg: { type: string; payload: unknown }): void {
    const { type, payload } = msg;

    if (type === 'set_api_key') {
      console.log('[ASR] API Key received');
      ws.send(JSON.stringify({ type: 'auth_success' }));
      return;
    }

    if (type === 'audio_chunk') {
      const result = session.handleChunk();

      if (result.shouldTranslate) {
        const progress = (session.getChunkCount() % 12) / 12;
        const partialText = this.mockTranslator.getPartialTranslation(result.index, progress);

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

      if (result.isFinal) {
        const translation = this.mockTranslator.getTranslation(result.index - 1);

        ws.send(JSON.stringify({
          type: 'subtitle_patch',
          payload: {
            action: 'MARK_FINAL',
            new_text: translation.tgt,
            target_range: [Date.now(), Date.now() + 2000],
            style: 'final',
          },
        }));
        console.log(`[ASR] Translation final: "${translation.tgt}"`);
      }
      return;
    }

    if (type === 'config') {
      console.log('[ASR] Config:', payload);
      return;
    }
  }
}
