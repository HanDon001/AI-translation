import Redis from 'ioredis';

/**
 * 会话状态缓存
 */
export class SessionCache {
  private redis: Redis;

  constructor(url: string = 'redis://localhost:6379') {
    this.redis = new Redis(url);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, data);
    } else {
      await this.redis.set(key, data);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
