import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';

// Mock ioredis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  ping: jest.fn(),
  on: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CacheService', () => {
  let service: CacheService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, unknown> = {
        nodeEnv: 'development',
        'redis.host': 'localhost',
        'redis.port': 6379,
        'redis.sentinelHosts': [],
        'redis.masterName': 'mymaster',
        'redis.username': 'user',
        'redis.password': 'pass',
        'redis.tlsEnabled': false,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.ping.mockResolvedValue('PONG');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);

    // Initialize the service
    await service.onModuleInit();

    // Simulate connected state
    const connectHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'connect');
    if (connectHandler) {
      connectHandler[1]();
    }
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return cached value if exists', async () => {
      const content = 'test content';
      const cachedValue = { language: 'eng', confidence: 95 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await service.get(content);

      expect(result).toEqual(cachedValue);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('should return null if cache miss', async () => {
      const content = 'test content';
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(content);

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
    });

    it('should return null on Redis error', async () => {
      const content = 'test content';
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get(content);

      expect(result).toBeNull();
    });

    it('should generate consistent cache keys for same content', async () => {
      const content = 'test content';
      mockRedis.get.mockResolvedValue(null);

      await service.get(content);
      await service.get(content);

      expect(mockRedis.get).toHaveBeenCalledTimes(2);
      const firstCallKey = mockRedis.get.mock.calls[0][0];
      const secondCallKey = mockRedis.get.mock.calls[1][0];
      expect(firstCallKey).toBe(secondCallKey);
    });

    it('should generate different cache keys for different content', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.get('content 1');
      await service.get('content 2');

      expect(mockRedis.get).toHaveBeenCalledTimes(2);
      const firstCallKey = mockRedis.get.mock.calls[0][0];
      const secondCallKey = mockRedis.get.mock.calls[1][0];
      expect(firstCallKey).not.toBe(secondCallKey);
    });
  });

  describe('set', () => {
    it('should cache value with TTL', async () => {
      const content = 'test content';
      const value = { language: 'eng', confidence: 95 };
      const ttl = 60;

      await service.set(content, value, ttl);

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(expect.any(String), ttl, JSON.stringify(value));
    });

    it('should not throw error on Redis failure', async () => {
      const content = 'test content';
      const value = { language: 'eng' };
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(service.set(content, value, 60)).resolves.not.toThrow();
    });

    it('should serialize value to JSON', async () => {
      const content = 'test content';
      const value = { language: 'eng', nested: { data: 'test' } };
      const ttl = 60;

      await service.set(content, value, ttl);

      const cachedValue = mockRedis.setex.mock.calls[0][2];
      expect(cachedValue).toBe(JSON.stringify(value));
    });
  });

  describe('delete', () => {
    it('should delete cached value', async () => {
      const content = 'test content';

      await service.delete(content);

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith(expect.any(String));
    });

    it('should not throw error on Redis failure', async () => {
      const content = 'test content';
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.delete(content)).resolves.not.toThrow();
    });
  });

  describe('isHealthy', () => {
    it('should return true when Redis is healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.isHealthy();

      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalledTimes(1);
    });

    it('should return false when Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      // Simulate disconnected state
      const errorHandler = mockRedis.on.mock.calls.find((call) => call[0] === 'error');
      if (errorHandler) {
        errorHandler[1](new Error('Connection lost'));
      }

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });
});
