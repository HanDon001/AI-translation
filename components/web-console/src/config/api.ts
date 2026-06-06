/**
 * API 端点配置
 * 所有 URL 集中管理，便于切换环境
 */

const GATEWAY_HOST = 'localhost:3000';
const DESKTOP_LYRICS_HOST = '127.0.0.1:8765';

export const API_ENDPOINTS = {
  /** 网关 WebSocket */
  GATEWAY_WS: `ws://${GATEWAY_HOST}/ws`,

  /** 网关 REST 翻译接口 */
  TRANSLATE: `http://${GATEWAY_HOST}/api/translate`,

  /** 桌面字幕 HTTP 控制接口 */
  DESKTOP_LYRICS: `http://${DESKTOP_LYRICS_HOST}`,

  /** MyMemory 翻译（备用，前端不应直接调用） */
  MYMEMORY: 'https://api.mymemory.translated.net/get',
} as const;
