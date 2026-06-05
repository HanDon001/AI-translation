import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { isAudioChunk } from '@realtime-interp/shared';
import { createQwenASRSession, type InternalASREvent } from '../services/QwenASRService.js';

// Mock 翻译剧本（无 API Key 降级用）— 模拟完整会议发言
const MOCK_SCRIPT = [
  'Good morning',
  'everyone,',
  'thank you for',
  'joining us today.',
  'We are excited',
  'to share our',
  'latest advancements',
  'in real-time translation.',
  'This technology',
  'uses large language',
  'models to deliver',
  'accurate results.',
  'Our system supports',
  'over fifty languages',
  'with latency under',
  'five hundred milliseconds.',
  'We believe this',
  'will transform how',
  'people communicate',
  'across language barriers.',
];

/**
 * 每个连接的独立状态
 */
interface ConnectionState {
  apiKey: string;
  asrSession: ReturnType<typeof createQwenASRSession> | null;
}

/**
 * WebSocket 消息路由处理
 * LiveTranslate 模型直接输出翻译结果，无需 Wait-K 和翻译中间步骤
 */
export function registerWsHandler(app: FastifyInstance): void {
  const clients = new Set<WebSocket>();
  const connectionStates = new Map<WebSocket, ConnectionState>();
  let windowId = 0;

  /** 处理翻译事件（直接广播给前端） */
  function handleTranslateEvent(event: InternalASREvent): void {
    const { type, text } = event;
    if (!text) return;

    const id = windowId++;
    const startMs = id * 400;
    const endMs = (id + 1) * 400;

    app.log.info({ type, text, id, clientCount: clients.size }, '🌐 Translate event');

    if (type === 'CHUNK') {
      const msg = {
        type: 'subtitle_patch',
        payload: {
          action: 'ADD_TEMP',
          target_range: [startMs, endMs],
          new_text: text,
          style: 'temp',
        },
        timestamp: Date.now(),
      };
      app.log.info({ action: 'ADD_TEMP', text, clients: clients.size }, '📤 Broadcasting to clients');
      broadcast(clients, msg);
    }

    if (type === 'FINAL') {
      const msg = {
        type: 'subtitle_patch',
        payload: {
          action: 'MARK_FINAL',
          target_range: [startMs, endMs],
          new_text: text,
          style: 'final',
        },
        timestamp: Date.now(),
      };
      app.log.info({ action: 'MARK_FINAL', text, clients: clients.size }, '📤 Broadcasting to clients');
      broadcast(clients, msg);
    }
  }

  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    const connState: ConnectionState = { apiKey: '', asrSession: null };
    connectionStates.set(socket, connState);
    app.log.info(`Client connected. Total: ${clients.size}`);

    socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // 添加日志：收到消息
        app.log.info({ type: msg.type }, '📨 Received message');

        // 处理 API Key 设置
        if (msg.type === 'set_api_key') {
          connState.apiKey = msg.payload.apiKey;
          app.log.info({ key_prefix: connState.apiKey.slice(0, 8) + '...' }, '🔑 API Key updated');
          return;
        }

        // 处理语音识别文本（麦克风模式 - Web Speech API）
        if (msg.type === 'asr_text') {
          handleTranslateEvent({
            type: msg.payload.is_final ? 'FINAL' : 'CHUNK',
            window_id: windowId++,
            text: msg.payload.text,
            start_ms: (windowId - 1) * 400,
            end_ms: windowId * 400,
          });
        }

        // 处理音频切片（标签页模式 - 送入 LiveTranslate）
        if (isAudioChunk(msg)) {
          const { window_id, pcm_data } = msg.payload;

          app.log.info({ window_id, hasApiKey: !!connState.apiKey, hasSession: !!connState.asrSession, hasPcmData: !!pcm_data }, '🎵 Audio chunk received');

          if (window_id % 10 === 0) {
            app.log.info({ window_id, hasApiKey: !!connState.apiKey, hasSession: !!connState.asrSession }, '🎵 Audio chunk');
          }

          // 无 API Key 时用 Mock 降级
          if (!connState.apiKey) {
            if (window_id % 10 === 0) {
              app.log.info({ window_id }, '⚠️ No API Key, using Mock');
            }
            const idx = window_id % MOCK_SCRIPT.length;
            // 每4个chunk标一个FINAL（模拟句子边界），最后一个也标FINAL
            const isFinal = (idx > 0 && idx % 4 === 0) || idx === MOCK_SCRIPT.length - 1;
            handleTranslateEvent({
              type: isFinal ? 'FINAL' : 'CHUNK',
              window_id,
              text: MOCK_SCRIPT[idx],
              start_ms: window_id * 400,
              end_ms: (window_id + 1) * 400,
            });
            return;
          }

          // 首次收到音频时创建 LiveTranslate 会话
          if (!connState.asrSession) {
            app.log.info('🔗 Creating LiveTranslate session...');
            try {
              connState.asrSession = createQwenASRSession({
                apiKey: connState.apiKey,
                targetLang: 'zh',
                onEvent: handleTranslateEvent,
              });
              app.log.info('✅ LiveTranslate session created');
            } catch (err) {
              app.log.error(err, '❌ LiveTranslate session failed, using mock');
              const idx = window_id % MOCK_SCRIPT.length;
              handleTranslateEvent({
                type: idx % 4 === 0 ? 'CHUNK' : 'CHUNK',
                window_id,
                text: MOCK_SCRIPT[idx],
                start_ms: window_id * 400,
                end_ms: (window_id + 1) * 400,
              });
              return;
            }
          }

          // 发送音频到 LiveTranslate
          if (pcm_data) {
            app.log.info({ window_id, dataLength: pcm_data.length }, '📤 Sending audio to LiveTranslate');
            connState.asrSession.sendAudio(pcm_data);
          } else {
            app.log.warn({ window_id }, '⚠️ No pcm_data in audio chunk');
          }
        }
      } catch (err) {
        app.log.error(err, 'Failed to process WS message');
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
      if (connState.asrSession) {
        connState.asrSession.close();
        connState.asrSession = null;
      }
      connectionStates.delete(socket);
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
