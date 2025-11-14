#!/bin/bash

# Antiphishing API Test Scenarios
# This script tests various scenarios using cURL

# Don't exit on error - we want to run all tests
set +e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test header
print_test() {
    echo -e "\n${BOLD}$1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

# Function to print failure
print_failure() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Function to run test
run_test() {
    local test_name=$1
    local expected_status=$2
    local request_data=$3
    local check_response=$4

    ((TESTS_RUN++))
    print_test "Test $TESTS_RUN: $test_name"

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$request_data" \
        "$API_URL/analyze")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq "$expected_status" ]; then
        if [ -n "$check_response" ]; then
            if echo "$body" | grep -q "$check_response"; then
                print_success "Status: $http_code (expected), Response contains: $check_response"
            else
                print_failure "Status: $http_code (expected), but response doesn't contain: $check_response"
                echo "Response: $body"
            fi
        else
            print_success "Status: $http_code (expected)"
        fi
    else
        print_failure "Status: $http_code (expected: $expected_status)"
        echo "Response: $body"
    fi
}

# Start tests
echo -e "${BOLD}=== Antiphishing API Test Scenarios ===${NC}"
echo "Testing API at: $API_URL"

# Test 1: Valid request with English content
run_test "Valid request - English content" 200 '{
  "parentID": "123e4567-e89b-12d3-a456-426614174000",
  "customerID": "123e4567-e89b-12d3-a456-426614174001",
  "senderID": "john@example.com",
  "content": "Hello, this is a test message in English. We are testing the language detection system.",
  "messageID": "123e4567-e89b-12d3-a456-426614174002"
}' '"language":"eng"'

# Test 2: Valid request with French content
run_test "Valid request - French content" 200 '{
  "parentID": "223e4567-e89b-12d3-a456-426614174000",
  "customerID": "223e4567-e89b-12d3-a456-426614174001",
  "senderID": "jean@example.com",
  "content": "Bonjour, ceci est un message de test en français. Nous testons le système de détection de langue.",
  "messageID": "223e4567-e89b-12d3-a456-426614174002"
}' '"language":"fra"'

# Test 3: Valid request with Dutch content
run_test "Valid request - Dutch content" 200 '{
  "parentID": "323e4567-e89b-12d3-a456-426614174000",
  "customerID": "323e4567-e89b-12d3-a456-426614174001",
  "senderID": "jan@example.com",
  "content": "Hallo, dit is een testbericht in het Nederlands. We testen het taaldetectiesysteem.",
  "messageID": "323e4567-e89b-12d3-a456-426614174002"
}' '"language":"nld"'

# Test 4: Valid request with Polish content
run_test "Valid request - Polish content" 200 '{
  "parentID": "423e4567-e89b-12d3-a456-426614174000",
  "customerID": "423e4567-e89b-12d3-a456-426614174001",
  "senderID": "jan@example.com",
  "content": "Witaj, to jest testowa wiadomość w języku polskim. Testujemy system wykrywania języka.",
  "messageID": "423e4567-e89b-12d3-a456-426614174002"
}' '"language":"pol"'

# Test 5: Valid request with Spanish content
run_test "Valid request - Spanish content" 200 '{
  "parentID": "523e4567-e89b-12d3-a456-426614174000",
  "customerID": "523e4567-e89b-12d3-a456-426614174001",
  "senderID": "jose@example.com",
  "content": "Hola, este es un mensaje de prueba en español. Estamos probando el sistema de detección de idiomas.",
  "messageID": "523e4567-e89b-12d3-a456-426614174002"
}' '"language":"spa"'

# Test 6: Cache hit scenario - same content twice
print_test "Test $((TESTS_RUN + 1)): Cache hit scenario"
((TESTS_RUN++))

unique_content="This is a unique message for cache testing at $(date +%s%N)"
request_data='{
  "parentID": "623e4567-e89b-12d3-a456-426614174000",
  "customerID": "623e4567-e89b-12d3-a456-426614174001",
  "senderID": "cache@example.com",
  "content": "'"$unique_content"'",
  "messageID": "623e4567-e89b-12d3-a456-426614174002"
}'

# First request - should not be cached
response1=$(curl -s -X POST -H "Content-Type: application/json" -d "$request_data" "$API_URL/analyze")
cached1=$(echo "$response1" | grep -o '"cached":[^,]*' | cut -d: -f2)

# Second request - should be cached
response2=$(curl -s -X POST -H "Content-Type: application/json" -d "$request_data" "$API_URL/analyze")
cached2=$(echo "$response2" | grep -o '"cached":[^,]*' | cut -d: -f2)

if [ "$cached1" == "false" ] && [ "$cached2" == "true" ]; then
    print_success "First request not cached, second request cached"
else
    print_failure "Cache behavior incorrect (cached1: $cached1, cached2: $cached2)"
fi

# Test 7: Invalid request - missing parentID
run_test "Invalid request - missing parentID" 400 '{
  "customerID": "723e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Test message",
  "messageID": "723e4567-e89b-12d3-a456-426614174002"
}' '"statusCode":400'

# Test 8: Invalid request - invalid UUID for parentID
run_test "Invalid request - invalid parentID UUID" 400 '{
  "parentID": "invalid-uuid",
  "customerID": "823e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Test message",
  "messageID": "823e4567-e89b-12d3-a456-426614174002"
}' '"statusCode":400'

# Test 9: Invalid request - missing content
run_test "Invalid request - missing content" 400 '{
  "parentID": "923e4567-e89b-12d3-a456-426614174000",
  "customerID": "923e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "messageID": "923e4567-e89b-12d3-a456-426614174002"
}' '"statusCode":400'

# Test 10: Invalid request - content too long (> 2000 chars)
long_content=$(printf 'a%.0s' {1..2001})
run_test "Invalid request - content exceeds 2000 characters" 400 '{
  "parentID": "a23e4567-e89b-12d3-a456-426614174000",
  "customerID": "a23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "'"$long_content"'",
  "messageID": "a23e4567-e89b-12d3-a456-426614174002"
}' '"statusCode":400'

# Test 11: Valid request - content with exactly 2000 characters
exact_content=$(printf 'a%.0s' {1..2000})
run_test "Valid request - content exactly 2000 characters" 200 '{
  "parentID": "b23e4567-e89b-12d3-a456-426614174000",
  "customerID": "b23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "'"$exact_content"'",
  "messageID": "b23e4567-e89b-12d3-a456-426614174002"
}' '"status":"safe"'

# Test 12: Invalid request - empty senderID
run_test "Invalid request - empty senderID" 400 '{
  "parentID": "c23e4567-e89b-12d3-a456-426614174000",
  "customerID": "c23e4567-e89b-12d3-a456-426614174001",
  "senderID": "",
  "content": "Test message",
  "messageID": "c23e4567-e89b-12d3-a456-426614174002"
}' '"statusCode":400'

# Test 13: URL detection - http URL
run_test "URL detection - http URL" 200 '{
  "parentID": "d23e4567-e89b-12d3-a456-426614174000",
  "customerID": "d23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Visit http://example.com for more information",
  "messageID": "d23e4567-e89b-12d3-a456-426614174002"
}' '"urls":\["http://example.com"\]'

# Test 14: URL detection - https URL
run_test "URL detection - https URL" 200 '{
  "parentID": "e23e4567-e89b-12d3-a456-426614174000",
  "customerID": "e23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Secure site at https://secure.example.com",
  "messageID": "e23e4567-e89b-12d3-a456-426614174002"
}' '"urls":\["https://secure.example.com"\]'

# Test 15: URL detection - www URL
run_test "URL detection - www URL" 200 '{
  "parentID": "f23e4567-e89b-12d3-a456-426614174000",
  "customerID": "f23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Check out www.example.org today",
  "messageID": "f23e4567-e89b-12d3-a456-426614174002"
}' '"urls":\["http://www.example.org"\]'

# Test 16: URL detection - multiple URLs
run_test "URL detection - multiple URLs" 200 '{
  "parentID": "023e4567-e89b-12d3-a456-426614174000",
  "customerID": "123e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Visit https://example.com or http://test.org and www.sample.net",
  "messageID": "223e4567-e89b-12d3-a456-426614174002"
}' '"urls":\['

# Test 17: URL detection - no URLs
run_test "URL detection - no URLs" 200 '{
  "parentID": "323e4567-e89b-12d3-a456-426614174000",
  "customerID": "423e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "This is a message without any URLs",
  "messageID": "523e4567-e89b-12d3-a456-426614174002"
}' '"urls":\[\]'

# Test 18: URL detection - bare domain
run_test "URL detection - bare domain" 200 '{
  "parentID": "623e4567-e89b-12d3-a456-426614174000",
  "customerID": "723e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Visit example.com for more information",
  "messageID": "823e4567-e89b-12d3-a456-426614174002"
}' '"urls":\["http://example.com"\]'

# Test 19: URL detection - multiple bare domains
run_test "URL detection - multiple bare domains" 200 '{
  "parentID": "923e4567-e89b-12d3-a456-426614174000",
  "customerID": "a23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Check example.com, test.org, and demo.net",
  "messageID": "b23e4567-e89b-12d3-a456-426614174002"
}' '"urls":\['

# Test 20: URL detection - email should not be detected
run_test "URL detection - email not detected" 200 '{
  "parentID": "c23e4567-e89b-12d3-a456-426614174000",
  "customerID": "d23e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Contact support@example.com for help",
  "messageID": "e23e4567-e89b-12d3-a456-426614174002"
}' '"urls":\[\]'

# Test 21: Phone detection - phone with dashes
run_test "Phone detection - phone with dashes" 200 '{
  "parentID": "f23e4567-e89b-12d3-a456-426614174000",
  "customerID": "023e4567-e89b-12d3-a456-426614174001",
  "senderID": "test@example.com",
  "content": "Call us at +1-202-456-1111 for support",
  "messageID": "123e4567-e89b-12d3-a456-426614174002"
}' '"phones":\["+12024561111"\]'

# Test 22: Phone detection - phone with dots
run_test "Phone detection - phone with dots" 200 '{
  "parentID": "023e4567-e89b-12d3-a456-426614174010",
  "customerID": "123e4567-e89b-12d3-a456-426614174011",
  "senderID": "test@example.com",
  "content": "Contact +1.202.456.1111 today",
  "messageID": "223e4567-e89b-12d3-a456-426614174012"
}' '"phones":\["+12024561111"\]'

# Test 23: Phone detection - phone with parentheses
run_test "Phone detection - phone with parentheses" 200 '{
  "parentID": "323e4567-e89b-12d3-a456-426614174010",
  "customerID": "423e4567-e89b-12d3-a456-426614174011",
  "senderID": "test@example.com",
  "content": "Phone: +1 (202) 456-1111 for assistance",
  "messageID": "523e4567-e89b-12d3-a456-426614174012"
}' '"phones":\["+12024561111"\]'

# Test 24: Phone detection - multiple phone numbers
run_test "Phone detection - multiple phone numbers" 200 '{
  "parentID": "623e4567-e89b-12d3-a456-426614174010",
  "customerID": "723e4567-e89b-12d3-a456-426614174011",
  "senderID": "test@example.com",
  "content": "Call +1-202-456-1111 or +44-20-7946-0958",
  "messageID": "823e4567-e89b-12d3-a456-426614174012"
}' '"phones":\['

# Test 25: Phone detection - no phones
run_test "Phone detection - no phones" 200 '{
  "parentID": "923e4567-e89b-12d3-a456-426614174010",
  "customerID": "a23e4567-e89b-12d3-a456-426614174011",
  "senderID": "test@example.com",
  "content": "This message has no phone numbers at all",
  "messageID": "b23e4567-e89b-12d3-a456-426614174012"
}' '"phones":\[\]'

# Test Health Endpoints
print_test "Test $((TESTS_RUN + 1)): Health check endpoint"
((TESTS_RUN++))
health_response=$(curl -s -w "\n%{http_code}" "$API_URL/health")
health_code=$(echo "$health_response" | tail -n1)

if [ "$health_code" -eq 200 ]; then
    print_success "Health endpoint returned 200"
else
    print_failure "Health endpoint returned $health_code (expected 200)"
fi

print_test "Test $((TESTS_RUN + 1)): Readiness check endpoint"
((TESTS_RUN++))
readiness_response=$(curl -s -w "\n%{http_code}" "$API_URL/health/readiness")
readiness_code=$(echo "$readiness_response" | tail -n1)

if [ "$readiness_code" -eq 200 ]; then
    print_success "Readiness endpoint returned 200"
else
    print_failure "Readiness endpoint returned $readiness_code (expected 200)"
fi

print_test "Test $((TESTS_RUN + 1)): Liveness check endpoint"
((TESTS_RUN++))
liveness_response=$(curl -s -w "\n%{http_code}" "$API_URL/health/liveness")
liveness_code=$(echo "$liveness_response" | tail -n1)

if [ "$liveness_code" -eq 200 ]; then
    print_success "Liveness endpoint returned 200"
else
    print_failure "Liveness endpoint returned $liveness_code (expected 200)"
fi

# Print summary
echo -e "\n${BOLD}=== Test Summary ===${NC}"
echo -e "Tests run: $TESTS_RUN"
echo -e "${GREEN}Tests passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}Some tests failed! ✗${NC}"
    exit 1
fi
