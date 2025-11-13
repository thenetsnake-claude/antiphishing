# Redis Configuration and Caching Strategy

## Overview

This document explains the Redis caching implementation, Sentinel configuration, and caching strategies used in the Antiphishing API.

## Why Redis?

- **High Performance**: In-memory data store with sub-millisecond latency
- **High Availability**: Sentinel provides automatic failover
- **Scalability**: Can handle millions of operations per second
- **Persistence**: Optional data persistence for recovery
- **TLS Support**: Secure connections for production

## Cache Strategy

### Cache Key Generation

Cache keys are generated using MD5 hash of the content field:

```typescript
import * as crypto from 'crypto';

function generateCacheKey(content: string): string {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
}
```

**Why MD5?**
- Fast hashing algorithm
- Consistent 32-character output
- Sufficient for cache key generation (not used for security)
- Handles any content size efficiently

**Example**:
```typescript
Input: "Hello, this is a test message"
Cache Key: "5d41402abc4b2a76b9719d911017c592"
```

### Cache TTL (Time To Live)

- **Duration**: 60 seconds
- **Rationale**:
  - Balance between freshness and performance
  - Reduces duplicate analysis within short timeframe
  - Prevents stale data from persisting too long

### Cache Value Structure

Cached data is stored as JSON string:

```json
{
  "language": "eng",
  "lang_certainity": 95.5,
  "risk_level": 0,
  "triggers": [],
  "enhanced": {
    "keyword_density": 0,
    ...
  }
}
```

### Cache Flow

```
┌─────────────────────┐
│  Request Received   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Generate Cache Key  │
│  (MD5 of content)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Check Redis       │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
Cache Hit    Cache Miss
     │           │
     ▼           ▼
┌─────────┐  ┌──────────────┐
│ Return  │  │ Analyze      │
│ Cached  │  │ Content      │
│ Result  │  │              │
└─────────┘  └──────┬───────┘
                    │
                    ▼
             ┌──────────────┐
             │ Store in     │
             │ Redis        │
             │ (TTL: 60s)   │
             └──────┬───────┘
                    │
                    ▼
             ┌──────────────┐
             │ Return       │
             │ Result       │
             └──────────────┘
```

## Development Environment

### Local Redis Setup

**Using Docker**:
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Using Docker Compose**:
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

### Configuration

**.env**:
```env
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS_ENABLED=false
```

### Testing Redis Connection

```bash
# Using redis-cli
docker exec -it redis redis-cli ping
# Expected: PONG

# Set a value
docker exec -it redis redis-cli SET test "hello"

# Get a value
docker exec -it redis redis-cli GET test
# Expected: "hello"

# Check TTL
docker exec -it redis redis-cli TTL test
```

## Production Environment

### Redis Sentinel Architecture

```
                ┌──────────────┐
                │  Application │
                └───────┬──────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Sentinel 1  │ │  Sentinel 2  │ │  Sentinel 3  │
│   :26379     │ │   :26379     │ │   :26379     │
└───────┬──────┘ └───────┬──────┘ └───────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│Redis Master  │ │Redis Replica │ │Redis Replica │
│   :6379      │ │   :6379      │ │   :6379      │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Sentinel Configuration

**.env (Production)**:
```env
NODE_ENV=production
REDIS_SENTINEL_HOSTS=sentinel-1.redis.svc.cluster.local:26379,sentinel-2.redis.svc.cluster.local:26379,sentinel-3.redis.svc.cluster.local:26379
REDIS_MASTER_NAME=mymaster
REDIS_USERNAME=antiphishing-api
REDIS_PASSWORD=<secure-password>
REDIS_TLS_ENABLED=true
```

### Connection Code

```typescript
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export class CacheService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const nodeEnv = this.configService.get('NODE_ENV');

    if (nodeEnv === 'production') {
      // Production: Use Sentinel
      const sentinelHosts = this.configService
        .get('REDIS_SENTINEL_HOSTS')
        .split(',')
        .map((host) => {
          const [hostname, port] = host.split(':');
          return { host: hostname, port: parseInt(port, 10) };
        });

      this.redis = new Redis({
        sentinels: sentinelHosts,
        name: this.configService.get('REDIS_MASTER_NAME'),
        username: this.configService.get('REDIS_USERNAME'),
        password: this.configService.get('REDIS_PASSWORD'),
        tls: this.configService.get('REDIS_TLS_ENABLED') === 'true' ? {} : undefined,
        sentinelRetryStrategy: (times) => {
          return Math.min(times * 50, 2000);
        },
      });
    } else {
      // Development: Direct connection
      this.redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
      });
    }

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }
}
```

## Sentinel Features

### Automatic Failover

When master fails:
1. Sentinels detect master is down (quorum)
2. Sentinels elect new master from replicas
3. Other replicas reconfigured to replicate from new master
4. Application automatically reconnects to new master

### Monitoring

Sentinels continuously monitor:
- Master availability
- Replica availability
- Replication lag
- Configuration changes

### Configuration Discovery

Application doesn't need to know master address:
- Connects to sentinels
- Sentinels provide current master address
- Automatic reconnection on failover

## Error Handling and Graceful Degradation

### Connection Errors

```typescript
async get(key: string): Promise<any | null> {
  try {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    this.logger.warn('Redis GET error, continuing without cache', {
      error: error.message,
    });
    return null; // Graceful fallback
  }
}

async set(key: string, value: any, ttl: number): Promise<void> {
  try {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    this.logger.warn('Redis SET error, continuing without cache', {
      error: error.message,
    });
    // Don't throw - allow request to proceed
  }
}
```

### Retry Strategy

```typescript
const redis = new Redis({
  sentinels: [...],
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false, // Fail fast
});
```

## Cache Performance Metrics

### Expected Performance

| Scenario | Expected Time |
|----------|--------------|
| Cache Hit | 1-5ms |
| Cache Miss | 20-50ms (with analysis) |
| Cache Write | 1-3ms |
| Redis Down | 20-50ms (analysis only, no cache) |

### Cache Hit Rate

**Calculation**:
```
Cache Hit Rate = (Cache Hits / Total Requests) × 100%
```

**Expected Rate**:
- 20-40% for diverse content
- 60-80% for duplicate/similar content

## Cache Operations

### Basic Operations

**Set with TTL**:
```bash
# Set value with 60 second TTL
SET key value EX 60
```

**Get value**:
```bash
GET key
```

**Check TTL**:
```bash
TTL key
# Returns remaining seconds, or -2 if key doesn't exist
```

**Delete key**:
```bash
DEL key
```

### Monitoring Commands

**Check memory usage**:
```bash
INFO memory
```

**Check connected clients**:
```bash
CLIENT LIST
```

**Monitor real-time commands**:
```bash
MONITOR
```

**Get statistics**:
```bash
INFO stats
```

**Check keyspace**:
```bash
INFO keyspace
```

## Cache Invalidation

### Current Strategy

- **TTL-based**: Keys automatically expire after 60 seconds
- **No manual invalidation**: Not needed for analysis results

### Future Enhancements

If manual invalidation needed:

```typescript
async invalidate(content: string): Promise<void> {
  const key = this.generateCacheKey(content);
  await this.redis.del(key);
}

async invalidatePattern(pattern: string): Promise<void> {
  const keys = await this.redis.keys(pattern);
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}

async clearAll(): Promise<void> {
  await this.redis.flushdb();
}
```

## Security

### TLS Configuration

**Enable TLS in production**:
```typescript
const redis = new Redis({
  sentinels: [...],
  tls: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.crt'),
    cert: fs.readFileSync('/path/to/client.crt'),
    key: fs.readFileSync('/path/to/client.key'),
  },
});
```

### Authentication

**Username/Password**:
```typescript
const redis = new Redis({
  sentinels: [...],
  username: 'antiphishing-api',
  password: 'secure-password',
});
```

### Network Security

- Use private network for Redis communication
- Configure firewall rules
- Use Kubernetes network policies
- Enable Redis `protected-mode`

## Troubleshooting

### Connection Issues

**Check connectivity**:
```bash
# Test sentinel
redis-cli -h sentinel-host -p 26379 ping

# Get master info
redis-cli -h sentinel-host -p 26379 SENTINEL get-master-addr-by-name mymaster

# Test master directly
redis-cli -h master-host -p 6379 ping
```

**Check logs**:
```bash
# Application logs
kubectl logs -n antiphishing <pod-name> | grep -i redis

# Redis logs
kubectl logs -n redis <redis-pod-name>
```

### High Memory Usage

**Check memory**:
```bash
redis-cli INFO memory
```

**Solutions**:
- Reduce TTL
- Implement eviction policy
- Monitor key count
- Check for memory leaks

**Set eviction policy**:
```bash
CONFIG SET maxmemory-policy allkeys-lru
```

### Slow Performance

**Check slow log**:
```bash
SLOWLOG GET 10
```

**Solutions**:
- Check network latency
- Monitor CPU usage
- Check for blocking operations
- Review key patterns

### Sentinel Issues

**Check sentinel status**:
```bash
redis-cli -h sentinel-host -p 26379 SENTINEL masters
redis-cli -h sentinel-host -p 26379 SENTINEL replicas mymaster
redis-cli -h sentinel-host -p 26379 SENTINEL sentinels mymaster
```

**Manual failover** (testing only):
```bash
redis-cli -h sentinel-host -p 26379 SENTINEL failover mymaster
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Connection Status**
   - Connected clients
   - Failed connections
   - Connection errors

2. **Performance**
   - Operations per second
   - Hit rate
   - Miss rate
   - Average latency

3. **Memory**
   - Used memory
   - Memory fragmentation
   - Evicted keys

4. **Replication**
   - Replication lag
   - Connected replicas
   - Sync status

### Health Check

```typescript
async healthCheck(): Promise<boolean> {
  try {
    const result = await this.redis.ping();
    return result === 'PONG';
  } catch (error) {
    this.logger.error('Redis health check failed', error);
    return false;
  }
}
```

## Best Practices

### Do's ✅

- Use connection pooling
- Implement retry logic
- Handle errors gracefully
- Monitor cache hit rate
- Use appropriate TTL
- Enable persistence in production
- Use TLS for production
- Implement health checks

### Don'ts ❌

- Don't store sensitive data without encryption
- Don't use Redis as primary data store
- Don't ignore connection errors
- Don't use very short TTLs (< 10s)
- Don't store very large values (> 1MB)
- Don't block the event loop with synchronous operations

## Cache Optimization

### Key Size

- Current: 32 bytes (MD5 hash)
- Optimal: Keep keys short but descriptive

### Value Size

- Current: ~500 bytes (JSON response)
- Optimal: Keep values under 10KB

### Connection Pooling

```typescript
const redis = new Redis({
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  lazyConnect: false,
});
```

## Testing

### Mock Redis for Tests

```typescript
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});
```

### Integration Tests with Real Redis

```typescript
describe('CacheService Integration', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: 'localhost',
      port: 6379,
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  it('should cache and retrieve value', async () => {
    const key = 'test-key';
    const value = { data: 'test' };

    await redis.setex(key, 60, JSON.stringify(value));
    const retrieved = await redis.get(key);

    expect(JSON.parse(retrieved)).toEqual(value);
  });
});
```

## Maintenance

### Regular Tasks

**Daily**:
- Monitor memory usage
- Check error logs
- Review performance metrics

**Weekly**:
- Review cache hit rates
- Check for unusual patterns
- Verify sentinel health

**Monthly**:
- Update Redis version (if needed)
- Review and optimize configuration
- Conduct failover testing

### Backup Strategy

Redis data is cache only (not persistent data):
- No backup needed for cache
- Data regenerates on cache miss
- Consider persistence for debugging

If persistence enabled:
```bash
# RDB snapshot
SAVE

# AOF persistence
BGREWRITEAOF
```

## References

- [Redis Documentation](https://redis.io/documentation)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Redis Best Practices](https://redis.io/topics/admin)
- [Redis Security](https://redis.io/topics/security)
