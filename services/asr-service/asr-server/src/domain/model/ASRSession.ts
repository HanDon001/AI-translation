/**
 * ASR 会话领域模型
 */
export interface ASRSession {
  sessionId: string;
  apiKey: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  status: 'initializing' | 'connecting' | 'ready' | 'processing' | 'closed';
  createdAt: Date;
  lastActiveAt: Date;
}
