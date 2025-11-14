# Antiphishing API - Requirements Document

## Project Overview
Build a NestJS-based content analysis API that detects language from incoming messages and provides a cached analysis response.

## Project Information
- **Package Name**: antiphishing-api
- **Framework**: NestJS
- **Node.js Version**: 22
- **Language Detection**: franc library
- **URL Detection**: linkify-it library with tlds package
- **Phone Number Detection**: libphonenumber-js library
- **Cache**: Redis (with Sentinel support for production)
- **Test Coverage**: Minimum 75%

## API Endpoint Specification

### POST /analyze

**Request Body Parameters:**
- `parentID` (string, GUID, required) - Parent identifier
- `customerID` (string, GUID, required) - Customer identifier
- `senderID` (string, required) - Sender identifier
- `messageID` (string, GUID, required) - Message identifier
- `content` (string, required, max 2000 characters) - Content to analyze

**Response Headers:**
- `X-Processing-Time` - Processing time in milliseconds

**Response Body (JSON):**
```json
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "eng|fra|nld|pol|spa|unknown",
    "lang_certainity": 0-100,
    "cached": true|false,
    "processing_time_ms": 123,
    "risk_level": 0,
    "triggers": [],
    "enhanced": {
      "keyword_density": 0,
      "message_length_risk": 0,
      "mixed_content_risk": 0,
      "caps_ratio_risk": 0,
      "total_context_risk": 0,
      "burst_pattern_risk": 0,
      "off_hours_risk": 0,
      "weekend_spike": 0,
      "total_temporal_risk": 0,
      "suspicious_tld": "",
      "phishing_keywords": [],
      "urls": [],
      "phones": []
    }
  }
}
```

**HTTP Status Codes:**
- 200 OK - Successful analysis
- 400 Bad Request - Validation errors (standard NestJS format)
- 500 Internal Server Error - Server errors

**Most Common Languages:**
- EN (English)
- FR (French)
- NL (Dutch)
- PL (Polish)
- ES (Spanish)

## Caching Strategy

### Redis Configuration
- **Cache Key**: Based on `content` field only
- **Cache Duration**: 60 seconds (1 minute)
- **Behavior if Redis Down**: Continue without cache, don't fail requests

### Production Environment (Kubernetes)
Redis with Sentinel configuration:
- Multiple sentinel hosts
- TLS enabled
- Username/password authentication
- Master name configuration

### Development Environment
Local Redis using Docker Compose (no sentinels, no TLS)

## Environment Variables

### Redis Configuration
- `REDIS_SENTINEL_HOSTS` - Comma-separated sentinel hosts (e.g., "host1:26379,host2:26379")
- `REDIS_PASSWORD` - Redis authentication password
- `REDIS_USERNAME` - Redis authentication username
- `REDIS_TLS_ENABLED` - Enable TLS for Redis connection (true/false)
- `REDIS_MASTER_NAME` - Redis Sentinel master name
- `REDIS_HOST` - Redis host for local dev (when not using sentinels)
- `REDIS_PORT` - Redis port for local dev

### Application Configuration
- `NODE_ENV` - Environment (development/production)
- `PORT` - API port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)
- `LOG_FILE_PATH` - Path for log files

## Language Detection

### Library
- Use `franc` library for language detection
- Fast and supports many languages

### Failure Handling
- If detection fails or confidence is too low: return `"unknown"` as language
- Include confidence percentage in `lang_certainity` field
- Never fail the request due to language detection issues

## URL Detection

### Overview
The API automatically extracts and normalizes URLs from message content and returns them in the `analysis.enhanced.urls` array.

### Library
- Use `linkify-it` library (v5.0.0) for URL detection
- Use `tlds` library for comprehensive TLD support
- Supports fuzzy matching for bare domains without protocols

### Supported URL Formats
1. **URLs with protocols**
   - `http://example.com`
   - `https://secure.example.com`

2. **URLs starting with www.**
   - `www.example.com` (automatically prefixed with `http://`)

3. **Bare domains**
   - `example.com` (automatically prefixed with `http://`)
   - `subdomain.example.org`
   - Supports ALL official TLDs (1500+)

4. **URLs with paths and parameters**
   - `https://example.com/path/to/page`
   - `https://example.com/page?param=value`
   - `https://example.com/page#anchor`

### TLD Support
- Supports **ALL official TLDs** (1500+)
- Includes generic TLDs: .com, .org, .net, .edu, .gov, .mil, .int
- Includes country-code TLDs: .uk, .de, .fr, .jp, .cn, .au, .br, etc.
- Includes new gTLDs: .io, .dev, .app, .tech, .cloud, .online, .shop, .xyz, etc.
- Includes special-use TLDs: .museum, .aero, .travel, .coop, .jobs, etc.
- Includes multi-level TLDs: .co.uk, .com.au, .co.za, .com.br, etc.
- TLD database automatically updated with `tlds` package

### Email Address Filtering
- **Does NOT detect** email addresses as URLs
- Email domains are specifically excluded (e.g., `user@example.com`)
- Only standalone domain names are detected as URLs

### URL Normalization
- Trailing punctuation automatically removed (periods, commas, semicolons, etc.)
- Bare domains prefixed with `http://`
- URLs starting with `www.` prefixed with `http://`
- Duplicate URLs automatically deduplicated
- Returns empty array `[]` when no URLs found

### Technical Implementation
- TypeScript `import = require()` syntax used for module compatibility
- Works with both `npm run build` and `npm run start:dev` (watch mode)
- ESLint exceptions added for require-style imports
- Type-safe with LinkifyIt.Match interface

### Failure Handling
- If URL detection fails: return empty array `[]`
- Never fail the request due to URL detection issues
- Gracefully handle malformed content

## Phone Number Detection

### Overview
The API automatically extracts and normalizes phone numbers from message content and returns them in the `analysis.enhanced.phones` array.

### Library
- Use `libphonenumber-js` library (v1.12.26) for phone number detection
- Comprehensive international phone number parsing library
- Based on Google's libphonenumber library
- Supports phone numbers from all countries and regions

### Supported Phone Number Formats
1. **International format with country code**
   - `+1 (202) 456-1111` (US format with parentheses)
   - `+44-20-7946-0958` (UK format with dashes)
   - `+49 30 12345678` (German format with spaces)
   - `+81-3-1234-5678` (Japanese format)

2. **Various separators supported**
   - **Dashes**: `+1-202-456-1111`
   - **Dots**: `+1.202.456.1111`
   - **Spaces**: `+1 202 456 1111`
   - **Parentheses**: `+1 (202) 456-1111`, `+1(202)456-1111`
   - **Slashes**: `+33/1/42/86/82/00` (less common, may not always be detected)

3. **Mixed formats in same content**
   - Multiple phone numbers with different separators can be detected in the same message

### Output Format
- **E.164 International Format**: All phone numbers returned as E.164 strings
  - Example: `+12024561111` (no spaces, dashes, or parentheses)
  - Always includes country code prefix with `+`
  - Consistent format regardless of input format
  - Easy to store and compare

### Phone Number Extraction Features
- **Default Country**: Belgium (BE) - local Belgian numbers detected without country code
- Detects phone numbers in various local and international formatting styles
- Automatically normalizes all phone numbers to E.164 format
- Supports phone numbers from all countries and regions worldwide
- Handles multiple phone numbers in single message
- Automatically deduplicates identical phone numbers
- Returns empty array `[]` when no phone numbers found
- Case-insensitive detection
- Strips surrounding text and punctuation
- Examples of Belgian local formats:
  - Toll-free: `0800 33 800` → `+32800338 00`
  - Brussels landline: `02 123 45 67` → `+3221234567`
  - Mobile: `0470 12 34 56` → `+32470123456`

### Technical Implementation
- Uses `findPhoneNumbersInText()` function for broad detection
- Belgium (BE) provided as default country for local number detection
- Converts PhoneNumber objects to E.164 string format
- TypeScript type safety with PhoneNumber interface
- Duplicate removal using Set data structure

### Failure Handling
- If phone number extraction fails: return empty array `[]`
- Never fail the request due to phone detection issues
- Gracefully handle malformed phone numbers
- Invalid phone-like text is filtered out

### Privacy Considerations
- Only extracts phone numbers, does not validate ownership
- No storage or retention of phone numbers beyond response
- Phone numbers logged in response metadata only

## Health Checks

### Required Endpoints
1. **GET /health** - General health check
2. **GET /health/readiness** - Kubernetes readiness probe
3. **GET /health/liveness** - Kubernetes liveness probe

Health checks should verify:
- API is running
- Redis connection status (warn if down, but don't fail)

## Logging

### Requirements
- **Format**: JSON structured logging
- **Content**: Log all request/response data EXCEPT content field (for privacy/size)
- **Production**:
  - JSON format to file
  - Daily rotation
  - Store in volume
- **Development**:
  - Console output
  - Human-readable format

### Logged Information
- Request: method, path, parentID, customerID, senderID, messageID (NOT content)
- Response: status code, processing time
- Errors: Full error details
- Cache: Hit/miss status

## Security

### Current Phase
- No authentication/authorization required
- Public endpoint for now

### Future Considerations
- API key authentication
- Rate limiting
- IP whitelisting

## Testing

### Requirements
- Minimum 75% code coverage
- Unit tests for all services
- Integration tests for API endpoints
- Tests for Redis caching (with mocked Redis)
- Tests for language detection
- Tests for URL detection
- Tests for phone number detection
- Tests for validation rules

### Test Scenarios (cURL)
Create a script with test scenarios for:
- Valid request with English content
- Valid request with French content
- Valid request with Dutch content
- Valid request with Polish content
- Valid request with Spanish content
- Valid request with unknown language
- Invalid request (missing fields)
- Invalid request (content too long)
- Invalid request (invalid GUID format)
- Cache hit scenario (same content twice)
- URL detection with protocol (http://, https://)
- URL detection with www prefix
- URL detection with bare domains
- URL detection should not detect emails
- Phone detection with dashes
- Phone detection with dots
- Phone detection with parentheses
- Phone detection with multiple numbers
- Phone detection should return empty array when no phones
- Phone detection with Belgian toll-free number
- Phone detection with Belgian landline
- Phone detection with Belgian mobile

## Validation Rules

### Input Validation
- All GUIDs must be valid UUID format
- `content` must be a string
- `content` max length: 2000 characters
- `senderID` must be a non-empty string
- All required fields must be present

### Standard NestJS Validation
- Use class-validator decorators
- Use ValidationPipe globally
- Return standard NestJS error format for validation failures

## Documentation

### Required Documentation Files (in doc/ folder)
1. **API.md** - API endpoint documentation
2. **ARCHITECTURE.md** - System architecture and design decisions
3. **DEPLOYMENT.md** - Deployment instructions for dev and prod
4. **DEVELOPMENT.md** - Local development setup guide
5. **TESTING.md** - Testing strategy and how to run tests
6. **REDIS.md** - Redis configuration and caching strategy

## Deployment

### Development Environment
- Docker Compose with:
  - NestJS API service
  - Local Redis (single instance, no sentinel)
- Hot reload enabled
- Environment variables from .env file

### Production Environment
- Kubernetes deployment
- External Redis with Sentinel
- TLS enabled
- Health checks configured
- Resource limits defined
- Environment variables from ConfigMaps/Secrets

## Project Structure
```
antiphishing-api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── analyze/
│   │   ├── analyze.module.ts
│   │   ├── analyze.controller.ts
│   │   ├── analyze.service.ts
│   │   ├── dto/
│   │   └── __tests__/
│   ├── language/
│   │   ├── language.service.ts
│   │   └── __tests__/
│   ├── cache/
│   │   ├── cache.service.ts
│   │   └── __tests__/
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── __tests__/
│   └── common/
│       ├── interceptors/
│       └── filters/
├── test/
├── doc/
├── scripts/
│   └── test-scenarios.sh
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env
├── nest-cli.json
├── tsconfig.json
├── package.json
└── README.md
```

## Implementation Phases

### Phase 1: Documentation
- Create all .md files in doc/ folder
- Document architecture and design decisions
- Commit: "docs: add initial documentation"

### Phase 2: Project Setup
- Initialize NestJS project
- Install dependencies
- Configure TypeScript and linting
- Set up project structure
- Commit: "chore: initial NestJS project setup"

### Phase 3: Core Services
- Implement language detection service
- Implement Redis cache service with Sentinel support
- Add health check endpoints
- Commit: "feat: add language detection and cache services"

### Phase 4: API Endpoint
- Create /analyze endpoint
- Add validation DTOs
- Add processing time interceptor
- Implement response mapping
- Commit: "feat: implement /analyze endpoint"

### Phase 5: Logging
- Add structured logging
- Configure file rotation
- Add request/response logging
- Commit: "feat: add structured logging with rotation"

### Phase 6: Testing
- Write unit tests for all services
- Write integration tests for endpoints
- Achieve 75%+ coverage
- Commit: "test: add comprehensive test suite"

### Phase 7: Docker & Deployment
- Create Dockerfile
- Create docker-compose.yml
- Add .env.example
- Commit: "chore: add Docker configuration"

### Phase 8: Test Scripts
- Create cURL test scenarios script
- Document usage
- Commit: "chore: add cURL test scenarios script"

### Phase 9: Final Review
- Review all documentation
- Update README.md
- Final testing
- Commit: "docs: update README and final review"

## Clarifications Provided

1. **Language Detection Library**: franc
2. **URL Detection Library**: linkify-it with tlds package for universal TLD support
3. **Phone Number Detection Library**: libphonenumber-js with E.164 output format
4. **Cache Key Strategy**: Only content field
5. **Language Detection Failure**: Return "unknown" with confidence in lang_certainity
6. **URL Detection Failure**: Return empty array []
7. **Phone Detection Failure**: Return empty array []
8. **Error Response Format**: Standard NestJS format
9. **Node.js Version**: 22
10. **Redis Env Vars**: REDIS_SENTINEL_HOSTS, REDIS_PASSWORD, REDIS_USERNAME, REDIS_TLS_ENABLED, REDIS_MASTER_NAME
11. **Additional Endpoints**: health, readiness, liveness
12. **Logging**: Log all except content, JSON to file (daily rotation) + console for dev
13. **Project Name**: antiphishing-api
14. **Status Codes**: 200 OK, 400 Bad Request, continue without cache if Redis down

## Implemented Features

### URL Detection (Added)
- Automatically extracts URLs from message content
- Supports http://, https://, www., and bare domains
- Supports ALL official TLDs (1500+) via linkify-it and tlds libraries
- Filters out email addresses
- Normalizes URLs and removes duplicates
- Returns extracted URLs in `analysis.enhanced.urls` array
- Comprehensive test coverage: 29 unit tests, 4 E2E tests, 4 cURL scenarios

### Phone Number Detection (Added)
- Automatically extracts phone numbers from message content
- **Default country**: Belgium (BE) for local number detection
- Supports Belgian local formats: toll-free (0800), landlines (02, 03, etc.), mobile (047x, 048x, 049x)
- Supports international format with country codes
- Handles various separators: dashes, dots, spaces, parentheses, slashes
- Normalizes all phone numbers to E.164 international format
- Supports phone numbers from all countries and regions worldwide
- Automatically deduplicates identical phone numbers
- Returns extracted phone numbers in `analysis.enhanced.phones` array
- Comprehensive test coverage: 20 unit tests, 7 E2E tests, 8 cURL scenarios

## Notes
- All placeholder values (status: "safe", certainity: 0, etc.) are hardcoded for now
- Future enhancement will add real risk analysis
- Security will be added in future phase
- Focus on clean, maintainable, well-tested code
