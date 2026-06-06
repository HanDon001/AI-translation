import type { ASRSession } from '../model/ASRSession.js';

/**
 * Qwen ASR 领域服务
 */
export class QwenASRDomainService {
  createSession(apiKey: string, targetLang: string, model: string): ASRSession {
    return {
      sessionId: crypto.randomUUID(),
      apiKey,
      sourceLang: 'auto',
      targetLang,
      model,
      status: 'initializing',
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
  }

  updateStatus(session: ASRSession, status: ASRSession['status']): ASRSession {
    return { ...session, status, lastActiveAt: new Date() };
  }
}
