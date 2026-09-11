import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, val: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** 清除全部以 prefix 开头的键 */
  delPrefix(prefix: string): Promise<void>;
  mode: 'redis' | 'memory';
}

class MemoryBackend implements CacheBackend {
  mode = 'memory' as const;
  private store = new Map<string, { val: string; expireAt: number }>();

  async get(key: string) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expireAt && item.expireAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.val;
  }

  async set(key: string, val: string, ttlSeconds?: number) {
    this.store.set(key, {
      val,
      expireAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
  }

  async del(key: string) {
    this.store.delete(key);
  }

  async delPrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

@Injectable()
export class CacheService implements OnModuleInit {
  private backend: CacheBackend = new MemoryBackend();
  private redis: Redis | null = null;
  private readonly logger = new Logger('CacheService');

  async onModuleInit() {
    if (process.env.OFFLINE === '1') {
      this.logger.warn('OFFLINE=1，使用内存缓存（未连接 Redis）');
      return;
    }
    await this.connectRedis(0);
  }

  private connectRedis(attempt: number) {
    return new Promise<void>((resolve) => {
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = Number(process.env.REDIS_PORT || 6379);
      const redis = new Redis({
        host,
        port,
        lazyConnect: true,
        retryStrategy: () => null, // 不重连，快速降级
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      const timer = setTimeout(() => {
        redis.disconnect();
        this.logger.warn(`Redis 连接超时，降级为内存缓存（${host}:${port}）`);
        resolve();
      }, 1500);

      redis
        .connect()
        .then(() => {
          clearTimeout(timer);
          this.redis = redis;
          this.backend = {
            mode: 'redis',
            get: (k) => redis.get(k),
            set: async (k, v, ttl) => {
              if (ttl) await redis.set(k, v, 'EX', ttl);
              else await redis.set(k, v);
            },
            del: async (k) => {
              await redis.del(k);
            },
            delPrefix: async (prefix) => {
              const keys = await redis.keys(`${prefix}*`);
              if (keys.length) await redis.del(...keys);
            },
          };
          this.logger.log(`已连接 Redis ${host}:${port}`);
          resolve();
        })
        .catch(() => {
          clearTimeout(timer);
          redis.disconnect();
          if (attempt === 0) {
            this.logger.warn(`Redis 不可用（${host}:${port}），降级为内存缓存`);
          }
          resolve();
        });
    });
  }

  get mode() {
    return this.backend.mode;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.backend.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 300) {
    await this.backend.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string) {
    await this.backend.del(key);
  }

  async delPrefix(prefix: string) {
    await this.backend.delPrefix(prefix);
  }
}
