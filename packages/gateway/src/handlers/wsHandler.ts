import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { BufferNode } from '@realtime-interp/shared';
import { WINDOW_MS, isAudioChunk } from '@realtime-interp/shared';
import { RingBuffer } from '../core/RingBuffer.js';
import { WaitKScheduler } from '../core/WaitKScheduler.js';
import { createQwenASRSession, type InternalASREvent } from '../services/QwenASRService.js';
import { createQwenTTSSession } from '../services/QwenTTSService.js';

// Mock ASR 剧本（降级用）
const MOCK_SCRIPT = ['Hello', 'everyone', 'welcome to', 'the meeting'];

/**
 * WebSocket 消息路由处理
 * 接收前端音频切片或语音识别文本，通过 ASR + Wait-K 调度翻译，广播字幕 Patch
 */
export function registerWsHandler(app: FastifyInstance): void {
  const buffer = new RingBuffer();
  const scheduler = new WaitKScheduler(buffer);
  const clients = new Set<WebSocket>();
  let windowId = 0;
  let apiKey = '';
  let asrSession: ReturnType<typeof createQwenASRSession> | null = null;

  /** 处理 ASR 事件（CHUNK/CORRECT/FINAL） */
  async function handleASREvent(event: InternalASREvent): Promise<void> {
    const { type, text, start_ms, end_ms } = event;
    if (!text) {
      app.log.debug({ type }, 'ASR event: empty text, skip');
      return;
    }

    const id = windowId++;
    app.log.info({ type, text, start_ms, end_ms, id }, '📌 ASR event received');

    if (type === 'CORRECT') {
      app.log.info({ text, start_ms }, '🔄 Correction detected');
      const node = buffer.getAll().find((n) => n.start_ms === start_ms);
      if (node) {
        const patch = await scheduler.handleASRCorrect(node.window_id, text);
        if (patch) {
          app.log.info({ patch }, '📤 Broadcasting INVALIDATE patch');
          broadcast(clients, { type: 'subtitle_patch', payload: patch, timestamp: Date.now() });
        } else {
          app.log.debug('No diff from correction');
        }
      } else {
        app.log.warn({ start_ms }, 'Correction target not found in buffer');
      }
      return;
    }

    // CHUNK 或 FINAL
    const asrNode: BufferNode = {
      window_id: id,
      source_text: text,
      translated_text: '',
      is_final: type === 'FINAL',
      start_ms,
      end_ms,
    };

    buffer.push(asrNode);
    app.log.info({ buffer_size: buffer.size, text, is_final: type === 'FINAL' }, '📥 Pushed to RingBuffer');

    const patch = await scheduler.handleASRChunk(asrNode);

    if (patch) {
      app.log.info({ action: patch.action, new_text: patch.new_text }, '📤 Broadcasting subtitle patch');
      broadcast(clients, { type: 'subtitle_patch', payload: patch, timestamp: Date.now() });

      // 最终态触发 TTS
      if (type === 'FINAL' && apiKey && patch.new_text) {
        app.log.info({ text: patch.new_text }, '🔊 Triggering TTS');
        createQwenTTSSession({
          text: patch.new_text,
          apiKey,
          onAudioChunk: (chunk) => {
            broadcast(clients, {
              type: 'tts_audio',
              payload: { audio_chunk: chunk.toString('base64'), is_last: false },
              timestamp: Date.now(),
            });
          },
          onDone: () => {
            app.log.info('🔊 TTS done');
            broadcast(clients, {
              type: 'tts_audio',
              payload: { audio_chunk: '', is_last: true },
              timestamp: Date.now(),
            });
          },
          onError: (err) => {
            app.log.error(err, '🔊 TTS failed');
          },
        });
      }
    } else {
      app.log.debug({ text }, 'No patch from scheduler (waiting for more windows)');
    }
  }

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    app.log.info(`Client connected. Total: ${clients.size}`);

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // 处理 API Key 设置
        if (msg.type === 'set_api_key') {
          apiKey = msg.payload.apiKey;
          scheduler.setApiKey(apiKey);
          app.log.info({ key_prefix: apiKey.slice(0, 8) + '...' }, '🔑 API Key updated');
          return;
        }

        // 处理语音识别文本（麦克风模式 - Web Speech API）
        if (msg.type === 'asr_text') {
          await handleASREvent({
            type: msg.payload.is_final ? 'FINAL' : 'CHUNK',
            window_id: windowId++,
            text: msg.payload.text,
            start_ms: (windowId - 1) * WINDOW_MS,
            end_ms: windowId * WINDOW_MS,
          });
        }

        // 处理音频切片（标签页模式 - 送入 Qwen ASR）
        if (isAudioChunk(msg)) {
          const { window_id, pcm_data } = msg.payload;
          const bytes = pcm_data ? Buffer.from(pcm_data, 'base64').length : 0;

          // 每 10 个 chunk 打印一次，减少日志量
          if (window_id % 10 === 0) {
            app.log.info({ window_id, pcm_bytes: bytes, hasApiKey: !!apiKey, hasSession: !!asrSession }, '🎵 Audio chunk');
          }

          // 无 API Key 时用 Mock ASR 降级
          if (!apiKey) {
            if (window_id % 10 === 0) {
              app.log.info({ window_id }, '⚠️ No API Key, using Mock ASR');
            }
            const mockText = MOCK_SCRIPT[window_id % MOCK_SCRIPT.length];
            await handleASREvent({
              type: window_id % MOCK_SCRIPT.length === MOCK_SCRIPT.length - 1 ? 'FINAL' : 'CHUNK',
              window_id,
              text: mockText,
              start_ms: window_id * WINDOW_MS,
              end_ms: (window_id + 1) * WINDOW_MS,
            });
            return;
          }

          // 首次收到音频时创建 ASR 会话
          if (!asrSession) {
            app.log.info('🔗 Creating ASR session...');
            try {
              asrSession = createQwenASRSession({
                apiKey,
                onEvent: (event) => {
                  handleASREvent(event).catch((err) => {
                    app.log.error(err, 'Failed to handle ASR event');
                  });
                },
              });
              app.log.info('✅ ASR session created');
            } catch (err) {
              app.log.error(err, '❌ Failed to create ASR session, falling back to mock');
              const mockText = MOCK_SCRIPT[window_id % MOCK_SCRIPT.length];
              await handleASREvent({
                type: 'CHUNK',
                window_id,
                text: mockText,
                start_ms: window_id * WINDOW_MS,
                end_ms: (window_id + 1) * WINDOW_MS,
              });
              return;
            }
          }

          // 发送音频到 ASR
          if (pcm_data) {
            asrSession.sendAudio(pcm_data);
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to process WS message');
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      if (asrSession) {
        asrSession.close();
        asrSession = null;
      }
      app.log.info(`Client disconnected. Total: ${clients.size}`);
    });
  });
}

function broadcast(clients: Set<WebSocket>, message: unknown): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
