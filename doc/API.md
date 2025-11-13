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
      "phones": []
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
| analysis.enhanced.urls | array | Extracted URLs from content (http://, https://, www.) |

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

**URL extraction features:**
- Detects URLs with paths, query parameters, and fragments
- Deduplicates identical URLs
- Returns empty array `[]` when no URLs are present
- Domain names without protocol prefixes (e.g., `example.com`) are **not** detected

**Example:**

Content: `"Visit https://example.com or www.test.org for more info"`

Result: `"urls": ["https://example.com", "http://www.test.org"]`

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
