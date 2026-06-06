import WebSocket from 'ws';

/**
 * DashScope 实时语音识别 WebSocket 客户端
 *
 * 实际协议流程 (基于实测):
 *   1. 连接 wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=<model>
 *   2. 服务端返回 session.created
 *   3. 客户端持续发送 input_audio_buffer.append (base64 PCM 16kHz 16bit mono)
 *   4. 服务端 VAD 检测语音活动，返回:
 *      - input_audio_buffer.speech_started   (语音开始)
 *      - conversation.item.created            (识别项创建)
 *      - conversation.item.input_audio_transcription.text  (增量识别, text在 stash 字段)
 *      - input_audio_buffer.speech_stopped    (语音结束)
 *      - input_audio_buffer.committed         (音频段提交)
 *      - conversation.item.input_audio_transcription.completed (最终识别, text在 transcript 字段)
 */
export class DashScopeWSClient {
  private ws: WebSocket | null = null;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((err: Error) => void) | null = null;
  private onSpeechStartedCallback: (() => void) | null = null;

  /**
   * 连接到 DashScope ASR 服务
   */
  async connect(apiKey: string, model: string): Promise<void> {
    const url = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=${model}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      this.ws.on('open', () => {
        console.log('[DashScope] Connected to ASR');
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[DashScope] Connection error:', err.message);
        this.onErrorCallback?.(err);
        reject(err);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[DashScope] Connection closed: ${code} ${reason.toString()}`);
      });
    });
  }

  /**
   * 注册识别结果回调
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  /**
   * 注册错误回调
   */
  onError(callback: (err: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * 注册语音开始回调
   * 新的语音段落开始时触发，用于提前结束冷却期
   */
  onSpeechStarted(callback: () => void): void {
    this.onSpeechStartedCallback = callback;
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case 'session.created':
          console.log('[DashScope] Session created:', msg.session?.id);
          break;

        case 'input_audio_buffer.speech_started':
          console.log(`[DashScope] Speech started at ${msg.audio_start_ms}ms`);
          this.onSpeechStartedCallback?.();
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log(`[DashScope] Speech stopped at ${msg.audio_end_ms}ms`);
          break;

        case 'input_audio_buffer.committed':
          break;

        case 'conversation.item.created':
          break;

        case 'conversation.item.input_audio_transcription.text': {
          const partialText = msg.stash || '';
          if (partialText) {
            this.onTranscriptCallback?.(partialText, false);
          }
          break;
        }

        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = msg.transcript || '';
          const lang = msg.language || '';
          console.log(`[DashScope] Final transcription [${lang}]: "${transcript}"`);
          if (transcript) {
            this.onTranscriptCallback?.(transcript, true);
          }
          break;
        }

        case 'error': {
          const errMsg = msg.error?.message || 'Unknown DashScope error';
          console.error('[DashScope] Server error:', errMsg);
          this.onErrorCallback?.(new Error(errMsg));
          break;
        }

        default:
          break;
      }
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

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
