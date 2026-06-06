import WebSocket from 'ws';

/**
 * DashScope WebSocket 客户端
 */
export class DashScopeWSClient {
  private ws: WebSocket | null = null;

  async connect(apiKey: string, model: string): Promise<void> {
    const url = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        console.log('[DashScope] Connected');
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[DashScope] Error:', err.message);
        reject(err);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });
    });
  }

  private handleMessage(message: string): void {
    try {
      const msg = JSON.parse(message);
      console.log('[DashScope] Received:', msg.type);
    } catch (err) {
      console.error('[DashScope] Parse error:', err);
    }
  }

  sendAudio(pcmBase64: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcmBase64,
      }));
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'session.finish' }));
      setTimeout(() => this.ws?.close(), 2000);
    }
  }
}
