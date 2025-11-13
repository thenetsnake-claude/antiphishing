import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { generateHash } from '../common/utils/hash.util';

/**
 * Cache service with Redis and Sentinel support
 * Provides graceful fallback when Redis is unavailable
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Redis connection on module start
   */
  async onModuleInit() {
    try {
      await this.initializeRedis();
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`, error.stack);
      this.isConnected = false;
    }
  }

  /**
   * Close Redis connection on module destroy
   */
  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Initialize Redis connection based on environment
   */
  private async initializeRedis() {
    const nodeEnv = this.configService.get<string>('nodeEnv');
    const sentinelHosts = this.configService.get<string[]>('redis.sentinelHosts');

    // Production: Use Sentinel
    if (nodeEnv === 'production' && sentinelHosts && sentinelHosts.length > 0) {
      this.logger.log('Initializing Redis with Sentinel configuration');
      await this.initializeSentinel(sentinelHosts);
    } else {
      // Development: Direct connection
      this.logger.log('Initializing Redis with direct connection');
      await this.initializeDirect();
    }

    this.setupEventHandlers();
  }

  /**
   * Initialize Redis with Sentinel
   */
  private async initializeSentinel(sentinelHosts: string[]) {
    const sentinels = sentinelHosts.map((host) => {
      const [hostname, port] = host.split(':');
      return { host: hostname, port: parseInt(port, 10) };
    });

    const tlsEnabled = this.configService.get<boolean>('redis.tlsEnabled');
    const masterName = this.configService.get<string>('redis.masterName');
    const username = this.configService.get<string>('redis.username');
    const password = this.configService.get<string>('redis.password');

    this.redis = new Redis({
      sentinels,
      name: masterName,
      username,
      password,
      tls: tlsEnabled ? {} : undefined,
      sentinelRetryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.debug(`Sentinel retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.debug(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  /**
   * Initialize Redis with direct connection
   */
  private async initializeDirect() {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');

    this.redis = new Redis({
      host,
      port,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.debug(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers() {
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  /**
   * Get value from cache
   * @param content - Content to use as cache key
   * @returns Cached value or null
   */
  async get<T>(content: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      return null;
    }

    try {
      const key = generateHash(content);
      const value = await this.redis.get(key);

      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(value) as T;
      }

      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param content - Content to use as cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set(content: string, value: unknown, ttl: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      const key = generateHash(content);
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.logger.debug(`Cached value for key: ${key} with TTL: ${ttl}s`);
    } catch (error) {
      this.logger.warn(`Cache set error: ${error.message}`, error.stack);
      // Don't throw - allow operation to continue without cache
    }
  }

  /**
   * Delete value from cache
   * @param content - Content to use as cache key
   */
  async delete(content: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache delete');
      return;
    }

    try {
      const key = generateHash(content);
      await this.redis.del(key);
      this.logger.debug(`Deleted cache key: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache delete error: ${error.message}`, error.stack);
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return false;
    }
  }
}
