# Antiphishing API

NestJS-based content analysis API with language detection and Redis caching.

## Features

- **Language Detection**: Automatic language detection using franc library
- **URL Extraction**: Detects and extracts URLs (http://, https://, www., bare domains) with support for ALL TLDs (1500+)
- **URL Shortener Detection**: Automatically detects 2,300+ URL shortener services and follows redirects to reveal final destinations
- **Redirect Following**: Intelligent redirect chain following with caching (max 10 redirects, 2s timeout, 24h cache)
- **Phone Number Extraction**: Detects and extracts phone numbers in various formats with E.164 normalization
- **Public IP Detection**: Detects and extracts public IP addresses (IPv4 and IPv6) with private IP filtering
- **Redis Caching**: High-performance caching with Sentinel support (multi-database for different cache types)
- **Health Checks**: Kubernetes-ready health, readiness, and liveness probes
- **Structured Logging**: JSON logging with daily rotation
- **Request Validation**: Comprehensive input validation
- **Performance Tracking**: Processing time tracking and reporting

## Quick Start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose (for local development)
- Redis (included in Docker Compose)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd antiphishing-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start with Docker Compose (recommended)
docker-compose up -d

# Or start locally (requires local Redis)
npm run start:dev
```

### API Endpoint

**POST /analyze**

Analyzes message content, detects language, and extracts URLs, phone numbers, and public IP addresses.

Request:
```json
{
  "parentID": "123e4567-e89b-12d3-a456-426614174000",
  "customerID": "123e4567-e89b-12d3-a456-426614174001",
  "senderID": "user@example.com",
  "content": "Hello, this is a test message",
  "messageID": "123e4567-e89b-12d3-a456-426614174002"
}
```

Response:
```json
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "eng",
    "lang_certainity": 95.5,
    "cached": false,
    "processing_time_ms": 45,
    "risk_level": 0,
    "triggers": [],
    "enhanced": {
      "keyword_density": 0,
      "message_length_risk": 0,
      "urls": [],
      "phones": [],
      "public_ips": [],
      "shortener_used": [],
      ...
    }
  }
}
```

### Health Checks

- `GET /health` - Comprehensive health check
- `GET /health/readiness` - Kubernetes readiness probe
- `GET /health/liveness` - Kubernetes liveness probe

## Development

```bash
# Run in development mode
npm run start:dev

# Run tests
npm test

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Test scenarios with cURL
./scripts/test-scenarios.sh
```

## Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down

# Rebuild
docker-compose up -d --build
```

## Documentation

Comprehensive documentation is available in the `doc/` folder:

- [API Documentation](./doc/API.md) - API endpoints and usage
- [Architecture](./doc/ARCHITECTURE.md) - System architecture and design
- [Deployment](./doc/DEPLOYMENT.md) - Deployment guides for dev and prod
- [Development](./doc/DEVELOPMENT.md) - Local development setup
- [Testing](./doc/TESTING.md) - Testing strategy and guidelines
- [Redis Configuration](./doc/REDIS.md) - Caching strategy and Redis setup

## Environment Variables

See [.env.example](./.env.example) for all available environment variables.

### Development
```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=debug
```

### Production
```env
NODE_ENV=production
PORT=3000
REDIS_SENTINEL_HOSTS=sentinel-1:26379,sentinel-2:26379,sentinel-3:26379
REDIS_MASTER_NAME=mymaster
REDIS_USERNAME=<username>
REDIS_PASSWORD=<password>
REDIS_TLS_ENABLED=true
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/app
```

## Project Structure

```
antiphishing-api/
├── src/
│   ├── analyze/           # Analysis module
│   ├── cache/             # Redis cache module
│   ├── language/          # Language detection service
│   ├── health/            # Health check endpoints
│   ├── common/            # Shared utilities
│   ├── config/            # Configuration
│   ├── app.module.ts      # Root module
│   └── main.ts            # Entry point
├── test/                  # E2E tests
├── doc/                   # Documentation
├── scripts/               # Utility scripts
├── docker-compose.yml     # Docker Compose config
├── Dockerfile             # Production Dockerfile
└── README.md              # This file
```

## Technologies

- **Framework**: NestJS 10
- **Runtime**: Node.js 22
- **Language**: TypeScript 5
- **Cache**: Redis 7 with ioredis (multi-database support)
- **Language Detection**: franc
- **URL Detection**: linkify-it with tlds
- **URL Shortener Detection**: link-shorteners (2,300+ domains)
- **HTTP Client**: axios (for redirect following)
- **Phone Number Detection**: libphonenumber-js
- **Public IP Detection**: ipaddr.js
- **Validation**: class-validator
- **Logging**: Winston with daily rotation
- **Testing**: Jest
- **Health Checks**: @nestjs/terminus

## License

MIT

## Support

For issues or questions:
- Check documentation in `doc/` folder
- Review test files for examples
- Contact the development team
