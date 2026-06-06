import { QwenASRDomainService } from '../../domain/service/QwenASRDomainService.js';
import { DashScopeWSClient } from '../../infrastructure/external/DashScopeWSClient.js';
import type { ASRSession } from '../../domain/model/ASRSession.js';

/**
 * ASR 应用服务
 */
export class ASRApplicationService {
  private domainService = new QwenASRDomainService();
  private sessions = new Map<string, { session: ASRSession; client: DashScopeWSClient }>();

  async createSession(apiKey: string, targetLang: string, model: string): Promise<string> {
    const session = this.domainService.createSession(apiKey, targetLang, model);
    const client = new DashScopeWSClient();

    await client.connect(apiKey, model);
    this.sessions.set(session.sessionId, { session, client });

    return session.sessionId;
  }

  sendAudio(sessionId: string, pcmBase64: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.client.sendAudio(pcmBase64);
    }
  }

  closeSession(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.client.close();
      this.sessions.delete(sessionId);
    }
  }
}
