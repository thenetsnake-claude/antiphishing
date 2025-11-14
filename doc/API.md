# API Documentation

## Overview
The Antiphishing API provides content analysis capabilities with language detection and caching support.

## Base URL
- **Development**: `http://localhost:3000`
- **Production**: Configured via deployment

## Endpoints

### POST /analyze

Analyzes message content, detects its language, and extracts URLs.

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "parentID": "123e4567-e89b-12d3-a456-426614174000",
  "customerID": "123e4567-e89b-12d3-a456-426614174001",
  "senderID": "user@example.com",
  "content": "This is a test message",
  "messageID": "123e4567-e89b-12d3-a456-426614174002"
}
```

**Parameters:**

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| parentID | string (UUID) | Yes | Valid UUID v4 | Parent identifier |
| customerID | string (UUID) | Yes | Valid UUID v4 | Customer identifier |
| senderID | string | Yes | Non-empty | Sender identifier |
| content | string | Yes | Max 2000 chars | Content to analyze |
| messageID | string (UUID) | Yes | Valid UUID v4 | Message identifier |

#### Response

**Headers:**
```
X-Processing-Time: 123
Content-Type: application/json
```

**Status Codes:**
- `200 OK` - Successful analysis
- `400 Bad Request` - Validation error
- `500 Internal Server Error` - Server error

**Success Response (200 OK):**
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
      "urls": ["http://example.com", "https://secure.site.com"],
      "phones": ["+12024561111"]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| status | string | Analysis status (always "safe" currently) |
| certainity | number | Overall certainty score (always 0 currently) |
| message | string | Analysis message (always "no analysis" currently) |
| customer_whitelisted | boolean | Customer whitelist status (always false currently) |
| analysis | object | Detailed analysis results |
| analysis.language | string | Detected language code (eng, fra, nld, pol, spa, or unknown) |
| analysis.lang_certainity | number | Language detection confidence (0-100) |
| analysis.cached | boolean | Whether result was served from cache |
| analysis.processing_time_ms | number | Processing time in milliseconds |
| analysis.risk_level | number | Risk level (always 0 currently) |
| analysis.triggers | array | Risk triggers (always empty currently) |
| analysis.enhanced | object | Enhanced analysis metrics |
| analysis.enhanced.urls | array | Extracted URLs from content (http://, https://, www., bare domains) |
| analysis.enhanced.phones | array | Extracted phone numbers in E.164 international format |

**Language Codes:**
- `eng` - English
- `fra` - French
- `nld` - Dutch
- `pol` - Polish
- `spa` - Spanish
- `unknown` - Could not detect or low confidence

**URL Detection:**

The API automatically extracts URLs from the message content and includes them in the `analysis.enhanced.urls` array.

**Detected URL formats:**
- URLs starting with `http://` (e.g., `http://example.com`)
- URLs starting with `https://` (e.g., `https://secure.example.com`)
- URLs starting with `www.` (automatically prefixed with `http://`, e.g., `www.example.com` → `http://www.example.com`)
- **Bare domains** (e.g., `example.com`, `test.org`, `demo.io`) - automatically prefixed with `http://`

**URL extraction features:**
- Detects URLs with paths, query parameters, and fragments
- **Supports ALL TLDs (1500+)** including: .com, .org, .net, .edu, .gov, .io, .dev, .app, .tech, .xyz, .cloud, .online, .shop, .museum, .aero, .travel, .co.uk, .com.au, and many more
- Powered by `linkify-it` library with comprehensive TLD database that is regularly updated
- Handles subdomains (e.g., `subdomain.example.com`)
- Automatically removes trailing punctuation (commas, periods, etc.)
- Deduplicates identical URLs
- **Does not** detect domains in email addresses (e.g., `user@example.com`)
- Returns empty array `[]` when no URLs are present

**Examples:**

Content: `"Visit https://example.com or www.test.org for more info"`
Result: `"urls": ["https://example.com", "http://www.test.org"]`

Content: `"Check example.com, test.org, and demo.net today"`
Result: `"urls": ["http://example.com", "http://test.org", "http://demo.net"]`

Content: `"Contact support@example.com for help"`
Result: `"urls": []` (email addresses are not detected as URLs)

**Phone Number Detection:**

The API automatically extracts phone numbers from the message content and includes them in the `analysis.enhanced.phones` array.

**Detected phone number formats:**
- International format with country code: `+1 (202) 456-1111`, `+44-20-7946-0958`
- Various separators supported:
  - **Dashes**: `+1-202-456-1111`
  - **Dots**: `+1.202.456.1111`
  - **Spaces**: `+1 202 456 1111`
  - **Parentheses**: `+1 (202) 456-1111`, `+1(202)456-1111`
  - **Slashes**: `+33/1/42/86/82/00` (may not always be detected)
- Mixed formats in same content

**Phone number extraction features:**
- **Output format**: E.164 international format (e.g., `+12024561111`)
- Powered by `libphonenumber-js` library for comprehensive international support
- Supports phone numbers from all countries and regions
- Handles various local and international formatting styles
- Automatically deduplicates identical numbers
- Returns empty array `[]` when no phone numbers are present
- Graceful error handling - never fails the request

**Examples:**

Content: `"Call us at +1-202-456-1111 for support"`
Result: `"phones": ["+12024561111"]`

Content: `"Phone: +44-20-7946-0958 or +1.202.456.1111"`
Result: `"phones": ["+442079460958", "+12024561111"]`

Content: `"Contact +1 (202) 456-1111 and also +1-202-456-1111"`
Result: `"phones": ["+12024561111"]` (deduplicated)

Content: `"No phone numbers in this text"`
Result: `"phones": []`

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": [
    "parentID must be a UUID",
    "content must be shorter than or equal to 2000 characters"
  ],
  "error": "Bad Request"
}
```

### GET /health

Health check endpoint for monitoring.

#### Response

**Status Codes:**
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is unhealthy

**Success Response (200 OK):**
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

### GET /health/readiness

Kubernetes readiness probe endpoint.

#### Response

**Status Codes:**
- `200 OK` - Service is ready to accept traffic
- `503 Service Unavailable` - Service is not ready

**Success Response (200 OK):**
```json
{
  "status": "ok"
}
```

### GET /health/liveness

Kubernetes liveness probe endpoint.

#### Response

**Status Codes:**
- `200 OK` - Service is alive
- `503 Service Unavailable` - Service should be restarted

**Success Response (200 OK):**
```json
{
  "status": "ok"
}
```

## Caching

The API uses Redis for caching analysis results:
- **Cache Key**: MD5 hash of content field
- **Cache Duration**: 60 seconds
- **Cache Behavior**: Results include `cached: true/false` to indicate cache hit/miss
- **Fallback**: If Redis is unavailable, requests proceed without caching

## Rate Limiting

Currently not implemented. May be added in future versions.

## Authentication

Currently not required. The API is publicly accessible.

## Examples

### Example 1: Analyze English Content

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "parentID": "123e4567-e89b-12d3-a456-426614174000",
    "customerID": "123e4567-e89b-12d3-a456-426614174001",
    "senderID": "john@example.com",
    "content": "Hello, this is a test message in English.",
    "messageID": "123e4567-e89b-12d3-a456-426614174002"
  }'
```

**Response:**
```json
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "eng",
    "lang_certainity": 98.2,
    "cached": false,
    "processing_time_ms": 45,
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

### Example 2: Analyze French Content

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "parentID": "123e4567-e89b-12d3-a456-426614174000",
    "customerID": "123e4567-e89b-12d3-a456-426614174001",
    "senderID": "jean@example.com",
    "content": "Bonjour, ceci est un message de test en français.",
    "messageID": "123e4567-e89b-12d3-a456-426614174003"
  }'
```

**Response:**
```json
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "fra",
    "lang_certainity": 97.8,
    "cached": false,
    "processing_time_ms": 42,
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

### Example 3: Validation Error

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "parentID": "invalid-uuid",
    "customerID": "123e4567-e89b-12d3-a456-426614174001",
    "content": "Test"
  }'
```

**Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": [
    "parentID must be a UUID",
    "senderID should not be empty",
    "messageID must be a UUID"
  ],
  "error": "Bad Request"
}
```

## Versioning

Current version: v1 (no version prefix in URL)

Future versions may include version prefix (e.g., `/v2/analyze`).

## Support

For issues or questions, contact the development team or refer to the project repository.
