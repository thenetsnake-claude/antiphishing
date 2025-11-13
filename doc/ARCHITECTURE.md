# Architecture Documentation

## Overview

The Antiphishing API is built using NestJS framework with a modular, scalable architecture designed for production deployment on Kubernetes with Redis caching support.

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 22
- **Framework**: NestJS (Latest stable)
- **Language**: TypeScript
- **Cache**: Redis with Sentinel support
- **Language Detection**: franc library
- **Testing**: Jest
- **Logging**: Winston with daily rotation

### Key Dependencies
- `@nestjs/common` - Core NestJS functionality
- `@nestjs/config` - Environment configuration
- `@nestjs/terminus` - Health checks
- `ioredis` - Redis client with Sentinel support
- `franc` - Language detection
- `class-validator` - Request validation
- `class-transformer` - DTO transformation
- `winston` - Structured logging
- `winston-daily-rotate-file` - Log rotation

## System Architecture

### High-Level Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP POST /analyze
       ▼
┌─────────────────────────────────────┐
│         NestJS API Gateway          │
│  ┌───────────────────────────────┐  │
│  │   Global Validation Pipeline  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Processing Time Interceptor  │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │    Logging Interceptor        │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│      Analyze Controller              │
│  - Request validation                │
│  - Response mapping                  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│       Analyze Service                │
│  - Orchestrates analysis             │
│  - Cache check                       │
│  - Language detection                │
│  - Response building                 │
└──────┬─────────────────┬─────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Cache      │  │  Language    │
│   Service    │  │  Service     │
│              │  │              │
│ - Redis ops  │  │ - franc lib  │
│ - Sentinel   │  │ - Confidence │
│ - Fallback   │  │ - Mapping    │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌──────────────────┐
│  Redis Cluster   │
│  with Sentinel   │
└──────────────────┘
```

### Module Structure

```
AppModule (Root)
├── ConfigModule (Global)
├── AnalyzeModule
│   ├── AnalyzeController
│   ├── AnalyzeService
│   ├── LanguageService
│   └── CacheService
└── HealthModule
    └── HealthController
```

## Core Components

### 1. Analyze Module

**Purpose**: Handles content analysis requests and orchestrates the analysis workflow.

**Components**:
- **AnalyzeController**: Exposes `/analyze` endpoint, handles HTTP layer
- **AnalyzeService**: Business logic orchestration
- **DTOs**: Request/response validation and transformation

**Responsibilities**:
- Validate incoming requests
- Check cache for existing results
- Perform language detection
- Build response structure
- Cache results
- Track processing time

### 2. Language Service

**Purpose**: Provides language detection capabilities using franc library.

**Features**:
- Detects language from text content
- Returns language code and confidence score
- Handles detection failures gracefully
- Maps franc language codes to ISO codes

**Language Mapping**:
- `eng` → English
- `fra` → French
- `nld` → Dutch
- `pol` → Polish
- `spa` → Spanish
- `unknown` → Detection failed or low confidence

### 3. Cache Service

**Purpose**: Manages Redis caching with Sentinel support and graceful degradation.

**Features**:
- MD5-based cache keys from content
- 60-second TTL
- Sentinel support for HA
- TLS support for production
- Graceful fallback when Redis unavailable
- Connection pooling

**Cache Strategy**:
```typescript
Cache Key = MD5(content)
Cache Value = Analysis Result (JSON)
TTL = 60 seconds
```

**Sentinel Configuration**:
- Multiple sentinel hosts for HA
- Automatic master discovery
- Failover support
- TLS encryption in production

### 4. Health Module

**Purpose**: Provides health check endpoints for monitoring and orchestration.

**Endpoints**:
- `/health` - Comprehensive health status
- `/health/readiness` - K8s readiness probe
- `/health/liveness` - K8s liveness probe

**Health Indicators**:
- Redis connection status
- Application status

## Data Flow

### Request Processing Flow

```
1. Client sends POST /analyze
   ↓
2. Global Validation Pipeline
   - Validates DTOs
   - Returns 400 if invalid
   ↓
3. Processing Time Interceptor starts timer
   ↓
4. AnalyzeController receives request
   ↓
5. AnalyzeService.analyze()
   ↓
6. Check Cache (CacheService.get())
   ├─ Cache Hit → Return cached result (cached: true)
   └─ Cache Miss → Continue
   ↓
7. Language Detection (LanguageService.detect())
   - Returns language + confidence
   ↓
8. Build Response
   - Populate analysis object
   - Set cached: false
   - Add placeholder values
   ↓
9. Cache Result (CacheService.set())
   - Store for 60 seconds
   - Ignore if Redis unavailable
   ↓
10. Processing Time Interceptor adds header
   ↓
11. Logging Interceptor logs request/response
   ↓
12. Return 200 with response body
```

### Cache Key Generation

```typescript
import * as crypto from 'crypto';

function generateCacheKey(content: string): string {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
}
```

## Configuration Management

### Environment-Based Configuration

The application uses `@nestjs/config` for environment-based configuration:

**Development (.env)**:
```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Production (K8s ConfigMap/Secrets)**:
```env
NODE_ENV=production
PORT=3000
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_MASTER_NAME=mymaster
REDIS_USERNAME=redisuser
REDIS_PASSWORD=<secret>
REDIS_TLS_ENABLED=true
```

### Configuration Schema

```typescript
interface AppConfig {
  nodeEnv: string;
  port: number;
  redis: {
    sentinelHosts?: string[];
    masterName?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    tlsEnabled: boolean;
  };
  logging: {
    level: string;
    filePath: string;
  };
}
```

## Logging Architecture

### Structured Logging

**Format**: JSON in production, pretty-print in development

**Log Levels**:
- `error` - Errors and exceptions
- `warn` - Warnings (e.g., Redis unavailable)
- `info` - General information
- `debug` - Detailed debugging

### Log Output

**Development**:
- Console output (colorized)
- Human-readable format

**Production**:
- JSON format to file
- Daily rotation (midnight)
- Retention: managed by volume
- Console output disabled

### Logged Data

**Request Logs**:
```json
{
  "timestamp": "2025-11-13T10:00:00.000Z",
  "level": "info",
  "message": "Incoming request",
  "context": {
    "method": "POST",
    "path": "/analyze",
    "parentID": "...",
    "customerID": "...",
    "senderID": "...",
    "messageID": "..."
  }
}
```

**Response Logs**:
```json
{
  "timestamp": "2025-11-13T10:00:00.123Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "statusCode": 200,
    "processingTime": 123,
    "cached": false,
    "language": "eng"
  }
}
```

**Privacy**: Content field is NEVER logged

## Error Handling

### Error Types

1. **Validation Errors (400)**:
   - Invalid UUIDs
   - Missing required fields
   - Content too long
   - Returns standard NestJS validation error format

2. **Server Errors (500)**:
   - Unexpected exceptions
   - Returns generic error message
   - Full details logged

### Error Response Format

```json
{
  "statusCode": 400,
  "message": ["field1 error", "field2 error"],
  "error": "Bad Request"
}
```

### Graceful Degradation

- **Redis Unavailable**: Continue without cache, log warning
- **Language Detection Fails**: Return "unknown" with 0% confidence
- **Processing Errors**: Return 500, log full details

## Security Considerations

### Current State
- No authentication/authorization
- Public endpoint
- Input validation only

### Future Enhancements
- API key authentication
- Rate limiting per customer
- IP whitelisting
- Request signing
- Audit logging

## Performance Considerations

### Caching Strategy
- Cache duration: 60 seconds
- Cache key: Content-based (deduplication)
- Cache hit = ~1-5ms response time
- Cache miss = ~20-50ms response time

### Language Detection
- franc library is fast (~1-10ms)
- No external API calls
- In-memory operation

### Scalability
- Stateless API (horizontal scaling)
- Redis for shared cache
- Health checks for orchestration
- Resource limits in K8s

## Deployment Architecture

### Development
```
┌──────────────────┐
│  Docker Compose  │
│  ┌────────────┐  │
│  │  NestJS    │  │
│  │  :3000     │  │
│  └────────────┘  │
│  ┌────────────┐  │
│  │  Redis     │  │
│  │  :6379     │  │
│  └────────────┘  │
└──────────────────┘
```

### Production (Kubernetes)
```
┌─────────────────────────────────────┐
│         Kubernetes Cluster          │
│  ┌───────────────────────────────┐  │
│  │     Ingress Controller        │  │
│  └───────────────┬───────────────┘  │
│                  │                   │
│  ┌───────────────▼───────────────┐  │
│  │  Antiphishing API Service     │  │
│  │  ┌─────────┐  ┌─────────┐    │  │
│  │  │  Pod 1  │  │  Pod 2  │ ...│  │
│  │  └─────────┘  └─────────┘    │  │
│  └───────────────────────────────┘  │
│                  │                   │
│  ┌───────────────▼───────────────┐  │
│  │     External Redis Cluster    │  │
│  │     (Sentinel HA Setup)       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Testing Strategy

### Test Pyramid

```
        ┌─────────┐
        │   E2E   │  (Integration tests)
        └─────────┘
      ┌─────────────┐
      │  Integration │  (Controller + Service)
      └─────────────┘
    ┌─────────────────┐
    │   Unit Tests    │  (Service logic)
    └─────────────────┘
```

### Test Coverage
- Target: 75%+ overall coverage
- Unit tests: All services, utilities
- Integration tests: Controllers, end-to-end flows
- Mocking: Redis, external dependencies

## Monitoring & Observability

### Health Checks
- Kubernetes liveness probe: `/health/liveness`
- Kubernetes readiness probe: `/health/readiness`
- General health: `/health`

### Metrics (Future)
- Request rate
- Processing time (p50, p95, p99)
- Cache hit rate
- Error rate
- Language detection distribution

### Logging
- Structured JSON logs
- Correlation IDs for tracing
- Error stack traces
- Performance metrics

## Design Decisions

### Why NestJS?
- Enterprise-ready framework
- Built-in dependency injection
- Excellent TypeScript support
- Modular architecture
- Strong ecosystem

### Why franc?
- Fast and lightweight
- No external API calls
- Good accuracy for common languages
- Simple integration

### Why Redis with Sentinel?
- High availability
- Automatic failover
- Proven at scale
- TLS support for security

### Why MD5 for Cache Keys?
- Fast hashing
- Consistent key length
- Sufficient for cache key generation
- No security implications (not for passwords)

### Why 60-Second Cache TTL?
- Balance between freshness and performance
- Reduces duplicate analysis load
- Short enough for near-real-time updates

## Future Enhancements

1. **Advanced Risk Analysis**
   - URL extraction and analysis
   - Phone number extraction
   - Keyword matching
   - Phishing pattern detection

2. **Enhanced Caching**
   - Longer TTL with configurable policies
   - Multi-tier caching (memory + Redis)
   - Cache warming

3. **Security**
   - API authentication
   - Rate limiting
   - Request signing
   - IP whitelisting

4. **Observability**
   - Prometheus metrics
   - Distributed tracing (Jaeger/OpenTelemetry)
   - APM integration

5. **Machine Learning**
   - ML-based risk scoring
   - Custom language models
   - Behavioral analysis

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [franc Library](https://github.com/wooorm/franc)
- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
