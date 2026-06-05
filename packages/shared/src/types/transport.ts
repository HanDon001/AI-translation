import type { AudioChunkEvent, ASRChunkEvent, ASRCorrectEvent, VADSilenceEvent } from './events.js';
import type { SubtitlePatchPayload } from './subtitle.js';

/**
 * WebSocket 消息信封
 * 统一包装所有通信消息
 */
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  /** 毫秒级时间戳，用于时间轴对齐 */
  timestamp: number;
}

/** Gateway -> Browser 字幕更新消息 */
export type SubtitlePatchMessage = WsMessage<SubtitlePatchPayload>;

/** 心跳包 */
export interface HeartbeatPayload {
  ping: boolean;
}

/** 错误消息 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/** 所有可能的入站消息类型联合 */
export type InboundMessage =
  | WsMessage<AudioChunkEvent['payload']>
  | WsMessage<ASRChunkEvent['payload']>
  | WsMessage<ASRCorrectEvent['payload']>
  | WsMessage<VADSilenceEvent['payload']>
  | WsMessage<HeartbeatPayload>
  | WsMessage<ErrorPayload>;

/** 所有可能的出站消息类型联合 */
export type OutboundMessage =
  | SubtitlePatchMessage
  | WsMessage<ErrorPayload>
  | WsMessage<HeartbeatPayload>;
