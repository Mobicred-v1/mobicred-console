import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import Redis from "ioredis";

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis;
  private prefix = "throttle:";

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: this.prefix,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `${throttlerName}:${key}`;

    // Check if blocked
    const blockedUntil = await this.redis.get(`blocked:${fullKey}`);
    if (blockedUntil) {
      const timeToBlockExpire = parseInt(blockedUntil) - Date.now();
      if (timeToBlockExpire > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire,
        };
      }
    }

    // Increment counter
    const multi = this.redis.multi();
    multi.incr(fullKey);
    multi.pttl(fullKey);

    const results = await multi.exec();
    const totalHits = results?.[0]?.[1] as number || 1;
    let timeToExpire = results?.[1]?.[1] as number || -1;

    // Set TTL if this is a new key
    if (timeToExpire === -1) {
      await this.redis.pexpire(fullKey, ttl);
      timeToExpire = ttl;
    }

    // Block if limit exceeded
    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit && blockDuration > 0) {
      const blockUntil = Date.now() + blockDuration;
      await this.redis.set(`blocked:${fullKey}`, blockUntil.toString(), "PX", blockDuration);
      isBlocked = true;
      timeToBlockExpire = blockDuration;
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key: string, throttlerName: string): Promise<{ hits: number; ttl: number } | null> {
    const fullKey = `${throttlerName}:${key}`;
    const [hits, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.pttl(fullKey),
    ]);

    if (!hits) return null;

    return {
      hits: parseInt(hits),
      ttl: Math.max(0, ttl),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, throttlerName: string): Promise<void> {
    const fullKey = `${throttlerName}:${key}`;
    await this.redis.del(fullKey, `blocked:${fullKey}`);
  }
}
