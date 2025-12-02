# Git Platform Integration - Task 6 Complete

## Summary

Successfully implemented Task 6: 错误处理和重试机制 (Error Handling and Retry Mechanism) for the Git Platform Integration feature.

## What Was Implemented

### 1. Git Sync Error Classification System

**File**: `packages/services/business/src/gitops/git-sync/git-sync-errors.ts`

Created a comprehensive error classification system with the following components:

#### Error Types (GitSyncErrorType)
- `AUTHENTICATION` - Token invalid or expired
- `NETWORK` - Connection failures or timeouts
- `RATE_LIMIT` - API rate limit exceeded
- `CONFLICT` - Resource already exists or name conflict
- `PERMISSION` - Insufficient token permissions
- `NOT_FOUND` - Repository or user not found
- `UNKNOWN` - Unclassified errors

#### Error Classes

**Base Class: GitSyncError**
- Stores error type, provider, retryability, status code
- `getUserMessage()` - Returns user-friendly error messages
- `getRetryDelay()` - Calculates appropriate retry delay based on error type

**Specialized Error Classes:**
1. **GitAuthenticationError** - Authentication failures
   - Not retryable (requires user action)
   
2. **GitNetworkError** - Network connectivity issues
   - Retryable with 5-second delay
   
3. **GitRateLimitError** - API rate limit exceeded
   - Retryable after rate limit reset time
   - Calculates exact delay until reset
   
4. **GitConflictError** - Resource conflicts
   - Not retryable (requires manual resolution)
   
5. **GitPermissionError** - Insufficient permissions
   - Not retryable (requires token update)
   
6. **GitNotFoundError** - Resource not found
   - Not retryable (resource doesn't exist)

#### Error Classification Functions

**`classifyGitError(provider, statusCode, responseBody, originalError)`**
- Classifies errors based on HTTP status codes:
  - 401 → Authentication error
  - 403 → Permission or rate limit error
  - 404 → Not found error
  - 409/422 → Conflict error
  - 5xx → Network/server error

**`classifyError(provider, error)`**
- Classifies errors from various sources:
  - Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
  - HTTP response errors
  - Generic error objects

**`shouldRetry(error, attemptCount, maxAttempts)`**
- Determines if an error should be retried
- Checks attempt count and error retryability

**`calculateBackoffDelay(attemptCount, baseDelay, maxDelay)`**
- Implements exponential backoff: `baseDelay * 2^attemptCount`
- Adds random jitter (±20%) to avoid thundering herd
- Caps at maximum delay

### 2. Enhanced Worker Error Handling

**File**: `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`

Added `handleSyncError()` method:
- Classifies errors using the error classification system
- Updates sync logs with detailed error information
- Stores error metadata (type, retryability, status code)
- Logs structured error information for debugging

### 3. Module Exports

**File**: `packages/services/business/src/gitops/git-sync/index.ts`
- Exported all error classes and utility functions
- Available for use in other modules

## Error Handling Flow

```
API Call Fails
    ↓
classifyError() / classifyGitError()
    ↓
Determine Error Type
    ↓
Check if Retryable
    ↓
Calculate Retry Delay
    ↓
Update Sync Log with Error Details
    ↓
BullMQ Automatic Retry (if retryable)
    or
Mark as Failed (if not retryable)
```

## Error Type Handling Matrix

| Error Type | Retryable | Default Delay | User Action Required |
|------------|-----------|---------------|---------------------|
| Authentication | ❌ No | N/A | Reconnect Git account |
| Network | ✅ Yes | 5s | Wait for network |
| Rate Limit | ✅ Yes | Until reset | Wait for rate limit reset |
| Conflict | ❌ No | N/A | Resolve conflict manually |
| Permission | ❌ No | N/A | Update token permissions |
| Not Found | ❌ No | N/A | Check configuration |
| Unknown | ✅ Yes | 2s | Review error details |

## Retry Strategy

### Exponential Backoff
- Base delay: 2 seconds
- Formula: `baseDelay * 2^attemptCount`
- Maximum delay: 60 seconds
- Jitter: ±20% random variation

### Example Retry Delays
- Attempt 1: ~2s (1.6s - 2.4s with jitter)
- Attempt 2: ~4s (3.2s - 4.8s with jitter)
- Attempt 3: ~8s (6.4s - 9.6s with jitter)

### BullMQ Integration
Already configured in Task 5:
```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
}
```

## User-Friendly Error Messages

The system provides localized, actionable error messages:

- **Authentication**: "GitHub/GitLab 认证失败，请重新连接账户"
- **Network**: "网络连接失败，请检查网络后重试"
- **Rate Limit**: "GitHub/GitLab API 调用频率超限，请稍后重试"
- **Conflict**: "资源冲突，可能已存在同名资源"
- **Permission**: "GitHub/GitLab Token 权限不足，请检查权限配置"
- **Not Found**: "资源不存在，请检查配置"

## Sync Log Metadata

Enhanced sync logs now include:
```typescript
metadata: {
  attemptCount: number
  lastAttemptAt: Date
  errorType: GitSyncErrorType
  retryable: boolean
  statusCode?: number
  gitApiResponse?: any
}
```

## Requirements Validated

✅ **Requirement 10.1**: Error classification (authentication, network, rate limit, conflict)
✅ **Requirement 10.2**: Exponential backoff retry strategy
✅ **Requirement 10.3**: Rate limit handling with automatic retry
✅ **Requirement 10.4**: Network error retry with exponential backoff
✅ **Requirement 6.2**: Detailed sync log recording

## Benefits

1. **Better User Experience**
   - Clear, actionable error messages
   - Users know what action to take

2. **Improved Reliability**
   - Automatic retry for transient errors
   - Smart backoff prevents API abuse

3. **Better Debugging**
   - Detailed error classification
   - Structured error metadata in logs

4. **Reduced Support Load**
   - Self-explanatory error messages
   - Automatic recovery from transient issues

## Next Steps

Task 7 will integrate this error handling into the ProjectMembersService to automatically trigger Git sync when members are added/removed/updated.

## Files Created/Modified

### Created:
- `packages/services/business/src/gitops/git-sync/git-sync-errors.ts`

### Modified:
- `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`
- `packages/services/business/src/gitops/git-sync/index.ts`

## Date

December 1, 2025
