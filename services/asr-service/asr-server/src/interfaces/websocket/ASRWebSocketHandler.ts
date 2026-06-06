import type { WebSocket } from 'ws';
import { ASRApplicationService } from '../../application/service/ASRApplicationService.js';

/**
 * ASR WebSocket 处理器
 */
export class ASRWebSocketHandler {
  private appService = new ASRApplicationService();

  async handleConnection(ws: WebSocket): Promise<void> {
    console.log('[ASR] Client connected');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (err) {
        console.error('[ASR] Error:', err);
      }
    });

    ws.on('close', () => {
      console.log('[ASR] Client disconnected');
    });
  }

  private async handleMessage(ws: WebSocket, msg: { type: string; payload: unknown }): Promise<void> {
    const { type, payload } = msg;

    if (type === 'audio_chunk') {
      const { pcm_data } = payload as { pcm_data: string };
      // 处理音频数据
      console.log('[ASR] Received audio chunk');
    }
  }
}
