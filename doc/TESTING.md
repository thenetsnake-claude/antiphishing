# Testing Documentation

## Overview

This document describes the testing strategy, test types, and how to run tests for the Antiphishing API.

## Testing Goals

- **Minimum 75% code coverage**
- **Fast feedback loop** for developers
- **Reliable tests** that don't flake
- **Comprehensive coverage** of critical paths
- **Easy to maintain** test suite

## Test Types

### 1. Unit Tests

**Purpose**: Test individual components in isolation

**Location**: `src/**/__tests__/*.spec.ts`

**Characteristics**:
- Fast execution (< 1 second per test)
- No external dependencies (mocked)
- Test single responsibility
- High code coverage

**Example**:
```typescript
// src/language/__tests__/language.service.spec.ts
describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    service = new LanguageService();
  });

  it('should detect English language', () => {
    const result = service.detect('This is a test message in English');

    expect(result.language).toBe('eng');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

### 2. Integration Tests

**Purpose**: Test interactions between components

**Location**: `src/**/__tests__/*.integration.spec.ts`

**Characteristics**:
- Tests multiple components together
- May use real dependencies (e.g., Redis)
- Slower than unit tests
- Tests real-world scenarios

**Example**:
```typescript
// src/analyze/__tests__/analyze.integration.spec.ts
describe('AnalyzeService Integration', () => {
  let service: AnalyzeService;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AnalyzeService, CacheService, LanguageService],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should cache analysis results', async () => {
    const request = createMockRequest();

    // First call - cache miss
    const result1 = await service.analyze(request);
    expect(result1.analysis.cached).toBe(false);

    // Second call - cache hit
    const result2 = await service.analyze(request);
    expect(result2.analysis.cached).toBe(true);
  });
});
```

### 3. End-to-End (E2E) Tests

**Purpose**: Test complete API flows from HTTP request to response

**Location**: `test/*.e2e-spec.ts`

**Characteristics**:
- Tests full request/response cycle
- Uses real HTTP server
- Tests all middleware, interceptors, guards
- Slowest tests

**Example**:
```typescript
// test/analyze.e2e-spec.ts
describe('Analyze API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('POST /analyze - success', () => {
    return request(app.getHttpServer())
      .post('/analyze')
      .send({
        parentID: '123e4567-e89b-12d3-a456-426614174000',
        customerID: '123e4567-e89b-12d3-a456-426614174001',
        senderID: 'test@example.com',
        content: 'Test message',
        messageID: '123e4567-e89b-12d3-a456-426614174002',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('safe');
        expect(res.body.analysis).toBeDefined();
        expect(res.headers['x-processing-time']).toBeDefined();
      });
  });
});
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:cov
```

**Coverage Report Location**: `coverage/lcov-report/index.html`

### Run E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npm test -- language.service.spec.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should detect language"
```

### Run Tests for Changed Files Only

```bash
npm test -- --onlyChanged
```

### Clear Jest Cache

```bash
npm test -- --clearCache
```

## Test Coverage Requirements

### Coverage Thresholds

Configured in `package.json`:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    }
  }
}
```

### Coverage by Component

| Component | Target Coverage |
|-----------|----------------|
| Services | 90%+ |
| Controllers | 80%+ |
| DTOs | 100% (via validation tests) |
| Interceptors | 80%+ |
| Utilities | 90%+ |

## Test Structure

### Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from '../service-name.service';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceName],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  describe('methodName', () => {
    it('should perform expected behavior', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge case', () => {
      // Test edge cases
    });

    it('should throw error on invalid input', () => {
      // Test error cases
    });
  });
});
```

### Integration Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceA } from '../service-a.service';
import { ServiceB } from '../service-b.service';

describe('ServiceA Integration', () => {
  let serviceA: ServiceA;
  let serviceB: ServiceB;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceA, ServiceB],
    }).compile();

    serviceA = module.get<ServiceA>(ServiceA);
    serviceB = module.get<ServiceB>(ServiceB);
  });

  it('should integrate correctly', async () => {
    // Test integration between services
  });
});
```

### E2E Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Feature (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle request', () => {
    return request(app.getHttpServer())
      .post('/endpoint')
      .send({ data: 'test' })
      .expect(200);
  });
});
```

## Mocking Strategies

### Mock Services

```typescript
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    AnalyzeService,
    {
      provide: CacheService,
      useValue: mockCacheService,
    },
  ],
}).compile();
```

### Mock Redis

```typescript
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});
```

### Mock External Libraries

```typescript
jest.mock('franc', () => ({
  franc: jest.fn().mockReturnValue('eng'),
  francAll: jest.fn().mockReturnValue([['eng', 1]]),
}));
```

### Mock Configuration

```typescript
const mockConfigService = {
  get: jest.fn((key: string) => {
    const config = {
      'redis.host': 'localhost',
      'redis.port': 6379,
    };
    return config[key];
  }),
};
```

## Test Data Factories

### Request Factory

```typescript
// test/factories/request.factory.ts
import { v4 as uuidv4 } from 'uuid';
import { AnalyzeRequestDto } from '../../src/analyze/dto/analyze-request.dto';

export class RequestFactory {
  static createAnalyzeRequest(
    overrides?: Partial<AnalyzeRequestDto>,
  ): AnalyzeRequestDto {
    return {
      parentID: uuidv4(),
      customerID: uuidv4(),
      senderID: 'test@example.com',
      content: 'Test content in English',
      messageID: uuidv4(),
      ...overrides,
    };
  }

  static createWithFrenchContent(): AnalyzeRequestDto {
    return this.createAnalyzeRequest({
      content: 'Bonjour, ceci est un test',
    });
  }

  static createWithLongContent(): AnalyzeRequestDto {
    return this.createAnalyzeRequest({
      content: 'a'.repeat(2000),
    });
  }
}
```

Usage:
```typescript
const request = RequestFactory.createAnalyzeRequest();
const frenchRequest = RequestFactory.createWithFrenchContent();
```

## Test Scenarios

### Language Detection Tests

**Test Cases**:
- ✓ Detect English content
- ✓ Detect French content
- ✓ Detect Dutch content
- ✓ Detect Polish content
- ✓ Detect Spanish content
- ✓ Handle unknown language
- ✓ Handle empty content
- ✓ Handle very short content (< 3 chars)
- ✓ Handle mixed language content

### Cache Tests

**Test Cases**:
- ✓ Cache miss on first request
- ✓ Cache hit on second request with same content
- ✓ Cache expiration after TTL
- ✓ Different content generates different cache keys
- ✓ Graceful fallback when Redis unavailable
- ✓ Handle Redis connection errors
- ✓ Handle Redis timeout

### Validation Tests

**Test Cases**:
- ✓ Valid request succeeds
- ✓ Missing parentID fails
- ✓ Invalid parentID UUID fails
- ✓ Missing customerID fails
- ✓ Invalid customerID UUID fails
- ✓ Missing senderID fails
- ✓ Empty senderID fails
- ✓ Missing content fails
- ✓ Empty content fails
- ✓ Content > 2000 chars fails
- ✓ Missing messageID fails
- ✓ Invalid messageID UUID fails

### API Endpoint Tests

**Test Cases**:
- ✓ POST /analyze returns 200 with valid request
- ✓ POST /analyze returns 400 with invalid request
- ✓ Response includes X-Processing-Time header
- ✓ Response includes all required fields
- ✓ Cached response has cached: true
- ✓ Non-cached response has cached: false
- ✓ Processing time is reasonable (< 100ms for cache hit)

### Health Check Tests

**Test Cases**:
- ✓ GET /health returns 200 when healthy
- ✓ GET /health includes Redis status
- ✓ GET /health/readiness returns 200
- ✓ GET /health/liveness returns 200

## Performance Testing

### Load Test with Artillery

Create `artillery.yml`:

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  payload:
    path: 'payloads.csv'
    fields:
      - content

scenarios:
  - name: 'Analyze content'
    flow:
      - post:
          url: '/analyze'
          json:
            parentID: '123e4567-e89b-12d3-a456-426614174000'
            customerID: '123e4567-e89b-12d3-a456-426614174001'
            senderID: 'test@example.com'
            content: '{{ content }}'
            messageID: '123e4567-e89b-12d3-a456-426614174002'
```

Run:
```bash
npm install -g artillery
artillery run artillery.yml
```

### Benchmarking

```bash
# Install autocannon
npm install -g autocannon

# Run benchmark
autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"parentID":"123e4567-e89b-12d3-a456-426614174000","customerID":"123e4567-e89b-12d3-a456-426614174001","senderID":"test@example.com","content":"Test","messageID":"123e4567-e89b-12d3-a456-426614174002"}' \
  http://localhost:3000/analyze
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:cov
        env:
          REDIS_HOST: localhost
          REDIS_PORT: 6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 75" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 75% threshold"
            exit 1
          fi
```

## Test Maintenance

### Keep Tests Fast

- Mock external dependencies
- Use in-memory database for tests
- Parallelize test execution
- Clean up test data properly

### Keep Tests Reliable

- Avoid timeouts
- Don't depend on external services
- Use deterministic test data
- Clean state between tests

### Keep Tests Maintainable

- Use factories for test data
- Extract common setup to helpers
- Keep tests focused (one assertion per test)
- Use descriptive test names

## Debugging Tests

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": [
    "${fileBasename}",
    "--config",
    "./test/jest-e2e.json",
    "--runInBand"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Single Test

```typescript
it.only('should test specific case', () => {
  // This test will run alone
});
```

### Skip Tests

```typescript
it.skip('should test case', () => {
  // This test will be skipped
});
```

### Verbose Output

```bash
npm test -- --verbose
```

## Common Testing Pitfalls

### 1. Testing Implementation Details

**❌ Bad**:
```typescript
it('should call method X', () => {
  const spy = jest.spyOn(service, 'internalMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled();
});
```

**✅ Good**:
```typescript
it('should return expected result', () => {
  const result = service.publicMethod();
  expect(result).toEqual(expectedResult);
});
```

### 2. Not Cleaning Up

**❌ Bad**:
```typescript
it('should work', async () => {
  await service.create(data);
  // Data persists to next test
});
```

**✅ Good**:
```typescript
afterEach(async () => {
  await service.cleanup();
});

it('should work', async () => {
  await service.create(data);
});
```

### 3. Brittle Tests

**❌ Bad**:
```typescript
expect(result).toEqual({
  id: 1,
  createdAt: '2025-11-13T10:00:00.000Z',
  // Many specific fields
});
```

**✅ Good**:
```typescript
expect(result).toMatchObject({
  id: expect.any(Number),
  createdAt: expect.any(String),
});
```

## Test Checklist

Before committing code:

- [ ] All tests pass locally
- [ ] New code has tests
- [ ] Coverage meets threshold (75%+)
- [ ] No `it.only` or `describe.only` in tests
- [ ] No `console.log` in test code
- [ ] Tests are deterministic (no random failures)
- [ ] Test names are descriptive
- [ ] Edge cases are covered
- [ ] Error cases are tested

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing NestJS Applications](https://docs.nestjs.com/fundamentals/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
