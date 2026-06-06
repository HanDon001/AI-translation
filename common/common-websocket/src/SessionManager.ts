import type { WebSocket } from 'ws';

/**
 * WebSocket 连接池管理
 */
export class SessionManager {
  private sessions = new Map<string, WebSocket>();

  add(id: string, ws: WebSocket): void {
    this.sessions.set(id, ws);
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  get(id: string): WebSocket | undefined {
    return this.sessions.get(id);
  }

  broadcast(message: string): void {
    for (const ws of this.sessions.values()) {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  }

  size(): number {
    return this.sessions.size;
  }
}
