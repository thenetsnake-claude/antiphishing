# Test Scenarios Script - Example Output

This document shows example output from the enhanced test-scenarios.sh script with verbose request/response display.

## Example Test Execution

```bash
$ ./scripts/test-scenarios.sh
```

### Sample Output:

```
=== Antiphishing API Test Scenarios ===
Testing API at: http://localhost:3000

Test 1: Valid request - English content
Request:
{
  "parentID": "123e4567-e89b-12d3-a456-426614174000",
  "customerID": "123e4567-e89b-12d3-a456-426614174001",
  "senderID": "john@example.com",
  "content": "Hello, this is a test message in English. We are testing the language detection system.",
  "messageID": "123e4567-e89b-12d3-a456-426614174002"
}

Response (HTTP 200):
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "eng",
    "lang_certainity": 98.5,
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
      "phones": [],
      "public_ips": [],
      "shortener_used": []
    }
  }
}

✓ Status: 200 (expected), Response contains: "language":"eng"

Test 33: URL shortener - shortener_used field present
Request:
{
  "parentID": "f23e4567-e89b-12d3-a456-426614174010",
  "customerID": "023e4567-e89b-12d3-a456-426614174011",
  "senderID": "test@example.com",
  "content": "No shortened URLs in this message: https://example.com",
  "messageID": "123e4567-e89b-12d3-a456-426614174012"
}

Response (HTTP 200):
{
  "status": "safe",
  "certainity": 0,
  "message": "no analysis",
  "customer_whitelisted": false,
  "analysis": {
    "language": "eng",
    "lang_certainity": 95.2,
    "cached": false,
    "processing_time_ms": 52,
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
      "urls": ["https://example.com"],
      "phones": [],
      "public_ips": [],
      "shortener_used": []
    }
  }
}

✓ Status: 200 (expected), Response contains: "shortener_used":[]
```

## Features

- **Full Request Display**: Every request is shown with proper JSON formatting
- **Full Response Display**: Every response is shown with proper JSON formatting
- **HTTP Status Codes**: Displayed in the response header
- **Color Coding**: Green checkmarks for passing tests, red X for failures
- **Validation**: Automatic validation of expected HTTP status and response content
- **JSON Formatting**: Uses `jq` if available for pretty-printing, falls back to raw output

## Benefits

1. **Visual Inspection**: See exactly what's being sent and received
2. **Debugging**: Quickly identify issues with request/response format
3. **Documentation**: Output can be copied for documentation examples
4. **Verification**: Confirm that new fields like `shortener_used` appear correctly
5. **API Evolution**: Track how responses change as the API evolves
