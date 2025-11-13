# Development Guide

## Getting Started

### Prerequisites

- **Node.js**: Version 22.x
- **npm**: Version 10.x or higher
- **Docker**: For running Redis locally
- **Docker Compose**: For full development stack
- **Git**: For version control
- **IDE**: VS Code (recommended) or your preferred editor

### Recommended VS Code Extensions

- ESLint
- Prettier
- Jest Runner
- Docker
- GitLens

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd antiphishing-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your local configuration:

```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS_ENABLED=false
LOG_LEVEL=debug
LOG_FILE_PATH=./logs
```

### 4. Start Redis (Option 1: Docker)

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 5. Start Redis (Option 2: Docker Compose)

```bash
docker-compose up -d redis
```

### 6. Run the Application

**Development mode with hot reload**:
```bash
npm run start:dev
```

**Debug mode**:
```bash
npm run start:debug
```

**Production mode locally**:
```bash
npm run build
npm run start:prod
```

### 7. Verify Installation

Open browser or use curl:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "redis": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "redis": {
      "status": "up"
    }
  }
}
```

## Development Workflow

### Running the Development Server

The development server includes:
- Hot reload on file changes
- Automatic compilation
- Source maps for debugging

```bash
npm run start:dev
```

### Code Formatting

**Format all files**:
```bash
npm run format
```

**Check formatting**:
```bash
npm run format:check
```

### Linting

**Lint all files**:
```bash
npm run lint
```

**Auto-fix linting issues**:
```bash
npm run lint:fix
```

### Testing

**Run all tests**:
```bash
npm test
```

**Run tests in watch mode**:
```bash
npm run test:watch
```

**Run tests with coverage**:
```bash
npm run test:cov
```

**Run end-to-end tests**:
```bash
npm run test:e2e
```

**Run specific test file**:
```bash
npm test -- analyze.service.spec.ts
```

## Project Structure

```
antiphishing-api/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── analyze/                # Analyze feature module
│   │   ├── analyze.module.ts
│   │   ├── analyze.controller.ts
│   │   ├── analyze.service.ts
│   │   ├── dto/
│   │   │   ├── analyze-request.dto.ts
│   │   │   └── analyze-response.dto.ts
│   │   └── __tests__/
│   │       ├── analyze.controller.spec.ts
│   │       └── analyze.service.spec.ts
│   ├── language/               # Language detection service
│   │   ├── language.service.ts
│   │   └── __tests__/
│   │       └── language.service.spec.ts
│   ├── cache/                  # Cache service
│   │   ├── cache.module.ts
│   │   ├── cache.service.ts
│   │   └── __tests__/
│   │       └── cache.service.spec.ts
│   ├── health/                 # Health check endpoints
│   │   ├── health.controller.ts
│   │   └── __tests__/
│   │       └── health.controller.spec.ts
│   ├── common/                 # Shared utilities
│   │   ├── interceptors/
│   │   │   ├── processing-time.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── utils/
│   │       └── hash.util.ts
│   └── config/                 # Configuration
│       └── configuration.ts
├── test/                       # E2E tests
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── doc/                        # Documentation
├── scripts/                    # Utility scripts
│   └── test-scenarios.sh
├── logs/                       # Log files (gitignored)
├── dist/                       # Compiled output (gitignored)
├── node_modules/               # Dependencies (gitignored)
├── .env                        # Environment variables (gitignored)
├── .env.example               # Environment template
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image definition
├── .eslintrc.js              # ESLint configuration
├── .prettierrc               # Prettier configuration
├── nest-cli.json             # NestJS CLI configuration
├── tsconfig.json             # TypeScript configuration
├── tsconfig.build.json       # TypeScript build configuration
├── package.json              # Dependencies and scripts
├── package-lock.json         # Locked dependencies
├── README.md                 # Project overview
└── REQUIREMENTS.md           # Requirements documentation
```

## Module Architecture

### Analyze Module

**Purpose**: Handles content analysis requests

**Files**:
- `analyze.controller.ts` - HTTP endpoint handler
- `analyze.service.ts` - Business logic
- `analyze.module.ts` - Module definition
- `dto/analyze-request.dto.ts` - Request validation
- `dto/analyze-response.dto.ts` - Response structure

### Language Module

**Purpose**: Language detection functionality

**Files**:
- `language.service.ts` - franc integration

### Cache Module

**Purpose**: Redis caching with Sentinel support

**Files**:
- `cache.service.ts` - Cache operations
- `cache.module.ts` - Module definition

### Health Module

**Purpose**: Health check endpoints

**Files**:
- `health.controller.ts` - Health endpoints

## Creating New Features

### 1. Create a New Module

```bash
nest g module feature-name
```

### 2. Create a Controller

```bash
nest g controller feature-name
```

### 3. Create a Service

```bash
nest g service feature-name
```

### 4. Create DTOs

Create in `src/feature-name/dto/`:
```typescript
// feature-request.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class FeatureRequestDto {
  @IsString()
  @IsNotEmpty()
  field: string;
}
```

### 5. Write Tests

Create in `src/feature-name/__tests__/`:
```typescript
// feature.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureService } from '../feature.service';

describe('FeatureService', () => {
  let service: FeatureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureService],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Working with DTOs

### Request DTO Example

```typescript
import { IsString, IsUUID, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRequestDto {
  @ApiProperty({ description: 'Parent ID', format: 'uuid' })
  @IsUUID()
  parentID: string;

  @ApiProperty({ description: 'Content to analyze', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
```

### Response DTO Example

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class AnalysisDto {
  @ApiProperty({ description: 'Detected language' })
  language: string;

  @ApiProperty({ description: 'Language confidence percentage' })
  lang_certainity: number;
}

export class AnalyzeResponseDto {
  @ApiProperty({ description: 'Analysis status' })
  status: string;

  @ApiProperty({ description: 'Analysis details' })
  analysis: AnalysisDto;
}
```

## Working with Services

### Service Example

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  async analyze(content: string): Promise<AnalysisResult> {
    this.logger.debug(`Analyzing content of length ${content.length}`);

    try {
      // Implementation
      return result;
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

### Service with Dependencies

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { LanguageService } from '../language/language.service';

@Injectable()
export class AnalyzeService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly languageService: LanguageService,
  ) {}

  async analyze(content: string): Promise<AnalysisResult> {
    // Use injected services
    const cached = await this.cacheService.get(content);
    if (cached) return cached;

    const language = this.languageService.detect(content);
    // ...
  }
}
```

## Testing Best Practices

### Unit Test Structure

```typescript
describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let cacheService: CacheService;
  let languageService: LanguageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: LanguageService,
          useValue: {
            detect: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
    cacheService = module.get<CacheService>(CacheService);
    languageService = module.get<LanguageService>(LanguageService);
  });

  describe('analyze', () => {
    it('should return cached result if available', async () => {
      const cachedResult = { language: 'eng', lang_certainity: 95 };
      jest.spyOn(cacheService, 'get').mockResolvedValue(cachedResult);

      const result = await service.analyze('test content');

      expect(result).toEqual(cachedResult);
      expect(cacheService.get).toHaveBeenCalledWith('test content');
    });
  });
});
```

### Integration Test Structure

```typescript
describe('AnalyzeController (e2e)', () => {
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

  it('/analyze (POST)', () => {
    return request(app.getHttpServer())
      .post('/analyze')
      .send({
        parentID: '123e4567-e89b-12d3-a456-426614174000',
        customerID: '123e4567-e89b-12d3-a456-426614174001',
        senderID: 'test@example.com',
        content: 'Test content',
        messageID: '123e4567-e89b-12d3-a456-426614174002',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('analysis');
      });
  });
});
```

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "console": "integratedTerminal",
      "restart": true,
      "sourceMaps": true,
      "stopOnEntry": false,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["${fileBasename}", "--config", "./test/jest-e2e.json"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debugging Tips

1. **Add breakpoints** in VS Code by clicking on line numbers
2. **Use Logger** for runtime debugging:
   ```typescript
   this.logger.debug('Variable value:', variable);
   ```
3. **Use console.log** for quick debugging (remove before commit)
4. **Check logs**: `tail -f logs/application-*.log`

## Environment Management

### Development Environment

```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS_ENABLED=false
LOG_LEVEL=debug
LOG_FILE_PATH=./logs
```

### Testing Environment

```env
NODE_ENV=test
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_TLS_ENABLED=false
LOG_LEVEL=error
LOG_FILE_PATH=./logs/test
```

## Docker Development

### Using Docker Compose

**Start all services**:
```bash
docker-compose up -d
```

**View logs**:
```bash
docker-compose logs -f api
```

**Restart API after changes**:
```bash
docker-compose restart api
```

**Rebuild after dependency changes**:
```bash
docker-compose up -d --build
```

**Stop all services**:
```bash
docker-compose down
```

**Remove volumes**:
```bash
docker-compose down -v
```

### Docker Compose Services

- **api**: NestJS application on port 3000
- **redis**: Redis on port 6379

## Common Development Tasks

### Adding a New Dependency

```bash
# Production dependency
npm install package-name

# Development dependency
npm install -D package-name
```

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm update package-name

# Update all packages (be careful)
npm update
```

### Database Migrations (Future)

When database is added:
```bash
npm run migration:generate -- -n MigrationName
npm run migration:run
npm run migration:revert
```

## Code Style Guidelines

### TypeScript Best Practices

1. **Use strict types**: Avoid `any`
2. **Use interfaces for objects**:
   ```typescript
   interface User {
     id: string;
     name: string;
   }
   ```
3. **Use enums for constants**:
   ```typescript
   enum Status {
     ACTIVE = 'active',
     INACTIVE = 'inactive',
   }
   ```

### NestJS Best Practices

1. **Use dependency injection**
2. **Keep controllers thin**: Business logic in services
3. **Use DTOs for validation**
4. **Use interceptors for cross-cutting concerns**
5. **Use guards for authentication/authorization**

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `analyze.service.ts`)
- **Classes**: `PascalCase` (e.g., `AnalyzeService`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `IConfig`)
- **Variables**: `camelCase` (e.g., `userName`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_LENGTH`)

## Git Workflow

### Branch Naming

- Feature: `feature/description`
- Bug fix: `bugfix/description`
- Hotfix: `hotfix/description`

### Commit Messages

Follow conventional commits:
```
feat: add language detection service
fix: handle Redis connection errors
docs: update API documentation
test: add cache service tests
chore: update dependencies
```

### Before Committing

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm test

# Check coverage
npm run test:cov
```

## Performance Tips

### 1. Use Caching Effectively

```typescript
// Cache expensive operations
const cached = await this.cacheService.get(key);
if (cached) return cached;

const result = await expensiveOperation();
await this.cacheService.set(key, result, 60);
return result;
```

### 2. Use Async/Await Properly

```typescript
// Parallel execution
const [user, posts] = await Promise.all([
  this.userService.find(id),
  this.postService.findByUser(id),
]);

// Sequential when needed
const user = await this.userService.find(id);
const posts = await this.postService.findByUser(user.id);
```

### 3. Optimize Logging

```typescript
// Conditional logging
if (this.logger.isDebugEnabled()) {
  this.logger.debug(`Expensive operation: ${JSON.stringify(data)}`);
}
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Redis Connection Error

```bash
# Check if Redis is running
docker ps | grep redis

# Start Redis
docker start redis

# Or use Docker Compose
docker-compose up -d redis
```

### Module Not Found Error

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Test Failures

```bash
# Clear Jest cache
npm test -- --clearCache

# Run specific test
npm test -- analyze.service.spec.ts
```

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Redis Documentation](https://redis.io/documentation)

## Getting Help

- Check documentation in `doc/` folder
- Review test files for examples
- Check issue tracker
- Ask team members
