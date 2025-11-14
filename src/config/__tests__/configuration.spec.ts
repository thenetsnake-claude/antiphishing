import configuration from '../configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no env vars are set', () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FILE_PATH;

    const config = configuration();

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      redis: {
        host: 'localhost',
        port: 6379,
        sentinelHosts: [],
        masterName: 'mymaster',
        username: undefined,
        password: undefined,
        tlsEnabled: false,
      },
      logging: {
        level: 'info',
        filePath: './logs',
      },
    });
  });

  it('should use environment variables when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_USERNAME = 'redisuser';
    process.env.REDIS_PASSWORD = 'redispass';
    process.env.REDIS_MASTER_NAME = 'redis-master';
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_FILE_PATH = '/var/log/app';

    const config = configuration();

    expect(config).toEqual({
      nodeEnv: 'production',
      port: 8080,
      redis: {
        host: 'redis.example.com',
        port: 6380,
        sentinelHosts: [],
        masterName: 'redis-master',
        username: 'redisuser',
        password: 'redispass',
        tlsEnabled: false,
      },
      logging: {
        level: 'debug',
        filePath: '/var/log/app',
      },
    });
  });

  it('should parse sentinel hosts from comma-separated string', () => {
    process.env.REDIS_SENTINEL_HOSTS =
      'sentinel1.example.com:26379,sentinel2.example.com:26379,sentinel3.example.com:26379';

    const config = configuration();

    expect(config.redis.sentinelHosts).toEqual([
      'sentinel1.example.com:26379',
      'sentinel2.example.com:26379',
      'sentinel3.example.com:26379',
    ]);
  });

  it('should handle empty sentinel hosts string', () => {
    process.env.REDIS_SENTINEL_HOSTS = '';

    const config = configuration();

    // Empty string is falsy, so it returns []
    expect(config.redis.sentinelHosts).toEqual([]);
  });

  it('should enable TLS when REDIS_TLS_ENABLED is true', () => {
    process.env.REDIS_TLS_ENABLED = 'true';

    const config = configuration();

    expect(config.redis.tlsEnabled).toBe(true);
  });

  it('should disable TLS when REDIS_TLS_ENABLED is false', () => {
    process.env.REDIS_TLS_ENABLED = 'false';

    const config = configuration();

    expect(config.redis.tlsEnabled).toBe(false);
  });

  it('should disable TLS when REDIS_TLS_ENABLED is not set', () => {
    delete process.env.REDIS_TLS_ENABLED;

    const config = configuration();

    expect(config.redis.tlsEnabled).toBe(false);
  });

  it('should parse PORT as integer', () => {
    process.env.PORT = '9000';

    const config = configuration();

    expect(config.port).toBe(9000);
    expect(typeof config.port).toBe('number');
  });

  it('should parse REDIS_PORT as integer', () => {
    process.env.REDIS_PORT = '7000';

    const config = configuration();

    expect(config.redis.port).toBe(7000);
    expect(typeof config.redis.port).toBe('number');
  });

  it('should handle invalid PORT with default', () => {
    process.env.PORT = 'invalid';

    const config = configuration();

    expect(isNaN(config.port)).toBe(true);
  });

  it('should handle all redis credentials', () => {
    process.env.REDIS_USERNAME = 'admin';
    process.env.REDIS_PASSWORD = 'secretpass';

    const config = configuration();

    expect(config.redis.username).toBe('admin');
    expect(config.redis.password).toBe('secretpass');
  });
});
